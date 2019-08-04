function RescueTimeTimer(platform, callback, interval) {
    this.callback = callback;
    this.interval = interval;
    this.platform = platform;
    this.handle = null;
    this.finished = false;
    this._repeating = false;
    this._use_nsi_timer = false;

    this.set = function(repeat) {
        this._repeating = repeat;
        if (this.handle != null) {
            return null;
        }
        if (this._repeating) {
            this.handle = window.setInterval(this.callback, this.interval);
        } else {
            this.handle = window.setTimeout(this.callback, this.interval);
        }
        return this;
    };
    this.useNsiTimer = function() {
      this._use_nsi_timer = true;
    };
    this.once = function() {
        return this.set(false);
    };
    this.repeat = function() {
        this.repeating = true;
        return this.set(true);
    };
    this.cancel = function() {
        if (this._repeating) {
            window.clearInterval(this.handle);
        } else {
            window.clearTimeout(this.handle);
        }
        return this;
    };
}

var EXPORTED_SYMBOLS = ['RescueTimeTimer'];
