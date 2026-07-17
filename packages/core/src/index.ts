/**
 * @kitkat/core — public surface.
 *
 * The shared engine behind every KitKat module. No React, no DOM-coupling
 * beyond what the WebMCP spec implies. Safe to import from the extension,
 * server, demo pages, and tests.
 */

export * from './types.js';
export * from './events.js';
export * from './polyfill.js';
export * from './declarative.js';
export * from './interceptor.js';
export * from './validation.js';
export * from './agent-engine.js';
