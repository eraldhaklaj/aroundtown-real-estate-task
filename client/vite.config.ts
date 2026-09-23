import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
    // One React copy for the whole tree (workspace hoisting can otherwise load two).
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5173,
    // Same-origin in dev: the browser only ever talks to Vite, which forwards /api to Express.
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: false } },
  },
})
