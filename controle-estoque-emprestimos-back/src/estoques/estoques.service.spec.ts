import { Test, TestingModule } from '@nestjs/testing';
import { EstoquesService } from './estoques.service';

describe('EstoquesService', () => {
  let service: EstoquesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EstoquesService],
    }).compile();

    service = module.get<EstoquesService>(EstoquesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
