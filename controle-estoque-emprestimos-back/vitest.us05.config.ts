import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    root: '.',
    reporters: ['default', 'json'],
    outputFile: { json: '../docs/testes/relatorios/resultados-v1-us05.json' },
    coverage: {
      provider: 'v8',
      reportOnFailure: true,
      include: [
        'src/modules/emprestimos/termo-pdf.service.ts',
        'src/modules/emprestimos/termo-storage.service.ts',
        'src/modules/emprestimos/termo-assinado.constants.ts',
        'src/modules/emprestimos/emprestimos.service.ts',
        'src/modules/emprestimos/emprestimos.controller.ts',
      ],
      exclude: ['src/**/*.module.ts', 'src/**/*.spec.ts', 'src/**/*.test.ts'],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: '../docs/testes/relatorios/v1/us05',
    },
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});