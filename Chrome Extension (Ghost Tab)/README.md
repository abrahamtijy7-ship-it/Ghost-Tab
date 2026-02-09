# Ghost Tab - Chrome Extension

A Chrome extension that saves RAM on budget PCs by automatically freezing inactive tabs when system memory usage is high.

## Features

- **Automatic Tab Freezing**: Monitors tabs and freezes those inactive for 5+ minutes when memory usage exceeds 80%
- **Memory Monitoring**: Tracks system memory usage using Chrome's system.memory API
- **Smart Restoration**: Click the frozen tab placeholder to instantly restore the original page
- **Activity Tracking**: Tracks tab activity to determine when tabs become inactive

## How It Works

1. **Monitoring**: The background service worker continuously monitors:
   - Tab activity (switches, updates, window focus)
   - System memory usage
   - Tab inactivity duration

2. **Freezing**: When a tab meets these conditions:
   - Inactive for 5+ minutes
   - System memory usage > 80%
   - Not a Chrome internal page (chrome://, chrome-extension://)
   
   The tab is replaced with a lightweight placeholder page and discarded to free memory.

3. **Restoration**: When you click the placeholder page, the original URL is restored and the tab reloads.

## Installation

### From Source

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the folder containing the extension files

### Required Permissions

- `tabs`: To monitor and manage tabs
- `storage`: To save tab states and frozen tab data
- `system.memory`: To check system memory usage
- `<all_urls>`: To work with all websites

## File Structure

```
ghost-tab/
├── manifest.json          # Extension manifest (Manifest V3)
├── background.js          # Service worker for monitoring and freezing
├── placeholder.html       # Lightweight page shown for frozen tabs
├── popup.html            # Extension popup UI
├── popup.js              # Popup functionality
├── icons/                # Extension icons (create these)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Configuration

You can adjust these constants in `background.js`:

- `INACTIVITY_THRESHOLD`: Time before a tab is considered inactive (default: 5 minutes)
- `MEMORY_THRESHOLD_PERCENT`: Memory usage threshold for freezing tabs (default: 80%)
- `CHECK_INTERVAL`: How often to check tabs (default: 60 seconds)

## Creating Icons

You need to create icon files in the `icons/` directory:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

### Quick Method (Recommended)

**Option 1: Using the HTML Generator**
1. Open `generate-icons.html` in your web browser
2. Click "Generate All Icons"
3. Save the downloaded files to the `icons` folder
4. Make sure they're named exactly: `icon16.png`, `icon48.png`, `icon128.png`

**Option 2: Using PowerShell Script (Windows)**
1. Right-click `generate-icons.ps1` and select "Run with PowerShell"
2. The icons will be automatically created in the `icons` folder

### Manual Method

You can also use any image editor or online icon generator to create PNG files with a "frozen" or "ghost" theme.

## Technical Details

### Manifest V3

This extension uses Manifest V3, which means:
- Background scripts run as service workers
- No persistent background pages
- Uses `chrome.storage` API for persistence
- Uses `chrome.tabs.discard()` to free memory

### Tab State Management

- Tab activity timestamps are stored in memory (Map) and synced to `chrome.storage.local`
- Frozen tab data (original URL, frozen timestamp) is stored in `chrome.storage.local`
- State is cleaned up when tabs are closed

### Memory Detection

Uses `chrome.system.memory.getInfo()` to get:
- Available memory capacity
- Total memory capacity
- Calculates used percentage

## Troubleshooting

**Extension not working?**
- Check that all permissions are granted
- Open Chrome DevTools (F12) and check the service worker console for errors
- Verify the extension is enabled in `chrome://extensions/`

**Tabs not freezing?**
- Ensure memory usage is above 80%
- Check that tabs have been inactive for at least 5 minutes
- Verify tabs aren't Chrome internal pages

**Can't restore tabs?**
- Check browser console for errors
- Verify the extension hasn't been disabled
- Try reloading the extension

## License

MIT License - Feel free to modify and distribute.
