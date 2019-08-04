var RescueTimeDetector = {
  events: ["focus", "click", "keydown", "mousemove"],
  not_before: 0,
  messager: function(e) {
    var now = Date.now();
    if (now > RescueTimeDetector.not_before) {
      var hid_type = "hid_" + e.type;

      try {
        chrome.runtime.sendMessage({"active":"true", "type": hid_type}, function(response){
          var lastErr = chrome.runtime.lastError;
          if (lastErr) {
            // Chrome runtime fix
            return Promise.resolve("Dummy response to keep the console quiet");
          }
        });
        RescueTimeDetector.not_before = now + 250;
      } catch (e) {
        console.log('RT: removing stale event listeners due to update');

        for (var i = 0; i < RescueTimeDetector.events.length; i++) {
          window.removeEventListener(RescueTimeDetector.events[i], RescueTimeDetector.messager);
        }
      }
    }
  }
};

for (var i = 0; i < RescueTimeDetector.events.length; i++) {
  window.removeEventListener(RescueTimeDetector.events[i], RescueTimeDetector.messager);
  window.addEventListener(RescueTimeDetector.events[i], RescueTimeDetector.messager, false);
}
