Driver for working with Tappy devices that use the TCMP protocol.

## Installation
NPM
```
npm install @taptrack/tappy
```

Bower
```
bower install tappy-tcmp
```

## Connecting to Tappies
In order to connect to a Tappy, you must supply it with a TappyCommunicator.

### NodeJS
For communicating with TappyUSB devices using the Node serialport driver, 
use the TappyNodeSerialCommunicator found under `@taptrack/tappynodeserialcommunicator`

```javascript
var comm = new NodeSerialCommunicator({path: "/dev/ttyUSB0"});
var tappy = new Tappy({communicator: comm});

tappy.connect(function() {
    console.log("Connected");
    tappy.disconnect(function() {
        console.log("Disconnected");
    });
});
```

### Chrome Packaged Apps
For communicating with TappyUSB devices connected in a Chrome packaged app, 
use the TappyChromeSerialCommunicator package found under 
`@taptrack/tappy-chromeserialcommiunicator` or 
`tappy-chromeserialcommunicator` depending on whether you are using NPM or 
Bower.

```javascript
var path = "/dev/ttyUSB0";
var comm = new TappyChromeSerialCommunicator(path);
// 
var tappy = new Tappy({communicator: comm});

tappy.connect(function (){
    console.log("Connected");
    tappy.disconnect(function() {
        console.log("Disconnected");
    });
});
```

## Sending Commands
Once you have connected to a Tappy, you can send it TCMP commands. There are several
families of commands supported by Tappies, but the most common to use  are the 
System family and the BasicNfc family.

```javascript
var command = new TappySystemFamily.Commands.Ping();

// A command must implement 
// getCommandCode() -> integer (0-255)
// getCommandFamily() -> Uint8Array (length: 2)
// getPayload() -> UintArray (length: 0-65530)
tappy.sendMessage(command);
```

## Receiving Commands
In order to receive communication from the Tappy, you must register a message listener.

```javascript
var listener = function(msg) {
    // msg will be an object that implements:
    // getCommandFamily() returning a Uint8Array of length 2
    // getCommandCode() returning a 0-255 value
    // getPayload() returning a Uint8Array of length 0->n
};

tappy.setMessageListener(listener);
// Can also be set when you initialize the tappy
// var tappy = new Tappy({communicator: comm, messageListener: listener});
```

## Detecting Errors
Errors that the Tappy experiences will be reported as standard responses using
response codes specified in their command family definitions. Similarly, client 
communication errors will be reported by responses in the System family. However, 
if the driver detects a serial port error or is receives an unparsable message 
from the Tappy, it reports the occurance through a second callback.

```javascript
var listener = function(errorType,data) {
    // errorTypes: found in Tappy.ErrorType, described below
    // data: either an object containing further information
    // or nothing in the case of NOT_CONNECTED
};

tappy.setErrorListener(listener);
// Can also be set when you initialize the tappy
// var tappy = new Tappy({communicator: comm, errorListener: listener});
```

### Error Types
`Tappy.ErrorType.NOT_CONNECTED`

Attempted to send a message when communicator was in an
unconnected state

`Tappy.ErrorType.CONNECTION_ERROR`

Communicator reported that an error occured when message 
send was attempted

`Tappy.ErrorType.INVALID_HDLC`

 Data was received that violates the Tappy framing convention.
 This generally occurs because a control byte was found in the
 wrong place, perhaps due to communication bit corruption

`Tappy.ErrorType.INVALID_TCMP`

Data was received that used the corrent Tappy HDLC framing,
but the contents were not parsable as a valid TCMP message

## Methods

### Tappy(params)
Create a new Tappy object to communicate with a Tappy device

**params (required)**

* `communicator (required)` A Tappy communicator for this Tappy object to
use to talk to the Tappy device. See 
[TappyNodeSerialCommunicator](https://github.com/TapTrack/TappyNodeSerialCommunicatorJs)
and
[TappyChromeSerialCommunicatorJs](https://github.com/TapTrack/TappyChromeSerialCommunicatorJs)

* `messageListener (optional)` Initial message listener callback, see 
`setMessageListener`

* `errorListener (optional)` Initial error listener callback, see 
`setErrorListener`


#### .setMessageListener(callback)
Sets the message listener for this Tappy. Note that a Tappy object can
only have one message listener at a time, so calling this will replace
the previous listener.

**callback (required)**
Callback should be of the form `function(msg) { ... }`

_msg_ TCMP message with the following methods:

* `getCommandFamily() -> Uint8Array` 2 byte command family ID
* `getCommandCode() -> integer` numerical command code 0-255
* `getPayload() -> Uint8Array` the payload the packet contained (may be of
length 0)

#### .setErrorListener(callback)
Sets the error listener for this Tappy. Note that a Tappy object can
only have one error listener at a time, so calling this will replace
the previous litener

**callback (required)**
Callback shoudl be of the form `function(errorType, data)`

_errorType_ One of values in Tappy.ErrorType

_data (optional)_ Additional content describing the error. The contents
and format of this object are not consistent. For instance, in the case 
of NOT\_CONNECTED no data is passed, while in the case of a 
CONNECTION\_ERROR, data will have contents that vary depending on the 
communicator in use.

#### .sendMessage(message)
Send a message to the Tappy. This method will throw if you attempt to send
a message that does not implement the appropriate methods. If a send is 
attempted when the Tappy's communicator is not connected, the message will
be discarded and the current error listener will be called with an error of
NOT\_CONNECTED.

**message (required)**  The message must implement the following methods:
* `getCommandFamily() -> Uint8Array` 2 byte command family ID
* `getCommandCode() -> integer` numerical command code 0-255
* `getPayload() -> Uint8Array` the payload the packet contained (may be of
length 0)


#### .connect(callback)
Informs the communicator to open the connection to the Tappy it handles.
Currently this is just a passthrough to the corresponding method on the 
communicator, but this characteristic may not be persisted in the future,
so `connect()` should generally be called on the Tappy, not the backing
communicator. 

**callback (optional)** The callback is passed straight through to the communicator
currently, so the connect callback format of the relevant communicator
should be consulted for additional information.

#### .disconnect(callback)
Informs the communicator to close the connection to the Tappy it handles.
Currently this is just a passthrough to the corresponding method on the 
communicator, but this characteristic may not be persisted in the future,
so `disconnect()` should generally be called on the Tappy, not the backing
communicator. 

**callback (optional)** The callback is passed straight through to the communicator
currently, so the disconnect callback format of the relevant communicator
should be consulted for additional information.

#### .isConnected()
Returns `true` if the Tappy is connected.
Currently this is just a passthrough to the corresponding method on the 
communicator, but this characteristic may not be persisted in the future,
so `isConnected()` should generally be called on the Tappy, not the backing
communicator. 
