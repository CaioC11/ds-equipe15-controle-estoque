import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AccessRole } from '../../common/auth/access-role.enum';
import { AccessDeniedException } from '../../common/exceptions/access-denied.exception';
import { AppException } from '../../common/exceptions/app.exception';
import { ResourceConflictException } from '../../common/exceptions/resource-conflict.exception';
import { ResourceNotFoundException } from '../../common/exceptions/resource-not-found.exception';
import { PrismaService } from '../../database/prisma.service';
import { EmprestimosService, estaAtrasado } from './emprestimos.service';
import { TermoPdfService } from './termo-pdf.service';
import { TermoStorageService } from './termo-storage.service';

const prismaMock = {
  $transaction: vi.fn(),
  estoque: { findUnique: vi.fn() },
  estoqueGestor: { findUnique: vi.fn() },
  item: { findFirst: vi.fn(), update: vi.fn() },
  responsavel: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  emprestimo: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  contadorTermo: { upsert: vi.fn() },
  termo: { create: vi.fn() },
  movimentacao: { create: vi.fn() },
};

const termoPdfMock = { gerar: vi.fn() };
const termoStorageMock = { write: vi.fn(), read: vi.fn(), remove: vi.fn() };

const DIA = 24 * 60 * 60 * 1000;
const amanha = () => new Date(Date.now() + DIA);
const ontem = () => new Date(Date.now() - DIA);

const dtoBase = {
  itemId: 'item-1',
  responsavel: {
    nome: 'Maria Silva',
    siape: '1234567',
    lotacao: 'CIn',
    cargo: 'Professora',
  },
};

describe('EmprestimosService', () => {
  let service: EmprestimosService;

  beforeEach(async () => {
    vi.resetAllMocks();
    termoPdfMock.gerar.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
    termoStorageMock.write.mockResolvedValue(undefined);
    termoStorageMock.read.mockResolvedValue(Buffer.from('%PDF'));
    termoStorageMock.remove.mockResolvedValue(undefined);
    prismaMock.contadorTermo.upsert.mockImplementation(
      ({ create }: { create: { ultimoNumero: number } }) =>
        Promise.resolve({ ultimoNumero: create.ultimoNumero }),
    );
    prismaMock.termo.create.mockResolvedValue({ id: 'termo-1' });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmprestimosService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: TermoPdfService, useValue: termoPdfMock },
        { provide: TermoStorageService, useValue: termoStorageMock },
      ],
    }).compile();
    service = module.get(EmprestimosService);

    // A transação reaproveita o próprio mock como "tx"
    prismaMock.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(prismaMock));
    prismaMock.estoque.findUnique.mockResolvedValue({ id: 'est-1', nome: 'Estoque de teste' });
    prismaMock.estoqueGestor.findUnique.mockResolvedValue({
      estoqueId: 'est-1',
      usuarioId: 'user-1',
    });
  });

  describe('create', () => {
    beforeEach(() => {
      prismaMock.item.findFirst.mockResolvedValue({
        id: 'item-1',
        tipo: 'PATRIMONIAL',
        status: 'DISPONIVEL',
        nome: 'Notebook',
        tombamento: 'T-001',
        numeroSerie: null,
        descricao: 'Notebook de teste',
      });
      prismaMock.emprestimo.findFirst.mockResolvedValue(null);
      prismaMock.responsavel.findMany.mockResolvedValue([]);
      prismaMock.responsavel.create.mockResolvedValue({
        id: 'resp-1',
        ...dtoBase.responsavel,
        cpf: null,
      });
      prismaMock.emprestimo.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'emp-1',
          ...data,
          status: 'AGUARDANDO_TERMO',
        }),
      );
      prismaMock.emprestimo.update.mockResolvedValue({
        id: 'emp-1',
        status: 'AGUARDANDO_TERMO',
        termo: { id: 'termo-1', numeroAno: '01/2026' },
      });
    });

    it('registra o empréstimo (aguardando termo) com responsável novo e gera movimentação SAIDA', async () => {
      const prazo = amanha();

      const result = await service.create('est-1', { ...dtoBase, prazoDevolucao: prazo }, 'user-1');

      expect(result).toMatchObject({ id: 'emp-1', status: 'AGUARDANDO_TERMO' });
      expect(prismaMock.responsavel.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nome: 'Maria Silva',
          siape: '1234567',
          cargo: 'Professora',
        }),
      });
      const { data } = prismaMock.emprestimo.create.mock.calls[0][0];
      expect(data).toMatchObject({
        itemId: 'item-1',
        responsavelId: 'resp-1',
        prazoDevolucao: prazo,
      });
      expect(data.dataRetirada).toBeInstanceOf(Date);
      // o status não é informado: vale o default AGUARDANDO_TERMO do schema
      expect(data.status).toBeUndefined();
      expect(prismaMock.movimentacao.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 'item-1',
          tipo: 'SAIDA',
          quantidade: 1,
          usuarioId: 'user-1',
        }),
      });
      expect(prismaMock.termo.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          numeroAno: expect.stringMatching(/^\d{2}\/\d{4}$/),
          arquivoPdf: expect.stringMatching(/^\d{4}\/.+\.pdf$/),
        }),
      });
      expect(prismaMock.emprestimo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'emp-1' },
          data: { termoId: 'termo-1' },
        }),
      );
      expect(termoPdfMock.gerar).toHaveBeenCalledWith(
        expect.objectContaining({
          responsavel: expect.objectContaining({ siape: '1234567' }),
          unidade: 'Estoque de teste',
          item: expect.objectContaining({ nome: 'Notebook', tombamento: 'T-001' }),
        }),
      );
    });

    it('usa o próximo número do contador anual ao criar o termo', async () => {
      const ano = new Date().getFullYear();
      prismaMock.contadorTermo.upsert.mockResolvedValue({ ultimoNumero: 17 });

      await service.create('est-1', dtoBase, 'user-1');

      expect(prismaMock.contadorTermo.upsert).toHaveBeenCalledWith({
        where: { ano },
        create: { ano, ultimoNumero: 1 },
        update: { ultimoNumero: { increment: 1 } },
      });
      expect(prismaMock.termo.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ numeroAno: `17/${ano}` }),
      });
    });

    it('guarda prazo nulo quando não é informado ("indefinido")', async () => {
      await service.create('est-1', dtoBase, 'user-1');

      const { data } = prismaMock.emprestimo.create.mock.calls[0][0];
      expect(data.prazoDevolucao).toBeNull();
    });

    it('reaproveita responsável já cadastrado (mesmo Siape) em vez de criar outro', async () => {
      prismaMock.responsavel.findMany.mockResolvedValue([{ id: 'resp-9' }]);
      prismaMock.responsavel.update.mockResolvedValue({ id: 'resp-9', nome: 'Maria Silva' });

      await service.create('est-1', dtoBase, 'user-1');

      expect(prismaMock.responsavel.create).not.toHaveBeenCalled();
      expect(prismaMock.responsavel.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'resp-9' } }),
      );
      expect(prismaMock.emprestimo.create.mock.calls[0][0].data.responsavelId).toBe('resp-9');
    });

    it('recusa (409) quando Siape e CPF pertencem a responsáveis diferentes', async () => {
      prismaMock.responsavel.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);

      await expect(
        service.create(
          'est-1',
          { ...dtoBase, responsavel: { ...dtoBase.responsavel, cpf: '12345678901' } },
          'user-1',
        ),
      ).rejects.toBeInstanceOf(ResourceConflictException);
      expect(prismaMock.emprestimo.create).not.toHaveBeenCalled();
    });

    it('recusa (409) item que já tem empréstimo aguardando termo ou ativo', async () => {
      prismaMock.emprestimo.findFirst.mockResolvedValue({
        id: 'emp-0',
        status: 'AGUARDANDO_TERMO',
      });

      await expect(service.create('est-1', dtoBase, 'user-1')).rejects.toBeInstanceOf(
        ResourceConflictException,
      );
      expect(prismaMock.emprestimo.findFirst).toHaveBeenCalledWith({
        where: { itemId: 'item-1', status: { in: ['AGUARDANDO_TERMO', 'ATIVO'] } },
      });
      expect(prismaMock.emprestimo.create).not.toHaveBeenCalled();
      expect(prismaMock.movimentacao.create).not.toHaveBeenCalled();
    });

    it('recusa (409) item que não está disponível (ex.: já emprestado)', async () => {
      prismaMock.item.findFirst.mockResolvedValue({
        id: 'item-1',
        tipo: 'PATRIMONIAL',
        status: 'EMPRESTADO',
      });

      await expect(service.create('est-1', dtoBase, 'user-1')).rejects.toBeInstanceOf(
        ResourceConflictException,
      );
    });

    it('recusa (400) item de consumo', async () => {
      prismaMock.item.findFirst.mockResolvedValue({
        id: 'item-1',
        tipo: 'CONSUMO',
        status: 'DISPONIVEL',
      });

      await expect(service.create('est-1', dtoBase, 'user-1')).rejects.toThrow('consumo');
      await expect(service.create('est-1', dtoBase, 'user-1')).rejects.toBeInstanceOf(AppException);
      expect(prismaMock.emprestimo.create).not.toHaveBeenCalled();
    });

    it('recusa (400) prazo anterior à data de retirada', async () => {
      await expect(
        service.create(
          'est-1',
          { ...dtoBase, dataRetirada: new Date(), prazoDevolucao: ontem() },
          'user-1',
        ),
      ).rejects.toBeInstanceOf(AppException);
    });

    it('recusa (403) quem não é gestor do estoque', async () => {
      prismaMock.estoqueGestor.findUnique.mockResolvedValue(null);

      await expect(service.create('est-1', dtoBase, 'outro-user')).rejects.toBeInstanceOf(
        AccessDeniedException,
      );
      expect(prismaMock.emprestimo.create).not.toHaveBeenCalled();
    });

    it('recusa (403) quando não há usuário identificado', async () => {
      await expect(service.create('est-1', dtoBase, undefined)).rejects.toBeInstanceOf(
        AccessDeniedException,
      );
    });

    it('retorna 404 quando o estoque não existe', async () => {
      prismaMock.estoque.findUnique.mockResolvedValue(null);

      await expect(service.create('x', dtoBase, 'user-1')).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it('retorna 404 quando o item não pertence ao estoque', async () => {
      prismaMock.item.findFirst.mockResolvedValue(null);

      await expect(service.create('est-1', dtoBase, 'user-1')).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(prismaMock.item.findFirst).toHaveBeenCalledWith({
        where: { id: 'item-1', estoqueId: 'est-1' },
      });
    });

    it('traduz P2002 (cadastro simultâneo do responsável) em 409', async () => {
      prismaMock.responsavel.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['siape'] },
        }),
      );

      await expect(service.create('est-1', dtoBase, 'user-1')).rejects.toBeInstanceOf(
        ResourceConflictException,
      );
    });
  });

  describe('obterPdf', () => {
    beforeEach(() => {
      prismaMock.emprestimo.findFirst.mockResolvedValue({
        termo: { arquivoPdf: '2026/termo.pdf', numeroAno: '01/2026' },
      });
    });

    it('permite ao gestor consultar e baixar o termo do próprio estoque', async () => {
      const result = await service.obterPdf('est-1', 'emp-1', {
        userId: 'user-1',
        role: AccessRole.USER,
      });

      expect(result).toEqual({
        pdf: Buffer.from('%PDF'),
        nomeArquivo: 'termo-01-2026.pdf',
      });
      expect(prismaMock.emprestimo.findFirst).toHaveBeenCalledWith({
        where: { id: 'emp-1', item: { estoqueId: 'est-1' } },
        include: { termo: true },
      });
      expect(termoStorageMock.read).toHaveBeenCalledWith('2026/termo.pdf');
    });

    it('permite ao ADMIN consultar qualquer estoque', async () => {
      prismaMock.estoqueGestor.findUnique.mockResolvedValue(null);

      await expect(
        service.obterPdf('est-1', 'emp-1', { userId: 'admin-1', role: AccessRole.ADMIN }),
      ).resolves.toBeDefined();
      expect(prismaMock.estoqueGestor.findUnique).not.toHaveBeenCalled();
    });

    it('recusa (403) usuário que não é gestor nem ADMIN', async () => {
      prismaMock.estoqueGestor.findUnique.mockResolvedValue(null);

      await expect(
        service.obterPdf('est-1', 'emp-1', { userId: 'user-2', role: AccessRole.USER }),
      ).rejects.toBeInstanceOf(AccessDeniedException);
      expect(prismaMock.emprestimo.findFirst).not.toHaveBeenCalled();
    });

    it('retorna 404 quando o empréstimo não existe no estoque', async () => {
      prismaMock.emprestimo.findFirst.mockResolvedValue(null);

      await expect(
        service.obterPdf('est-1', 'emp-404', { userId: 'user-1', role: AccessRole.USER }),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });

    it('retorna 404 quando o empréstimo ainda não possui termo', async () => {
      prismaMock.emprestimo.findFirst.mockResolvedValue({ termo: null });

      await expect(
        service.obterPdf('est-1', 'emp-1', { userId: 'user-1', role: AccessRole.USER }),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });
  });

  describe('devolver', () => {
    const ativo = { id: 'emp-1', itemId: 'item-1', status: 'ATIVO' };

    beforeEach(() => {
      prismaMock.emprestimo.findFirst.mockResolvedValue(ativo);
      prismaMock.emprestimo.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.emprestimo.findUniqueOrThrow.mockResolvedValue({ ...ativo, status: 'DEVOLVIDO' });
    });

    it('devolve empréstimo ativo: registra data, libera o item e gera movimentação DEVOLUCAO', async () => {
      const result = await service.devolver('est-1', 'emp-1', 'user-1');

      expect(result).toMatchObject({ status: 'DEVOLVIDO' });
      const { where, data } = prismaMock.emprestimo.updateMany.mock.calls[0][0];
      expect(where).toEqual({ id: 'emp-1', status: 'ATIVO' });
      expect(data.status).toBe('DEVOLVIDO');
      expect(data.dataDevolucaoEfetiva).toBeInstanceOf(Date);
      expect(prismaMock.item.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { status: 'DISPONIVEL' },
      });
      expect(prismaMock.movimentacao.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ itemId: 'item-1', tipo: 'DEVOLUCAO', usuarioId: 'user-1' }),
      });
    });

    it.each([
      'AGUARDANDO_TERMO',
      'DEVOLVIDO',
      'CANCELADO',
    ])('recusa (409) devolução de empréstimo %s', async (status) => {
      prismaMock.emprestimo.findFirst.mockResolvedValue({ ...ativo, status });

      await expect(service.devolver('est-1', 'emp-1', 'user-1')).rejects.toBeInstanceOf(
        ResourceConflictException,
      );
      expect(prismaMock.emprestimo.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.item.update).not.toHaveBeenCalled();
      expect(prismaMock.movimentacao.create).not.toHaveBeenCalled();
    });

    it('recusa (409) devolução dupla simultânea (nenhuma linha atualizada)', async () => {
      prismaMock.emprestimo.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.devolver('est-1', 'emp-1', 'user-1')).rejects.toBeInstanceOf(
        ResourceConflictException,
      );
      expect(prismaMock.item.update).not.toHaveBeenCalled();
    });

    it('retorna 404 quando o empréstimo não pertence ao estoque', async () => {
      prismaMock.emprestimo.findFirst.mockResolvedValue(null);

      await expect(service.devolver('est-1', 'emp-9', 'user-1')).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(prismaMock.emprestimo.findFirst).toHaveBeenCalledWith({
        where: { id: 'emp-9', item: { estoqueId: 'est-1' } },
      });
    });

    it('recusa (403) quem não é gestor do estoque', async () => {
      prismaMock.estoqueGestor.findUnique.mockResolvedValue(null);

      await expect(service.devolver('est-1', 'emp-1', 'outro-user')).rejects.toBeInstanceOf(
        AccessDeniedException,
      );
      expect(prismaMock.emprestimo.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('findPendentes', () => {
    const query = { page: 2, limit: 10 } as never;

    beforeEach(() => {
      prismaMock.emprestimo.findMany.mockResolvedValue([]);
      prismaMock.emprestimo.count.mockResolvedValue(0);
    });

    it('lista só aguardando termo e ativos do estoque, com paginação', async () => {
      prismaMock.emprestimo.count.mockResolvedValue(21);

      const result = await service.findPendentes('est-1', query, {
        userId: 'user-1',
        role: AccessRole.USER,
      });

      expect(prismaMock.emprestimo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: { in: ['AGUARDANDO_TERMO', 'ATIVO'] }, item: { estoqueId: 'est-1' } },
          skip: 10,
          take: 10,
        }),
      );
      expect(result.meta).toEqual({ page: 2, limit: 10, total: 21, totalPages: 3 });
    });

    it('calcula "atrasado" pela data prevista, sem estado salvo', async () => {
      prismaMock.emprestimo.findMany.mockResolvedValue([
        { id: 'a', status: 'ATIVO', prazoDevolucao: ontem() },
        { id: 'b', status: 'ATIVO', prazoDevolucao: amanha() },
        { id: 'c', status: 'ATIVO', prazoDevolucao: null },
        { id: 'd', status: 'AGUARDANDO_TERMO', prazoDevolucao: ontem() },
      ]);

      const result = await service.findPendentes('est-1', query, {
        userId: 'user-1',
        role: AccessRole.USER,
      });

      expect(result.items.map((e) => [e.id, e.atrasado])).toEqual([
        ['a', true],
        ['b', false],
        ['c', false],
        ['d', false],
      ]);
    });

    it('permite o ADMIN consultar qualquer estoque (somente leitura)', async () => {
      prismaMock.estoqueGestor.findUnique.mockResolvedValue(null);

      await expect(
        service.findPendentes('est-1', query, { userId: 'admin-1', role: AccessRole.ADMIN }),
      ).resolves.toBeDefined();
    });

    it('recusa (403) quem não é gestor do estoque nem ADMIN', async () => {
      prismaMock.estoqueGestor.findUnique.mockResolvedValue(null);

      await expect(
        service.findPendentes('est-1', query, { userId: 'req-1', role: AccessRole.USER }),
      ).rejects.toBeInstanceOf(AccessDeniedException);
      expect(prismaMock.emprestimo.findMany).not.toHaveBeenCalled();
    });

    it('retorna 404 quando o estoque não existe', async () => {
      prismaMock.estoque.findUnique.mockResolvedValue(null);

      await expect(
        service.findPendentes('x', query, { userId: 'user-1', role: AccessRole.USER }),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });
  });
});

describe('estaAtrasado', () => {
  it('só considera atrasado o empréstimo ATIVO com prazo vencido', () => {
    expect(estaAtrasado({ status: 'ATIVO', prazoDevolucao: ontem() } as never)).toBe(true);
    expect(estaAtrasado({ status: 'ATIVO', prazoDevolucao: amanha() } as never)).toBe(false);
    expect(estaAtrasado({ status: 'ATIVO', prazoDevolucao: null } as never)).toBe(false);
    expect(estaAtrasado({ status: 'DEVOLVIDO', prazoDevolucao: ontem() } as never)).toBe(false);
    expect(estaAtrasado({ status: 'AGUARDANDO_TERMO', prazoDevolucao: ontem() } as never)).toBe(
      false,
    );
  });
});
