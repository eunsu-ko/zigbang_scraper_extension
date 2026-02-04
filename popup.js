const startButton = document.getElementById('startScraping');
const statusDiv = document.getElementById('status');

// Function to update UI based on scraping status
function updateUI(isScraping, count) {
  if (isScraping) {
    startButton.disabled = true;
    statusDiv.textContent = '수집 중... ⏳';
  } else {
    startButton.disabled = false;
    if (typeof count === 'number') {
      statusDiv.textContent = `완료! ${count}개 수집됨 ✅`;
    } else {
      statusDiv.textContent = ''; // Clear status if no count
    }
  }
}

// When popup opens, check the current status
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['isScraping', 'lastCount'], (result) => {
    updateUI(result.isScraping, result.lastCount);
  });
});

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((message) => {
  if (message.status === 'scraping_complete') {
    const count = message.count;
    chrome.storage.local.set({ isScraping: false, lastCount: count }, () => {
      updateUI(false, count);
    });
  }
});

// Handle button click
startButton.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.url && tab.url.includes('zigbang.com')) {
      // Clear previous count and set status to scraping
      chrome.storage.local.set({ isScraping: true, lastCount: null }, () => {
        updateUI(true, null);
        // Execute the content script
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });
      });
    } else {
      statusDiv.textContent = '직방 웹사이트에서 실행해주세요.';
    }
  });
});
