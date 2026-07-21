# KitKat

> **A developer toolkit for WebMCP — the new standard that lets websites expose "tools" AI assistants can call.** KitKat lets you test those tools before you ship them. Runs entirely in your browser; nothing leaves your machine.

---

## 🧭 Start here (if you're new)

**Don't skip this section.** It explains *what KitKat actually is* in plain English, with no assumed knowledge.

### What problem does this solve?

There's a new web standard called **WebMCP** (co-authored by Google and Microsoft). The idea:

> Websites can now expose **"tools"** that AI assistants call directly — like functions.

**Without WebMCP:** You ask an AI "find me a red dress and add it to cart." The AI has to *scrape the page* — read raw HTML, simulate clicks blindly. It's messy, fragile, and unreliable.

**With WebMCP:** The website deliberately exposes typed tools:

```
shop.search(query, color)   →  returns matching products
shop.addToCart(productId)   →  adds to the cart
```

The AI just *calls these tools*, exactly like calling a function in code. Clean, typed, reliable.

### So what is KitKat?

**KitKat is "Postman for WebMCP."** Postman lets you test APIs; KitKat lets you test these AI-facing website tools. Specifically, it answers the questions a developer asks while building WebMCP tools:

- *"Did I write my tool correctly?"* → the **Validator** runs 5 categories of tests and tells you what to fix
- *"What does an AI actually see when it reads my tool?"* → the **Debugger** shows you, live
- *"Would an AI be able to use my tools end-to-end?"* → the **Sandbox** simulates an AI doing exactly that
- *"How are my tools being used?"* → **Analytics** tracks invocations, success rates, timing

### How do I use it? (60 seconds)

```bash
npm install      # one-time: download dependencies
npm run web      # start the tool
```

Open `http://localhost:5174`, click **Launch the tool**, and you're in. No browser extension. No account. The sample tool is already loaded — click **Validator → Run validation** to see it work.

That's the whole thing. Everything below is detail for when you want to go deeper.

---

## ✨ The four modules

| Module | What it does | Plain-English version |
|---|---|---|
| **✓ Validator** | 5-category test suite (schema, parameters, execution, errors, security) with fix suggestions + export. | "Did I build this tool right? Here's what to fix." |
| **⛏ Debugger** | Live inspector: tool state, schemas, request/response, consent flow, timeline, LLM persona views. | "Show me exactly what an AI sees." |
| **⬡ Sandbox** | Rule-based agent simulator drives the discover→select→fill→invoke→respond→decide workflow. | "Would an AI actually be able to use my tools?" |
| **▦ Analytics** | Local SQLite dashboard: registrations, invocations, success/error rates, top tools, trends. | "How are my tools performing?" |

Plus:
- **🌐 Web app** — the no-install tool you just ran (`npm run web`). The recommended way to use KitKat.
- **`@kitkat/ui`** — the shared design system (buttons, colors, layout) used by both the web app and the extension.
- **`@kitkat/core`** — the engine: spec-faithful types, a polyfill, the validator, the agent simulator. No UI; reusable anywhere.
- **Local server** — optional; powers Analytics history and serves the demo pages (`npm run server`).
- **Demo pages** — example WebMCP sites (e-commerce, travel, forms) to test against.
- **Chrome extension** — the power-user version; can inspect *real* websites you browse (the web app can only see tools you define inline). See below.

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

### 🛟 Common problems (and fixes)

**"Failed to load extension — Manifest file is missing"**
You loaded the wrong folder. Chrome needs the *built* manifest, which lives in `extension/dist`, **not** the `extension/` source folder. Re-run `npm run build -w kitkat-extension`, then **Load unpacked → select `extension/dist`**. (This is exactly why the web app exists — `npm run web` has no such gotchas.)

**"The site looks unstyled / ugly"**
If styles are missing, the CSS pipeline didn't build. Run `npm run build -w kitkat-web` (production) or restart `npm run web` (dev). The build generates ~230 utility classes; if you see raw unstyled HTML, they didn't emit. A clean `rm -rf web/dist node_modules/.vite && npm run web` fixes it.

**"`npm install` warns about install scripts (better-sqlite3)"**
The analytics database needs a native compile. Run `npm approve-scripts better-sqlite3`, then `npm install` again. If you skip Analytics entirely, you can ignore this — everything else works without it.

**"Nothing happens when I click a tool"**
Make sure you're on a page that actually has WebMCP tools. Open a demo (`http://localhost:7421/ecommerce/` with the server running) or use the web app's inline Editor to define one.

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

## 🔧 How it works (under the hood, in plain English)

The cleverest part of KitKat is a trick that lets the **same four screens run in two completely different places** — inside a website AND inside a browser extension — without duplicating any code. Here's how.

### The "wall socket" trick

Imagine a wall socket. Your phone charger doesn't know or care where the electricity comes from — a power plant, a solar panel, a battery. It just plugs in and works.

KitKat does the same thing. There's a contract (programmers call it an *interface*) named **`ToolBackend`** — think of it as the wall socket:

```
ToolBackend = {
  getTools()      // "what tools exist right now?"
  invoke(name)    // "run this tool"
  validate()      // "test all the tools"
  ...
}
```

The four screens (Validator, Debugger, Sandbox, Analytics) **only ever talk to this socket**. They never ask what's behind it.

Then we plug in different "power sources":

- **The web app** plugs in a **simulated socket** — a list of tools you typed into the editor, running in your browser's memory.
- **The extension** plugs in a **real socket** — it actually inspects the live webpage you're browsing and uses *its* tools.

**Same screens, different power source.** Build once, use twice. This is the single idea that makes the whole project work. Programmers call it "an abstraction" — hiding messy details behind a simple, predictable interface.

### What each piece does, one level deeper

- **`@kitkat/core`** (the engine) does the real work: it can *register* tools, *invoke* them, *test* them, and *simulate* an AI using them. It has no buttons or screens — just pure logic. That's deliberate: it means the same engine powers the web app, the extension, and even automated tests.
- **`@kitkat/ui`** (the design system) is every visual element: the dark theme, buttons, panels, the sidebar layout. Shared so the web app and extension never look different.
- **The polyfill** — WebMCP is so new that most browsers don't support it yet. KitKat ships a faithful *fake* of the browser's WebMCP feature, so everything works today, on any browser. When real WebMCP arrives, KitKat uses it automatically.

### Data flow in one sentence

You define a tool → it goes into the `ToolBackend` → the screens read from that backend → when you click "validate" or "simulate," the `@kitkat/core` engine does the actual testing → results flow back to the screen.

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
