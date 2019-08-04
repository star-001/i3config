/* Copyright RescueTime, Inc. 2012
 * "Mark Wolgemuth" <mark@rescuetime.com>
 * all rights reserved
 */

// browser specific hooks installed here if they can't be handled automatically
// fix this per http://code.google.com/p/pgn4web/issues/detail?id=110

RescueTimeEngine.debug = false;
RescueTimeAPI.initialize(RescueTimeEngine
			             .initialize(RescueTimeWebSocket
                                     .initialize(RescueTimeClientConfig
				                                 .initialize(RescueTimeLocalStorage
						                                     .initialize(RescueTimeUtil
							                                              .initialize(RescueTimeTimer))))));
jQuery.noConflict();

function rescuetime_webrequest_begun(details){
    var url = details.url;
    if (RescueTimeAPI.engine.storeCurrentUrl(url)) {
	    // changed
	    RescueTimeAPI.engine.storeCurrentTitle(null);
	    //RescueTimeAPI.engine.setCurrentUrlAndTitle();
    }
}
function rescuetime_webrequest_done(details){
    var url = details.url;
    //RescueTimeAPI.engine.logDebug("event done url: " + url);
    // url and title are discovered in the function below
    RescueTimeAPI.engine.setCurrentUrlAndTitle();
}

var rescuetime_webrequest_filter = {
    urls: ["<all_urls>"],
    types: ["main_frame"]
};

chrome.webRequest.onBeforeRequest.addListener(rescuetime_webrequest_begun,
					                          rescuetime_webrequest_filter, null);
chrome.webRequest.onCompleted.addListener(rescuetime_webrequest_done,
					                      rescuetime_webrequest_filter, null);

function checkLastError(){
  var lastErr = chrome.runtime.lastError;
  if (lastErr) {
    RescueTimeUtil._log('caught lastError: ' + JSON.stringify(lastErr));
    // Chrome runtime fix
    return Promise.resolve("Dummy response to keep the console quiet");
  }
}

// inject to all open tabs
chrome.runtime.onInstalled.addListener(function(){
  chrome.tabs.query({}, function(tabs) {
    for(var i in tabs) {
      chrome.tabs.executeScript(tabs[i].id, {file: "detect_focus.js"}, checkLastError);
    }
  });
});

