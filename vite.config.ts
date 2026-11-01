import { defineConfig } from 'vite';
import { previewPlugin } from './scripts/preview-plugin.ts';
export default defineConfig({
  root: 'web', plugins: [previewPlugin()], server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { outDir: '../dist/web', emptyOutDir: true, sourcemap: false },
});
