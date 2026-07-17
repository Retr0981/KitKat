/**
 * Self-contained WebMCP polyfill for KitKat demo pages.
 *
 * Pure static JS — no imports, no build step, no network. If the browser
 * provides `navigator.modelContext` natively (Chrome 146+ with the flag), this
 * is a no-op. Otherwise it installs a spec-accurate shim so the demo's tools are
 * discoverable by KitKat's Validator and Debugger.
 *
 * Usage in a demo page:
 *   <script src="/_shared/kitkat-polyfill.js"></script>
 *   <script>
 *     navigator.modelContext.registerTool({ name: 'demo.x', ... });
 *   </script>
 */
(function () {
  if (typeof navigator === 'undefined') return;
  if (navigator.modelContext && navigator.modelContextTesting) {
    console.info('[KitKat] Native WebMCP detected.');
    return;
  }

  var tools = new Map();

  function assertValidName(name) {
    if (typeof name !== 'string' || !name) {
      throw new DOMException('Tool name must be a non-empty string', 'InvalidStateError');
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(name)) {
      throw new DOMException('Invalid tool name: ' + name, 'InvalidStateError');
    }
  }

  function toDescriptor(t) {
    return { name: t.name, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations };
  }

  function makeClient(toolName) {
    return {
      requestUserInteraction: function (message) {
        return Promise.resolve(confirm(message));
      },
    };
  }

  var modelContext = {
    registerTool: function (tool) {
      assertValidName(tool.name);
      if (tools.has(tool.name)) {
        throw new DOMException('Tool already registered: ' + tool.name, 'InvalidStateError');
      }
      tools.set(tool.name, Object.assign({}, tool, { source: 'imperative', registeredAt: Date.now() }));
      window.dispatchEvent(new CustomEvent('kitkat:registered', { detail: toDescriptor(tool) }));
    },
    unregisterTool: function (name) {
      tools.delete(name);
    },
  };

  var modelContextTesting = {
    getTools: function () {
      return Promise.resolve(Array.from(tools.values()).map(toDescriptor));
    },
    executeTool: function (name, input) {
      return new Promise(function (resolve, reject) {
        var tool = tools.get(name);
        if (!tool) return reject(new DOMException('Unknown tool: ' + name, 'NotFoundError'));
        try {
          Promise.resolve(tool.execute(input || {}, makeClient(name))).then(resolve, reject);
        } catch (e) {
          reject(e);
        }
      });
    },
    provideContext: function (ctx) {
      var _this = this;
      tools.clear();
      (ctx.tools || []).forEach(function (t) {
        tools.set(t.name, Object.assign({}, t, { source: 'imperative', registeredAt: Date.now() }));
      });
      return Promise.resolve();
    },
    clearContext: function () {
      tools.clear();
      return Promise.resolve();
    },
  };

  Object.defineProperty(navigator, 'modelContext', { value: modelContext, configurable: true });
  Object.defineProperty(navigator, 'modelContextTesting', { value: modelContextTesting, configurable: true });

  window.__kitkatPolyfill = true;
  console.info('[KitKat] Polyfill installed (navigator.modelContext + modelContextTesting).');
})();
