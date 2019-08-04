// require RescueTimeUtil

var RescueTimeLocalStorage = {
    util: null,
    dataSets: 0,
    dataGets: 0,
    configSets: 0,
    configGets: 0,
    cfix: 'rescuetime.config.',
    dfix: 'rescuetime.data.',
    proxyStorage: null,
    lastGetDataKey: null,
    virtualStorageUrl: 'http://extension.rescuetime',

    initialize: function(util) {
        this.util = util;
        this.proxyStorage = chrome.storage.local;
        return this;
    },
    setStorage: function(storage) {
        this.proxyStorage = storage;
        return storage;
    },
    // these are for items that match other of our clients (rescuetimed.cfg)
    // and are synced with server
    setConfig: function(key, value) {
        this.configSets++;
        var storObj = {};
        storObj[this.cfix + key] = value;
        this.proxyStorage.set(storObj);
    },
    getConfig: function(keys, callback) {
        this.configGets += keys.length;
        this.proxyStorage.get(keys.map(k => this.cfix+k), callback);
    },
    deleteConfig: function(key) {
        this.proxyStorage.remove([this.cfix + key]);
    },
    removeConfig: function(key) {
        return this.deleteConfig(key);
    },
    // this for namespace scoped data
    setData: function(key, value) {
        this.dataSets++;
        var storObj = {};
        storObj[this.dfix + key] = value;
        this.proxyStorage.set(storObj);
    },
    getData: function(keys, callback) {
        this.dataGets += keys.length;
        this.proxyStorage.get(keys.map(k => this.dfix+k), callback);
    },
    deleteData: function(key) {
        this.proxyStorage.remove([this.dfix + key]);
    },
    removeData: function(key) {
        return this.deleteData(key);
    },
    setDataForClientFallback: function(key, value){
        try {
            localStorage.setItem(this.dfix + key, value); // For old storage DB fallback
        } catch(err) {
            return;
        }
    }
};
var EXPORTED_SYMBOLS = ['RescueTimeLocalStorage'];
