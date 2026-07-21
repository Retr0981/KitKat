import { createContext, useContext, type ReactNode } from 'react';
import type { ToolBackend } from './types.js';

/**
 * React context providing the active ToolBackend. Modules consume it via
 * `useBackend()` rather than reaching for chrome.* or fetch directly.
 */

const BackendContext = createContext<ToolBackend | null>(null);

export function BackendProvider({ backend, children }: { backend: ToolBackend; children: ReactNode }) {
  return <BackendContext.Provider value={backend}>{children}</BackendContext.Provider>;
}

/** Access the active backend. Throws if used outside a provider. */
export function useBackend(): ToolBackend {
  const ctx = useContext(BackendContext);
  if (!ctx) throw new Error('useBackend() must be used within a <BackendProvider>.');
  return ctx;
}
