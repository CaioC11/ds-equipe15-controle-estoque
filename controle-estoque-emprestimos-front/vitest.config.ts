import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // src/config/env.ts reads these at import time, so any test that touches
    // src/services/api.ts (most of them, transitively) needs them to exist.
    // Dummy values are fine: nothing in the suite makes a real network or
    // Keycloak call. Without this, CI fails on every such test — there is no
    // .env file there, and .env is gitignored, so it never reaches the runner.
    env: {
      VITE_API_URL: 'http://localhost:3333/controle-estoque-emprestimos/api',
      VITE_KEYCLOAK_JSON:
        '{"realm":"test","auth-server-url":"http://localhost/auth/","ssl-required":"external","resource":"controle-estoque-emprestimos-front-test","public-client":true,"confidential-port":0}',
    },
  },
})
