import { Test, TestingModule } from '@nestjs/testing';
import { TipoMovimentacao } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessDeniedException } from '../../common/exceptions/access-denied.exception';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../database/prisma.service';
import { MovimentacoesService } from './movimentacoes.service';
import { TransferenciasService } from './transferencias.service';

describe('TransferenciasService', () => {
  let service: TransferenciasService;

  const mockPrisma = {
    $transaction: vi.fn(),
    estoque: { findUnique: vi.fn() },
    estoqueGestor: { findUnique: vi.fn() },
    item: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    emprestimo: { findFirst: vi.fn() },
    movimentacao: { create: vi.fn() },
  };
  const mockMovimentacoes = { calcularSaldoItem: vi.fn() };

  const estoqueOrigem = { id: 'est-origem', nome: 'Origem', ativo: true };
  const estoqueDestino = { id: 'est-destino', nome: 'Destino', ativo: true };

  const itemConsumo = {
    id: 'item-origem',
    tipo: 'CONSUMO',
    nome: 'Papel A4',
    descricao: null,
    nivelMinimo: null,
    categoriaId: 'cat-1',
    estoqueId: 'est-origem',
    status: 'DISPONIVEL',
    tombamento: null,
  };

  const itemPatrimonial = {
    ...itemConsumo,
    id: 'item-pat',
    tipo: 'PATRIMONIAL',
    nome: 'Notebook',
    tombamento: 'TOMB-123',
  };

  const dtoConsumo = (quantidade: number) => ({
    itemId: 'item-origem',
    estoqueOrigemId: 'est-origem',
    estoqueDestinoId: 'est-destino',
    quantidade,
  });

  /** Origem e destino ativos, usuário gestor dos dois, sem empréstimo em aberto. */
  const cenarioFeliz = () => {
    mockPrisma.estoque.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === 'est-origem' ? estoqueOrigem : where.id === 'est-destino' ? estoqueDestino : null,
    );
    mockPrisma.estoqueGestor.findUnique.mockResolvedValue({ estoqueId: 'x', usuarioId: 'u1' });
    mockPrisma.emprestimo.findFirst.mockResolvedValue(null);
    mockPrisma.movimentacao.create.mockImplementation(async ({ data }: { data: unknown }) => ({
      id: 'mov',
      ...(data as object),
    }));
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb(mockPrisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferenciasService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MovimentacoesService, useValue: mockMovimentacoes },
      ],
    }).compile();

    service = module.get(TransferenciasService);
  });

  it('rejeita origem igual ao destino sem tocar no banco', async () => {
    await expect(
      service.transferir({ ...dtoConsumo(1), estoqueDestinoId: 'est-origem' }, 'u1'),
    ).rejects.toThrow(AppException);

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('aceita quantidade igual ao saldo e gera duas movimentações ligadas', async () => {
    cenarioFeliz();
    mockMovimentacoes.calcularSaldoItem.mockResolvedValue(10);
    mockPrisma.item.findFirst
      .mockResolvedValueOnce(itemConsumo) // item na origem
      .mockResolvedValueOnce(null); // não existe no destino
    mockPrisma.item.create.mockResolvedValue({ id: 'item-destino' });

    const resultado = await service.transferir(dtoConsumo(10), 'u1');

    expect(mockPrisma.movimentacao.create).toHaveBeenCalledTimes(2);
    expect(resultado.movimentacaoSaida).toMatchObject({
      itemId: 'item-origem',
      tipo: TipoMovimentacao.TRANSFERENCIA,
      quantidade: 10,
      transferenciaId: resultado.transferenciaId,
    });
    expect(resultado.movimentacaoEntrada).toMatchObject({
      itemId: 'item-destino',
      tipo: TipoMovimentacao.ENTRADA,
      quantidade: 10,
      transferenciaId: resultado.transferenciaId,
    });
  });

  it('rejeita quantidade igual ao saldo + 1 e não grava nada', async () => {
    cenarioFeliz();
    mockMovimentacoes.calcularSaldoItem.mockResolvedValue(10);
    mockPrisma.item.findFirst.mockResolvedValueOnce(itemConsumo);

    await expect(service.transferir(dtoConsumo(11), 'u1')).rejects.toThrow(AppException);

    expect(mockPrisma.movimentacao.create).not.toHaveBeenCalled();
    expect(mockPrisma.item.create).not.toHaveBeenCalled();
  });

  it('consumo já existente no destino soma ao saldo sem duplicar o item', async () => {
    cenarioFeliz();
    mockMovimentacoes.calcularSaldoItem.mockResolvedValue(10);
    mockPrisma.item.findFirst
      .mockResolvedValueOnce(itemConsumo)
      .mockResolvedValueOnce({ ...itemConsumo, id: 'item-no-destino', estoqueId: 'est-destino' });

    const resultado = await service.transferir(dtoConsumo(4), 'u1');

    expect(mockPrisma.item.create).not.toHaveBeenCalled();
    expect(resultado.movimentacaoEntrada.itemId).toBe('item-no-destino');
  });

  it('patrimonial muda de estoque preservando o tombamento, sem criar item', async () => {
    cenarioFeliz();
    mockPrisma.item.findFirst.mockResolvedValueOnce(itemPatrimonial);

    const resultado = await service.transferir(
      { itemId: 'item-pat', estoqueOrigemId: 'est-origem', estoqueDestinoId: 'est-destino' },
      'u1',
    );

    expect(mockPrisma.item.update).toHaveBeenCalledWith({
      where: { id: 'item-pat' },
      data: { estoqueId: 'est-destino' },
    });
    expect(mockPrisma.item.create).not.toHaveBeenCalled();
    expect(mockPrisma.movimentacao.create).toHaveBeenCalledTimes(2);
    expect(resultado.movimentacaoSaida.itemId).toBe('item-pat');
    expect(resultado.movimentacaoEntrada.itemId).toBe('item-pat');
  });

  it('bloqueia item com empréstimo ativo ou aguardando termo', async () => {
    cenarioFeliz();
    mockPrisma.item.findFirst.mockResolvedValueOnce(itemPatrimonial);
    mockPrisma.emprestimo.findFirst.mockResolvedValue({ id: 'emp-1', status: 'ATIVO' });

    await expect(
      service.transferir(
        { itemId: 'item-pat', estoqueOrigemId: 'est-origem', estoqueDestinoId: 'est-destino' },
        'u1',
      ),
    ).rejects.toThrow(AppException);

    expect(mockPrisma.item.update).not.toHaveBeenCalled();
    expect(mockPrisma.movimentacao.create).not.toHaveBeenCalled();
  });

  it('retorna 403 quando não é gestor do estoque de destino', async () => {
    cenarioFeliz();
    mockPrisma.estoqueGestor.findUnique
      .mockResolvedValueOnce({ estoqueId: 'est-origem', usuarioId: 'u1' }) // origem ok
      .mockResolvedValueOnce(null); // destino sem vínculo

    await expect(service.transferir(dtoConsumo(1), 'u1')).rejects.toThrow(AccessDeniedException);

    expect(mockPrisma.movimentacao.create).not.toHaveBeenCalled();
  });

  it('rejeita estoque de destino desativado', async () => {
    cenarioFeliz();
    mockPrisma.estoque.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === 'est-origem' ? estoqueOrigem : { ...estoqueDestino, ativo: false },
    );

    await expect(service.transferir(dtoConsumo(1), 'u1')).rejects.toThrow(AppException);

    expect(mockPrisma.movimentacao.create).not.toHaveBeenCalled();
  });
});