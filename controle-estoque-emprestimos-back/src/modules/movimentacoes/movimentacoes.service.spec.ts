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
      mockPrisma.movimentacao.create.mockResolvedValue({ id: 'mov-4' });
      mockPrisma.$transaction.mockRejectedValueOnce({ code: 'P2034' });

      const resultado = await service.registrarMovimentacao(
        { itemId: 'item-1', tipo: TipoMovimentacao.SAIDA, quantidade: 1 },
        'gestor-1',
        false,
      );

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
      expect(resultado.saldoAtual).toBe(4);
    });

    it('lança ConflictException quando esgota as tentativas', async () => {
      mockPrisma.$transaction.mockRejectedValue({ code: 'P2034' });

      await expect(
        service.registrarMovimentacao(
          { itemId: 'item-1', tipo: TipoMovimentacao.SAIDA, quantidade: 1 },
          'gestor-1',
          false,
        ),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(3);
    });
  });

  describe('calcularSaldoItem', () => {
    it('calcula saldo com entradas, devoluções, saídas e manutenção', async () => {
      mockPrisma.movimentacao.groupBy.mockResolvedValue(
        gruposPorTipo(
          [TipoMovimentacao.ENTRADA, 10],
          [TipoMovimentacao.DEVOLUCAO, 2],
          [TipoMovimentacao.SAIDA, 3],
          [TipoMovimentacao.MANUTENCAO, 1],
        ),
      );

      await expect(service.calcularSaldoItem('item-1')).resolves.toBe(8);
    });

    it('retorna 0 quando não há movimentações', async () => {
      mockPrisma.movimentacao.groupBy.mockResolvedValue([]);
      await expect(service.calcularSaldoItem('item-1')).resolves.toBe(0);
    });
  });

  describe('consultarSaldoItem', () => {
    it('abaixoDoMinimo verdadeiro quando saldo <= nivelMinimo', async () => {
      mockPrisma.item.findUnique.mockResolvedValue({ ...itemBase, nivelMinimo: 3 });
      mockPrisma.movimentacao.groupBy.mockResolvedValue(
        gruposPorTipo([TipoMovimentacao.ENTRADA, 3]),
      );

      const resultado = await service.consultarSaldoItem('item-1');
      expect(resultado.abaixoDoMinimo).toBe(true);
    });

    it('abaixoDoMinimo falso quando saldo > nivelMinimo (volta a falso após reposição)', async () => {
      mockPrisma.item.findUnique.mockResolvedValue({ ...itemBase, nivelMinimo: 3 });
      comoGestor();
      mockPrisma.movimentacao.groupBy.mockResolvedValue(
        gruposPorTipo([TipoMovimentacao.ENTRADA, 2], [TipoMovimentacao.ENTRADA, 3]),
      );

      const resultado = await service.consultarSaldoItem('item-1');
      expect(resultado.saldo).toBe(5);
      expect(resultado.abaixoDoMinimo).toBe(false);
    });

    it('sem nível mínimo, abaixoDoMinimo nunca é verdadeiro', async () => {
      mockPrisma.item.findUnique.mockResolvedValue(itemBase);
      comoGestor();
      mockPrisma.movimentacao.groupBy.mockResolvedValue([]);

      const resultado = await service.consultarSaldoItem('item-1');
      expect(resultado.abaixoDoMinimo).toBe(false);
    });

    it('permite consulta sem vínculo de gestor', async () => {
      mockPrisma.item.findUnique.mockResolvedValue(itemBase);
      comoNaoGestor();
      mockPrisma.movimentacao.groupBy.mockResolvedValue([]);

      await expect(service.consultarSaldoItem('item-1')).resolves.toBeDefined();
    });

    it('retorna 404 para item inexistente', async () => {
      mockPrisma.item.findUnique.mockResolvedValue(null);

      await expect(service.consultarSaldoItem('nao-existe')).rejects.toThrow(NotFoundException);
    });
  });

  describe('consultarSaldoEstoque', () => {
    it('retorna o saldo de cada item do estoque com a flag abaixoDoMinimo', async () => {
      comoGestor();
      mockPrisma.item.findMany.mockResolvedValue([
        { id: 'item-1', nome: 'Cabo', nivelMinimo: 5 },
        { id: 'item-2', nome: 'Mouse', nivelMinimo: null },
        { id: 'item-3', nome: 'Teclado', nivelMinimo: 2 },
      ]);
      mockPrisma.movimentacao.groupBy.mockResolvedValue([
        { itemId: 'item-1', tipo: TipoMovimentacao.ENTRADA, _sum: { quantidade: 10 } },
        { itemId: 'item-1', tipo: TipoMovimentacao.SAIDA, _sum: { quantidade: 6 } },
        { itemId: 'item-2', tipo: TipoMovimentacao.ENTRADA, _sum: { quantidade: 1 } },
      ]);

      const resultado = await service.consultarSaldoEstoque('estoque-1');

      expect(resultado.itens).toEqual([
        { itemId: 'item-1', nomeItem: 'Cabo', saldo: 4, nivelMinimo: 5, abaixoDoMinimo: true },
        { itemId: 'item-2', nomeItem: 'Mouse', saldo: 1, nivelMinimo: null, abaixoDoMinimo: false },
        { itemId: 'item-3', nomeItem: 'Teclado', saldo: 0, nivelMinimo: 2, abaixoDoMinimo: true },
      ]);
    });

    it('permite consulta do saldo do estoque sem vínculo de gestor', async () => {
      mockPrisma.item.findMany.mockResolvedValue([]);
      mockPrisma.movimentacao.groupBy.mockResolvedValue([]);

      await expect(service.consultarSaldoEstoque('estoque-1')).resolves.toEqual({
        estoqueId: 'estoque-1',
        itens: [],
      });
    });
  });

  describe('consultarHistoricoEstoque', () => {
    it('retorna o histórico da mais recente para a mais antiga', async () => {
      comoGestor();
      mockPrisma.movimentacao.findMany.mockResolvedValue([]);

      await service.consultarHistoricoEstoque('estoque-1', 'gestor-1', false);

      expect(mockPrisma.movimentacao.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { item: { estoqueId: 'estoque-1' } },
          orderBy: { dataMovimentacao: 'desc' },
        }),
      );
    });

    it('nega acesso a quem não é gestor nem ADMIN (403)', async () => {
      comoNaoGestor();

      await expect(
        service.consultarHistoricoEstoque('estoque-1', 'outro-usuario', false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite ao ADMIN consultar o histórico', async () => {
      mockPrisma.movimentacao.findMany.mockResolvedValue([]);

      await expect(
        service.consultarHistoricoEstoque('estoque-1', 'admin-1', true),
      ).resolves.toEqual([]);
    });
  });
});
