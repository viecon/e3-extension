# E3 Extension

NYCU E3 LMS 瀏覽器 Extension — Chrome / Firefox / Zen Browser。

> 從 [viecon/e3-assistant](https://github.com/viecon/e3-assistant) 拆分而來。

## 功能

- **Command Palette (Ctrl+Shift+K)** — 在 E3 任何頁面快速搜尋跳轉到課程、作業、頁面
- **Dark Mode** — E3 網站深色模式，可手動切換（Auto/Dark/Light）
- **快速面板** — E3 頁面右下角按鈕，展開顯示未繳作業和課程連結
- **批次下載** — 課程頁面一鍵下載所有教材
- **截止日提醒** — 首頁自動提醒 7 天內到期的作業
- **Popup** — 未繳作業列表 + 課程列表 + dark mode 切換
- **Side Panel** — 完整功能面板（作業/課程/公告/行事曆/成績/通知）
- **Badge** — Toolbar icon 顯示未繳作業數量

## 安裝

### 開發

```bash
pnpm install
pnpm dev              # Chrome 開發模式
pnpm dev:firefox      # Firefox 開發模式
```

### 建置

```bash
pnpm build            # Chrome MV3
pnpm build:firefox    # Firefox MV2
pnpm build:all        # 兩者都 build
```

### 載入

**Chrome / Edge / Arc**：
1. 開啟 `chrome://extensions`
2. 開啟「開發者模式」
3. 點「載入未封裝項目」→ 選 `.output/chrome-mv3`

**Firefox / Zen Browser**：
1. 開啟 `about:debugging#/runtime/this-firefox`
2. 點「載入暫用附加元件」→ 選 `.output/firefox-mv2/manifest.json`

## Tech Stack

- [WXT](https://wxt.dev/) — WebExtension 建置工具
- React 18 + Tailwind CSS
- Zustand 狀態管理
- TypeScript

## License

MIT
