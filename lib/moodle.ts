/**
 * Browser-side Moodle API client.
 *
 * 認證方式：使用 session cookie + sesskey（透過 AJAX API）
 * 因為 NYCU E3 使用 SSO + 2FA，無法用 /login/token.php 登入。
 * 改為從已登入的 E3 頁面擷取 sesskey，搭配瀏覽器自動帶的 session cookie 使用。
 */

const BASE_URL = 'https://e3p.nycu.edu.tw';

export class MoodleApiError extends Error {
  constructor(
    public errorcode: string,
    message: string,
  ) {
    super(message);
    this.name = 'MoodleApiError';
  }
}

function flattenParams(
  params: Record<string, unknown>,
  body: URLSearchParams,
  prefix = '',
): void {
  for (const [key, value] of Object.entries(params)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          flattenParams(item as Record<string, unknown>, body, `${fullKey}[${index}]`);
        } else {
          body.append(`${fullKey}[${index}]`, String(item));
        }
      });
    } else if (typeof value === 'object' && value !== null) {
      flattenParams(value as Record<string, unknown>, body, fullKey);
    } else if (value !== undefined && value !== null) {
      body.append(fullKey, String(value));
    }
  }
}

/**
 * 呼叫 Moodle AJAX API（session-based，不需 token）
 * 使用 /lib/ajax/service.php，瀏覽器自動帶 MoodleSession cookie
 */
export async function moodleAjaxCall<T>(
  sesskey: string,
  wsfunction: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const url = new URL('/lib/ajax/service.php', BASE_URL);
  url.searchParams.set('sesskey', sesskey);
  url.searchParams.set('info', wsfunction);

  const payload = [
    {
      index: 0,
      methodname: wsfunction,
      args: params,
    },
  ];

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include', // 帶上 session cookie
  });

  if (!res.ok) {
    if (res.status === 403) {
      throw new MoodleApiError('session_expired', '登入已過期，請重新在 E3 網頁登入');
    }
    throw new MoodleApiError('http_error', `HTTP ${res.status}`);
  }

  const data = await res.json();

  // AJAX API 回傳陣列，每個元素有 error/data
  if (Array.isArray(data)) {
    const result = data[0];
    if (result?.error) {
      throw new MoodleApiError(
        result.exception?.errorcode ?? 'ajax_error',
        result.exception?.message ?? result.error,
      );
    }
    return result.data as T;
  }

  // Fallback: 非陣列回應（例如錯誤）
  if (data?.error) {
    throw new MoodleApiError(data.errorcode ?? 'error', data.message ?? 'Unknown error');
  }

  return data as T;
}

/**
 * 備用：使用 wstoken 呼叫 REST API（當有 token 時）
 */
export async function moodleRestCall<T>(
  token: string,
  wsfunction: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const url = new URL('/webservice/rest/server.php', BASE_URL);
  url.searchParams.set('wstoken', token);
  url.searchParams.set('moodlewsrestformat', 'json');
  url.searchParams.set('wsfunction', wsfunction);

  const body = new URLSearchParams();
  flattenParams(params, body);

  const res = await fetch(url.toString(), { method: 'POST', body });
  if (!res.ok) throw new MoodleApiError('http_error', `HTTP ${res.status}`);

  const data = await res.json();
  if (data?.exception) {
    throw new MoodleApiError(data.errorcode, data.message);
  }
  return data as T;
}

/**
 * 上傳檔案到草稿區（使用 session cookie）
 */
export async function moodleUploadFile(
  sesskey: string,
  file: File,
  itemid: number = 0,
): Promise<{ itemid: number; filename: string }> {
  const url = new URL('/repository/repository_ajax.php', BASE_URL);
  url.searchParams.set('action', 'upload');

  const formData = new FormData();
  formData.append('sesskey', sesskey);
  formData.append('repo_upload_file', file, file.name);
  formData.append('itemid', String(itemid));
  formData.append('savepath', '/');
  formData.append('ctx_id', '1'); // system context, will be overridden
  formData.append('repo_id', ''); // will use upload repository

  const res = await fetch(url.toString(), {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!res.ok) throw new MoodleApiError('upload_error', `HTTP ${res.status}`);
  const data = await res.json();
  if (data?.error) throw new MoodleApiError('upload_error', data.error);

  return { itemid: data.itemid ?? itemid, filename: data.file ?? file.name };
}

/**
 * 使用 draft file manager 上傳（更可靠的方式）
 */
export async function moodleUploadDraft(
  sesskey: string,
  file: File,
  itemid: number = 0,
): Promise<{ itemid: number; filename: string }> {
  // 使用 Moodle 的 draftfile upload endpoint
  const url = new URL('/draftfile.php/5/user/draft/' + itemid + '/', BASE_URL);

  const formData = new FormData();
  formData.append('sesskey', sesskey);
  formData.append('repo_upload_file', file, file.name);

  // 用 core_files_upload 通過 AJAX API 上傳
  const result = await moodleAjaxCall<{
    itemid: number;
    filename: string;
    fileurl: string;
  }>(sesskey, 'core_files_upload', {
    component: 'user',
    filearea: 'draft',
    itemid: itemid,
    filepath: '/',
    filename: file.name,
    filecontent: await fileToBase64(file),
    contextlevel: 'user',
    instanceid: 0, // will be filled by Moodle
  });

  return { itemid: result.itemid, filename: result.filename };
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 檢查目前 E3 session 是否有效
 */
export async function checkSession(): Promise<{
  valid: boolean;
  userid?: number;
  fullname?: string;
  username?: string;
  sesskey?: string;
}> {
  try {
    // 嘗試存取 E3 首頁，看是否被重導到登入頁
    const res = await fetch(`${BASE_URL}/my/`, {
      credentials: 'include',
      redirect: 'manual',
    });

    // 如果被重導（302 到 SSO），session 無效
    if (res.status === 302 || res.type === 'opaqueredirect') {
      return { valid: false };
    }

    if (!res.ok) {
      return { valid: false };
    }

    const html = await res.text();

    // 從 HTML 擷取 sesskey
    const sesskeyMatch = html.match(/"sesskey"\s*:\s*"([^"]+)"/);
    const sesskey = sesskeyMatch?.[1];
    if (!sesskey) {
      return { valid: false };
    }

    // 從 HTML 擷取使用者資訊
    const useridMatch = html.match(/"userid"\s*:\s*(\d+)/);
    const userid = useridMatch ? Number(useridMatch[1]) : undefined;

    // 嘗試從頁面擷取姓名
    const nameMatch = html.match(/data-userid="\d+"[^>]*>([^<]+)</) ||
                      html.match(/"fullname"\s*:\s*"([^"]+)"/);
    const fullname = nameMatch?.[1];

    const usernameMatch = html.match(/"username"\s*:\s*"([^"]+)"/);
    const username = usernameMatch?.[1];

    return { valid: true, userid, fullname, username, sesskey };
  } catch {
    return { valid: false };
  }
}
