/* Copyright RescueTime, Inc. 2012
 * "Mark Wolgemuth" <mark@rescuetime.com>
 * all rights reserved
 */

var RescueTimeJq = jQuery.noConflict(true);
var RescueTimeBackgroundContainer = chrome.extension.getBackgroundPage();

RescueTimeJq(document).ready(function() {
    RescueTimePopover.initialize(RescueTimeBackgroundContainer.RescueTimeAPI);
    RescueTimePopover.load();
});
