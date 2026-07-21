import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Exact-match the CSS subpath BEFORE the bare-package alias (which points
      // at index.ts). Order matters: array form is matched first-to-last.
      { find: '@kitkat/ui/styles.css', replacement: new URL('../packages/ui/src/styles.css', import.meta.url).pathname },
      { find: '@kitkat/core', replacement: new URL('../packages/core/src/index.ts', import.meta.url).pathname },
      { find: '@kitkat/ui', replacement: new URL('../packages/ui/src/index.ts', import.meta.url).pathname },
    ],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ['monaco-editor', '@monaco-editor/react'],
          charts: ['recharts'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
});
