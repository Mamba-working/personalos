import { defineConfig } from 'vite';

// Relative base so `dist/` can be served from any sub-path (or opened by a static server).
export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5180 },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
