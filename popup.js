const startButton = document.getElementById('startScraping');
const statusDiv = document.getElementById('status');

function updateUI(isScraping, message) {
  if (isScraping) {
    startButton.disabled = true;
    statusDiv.textContent = message || '수집 중... ⏳';
  } else {
    startButton.disabled = false;
    statusDiv.textContent = message || '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['isScraping', 'lastMessage'], (result) => {
    updateUI(result.isScraping, result.lastMessage);
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.status === 'scraping_progress') {
    const progressText = `${message.stage || '진행 중'} ${message.current}/${message.total}`;
    chrome.storage.local.set({ isScraping: true, lastMessage: progressText });
    updateUI(true, progressText);
    return;
  }
  if (message.status === 'scraping_complete') {
    const count = message.count;
    const today = new Date().toISOString().split('T')[0];
    const finalMessage = count == null
      ? `수집이 중단되었습니다. (${today})`
      : `Y26 Q1 직방 등록 매물 수 ${count}개 (오늘날짜 ${today} 기준) — 상세 정보 포함 CSV 저장 완료`;

    chrome.storage.local.set({ isScraping: false, lastMessage: finalMessage }, () => {
      updateUI(false, finalMessage);
    });
  }
});

startButton.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.url && tab.url.includes('zigbang.com')) {
      chrome.storage.local.set({ isScraping: true, lastMessage: null }, () => {
        updateUI(true, '리스트 수집 중...');
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
