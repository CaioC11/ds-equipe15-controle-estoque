import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AccessDeniedException } from '../../common/exceptions/access-denied.exception';
import { AppException } from '../../common/exceptions/app.exception';
import { ResourceConflictException } from '../../common/exceptions/resource-conflict.exception';
import { ResourceNotFoundException } from '../../common/exceptions/resource-not-found.exception';
import { PrismaService } from '../../database/prisma.service';
import { CompletarTombamentoSchema } from './dto/completar-tombamento.dto';
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

    prismaMock.estoque.findUnique.mockResolvedValue({ id: 'est-1', ativo: true });
    prismaMock.categoria.findUnique.mockResolvedValue({ id: 'cat-1' });
    prismaMock.estoqueGestor.findUnique.mockResolvedValue({
      estoqueId: 'est-1',
      usuarioId: 'user-1',
    });
  });

  describe('create', () => {
    it('recusa (400) item em estoque desativado', async () => {
      prismaMock.estoque.findUnique.mockResolvedValue({ id: 'est-1', ativo: false });

      await expect(service.create('est-1', dtoPatrimonial, 'user-1')).rejects.toThrow('desativado');
      expect(prismaMock.item.create).not.toHaveBeenCalled();
    });

    it('cadastra item patrimonial no estoque quando o usuário é gestor', async () => {
      prismaMock.item.create.mockResolvedValue({
        id: 'item-1',
        tipo: 'PATRIMONIAL',
        tombamento: '123456',
      });

      const result = await service.create('est-1', dtoPatrimonial, 'user-1');

      expect(result).toEqual({
        id: 'item-1',
        tipo: 'PATRIMONIAL',
        tombamento: '123456',
        tombamentoPendente: false,
      });
      expect(prismaMock.item.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            estoqueId: 'est-1',
            tombamento: '123456',
          }),
        }),
      );
    });

    it('cadastra item patrimonial sem tombamento marcando tombamentoPendente como true', async () => {
      prismaMock.item.create.mockResolvedValue({
        id: 'item-pendente',
        tipo: 'PATRIMONIAL',
        tombamento: null,
      });

      const result = await service.create(
        'est-1',
        { tipo: 'PATRIMONIAL', nome: 'Projetor', categoriaId: 'cat-1' },
        'user-1',
      );

      expect(result).toEqual({
        id: 'item-pendente',
        tipo: 'PATRIMONIAL',
        tombamento: null,
        tombamentoPendente: true,
      });
    });

    it('cadastra item de consumo sem tombamento', async () => {
      prismaMock.item.create.mockResolvedValue({
        id: 'item-2',
        tipo: 'CONSUMO',
        tombamento: null,
      });

      const result = await service.create(
        'est-1',
        { tipo: 'CONSUMO', nome: 'Papel A4', categoriaId: 'cat-1' },
        'user-1',
      );

      expect(prismaMock.item.create).toHaveBeenCalled();
      expect(result.tombamentoPendente).toBe(false);
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
    it('lista os itens do estoque com paginação e flag tombamentoPendente', async () => {
      prismaMock.item.findMany.mockResolvedValue([
        { id: 'item-1', tipo: 'PATRIMONIAL', tombamento: null },
        { id: 'item-2', tipo: 'PATRIMONIAL', tombamento: 'TOMB-1' },
      ]);
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
      expect(result.items).toEqual([
        { id: 'item-1', tipo: 'PATRIMONIAL', tombamento: null, tombamentoPendente: true },
        { id: 'item-2', tipo: 'PATRIMONIAL', tombamento: 'TOMB-1', tombamentoPendente: false },
      ]);
      expect(result.meta).toEqual({
        page: 2,
        limit: 10,
        total: 21,
        totalPages: 3,
      });
    });

    it('filtra apenas itens pendentes quando pendente=true', async () => {
      prismaMock.item.findMany.mockResolvedValue([]);
      prismaMock.item.count.mockResolvedValue(0);

      await service.findAllByEstoque('est-1', {
        page: 1,
        limit: 20,
        pendente: true,
      } as never);

      expect(prismaMock.item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { estoqueId: 'est-1', tipo: 'PATRIMONIAL', tombamento: null },
        }),
      );
    });

    it('filtra apenas itens não pendentes quando pendente=false', async () => {
      prismaMock.item.findMany.mockResolvedValue([]);
      prismaMock.item.count.mockResolvedValue(0);

      await service.findAllByEstoque('est-1', {
        page: 1,
        limit: 20,
        pendente: false,
      } as never);

      expect(prismaMock.item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            estoqueId: 'est-1',
            OR: [{ tipo: { not: 'PATRIMONIAL' } }, { tombamento: { not: null } }],
          },
        }),
      );
    });
  });

  describe('update', () => {
    it('atualiza item quando o usuário é gestor', async () => {
      prismaMock.item.findFirst.mockResolvedValue({
        id: 'item-1',
        tipo: 'PATRIMONIAL',
        tombamento: '123456',
      });
      prismaMock.item.update.mockResolvedValue({
        id: 'item-1',
        tipo: 'PATRIMONIAL',
        tombamento: '123456',
        nome: 'Novo',
      });

      const result = await service.update('est-1', 'item-1', { nome: 'Novo' }, 'user-1');

      expect(result).toEqual({
        id: 'item-1',
        tipo: 'PATRIMONIAL',
        tombamento: '123456',
        nome: 'Novo',
        tombamentoPendente: false,
      });
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

    it('recusa apagar tombamento já preenchido na edição', async () => {
      prismaMock.item.findFirst.mockResolvedValue({
        id: 'item-1',
        tipo: 'PATRIMONIAL',
        tombamento: '123456',
      });

      await expect(
        service.update('est-1', 'item-1', { tombamento: '' }, 'user-1'),
      ).rejects.toThrow('Tombamento já preenchido não pode ser apagado');
      await expect(
        service.update('est-1', 'item-1', { tombamento: null as never }, 'user-1'),
      ).rejects.toBeInstanceOf(AppException);
      expect(prismaMock.item.update).not.toHaveBeenCalled();
    });

    it('recusa tombamento duplicado na edição (409)', async () => {
      prismaMock.item.findFirst.mockResolvedValue({
        id: 'item-1',
        tipo: 'PATRIMONIAL',
        tombamento: '123456',
      });
      prismaMock.item.update.mockRejectedValue(p2002('tombamento'));

      await expect(
        service.update('est-1', 'item-1', { tombamento: '654321' }, 'user-1'),
      ).rejects.toBeInstanceOf(ResourceConflictException);
    });
  });

  describe('completarTombamento', () => {
    it('completa tombamento de item patrimonial pendente quando usuário é gestor', async () => {
      prismaMock.item.findFirst.mockResolvedValue({
        id: 'item-1',
        tipo: 'PATRIMONIAL',
        tombamento: null,
      });
      prismaMock.item.update.mockResolvedValue({
        id: 'item-1',
        tipo: 'PATRIMONIAL',
        tombamento: 'TOMB-777',
      });

      const result = await service.completarTombamento(
        'est-1',
        'item-1',
        { tombamento: 'TOMB-777' },
        'user-1',
      );

      expect(prismaMock.item.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { tombamento: 'TOMB-777' },
        include: { categoria: true },
      });
      expect(result).toEqual({
        id: 'item-1',
        tipo: 'PATRIMONIAL',
        tombamento: 'TOMB-777',
        tombamentoPendente: false,
      });
    });

    it('recusa (403) quem não é gestor do estoque', async () => {
      prismaMock.estoqueGestor.findUnique.mockResolvedValue(null);

      await expect(
        service.completarTombamento('est-1', 'item-1', { tombamento: 'TOMB-777' }, 'outro-user'),
      ).rejects.toBeInstanceOf(AccessDeniedException);
      expect(prismaMock.item.update).not.toHaveBeenCalled();
    });

    it('retorna 404 quando o item não existe no estoque', async () => {
      prismaMock.item.findFirst.mockResolvedValue(null);

      await expect(
        service.completarTombamento('est-1', 'item-9', { tombamento: 'TOMB-777' }, 'user-1'),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });

    it('recusa (400) em item de consumo', async () => {
      prismaMock.item.findFirst.mockResolvedValue({
        id: 'item-2',
        tipo: 'CONSUMO',
        tombamento: null,
      });

      await expect(
        service.completarTombamento('est-1', 'item-2', { tombamento: 'TOMB-777' }, 'user-1'),
      ).rejects.toThrow('Item de consumo não possui tombamento');
    });

    it('recusa (400) quando o item já possui tombamento cadastrado', async () => {
      prismaMock.item.findFirst.mockResolvedValue({
        id: 'item-1',
        tipo: 'PATRIMONIAL',
        tombamento: 'TOMB-111',
      });

      await expect(
        service.completarTombamento('est-1', 'item-1', { tombamento: 'TOMB-777' }, 'user-1'),
      ).rejects.toThrow('já possui tombamento cadastrado');
    });

    it('recusa tombamento duplicado (409) com a mensagem padrão', async () => {
      prismaMock.item.findFirst.mockResolvedValue({
        id: 'item-1',
        tipo: 'PATRIMONIAL',
        tombamento: null,
      });
      prismaMock.item.update.mockRejectedValue(p2002('tombamento'));

      await expect(
        service.completarTombamento('est-1', 'item-1', { tombamento: 'TOMB-111' }, 'user-1'),
      ).rejects.toThrow('Já existe um item com este tombamento.');
    });
  });
});

describe('CreateItemSchema', () => {
  it('aceita item patrimonial sem tombamento ou com tombamento vazio', () => {
    const semCampo = CreateItemSchema.safeParse({
      tipo: 'PATRIMONIAL',
      nome: 'Notebook',
      categoriaId: 'cat-1',
    });
    expect(semCampo.success).toBe(true);
    if (semCampo.success) {
      expect(semCampo.data.tombamento).toBeUndefined();
    }

    const vazio = CreateItemSchema.safeParse({
      tipo: 'PATRIMONIAL',
      nome: 'Notebook',
      categoriaId: 'cat-1',
      tombamento: '   ',
    });
    expect(vazio.success).toBe(true);
    if (vazio.success) {
      expect(vazio.data.tombamento).toBeUndefined();
    }
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

describe('CompletarTombamentoSchema', () => {
  it('recusa tombamento ausente ou vazio', () => {
    expect(CompletarTombamentoSchema.safeParse({}).success).toBe(false);
    expect(CompletarTombamentoSchema.safeParse({ tombamento: '   ' }).success).toBe(false);
  });

  it('aceita e faz trim em tombamento válido', () => {
    const r = CompletarTombamentoSchema.safeParse({ tombamento: '  TOMB-42  ' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.tombamento).toBe('TOMB-42');
    }
  });
});