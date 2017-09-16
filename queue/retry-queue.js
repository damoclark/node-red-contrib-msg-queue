/**
 * queue.js
 *
 * Main project file
 *
 * node-red-contrib-msg-queue
 *
 * 23/5/17
 *
 * Copyright (C) 2017 Damien Clark (damo.clarky@gmail.com)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

module.exports = function (RED) {
	"use strict";

	var Queue = require('node-persistent-queue') ;
	var shallowequal = require('shallowequal') ;

	function QueueNode(config) {
		RED.nodes.createNode(this, config);

		this.name = config.name || 'Retry Queue' ;
		this.ack_mode = config.ack_mode ;
		this.timeout = config.timeout * 1000 ;
		this.sqlite = config.sqlite;
		this.connectedMatch = config.connected;
		this.connectedMatchType = config.connectedType;
		this.disconnectedMatch = config.disconnected;
		this.disconnectedMatchType = config.disconnectedType;

		/**
		 * Hash of timeout objects keyed by the queue_id
		 */
		var timeouts = {} ;

		/**
		 * Node Red Status Message
		 * @typedef {Object} NodeStatus
		 * @property {string} fill Colour of the status icon
		 * @property {string} shape Shape of icon whether ring or dot
		 * @property {string} text Text explaining status
		 */

		/**
		 * Instance of this node
		 * @type {QueueNode}
		 */
		var node = this;

		/**
		 * The status of the connection for the downstream node
		 * @type {boolean} isConnected === true, otherwise false
		 */
		var isConnected = false;

		/**
		 * Store status msg object received while sqlite waiting on I/O opening the DB
		 * @type {Array}
		 */
		var initStateMsgs = [] ;

		/**
		 * Store msg objects received while sqlite waiting on I/O opening the DB
		 * @type {Array}
		 */
		var initMsgs = [] ;

		/**
		 * Function that is called every second to update the status of the node
		 * @type {Function}
		 */
		var statusTimer = null ;

		/**
		 * Copy of last status message sent - if new status is different then send
		 * @type {NodeStatus}
		 */
		var status = {} ;

		// Generate error if filename to sqlite db not provided
		if(node.sqlite === undefined || node.sqlite == '') {
			node.error("No filename specified for the queue SQLite DB") ;
		}

		/**
		 * Queue
		 * @type {PersistentQueue}
		 */
		var queue = new Queue(this.sqlite) ;

		// Send messages from the queue downstream
		queue.on('next',function(job) {
			var msg = job.job ;
			msg.queue_id = job.id ;
			node.send(msg) ;
			queue.done() ;
		}) ;

		// Log when messages are being sent from queue
		queue.on('start',function() {
			if(!queue.isEmpty()) {
				statusOutput();
			}
			setStatusTimer() ;
			node.log('Processing messages in queue') ;
		}) ;

		// Log when messages being stored in queue
		queue.on('stop',function() {
			setStatusTimer() ;
			node.log('Queue processing stopped') ;
		}) ;

		// Log when queue is empty
		queue.on('empty',function() {
			statusOutput() ;
			setStatusTimer() ;
			node.log('Queue now empty') ;
			queue.stop() ;
		}) ;

		queue.on('add',function(job) {
			setStatusTimer();
			// If the queue isn't started (processing jobs from previous session)
			// send msg now
			if(!queue.isStarted()) {
				var msg = job.job;
				msg.queue_id = job.id;
				reSend(msg);
			}
		}) ;

		// On node close, close the queue
		node.on('close', function (done) {
			if(statusTimer) {
				clearInterval(statusTimer) ;
				statusTimer = null ;
			}

			if(queue.isOpen()) {
				queue.close()
				.then(function() {
					done() ;
				})
				.catch(function(err) {
					done(err) ;
				}) ;
			} else {
				done() ;
			}
		});

		// Temporary event handler for processing messages while sqlite still opening DB
		// This prevents race conditions from occurring and messages being lost during the asynchronous
		// call of sqlite opening the db file
		node.on('input',initialMsgs) ;

		/**
		 * Recusive function to re/send message when in ack/nack mode
		 * @param {object} msg Message object containing queue_id
		 */
		function reSend(msg) {
			node.send(msg) ;
			console.log('reSend message with id='+msg.queue_id) ;
			timeouts[msg.queue_id] = setTimeout(function() {
				console.log('timeout occurred for id='+msg.queue_id) ;
				if(node.ack_mode === 'ack') {
					// No acknowledgement, so resend
					console.log('resending message using reSend for id='+msg.queue_id) ;
					reSend(msg) ;
				}
				else { // must be nack mode
					console.log('deleting from queue id='+msg.queue_id) ;
					// Haven't received a nack so must have sent okay, so delete from queue
					queue.delete(msg.queue_id) ; // Returns a promise
					statusOutput() ;
				}
			},node.timeout).unref() ; // TODO Make this retry period configurable in UI
		}

		/**
		 * Start/stop sending node status updates based on state of node
		 *
		 * If downstream node is disconnected or its connected but the queue isnt empty
		 * then we will send status updates for our node reflecting the change in number
		 * of msgs in the queue
		 *
		 * Otherwise, we stop updating our status (as the number of msgs wont change)
		 */
		function setStatusTimer() {
			if(!queue.isEmpty()) {
				if(!statusTimer)
					statusTimer = setInterval(statusOutput,500) ;
			} else if(statusTimer) {
				clearInterval(statusTimer) ;
				statusTimer = null ;
			}
		}

		/**
		 * Function that outputs the status of the node on a timer
		 */
		function statusOutput() {
			// set status to: processing, storing, forwarding
			// processing = Green/Ring
			// !queue.isEmpty() && isConnected
			//
			// storing = Yellow/Ring
			// !isConnected
			//
			// forwarding = Green/Dot
			// queue.isEmpty() && isConnected
			var remaining = " (" + queue.getLength() + ")" ;

			var s = {
				fill:"green", shape:"ring", text:"Processing" + remaining
			} ;

			// Only update our status if it has changed
			if(!shallowequal(s,status))
				node.status(s) ;

			status = s ;
		}

		/**
		 * Store the latest 'status' message during initialisation of node
		 *
		 * Store the latest 'status' message while waiting for sqlite to open the db file.
		 *
		 * @param msg Messages received while sqlite still initialising
		 */
		function initialMsgs(msg) {
			initMsgs.push(msg) ;
		}



		/**
		 * Determine the status based on 'status' msg
		 *
		 * This function is passed a msg object with a 'status' property and processes it to determine
		 * whether the status is connected or not according to the user configuration
		 *
		 * @param {Object} msg Message passed from upstream nodes
		 * @param {Object} msg.status The status of the downstream node
		 */
		function processAcknowledgement(msg) {
			// Clear any pending timeouts for this msg
			clearTimeout(timeouts[msg.queue_id]) ;
			delete timeouts[msg.queue_id] ;
			if(node.ack_mode === 'ack') {
				// Delete msg from queue as its received
				queue.delete(msg.queue_id) ; // Returns a promise
			}
			else { // nack
				// Resend message (this will add another timeout)
				setTimeout(function(){
					reSend(msg) ;
				},node.timeout).unref() ;
			}
			// status message update
			statusOutput() ;
		}

		// Open the database
		queue.open()
		.then(function() {
			node.log("Opened " + node.sqlite + " successfully.") ;
		})
		.catch(function(err) {
			node.error("Queue failed to open " + node.sqlite, err);
			// @todo Check does this handle sqlite open error condition accordingly to node-red framework
		}) ;

		// Once the sqlite db is open, set our event handlers for messages
		queue.on('open',function() {
			node.removeListener('input',initialMsgs) ; // Initial state listener not needed now

			// Add these initial messages to the queue, so we can be sure they are passed on first, no matter
			// what the initial state of the queue is
			if(initMsgs.length > 0) {
				initMsgs.forEach(function(m){queue.add(m);}) ;
				initMsgs = [] ;
			}

			// Update our node status after db opened
			statusOutput() ;

			// Once the queue has been opened, we can start listening for input from node-red
			node.on('input', function (msg) {

				// ack/nack message
				if (msg.hasOwnProperty('queue_id')) {
					// TODO Set timer to retry if 'nack' or delete from queue if 'ack'
					processAcknowledgement(msg) ;
					return ;
				}

				// Add to queue (which will also send it)
				queue.add(msg) ;
			});
			if(!queue.isEmpty())
				queue.start() ;
		}) ;
	}
	RED.nodes.registerType('retry-queue', QueueNode);
};