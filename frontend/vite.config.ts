import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { relaxXlsxAxisMinimumsPlugin } from './vite/relaxAxisMinimums';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [relaxXlsxAxisMinimumsPlugin(), react(), tailwindcss()],
  worker: {
    // xlsx-worker.js dynamically imports @dukelib/sheets-wasm. The default
    // IIFE worker format cannot code-split, so production builds fail.
    format: 'es',
    plugins: () => [relaxXlsxAxisMinimumsPlugin()],
  },
  optimizeDeps: {
    // The viewer starts xlsx-worker.js via `new Worker(new URL(...))`. Vite's
    // dep optimizer rewrites that URL into `.vite/deps` without emitting the
    // worker, so the package has to be served as source. Its CommonJS
    // dependencies still need prebundling for ESM interop.
    exclude: ['@extend-ai/react-xlsx'],
    include: ['regl'],
  },
  assetsInclude: ['**/*.wasm'],
  resolve: {
    alias: {
      '@hja/shared': path.resolve(__dirname, '../packages/shared/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
  },
});
