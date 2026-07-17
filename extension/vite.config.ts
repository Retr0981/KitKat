import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    // Chunk splitting keeps Monaco from bloating the popup bundle.
    rollupOptions: {
      // Explicitly include the devtools panel HTML so it's bundled (CRXJS only
      // auto-discovers manifest-referenced or imported HTML; panels.create's
      // string path isn't statically visible).
      input: {
        panel: 'src/devtools/panel.html',
      },
      output: {
        manualChunks: {
          monaco: ['monaco-editor', '@monaco-editor/react'],
          charts: ['recharts'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@kitkat/core': new URL('../packages/core/src/index.ts', import.meta.url).pathname,
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5174,
    },
  },
});
