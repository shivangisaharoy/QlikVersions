# QlikVersions — Chrome Extension

A Chrome side panel extension for versioning Qlik Sense Data Load Editor scripts.
Save snapshots of your load scripts, compare versions with a diff view, and restore previous versions — across multiple Qlik servers.

---

## Installation (Load Unpacked)

1. Download or clone this repository to your local machine.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select the folder containing `manifest.json` (the root of this project).
6. The QlikVersions icon will appear in your Chrome toolbar.

---

## First-Time Setup

1. Click the QlikVersions icon in the toolbar to open the side panel.
2. At the bottom of the panel, click **▲** to expand the **Servers** section.
3. Type your Qlik Sense server URL (e.g. `https://qlik.yourcompany.com`) and click **Add**.
4. Repeat for any additional servers you want to track.

Your servers are saved to Chrome's local storage and **persist across browser restarts**.

---

## Adding / Removing Servers

- Open the **Servers** section (▲ button at the bottom).
- To add: enter a URL and click **Add** (or press Enter). `https://` is added automatically if omitted.
- To remove: click the **✕** button next to any server in the list.
- The extension will never add a default server — the list starts empty.

---

## Taking a Snapshot

1. Navigate to your Qlik Sense app and open the **Data Load Editor**.
2. Open the QlikVersions side panel — it will detect the current app automatically.
3. Optionally type a label in the text box (e.g. `before cleanup`).
4. Click **Snapshot**.

Up to 8 snapshots are stored per app. The oldest is dropped when the limit is reached.
Identical consecutive scripts are deduplicated and not saved twice.

---

## Viewing a Version

Click **View** on any version card to open the raw script in a new browser tab.

---

## Comparing Versions (Diff)

1. Click **Diff** on one version — the button turns orange.
2. Click **Diff** on a second version.
3. The diff panel appears below, showing added lines (green) and removed lines (red).
4. Click **✕** in the diff panel header to close it.

---

## Restoring a Version

1. Click **Restore** on the version you want to go back to.
2. Confirm the prompt.
3. The script is written directly into the Data Load Editor.

> The editor must be open on the current tab for restore to work.

---

## Multi-Server Behaviour

- Add as many servers as you need — each is stored in the list.
- When you switch browser tabs, the panel automatically re-detects which server and app you are on.
- Version history is stored per app ID, so the same app ID on different servers is tracked separately.
- The diff view resets whenever you switch tabs.

---

## Data & Privacy

- All data (server URLs and script versions) is stored locally in Chrome's storage on your machine.
- Nothing is sent to any external server or third party.
- Data survives Chrome restarts. To clear everything, go to `chrome://extensions`, click **Details** on QlikVersions, then **Clear data**.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Not on a configured Qlik page" | Check that the server URL in the Servers list matches the current tab's domain. |
| "Editor not found" on Snapshot / Restore | Make sure the Data Load Editor tab is open and active. |
| A deleted server keeps coming back | Reload the extension from `chrome://extensions` — this clears any stale cached storage. |
| Side panel does not open | Ensure Developer mode is on and the extension is enabled in `chrome://extensions`. |
