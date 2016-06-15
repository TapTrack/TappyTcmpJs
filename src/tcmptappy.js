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
    var toHexStr = function(byteArray) {
        return byteArray.map(function(byte) {
            return ('0' + (byte & 0xFF).toString(16)).slice(-2);
        }).join(' ').toUpperCase();
    };

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


    var iCommunicator = new interface("iCommunicator",['connect','disconnect','isConnected','flush','setDataCallback','setErrorCallback','send']);
    var iTcmpMessage = new interface("iTcmpMessage",['getCommandFamily','getCommandCode','getPayload']);
    
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

    var decodeTcmp = function(packet) {
        var RawTcmp = function(family,code,payload) {
            this.family = new Uint8Array(family);
            this.code = code;
            this.payload = new Uint8Array(payload);
            this.getCommandFamily = function () {
                return this.family;
            };
            this.getCommandCode= function () {
                return this.code;
            };
            this.getPayload = function () {
                return this.payload;
            };
            
        };
        
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
            msg: new RawTcmp(family,code,payload),
            ok: true,
            err: null
        };
    };

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


    var hasParam = function(obj,name) {
        return typeof obj === "object" && obj !== null && typeof obj[name] !== 'undefined';
    };

    var getValue = function(obj,name,def) {
        if(hasParam(obj,name)) {
            return obj[name];
        } else {
            return def;
        }
    };

    /**
     * TcmpTappy~params
     * communicator: 
     * messageListener: message listener
     * errorListener: error listener
     */
    var TcmpTappy = function (params) {
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
                if(dataArr[i] === 0x7E) {
                    var packet = self.buffer;
                    self.buffer = [];
                    var hRes = unescapeHdlc(packet);
                    if(hRes.ok) {
                        if(hRes.unescaped.length > 0) {
                            var tRes = decodeTcmp(hRes.unescaped);
                            if(tRes.ok) {
                                self.messageListener(tRes.msg);
                            }
                            else {
                                self.errorListener(TcmpTappy.ErrorType.INVALID_TCMP,{packet: packet, message: hRes.unescaped});
                            }
                        }
                    }
                    else {
                        self.errorListener(TcmpTappy.ErrorType.INVALID_HDLC,{packet:packet});                
                    }
                }
            }
        };

        this.commErrorCb = function(data) {
            this.errorListener(TcmpTappy.ErrorType.CONNECTION_ERROR,data);
        };

        this.communicator.setDataCallback(this.dataCb);
        this.communicator.setErrorCallback(this.commErrorCb);
    };

    TcmpTappy.ErrorType = {
        NOT_CONNECTED: 0x00,
        CONNECTION_ERROR: 0x01,
        INVALID_HDLC: 0x02,
        INVALID_TCMP: 0x03,
    };
    


    TcmpTappy.prototype = {
        setMessageListener: function(cb) {
            this.messageListener = cb;
        },

        sendMessage: function(message) {
            var valid = interface.check(message,iTcmpMessage);
            if(!valid) {
                throw new Error(interface.typeErrorString(message,iTcmpMessage));
            }
            if(this.communicator.isConnected()) {
                var packet = composeTcmp(message.getCommandFamily(),
                        message.getCommandCode(),
                        message.getPayload());
                var frame = createHdlcFrame(packet);
                this.communicator.send(frame.buffer);
            }
            else {
                this.errorListener(TcmpTappy.ErrorType.NOT_CONNECTED);
            }
        },

        setErrorListener: function(cb) {
            this.errorListener = cb;
        },
        
        connect: function(cb){
            this.communicator.connect(cb);
        },
        disconnect: function(cb){
            this.communicator.disconnect(cb);
        },
        isConnected: function() {
            return this.communicator.isConnected();
        },
    };

    return TcmpTappy;
}));
