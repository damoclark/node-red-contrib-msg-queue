# TODO

## Match connect or disconnect states based on status icons
Instead of matching the status text string to determine the state, use the icons, such as their colour
and their shape.

## Specify built in node types to match against
Frequently used nodes could be selected from a list in the config UI and queue will know how to 
detect the status based on the text status messages from those nodes.

## For stateless outbound nodes, have Queue take input from catch nodes
Some outbound nodes use stateless protocols such as UDP.  In these instances, there is no *connection*
state.  Some nodes, like [influxdb out](https://flows.nodered.org/node/node-red-contrib-influxdb) 
generate catch messages when an error occurs storing data in the influxdb instance.  Queue could 
*catch* these errors, and store them in a queue, and retry them later.
