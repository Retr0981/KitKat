/**
 * @kitkat/ui — the shared design system.
 *
 * Tokens (CSS variables), primitives, and the app shell. Used by both the web
 * app and the Chrome extension so they never visually diverge.
 *
 * NOTE: styles are NOT imported here. Each consuming app imports
 * `@kitkat/ui/styles.css` (or its own entry) so Tailwind processes the @tailwind
 * directives in that app's PostCSS context. Importing CSS here would bypass the
 * host's Tailwind pipeline and leave utility classes ungenerated.
 */

export * from './Button.js';
export * from './Badge.js';
export * from './Panel.js';
export * from './Input.js';
export * from './Tooltip.js';
export * from './Tabs.js';
export * from './Misc.js';
export * from './SplitPane.js';
export * from './Toaster.js';
export * from './AppShell.js';
