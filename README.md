# KitKat

> **The definitive open-source developer toolkit for WebMCP** — Postman for the Web Model Context Protocol. Validate, debug, simulate, and analyze WebMCP tools, **entirely client-side and local. Zero external API calls.**

WebMCP is Google + Microsoft's proposed W3C standard that lets websites expose JavaScript functions and HTML forms as structured **tools** to AI agents via `navigator.modelContext`. KitKat is the developer tooling layer around it: discover a page's tool contract, test it before shipping, watch live invocations, simulate agents offline, and track usage — all without leaving your browser or leaking data.

---

## ✨ What's inside

Four modules in one Chrome extension, plus a local analytics server and a shared engine:

| Module | What it does | Status |
|---|---|---|
| **✓ Validator** | Detect a page's tools and run a 5-category suite (schema, parameters, execution, error handling, security) with fix suggestions + JSON/Markdown export. | **Deep** |
| **⛏ Debugger** | Real-time inspector: tool state, full schemas, request/response payloads, consent flow, filterable timeline, freeze-frame diffing, LLM persona views, DOM overlay. | **Deep** |
| **⬡ Sandbox** | Simulate agent interactions offline. Pick a scenario + persona + goal, watch a rule-based agent drive the discover → select → fill → invoke → respond → decide workflow. | Skeleton |
| **▦ Analytics** | Local SQLite-backed dashboard: registrations, invocations, success/error rates, avg duration, top tools, error breakdown, trends. | Skeleton |

Plus:
- **🌐 Web app** — the no-install hosted tool (`npm run web`) plus a marketing landing page. Define tools in an inline editor and validate/debug them instantly, entirely in-browser.
- **`@kitkat/ui`** — the shared design system (tokens, primitives, app shell) used by both the web app and the extension, so they never visually diverge.
- **`@kitkat/core`** — a framework-agnostic engine: W3C-faithful types, a spec-accurate polyfill, the registration interceptor, a declarative-HTML scanner, the validation suite, and the agent engine. Reusable in tests, CLI, and other tools.
- **Local server** — Express + SQLite event ingest (`npm run server`), serving the demo pages and exposing the dashboard data API.
- **Demo pages** — real WebMCP pages (e-commerce, travel, forms) that use the native API when present and auto-polyfill otherwise.

---

## 🚀 Quick start

### Prerequisites
- **Node.js ≥ 20**
- **Chrome ≥ 116** (116 for the extension UI; **146+** for native WebMCP, behind `chrome://flags/#enable-webmcp-testing`)

### Install & build

```bash
git clone <this repo> KitKat && cd KitKat
npm install            # installs all workspaces
npm run build          # builds core, extension, server, and web app
```

> Building `better-sqlite3` (the analytics DB) runs a native compile. npm will prompt you to approve its install script — say yes.

### 🌐 Run the web app (no install, no extension)

The fastest way to use KitKat — a hosted-style web app that runs entirely in your browser:

```bash
npm run web            # http://localhost:5174
```

Open the URL and you land on the marketing site; click **Launch the tool** (or visit `?app`) to enter the redesigned toolkit. Define WebMCP tools in the **inline editor**, then immediately validate and debug them. Nothing else needs to be running. Optional: start `npm run server` to also populate the Analytics dashboard and serve the demo pages.

This is the recommended starting point. Use the extension only when you need to inspect your real, cross-origin production pages.

### Run the analytics server + demos

```bash
npm run server         # http://localhost:7421
```

This serves:
- The analytics API (`POST /events`, `GET /stats`, `/export`, `/stream`) that the extension batches to.
- The **demo pages** at `http://localhost:7421/` — e-commerce, travel, forms. Open one; it's a real WebMCP page.

### Load the extension

1. Run `npm run dev -w kitkat-extension` (or `npm run build -w kitkat-extension`).
2. Open `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select `extension/dist`.
4. Open one of the demo pages (or any WebMCP-enabled site).
5. Click the KitKat toolbar action, open DevTools → **KitKat** panel, or press **⌘K**.

You should see the page's tools appear in the Validator within ~2 seconds.

---

## 🧭 Module guides

### Validator
1. Open a WebMCP page (e.g. `http://localhost:7421/ecommerce/`).
2. Open the KitKat panel → **Validator** tab.
3. The tool list on the left populates from the page's registrations + declarative forms.
4. Click **▶ Run validation** to run the full 5-category suite across every tool.
5. Select a tool to inspect its contract, schema, and per-check results with fix suggestions.
6. **Export** the report as JSON or Markdown.

The five categories:
- **Schema** — declared, typed, `required` set, compiles in AJV, properties described.
- **Parameters** — generated valid / edge-case / invalid inputs are accepted or rejected correctly.
- **Execution** — runs with valid input; output is JSON-serializable.
- **Error handling** — invalid input throws a descriptive error, not a crash.
- **Security** — non-`readOnlyHint` tools call `client.requestUserInteraction()` before side effects.

### Debugger
- **Inspector** — live tool list with state badges (available → invoked → completed/error), full schemas, and a network-style request/response log per tool.
- **Agent view** — re-renders the tool list as Gemini / Claude / GPT function-calling declarations, so you see what a model sees. Pure formatting, no network.
- **Timeline** — chronological, filterable event log with freeze-frame capture (⏸ Freeze) and diffing against a saved snapshot.
- **DOM overlay** (◈) — highlights `[toolname]` elements on the page.

### Sandbox
1. Pick a preset scenario (e-commerce, travel, support) or create a new one.
2. Set the agent **goal** and **persona**.
3. Click **▶ Simulate agent**. The rule-based engine runs the 5-step workflow and renders a narrated trace.
4. Safe mode returns deterministic mocks — no real side effects.

The agent engine is intentionally AI-free and deterministic, so scenarios are reproducible and contributor-friendly. The drag-and-drop flow builder is the first flagged enhancement.

### Analytics
1. Start the server (`npm run server`).
2. Open the KitKat panel → **Analytics** tab. The dashboard pulls from `GET /stats` and refreshes every 4s.
3. The extension's service worker batches every observed event to the server (offline-queued if it's down).
4. If the server is unreachable, the dashboard falls back to the in-session event stream so it's never empty.

---

## 🌐 WebMCP primer

> Inline `ConceptTooltip`s throughout the UI explain these terms in context. This is the long-form version.

**WebMCP** (Web Model Context Protocol) is a draft W3C standard, co-authored by Google and Microsoft, developed under the Web Machine Learning Working Group. It lets a website publish a **Tool Contract** — a set of named tools with JSON-Schema-typed inputs and handlers — that AI agents can discover and invoke directly through the browser.

**The API surface** (what KitKat mirrors in `@kitkat/core`):
- `navigator.modelContext.registerTool(tool)` / `.unregisterTool(name)` — the production API. Throws `InvalidStateError` on duplicate/invalid names.
- `navigator.modelContextTesting.{getTools, executeTool, provideContext, clearContext}()` — the testing/agent API (Chrome 146+, behind `#enable-webmcp-testing`). This is what KitKat's Validator and Debugger use to discover and invoke tools.
- `ModelContextClient.requestUserInteraction(message)` — the **security primitive**. Sensitive (non-read-only) tools must call it before side effects; the browser shows a consent prompt.

**Two implementation paths:**
- **Imperative** — `registerTool()` in JS for dynamic tools (search, cart, booking).
- **Declarative** — `<form toolname="x" tooldescription="y">`. The browser synthesizes an input schema from the form controls. Zero JavaScript.

**Constraints KitKat respects:**
- Secure context (HTTPS / localhost) only.
- Same-origin; top-level browsing context.
- Tools clear on navigation.
- No headless mode yet; no `.well-known/webmcp` manifest yet.

**No native WebMCP? No problem.** KitKat's interceptor still detects declarative tools, and `@kitkat/core` ships a spec-accurate polyfill used by the Sandbox and demos so everything works pre-149.

---

## 🗂 Project structure

```
KitKat/
├─ packages/
│  ├─ core/              @kitkat/core — types, polyfill, interceptor, validation, agent engine
│  └─ ui/                @kitkat/ui — shared design system (tokens, primitives, app shell)
├─ web/                  🌐 the hosted web app + marketing site (Vite + React)
│  └─ src/
│     ├─ landing/        hero, WebMCP primer, modules, how-it-works, get-started
│     └─ app/            redesigned tool: editor + validator/debugger/sandbox/analytics
│        ├─ backend/     ToolBackend interface + in-memory backend
│        └─ modules/     redesigned Validator/Debugger/Sandbox/Analytics + inline ToolEditor
├─ extension/            Chrome MV3 (CRXJS + React + Tailwind + Monaco + Zustand + Recharts)
│  └─ src/
│     ├─ background/     service worker: message router + analytics batcher
│     ├─ content/        MAIN interceptor + ISOLATED relay + DOM overlay
│     ├─ messaging/      typed chrome.runtime port/message wrappers
│     ├─ store/          Zustand session store (tools, timeline, reports)
│     ├─ ui/             app shell + 4 modules + shared components
│     ├─ popup/ devtools/ sidepanel/   entry surfaces
│     └─ sandbox/        polyfilled runner iframe
├─ server/               Express + better-sqlite3 (ingest, stats, export, seed, benchmark)
└─ demo/                 static WebMCP pages (ecommerce, travel, forms) + polyfill
```

> **Architecture note:** the chrome coupling in the extension lives in a thin transport layer; everything else — `@kitkat/core`, `@kitkat/ui`, the store, the modules — is transport-agnostic. The web app implements the same `ToolBackend` interface against an in-memory registry, so the redesigned modules run identically in both.

---

## ⌨️ Keyboard shortcuts

| Shortcut | Action |
|---|---|
| **⌘K / Ctrl+K** | Command palette (module nav, toggle overlay, clear timeline) |
| **Ctrl+Shift+D** | Open Debugger (side panel) |
| **Ctrl+Shift+V** | Open Validator (popup) |

---

## 🧪 Developing

```bash
npm run web              # 🌐 the hosted web app + landing page (HMR) — the easiest entry
npm run dev              # core + extension (HMR) + server, concurrently
npm test                 # vitest (core engine tests)
npm run typecheck        # tsc --noEmit across all packages
npm run lint             # eslint
npm run format           # prettier
```

Useful workspace-scoped commands:
```bash
npm run dev -w kitkat-extension     # extension HMR only
npm run server                      # analytics server + demos
npm run seed -w kitkat-server       # seed 10,000 events
npm run benchmark -w kitkat-server  # prove the <1s query criterion
```

### Performance benchmarks
The analytics server meets the success criterion with huge headroom — on a 10,000-event dataset:

```
GET /stats (full dashboard payload)      6.0ms   ✓ under 1s
GET /events?limit=100 (paginated log)    0.7ms
POST /events (1,000 event batch insert)  8.6ms
```

Run `npm run benchmark -w kitkat-server` to verify on your machine.

---

## 🤝 Contributing

Contributions are welcome and deliberately scoped to be easy. The best entry points:

- **Agent personas** — add to `PERSONAS` in `packages/core/src/agent-engine.ts` and use them in the Sandbox + Debugger.
- **Validation rules** — add a `Check` to the relevant category in `packages/core/src/validation.ts`. Each is a small, testable function.
- **Sandbox scenarios** — drop a JSON-shaped scenario into `extension/src/ui/modules/sandbox/presets.ts`. No build needed for builtin scenarios.
- **Demo pages** — a single static HTML file in `demo/` using the bundled polyfill.

**Process:** fork → branch → `npm test && npm run typecheck` → PR. Please add a Vitest case for any new `@kitkat/core` behavior. See `.github/` for issue/PR templates.

---

## 📄 License

MIT © KitKat Contributors. See [LICENSE](./LICENSE).
