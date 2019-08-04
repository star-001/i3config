// Copyright RescueTime, Inc.
// require RescueTimeUtil
// require RescueTimeLocalStorage

var RescueTimeClientConfig = {
    storage: null,
    util: null,
    protocol: 'https://',
    isResetting: false,
    _reset_config: {
        account_key: null,
        whitelist: null,
        plan_id: null,
        paused_until: null,
        blocking_enabled: null,
        identity: null
    },
    common: {
        account_key: null,
        url: 'api.rescuetime.com:443',
        ui_url: 'www.rescuetime.com',
        logging_enabled: true,
        scan_interval: 1,
        push_interval: 180,
        pull_interval: 60,
        idle_time_start: 120,
        idle_time_away: 120,
        paused_until: null,
        timepie_enabled: false,
        timepie_labels: null,
        blocking_enabled: true,
        blocking_allow_rescore: true,
        pausing_allowed: true,
        focused_time_allowed: true,
        plan_id: null,
        whitelist: null,
        premium_enabled: true,
        // below not impl
        full_urls_enabled: true,
        whitelist_enabled: true,
        window_titles_enabled: true, // TODO
        alerts_enabled: true, // TODO
        logging_schedule_enabled: false, // TODO
        logging_scheduled_days: '127',
        logging_scheduled_start_hour: null,
        logging_scheduled_stop_hour: null,
        goto_dashboard_allowed: true,
        debug_log_level: 1,
        // ignored
        ssl_enabled: true,
        projects_enabled: true,
        hotkey_enabled: true,
        hotkey_char: 'ctrl+shift+s',
        quitting_allowed: true,
        identity: null,
        idle_activities: []
    },
    _reset_data: {
        data_key: null,
        local_logging_enabled: false,
        activation_code: null,
        activation_url: null,
        activation_email: null
    },
    data: {
        data_key: null,
        local_logging_enabled: false,
        activation_code: null,
        activation_url: null,
        activation_email: null
    },
    initialize: function(storage) {
        this.storage = storage;
        this.util = storage.util;
        this.loadLocalStorage('common');
        this.loadLocalStorage('data');
        return this;
    },
    matchesCommonConfig: function(key, value) {
        if (this.common[key] === value) {
            return true;
        }
        return false;
    },
    getCommonConfig: function(key) {
        return this.common[key];
    },
    setCommonConfig: function(key, value) {
        this.common[key] = value;
        this.storage.setConfig(key, value);
        return value;
    },
    setConfigData: function(key, value) {
        this.data[key] = value;
        this.storage.setData(key, value);
        return value;
    },
    getConfigData: function(key) {
        return this.data[key];
    },
    removeConfigData: function(key) {
        this.data[key] = this._reset_data[key];
        return this.storage.deleteData(key);
    },
    getSetting: function(key) { // merged view of common + data configs
        var value = this.common[key];
        if (value == null) {
            value = this.getConfigData(key);
            if (this.blankOrNull(value)) {
                value = null;
            }
        }
        return value;
    },
    asBoolean: function(value) {
        if ((value === 'true') || (value === true)) {
            return true;
        }
        return false;
    },
    blankOrNull: function(value) {
        if ((value) && (value != null) && (value !== '')) {
            return false;
        }
        return true;
    },
    loadLocalStorage: function(namespace) {
        var self = this,
            storageKeys = Object.keys(this[namespace]),
            storageKeyPrefix = this.storage[ namespace[0]+'fix' ],
            appValue,
            appKey;

        var storageCallback = function(data){
            for (var storageKey in data) {
                appKey = storageKey.split(storageKeyPrefix)[1];
                appValue = self[namespace][appKey];
                if (typeof(self[namespace][appKey]) === 'boolean') {
                    if ((data[storageKey] === 'true') || (data[storageKey] === true)) {
                        self[namespace][appKey] = true;
                    } else if ((data[storageKey] === 'false') || (data[storageKey] === false)) {
                        self[namespace][appKey] = false;
                    } else {
                        self[namespace][appKey] = null;
                    }
                } else {
                    self[namespace][appKey] = data[storageKey];
                }
                // preserve default value if local copy is null
                if (self[namespace][appKey] == null) {
                    self[namespace][appKey] = appValue;
                }
            }
        };

        if(namespace === 'common'){
            this.storage.getConfig(storageKeys, storageCallback);
        } else {
            this.storage.getData(storageKeys, storageCallback);
        }
    },
    resetConfig: function() {
        var self = this;
        for (var key in self._reset_config) {
            self.setCommonConfig(key, this._reset_config[key]);
            self.storage.deleteConfig(key);
        }
        for (var dkey in self._reset_data) {
            self.setConfigData(dkey, this._reset_data[dkey]);
            self.storage.deleteData(dkey);
        }
    },
    shouldLogTime: function() {
        if (this.hasAccountKey() &&
            ((this.common.logging_enabled) && (this.common.logging_enabled !== false) && (this.common.logging_enabled !== 'false'))) {
            return true;
        }
        return false;
    },
    hasAccountKey: function() {
        if (this.common.account_key) {
            if ((this.common.account_key != null) && (this.common.account_key !== '')) {
                return true;
            }
        }
        return false;
    }
};

var EXPORTED_SYMBOLS = ['RescueTimeClientConfig'];
