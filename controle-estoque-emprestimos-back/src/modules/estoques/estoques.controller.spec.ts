import { Test, TestingModule } from '@nestjs/testing';
import { AccessRole, ROLES_KEY } from '../../common/auth/decorators/roles.decorator';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { EstoquesController } from './estoques.controller';
import { EstoquesService } from './estoques.service';

describe('EstoquesController', () => {
  let controller: EstoquesController;
  const serviceMock = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    listGestores: vi.fn(),
    addGestor: vi.fn(),
    removeGestor: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EstoquesController],
      providers: [
        {
          provide: EstoquesService,
          useValue: serviceMock,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<EstoquesController>(EstoquesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('encaminha a autorização do gestor ao serviço', () => {
    serviceMock.addGestor.mockClear();
    const dto = { usuarioId: 'kc-user-1' };
    controller.addGestor('est-1', dto);
    expect(serviceMock.addGestor).toHaveBeenCalledWith('est-1', 'kc-user-1');
  });

  it('restringe os três endpoints de gestores ao ADMIN', () => {
    for (const handler of [
      EstoquesController.prototype.listGestores,
      EstoquesController.prototype.addGestor,
      EstoquesController.prototype.removeGestor,
    ]) {
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([AccessRole.ADMIN]);
    }
  });
});
