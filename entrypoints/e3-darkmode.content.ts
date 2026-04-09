import { darkModeStorage } from '@/lib/storage';

/**
 * Dark mode content script — runs at document_start to prevent flash of light content.
 * Injects CSS and applies the dark class before the page renders.
 */
export default defineContentScript({
  matches: ['https://e3p.nycu.edu.tw/*'],
  runAt: 'document_start',
  async main() {
    const DARK_CSS = `
    html.e3-dark {
      filter: invert(90%) hue-rotate(180deg);
      background: #111 !important;
    }
    html.e3-dark body { background-color: #eee !important; }
    html.e3-dark #page, html.e3-dark #page-wrapper, html.e3-dark #page-content,
    html.e3-dark #region-main, html.e3-dark #region-main-box,
    html.e3-dark .course-content, html.e3-dark [role="main"],
    html.e3-dark .block, html.e3-dark .card, html.e3-dark .card-body,
    html.e3-dark .card-header, html.e3-dark .card-footer,
    html.e3-dark .dashboard-card-deck, html.e3-dark .block_myoverview,
    html.e3-dark .section-summary, html.e3-dark .course-section-header,
    html.e3-dark .container-fluid:not(.navbar .container-fluid) {
      background-color: #fff !important;
    }
    html.e3-dark #page-footer { background-color: #f5f5f5 !important; }
    html.e3-dark nav.navbar.bg-primary { background-color: #d4e6f9 !important; }
    html.e3-dark nav.navbar .nav-link, html.e3-dark nav.navbar a { color: #1a3a5f !important; }
    html.e3-dark .popover-region-container, html.e3-dark .popover-region-content-container { background-color: #fff !important; }
    html.e3-dark .drawer { background-color: #f0f0f0 !important; }
    html.e3-dark img, html.e3-dark video, html.e3-dark canvas,
    html.e3-dark iframe, html.e3-dark embed, html.e3-dark object {
      filter: invert(100%) hue-rotate(180deg) !important;
    }
    html.e3-dark .icon, html.e3-dark .fa, html.e3-dark [class*="fa-"] { filter: none !important; }
    html.e3-dark .activityiconcontainer img, html.e3-dark .activityicon,
    html.e3-dark .courseicon img, html.e3-dark .icon.activityicon { filter: none !important; }
    html.e3-dark * { text-shadow: none !important; }
    html.e3-dark #e3-quick-panel, html.e3-dark .e3-panel-item,
    html.e3-dark .e3-panel-header, html.e3-dark .e3-panel-loading,
    html.e3-dark .e3-panel-empty { filter: invert(100%) hue-rotate(180deg) !important; }
    html.e3-dark button[style*="position: fixed"][style*="bottom: 20px"] { filter: invert(100%) hue-rotate(180deg) !important; }
    html.e3-dark ::-webkit-scrollbar { width: 8px; }
    html.e3-dark ::-webkit-scrollbar-track { background: #222; }
    html.e3-dark ::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }
    `;

    // Inject CSS immediately (before render)
    const style = document.createElement('style');
    style.id = 'e3-dark-mode';
    style.textContent = DARK_CSS;
    (document.head ?? document.documentElement).appendChild(style);

    // Apply dark class immediately based on stored setting
    async function applyMode() {
      const mode = await darkModeStorage.getValue();
      const isDark = mode === 'dark'
        || (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('e3-dark', isDark);
    }

    applyMode();

    // Listen for system theme changes (for auto mode)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyMode);

    // Listen for storage changes (user toggles in popup)
    darkModeStorage.watch(applyMode);
  },
});
