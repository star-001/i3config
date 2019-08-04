/*
 *
 Copyright RescueTime, Inc.
 *
 */


// require RescueTimeUtil
// require RescueTimeLocalStorage
// require RescueTimeClientConfig
// require RescueTimeEngine

var RescueTimeAPI = {
    util: null,
    config: null,
    storage: null,
    engine: null,
    webSocket: null,
    client_identity: {
        client_version: "3.2.3",
        data_version: 2,
        os_id: 8,
    },
    staticIdentityParams: null,
    userAgent: null,
    asHelperOnly: false, // only grab url and assist blocking
    isActivated: false,
    blockList: null,
    waitFor: {
        config: 0,
        sendLog: 0,
        messages: 0
    },
    messageCodes: {
        ALERTS: 1,
        NEW_CONFIG: 2,
        NEW_BETA_CLIENT: 3,
        NEW_BLOCK_LIST: 4,
        NEW_SURVEY: 5
    },
    activationInProgress: false,
    validateSession: true,
    sessionCookieName: '_rescuetime_session4',
    authCookieName: 'auth_token',
    modeCookieName: '_enable_logging',
    initialize: function(engine) {
        this.util = engine.util;
        this.storage = engine.storage;
        this.webSocket = engine.webSocket;
        this.config = engine.config;
        this.engine = engine;
        this.engine.api = this; // May merge engine and api to one (engine) singleton; this is ugly
        this.userAgent = this.getUserAgent();
        // send any backlogged logs here
        (function(self) {
            self.util.inFuture("send_or_store_logs", self.engine.sendOrStorePendingLogsGenerator(), 5);
        })(this);
        if (this.config.shouldLogTime()) {
            this.engine.startLogPusher();
        }

        var self = this,
            storageKeys = ['account_key'];

        var storageCallback = function(result){
            if(typeof(result[self.storage.cfix+'account_key']) !== 'undefined'){
                if(self.config.getConfigData('local_logging_enabled')){
                    if(!self.engine.messagePullerRunning()){
                        self.pullMessages();
                        self.engine.startMessagePuller();
                    }
                }
                self.util.setIcon(true);
            } else {
                self.checkForSiteLogin(function win(){
                    self.requestActivation(true);
                }, function fail(){
                    self.listenForSiteLogin();
                });
            }
        };
        this.storage.getConfig(storageKeys, storageCallback);

        return this;
    },
    getUserAgent: function() {
        if (this.userAgent == null) {
            this.userAgent = ["RescueTime Client ", this.client_identity.client_version,
                              " javascript ", this.util.getSystem(),
                              " ", this.util.getBrowser(),
                              " ", window.navigator.userAgent
                             ].join("");
        }

        return this.userAgent;
    },
    getStaticIdentityParams: function() {
        if (this.staticIdentityParams == null) {
            this.staticIdentityParams = {
                "os_id": this.client_identity.os_id,
                "data_version": this.client_identity.data_version,
                "client_version": this.client_identity.client_version
            };
        }
        return this.staticIdentityParams;
    },
    getIdentityParams: function() {
        var params = {};
        var statics = this.getStaticIdentityParams();
        for (var key in statics) {
            params[key] = statics[key];
        }
        params.account_key = this.config.common.account_key;
        params.os_username = this.engine.os_username();
        params.computer_name = this.engine.computer_name() + '-' + this.engine.identity;
        return params;
    },
    requestActivation: function(expects_account, uiCallback) {
        this.util._log("requesting activation for user from session");

        var self = this,
            storageKeys = Object.keys(this.config.common);

        var activationCallback = function(data){
            self.activationInProgress = true;
            var params = self.getStaticIdentityParams();
            var app_identity = data[self.storage.cfix+'identity']
            params["device[carrier]"] = self.util.os;
            params["device[make]"] = self.util.browser;
            params["device[platform_version]"] = self.util.browserVersion;
            params.computer_name = [self.engine.computer_name(), app_identity].join('-');
            params.expects_account = +expects_account;
            params.should_have_session = true;
            params.stay_in = '1';

            var win = function(response) {
                self.util._log("request activation response: ", response.toString());
                self.util._log("response json: ", response.responseText);
                var result = JSON.parse(response.responseText),
                    status = "continue",
                    ui_result = null,
                    ui_update_callback = null;

                if (result == null) {
                    ui_result = "no response, uknown error";

                } else {
                    var response_code = result.c[0];
                    if (response_code === 1) {
                        status = "reload";
                        if (result.error != null) {
                            ui_result = result.error;
                            if (result.error === "user:taken") {
                                ui_result = "That user name is taken! (switch tabs if you are already a user)";
                            }
                            else if (result.error === "user:not_found") {
                                ui_result = "We did not find a user matching that email!";
                                status = 'warning';
                                self.config.removeConfigData("activation_email");
                            } else if (result.error === "user:error") {
                                // bad session
                                status ="inactive_session";
                                self.validateSession = false;
                                self.listenForSiteLogin();
                            } else {
                                status ="fail";
                                ui_result = "A fatal error has occured when activating your browser extension.";
                            }
                        } else {
                            ui_result = "unknown error";
                        }
                    } else if (response_code === 0) {

                        self.util._log("inline activation");
                        var account_key = result.account_key,
                            data_key = result.data_key,
                            activation_email = result.activation_email;

                        self.util._log("got account key, data key: ", account_key, ",", data_key);
                        if ((account_key != null) && (data_key != null)) {
                            self.activationDone(activation_email, account_key, data_key);
                            ui_result = "Thanks for using RescueTime!";
                            status = "reload";
                            self.pullConfig(uiCallback);
                            if(self.config.getConfigData('local_logging_enabled')){
                                if(!self.engine.messagePullerRunning()){
                                    self.pullMessages();
                                    self.engine.startMessagePuller();
                                }
                            }
                        } else {
                            status ="fail";
                            ui_result = "There was a problem with activation, please try again later.";
                            // UI FOR FAILED ACTIVATION HERE
                        }
                    }
                }

                try {
                    if (uiCallback != null) {
                        uiCallback(status, ui_result, ui_update_callback);
                    }
                } catch (e) {
                    self.util._log("dead callback function");
                }
                self.activationInProgress = false;
            };
            var fail = function(response) {
                self.util._log("request activation fail: ", response.toString());
                // var url = self.getGetUrl('/logout', 'from=extension&redirect_to=' + encodeURIComponent('/login'));

                // chrome.tabs.create({url: url}, function(tab){
                //   self.api.util._log('will open in tab: ', url);
                //   self.closePopover();
                // });
                self.listenForSiteLogin();
                try {
                    if (uiCallback != null) {
                        uiCallback('inactive_session');
                    }
                } catch (e) {
                    self.util._log("dead callback function");
                }
                self.activationInProgress = false;
            };
            self.postUI("/device/activate/request", win, fail, params);
        };

        this.storage.getConfig(storageKeys, activationCallback);
    },
    activationDone: function(activation_email, account_key, data_key){
        var self = this;

        self.engine.setActivationEmailCache(activation_email);
        self.config.setCommonConfig("account_key", account_key);
        self.config.setConfigData("data_key", data_key);
        self.config.setConfigData("activation_email", activation_email);
        self.util.setIcon(true);
        self.listenForModeChange();

        self.util._log('activation success: opening url in tab');
        chrome.tabs.query({active: true, url: '*://*.rescuetime.com/*'}, function(tabs){
            var opts = {
                active: true,
                url: [self.config.protocol,self.config.common.ui_url,'/users/activated-browser-plugin'].join('')
            };
            if(tabs.length){
                chrome.tabs.update(tabs[0].id, opts);
            } else {
                chrome.tabs.create(opts);
            }
        });
    },
    hello: function() {
        var engine = this.engine,
            util = this.util;

        var win = function(response) {
            util._log("hello success: ", response.responseText);
        };
        var fail = function(response) {
            util._log("hello fail: ", response.toString());
        };

        this.postAPI("/hello", win, fail);
    },
    pullConfig: function(callback) {
        var self = this,
            storageKeys = Object.keys(this.config.common);

        var storageCallback = function(data){
            var account_key = data[self.storage.cfix+'account_key'],
                app_identity = data[self.storage.cfix+'identity'];
            if(typeof(account_key) === 'undefined'){
                // impossible
                return;
            }

            var now = Date.now();
            if ((now - self.waitFor.config) < 60000 ) {
                self.util._log("too soon to get config, waiting");
                return;
            }
            self.waitFor.config = now;

            var params = self.getStaticIdentityParams();

            params.account_key = account_key;
            params.os_username = self.engine.os_username();
            params.computer_name = [self.engine.computer_name(), app_identity].join('-');
            params.identity = app_identity;
            params["device[carrier]"] = self.util.os;
            params["device[make]"] = self.util.browser;
            params["device[platform_version]"] = self.util.browserVersion;

            var win = function(response) {
                self.util._log("begin config result parse");
                self.util._log("config response: ", response.responseText);
                var result = JSON.parse(response.responseText),
                    status = null,
                    message = null;

                if (result == null) {
                    self.util._log("unknown error: null response");
                } else {
                    var response_code = result.c[0];
                    if (response_code === 0) {
                        self.engine.logDebug("response code 0");
                        self.engine.logDebug("got config: ", result.config);
                        status = "noop";
                        var reset_logging_schedule = false;
                        for (var key in result.config) {
                            // only reload screen if config has changed
                            if (! self.config.matchesCommonConfig(key, result.config[key])) {
                                var value_was = self.config.getCommonConfig(key),
                                    value = result.config[key];
                                self.config.setCommonConfig(key, value);
                                self.util._log('config has changed for: ',
                                               key, " was ", value_was, "(", typeof(value_was), ")",
                                               " now ", value, "(", typeof(value), ")" );
                                status = "reload_delayed";
                                // reset the schedule if push interval changed
                                if (key === "push_interval") {
                                    reset_logging_schedule = true;
                                }
                            }
                        }
                        if (reset_logging_schedule) {
                            self.engine.stopLogPusher();
                            self.util.inFuture("send_or_store_logs", self.engine.sendOrStorePendingLogsGenerator(), 1);
                        } // following will start it again
                        if (self.config.shouldLogTime() && (! self.engine.logPusherRunning())) {
                            self.engine.startLogPusher();
                        }
                    } else if (response_code === 1) {
                        var error = result.error;
                        if ((error != null) && (error === "Unable to find user machine")) {
                            // fatal condition, reset config
                            message = "There was a fatal error syncing your account. Reactivation required. No data is lost.";
                            self.engine.hardReset();
                        }
                        status = "reload_delayed";
                    }
                }

                if (callback != null) {
                    callback(status, message);
                }
            };
            var fail = function(response) {
                self.engine.log("failed to get config");
            };
            self.postAPI("/config",  win, fail, params);
        };

        this.storage.getConfig(storageKeys, storageCallback);
    },
    sendLogFile: function(logFile) {
        var self = this,
            storageKeys = Object.keys(self.config.common);

        var storageCallback = function(data){
            var params = self.getStaticIdentityParams(),
                app_identity = data[self.storage.cfix+'identity'];

            params.account_key = data[self.storage.cfix+'account_key'];
            params.os_username = self.engine.os_username();
            params.computer_name = self.engine.computer_name() + '-' + app_identity;
            params.identity = app_identity;
            params.gz = 0;

            var win = function(response) {
                // check success code and done
                self.util._log('response: ', response.responseText);
                // TODO getting parse error from json parser?
                var result = JSON.parse(response.responseText);
                if (result == null) {
                    self.engine.log("unknown error: null response, saving log");
                    self.engine.saveLogFile(logFile);
                } else if (result.error) {
                    self.engine.log("post log error: ", JSON.stringify(result));
                    self.engine.saveLogFile(logFile);
                } else {
                    if ((result.c) && (result.c[0] === 0)) {
                        self.engine.log("response code 0, log send success");
                        self.engine.lastLogSent = Date.now();
                        self.engine.nextLogToStorageFlush = self.engine.lastLogSent + self.engine.logToStorageFlushPeriod;

                    } else {
                        // if fail store log
                        self.engine.logDebug("result code fail, could not send log, saving log");
                        self.util._log("response was: ", result);
                        self.engine.saveLogFile(logFile);
                    }
                }
            };
            var fail = function(response) {
                self.engine.logDebug("https post fail, could not send log, saving log");
                self.engine.saveLogFile(logFile);
            };
            self.postAPI("/collect", win, fail, params, logFile);
        };

        this.storage.getConfig(storageKeys, storageCallback);
    },
    pullMessages: function() {
        this.util._log("begin pull messages");
        var self = this,
            storageKeys = Object.keys(this.config.common);

        var storageCallback = function(data){
            var params = self.getStaticIdentityParams(),
                app_identity = data[self.storage.cfix+'identity'];

            params.account_key = data[self.storage.cfix+'account_key'];
            params.os_username = self.engine.os_username();
            params.computer_name = self.engine.computer_name() + '-' + app_identity;

            var win = function(response) {
                response = JSON.parse(response.responseText);
                if (response == null) {
                    self.util._log("unknown error: null response");
                } else if (response.error) {
                    self.engine.logDebug("post log error: ", response.error);
                } else if ((response.c) && (response.c[0] === 0)) {
                    self.util._log("response code 0, message received");
                    var messages = response.messages;
                    if (messages != null) {
                        self.util._log("got message responses: ", messages.join(","));
                        if (messages.length > 0) {
                            var dedup = {};
                            for (var i = 0; i < messages.length; i++) {
                                if (dedup[messages[i]]) {
                                    continue;
                                }
                                dedup[messages[i]] = true;
                                self.util._log("should handle message code: ", messages[i]);
                                if (self.messageCodes.NEW_CONFIG === messages[i]) {
                                    self.waitFor.config = 0;
                                    self.pullConfig();
                                } else if (self.messageCodes.ALERTS === messages[i]) {
                                    self.pullAlerts();
                                }
                            }
                        }
                    }
                }
            };
            var fail = function(response) {
                self.engine.logDebug("fatal error getting client messages");
            };
            self.postAPI("/messages", win, fail, params);
        };

        this.storage.getConfig(storageKeys, storageCallback);
    },
    pullAlerts: function() {
        this.util._log("pull alerts message handler");
        // needs to bubble some events to be visible if possible
        // get alerts
    },
    checkForSiteLogin: function(successCallback, failCallback){
        this.util._log('checking for site login');

        var cookieUrl = [this.config.protocol,this.config.common.ui_url].join(''),
            cookieOpts = {
                url: cookieUrl,
                name: this.sessionCookieName
            },
            self = this;

        chrome.cookies.get(cookieOpts, function(cookie){
            self.util._log('will request activation:', self.validateSession);
            try {
                if(typeof(cookie.value) !== 'undefined' && self.validateSession){
                    successCallback();
                } else {
                    failCallback();
                }

            } catch(e) {
                self.validateSession = false;
                failCallback();
            }
        });
    },
    authCookieChangeHandler: function(changeInfo){
        var rtAPI = this.RescueTimeAPI;
        if(changeInfo.cookie.domain === rtAPI.config.common.ui_url){
            if(changeInfo.removed === false && changeInfo.cookie.name === rtAPI.authCookieName){
                rtAPI.util._log('removing cookie listener for auth_token');
                chrome.cookies.onChanged.removeListener(rtAPI.authCookieChangeHandler);
                if(rtAPI.activationInProgress === false){
                    rtAPI.requestActivation(true);
                }
            }
        }
    },
    listenForSiteLogin: function(){
        this.util.setIcon(false);
        this.util._log(chrome.cookies.onChanged.hasListener(this.authCookieChangeHandler) ? 'has' : 'no', ' auth_token cookie listener');
        if(chrome.cookies.onChanged.hasListener(this.authCookieChangeHandler) === false){
            this.util._log('adding cookie listener for auth_token');
            chrome.cookies.onChanged.addListener(this.authCookieChangeHandler);
        }
    },
    modeCookieChangeHandler: function(changeInfo){
        var rtAPI = this.RescueTimeAPI;
        if(changeInfo.cookie.domain === rtAPI.config.common.ui_url){
            if(changeInfo.removed === false && changeInfo.cookie.name === rtAPI.modeCookieName){
                var enableLogging = [true, 'true'].indexOf(changeInfo.cookie.value) > -1;
                rtAPI.util._log('logging will be enabled: ', enableLogging);
                rtAPI.config.setConfigData('local_logging_enabled', enableLogging);
                if(enableLogging){
                    if(!rtAPI.engine.messagePullerRunning()){
                        rtAPI.pullMessages();
                        rtAPI.engine.startMessagePuller();
                    }
                } else {
                    rtAPI.engine.stopMessagePuller();
                }
            }
        }
    },
    listenForModeChange: function(){
        // this.util.setIcon(false);
        this.util._log(chrome.cookies.onChanged.hasListener(this.modeCookieChangeHandler) ? 'has' : 'no', ' _enable_logging cookie listener');
        if(chrome.cookies.onChanged.hasListener(this.modeCookieChangeHandler) === false){
            this.util._log('adding cookie listener for _enable_logging');
            chrome.cookies.onChanged.addListener(this.modeCookieChangeHandler);

            // remove listener after 5 minutes
            var self = this;
            self.util.inFuture('remove-mode-listener', function() {
                self.util._log('removing cookie listener for _enable_logging');
                chrome.cookies.onChanged.removeListener(self.modeCookieChangeHandler);
            }, (5*(60*1000)));
        }
    },
    getGetUrl: function(path, paramstring) {
        // path expects preceding "/"
        var url = [this.config.protocol,this.config.common.ui_url,path,"?",paramstring].join("");
        return url;
    },
    postAPI: function(path, successCallback, failCallback, params, multipartfile) {
        return this.post(this.config.common.url, path, successCallback, failCallback, params, multipartfile);
    },
    postUI: function(path, successCallback, failCallback, params, multipartfile) {
        return this.post(this.config.common.ui_url, path, successCallback, failCallback, params, multipartfile);
    },
    post: function(service, path, successCallback, failCallback, params, multipartfile) {
        var url = [this.config.protocol,service,path].join('');
        if (params == null) { params = {}; }
        params.format = "json";
        if (this.engine.debug) {
            var debugparams = [];
            for (var key in params) {
                debugparams.push(key + "=" + params[key]);
            }
            this.util._log("params: ", debugparams.join(" "));
        }
        var self = this;
        var duration = Date.now();
        var benchmarkedSuccess = function(response) {
            duration = Date.now() - duration;

            if (successCallback != null) {
                if (self.engine.debug) {
                    self.engine.logDebug("[" + duration + "ms] for: " + url);
                }
                return successCallback(response);
            }
        };
        this.util.postRequest(url, params, multipartfile, true,
                              benchmarkedSuccess, failCallback);
    }
};

var EXPORTED_SYMBOLS = ["RescueTimeAPI"];
