import { describe, expect, it } from 'vitest';
import { ZodValidationPipe } from 'nestjs-zod';
import { RegistrarMovimentacaoDto } from '../../src/modules/movimentacoes/dto/registrar-movimentacao.dto';

const pipe = new ZodValidationPipe();
const metadata = { type: 'body' as const, metatype: RegistrarMovimentacaoDto };
describe('US01 — validação da entrada pelo pipe configurado na aplicação', () => {
  it.each([
    ['CT-01-17: tipo ausente', { itemId: 'i', quantidade: 1 }],
    ['CT-01-18: tipo inválido', { itemId: 'i', tipo: 'INVENTADO', quantidade: 1 }],
    ['CT-01-19: quantidade zero', { itemId: 'i', tipo: 'ENTRADA', quantidade: 0 }],
    ['CT-01-19: quantidade negativa', { itemId: 'i', tipo: 'ENTRADA', quantidade: -1 }],
    ['CT-01-19: quantidade fracionária', { itemId: 'i', tipo: 'ENTRADA', quantidade: 1.5 }],
  ])('%s é rejeitado antes da chamada ao controller', (_, valor) => {
    expect(() => pipe.transform(valor, metadata)).toThrow();
  });
  it('aceita quantidade inteira positiva e tipo do enum', () => {
    expect(pipe.transform({ itemId: 'i', tipo: 'ENTRADA', quantidade: 1 }, metadata)).toEqual({ itemId: 'i', tipo: 'ENTRADA', quantidade: 1 });
  });
});
