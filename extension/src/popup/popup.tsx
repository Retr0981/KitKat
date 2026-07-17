import { renderApp } from '../render.js';

// The popup has no inspected tab; App resolves the active tab itself.
const host = document.getElementById('root')!;
renderApp(host);
