import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

/**
 * Chrome Manifest V3 for KitKat.
 *
 * - The service worker routes messages and batches analytics events.
 * - The ISOLATED-world content script bridges page ↔ extension.
 * - The MAIN-world content script installs the interceptor in the page's
 *   context so it shares the page's `navigator.modelContext`.
 * - DevTools panel is the primary full-screen surface; popup + side panel are
 *   compact launchers.
 */
export default defineManifest({
  manifest_version: 3,
  name: 'KitKat — WebMCP Developer Toolkit',
  version: pkg.version,
  description: 'Postman for WebMCP: validate, debug, simulate, and analyze Web Model Context Protocol tools.',
  minimum_chrome_version: '116',
  action: {
    default_popup: 'src/popup/popup.html',
    default_title: 'KitKat',
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      // Runs in the page's MAIN world to observe navigator.modelContext.
      matches: ['<all_urls>'],
      js: ['src/content/interceptor.main.ts'],
      world: 'MAIN',
      run_at: 'document_start',
      all_frames: false,
    },
    {
      // Isolated-world bridge: MAIN ↔ background via chrome.runtime.
      matches: ['<all_urls>'],
      js: ['src/content/relay.isolated.ts'],
      world: 'ISOLATED',
      run_at: 'document_start',
      all_frames: false,
    },
  ],
  permissions: ['storage', 'scripting', 'tabs', 'sidePanel', 'activeTab', 'devtools'],
  host_permissions: ['<all_urls>'],
  side_panel: {
    default_path: 'src/sidepanel/sidepanel.html',
  },
  devtools_page: 'src/devtools/devtools.html',
  commands: {
    'open-validator': {
      suggested_key: { default: 'Ctrl+Shift+V', mac: 'MacCtrl+Shift+V' },
      description: 'Open the KitKat Validator',
    },
    'open-debugger': {
      suggested_key: { default: 'Ctrl+Shift+D', mac: 'MacCtrl+Shift+D' },
      description: 'Open the KitKat Debugger',
    },
  },
  web_accessible_resources: [
    {
      resources: ['src/sandbox/runner.html'],
      matches: ['<all_urls>'],
    },
  ],
});
