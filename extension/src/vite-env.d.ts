/// <reference types="vite/client" />

// Vite serves `?url` imports as a string URL at runtime; tsc needs to know.
declare module '*.html?url' {
  const src: string;
  export default src;
}
