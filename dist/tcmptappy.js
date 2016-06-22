(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define([], factory);
    } else if (typeof exports === 'object') {
        // Node, CommonJS-like
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.Tappy = factory();
    }
}(this, function () {
    /**
     * Convert an array of bytes into a hexadecimal representation
     */
    var toHexStr = function(byteArray) {
        return byteArray.map(function(byte) {
            return ('0' + (byte & 0xFF).toString(16)).slice(-2);
        }).join(' ').toUpperCase();
    };

    /**
     * This interface stuff is just for checking that objects quack like
     * a duck. It's pretty overkill in this this circumstance, but it
     * works fine, so there's no real impetus to replace it.
     */
    var interface = function(name,methods) {
        this.name = name;
        this.methods = [];

        for(var i = 0; i < methods.length; i++) {
            if(typeof methods[i] !== 'string') {
                throw new Error("Interface methods must be strings");
            }
            this.methods.push(methods[i]);
        }
    };
    
    interface.prototype = {
        getName: function() {
            return this.name;
        },
        getMethods: function() {
            return this.methods;
        }
    };

    interface.iInterface = new interface("iInterface",["getName","getMethods"]);

    interface.hasMethod = function(instance, method) {
        if(!instance[method] || typeof instance[method] !== 'function') {
            return false;
        } else {
            return true;
        }
    };

    interface.check = function(instance) {
        if(arguments.length < 2) {
            throw new Error("Must specify an instance as well as 1 or more interfaces to check");
        }
        for(var i = 1; i < arguments.length; i++) {
            var proto = arguments[i];

            var methods = proto.getMethods();
            for(var j = 0; j < methods.length; j++) {
                var method = methods[j];
                if(!interface.hasMethod(instance,method)) {
                    return false;
                }
            }
        }

        return true;
    };

    interface.typeErrorString = function(instance) {
        if(arguments.length < 2) {
            throw new Error("Must specify at least one instance and one interface");
        }
        var errorString = "Error, object "+instance.toString()+" must implement: ";
        for(var i = 1; i < arguments.length; i++) {
            var proto = arguments[i];
            if(!interface.check(proto,interface.iInterface)) {
                throw new Error("Must check against Interfaces");
            }
            else {
                var methods = proto.getMethods();
                var missingMethods = [];
                var fullMethods = [];
                for(var j = 0; j < methods.length; j++) {
                    fullMethods.push(methods[j]);
                    if(!interface.hasMethod(instance,methods[j])) {
                        missingMethods.push(methods[j]);
                    }
                }
                if(missingMethods.length > 0) {
                    errorString += "\n\t"+proto.getName()+" missing methods:\n\t\t";
                    errorString += missingMethods.join("\n\t\t");
                }

            }
        }
        return errorString;
    };

    /**
     * Tappy Communicator type
     *
     * @name TappyCommunicator
     * @object
     * @method {function(function(boolean))} connect
     * @method {function(function())} disconnect
     * @method {function() boolean} isConnected
     * @method {function(function(boolean)) flush
     * @method {function(function(Uint8Array)) setDataCallback
     * @method {function(function(object))} setErrorCallback
     * @method {function(Uint8Array)} send
     */
    var iCommunicator = new interface("iCommunicator",
            ['connect','disconnect','isConnected','flush',
            'setDataCallback','setErrorCallback','send']);
    /**
     * Tcmp message type
     *
     * @name TcmpMessage
     * @object
     * @method {function() Uint8Array} getCommandFamily 
     * @method {function() byte} getCommandCode
     * @method {function() Uint8Array} getPayload
     */
    var iTcmpMessage = new interface("iTcmpMessage",
            ['getCommandFamily','getCommandCode','getPayload']);
   
    /**
     * CRC Calculation code is kind of messy, ported from Java
     * code that was ported from C, probably should be cleaned
     * up eventually
     */
    var update_cr16 = function (crc, b) {
        var i = 0;
        var v = 0;
        var tcrc = 0;

        v = ((crc ^ b) & 0xff);
        for(i = 0; i < 8; i++) {
            tcrc = ((( (tcrc ^ v) & 1) !== 0) ? (tcrc >> 1) ^ 0x8408 : tcrc >>1);
            v >>= 1;
        }

        return (((crc >> 8) ^ tcrc) & 0xffff);
    };
    var calculateCRCBitwise = function(data) {
        var crc = 0x6363;
        for(var i = 0; i < data.length; ++i) {
            crc = update_cr16(crc, data[i]);
        }

        return [((crc>>8) & 0xFF),(crc & 0XFF)];
    };

    /**
     * Construct a TCMP packet without HDLC framing or escaping
     *
     * @param {Uint8Array} family two-byte command family
     * @param byte command command code 
     * @param {Uint8Array} payload payload to go into frame, must be provided
     * but may be of zero length
     * @return {Uint8Array} composed TCMP packet
     */
    var composeTcmp = function(family,command,payload) {
        var length = payload.length + 5;
        var l1 = ((length >> 8) & 0xff);
        var l2 = ((length) & 0xff);
        var lcs =  ((( 0xFF - (((l1 & 0xff) + (l2 & 0xff)) & 0xff)) + (0x01 & 0xff)) & 0xff);
        var partial = new Uint8Array(payload.length+6);
        partial[0] = l1;
        partial[1] = l2;
        partial[2] = lcs;
        partial[3] = family[0];
        partial[4] = family[1];
        partial[5] = command;
        for( var i = 0; i < payload.length; i++) {
            partial[6+i] = payload[i];
        }
        var crc = calculateCRCBitwise(partial);
        var packet = new Uint8Array(partial.length+2);
        packet.set(partial);
        packet[partial.length] = crc[0]; 
        packet[partial.length+1] = crc[1]; 
        return packet;
    };

    /**
     * Tcmp mesage
     * @class {RawTcmpMessage}
     */
    var RawTcmpMessage = function(family,code,payload) {
        var commandFamily = new Uint8Array(family);
        var commandCode = code;
        var payloadData = new Uint8Array(payload);

        /**
         * Get the command family
         * @method
         * @return {Uint8Array} 2-byte command family identifier
         */
        this.getCommandFamily = function () {
            return commandFamily;
        };

        /**
         * Get the command family
         * @method
         * @return {byte} command code
         */
        this.getCommandCode= function () {
            return commandCode;
        };
        
        /**
         * Get the packet payload
         * @method
         * @return {Uint8Array} payload contents (may be 0 length)
         */
        this.getPayload = function () {
            return payloadData;
        };
    };

    /**
     * Tcmp parser result
     * @name TcmpPacketParseResult
     * @object
     * @property {?RawTcmpMessage} msg the parsed TCMP message
     * @property {boolean} ok true if parsed successfully, else false
     * @property {?msg} English description of parse error if one occured
     */
    /**
     * Parse a TCMP packet out of raw bytes
     *
     * @param {Uint8Array} packet TCMP data after HDLC deframing
     * @return {TcmpPacketParseResult} result of the parse attempt
     */
    var decodeTcmp = function(packet) {
        
        if(packet.length < 8) {
            return {msg: null, ok: false, err: "Too short"};
        }
        
        var l1 = packet[0];
        var l2 = packet[1];
        var lcs = packet[2];
        var family = [packet[3],packet[4]];
        var code = packet[5];
        var crc = [packet[packet.length - 2],packet[packet.length - 1]];

        var partial = packet.slice(0,packet.length-2);
        var calcCrc = calculateCRCBitwise(partial);

        if(crc[0] !== calcCrc[0] || crc[1] !== calcCrc[1]) {
            return {msg: null, ok: false, err: "Bad CRC"};
        }
        
        var calcLcs = ((( 0xFF - (((l1 & 0xff) + (l2 & 0xff)) & 0xff)) + (0x01 & 0xff)) & 0xff);
        if(calcLcs != lcs) {
            return {msg: null, ok: false, err: "Bad LCS"};
        }
        
        var expectedLength = (l1 << 8) + l2;
        if(expectedLength !== (packet.length - 3)) {
            return {msg: null, ok: false, err: "Bad length, read "+expectedLength+" found "+(packet.length - 5)};
        }

        var payload = packet.slice(6,packet.length - 2);
        return {
            msg: new RawTcmpMessage(family,code,payload),
            ok: true,
            err: null
        };
    };

    /**
     * Wraps a TCMP packet in the HDLC-derived framing protocol, including
     * escaping any control bytes found in packet.
     * 
     * Note that this is not a full HDLC implementation and should
     * not be taken as such. It merely borrows some of the basic framing
     * concepts.
     *
     * @param {Uint8Array} packet the packet to frame
     * @return {Uint8Array} packet hdlc frame
     */
    var createHdlcFrame = function(packet) {
        var frame = [0x7E];
        for(var i = 0; i < packet.length; i++) {
            if(packet[i] === 0x7E) {
                frame.push(0x7D);
                frame.push(0x5E);
            }
            else if (packet[i] === 0x7D) {
                frame.push(0x7D);
                frame.push(0x5D);
            }
            else {
                frame.push(packet[i]);
            }
        }
        frame.push(0x7E);
        return new Uint8Array(frame);
    };

    /**
     * Hdlc unescaping/deframing result
     *
     * If deframing fails, this indicates that control bytes are found
     * in invalid positions such as an escape byte preceeding a non-control
     * byte.
     *
     * @name HdlcDeframingResult
     * @object
     * @property {Uint8Array} msg the parsed TCMP message
     * @property {boolean} ok true if deframed successfully, else false
     * if deframing fails, the contents of msg should be treated as 
     * undefined
     */
    /**
     * Deframe and unescape a potential HDLC frame
     *
     * @param {Uint8Array} packet packet contents
     * @return {HdlcDeframingResult}
     */
    var unescapeHdlc = function(packet) {
        var unescaped = [];
        var ok = true;
        for(var i = 0; i < packet.length; i++) {
            if(packet[i] === 0x7E) {
                // do nothing, this is a packet terminator
                // possibly should error if these
                // aren't in the correct place
            } else if(packet[i] === 0x7D) {
                if((i+1) > packet.length) {
                    ok = false;
                    break;
                } else if (packet[i+1] === 0x5D) {
                    unescaped.push(0x7D);
                    i++;
                } else if (packet[i+1] === 0x5E) {
                    unescaped.push(0x7E);
                    i++;
                } else {
                    ok = false;
                    break;
                }
            }
            else {
                unescaped.push(packet[i]);
            }
        }

        return {unescaped: new Uint8Array(unescaped), ok: ok};
    };


    /**
     * Determine if a param is present on an object and non-null
     * 
     * @param {object} obj object to check
     * @param {string} name name of param to check for
     * @return {boolean} true if param is present and non-null
     */
    var hasParam = function(obj,name) {
        return typeof obj === "object" && obj !== null && typeof obj[name] !== 'undefined';
    };

    /**
     * Get a property from an object or a default if the property is not
     * present on the object or is present, but === null
     * 
     * @param {object} obj object to check
     * @param {string} name name of property to check for
     * @param {*} def default value to return if property not found
     */
    var getValue = function(obj,name,def) {
        if(hasParam(obj,name)) {
            return obj[name];
        } else {
            return def;
        }
    };



    /**
     * Tappy Params
     * @name TappyParams
     * @property {TappyCommunicator} communicator communication interface with
     *      the tappy device
     * @property {?function(TcmpMessage)} messageListener message listener 
     *      callback
     * @property {?function(Tappy.ErrorType,?object)} errorListener error 
     *      listener object contains information about the error, may be 
     *      null, for instance in the case of NOT_CONNECTED
     */

    /**
     * Tappy
     * @param {TappyParams} parameters for constructing the tappy
     * @throws If a communicator is not supplied
     */
    var Tappy = function (params) {
        var self = this;
        if(hasParam(params,"communicator")) {
            var comm = params.communicator;
            if(!interface.check(comm,iCommunicator)) {
                throw new Error(interface.typeErrorString(comm,iCommunicator));
            } else {
                this.communicator = comm;
            }
        } else {
           throw new Error("Must supply a communicator"); 
        }
        this.messageListener = getValue(params,"messageListener",function() {});
        this.errorListener = getValue(params,"errorListener",function() {});
        this.buffer = [];

        this.dataCb = function(data) {
            var dataArr = new Uint8Array(data);
            for(var i = 0; i < dataArr.length; i++) {
                self.buffer.push(dataArr[i]);
                // Check for frame boundary byte
                if(dataArr[i] === 0x7E) {
                    // Chop frame out of buffer
                    var packet = self.buffer;
                    // reset buffer
                    self.buffer = [];
                    var hRes = unescapeHdlc(packet);
                    if(hRes.ok) {
                        if(hRes.unescaped.length > 0) {
                            var tRes = decodeTcmp(hRes.unescaped);
                            if(tRes.ok) {
                                self.messageListener(tRes.msg);
                            }
                            else {
                                self.errorListener(Tappy.ErrorType.INVALID_TCMP,{packet: packet, message: hRes.unescaped});
                            }
                        }
                    }
                    else {
                        self.errorListener(Tappy.ErrorType.INVALID_HDLC,{packet:packet});                
                    }
                }
            }
        };

        this.commErrorCb = function(data) {
            self.errorListener(Tappy.ErrorType.CONNECTION_ERROR,data);
        };

        this.communicator.setDataCallback(this.dataCb);
        this.communicator.setErrorCallback(this.commErrorCb);
    };

    /**
     * Object containing different communication error categorizations
     */
    Tappy.ErrorType = {
        /**
         * Attempted to send a message when communicator was in an
         * unconnected state
         */
        NOT_CONNECTED: 0x00,
        
        /**
         * Communicator reported that an error occured when message 
         * send was attempted
         */
        CONNECTION_ERROR: 0x01,
        
        /**
         * Data was received that violates the Tappy framing convention.
         * This generally occurs because a control byte was found in the
         * wrong place, perhaps due to communication bit corruption
         */
        INVALID_HDLC: 0x02,
        
        /**
         * Data was received that used the corrent Tappy HDLC framing,
         * but the contents were not parsable as a valid TCMP message
         */
        INVALID_TCMP: 0x03,
    };
    


    Tappy.prototype = {
        /**
         * Set the message listener for this Tappy. Replaces any
         * previously set listener.
         *
         * @param {function(TcmpMessage)} cb new listener
         */
        setMessageListener: function(cb) {
            var self = this;
            self.messageListener = cb;
        },
        /**
         * Send a tcmp message to the tappy
         *
         * @param {TcmpMessage} message message to send
         * @throws If message is not a valid TcmpMessage
         */
        sendMessage: function(message) {
            var self = this;
            var valid = interface.check(message,iTcmpMessage);
            if(!valid) {
                throw new Error(
                        interface.typeErrorString(message,iTcmpMessage));
            }
            if(self.isConnected()) {
                var packet = composeTcmp(message.getCommandFamily(),
                        message.getCommandCode(),
                        message.getPayload());
                var frame = createHdlcFrame(packet);
                self.communicator.send(frame.buffer);
            }
            else {
                self.errorListener(Tappy.ErrorType.NOT_CONNECTED);
            }
        },

        /** 
         * Set the error listener for the Tappy. Replaces any previously set 
         * listener.
         *
         * @param {?function(Tappy.ErrorType,?object)} errorListener error 
         *      listener object contains information about the error, may be 
         *      null, for instance in the case of NOT_CONNECTED
         */
        setErrorListener: function(cb) {
            var self = this;
            self.errorListener = cb;
        },
        
        /**
         * Convenience function for calling connect on the communicator
         * Technically speaking, you can call connect manually on the 
         * communicator instead, but this capability may not be persisted in
         * the future, so it should not be relied upon.
         *
         * @param {callback} cb Callback passed to communicator connect
         */
        connect: function(cb){
            var self = this;
            self.communicator.connect(cb);
        },
        
        /**
         * Convenience function for calling disconnect on the communicator
         * Technically speaking, you can call disconnect manually on the 
         * communicator instead, but this capability may not be persisted in
         * the future, so it should not be relied upon.
         *
         * @param {callback} cb Callback passed to communicator disconnect
         */
        disconnect: function(cb){
            var self = this;
            self.communicator.disconnect(cb);
        },
        
        /**
         * Determine if the backing communicator is in a connected state.
         * This should return the same value as calling isConnected directly
         * on the communicator, but this behaviour may not be persisted in
         * the future, so it should not be relied upon.
         *
         * @return {boolean} true if the backing communicator is in a 
         * connected state
         */
        isConnected: function() {
            var self = this;
            return self.communicator.isConnected();
        },
    };

    return Tappy;
}));
