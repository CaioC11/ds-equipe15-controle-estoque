// Suíte v2 da US04 (Registro de empréstimo e devolução).
// Base: suíte v1 (tests/v1-llm/us04-emprestimos.spec.ts), mantida e corrigida, mais os testes das lacunas.
// Código sob teste: versão com a S3-20 (#100) implementada (bloqueio por atraso e justificativa de permanência).
// Convenção dos comentários:
//   "v1"                     -> teste mantido da v1
//   "[v2] Lacuna CT-04-xx"   -> teste novo ou corrigido; xx é o caso da matriz-rastreabilidade-us4.md
// S3-21 (#101) implementada: CA-02 e CA-10 agora têm testes executáveis. Só PR-04 permanece como todo.
import { HttpStatus } from '@nestjs/common';
import { StatusEmprestimo, StatusItem, TipoItem, TipoMovimentacao } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessRole } from '../../src/common/auth/access-role.enum';
import { AccessDeniedException } from '../../src/common/exceptions/access-denied.exception';
import { AppException } from '../../src/common/exceptions/app.exception';
import { ResourceConflictException } from '../../src/common/exceptions/resource-conflict.exception';
import { ResourceNotFoundException } from '../../src/common/exceptions/resource-not-found.exception';
import { CreateEmprestimoSchema } from '../../src/modules/emprestimos/dto/create-emprestimo.dto';
import { RegistrarJustificativaPermanenciaSchema } from '../../src/modules/emprestimos/dto/registrar-justificativa-permanencia.dto';
import {
  EmprestimosService,
  estaAtrasado,
} from '../../src/modules/emprestimos/emprestimos.service';
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
const ROLE_NAO_ADMIN = AccessRole.USER;

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
const OUTRO_RESPONSAVEL = {
  id: 'resp-2',
  nome: 'João Lima',
  siape: '7654321',
  cpf: null,
  lotacao: 'DEE',
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
  justificativaPermanencia: null as string | null,
  dataDevolucaoEfetiva: null,
  termoId: 'termo-1',
  item: ITEM,
  responsavel: RESPONSAVEL,
  termo: {
    id: 'termo-1',
    numeroAno: '01/2026',
    arquivoPdf: '2026/a.pdf',
    arquivoAssinado: null as string | null,
  },
  ...over,
});

const arquivoPdf = (over: Record<string, unknown> = {}) => {
  const buffer = Buffer.concat([PDF_MAGIC, Buffer.from('-1.4 conteudo')]);
  return {
    buffer,
    size: buffer.length,
    mimetype: TERMO_ASSINADO_MIME,
    originalname: 'termo.pdf',
    ...over,
  } as any;
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
    responsavel: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
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

// [v2] Simula os empréstimos já existentes, respeitando os filtros que o service envia ao Prisma:
// id, item, responsável, status, prazoDevolucao.lt e justificativaPermanencia nula.
function simularEmprestimosExistentes(prisma: any, lista: any[]) {
  const statusOk = (e: any, st: any) =>
    st === undefined ||
    (typeof st === 'string' ? e.status === st : !st.in || st.in.includes(e.status));
  const prazoOk = (e: any, p: any) =>
    p === undefined || p?.lt === undefined || (e.prazoDevolucao != null && e.prazoDevolucao < p.lt);
  const casa = (e: any, where: any) =>
    !where ||
    ((!where.id || e.id === where.id) &&
      (!where.itemId || e.itemId === where.itemId) &&
      (!where.responsavelId || e.responsavelId === where.responsavelId) &&
      statusOk(e, where.status) &&
      prazoOk(e, where.prazoDevolucao) &&
      (where.justificativaPermanencia !== null || e.justificativaPermanencia == null));
  prisma.emprestimo.findFirst.mockImplementation(
    async ({ where }: any) => lista.find((e) => casa(e, where)) ?? null,
  );
  prisma.emprestimo.findMany.mockImplementation(async ({ where }: any) =>
    lista.filter((e) => casa(e, where)),
  );
  prisma.emprestimo.count.mockImplementation(
    async ({ where }: any) => lista.filter((e) => casa(e, where)).length,
  );
}

let prisma: any;
let termoPdf: { gerar: ReturnType<typeof vi.fn> };
let termoStorage: {
  write: ReturnType<typeof vi.fn>;
  read: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};
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
  const entrada = (
    over: Record<string, unknown> = {},
    responsavel: Record<string, unknown> = {},
  ) => ({
    itemId: 'item-1',
    responsavel: {
      nome: 'Maria Souza',
      siape: '1234567',
      lotacao: 'DCC',
      cargo: 'Docente',
      ...responsavel,
    },
    ...over,
  });
  const caminhos = (r: any) => r.error.issues.map((i: any) => i.path.join('.'));

  it('aceita a entrada mínima válida identificada por Siape', () => {
    // v1 | Técnica: partição (classe válida) | Requisito: CA1
    expect(CreateEmprestimoSchema.safeParse(entrada()).success).toBe(true);
  });

  it('aceita responsável identificado apenas por CPF', () => {
    // v1 | Técnica: partição (classe válida: só CPF) | Requisito: CA1, CA2
    const r = CreateEmprestimoSchema.safeParse(
      entrada({}, { siape: undefined, cpf: '12345678901' }),
    );
    expect(r.success).toBe(true);
  });

  it('aceita Siape e CPF informados juntos', () => {
    // v1 | Técnica: partição (classe válida: ambos) | Requisito: CA2
    const r = CreateEmprestimoSchema.safeParse(entrada({}, { cpf: '12345678901' }));
    expect(r.success).toBe(true);
  });

  it('normaliza CPF com máscara para 11 dígitos', () => {
    // v1 | Técnica: partição (CPF mascarado válido) | Requisito: CA2
    const r: any = CreateEmprestimoSchema.safeParse(
      entrada({}, { siape: undefined, cpf: '123.456.789-01' }),
    );
    expect(r.success).toBe(true);
    expect(r.data.responsavel.cpf).toBe('12345678901');
  });

  it.each([
    ['10 dígitos (abaixo do limite)', '1234567890', false],
    ['11 dígitos (limite válido)', '12345678901', true],
    ['12 dígitos (acima do limite)', '123456789012', false],
    ['sem dígitos', 'abc.def.ghi-jk', false],
  ])('CPF com %s', (_desc, cpf, valido) => {
    // v1 | Técnica: valor-limite (tamanho do CPF 10/11/12) | Requisito: CA1, CA2
    const r = CreateEmprestimoSchema.safeParse(entrada({}, { siape: undefined, cpf }));
    expect(r.success).toBe(valido);
  });

  it('rejeita responsável sem Siape e sem CPF', () => {
    // v1 | Técnica: partição (classe inválida: nenhum identificador) | Requisito: CA2 | CT-04-07 (PRD-03)
    const r: any = CreateEmprestimoSchema.safeParse(entrada({}, { siape: undefined }));
    expect(r.success).toBe(false);
    expect(caminhos(r)).toContain('responsavel.siape');
  });

  it.each([
    ['vazio (0 caracteres)', '', false],
    ['somente espaços', '   ', false],
    ['1 caractere (limite mínimo)', '7', true],
  ])('Siape %s', (_desc, siape, valido) => {
    // v1 | Técnica: valor-limite (tamanho mínimo do Siape) | Requisito: CA1
    const r = CreateEmprestimoSchema.safeParse(entrada({}, { siape }));
    expect(r.success).toBe(valido);
  });

  describe.each(['nome', 'lotacao', 'cargo'])('campo obrigatório do responsável: %s', (campo) => {
    it.each([
      ['ausente', undefined],
      ['string vazia', ''],
      ['somente espaços', '   '],
    ])('rejeita quando %s', (_desc, valor) => {
      // v1 | Técnica: partição (classes inválidas) + valor-limite (0 caracteres) | Requisito: CA1 | CT-04-06 (PRD-02, campo nome)
      const r: any = CreateEmprestimoSchema.safeParse(entrada({}, { [campo]: valor }));
      expect(r.success).toBe(false);
      expect(caminhos(r)).toContain(`responsavel.${campo}`);
    });

    it('aceita com 1 caractere', () => {
      // v1 | Técnica: valor-limite (tamanho mínimo 1) | Requisito: CA1
      expect(CreateEmprestimoSchema.safeParse(entrada({}, { [campo]: 'X' })).success).toBe(true);
    });
  });

  it.each([
    ['e-mail válido', 'maria@ufpe.br', true],
    ['e-mail sem domínio', 'maria@', false],
    ['e-mail sem arroba', 'maria.ufpe.br', false],
    ['e-mail ausente (opcional)', undefined, true],
  ])('%s', (_desc, email, valido) => {
    // v1 | Técnica: partição (e-mail válido/inválido/ausente) | Requisito: CA1
    expect(CreateEmprestimoSchema.safeParse(entrada({}, { email })).success).toBe(valido);
  });

  it.each([
    ['ausente', undefined],
    ['vazio', ''],
    ['somente espaços', '   '],
  ])('rejeita itemId %s', (_desc, itemId) => {
    // v1 | Técnica: partição (itemId inválido) + valor-limite (0 caracteres) | Requisito: CA1
    const r: any = CreateEmprestimoSchema.safeParse(entrada({ itemId }));
    expect(r.success).toBe(false);
    expect(caminhos(r)).toContain('itemId');
  });

  it.each([
    ['ausente', undefined],
    ['nulo', null],
  ])('[v2] rejeita a entrada com o responsável %s', (_desc, responsavel) => {
    // [v2] Lacuna CT-04-04 (PRO-03) | Técnica: partição (responsável não informado) | Requisito: CA-01
    const r: any = CreateEmprestimoSchema.safeParse({ itemId: 'item-1', responsavel });
    expect(r.success).toBe(false);
    expect(caminhos(r)).toContain('responsavel');
  });

  describe('prazo de devolução', () => {
    it('mantém o prazo indefinido (undefined) quando omitido', () => {
      // v1 | Técnica: partição (prazo omitido) | Requisito: CA3 | CT-04-12
      const r: any = CreateEmprestimoSchema.safeParse(entrada());
      expect(r.success).toBe(true);
      expect(r.data.prazoDevolucao).toBeUndefined();
    });

    it('aceita prazo null como indefinido', () => {
      // v1 | Técnica: partição (prazo nulo) | Requisito: CA3 | CT-04-12
      const r: any = CreateEmprestimoSchema.safeParse(entrada({ prazoDevolucao: null }));
      expect(r.success).toBe(true);
      expect(r.data.prazoDevolucao).toBeNull();
    });

    it('converte prazo informado em Date', () => {
      // v1 | Técnica: partição (prazo válido) | Requisito: CA3
      const r: any = CreateEmprestimoSchema.safeParse(
        entrada({ prazoDevolucao: '2026-12-31T00:00:00.000Z' }),
      );
      expect(r.success).toBe(true);
      expect(r.data.prazoDevolucao).toEqual(new Date('2026-12-31T00:00:00.000Z'));
    });

    it.each(['não-é-data', ''])('rejeita prazo inválido "%s"', (prazoDevolucao) => {
      // v1 | Técnica: partição (prazo inválido) | Requisito: CA3 | CT-04-15
      const r: any = CreateEmprestimoSchema.safeParse(entrada({ prazoDevolucao }));
      expect(r.success).toBe(false);
      expect(caminhos(r)).toContain('prazoDevolucao');
    });

    it('rejeita data de retirada inválida', () => {
      // v1 | Técnica: partição (data de retirada inválida) | Requisito: CA1
      const r: any = CreateEmprestimoSchema.safeParse(entrada({ dataRetirada: 'ontem-talvez' }));
      expect(r.success).toBe(false);
      expect(caminhos(r)).toContain('dataRetirada');
    });

    it.each([
      ['1 ms antes da retirada (abaixo do limite)', '2026-11-13T09:59:59.999Z', false],
      ['exatamente na retirada (limite)', '2026-11-13T10:00:00.000Z', true],
      ['1 ms depois da retirada (acima do limite)', '2026-11-13T10:00:00.001Z', true],
    ])('prazo %s', (_desc, prazoDevolucao, valido) => {
      // v1 | Técnica: valor-limite (prazo vs. data de retirada) | Requisito: CA3 | CT-04-13, CT-04-14
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
  const ativo = (prazoDevolucao: Date | null) => ({
    status: StatusEmprestimo.ATIVO,
    prazoDevolucao,
  });

  it('é atraso quando o prazo venceu 1 ms antes de agora', () => {
    // v1 | Técnica: valor-limite (prazo = agora - 1 ms) | Requisito: CA8 | CT-04-29
    expect(estaAtrasado(ativo(new Date(AGORA.getTime() - 1)), AGORA)).toBe(true);
  });

  it('não é atraso quando o prazo é exatamente agora', () => {
    // v1 | Técnica: valor-limite (prazo = agora) | Requisito: CA8 | CT-04-28 (instante)
    expect(estaAtrasado(ativo(new Date(AGORA.getTime())), AGORA)).toBe(false);
  });

  it('não é atraso quando o prazo vence 1 ms depois de agora', () => {
    // v1 | Técnica: valor-limite (prazo = agora + 1 ms) | Requisito: CA8
    expect(estaAtrasado(ativo(new Date(AGORA.getTime() + 1)), AGORA)).toBe(false);
  });

  it('não é atraso quando o prazo é indefinido', () => {
    // v1 | Técnica: partição (prazo nulo) | Requisito: CA3, CA8 | CT-04-30
    expect(estaAtrasado(ativo(null), AGORA)).toBe(false);
  });

  it.each([
    StatusEmprestimo.AGUARDANDO_TERMO,
    StatusEmprestimo.DEVOLVIDO,
  ])('não é atraso para status %s mesmo com prazo vencido', (status) => {
    // v1 | Técnica: partição (status diferente de ATIVO) | Requisito: CA8 | CT-04-31, CT-04-32
    expect(
      estaAtrasado({ status, prazoDevolucao: new Date(AGORA.getTime() - UM_DIA) }, AGORA),
    ).toBe(false);
  });

  it('usa a data atual quando "agora" não é informado', () => {
    // v1 | Técnica: partição (parâmetro padrão) | Requisito: CA8
    expect(estaAtrasado(ativo(new Date(AGORA.getTime() - 1)))).toBe(true);
    expect(estaAtrasado(ativo(new Date(AGORA.getTime() + UM_DIA)))).toBe(false);
  });

  it('[v2] é atraso quando o prazo venceu há 5 dias e não é quando vence daqui a 5 dias', () => {
    // [v2] Lacuna CT-04-26 e CT-04-27 (PAT-01, PAT-02): valores da matriz (5 dias) | Técnica: partição | Requisito: CA-08
    expect(estaAtrasado(ativo(new Date(AGORA.getTime() - 5 * UM_DIA)), AGORA)).toBe(true);
    expect(estaAtrasado(ativo(new Date(AGORA.getTime() + 5 * UM_DIA)), AGORA)).toBe(false);
  });

  // [v2] Lacuna CT-04-28 (PR-04, LM-02 lado "hoje"): a matriz espera que no dia do prazo ainda não haja atraso,
  // mas o código compara o instante (prazoDevolucao < agora). Aguarda a equipe confirmar a premissa PR-04.
  it.todo(
    '[v2] CT-04-28: prazo igual a hoje (qualquer horário do dia) não é atraso — depende de confirmar PR-04',
  );
});

// ---------------------------------------------------------------------------
// EmprestimosService.create
// ---------------------------------------------------------------------------
describe('EmprestimosService.create', () => {
  beforeEach(() => {
    configurarCaminhoFelizDeCreate(prisma, termoPdf, termoStorage);
  });

  it('[v2] registra o empréstimo de item disponível, para responsável já cadastrado, aguardando o termo assinado', async () => {
    // [v2] Lacuna CT-04-01 (PRO-01, PRS-01): v1 usava responsável novo e conferia um status vindo do mock.
    // Agora o responsável já existe, não há empréstimos dele e o status nasce do default do banco (data sem status).
    prisma.responsavel.findMany.mockResolvedValue([RESPONSAVEL]);
    simularEmprestimosExistentes(prisma, []);

    const r: any = await service.create(ESTOQUE_ID, criarDto(), USER_ID);

    const { data } = prisma.emprestimo.create.mock.calls[0][0];
    expect(data).toEqual(
      expect.objectContaining({ itemId: ITEM.id, responsavelId: RESPONSAVEL.id }),
    );
    expect(data.status).toBeUndefined();
    expect(r.termoAssinadoAnexado).toBe(false);
    expect(r.termo).toEqual({ id: 'termo-1', numeroAno: '01/2026' });
    // O item só vira EMPRESTADO na confirmação da entrega (CA4)
    expect(prisma.item.update).not.toHaveBeenCalled();
  });

  it('[v2] registra empréstimo de item patrimonial sem tombamento, identificado pelo nº de série', async () => {
    // [v2] Lacuna CT-04-02 (PIT-02) | Técnica: partição (patrimonial sem tombamento, com nº de série) | Requisito: CA-01
    prisma.item.findFirst.mockResolvedValue({ ...ITEM, tombamento: null });

    await service.create(ESTOQUE_ID, criarDto(), USER_ID);

    expect(prisma.emprestimo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ itemId: ITEM.id }) }),
    );
    expect(termoPdf.gerar).toHaveBeenCalledWith(
      expect.objectContaining({
        item: expect.objectContaining({ tombamento: null, numeroSerie: 'SN-1' }),
      }),
    );
  });

  it('cadastra o responsável no ato quando ele ainda não existe', async () => {
    // v1 | Técnica: partição (responsável novo) | Requisito: CA1 | CT-04-03
    await service.create(ESTOQUE_ID, criarDto(), USER_ID);

    expect(prisma.responsavel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nome: 'Maria Souza',
        siape: '1234567',
        lotacao: 'DCC',
        cargo: 'Docente',
      }),
    });
    expect(prisma.responsavel.update).not.toHaveBeenCalled();
    expect(prisma.emprestimo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ responsavelId: RESPONSAVEL.id }) }),
    );
  });

  it('reaproveita o responsável já cadastrado (encontrado por Siape) sem duplicar', async () => {
    // v1 | Técnica: partição (responsável existente) | Requisito: CA2 | CT-04-10 (parcial: o gestor reenvia os dados)
    prisma.responsavel.findMany.mockResolvedValue([RESPONSAVEL]);

    await service.create(ESTOQUE_ID, criarDto(), USER_ID);

    expect(prisma.responsavel.findMany).toHaveBeenCalledWith({
      where: { OR: [{ siape: '1234567' }] },
    });
    expect(prisma.responsavel.create).not.toHaveBeenCalled();
    expect(prisma.responsavel.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: RESPONSAVEL.id } }),
    );
    expect(prisma.emprestimo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ responsavelId: RESPONSAVEL.id }) }),
    );
  });

  it('procura o responsável existente por CPF quando não há Siape', async () => {
    // v1 | Técnica: partição (identificação só por CPF) | Requisito: CA2
    prisma.responsavel.findMany.mockResolvedValue([RESPONSAVEL]);
    const dto = criarDto({
      responsavel: { nome: 'Maria Souza', cpf: '12345678901', lotacao: 'DCC', cargo: 'Docente' },
    });

    await service.create(ESTOQUE_ID, dto, USER_ID);

    expect(prisma.responsavel.findMany).toHaveBeenCalledWith({
      where: { OR: [{ cpf: '12345678901' }] },
    });
  });

  it('procura por Siape e CPF quando ambos são informados', async () => {
    // v1 | Técnica: partição (identificação por Siape e CPF) | Requisito: CA2
    const dto = criarDto({
      responsavel: {
        nome: 'Maria',
        siape: '1234567',
        cpf: '12345678901',
        lotacao: 'DCC',
        cargo: 'Docente',
      },
    });

    await service.create(ESTOQUE_ID, dto, USER_ID);

    expect(prisma.responsavel.findMany).toHaveBeenCalledWith({
      where: { OR: [{ siape: '1234567' }, { cpf: '12345678901' }] },
    });
  });

  it('recusa quando Siape e CPF pertencem a responsáveis diferentes', async () => {
    // v1 | Técnica: partição (identificadores conflitantes) | Requisito: CA2
    prisma.responsavel.findMany.mockResolvedValue([RESPONSAVEL, { ...RESPONSAVEL, id: 'resp-2' }]);
    const dto = criarDto({
      responsavel: {
        nome: 'Maria',
        siape: '1234567',
        cpf: '12345678901',
        lotacao: 'DCC',
        cargo: 'Docente',
      },
    });

    await expect(service.create(ESTOQUE_ID, dto, USER_ID)).rejects.toBeInstanceOf(
      ResourceConflictException,
    );
    expect(prisma.emprestimo.create).not.toHaveBeenCalled();
  });

  // [v2] CT-04-05, 09 e 10: executados no grupo S3-21 abaixo.

  it('guarda o prazo de devolução quando informado', async () => {
    // v1 | Técnica: partição (prazo informado) | Requisito: CA3 | CT-04-11
    const prazo = new Date('2026-12-20T00:00:00.000Z');

    await service.create(ESTOQUE_ID, criarDto({ prazoDevolucao: prazo }), USER_ID);

    expect(prisma.emprestimo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ prazoDevolucao: prazo }) }),
    );
  });

  it.each([
    ['omitido', undefined],
    ['nulo', null],
  ])('[v2] deixa o prazo indefinido (null) quando %s', async (_desc, prazoDevolucao) => {
    // [v2] Lacuna CT-04-12 (PPZ-02): na v1 falhava por oráculo errado (lia o retorno do mock, que não traz o prazo).
    // Agora confere só o dado gravado, que é o que o service decide.
    await service.create(ESTOQUE_ID, criarDto({ prazoDevolucao }), USER_ID);

    const { data } = prisma.emprestimo.create.mock.calls[0][0];
    expect(data.prazoDevolucao).toBeNull();
  });

  it('usa a data atual como retirada quando omitida', async () => {
    // v1 | Técnica: partição (retirada omitida) | Requisito: CA1
    await service.create(ESTOQUE_ID, criarDto(), USER_ID);

    expect(prisma.emprestimo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dataRetirada: AGORA }) }),
    );
  });

  it('recusa prazo 1 ms anterior à retirada', async () => {
    // v1 | Técnica: valor-limite (prazo = retirada - 1 ms) | Requisito: CA3 | CT-04-13
    const retirada = new Date('2026-11-13T10:00:00.000Z');
    const dto = criarDto({
      dataRetirada: retirada,
      prazoDevolucao: new Date(retirada.getTime() - 1),
    });

    const erro = await erroDe(service.create(ESTOQUE_ID, dto, USER_ID));

    expect(erro).toBeInstanceOf(AppException);
    expect(erro.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(prisma.emprestimo.create).not.toHaveBeenCalled();
  });

  it.each([
    ['igual à retirada', 0],
    ['1 ms depois da retirada', 1],
  ])('[v2] aceita prazo %s e o guarda como informado', async (_desc, delta) => {
    // [v2] Lacuna CT-04-14 (PPZ-04, LM-01 lado aceito): a v1 só conferia que a chamada resolvia (toBeDefined).
    const retirada = new Date('2026-11-13T10:00:00.000Z');
    const prazo = new Date(retirada.getTime() + delta);

    await service.create(
      ESTOQUE_ID,
      criarDto({ dataRetirada: retirada, prazoDevolucao: prazo }),
      USER_ID,
    );

    expect(prisma.emprestimo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ prazoDevolucao: prazo }) }),
    );
  });

  it('recusa empréstimo de item que já está emprestado', async () => {
    // v1 | Técnica: partição (status do item inválido: EMPRESTADO) | Requisito: CA5 | CT-04-19
    prisma.item.findFirst.mockResolvedValue({ ...ITEM, status: StatusItem.EMPRESTADO });

    await expect(service.create(ESTOQUE_ID, criarDto(), USER_ID)).rejects.toBeInstanceOf(
      ResourceConflictException,
    );
    expect(prisma.emprestimo.create).not.toHaveBeenCalled();
    expect(prisma.item.update).not.toHaveBeenCalled();
  });

  it('recusa quando já existe empréstimo aguardando termo ou ativo para o item (corrida)', async () => {
    // v1 | Técnica: partição (empréstimo em aberto na transação) | Requisito: CA5 | CT-04-19, CT-04-20
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

  it('[v2] aceita novo empréstimo de item que já foi emprestado e devolvido', async () => {
    // [v2] Lacuna CT-04-21 (PIS-04, LM-04 lado aceito): o item tem um empréstimo DEVOLVIDO no histórico.
    // O mock só devolve o empréstimo se o filtro do service incluir o status dele.
    const devolvido = emprestimoBase({
      id: 'emp-antigo',
      status: StatusEmprestimo.DEVOLVIDO,
      dataDevolucaoEfetiva: new Date('2026-11-05T00:00:00.000Z'),
    });
    simularEmprestimosExistentes(prisma, [devolvido]);

    await expect(service.create(ESTOQUE_ID, criarDto(), USER_ID)).resolves.toBeDefined();

    const { where } = prisma.emprestimo.findFirst.mock.calls[0][0];
    expect(where.status.in).not.toContain(StatusEmprestimo.DEVOLVIDO);
    expect(prisma.emprestimo.create).toHaveBeenCalledTimes(1);
  });

  it('recusa item de consumo com erro de validação (400) e sem abrir transação', async () => {
    // v1 | Técnica: partição (tipo do item inválido: CONSUMO) | Requisito: CA6 | CT-04-22
    prisma.item.findFirst.mockResolvedValue({ ...ITEM, tipo: TipoItem.CONSUMO });

    const erro = await erroDe(service.create(ESTOQUE_ID, criarDto(), USER_ID));

    expect(erro).toBeInstanceOf(AppException);
    expect(erro.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.emprestimo.create).not.toHaveBeenCalled();
    expect(prisma.movimentacao.create).not.toHaveBeenCalled();
  });

  it('recusa item inexistente (ou de outro estoque) com 404', async () => {
    // v1 | Técnica: partição (item inexistente) | Requisito: CA1 | CT-04-08 ([v2] agora confere que nada foi criado)
    prisma.item.findFirst.mockResolvedValue(null);

    await expect(service.create(ESTOQUE_ID, criarDto(), USER_ID)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    expect(prisma.item.findFirst).toHaveBeenCalledWith({
      where: { id: ITEM.id, estoqueId: ESTOQUE_ID },
    });
    expect(prisma.emprestimo.create).not.toHaveBeenCalled();
  });

  it('recusa estoque inexistente com 404', async () => {
    // v1 | Técnica: partição (estoque inexistente) | Requisito: CA1
    prisma.estoque.findUnique.mockResolvedValue(null);

    await expect(service.create(ESTOQUE_ID, criarDto(), USER_ID)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it.each([
    ['usuário sem vínculo de gestor', USER_ID, null],
    ['usuário não identificado', undefined, { estoqueId: ESTOQUE_ID, usuarioId: USER_ID }],
  ])('nega acesso a %s', async (_desc, userId, vinculo) => {
    // v1 | Técnica: partição (permissão inválida) | Requisito: CA1 | CT-04-41
    prisma.estoqueGestor.findUnique.mockResolvedValue(vinculo);

    await expect(service.create(ESTOQUE_ID, criarDto(), userId)).rejects.toBeInstanceOf(
      AccessDeniedException,
    );
    expect(prisma.emprestimo.create).not.toHaveBeenCalled();
  });

  it('registra a movimentação de saída com o usuário gestor', async () => {
    // v1 | Técnica: critério (efeito colateral do registro) | Requisito: CA1
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
    // v1 | Técnica: valor-limite (preenchimento com zero 1/9/10/3 dígitos) | Requisito: CA1
    prisma.contadorTermo.upsert.mockResolvedValue({ ultimoNumero });

    await service.create(ESTOQUE_ID, criarDto(), USER_ID);

    expect(termoPdf.gerar).toHaveBeenCalledWith(expect.objectContaining({ numeroAno: esperado }));
    expect(prisma.termo.create).toHaveBeenCalledWith({
      data: { numeroAno: esperado, arquivoPdf: expect.stringMatching(/^2026\/.+\.pdf$/) },
    });
  });

  it('grava o PDF do termo no armazenamento', async () => {
    // v1 | Técnica: critério (geração do termo no registro) | Requisito: CA1
    await service.create(ESTOQUE_ID, criarDto(), USER_ID);

    expect(termoStorage.write).toHaveBeenCalledWith(
      expect.stringMatching(/^2026\/.+\.pdf$/),
      Buffer.from('%PDF-gerado'),
    );
  });

  it('remove o PDF já gravado e traduz P2002 em conflito quando a transação falha por unicidade', async () => {
    // v1 | Técnica: partição (falha de unicidade com arquivo criado) | Requisito: CA2
    const { Prisma } = await import('@prisma/client');
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique', {
      code: 'P2002',
      clientVersion: '5',
    });
    prisma.termo.create.mockRejectedValue(p2002);

    await expect(service.create(ESTOQUE_ID, criarDto(), USER_ID)).rejects.toBeInstanceOf(
      ResourceConflictException,
    );
    expect(termoStorage.remove).toHaveBeenCalledWith(termoStorage.write.mock.calls[0][0]);
  });

  it('propaga erros inesperados da transação e limpa o PDF', async () => {
    // v1 | Técnica: partição (erro genérico após criar arquivo) | Requisito: CA1
    const falha = new Error('banco caiu');
    prisma.termo.create.mockRejectedValue(falha);

    await expect(service.create(ESTOQUE_ID, criarDto(), USER_ID)).rejects.toBe(falha);
    expect(termoStorage.remove).toHaveBeenCalledTimes(1);
  });

  it('agrega os erros quando a limpeza do PDF também falha', async () => {
    // v1 | Técnica: partição (falha na transação + falha na limpeza) | Requisito: CA1
    prisma.termo.create.mockRejectedValue(new Error('banco caiu'));
    termoStorage.remove.mockRejectedValue(new Error('disco cheio'));

    await expect(service.create(ESTOQUE_ID, criarDto(), USER_ID)).rejects.toBeInstanceOf(
      AggregateError,
    );
  });

  it('não tenta remover PDF quando a falha ocorre antes da gravação', async () => {
    // v1 | Técnica: partição (falha antes de gravar o arquivo) | Requisito: CA5
    prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase());

    await erroDe(service.create(ESTOQUE_ID, criarDto(), USER_ID));

    expect(termoStorage.write).not.toHaveBeenCalled();
    expect(termoStorage.remove).not.toHaveBeenCalled();
  });

  describe('responsável com item em atraso (CA-09, premissa A5)', () => {
    const atrasado = (over: Record<string, unknown> = {}) =>
      emprestimoBase({
        id: 'emp-0',
        itemId: 'item-9',
        status: StatusEmprestimo.ATIVO,
        prazoDevolucao: new Date(AGORA.getTime() - UM_DIA),
        justificativaPermanencia: null,
        ...over,
      });

    beforeEach(() => {
      prisma.responsavel.findMany.mockResolvedValue([RESPONSAVEL]);
    });

    it('[v2] impede novo empréstimo para responsável com item em atraso', async () => {
      // [v2] Lacuna CT-04-33 (PRS-02, LM-03 lado recusado): na v1 falhava (defeito real); a S3-20 (#100) implementou o bloqueio.
      // Técnica: critério de aceitação (regra de bloqueio) | Requisito: CA-09
      simularEmprestimosExistentes(prisma, [atrasado()]);

      const erro = await erroDe(service.create(ESTOQUE_ID, criarDto(), USER_ID));

      expect(erro).toBeInstanceOf(ResourceConflictException);
      expect(erro.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(prisma.emprestimo.create).not.toHaveBeenCalled();
      expect(termoStorage.write).not.toHaveBeenCalled();
    });

    it('[v2] bloqueia responsável identificado só por CPF, sem Siape — S3-20', async () => {
      // [v2] Lacuna CT-04-33 (identificação só por CPF) | Requisito: CA-09, S3-20 (#100)
      const responsavelCpf = { ...RESPONSAVEL, id: 'resp-cpf', siape: null, cpf: '12345678901' };
      prisma.responsavel.findMany.mockResolvedValue([responsavelCpf]);
      prisma.responsavel.update.mockResolvedValue(responsavelCpf);
      simularEmprestimosExistentes(prisma, [atrasado({ responsavelId: responsavelCpf.id })]);
      const dto = criarDto({
        responsavel: {
          nome: responsavelCpf.nome,
          cpf: responsavelCpf.cpf,
          lotacao: 'DCC',
          cargo: 'Docente',
        },
      });

      const erro = await erroDe(service.create(ESTOQUE_ID, dto, USER_ID));

      expect(prisma.responsavel.findMany).toHaveBeenCalledWith({
        where: { OR: [{ cpf: responsavelCpf.cpf }] },
      });
      expect(prisma.emprestimo.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ responsavelId: responsavelCpf.id }),
        }),
      );
      expect(erro).toBeInstanceOf(ResourceConflictException);
      expect(erro.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(erro.message).toMatch(/atras|pend/i);
      expect(prisma.emprestimo.create).not.toHaveBeenCalled();
      expect(prisma.movimentacao.create).not.toHaveBeenCalled();
      expect(termoStorage.write).not.toHaveBeenCalled();
    });

    it('[v2] informa a pendência na mensagem: responsável, item com tombamento, vencimento e como regularizar', async () => {
      // [v2] Lacuna CT-04-33 | Técnica: critério de aceitação (mensagem ao gestor) | Requisito: CA-09
      simularEmprestimosExistentes(prisma, [atrasado()]);

      const erro = await erroDe(service.create(ESTOQUE_ID, criarDto(), USER_ID));

      expect(erro.message).toContain('Maria Souza');
      expect(erro.message).toContain('Notebook (tombamento 123456)');
      expect(erro.message).toMatch(/em atraso desde \d{2}\/\d{2}\/\d{4}/);
      expect(erro.message).toContain('justificativa de permanência');
    });

    it.each([
      ['item sem tombamento', { item: { ...ITEM, tombamento: null } }, 'com Notebook em atraso'],
      ['item ausente na consulta', { item: null }, 'com um item em atraso'],
    ])('[v2] mensagem de pendência para %s', async (_desc, over, trecho) => {
      // [v2] Lacuna CT-04-33 (ramos da mensagem) | Técnica: partição (descrição do item) | Requisito: CA-09
      simularEmprestimosExistentes(prisma, [atrasado(over)]);

      const erro = await erroDe(service.create(ESTOQUE_ID, criarDto(), USER_ID));

      expect(erro.message).toContain(trecho);
      expect(erro.message).not.toContain('tombamento');
    });

    it('[v2] consulta o atraso do responsável: só ATIVO, prazo vencido e sem justificativa', async () => {
      // [v2] Lacuna CT-04-34, CT-04-35, CT-04-36 (filtro que decide o bloqueio) | Requisito: CA-09
      simularEmprestimosExistentes(prisma, []);

      await service.create(ESTOQUE_ID, criarDto(), USER_ID);

      const wheres = prisma.emprestimo.findFirst.mock.calls.map((c: any[]) => c[0].where);
      expect(wheres).toContainEqual({
        responsavelId: RESPONSAVEL.id,
        status: StatusEmprestimo.ATIVO,
        prazoDevolucao: { lt: AGORA },
        justificativaPermanencia: null,
      });
    });

    it('[v2] impede quando o prazo venceu 1 ms antes de agora', async () => {
      // [v2] Lacuna LM-02/LM-03 (lado recusado, valor-limite) | Requisito: CA-09
      simularEmprestimosExistentes(prisma, [
        atrasado({ prazoDevolucao: new Date(AGORA.getTime() - 1) }),
      ]);

      await expect(service.create(ESTOQUE_ID, criarDto(), USER_ID)).rejects.toBeInstanceOf(
        ResourceConflictException,
      );
    });

    it.each([
      ['ativo ainda dentro do prazo', { prazoDevolucao: new Date(AGORA.getTime() + 5 * UM_DIA) }],
      ['ativo com prazo indefinido', { prazoDevolucao: null }],
      [
        'ativo com prazo exatamente agora (limite: ainda sem atraso)',
        { prazoDevolucao: new Date(AGORA.getTime()) },
      ],
      ['aguardando termo com prazo vencido', { status: StatusEmprestimo.AGUARDANDO_TERMO }],
      ['já devolvido', { status: StatusEmprestimo.DEVOLVIDO }],
      [
        'em atraso, mas com justificativa de permanência registrada',
        { justificativaPermanencia: 'Item em uso no projeto' },
      ],
    ])('[v2] aceita novo empréstimo quando o responsável tem empréstimo %s', async (_desc, over) => {
      // [v2] Lacuna CT-04-34 e CT-04-36 (PRS-04, PRS-05, LM-03 lado aceito) | Técnica: partição | Requisito: CA-09
      simularEmprestimosExistentes(prisma, [atrasado(over)]);

      await expect(service.create(ESTOQUE_ID, criarDto(), USER_ID)).resolves.toBeDefined();
      expect(prisma.emprestimo.create).toHaveBeenCalledTimes(1);
    });

    it('[v2] aceita novo empréstimo depois que o responsável devolve o item em atraso', async () => {
      // [v2] Lacuna CT-04-35 (PRS-03) | Técnica: partição (atraso regularizado pela devolução) | Requisito: CA-09
      const emAtraso = atrasado();
      simularEmprestimosExistentes(prisma, [emAtraso]);
      prisma.emprestimo.updateMany.mockImplementation(async ({ where, data }: any) => {
        if (emAtraso.status !== where.status) return { count: 0 };
        Object.assign(emAtraso, data);
        return { count: 1 };
      });
      prisma.item.update.mockResolvedValue({});
      prisma.emprestimo.findUniqueOrThrow.mockImplementation(async () => emAtraso);

      await expect(service.create(ESTOQUE_ID, criarDto(), USER_ID)).rejects.toBeInstanceOf(
        ResourceConflictException,
      );
      await service.devolver(ESTOQUE_ID, 'emp-0', USER_ID);
      expect(emAtraso.status).toBe(StatusEmprestimo.DEVOLVIDO);

      await expect(service.create(ESTOQUE_ID, criarDto(), USER_ID)).resolves.toBeDefined();
      expect(prisma.emprestimo.create).toHaveBeenCalledTimes(1);
    });

    it('[v2] libera o novo empréstimo depois que o gestor registra a justificativa de permanência', async () => {
      // [v2] Lacuna CT-04-36 (PRS-04, PR-06) | Técnica: critério de aceitação (fluxo bloqueio -> justificativa -> liberação) | Requisito: CA-09
      const emAtraso = atrasado();
      simularEmprestimosExistentes(prisma, [emAtraso]);
      prisma.emprestimo.updateMany.mockImplementation(async ({ where, data }: any) => {
        if (where.justificativaPermanencia === null && emAtraso.justificativaPermanencia != null)
          return { count: 0 };
        Object.assign(emAtraso, data);
        return { count: 1 };
      });
      prisma.emprestimo.findUniqueOrThrow.mockImplementation(async () => emAtraso);

      await expect(service.create(ESTOQUE_ID, criarDto(), USER_ID)).rejects.toBeInstanceOf(
        ResourceConflictException,
      );
      await service.registrarJustificativaPermanencia(
        ESTOQUE_ID,
        'emp-0',
        { justificativa: 'Item em uso no projeto de pesquisa' } as any,
        USER_ID,
      );
      expect(emAtraso.status).toBe(StatusEmprestimo.ATIVO);

      await expect(service.create(ESTOQUE_ID, criarDto(), USER_ID)).resolves.toBeDefined();
      expect(prisma.emprestimo.create).toHaveBeenCalledTimes(1);
    });

    it('[v2] o atraso de um responsável não impede o empréstimo de outro responsável', async () => {
      // [v2] Lacuna CT-04-37 (PRS-02 isolado por responsável) | Técnica: partição | Requisito: CA-09
      simularEmprestimosExistentes(prisma, [atrasado()]);
      prisma.responsavel.findMany.mockResolvedValue([]);
      prisma.responsavel.create.mockResolvedValue(OUTRO_RESPONSAVEL);
      const dto = criarDto({
        responsavel: { nome: 'João Lima', siape: '7654321', lotacao: 'DEE', cargo: 'Docente' },
      });

      await expect(service.create(ESTOQUE_ID, dto, USER_ID)).resolves.toBeDefined();
      expect(prisma.emprestimo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ responsavelId: OUTRO_RESPONSAVEL.id }),
        }),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// EmprestimosService.anexarTermoAssinado
// ---------------------------------------------------------------------------
describe('EmprestimosService.anexarTermoAssinado', () => {
  beforeEach(() => {
    prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase());
    prisma.emprestimo.findUniqueOrThrow.mockResolvedValue(
      emprestimoBase({
        termo: { id: 'termo-1', numeroAno: '01/2026', arquivoAssinado: 'novo.pdf' },
      }),
    );
    prisma.termo.update.mockResolvedValue({});
    termoStorage.write.mockResolvedValue(undefined);
    termoStorage.remove.mockResolvedValue(undefined);
  });

  it('anexa o PDF assinado sem ativar o empréstimo', async () => {
    // v1 | Técnica: critério de aceitação (anexo antes da confirmação) | Requisito: CA4 | CT-04-18
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
    // v1 | Técnica: partição (já existe termo assinado) | Requisito: CA4
    prisma.emprestimo.findFirst.mockResolvedValue(
      emprestimoBase({
        termo: {
          id: 'termo-1',
          numeroAno: '01/2026',
          arquivoPdf: 'x.pdf',
          arquivoAssinado: 'velho.pdf',
        },
      }),
    );

    await service.anexarTermoAssinado(ESTOQUE_ID, 'emp-1', arquivoPdf(), USER_ID);

    expect(termoStorage.remove).toHaveBeenCalledWith('velho.pdf');
  });

  it('não remove nada quando não havia anexo anterior', async () => {
    // v1 | Técnica: partição (primeiro anexo) | Requisito: CA4
    await service.anexarTermoAssinado(ESTOQUE_ID, 'emp-1', arquivoPdf(), USER_ID);

    expect(termoStorage.remove).not.toHaveBeenCalled();
  });

  it.each([
    ['arquivo ausente', undefined],
    ['buffer vazio', arquivoPdf({ buffer: Buffer.alloc(0), size: 0 })],
    ['tipo não PDF', arquivoPdf({ mimetype: 'image/png' })],
    [
      'conteúdo sem assinatura %PDF',
      arquivoPdf({ buffer: Buffer.from('nao e um pdf de verdade'), size: 24 }),
    ],
    ['tamanho 1 byte acima do limite', arquivoPdf({ size: TERMO_ASSINADO_MAX_BYTES + 1 })],
  ])('rejeita com 400: %s', async (_desc, arquivo) => {
    // v1 | Técnica: partição (arquivos inválidos) + valor-limite (limite + 1) | Requisito: CA4
    const erro = await erroDe(service.anexarTermoAssinado(ESTOQUE_ID, 'emp-1', arquivo, USER_ID));

    expect(erro).toBeInstanceOf(AppException);
    expect(erro.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(termoStorage.write).not.toHaveBeenCalled();
  });

  it.each([
    ['exatamente no limite', TERMO_ASSINADO_MAX_BYTES],
    ['1 byte abaixo do limite', TERMO_ASSINADO_MAX_BYTES - 1],
  ])('[v2] aceita arquivo com tamanho %s e grava o anexo', async (_desc, size) => {
    // [v2] Lacuna (teste trivial da v1: só conferia toBeDefined) | Técnica: valor-limite (tamanho máximo) | Requisito: CA4
    const r: any = await service.anexarTermoAssinado(
      ESTOQUE_ID,
      'emp-1',
      arquivoPdf({ size }),
      USER_ID,
    );

    expect(termoStorage.write).toHaveBeenCalledTimes(1);
    expect(prisma.termo.update).toHaveBeenCalledTimes(1);
    expect(r.termoAssinadoAnexado).toBe(true);
  });

  it.each([
    StatusEmprestimo.ATIVO,
    StatusEmprestimo.DEVOLVIDO,
  ])('recusa anexo quando o empréstimo está %s', async (status) => {
    // v1 | Técnica: partição (status inválido) | Requisito: CA4
    prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase({ status }));

    await expect(
      service.anexarTermoAssinado(ESTOQUE_ID, 'emp-1', arquivoPdf(), USER_ID),
    ).rejects.toBeInstanceOf(ResourceConflictException);
  });

  it('responde 404 quando o empréstimo não existe neste estoque', async () => {
    // v1 | Técnica: partição (empréstimo inexistente) | Requisito: CA4
    prisma.emprestimo.findFirst.mockResolvedValue(null);

    await expect(
      service.anexarTermoAssinado(ESTOQUE_ID, 'emp-x', arquivoPdf(), USER_ID),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });

  it('responde 404 quando o empréstimo não tem termo gerado', async () => {
    // v1 | Técnica: partição (termo ausente) | Requisito: CA4
    prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase({ termo: null }));

    await expect(
      service.anexarTermoAssinado(ESTOQUE_ID, 'emp-1', arquivoPdf(), USER_ID),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });

  it('nega acesso a quem não é gestor do estoque', async () => {
    // v1 | Técnica: partição (permissão inválida) | Requisito: CA4
    prisma.estoqueGestor.findUnique.mockResolvedValue(null);

    await expect(
      service.anexarTermoAssinado(ESTOQUE_ID, 'emp-1', arquivoPdf(), USER_ID),
    ).rejects.toBeInstanceOf(AccessDeniedException);
  });

  it('desfaz a gravação do novo arquivo quando a atualização do termo falha', async () => {
    // v1 | Técnica: partição (falha de persistência) | Requisito: CA4
    const falha = new Error('banco caiu');
    prisma.termo.update.mockRejectedValue(falha);

    await expect(
      service.anexarTermoAssinado(ESTOQUE_ID, 'emp-1', arquivoPdf(), USER_ID),
    ).rejects.toBe(falha);
    expect(termoStorage.remove).toHaveBeenCalledWith(termoStorage.write.mock.calls[0][0]);
  });
});

// ---------------------------------------------------------------------------
// EmprestimosService.confirmarEntrega
// ---------------------------------------------------------------------------
describe('EmprestimosService.confirmarEntrega', () => {
  const comTermoAssinado = (over: Record<string, unknown> = {}) =>
    emprestimoBase({
      termo: {
        id: 'termo-1',
        numeroAno: '01/2026',
        arquivoPdf: 'a.pdf',
        arquivoAssinado: 'assinado.pdf',
      },
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
    // v1 | Técnica: critério de aceitação (caminho feliz) | Requisito: CA4 | CT-04-16
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
    // v1 | Técnica: partição (termo assinado ausente) | Requisito: CA4 | CT-04-17
    prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase());

    await expect(service.confirmarEntrega(ESTOQUE_ID, 'emp-1', USER_ID)).rejects.toBeInstanceOf(
      ResourceConflictException,
    );
    expect(prisma.emprestimo.updateMany).not.toHaveBeenCalled();
    expect(prisma.item.update).not.toHaveBeenCalled();
  });

  it('recusa a entrega quando não há termo algum', async () => {
    // v1 | Técnica: partição (termo nulo) | Requisito: CA4
    prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase({ termo: null }));

    await expect(service.confirmarEntrega(ESTOQUE_ID, 'emp-1', USER_ID)).rejects.toBeInstanceOf(
      ResourceConflictException,
    );
  });

  it.each([
    StatusEmprestimo.ATIVO,
    StatusEmprestimo.DEVOLVIDO,
  ])('recusa confirmar entrega de empréstimo %s', async (status) => {
    // v1 | Técnica: partição (status inválido) | Requisito: CA4
    prisma.emprestimo.findFirst.mockResolvedValue(comTermoAssinado({ status }));

    await expect(service.confirmarEntrega(ESTOQUE_ID, 'emp-1', USER_ID)).rejects.toBeInstanceOf(
      ResourceConflictException,
    );
    expect(prisma.item.update).not.toHaveBeenCalled();
  });

  it('responde 404 para empréstimo inexistente neste estoque', async () => {
    // v1 | Técnica: partição (empréstimo inexistente) | Requisito: CA4
    prisma.emprestimo.findFirst.mockResolvedValue(null);

    await expect(service.confirmarEntrega(ESTOQUE_ID, 'emp-x', USER_ID)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it('trata confirmação concorrente (0 linhas atualizadas) como conflito', async () => {
    // v1 | Técnica: valor-limite (count = 0) | Requisito: CA4
    prisma.emprestimo.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.confirmarEntrega(ESTOQUE_ID, 'emp-1', USER_ID)).rejects.toBeInstanceOf(
      ResourceConflictException,
    );
    expect(prisma.item.update).not.toHaveBeenCalled();
  });

  it('nega acesso a quem não é gestor do estoque', async () => {
    // v1 | Técnica: partição (permissão inválida) | Requisito: CA4
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
    // v1 | Técnica: critério de aceitação (caminho feliz) | Requisito: CA7 | CT-04-23
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
    // v1 | Técnica: critério (efeito colateral da devolução) | Requisito: CA7
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
    // v1 | Técnica: partição (ativo em atraso) | Requisito: CA7, CA8
    prisma.emprestimo.findFirst.mockResolvedValue(
      ativo({ prazoDevolucao: new Date(AGORA.getTime() - UM_DIA) }),
    );

    await expect(service.devolver(ESTOQUE_ID, 'emp-1', USER_ID)).resolves.toBeDefined();
    expect(prisma.item.update).toHaveBeenCalledTimes(1);
  });

  it.each([
    StatusEmprestimo.AGUARDANDO_TERMO,
    StatusEmprestimo.DEVOLVIDO,
  ])('recusa devolver empréstimo %s', async (status) => {
    // v1 | Técnica: partição (status inválido) | Requisito: CA7 | CT-04-24, CT-04-25
    prisma.emprestimo.findFirst.mockResolvedValue(ativo({ status }));

    await expect(service.devolver(ESTOQUE_ID, 'emp-1', USER_ID)).rejects.toBeInstanceOf(
      ResourceConflictException,
    );
    expect(prisma.item.update).not.toHaveBeenCalled();
    expect(prisma.movimentacao.create).not.toHaveBeenCalled();
  });

  it('responde 404 para empréstimo inexistente neste estoque', async () => {
    // v1 | Técnica: partição (empréstimo inexistente) | Requisito: CA7
    prisma.emprestimo.findFirst.mockResolvedValue(null);

    await expect(service.devolver(ESTOQUE_ID, 'emp-x', USER_ID)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    expect(prisma.emprestimo.findFirst).toHaveBeenCalledWith({
      where: { id: 'emp-x', item: { estoqueId: ESTOQUE_ID } },
    });
  });

  it('trata devolução concorrente (0 linhas atualizadas) como conflito', async () => {
    // v1 | Técnica: valor-limite (count = 0) | Requisito: CA7
    prisma.emprestimo.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.devolver(ESTOQUE_ID, 'emp-1', USER_ID)).rejects.toBeInstanceOf(
      ResourceConflictException,
    );
    expect(prisma.item.update).not.toHaveBeenCalled();
  });

  it('nega acesso a quem não é gestor do estoque', async () => {
    // v1 | Técnica: partição (permissão inválida) | Requisito: CA7 | CT-04-44
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
    emprestimoBase({
      id: 'e1',
      status: StatusEmprestimo.ATIVO,
      prazoDevolucao: new Date(AGORA.getTime() - UM_DIA),
      termo: termoComFlag,
    }),
    emprestimoBase({
      id: 'e2',
      status: StatusEmprestimo.ATIVO,
      prazoDevolucao: new Date(AGORA.getTime() + UM_DIA),
      termo: termoComFlag,
    }),
    emprestimoBase({
      id: 'e3',
      status: StatusEmprestimo.ATIVO,
      prazoDevolucao: null,
      termo: termoComFlag,
    }),
    emprestimoBase({
      id: 'e4',
      status: StatusEmprestimo.AGUARDANDO_TERMO,
      prazoDevolucao: new Date(AGORA.getTime() - UM_DIA),
      termo: termoComFlag,
    }),
  ];

  beforeEach(() => {
    prisma.emprestimo.findMany.mockResolvedValue(lista());
    prisma.emprestimo.count.mockResolvedValue(4);
  });

  it('destaca como atrasado somente o empréstimo ativo com prazo vencido', async () => {
    // v1 | Técnica: critério de aceitação + partição (atrasado / no prazo / indefinido / aguardando) | Requisito: CA8
    const r: any = await service.findPendentes(ESTOQUE_ID, query, gestor);

    expect(r.items.map((i: any) => [i.id, i.atrasado])).toEqual([
      ['e1', true],
      ['e2', false],
      ['e3', false],
      ['e4', false],
    ]);
    expect(r.total).toBe(4);
  });

  it('[v2] destaca o atraso de empréstimo vencido há 5 dias e não destaca o que vence daqui a 5 dias', async () => {
    // [v2] Lacuna CT-04-26 e CT-04-27 (PAT-01, PAT-02): valores da matriz na listagem | Requisito: CA-08
    prisma.emprestimo.findMany.mockResolvedValue([
      emprestimoBase({
        id: 'v5',
        status: StatusEmprestimo.ATIVO,
        prazoDevolucao: new Date(AGORA.getTime() - 5 * UM_DIA),
        termo: termoComFlag,
      }),
      emprestimoBase({
        id: 'f5',
        status: StatusEmprestimo.ATIVO,
        prazoDevolucao: new Date(AGORA.getTime() + 5 * UM_DIA),
        termo: termoComFlag,
      }),
    ]);

    const r: any = await service.findPendentes(ESTOQUE_ID, query, gestor);

    expect(r.items.map((i: any) => [i.id, i.atrasado])).toEqual([
      ['v5', true],
      ['f5', false],
    ]);
  });

  it('[v2] não destaca atraso de empréstimo devolvido, mesmo com prazo que já passou', async () => {
    // [v2] Lacuna CT-04-32 (PAT-05): confere o campo "atrasado" na listagem, e não só a função isolada | Requisito: CA-08
    prisma.emprestimo.findMany.mockResolvedValue([
      emprestimoBase({
        id: 'dev',
        status: StatusEmprestimo.DEVOLVIDO,
        prazoDevolucao: new Date(AGORA.getTime() - 5 * UM_DIA),
        termo: termoComFlag,
      }),
    ]);

    const r: any = await service.findPendentes(ESTOQUE_ID, query, gestor);

    expect(r.items[0]).toEqual(expect.objectContaining({ id: 'dev', atrasado: false }));
  });

  it('lista apenas pendentes (aguardando termo e ativos) do estoque, excluindo devolvidos', async () => {
    // v1 | Técnica: partição (status listados) | Requisito: CA8
    await service.findPendentes(ESTOQUE_ID, query, gestor);

    const where = {
      status: { in: [StatusEmprestimo.AGUARDANDO_TERMO, StatusEmprestimo.ATIVO] },
      item: { estoqueId: ESTOQUE_ID },
    };
    expect(prisma.emprestimo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(prisma.emprestimo.count).toHaveBeenCalledWith({ where });
  });

  it('ordena por prazo crescente com prazos indefinidos por último', async () => {
    // v1 | Técnica: critério (ordenação) | Requisito: CA8
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
    // v1 | Técnica: valor-limite (primeira página e páginas seguintes) | Requisito: CA8
    await service.findPendentes(ESTOQUE_ID, { page, limit } as any, gestor);

    expect(prisma.emprestimo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip, take: limit }),
    );
  });

  it('retorna lista vazia quando não há empréstimos pendentes', async () => {
    // v1 | Técnica: valor-limite (0 resultados) | Requisito: CA8
    prisma.emprestimo.findMany.mockResolvedValue([]);
    prisma.emprestimo.count.mockResolvedValue(0);

    const r: any = await service.findPendentes(ESTOQUE_ID, query, gestor);

    expect(r.items).toEqual([]);
    expect(r.total).toBe(0);
  });

  it('permite ADMIN consultar sem ser gestor do estoque', async () => {
    // v1 | Técnica: partição (papel ADMIN) | Requisito: CA8
    prisma.estoqueGestor.findUnique.mockResolvedValue(null);

    await expect(service.findPendentes(ESTOQUE_ID, query, admin)).resolves.toBeDefined();
    expect(prisma.estoqueGestor.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['usuário sem vínculo e sem papel ADMIN', gestor],
    ['usuário não identificado', undefined],
  ])('nega acesso a %s', async (_desc, user) => {
    // v1 | Técnica: partição (permissão inválida) | Requisito: CA8
    prisma.estoqueGestor.findUnique.mockResolvedValue(null);

    await expect(service.findPendentes(ESTOQUE_ID, query, user)).rejects.toBeInstanceOf(
      AccessDeniedException,
    );
  });

  it('responde 404 quando o estoque não existe', async () => {
    // v1 | Técnica: partição (estoque inexistente) | Requisito: CA8
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
    // v1 | Técnica: partição (termo existente) | Requisito: CA1
    prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase());
    termoStorage.read.mockResolvedValue(Buffer.from('%PDF'));

    const r = await service.obterPdf(ESTOQUE_ID, 'emp-1', gestor);

    expect(termoStorage.read).toHaveBeenCalledWith('2026/a.pdf');
    expect(r.nomeArquivo).toBe('termo-01-2026.pdf');
  });

  it('devolve o PDF assinado com sufixo "-assinado"', async () => {
    // v1 | Técnica: partição (termo assinado existente) | Requisito: CA4
    prisma.emprestimo.findFirst.mockResolvedValue(
      emprestimoBase({
        termo: { id: 't', numeroAno: '07/2026', arquivoPdf: 'a.pdf', arquivoAssinado: 's.pdf' },
      }),
    );
    termoStorage.read.mockResolvedValue(Buffer.from('%PDF'));

    const r = await service.obterPdfAssinado(ESTOQUE_ID, 'emp-1', admin);

    expect(termoStorage.read).toHaveBeenCalledWith('s.pdf');
    expect(r.nomeArquivo).toBe('termo-07-2026-assinado.pdf');
  });

  it('responde 404 quando não há termo assinado anexado', async () => {
    // v1 | Técnica: partição (termo assinado ausente) | Requisito: CA4
    prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase());

    await expect(service.obterPdfAssinado(ESTOQUE_ID, 'emp-1', admin)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it('responde 404 quando o empréstimo não tem termo', async () => {
    // v1 | Técnica: partição (termo ausente) | Requisito: CA1
    prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase({ termo: null }));

    await expect(service.obterPdf(ESTOQUE_ID, 'emp-1', admin)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it('nega acesso ao PDF para quem não é gestor nem ADMIN', async () => {
    // v1 | Técnica: partição (permissão inválida) | Requisito: CA1
    prisma.estoqueGestor.findUnique.mockResolvedValue(null);

    await expect(service.obterPdf(ESTOQUE_ID, 'emp-1', gestor)).rejects.toBeInstanceOf(
      AccessDeniedException,
    );
  });

  // [v2] Branches descobertos na v1 (service, linhas 196, 265 e 273) | Técnica: cobertura de decisão
  it('[v2] obterPdf responde 404 quando o empréstimo não existe neste estoque', async () => {
    // [v2] Branch linha 196 (empréstimo inexistente em obterPdf)
    prisma.emprestimo.findFirst.mockResolvedValue(null);

    await expect(service.obterPdf(ESTOQUE_ID, 'emp-x', admin)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it('[v2] obterPdfAssinado responde 404 quando o empréstimo não existe neste estoque', async () => {
    // [v2] Branch linha 273 (empréstimo inexistente em obterPdfAssinado)
    prisma.emprestimo.findFirst.mockResolvedValue(null);

    await expect(service.obterPdfAssinado(ESTOQUE_ID, 'emp-x', admin)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it('[v2] obterPdfAssinado responde 404 quando o empréstimo não tem termo', async () => {
    // [v2] Branch do "?." em emprestimo.termo?.arquivoAssinado (termo nulo)
    prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase({ termo: null }));

    await expect(service.obterPdfAssinado(ESTOQUE_ID, 'emp-1', admin)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it('[v2] obterPdfAssinado permite o gestor do estoque (não ADMIN)', async () => {
    // [v2] Branch linha 265 (usuário não ADMIN passa pela checagem de gestor) — o v1 só chamava com ADMIN
    prisma.emprestimo.findFirst.mockResolvedValue(
      emprestimoBase({
        termo: { id: 't', numeroAno: '07/2026', arquivoPdf: 'a.pdf', arquivoAssinado: 's.pdf' },
      }),
    );
    termoStorage.read.mockResolvedValue(Buffer.from('%PDF'));

    const r = await service.obterPdfAssinado(ESTOQUE_ID, 'emp-1', gestor);

    expect(prisma.estoqueGestor.findUnique).toHaveBeenCalledWith({
      where: { estoqueId_usuarioId: { estoqueId: ESTOQUE_ID, usuarioId: USER_ID } },
    });
    expect(r.nomeArquivo).toBe('termo-07-2026-assinado.pdf');
  });

  it('[v2] obterPdfAssinado nega acesso a quem não é gestor nem ADMIN', async () => {
    // [v2] Branch linha 265 (checagem de gestor com 403)
    prisma.estoqueGestor.findUnique.mockResolvedValue(null);

    await expect(service.obterPdfAssinado(ESTOQUE_ID, 'emp-1', gestor)).rejects.toBeInstanceOf(
      AccessDeniedException,
    );
    expect(prisma.emprestimo.findFirst).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// [v2] Perfis de acesso (CA-11): controller + service reais, Prisma simulado
// ---------------------------------------------------------------------------
describe('[v2] Acesso por perfil no registro e na devolução (CA-11)', () => {
  let controller: any;

  // Só USER_ID é gestor do estoque; qualquer outro usuário não tem vínculo.
  const perfis = [
    ['ADMIN', { userId: 'admin-1', role: AccessRole.ADMIN }],
    ['requisitante (perfil USER sem vínculo)', { userId: 'user-9', role: AccessRole.USER }],
    ['gestor de outro estoque', { userId: 'gestor-outro-estoque', role: AccessRole.USER }],
  ] as const;

  beforeEach(async () => {
    const { EmprestimosController } = await import(
      '../../src/modules/emprestimos/emprestimos.controller'
    );
    controller = new EmprestimosController(service as any);
    configurarCaminhoFelizDeCreate(prisma, termoPdf, termoStorage);
    prisma.estoqueGestor.findUnique.mockImplementation(async ({ where }: any) =>
      where.estoqueId_usuarioId.usuarioId === USER_ID
        ? { estoqueId: ESTOQUE_ID, usuarioId: USER_ID }
        : null,
    );
  });

  it.each(
    perfis,
  )('[v2] registro de empréstimo: %s recebe 403 e nada é criado', async (_perfil, usuario) => {
    // [v2] Lacuna CT-04-40, CT-04-41, CT-04-42 (PPF-02, PPF-03, PPF-04) | Técnica: partição (perfil inválido) | Requisito: CA-11
    const erro = await erroDe(controller.create(ESTOQUE_ID, criarDto(), usuario));

    expect(erro).toBeInstanceOf(AccessDeniedException);
    expect(erro.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(prisma.emprestimo.create).not.toHaveBeenCalled();
    expect(prisma.movimentacao.create).not.toHaveBeenCalled();
  });

  it.each(
    perfis,
  )('[v2] devolução: %s recebe 403 e o empréstimo continua ativo', async (_perfil, usuario) => {
    // [v2] Lacuna CT-04-43, CT-04-44, CT-04-45 (PPF-02, PPF-03, PPF-04 com PED-01) | Requisito: CA-11
    prisma.emprestimo.findFirst.mockResolvedValue(
      emprestimoBase({ status: StatusEmprestimo.ATIVO }),
    );

    const erro = await erroDe(controller.devolver(ESTOQUE_ID, 'emp-1', usuario));

    expect(erro).toBeInstanceOf(AccessDeniedException);
    expect(erro.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(prisma.emprestimo.updateMany).not.toHaveBeenCalled();
    expect(prisma.item.update).not.toHaveBeenCalled();
  });

  it.each(
    perfis,
  )('[v2] justificativa de permanência: %s recebe 403 e nada é gravado', async (_perfil, usuario) => {
    // [v2] Lacuna CT-04-36 + CA-11 (PPF-02, PPF-03, PPF-04 na ação nova) | Técnica: partição (perfil inválido) | Requisito: CA-11
    prisma.emprestimo.findFirst.mockResolvedValue(
      emprestimoBase({
        status: StatusEmprestimo.ATIVO,
        prazoDevolucao: new Date(AGORA.getTime() - UM_DIA),
        justificativaPermanencia: null,
      }),
    );

    const erro = await erroDe(
      controller.registrarJustificativaPermanencia(
        ESTOQUE_ID,
        'emp-1',
        { justificativa: 'Em uso' },
        usuario,
      ),
    );

    expect(erro).toBeInstanceOf(AccessDeniedException);
    expect(erro.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(prisma.emprestimo.updateMany).not.toHaveBeenCalled();
    expect(prisma.item.update).not.toHaveBeenCalled();
    expect(prisma.movimentacao.create).not.toHaveBeenCalled();
    expect(prisma.emprestimo.findFirst).not.toHaveBeenCalled();
  });

  it('[v2] o gestor do estoque registra o empréstimo pelo controller', async () => {
    // [v2] Contraprova de CT-04-40..45: o perfil PPF-01 passa pelo mesmo caminho | Requisito: CA-11
    const gestor = { userId: USER_ID, role: AccessRole.USER };

    await expect(controller.create(ESTOQUE_ID, criarDto(), gestor)).resolves.toBeDefined();
    expect(prisma.emprestimo.create).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// [v2] Justificativa de permanência (S3-20 (#100), matriz seção 8)
// ---------------------------------------------------------------------------
describe('[v2] RegistrarJustificativaPermanenciaSchema', () => {
  const caminhos = (r: any) => r.error.issues.map((i: any) => i.path.join('.'));

  it.each([
    ['ausente', undefined],
    ['vazia', ''],
    ['somente espaços', '   '],
    ['numérica', 123],
  ])('[v2] rejeita justificativa %s', (_desc, justificativa) => {
    // [v2] Lacuna CT-04-36 (PR-06) | Técnica: partição (classes inválidas) + valor-limite (0 caracteres) | Requisito: CA-09
    const r: any = RegistrarJustificativaPermanenciaSchema.safeParse({ justificativa });
    expect(r.success).toBe(false);
    expect(caminhos(r)).toContain('justificativa');
  });

  it.each([
    ['1 caractere (limite mínimo)', 'a'.repeat(1), true],
    ['1000 caracteres (limite máximo)', 'a'.repeat(1000), true],
    ['1001 caracteres (acima do limite)', 'a'.repeat(1001), false],
  ])('[v2] justificativa com %s', (_desc, justificativa, valido) => {
    // [v2] Lacuna CT-04-36 (PR-06) | Técnica: valor-limite (1 a 1000 caracteres) | Requisito: CA-09
    expect(RegistrarJustificativaPermanenciaSchema.safeParse({ justificativa }).success).toBe(
      valido,
    );
  });

  it('[v2] remove espaços nas pontas da justificativa', () => {
    // [v2] Lacuna CT-04-36 | Técnica: partição (texto com espaços nas pontas) | Requisito: CA-09
    const r: any = RegistrarJustificativaPermanenciaSchema.safeParse({
      justificativa: '  em uso  ',
    });
    expect(r.success).toBe(true);
    expect(r.data.justificativa).toBe('em uso');
  });
});

describe('[v2] EmprestimosService.registrarJustificativaPermanencia', () => {
  const dto = { justificativa: 'Item em uso no projeto de pesquisa' } as any;
  const ativoVencido = (over: Record<string, unknown> = {}) =>
    emprestimoBase({
      status: StatusEmprestimo.ATIVO,
      prazoDevolucao: new Date(AGORA.getTime() - UM_DIA),
      justificativaPermanencia: null,
      ...over,
    });

  beforeEach(() => {
    prisma.emprestimo.findFirst.mockResolvedValue(ativoVencido());
    prisma.emprestimo.updateMany.mockResolvedValue({ count: 1 });
    prisma.emprestimo.findUniqueOrThrow.mockResolvedValue(
      ativoVencido({ justificativaPermanencia: dto.justificativa }),
    );
  });

  it('[v2] grava a justificativa e mantém o empréstimo ativo e o item emprestado', async () => {
    // [v2] Lacuna CT-04-36 (PR-06) | Técnica: critério de aceitação (caminho feliz) | Requisito: CA-09
    const r: any = await service.registrarJustificativaPermanencia(
      ESTOQUE_ID,
      'emp-1',
      dto,
      USER_ID,
    );

    expect(prisma.emprestimo.updateMany).toHaveBeenCalledWith({
      where: { id: 'emp-1', justificativaPermanencia: null },
      data: { justificativaPermanencia: dto.justificativa },
    });
    expect(prisma.emprestimo.updateMany.mock.calls[0][0].data).not.toHaveProperty('status');
    expect(prisma.item.update).not.toHaveBeenCalled();
    expect(r.id).toBe('emp-1');
  });

  it('[v2] aceita quando o prazo venceu 1 ms antes de agora', async () => {
    // [v2] Lacuna LM-02 (limite do atraso na justificativa) | Técnica: valor-limite (prazo = agora - 1 ms) | Requisito: CA-09
    prisma.emprestimo.findFirst.mockResolvedValue(
      ativoVencido({ prazoDevolucao: new Date(AGORA.getTime() - 1) }),
    );

    await expect(
      service.registrarJustificativaPermanencia(ESTOQUE_ID, 'emp-1', dto, USER_ID),
    ).resolves.toBeDefined();
  });

  it.each([
    [
      'ativo com prazo exatamente agora (limite: sem atraso)',
      { prazoDevolucao: new Date(AGORA.getTime()) },
    ],
    ['ativo ainda dentro do prazo', { prazoDevolucao: new Date(AGORA.getTime() + UM_DIA) }],
    ['ativo com prazo indefinido', { prazoDevolucao: null }],
    ['aguardando termo com prazo vencido', { status: StatusEmprestimo.AGUARDANDO_TERMO }],
    ['devolvido com prazo vencido', { status: StatusEmprestimo.DEVOLVIDO }],
  ])('[v2] recusa (409) justificativa para empréstimo %s', async (_desc, over) => {
    // [v2] Lacuna CT-04-36 (partições inválidas da justificativa) | Requisito: CA-09
    prisma.emprestimo.findFirst.mockResolvedValue(ativoVencido(over));

    await expect(
      service.registrarJustificativaPermanencia(ESTOQUE_ID, 'emp-1', dto, USER_ID),
    ).rejects.toBeInstanceOf(ResourceConflictException);
    expect(prisma.emprestimo.updateMany).not.toHaveBeenCalled();
  });

  it('[v2] recusa (409) uma segunda justificativa para o mesmo empréstimo', async () => {
    // [v2] Lacuna CT-04-36 (uma justificativa por empréstimo) | Técnica: partição | Requisito: CA-09
    prisma.emprestimo.findFirst.mockResolvedValue(
      ativoVencido({ justificativaPermanencia: 'já registrada' }),
    );

    await expect(
      service.registrarJustificativaPermanencia(ESTOQUE_ID, 'emp-1', dto, USER_ID),
    ).rejects.toBeInstanceOf(ResourceConflictException);
    expect(prisma.emprestimo.updateMany).not.toHaveBeenCalled();
  });

  it('[v2] trata registro concorrente (0 linhas atualizadas) como conflito', async () => {
    // [v2] Lacuna CT-04-36 | Técnica: valor-limite (count = 0) | Requisito: CA-09
    prisma.emprestimo.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.registrarJustificativaPermanencia(ESTOQUE_ID, 'emp-1', dto, USER_ID),
    ).rejects.toBeInstanceOf(ResourceConflictException);
  });

  it('[v2] responde 404 para empréstimo inexistente neste estoque', async () => {
    // [v2] Lacuna CT-04-36 | Técnica: partição (empréstimo inexistente) | Requisito: CA-09
    prisma.emprestimo.findFirst.mockResolvedValue(null);

    await expect(
      service.registrarJustificativaPermanencia(ESTOQUE_ID, 'emp-x', dto, USER_ID),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
    expect(prisma.emprestimo.findFirst).toHaveBeenCalledWith({
      where: { id: 'emp-x', item: { estoqueId: ESTOQUE_ID } },
    });
  });

  it('[v2] responde 404 quando o estoque não existe', async () => {
    // [v2] Lacuna CT-04-36 | Técnica: partição (estoque inexistente) | Requisito: CA-09
    prisma.estoque.findUnique.mockResolvedValue(null);

    await expect(
      service.registrarJustificativaPermanencia(ESTOQUE_ID, 'emp-1', dto, USER_ID),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });

  it.each([
    ['usuário sem vínculo de gestor', USER_ID, null],
    ['usuário não identificado', undefined, { estoqueId: ESTOQUE_ID, usuarioId: USER_ID }],
  ])('[v2] nega acesso (403) a %s', async (_desc, userId, vinculo) => {
    // [v2] Lacuna CT-04-36 + CA-11 | Técnica: partição (permissão inválida) | Requisito: CA-11
    prisma.estoqueGestor.findUnique.mockResolvedValue(vinculo);

    await expect(
      service.registrarJustificativaPermanencia(ESTOQUE_ID, 'emp-1', dto, userId),
    ).rejects.toBeInstanceOf(AccessDeniedException);
    expect(prisma.emprestimo.updateMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// [v2] Fluxo completo (CT-04-46): registra -> anexa termo -> confirma entrega -> devolve
// ---------------------------------------------------------------------------
describe('[v2] Fluxo completo do empréstimo', () => {
  it('percorre aguardando termo, ativo e devolvido, com o item disponível, emprestado e disponível', async () => {
    // [v2] Lacuna CT-04-46 | Técnica: critério de aceitação (fluxo ponta a ponta com estado simulado) | Requisito: CA-01, CA-03, CA-04, CA-07
    configurarCaminhoFelizDeCreate(prisma, termoPdf, termoStorage);
    let emp: any;
    let statusDoItem: StatusItem = StatusItem.DISPONIVEL;
    const prazo = new Date('2026-12-20T00:00:00.000Z');

    prisma.item.findFirst.mockImplementation(async () => ({ ...ITEM, status: statusDoItem }));
    prisma.emprestimo.findFirst.mockImplementation(async ({ where }: any) =>
      where?.itemId ? null : emp,
    );
    prisma.emprestimo.create.mockImplementation(async ({ data }: any) => {
      // O banco aplica o default AGUARDANDO_TERMO, que o service não envia
      emp = {
        id: 'emp-1',
        ...data,
        status: StatusEmprestimo.AGUARDANDO_TERMO,
        dataDevolucaoEfetiva: null,
        item: ITEM,
        responsavel: RESPONSAVEL,
        termo: null,
      };
      return emp;
    });
    prisma.termo.create.mockImplementation(async ({ data }: any) => ({ id: 'termo-1', ...data }));
    prisma.emprestimo.update.mockImplementation(async ({ data }: any) => {
      emp = {
        ...emp,
        ...data,
        termo: { id: 'termo-1', numeroAno: '01/2026', arquivoPdf: 'x.pdf', arquivoAssinado: null },
      };
      return emp;
    });
    prisma.termo.update.mockImplementation(async ({ data }: any) => {
      emp = { ...emp, termo: { ...emp.termo, arquivoAssinado: data.arquivoAssinado } };
      return {};
    });
    prisma.emprestimo.updateMany.mockImplementation(async ({ where, data }: any) => {
      if (emp.status !== where.status) return { count: 0 };
      emp = { ...emp, ...data };
      return { count: 1 };
    });
    prisma.item.update.mockImplementation(async ({ data }: any) => {
      statusDoItem = data.status;
      return {};
    });
    prisma.emprestimo.findUniqueOrThrow.mockImplementation(async () => emp);

    // 1. registra o empréstimo com prazo
    await service.create(ESTOQUE_ID, criarDto({ prazoDevolucao: prazo }), USER_ID);
    expect(emp.status).toBe(StatusEmprestimo.AGUARDANDO_TERMO);
    expect(emp.prazoDevolucao).toEqual(prazo);
    expect(statusDoItem).toBe(StatusItem.DISPONIVEL);

    // 2. anexa o termo assinado, sem ativar
    await service.anexarTermoAssinado(ESTOQUE_ID, 'emp-1', arquivoPdf(), USER_ID);
    expect(emp.termo.arquivoAssinado).toEqual(expect.stringMatching(/^2026\/assinados\/.+\.pdf$/));
    expect(emp.status).toBe(StatusEmprestimo.AGUARDANDO_TERMO);
    expect(statusDoItem).toBe(StatusItem.DISPONIVEL);

    // 3. confirma a entrega física
    await service.confirmarEntrega(ESTOQUE_ID, 'emp-1', USER_ID);
    expect(emp.status).toBe(StatusEmprestimo.ATIVO);
    expect(statusDoItem).toBe(StatusItem.EMPRESTADO);

    // 4. registra a devolução
    await service.devolver(ESTOQUE_ID, 'emp-1', USER_ID);
    expect(emp.status).toBe(StatusEmprestimo.DEVOLVIDO);
    expect(statusDoItem).toBe(StatusItem.DISPONIVEL);

    expect(prisma.movimentacao.create.mock.calls.map((c: any[]) => c[0].data.tipo)).toEqual([
      TipoMovimentacao.SAIDA,
      TipoMovimentacao.DEVOLUCAO,
    ]);
  });
});

// ---------------------------------------------------------------------------
// [v2] Histórico do responsável (CA-10): coberto pelo grupo S3-21 abaixo
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// EmprestimosController (delegação ao service)
// ---------------------------------------------------------------------------
describe('EmprestimosController', () => {
  let controller: any;
  let svc: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    // Import dinâmico: falha de guards/decorators não derruba os testes do service
    const { EmprestimosController } = await import(
      '../../src/modules/emprestimos/emprestimos.controller'
    );
    svc = {
      create: vi.fn().mockResolvedValue({ id: 'emp-1' }),
      findPendentes: vi.fn().mockResolvedValue({ items: [] }),
      devolver: vi.fn().mockResolvedValue({ id: 'emp-1' }),
      anexarTermoAssinado: vi.fn().mockResolvedValue({ id: 'emp-1' }),
      confirmarEntrega: vi.fn().mockResolvedValue({ id: 'emp-1' }),
      registrarJustificativaPermanencia: vi.fn().mockResolvedValue({ id: 'emp-1' }),
      obterPdf: vi
        .fn()
        .mockResolvedValue({ pdf: Buffer.from('%PDF'), nomeArquivo: 'termo-01-2026.pdf' }),
      obterPdfAssinado: vi
        .fn()
        .mockResolvedValue({ pdf: Buffer.from('%PDF'), nomeArquivo: 'termo-01-2026-assinado.pdf' }),
    };
    controller = new EmprestimosController(svc as any);
  });

  const user = { userId: USER_ID, role: ROLE_NAO_ADMIN } as any;

  it('create repassa estoque, dto e o id do usuário', async () => {
    // v1 | Técnica: critério (delegação) | Requisito: CA1
    const dto = criarDto();

    await controller.create(ESTOQUE_ID, dto, user);

    expect(svc.create).toHaveBeenCalledWith(ESTOQUE_ID, dto, USER_ID);
  });

  it('create repassa userId indefinido quando não há usuário autenticado', async () => {
    // v1 | Técnica: partição (usuário ausente) | Requisito: CA1
    await controller.create(ESTOQUE_ID, criarDto(), undefined);

    expect(svc.create).toHaveBeenCalledWith(ESTOQUE_ID, expect.anything(), undefined);
  });

  it('findPendentes repassa a consulta e o usuário completo', async () => {
    // v1 | Técnica: critério (delegação) | Requisito: CA8
    const query = { page: 1, limit: 10 } as any;

    await controller.findPendentes(ESTOQUE_ID, query, user);

    expect(svc.findPendentes).toHaveBeenCalledWith(ESTOQUE_ID, query, user);
  });

  it('devolver repassa estoque, id do empréstimo e id do usuário', async () => {
    // v1 | Técnica: critério (delegação) | Requisito: CA7
    await controller.devolver(ESTOQUE_ID, 'emp-1', user);

    expect(svc.devolver).toHaveBeenCalledWith(ESTOQUE_ID, 'emp-1', USER_ID);
  });

  it('confirmarEntrega repassa estoque, id do empréstimo e id do usuário', async () => {
    // v1 | Técnica: critério (delegação) | Requisito: CA4
    await controller.confirmarEntrega(ESTOQUE_ID, 'emp-1', user);

    expect(svc.confirmarEntrega).toHaveBeenCalledWith(ESTOQUE_ID, 'emp-1', USER_ID);
  });

  it('[v2] registrarJustificativaPermanencia repassa estoque, id, corpo e id do usuário', async () => {
    // [v2] Lacuna CT-04-36 | Técnica: critério (delegação) | Requisito: CA-09
    const dto = { justificativa: 'Item em uso no projeto' } as any;

    await controller.registrarJustificativaPermanencia(ESTOQUE_ID, 'emp-1', dto, user);

    expect(svc.registrarJustificativaPermanencia).toHaveBeenCalledWith(
      ESTOQUE_ID,
      'emp-1',
      dto,
      USER_ID,
    );
  });

  it('anexarTermoAssinado repassa o arquivo enviado', async () => {
    // v1 | Técnica: critério (delegação) | Requisito: CA4
    const arquivo = arquivoPdf();

    await controller.anexarTermoAssinado(ESTOQUE_ID, 'emp-1', arquivo, user);

    expect(svc.anexarTermoAssinado).toHaveBeenCalledWith(ESTOQUE_ID, 'emp-1', arquivo, USER_ID);
  });

  it('visualizarTermo responde PDF inline', async () => {
    // v1 | Técnica: partição (disposição inline) | Requisito: CA1
    const file = await controller.visualizarTermo(ESTOQUE_ID, 'emp-1', user);

    const headers = file.getHeaders();
    expect(headers.type).toBe('application/pdf');
    expect(headers.disposition).toBe('inline; filename="termo-01-2026.pdf"');
  });

  it('baixarTermo responde PDF como anexo', async () => {
    // v1 | Técnica: partição (disposição attachment) | Requisito: CA1
    const file = await controller.baixarTermo(ESTOQUE_ID, 'emp-1', user);

    expect(file.getHeaders().disposition).toBe('attachment; filename="termo-01-2026.pdf"');
  });

  it('baixarTermoAssinado responde o PDF assinado como anexo', async () => {
    // v1 | Técnica: partição (termo assinado) | Requisito: CA4
    const file = await controller.baixarTermoAssinado(ESTOQUE_ID, 'emp-1', user);

    const headers = file.getHeaders();
    expect(headers.type).toBe('application/pdf');
    expect(headers.disposition).toBe('attachment; filename="termo-01-2026-assinado.pdf"');
    expect(svc.obterPdfAssinado).toHaveBeenCalledWith(ESTOQUE_ID, 'emp-1', user);
  });
});

// ---------------------------------------------------------------------------
// [v2] S3-21 (#101): seleção, cadastro global e histórico por estoque autorizado.
// ---------------------------------------------------------------------------
describe('[v2] S3-21 — seleção de responsável (CA-02)', () => {
  beforeEach(() => configurarCaminhoFelizDeCreate(prisma, termoPdf, termoStorage));

  it('[v2] CT-04-10: seleciona cadastro existente sem reenviar dados nem duplicar ou editar o cadastro', async () => {
    // [v2] Lacuna CT-04-10 (PRO-01) | Requisito: CA-02, S3-21
    prisma.responsavel.findUnique.mockResolvedValue(RESPONSAVEL);
    const dto = CreateEmprestimoSchema.parse({ itemId: ITEM.id, responsavelId: RESPONSAVEL.id });
    await service.create(ESTOQUE_ID, dto, USER_ID);
    expect(prisma.responsavel.findUnique).toHaveBeenCalledWith({ where: { id: RESPONSAVEL.id } });
    expect(prisma.responsavel.findMany).not.toHaveBeenCalled();
    expect(prisma.responsavel.create).not.toHaveBeenCalled();
    expect(prisma.responsavel.update).not.toHaveBeenCalled();
    expect(prisma.emprestimo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ responsavelId: RESPONSAVEL.id, itemId: ITEM.id }),
      }),
    );
    expect(termoPdf.gerar).toHaveBeenCalledWith(
      expect.objectContaining({
        responsavel: expect.objectContaining({ nome: RESPONSAVEL.nome, siape: RESPONSAVEL.siape }),
      }),
    );
  });

  it('[v2] CT-04-05: identificador inexistente retorna 404 sem criar empréstimo ou PDF', async () => {
    // [v2] Lacuna CT-04-05 (PRO-04, PR-01) | Requisito: CA-01, S3-21
    prisma.responsavel.findUnique.mockResolvedValue(null);
    const erro = await erroDe(
      service.create(ESTOQUE_ID, { itemId: ITEM.id, responsavelId: 'inexistente' }, USER_ID),
    );
    expect(erro).toBeInstanceOf(ResourceNotFoundException);
    expect(erro.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(prisma.emprestimo.create).not.toHaveBeenCalled();
    expect(prisma.movimentacao.create).not.toHaveBeenCalled();
    expect(termoStorage.write).not.toHaveBeenCalled();
  });

  it('[v2] CT-04-33: selecionar cadastro existente não contorna o bloqueio por atraso', async () => {
    // [v2] Lacuna CT-04-10 + CT-04-33 | Requisito: CA-02, CA-09, S3-20/S3-21
    prisma.responsavel.findUnique.mockResolvedValue(RESPONSAVEL);
    simularEmprestimosExistentes(prisma, [
      emprestimoBase({
        itemId: 'outro-item',
        status: StatusEmprestimo.ATIVO,
        prazoDevolucao: new Date(AGORA.getTime() - UM_DIA),
      }),
    ]);
    await expect(
      service.create(ESTOQUE_ID, { itemId: ITEM.id, responsavelId: RESPONSAVEL.id }, USER_ID),
    ).rejects.toBeInstanceOf(ResourceConflictException);
    expect(prisma.emprestimo.create).not.toHaveBeenCalled();
  });

  it.each([
    ['nenhum responsável', { itemId: ITEM.id }],
    ['identificador vazio', { itemId: ITEM.id, responsavelId: '   ' }],
    ['identificador nulo', { itemId: ITEM.id, responsavelId: null }],
    ['dados e identificador juntos', { ...criarDto(), responsavelId: RESPONSAVEL.id }],
  ])('[v2] CT-04-04/10: rejeita %s', (_desc, dto) => {
    // [v2] Lacuna CT-04-04/10 | Requisito: CA-01, CA-02, S3-21 (entrada sem ambiguidade)
    expect(CreateEmprestimoSchema.safeParse(dto).success).toBe(false);
  });
});

describe('[v2] S3-21 — consultas e permissões (CA-02 e CA-10)', () => {
  const query = { page: 1, limit: 20, skip: 0, take: 20 } as any;
  const gestor = { userId: USER_ID, role: AccessRole.USER };
  const admin = { userId: 'admin-1', role: AccessRole.ADMIN };
  let controller: any;

  beforeEach(async () => {
    const { EmprestimosController } = await import(
      '../../src/modules/emprestimos/emprestimos.controller'
    );
    controller = new EmprestimosController(service);
    prisma.estoqueGestor.findUnique.mockImplementation(async ({ where }: any) =>
      where.estoqueId_usuarioId.usuarioId === USER_ID
        ? { estoqueId: ESTOQUE_ID, usuarioId: USER_ID }
        : null,
    );
    prisma.responsavel.findMany.mockResolvedValue([RESPONSAVEL]);
    prisma.responsavel.count.mockResolvedValue(1);
    prisma.responsavel.findUnique.mockResolvedValue(RESPONSAVEL);
    prisma.emprestimo.findMany.mockResolvedValue([]);
    prisma.emprestimo.count.mockResolvedValue(0);
  });

  it('[v2] CT-04-09: cadastro feito no empréstimo fica disponível na lista com nome e identificação', async () => {
    // [v2] Lacuna CT-04-09 (PRO-01, PRO-02) | Requisito: CA-02, S3-21
    configurarCaminhoFelizDeCreate(prisma, termoPdf, termoStorage);
    const cadastros: any[] = [];
    prisma.responsavel.findMany.mockImplementation(async () => [...cadastros]);
    prisma.responsavel.create.mockImplementation(async ({ data }: any) => {
      const novo = { id: RESPONSAVEL.id, ...data };
      cadastros.push(novo);
      return novo;
    });
    prisma.responsavel.count.mockImplementation(async () => cadastros.length);
    await service.create(ESTOQUE_ID, criarDto(), USER_ID);
    const result = await controller.listarResponsaveis(ESTOQUE_ID, query, gestor);
    expect(result.items).toEqual([
      expect.objectContaining({
        id: RESPONSAVEL.id,
        nome: RESPONSAVEL.nome,
        siape: RESPONSAVEL.siape,
      }),
    ]);
    expect(result.total).toBe(1);
  });

  it.each([
    ['CT-04-47', 'gestor do estoque', gestor],
    ['CT-04-48', 'ADMIN', admin],
  ])('[v2] %s: %s consulta responsáveis com nome e Siape ou CPF', async (_ct, _perfil, user) => {
    // [v2] Lacuna CT-04-47/48 (PPF-01/02 na consulta) | Requisito: CA-02, RNF01
    const porCpf = { ...OUTRO_RESPONSAVEL, siape: null, cpf: '12345678901' };
    prisma.responsavel.findMany.mockResolvedValue([RESPONSAVEL, porCpf]);
    prisma.responsavel.count.mockResolvedValue(2);
    const result = await controller.listarResponsaveis(ESTOQUE_ID, query, user);
    expect(result.items).toEqual([
      expect.objectContaining({ nome: RESPONSAVEL.nome, siape: RESPONSAVEL.siape }),
      expect.objectContaining({ nome: porCpf.nome, cpf: porCpf.cpf }),
    ]);
    expect(result.total).toBe(2);
    expect(prisma.responsavel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ id: true, nome: true, siape: true, cpf: true }),
        skip: 0,
        take: 20,
      }),
    );
  });

  it.each([
    ['CT-04-51', 'gestor do estoque', gestor],
    ['CT-04-52', 'ADMIN', admin],
  ])('[v2] %s: %s consulta histórico com empréstimo ativo e devolvido', async (_ct, _perfil, user) => {
    // [v2] Lacuna CT-04-38/51/52 (PHR-01) | Requisito: CA-10, RNF01
    prisma.emprestimo.findMany.mockResolvedValue([
      emprestimoBase({
        status: StatusEmprestimo.ATIVO,
        prazoDevolucao: new Date(AGORA.getTime() - UM_DIA),
      }),
      emprestimoBase({
        id: 'devolvido',
        status: StatusEmprestimo.DEVOLVIDO,
        dataDevolucaoEfetiva: AGORA,
        termo: null,
      }),
    ]);
    prisma.emprestimo.count.mockResolvedValue(2);
    const result = await controller.historicoResponsavel(ESTOQUE_ID, RESPONSAVEL.id, query, user);
    expect(result.items).toEqual([
      expect.objectContaining({
        status: StatusEmprestimo.ATIVO,
        item: expect.objectContaining({ nome: ITEM.nome }),
        atrasado: true,
      }),
      expect.objectContaining({
        status: StatusEmprestimo.DEVOLVIDO,
        dataDevolucaoEfetiva: AGORA,
        atrasado: false,
        termo: null,
        termoAssinadoAnexado: false,
      }),
    ]);
    expect(result.total).toBe(2);
    const where = { responsavelId: RESPONSAVEL.id, item: { estoqueId: ESTOQUE_ID } };
    expect(prisma.emprestimo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(prisma.emprestimo.count).toHaveBeenCalledWith({ where });
    expect(where).not.toHaveProperty('status');
  });

  it.each([
    ['CT-04-49/53', { userId: 'requisitante', role: AccessRole.USER }],
    ['CT-04-50/54', { userId: 'gestor-outro', role: AccessRole.USER }],
    ['sem autenticação', undefined],
  ])('[v2] %s: consultas retornam 403 antes de ler cadastros ou histórico', async (_ct, user) => {
    // [v2] Lacuna CT-04-49/50/53/54 | Requisito: CA-02, CA-10, RNF01
    for (const promessa of [
      () => controller.listarResponsaveis(ESTOQUE_ID, query, user),
      () => controller.historicoResponsavel(ESTOQUE_ID, RESPONSAVEL.id, query, user),
    ]) {
      const erro = await erroDe(promessa());
      expect(erro).toBeInstanceOf(AccessDeniedException);
      expect(erro.getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
    expect(prisma.responsavel.findMany).not.toHaveBeenCalled();
    expect(prisma.responsavel.findUnique).not.toHaveBeenCalled();
    expect(prisma.responsavel.count).not.toHaveBeenCalled();
    expect(prisma.emprestimo.findMany).not.toHaveBeenCalled();
    expect(prisma.emprestimo.count).not.toHaveBeenCalled();
  });

  it('[v2] CT-04-39: responsável sem empréstimos tem histórico vazio', async () => {
    // [v2] Lacuna CT-04-39 (PHR-02, PR-10) | Requisito: CA-10
    const result = await controller.historicoResponsavel(ESTOQUE_ID, RESPONSAVEL.id, query, gestor);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('[v2] CT-04-09: lista vazia não é erro', async () => {
    // [v2] Lacuna CT-04-09 | Requisito: CA-02
    prisma.responsavel.findMany.mockResolvedValue([]);
    prisma.responsavel.count.mockResolvedValue(0);
    expect((await service.listarResponsaveis(ESTOQUE_ID, query, gestor)).items).toEqual([]);
  });

  it('[v2] CT-04-38: responsável inexistente retorna 404 após autorização', async () => {
    // [v2] Lacuna CT-04-38 | Requisito: CA-10, PR-01
    prisma.responsavel.findUnique.mockResolvedValue(null);
    const erro = await erroDe(service.historicoResponsavel(ESTOQUE_ID, 'ausente', query, admin));
    expect(erro.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(prisma.emprestimo.findMany).not.toHaveBeenCalled();
  });

  it('[v2] CT-04-38: filtra empréstimos de outro responsável e de outro estoque', async () => {
    // [v2] Lacuna CT-04-38/51 | Requisito: CA-10, RNF01 (isolamento de dados)
    const outros = [
      emprestimoBase({ id: 'permitido', item: { ...ITEM, estoqueId: ESTOQUE_ID } }),
      emprestimoBase({ id: 'outro-responsavel', responsavelId: OUTRO_RESPONSAVEL.id, item: ITEM }),
      emprestimoBase({ id: 'outro-estoque', item: { ...ITEM, estoqueId: 'est-2' } }),
    ];
    const filtro = ({ where }: any) =>
      outros.filter(
        (e) =>
          e.responsavelId === where.responsavelId &&
          (!where.item?.estoqueId || e.item.estoqueId === where.item.estoqueId),
      );
    prisma.emprestimo.findMany.mockImplementation(async (args: any) => filtro(args));
    prisma.emprestimo.count.mockImplementation(async (args: any) => filtro(args).length);
    const result = await service.historicoResponsavel(ESTOQUE_ID, RESPONSAVEL.id, query, gestor);
    expect(result.items.map((e: any) => e.id)).toEqual(['permitido']);
    expect(result.meta.total).toBe(1);
  });

  it('[v2] CT-04-09/38: aplica paginação nas duas consultas', async () => {
    // [v2] Lacuna CT-04-09/38 | Requisito: CA-02, CA-10 (todos os registros consultáveis)
    const pagina2 = { page: 2, limit: 5, skip: 5, take: 5 } as any;
    await service.listarResponsaveis(ESTOQUE_ID, pagina2, admin);
    await service.historicoResponsavel(ESTOQUE_ID, RESPONSAVEL.id, pagina2, admin);
    expect(prisma.responsavel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
    expect(prisma.emprestimo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
  });

  it('[v2] CT-04-09/38: estoque inexistente retorna 404 sem consultar dados', async () => {
    // [v2] Lacuna CT-04-09/38 | Requisito: CA-02, CA-10, PR-01
    prisma.estoque.findUnique.mockResolvedValue(null);
    for (const chamada of [
      () => service.listarResponsaveis('ausente', query, admin),
      () => service.historicoResponsavel('ausente', RESPONSAVEL.id, query, admin),
    ])
      expect((await erroDe(chamada())).getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(prisma.responsavel.findMany).not.toHaveBeenCalled();
    expect(prisma.responsavel.findUnique).not.toHaveBeenCalled();
  });
});
