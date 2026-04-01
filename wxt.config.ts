import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'E3 助手 - NYCU E3 LMS Assistant',
    description: '讓 NYCU E3 更好用：作業追蹤、批次下載、批次上傳',
    permissions: ['storage', 'alarms', 'notifications', 'downloads', 'sidePanel', 'cookies'],
    host_permissions: [
      'https://e3p.nycu.edu.tw/*',
      'https://127.0.0.1:27124/*',
      'http://127.0.0.1:27123/*',
    ],
    // Firefox sidebar
    sidebar_action: {
      default_title: 'E3 助手',
      default_panel: 'sidepanel.html',
    },
  },
});
