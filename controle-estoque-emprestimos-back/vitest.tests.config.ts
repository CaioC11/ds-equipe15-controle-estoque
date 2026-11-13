import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    root: '.',
    coverage: {
      provider: 'v8',
      reportOnFailure: true,
      include: ['src/modules/itens/**/*.ts'],
      exclude: ['src/modules/itens/**/*.module.ts', 'src/**/*.spec.ts', 'src/**/*.test.ts'],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: '../docs/testes/relatorios/v1',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});