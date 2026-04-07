import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'E3 助手 - NYCU E3 LMS Assistant',
    description: '讓 NYCU E3 更好用：作業追蹤、批次下載、批次上傳',
    browser_specific_settings: {
      gecko: {
        id: 'e3-assistant@viecon.site',
        strict_min_version: '142.0',
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    // MV3: action, MV2: browser_action — WXT auto-generates from popup entrypoint
    // but doesn't set default_icon, so we add browser_action manually for MV2
    browser_action: {
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
      },
    },
    permissions: ['storage', 'alarms', 'notifications', 'downloads', 'cookies'],
    host_permissions: [
      'https://e3p.nycu.edu.tw/*',
    ],
    // Firefox sidebar
    sidebar_action: {
      default_title: 'E3 助手',
      default_panel: 'sidepanel.html',
    },
  },
});
