/**
 * WebMCP interceptor — observes a page's tool registrations without breaking
 * page functionality.
 *
 * Two paths (mirroring WebMCP itself):
 *  1. Imperative: if `navigator.modelContext` exists (native or polyfilled),
 *     we wrap `registerTool`/`unregisterTool` so every call also notifies us
 *     AND still runs the original behavior.
 *  2. Declarative fallback: if no API exists, a MutationObserver scans for
 *     `[toolname]` forms and reports them.
 *
 * The interceptor runs in the page's MAIN world (the content script injects it
 * so it shares the page's `navigator`). All observations are forwarded via the
 * injected `emit` callback, which the content script bridges to the extension.
 */

import { ATTR, scanDeclarative } from './declarative.js';
import { getPolyfillInternal, installPolyfill, type ConsentHandler } from './polyfill.js';
import type {
  InvocationResult,
  JsonObject,
  RegisteredTool,
  ModelContext,
  ToolDescriptor,
} from './types.js';
import { makeEvent, type McpEvent } from './events.js';

/** Callback the interceptor calls for every event it observes. */
export type InterceptorEmit = (event: McpEvent) => void;

/** Options for {@link installInterceptor}. */
export interface InterceptorOptions {
  emit: InterceptorEmit;
  /** Origin to stamp on emitted events. Defaults to location.origin. */
  origin?: string;
  /** Consent handler to wire through the polyfill, if it gets installed. */
  consent?: ConsentHandler;
  /** Run in safe mode (handlers return mocks). Default false. */
  safeMode?: boolean;
  /** If true, install the polyfill when no native API is present. Default true. */
  autoPolyfill?: boolean;
}

/**
 * Install the interceptor on the current global. Returns a handle with the
 * captured tools and an `uninstall` to restore originals (used in Sandbox +
 * tests).
 */
export interface InterceptorHandle {
  /** Snapshot of currently captured tools (live reference). */
  tools: () => RegisteredTool[];
  /** Unwrap everything the interceptor changed. */
  uninstall: () => void;
}

export function installInterceptor(opts: InterceptorOptions): InterceptorHandle {
  const origin = opts.origin ?? (typeof location !== 'undefined' ? location.origin : 'unknown');
  const captured = new Map<string, RegisteredTool>();
  let observer: MutationObserver | undefined;

  const reportRegistered = (tool: RegisteredTool) => {
    captured.set(tool.name, tool);
    opts.emit(
      makeEvent({
        type: 'tool:registered',
        origin,
        tool: toDescriptor(tool),
      }),
    );
  };

  const reportUnregistered = (name: string) => {
    captured.delete(name);
    opts.emit(makeEvent({ type: 'tool:unregistered', origin, toolName: name }));
  };

  // --- Path selection ------------------------------------------------------
  const nav = (globalThis as any).navigator as Navigator & {
    modelContext?: ModelContext;
    modelContextTesting?: unknown;
  };
  let nativePresent = typeof nav.modelContext === 'object' && nav.modelContext !== null;

  // If no API and autoPolyfill is on, install our polyfill (also acting as the API).
  if (!nativePresent && opts.autoPolyfill !== false) {
    const installed = installPolyfill(globalThis, {
      consent: opts.consent,
      safeMode: opts.safeMode,
      onRegistryChange: (tools) => {
        // Reconcile captured set with polyfill state.
        const names = new Set<string>();
        for (const t of tools) {
          names.add(t.name);
          if (!captured.has(t.name)) reportRegistered(t);
        }
        for (const name of [...captured.keys()]) {
          if (!names.has(name)) reportUnregistered(name);
        }
      },
    });
    // Wire event emission from polyfill invocations.
    const internal = getPolyfillInternal(installed.modelContext);
    if (internal) {
      internal.emitToolInvoked = (toolName: string, input: JsonObject) =>
        opts.emit(makeEvent({ type: 'tool:invoked', origin, toolName, input }));
      internal.emitToolResult = (result: InvocationResult) =>
        opts.emit(makeEvent({ type: 'tool:result', origin, result }));
      internal.emitConsentRequested = (toolName, message) =>
        opts.emit(makeEvent({ type: 'consent:requested', origin, toolName, message }));
      internal.emitConsentResolved = (toolName, granted) =>
        opts.emit(makeEvent({ type: 'consent:resolved', origin, toolName, granted }));
    }
    nativePresent = true;
  }

  if (nativePresent && nav.modelContext) {
    // Wrap registerTool/unregisterTool to observe without altering behavior.
    const mc = nav.modelContext;
    const origRegister = mc.registerTool?.bind(mc);
    const origUnregister = mc.unregisterTool?.bind(mc);

    mc.registerTool = (tool: any) => {
      origRegister?.(tool);
      reportRegistered({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
        source: 'imperative',
        execute: tool.execute,
        registeredAt: Date.now(),
      });
    };
    mc.unregisterTool = (name: string) => {
      origUnregister?.(name);
      reportUnregistered(name);
    };
  } else {
    // Pure declarative fallback — no API at all. Observe DOM for [toolname].
    const rescan = () => {
      const scanned = scanDeclarative();
      const names = new Set(scanned.map((t) => t.name));
      for (const t of scanned) {
        if (!captured.has(t.name)) reportRegistered(t);
      }
      for (const name of [...captured.keys()]) {
        if (!names.has(name)) reportUnregistered(name);
      }
    };
    rescan();
    observer = new MutationObserver(() => rescan());
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: [ATTR.name] });
  }

  return {
    tools: () => Array.from(captured.values()),
    uninstall: () => {
      observer?.disconnect();
      // We intentionally do not restore originals on the page's modelContext
      // — doing so would drop registrations the page relies on. Tests reinstall.
    },
  };
}

/** Build an IPC-safe descriptor from a registered tool (drops `execute`). */
function toDescriptor(tool: RegisteredTool): ToolDescriptor {
  const { execute: _e, ...rest } = tool;
  void _e;
  return rest;
}
