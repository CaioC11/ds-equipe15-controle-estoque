// A v2 preserva os cenários da v1 e acrescenta os casos abaixo.
import '../v1-llm/us06-alerta.spec';
import { describe, expect, it, vi } from 'vitest';
import { TipoItem, TipoMovimentacao } from '@prisma/client';
import { MovimentacoesService } from '../../src/modules/movimentacoes/movimentacoes.service';

// Lacunas CT-06-04 a 07, 14 a 17: fronteiras e conteúdo do alerta.
describe('US06 v2 — alertas e limites', () => {
  const consultar = async (minimo: number | null, saldo: number) => {
    const prisma: any = {
      item: { findUnique: vi.fn().mockResolvedValue({ id: 'i', nome: 'Luva', estoqueId: 'e', tipo: TipoItem.CONSUMO, nivelMinimo: minimo }) },
      movimentacao: { groupBy: vi.fn().mockResolvedValue(saldo ? [{ tipo: TipoMovimentacao.ENTRADA, _sum: { quantidade: saldo } }] : []) },
    };
    return new MovimentacoesService(prisma).consultarSaldoItem('i');
  };
  it.each([
    [5, 0, true], [0, 0, true], [0, 1, false], [null, 0, false], [5, 5, true], [5, 6, false],
  ])('CT-06-04/05/06/07: mínimo %s, saldo %s, alerta %s', async (minimo, saldo, alerta) => {
    expect(await consultar(minimo, saldo)).toMatchObject({ itemId: 'i', nomeItem: 'Luva', estoqueId: 'e', saldo, nivelMinimo: minimo, abaixoDoMinimo: alerta });
  });
  it('CT-06-15/16/17: separa 3 alertas de 2 itens regulares', async () => {
    const prisma: any = {
      estoque: { findUnique: vi.fn().mockResolvedValue({ id: 'e' }) },
      item: { findMany: vi.fn().mockResolvedValue([0, 1, 2, 3, 4].map((n) => ({ id: `i${n}`, nome: `Item ${n}`, estoqueId: 'e', nivelMinimo: 5 }))) },
      movimentacao: { groupBy: vi.fn().mockImplementation(({ where }: any) => Promise.resolve([{ tipo: TipoMovimentacao.ENTRADA, _sum: { quantidade: Number(where.itemId.slice(1)) + 3 } }])) },
    };
    const result = await new MovimentacoesService(prisma).consultarSaldoEstoque('e');
    expect(result.itens.filter((item) => item.abaixoDoMinimo).map((item) => item.itemId)).toEqual(['i0', 'i1', 'i2']);
    expect(result.itens).toHaveLength(5);
  });
  it.each([
    [3, TipoMovimentacao.ENTRADA, 3, 6, false],
    [3, TipoMovimentacao.ENTRADA, 2, 5, true],
    [8, TipoMovimentacao.SAIDA, 3, 5, true],
  ])('CT-06-08/09/10: saldo %i, %s %i → %i e alerta %s', async (saldo, tipo, quantidade, esperado, alerta) => {
    const tx: any = {
      item: { findUnique: vi.fn().mockResolvedValue({ id: 'i', estoqueId: 'e', nivelMinimo: 5 }) },
      estoqueGestor: { findUnique: vi.fn().mockResolvedValue({ estoqueId: 'e', usuarioId: 'u' }) },
      movimentacao: { groupBy: vi.fn().mockResolvedValue([{ tipo: TipoMovimentacao.ENTRADA, _sum: { quantidade: saldo } }]), create: vi.fn().mockResolvedValue({ id: 'm' }) },
    };
    const result = await new MovimentacoesService({ $transaction: (cb: any) => cb(tx) } as any)
      .registrarMovimentacao({ itemId: 'i', tipo, quantidade }, 'u', false);
    expect(result).toMatchObject({ saldoAtual: esperado, abaixoDoMinimo: alerta });
    expect(tx.movimentacao.create).toHaveBeenCalledOnce();
  });
});
