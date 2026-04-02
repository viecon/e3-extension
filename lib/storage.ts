import { storage } from 'wxt/storage';

// Session-based auth (sesskey extracted from E3 page)
export const sesskeyStorage = storage.defineItem<string | null>('session:sesskey', {
  fallback: null,
});

// Legacy token support (for users who have a wstoken)
export const tokenStorage = storage.defineItem<string | null>('local:token', {
  fallback: null,
});

export const userInfoStorage = storage.defineItem<{
  userid: number;
  fullname: string;
  username: string;
} | null>('local:userInfo', {
  fallback: null,
});

export const settingsStorage = storage.defineItem<{
  notificationsEnabled: boolean;
  notifyHoursBefore: number;
  obsidianApiUrl: string;
  obsidianApiKey: string;
}>('local:settings', {
  fallback: {
    notificationsEnabled: true,
    notifyHoursBefore: 24,
    obsidianApiUrl: 'https://127.0.0.1:27124',
    obsidianApiKey: '',
  },
});

// Auth mode: 'session' (SSO, default) or 'token' (manual)
export const authModeStorage = storage.defineItem<'session' | 'token'>('local:authMode', {
  fallback: 'session',
});

// Dark mode: 'auto' (follow system), 'dark', 'light'
export const darkModeStorage = storage.defineItem<'auto' | 'dark' | 'light'>('local:darkMode', {
  fallback: 'auto',
});
