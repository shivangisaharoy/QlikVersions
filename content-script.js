// content-script.js
// Detects the current app ID and intercepts save events.
// Does NOT read the editor directly — delegates that to the background worker
// which uses chrome.scripting.executeScript (CSP-exempt, runs in page world).

(function () {
  'use strict';

  let currentAppId = null;
  let saveIntercepted = false;

  function parseAppId(url) {
    const match = url.match(/\/app\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    return match ? match[1] : null;
  }

  function getAppName() {
    const el = document.querySelector('.qs-toolbar-app-name, .app-name, [class*="appName"]');
    if (el) return el.textContent.trim();
    const m = document.title.match(/^(.+?)\s*[-–|]\s*Qlik/i);
    return m ? m[1].trim() : (currentAppId || 'Unknown App');
  }

  function hookSaveEvents() {
    if (saveIntercepted) return;
    saveIntercepted = true;

    // Ctrl+S
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        setTimeout(() => {
          if (!currentAppId) return;
          chrome.runtime.sendMessage({
            type: 'CAPTURE_FOR_TAB',
            appId: currentAppId,
            appName: getAppName()
          });
        }, 300);
      }
    }, true);

    // Save button
    const saveSelectors = [
      '[data-testid="save-button"]',
      '.lui-button--primary[tid="save"]',
      'button[title="Save"]',
      '.qs-save-button'
    ];
    document.addEventListener('click', (e) => {
      if (e.target.closest(saveSelectors.join(','))) {
        setTimeout(() => {
          if (!currentAppId) return;
          chrome.runtime.sendMessage({
            type: 'CAPTURE_FOR_TAB',
            appId: currentAppId,
            appName: getAppName()
          });
        }, 300);
      }
    }, true);
  }

  function watchForEditor() {
    const observer = new MutationObserver(() => {
      if (document.querySelector('.CodeMirror, .monaco-editor')) hookSaveEvents();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_CURRENT_APP') {
      sendResponse({ appId: currentAppId, appName: getAppName() });
      return true;
    }
  });

  function init() {
    const appId = parseAppId(window.location.href);
    if (!appId) return;
    currentAppId = appId;
    watchForEditor();
    if (document.querySelector('.CodeMirror, .monaco-editor')) hookSaveEvents();
  }

  // Re-init on SPA navigation
  let lastUrl = window.location.href;
  new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      saveIntercepted = false;
      init();
    }
  }).observe(document.body, { childList: true, subtree: true });

  init();
})();
