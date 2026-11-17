import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  plugins: [react()],
  css: { postcss: path.join(here, 'postcss.config.cjs') },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false } },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false } },
  },
  build: {
    outDir: path.join(here, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: { katex: ['katex'], react: ['react', 'react-dom', 'react-router-dom'] },
      },
    },
  },
});
