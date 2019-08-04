// assume RTlib has been linked prior to execution

var RescueTimePopover = {
  initialized: false,
  lastMessage: '(no message)',
  api: null,
  disableUI: false,
  hooksRegistered: {},
  currentScreen: null,
  lastDashboardUrl: null,
  uiBusy: false,

  initialize: function(myapi) {
    if (this.initialized) { return this; }
    this.api = myapi;
    this.api.util._log('RescueTimePopover intialize');
    (function(self) { RescueTimeJq('#rt_popover_close').click(function() {
      self.api.util._log('close hook running');
      self.closePopover();
    }); })(this);
    this.navHooks();
    this.accountPanelHooks();
    this.pausePanelHooks();
    this.helpPanelHooks();
    this.modePanelHooks();
    this.debugHooks();
    this.setPopoverTitle();
    this.initialized = true;

    return this;
  },
  displayMessage: function(message) {
    if (message != null) {
      this.lastMessage = message;
    }
    RescueTimeJq('#rt_popover_message_span').text(this.lastMessage);
    RescueTimeJq('#rt_popover_messages').show();

    this.api.util.inFuture('clear_popover_messages', function() {
      RescueTimeJq('#rt_popover_messages').hide();
    }, 3000);
  },
  warning: function(message) {
    RescueTimeJq('#rt_popover_message_span').addClass('warning');
    RescueTimeJq('#rt_popover_message_span').removeClass('notice');
    this.displayMessage(message);
  },
  notice: function(message) {
    RescueTimeJq('#rt_popover_message_span').addClass('notice');
    RescueTimeJq('#rt_popover_message_span').removeClass('warning');
    this.displayMessage(message);
  },
  debug: function() {
    return (this.api.engine.debug);
  },
  closePopover: function() {
    this.api.util._log('RescueTimePopover.closePopover');
    this.api.util.cancel('debug_refresh');
    window.close();
  },
  load: function() {
    this.api.engine.logDebug('entered popover load hook');
    if (this.disableUI) {
      RescueTimeJq('#rt_popover_app_container').hide();
      RescueTimeJq('#rt_popover_no_app').show();
    } else {
      if (this.api.config.hasAccountKey()) {
        // if (this.api.webSocket._maxConnectAttemptsExceeded) {
        //   this.setScreen('mode');
        //   // prompt to select mode

        //   // set localLoggingEnabled

        //   // load dashbaord

        // } else {
        this.api.engine.logDebug('we have an activated system');
        this.setScreen('dashboard');
        this.api.pullConfig(this.panelStatusCallbackGenerator());

        if(this.api.engine.isLoggingDisabledLocally()){
          this.api.webSocket.connect();
        }
        this.api.util.setIcon(true);
      } else {

        var self = this,
            win = function(){
              self.api.util._log('found site login');

              var uiCallback = self.panelStatusCallbackGenerator();
              self.api.requestActivation(true, uiCallback);
            },
            fail = function(){
              self.api.util._log('no site login found');

              self.api.engine.logDebug('we do not have an activated system');
              self.api.listenForSiteLogin();
              self.setScreen('account');
            };
        this.api.checkForSiteLogin(win, fail);
      }
    }
    if (this.api.engine.isInsideLoggingSchedule()) {
      RescueTimeJq('#rt_popover_logging_schedule').hide();
    } else {
      RescueTimeJq('#rt_popover_logging_schedule').show();
    }
    if (this.api.engine.isPaused()) {
      RescueTimeJq('#rt_popover_nav_pause').text('Paused: click to unpause');
      RescueTimeJq('#rt_popover_nav_pause').addClass('warning');
    } else {
      RescueTimeJq('#rt_popover_nav_pause').text('Pause');
      RescueTimeJq('#rt_popover_nav_pause').removeClass('warning');
    }

    // Troubleshooting
    var indicatorText = 'x';
    if(this.api.webSocket._connected){
      indicatorText = this.api.webSocket._portsAvailable[this.api.webSocket._portIndex];
    } else if(this.api.webSocket._connectEnabled){
      indicatorText = '---';
    } else {
      indicatorText = 'ERR';
    }
    RescueTimeJq('DIV #rt-connection-indicator SPAN').text(indicatorText);
  },
  setPopoverTitle: function(){
    var manifest = chrome.runtime.getManifest();
    RescueTimeJq('H2.rt_popover_nav_browser_name').text(manifest.name);
  },
  setScreen: function(selected) {
    (function(self) {
      var screens = {
        dashboard: { show: function() { self.drawDashboardPanel(); },
                      hide: function() { RescueTimeJq('#rt_popover_dashboard_panel').hide(); } },
        account: { show: function() { self.drawAccountPanel(); },
                    hide: function() { RescueTimeJq('#rt_popover_account_panel').hide(); } },
        help: { show: function() { self.drawHelpPanel(); },
                hide: function() { RescueTimeJq('#rt_popover_help_panel').hide(); } },
        pause: { show: function() { self.drawPausePanel(); },
                 hide: function() { RescueTimeJq('#rt_popover_pause_panel').hide(); } },
        mode: { show: function() { self.drawModePanel(); },
                    hide: function() { RescueTimeJq('#rt_popover_mode_panel').hide(); } },
      };

      // if the nav is hidden and the account key exists, show it.
      if (self.api.config.hasAccountKey()) {
        RescueTimeJq('#rt_popover_nav_with_account:hidden').show();
      }

      if (! self.api.config.hasAccountKey()) {
        // also hide the nav in the top corner if there's no account.
        RescueTimeJq('#rt_popover_nav_with_account').hide();

        if (selected === 'dashboard') {
          selected = 'account';
        } else if (selected === self.currentScreen) {
          selected = 'account';
        }
      } else if (selected === self.currentScreen) {
        // reclick acts like screen close, default back to dashboard
        selected = 'dashboard';
      }

      for (var screen in screens) {
        if (selected === screen) {
          screens[screen].show();
          self.currentScreen = screen;
        } else {
          screens[screen].hide();
        }
      }

      self.api.util._log('setting screen: ' + selected);
    })(this);
  },
  panelStatusCallbackGenerator: function() {
    var self = this;
    var callback = function(action, message, extraCallback) {

      if (message != null && action !== 'inactive_session') {
        if (action === 'warning'){
          self.warning(message);
        } else {
          self.notice(message);
        }
      }

      if (extraCallback != null) {
        self.api.util._log('executing extra callback');
        extraCallback();
      }
      if (action != null) {
        if (action === 'reload' || action === 'warning') {
          self.load();
        } else if (action === 'reload_delayed') {
          self.api.util.inFuture('popover_reload', function() {
            self.api.util._log('executing popover reload');
            self.load();
          }, 1000);
        } else if(action === 'inactive_session'){
          self.drawAccountPanel();
        } else {
          self.api.util._log('TOTAL FAILURE');
        }
        // noop no need to match
      }
    };
    return callback;
  },
  drawAccountPanel: function() {
    var email = null;
    if (this.api.config.hasAccountKey()) {
      email = this.api.config.getConfigData('activation_email');
      RescueTimeJq('#rt_popover_account_panel_activation').hide();
      RescueTimeJq('#rt_popover_account_panel_active').show();
      if ((this.api.config.getSetting('plan_id') === 1) || (this.api.config.getSetting('premium_enabled') === false) || this.api.config.getSetting('premium_enabled') === 'false') {
        RescueTimeJq('#rt_popover_account_upgrade').show();
      }
      if (this.api.engine.isLoggingDisabledLocally()) {
        RescueTimeJq('#rt-connection-indicator').show();
        RescueTimeJq('#disable-plugin-logging').attr('checked', 'checked');
      }
      if (this.api.config.asBoolean(this.api.config.getConfigData('data_include_weekends'))) {
        RescueTimeJq('#daily-average-include-weekend').attr('checked', 'checked');
      }
      if (this.api.util.isCrOs()) {
        RescueTimeJq('#rescuetime-settings-disable-logging').hide();
      }
      RescueTimeJq('#rt_popover_account_registered_as').text(' for ' + email);
    } else {
      RescueTimeJq('#rt_popover_account_panel_active').hide();
      RescueTimeJq('#rt_popover_account_panel_activation').show();

      if (! this.api.util.isCrOs()) {
        RescueTimeJq('#rt_popover_account_local_logging').prop('checked', true);
      }
    }
    RescueTimeJq('#rt_popover_account_panel').show();
  },
  drawDashboardPanel: function() {
    RescueTimeJq('#rt_popover_dashboard_panel').show();
    this.api.util._log('should show dashboard');
    var dashboard_local_url = 'dashboard-local.html';
    var dashboard_offline_url = 'dashboard-offline.html';
    var dashboard_remote_url = this.getPopoverDashboardUrl();
    this.api.util._log('dashboard_remote_url: ', dashboard_remote_url);
    var test_connection_url = this.api.getGetUrl('/hello');

    (function(self) {
      self.api.util._log('getting remote dash: ', dashboard_remote_url);
      var success = function(response) {
        self.lastDashboardUrl = dashboard_remote_url;
        self.api.util._log('will show remote dash: ', dashboard_remote_url);
        RescueTimeJq('#rt_popover_dashboard_iframe').attr('src', dashboard_remote_url);
      };
      var fail = function(fail) {
        self.lastDashboardUrl = dashboard_offline_url;
        self.api.util._log('will show local dash: ', dashboard_offline_url);
        // in the future we could distinguish between offline and RescueTime timeout
        // right now it treats them the same
        RescueTimeJq('#rt_popover_dashboard_iframe').attr('src', dashboard_offline_url);
      };
      // let them spin for 10 seconds or give up
      self.api.util.getRequest(test_connection_url, success, fail, { 'timeout' : 10000 } );
    })(this);
  },
  drawPausePanel: function() {
    if (this.api.engine.isPaused()) {

    } else {
      RescueTimeJq('#rt_popover_pause_panel').show();
    }
  },
  drawHelpPanel: function() {
    RescueTimeJq('#rt_popover_help_panel').show();
    if (RescueTimeJq('#rt_popover_help_panel').is(':visible')) {
      RescueTimeJq('#rt_popover_help_email').hide();
      RescueTimeJq('#rt_popover_help_main').show();
    }
  },
  drawModePanel: function() {
    this.api.util.setIcon(false);
    this.setPopoverTitle();
    RescueTimeJq('#rt_popover_mode_panel').show();
  },
  enableActivationButtons: function() {
    RescueTimeJq('#rt_popover_activation_button').removeClass('disabled');
  },
  disableActivationButtons: function() {
    RescueTimeJq('#rt_popover_activation_button').addClass('disabled');
  },
  navHooks: function() {
    if (this.hooksRegistered.navHooks) {
      return;
    }
    (function(self) {
      RescueTimeJq('#rt_popover_nav_dashboard, #rt_popover_nav_more_stats').click(function() {
        if (self.api.config.hasAccountKey()) {
          if (self.currentScreen === 'dashboard') {
            self.openUrlInTab(self.api.getGetUrl('/dashboard',
                                                 'from=extension&activation_email='+ encodeURIComponent(self.api.config.getConfigData('activation_email'))));
          } else {
            self.setScreen('dashboard');
          }
        } else {
          self.setScreen('account');
        }
      });
      RescueTimeJq('#rt_popover_nav_account').click(function() {
        self.setScreen('account');
      });
      // don't show the pause tab if we're not doing local logging
      if (self.api.engine.isLoggingDisabledLocally()) {
        RescueTimeJq('#rt_popover_nav_pause').hide();
        RescueTimeJq('#rt_popover_nav_pause_spacer').hide();
      }
      RescueTimeJq('#rt_popover_nav_pause').click(function() {
        if (self.api.engine.isPaused()) {
          self.api.engine.unPause();
          self.closePopover();
        } else {
          self.setScreen('pause');
        }
      });
      RescueTimeJq('#rt_popover_nav_help').click(function() {
        self.drawHelpPanel();
        self.setScreen('help');
      });
    })(this);
  },
  accountPanelHooks: function() {
    (function(self) {
      RescueTimeJq('#rt_popover_account_registered_as').click(function() {
        self.openUrlInTab(self.api.getGetUrl('/users/settings',
                                             'from=extension&activation_email='+ encodeURIComponent(self.api.config.getConfigData('activation_email'))));
      });
      RescueTimeJq('#rt_popover_account_settings_account').click(function() {
        self.openUrlInTab(self.api.getGetUrl('/users/settings',
                                             'from=extension&activation_email='+ encodeURIComponent(self.api.config.getConfigData('activation_email'))));
      });
      RescueTimeJq('#rt_popover_account_settings_monitoring').click(function() {
        self.openUrlInTab(self.api.getGetUrl('/accounts/monitoring_options',
                                             'from=extension&activation_email='+ encodeURIComponent(self.api.config.getConfigData('activation_email'))));
      });
      RescueTimeJq('#rt_popover_account_forget').click(function() {
        RescueTimeJq('#rt_popover_account_forget_confirm').show();
      });
      RescueTimeJq('#rt_popover_account_forget_ok').click(function() {
        self.api.engine.logDebug('Resetting configuration!');
        RescueTimeJq('#rt_popover_account_forget_confirm').hide();
        self.api.engine.hardReset(function() {
          self.openUrlInTab(self.api.getGetUrl('/logout', 'from=extension&redirect_to=' + encodeURIComponent('/login')));
        });
        self.api.listenForSiteLogin();
        self.setPopoverTitle();
      });
      RescueTimeJq('#rt_popover_account_forget_cancel').click(function() {
        RescueTimeJq('#rt_popover_account_forget_confirm').hide();
      });
      RescueTimeJq('#rt_popover_account_upgrade_now').click(function() {
        self.openUrlInTab(self.api.getGetUrl('/upgrade',
                                             'from=extension&activation_email='+ encodeURIComponent(self.api.config.getConfigData('activation_email'))));
      });

      if (! self.api.util.isCrOs()) {
        RescueTimeJq('#rt_popover_account_local_logging').prop('checked', true);
      } else {
        RescueTimeJq('#rt-activation-info-not-cros').hide();
      }
      RescueTimeJq('#rt_popover_nav_signin_link A').click(function() {
        self.openUrlInTab(self.api.getGetUrl('/logout', 'from=extension&redirect_to=' + encodeURIComponent('/login')));
        // self.openUrlInTab(self.api.getGetUrl('/login', 'from=extension'));
        self.api.listenForSiteLogin();
      });
      RescueTimeJq('#rt_popover_nav_signup_link A').click(function() {
        self.openUrlInTab(self.api.getGetUrl('/logout', 'from=extension&redirect_to=' + encodeURIComponent('/signup/solo/lite')));
        // self.openUrlInTab(self.api.getGetUrl('/plans', 'from=extension'));
        self.api.listenForSiteLogin();
      });
      RescueTimeJq('#disable-plugin-logging').change(function() {
        var checked = this.checked;
        self.selectPluginMode(!checked);
      });
      RescueTimeJq('#daily-average-include-weekend').change(function() {
        var checked = this.checked;
        if (checked) {
          self.api.config.setConfigData('data_include_weekends', true);
        } else {
          self.api.config.setConfigData('data_include_weekends', false);
        }
      });
    })(this);
  },
  helpPanelHooks: function() {
    var popover = this;
    RescueTimeJq('#rt_popover_help_debug').click(function() {
      RescueTimeJq('#rt_popover_debug_panel').toggle();
      popover.api.util._log('should toggle debug panel');
      if (RescueTimeJq('#rt_popover_debug_panel').is(':visible')) {
        popover.api.engine.debug = true;
        popover.loadDebug();
      } else {
        popover.closeDebugPanel();
      }
    });
    RescueTimeJq('#rt_popover_help_why_email').click(function() {
      RescueTimeJq('#rt_popover_help_email').show();
      RescueTimeJq('#rt_popover_help_panel').show();
      RescueTimeJq('#rt_popover_help_main').hide();
    });
    this.hooksRegistered.helpPanelHooks = true;
  },
  pausePanelHooks: function() {
    if (this.hooksRegistered.pausePanelHooks) {
      return;
    }
    (function(self) {
      RescueTimeJq('#rt_popover_pause_for_button').click(function() {
        var pause_for = RescueTimeJq('#rt_popover_pause_for_minutes').val();

        if ((pause_for == null) || (pause_for === '')) {
          pause_for = 30;
        }
        var pause_until = Date.now() + (pause_for * 60 * 1000);
        self.api.util._log('got pause_for: ', pause_for, ' pause until: ', pause_until);
        self.api.engine.pauseUntil(pause_until);
        self.closePopover();
      });
      RescueTimeJq('#rt_popover_pause_tomorrow_button').click(function() {
        var tomorrow = new Date();
        // d = new Date(); d.setMinutes(0) ; d.setSeconds(0) ; d.setHours(24) ; d.getTime();
        tomorrow.setMinutes(0);
        tomorrow.setSeconds(0);
        tomorrow.setHours(24); // this will roll the time to next 00:00
        var pause_until = tomorrow.getTime();
        self.api.util._log('got pause until tomorrow: ', pause_until);
        self.api.engine.pauseUntil(pause_until);
        self.closePopover();
      });
    })(this);
    this.hooksRegistered.pausePanelHooks = true;
  },
  modePanelHooks: function() {
    (function(self) {
      RescueTimeJq('#rt_popover_mode_panel A#disable_local_log').click(function() {
        self.api.util.setIcon(true);
        self.selectPluginMode(false);
        self.setScreen('dashboard');
        self.api.webSocket._maxConnectAttemptsExceeded = false;
        self.api.webSocket.enableConnect();
      });
      RescueTimeJq('#rt_popover_mode_panel A#enable_local_log').click(function() {
        self.api.util.setIcon(true);
        self.selectPluginMode(true);
        self.setScreen('dashboard');
        self.api.webSocket._maxConnectAttemptsExceeded = false;
      });
    })(this);

  },
  selectPluginMode: function(enableLogging){
    this.api.config.setConfigData('local_logging_enabled', enableLogging);

    if(enableLogging){
      // standalone
      RescueTimeJq('#rt-connection-indicator').hide();
      RescueTimeJq('#rt_popover_nav_pause').show();
      RescueTimeJq('#rt_popover_nav_pause_spacer').show();
      if (! this.api.engine.messagePullerRunning()) {
        this.api.pullMessages();
        this.api.engine.startMessagePuller();
      }

      if(! this.api.engine.logPusherRunning()){
        this.api.engine.startLogPusher();
      }
      this.api.webSocket.disconnect();
    } else {
      RescueTimeJq('#rt-connection-indicator').show();
      RescueTimeJq('#rt_popover_nav_pause').hide();
      RescueTimeJq('#rt_popover_nav_pause_spacer').hide();
      this.api.engine.stopLogPusher();
      this.api.engine.stopMessagePuller();
      this.api.engine.clearAllLogEntries();
      this.api.webSocket.connect();
    }
  },
  openUrlInTab: function(url) {
    var self = this;
    if(self.uiBusy === true) { return false; }

    self.uiBusy = true;
    chrome.tabs.query({url: url}, function(tabs) {
      if (tabs[0] == null) {
        chrome.tabs.create({url: url}, function(tab){
          self.api.util._log('will open in tab: ', url);
          self.closePopover();
        });
      } else {
        var activeTab = tabs[tabs.length - 1];
        chrome.tabs.update(activeTab.id, {active: true});
        chrome.tabs.reload(activeTab.id);
        self.closePopover();
      }

      self.uiBusy = false;
    });
  },
  getPopoverDashboardUrl: function() {
    var url = '';
    if (this.api.engine.mostRecentUrlNotSelf != null) {
      url = this.api.engine.mostRecentUrlNotSelf.split('?')[0];
    }

    var params = {
      rtapi_key: this.api.config.data.data_key,
      time_frame: 'day',
      limit: 7,
      current_url: url,
      current_title: this.api.engine.mostRecentTitleNotSelf,
      rescuetime_extension_requestor_browser: this.api.util.getBrowser(),
      from: 'extension',
      activation_email: this.api.config.getConfigData('activation_email'),
    };
    if (! this.api.config.asBoolean(this.api.config.getConfigData('data_include_weekends'))) {
      params.weekday_aware = 'true';
    }
    return this.api.getGetUrl('/x/popover', RescueTimeJq.param(params, true));
  },
  logDebug: function(entry) {
    RescueTimeJq('#rt_popover_debug_log').append('<br />' + entry);
  },
  closeDebugPanel: function() {
    this.api.engine.debug = false;
    this.api.util.cancel('debug_refresh');
    RescueTimeJq('#rt_popover_debug_panel').hide();
  },
  debugHooks: function() {
    var popover = this;
    RescueTimeJq('#rt_popover_debug_close').click(function() {
      popover.closeDebugPanel();
    });
    RescueTimeJq('#rt_popover_debug_hello').click(function() {
      popover.api.hello();
    });
    RescueTimeJq('#rt_popover_debug_reset').click(function() {
      popover.api.engine.log('Resetting configuration!');
      RescueTimeJq('#rt_popover_dashboard_panel').hide();
      popover.api.engine.hardReset(function() { popover.load(); });
    });
    this.hooksRegistered.debugHooks = true;
  },
  loadDebug: function() {
    this.drawDebug();
    this.api.util.cancel('debug_refresh');
    (function(self) {
      self.api.util._log('reset debug timer');
      self.api.util.onInterval('debug_refresh', function() {
        self.drawDebug();
      }, 1000);
    })(this);
  },
  drawDebug: function() {
    var url = this.api.engine.mostRecentUrl;
    var title = this.api.engine.mostRecentTitle;
    var debug_messages = [
      'os_username: [', this.api.engine.os_username(),
      '] computer_name: [', this.api.engine.computer_name(),
      '] <br />extension reloads: ', this.api.engine.extensionLoads,
      ' scans: ', this.api.engine.scannerLoops,
      ' data gets/sets/last: ',
      this.api.storage.dataGets,'/',this.api.storage.dataSets,'/',
      ' conf gets/sets: ',
      this.api.storage.configGets,'/',this.api.storage.configSets,
      '<br />CurrentUrl: ', url,
      '<br />CurrentTitle: ', title,
    ];
    RescueTimeJq('#rt_popover_debug_message').text(debug_messages.join(''));
    RescueTimeJq('#rt_popover_debug_log').text('Logs entries:');
    for (var i in this.api.engine.logMessages) {
      this.logDebug(this.api.engine.logMessages[i]);
    }
  }
};
