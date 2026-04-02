import type { MoodleError } from './types.js';
import { flattenParams } from './utils.js';
import { DEFAULT_BASE_URL } from './constants.js';

const BASE_URL = DEFAULT_BASE_URL;
const REST_PATH = '/webservice/rest/server.php';
const AJAX_PATH = '/lib/ajax/service.php';

export class MoodleApiError extends Error {
  constructor(
    public errorcode: string,
    message: string,
    public exception?: string,
  ) {
    super(message);
    this.name = 'MoodleApiError';
  }
}

export interface MoodleClientOptions {
  baseUrl?: string;
  /** Web service token (from /user/managetoken.php) */
  token?: string;
  /** MoodleSession cookie value (from browser, for SSO auth) */
  sessionCookie?: string;
  /** Session key (from E3 page, for AJAX API) */
  sesskey?: string;
  /** Extra headers to include in requests */
  extraHeaders?: Record<string, string>;
}

export class MoodleClient {
  private token?: string;
  private sessionCookie?: string;
  private sesskey?: string;
  private baseUrl: string;
  private extraHeaders: Record<string, string>;

  constructor(options: MoodleClientOptions) {
    this.baseUrl = options.baseUrl ?? BASE_URL;
    this.token = options.token;
    this.sessionCookie = options.sessionCookie;
    this.sesskey = options.sesskey;
    this.extraHeaders = options.extraHeaders ?? {};

    if (!this.token && !this.sessionCookie) {
      throw new Error('需要提供 token 或 sessionCookie');
    }
  }

  /**
   * Call a Moodle web service function.
   * Uses REST API (token) or AJAX API (session) depending on auth mode.
   */
  async call<T>(wsfunction: string, params: Record<string, unknown> = {}): Promise<T> {
    if (this.token) {
      return this.restCall<T>(wsfunction, params);
    }
    return this.ajaxCall<T>(wsfunction, params);
  }

  /**
   * REST API call (token-based).
   */
  private async restCall<T>(wsfunction: string, params: Record<string, unknown> = {}): Promise<T> {
    const url = new URL(REST_PATH, this.baseUrl);
    url.searchParams.set('wstoken', this.token!);
    url.searchParams.set('moodlewsrestformat', 'json');
    url.searchParams.set('wsfunction', wsfunction);

    const body = new URLSearchParams();
    flattenParams(params, body);

    const res = await fetch(url.toString(), {
      method: 'POST',
      body,
      headers: this.extraHeaders,
    });

    if (!res.ok) {
      throw new MoodleApiError('http_error', `HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();

    if (data && typeof data === 'object' && 'exception' in data) {
      const err = data as MoodleError;
      throw new MoodleApiError(err.errorcode, err.message, err.exception);
    }

    return data as T;
  }

  /**
   * AJAX API call (session-based).
   * Uses /lib/ajax/service.php with session cookie.
   */
  private async ajaxCall<T>(wsfunction: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!this.sesskey) {
      // Try to get sesskey from E3 page
      this.sesskey = await this.fetchSesskey();
    }

    const url = new URL(AJAX_PATH, this.baseUrl);
    url.searchParams.set('sesskey', this.sesskey!);
    url.searchParams.set('info', wsfunction);

    const payload = [
      {
        index: 0,
        methodname: wsfunction,
        args: params,
      },
    ];

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.extraHeaders,
    };

    if (this.sessionCookie) {
      headers['Cookie'] = `MoodleSession=${this.sessionCookie}`;
    }

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      if (res.status === 403) {
        throw new MoodleApiError('session_expired', 'Session 已過期，請重新登入');
      }
      throw new MoodleApiError('http_error', `HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();

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

    if (data?.error) {
      throw new MoodleApiError(data.errorcode ?? 'error', data.message ?? 'Unknown error');
    }

    return data as T;
  }

  /**
   * Fetch sesskey from E3 main page.
   */
  private async fetchSesskey(): Promise<string> {
    const headers: Record<string, string> = { ...this.extraHeaders };
    if (this.sessionCookie) {
      headers['Cookie'] = `MoodleSession=${this.sessionCookie}`;
    }

    const res = await fetch(`${this.baseUrl}/my/`, {
      headers,
      redirect: 'manual',
    });

    if (res.status === 302 || res.status === 301) {
      throw new MoodleApiError('session_expired', 'Session 已過期（被重導到登入頁）');
    }

    const html = await res.text();
    const match = html.match(/"sesskey"\s*:\s*"([^"]+)"/);
    if (!match) {
      throw new MoodleApiError('sesskey_not_found', '無法從頁面擷取 sesskey');
    }

    this.sesskey = match[1];

    return match[1];
  }

  /**
   * Upload a file to Moodle's draft area.
   */
  async uploadFile(
    file: Blob,
    filename: string,
    itemid: number = 0,
  ): Promise<{ itemid: number; filename: string }> {
    if (this.token) {
      return this.uploadWithToken(file, filename, itemid);
    }
    return this.uploadWithSession(file, filename, itemid);
  }

  private async uploadWithToken(
    file: Blob,
    filename: string,
    itemid: number = 0,
  ): Promise<{ itemid: number; filename: string }> {
    const url = new URL('/webservice/upload.php', this.baseUrl);

    const formData = new FormData();
    formData.append('token', this.token!);
    formData.append('filearea', 'draft');
    formData.append('itemid', String(itemid));
    formData.append('file', file, filename);

    const res = await fetch(url.toString(), {
      method: 'POST',
      body: formData,
      headers: this.extraHeaders,
    });

    if (!res.ok) {
      throw new MoodleApiError('upload_error', `Upload failed: HTTP ${res.status}`);
    }

    const data = await res.json();

    if (data && typeof data === 'object' && 'exception' in data) {
      const err = data as MoodleError;
      throw new MoodleApiError(err.errorcode, err.message, err.exception);
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result || result.itemid === undefined) {
      throw new MoodleApiError('upload_error', 'Upload returned empty or malformed response');
    }
    return { itemid: result.itemid, filename: result.filename };
  }

  private async uploadWithSession(
    file: Blob,
    filename: string,
    itemid: number = 0,
  ): Promise<{ itemid: number; filename: string }> {
    if (!this.sesskey) {
      this.sesskey = await this.fetchSesskey();
    }

    // Convert file to base64 (works in both Node and browser)
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(buffer).toString('base64');

    const result = await this.ajaxCall<{
      itemid: number;
      filename: string;
    }>('core_files_upload', {
      component: 'user',
      filearea: 'draft',
      itemid,
      filepath: '/',
      filename,
      filecontent: base64,
      contextlevel: 'user',
      instanceid: 0,
    });

    return result;
  }

  /**
   * Build a download URL.
   * For token auth: appends token param.
   * For session auth: returns original URL (session cookies handle auth).
   */
  getFileUrl(fileurl: string): string {
    if (this.token) {
      try {
        const url = new URL(fileurl);
        url.searchParams.set('token', this.token);
        return url.toString();
      } catch {
        // Malformed URL, return with query string appended
        const sep = fileurl.includes('?') ? '&' : '?';
        return `${fileurl}${sep}token=${this.token}`;
      }
    }
    return fileurl;
  }

  /**
   * Download a file (returns Buffer for CLI use).
   */
  async downloadFile(fileurl: string): Promise<Buffer> {
    const headers: Record<string, string> = { ...this.extraHeaders };
    if (this.sessionCookie) {
      headers['Cookie'] = `MoodleSession=${this.sessionCookie}`;
    }

    const url = this.getFileUrl(fileurl);
    const res = await fetch(url, { headers });

    if (!res.ok) {
      throw new MoodleApiError('download_error', `Download failed: HTTP ${res.status}`);
    }

    return Buffer.from(await res.arrayBuffer());
  }

  get siteUrl(): string {
    return this.baseUrl;
  }

}
