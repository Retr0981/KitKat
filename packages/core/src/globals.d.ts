/**
 * Ambient WebMCP globals on `Navigator`.
 *
 * The W3C IDL puts `modelContext` + `modelContextTesting` on Navigator, but
 * TypeScript's lib.dom.d.ts doesn't ship them yet. We declare them here so
 * application code (and tests) can reference them with proper types. When
 * Chrome's types catch up, this can be removed.
 */

import type { ModelContext, ModelContextTesting } from './types.js';

declare global {
  interface Navigator {
    readonly modelContext?: ModelContext;
    readonly modelContextTesting?: ModelContextTesting;
  }
}

export {};
