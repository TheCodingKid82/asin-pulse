'use strict';
(async()=>{
  try {
    await chrome.storage.local.set({reopenAfterUpdate:Date.now()});
    chrome.runtime.reload();
  } catch {
    document.getElementById('status').textContent='Open chrome://extensions and click the reload button on ASIN Pulse, then reopen it.';
  }
})();
