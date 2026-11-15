import { describe, expect, it, vi } from 'vitest';
import { TipoItem, TipoMovimentacao } from '@prisma/client';
import { ItensService } from '../../src/modules/itens/itens.service';
import { MovimentacoesService } from '../../src/modules/movimentacoes/movimentacoes.service';

function fixture() {
  const itens = new Map<string, Record<string, unknown>>();
  const movimentos: Array<{ itemId: string; tipo: TipoMovimentacao; quantidade: number }> = [];
  const prisma = {
    estoque: { findUnique: vi.fn().mockResolvedValue({ id: 'e', ativo: true }) },
    estoqueGestor: { findUnique: vi.fn().mockResolvedValue({ estoqueId: 'e', usuarioId: 'gestor' }) },
    categoria: { findUnique: vi.fn().mockResolvedValue({ id: 'cat' }) },
    item: {
      create: vi.fn().mockImplementation(({ data }) => { const item = { id: `i${itens.size + 1}`, ...data }; itens.set(item.id, item); return Promise.resolve(item); }),
      findUnique: vi.fn().mockImplementation(({ where }) => Promise.resolve(itens.get(where.id))),
    },
    movimentacao: {
      create: vi.fn().mockImplementation(({ data }) => { movimentos.push(data); return Promise.resolve({ id: `m${movimentos.length}`, ...data }); }),
      groupBy: vi.fn().mockImplementation(({ where }) => Promise.resolve(
        [...new Set(movimentos.filter((m) => m.itemId === where.itemId).map((m) => m.tipo))].map((tipo) => ({
          tipo, _sum: { quantidade: movimentos.filter((m) => m.itemId === where.itemId && m.tipo === tipo).reduce((n, m) => n + m.quantidade, 0) },
        })),
      )),
    },
    $transaction: (cb: (tx: unknown) => Promise<unknown>) => cb(prisma),
  };
  return { prisma, itens: new ItensService(prisma as never), movimentacoes: new MovimentacoesService(prisma as never) };
}
describe('US03 — saldo após cadastro (fake de persistência compartilhado)', () => {
  it('CT-03-16: consumo cadastrado e entrada de 10 tem saldo 10', async () => {
    const { itens, movimentacoes } = fixture();
    const item = await itens.create('e', { tipo: TipoItem.CONSUMO, nome: 'Papel', categoriaId: 'cat' }, 'gestor');
    await movimentacoes.registrarMovimentacao({ itemId: item!.id, tipo: TipoMovimentacao.ENTRADA, quantidade: 10 }, 'gestor', false);
    expect(await movimentacoes.consultarSaldoItem(item!.id)).toMatchObject({ saldo: 10 });
  });
  it('CT-03-17: patrimonial recém-cadastrado começa com saldo 1', async () => {
    const { itens, movimentacoes } = fixture();
    const item = await itens.create('e', { tipo: TipoItem.PATRIMONIAL, nome: 'Notebook', tombamento: 'T-1', categoriaId: 'cat' }, 'gestor');
    expect(await movimentacoes.consultarSaldoItem(item!.id)).toMatchObject({ saldo: 1 });
  });
});
