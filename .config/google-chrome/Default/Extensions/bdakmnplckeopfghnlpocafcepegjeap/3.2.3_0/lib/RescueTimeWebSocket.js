/* Copyright RescueTime, Inc. 2017
 * 'Brian Arenz' <brianarenz@rescuetime.com>
*/

// require RescueTimeUtil
// require RescueTimeLocalStorage
// require RescueTimeConfig

var RescueTimeWebSocket = {
  storage: null,
  config: null,
  util: null,
  socket: null,
  _connectEnabled: true,
  _connected: false,
  _connectAttempts: 1,
  _maxConnectAttempts: 1,
  _maxConnectAttemptsExceeded: false,
  _reconnectInterval: (1 * (60 * 1000)),
  _compatiblePlatforms: [
    'mac-firefox',
    'linux-firefox',
    'linux-chrome',
    'win-chrome',
    'win-firefox'
  ],
  _protocolVersion: 1,
  _host: 'ws://localhost',
  _portIndex: 0,
  _portsAvailable: [
    16587, 19968, 16485, 2961, 62743, 22832, 3900,
    7394, 58293, 23552, 20085, 18278, 26078, 61230, 18814,
    35556, 33153, 62463, 32969, 38999, 13813, 29096, 58838,
    26223, 18535, 15351, 52270, 30994, 21143, 34095, 7271
  ],
  _lastMessage: null,
  _messageIds: Object.freeze({
    initialize:   0,
    validate:     1,
    url:          2,
    redirect:     3
  }),

  initialize: function(config) {
    this.config = config;
    this.util = config.util;
    this.storage = config.storage;

    return this;
  },

  platformCompatible: function(){
    var platform = this.util.os + '-' + this.util.browser;
    return this._compatiblePlatforms.indexOf(platform) !== -1;
  },

  //////////////
  // Connections
  connect: function(){
    if(this.shouldConnect()){
      this.util._log('WebSocket connecting');

      var self = this,
          currentPort = self._portsAvailable[self._portIndex],
          hostUri = self._host + ':' + currentPort + '?from=rtext';

      self.socket = new WebSocket(hostUri);

      //// Events
      self.socket.addEventListener('open', function(event){
        self.util._log('WebSocket initializing connection');

        var manifest = chrome.runtime.getManifest();

        var opts = {
          message_id: self._messageIds.initialize,
          protocol_version: self._protocolVersion,
          account_key: self.config.common.account_key,
          extension_version: manifest.version
        };

        self.sendMessage(opts);
      });

      self.socket.addEventListener('message', function(msg){
        self.util._log('WebSocket message received');

        var message = JSON.parse(msg.data);
        self.getMessageCallback(message);
      });

      self.socket.addEventListener('error', function(err){
        self.util._log('WebSocket ERROR');
        self._portIndex++;
      });

      self.socket.addEventListener('close', function(res){
        self.util._log('WebSocket disconnected');
        self._connected = false;
        self.reconnect();
      });
    }
  },

  disconnect: function(){

    this._portIndex = 0;
    if(this.socket !== null){
      this.socket.close();
    }
  },

  reconnect: function(){
    this.socket = null;

    if(this._portIndex < this._portsAvailable.length){
      this.connect();
    } else {
      var self = this;

      self.util._log('WebSocket all ports scanned, reconnect delayed for '+ self._reconnectInterval);

      // self.util._log('WebSocket connect attempts: '+ self._connectAttempts);
      self._portIndex = 0;
      self._connectEnabled = false;

      // if(self._connectAttempts === self._maxConnectAttempts){
      //   self.util._log('WebSocket max connect attempts exceeded');
      //   self._connectAttempts = 0;
      //   self._maxConnectAttemptsExceeded = true;
      //   self.util.setIcon(false);
      // } else {
      self._connectAttempts++;
      self.util.inFuture('enable-connect', function() { self.enableConnect(); }, self._reconnectInterval);
      // }
    }
  },

  shouldConnect: function(){
    if(this.platformCompatible() && this._connectEnabled){
      var localLoggingEnabled = this.config.getConfigData('local_logging_enabled');

      if ((this.config.hasAccountKey()) && (this._connected === false) &&
          (localLoggingEnabled !== null) && ((localLoggingEnabled === false) || (localLoggingEnabled === 'false')) &&
          (this.connectionBusy() === false)){
            return true;
      }
    }

    return false;
  },

  connectionBusy: function(){
    if(this.socket !== null){
      if([0,2].indexOf(this.socket.readyState) !== -1){
        return true;
      }
    }

    return false;
  },

  enableConnect: function(){
    this.util._log('WebSocket connect enabled');
    this._connectEnabled = true;
    this.connect();

  },



  ////////////
  // Messaging
  sendMessage: function(obj){
    if(this.connectionBusy() === false){
      if(this.socket !== null){
        // check for sent url message
        if(this._lastMessage && this._lastMessage.message_id === this._messageIds.url){
          var self = this;
          // get the current window and make sure it's actually focused
          chrome.windows.getCurrent(function(win){
            if(win.focused) {
              // if window is focused, check last message timestamp
              var timeDiffMs = (Date.parse(obj.timestamp) - Date.parse(self._lastMessage.timestamp));
              // reduce chatter, 200ms threshold
              if( timeDiffMs > 200 ){
                // check for exact same url, reduce chatter on page loads
                // if( self._lastMessage.url !== obj.url ){
                  self.socket.send(JSON.stringify(obj));
                  self.util._log('WebSocket sending ', JSON.stringify(obj));
                // }
              }
              // update the last message
              self._lastMessage = obj;
            } else {
              // window unfocused, reset the last message
              self._lastMessage = null;
            }
          });
        } else {
          this.socket.send(JSON.stringify(obj));
          this.util._log('WebSocket sending ', JSON.stringify(obj));
          this._lastMessage = obj;
        }

      } else {
        this.connect();
      }
    }
  },

  getMessageCallback: function(msg){
    var self = this,
        callbackName = Object.keys(self._messageIds).filter(function(key){ return self._messageIds[key] === msg.message_id; })[0];

    if(typeof(callbackName) !== 'undefined'){
      self[callbackName](msg);
    }
  },

  //// Callbacks
  validate: function(msg){
    if(msg.hasOwnProperty('valid') && msg.hasOwnProperty('protocol_version')) {
      if(msg.valid !== true || (msg.protocol_version !== this._protocolVersion)) {
        this.disconnect();
        this._connectEnabled = false;
      } else {
        this.util._log('WebSocket connection validated');
        this._connected = true;
      }
    } else {
      this.disconnect();
    }
  },

  redirect: function(msg){
    // for focustime
    if(msg.hasOwnProperty('url') && msg.hasOwnProperty('block_url')){

      var urlString = new URL(msg.url).toString(),
          opts = {
            currentWindow: true,
            active: true,
            url: urlString
          },
          blockUrl = chrome.runtime.getManifest().homepage_url + '/blocked/url/' + urlString;

      chrome.tabs.query(opts, function(results){
        if(results.length && results[0].hasOwnProperty('id')){
          chrome.tabs.update(results[0].id, {url: blockUrl});
        }
      });
    }
  }
};

var EXPORTED_SYMBOLS = ['RescueTimeWebSocket'];
