import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/app.js';
import './styles.css';

/**
 * Mount the shared <App/> into a host element. Used by every HTML entry point
 * (devtools panel, popup, side panel). `tabId` is optional — when omitted, the
 * app resolves the active tab itself.
 */
export function renderApp(host: HTMLElement, tabId?: number) {
  createRoot(host).render(
    <React.StrictMode>
      <div className="dark h-full">
        <App tabId={tabId} />
      </div>
    </React.StrictMode>,
  );
}
