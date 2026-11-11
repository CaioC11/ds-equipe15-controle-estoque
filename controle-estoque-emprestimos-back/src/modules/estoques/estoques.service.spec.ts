import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { EstoquesService } from './estoques.service';

describe('EstoquesService', () => {
  let service: EstoquesService;
  const prismaMock = {
    estoque: { findUnique: vi.fn() },
    estoqueGestor: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstoquesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<EstoquesService>(EstoquesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('lista gestores do estoque após validar que o estoque existe', async () => {
    prismaMock.estoque.findUnique.mockResolvedValue({ id: 'est-1' });
    prismaMock.estoqueGestor.findMany.mockResolvedValue([
      { estoqueId: 'est-1', usuarioId: 'kc-user-1' },
    ]);

    await expect(service.listGestores('est-1')).resolves.toEqual([
      { estoqueId: 'est-1', usuarioId: 'kc-user-1' },
    ]);
    expect(prismaMock.estoqueGestor.findMany).toHaveBeenCalledWith({
      where: { estoqueId: 'est-1' },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('cria vínculo de gestor', async () => {
    prismaMock.estoque.findUnique.mockResolvedValue({ id: 'est-1' });
    prismaMock.estoqueGestor.findUnique.mockResolvedValue(null);
    prismaMock.estoqueGestor.create.mockResolvedValue({
      estoqueId: 'est-1',
      usuarioId: 'kc-user-1',
    });

    await expect(service.addGestor('est-1', 'kc-user-1')).resolves.toEqual({
      estoqueId: 'est-1',
      usuarioId: 'kc-user-1',
    });
    expect(prismaMock.estoqueGestor.create).toHaveBeenCalledWith({
      data: { estoqueId: 'est-1', usuarioId: 'kc-user-1' },
    });
  });

  it('recusa vínculo duplicado', async () => {
    prismaMock.estoque.findUnique.mockResolvedValue({ id: 'est-1' });
    prismaMock.estoqueGestor.findUnique.mockResolvedValue({
      estoqueId: 'est-1',
      usuarioId: 'kc-user-1',
    });

    await expect(service.addGestor('est-1', 'kc-user-1')).rejects.toMatchObject({
      status: 409,
    });
    expect(prismaMock.estoqueGestor.create).not.toHaveBeenCalled();
  });

  it('remove vínculo existente', async () => {
    prismaMock.estoque.findUnique.mockResolvedValue({ id: 'est-1' });
    prismaMock.estoqueGestor.findUnique.mockResolvedValue({
      estoqueId: 'est-1',
      usuarioId: 'kc-user-1',
    });
    prismaMock.estoqueGestor.delete.mockResolvedValue({
      estoqueId: 'est-1',
      usuarioId: 'kc-user-1',
    });

    await service.removeGestor('est-1', 'kc-user-1');
    expect(prismaMock.estoqueGestor.delete).toHaveBeenCalledWith({
      where: { estoqueId_usuarioId: { estoqueId: 'est-1', usuarioId: 'kc-user-1' } },
    });
  });

  it('retorna 404 quando o estoque não existe', async () => {
    prismaMock.estoque.findUnique.mockResolvedValue(null);
    await expect(service.listGestores('inexistente')).rejects.toMatchObject({
      status: 404,
    });
  });
});
