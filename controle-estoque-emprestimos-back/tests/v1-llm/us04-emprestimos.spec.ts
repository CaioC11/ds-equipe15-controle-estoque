// ARQUIVO: tests/v1-llm/us04-emprestimos.spec.ts
import { HttpStatus } from '@nestjs/common';
import { StatusEmprestimo, StatusItem, TipoItem, TipoMovimentacao } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessRole } from '../../src/common/auth/access-role.enum';
import { AccessDeniedException } from '../../src/common/exceptions/access-denied.exception';
import { AppException } from '../../src/common/exceptions/app.exception';
import { ResourceConflictException } from '../../src/common/exceptions/resource-conflict.exception';
import { ResourceNotFoundException } from '../../src/common/exceptions/resource-not-found.exception';
import { CreateEmprestimoSchema } from '../../src/modules/emprestimos/dto/create-emprestimo.dto';
import { EmprestimosService, estaAtrasado } from '../../src/modules/emprestimos/emprestimos.service';
import {
  PDF_MAGIC,
  TERMO_ASSINADO_MAX_BYTES,
  TERMO_ASSINADO_MIME,
} from '../../src/modules/emprestimos/termo-assinado.constants';

// Isola o formato da paginação: o foco aqui é a regra do empréstimo, não o DTO de paginação
vi.mock('../../src/common/pagination/paginated-response.dto', () => ({
  PaginatedResponseDto: {
    of: (items: unknown[], total: number, query: unknown) => ({ items, total, query }),
  },
}));

// ---------------------------------------------------------------------------
// Fixtures e helpers
// ---------------------------------------------------------------------------
const AGORA = new Date('2026-11-13T12:00:00.000Z');
const UM_DIA = 24 * 60 * 60 * 1000;
const ESTOQUE_ID = 'est-1';
const USER_ID = 'user-gestor';

const TIPO_NAO_CONSUMO = Object.values(TipoItem).find((t) => t !== TipoItem.CONSUMO) as TipoItem;
const ROLE_NAO_ADMIN = (Object.values(AccessRole).find((r) => r !== AccessRole.ADMIN) ??
  'GESTOR') as AccessRole;

const ESTOQUE = { id: ESTOQUE_ID, nome: 'Laboratório de Informática' };
const ITEM = {
  id: 'item-1',
  estoqueId: ESTOQUE_ID,
  nome: 'Notebook',
  tipo: TIPO_NAO_CONSUMO,
  status: StatusItem.DISPONIVEL,
  tombamento: '123456',
  numeroSerie: 'SN-1',
  descricao: 'Notebook 14"',
};
const RESPONSAVEL = {
  id: 'resp-1',
  nome: 'Maria Souza',
  siape: '1234567',
  cpf: null,
  lotacao: 'DCC',
  cargo: 'Docente',
  email: null,
};

const criarDto = (over: Record<string, unknown> = {}) =>
  ({
    itemId: ITEM.id,
    responsavel: { nome: 'Maria Souza', siape: '1234567', lotacao: 'DCC', cargo: 'Docente' },
    ...over,
  }) as any;

const emprestimoBase = (over: Record<string, unknown> = {}) => ({
  id: 'emp-1',
  itemId: ITEM.id,
  responsavelId: RESPONSAVEL.id,
  status: StatusEmprestimo.AGUARDANDO_TERMO,
  dataRetirada: new Date('2026-11-01T00:00:00.000Z'),
  prazoDevolucao: null as Date | null,
  dataDevolucaoEfetiva: null,
  termoId: 'termo-1',
  item: ITEM,
  responsavel: RESPONSAVEL,
  termo: { id: 'termo-1', numeroAno: '01/2026', arquivoPdf: '2026/a.pdf', arquivoAssinado: null as string | null },
  ...over,
});

const arquivoPdf = (over: Record<string, unknown> = {}) => {
  const buffer = Buffer.concat([PDF_MAGIC, Buffer.from('-1.4 conteudo')]);
  return { buffer, size: buffer.length, mimetype: TERMO_ASSINADO_MIME, originalname: 'termo.pdf', ...over } as any;
};

async function erroDe(promessa: Promise<unknown>): Promise<any> {
  try {
    await promessa;
  } catch (e) {
    return e;
  }
  throw new Error('Esperava que a promessa fosse rejeitada');
}

function criarPrisma() {
  const prisma: any = {
    estoque: { findUnique: vi.fn() },
    estoqueGestor: { findUnique: vi.fn() },
    item: { findFirst: vi.fn(), update: vi.fn() },
    responsavel: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    emprestimo: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    movimentacao: { create: vi.fn() },
    contadorTermo: { upsert: vi.fn() },
    termo: { create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(prisma));
  // Padrões: usuário é gestor de um estoque existente
  prisma.estoque.findUnique.mockResolvedValue(ESTOQUE);
  prisma.estoqueGestor.findUnique.mockResolvedValue({ estoqueId: ESTOQUE_ID, usuarioId: USER_ID });
  return prisma;
}

function configurarCaminhoFelizDeCreate(prisma: any, termoPdf: any, termoStorage: any) {
  prisma.item.findFirst.mockResolvedValue(ITEM);
  prisma.emprestimo.findFirst.mockResolvedValue(null);
  prisma.responsavel.findMany.mockResolvedValue([]);
  prisma.responsavel.create.mockResolvedValue(RESPONSAVEL);
  prisma.responsavel.update.mockResolvedValue(RESPONSAVEL);
  prisma.emprestimo.create.mockImplementation(async ({ data }: any) => ({
    id: 'emp-1',
    ...data,
    status: StatusEmprestimo.AGUARDANDO_TERMO,
    item: ITEM,
    responsavel: RESPONSAVEL,
    termo: null,
  }));
  prisma.movimentacao.create.mockResolvedValue({});
  prisma.contadorTermo.upsert.mockResolvedValue({ ultimoNumero: 1 });
  prisma.termo.create.mockImplementation(async ({ data }: any) => ({ id: 'termo-1', ...data }));
  prisma.emprestimo.update.mockImplementation(async ({ data }: any) => ({
    id: 'emp-1',
    status: StatusEmprestimo.AGUARDANDO_TERMO,
    ...data,
    item: ITEM,
    responsavel: RESPONSAVEL,
    termo: { id: 'termo-1', numeroAno: '01/2026', arquivoAssinado: null },
  }));
  termoPdf.gerar.mockResolvedValue(Buffer.from('%PDF-gerado'));
  termoStorage.write.mockResolvedValue(undefined);
  termoStorage.remove.mockResolvedValue(undefined);
}

let prisma: any;
let termoPdf: { gerar: ReturnType<typeof vi.fn> };
let termoStorage: { write: ReturnType<typeof vi.fn>; read: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
let service: EmprestimosService;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
  prisma = criarPrisma();
  termoPdf = { gerar: vi.fn() };
  termoStorage = { write: vi.fn(), read: vi.fn(), remove: vi.fn() };
  service = new EmprestimosService(prisma, termoPdf as any, termoStorage as any);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// DTO: CreateEmprestimoSchema
// ---------------------------------------------------------------------------
describe('CreateEmprestimoSchema (validação de entrada)', () => {
  const entrada = (over: Record<string, unknown> = {}, responsavel: Record<string, unknown> = {}) => ({
    itemId: 'item-1',
    responsavel: { nome: 'Maria Souza', siape: '1234567', lotacao: 'DCC', cargo: 'Docente', ...responsavel },
    ...over,
  });
  const caminhos = (r: any) => r.error.issues.map((i: any) => i.path.join('.'));

  it('aceita a entrada mínima válida identificada por Siape', () => {
    // Técnica: partição (classe válida) | Requisito: CA1
    expect(CreateEmprestimoSchema.safeParse(entrada()).success).toBe(true);
  });

  it('aceita responsável identificado apenas por CPF', () => {
    // Técnica: partição (classe válida: só CPF) | Requisito: CA1, CA2
    const r = CreateEmprestimoSchema.safeParse(entrada({}, { siape: undefined, cpf: '12345678901' }));
    expect(r.success).toBe(true);
  });

  it('aceita Siape e CPF informados juntos', () => {
    // Técnica: partição (classe válida: ambos) | Requisito: CA2
    const r = CreateEmprestimoSchema.safeParse(entrada({}, { cpf: '12345678901' }));
    expect(r.success).toBe(true);
  });

  it('normaliza CPF com máscara para 11 dígitos', () => {
    // Técnica: partição (CPF mascarado válido) | Requisito: CA2
    const r: any = CreateEmprestimoSchema.safeParse(entrada({}, { siape: undefined, cpf: '123.456.789-01' }));
    expect(r.success).toBe(true);
    expect(r.data.responsavel.cpf).toBe('12345678901');
  });

  it.each([
    ['10 dígitos (abaixo do limite)', '1234567890', false],
    ['11 dígitos (limite válido)', '12345678901', true],
    ['12 dígitos (acima do limite)', '123456789012', false],
    ['sem dígitos', 'abc.def.ghi-jk', false],
  ])('CPF com %s', (_desc, cpf, valido) => {
    // Técnica: valor-limite (tamanho do CPF 10/11/12) | Requisito: CA1, CA2
    const r = CreateEmprestimoSchema.safeParse(entrada({}, { siape: undefined, cpf }));
    expect(r.success).toBe(valido);
  });

  it('rejeita responsável sem Siape e sem CPF', () => {
    // Técnica: partição (classe inválida: nenhum identificador) | Requisito: CA2
    const r: any = CreateEmprestimoSchema.safeParse(entrada({}, { siape: undefined }));
    expect(r.success).toBe(false);
    expect(caminhos(r)).toContain('responsavel.siape');
  });

  it.each([
    ['vazio (0 caracteres)', '', false],
    ['somente espaços', '   ', false],
    ['1 caractere (limite mínimo)', '7', true],
  ])('Siape %s', (_desc, siape, valido) => {
    // Técnica: valor-limite (tamanho mínimo do Siape) | Requisito: CA1
    const r = CreateEmprestimoSchema.safeParse(entrada({}, { siape }));
    expect(r.success).toBe(valido);
  });

  describe.each(['nome', 'lotacao', 'cargo'])('campo obrigatório do responsável: %s', (campo) => {
    it.each([
      ['ausente', undefined],
      ['string vazia', ''],
      ['somente espaços', '   '],
    ])('rejeita quando %s', (_desc, valor) => {
      // Técnica: partição (classes inválidas) + valor-limite (0 caracteres) | Requisito: CA1
      const r: any = CreateEmprestimoSchema.safeParse(entrada({}, { [campo]: valor }));
      expect(r.success).toBe(false);
      expect(caminhos(r)).toContain(`responsavel.${campo}`);
    });

    it('aceita com 1 caractere', () => {
      // Técnica: valor-limite (tamanho mínimo 1) | Requisito: CA1
      expect(CreateEmprestimoSchema.safeParse(entrada({}, { [campo]: 'X' })).success).toBe(true);
    });
  });

  it.each([
    ['e-mail válido', 'maria@ufpe.br', true],
    ['e-mail sem domínio', 'maria@', false],
    ['e-mail sem arroba', 'maria.ufpe.br', false],
    ['e-mail ausente (opcional)', undefined, true],
  ])('%s', (_desc, email, valido) => {
    // Técnica: partição (e-mail válido/inválido/ausente) | Requisito: CA1
    expect(CreateEmprestimoSchema.safeParse(entrada({}, { email })).success).toBe(valido);
  });

  it.each([
    ['ausente', undefined],
    ['vazio', ''],
    ['somente espaços', '   '],
  ])('rejeita itemId %s', (_desc, itemId) => {
    // Técnica: partição (itemId inválido) + valor-limite (0 caracteres) | Requisito: CA1
    const r: any = CreateEmprestimoSchema.safeParse(entrada({ itemId }));
    expect(r.success).toBe(false);
    expect(caminhos(r)).toContain('itemId');
  });

  describe('prazo de devolução', () => {
    it('mantém o prazo indefinido (undefined) quando omitido', () => {
      // Técnica: partição (prazo omitido) | Requisito: CA3
      const r: any = CreateEmprestimoSchema.safeParse(entrada());
      expect(r.success).toBe(true);
      expect(r.data.prazoDevolucao).toBeUndefined();
    });

    it('aceita prazo null como indefinido', () => {
      // Técnica: partição (prazo nulo) | Requisito: CA3
      const r: any = CreateEmprestimoSchema.safeParse(entrada({ prazoDevolucao: null }));
      expect(r.success).toBe(true);
      expect(r.data.prazoDevolucao).toBeNull();
    });

    it('converte prazo informado em Date', () => {
      // Técnica: partição (prazo válido) | Requisito: CA3
      const r: any = CreateEmprestimoSchema.safeParse(entrada({ prazoDevolucao: '2026-12-31T00:00:00.000Z' }));
      expect(r.success).toBe(true);
      expect(r.data.prazoDevolucao).toEqual(new Date('2026-12-31T00:00:00.000Z'));
    });

    it.each(['não-é-data', ''])('rejeita prazo inválido "%s"', (prazoDevolucao) => {
      // Técnica: partição (prazo inválido) | Requisito: CA3
      const r: any = CreateEmprestimoSchema.safeParse(entrada({ prazoDevolucao }));
      expect(r.success).toBe(false);
      expect(caminhos(r)).toContain('prazoDevolucao');
    });

    it('rejeita data de retirada inválida', () => {
      // Técnica: partição (data de retirada inválida) | Requisito: CA1
      const r: any = CreateEmprestimoSchema.safeParse(entrada({ dataRetirada: 'ontem-talvez' }));
      expect(r.success).toBe(false);
      expect(caminhos(r)).toContain('dataRetirada');
    });

    it.each([
      ['1 ms antes da retirada (abaixo do limite)', '2026-11-13T09:59:59.999Z', false],
      ['exatamente na retirada (limite)', '2026-11-13T10:00:00.000Z', true],
      ['1 ms depois da retirada (acima do limite)', '2026-11-13T10:00:00.001Z', true],
    ])('prazo %s', (_desc, prazoDevolucao, valido) => {
      // Técnica: valor-limite (prazo vs. data de retirada) | Requisito: CA3
      const r: any = CreateEmprestimoSchema.safeParse(
        entrada({ dataRetirada: '2026-11-13T10:00:00.000Z', prazoDevolucao }),
      );
      expect(r.success).toBe(valido);
      if (!valido) expect(caminhos(r)).toContain('prazoDevolucao');
    });
  });
});

// ---------------------------------------------------------------------------
// estaAtrasado (derivação do atraso)
// ---------------------------------------------------------------------------
describe('estaAtrasado', () => {
  const ativo = (prazoDevolucao: Date | null) => ({ status: StatusEmprestimo.ATIVO, prazoDevolucao });

  it('é atraso quando o prazo venceu 1 ms antes de agora', () => {
    // Técnica: valor-limite (prazo = agora - 1 ms) | Requisito: CA8
    expect(estaAtrasado(ativo(new Date(AGORA.getTime() - 1)), AGORA)).toBe(true);
  });

  it('não é atraso quando o prazo é exatamente agora', () => {
    // Técnica: valor-limite (prazo = agora) | Requisito: CA8
    expect(estaAtrasado(ativo(new Date(AGORA.getTime())), AGORA)).toBe(false);
  });

  it('não é atraso quando o prazo vence 1 ms depois de agora', () => {
    // Técnica: valor-limite (prazo = agora + 1 ms) | Requisito: CA8
    expect(estaAtrasado(ativo(new Date(AGORA.getTime() + 1)), AGORA)).toBe(false);
  });

  it('não é atraso quando o prazo é indefinido', () => {
    // Técnica: partição (prazo nulo) | Requisito: CA3, CA8
    expect(estaAtrasado(ativo(null), AGORA)).toBe(false);
  });

  it.each([StatusEmprestimo.AGUARDANDO_TERMO, StatusEmprestimo.DEVOLVIDO])(
    'não é atraso para status %s mesmo com prazo vencido',
    (status) => {
      // Técnica: partição (status diferente de ATIVO) | Requisito: CA8
      expect(estaAtrasado({ status, prazoDevolucao: new Date(AGORA.getTime() - UM_DIA) }, AGORA)).toBe(false);
    },
  );

  it('usa a data atual quando "agora" não é informado', () => {
    // Técnica: partição (parâmetro padrão) | Requisito: CA8
    expect(estaAtrasado(ativo(new Date(AGORA.getTime() - 1)))).toBe(true);
    expect(estaAtrasado(ativo(new Date(AGORA.getTime() + UM_DIA)))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// EmprestimosService.create
// ---------------------------------------------------------------------------
describe('EmprestimosService.create', () => {
  beforeEach(() => {
    configurarCaminhoFelizDeCreate(prisma, termoPdf, termoStorage);
  });

  it('registra o empréstimo de item disponível aguardando o termo assinado', async () => {
    // Técnica: critério de aceitação (caminho feliz) | Requisito: CA1
    const r: any = await service.create(ESTOQUE_ID, criarDto(), USER_ID);

    expect(r.status).toBe(StatusEmprestimo.AGUARDANDO_TERMO);
    expect(r.termoAssinadoAnexado).toBe(false);
    expect(r.termo).toEqual({ id: 'termo-1', numeroAno: '01/2026' });
    expect(prisma.emprestimo.create).toHaveBeenCalledTimes(1);
    // O item só vira EMPRESTADO na confirmação da entrega (CA4)
    expect(prisma.item.update).not.toHaveBeenCalled();
  });

  it('cadastra o responsável no ato quando ele ainda não existe', async () => {
    // Técnica: partição (responsável novo) | Requisito: CA1
    await service.create(ESTOQUE_ID, criarDto(), USER_ID);

    expect(prisma.responsavel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ nome: 'Maria Souza', siape: '1234567', lotacao: 'DCC', cargo: 'Docente' }),
    });
    expect(prisma.responsavel.update).not.toHaveBeenCalled();
    expect(prisma.emprestimo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ responsavelId: RESPONSAVEL.id }) }),
    );
  });

  it('reaproveita o responsável já cadastrado (encontrado por Siape) sem duplicar', async () => {
    // Técnica: partição (responsável existente) | Requisito: CA2
    prisma.responsavel.findMany.mockResolvedValue([RESPONSAVEL]);

    await service.create(ESTOQUE_ID, criarDto(), USER_ID);

    expect(prisma.responsavel.findMany).toHaveBeenCalledWith({ where: { OR: [{ siape: '1234567' }] } });
    expect(prisma.responsavel.create).not.toHaveBeenCalled();
    expect(prisma.responsavel.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: RESPONSAVEL.id } }),
    );
    expect(prisma.emprestimo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ responsavelId: RESPONSAVEL.id }) }),
    );
  });

  it('procura o responsável existente por CPF quando não há Siape', async () => {
    // Técnica: partição (identificação só por CPF) | Requisito: CA2
    prisma.responsavel.findMany.mockResolvedValue([RESPONSAVEL]);
    const dto = criarDto({
      responsavel: { nome: 'Maria Souza', cpf: '12345678901', lotacao: 'DCC', cargo: 'Docente' },
    });

    await service.create(ESTOQUE_ID, dto, USER_ID);

    expect(prisma.responsavel.findMany).toHaveBeenCalledWith({ where: { OR: [{ cpf: '12345678901' }] } });
  });

  it('procura por Siape e CPF quando ambos são informados', async () => {
    // Técnica: partição (identificação por Siape e CPF) | Requisito: CA2
    const dto = criarDto({
      responsavel: { nome: 'Maria', siape: '1234567', cpf: '12345678901', lotacao: 'DCC', cargo: 'Docente' },
    });

    await service.create(ESTOQUE_ID, dto, USER_ID);

    expect(prisma.responsavel.findMany).toHaveBeenCalledWith({
      where: { OR: [{ siape: '1234567' }, { cpf: '12345678901' }] },
    });
  });

  it('recusa quando Siape e CPF pertencem a responsáveis diferentes', async () => {
    // Técnica: partição (identificadores conflitantes) | Requisito: CA2
    prisma.responsavel.findMany.mockResolvedValue([RESPONSAVEL, { ...RESPONSAVEL, id: 'resp-2' }]);
    const dto = criarDto({
      responsavel: { nome: 'Maria', siape: '1234567', cpf: '12345678901', lotacao: 'DCC', cargo: 'Docente' },
    });

    await expect(service.create(ESTOQUE_ID, dto, USER_ID)).rejects.toBeInstanceOf(ResourceConflictException);
    expect(prisma.emprestimo.create).not.toHaveBeenCalled();
  });

  it('guarda o prazo de devolução quando informado', async () => {
    // Técnica: partição (prazo informado) | Requisito: CA3
    const prazo = new Date('2026-12-20T00:00:00.000Z');

    await service.create(ESTOQUE_ID, criarDto({ prazoDevolucao: prazo }), USER_ID);

    expect(prisma.emprestimo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ prazoDevolucao: prazo }) }),
    );
  });

  it.each([
    ['omitido', undefined],
    ['nulo', null],
  ])('deixa o prazo indefinido (null) quando %s', async (_desc, prazoDevolucao) => {
    // Técnica: partição (prazo ausente) | Requisito: CA3
    const r: any = await service.create(ESTOQUE_ID, criarDto({ prazoDevolucao }), USER_ID);

    expect(prisma.emprestimo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ prazoDevolucao: null }) }),
    );
    expect(r.prazoDevolucao).toBeNull();
  });

  it('usa a data atual como retirada quando omitida', async () => {
    // Técnica: partição (retirada omitida) | Requisito: CA1
    await service.create(ESTOQUE_ID, criarDto(), USER_ID);

    expect(prisma.emprestimo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dataRetirada: AGORA }) }),
    );
  });

  it('recusa prazo 1 ms anterior à retirada', async () => {
    // Técnica: valor-limite (prazo = retirada - 1 ms) | Requisito: CA3
    const retirada = new Date('2026-11-13T10:00:00.000Z');
    const dto = criarDto({ dataRetirada: retirada, prazoDevolucao: new Date(retirada.getTime() - 1) });

    const erro = await erroDe(service.create(ESTOQUE_ID, dto, USER_ID));

    expect(erro).toBeInstanceOf(AppException);
    expect(erro.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(prisma.emprestimo.create).not.toHaveBeenCalled();
  });

  it.each([
    ['igual à retirada', 0],
    ['1 ms depois da retirada', 1],
  ])('aceita prazo %s', async (_desc, delta) => {
    // Técnica: valor-limite (prazo = retirada e retirada + 1 ms) | Requisito: CA3
    const retirada = new Date('2026-11-13T10:00:00.000Z');
    const dto = criarDto({ dataRetirada: retirada, prazoDevolucao: new Date(retirada.getTime() + delta) });

    await expect(service.create(ESTOQUE_ID, dto, USER_ID)).resolves.toBeDefined();
  });

  it('recusa empréstimo de item que já está emprestado', async () => {
    // Técnica: partição (status do item inválido: EMPRESTADO) | Requisito: CA5
    prisma.item.findFirst.mockResolvedValue({ ...ITEM, status: StatusItem.EMPRESTADO });

    await expect(service.create(ESTOQUE_ID, criarDto(), USER_ID)).rejects.toBeInstanceOf(
      ResourceConflictException,
    );
    expect(prisma.emprestimo.create).not.toHaveBeenCalled();
  });

  it('recusa quando já existe empréstimo aguardando termo ou ativo para o item (corrida)', async () => {
    // Técnica: partição (empréstimo em aberto na transação) | Requisito: CA5
    prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase());

    await expect(service.create(ESTOQUE_ID, criarDto(), USER_ID)).rejects.toBeInstanceOf(
      ResourceConflictException,
    );
    expect(prisma.emprestimo.findFirst).toHaveBeenCalledWith({
      where: {
        itemId: ITEM.id,
        status: { in: [StatusEmprestimo.AGUARDANDO_TERMO, StatusEmprestimo.ATIVO] },
      },
    });
    expect(prisma.emprestimo.create).not.toHaveBeenCalled();
  });

  it('recusa item de consumo com erro de validação (400) e sem abrir transação', async () => {
    // Técnica: partição (tipo do item inválido: CONSUMO) | Requisito: CA6
    prisma.item.findFirst.mockResolvedValue({ ...ITEM, tipo: TipoItem.CONSUMO });

    const erro = await erroDe(service.create(ESTOQUE_ID, criarDto(), USER_ID));

    expect(erro).toBeInstanceOf(AppException);
    expect(erro.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.emprestimo.create).not.toHaveBeenCalled();
  });

  it('recusa item inexistente (ou de outro estoque) com 404', async () => {
    // Técnica: partição (item inexistente) | Requisito: CA1
    prisma.item.findFirst.mockResolvedValue(null);

    await expect(service.create(ESTOQUE_ID, criarDto(), USER_ID)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    expect(prisma.item.findFirst).toHaveBeenCalledWith({ where: { id: ITEM.id, estoqueId: ESTOQUE_ID } });
  });

  it('recusa estoque inexistente com 404', async () => {
    // Técnica: partição (estoque inexistente) | Requisito: CA1
    prisma.estoque.findUnique.mockResolvedValue(null);

    await expect(service.create(ESTOQUE_ID, criarDto(), USER_ID)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it.each([
    ['usuário sem vínculo de gestor', USER_ID, null],
    ['usuário não identificado', undefined, { estoqueId: ESTOQUE_ID, usuarioId: USER_ID }],
  ])('nega acesso a %s', async (_desc, userId, vinculo) => {
    // Técnica: partição (permissão inválida) | Requisito: CA1
    prisma.estoqueGestor.findUnique.mockResolvedValue(vinculo);

    await expect(service.create(ESTOQUE_ID, criarDto(), userId)).rejects.toBeInstanceOf(AccessDeniedException);
    expect(prisma.emprestimo.create).not.toHaveBeenCalled();
  });

  it('registra a movimentação de saída com o usuário gestor', async () => {
    // Técnica: critério (efeito colateral do registro) | Requisito: CA1
    await service.create(ESTOQUE_ID, criarDto(), USER_ID);

    expect(prisma.movimentacao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        itemId: ITEM.id,
        tipo: TipoMovimentacao.SAIDA,
        quantidade: 1,
        usuarioId: USER_ID,
      }),
    });
  });

  it.each([
    [1, '01/2026'],
    [9, '09/2026'],
    [10, '10/2026'],
    [123, '123/2026'],
  ])('numera o termo com o contador %i como %s', async (ultimoNumero, esperado) => {
    // Técnica: valor-limite (preenchimento com zero 1/9/10/3 dígitos) | Requisito: CA1
    prisma.contadorTermo.upsert.mockResolvedValue({ ultimoNumero });

    await service.create(ESTOQUE_ID, criarDto(), USER_ID);

    expect(termoPdf.gerar).toHaveBeenCalledWith(expect.objectContaining({ numeroAno: esperado }));
    expect(prisma.termo.create).toHaveBeenCalledWith({
      data: { numeroAno: esperado, arquivoPdf: expect.stringMatching(/^2026\/.+\.pdf$/) },
    });
  });

  it('grava o PDF do termo no armazenamento', async () => {
    // Técnica: critério (geração do termo no registro) | Requisito: CA1
    await service.create(ESTOQUE_ID, criarDto(), USER_ID);

    expect(termoStorage.write).toHaveBeenCalledWith(
      expect.stringMatching(/^2026\/.+\.pdf$/),
      Buffer.from('%PDF-gerado'),
    );
  });

  it('remove o PDF já gravado e traduz P2002 em conflito quando a transação falha por unicidade', async () => {
    // Técnica: partição (falha de unicidade com arquivo criado) | Requisito: CA2
    const { Prisma } = await import('@prisma/client');
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique', { code: 'P2002', clientVersion: '5' });
    prisma.termo.create.mockRejectedValue(p2002);

    await expect(service.create(ESTOQUE_ID, criarDto(), USER_ID)).rejects.toBeInstanceOf(
      ResourceConflictException,
    );
    expect(termoStorage.remove).toHaveBeenCalledWith(termoStorage.write.mock.calls[0][0]);
  });

  it('propaga erros inesperados da transação e limpa o PDF', async () => {
    // Técnica: partição (erro genérico após criar arquivo) | Requisito: CA1
    const falha = new Error('banco caiu');
    prisma.termo.create.mockRejectedValue(falha);

    await expect(service.create(ESTOQUE_ID, criarDto(), USER_ID)).rejects.toBe(falha);
    expect(termoStorage.remove).toHaveBeenCalledTimes(1);
  });

  it('agrega os erros quando a limpeza do PDF também falha', async () => {
    // Técnica: partição (falha na transação + falha na limpeza) | Requisito: CA1
    prisma.termo.create.mockRejectedValue(new Error('banco caiu'));
    termoStorage.remove.mockRejectedValue(new Error('disco cheio'));

    await expect(service.create(ESTOQUE_ID, criarDto(), USER_ID)).rejects.toBeInstanceOf(AggregateError);
  });

  it('não tenta remover PDF quando a falha ocorre antes da gravação', async () => {
    // Técnica: partição (falha antes de gravar o arquivo) | Requisito: CA5
    prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase());

    await erroDe(service.create(ESTOQUE_ID, criarDto(), USER_ID));

    expect(termoStorage.write).not.toHaveBeenCalled();
    expect(termoStorage.remove).not.toHaveBeenCalled();
  });

  describe('responsável com item em atraso', () => {
    const atrasado = () =>
      emprestimoBase({
        id: 'emp-0',
        itemId: 'item-9',
        status: StatusEmprestimo.ATIVO,
        prazoDevolucao: new Date(AGORA.getTime() - UM_DIA),
      });

    // ATENÇÃO: o módulo fornecido NÃO implementa a regra de CA9. Estes testes descrevem o
    // comportamento esperado do critério e devem falhar até que a regra exista.
    function simularResponsavelComAtraso() {
      const emAtraso = atrasado();
      prisma.responsavel.findMany.mockResolvedValue([RESPONSAVEL]);
      // Consulta por item => sem empréstimo em aberto; consulta por responsável => o atrasado
      prisma.emprestimo.findFirst.mockImplementation(async ({ where }: any) =>
        where?.itemId ? null : emAtraso,
      );
      prisma.emprestimo.findMany.mockResolvedValue([emAtraso]);
      prisma.emprestimo.count.mockResolvedValue(1);
    }

    it('impede novo empréstimo para responsável com item em atraso', async () => {
      // Técnica: critério de aceitação (regra de bloqueio) | Requisito: CA9
      simularResponsavelComAtraso();

      await expect(service.create(ESTOQUE_ID, criarDto(), USER_ID)).rejects.toBeInstanceOf(
        ResourceConflictException,
      );
      expect(prisma.emprestimo.create).not.toHaveBeenCalled();
    });

    it('informa a pendência na mensagem de erro', async () => {
      // Técnica: critério de aceitação (mensagem ao gestor) | Requisito: CA9
      simularResponsavelComAtraso();

      const erro = await erroDe(service.create(ESTOQUE_ID, criarDto(), USER_ID));

      expect(erro.message).toMatch(/atras|pend/i);
    });
  });

  // CA2 (lista de responsáveis cadastrados para seleção) e CA10 (histórico do responsável):
  // o módulo fornecido não expõe endpoint nem método para essas consultas.
  it.todo('lista responsáveis cadastrados com nome e Siape/CPF para seleção — CA2 (consulta ausente no módulo)');
  it.todo('retorna o histórico de empréstimos e devoluções de um responsável — CA10 (consulta ausente no módulo)');
});

// ---------------------------------------------------------------------------
// EmprestimosService.anexarTermoAssinado
// ---------------------------------------------------------------------------
describe('EmprestimosService.anexarTermoAssinado', () => {
  beforeEach(() => {
    prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase());
    prisma.emprestimo.findUniqueOrThrow.mockResolvedValue(
      emprestimoBase({ termo: { id: 'termo-1', numeroAno: '01/2026', arquivoAssinado: 'novo.pdf' } }),
    );
    prisma.termo.update.mockResolvedValue({});
    termoStorage.write.mockResolvedValue(undefined);
    termoStorage.remove.mockResolvedValue(undefined);
  });

  it('anexa o PDF assinado sem ativar o empréstimo', async () => {
    // Técnica: critério de aceitação (anexo antes da confirmação) | Requisito: CA4
    const r: any = await service.anexarTermoAssinado(ESTOQUE_ID, 'emp-1', arquivoPdf(), USER_ID);

    expect(termoStorage.write).toHaveBeenCalledWith(
      expect.stringMatching(/^2026\/assinados\/.+\.pdf$/),
      expect.any(Buffer),
    );
    expect(prisma.termo.update).toHaveBeenCalledWith({
      where: { id: 'termo-1' },
      data: { arquivoAssinado: expect.stringMatching(/^2026\/assinados\/.+\.pdf$/) },
    });
    expect(r.termoAssinadoAnexado).toBe(true);
    expect(prisma.emprestimo.updateMany).not.toHaveBeenCalled();
    expect(prisma.item.update).not.toHaveBeenCalled();
  });

  it('substitui o anexo anterior removendo o arquivo antigo', async () => {
    // Técnica: partição (já existe termo assinado) | Requisito: CA4
    prisma.emprestimo.findFirst.mockResolvedValue(
      emprestimoBase({ termo: { id: 'termo-1', numeroAno: '01/2026', arquivoPdf: 'x.pdf', arquivoAssinado: 'velho.pdf' } }),
    );

    await service.anexarTermoAssinado(ESTOQUE_ID, 'emp-1', arquivoPdf(), USER_ID);

    expect(termoStorage.remove).toHaveBeenCalledWith('velho.pdf');
  });

  it('não remove nada quando não havia anexo anterior', async () => {
    // Técnica: partição (primeiro anexo) | Requisito: CA4
    await service.anexarTermoAssinado(ESTOQUE_ID, 'emp-1', arquivoPdf(), USER_ID);

    expect(termoStorage.remove).not.toHaveBeenCalled();
  });

  it.each([
    ['arquivo ausente', undefined],
    ['buffer vazio', arquivoPdf({ buffer: Buffer.alloc(0), size: 0 })],
    ['tipo não PDF', arquivoPdf({ mimetype: 'image/png' })],
    ['conteúdo sem assinatura %PDF', arquivoPdf({ buffer: Buffer.from('nao e um pdf de verdade'), size: 24 })],
    ['tamanho 1 byte acima do limite', arquivoPdf({ size: TERMO_ASSINADO_MAX_BYTES + 1 })],
  ])('rejeita com 400: %s', async (_desc, arquivo) => {
    // Técnica: partição (arquivos inválidos) + valor-limite (limite + 1) | Requisito: CA4
    const erro = await erroDe(service.anexarTermoAssinado(ESTOQUE_ID, 'emp-1', arquivo, USER_ID));

    expect(erro).toBeInstanceOf(AppException);
    expect(erro.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(termoStorage.write).not.toHaveBeenCalled();
  });

  it.each([
    ['exatamente no limite', TERMO_ASSINADO_MAX_BYTES],
    ['1 byte abaixo do limite', TERMO_ASSINADO_MAX_BYTES - 1],
  ])('aceita arquivo com tamanho %s', async (_desc, size) => {
    // Técnica: valor-limite (tamanho máximo 5 MB) | Requisito: CA4
    await expect(
      service.anexarTermoAssinado(ESTOQUE_ID, 'emp-1', arquivoPdf({ size }), USER_ID),
    ).resolves.toBeDefined();
  });

  it.each([StatusEmprestimo.ATIVO, StatusEmprestimo.DEVOLVIDO])(
    'recusa anexo quando o empréstimo está %s',
    async (status) => {
      // Técnica: partição (status inválido) | Requisito: CA4
      prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase({ status }));

      await expect(
        service.anexarTermoAssinado(ESTOQUE_ID, 'emp-1', arquivoPdf(), USER_ID),
      ).rejects.toBeInstanceOf(ResourceConflictException);
    },
  );

  it('responde 404 quando o empréstimo não existe neste estoque', async () => {
    // Técnica: partição (empréstimo inexistente) | Requisito: CA4
    prisma.emprestimo.findFirst.mockResolvedValue(null);

    await expect(
      service.anexarTermoAssinado(ESTOQUE_ID, 'emp-x', arquivoPdf(), USER_ID),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });

  it('responde 404 quando o empréstimo não tem termo gerado', async () => {
    // Técnica: partição (termo ausente) | Requisito: CA4
    prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase({ termo: null }));

    await expect(
      service.anexarTermoAssinado(ESTOQUE_ID, 'emp-1', arquivoPdf(), USER_ID),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });

  it('nega acesso a quem não é gestor do estoque', async () => {
    // Técnica: partição (permissão inválida) | Requisito: CA4
    prisma.estoqueGestor.findUnique.mockResolvedValue(null);

    await expect(
      service.anexarTermoAssinado(ESTOQUE_ID, 'emp-1', arquivoPdf(), USER_ID),
    ).rejects.toBeInstanceOf(AccessDeniedException);
  });

  it('desfaz a gravação do novo arquivo quando a atualização do termo falha', async () => {
    // Técnica: partição (falha de persistência) | Requisito: CA4
    const falha = new Error('banco caiu');
    prisma.termo.update.mockRejectedValue(falha);

    await expect(service.anexarTermoAssinado(ESTOQUE_ID, 'emp-1', arquivoPdf(), USER_ID)).rejects.toBe(falha);
    expect(termoStorage.remove).toHaveBeenCalledWith(termoStorage.write.mock.calls[0][0]);
  });
});

// ---------------------------------------------------------------------------
// EmprestimosService.confirmarEntrega
// ---------------------------------------------------------------------------
describe('EmprestimosService.confirmarEntrega', () => {
  const comTermoAssinado = (over: Record<string, unknown> = {}) =>
    emprestimoBase({
      termo: { id: 'termo-1', numeroAno: '01/2026', arquivoPdf: 'a.pdf', arquivoAssinado: 'assinado.pdf' },
      ...over,
    });

  beforeEach(() => {
    prisma.emprestimo.findFirst.mockResolvedValue(comTermoAssinado());
    prisma.emprestimo.updateMany.mockResolvedValue({ count: 1 });
    prisma.item.update.mockResolvedValue({});
    prisma.emprestimo.findUniqueOrThrow.mockResolvedValue(
      comTermoAssinado({ status: StatusEmprestimo.ATIVO }),
    );
  });

  it('torna o empréstimo ATIVO e o item EMPRESTADO quando há termo assinado', async () => {
    // Técnica: critério de aceitação (caminho feliz) | Requisito: CA4
    const r: any = await service.confirmarEntrega(ESTOQUE_ID, 'emp-1', USER_ID);

    expect(prisma.emprestimo.updateMany).toHaveBeenCalledWith({
      where: { id: 'emp-1', status: StatusEmprestimo.AGUARDANDO_TERMO },
      data: { status: StatusEmprestimo.ATIVO },
    });
    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: ITEM.id },
      data: { status: StatusItem.EMPRESTADO },
    });
    expect(r.status).toBe(StatusEmprestimo.ATIVO);
    expect(r.termoAssinadoAnexado).toBe(true);
  });

  it('recusa a entrega sem termo assinado anexado', async () => {
    // Técnica: partição (termo assinado ausente) | Requisito: CA4
    prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase());

    await expect(service.confirmarEntrega(ESTOQUE_ID, 'emp-1', USER_ID)).rejects.toBeInstanceOf(
      ResourceConflictException,
    );
    expect(prisma.emprestimo.updateMany).not.toHaveBeenCalled();
    expect(prisma.item.update).not.toHaveBeenCalled();
  });

  it('recusa a entrega quando não há termo algum', async () => {
    // Técnica: partição (termo nulo) | Requisito: CA4
    prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase({ termo: null }));

    await expect(service.confirmarEntrega(ESTOQUE_ID, 'emp-1', USER_ID)).rejects.toBeInstanceOf(
      ResourceConflictException,
    );
  });

  it.each([StatusEmprestimo.ATIVO, StatusEmprestimo.DEVOLVIDO])(
    'recusa confirmar entrega de empréstimo %s',
    async (status) => {
      // Técnica: partição (status inválido) | Requisito: CA4
      prisma.emprestimo.findFirst.mockResolvedValue(comTermoAssinado({ status }));

      await expect(service.confirmarEntrega(ESTOQUE_ID, 'emp-1', USER_ID)).rejects.toBeInstanceOf(
        ResourceConflictException,
      );
      expect(prisma.item.update).not.toHaveBeenCalled();
    },
  );

  it('responde 404 para empréstimo inexistente neste estoque', async () => {
    // Técnica: partição (empréstimo inexistente) | Requisito: CA4
    prisma.emprestimo.findFirst.mockResolvedValue(null);

    await expect(service.confirmarEntrega(ESTOQUE_ID, 'emp-x', USER_ID)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it('trata confirmação concorrente (0 linhas atualizadas) como conflito', async () => {
    // Técnica: valor-limite (count = 0) | Requisito: CA4
    prisma.emprestimo.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.confirmarEntrega(ESTOQUE_ID, 'emp-1', USER_ID)).rejects.toBeInstanceOf(
      ResourceConflictException,
    );
    expect(prisma.item.update).not.toHaveBeenCalled();
  });

  it('nega acesso a quem não é gestor do estoque', async () => {
    // Técnica: partição (permissão inválida) | Requisito: CA4
    prisma.estoqueGestor.findUnique.mockResolvedValue(null);

    await expect(service.confirmarEntrega(ESTOQUE_ID, 'emp-1', USER_ID)).rejects.toBeInstanceOf(
      AccessDeniedException,
    );
  });
});

// ---------------------------------------------------------------------------
// EmprestimosService.devolver
// ---------------------------------------------------------------------------
describe('EmprestimosService.devolver', () => {
  const ativo = (over: Record<string, unknown> = {}) =>
    emprestimoBase({ status: StatusEmprestimo.ATIVO, ...over });

  beforeEach(() => {
    prisma.emprestimo.findFirst.mockResolvedValue(ativo());
    prisma.emprestimo.updateMany.mockResolvedValue({ count: 1 });
    prisma.item.update.mockResolvedValue({});
    prisma.movimentacao.create.mockResolvedValue({});
    prisma.emprestimo.findUniqueOrThrow.mockResolvedValue(
      ativo({ status: StatusEmprestimo.DEVOLVIDO, dataDevolucaoEfetiva: AGORA }),
    );
  });

  it('marca o empréstimo como DEVOLVIDO e libera o item', async () => {
    // Técnica: critério de aceitação (caminho feliz) | Requisito: CA7
    const r: any = await service.devolver(ESTOQUE_ID, 'emp-1', USER_ID);

    expect(prisma.emprestimo.updateMany).toHaveBeenCalledWith({
      where: { id: 'emp-1', status: StatusEmprestimo.ATIVO },
      data: { status: StatusEmprestimo.DEVOLVIDO, dataDevolucaoEfetiva: AGORA },
    });
    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: ITEM.id },
      data: { status: StatusItem.DISPONIVEL },
    });
    expect(r.status).toBe(StatusEmprestimo.DEVOLVIDO);
  });

  it('registra a movimentação de devolução', async () => {
    // Técnica: critério (efeito colateral da devolução) | Requisito: CA7
    await service.devolver(ESTOQUE_ID, 'emp-1', USER_ID);

    expect(prisma.movimentacao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        itemId: ITEM.id,
        tipo: TipoMovimentacao.DEVOLUCAO,
        quantidade: 1,
        usuarioId: USER_ID,
      }),
    });
  });

  it('permite devolver empréstimo com prazo vencido', async () => {
    // Técnica: partição (ativo em atraso) | Requisito: CA7, CA8
    prisma.emprestimo.findFirst.mockResolvedValue(ativo({ prazoDevolucao: new Date(AGORA.getTime() - UM_DIA) }));

    await expect(service.devolver(ESTOQUE_ID, 'emp-1', USER_ID)).resolves.toBeDefined();
    expect(prisma.item.update).toHaveBeenCalledTimes(1);
  });

  it.each([StatusEmprestimo.AGUARDANDO_TERMO, StatusEmprestimo.DEVOLVIDO])(
    'recusa devolver empréstimo %s',
    async (status) => {
      // Técnica: partição (status inválido) | Requisito: CA7
      prisma.emprestimo.findFirst.mockResolvedValue(ativo({ status }));

      await expect(service.devolver(ESTOQUE_ID, 'emp-1', USER_ID)).rejects.toBeInstanceOf(
        ResourceConflictException,
      );
      expect(prisma.item.update).not.toHaveBeenCalled();
      expect(prisma.movimentacao.create).not.toHaveBeenCalled();
    },
  );

  it('responde 404 para empréstimo inexistente neste estoque', async () => {
    // Técnica: partição (empréstimo inexistente) | Requisito: CA7
    prisma.emprestimo.findFirst.mockResolvedValue(null);

    await expect(service.devolver(ESTOQUE_ID, 'emp-x', USER_ID)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    expect(prisma.emprestimo.findFirst).toHaveBeenCalledWith({
      where: { id: 'emp-x', item: { estoqueId: ESTOQUE_ID } },
    });
  });

  it('trata devolução concorrente (0 linhas atualizadas) como conflito', async () => {
    // Técnica: valor-limite (count = 0) | Requisito: CA7
    prisma.emprestimo.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.devolver(ESTOQUE_ID, 'emp-1', USER_ID)).rejects.toBeInstanceOf(
      ResourceConflictException,
    );
    expect(prisma.item.update).not.toHaveBeenCalled();
  });

  it('nega acesso a quem não é gestor do estoque', async () => {
    // Técnica: partição (permissão inválida) | Requisito: CA7
    prisma.estoqueGestor.findUnique.mockResolvedValue(null);

    await expect(service.devolver(ESTOQUE_ID, 'emp-1', USER_ID)).rejects.toBeInstanceOf(
      AccessDeniedException,
    );
  });
});

// ---------------------------------------------------------------------------
// EmprestimosService.findPendentes
// ---------------------------------------------------------------------------
describe('EmprestimosService.findPendentes', () => {
  const termoComFlag = { id: 'termo-1', numeroAno: '01/2026', arquivoAssinado: 'a.pdf' };
  const gestor = { userId: USER_ID, role: ROLE_NAO_ADMIN } as any;
  const admin = { userId: 'admin-1', role: AccessRole.ADMIN } as any;
  const query = { page: 1, limit: 10 } as any;

  const lista = () => [
    emprestimoBase({ id: 'e1', status: StatusEmprestimo.ATIVO, prazoDevolucao: new Date(AGORA.getTime() - UM_DIA), termo: termoComFlag }),
    emprestimoBase({ id: 'e2', status: StatusEmprestimo.ATIVO, prazoDevolucao: new Date(AGORA.getTime() + UM_DIA), termo: termoComFlag }),
    emprestimoBase({ id: 'e3', status: StatusEmprestimo.ATIVO, prazoDevolucao: null, termo: termoComFlag }),
    emprestimoBase({ id: 'e4', status: StatusEmprestimo.AGUARDANDO_TERMO, prazoDevolucao: new Date(AGORA.getTime() - UM_DIA), termo: termoComFlag }),
  ];

  beforeEach(() => {
    prisma.emprestimo.findMany.mockResolvedValue(lista());
    prisma.emprestimo.count.mockResolvedValue(4);
  });

  it('destaca como atrasado somente o empréstimo ativo com prazo vencido', async () => {
    // Técnica: critério de aceitação + partição (atrasado / no prazo / indefinido / aguardando) | Requisito: CA8
    const r: any = await service.findPendentes(ESTOQUE_ID, query, gestor);

    expect(r.items.map((i: any) => [i.id, i.atrasado])).toEqual([
      ['e1', true],
      ['e2', false],
      ['e3', false],
      ['e4', false],
    ]);
    expect(r.total).toBe(4);
  });

  it('lista apenas pendentes (aguardando termo e ativos) do estoque, excluindo devolvidos', async () => {
    // Técnica: partição (status listados) | Requisito: CA8
    await service.findPendentes(ESTOQUE_ID, query, gestor);

    const where = { status: { in: [StatusEmprestimo.AGUARDANDO_TERMO, StatusEmprestimo.ATIVO] }, item: { estoqueId: ESTOQUE_ID } };
    expect(prisma.emprestimo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(prisma.emprestimo.count).toHaveBeenCalledWith({ where });
  });

  it('ordena por prazo crescente com prazos indefinidos por último', async () => {
    // Técnica: critério (ordenação) | Requisito: CA8
    await service.findPendentes(ESTOQUE_ID, query, gestor);

    expect(prisma.emprestimo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ prazoDevolucao: { sort: 'asc', nulls: 'last' } }, { dataRetirada: 'desc' }],
      }),
    );
  });

  it.each([
    [1, 10, 0],
    [2, 10, 10],
    [3, 25, 50],
  ])('paginação página %i com limite %i usa skip %i', async (page, limit, skip) => {
    // Técnica: valor-limite (primeira página e páginas seguintes) | Requisito: CA8
    await service.findPendentes(ESTOQUE_ID, { page, limit } as any, gestor);

    expect(prisma.emprestimo.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip, take: limit }));
  });

  it('retorna lista vazia quando não há empréstimos pendentes', async () => {
    // Técnica: valor-limite (0 resultados) | Requisito: CA8
    prisma.emprestimo.findMany.mockResolvedValue([]);
    prisma.emprestimo.count.mockResolvedValue(0);

    const r: any = await service.findPendentes(ESTOQUE_ID, query, gestor);

    expect(r.items).toEqual([]);
    expect(r.total).toBe(0);
  });

  it('permite ADMIN consultar sem ser gestor do estoque', async () => {
    // Técnica: partição (papel ADMIN) | Requisito: CA8
    prisma.estoqueGestor.findUnique.mockResolvedValue(null);

    await expect(service.findPendentes(ESTOQUE_ID, query, admin)).resolves.toBeDefined();
    expect(prisma.estoqueGestor.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['usuário sem vínculo e sem papel ADMIN', gestor],
    ['usuário não identificado', undefined],
  ])('nega acesso a %s', async (_desc, user) => {
    // Técnica: partição (permissão inválida) | Requisito: CA8
    prisma.estoqueGestor.findUnique.mockResolvedValue(null);

    await expect(service.findPendentes(ESTOQUE_ID, query, user)).rejects.toBeInstanceOf(AccessDeniedException);
  });

  it('responde 404 quando o estoque não existe', async () => {
    // Técnica: partição (estoque inexistente) | Requisito: CA8
    prisma.estoque.findUnique.mockResolvedValue(null);

    await expect(service.findPendentes(ESTOQUE_ID, query, gestor)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });
});

// ---------------------------------------------------------------------------
// EmprestimosService: consulta de PDFs do termo
// ---------------------------------------------------------------------------
describe('EmprestimosService.obterPdf / obterPdfAssinado', () => {
  const admin = { userId: 'admin-1', role: AccessRole.ADMIN } as any;
  const gestor = { userId: USER_ID, role: ROLE_NAO_ADMIN } as any;

  it('devolve o PDF do termo com nome derivado do número/ano', async () => {
    // Técnica: partição (termo existente) | Requisito: CA1
    prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase());
    termoStorage.read.mockResolvedValue(Buffer.from('%PDF'));

    const r = await service.obterPdf(ESTOQUE_ID, 'emp-1', gestor);

    expect(termoStorage.read).toHaveBeenCalledWith('2026/a.pdf');
    expect(r.nomeArquivo).toBe('termo-01-2026.pdf');
  });

  it('devolve o PDF assinado com sufixo "-assinado"', async () => {
    // Técnica: partição (termo assinado existente) | Requisito: CA4
    prisma.emprestimo.findFirst.mockResolvedValue(
      emprestimoBase({ termo: { id: 't', numeroAno: '07/2026', arquivoPdf: 'a.pdf', arquivoAssinado: 's.pdf' } }),
    );
    termoStorage.read.mockResolvedValue(Buffer.from('%PDF'));

    const r = await service.obterPdfAssinado(ESTOQUE_ID, 'emp-1', admin);

    expect(termoStorage.read).toHaveBeenCalledWith('s.pdf');
    expect(r.nomeArquivo).toBe('termo-07-2026-assinado.pdf');
  });

  it('responde 404 quando não há termo assinado anexado', async () => {
    // Técnica: partição (termo assinado ausente) | Requisito: CA4
    prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase());

    await expect(service.obterPdfAssinado(ESTOQUE_ID, 'emp-1', admin)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it('responde 404 quando o empréstimo não tem termo', async () => {
    // Técnica: partição (termo ausente) | Requisito: CA1
    prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase({ termo: null }));

    await expect(service.obterPdf(ESTOQUE_ID, 'emp-1', admin)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it('nega acesso ao PDF para quem não é gestor nem ADMIN', async () => {
    // Técnica: partição (permissão inválida) | Requisito: CA1
    prisma.estoqueGestor.findUnique.mockResolvedValue(null);

    await expect(service.obterPdf(ESTOQUE_ID, 'emp-1', gestor)).rejects.toBeInstanceOf(AccessDeniedException);
  });
});

// ---------------------------------------------------------------------------
// EmprestimosController (delegação ao service)
// ---------------------------------------------------------------------------
describe('EmprestimosController', () => {
  let controller: any;
  let svc: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    // Import dinâmico: falha de guards/decorators não derruba os testes do service
    const { EmprestimosController } = await import('../../src/modules/emprestimos/emprestimos.controller');
    svc = {
      create: vi.fn().mockResolvedValue({ id: 'emp-1' }),
      findPendentes: vi.fn().mockResolvedValue({ items: [] }),
      devolver: vi.fn().mockResolvedValue({ id: 'emp-1' }),
      anexarTermoAssinado: vi.fn().mockResolvedValue({ id: 'emp-1' }),
      confirmarEntrega: vi.fn().mockResolvedValue({ id: 'emp-1' }),
      obterPdf: vi.fn().mockResolvedValue({ pdf: Buffer.from('%PDF'), nomeArquivo: 'termo-01-2026.pdf' }),
      obterPdfAssinado: vi
        .fn()
        .mockResolvedValue({ pdf: Buffer.from('%PDF'), nomeArquivo: 'termo-01-2026-assinado.pdf' }),
    };
    controller = new EmprestimosController(svc as any);
  });

  const user = { userId: USER_ID, role: ROLE_NAO_ADMIN } as any;

  it('create repassa estoque, dto e o id do usuário', async () => {
    // Técnica: critério (delegação) | Requisito: CA1
    const dto = criarDto();

    await controller.create(ESTOQUE_ID, dto, user);

    expect(svc.create).toHaveBeenCalledWith(ESTOQUE_ID, dto, USER_ID);
  });

  it('create repassa userId indefinido quando não há usuário autenticado', async () => {
    // Técnica: partição (usuário ausente) | Requisito: CA1
    await controller.create(ESTOQUE_ID, criarDto(), undefined);

    expect(svc.create).toHaveBeenCalledWith(ESTOQUE_ID, expect.anything(), undefined);
  });

  it('findPendentes repassa a consulta e o usuário completo', async () => {
    // Técnica: critério (delegação) | Requisito: CA8
    const query = { page: 1, limit: 10 } as any;

    await controller.findPendentes(ESTOQUE_ID, query, user);

    expect(svc.findPendentes).toHaveBeenCalledWith(ESTOQUE_ID, query, user);
  });

  it('devolver repassa estoque, id do empréstimo e id do usuário', async () => {
    // Técnica: critério (delegação) | Requisito: CA7
    await controller.devolver(ESTOQUE_ID, 'emp-1', user);

    expect(svc.devolver).toHaveBeenCalledWith(ESTOQUE_ID, 'emp-1', USER_ID);
  });

  it('confirmarEntrega repassa estoque, id do empréstimo e id do usuário', async () => {
    // Técnica: critério (delegação) | Requisito: CA4
    await controller.confirmarEntrega(ESTOQUE_ID, 'emp-1', user);

    expect(svc.confirmarEntrega).toHaveBeenCalledWith(ESTOQUE_ID, 'emp-1', USER_ID);
  });

  it('anexarTermoAssinado repassa o arquivo enviado', async () => {
    // Técnica: critério (delegação) | Requisito: CA4
    const arquivo = arquivoPdf();

    await controller.anexarTermoAssinado(ESTOQUE_ID, 'emp-1', arquivo, user);

    expect(svc.anexarTermoAssinado).toHaveBeenCalledWith(ESTOQUE_ID, 'emp-1', arquivo, USER_ID);
  });

  it('visualizarTermo responde PDF inline', async () => {
    // Técnica: partição (disposição inline) | Requisito: CA1
    const file = await controller.visualizarTermo(ESTOQUE_ID, 'emp-1', user);

    const headers = file.getHeaders();
    expect(headers.type).toBe('application/pdf');
    expect(headers.disposition).toBe('inline; filename="termo-01-2026.pdf"');
  });

  it('baixarTermo responde PDF como anexo', async () => {
    // Técnica: partição (disposição attachment) | Requisito: CA1
    const file = await controller.baixarTermo(ESTOQUE_ID, 'emp-1', user);

    expect(file.getHeaders().disposition).toBe('attachment; filename="termo-01-2026.pdf"');
  });

  it('baixarTermoAssinado responde o PDF assinado como anexo', async () => {
    // Técnica: partição (termo assinado) | Requisito: CA4
    const file = await controller.baixarTermoAssinado(ESTOQUE_ID, 'emp-1', user);

    const headers = file.getHeaders();
    expect(headers.type).toBe('application/pdf');
    expect(headers.disposition).toBe('attachment; filename="termo-01-2026-assinado.pdf"');
    expect(svc.obterPdfAssinado).toHaveBeenCalledWith(ESTOQUE_ID, 'emp-1', user);
  });
});
