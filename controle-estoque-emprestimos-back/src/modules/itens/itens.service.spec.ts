import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AccessDeniedException } from '../../common/exceptions/access-denied.exception';
import { ResourceConflictException } from '../../common/exceptions/resource-conflict.exception';
import { ResourceNotFoundException } from '../../common/exceptions/resource-not-found.exception';
import { PrismaService } from '../../database/prisma.service';
import { CreateItemSchema } from './dto/create-item.dto';
import { ItensService } from './itens.service';

const prismaMock = {
  estoque: { findUnique: vi.fn() },
  categoria: { findUnique: vi.fn() },
  estoqueGestor: { findUnique: vi.fn() },
  item: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
};

const p2002 = (campo: string) =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: [campo] },
  });

describe('ItensService', () => {
  let service: ItensService;

  const dtoPatrimonial = {
    tipo: 'PATRIMONIAL' as const,
    nome: 'Notebook',
    categoriaId: 'cat-1',
    tombamento: '123456',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ItensService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get(ItensService);

    prismaMock.estoque.findUnique.mockResolvedValue({ id: 'est-1' });
    prismaMock.categoria.findUnique.mockResolvedValue({ id: 'cat-1' });
    prismaMock.estoqueGestor.findUnique.mockResolvedValue({
      estoqueId: 'est-1',
      usuarioId: 'user-1',
    });
  });

  describe('create', () => {
    it('cadastra item patrimonial no estoque quando o usuário é gestor', async () => {
      prismaMock.item.create.mockResolvedValue({ id: 'item-1' });

      const result = await service.create('est-1', dtoPatrimonial, 'user-1');

      expect(result).toEqual({ id: 'item-1' });
      expect(prismaMock.item.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            estoqueId: 'est-1',
            tombamento: '123456',
          }),
        }),
      );
    });

    it('cadastra item de consumo sem tombamento', async () => {
      prismaMock.item.create.mockResolvedValue({ id: 'item-2' });

      await service.create(
        'est-1',
        { tipo: 'CONSUMO', nome: 'Papel A4', categoriaId: 'cat-1' },
        'user-1',
      );

      expect(prismaMock.item.create).toHaveBeenCalled();
    });

    it('recusa (403) quem não é gestor do estoque', async () => {
      prismaMock.estoqueGestor.findUnique.mockResolvedValue(null);

      await expect(service.create('est-1', dtoPatrimonial, 'outro-user')).rejects.toBeInstanceOf(
        AccessDeniedException,
      );
      expect(prismaMock.item.create).not.toHaveBeenCalled();
    });

    it('recusa (403) quando não há usuário identificado', async () => {
      await expect(service.create('est-1', dtoPatrimonial, undefined)).rejects.toBeInstanceOf(
        AccessDeniedException,
      );
    });

    it('retorna 404 quando o estoque não existe', async () => {
      prismaMock.estoque.findUnique.mockResolvedValue(null);

      await expect(service.create('x', dtoPatrimonial, 'user-1')).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it('retorna 404 quando a categoria não existe', async () => {
      prismaMock.categoria.findUnique.mockResolvedValue(null);

      await expect(service.create('est-1', dtoPatrimonial, 'user-1')).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it('recusa tombamento duplicado (409)', async () => {
      prismaMock.item.create.mockRejectedValue(p2002('tombamento'));

      await expect(service.create('est-1', dtoPatrimonial, 'user-1')).rejects.toThrow('tombamento');
      await expect(service.create('est-1', dtoPatrimonial, 'user-1')).rejects.toBeInstanceOf(
        ResourceConflictException,
      );
    });

    it('recusa nº de série duplicado (409)', async () => {
      prismaMock.item.create.mockRejectedValue(p2002('numeroSerie'));

      await expect(service.create('est-1', dtoPatrimonial, 'user-1')).rejects.toThrow(
        'número de série',
      );
    });
  });

  describe('findAllByEstoque', () => {
    it('lista os itens do estoque com paginação', async () => {
      prismaMock.item.findMany.mockResolvedValue([{ id: 'item-1' }]);
      prismaMock.item.count.mockResolvedValue(21);

      const result = await service.findAllByEstoque('est-1', {
        page: 2,
        limit: 10,
      } as never);

      expect(prismaMock.item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { estoqueId: 'est-1' },
          skip: 10,
          take: 10,
        }),
      );
      expect(result.meta).toEqual({
        page: 2,
        limit: 10,
        total: 21,
        totalPages: 3,
      });
    });
  });

  describe('update', () => {
    it('atualiza item quando o usuário é gestor', async () => {
      prismaMock.item.findFirst.mockResolvedValue({
        id: 'item-1',
        tipo: 'PATRIMONIAL',
      });
      prismaMock.item.update.mockResolvedValue({ id: 'item-1', nome: 'Novo' });

      const result = await service.update('est-1', 'item-1', { nome: 'Novo' }, 'user-1');

      expect(result).toEqual({ id: 'item-1', nome: 'Novo' });
    });

    it('recusa (403) quem não é gestor do estoque', async () => {
      prismaMock.estoqueGestor.findUnique.mockResolvedValue(null);

      await expect(
        service.update('est-1', 'item-1', { nome: 'Novo' }, 'outro-user'),
      ).rejects.toBeInstanceOf(AccessDeniedException);
      expect(prismaMock.item.update).not.toHaveBeenCalled();
    });

    it('retorna 404 quando o item não pertence ao estoque', async () => {
      prismaMock.item.findFirst.mockResolvedValue(null);

      await expect(
        service.update('est-1', 'item-9', { nome: 'Novo' }, 'user-1'),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });

    it('recusa tombamento em item de consumo', async () => {
      prismaMock.item.findFirst.mockResolvedValue({
        id: 'item-2',
        tipo: 'CONSUMO',
      });

      await expect(
        service.update('est-1', 'item-2', { tombamento: '999' }, 'user-1'),
      ).rejects.toThrow('Item de consumo não possui tombamento');
    });

    it('recusa tombamento duplicado na edição (409)', async () => {
      prismaMock.item.findFirst.mockResolvedValue({
        id: 'item-1',
        tipo: 'PATRIMONIAL',
      });
      prismaMock.item.update.mockRejectedValue(p2002('tombamento'));

      await expect(
        service.update('est-1', 'item-1', { tombamento: '123456' }, 'user-1'),
      ).rejects.toBeInstanceOf(ResourceConflictException);
    });
  });
});

describe('CreateItemSchema', () => {
  it('exige tombamento em item patrimonial', () => {
    const r = CreateItemSchema.safeParse({
      tipo: 'PATRIMONIAL',
      nome: 'Notebook',
      categoriaId: 'cat-1',
    });
    expect(r.success).toBe(false);
  });

  it('aceita item de consumo sem tombamento, com nº de série e nível mínimo opcionais', () => {
    const r = CreateItemSchema.safeParse({
      tipo: 'CONSUMO',
      nome: 'Papel A4',
      categoriaId: 'cat-1',
    });
    expect(r.success).toBe(true);
  });

  it('recusa tombamento em item de consumo', () => {
    const r = CreateItemSchema.safeParse({
      tipo: 'CONSUMO',
      nome: 'Papel A4',
      categoriaId: 'cat-1',
      tombamento: '1',
    });
    expect(r.success).toBe(false);
  });

  it('recusa nível mínimo negativo', () => {
    const r = CreateItemSchema.safeParse({
      tipo: 'CONSUMO',
      nome: 'Papel A4',
      categoriaId: 'cat-1',
      nivelMinimo: -1,
    });
    expect(r.success).toBe(false);
  });
});
