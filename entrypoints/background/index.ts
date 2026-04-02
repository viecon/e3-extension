import { onMessage } from '@/lib/messages';
import {
  sesskeyStorage,
  tokenStorage,
  userInfoStorage,
  authModeStorage,
} from '@/lib/storage';
import {
  moodleAjaxCall,
  moodleRestCall,
  checkSession,
} from '@/lib/moodle';

/**
 * Call Moodle API.
 * Strategy: token (REST, full access) > session (AJAX, limited) > error
 */
async function apiCall<T>(wsfunction: string, params: Record<string, unknown> = {}): Promise<T> {
  // Prefer token mode - it has access to ALL Moodle API functions
  const token = await tokenStorage.getValue();
  if (token) {
    try {
      return await moodleRestCall<T>(token, wsfunction, params);
    } catch (err) { console.warn("[E3 助手]", err);
      // Token might be invalid, try session fallback
    }
  }

  // Fallback to session mode (limited AJAX API)
  const sesskey = await sesskeyStorage.getValue();
  if (sesskey) {
    try {
      return await moodleAjaxCall<T>(sesskey, wsfunction, params);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('過期')) {
        await sesskeyStorage.setValue(null);
      }
      throw err;
    }
  }

  throw new Error('未登入。請先在瀏覽器登入 E3，或在設定中輸入 Token。');
}

export default defineBackground(() => {
  // === Auth ===

  onMessage('checkSession', async () => {
    try {
      const result = await checkSession();
      if (result.valid && result.sesskey) {
        await sesskeyStorage.setValue(result.sesskey);
        await authModeStorage.setValue('session');
        if (result.userid) {
          await userInfoStorage.setValue({
            userid: result.userid,
            fullname: result.fullname ?? '',
            username: result.username ?? '',
          });
        }
        return { loggedIn: true, fullname: result.fullname };
      }
      return { loggedIn: false, error: '尚未登入 E3，請先在瀏覽器登入' };
    } catch (err: unknown) {
      return { loggedIn: false, error: err instanceof Error ? err.message : '檢查失敗' };
    }
  });

  onMessage('saveSessionInfo', async ({ data }) => {
    await sesskeyStorage.setValue(data.sesskey);
    await authModeStorage.setValue('session');
    if (data.userid) {
      await userInfoStorage.setValue({
        userid: data.userid,
        fullname: data.fullname ?? '',
        username: data.username ?? '',
      });
    }
  });

  onMessage('loginWithToken', async ({ data }) => {
    try {
      const info = await moodleRestCall<{
        userid: number;
        fullname: string;
        username: string;
      }>(data.token, 'core_webservice_get_site_info');

      await tokenStorage.setValue(data.token);
      await authModeStorage.setValue('token');
      await userInfoStorage.setValue({
        userid: info.userid,
        fullname: info.fullname,
        username: info.username,
      });

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Token 無效' };
    }
  });

  onMessage('logout', async () => {
    await sesskeyStorage.setValue(null);
    await tokenStorage.setValue(null);
    await userInfoStorage.setValue(null);
  });

  onMessage('getAuthState', async () => {
    const sesskey = await sesskeyStorage.getValue();
    const token = await tokenStorage.getValue();
    const info = await userInfoStorage.getValue();
    const mode = await authModeStorage.getValue();

    return {
      loggedIn: !!(sesskey || token),
      fullname: info?.fullname,
      authMode: mode,
    };
  });

  // === Courses ===
  // Use AJAX-compatible: core_course_get_enrolled_courses_by_timeline_classification

  onMessage('getCourses', async () => {
    try {
      const result = await apiCall<{
        courses: {
          id: number;
          fullname: string;
          shortname: string;
          visible: boolean;
          viewurl: string;
        }[];
      }>('core_course_get_enrolled_courses_by_timeline_classification', {
        classification: 'inprogress',
        limit: 0,
        offset: 0,
        sort: 'fullname',
      });
      return { courses: result.courses };
    } catch (err) {
      console.warn('[E3 助手] getCourses failed:', err);
      return { courses: [] };
    }
  });

  // === Pending Assignments ===
  // Use AJAX-compatible: core_calendar_get_action_events_by_timesort
  // Events with action.actionable=true are pending assignments/activities

  onMessage('getPendingAssignments', async () => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const until = now + 60 * 86400; // 60 days ahead

      const result = await apiCall<{
        events: {
          id: number;
          name: string;
          description: string;
          timestart: number;
          timeduration: number;
          eventtype: string;
          modulename: string;
          instance: number;
          overdue: boolean;
          url: string;
          course?: { id: number; fullname: string; shortname: string };
          action?: { name: string; url: string; actionable: boolean; itemcount: number };
        }[];
      }>('core_calendar_get_action_events_by_timesort', {
        timesortfrom: now - 86400,
        timesortto: until,
      });

      const assignments = result.events
        .filter(e => e.action?.actionable && e.modulename === 'assign')
        .map(e => ({
          id: e.instance,
          cmid: e.instance,
          courseId: e.course?.id ?? 0,
          courseName: e.course?.fullname ?? '',
          courseShortname: e.course?.shortname ?? '',
          name: e.name,
          duedate: e.timestart,
          intro: e.description ?? '',
          submissionStatus: 'new' as const,
          isOverdue: e.overdue,
          url: e.action?.url ?? e.url,
        }));

      return { assignments };
    } catch (err) { console.warn("[E3 助手]", err);
      return { assignments: [] };
    }
  });

  // === Course Files ===
  // core_course_get_contents is NOT available via AJAX on E3.
  // Scrape course page + expand mod/folder pages to find all files.

  onMessage('getCourseFiles', async ({ data }) => {
    try {
      const files = await scrapeCourseFiles(data.courseid, data.typeFilter);
      return { files };
    } catch (err) { console.warn("[E3 助手]", err);
      return { files: [] };
    }
  });

  // Download course files
  onMessage('downloadCourseFiles', async ({ data }) => {
    try {
      const files = await scrapeCourseFiles(data.courseid, data.typeFilter) as { filename: string; fileurl: string }[];
      let count = 0;
      for (const file of files) {
        await chrome.downloads.download({
          url: file.fileurl,
          filename: file.filename,
        });
        count++;
      }
      return { count };
    } catch (err) { console.warn("[E3 助手]", err);
      return { count: 0 };
    }
  });

  // === Calendar ===
  onMessage('getCalendarEvents', async ({ data }) => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const until = now + data.days * 86400;

      const result = await apiCall<{ events: unknown[] }>(
        'core_calendar_get_action_events_by_timesort',
        { timesortfrom: now, timesortto: until },
      );
      return { events: result.events };
    } catch (err) { console.warn("[E3 助手]", err);
      // Try upcoming view as fallback
      try {
        const result = await apiCall<{ events: unknown[] }>(
          'core_calendar_get_calendar_upcoming_view',
          {},
        );
        return { events: result.events };
      } catch (err) { console.warn("[E3 助手]", err);
        return { events: [] };
      }
    }
  });

  // === Grades ===
  onMessage('getGrades', async ({ data }) => {
    try {
      const info = await userInfoStorage.getValue();
      if (!info) return { grades: null };

      if (data.courseid) {
        const result = await apiCall<{ usergrades: unknown[] }>(
          'gradereport_user_get_grade_items',
          { courseid: data.courseid, userid: info.userid },
        );
        return { grades: result.usergrades[0] };
      }

      const result = await apiCall('gradereport_overview_get_course_grades', {
        userid: info.userid,
      });
      return { grades: result };
    } catch (err) { console.warn("[E3 助手]", err);
      return { grades: null };
    }
  });

  // === Upload & Submit ===
  onMessage('uploadAndSubmit', async ({ data }) => {
    try {
      await apiCall('mod_assign_save_submission', {
        assignmentid: data.assignmentId,
        plugindata: { files_filemanager: data.itemid },
      });
      return { success: true };
    } catch (err) { console.warn("[E3 助手]", err);
      return { success: false };
    }
  });

  // === CLI Export ===
  onMessage('exportForCli', async () => {
    try {
      const cookie = await chrome.cookies.get({
        url: 'https://e3p.nycu.edu.tw',
        name: 'MoodleSession',
      });
      if (cookie) {
        const masked = cookie.value.slice(0, 4) + '****' + cookie.value.slice(-4);
        return {
          cookie: cookie.value,
          instructions: `執行: e3 login --session "..." (cookie: ${masked})，請從 DevTools > Application > Cookies 複製完整值`,
        };
      }
    } catch { /* ok */ }

    return { cookie: '', instructions: '請先在瀏覽器登入 E3' };
  });

  // === Badge: show pending assignment count on toolbar icon ===
  async function updateBadge() {
    try {
      const now = Math.floor(Date.now() / 1000);
      const result = await apiCall<{
        events: { action?: { actionable: boolean }; modulename: string }[];
      }>('core_calendar_get_action_events_by_timesort', {
        timesortfrom: now - 86400,
        timesortto: now + 30 * 86400,
      });

      const count = result.events.filter(
        e => e.action?.actionable && e.modulename === 'assign',
      ).length;

      chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
      chrome.action.setBadgeBackgroundColor({ color: count > 0 ? '#e74c3c' : '#4a90d9' });
    } catch {
      chrome.action.setBadgeText({ text: '' });
    }
  }

  // Update badge on startup and periodically
  updateBadge();
  chrome.alarms.create('checkDeadlines', { periodInMinutes: 30 });

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== 'checkDeadlines') return;

    const sesskey = await sesskeyStorage.getValue();
    const token = await tokenStorage.getValue();
    if (!sesskey && !token) return;

    try {
      const session = await checkSession();
      if (session.valid && session.sesskey) {
        await sesskeyStorage.setValue(session.sesskey);
      }
    } catch { /* ok */ }

    updateBadge();
  });
});

/**
 * Scrape course page + expand mod/folder pages to find all downloadable files.
 * E3 的講義大多放在 mod/folder 裡，需要逐一展開才能拿到 pluginfile 連結。
 */
async function scrapeCourseFiles(
  courseid: number,
  typeFilter?: string[],
): Promise<{ sectionName: string; moduleName: string; filename: string; fileurl: string; filesize: number; mimetype: string | undefined }[]> {
  const courseRes = await fetch(`https://e3p.nycu.edu.tw/course/view.php?id=${courseid}`, {
    credentials: 'include',
  });
  if (!courseRes.ok) return [];

  const courseHtml = await courseRes.text();
  const files: { sectionName: string; moduleName: string; filename: string; fileurl: string; filesize: number; mimetype: string | undefined }[] = [];
  const seen = new Set<string>();

  function addFile(filename: string, fileurl: string, moduleName: string) {
    if (!filename || filename.endsWith('.ico') || seen.has(fileurl)) return;

    if (typeFilter?.length) {
      const ext = filename.split('.').pop()?.toLowerCase() ?? '';
      if (!typeFilter.includes(ext)) return;
    }

    seen.add(fileurl);
    files.push({
      sectionName: '',
      moduleName,
      filename,
      fileurl,
      filesize: 0,
      mimetype: undefined,
    });
  }

  // 1. Direct pluginfile links on the course page
  const directFileRegex = /href="(https:\/\/e3p\.nycu\.edu\.tw\/pluginfile\.php\/[^"]+)"/g;
  let match;
  while ((match = directFileRegex.exec(courseHtml)) !== null) {
    const url = match[1].split('?')[0];
    const filename = decodeURIComponent(url.split('/').pop() ?? '');
    addFile(filename, match[1], '');
  }

  // 2. Expand all mod/folder pages to find files inside
  const folderRegex = /mod\/folder\/view\.php\?id=(\d+)/g;
  const folderIds = new Set<string>();
  while ((match = folderRegex.exec(courseHtml)) !== null) {
    folderIds.add(match[1]);
  }

  // Fetch all folders in parallel (batches of 5)
  const folderArray = [...folderIds];
  for (let i = 0; i < folderArray.length; i += 5) {
    const batch = folderArray.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(async (fid) => {
        try {
          const res = await fetch(`https://e3p.nycu.edu.tw/mod/folder/view.php?id=${fid}`, {
            credentials: 'include',
          });
          if (!res.ok) return '';
          return res.text();
        } catch (err) { console.warn("[E3 助手]", err);
          return '';
        }
      }),
    );

    for (const folderHtml of results) {
      if (!folderHtml) continue;

      // Get folder name
      const nameMatch = folderHtml.match(/<h2[^>]*>([^<]+)<\/h2>/);
      const folderName = nameMatch?.[1]?.trim() ?? '';

      // Find pluginfile links
      const fileRegex = /href="(https:\/\/e3p\.nycu\.edu\.tw\/pluginfile\.php\/[^"]+)"/g;
      while ((match = fileRegex.exec(folderHtml)) !== null) {
        const url = match[1].split('?')[0];
        const filename = decodeURIComponent(url.split('/').pop() ?? '');
        addFile(filename, match[1], folderName);
      }
    }
  }

  // 3. Expand mod/resource pages (single files)
  const resourceRegex = /mod\/resource\/view\.php\?id=(\d+)/g;
  const resourceIds = new Set<string>();
  while ((match = resourceRegex.exec(courseHtml)) !== null) {
    resourceIds.add(match[1]);
  }

  const resourceArray = [...resourceIds];
  for (let i = 0; i < resourceArray.length; i += 5) {
    const batch = resourceArray.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(async (rid) => {
        try {
          // mod/resource usually redirects to the actual file
          const res = await fetch(`https://e3p.nycu.edu.tw/mod/resource/view.php?id=${rid}`, {
            credentials: 'include',
            redirect: 'manual',
          });
          // If redirected, the Location header has the file URL
          const location = res.headers.get('location');
          if (location?.includes('pluginfile.php')) {
            return { url: location, html: '' };
          }
          if (res.ok) {
            return { url: '', html: await res.text() };
          }
          return { url: '', html: '' };
        } catch (err) { console.warn("[E3 助手]", err);
          return { url: '', html: '' };
        }
      }),
    );

    for (const { url, html: resHtml } of results) {
      if (url) {
        const filename = decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? '');
        addFile(filename, url, '');
      } else if (resHtml) {
        const fileRegex = /href="(https:\/\/e3p\.nycu\.edu\.tw\/pluginfile\.php\/[^"]+)"/g;
        while ((match = fileRegex.exec(resHtml)) !== null) {
          const fileUrl = match[1].split('?')[0];
          const filename = decodeURIComponent(fileUrl.split('/').pop() ?? '');
          addFile(filename, match[1], '');
        }
      }
    }
  }

  return files;
}
