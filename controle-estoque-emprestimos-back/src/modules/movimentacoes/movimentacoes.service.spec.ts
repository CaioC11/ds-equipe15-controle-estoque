import { Test, TestingModule } from '@nestjs/testing';
import { MovimentacoesService } from './movimentacoes.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TipoMovimentacao } from '@prisma/client';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('MovimentacoesService', () => {
  let service: MovimentacoesService;

  const mockPrismaService = {
    estoqueGestor: {
      findUnique: vi.fn(),
    },
    item: {
      findUnique: vi.fn(),
    },
    movimentacao: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovimentacoesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<MovimentacoesService>(MovimentacoesService);
    vi.clearAllMocks();
  });

  it('deve rejeitar saída quando a quantidade for maior que o saldo atual', async () => {
    mockPrismaService.item.findUnique.mockResolvedValue({
      id: 'item-1',
      estoqueId: 'estoque-1',
    });
    mockPrismaService.estoqueGestor.findUnique.mockResolvedValue({
      estoqueId: 'estoque-1',
      usuarioId: 'gestor-1',
    });

    mockPrismaService.movimentacao.findMany.mockResolvedValue([
      { tipo: TipoMovimentacao.ENTRADA, quantidade: 5 },
    ]);

    await expect(
      service.registrarMovimentacao(
        { itemId: 'item-1', tipo: TipoMovimentacao.SAIDA, quantidade: 10 },
        'gestor-1',
        false,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('deve calcular abaixoDoMinimo como verdadeiro quando saldo <= nivelMinimo', async () => {
    mockPrismaService.item.findUnique.mockResolvedValue({
      id: 'item-1',
      estoqueId: 'estoque-1',
      nivelMinimo: 3,
    });
    mockPrismaService.estoqueGestor.findUnique.mockResolvedValue({
      estoqueId: 'estoque-1',
      usuarioId: 'gestor-1',
    });

    mockPrismaService.movimentacao.findMany.mockResolvedValue([
      { tipo: TipoMovimentacao.ENTRADA, quantidade: 2 },
    ]);

    const resultado = await service.consultarSaldoItem('item-1', 'gestor-1', false);
    expect(resultado.abaixoDoMinimo).toBe(true);
  });

  it('deve proibir ADMIN de registrar movimentação', async () => {
    await expect(
      service.registrarMovimentacao(
        { itemId: 'item-1', tipo: TipoMovimentacao.ENTRADA, quantidade: 5 },
        'admin-1',
        true,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});