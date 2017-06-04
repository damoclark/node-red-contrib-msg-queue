# node-red-contrib-msg-queue

A contributed Node-RED node, that queues undeliverable messages to file for later delivery.

This node is most valuable for Node-RED installations that have unreliable network connectivity.
Messages that can't be delivered, are instead queued on disk until communications are again
restored. 

## Overview
If an outbound Node-Red node, such as an MQTT node goes offline, subsequent messages are
lost until the node reconnects.  By wiring a `Queue` node ahead of the outbound
node, and wiring status messages into `Queue`, undeliverable messages will instead be queued
to a local file.  

![example-flow](https://raw.githubusercontent.com/damoclark/node-red-contrib-msg-queue/master/examples/example-flow.gif)

When the outbound node reconnects, `Queue` will forward on messages from the
queue in the same order they were received, until the queue becomes empty
or the outbound node again goes offline.  While `Queue` drains the queue of messages, any new
messages that arrive are appended to the queue to ensure ordered delivery is maintained.

Once the queue becomes empty, and the outbound node is still connected, `Queue` will again 
forward on messages and bypass the queue storage entirely.  

## Installation

Install `node-red-contrib-msg-queue` by following the
[adding nodes](http://nodered.org/docs/getting-started/adding-nodes)
instructions from the
[Node-RED Getting Started Documentation](http://nodered.org/docs/getting-started/).

The following instructions use [npm](https://www.npmjs.com/) at the command line.

```bash
cd $HOME/.node-red
npm install node-red-contrib-msg-queue
```

## Usage

To use the node, launch or re-launch Node-RED (see
[running Node-RED](http://nodered.org/docs/getting-started/running.html) for
help getting started).

An [example-flow.json](https://raw.githubusercontent.com/damoclark/node-red-contrib-msg-queue/master/examples/example-flow.json) 
is available that matches the illustration in the overview.  You can copy and paste this flow 
into Node-RED and tinker to get a feel for how it works.

Or if you prefer, read the following explanation and view the screen shot.

### Queue Configuration

The `Connected Status Matches` section is a regular expression `^connected` which
matches all status text messages that start with *connected*.  In addition to regular
expressions, you can also specify a simple substring match.  Because there is no
value specified to match `Disconnected Status Matches`, any message that doesn't
match `^connected` will be deemed a disconnected state.  

Conversely, if a `Disconnected Status Matches` value is provided, but not for
`Connected Status Matches`, then any status text that does not match will be
deemed a connected state.  

Finally, if both a `Connected Status Matches` and `Disconnected Status Matches` 
value is given, then any status text doesn't match either, will be ignored, and
the current state will remain.

![node-red-contrib-msg-queue config](https://raw.githubusercontent.com/damoclark/node-red-contrib-msg-queue/master/examples/node-red-contrib-msg-queue-edit.png)

You must also specify a filename for the sqlite database that stores queued
messages during a *disconnected* state.  This database file **must not** be
shared between multiple queue nodes.

## TODO

A [TODO List](TODO.md) of possible future features is included.  Contributions
welcome.

## Licence
Copyright (c) 2017 Damien Clark, [Damo's World](https://damos.world)<br/> <br/>
Licenced under the terms of the
[GPLv3](https://www.gnu.org/licenses/gpl.txt)<br/>
![GPLv3](https://www.gnu.org/graphics/gplv3-127x51.png "GPLv3")

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL DAMIEN CLARK BE LIABLE FOR ANY DIRECT,
INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

## Acknowledgements

Like others who stand on the shoulders of giants, I'd like to acknowledge
the contributions of the following people/groups without which, more directly,
this modest Node-RED node would not be possible.

* Creators of the [queue icon](https://commons.wikimedia.org/wiki/File:AWS_Simple_Icons_Messaging_Amazon_SQS_Queue.svg)
* Nick O'Leary and Dave Conway-Jones for creating [Node-Red](http://nodered.org/about/)
