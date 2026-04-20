// storage.js — chrome.storage.local wrapper for version management
const MAX_VERSIONS = 8;

function storageKey(appId) {
  return `versions_${appId}`;
}

async function getVersions(appId) {
  const result = await chrome.storage.local.get(storageKey(appId));
  return result[storageKey(appId)] || [];
}

async function saveVersion(appId, appName, script, label = '') {
  const versions = await getVersions(appId);

  // Skip if script is identical to the most recent version
  if (versions.length > 0 && versions[0].script === script) return null;

  const newVersion = {
    id: Date.now(),
    timestamp: Date.now(),
    label: label || '',
    script,
    appName: appName || appId
  };

  const updated = [newVersion, ...versions].slice(0, MAX_VERSIONS);
  await chrome.storage.local.set({ [storageKey(appId)]: updated });
  return newVersion;
}

async function deleteVersion(appId, versionId) {
  const versions = await getVersions(appId);
  await chrome.storage.local.set({
    [storageKey(appId)]: versions.filter(v => v.id !== versionId)
  });
}
