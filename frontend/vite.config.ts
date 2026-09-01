/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
    },
    // Polling is required on Windows + Docker because inotify filesystem
    // events don't propagate from the host into the container, so Vite's
    // default watcher never fires. Polling every 300ms keeps HMR working.
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  // Pre-bundle all dependencies on startup so Vite never force-reloads
  // mid-session when a new import is encountered for the first time.
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      '@tanstack/react-query-devtools',
      'zustand',
      'axios',
      'framer-motion',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
      'lucide-react',
      'i18next',
      'react-i18next',
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
