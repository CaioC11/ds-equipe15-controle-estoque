import { Test, TestingModule } from '@nestjs/testing';
import { AccessRole } from '../../common/auth/access-role.enum';
import { AccessDeniedException } from '../../common/exceptions/access-denied.exception';
import { AppException } from '../../common/exceptions/app.exception';
import { ResourceConflictException } from '../../common/exceptions/resource-conflict.exception';
import { ResourceNotFoundException } from '../../common/exceptions/resource-not-found.exception';
import { PrismaService } from '../../database/prisma.service';
import { EmprestimosService } from './emprestimos.service';
import { TERMO_ASSINADO_MAX_BYTES } from './termo-assinado.constants';
import { TermoPdfService } from './termo-pdf.service';
import { TermoStorageService } from './termo-storage.service';

const prismaMock = {
  $transaction: vi.fn(),
  estoque: { findUnique: vi.fn() },
  estoqueGestor: { findUnique: vi.fn() },
  item: { update: vi.fn() },
  emprestimo: {
    findFirst: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    updateMany: vi.fn(),
  },
  termo: { update: vi.fn() },
};
const storageMock = { write: vi.fn(), read: vi.fn(), remove: vi.fn() };

const pdfValido = (overrides = {}) => ({
  originalname: 'termo.pdf',
  mimetype: 'application/pdf',
  size: 10,
  buffer: Buffer.from('%PDF-1.7 conteudo'),
  ...overrides,
});

const emprestimoBase = {
  id: 'emp-1',
  itemId: 'item-1',
  status: 'AGUARDANDO_TERMO',
  termo: { id: 'termo-1', numeroAno: '01/2026', arquivoPdf: 'a.pdf', arquivoAssinado: null },
};

const comAssinado = {
  ...emprestimoBase,
  termo: { ...emprestimoBase.termo, arquivoAssinado: '2026/assinados/x.pdf' },
};

describe('EmprestimosService - termo assinado e confirmação de entrega', () => {
  let service: EmprestimosService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmprestimosService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: TermoPdfService, useValue: { gerar: vi.fn() } },
        { provide: TermoStorageService, useValue: storageMock },
      ],
    }).compile();
    service = module.get(EmprestimosService);

    prismaMock.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(prismaMock));
    prismaMock.estoque.findUnique.mockResolvedValue({ id: 'est-1' });
    prismaMock.estoqueGestor.findUnique.mockResolvedValue({ estoqueId: 'est-1', usuarioId: 'u1' });
    storageMock.write.mockResolvedValue(undefined);
    storageMock.remove.mockResolvedValue(undefined);
    prismaMock.termo.update.mockResolvedValue({});
    prismaMock.emprestimo.findUniqueOrThrow.mockResolvedValue({ id: 'emp-1' });
  });

  describe('anexarTermoAssinado', () => {
    it('grava o PDF e vincula ao termo', async () => {
      prismaMock.emprestimo.findFirst.mockResolvedValue(emprestimoBase);

      await service.anexarTermoAssinado('est-1', 'emp-1', pdfValido(), 'u1');

      expect(storageMock.write).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{4}\/assinados\/.+\.pdf$/),
        expect.any(Buffer),
      );
      expect(prismaMock.termo.update).toHaveBeenCalledWith({
        where: { id: 'termo-1' },
        data: { arquivoAssinado: expect.stringContaining('/assinados/') },
      });
    });

    it('remove o arquivo anterior ao reenviar', async () => {
      prismaMock.emprestimo.findFirst.mockResolvedValue(comAssinado);

      await service.anexarTermoAssinado('est-1', 'emp-1', pdfValido(), 'u1');

      expect(storageMock.remove).toHaveBeenCalledWith('2026/assinados/x.pdf');
    });

    it('desfaz a gravação se o vínculo no banco falhar', async () => {
      prismaMock.emprestimo.findFirst.mockResolvedValue(emprestimoBase);
      prismaMock.termo.update.mockRejectedValue(new Error('db'));

      await expect(
        service.anexarTermoAssinado('est-1', 'emp-1', pdfValido(), 'u1'),
      ).rejects.toThrow('db');
      expect(storageMock.remove).toHaveBeenCalledTimes(1);
    });

    it('403 para quem não é gestor do estoque', async () => {
      prismaMock.estoqueGestor.findUnique.mockResolvedValue(null);
      await expect(
        service.anexarTermoAssinado('est-1', 'emp-1', pdfValido(), 'outro'),
      ).rejects.toBeInstanceOf(AccessDeniedException);
      expect(storageMock.write).not.toHaveBeenCalled();
    });

    it('404 para empréstimo inexistente', async () => {
      prismaMock.emprestimo.findFirst.mockResolvedValue(null);
      await expect(
        service.anexarTermoAssinado('est-1', 'nada', pdfValido(), 'u1'),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });

    it('409 se o empréstimo não está aguardando termo', async () => {
      prismaMock.emprestimo.findFirst.mockResolvedValue({ ...emprestimoBase, status: 'ATIVO' });
      await expect(
        service.anexarTermoAssinado('est-1', 'emp-1', pdfValido(), 'u1'),
      ).rejects.toBeInstanceOf(ResourceConflictException);
    });

    it.each([
      ['ausente', undefined],
      ['com mimetype não-PDF', pdfValido({ mimetype: 'image/png' })],
      ['que não é PDF (mimetype forjado)', pdfValido({ buffer: Buffer.from('MZ exe') })],
      ['acima do limite', pdfValido({ size: TERMO_ASSINADO_MAX_BYTES + 1 })],
    ])('400 para arquivo %s', async (_nome, arquivo) => {
      prismaMock.emprestimo.findFirst.mockResolvedValue(emprestimoBase);
      await expect(
        service.anexarTermoAssinado('est-1', 'emp-1', arquivo, 'u1'),
      ).rejects.toBeInstanceOf(AppException);
      expect(storageMock.write).not.toHaveBeenCalled();
    });
  });

  describe('confirmarEntrega', () => {
    it('ativa o empréstimo e marca o item como EMPRESTADO', async () => {
      prismaMock.emprestimo.findFirst.mockResolvedValue(comAssinado);
      prismaMock.emprestimo.updateMany.mockResolvedValue({ count: 1 });

      await service.confirmarEntrega('est-1', 'emp-1', 'u1');

      expect(prismaMock.emprestimo.updateMany).toHaveBeenCalledWith({
        where: { id: 'emp-1', status: 'AGUARDANDO_TERMO' },
        data: { status: 'ATIVO' },
      });
      expect(prismaMock.item.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { status: 'EMPRESTADO' },
      });
    });

    it('409 sem termo assinado anexado (e não altera nada)', async () => {
      prismaMock.emprestimo.findFirst.mockResolvedValue(emprestimoBase);
      await expect(service.confirmarEntrega('est-1', 'emp-1', 'u1')).rejects.toBeInstanceOf(
        ResourceConflictException,
      );
      expect(prismaMock.emprestimo.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.item.update).not.toHaveBeenCalled();
    });

    it('409 se já estiver ativo', async () => {
      prismaMock.emprestimo.findFirst.mockResolvedValue({ ...comAssinado, status: 'ATIVO' });
      await expect(service.confirmarEntrega('est-1', 'emp-1', 'u1')).rejects.toBeInstanceOf(
        ResourceConflictException,
      );
    });

    it('409 em confirmação simultânea (count 0)', async () => {
      prismaMock.emprestimo.findFirst.mockResolvedValue(comAssinado);
      prismaMock.emprestimo.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.confirmarEntrega('est-1', 'emp-1', 'u1')).rejects.toBeInstanceOf(
        ResourceConflictException,
      );
      expect(prismaMock.item.update).not.toHaveBeenCalled();
    });

    it('403 para não-gestor', async () => {
      prismaMock.estoqueGestor.findUnique.mockResolvedValue(null);
      await expect(service.confirmarEntrega('est-1', 'emp-1', 'x')).rejects.toBeInstanceOf(
        AccessDeniedException,
      );
    });

    it('404 para empréstimo inexistente', async () => {
      prismaMock.emprestimo.findFirst.mockResolvedValue(null);
      await expect(service.confirmarEntrega('est-1', 'nada', 'u1')).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  describe('obterPdfAssinado', () => {
    const gestor = { userId: 'u1', role: AccessRole.USER } as never;

    it('devolve o PDF assinado ao gestor', async () => {
      prismaMock.emprestimo.findFirst.mockResolvedValue(comAssinado);
      storageMock.read.mockResolvedValue(Buffer.from('%PDF-'));

      const r = await service.obterPdfAssinado('est-1', 'emp-1', gestor);

      expect(r.nomeArquivo).toBe('termo-01-2026-assinado.pdf');
      expect(storageMock.read).toHaveBeenCalledWith('2026/assinados/x.pdf');
    });

    it('404 quando ainda não há termo assinado', async () => {
      prismaMock.emprestimo.findFirst.mockResolvedValue(emprestimoBase);
      await expect(service.obterPdfAssinado('est-1', 'emp-1', gestor)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });
});
