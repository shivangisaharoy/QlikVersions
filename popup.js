// popup.js

let currentAppId = null;
let currentTabId = null;
let allVersions = [];
let diffSelection = [];

const SERVERS_KEY = 'qlikServerUrls';

document.addEventListener('DOMContentLoaded', async () => {
  chrome.storage.local.remove('qlikBaseUrl');
  await setupServerSettings();
  await detectCurrentApp();
  setupSnapshotButton();
  setupDiffClose();
  setupTabListeners();
});

// ── Re-detect when the user switches tabs ─────────────────────────────────────
function setupTabListeners() {
  chrome.tabs.onActivated.addListener(() => refreshDetection());

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab?.id === tabId) refreshDetection();
      });
    }
  });
}

// ── Server list storage ───────────────────────────────────────────────────────
function getConfiguredServers() {
  return new Promise(resolve => {
    chrome.storage.local.get(SERVERS_KEY, data => {
      resolve(data[SERVERS_KEY] || []);
    });
  });
}

function saveConfiguredServers(urls) {
  return new Promise(resolve => chrome.storage.local.set({ [SERVERS_KEY]: urls }, resolve));
}

function getHostname(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

// ── Settings UI ───────────────────────────────────────────────────────────────
async function setupServerSettings() {
  const urls = await getConfiguredServers();
  renderServerList(urls);
  updateServerBadge(urls.length);

  document.getElementById('btn-toggle-settings').addEventListener('click', () => {
    const panel = document.getElementById('settings-panel');
    const btn = document.getElementById('btn-toggle-settings');
    const nowHidden = panel.classList.toggle('hidden');
    btn.textContent = nowHidden ? '▲' : '▼';
  });

  document.getElementById('btn-add-server').addEventListener('click', addServer);
  document.getElementById('server-url-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addServer();
  });
}

async function addServer() {
  const input = document.getElementById('server-url-input');
  let raw = input.value.trim();
  if (!raw) return;

  if (!raw.startsWith('http://') && !raw.startsWith('https://')) raw = 'https://' + raw;

  const urls = await getConfiguredServers();
  const host = getHostname(raw);

  if (urls.some(u => getHostname(u) === host)) {
    showToast('Server already in list', true);
    return;
  }

  urls.push(raw);
  await saveConfiguredServers(urls);
  input.value = '';
  renderServerList(urls);
  updateServerBadge(urls.length);
  await refreshDetection();
}

async function removeServer(url) {
  let urls = await getConfiguredServers();
  urls = urls.filter(u => u !== url);
  await saveConfiguredServers(urls);
  renderServerList(urls);
  updateServerBadge(urls.length);
  await refreshDetection();
}

function renderServerList(urls) {
  const list = document.getElementById('server-list');
  list.innerHTML = '';
  if (urls.length === 0) {
    list.innerHTML = '<div class="server-empty">No servers added yet</div>';
    return;
  }
  urls.forEach(url => {
    const row = document.createElement('div');
    row.className = 'server-row';
    row.innerHTML = `
      <span class="server-hostname" title="${escapeHtml(url)}">${escapeHtml(getHostname(url))}</span>
      <button class="btn-remove-server" title="Remove">✕</button>
    `;
    row.querySelector('.btn-remove-server').addEventListener('click', () => removeServer(url));
    list.appendChild(row);
  });
}

function updateServerBadge(count) {
  document.getElementById('server-count-badge').textContent =
    count === 0 ? 'none' : `${count} server${count !== 1 ? 's' : ''}`;
}

async function refreshDetection() {
  currentAppId = null;
  currentTabId = null;
  allVersions = [];
  diffSelection = [];
  document.getElementById('btn-snapshot').disabled = true;
  document.getElementById('version-list').innerHTML = '';
  document.getElementById('no-versions').classList.remove('hidden');
  document.getElementById('diff-panel').classList.add('hidden');
  document.getElementById('diff-output').innerHTML = '';
  await detectCurrentApp();
}

// ── Detect which Qlik app is open ────────────────────────────────────────────
async function detectCurrentApp() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const servers = await getConfiguredServers();

  if (servers.length === 0) {
    setAppBar('Add a Qlik server in settings below', '');
    return;
  }

  const matched = servers.find(url => tab?.url?.includes(getHostname(url)));
  if (!matched) {
    setAppBar('Not on a configured Qlik page', '');
    return;
  }

  const appId = parseAppId(tab.url);
  if (!appId) {
    setAppBar('Navigate into a Qlik app', '');
    return;
  }

  currentTabId = tab.id;
  currentAppId = appId;

  let appName = appId;
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_APP' });
    if (resp?.appName) appName = resp.appName;
  } catch (_) {}

  setAppBar(appName, appId);
  document.getElementById('btn-snapshot').disabled = false;
  await loadVersions();
}

function parseAppId(url) {
  const match = url.match(/\/app\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return match ? match[1] : null;
}

function setAppBar(name, id) {
  document.getElementById('app-name').textContent = name;
  document.getElementById('app-id-label').textContent = id ? `ID: ${id.slice(0, 12)}…` : '';
}

// ── Load and render version list ──────────────────────────────────────────────
async function loadVersions() {
  if (!currentAppId) return;
  const resp = await chrome.runtime.sendMessage({ type: 'GET_VERSIONS', appId: currentAppId });
  allVersions = resp.versions || [];
  renderVersionList();
}

function renderVersionList() {
  const list = document.getElementById('version-list');
  const empty = document.getElementById('no-versions');
  list.innerHTML = '';

  if (allVersions.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  allVersions.forEach((v, idx) => {
    const card = document.createElement('div');
    card.className = 'version-card';
    card.dataset.id = v.id;

    const ts = new Date(v.timestamp).toLocaleString();
    card.innerHTML = `
      <div class="version-card-header">
        <span class="version-timestamp">${ts}${idx === 0 ? ' <strong>(latest)</strong>' : ''}</span>
        ${v.label ? `<span class="version-label">${escapeHtml(v.label)}</span>` : ''}
      </div>
      <div class="version-card-actions">
        <button class="btn-view">View</button>
        <button class="btn-diff">Diff</button>
        <button class="btn-restore">Restore</button>
        <button class="btn-delete">Delete</button>
      </div>
    `;

    card.querySelector('.btn-view').addEventListener('click', () => viewVersion(v));
    card.querySelector('.btn-diff').addEventListener('click', () => selectForDiff(v, card));
    card.querySelector('.btn-restore').addEventListener('click', () => restoreVersion(v));
    card.querySelector('.btn-delete').addEventListener('click', () => deleteVersion(v.id, card));

    list.appendChild(card);
  });
}

// ── View ──────────────────────────────────────────────────────────────────────
function viewVersion(v) {
  const blob = new Blob([v.script], { type: 'text/plain' });
  chrome.tabs.create({ url: URL.createObjectURL(blob) });
}

// ── Diff ──────────────────────────────────────────────────────────────────────
function selectForDiff(v, card) {
  const idx = diffSelection.findIndex(s => s.id === v.id);
  if (idx !== -1) {
    diffSelection.splice(idx, 1);
    card.querySelector('.btn-diff').classList.remove('active');
    card.classList.remove('diff-selected');
  } else {
    if (diffSelection.length >= 2) {
      const old = diffSelection.shift();
      const oldCard = document.querySelector(`.version-card[data-id="${old.id}"]`);
      if (oldCard) {
        oldCard.querySelector('.btn-diff').classList.remove('active');
        oldCard.classList.remove('diff-selected');
      }
    }
    diffSelection.push(v);
    card.querySelector('.btn-diff').classList.add('active');
    card.classList.add('diff-selected');
  }

  if (diffSelection.length === 2) {
    const older = diffSelection[0].timestamp < diffSelection[1].timestamp ? diffSelection[0] : diffSelection[1];
    const newer = older === diffSelection[0] ? diffSelection[1] : diffSelection[0];
    document.getElementById('diff-label').textContent =
      `${new Date(older.timestamp).toLocaleString()}  →  ${new Date(newer.timestamp).toLocaleString()}`;
    document.getElementById('diff-output').innerHTML = renderDiff(computeDiff(older.script, newer.script));
    document.getElementById('diff-panel').classList.remove('hidden');
  } else {
    document.getElementById('diff-panel').classList.add('hidden');
  }
}

function setupDiffClose() {
  document.getElementById('btn-close-diff').addEventListener('click', () => {
    diffSelection = [];
    document.querySelectorAll('.version-card').forEach(c => {
      c.classList.remove('diff-selected');
      c.querySelector('.btn-diff')?.classList.remove('active');
    });
    document.getElementById('diff-panel').classList.add('hidden');
  });
}

// ── Restore ───────────────────────────────────────────────────────────────────
async function restoreVersion(v) {
  if (!confirm(`Restore version from ${new Date(v.timestamp).toLocaleString()}?\n\nThis will overwrite the current script in the editor.`)) return;
  const resp = await chrome.runtime.sendMessage({ type: 'SET_SCRIPT', tabId: currentTabId, script: v.script });
  showToast(resp?.ok ? 'Version restored to editor' : 'Could not restore — is the Data Load Editor open?', !resp?.ok);
}

// ── Delete ────────────────────────────────────────────────────────────────────
async function deleteVersion(versionId, card) {
  if (!confirm('Delete this version?')) return;
  await chrome.runtime.sendMessage({ type: 'DELETE_VERSION', appId: currentAppId, versionId });
  card.remove();
  allVersions = allVersions.filter(v => v.id !== versionId);
  if (allVersions.length === 0) document.getElementById('no-versions').classList.remove('hidden');
}

// ── Snapshot ──────────────────────────────────────────────────────────────────
function setupSnapshotButton() {
  document.getElementById('btn-snapshot').addEventListener('click', async () => {
    const label = document.getElementById('snapshot-label').value.trim();
    const btn = document.getElementById('btn-snapshot');
    btn.disabled = true;
    btn.textContent = '...';

    const scriptResp = await chrome.runtime.sendMessage({ type: 'GET_SCRIPT', tabId: currentTabId });
    if (!scriptResp?.script) {
      showToast('Editor not found — is the Data Load Editor open?', true);
      btn.disabled = false;
      btn.textContent = 'Snapshot';
      return;
    }

    await chrome.runtime.sendMessage({
      type: 'SAVE_VERSION',
      appId: currentAppId,
      appName: document.getElementById('app-name').textContent,
      script: scriptResp.script,
      label
    });

    document.getElementById('snapshot-label').value = '';
    await loadVersions();
    showToast('Snapshot saved');
    btn.disabled = false;
    btn.textContent = 'Snapshot';
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg, isError = false) {
  document.getElementById('toast')?.remove();
  const t = document.createElement('div');
  t.id = 'toast';
  t.textContent = msg;
  t.style.cssText = `position:fixed;bottom:60px;left:50%;transform:translateX(-50%);
    background:${isError ? '#ff4444' : '#2a9d4e'};color:#fff;padding:6px 16px;
    border-radius:4px;font-size:12px;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,.4)`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}
