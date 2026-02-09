// Popup script for Ghost Tab extension

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function updateStats() {
  try {
    // Get memory usage
    const info = await chrome.system.memory.getInfo();
    const availablePercent = ((info.availableCapacity / info.capacity) * 100);
    const usedPercent = (100 - availablePercent).toFixed(1);
    
    // Display RAM usage percentage
    document.getElementById('memoryUsage').textContent = `${usedPercent}%`;
    
    // Display detailed RAM info
    const usedBytes = info.capacity - info.availableCapacity;
    const usedFormatted = formatBytes(usedBytes);
    const totalFormatted = formatBytes(info.capacity);
    const availableFormatted = formatBytes(info.availableCapacity);
    
    document.getElementById('memoryDetail').textContent = 
      `${usedFormatted} / ${totalFormatted} used (${availableFormatted} available)`;
    
    // Update frozen tabs list and count
    await updateFrozenTabsList();
  } catch (error) {
    console.error('Error updating stats:', error);
    document.getElementById('memoryUsage').textContent = 'N/A';
    document.getElementById('memoryDetail').textContent = 'Unable to read memory info';
  }
}

async function updateFrozenTabsList() {
  try {
    const tabs = await chrome.tabs.query({});
    const frozenTabs = [];
    
    // Get all frozen tab data from storage
    const storageKeys = await chrome.storage.local.get(null);
    const frozenDataMap = new Map();
    
    for (const [key, value] of Object.entries(storageKeys)) {
      if (key.startsWith('frozen_')) {
        const tabId = parseInt(key.replace('frozen_', ''));
        frozenDataMap.set(tabId, value);
      }
    }
    
    // Match frozen tabs with actual tabs
    for (const tab of tabs) {
      if (frozenDataMap.has(tab.id)) {
        const frozenData = frozenDataMap.get(tab.id);
        frozenTabs.push({
          id: tab.id,
          url: frozenData.url,
          frozenAt: frozenData.frozenAt
        });
      }
    }
    
    // Update count
    document.getElementById('frozenCount').textContent = frozenTabs.length;
    
    // Update list
    const listContainer = document.getElementById('frozenTabsList');
    const unfreezeAllBtn = document.getElementById('unfreezeAllBtn');
    
    if (frozenTabs.length === 0) {
      listContainer.innerHTML = '<div class="no-frozen-tabs">No frozen tabs</div>';
      unfreezeAllBtn.style.display = 'none';
    } else {
      listContainer.innerHTML = '';
      frozenTabs.forEach(tab => {
        const tabItem = document.createElement('div');
        tabItem.className = 'frozen-tab-item';
        
        const urlDiv = document.createElement('div');
        urlDiv.className = 'frozen-tab-url';
        urlDiv.textContent = tab.url.length > 50 ? tab.url.substring(0, 50) + '...' : tab.url;
        urlDiv.title = tab.url;
        
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'frozen-tab-actions';
        
        const unfreezeBtn = document.createElement('button');
        unfreezeBtn.className = 'unfreeze-btn';
        unfreezeBtn.textContent = 'Unfreeze';
        unfreezeBtn.onclick = () => unfreezeTab(tab.id);
        
        const viewBtn = document.createElement('button');
        viewBtn.className = 'unfreeze-btn';
        viewBtn.textContent = 'View';
        viewBtn.onclick = () => chrome.tabs.update(tab.id, { active: true });
        
        actionsDiv.appendChild(unfreezeBtn);
        actionsDiv.appendChild(viewBtn);
        
        tabItem.appendChild(urlDiv);
        tabItem.appendChild(actionsDiv);
        listContainer.appendChild(tabItem);
      });
      
      unfreezeAllBtn.style.display = 'block';
    }
  } catch (error) {
    console.error('Error updating frozen tabs list:', error);
    document.getElementById('frozenTabsList').innerHTML = 
      '<div class="no-frozen-tabs">Error loading frozen tabs</div>';
  }
}

async function unfreezeTab(tabId) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'restoreTab',
      tabId: tabId
    });
    
    if (response && response.success) {
      // Update the list after a short delay to allow tab to restore
      setTimeout(() => {
        updateStats();
      }, 500);
    } else {
      alert('Failed to unfreeze tab. Please try again.');
    }
  } catch (error) {
    console.error('Error unfreezing tab:', error);
    alert('Error unfreezing tab: ' + error.message);
  }
}

async function unfreezeAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    const storageKeys = await chrome.storage.local.get(null);
    const frozenTabIds = [];
    
    for (const key of Object.keys(storageKeys)) {
      if (key.startsWith('frozen_')) {
        const tabId = parseInt(key.replace('frozen_', ''));
        // Verify tab still exists
        if (tabs.some(t => t.id === tabId)) {
          frozenTabIds.push(tabId);
        }
      }
    }
    
    if (frozenTabIds.length === 0) {
      return;
    }
    
    // Unfreeze all tabs
    const promises = frozenTabIds.map(tabId => 
      chrome.runtime.sendMessage({
        action: 'restoreTab',
        tabId: tabId
      })
    );
    
    await Promise.all(promises);
    
    // Update the list after a short delay
    setTimeout(() => {
      updateStats();
    }, 500);
  } catch (error) {
    console.error('Error unfreezing all tabs:', error);
    alert('Error unfreezing tabs: ' + error.message);
  }
}

// Set up unfreeze all button
document.getElementById('unfreezeAllBtn').addEventListener('click', unfreezeAllTabs);

// Update stats on load
updateStats();

// Update every 5 seconds
setInterval(updateStats, 5000);
