import { sendMessage } from '@/lib/messages';

export default defineContentScript({
  matches: ['https://e3p.nycu.edu.tw/*'],
  runAt: 'document_idle',
  main() {
    // ===== 1. 自動擷取 sesskey 和使用者資訊 =====
    extractAndSaveSession();

    // ===== 2. 浮動按鈕 =====
    addFloatingButton();

    // ===== 3. 課程頁面增強 =====
    if (window.location.pathname.includes('/course/view.php')) {
      const courseId = new URLSearchParams(window.location.search).get('id');
      if (courseId) addBatchDownloadButton(courseId);
    }
  },
});

/**
 * 從當前 E3 頁面擷取 sesskey 和使用者資訊，送到 background 儲存
 */
function extractAndSaveSession() {
  // 方法 1: 從 M.cfg（Moodle JavaScript config）擷取
  const scriptTags = document.querySelectorAll('script');
  let sesskey: string | null = null;
  let userid: number | undefined;
  let fullname: string | undefined;
  let username: string | undefined;

  for (const script of scriptTags) {
    const text = script.textContent ?? '';

    if (!sesskey) {
      const sesskeyMatch = text.match(/"sesskey"\s*:\s*"([a-zA-Z0-9]+)"/);
      if (sesskeyMatch) sesskey = sesskeyMatch[1];
    }

    if (!userid) {
      const useridMatch = text.match(/"userid"\s*:\s*(\d+)/);
      if (useridMatch) userid = Number(useridMatch[1]);
    }

    if (!fullname) {
      const fullnameMatch = text.match(/"fullname"\s*:\s*"([^"]+)"/);
      if (fullnameMatch) fullname = fullnameMatch[1];
    }

    if (!username) {
      const usernameMatch = text.match(/"username"\s*:\s*"([^"]+)"/);
      if (usernameMatch) username = usernameMatch[1];
    }
  }

  // 方法 2: 從 hidden input 擷取 sesskey
  if (!sesskey) {
    const input = document.querySelector('input[name="sesskey"]') as HTMLInputElement | null;
    if (input) sesskey = input.value;
  }

  // 方法 3: 從 logout link 擷取 sesskey
  if (!sesskey) {
    const logoutLink = document.querySelector('a[href*="logout.php"]') as HTMLAnchorElement | null;
    if (logoutLink) {
      const match = logoutLink.href.match(/sesskey=([a-zA-Z0-9]+)/);
      if (match) sesskey = match[1];
    }
  }

  if (sesskey) {
    sendMessage('saveSessionInfo', {
      sesskey,
      userid,
      fullname,
      username,
    }).catch(() => {
      // Extension context might not be ready
    });
  }
}

function addFloatingButton() {
  const btn = document.createElement('button');
  btn.textContent = 'E3 助手';
  btn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
    background: #4a90d9;
    color: white;
    border: none;
    border-radius: 24px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 12px rgba(74, 144, 217, 0.4);
    transition: all 0.2s;
  `;
  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'scale(1.05)';
    btn.style.boxShadow = '0 4px 16px rgba(74, 144, 217, 0.5)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 2px 12px rgba(74, 144, 217, 0.4)';
  });
  btn.addEventListener('click', () => {
    if (chrome?.sidePanel) {
      chrome.runtime.sendMessage({ type: 'openSidePanel' });
    }
  });
  document.body.appendChild(btn);
}

function addBatchDownloadButton(courseId: string) {
  const header = document.querySelector('#page-header, .page-header-headings, #region-main h2');
  if (!header) return;

  const downloadBtn = document.createElement('button');
  downloadBtn.textContent = '📥 批次下載教材';
  downloadBtn.style.cssText = `
    margin-left: 12px;
    background: #27ae60;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 13px;
    cursor: pointer;
    vertical-align: middle;
  `;
  downloadBtn.addEventListener('click', async () => {
    downloadBtn.textContent = '下載中...';
    downloadBtn.style.opacity = '0.6';
    try {
      await sendMessage('downloadCourseFiles', {
        courseid: Number(courseId),
      });
      downloadBtn.textContent = '✓ 下載完成';
    } catch {
      downloadBtn.textContent = '❌ 下載失敗';
    }
    setTimeout(() => {
      downloadBtn.textContent = '📥 批次下載教材';
      downloadBtn.style.opacity = '1';
    }, 3000);
  });

  header.appendChild(downloadBtn);
}
