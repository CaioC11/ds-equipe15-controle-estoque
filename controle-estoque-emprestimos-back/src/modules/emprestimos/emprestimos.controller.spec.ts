import { Test, TestingModule } from '@nestjs/testing';
import { AccessRole } from '../../common/auth/access-role.enum';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { EmprestimosController } from './emprestimos.controller';
import { EmprestimosService } from './emprestimos.service';

describe('EmprestimosController', () => {
  let controller: EmprestimosController;
  const service = { create: vi.fn(), findPendentes: vi.fn(), devolver: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmprestimosController],
      providers: [{ provide: EmprestimosService, useValue: service }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(EmprestimosController);
  });

  it('repassa o userId do usuário logado ao registrar o empréstimo', async () => {
    const dto = { itemId: 'i-1' } as never;
    await controller.create('est-1', dto, { userId: 'u1' } as never);
    expect(service.create).toHaveBeenCalledWith('est-1', dto, 'u1');
  });

  it('repassa o usuário (com o papel) ao listar os pendentes', async () => {
    const query = { page: 1, limit: 20 } as never;
    const user = { userId: 'u1', role: AccessRole.ADMIN };
    await controller.findPendentes('est-1', query, user);
    expect(service.findPendentes).toHaveBeenCalledWith('est-1', query, user);
  });

  it('repassa o userId do usuário logado ao devolver', async () => {
    await controller.devolver('est-1', 'emp-1', { userId: 'u1' } as never);
    expect(service.devolver).toHaveBeenCalledWith('est-1', 'emp-1', 'u1');
  });
});
