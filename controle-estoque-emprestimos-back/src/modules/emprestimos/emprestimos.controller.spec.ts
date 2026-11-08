import { StreamableFile } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AccessRole } from '../../common/auth/access-role.enum';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { EmprestimosController } from './emprestimos.controller';
import { EmprestimosService } from './emprestimos.service';

describe('EmprestimosController', () => {
  let controller: EmprestimosController;
  const service = {
    create: vi.fn(),
    findPendentes: vi.fn(),
    devolver: vi.fn(),
    obterPdf: vi.fn(),
  };

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

  it('serve o termo em linha para visualização', async () => {
    service.obterPdf.mockResolvedValue({
      pdf: Buffer.from('pdf'),
      nomeArquivo: 'termo-01-2026.pdf',
    });

    const result = await controller.visualizarTermo('est-1', 'emp-1', {
      userId: 'u1',
      role: AccessRole.USER,
    } as never);

    expect(result).toBeInstanceOf(StreamableFile);
    expect(service.obterPdf).toHaveBeenCalledWith('est-1', 'emp-1', {
      userId: 'u1',
      role: AccessRole.USER,
    });
  });

  it('serve o termo como anexo para download', async () => {
    service.obterPdf.mockResolvedValue({
      pdf: Buffer.from('pdf'),
      nomeArquivo: 'termo-01-2026.pdf',
    });

    const result = await controller.baixarTermo('est-1', 'emp-1', {
      userId: 'admin',
      role: AccessRole.ADMIN,
    } as never);

    expect(result).toBeInstanceOf(StreamableFile);
    expect(service.obterPdf).toHaveBeenCalledWith('est-1', 'emp-1', {
      userId: 'admin',
      role: AccessRole.ADMIN,
    });
  });
});
