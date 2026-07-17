/**
 * DevTools entry. Creates the KitKat panel and renders the shared App into it.
 *
 * The panel HTML is imported as a URL so Vite/CRXJS bundles it into the build
 * output (string paths passed to panels.create aren't statically detected).
 */
import panelUrl from './panel.html?url';

chrome.devtools.panels.create('KitKat', '', panelUrl, () => {
  // Panel created; panel.html/panel.tsx does the rendering.
});

export {};
