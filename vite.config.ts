/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Keep every asset (including fonts) a separate file so the CSP needs no data: fonts (ADR-0004).
    assetsInlineLimit: 0,
    sourcemap: false,
  },
  server: {
    // Same-origin in development too: /api goes to a local backend (`go run ./cmd/api`), never a remote host (FE-62).
    proxy: {
      '/api': 'http://127.0.0.1:8080',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    css: { include: [/.+/], modules: { classNameStrategy: 'non-scoped' } },
    restoreMocks: true,
  },
});
