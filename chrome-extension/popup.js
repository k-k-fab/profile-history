// DOM要素を取得
const extractBtn = document.getElementById('extractBtn');
const messageDiv = document.getElementById('message');
const recordsContainer = document.getElementById('recordsContainer');
const recordsList = document.getElementById('recordsList');
const copyBtn = document.getElementById('copyBtn');

// 戦績を抽出（複数ページ対応）
extractBtn.addEventListener('click', async () => {
  try {
    // 現在のタブを取得
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // メッセージを表示
    showMessage('戦績を抽出中...', 'loading');
    recordsContainer.style.display = 'none';
    
    // すべてのページのURLを収集
    const allUrls = await getAllPageUrls(tab.id);
    console.log('取得するページ数:', allUrls.length);
    
    // すべてのページからデータを取得
    const allRecords = [];
    const originalUrl = tab.url; // 元のURLを保存
    console.log('元のURL:', originalUrl);
    
    for (let i = 0; i < allUrls.length; i++) {
      const url = allUrls[i];
      showMessage(`戦績を抽出中... (${i + 1}/${allUrls.length})`, 'loading');
      console.log(`ページ ${i + 1}/${allUrls.length} を処理中:`, url);
      
      const records = await extractRecordsFromUrl(url, tab.id, i === 0);
      if (records && records.length > 0) {
        allRecords.push(...records);
        console.log(`ページ ${i + 1}: ${records.length}件の戦績を取得`);
      } else {
        console.log(`ページ ${i + 1}: 戦績が見つかりませんでした`);
      }
    }
    
    // 元のURLに戻す
    if (allUrls.length > 1 && originalUrl) {
      console.log('元のURLに戻します:', originalUrl);
      chrome.tabs.update(tab.id, { url: originalUrl });
    }
    
    // 結果を表示
    if (allRecords.length > 0) {
      displayRecords(allRecords);
      showMessage(`${allUrls.length}ページから ${allRecords.length}件の戦績を取得しました`, 'success');
    } else {
      showMessage('戦績データが見つかりませんでした。', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showMessage('エラーが発生しました: ' + error.message, 'error');
  }
});

// すべてのページのURLを取得
async function getAllPageUrls(currentTabId) {
  return new Promise((resolve) => {
    // 現在のタブのURLを取得
    chrome.tabs.get(currentTabId, (tab) => {
      const currentUrl = tab.url;
      
      // content scriptにメッセージを送信してすべてのページのリンクを取得
      chrome.tabs.sendMessage(currentTabId, { action: 'getAllPageUrls' }, (response) => {
        if (chrome.runtime.lastError) {
          // content scriptが読み込まれていない場合、現在のページのURLのみを返す
          resolve([currentUrl]);
          return;
        }
        
        // content scriptから取得した全ページのURLを使用
        let allUrls = [];
        
        if (response && response.links && response.links.length > 0) {
          allUrls = response.links;
        } else {
          // リンクが取得できなかった場合、現在のページのみ
          allUrls = [currentUrl];
        }
        
        // ページ番号でソート
        allUrls.sort((a, b) => {
          try {
            const urlA = new URL(a);
            const urlB = new URL(b);
            const pageA = parseInt(urlA.searchParams.get('page') || '1');
            const pageB = parseInt(urlB.searchParams.get('page') || '1');
            return pageA - pageB;
          } catch (e) {
            return 0;
          }
        });
        
        resolve(allUrls);
      });
    });
  });
}

// 指定されたURLから戦績を抽出
async function extractRecordsFromUrl(url, originalTabId, isCurrentPage) {
  return new Promise((resolve) => {
    if (isCurrentPage) {
      // 現在のページの場合
      chrome.tabs.sendMessage(originalTabId, { action: 'extractRecords' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('現在のページでエラー:', chrome.runtime.lastError);
          resolve([]);
          return;
        }
        resolve(response && response.records ? response.records : []);
      });
    } else {
      // 別のページの場合、現在のタブのURLを変更してデータを取得
      chrome.tabs.update(originalTabId, { url: url }, (updatedTab) => {
        console.log('タブのURLを変更しました:', url);
        
        // タブの更新を監視
        const onUpdatedListener = (tabId, changeInfo, tab) => {
          if (tabId === originalTabId && changeInfo.status === 'complete') {
            // content scriptが注入されるまで待つ
            setTimeout(() => {
              // 複数回試行する
              let retryCount = 0;
              const maxRetries = 15;
              
              const tryExtract = () => {
                chrome.tabs.sendMessage(originalTabId, { action: 'extractRecords' }, (response) => {
                  if (chrome.runtime.lastError) {
                    retryCount++;
                    if (retryCount < maxRetries) {
                      console.log(`リトライ ${retryCount}/${maxRetries}...`);
                      setTimeout(tryExtract, 500);
                      return;
                    }
                    console.error('データ取得に失敗:', chrome.runtime.lastError);
                    chrome.tabs.onUpdated.removeListener(onUpdatedListener);
                    resolve([]);
                    return;
                  }
                  
                  console.log('データ取得成功:', response && response.records ? response.records.length : 0, '件');
                  chrome.tabs.onUpdated.removeListener(onUpdatedListener);
                  resolve(response && response.records ? response.records : []);
                });
              };
              
              tryExtract();
            }, 2000); // 2秒待ってから試行
          }
        };
        
        chrome.tabs.onUpdated.addListener(onUpdatedListener);
        
        // タイムアウト処理（30秒）
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(onUpdatedListener);
          console.error('タイムアウト');
          resolve([]);
        }, 30000);
      });
    }
  });
}

// メッセージを表示
function showMessage(text, type) {
  messageDiv.innerHTML = '';
  
  if (type === 'loading') {
    messageDiv.innerHTML = `<div class="loading">${text}</div>`;
  } else if (type === 'error') {
    messageDiv.innerHTML = `<div class="error-message">${text}</div>`;
  } else if (type === 'success') {
    messageDiv.innerHTML = `<div style="padding: 12px; background: #e3f2fd; color: #1976d2; border-radius: 8px; margin-bottom: 16px; font-size: 14px;">${text}</div>`;
  } else {
    messageDiv.innerHTML = `<div style="padding: 12px; background: #e3f2fd; color: #1976d2; border-radius: 8px; margin-bottom: 16px; font-size: 14px;">${text}</div>`;
  }
}

// 戦績を表示
function displayRecords(records) {
  if (records.length === 0) {
    showMessage('戦績データが見つかりませんでした。', 'error');
    recordsContainer.style.display = 'none';
    return;
  }
  
  // メッセージをクリア
  messageDiv.innerHTML = '';
  
  // 戦績リストを生成
  let html = '';
  records.forEach(record => {
    const dateStr = record.date || '';
    const storeStr = record.storeName || '';
    html += `
      <div class="record-item">
        ${dateStr ? `<span class="record-date">${dateStr}</span>` : ''}
        <span class="record-event">${record.eventName}</span>
        ${storeStr ? `<span class="record-store">${storeStr}</span>` : ''}
        <span class="record-score">${record.record}</span>
      </div>
    `;
  });
  
  recordsList.innerHTML = html;
  recordsContainer.style.display = 'block';
  copyBtn.style.display = 'block';
  
  // コピー用のテキストを生成（ソートなし、取得順のまま）
  const copyText = records.map(r => {
    const dateStr = r.date ? `${r.date} ` : '';
    const storeStr = r.storeName ? `${r.storeName} ` : '';
    return `${dateStr}${r.eventName} ${storeStr}${r.record}`;
  }).join('\n');
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(copyText).then(() => {
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'コピーしました！';
      copyBtn.style.background = '#10b981';
      setTimeout(() => {
        copyBtn.textContent = originalText;
        copyBtn.style.background = '#10b981';
      }, 2000);
    }).catch(err => {
      console.error('コピーに失敗しました:', err);
      alert('コピーに失敗しました');
    });
  };
}

// ページ読み込み時に自動的に抽出を試みる
window.addEventListener('DOMContentLoaded', () => {
  // 少し遅延させてから自動抽出
  setTimeout(() => {
    extractBtn.click();
  }, 100);
});

