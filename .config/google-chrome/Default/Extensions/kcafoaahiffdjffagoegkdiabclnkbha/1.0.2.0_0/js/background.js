chrome.contextMenus.removeAll();

chrome.contextMenus.create({
    "id": "Encode",
    "contexts": ["selection"],
    "onclick": function (info, tab) {
        chrome.tabs.sendMessage(tab.id, { action: "updateSelection", selection: info.selectionText, text: btoa(info.selectionText) });
    },
    "title": "Base64 Encode"
});

chrome.contextMenus.create({
    "id": "Decode",
    "contexts": ["selection"],
    "onclick": function (info, tab) {
        chrome.tabs.sendMessage(tab.id, { action: "updateSelection", selection: info.selectionText, text: atob(info.selectionText) });
    },
    "title": "Base64 Decode"
});