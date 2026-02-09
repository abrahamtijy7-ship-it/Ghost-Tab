// Ghost Tab - Background Service Worker
// Monitors tab activity and freezes inactive tabs when memory is high

const INACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds
const MEMORY_THRESHOLD_PERCENT = 80; // Freeze tabs when memory usage exceeds 80%
const CHECK_INTERVAL = 60000; // Check every minute

// Track tab activity timestamps
let tabActivityMap = new Map();

// Initialize on extension install/startup
chrome.runtime.onInstalled.addListener(() => {
  console.log('Ghost Tab extension installed');
  initializeTabTracking();
});

chrome.runtime.onStartup.addListener(() => {
  initializeTabTracking();
});

// Initialize tab tracking for all existing tabs
async function initializeTabTracking() {
  const tabs = await chrome.tabs.query({});
  const now = Date.now();
  
  for (const tab of tabs) {
    if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
      await setTabActivity(tab.id, now);
    }
  }
  
  // Start monitoring
  startMonitoring();
}

// Track tab activity
async function setTabActivity(tabId, timestamp) {
  tabActivityMap.set(tabId, timestamp);
  await chrome.storage.local.set({ [`tab_${tabId}`]: timestamp });
}

// Get tab activity timestamp
async function getTabActivity(tabId) {
  if (tabActivityMap.has(tabId)) {
    return tabActivityMap.get(tabId);
  }
  
  const result = await chrome.storage.local.get([`tab_${tabId}`]);
  const timestamp = result[`tab_${tabId}`];
  
  if (timestamp) {
    tabActivityMap.set(tabId, timestamp);
    return timestamp;
  }
  
  return Date.now();
}

// Listen for tab updates (user interaction)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && 
      !tab.url.startsWith('chrome://') && 
      !tab.url.startsWith('chrome-extension://')) {
    await setTabActivity(tabId, Date.now());
  }
});

// Listen for tab activation (user switches to tab)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await setTabActivity(activeInfo.tabId, Date.now());
});

// Listen for window focus (user interacts with browser)
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    const tabs = await chrome.tabs.query({ active: true, windowId: windowId });
    if (tabs[0]) {
      await setTabActivity(tabs[0].id, Date.now());
    }
  }
});

// Check system memory usage
async function getMemoryUsage() {
  try {
    const info = await chrome.system.memory.getInfo();
    const usedPercent = ((info.availableCapacity / info.capacity) * 100);
    return {
      available: info.availableCapacity,
      capacity: info.capacity,
      usedPercent: 100 - usedPercent
    };
  } catch (error) {
    console.error('Error getting memory info:', error);
    // Fallback: assume memory is fine if API fails
    return { usedPercent: 50 };
  }
}

// Check if tab should be frozen
async function shouldFreezeTab(tabId, tab) {
  // Skip chrome:// and extension pages
  if (!tab.url || 
      tab.url.startsWith('chrome://') || 
      tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('about:') ||
      tab.discarded) {
    return false;
  }
  
  // Check if tab is already frozen
  const frozenData = await chrome.storage.local.get([`frozen_${tabId}`]);
  if (frozenData[`frozen_${tabId}`]) {
    return false; // Already frozen
  }
  
  // Check inactivity
  const lastActivity = await getTabActivity(tabId);
  const inactiveTime = Date.now() - lastActivity;
  
  if (inactiveTime < INACTIVITY_THRESHOLD) {
    return false; // Tab is still active
  }
  
  // Check memory usage
  const memoryInfo = await getMemoryUsage();
  
  if (memoryInfo.usedPercent < MEMORY_THRESHOLD_PERCENT) {
    return false; // Memory usage is acceptable
  }
  
  return true;
}

// Freeze a tab by replacing it with placeholder
async function freezeTab(tabId, originalUrl) {
  try {
    // Save frozen tab data
    await chrome.storage.local.set({
      [`frozen_${tabId}`]: {
        url: originalUrl,
        frozenAt: Date.now()
      }
    });
    
    // Replace tab with placeholder page
    const placeholderUrl = chrome.runtime.getURL('placeholder.html') + `?tabId=${tabId}`;
    await chrome.tabs.update(tabId, { url: placeholderUrl });
    
    // Discard the tab to free memory
    await chrome.tabs.discard(tabId);
    
    console.log(`Frozen tab ${tabId}: ${originalUrl}`);
  } catch (error) {
    console.error(`Error freezing tab ${tabId}:`, error);
  }
}

// Restore a frozen tab
async function restoreTab(tabId) {
  try {
    const frozenData = await chrome.storage.local.get([`frozen_${tabId}`]);
    const frozen = frozenData[`frozen_${tabId}`];
    
    if (!frozen) {
      return false;
    }
  
    // Remove frozen state
    await chrome.storage.local.remove([`frozen_${tabId}`]);
    
    // Reload original URL
    await chrome.tabs.update(tabId, { url: frozen.url });
    
    // Update activity timestamp
    await setTabActivity(tabId, Date.now());
    
    console.log(`Restored tab ${tabId}: ${frozen.url}`);
    return true;
  } catch (error) {
    console.error(`Error restoring tab ${tabId}:`, error);
    return false;
  }
}

// Main monitoring loop
async function startMonitoring() {
  setInterval(async () => {
    try {
      const tabs = await chrome.tabs.query({});
      const memoryInfo = await getMemoryUsage();
      
      // Only check if memory usage is high
      if (memoryInfo.usedPercent >= MEMORY_THRESHOLD_PERCENT) {
        for (const tab of tabs) {
          if (await shouldFreezeTab(tab.id, tab)) {
            await freezeTab(tab.id, tab.url);
          }
        }
      }
    } catch (error) {
      console.error('Error in monitoring loop:', error);
    }
  }, CHECK_INTERVAL);
}

// Handle messages from placeholder page and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'restoreTab') {
    restoreTab(request.tabId).then(success => {
      sendResponse({ success });
    });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'getFrozenData') {
    chrome.storage.local.get([`frozen_${request.tabId}`]).then(result => {
      sendResponse({ frozen: result[`frozen_${request.tabId}`] });
    });
    return true;
  }
  
  if (request.action === 'getAllFrozenTabs') {
    chrome.storage.local.get(null).then(allData => {
      const frozenTabs = [];
      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith('frozen_')) {
          const tabId = parseInt(key.replace('frozen_', ''));
          frozenTabs.push({
            tabId: tabId,
            url: value.url,
            frozenAt: value.frozenAt
          });
        }
      }
      sendResponse({ frozenTabs });
    });
    return true;
  }
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  tabActivityMap.delete(tabId);
  await chrome.storage.local.remove([`tab_${tabId}`, `frozen_${tabId}`]);
});
