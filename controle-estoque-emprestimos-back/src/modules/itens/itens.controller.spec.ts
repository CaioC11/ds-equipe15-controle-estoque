import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { ItensController } from './itens.controller';
import { ItensService } from './itens.service';

describe('ItensController', () => {
  let controller: ItensController;
  const service = {
    create: vi.fn(),
    findAllByEstoque: vi.fn(),
    update: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ItensController],
      providers: [{ provide: ItensService, useValue: service }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ItensController);
  });

  it('repassa o userId do usuário logado ao cadastrar', async () => {
    const dto = { tipo: 'CONSUMO', nome: 'Papel', categoriaId: 'c' } as never;
    await controller.create('est-1', dto, { userId: 'u1' } as never);
    expect(service.create).toHaveBeenCalledWith('est-1', dto, 'u1');
  });

  it('lista os itens de um estoque', async () => {
    const query = { page: 1, limit: 20 } as never;
    await controller.findAll('est-1', query);
    expect(service.findAllByEstoque).toHaveBeenCalledWith('est-1', query);
  });

  it('repassa o userId do usuário logado ao editar', async () => {
    await controller.update(
      'est-1',
      'i-1',
      { nome: 'X' } as never,
      {
        userId: 'u1',
      } as never,
    );
    expect(service.update).toHaveBeenCalledWith('est-1', 'i-1', { nome: 'X' }, 'u1');
  });
});
