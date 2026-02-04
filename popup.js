const startButton = document.getElementById('startScraping');
const statusDiv = document.getElementById('status');

// Function to update UI based on scraping status
function updateUI(isScraping, message) {
  if (isScraping) {
    startButton.disabled = true;
    statusDiv.textContent = '수집 중... ⏳';
  } else {
    startButton.disabled = false;
    statusDiv.textContent = message || ''; // Display the message or clear
  }
}

// When popup opens, check the current status
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['isScraping', 'lastMessage'], (result) => {
    updateUI(result.isScraping, result.lastMessage);
  });
});

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((message) => {
  if (message.status === 'scraping_complete') {
    const count = message.count;
    const today = new Date().toISOString().split('T')[0];
    const finalMessage = `Y26 Q1 직방 등록 매물 수 ${count}개 (오늘날짜 ${today} 기준)`;
    
    chrome.storage.local.set({ isScraping: false, lastMessage: finalMessage }, () => {
      updateUI(false, finalMessage);
    });
  }
});

// Handle button click
startButton.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.url && tab.url.includes('zigbang.com')) {
      // Clear previous message and set status to scraping
      chrome.storage.local.set({ isScraping: true, lastMessage: null }, () => {
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
