chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action === "START_SCRAPING") {
    chrome.tabs.sendMessage(sender.tab.id, {
      action: "START_SCRAPING"
    });
  }
});
