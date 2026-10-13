import { Test, TestingModule } from '@nestjs/testing';
import { EstoquesController } from './estoques.controller';
import { EstoquesService } from './estoques.service';

describe('EstoquesController', () => {
  let controller: EstoquesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EstoquesController],
      providers: [EstoquesService],
    }).compile();

    controller = module.get<EstoquesController>(EstoquesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
