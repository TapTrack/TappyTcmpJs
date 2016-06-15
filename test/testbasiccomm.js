describe("Test tappy communication",function() {
    var Tappy = require('../src/tcmptappy.js');
    
    var StatusTestCommunicator = function() {
        this.connected = false;
    };
    
    StatusTestCommunicator.prototype = {
        connect: function(){ this.connected = true ;},
        disconnect: function(){this.connected = false;},
        isConnected: function() {return this.connected;},
        flush: function() {},
        send: function() {},
        setDataCallback: function() {},
        setErrorCallback: function(){}
    };

    it("Tappy connection status reported",function() {
        var testComm = new StatusTestCommunicator();
        var tappy = new Tappy({communicator: testComm});
        
        expect(tappy.isConnected()).toBe(false);
        tappy.connect();
        expect(tappy.isConnected()).toBe(true);
        tappy.disconnect();
        expect(tappy.isConnected()).toBe(false);
    });

    it("Test send failure on no connection",function() {
        var testMessage = {
            getCommandFamily: function(){return [0x01,0x00];},
            getCommandCode: function() {return 0x02;},
            getPayload: function(){return 0x01;}
        };

        var testComm = new StatusTestCommunicator();
        var tappy = new Tappy({communicator: testComm});
        var sender = function() {
            tappy.sendMessage(testMessage);
        };

        var errorCount = 0;
        tappy.setErrorListener(function(type) {
            expect(type).toBe(Tappy.ErrorType.NOT_CONNECTED);
            errorCount++;
        });
        sender();
        tappy.connect();
        sender();
        tappy.disconnect();
        sender();
        expect(errorCount).toBe(2);
    });

    it("Test message composition", function() {
        var message = {
            getCommandFamily: function(){return [0x01,0x02];},
            getCommandCode: function() {return 0x01;},
            getPayload: function(){return [0x7D,0x7E,0x33];}
        };
        var expected = new Uint8Array([0x7E,0x00,0x08,0xF8,0x01,0x02,0x01,0x7D,0x5D,0x7D,0x5E,0x33,0xE2,0xFE,0x7E]);

        var MessageSendTestCommunicator = function() {
            this.connected = true;
        };
        
        MessageSendTestCommunicator.prototype = {
            connect: function(){ this.connected = true ;},
            disconnect: function(){this.connected = false;},
            isConnected: function() {return this.connected;},
            flush: function() {},
            send: function(bytes) {
                var gotArr = new Uint8Array(bytes);
                expect(gotArr).toEqual(expected);
            },
            setDataCallback: function() {},
            setErrorCallback: function(){}
        };
        
        var msgTestComm = new MessageSendTestCommunicator();
        var tappy = new Tappy({communicator: msgTestComm});
        tappy.sendMessage(message);
    });

    it("Test basic buffering and frame resolution", function() {
        var MessageRecdTestCommunicator = function() {
            this.connected = true;
            this.dataCb = function() {};
        };
        
        MessageRecdTestCommunicator.prototype = {
            connect: function(){ this.connected = true ;},
            disconnect: function(){this.connected = false;},
            isConnected: function() {return this.connected;},
            flush: function() {},
            send: function(bytes) {
            },
            setDataCallback: function(cb) {
                this.dataCb = cb;
            },
            setErrorCallback: function(){},
            sendZeroLengthFrames: function() {
                var arr = new Uint8Array([0x7E,0x7E,0x7E,0x7E]);
                this.dataCb(arr.buffer);
            },
            sendInvalidHdlcEscaping1: function() {
                var arr = new Uint8Array([0x7E,0x7D,0x7D,0x7E]);
                this.dataCb(arr.buffer);
            },
            sendInvalidHdlcEscaping2: function() {
                var arr = new Uint8Array([0x7E,0x7D,0x7E]);
                this.dataCb(arr.buffer);
            },
            sendValidTcmpHdlc: function() {
                // Packet for
                // Command Family: 0xFA, 0x03
                // Command Code: 0xFE
                // Payload: 0x7D, 0x7E, 0x33
                var arr = new Uint8Array([0x7E,0x00,0x08,0xF8,0xFA,0x03,0xFE,0x7D,0x5D,0x7D,0x5E,0x33,0xC1,0xEE,0x7E]);
                this.dataCb(arr.buffer);
            },
            sendBadCrcTcmp: function() {
                var arr = new Uint8Array([0x7E,0x00,0x08,0xF8,0xFA,0x03,0xFE,0x7D,0x5D,0x7D,0x5E,0x33,0xC1,0xEA,0x7E]);
                this.dataCb(arr.buffer);
            },
            sendBadLcsTcmp: function() {
                var arr = new Uint8Array([0x7E,0x00,0x08,0x01,0xFA,0x03,0xFE,0x7D,0x5D,0x7D,0x5E,0x33,0x17,0x86,0x7E]);
                this.dataCb(arr.buffer);
            },
            sendVeryLongTcmp: function() {
                var arr = new Uint8Array([
                        0x7E,0x01,0xC7,0x38,0xFA,0x03,0xFE,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x44,0x44,0x44,0x44,0x44,0x44,0x44,
                        0x44,0x3E,0x37,0x7E]);
                this.dataDb(arr.buffer);
            }
        };
        var msgTestComm = new MessageRecdTestCommunicator();
        var tappy = new Tappy({communicator: msgTestComm});

        var clFailer = function(msg) {
            return function() {
                fail(msg);
                console.log(arguments[1]);
            };
        };
        tappy.setMessageListener(clFailer("Zero length frames should not be passed on"));
        tappy.setErrorListener(clFailer("Zero length frames should not cause an error"));
        msgTestComm.sendZeroLengthFrames();

        var errCalled = false;
        tappy.setMessageListener(clFailer("Invalid HDLC frame should not be forwarded as a valid message"));
        tappy.setErrorListener(function(type){
            expect(type).toBe(Tappy.ErrorType.INVALID_HDLC);
            errCalled = true;
        });
        msgTestComm.sendInvalidHdlcEscaping1();
        expect(errCalled).toBe(true);
        
        errCalled = false;
        msgTestComm.sendInvalidHdlcEscaping2();
        expect(errCalled).toBe(true);

        //test tcmp errors
        tappy.setMessageListener(clFailer("TCMP packets with a bad CRC should not be forwarded as a valid message"));
        tappy.setErrorListener(function(type){
            expect(type).toBe(Tappy.ErrorType.INVALID_TCMP);
            errCalled = true;
        });
        errCalled = false;
        msgTestComm.sendBadCrcTcmp();
        expect(errCalled).toBe(true);
        
        tappy.setMessageListener(clFailer("TCMP packets with a bad LCS should not be forwarded as a valid message"));
        errCalled = false;
        msgTestComm.sendBadLcsTcmp();
        expect(errCalled).toBe(true);


        tappy.setErrorListener(clFailer("Valid TCMP packet incorrectly caused error"));
        tappy.setMessageListener(function(msg) {
            expect(msg.getCommandCode()).toEqual(0xFE);
            expect([].slice.call(msg.getCommandFamily())).toEqual([0xFA,0x03]);
            expect([].slice.call(msg.getPayload())).toEqual([0x7D,0x7E,0x33]);
        });
        msgTestComm.sendValidTcmpHdlc();
        
        tappy.setErrorListener(clFailer("Valid long TCMP packet incorrectly caused error"));
        tappy.setMessageListener(function(msg) {
            expect(msg.getCommandCode()).toEqual(0xFE);
            expect(msg.getCommandFamily()).toEqual([0xFA,0x03]);

            var pld = [];
            for(var i = 0; i < 450; i++) {
                pld.push(0x44);
            }
            expect(msg.getPayload()).toEqual(pld);
        });

    });
});
