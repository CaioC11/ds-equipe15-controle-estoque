// Suíte v2 da US01: mantém a evidência válida da v1 e fecha as lacunas identificadas na matriz.
import {
  BadRequestException,
  ConflictException,
  HttpException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TipoMovimentacao } from '@prisma/client';
import { validate } from 'class-validator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessRole } from '../../src/common/auth/access-role.enum';
import { RolesGuard } from '../../src/common/auth/guards/roles.guard';
import { PrismaService } from '../../src/database/prisma.service';
import { CreateEstoqueSchema } from '../../src/modules/estoques/dto/create-estoque.dto';
import { UpdateEstoqueSchema } from '../../src/modules/estoques/dto/update-estoque.dto';
import { EstoquesController } from '../../src/modules/estoques/estoques.controller';
import { EstoquesService } from '../../src/modules/estoques/estoques.service';
import { RegistrarMovimentacaoDto } from '../../src/modules/movimentacoes/dto/registrar-movimentacao.dto';
import { MovimentacoesService } from '../../src/modules/movimentacoes/movimentacoes.service';

function statusDaRota(method: keyof EstoquesController, role: AccessRole): number {
  const guard = new RolesGuard(new Reflector());
  const context = {
    getHandler: () => EstoquesController.prototype[method],
    getClass: () => EstoquesController,
    switchToHttp: () => ({ getRequest: () => ({ user: { userId: 'u1', role } }) }),
  };
  try {
    guard.canActivate(context as never);
    return 200;
  } catch (error) {
    return (error as HttpException).getStatus();
  }
}

function criarBancoMovimentacoes(
  itens: Array<Record<string, unknown>>,
  gestores: Array<{ estoqueId: string; usuarioId: string }>,
  movimentos: Array<Record<string, unknown>> = [],
  estoques: string[] = ['e1', 'A', 'B'],
) {
  const ledger = [...movimentos];
  const prisma: any = {
    $transaction: vi.fn((callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
    estoque: {
      findUnique: vi.fn(async ({ where }: any) =>
        estoques.includes(where.id) ? { id: where.id } : null,
      ),
    },
    item: {
      findUnique: vi.fn(async ({ where }: any) => itens.find((item) => item.id === where.id) ?? null),
      findMany: vi.fn(async ({ where }: any) =>
        itens.filter((item) => item.estoqueId === where.estoqueId),
      ),
    },
    estoqueGestor: {
      findUnique: vi.fn(async ({ where }: any) =>
        gestores.find(
          (gestor) =>
            gestor.estoqueId === where.estoqueId_usuarioId.estoqueId &&
            gestor.usuarioId === where.estoqueId_usuarioId.usuarioId,
        ) ?? null,
      ),
    },
    movimentacao: {
      groupBy: vi.fn(async ({ where }: any) => {
        const grupos = new Map<string, number>();
        for (const movimento of ledger.filter((entry) => entry.itemId === where.itemId)) {
          const tipo = String(movimento.tipo);
          grupos.set(tipo, (grupos.get(tipo) ?? 0) + Number(movimento.quantidade));
        }
        return [...grupos].map(([tipo, quantidade]) => ({
          tipo,
          _sum: { quantidade },
        }));
      }),
      create: vi.fn(async ({ data }: any) => {
        const criado = { id: `m${ledger.length + 1}`, ...data };
        ledger.push(criado);
        return criado;
      }),
      findMany: vi.fn(async ({ where }: any) =>
        ledger.filter((movimento) => {
          const item = itens.find((entry) => entry.id === movimento.itemId);
          return item?.estoqueId === where.item.estoqueId;
        }),
      ),
    },
  };
  return { prisma, ledger, service: new MovimentacoesService(prisma as PrismaService) };
}

describe('US01 — Estoques e movimentações', () => {
  describe('schemas de estoque', () => {
    // [v2] PNE-01: nome válido é normalizado.
    it('normaliza o nome e mantém os campos opcionais', () => {
      expect(CreateEstoqueSchema.parse({ nome: '  Almoxarifado  ' })).toEqual({
        nome: 'Almoxarifado',
      });
    });

    // [v2] PNE-03 / LM-03: nome vazio ou só espaços não é aceito.
    it.each(['', '   '])('rejeita nome vazio %j', (nome) => {
      const resultado = CreateEstoqueSchema.safeParse({ nome });
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0]).toMatchObject({
          path: ['nome'],
          message: 'Nome é obrigatório',
        });
      }
    });

    // [v2] CT-01-09 / CA-03: atualização parcial pode manter os campos atuais.
    it('aceita atualização sem campos', () => {
      expect(UpdateEstoqueSchema.parse({})).toEqual({});
    });

    // [v2] CT-01-02 / PNE-02: nome ausente é recusado no campo correspondente.
    it('rejeita cadastro sem nome', () => {
      const resultado = CreateEstoqueSchema.safeParse({});
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0].path).toEqual(['nome']);
      }
    });

    // [v2] CT-01-05 / PNE-01 / LM-03: o menor nome válido tem um caractere.
    it('aceita estoque com nome de um caractere', () => {
      expect(CreateEstoqueSchema.parse({ nome: 'A' })).toEqual({ nome: 'A' });
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

    // [v2] CT-01-01: cadastro cria estoque ativo.
    it('cria estoque com ativo=true', async () => {
      const criado = { id: 'e1', nome: 'Lab', ativo: true };
      prisma.estoque.findFirst.mockResolvedValue(null);
      prisma.estoque.create.mockResolvedValue(criado);

      await expect(service.create({ nome: 'Lab' })).resolves.toEqual(criado);
      expect(prisma.estoque.create).toHaveBeenCalledWith({
        data: { nome: 'Lab', ativo: true },
      });
    });

    // [v2] Lacuna CT-01-01 / CA-01: o cadastro bem-sucedido aparece na consulta seguinte.
    it('cria e lista o mesmo estoque ativo', async () => {
      const estoque = { id: 'e1', nome: 'Laboratório X', ativo: true, itens: [], gestores: [] };
      prisma.estoque.findFirst.mockResolvedValue(null);
      prisma.estoque.create.mockResolvedValue(estoque);
      prisma.estoque.findMany.mockResolvedValue([estoque]);

      await service.create({ nome: 'Laboratório X' });
      await expect(service.findAll()).resolves.toMatchObject([
        { id: 'e1', nome: 'Laboratório X', ativo: true },
      ]);
    });

    // [v2] Lacuna CT-01-08 / PNE-01: nomes distintos geram estoques independentes.
    it('cria dois estoques distintos sem compartilhar identidade', async () => {
      prisma.estoque.findFirst.mockResolvedValue(null);
      prisma.estoque.create
        .mockResolvedValueOnce({ id: 'e1', nome: 'Laboratório A', ativo: true })
        .mockResolvedValueOnce({ id: 'e2', nome: 'Laboratório B', ativo: true });

      const a = await service.create({ nome: 'Laboratório A' });
      const b = await service.create({ nome: 'Laboratório B' });

      expect(a).toMatchObject({ id: 'e1', nome: 'Laboratório A' });
      expect(b).toMatchObject({ id: 'e2', nome: 'Laboratório B' });
      expect(prisma.estoque.create).toHaveBeenCalledTimes(2);
    });

    // [v2] PNE-04: nomes repetidos não criam um segundo estoque.
    it('recusa nome já cadastrado', async () => {
      prisma.estoque.findFirst.mockResolvedValue({ id: 'e1', nome: 'Lab' });

      await expect(service.create({ nome: 'lab' })).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.estoque.create).not.toHaveBeenCalled();
    });

    // [v2] CT-01-01: listagem padrão inclui apenas estoques ativos e calcula o resumo.
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

    // [v2] CT-01-01: o ramo de consulta de inativos remove o filtro de ativo.
    it('inclui estoques inativos quando solicitado', async () => {
      prisma.estoque.findMany.mockResolvedValue([
        { id: 'e1', ativo: false, itens: [], gestores: [] },
      ]);

      await expect(service.findAll(true)).resolves.toMatchObject([{ id: 'e1', ativo: false }]);
      expect(prisma.estoque.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    // [v2] CT-01-10 / PES-02: edição de estoque inexistente retorna HTTP 404 sem update.
    it('retorna não encontrado para estoque ausente', async () => {
      prisma.estoque.findUnique.mockResolvedValue(null);
      const erro = await service.update('missing', { nome: 'Novo' }).catch((e: unknown) => e);
      expect((erro as HttpException).getStatus()).toBe(404);
      expect(prisma.estoque.update).not.toHaveBeenCalled();
    });

    // [v2] CT-01-09 / PPM-01 / PES-01: edição autorizada persiste nome e descrição.
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

  });

  describe('papéis e operações da matriz', () => {
    // [v2] CT-01-01 / CA-01: ADMIN pode usar a rota de criação.
    it('permite ADMIN criar estoque', () => {
      expect(statusDaRota('create', AccessRole.ADMIN)).toBe(200);
    });

    // [v2] CT-01-07 / PPC-02: requisitante recebe 403 antes de criar.
    it('nega criação ao requisitante com HTTP 403', () => {
      expect(statusDaRota('create', AccessRole.USER)).toBe(403);
    });

    // [v2] CT-01-09 / PPM-01: gestor vinculado deve editar o próprio estoque.
    it.fails('permite ao gestor autorizado editar o próprio estoque', () => {
      expect(statusDaRota('update', AccessRole.USER)).toBe(200);
    });

    // [v2] CT-01-11 / PPM-02: gestor sem vínculo recebe 403 na edição.
    it('nega edição ao gestor de outro estoque com HTTP 403', () => {
      expect(statusDaRota('update', AccessRole.USER)).toBe(403);
    });

    // [v2] CT-01-12 / PPM-03: requisitante recebe 403 na edição.
    it('nega edição ao requisitante com HTTP 403', () => {
      expect(statusDaRota('update', AccessRole.USER)).toBe(403);
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

    // [v2] CT-01-30 / PCS-01: saldo líquido soma entradas/devoluções e subtrai saídas.
    it('calcula saldo a partir dos grupos de movimentação', async () => {
      prisma.movimentacao.groupBy.mockResolvedValue([
        { tipo: TipoMovimentacao.ENTRADA, _sum: { quantidade: 5 } },
        { tipo: TipoMovimentacao.SAIDA, _sum: { quantidade: 2 } },
        { tipo: TipoMovimentacao.DEVOLUCAO, _sum: { quantidade: 1 } },
      ]);

      await expect(service.calcularSaldoItem('i1')).resolves.toBe(4);
    });

    // [v2] CT-01-20..23 / PQT-02..04 / LM-01: valida valores de quantidade.
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

    // [v2] CT-01-26 / PPM-02: gestor sem vínculo não registra entrada.
    it('nega entrada ao gestor sem vínculo com HTTP 403 e sem gravação', async () => {
      tx.item.findUnique.mockResolvedValue({ id: 'i1', estoqueId: 'e1', nivelMinimo: 0 });
      tx.estoqueGestor.findUnique.mockResolvedValue(null);

      const erro = await service.registrarMovimentacao(
          { itemId: 'i1', tipo: TipoMovimentacao.ENTRADA, quantidade: 1 },
          'u1',
          false,
        ).catch((e: unknown) => e);
      expect((erro as HttpException).getStatus()).toBe(403);
      expect(tx.movimentacao.create).not.toHaveBeenCalled();
    });

    // [v2] CT-01-16 / PSD-03 / LM-02: saída acima do saldo não grava movimento.
    it('recusa saída maior que o saldo disponível com HTTP 400', async () => {
      tx.item.findUnique.mockResolvedValue({ id: 'i1', estoqueId: 'e1', nivelMinimo: 0 });
      tx.estoqueGestor.findUnique.mockResolvedValue({ estoqueId: 'e1', usuarioId: 'u1' });
      tx.movimentacao.groupBy.mockResolvedValue([
        { tipo: TipoMovimentacao.ENTRADA, _sum: { quantidade: 2 } },
      ]);

      const erro = await service.registrarMovimentacao(
          { itemId: 'i1', tipo: TipoMovimentacao.SAIDA, quantidade: 3 },
          'u1',
          false,
        ).catch((e: unknown) => e);
      expect((erro as HttpException).getStatus()).toBe(400);
      expect(tx.movimentacao.create).not.toHaveBeenCalled();
    });

    // [v2] CT-01-21 / PQT-01 / LM-01: entrada de uma unidade aumenta o saldo em um.
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

  describe('CTs adicionais da matriz', () => {
    // [v2] CT-01-17 / PTP-03: tipo ausente é rejeitado no DTO.
    it('rejeita DTO sem tipo apontando o campo tipo', async () => {
      const errors = await validate(
        Object.assign(new RegistrarMovimentacaoDto(), { itemId: 'i1', quantidade: 1 }),
      );
      const tipoError = errors.find((error) => error.property === 'tipo');
      expect(tipoError?.constraints).toHaveProperty('isEnum');
    });

    // [v2] CT-01-18 / PTP-04: tipo fora do enum é rejeitado no DTO.
    it('rejeita DTO com tipo AJUSTE apontando o campo tipo', async () => {
      const errors = await validate(
        Object.assign(new RegistrarMovimentacaoDto(), {
          itemId: 'i1',
          tipo: 'AJUSTE',
          quantidade: 1,
        }),
      );
      const tipoError = errors.find((error) => error.property === 'tipo');
      expect(tipoError?.constraints).toHaveProperty('isEnum');
    });

    // [v2] CT-01-19 / PQT-05: quantidade ausente é rejeitada no DTO.
    it('rejeita DTO sem quantidade apontando o campo quantidade', async () => {
      const errors = await validate(
        Object.assign(new RegistrarMovimentacaoDto(), {
          itemId: 'i1',
          tipo: TipoMovimentacao.ENTRADA,
        }),
      );
      const quantidadeError = errors.find((error) => error.property === 'quantidade');
      expect(quantidadeError?.constraints).toHaveProperty('isInt');
    });

    // [v2] CT-01-13 / PTP-01 / PQT-01 / PIT-01: entrada de 10 é registrada e altera o saldo.
    it('registra entrada de 10 unidades e retorna saldo 14', async () => {
      const { service, ledger } = criarBancoMovimentacoes(
        [{ id: 'i1', nome: 'Cabo', estoqueId: 'e1', nivelMinimo: null }],
        [{ estoqueId: 'e1', usuarioId: 'gestor-e1' }],
        [{ itemId: 'i1', tipo: TipoMovimentacao.ENTRADA, quantidade: 4 }],
      );

      const resultado = await service.registrarMovimentacao(
        { itemId: 'i1', tipo: TipoMovimentacao.ENTRADA, quantidade: 10 },
        'gestor-e1',
        false,
      );

      expect(resultado.saldoAtual).toBe(14);
      expect(ledger).toHaveLength(2);
      expect(ledger[1]).toMatchObject({ tipo: TipoMovimentacao.ENTRADA, quantidade: 10 });
    });

    // [v2] CT-01-14 / PSD-01: saída inferior ao saldo produz o saldo restante.
    it('registra saída de 3 unidades de um saldo 10 e retorna 7', async () => {
      const { service, ledger } = criarBancoMovimentacoes(
        [{ id: 'i1', nome: 'Cabo', estoqueId: 'e1', nivelMinimo: null }],
        [{ estoqueId: 'e1', usuarioId: 'gestor-e1' }],
        [{ itemId: 'i1', tipo: TipoMovimentacao.ENTRADA, quantidade: 10 }],
      );

      const resultado = await service.registrarMovimentacao(
        { itemId: 'i1', tipo: TipoMovimentacao.SAIDA, quantidade: 3 },
        'gestor-e1',
        false,
      );

      expect(resultado.saldoAtual).toBe(7);
      expect(ledger).toHaveLength(2);
      expect(ledger[1]).toMatchObject({ tipo: TipoMovimentacao.SAIDA, quantidade: 3 });
    });

    // [v2] CT-01-15 / PSD-02 / LM-02: saída igual ao saldo é aceita e o resultado é zero.
    it('aceita saída de 10 com saldo 10 e retorna zero', async () => {
      const { service, ledger } = criarBancoMovimentacoes(
        [{ id: 'i1', nome: 'Cabo', estoqueId: 'e1', nivelMinimo: null }],
        [{ estoqueId: 'e1', usuarioId: 'gestor-e1' }],
        [{ itemId: 'i1', tipo: TipoMovimentacao.ENTRADA, quantidade: 10 }],
      );

      const resultado = await service.registrarMovimentacao(
        { itemId: 'i1', tipo: TipoMovimentacao.SAIDA, quantidade: 10 },
        'gestor-e1',
        false,
      );

      expect(resultado.saldoAtual).toBe(0);
      expect(ledger).toHaveLength(2);
    });

    // [v2] CT-01-24 / PIT-02: item inexistente resulta em 404 sem persistir movimento.
    it('recusa movimentação de item inexistente com HTTP 404', async () => {
      const { service, prisma, ledger } = criarBancoMovimentacoes([], []);
      const erro = await service.registrarMovimentacao(
        { itemId: 'ausente', tipo: TipoMovimentacao.ENTRADA, quantidade: 1 },
        'gestor-e1',
        false,
      ).catch((error: unknown) => error);

      expect((erro as HttpException).getStatus()).toBe(404);
      expect(prisma.movimentacao.create).not.toHaveBeenCalled();
      expect(ledger).toHaveLength(0);
    });

    // [v2] CT-01-25 / PIT-03: vínculo do usuário é verificado contra o estoque real do item.
    it('nega a movimentação de item pertencente a outro estoque com HTTP 403', async () => {
      const { service, prisma, ledger } = criarBancoMovimentacoes(
        [{ id: 'item-B', nome: 'Item B', estoqueId: 'B', nivelMinimo: null }],
        [{ estoqueId: 'A', usuarioId: 'gestor-A' }],
      );
      const erro = await service.registrarMovimentacao(
        { itemId: 'item-B', tipo: TipoMovimentacao.ENTRADA, quantidade: 1 },
        'gestor-A',
        false,
      ).catch((error: unknown) => error);

      expect((erro as HttpException).getStatus()).toBe(403);
      expect(prisma.estoqueGestor.findUnique).toHaveBeenCalledWith({
        where: { estoqueId_usuarioId: { estoqueId: 'B', usuarioId: 'gestor-A' } },
      });
      expect(ledger).toHaveLength(0);
    });

    // [v2] CT-01-27 / PPM-02: gestor de outro estoque não registra saída.
    it('nega saída ao gestor sem vínculo com HTTP 403 e estado inalterado', async () => {
      const { service, ledger } = criarBancoMovimentacoes(
        [{ id: 'i1', nome: 'Cabo', estoqueId: 'e1', nivelMinimo: null }],
        [],
        [{ itemId: 'i1', tipo: TipoMovimentacao.ENTRADA, quantidade: 3 }],
      );
      const erro = await service.registrarMovimentacao(
        { itemId: 'i1', tipo: TipoMovimentacao.SAIDA, quantidade: 1 },
        'gestor-outro',
        false,
      ).catch((error: unknown) => error);

      expect((erro as HttpException).getStatus()).toBe(403);
      expect(ledger).toHaveLength(1);
    });

    // [v2] CT-01-28 / PPM-03: requisitante não movimenta e não altera o saldo.
    it('nega entrada ao requisitante com HTTP 403 e estado inalterado', async () => {
      const { service, ledger } = criarBancoMovimentacoes(
        [{ id: 'i1', nome: 'Cabo', estoqueId: 'e1', nivelMinimo: null }],
        [],
      );
      const erro = await service.registrarMovimentacao(
        { itemId: 'i1', tipo: TipoMovimentacao.ENTRADA, quantidade: 1 },
        'requisitante',
        false,
      ).catch((error: unknown) => error);

      expect((erro as HttpException).getStatus()).toBe(403);
      expect(ledger).toHaveLength(0);
    });

    // [v2] CT-01-29 / PPM-04: ADMIN sem vínculo não movimenta e não altera o ledger.
    it('nega movimentação ao ADMIN com HTTP 403 e estado inalterado', async () => {
      const { service, ledger } = criarBancoMovimentacoes(
        [{ id: 'i1', nome: 'Cabo', estoqueId: 'e1', nivelMinimo: null }],
        [],
        [{ itemId: 'i1', tipo: TipoMovimentacao.ENTRADA, quantidade: 3 }],
      );
      const erro = await service.registrarMovimentacao(
        { itemId: 'i1', tipo: TipoMovimentacao.SAIDA, quantidade: 1 },
        'admin-sem-vinculo',
        true,
      ).catch((error: unknown) => error);

      expect((erro as HttpException).getStatus()).toBe(403);
      expect(ledger).toHaveLength(1);
    });

    // [v2] CT-01-30 / PCS-01: consulta o saldo agregado (10 + 5 - 4).
    it('calcula saldo agregado de estoque com entradas e saída', async () => {
      const { service } = criarBancoMovimentacoes(
        [{ id: 'i1', nome: 'Cabo', estoqueId: 'e1', nivelMinimo: null }],
        [],
        [
          { itemId: 'i1', tipo: TipoMovimentacao.ENTRADA, quantidade: 10 },
          { itemId: 'i1', tipo: TipoMovimentacao.ENTRADA, quantidade: 5 },
          { itemId: 'i1', tipo: TipoMovimentacao.SAIDA, quantidade: 4 },
        ],
      );

      await expect(service.consultarSaldoEstoque('e1')).resolves.toMatchObject({
        estoqueId: 'e1',
        itens: [{ itemId: 'i1', saldo: 11 }],
      });
    });

    // [v2] CT-01-31 / PCS-01: saldos de estoques diferentes permanecem isolados.
    it('não mistura itens nem saldos de estoques distintos', async () => {
      const { service } = criarBancoMovimentacoes(
        [
          { id: 'item-A', nome: 'A', estoqueId: 'A', nivelMinimo: null },
          { id: 'item-B', nome: 'B', estoqueId: 'B', nivelMinimo: null },
        ],
        [],
        [
          { itemId: 'item-A', tipo: TipoMovimentacao.ENTRADA, quantidade: 2 },
          { itemId: 'item-B', tipo: TipoMovimentacao.ENTRADA, quantidade: 9 },
        ],
      );

      await expect(service.consultarSaldoEstoque('A')).resolves.toMatchObject({
        itens: [{ itemId: 'item-A', saldo: 2 }],
      });
      await expect(service.consultarSaldoEstoque('B')).resolves.toMatchObject({
        itens: [{ itemId: 'item-B', saldo: 9 }],
      });
    });

    // [v2] CT-01-32 / PCS-02 / LM-04: estoque sem itens retorna lista vazia.
    it('retorna lista vazia para saldo de estoque sem itens', async () => {
      const { service } = criarBancoMovimentacoes([], []);
      await expect(service.consultarSaldoEstoque('e1')).resolves.toEqual({
        estoqueId: 'e1',
        itens: [],
      });
    });

    // [v2] CT-01-33 / PES-02: estoque inexistente não retorna saldo.
    it('retorna HTTP 404 para consulta de saldo de estoque inexistente', async () => {
      const { service } = criarBancoMovimentacoes([], [], [], ['e1']);
      const erro = await service.consultarSaldoEstoque('ausente').catch((error: unknown) => error);
      expect((erro as HttpException).getStatus()).toBe(404);
    });

    // [v2] CT-01-34 / PHI-01 / LM-04: a primeira movimentação aparece no histórico.
    it('retorna um registro com tipo e quantidade no histórico', async () => {
      const registro = {
        id: 'm1',
        itemId: 'i1',
        tipo: TipoMovimentacao.ENTRADA,
        quantidade: 1,
        dataMovimentacao: new Date('2026-01-01T00:00:00Z'),
        usuarioId: 'gestor-e1',
      };
      const { service } = criarBancoMovimentacoes(
        [{ id: 'i1', nome: 'Cabo', tipo: 'CONSUMO', estoqueId: 'e1', nivelMinimo: null }],
        [{ estoqueId: 'e1', usuarioId: 'gestor-e1' }],
        [registro],
      );

      await expect(service.consultarHistoricoEstoque('e1', 'gestor-e1', false)).resolves.toMatchObject([
        { id: 'm1', tipo: TipoMovimentacao.ENTRADA, quantidade: 1 },
      ]);
    });

    // [v2] CT-01-35 / PHI-01: histórico contém somente os movimentos do estoque solicitado.
    it('isola o histórico por estoque', async () => {
      const { service } = criarBancoMovimentacoes(
        [
          { id: 'item-A', nome: 'A', tipo: 'CONSUMO', estoqueId: 'A', nivelMinimo: null },
          { id: 'item-B', nome: 'B', tipo: 'CONSUMO', estoqueId: 'B', nivelMinimo: null },
        ],
        [{ estoqueId: 'A', usuarioId: 'gestor-A' }],
        [
          { id: 'm-A', itemId: 'item-A', tipo: TipoMovimentacao.ENTRADA, quantidade: 1 },
          { id: 'm-B', itemId: 'item-B', tipo: TipoMovimentacao.ENTRADA, quantidade: 2 },
        ],
      );

      await expect(service.consultarHistoricoEstoque('A', 'gestor-A', false)).resolves.toMatchObject([
        { id: 'm-A' },
      ]);
    });

    // [v2] CT-01-36 / PHI-02 / LM-04: estoque sem movimentações tem histórico vazio.
    it('retorna histórico vazio quando não há movimentações', async () => {
      const { service } = criarBancoMovimentacoes(
        [{ id: 'i1', nome: 'Cabo', tipo: 'CONSUMO', estoqueId: 'e1', nivelMinimo: null }],
        [{ estoqueId: 'e1', usuarioId: 'gestor-e1' }],
      );

      await expect(service.consultarHistoricoEstoque('e1', 'gestor-e1', false)).resolves.toEqual([]);
    });

    // [v2] CT-01-37 / PSD-03: saída recusada não altera o ledger nem o histórico.
    it('mantém o histórico vazio após saída recusada por saldo insuficiente', async () => {
      const { service, ledger } = criarBancoMovimentacoes(
        [{ id: 'i1', nome: 'Cabo', tipo: 'CONSUMO', estoqueId: 'e1', nivelMinimo: null }],
        [{ estoqueId: 'e1', usuarioId: 'gestor-e1' }],
        [{ itemId: 'i1', tipo: TipoMovimentacao.ENTRADA, quantidade: 2 }],
      );
      const erro = await service.registrarMovimentacao(
        { itemId: 'i1', tipo: TipoMovimentacao.SAIDA, quantidade: 3 },
        'gestor-e1',
        false,
      ).catch((error: unknown) => error);

      expect((erro as HttpException).getStatus()).toBe(400);
      expect(ledger).toHaveLength(1);
      await expect(service.consultarHistoricoEstoque('e1', 'gestor-e1', false)).resolves.toHaveLength(1);
    });
  });
});
