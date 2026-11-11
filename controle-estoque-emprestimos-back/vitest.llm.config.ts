import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportOnFailure: true,
      include: [
        'src/modules/estoques/**/*.ts',
        'src/modules/movimentacoes/**/*.ts',
        'src/modules/itens/**/*.ts',
        'src/modules/emprestimos/**/*.ts',
        'src/common/auth/guards/**/*.ts',
        'src/common/auth/decorators/roles.decorator.ts',
        'src/common/auth/access-role.enum.ts',
      ],
      exclude: ['src/**/*.module.ts', 'src/**/*.spec.ts'],
    },
    root: '.',
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});