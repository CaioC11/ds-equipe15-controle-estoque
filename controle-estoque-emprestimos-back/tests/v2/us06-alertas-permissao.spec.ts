import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { TipoMovimentacao } from '@prisma/client';
import { MovimentacoesController } from '../../src/modules/movimentacoes/movimentacoes.controller';
import { MovimentacoesService } from '../../src/modules/movimentacoes/movimentacoes.service';
import { AccessRole } from '../../src/common/auth/access-role.enum';

function fixture() {
  const prisma = {
    estoqueGestor: {
      findUnique: vi.fn().mockImplementation(({ where }) => Promise.resolve(
        where.estoqueId_usuarioId.estoqueId === 'A' && where.estoqueId_usuarioId.usuarioId === 'gestor'
          ? { estoqueId: 'A', usuarioId: 'gestor' } : null)),
      findMany: vi.fn().mockResolvedValue([{ estoqueId: 'A' }]),
    },
    estoque: {
      findUnique: vi.fn().mockImplementation(({ where }) => Promise.resolve({ id: where.id })),
      findMany: vi.fn().mockResolvedValue([{ id: 'A' }, { id: 'B' }]),
    },
    item: { findUnique: vi.fn().mockResolvedValue({ id: 'A-alerta', estoqueId: 'A' }), findMany: vi.fn().mockImplementation(({ where }) => Promise.resolve([
      { id: `${where.estoqueId}-alerta`, nome: 'Luva', estoqueId: where.estoqueId, nivelMinimo: 5 },
      { id: `${where.estoqueId}-regular`, nome: 'Papel', estoqueId: where.estoqueId, nivelMinimo: 5 },
    ])) },
    movimentacao: { groupBy: vi.fn().mockImplementation(({ where }) => Promise.resolve([
      { tipo: TipoMovimentacao.ENTRADA, _sum: { quantidade: where.itemId.endsWith('alerta') ? 5 : 6 } },
    ])) },
  };
  const service = new MovimentacoesService(prisma as never);
  const controller = new MovimentacoesController(service, {} as never);
  return { prisma, controller };
}
describe('US06 — lista de alertas do gestor', () => {
  it('CT-06-17/18: gestor de A recebe só alertas de A, sem itens regulares', async () => {
    const { controller } = fixture();
    expect(await controller.consultarMeusAlertas({ userId: 'gestor', role: AccessRole.USER })).toEqual([
      { estoqueId: 'A', itens: [expect.objectContaining({ itemId: 'A-alerta', abaixoDoMinimo: true })] },
    ]);
  });
  it('CT-06-19: dois vínculos mostram alertas dos dois estoques', async () => {
    const { controller, prisma } = fixture();
    prisma.estoqueGestor.findMany.mockResolvedValue([{ estoqueId: 'A' }, { estoqueId: 'B' }]);
    prisma.estoqueGestor.findUnique.mockResolvedValue({ usuarioId: 'gestor' });
    expect((await controller.consultarMeusAlertas({ userId: 'gestor', role: AccessRole.USER })).map((v) => v.estoqueId)).toEqual(['A', 'B']);
  });
  it.each(['outro', 'requisitante'])('CT-06-20/21: %s recebe 403 sem leitura dos itens de A', async (userId) => {
    const { controller, prisma } = fixture();
    await expect(controller.consultarAlertasEstoque('A', { userId, role: AccessRole.USER })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.item.findMany).not.toHaveBeenCalled();
  });
  it('CT-06-13: patrimonial com saldo 1 e mínimo 1 também gera alerta', async () => {
    const { controller, prisma } = fixture();
    prisma.item.findMany.mockResolvedValue([{ id: 'pat-1', nome: 'Notebook', tipo: 'PATRIMONIAL', estoqueId: 'A', nivelMinimo: 1 }]);
    prisma.movimentacao.groupBy.mockResolvedValue([]);
    expect(await controller.consultarAlertasEstoque('A', { userId: 'gestor', role: AccessRole.USER })).toEqual({
      estoqueId: 'A', itens: [expect.objectContaining({ itemId: 'pat-1', saldo: 1, abaixoDoMinimo: true })],
    });
  });
  it('consulta genérica de saldo também nega acesso sem vínculo', async () => {
    const { controller, prisma } = fixture();
    await expect(controller.consultarSaldoEstoque('A', { userId: 'req', role: AccessRole.USER })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.consultarSaldoItem('A-alerta', { userId: 'req', role: AccessRole.USER })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.movimentacao.groupBy).not.toHaveBeenCalled();
  });
  it('CT-06-22: ADMIN vê alertas de ambos os estoques', async () => {
    const { controller } = fixture();
    const result = await controller.consultarMeusAlertas({ userId: 'admin', role: AccessRole.ADMIN });
    expect(result.map((v) => v.estoqueId)).toEqual(['A', 'B']);
    expect(result.every((v) => v.itens.length === 1)).toBe(true);
  });
});
