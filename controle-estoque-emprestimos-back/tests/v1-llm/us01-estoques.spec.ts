import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TipoMovimentacao } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../src/database/prisma.service';
import { CreateEstoqueSchema } from '../../src/modules/estoques/dto/create-estoque.dto';
import { UpdateEstoqueSchema } from '../../src/modules/estoques/dto/update-estoque.dto';
import { EstoquesService } from '../../src/modules/estoques/estoques.service';
import { MovimentacoesController } from '../../src/modules/movimentacoes/movimentacoes.controller';
import { MovimentacoesService } from '../../src/modules/movimentacoes/movimentacoes.service';

describe('US01 — Estoques e movimentações', () => {
  describe('schemas de estoque', () => {
    // Técnica: partição válida; CA1 — nome informado com espaços externos.
    it('normaliza o nome e mantém os campos opcionais', () => {
      expect(CreateEstoqueSchema.parse({ nome: '  Almoxarifado  ' })).toEqual({
        nome: 'Almoxarifado',
      });
    });

    // Técnica: partição inválida; CA1 — nome vazio após trim.
    it.each(['', '   '])('rejeita nome vazio %j', (nome) => {
      expect(() => CreateEstoqueSchema.parse({ nome })).toThrow();
    });

    // Técnica: partição válida; CA1 — atualização parcial não exige nome.
    it('aceita atualização sem campos', () => {
      expect(UpdateEstoqueSchema.parse({})).toEqual({});
    });
  });

  describe('EstoquesService', () => {
    let service: EstoquesService;
    let prisma: any;

    beforeEach(() => {
      prisma = {
        estoque: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
          findUnique: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
        },
      };
      service = new EstoquesService(prisma as PrismaService);
    });

    // Técnica: partição válida; CA1 — cadastro cria estoque ativo.
    it('cria estoque com ativo=true', async () => {
      const criado = { id: 'e1', nome: 'Lab', ativo: true };
      prisma.estoque.findFirst.mockResolvedValue(null);
      prisma.estoque.create.mockResolvedValue(criado);

      await expect(service.create({ nome: 'Lab' })).resolves.toEqual(criado);
      expect(prisma.estoque.create).toHaveBeenCalledWith({
        data: { nome: 'Lab', ativo: true },
      });
    });

    // Técnica: partição inválida; CA1 — nome duplicado ignora maiúsculas/minúsculas.
    it('recusa nome já cadastrado', async () => {
      prisma.estoque.findFirst.mockResolvedValue({ id: 'e1', nome: 'Lab' });

      await expect(service.create({ nome: 'lab' })).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.estoque.create).not.toHaveBeenCalled();
    });

    // Técnica: partição válida; CA1 — lista apenas ativos por padrão e calcula resumo.
    it('lista estoques ativos com contagem por status', async () => {
      prisma.estoque.findMany.mockResolvedValue([
        {
          id: 'e1',
          itens: [{ status: 'DISPONIVEL' }, { status: 'EMPRESTADO' }],
          gestores: [],
        },
      ]);

      await expect(service.findAll()).resolves.toMatchObject([
        { id: 'e1', saldo: { totalItens: 2, disponiveis: 1, emprestados: 1 } },
      ]);
      expect(prisma.estoque.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ativo: true } }),
      );
    });

    // Técnica: partição inválida; CA1 — ID inexistente.
    it('retorna não encontrado para estoque ausente', async () => {
      prisma.estoque.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    // Técnica: partição válida; CA1 — alteração de dados do estoque existente.
    it('atualiza estoque existente', async () => {
      prisma.estoque.findUnique.mockResolvedValue({ id: 'e1', itens: [], gestores: [] });
      prisma.estoque.findFirst.mockResolvedValue(null);
      prisma.estoque.update.mockResolvedValue({ id: 'e1', nome: 'Novo' });

      await expect(service.update('e1', { nome: 'Novo' })).resolves.toEqual({
        id: 'e1',
        nome: 'Novo',
      });
      expect(prisma.estoque.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { nome: 'Novo' },
      });
    });

    // Técnica: partição válida; CA1 — remoção lógica preserva o registro.
    it('desativa estoque em vez de apagar o registro', async () => {
      prisma.estoque.findUnique.mockResolvedValue({ id: 'e1', itens: [], gestores: [] });
      prisma.estoque.update.mockResolvedValue({ id: 'e1', ativo: false });

      await service.remove('e1');
      expect(prisma.estoque.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { ativo: false },
      });
    });
  });

  describe('MovimentacoesService', () => {
    let service: MovimentacoesService;
    let prisma: any;
    let tx: any;

    beforeEach(() => {
      tx = {
        item: { findUnique: vi.fn() },
        estoqueGestor: { findUnique: vi.fn() },
        movimentacao: { groupBy: vi.fn(), create: vi.fn() },
      };
      prisma = {
        item: { findUnique: vi.fn(), findMany: vi.fn() },
        estoque: { findUnique: vi.fn() },
        movimentacao: { groupBy: vi.fn(), findMany: vi.fn() },
        estoqueGestor: { findUnique: vi.fn() },
        $transaction: vi.fn((callback: (client: any) => Promise<unknown>) => callback(tx)),
      };
      service = new MovimentacoesService(prisma as PrismaService);
    });

    // Técnica: partição válida; CA1 — saldo soma entradas/devoluções e subtrai saídas.
    it('calcula saldo a partir dos grupos de movimentação', async () => {
      prisma.movimentacao.groupBy.mockResolvedValue([
        { tipo: TipoMovimentacao.ENTRADA, _sum: { quantidade: 5 } },
        { tipo: TipoMovimentacao.SAIDA, _sum: { quantidade: 2 } },
        { tipo: TipoMovimentacao.DEVOLUCAO, _sum: { quantidade: 1 } },
      ]);

      await expect(service.calcularSaldoItem('i1')).resolves.toBe(4);
    });

    // Técnica: valor-limite; CA1 — saldo igual ao nível mínimo aciona o alerta.
    it('marca saldo igual ao mínimo como abaixo do mínimo', async () => {
      prisma.item.findUnique.mockResolvedValue({
        id: 'i1', nome: 'Cabo', estoqueId: 'e1', nivelMinimo: 5,
      });
      prisma.movimentacao.groupBy.mockResolvedValue([
        { tipo: TipoMovimentacao.ENTRADA, _sum: { quantidade: 5 } },
      ]);

      await expect(service.consultarSaldoItem('i1')).resolves.toMatchObject({
        saldo: 5,
        abaixoDoMinimo: true,
      });
    });

    // Técnica: valores-limite; CA1 — testa um acima e um abaixo do limiar.
    it.each([
      { quantidade: 6, esperado: false },
      { quantidade: 4, esperado: true },
    ])('classifica saldo $quantidade em relação ao mínimo 5', async ({ quantidade, esperado }) => {
      prisma.item.findUnique.mockResolvedValue({
        id: 'i1', nome: 'Cabo', estoqueId: 'e1', nivelMinimo: 5,
      });
      prisma.movimentacao.groupBy.mockResolvedValue([
        { tipo: TipoMovimentacao.ENTRADA, _sum: { quantidade } },
      ]);

      await expect(service.consultarSaldoItem('i1')).resolves.toMatchObject({
        saldo: quantidade,
        abaixoDoMinimo: esperado,
      });
    });

    // Técnica: partição válida; CA1 — sem nível mínimo não há alerta.
    it('não alerta quando nível mínimo é nulo', async () => {
      prisma.item.findUnique.mockResolvedValue({
        id: 'i1', nome: 'Cabo', estoqueId: 'e1', nivelMinimo: null,
      });
      prisma.movimentacao.groupBy.mockResolvedValue([
        { tipo: TipoMovimentacao.ENTRADA, _sum: { quantidade: 0 } },
      ]);

      await expect(service.consultarSaldoItem('i1')).resolves.toMatchObject({
        saldo: 0,
        abaixoDoMinimo: false,
      });
    });

    // Técnica: partição inválida; CA1 — item inexistente.
    it('retorna não encontrado ao consultar saldo de item ausente', async () => {
      prisma.item.findUnique.mockResolvedValue(null);

      await expect(service.consultarSaldoItem('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    // Técnica: partição inválida e valor-limite inferior; CA1 — quantidade deve ser inteiro positivo.
    it.each([0, -1, 1.5])('rejeita quantidade inválida %s', async (quantidade) => {
      await expect(
        service.registrarMovimentacao(
          { itemId: 'i1', tipo: TipoMovimentacao.ENTRADA, quantidade },
          'u1',
          false,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    // Técnica: partição válida de papel; CA1 — ADMIN não registra movimentação.
    it('recusa registro por ADMIN', async () => {
      await expect(
        service.registrarMovimentacao(
          { itemId: 'i1', tipo: TipoMovimentacao.ENTRADA, quantidade: 1 },
          'admin',
          true,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    // Técnica: partição inválida de acesso; CA1 — só gestor vinculado ao estoque movimenta.
    it('recusa usuário sem vínculo de gestor', async () => {
      tx.item.findUnique.mockResolvedValue({ id: 'i1', estoqueId: 'e1', nivelMinimo: 0 });
      tx.estoqueGestor.findUnique.mockResolvedValue(null);

      await expect(
        service.registrarMovimentacao(
          { itemId: 'i1', tipo: TipoMovimentacao.ENTRADA, quantidade: 1 },
          'u1',
          false,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(tx.movimentacao.create).not.toHaveBeenCalled();
    });

    // Técnica: valor-limite; CA1 — saída que excede saldo é recusada.
    it('recusa saída maior que o saldo disponível', async () => {
      tx.item.findUnique.mockResolvedValue({ id: 'i1', estoqueId: 'e1', nivelMinimo: 0 });
      tx.estoqueGestor.findUnique.mockResolvedValue({ estoqueId: 'e1', usuarioId: 'u1' });
      tx.movimentacao.groupBy.mockResolvedValue([
        { tipo: TipoMovimentacao.ENTRADA, _sum: { quantidade: 2 } },
      ]);

      await expect(
        service.registrarMovimentacao(
          { itemId: 'i1', tipo: TipoMovimentacao.SAIDA, quantidade: 3 },
          'u1',
          false,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    // Técnica: partição válida; CA1 — registro retorna novo saldo e estado do alerta.
    it('registra entrada e informa saldo após a operação', async () => {
      tx.item.findUnique.mockResolvedValue({ id: 'i1', estoqueId: 'e1', nivelMinimo: 2 });
      tx.estoqueGestor.findUnique.mockResolvedValue({ estoqueId: 'e1', usuarioId: 'u1' });
      tx.movimentacao.groupBy.mockResolvedValue([
        { tipo: TipoMovimentacao.ENTRADA, _sum: { quantidade: 1 } },
      ]);
      tx.movimentacao.create.mockResolvedValue({ id: 'm1' });

      await expect(
        service.registrarMovimentacao(
          { itemId: 'i1', tipo: TipoMovimentacao.ENTRADA, quantidade: 1 },
          'u1',
          false,
        ),
      ).resolves.toMatchObject({ saldoAtual: 2, abaixoDoMinimo: true });
    });
  });

  describe('MovimentacoesController', () => {
    // Técnica: partição válida; CA1 — contexto do usuário é delegado ao serviço.
    it('encaminha a movimentação com userId e papel de ADMIN', async () => {
      const service = { registrarMovimentacao: vi.fn().mockResolvedValue({ id: 'm1' }) };
      const controller = new MovimentacoesController(service as any);

      await expect(
        controller.registrar(
          { itemId: 'i1', tipo: TipoMovimentacao.ENTRADA, quantidade: 1 },
          { userId: 'u1', role: 'ADMIN' } as any,
        ),
      ).resolves.toEqual({ id: 'm1' });
      expect(service.registrarMovimentacao).toHaveBeenCalledWith(
        { itemId: 'i1', tipo: TipoMovimentacao.ENTRADA, quantidade: 1 },
        'u1',
        true,
      );
    });
  });
});
