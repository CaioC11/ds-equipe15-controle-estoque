import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../src/database/prisma.service';
import { MovimentacoesService } from '../../src/modules/movimentacoes/movimentacoes.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('US06 — Alerta de reposição', () => {
  let prisma: {
    item: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    estoque: { findUnique: ReturnType<typeof vi.fn> };
    movimentacao: { groupBy: ReturnType<typeof vi.fn> };
  };
  let service: MovimentacoesService;

  beforeEach(() => {
    prisma = {
      item: { findUnique: vi.fn(), findMany: vi.fn() },
      estoque: { findUnique: vi.fn() },
      movimentacao: { groupBy: vi.fn().mockResolvedValue([]) },
    };
    service = new MovimentacoesService(prisma as unknown as PrismaService);
  });

  // Técnica: partição inválida; CA1 — item inexistente não possui saldo consultável.
  it('informa item inexistente', async () => {
    prisma.item.findUnique.mockResolvedValue(null);
    await expect(service.consultarSaldoItem('ausente')).rejects.toBeInstanceOf(NotFoundException);
  });

  // Técnica: partição válida; CA1 — sem nível mínimo não há alerta.
  it('não marca alerta quando o nível mínimo é nulo', async () => {
    prisma.item.findUnique.mockResolvedValue({ id: 'item-1', nome: 'Luva', estoqueId: 'e1', nivelMinimo: null });
    prisma.movimentacao.groupBy.mockResolvedValue([{ tipo: 'ENTRADA', _sum: { quantidade: 4 } }]);
    await expect(service.consultarSaldoItem('item-1')).resolves.toMatchObject({ saldo: 4, nivelMinimo: null, abaixoDoMinimo: false });
  });

  // Técnica: valor-limite na fronteira (saldo igual ao mínimo); CA1 — igualdade gera alerta.
  it('marca alerta quando o saldo é igual ao mínimo', async () => {
    prisma.item.findUnique.mockResolvedValue({ id: 'item-1', nome: 'Luva', estoqueId: 'e1', nivelMinimo: 5 });
    prisma.movimentacao.groupBy.mockResolvedValue([{ tipo: 'ENTRADA', _sum: { quantidade: 5 } }]);
    await expect(service.consultarSaldoItem('item-1')).resolves.toMatchObject({ saldo: 5, nivelMinimo: 5, abaixoDoMinimo: true });
  });

  // Técnica: valor-limite abaixo da fronteira; CA1 — saldo menor que o mínimo gera alerta.
  it('marca alerta quando o saldo fica abaixo do mínimo', async () => {
    prisma.item.findUnique.mockResolvedValue({ id: 'item-1', nome: 'Luva', estoqueId: 'e1', nivelMinimo: 5 });
    prisma.movimentacao.groupBy.mockResolvedValue([{ tipo: 'ENTRADA', _sum: { quantidade: 4 } }]);
    await expect(service.consultarSaldoItem('item-1')).resolves.toMatchObject({ saldo: 4, abaixoDoMinimo: true });
  });

  // Técnica: valor-limite acima da fronteira; CA1 — saldo maior que o mínimo não gera alerta.
  it('não marca alerta quando o saldo supera o mínimo', async () => {
    prisma.item.findUnique.mockResolvedValue({ id: 'item-1', nome: 'Luva', estoqueId: 'e1', nivelMinimo: 5 });
    prisma.movimentacao.groupBy.mockResolvedValue([{ tipo: 'ENTRADA', _sum: { quantidade: 6 } }]);
    await expect(service.consultarSaldoItem('item-1')).resolves.toMatchObject({ saldo: 6, abaixoDoMinimo: false });
  });

  // Técnica: partição inválida; CA1 — estoque inexistente não tem alertas consultáveis.
  it('informa estoque inexistente', async () => {
    prisma.estoque.findUnique.mockResolvedValue(null);
    await expect(service.consultarSaldoEstoque('ausente')).rejects.toBeInstanceOf(NotFoundException);
  });

  // Técnica: partição válida; CA1 — consulta do estoque devolve alerta individual por item.
  it('calcula alerta para cada item do estoque', async () => {
    prisma.estoque.findUnique.mockResolvedValue({ id: 'e1' });
    prisma.item.findMany.mockResolvedValue([
      { id: 'item-baixo', nome: 'Luva', nivelMinimo: 3 },
      { id: 'item-ok', nome: 'Máscara', nivelMinimo: 2 },
    ]);
    prisma.movimentacao.groupBy
      .mockResolvedValueOnce([{ tipo: 'ENTRADA', _sum: { quantidade: 2 } }])
      .mockResolvedValueOnce([{ tipo: 'ENTRADA', _sum: { quantidade: 3 } }]);

    await expect(service.consultarSaldoEstoque('e1')).resolves.toMatchObject({
      estoqueId: 'e1',
      itens: [
        { itemId: 'item-baixo', saldo: 2, nivelMinimo: 3, abaixoDoMinimo: true },
        { itemId: 'item-ok', saldo: 3, nivelMinimo: 2, abaixoDoMinimo: false },
      ],
    });
  });
});
