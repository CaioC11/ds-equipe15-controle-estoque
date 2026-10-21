import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TipoMovimentacao } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { MovimentacoesService } from './movimentacoes.service';

describe('MovimentacoesService', () => {
  let service: MovimentacoesService;

  const mockPrisma = {
    $transaction: vi.fn(),
    estoque: { findUnique: vi.fn() },
    estoqueGestor: { findUnique: vi.fn() },
    item: { findUnique: vi.fn(), findMany: vi.fn() },
    movimentacao: { groupBy: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  };

  /** Simula o resultado do groupBy por tipo. */
  const gruposPorTipo = (...itens: Array<[TipoMovimentacao, number]>) =>
    itens.map(([tipo, quantidade]) => ({ tipo, _sum: { quantidade } }));

  const itemBase = { id: 'item-1', nome: 'Notebook', estoqueId: 'estoque-1', nivelMinimo: null };

  const comoGestor = () =>
    mockPrisma.estoqueGestor.findUnique.mockResolvedValue({
      estoqueId: 'estoque-1',
      usuarioId: 'gestor-1',
    });

  const comoNaoGestor = () => mockPrisma.estoqueGestor.findUnique.mockResolvedValue(null);

  beforeEach(async () => {
    vi.resetAllMocks();
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb(mockPrisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [MovimentacoesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(MovimentacoesService);
  });

  describe('registrarMovimentacao', () => {
    it('rejeita saída maior que o saldo e não grava nada', async () => {
      mockPrisma.item.findUnique.mockResolvedValue(itemBase);
      comoGestor();
      mockPrisma.movimentacao.groupBy.mockResolvedValue(
        gruposPorTipo([TipoMovimentacao.ENTRADA, 5]),
      );

      await expect(
        service.registrarMovimentacao(
          { itemId: 'item-1', tipo: TipoMovimentacao.SAIDA, quantidade: 10 },
          'gestor-1',
          false,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.movimentacao.create).not.toHaveBeenCalled();
    });

    it.each([
      TipoMovimentacao.TRANSFERENCIA,
      TipoMovimentacao.MANUTENCAO,
    ])('rejeita %s maior que o saldo', async (tipo) => {
      mockPrisma.item.findUnique.mockResolvedValue(itemBase);
      comoGestor();
      mockPrisma.movimentacao.groupBy.mockResolvedValue(
        gruposPorTipo([TipoMovimentacao.ENTRADA, 2]),
      );

      await expect(
        service.registrarMovimentacao({ itemId: 'item-1', tipo, quantidade: 3 }, 'gestor-1', false),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.movimentacao.create).not.toHaveBeenCalled();
    });

    it('registra entrada e retorna o novo saldo', async () => {
      mockPrisma.item.findUnique.mockResolvedValue(itemBase);
      comoGestor();
      mockPrisma.movimentacao.groupBy.mockResolvedValue(
        gruposPorTipo([TipoMovimentacao.ENTRADA, 5]),
      );
      mockPrisma.movimentacao.create.mockResolvedValue({ id: 'mov-1' });

      const resultado = await service.registrarMovimentacao(
        { itemId: 'item-1', tipo: TipoMovimentacao.ENTRADA, quantidade: 4, observacao: 'compra' },
        'gestor-1',
        false,
      );

      expect(mockPrisma.movimentacao.create).toHaveBeenCalledWith({
        data: {
          itemId: 'item-1',
          tipo: TipoMovimentacao.ENTRADA,
          quantidade: 4,
          observacao: 'compra',
          usuarioId: 'gestor-1',
        },
      });
      expect(resultado.saldoAtual).toBe(9);
      expect(resultado.abaixoDoMinimo).toBe(false);
    });

    it('registra saída válida e sinaliza abaixoDoMinimo', async () => {
      mockPrisma.item.findUnique.mockResolvedValue({ ...itemBase, nivelMinimo: 3 });
      comoGestor();
      mockPrisma.movimentacao.groupBy.mockResolvedValue(
        gruposPorTipo([TipoMovimentacao.ENTRADA, 5]),
      );
      mockPrisma.movimentacao.create.mockResolvedValue({ id: 'mov-2' });

      const resultado = await service.registrarMovimentacao(
        { itemId: 'item-1', tipo: TipoMovimentacao.SAIDA, quantidade: 2 },
        'gestor-1',
        false,
      );

      expect(resultado.saldoAtual).toBe(3);
      expect(resultado.abaixoDoMinimo).toBe(true);
    });

    it('permite sair exatamente o saldo disponível (saldo zerado)', async () => {
      mockPrisma.item.findUnique.mockResolvedValue(itemBase);
      comoGestor();
      mockPrisma.movimentacao.groupBy.mockResolvedValue(
        gruposPorTipo([TipoMovimentacao.ENTRADA, 5]),
      );
      mockPrisma.movimentacao.create.mockResolvedValue({ id: 'mov-3' });

      const resultado = await service.registrarMovimentacao(
        { itemId: 'item-1', tipo: TipoMovimentacao.SAIDA, quantidade: 5 },
        'gestor-1',
        false,
      );

      expect(resultado.saldoAtual).toBe(0);
    });

    it('proíbe ADMIN de registrar movimentação (403)', async () => {
      await expect(
        service.registrarMovimentacao(
          { itemId: 'item-1', tipo: TipoMovimentacao.ENTRADA, quantidade: 5 },
          'admin-1',
          true,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('proíbe usuário que não é gestor do estoque (403)', async () => {
      mockPrisma.item.findUnique.mockResolvedValue(itemBase);
      comoNaoGestor();

      await expect(
        service.registrarMovimentacao(
          { itemId: 'item-1', tipo: TipoMovimentacao.ENTRADA, quantidade: 5 },
          'outro-usuario',
          false,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.movimentacao.create).not.toHaveBeenCalled();
    });

    it('retorna 404 para item inexistente', async () => {
      mockPrisma.item.findUnique.mockResolvedValue(null);

      await expect(
        service.registrarMovimentacao(
          { itemId: 'nao-existe', tipo: TipoMovimentacao.ENTRADA, quantidade: 1 },
          'gestor-1',
          false,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it.each([0, -3, 1.5])('rejeita quantidade inválida (%s)', async (quantidade) => {
      await expect(
        service.registrarMovimentacao(
          { itemId: 'item-1', tipo: TipoMovimentacao.ENTRADA, quantidade },
          'gestor-1',
          false,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('tenta novamente em caso de conflito de serialização (P2034)', async () => {
      mockPrisma.item.findUnique.mockResolvedValue(itemBase);
      comoGestor();
      mockPrisma.movimentacao.groupBy.mockResolvedValue(
        gruposPorTipo([TipoMovimentacao.ENTRADA, 5]),
      );
