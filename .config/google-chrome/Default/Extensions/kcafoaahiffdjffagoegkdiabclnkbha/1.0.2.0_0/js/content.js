chrome.extension.onMessage.addListener(function (request, sender, sendResponse) {
    if (request && request.action == "updateSelection") {
        var sel, range;
        if (window.getSelection) {
            sel = window.getSelection();
            if (sel.rangeCount) {
                range = sel.getRangeAt(0);
                range.deleteContents();
                range.insertNode(document.createTextNode(request.text));
            }
        } else if (document.selection && document.selection.createRange) {
            range = document.selection.createRange();
            range.text = request.text;
        }
    }
});