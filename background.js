// background.js — service worker
importScripts('storage.js');

// Open side panel when extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });


// Runs in the page's main world — reads the editor content (CSP-exempt)
function getEditorContent() {
  const cm = document.querySelector('.CodeMirror');
  if (cm && cm.CodeMirror) return cm.CodeMirror.getValue();
  if (typeof monaco !== 'undefined' && monaco.editor) {
    const eds = monaco.editor.getEditors();
    if (eds.length) return eds[0].getValue();
    const models = monaco.editor.getModels();
    if (models.length) return models[0].getValue();
  }
  return null;
}

// Runs in the page's main world — writes to the editor (CSP-exempt)
function setEditorContent(script) {
  const cm = document.querySelector('.CodeMirror');
  if (cm && cm.CodeMirror) { cm.CodeMirror.setValue(script); return true; }
  if (typeof monaco !== 'undefined' && monaco.editor) {
    const eds = monaco.editor.getEditors();
    if (eds.length) { eds[0].setValue(script); return true; }
  }
  return false;
}

// Runs in the page's main world — returns diagnostic info
function diagnoseEditor() {
  const cm = document.querySelector('.CodeMirror');
  return {
    hasCM:           !!cm,
    hasCMInstance:   !!(cm && cm.CodeMirror),
    hasMonacoEl:     !!document.querySelector('.monaco-editor'),
    hasMonacoGlobal: typeof monaco !== 'undefined',
    monacoEditors:   (typeof monaco !== 'undefined' && monaco.editor) ? monaco.editor.getEditors().length : -1,
    monacoModels:    (typeof monaco !== 'undefined' && monaco.editor) ? monaco.editor.getModels().length : -1,
    textareas:       document.querySelectorAll('textarea').length,
    iframes:         document.querySelectorAll('iframe').length,
    title:           document.title,
    url:             location.href
  };
}

async function execInPage(tabId, func, args) {
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    world: 'MAIN',
    func,
    args: args || []
  });
  return results?.[0]?.result ?? null;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse).catch(err => sendResponse({ error: err.message }));
  return true;
});

async function handleMessage(msg, sender) {
  switch (msg.type) {

    case 'CAPTURE_FOR_TAB': {
      // Triggered by content script on Ctrl+S / save button
      const tabId = sender.tab?.id;
      if (!tabId) return { ok: false, error: 'No tab ID' };
      const script = await execInPage(tabId, getEditorContent);
      if (!script) return { ok: false, error: 'Editor not found' };
      const version = await saveVersion(msg.appId, msg.appName, script, '');
      return { ok: true, version };
    }

    case 'GET_SCRIPT': {
      const script = await execInPage(msg.tabId, getEditorContent);
      return { ok: !!script, script };
    }

    case 'SET_SCRIPT': {
      const ok = await execInPage(msg.tabId, setEditorContent, [msg.script]);
      return { ok: !!ok };
    }

    case 'DEBUG_EDITOR': {
      const info = await execInPage(msg.tabId, diagnoseEditor);
      return { ok: true, info };
    }

    case 'SAVE_VERSION':
      return { ok: true, version: await saveVersion(msg.appId, msg.appName, msg.script, msg.label) };

    case 'GET_VERSIONS':
      return { ok: true, versions: await getVersions(msg.appId) };

    case 'DELETE_VERSION':
      await deleteVersion(msg.appId, msg.versionId);
      return { ok: true };

    default:
      return { error: `Unknown message type: ${msg.type}` };
  }
}
