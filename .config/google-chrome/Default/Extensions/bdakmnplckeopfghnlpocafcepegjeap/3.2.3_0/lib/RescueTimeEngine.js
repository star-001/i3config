// require RescueTimeWebSocket
// require RescueTimeUtil
// require RescueTimeLocalStorage
// require RescueTimeConfig

var RescueTimeEngine = {
    webSocket: null,
    config: null,
    util: null,
    storage: null,
    api: null, // circular ref up the stack for api / network communications
    initialized: false,
    identity: null,
    identity_size: 12,
    logMessages: [],
    activation_email_cache: null,
    debug: false,
    lastActive: 0,
    lastLastActive: 0,
    lastUserInput: 0,
    lastLastUserInput: 0,
    scanInterval: 1000,
    previousUrl: null,
    previousTitle: null,
    mostRecentUrl: null,
    mostRecentTitle: null,
    mostRecentUrlNotSelf: null,
    mostRecentTitleNotSelf: null,
    loggerLoops: 0,
    memoryLogSize: 500,
    memoryLog: [],
    pendingMemoryLog: [],
    nextLogToStorageFlush: 0,
    lastLogSent: 0,
    logToStorageFlushPeriod: 300000,
    extensionLoads: 0,
    tabCount: 0,
    extensionId: null,
    extensionBaseUrl: null,
    instance_config: {
        pause_until: 0
    },
    _reset_data: {
        savedLogFile: null,
        lastSavedLogFile: null,
    },
    openLogEntry: null,

    ENTITY_TYPE_CODES: {
        "Platform": 0,
        "App": 1,
        "Domain": 2,
        "OfflineEntity": 5
    },

    // per browser implementations to be overridden
    setCurrentUrlAndTitle: function() {},

    // fully implemented
    initialize: function(webSocket) {
        this.webSocket = webSocket;
        this.config = webSocket.config;
        this.util = webSocket.util;
        this.storage = webSocket.storage;
        this.currentMemoryLog = this.memoryLog1;

        var pause_until = this.config.getConfigData("pause_until");

        if (! this.config.blankOrNull(pause_until)) {
            if (pause_until > Date.now()) {
                this.instance_config.pause_until = parseInt(pause_until);
            } else {
                this.config.removeConfigData("pause_until");
            }
        }

        if (this.util.isChromeFamily()) {
            this.extensionId = chrome.i18n.getMessage("@@extension_id");
            this.extensionBaseUrl = "chrome-extension://" + this.extensionId;
        }

        var self = this;

        this.setCurrentUrlAndTitle = function () {

            if (self.tabCount > 0) {
                chrome.windows.getCurrent({populate: true}, function(windowData){
                    if(typeof(windowData) !== "undefined"){
                        var activeTab = windowData.tabs.filter(function(tab){return tab.active === true; })[0];
                        if (typeof(activeTab) !== "undefined") {
                            self.storeCurrentUrlAndTitle(activeTab.url, activeTab.title);

                            // WebSocket
                            self.sendUrlIfShouldToClient(activeTab.url);

                            return [RescueTimeEngine.mostRecentUrl, RescueTimeEngine.mostRecentTitle];
                        } else {
                            self.util._log('browser tab: no current active tab');
                        }
                    } else {
                        self.util._log('browser window: no current window exists');
                    }
                });
            }
            return [RescueTimeEngine.mostRecentUrl, RescueTimeEngine.mostRecentTitle];
        };

        var now = Date.now();
        this.nextLogToStorageFlush = now + this.logToStorageFlushPeriod;
        this.lastActive = this.lastLastActive = this.lastUserInput = this.lastLastUserInput = now;
        this.identify();
        this.extensionLoads++;
        this._detectActivityHooks();
        this.startHousekeeping();

        (function(self) {
            self._setTabCount(function() {self.setCurrentUrlAndTitle();});
        })(this);

        this.util._log(["engine intialized:",this.util.getSystem(), this.util.getBrowser(), this.util.getBrowserVersion()].join(" "));
        this.initialized = true;

        return this;
    },

    identify: function() {
        if (this.identity == null) {

            var self = this;
            this.storage.getConfig(['identity'], function(result){
                if(typeof(result[self.storage.cfix+'identity']) === 'undefined'){
                    self.identity = self.util.randomString(self.identity_size);
                    self.config.setCommonConfig("identity", self.identity);
                }
            });
        }
    },
    hardReset: function(callback)  {
        this.config.resetConfig();
        // thisremoveConfigData
        this.resetData();
        this.identity = null;
        this.identify();
        this.util.setIcon(false);
        this.webSocket.disconnect();
        this.webSocket._connectEnabled = true;

        if (callback != null) {
            callback();
        }
    },
    resetData: function() {
        //self = this;
        (function(self) {
            for (var key in self._reset_data) {
                self.storage.setData(key, self._reset_data[key]);
                self.storage.deleteData(key);
            }
        })(this);
    },
    rotateMemoryLog: function(save_only) {
        if (this.memoryLog.length === 0) {
            this.util._log('not sending, empty log');
            return;
        } else {
            this.emitInterruptedLogEntry();
            this.pendingMemoryLog = this.pendingMemoryLog.concat(this.memoryLog);
            this.memoryLog = [];
        }
        if (save_only) {
            this.util._log("rotating and storing only not sending");
            var logFile = this.csvFromPendingLog();
            if (logFile) {
                this.util._log('saving a logfile of size: ', logFile.length);
                this.saveLogFile(logFile);
            } else {
                this.util._log('no log file from pending mem logs');
            }
        } else {
            if (this.pendingMemoryLog.length > 0) {
                (function(self) {
                    self.util.inFuture("send_or_store_logs", self.sendOrStorePendingLogsGenerator(), 1);
                })(this);
            } else {
                this.util._log('no logs pending after rotate');
            }
        }
    },
    checkRotateMemoryLog: function() {
        if (this.memoryLog.length >= this.memoryLogSize) {
            this.rotateMemoryLog();
        }
    },
    csvFromPendingLog: function() {
        var memlog = this.pendingMemoryLog;
        this.util._log('pendingMemoryLog: ', this.pendingMemoryLog);
        this.pendingMemoryLog = [];
        this.util._log('memlog: ', memlog);
        if (memlog.length > 0) {
            var logFile = this.csvFromMemoryLog(memlog);
            return logFile;
        } else {
            return null;
        }
    },
    sendOrStorePendingLogsGenerator: function() {
        var self = this,
            logFile = null;
        return function() {
            self.util._log("send or store log is running");
            self.storage.getData(['savedLogFile'], function(result){
                if (result[self.storage.dfix+'savedLogFile'] != null) {
                    logFile = result[self.storage.dfix+'savedLogFile'];
                    self.util._log("trying to send a saved log (", logFile.length, "):\n", logFile);
                    self.storage.deleteData('savedLogFile');
                    if ((logFile != null) && (logFile.length > 0)) {
                        self.api.sendLogFile(logFile);
                    } else {
                        self.util._log("saved log file is actually empty string");
                    }
                }
                logFile = self.csvFromPendingLog();
                if (logFile) {
                    self.util._log("got logfile: ", logFile);
                    self.api.sendLogFile(logFile);
                } else {
                    self.util._log("no logs in pending list");
                }
            });
        };
    },
    csvFromMemoryLog: function(memLog) {
        if (memLog == null) {
            this.util._log("fatal: attempt to convert a null log");
        }
        var csvs = [];
        for (var i = 0; i < memLog.length; i++) {
            csvs.push.apply(csvs, this.entryToCSVarray(memLog[i]));
            csvs.push("\n");
        }
        var csvsString = csvs.join('');
        return csvsString;
    },
    saveLogFile: function(logFileString) {
        if ((logFileString == null) || (logFileString.length === 0)) {
            return false;
        }
        var storedLog = logFileString,
            self = this;

        var storageCallback = function(result){
            var current = result[self.storage.dfix+'savedLogFile'];
            if ((current == null) || (current === '')) {
                storedLog = logFileString;
                self.storage.setData('savedLogFile', logFileString);
            } else {
                storedLog = current + logFileString;
                self.storage.setData('savedLogFile', storedLog);
            }
            var now = Date.now();
            self.nextLogToStorageFlush = now + this.logToStorageFlushPeriod;
            self.storage.setData('lastSavedLogFile', now);
        };
        this.storage.getData(['savedLogFile'], storageCallback);
    },
    storeLogEntry: function(entry) {
        if (this.isPaused() || this.isLoggingDisabledLocally() || (! this.isInsideLoggingSchedule())) {
            return;
        }
        this.util._log('will store entry: ', this.entryToCSVarray(entry).join(''));
        this.checkRotateMemoryLog();
        this.memoryLog.push(entry);
    },
    wasActive: function(reason) {
        this.lastLastActive = this.lastActive;
        this.lastActive = Date.now();
        //this.util._log("active idle period: " + idle + " reason: " + reason);
        // check if window change event, if so refresh current title and url
        if (reason.match('^window')) {
            this.util._log("updating current activity due to tab event: ", reason);
            this.setCurrentUrlAndTitle();
            // this could be page reload which might be meta refresh
            if (! reason.match('^window_tab_updated')) {
                this.userWasActive(this.lastActive);
            }
        } else if (reason.match('^hid_focus')) {
            // this solves the chrome issue of windows.onFocusChanged not firing when switching in and out of app
            this.util._log('hid active: ', reason);
            this.util._log("updating current activity due to window event: ", reason);
            this.setCurrentUrlAndTitle();

        } else if (reason.match('^hid')) {
            this.util._log('hid active: ', reason);
            this.userWasActive(this.lastActive);
        }
    },
    userWasActive: function(now) {
        if (now == null) {
            now = Date.now();
        }
        this.lastLastUserInput = this.lastUserInput;
        this.lastUserInput = now;
    },
    _setTabCount: function(callback) {
        (function(self) {
            chrome.tabs.query({}, function(tabs) {
                var count = 0;
                if (tabs == null) {
                    self.util._log("have no tabs and null tabs array");
                } else {
                    self.util._log("have this many tabs now: ", tabs.length);
                    count = tabs.length;
                }
                self.tabCount = count;
                if (callback != null) {
                    callback();
                }
            });
        })(this);
        return this.tabCount;
    },
    _detectActivityHooks: function() {

        this.util._log("setting browser idle detections");
        (function(self) {
            chrome.runtime.onMessage.addListener(function(request,sender,responder) {
                if ((request.active === 'true') || (request.active === true)) {
                    self.wasActive(request.type);
                }
                // Chrome runtime fix
                return Promise.resolve("Dummy response to keep the console quiet");
            });
            // According to docs this fires multiple times in Firefox
            // https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Chrome_incompatibilities#windows
            chrome.windows.onFocusChanged.addListener(function(windowId) {
                self.storeCurrentTitle('');
                self.wasActive("window_focus_changed");
            });
            chrome.tabs.onCreated.addListener(function(tab) {
                self.wasActive("window_tab_created");
                self._setTabCount();
            });
            chrome.tabs.onAttached.addListener(function(tabId, props) {
                self.wasActive("window_tab_attached");
            });
            chrome.tabs.onMoved.addListener(function(tabId, props) {
                self.wasActive("window_tab_moved");
            });
            chrome.tabs.onUpdated.addListener(function(tabId, info, tab) {
                self.wasActive("window_tab_updated");
            });
            chrome.tabs.onActivated.addListener(function(info) {
                self.storeCurrentTitle('');
                self.wasActive("window_tab_activated");
            });
            chrome.tabs.onRemoved.addListener(function(tabId) {
                var count = self._setTabCount();
                if (count === 0) {
                    self.util._log("all tabs closed");
                }
            });
            chrome.windows.onRemoved.addListener(function(windowId) {
                chrome.windows.getAll({},function(windows) {
                    if (windows.length === 0) {
                        self.util._log("all windows closed");
                        self.rotateMemoryLog(true); //store only dont try to send
                        self.storage.setData('lastCleanShutdown', Date.now());
                    } else {
                        self.util._log("window count: ", windows.length);
                    }
                });
            });


        })(this);
    },
    storeCurrentUrl: function(url) {
        var changed = false;
        if (url != null) {
            if (! this.config.getCommonConfig('full_urls_enabled')) {
                url = this.util.serverOnlyUrl(this.util.noQueryUrl(url));
            }
            this.mostRecentUrl = this.util.safeData(url);
            if ((! this.util.isChromeFamily()) || (! url.match(this.extensionBaseUrl))) {
                this.mostRecentUrlNotSelf = this.mostRecentUrl;
            }
        }
        if (this.previousUrl !== this.mostRecentUrl) {
            this.storage.setData("currentUrl", this.mostRecentUrl);
            this.storage.setData("currentUrlUpdatedAt", Date.now());
            this.storage.setDataForClientFallback("currentUrl", this.mostRecentUrl);
            this.storage.setDataForClientFallback("currentUrlUpdatedAt", Date.now());
            this.previousUrl = this.mostRecentUrl;
            changed = true;
        }
        this.checkOpenLogEntry(changed);
        return changed;
    },
    storeCurrentTitle: function(title) {
        var changed = false;
        if (this.config.getCommonConfig('window_titles_enabled')) {
            if (title == null) {
                title = "";
            }
            this.mostRecentTitle = this.util.safeData(title);
            if ((! this.util.isChromeFamily()) || (! this.mostRecentUrl.match(this.extensionBaseUrl))) {
                this.mostRecentTitleNotSelf = this.mostRecentTitle;
            }
            if (this.previousTitle !== this.mostRecentTitle) {
                this.storage.setData("currentTitle", this.mostRecentTitle);
                this.storage.setDataForClientFallback("currentTitle", this.mostRecentTitle);
                this.previousTitle = this.mostRecentTitle;
                changed = true;
            }
            this.checkOpenLogEntry(changed);
        }
        return changed;
    },
    storeCurrentUrlAndTitle: function(url, title) {
        var changed = false;
        //this.logDebug(url + " : " + title);
        changed = this.storeCurrentUrl(url);
        changed = (this.storeCurrentTitle(title) || changed);
        return changed;
    },
    sendUrlIfShouldToClient: function(url){
        if (this.isLoggingDisabledLocally()){
            this.webSocket.sendMessage({
                message_id: this.webSocket._messageIds.url,
                url: url,
                timestamp: new Date().toISOString()
            });
        }
    },
    isLoggingDisabledLocally: function() {
        var enabled = this.config.getConfigData('local_logging_enabled');
        if ((enabled != null) && ((enabled === false) || (enabled === 'false'))) {
            return true;
        }
        return false;
    },
    isInsideLoggingSchedule: function() {
        if (this.config.getCommonConfig('logging_schedule_enabled')) {
            var daysofweek = this.config.getCommonConfig('logging_scheduled_days');
            var now = new Date();
            if (( 1 << now.getDay()) & daysofweek) {
                // matches day of week mask
                if ((Number(this.config.getCommonConfig('logging_scheduled_start_hour').split(':')[0]) <= now.getHours()) && (Number(this.config.getCommonConfig('logging_scheduled_stop_hour').split(':')[0]) > now.getHours())) {
                    return true;
                }
            }
            return false;
        }
        return true;
    },
    isPaused: function() {
        if ((this.instance_config.pause_until) && (this.instance_config.pause_until > 0)) {
            var now = Date.now();
            if (now < this.instance_config.pause_until) {
                return true;
            } else {
                this.unPause();
            }
        }
        return false;
    },
    pauseUntil: function(until) {
        if (until) {
            until = parseInt(until);
            this.config.setConfigData("pause_until", until);
            this.instance_config.pause_until = until;
            this.rotateMemoryLog();
            this.stopLogPusher();
            this.util._log("pauseUntil is set: ", until, ": ", (until - Date.now()), "ms from now");
        } else {
            this.config.removeConfigData("pause_until");
            this.instance_config.pause_until = 0;
            this.util._log("pause is canceled");
        }
    },
    unPause: function() {
        this.pauseUntil(null);
        this.startLogPusher();
    },
    isIdle: function() {
        var now = Date.now();
        if ((now - this.lastActive) > (this.config.common.idle_time_start * 1000)) {
            return true;
        }
        return false;
    },
    isIdleUser: function() {
        var now = Date.now();
        //this.util._log('idle: ', [now, this.lastUserInput, (now - this.lastUserInput), (this.config.common.idle_time_start * 1000)].join(', '));
        if ((now - this.lastUserInput) > (this.config.common.idle_time_start * 1000)) {
            return true;
        }
        return false;
    },
    idleStateHandler: function() {
        if (this.openLogEntry != null) {
            // passes an adjustment time to go back to when idle clock began
            var logEntry = this.emitRetiredLogEntry(this.config.common.idle_time_start);
            //this.util._log("browser is now idle");
            if (logEntry == null) {
                //this.util._log("idle but no log to close");
            } else {
                this.util._log("idle and closed log: ", logEntry.extendedInfo);
            }
        }
    },
    clearAllLogEntries: function() {
        this.memLog = [];
        this.pendingMemoryLog = [] ;
    },
    newLogEntry: function() {
        var logEntry = {
            applicationName: this.util.getBrowser(),
            applicationVersion: this.util.getBrowserVersion(),
            extendedInfo: this.mostRecentUrl,
            windowTitle: this.mostRecentTitle,
            entityType: this.ENTITY_TYPE_CODES.Domain,
            productivity: null,
            started: (new Date()),
            completed: null
        };
        // clean up
        if (logEntry.extendedInfo == null) {
            logEntry.extendedInfo = "";
        }
        if (logEntry.windowTitle == null) {
            logEntry.windowTitle = "";
        }
        //this.util._log("opened a log entry for: ", logEntry.extendedInfo);
        return logEntry;
    },
    entryToCSVarray: function(entry) {
        if ((entry.extendedInfo) && (entry.extendedInfo.match('^chrome-extension:'))) {
            var myid = chrome.i18n.getMessage("@@extension_id");
            if (entry.extendedInfo.match('^chrome-extension://' + myid)) {
                entry.extendedInfo = "RescueTime-Chrome-Extension";
            } else {
                entry.extendedInfo = "chrome-extension"; // strip off the long hexidecimal garbage
            }
        }
        if ((entry.windowTitle == null) || (entry.windowTitle == "null")) {
            entry.windowTitle = "";
        }
        var csv = [
            '"',encodeURIComponent(entry.applicationName.toLowerCase()),'",',
            '"',entry.applicationVersion,'",',
            '"",', // hash
            '"',encodeURIComponent(entry.windowTitle),'",',
            '"',encodeURIComponent(entry.extendedInfo),'",',
            '"',this.util.isoDate(entry.started),'",',
            '"',this.util.isoDate(entry.completed),'",',
            '"',entry.entityType,'",',
            '"",', // productivity
            '"",', // category
            '"",', // project
            '""', // location
        ];
        return csv;
    },
    checkOpenLogEntry: function(changed) {
        if (this.openLogEntry == null) {
            this.openLogEntry = this.newLogEntry();
        } else if (changed) {
            var logEntry = this.emitRetiredLogEntry();
            this.openLogEntry = this.newLogEntry();
            if (logEntry == null) {
                this.util._log("odd, shouldn't be null open entry");
            } else {
                //this.util._log("closed an open log: ", logEntry.extendedInfo);
            }
        }
    },
    emitRetiredLogEntry: function(rollbackSeconds) {
        return this.emitClosedLogEntry(true, rollbackSeconds);
    },
    emitInterruptedLogEntry: function() {
        return this.emitClosedLogEntry(false);
    },
    emitClosedLogEntry: function(retireCurrent, rollbackSeconds) {
        var logEntry = null;
        if (this.openLogEntry != null) {
            logEntry = this.openLogEntry;
            logEntry.completed = new Date();
            // this should only happen if the system went to sleep with browser open
            // then the record could exceed the max theoretical limit of a single record
            // which is the max time between memlog rotations
            // anding 30 seconds of slush to avoid races at the boundary
            if ((logEntry.completed - logEntry.started) > (30000 + Math.min(this.logToStorageFlushPeriod,
                                    (this.config.getCommonConfig('push_interval') * 1000)))) {
                this.util._log("discarding: duration exceeds max rotation, must be sleep event: ",
                               this.entryToCSVarray(logEntry).join(''));
                this.openLogEntry = null;
                return null;
            }
            if (logEntry.completed < logEntry.started) {
                this.util._log("whoaaa... discarding, can't have negative duration: ",
                               ((logEntry.started - logEntry.completed)/1000));
                this.openLogEntry = null;
                return null;
            }
            if (retireCurrent) {
                this.openLogEntry = null;
            } else {
                var newOpenLogEntry = this.newLogEntry();
                newOpenLogEntry.windowTitle = logEntry.windowTitle;
                newOpenLogEntry.extendedInfo = logEntry.extendedInfo;
                newOpenLogEntry.started = logEntry.completed;
                newOpenLogEntry.completed = null;
                this.openLogEntry = newOpenLogEntry;
                this.util._log("re-opened a new log entry after close: ", this.entryToCSVarray(this.openLogEntry).join(''));
            }
            if (rollbackSeconds != null) {
                this.util._log("going to rollback idle period: " + rollbackSeconds);
                logEntry.completed.setSeconds(logEntry.completed.getSeconds() - rollbackSeconds);
            }
        }
        if ((logEntry != null) & (this.config.shouldLogTime())) {
            this.storeLogEntry(logEntry);
        }
        return logEntry;
    },
    housekeepingGenerator: function() {
        var self = this;
        return function() {
            // pause state management
            if (self.isPaused()) {
                // the isPaused check will clean up if pause has elapsed in background
            }
            // idle state management
            chrome.idle.queryState(self.config.common.idle_time_start, function(sysState){
                if ((sysState === "idle") || (sysState === "locked")) {
                    self.util._log("gone idle");
                    self.idleStateHandler();
                }
            });

            if (self.isIdleUser()) {
                self.idleStateHandler();
            }

            // safely flush to disk in case of quit / crash every so often
            // should only fire for free users since pro last log sent should be more recent
            var now = Date.now();
            if ((now > self.nextLogToStorageFlush) && (self.nextLogToStorageFlush > self.lastLogSent)) {
                // the store procedure updates nextLogToStorageFlush
                if (self.memoryLog.length === 0) { // reset timer if theres nothing there
                    self.nextLogToStorageFlush = now + self.logToStorageFlushPeriod;
                } else {
                    self.util._log('storing log to protext against shutdown');
                    self.rotateMemoryLog(true); // true means dont send just store
                }
            }
        };
    },
    startHousekeeping: function() {
        this.util.onInterval("housekeeping", this.housekeepingGenerator(), this.scanInterval);
        this.log("housekeeping starting");
    },
    stopHousekeeping: function() {
        this.util.cancel("housekeeping");
    },
    logPusherGenerator: function() {
        var self = this;
        return function() {
            self.rotateMemoryLog();
        };
    },
    startLogPusher: function() {
        this.util.onInterval("log_pusher", this.logPusherGenerator(),
                             this.config.common.push_interval * 1000);
    },
    stopLogPusher: function() {
        this.util.cancel("log_pusher");
    },
    logPusherRunning: function() {
        return this.util.isRunning('log_pusher');
    },
    messagePullerGenerator: function() {
        var self = this;
        return function() {
            self.util._log("should pull messages");
            self.api.pullMessages();
        };
    },
    startMessagePuller: function() {
        this.util.onInterval("message_puller", this.messagePullerGenerator(),
                             this.config.common.pull_interval * 1000);
    },
    stopMessagePuller: function() {
        this.util.cancel("message_puller");
    },
    messagePullerRunning: function() {
        return this.util.isRunning("message_puller");
    },
    setActivationEmailCache: function(email) {
        this.activation_email_cache = email;
    },
    activationEmail: function() {
        if (this.activation_email_cache == null) {
            this.activation_email_cache = this.config.getConfigData("activation_email");
        }
        return this.activation_email_cache;
    },
    // mimic other clients
    computer_name: function() {
        var name = ["extension",this.util.getBrowser(),this.util.getSystem()].join("-");
        return name;
    },
    // mimic other clients
    os_username: function() {
        var name = this.activationEmail();
        return name;
    },
    log: function(message) {
        if (this.logMessages.length > 20) {
            this.logMessages.shift();
        }
        this.logMessages.push(Date.now() + " " + message);
    },
    logDebug: function(message) {
        if (this.debug) {
            this.util._log(message);
            this.log(message);
        }
    }
};

var EXPORTED_SYMBOLS = ["RescueTimeEngine"];
