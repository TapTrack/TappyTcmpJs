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
For communicating with TappyUSB devices connected using the Chrome serial port, 
use the TappyChromeSerialCommunicator package found under @taptrack/tappy-chromeserialcomm 
or tappy-chromeserialcomm depending on whether you are using NPM or Bower.

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

    // A command must implement getCommandFamily(), getCommandCode(), and getPayload()
    // returning Uint8Arrays of length 2, 1, and 0-n bytes respectively
    tappy.sendMsg(command);
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
        // errorTypes: found in Tappy.ErrorType
        // data: either an object containing further information
        // or nothing in the case of NOT_CONNECTED
    };

    tappy.setErrorListener(listener);
    // Can also be set when you initialize the tappy
    // var tappy = new Tappy({communicator: comm, errorListener: listener});
```
