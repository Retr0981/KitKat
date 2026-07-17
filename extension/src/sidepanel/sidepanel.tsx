import { renderApp } from '../render.js';

// Side panel mirrors the compact app. App resolves the active tab on mount.
const host = document.getElementById('root')!;
renderApp(host);
