import { defineConfig } from 'vite';

// Library build: `npm run build:lib` → dist-lib/weather-scene.js (+ types in dist-lib/types,
// assets in dist-lib/assets). three.js is a peer dependency and stays external.
export default defineConfig({
  publicDir: false,
  build: {
    target: 'es2022',
    outDir: 'dist-lib',
    emptyOutDir: true,
    lib: { entry: 'src/lib/index.ts', formats: ['es'], fileName: () => 'weather-scene.js' },
    rollupOptions: { external: [/^three($|\/)/] },
    chunkSizeWarningLimit: 1200,
  },
});
