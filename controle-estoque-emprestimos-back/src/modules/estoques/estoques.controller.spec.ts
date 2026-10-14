import { Test, TestingModule } from '@nestjs/testing';
import { EstoquesController } from './estoques.controller';
import { EstoquesService } from './estoques.service';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';

describe('EstoquesController', () => {
  let controller: EstoquesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EstoquesController],
      providers: [
        {
          provide: EstoquesService,
          useValue: {
            create: vi.fn(),
            findAll: vi.fn(),
            findOne: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
          },
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
});