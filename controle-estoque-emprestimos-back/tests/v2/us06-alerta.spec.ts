import { HttpException, NotFoundException } from '@nestjs/common';
import { TipoMovimentacao } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessRole } from '../../src/common/auth/access-role.enum';
import { PrismaService } from '../../src/database/prisma.service';
import { MovimentacoesController } from '../../src/modules/movimentacoes/movimentacoes.controller';
import { MovimentacoesService } from '../../src/modules/movimentacoes/movimentacoes.service';

// Suíte v2 da US06: cada caso novo referencia CT, partição ou fronteira da matriz.
function criarBancoAlertas(
  itens: Array<{
    id: string;
    nome: string;
    tipo: string;
    estoqueId: string;
    nivelMinimo: number | null;
  }>,
  movimentos: Array<{ itemId: string; tipo: TipoMovimentacao; quantidade: number }> = [],
  estoques: string[] = ['e1'],
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
      findMany: vi.fn(async ({ where }: any) => itens.filter((item) => item.estoqueId === where.estoqueId)),
    },
    estoqueGestor: {
      findUnique: vi.fn(async () => ({ estoqueId: 'e1', usuarioId: 'gestor-e1' })),
    },
    movimentacao: {
      groupBy: vi.fn(async ({ where }: any) => {
        const grupos = new Map<TipoMovimentacao, number>();
        for (const movimento of ledger.filter((entry) => entry.itemId === where.itemId)) {
          grupos.set(movimento.tipo, (grupos.get(movimento.tipo) ?? 0) + movimento.quantidade);
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
      findMany: vi.fn(async () => ledger),
    },
  };
  return { prisma, ledger, service: new MovimentacoesService(prisma as PrismaService) };
}

describe('US06 — Alerta de reposição v2', () => {
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

  // [v2] CT-06-05 / PNM-01 / LM-02: ausência do nível mínimo não gera alerta.
  it('não marca alerta quando o nível mínimo é nulo', async () => {
    prisma.item.findUnique.mockResolvedValue({ id: 'item-1', nome: 'Luva', estoqueId: 'e1', nivelMinimo: null });
    await expect(service.consultarSaldoItem('item-1')).resolves.toMatchObject({ saldo: 0, nivelMinimo: null, abaixoDoMinimo: false });
  });

  // [v2] CT-06-01 / PSM-02 / LM-01: igualdade ao mínimo gera alerta.
  it('marca alerta quando o saldo é igual ao mínimo', async () => {
    prisma.item.findUnique.mockResolvedValue({ id: 'item-1', nome: 'Luva', estoqueId: 'e1', nivelMinimo: 5 });
    prisma.movimentacao.groupBy.mockResolvedValue([{ tipo: 'ENTRADA', _sum: { quantidade: 5 } }]);
    await expect(service.consultarSaldoItem('item-1')).resolves.toMatchObject({ saldo: 5, nivelMinimo: 5, abaixoDoMinimo: true });
  });

  // [v2] CT-06-03 / PSM-03: saldo abaixo do mínimo gera alerta.
  it('marca alerta quando o saldo fica abaixo do mínimo', async () => {
    prisma.item.findUnique.mockResolvedValue({ id: 'item-1', nome: 'Luva', estoqueId: 'e1', nivelMinimo: 5 });
    prisma.movimentacao.groupBy.mockResolvedValue([{ tipo: 'ENTRADA', _sum: { quantidade: 4 } }]);
    await expect(service.consultarSaldoItem('item-1')).resolves.toMatchObject({ saldo: 4, abaixoDoMinimo: true });
  });

  // [v2] CT-06-02 / PSM-01 / LM-01: saldo acima do mínimo não gera alerta.
  it('não marca alerta quando o saldo supera o mínimo', async () => {
    prisma.item.findUnique.mockResolvedValue({ id: 'item-1', nome: 'Luva', estoqueId: 'e1', nivelMinimo: 5 });
    prisma.movimentacao.groupBy.mockResolvedValue([{ tipo: 'ENTRADA', _sum: { quantidade: 6 } }]);
    await expect(service.consultarSaldoItem('item-1')).resolves.toMatchObject({ saldo: 6, abaixoDoMinimo: false });
  });

  // [v2] CT-06-23 / PES-03: estoque inexistente retorna not found.
  it('informa estoque inexistente', async () => {
    prisma.estoque.findUnique.mockResolvedValue(null);
    await expect(service.consultarSaldoEstoque('ausente')).rejects.toBeInstanceOf(NotFoundException);
  });

  // [v2] CT-06-14 / PTI-01: consulta retorna os dados de alerta por item.
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

  it('CT-06-04 / PSM-04: saldo zero com mínimo positivo gera alerta', async () => {
    prisma.item.findUnique.mockResolvedValue({ id: 'item-1', nome: 'Luva', estoqueId: 'e1', nivelMinimo: 1 });
    await expect(service.consultarSaldoItem('item-1')).resolves.toMatchObject({
      saldo: 0,
      abaixoDoMinimo: true,
    });
  });

  it('CT-06-06 / PNM-03 / LM-02: mínimo zero e saldo zero gera alerta', async () => {
    prisma.item.findUnique.mockResolvedValue({ id: 'item-1', nome: 'Luva', estoqueId: 'e1', nivelMinimo: 0 });
    await expect(service.consultarSaldoItem('item-1')).resolves.toMatchObject({
      saldo: 0,
      abaixoDoMinimo: true,
    });
  });

  it('CT-06-07 / PSM-06: mínimo zero e saldo positivo não gera alerta', async () => {
    prisma.item.findUnique.mockResolvedValue({ id: 'item-1', nome: 'Luva', estoqueId: 'e1', nivelMinimo: 0 });
    prisma.movimentacao.groupBy.mockResolvedValue([{ tipo: TipoMovimentacao.ENTRADA, _sum: { quantidade: 1 } }]);
    await expect(service.consultarSaldoItem('item-1')).resolves.toMatchObject({
      saldo: 1,
      abaixoDoMinimo: false,
    });
  });

  it('CT-06-08 / PSM-07: movimento de saída reduz o saldo e atualiza o alerta', async () => {
    const item = { id: 'item-1', nome: 'Luva', tipo: 'CONSUMO', estoqueId: 'e1', nivelMinimo: 5 };
    const { service: ledgerService } = criarBancoAlertas(
      [item],
      [{ itemId: item.id, tipo: TipoMovimentacao.ENTRADA, quantidade: 8 }],
    );
    await ledgerService.registrarMovimentacao(
      { itemId: item.id, tipo: TipoMovimentacao.SAIDA, quantidade: 3 },
      'gestor-e1',
      false,
    );
    await expect(ledgerService.consultarSaldoItem(item.id)).resolves.toMatchObject({
      saldo: 5,
      abaixoDoMinimo: true,
    });
  });

  it('CT-06-09 / PSM-08: movimento de entrada eleva o saldo acima do mínimo', async () => {
    const item = { id: 'item-1', nome: 'Luva', tipo: 'CONSUMO', estoqueId: 'e1', nivelMinimo: 5 };
    const { service: ledgerService } = criarBancoAlertas(
      [item],
      [{ itemId: item.id, tipo: TipoMovimentacao.ENTRADA, quantidade: 3 }],
    );
    await ledgerService.registrarMovimentacao(
      { itemId: item.id, tipo: TipoMovimentacao.ENTRADA, quantidade: 3 },
      'gestor-e1',
      false,
    );
    await expect(ledgerService.consultarSaldoItem(item.id)).resolves.toMatchObject({
      saldo: 6,
      abaixoDoMinimo: false,
    });
  });

  it('CT-06-10 / PSM-09: movimento de entrada leva o saldo exatamente ao mínimo', async () => {
    const item = { id: 'item-1', nome: 'Luva', tipo: 'CONSUMO', estoqueId: 'e1', nivelMinimo: 5 };
    const { service: ledgerService } = criarBancoAlertas(
      [item],
      [{ itemId: item.id, tipo: TipoMovimentacao.ENTRADA, quantidade: 3 }],
    );
    await ledgerService.registrarMovimentacao(
      { itemId: item.id, tipo: TipoMovimentacao.ENTRADA, quantidade: 2 },
      'gestor-e1',
      false,
    );
    await expect(ledgerService.consultarSaldoItem(item.id)).resolves.toMatchObject({
      saldo: 5,
      abaixoDoMinimo: true,
    });
  });

  it('CT-06-11 / PSM-10: entrada parcial mantém o saldo abaixo do mínimo', async () => {
    const item = { id: 'item-1', nome: 'Luva', tipo: 'CONSUMO', estoqueId: 'e1', nivelMinimo: 5 };
    const { service: ledgerService } = criarBancoAlertas(
      [item],
      [{ itemId: item.id, tipo: TipoMovimentacao.ENTRADA, quantidade: 1 }],
    );
    await ledgerService.registrarMovimentacao(
      { itemId: item.id, tipo: TipoMovimentacao.ENTRADA, quantidade: 2 },
      'gestor-e1',
      false,
    );
    await expect(ledgerService.consultarSaldoItem(item.id)).resolves.toMatchObject({
      saldo: 3,
      abaixoDoMinimo: true,
    });
  });

  it('CT-06-12 / PSM-11: saída acima do saldo é rejeitada sem alterar o histórico', async () => {
    const item = { id: 'item-1', nome: 'Luva', tipo: 'CONSUMO', estoqueId: 'e1', nivelMinimo: 5 };
    const { service: ledgerService, ledger } = criarBancoAlertas(
      [item],
      [{ itemId: item.id, tipo: TipoMovimentacao.ENTRADA, quantidade: 8 }],
    );
    await expect(
      ledgerService.registrarMovimentacao(
        { itemId: item.id, tipo: TipoMovimentacao.SAIDA, quantidade: 9 },
        'gestor-e1',
        false,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(ledger).toHaveLength(1);
    await expect(ledgerService.consultarSaldoItem(item.id)).resolves.toMatchObject({
      saldo: 8,
      abaixoDoMinimo: false,
    });
  });

  it.fails('CT-06-13 / PTI-02: item patrimonial não entra na lista de reposição', async () => {
    const { service: ledgerService } = criarBancoAlertas(
      [{ id: 'item-patrimonial', nome: 'Projetor', tipo: 'PATRIMONIAL', estoqueId: 'e1', nivelMinimo: 1 }],
      [{ itemId: 'item-patrimonial', tipo: TipoMovimentacao.ENTRADA, quantidade: 1 }],
    );
    await expect(ledgerService.consultarSaldoEstoque('e1')).resolves.toMatchObject({
      itens: [],
    });
  });

  it('CT-06-14 / PTI-01: lista de alertas inclui identificação e saldo do item', async () => {
    const { service: ledgerService } = criarBancoAlertas(
      [{ id: 'item-1', nome: 'Luva', tipo: 'CONSUMO', estoqueId: 'e1', nivelMinimo: 4 }],
      [{ itemId: 'item-1', tipo: TipoMovimentacao.ENTRADA, quantidade: 2 }],
    );
    await expect(ledgerService.consultarSaldoEstoque('e1')).resolves.toMatchObject({
      estoqueId: 'e1',
      itens: [{ itemId: 'item-1', nomeItem: 'Luva', saldo: 2, nivelMinimo: 4, abaixoDoMinimo: true }],
    });
  });

  it.fails('CT-06-15 / PSM-12: lista vazia quando nenhum item está abaixo do mínimo', async () => {
    const { service: ledgerService } = criarBancoAlertas(
      [{ id: 'item-1', nome: 'Luva', tipo: 'CONSUMO', estoqueId: 'e1', nivelMinimo: 1 }],
      [{ itemId: 'item-1', tipo: TipoMovimentacao.ENTRADA, quantidade: 2 }],
    );
    await expect(ledgerService.consultarSaldoEstoque('e1')).resolves.toMatchObject({ itens: [] });
  });

  it.fails('CT-06-16 / PSM-13: lista contém somente itens abaixo do mínimo', async () => {
    const { service: ledgerService } = criarBancoAlertas(
      [
        { id: 'abaixo', nome: 'Luva', tipo: 'CONSUMO', estoqueId: 'e1', nivelMinimo: 3 },
        { id: 'acima', nome: 'Máscara', tipo: 'CONSUMO', estoqueId: 'e1', nivelMinimo: 1 },
      ],
      [
        { itemId: 'abaixo', tipo: TipoMovimentacao.ENTRADA, quantidade: 2 },
        { itemId: 'acima', tipo: TipoMovimentacao.ENTRADA, quantidade: 2 },
      ],
    );
    await expect(ledgerService.consultarSaldoEstoque('e1')).resolves.toMatchObject({
      itens: [{ itemId: 'abaixo', abaixoDoMinimo: true }],
    });
  });

  it.fails('CT-06-17 / PSM-14: lista contém somente os itens em alerta entre vários itens', async () => {
    const itens = Array.from({ length: 5 }, (_, index) => ({
      id: `item-${index}`,
      nome: `Item ${index}`,
      tipo: 'CONSUMO',
      estoqueId: 'e1',
      nivelMinimo: 2,
    }));
    const movimentos = itens.map((item, index) => ({
      itemId: item.id,
      tipo: TipoMovimentacao.ENTRADA,
      quantidade: index < 3 ? 1 : 3,
    }));
    const { service: ledgerService } = criarBancoAlertas(itens, movimentos);
    await expect(ledgerService.consultarSaldoEstoque('e1')).resolves.toMatchObject({
      itens: expect.arrayContaining([
        expect.objectContaining({ itemId: 'item-0', abaixoDoMinimo: true }),
        expect.objectContaining({ itemId: 'item-1', abaixoDoMinimo: true }),
        expect.objectContaining({ itemId: 'item-2', abaixoDoMinimo: true }),
      ]),
    });
    const result = await ledgerService.consultarSaldoEstoque('e1');
    expect(result.itens).toHaveLength(3);
  });

  it('CT-06-18 / PPA-01: gestor consulta somente alertas do próprio estoque', async () => {
    const { service: alertasService } = criarBancoAlertas(
      [
        { id: 'item-a', nome: 'Luva', tipo: 'CONSUMO', estoqueId: 'a', nivelMinimo: 2 },
        { id: 'item-b', nome: 'Máscara', tipo: 'CONSUMO', estoqueId: 'b', nivelMinimo: 3 },
      ],
      [
        { itemId: 'item-a', tipo: TipoMovimentacao.ENTRADA, quantidade: 1 },
        { itemId: 'item-b', tipo: TipoMovimentacao.ENTRADA, quantidade: 1 },
      ],
      ['a', 'b'],
    );
    const controller = new MovimentacoesController(alertasService);
    const response = await Reflect.apply(controller.consultarSaldoEstoque, controller, [
      'a',
      { userId: 'gestor-a', role: AccessRole.USER },
    ]);
    expect(response.itens).toMatchObject([{ itemId: 'item-a', abaixoDoMinimo: true }]);
  });

  it.fails('CT-06-20 / PPA-03: gestor de outro estoque recebe 403 sem alertas', async () => {
    const { service: alertasService } = criarBancoAlertas(
      [{ id: 'item-a', nome: 'Luva', tipo: 'CONSUMO', estoqueId: 'a', nivelMinimo: 2 }],
      [{ itemId: 'item-a', tipo: TipoMovimentacao.ENTRADA, quantidade: 1 }],
      ['a'],
    );
    const controller = new MovimentacoesController(alertasService);
    const response = Reflect.apply(controller.consultarSaldoEstoque, controller, [
      'a',
      { userId: 'gestor-b', role: AccessRole.USER },
    ]);
    await expect(response).rejects.toMatchObject({ status: 403 });
  });

  it.fails('CT-06-21 / PPA-04: requisitante recebe 403 sem alertas', async () => {
    const { service: alertasService } = criarBancoAlertas(
      [{ id: 'item-a', nome: 'Luva', tipo: 'CONSUMO', estoqueId: 'a', nivelMinimo: 2 }],
      [{ itemId: 'item-a', tipo: TipoMovimentacao.ENTRADA, quantidade: 1 }],
      ['a'],
    );
    const controller = new MovimentacoesController(alertasService);
    const response = Reflect.apply(controller.consultarSaldoEstoque, controller, [
      'a',
      { userId: 'requisitante', role: AccessRole.USER },
    ]);
    await expect(response).rejects.toMatchObject({ status: 403 });
  });

  it('CT-06-19 / PPA-02: gestores vinculados a estoques distintos consultam seus alertas', async () => {
    const { service: alertasService } = criarBancoAlertas(
      [
        { id: 'item-a', nome: 'Luva', tipo: 'CONSUMO', estoqueId: 'a', nivelMinimo: 2 },
        { id: 'item-b', nome: 'Máscara', tipo: 'CONSUMO', estoqueId: 'b', nivelMinimo: 3 },
      ],
      [
        { itemId: 'item-a', tipo: TipoMovimentacao.ENTRADA, quantidade: 1 },
        { itemId: 'item-b', tipo: TipoMovimentacao.ENTRADA, quantidade: 1 },
      ],
      ['a', 'b'],
    );
    const controller = new MovimentacoesController(alertasService);
    const alertasA = await Reflect.apply(controller.consultarSaldoEstoque, controller, [
      'a',
      { userId: 'gestor-ab', role: AccessRole.USER },
    ]);
    const alertasB = await Reflect.apply(controller.consultarSaldoEstoque, controller, [
      'b',
      { userId: 'gestor-ab', role: AccessRole.USER },
    ]);
    expect(alertasA.itens).toMatchObject([{ itemId: 'item-a', abaixoDoMinimo: true }]);
    expect(alertasB.itens).toMatchObject([{ itemId: 'item-b', abaixoDoMinimo: true }]);
  });

  it('CT-06-22 / PPA-05: ADMIN pode consultar alertas de estoque', async () => {
    const { service: alertasService } = criarBancoAlertas(
      [{ id: 'item-1', nome: 'Luva', tipo: 'CONSUMO', estoqueId: 'e1', nivelMinimo: 1 }],
      [{ itemId: 'item-1', tipo: TipoMovimentacao.ENTRADA, quantidade: 0 }],
    );
    const controller = new MovimentacoesController(alertasService);
    const response = await Reflect.apply(controller.consultarSaldoEstoque, controller, [
      'e1',
      { userId: 'admin', role: AccessRole.ADMIN },
    ]);
    expect(response).toMatchObject({
      estoqueId: 'e1',
      itens: [expect.objectContaining({ itemId: 'item-1', abaixoDoMinimo: true })],
    });
  });

  it('CT-06-05 / PNM-01: soma agregada nula produz saldo zero sem mínimo', async () => {
    const aggregate = vi.fn().mockResolvedValue([
      { tipo: TipoMovimentacao.ENTRADA, _sum: { quantidade: null } },
    ]);
    const ledgerService = new MovimentacoesService({
      movimentacao: { groupBy: aggregate },
    } as unknown as PrismaService);
    await expect(ledgerService.calcularSaldoItem('item-1')).resolves.toBe(0);
  });
});
