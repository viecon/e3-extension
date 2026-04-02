import { sendMessage } from '@/lib/messages';
import { BASE_URL } from '@/lib/moodle';

export default defineContentScript({
  matches: ['https://e3p.nycu.edu.tw/*'],
  runAt: 'document_idle',
  async main() {
    // 1. 自動擷取 sesskey 並等待存入 (後續功能需要 auth)
    await extractAndSaveSession();

    // 2. 浮動按鈕
    addFloatingButton();

    // 3. 課程頁面增強
    if (window.location.pathname.includes('/course/view.php')) {
      const courseId = new URLSearchParams(window.location.search).get('id');
      if (courseId) {
        addBatchDownloadButton(courseId);
        highlightDeadlines();
      }
    }

    // 4. 作業頁面增強
    if (window.location.pathname.includes('/mod/assign/view.php')) {
      enhanceAssignmentPage();
    }

    // 5. 首頁截止日提醒 banner (需要 auth 所以放最後)
    if (window.location.pathname === '/my/' || window.location.pathname === '/my') {
      addDeadlineBanner();
    }
  },
});

/**
 * 從當前 E3 頁面擷取 sesskey 和使用者資訊
 */
async function extractAndSaveSession() {
  const scriptTags = document.querySelectorAll('script');
  let sesskey: string | null = null;
  let userid: number | undefined;
  let fullname: string | undefined;
  let username: string | undefined;

  for (const script of scriptTags) {
    const text = script.textContent ?? '';
    if (!sesskey) {
      const m = text.match(/"sesskey"\s*:\s*"([^"]+)"/);
      if (m) sesskey = m[1];
    }
    if (!userid) {
      const m = text.match(/"userid"\s*:\s*(\d+)/);
      if (m) { const n = Number(m[1]); if (!isNaN(n)) userid = n; }
    }
    if (!fullname) {
      const m = text.match(/"fullname"\s*:\s*"([^"]+)"/);
      if (m) fullname = m[1];
    }
    if (!username) {
      const m = text.match(/"username"\s*:\s*"([^"]+)"/);
      if (m) username = m[1];
    }
  }

  if (!sesskey) {
    const input = document.querySelector('input[name="sesskey"]') as HTMLInputElement | null;
    if (input) sesskey = input.value;
  }

  if (!sesskey) {
    const logoutLink = document.querySelector('a[href*="logout.php"]') as HTMLAnchorElement | null;
    if (logoutLink) {
      const m = logoutLink.href.match(/sesskey=([^&]+)/);
      if (m) sesskey = m[1];
    }
  }

  if (sesskey) {
    try {
      await sendMessage('saveSessionInfo', { sesskey, userid, fullname, username });
    } catch {
      // Extension context might not be ready
    }
  }
}

/**
 * 浮動 E3 助手按鈕 + 快速面板
 */
function addFloatingButton() {
  let panelOpen = false;
  let panel: HTMLDivElement | null = null;

  const btn = document.createElement('button');
  btn.textContent = 'E3 助手';
  btn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10001;
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
    if (panelOpen && panel) {
      panel.remove();
      panel = null;
      panelOpen = false;
      btn.textContent = 'E3 助手';
      return;
    }
    panelOpen = true;
    btn.textContent = '收起';
    panel = createQuickPanel();
    document.body.appendChild(panel);
  });
  document.body.appendChild(btn);
}

/**
 * 建立快速面板：未繳作業 + 課程連結
 */
function createQuickPanel(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.style.cssText = `
    position: fixed;
    bottom: 65px;
    right: 20px;
    z-index: 10000;
    width: 340px;
    max-height: 480px;
    overflow-y: auto;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.18);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    animation: e3SlideUp 0.2s ease-out;
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes e3SlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .e3-panel-item { padding: 10px 16px; border-bottom: 1px solid #f0f0f0; cursor: default; transition: background 0.15s; }
    .e3-panel-item:hover { background: #f8f9fa; }
    .e3-panel-item a { color: #4a90d9; text-decoration: none; }
    .e3-panel-item a:hover { text-decoration: underline; }
    .e3-panel-header { padding: 12px 16px; font-size: 13px; font-weight: 600; color: #1e3a5f; border-bottom: 2px solid #4a90d9; }
    .e3-panel-empty { padding: 16px; text-align: center; color: #999; font-size: 13px; }
    .e3-panel-loading { padding: 20px; text-align: center; color: #999; font-size: 13px; }
  `;
  document.head.appendChild(style);

  // Loading state
  panel.innerHTML = '<div class="e3-panel-loading">載入中...</div>';

  // Load data
  loadPanelData(panel);

  return panel;
}

async function loadPanelData(panel: HTMLDivElement) {
  try {
    const [assignResult, courseResult] = await Promise.all([
      sendMessage('getPendingAssignments', undefined),
      sendMessage('getCourses', undefined),
    ]);

    const assignments = assignResult.assignments as {
      name: string;
      courseShortname: string;
      duedate: number;
      isOverdue: boolean;
      url?: string;
    }[];

    const courses = courseResult.courses as {
      id: number;
      shortname: string;
      fullname: string;
      viewurl: string;
    }[];

    // Clear loading
    panel.textContent = '';

    // === Assignments section ===
    const assignHeader = document.createElement('div');
    assignHeader.className = 'e3-panel-header';
    assignHeader.textContent = `未繳作業 (${assignments.length})`;
    panel.appendChild(assignHeader);

    if (assignments.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'e3-panel-empty';
      empty.textContent = '沒有未繳作業';
      panel.appendChild(empty);
    } else {
      for (const a of assignments) {
        const item = document.createElement('div');
        item.className = 'e3-panel-item';

        const now = Date.now() / 1000;
        const hoursLeft = Math.max(0, Math.round((a.duedate - now) / 3600));
        const color = a.isOverdue ? '#e74c3c' : hoursLeft < 24 ? '#e74c3c' : hoursLeft < 72 ? '#f39c12' : '#27ae60';
        const timeText = a.isOverdue ? '已逾期' : hoursLeft < 24 ? `${hoursLeft}h` : `${Math.round(hoursLeft / 24)}d`;

        const nameEl = document.createElement('div');
        nameEl.style.cssText = 'font-size:13px;font-weight:500;color:#333';
        if (a.url) {
          const link = document.createElement('a');
          link.href = a.url;
          link.textContent = a.name;
          link.addEventListener('click', (e) => { e.preventDefault(); window.location.href = link.href; });
          nameEl.appendChild(link);
        } else {
          nameEl.textContent = a.name;
        }

        const meta = document.createElement('div');
        meta.style.cssText = 'display:flex;justify-content:space-between;margin-top:3px';

        const course = document.createElement('span');
        course.style.cssText = 'font-size:11px;color:#999';
        course.textContent = a.courseShortname;

        const time = document.createElement('span');
        time.style.cssText = `font-size:11px;font-weight:600;color:${color}`;
        time.textContent = timeText;

        meta.append(course, time);
        item.append(nameEl, meta);
        panel.appendChild(item);
      }
    }

    // === Courses section ===
    const courseHeader = document.createElement('div');
    courseHeader.className = 'e3-panel-header';
    courseHeader.textContent = '課程';
    panel.appendChild(courseHeader);

    for (const c of courses) {
      const item = document.createElement('div');
      item.className = 'e3-panel-item';
      item.style.cursor = 'pointer';

      const link = document.createElement('a');
      link.href = c.viewurl || `${BASE_URL}/course/view.php?id=${c.id}`;
      link.style.cssText = 'font-size:13px;display:block';
      link.textContent = c.fullname;

      // Navigate in same tab for quick course switching
      link.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = link.href;
      });

      item.appendChild(link);
      panel.appendChild(item);
    }
  } catch {
    panel.textContent = '';
    const err = document.createElement('div');
    err.className = 'e3-panel-empty';
    err.textContent = '無法載入，請先在 Extension 登入';
    panel.appendChild(err);
  }
}

/**
 * 課程頁面：批次下載教材按鈕
 */
function addBatchDownloadButton(courseId: string) {
  const header = document.querySelector('#page-header, .page-header-headings, #region-main h2');
  if (!header) return;

  const downloadBtn = document.createElement('button');
  downloadBtn.textContent = '批次下載教材';
  downloadBtn.style.cssText = `
    margin-left: 12px;
    background: #4a90d9;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 13px;
    cursor: pointer;
    vertical-align: middle;
    transition: background 0.2s;
  `;
  downloadBtn.addEventListener('mouseenter', () => { downloadBtn.style.background = '#1e3a5f'; });
  downloadBtn.addEventListener('mouseleave', () => { downloadBtn.style.background = '#4a90d9'; });
  downloadBtn.addEventListener('click', async () => {
    downloadBtn.textContent = '下載中...';
    downloadBtn.style.opacity = '0.6';
    try {
      await sendMessage('downloadCourseFiles', { courseid: Number(courseId) });
      downloadBtn.textContent = '下載完成';
      downloadBtn.style.background = '#27ae60';
    } catch {
      downloadBtn.textContent = '下載失敗';
      downloadBtn.style.background = '#e74c3c';
    }
    setTimeout(() => {
      downloadBtn.textContent = '批次下載教材';
      downloadBtn.style.background = '#4a90d9';
      downloadBtn.style.opacity = '1';
    }, 3000);
  });

  header.appendChild(downloadBtn);
}

/**
 * 課程頁面：高亮有截止日的活動
 */
function highlightDeadlines() {
  // 找所有 assign 連結，加上視覺提示
  const assignLinks = document.querySelectorAll('a[href*="/mod/assign/view.php"]');
  assignLinks.forEach((link) => {
    const el = link as HTMLAnchorElement;
    // 找到最近的 activity 容器
    const activity = el.closest('.activity, .activityinstance, li');
    if (activity) {
      // 找截止日文字
      const text = activity.textContent ?? '';
      const dateMatch = text.match(/(\d{1,2})\s*(月|January|February|March|April|May|June|July|August|September|October|November|December)/i);
      if (dateMatch) {
        (activity as HTMLElement).style.borderLeft = '3px solid #e74c3c';
        (activity as HTMLElement).style.paddingLeft = '8px';
      }
    }
  });
}

/**
 * 作業頁面：拖放上傳區域增強
 */
function enhanceAssignmentPage() {
  // 找到提交狀態區域
  const submissionStatus = document.querySelector('.submissionstatustable, .generaltable');
  if (!submissionStatus) return;

  // 檢查是否可以提交
  const submitBtn = document.querySelector('a[href*="action=editsubmission"], .btn-primary[href*="editsubmission"]');
  if (!submitBtn) return;

  // 加一個快速提示
  const tip = document.createElement('div');
  tip.style.cssText = `
    margin: 12px 0;
    padding: 10px 16px;
    background: #e8f4fd;
    border-left: 4px solid #4a90d9;
    border-radius: 4px;
    font-size: 13px;
    color: #1e3a5f;
  `;
  tip.innerHTML = '<strong>E3 助手</strong> — 可以用 Side Panel 的上傳功能一次上傳多個檔案';
  submissionStatus.parentNode?.insertBefore(tip, submissionStatus.nextSibling);
}

/**
 * 首頁：截止日提醒 banner
 */
async function addDeadlineBanner() {
  try {
    const result = await sendMessage('getPendingAssignments', undefined);
    const assignments = result.assignments as {
      name: string;
      courseShortname: string;
      duedate: number;
      isOverdue: boolean;
      url?: string;
    }[];

    if (assignments.length === 0) return;

    // 顯示 7 天內的
    const now = Date.now() / 1000;
    const urgent = assignments.filter(a => a.duedate > 0 && (a.duedate - now) < 7 * 86400);
    if (urgent.length === 0) return;

    const banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      z-index: 9999;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      padding: 16px 20px;
      max-width: 360px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      animation: slideIn 0.3s ease-out;
    `;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    `;
    document.head.appendChild(style);

    // Build banner with DOM API (no innerHTML with user data — XSS prevention)
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px';

    const title = document.createElement('span');
    title.style.cssText = 'font-size:14px;font-weight:600;color:#1e3a5f';
    title.textContent = '即將截止的作業';

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:18px;color:#999;padding:0 4px';
    closeBtn.textContent = '\u2715';
    closeBtn.addEventListener('click', () => banner.remove());

    header.append(title, closeBtn);
    banner.appendChild(header);

    for (const a of urgent) {
      const hoursLeft = Math.max(0, Math.round((a.duedate - now) / 3600));
      const color = hoursLeft < 24 ? '#e74c3c' : '#f39c12';
      const timeText = a.isOverdue ? '已逾期' : hoursLeft < 24 ? `剩 ${hoursLeft} 小時` : `剩 ${Math.round(hoursLeft / 24)} 天`;

      const row = document.createElement('div');
      row.style.cssText = 'padding:8px 0;border-top:1px solid #f0f0f0';

      const inner = document.createElement('div');
      inner.style.cssText = 'display:flex;justify-content:space-between;align-items:start';

      const info = document.createElement('div');
      info.style.cssText = 'min-width:0';

      const nameEl = document.createElement('div');
      nameEl.style.cssText = 'font-size:13px;font-weight:500;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      nameEl.textContent = a.name;

      const courseEl = document.createElement('div');
      courseEl.style.cssText = 'font-size:11px;color:#999;margin-top:2px';
      courseEl.textContent = a.courseShortname;

      const timeEl = document.createElement('span');
      timeEl.style.cssText = `font-size:11px;font-weight:600;color:${color};white-space:nowrap;margin-left:8px`;
      timeEl.textContent = timeText;

      info.append(nameEl, courseEl);
      inner.append(info, timeEl);
      row.appendChild(inner);
      banner.appendChild(row);
    }

    document.body.appendChild(banner);

    // 30 秒後自動消失
    setTimeout(() => {
      banner.style.transition = 'opacity 0.3s, transform 0.3s';
      banner.style.opacity = '0';
      banner.style.transform = 'translateX(100%)';
      setTimeout(() => banner.remove(), 300);
    }, 30000);
  } catch {
    // Extension might not have auth yet
  }
}
