import { renderApp } from '../render.js';

// The DevTools panel always knows its inspected tab.
const tabId = chrome.devtools.inspectedWindow.tabId;
const host = document.getElementById('root')!;
renderApp(host, tabId);
