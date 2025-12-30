// 戦績データを抽出する関数
function extractEventRecords() {
  const events = [];
  const eventElements = document.querySelectorAll('.event');
  
  console.log('イベント要素数:', eventElements.length);
  
  eventElements.forEach((eventEl, eventIndex) => {
    // イベント名と日付を取得
    const titleEl = eventEl.querySelector('.event__title');
    if (!titleEl) {
      console.log(`イベント ${eventIndex}: タイトルが見つかりません`);
      return;
    }
    
    const titleText = titleEl.textContent.trim();
    console.log(`イベント ${eventIndex}: タイトル = "${titleText}"`);
    
    // 日付を取得（複数の形式に対応）
    let date = '';
    let eventName = titleText;
    
    // パターン1: "12/28  FABLE INVITATION CUP" 形式
    const dateMatch1 = titleText.match(/^(\d{1,2}\/\d{1,2})/);
    if (dateMatch1) {
      date = dateMatch1[1];
      eventName = titleText.replace(/^\d{1,2}\/\d{1,2}\s*/, '').trim();
    } else {
      // パターン2: "21 Dec 2025: 4.00pm Promo Classic Constructed" 形式
      const dateMatch2 = titleText.match(/^(\d{1,2}\s+\w{3}\s+\d{4})/);
      if (dateMatch2) {
        // "21 Dec 2025" を "12/21" 形式に変換
        const dateStr = dateMatch2[1];
        const monthMap = {
          'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
          'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
          'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        };
        const parts = dateStr.split(/\s+/);
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = monthMap[parts[1]] || '01';
          date = `${month}/${day}`;
        }
        eventName = titleText.replace(/^\d{1,2}\s+\w{3}\s+\d{4}:\s*/, '').trim();
      } else {
        // パターン3: 日付がタイトルに含まれていない場合、メタ情報から取得
        const metaItems = eventEl.querySelectorAll('.event__meta-item');
        for (const metaItem of metaItems) {
          const metaText = metaItem.textContent.trim();
          // "2025年12月21日 16:00" 形式から日付を抽出
          const metaDateMatch = metaText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
          if (metaDateMatch) {
            const month = metaDateMatch[2].padStart(2, '0');
            const day = metaDateMatch[3].padStart(2, '0');
            date = `${month}/${day}`;
            break;
          }
        }
        eventName = titleText;
      }
    }
    
    if (!eventName) {
      console.log(`イベント ${eventIndex}: イベント名が取得できませんでした`);
      return;
    }
    
    // 店舗名を取得
    let storeName = '';
    const metaItems = eventEl.querySelectorAll('.event__meta-item');
    for (const metaItem of metaItems) {
      const span = metaItem.querySelector('span');
      if (span) {
        const text = span.textContent.trim();
        // 店舗名の候補（日付、時刻、イベントタイプ、フォーマット、XP倍率、レーティング以外）
        if (text && 
            !text.includes('年') && !text.includes('月') && !text.includes('日') && 
            !text.includes(':') && 
            !text.includes('オンデマンド') && !text.includes('バトルハーデン') && !text.includes('コーリング') && !text.includes('プロクエスト') &&
            !text.includes('クラシック') && !text.includes('Silver Age') && !text.includes('Blitz') &&
            !text.includes('XP倍率') && 
            !text.includes('レーティング')) {
          // 建物アイコンのSVGがある場合、店舗名の可能性が高い
          const svg = metaItem.querySelector('svg');
          if (svg && svg.getAttribute('viewBox') && svg.getAttribute('viewBox').includes('511')) {
            storeName = text;
            console.log(`イベント ${eventIndex}: 店舗名 = "${storeName}"`);
            break;
          }
        }
      }
    }
    
    // 日付がない場合は空文字列のまま進む（後で処理）
    console.log(`イベント ${eventIndex}: 日付 = "${date}", イベント名 = "${eventName}", 店舗名 = "${storeName}"`);
    
    // 戦績データを取得
    // details要素が閉じている場合でも、中身を取得できるようにする
    const detailsEl = eventEl.querySelector('.event__extra-details');
    if (!detailsEl) {
      console.log(`イベント ${eventIndex}: event__extra-detailsが見つかりません`);
      return;
    }
    
    // 「試合」というタイトルの後に続くテーブルを探す
    // まず、.block-tableの中のテーブルを探す
    let table = detailsEl.querySelector('.block-table table');
    
    // 見つからない場合は、すべてのテーブルをチェック
    if (!table) {
      const allTables = detailsEl.querySelectorAll('table');
      console.log(`イベント ${eventIndex}: テーブル数 = ${allTables.length}`);
      
      // 「レコード (勝利-敗北)」というヘッダーがあるテーブルを探す
      for (const t of allTables) {
        const headerRow = t.querySelector('thead tr') || t.querySelector('tbody tr:first-child');
        if (headerRow) {
          const headerText = headerRow.textContent;
          if (headerText.includes('レコード') || headerText.includes('勝利-敗北')) {
            table = t;
            console.log(`イベント ${eventIndex}: 「レコード」ヘッダーがあるテーブルを見つけました`);
            break;
          }
        }
      }
      
      // まだ見つからない場合は、最後のテーブルを試す（「結果」テーブルではないもの）
      if (!table && allTables.length > 1) {
        // 「結果」テーブルをスキップして、2番目以降のテーブルを試す
        for (let i = allTables.length - 1; i >= 0; i--) {
          const t = allTables[i];
          const headerRow = t.querySelector('thead tr') || t.querySelector('tbody tr:first-child');
          if (headerRow) {
            const headerText = headerRow.textContent;
            // 「結果」テーブルでないことを確認
            if (!headerText.includes('合計勝利数') && !headerText.includes('獲得XP')) {
              table = t;
              console.log(`イベント ${eventIndex}: 最後のテーブルを使用`);
              break;
            }
          }
        }
      } else if (!table && allTables.length === 1) {
        table = allTables[0];
        console.log(`イベント ${eventIndex}: 唯一のテーブルを使用`);
      }
    }
    
    if (!table) {
      console.log(`イベント ${eventIndex}: テーブルが見つかりません`);
      return;
    }
    
    console.log(`イベント ${eventIndex}: テーブルが見つかりました`);
    
    let record = null;
    const rows = table.querySelectorAll('tbody tr');
    console.log(`イベント ${eventIndex}: テーブルの行数 = ${rows.length}`);
    
    // ヘッダー行からレコード列のインデックスを取得
    let recordColumnIndex = -1;
    const headerRow = table.querySelector('thead tr') || table.querySelector('tbody tr:first-child');
    if (headerRow) {
      const headerCells = headerRow.querySelectorAll('th, td');
      headerCells.forEach((cell, index) => {
        const headerText = cell.textContent.trim();
        if (headerText.includes('レコード') || headerText.includes('勝利-敗北') || 
            (headerText.includes('勝利') && headerText.includes('敗北'))) {
          recordColumnIndex = index;
          console.log(`イベント ${eventIndex}: レコード列のインデックス = ${index}`);
        }
      });
    }
    
    // レコード列が見つからない場合は、最後の列を試す
    if (recordColumnIndex === -1) {
      const firstDataRow = Array.from(rows).find(row => {
        const cells = row.querySelectorAll('td');
        return cells.length > 0;
      });
      if (firstDataRow) {
        const cells = firstDataRow.querySelectorAll('td');
        recordColumnIndex = cells.length - 1;
        console.log(`イベント ${eventIndex}: レコード列のインデックス（推定） = ${recordColumnIndex}`);
      }
    }
    
    // 最後の行の戦績を取得（通常ラウンドの最終的な戦績）
    let regularWins = 0;
    let regularLosses = 0;
    
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      const cells = row.querySelectorAll('td');
      if (cells.length === 0) continue; // ヘッダー行をスキップ
      
      const targetIndex = recordColumnIndex >= 0 ? recordColumnIndex : cells.length - 1;
      if (cells[targetIndex]) {
        const recordText = cells[targetIndex].textContent.trim();
        const recordMatch = recordText.match(/(\d+)-(\d+)/);
        if (recordMatch) {
          regularWins = parseInt(recordMatch[1]);
          regularLosses = parseInt(recordMatch[2]);
          console.log(`イベント ${eventIndex}: 通常ラウンドの戦績 = ${regularWins}-${regularLosses}`);
          break;
        }
      }
    }
    
    // 戦績が見つからない場合は、テーブル内のすべての行から最大の戦績を探す
    if (regularWins === 0 && regularLosses === 0) {
      rows.forEach((row, rowIndex) => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 0) return; // ヘッダー行をスキップ
        
        const targetIndex = recordColumnIndex >= 0 ? recordColumnIndex : cells.length - 1;
        if (cells[targetIndex]) {
          const recordText = cells[targetIndex].textContent.trim();
          const recordMatch = recordText.match(/(\d+)-(\d+)/);
          if (recordMatch) {
            const wins = parseInt(recordMatch[1]);
            const losses = parseInt(recordMatch[2]);
            if (wins > regularWins || (wins === regularWins && losses > regularLosses)) {
              regularWins = wins;
              regularLosses = losses;
              console.log(`イベント ${eventIndex}: 行 ${rowIndex} から戦績を取得 = ${regularWins}-${regularLosses}`);
            }
          }
        }
      });
    }
    
    // プレイオフテーブルを探す
    const playoffTables = detailsEl.querySelectorAll('.block-table table');
    let playoffWins = 0;
    let playoffLosses = 0;
    
    for (const playoffTable of playoffTables) {
      const headerRow = playoffTable.querySelector('thead tr') || playoffTable.querySelector('tbody tr:first-child');
      if (headerRow) {
        const headerText = headerRow.textContent;
        if (headerText.includes('プレイオフ')) {
          console.log(`イベント ${eventIndex}: プレイオフテーブルを見つけました`);
          
          // プレイオフの結果をカウント
          const playoffRows = playoffTable.querySelectorAll('tbody tr');
          playoffRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length === 0) return; // ヘッダー行をスキップ
            
            // 「結果」列を探す
            let resultIndex = -1;
            const headerCells = headerRow.querySelectorAll('th, td');
            headerCells.forEach((cell, index) => {
              if (cell.textContent.includes('結果')) {
                resultIndex = index;
              }
            });
            
            if (resultIndex >= 0 && cells[resultIndex]) {
              const resultText = cells[resultIndex].textContent.trim();
              if (resultText === '勝利') {
                playoffWins++;
              } else if (resultText === '敗北') {
                playoffLosses++;
              }
            }
          });
          
          console.log(`イベント ${eventIndex}: プレイオフの戦績 = ${playoffWins}-${playoffLosses}`);
          break;
        }
      }
    }
    
    // 通常ラウンドとプレイオフを合計
    const totalWins = regularWins + playoffWins;
    const totalLosses = regularLosses + playoffLosses;
    
    if (totalWins > 0 || totalLosses > 0) {
      record = `${totalWins}-${totalLosses}`;
      console.log(`イベント ${eventIndex}: 最終戦績 = ${record} (通常: ${regularWins}-${regularLosses}, プレイオフ: ${playoffWins}-${playoffLosses})`);
    }
    
    if (eventName && record) {
      events.push({
        date: date || '', // 日付がない場合も追加
        eventName: eventName,
        storeName: storeName || '', // 店舗名
        record: record
      });
      console.log(`イベント ${eventIndex}: 追加完了 - ${date || '(日付なし)'} ${eventName} ${storeName ? storeName + ' ' : ''}${record}`);
    } else {
      console.log(`イベント ${eventIndex}: データが不完全 - date: ${date}, eventName: ${eventName}, record: ${record}`);
    }
  });
  
  return events;
}

// すべてのページのURLを生成する関数
function getAllPageUrls() {
  const currentUrl = new URL(window.location.href);
  const basePath = currentUrl.pathname;
  const baseUrl = currentUrl.origin + basePath;
  
  // 現在のページ番号を取得
  const currentPageMatch = window.location.search.match(/[?&]page=(\d+)/);
  const currentPage = currentPageMatch ? parseInt(currentPageMatch[1]) : 1;
  
  // 最終ページ番号を取得
  let lastPage = currentPage;
  
  // pagination-arrow-nextから最終ページを取得
  const nextArrow = document.querySelector('.pagination-arrow-next a.page-link');
  if (nextArrow) {
    const nextHref = nextArrow.getAttribute('href');
    if (nextHref) {
      const nextPageMatch = nextHref.match(/page=(\d+)/);
      if (nextPageMatch) {
        lastPage = parseInt(nextPageMatch[1]);
      }
    }
  }
  
  // すべてのページ番号のリンクから最大値を取得
  const allPageLinks = document.querySelectorAll('.page-item a.page-link');
  allPageLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href) {
      const pageMatch = href.match(/page=(\d+)/);
      if (pageMatch) {
        const pageNum = parseInt(pageMatch[1]);
        if (pageNum > lastPage) {
          lastPage = pageNum;
        }
      }
    }
  });
  
  console.log('現在のページ:', currentPage);
  console.log('最終ページ:', lastPage);
  
  // 1ページ目から最終ページまですべてのURLを生成
  const allUrls = [];
  for (let page = 1; page <= lastPage; page++) {
    const url = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;
    allUrls.push(url);
  }
  
  console.log('生成された全ページURL:', allUrls.length, '件');
  return allUrls;
}

// メッセージリスナーを設定
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('メッセージを受信:', request.action);
  
  if (request.action === 'extractRecords') {
    try {
      const records = extractEventRecords();
      console.log('抽出されたレコード数:', records.length);
      sendResponse({ records: records });
    } catch (error) {
      console.error('レコード抽出エラー:', error);
      sendResponse({ records: [] });
    }
  } else if (request.action === 'getAllPageUrls') {
    try {
      const links = getAllPageUrls();
      console.log('全ページのリンク数:', links.length);
      sendResponse({ links: links });
    } catch (error) {
      console.error('リンク取得エラー:', error);
      sendResponse({ links: [] });
    }
  }
  return true; // 非同期レスポンスを許可
});

// ページ読み込み時にログを出力（デバッグ用）
console.log('Content script loaded:', window.location.href);

