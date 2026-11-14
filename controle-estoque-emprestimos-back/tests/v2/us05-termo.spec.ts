// tests/v2/us05-termo.spec.ts
// Suíte v2 da US05 (Termo de Responsabilidade): cobre as lacunas G-01 a G-10.
// G-11 (botões da tela) é do front-end e não tem teste aqui.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument, PDFPage } from 'pdf-lib';
import { Prisma, StatusEmprestimo, StatusItem } from '@prisma/client';
import { StreamableFile } from '@nestjs/common';

import { AccessRole } from '../../src/common/auth/access-role.enum';
import { AppException } from '../../src/common/exceptions/app.exception';
import { AccessDeniedException } from '../../src/common/exceptions/access-denied.exception';
import { ResourceNotFoundException } from '../../src/common/exceptions/resource-not-found.exception';
import { ResourceConflictException } from '../../src/common/exceptions/resource-conflict.exception';
import { ErrorCode } from '../../src/common/exceptions/error-code.enum';
import { EmprestimosService } from '../../src/modules/emprestimos/emprestimos.service';
import { EmprestimosController } from '../../src/modules/emprestimos/emprestimos.controller';
import { TermoPdfService, TermoPdfData } from '../../src/modules/emprestimos/termo-pdf.service';
import {
  PDF_MAGIC,
  TERMO_ASSINADO_MAX_BYTES,
} from '../../src/modules/emprestimos/termo-assinado.constants';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

// Exige que a promessa seja rejeitada (se resolver, o teste falha) e devolve o erro.
async function rejeitada(promise: Promise<unknown>): Promise<unknown> {
  const resultado = await promise.then(
    () => ({ rejeitada: false as const, erro: undefined as unknown }),
    (erro: unknown) => ({ rejeitada: true as const, erro }),
  );
  expect(resultado.rejeitada, 'a promessa deveria ter sido rejeitada').toBe(true);
  return resultado.erro;
}

// Confere classe, código HTTP exato e código de erro da AppException.
function esperaErro(erro: unknown, classe: new (...args: any[]) => AppException, status: number, codigo: ErrorCode) {
  expect(erro).toBeInstanceOf(classe);
  const ex = erro as AppException;
  expect(ex.getStatus()).toBe(status);
  expect(ex.getErrorCode()).toBe(codigo);
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const regexAssinado = (ano: number) => new RegExp(`^${ano}/assinados/${UUID}\\.pdf$`);
const regexGerado = (ano: number) => new RegExp(`^${ano}/${UUID}\\.pdf$`);

// Data fixa em todos os testes (apenas Date), meio-dia UTC para não depender do fuso.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-06-15T15:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

/* ------------------------------------------------------------------ */
/* EmprestimosService                                                  */
/* ------------------------------------------------------------------ */

describe('US05 v2 - EmprestimosService', () => {
  const ESTOQUE_ID = 'estoque-1';
  const EMP_ID = 'emp-1';
  const GESTOR_ID = 'user-gestor';

  let prisma: any;
  let termoPdf: { gerar: ReturnType<typeof vi.fn> };
  let termoStorage: {
    write: ReturnType<typeof vi.fn>;
    read: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let service: EmprestimosService;

  const gestor = { userId: GESTOR_ID, role: AccessRole.USER };
  const admin = { userId: 'admin-1', role: AccessRole.ADMIN };

  const termoBase = (over: Record<string, unknown> = {}) => ({
    id: 'termo-1',
    numeroAno: '03/2026',
    arquivoPdf: '2026/gerado.pdf',
    arquivoAssinado: null as string | null,
    ...over,
  });

  const emprestimoBase = (over: Record<string, unknown> = {}) => ({
    id: EMP_ID,
    itemId: 'item-1',
    status: StatusEmprestimo.AGUARDANDO_TERMO,
    termo: termoBase(),
    ...over,
  });

  const itemBase = () => ({
    id: 'item-1',
    estoqueId: ESTOQUE_ID,
    nome: 'Notebook Dell Latitude',
    tipo: 'PERMANENTE',
    status: StatusItem.DISPONIVEL,
    tombamento: 'TOMB-001',
    numeroSerie: 'SN-999',
    descricao: null,
  });

  const pdfValido = (over: Record<string, unknown> = {}) => {
    const buffer = Buffer.concat([PDF_MAGIC, Buffer.from('1.7 conteudo')]);
    return {
      originalname: 'termo.pdf',
      mimetype: 'application/pdf',
      size: buffer.length,
      buffer,
      ...over,
    } as any;
  };

  const comoNaoGestor = () => prisma.estoqueGestor.findUnique.mockResolvedValue(null);

  // O retorno final do upload reflete o caminho que foi realmente gravado no storage.
  const retornoRefleteGravacao = () =>
    prisma.emprestimo.findUniqueOrThrow.mockImplementation(async () => ({
      id: EMP_ID,
      status: StatusEmprestimo.AGUARDANDO_TERMO,
      termo: {
        id: 'termo-1',
        numeroAno: '03/2026',
        arquivoAssinado: termoStorage.write.mock.calls[0]?.[0] ?? null,
      },
    }));

  const dtoCreate = () =>
    ({
      itemId: 'item-1',
      responsavel: {
        nome: 'Maria da Silva',
        siape: '1234567',
        lotacao: 'Departamento de Computação',
        cargo: 'Professora',
      },
    }) as any;

  // Prepara o mock do create; o contador respeita os argumentos recebidos pelo upsert.
  const prepararCreate = (inicial: Record<number, number> = {}) => {
    const contadores = new Map<number, number>(
      Object.entries(inicial).map(([ano, n]) => [Number(ano), n]),
    );
    prisma.emprestimo.findFirst.mockResolvedValue(null);
    prisma.emprestimo.create.mockImplementation(async ({ data }: any) => ({
      id: 'emp-novo',
      itemId: data.itemId,
      dataRetirada: data.dataRetirada,
      prazoDevolucao: data.prazoDevolucao,
      termo: null,
    }));
    prisma.contadorTermo.upsert.mockImplementation(async ({ where, create, update }: any) => {
      const atual = contadores.get(where.ano);
      const novo =
        atual === undefined ? create.ultimoNumero : atual + update.ultimoNumero.increment;
      contadores.set(where.ano, novo);
      return { ano: where.ano, ultimoNumero: novo };
    });
    termoPdf.gerar.mockResolvedValue(new Uint8Array([37, 80, 68, 70, 45]));
    prisma.termo.create.mockImplementation(async ({ data }: any) => ({
      id: 'termo-novo',
      ...data,
      arquivoAssinado: null,
    }));
    prisma.emprestimo.update.mockResolvedValue({
      id: 'emp-novo',
      termo: { id: 'termo-novo', numeroAno: 'x', arquivoAssinado: null },
    });
    return contadores;
  };

  const criar = () => service.create(ESTOQUE_ID, dtoCreate(), GESTOR_ID);
  const numeroEnviadoAoPdf = () => termoPdf.gerar.mock.calls.at(-1)![0].numeroAno as string;
  const numeroGravadoNoTermo = () => prisma.termo.create.mock.calls.at(-1)![0].data.numeroAno as string;

  const erroUnicidade = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
    });

  beforeEach(() => {
    prisma = {
      estoque: { findUnique: vi.fn().mockResolvedValue({ id: ESTOQUE_ID, nome: 'Estoque Central' }) },
      estoqueGestor: { findUnique: vi.fn().mockResolvedValue({ id: 'vinculo' }) },
      item: { findFirst: vi.fn().mockResolvedValue(itemBase()), update: vi.fn().mockResolvedValue({}) },
      responsavel: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(async ({ data }: any) => ({ id: 'resp-1', ...data })),
        update: vi.fn(),
      },
      emprestimo: {
        findFirst: vi.fn().mockResolvedValue(emprestimoBase()),
        findUniqueOrThrow: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn(),
        create: vi.fn(),
      },
      movimentacao: { create: vi.fn().mockResolvedValue({}) },
      contadorTermo: { upsert: vi.fn() },
      termo: { update: vi.fn().mockResolvedValue({}), create: vi.fn() },
      $transaction: vi.fn(async (fn: any) => fn(prisma)),
    };
    termoPdf = { gerar: vi.fn() };
    termoStorage = {
      write: vi.fn().mockResolvedValue(undefined),
      read: vi.fn().mockResolvedValue(Buffer.from('%PDF-conteudo')),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    service = new EmprestimosService(prisma as any, termoPdf as any, termoStorage as any);
  });

  /* ---------------- G-01: numeração do termo (create) ---------------- */

  describe('G-01 - numeração sequencial do termo por ano', () => {
    // Técnica: partição válida (PNT-01) | Requisito: CA1 | Lacuna G-01 / CT-05-01
    it('primeiro termo do ano recebe o número "01/2026"', async () => {
      prepararCreate();
      await criar();
      expect(numeroEnviadoAoPdf()).toBe('01/2026');
      expect(numeroGravadoNoTermo()).toBe('01/2026');
      expect(prisma.contadorTermo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ano: 2026 } }),
      );
    });

    // Técnica: partição válida (PNT-02) | Requisito: CA1 | Lacuna G-01 / CT-05-02
    it('termo seguinte recebe o número anterior + 1, no mesmo ano', async () => {
      prepararCreate();
      await criar();
      expect(numeroEnviadoAoPdf()).toBe('01/2026');
      await criar();
      expect(numeroEnviadoAoPdf()).toBe('02/2026');
      await criar();
      expect(numeroEnviadoAoPdf()).toBe('03/2026');
      expect(numeroGravadoNoTermo()).toBe('03/2026');
    });

    // Técnica: partição válida a partir de contador existente | Requisito: CA1 | Lacuna G-01 / CT-05-02
    it('com o último número do ano em 41, o próximo termo é "42/2026"', async () => {
      prepararCreate({ 2026: 41 });
      await criar();
      expect(numeroEnviadoAoPdf()).toBe('42/2026');
    });

    // Técnica: valor-limite 31/12 (lado "ano ainda é o mesmo") | Requisito: CA1 | Lacuna G-01 / CT-05-03 (LM-03)
    it('em 31/12 a sequência do ano que termina continua ("07/2026")', async () => {
      prepararCreate({ 2026: 6 });
      vi.setSystemTime(new Date('2026-12-31T15:00:00Z'));
      await criar();
      expect(numeroEnviadoAoPdf()).toBe('07/2026');
      expect(numeroGravadoNoTermo()).toBe('07/2026');
    });

    // Técnica: valor-limite 01/01 (lado "ano novo") | Requisito: CA1 | Lacuna G-01 / CT-05-04 (PNT-03, LM-03)
    it('em 01/01 o primeiro termo do ano novo é "01/2027" (reinicia)', async () => {
      const contadores = prepararCreate({ 2026: 99 });
      vi.setSystemTime(new Date('2027-01-01T15:00:00Z'));
      await criar();
      expect(numeroEnviadoAoPdf()).toBe('01/2027');
      expect(numeroGravadoNoTermo()).toBe('01/2027');
      expect(contadores.get(2026)).toBe(99);
      expect(contadores.get(2027)).toBe(1);
    });

    // Técnica: valor-limite dos dois lados da virada | Requisito: CA1 | Lacuna G-01 / CT-05-03 e CT-05-04 (LM-03)
    it('31/12 continua a sequência e 01/01 reinicia, na mesma execução', async () => {
      prepararCreate({ 2026: 11 });
      vi.setSystemTime(new Date('2026-12-31T15:00:00Z'));
      await criar();
      expect(numeroEnviadoAoPdf()).toBe('12/2026');
      vi.setSystemTime(new Date('2027-01-01T15:00:00Z'));
      await criar();
      expect(numeroEnviadoAoPdf()).toBe('01/2027');
      await criar();
      expect(numeroEnviadoAoPdf()).toBe('02/2027');
    });

    // Técnica: valor-limite (início da sequência: 0 inválido × 1 válido) | Requisito: CA1 | Lacuna G-01 / CT-05-05 (LM-04)
    it('o número nunca é 0: a sequência começa em 1', async () => {
      prepararCreate();
      const numeros: string[] = [];
      for (let i = 0; i < 5; i++) {
        await criar();
        numeros.push(numeroEnviadoAoPdf());
      }
      expect(numeros).not.toContain('00/2026');
      for (const numero of numeros) {
        expect(Number(numero.split('/')[0])).toBeGreaterThanOrEqual(1);
      }
      expect(numeros[0]).toBe('01/2026');
    });

    // Técnica: valor-limite (formato com padStart de 2 dígitos) | Requisito: CA1 | Lacuna G-01 / CT-05-06
    it.each([
      [1, '01/2026'],
      [9, '09/2026'],
      [10, '10/2026'],
      [99, '99/2026'],
      [100, '100/2026'],
    ])('o número %i é formatado como "%s" (sem truncar)', async (n, esperado) => {
      prepararCreate(n === 1 ? {} : { 2026: n - 1 });
      await criar();
      expect(numeroEnviadoAoPdf()).toBe(esperado);
      expect(numeroGravadoNoTermo()).toBe(esperado);
    });

    // Técnica: partição inválida (PNT-04, número já usado) | Requisito: CA1 | Lacuna G-01 / CT-05-06
    it('P2002 ao obter o número: erro vira ResourceConflictException (409) e nada é gerado', async () => {
      prepararCreate();
      prisma.contadorTermo.upsert.mockRejectedValue(erroUnicidade());
      const e = await rejeitada(criar());
      esperaErro(e, ResourceConflictException, 409, ErrorCode.CONFLICT);
      expect(termoPdf.gerar).not.toHaveBeenCalled();
      expect(termoStorage.write).not.toHaveBeenCalled();
      expect(prisma.termo.create).not.toHaveBeenCalled();
    });

    // Técnica: partição inválida (PNT-04, número repetido recusado pelo banco ao gravar o termo) | Requisito: CA1 | Lacuna G-01 / CT-05-06
    it('P2002 ao gravar o termo: empréstimo não é vinculado e o erro vira 409', async () => {
      prepararCreate();
      prisma.termo.create.mockRejectedValue(erroUnicidade());
      const e = await rejeitada(criar());
      esperaErro(e, ResourceConflictException, 409, ErrorCode.CONFLICT);
      expect(prisma.emprestimo.update).not.toHaveBeenCalled();
    });
  });

  /* ---------------- G-02: consultas não consomem número ---------------- */

  describe('G-02 - visualizar/baixar não consome número de termo', () => {
    const comAssinado = () =>
      prisma.emprestimo.findFirst.mockResolvedValue(
        emprestimoBase({ termo: termoBase({ arquivoAssinado: '2026/assinados/x.pdf' }) }),
      );

    // Técnica: partição válida (PNT-05, consulta repetida) | Requisito: CA1, CA5 | Lacuna G-02 / CT-05-07 (PR-06)
    it('obterPdf: duas consultas devolvem o mesmo nomeArquivo e não chamam o contador', async () => {
      const r1 = await service.obterPdf(ESTOQUE_ID, EMP_ID, gestor);
      const r2 = await service.obterPdf(ESTOQUE_ID, EMP_ID, gestor);
      expect(r1.nomeArquivo).toBe('termo-03-2026.pdf');
      expect(r2.nomeArquivo).toBe(r1.nomeArquivo);
      expect(prisma.contadorTermo.upsert).not.toHaveBeenCalled();
    });

    // Técnica: partição válida (PNT-05, ADMIN) | Requisito: CA1, CA3 | Lacuna G-02 / CT-05-07 (PR-06)
    it('obterPdf como ADMIN também não consome número', async () => {
      await service.obterPdf(ESTOQUE_ID, EMP_ID, admin);
      await service.obterPdf(ESTOQUE_ID, EMP_ID, admin);
      expect(prisma.contadorTermo.upsert).not.toHaveBeenCalled();
    });

    // Técnica: partição válida (PNT-05, consulta repetida) | Requisito: CA1, CA5 | Lacuna G-02 / CT-05-07 (PR-06)
    it('obterPdfAssinado: duas consultas devolvem o mesmo nomeArquivo e não chamam o contador', async () => {
      comAssinado();
      const r1 = await service.obterPdfAssinado(ESTOQUE_ID, EMP_ID, gestor);
      const r2 = await service.obterPdfAssinado(ESTOQUE_ID, EMP_ID, gestor);
      expect(r1.nomeArquivo).toBe('termo-03-2026-assinado.pdf');
      expect(r2.nomeArquivo).toBe(r1.nomeArquivo);
      expect(prisma.contadorTermo.upsert).not.toHaveBeenCalled();
    });
  });

  /* ---------------- G-04: códigos HTTP estritos ---------------- */

  describe('G-04 - código HTTP exato nas recusas', () => {
    const comAssinado = () =>
      prisma.emprestimo.findFirst.mockResolvedValue(
        emprestimoBase({ termo: termoBase({ arquivoAssinado: '2026/assinados/x.pdf' }) }),
      );

    const consultas: Array<[string, (u: any, estoque?: string, emp?: string) => Promise<unknown>]> = [
      ['obterPdf', (u, e = ESTOQUE_ID, emp = EMP_ID) => service.obterPdf(e, emp, u)],
      ['obterPdfAssinado', (u, e = ESTOQUE_ID, emp = EMP_ID) => service.obterPdfAssinado(e, emp, u)],
    ];

    describe.each(consultas)('%s', (_nome, consultar) => {
      beforeEach(() => comAssinado());

      // Técnica: partição inválida (PPF-03, gestor de outro estoque) | Requisito: CA3 | Lacuna G-04 / CT-05-13
      it('gestor de outro estoque (USER sem vínculo) recebe 403 AccessDeniedException', async () => {
        comoNaoGestor();
        const e = await rejeitada(consultar({ userId: 'gestor-outro', role: AccessRole.USER }));
        esperaErro(e, AccessDeniedException, 403, ErrorCode.ACCESS_DENIED);
        expect(termoStorage.read).not.toHaveBeenCalled();
      });

      // Técnica: partição inválida (PPF-04, requisitante) | Requisito: CA3 | Lacuna G-04 / CT-05-14
      it('requisitante sem vínculo recebe 403 AccessDeniedException', async () => {
        comoNaoGestor();
        const e = await rejeitada(consultar({ userId: 'requisitante-1', role: AccessRole.USER }));
        esperaErro(e, AccessDeniedException, 403, ErrorCode.ACCESS_DENIED);
        expect(termoStorage.read).not.toHaveBeenCalled();
      });

      // Técnica: partição inválida (usuário sem userId) | Requisito: CA3 | Lacuna G-04 / CT-05-14
      it('usuário USER sem userId recebe 403 AccessDeniedException', async () => {
        const e = await rejeitada(consultar({ role: AccessRole.USER }));
        esperaErro(e, AccessDeniedException, 403, ErrorCode.ACCESS_DENIED);
        expect(prisma.estoqueGestor.findUnique).not.toHaveBeenCalled();
      });

      // Técnica: partição inválida (sem usuário autenticado) | Requisito: CA3 | Lacuna G-04 / CT-05-14
      it('sem usuário autenticado recebe 403 AccessDeniedException', async () => {
        const e = await rejeitada(consultar(undefined));
        esperaErro(e, AccessDeniedException, 403, ErrorCode.ACCESS_DENIED);
      });

      // Técnica: partição inválida (PEE-02, empréstimo inexistente) | Requisito: CA4 | Lacuna G-04 / CT-05-13
      it('empréstimo inexistente recebe 404 ResourceNotFoundException', async () => {
        prisma.emprestimo.findFirst.mockResolvedValue(null);
        const e = await rejeitada(consultar(gestor, ESTOQUE_ID, 'inexistente'));
        esperaErro(e, ResourceNotFoundException, 404, ErrorCode.NOT_FOUND);
        expect(termoStorage.read).not.toHaveBeenCalled();
      });

      // Técnica: partição inválida (estoque inexistente) | Requisito: CA4 | Lacuna G-04 / CT-05-13
      it('estoque inexistente recebe 404 ResourceNotFoundException', async () => {
        prisma.estoque.findUnique.mockResolvedValue(null);
        const e = await rejeitada(consultar(gestor, 'nao-existe'));
        esperaErro(e, ResourceNotFoundException, 404, ErrorCode.NOT_FOUND);
      });
    });

    // Técnica: partição inválida (sem termo gerado) | Requisito: CA4 | Lacuna G-04 / CT-05-13
    it('obterPdf: empréstimo sem termo recebe 404 ResourceNotFoundException', async () => {
      prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase({ termo: null }));
      const e = await rejeitada(service.obterPdf(ESTOQUE_ID, EMP_ID, gestor));
      esperaErro(e, ResourceNotFoundException, 404, ErrorCode.NOT_FOUND);
    });

    // Técnica: partição inválida (sem PDF assinado) | Requisito: CA7 | Lacuna G-04 / CT-05-13
    it('obterPdfAssinado: termo sem PDF assinado recebe 404 ResourceNotFoundException', async () => {
      prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase());
      const e = await rejeitada(service.obterPdfAssinado(ESTOQUE_ID, EMP_ID, gestor));
      esperaErro(e, ResourceNotFoundException, 404, ErrorCode.NOT_FOUND);
    });

    // Técnica: partição inválida (PAX-03, anexo ausente) | Requisito: CA6, CA8 | Lacuna G-04 / CT-05-14
    it('anexar sem arquivo recebe 400 AppException VALIDATION_FAILED', async () => {
      const e = await rejeitada(service.anexarTermoAssinado(ESTOQUE_ID, EMP_ID, undefined, GESTOR_ID));
      esperaErro(e, AppException, 400, ErrorCode.VALIDATION_FAILED);
    });

    // Técnica: partição inválida (PAX-02, não é PDF) | Requisito: CA6, CA8 | Lacuna G-04 / CT-05-14
    it('anexar arquivo que não é PDF recebe 400 AppException VALIDATION_FAILED', async () => {
      const buffer = Buffer.from('conteudo qualquer');
      const e = await rejeitada(
        service.anexarTermoAssinado(
          ESTOQUE_ID,
          EMP_ID,
          pdfValido({ mimetype: 'text/plain', buffer, size: buffer.length }),
          GESTOR_ID,
        ),
      );
      esperaErro(e, AppException, 400, ErrorCode.VALIDATION_FAILED);
      expect(termoStorage.write).not.toHaveBeenCalled();
    });

    // Técnica: partição inválida (perfil sem vínculo no upload) | Requisito: CA3, CA6 | Lacuna G-04 / CT-05-13
    it('anexar por quem não é gestor do estoque recebe 403 AccessDeniedException', async () => {
      comoNaoGestor();
      const e = await rejeitada(
        service.anexarTermoAssinado(ESTOQUE_ID, EMP_ID, pdfValido(), 'outro-usuario'),
      );
      esperaErro(e, AccessDeniedException, 403, ErrorCode.ACCESS_DENIED);
      expect(termoStorage.write).not.toHaveBeenCalled();
    });

    // Técnica: partição inválida (PCF-02, sem anexo) | Requisito: CA7, CA8 | Lacuna G-04
    it('confirmar entrega sem termo assinado recebe 409 ResourceConflictException', async () => {
      const e = await rejeitada(service.confirmarEntrega(ESTOQUE_ID, EMP_ID, GESTOR_ID));
      esperaErro(e, ResourceConflictException, 409, ErrorCode.CONFLICT);
      expect(prisma.item.update).not.toHaveBeenCalled();
    });
  });

  /* ---------------- G-05: ENOENT do storage (defeito ACH-15) ---------------- */

  describe('G-05 - arquivo ausente no storage (ENOENT)', () => {
    const enoent = () => Object.assign(new Error('ENOENT'), { code: 'ENOENT' });

    // Técnica: critério (arquivo some do storage) | Requisito: CA4 | Lacuna G-05 / ACH-15
    // defeito conhecido ACH-15, abrir issue
    it.fails('obterPdf: ENOENT do storage vira ResourceNotFoundException (404)', async () => {
      termoStorage.read.mockRejectedValue(enoent());
      const e = await rejeitada(service.obterPdf(ESTOQUE_ID, EMP_ID, gestor));
      expect(e).toBeInstanceOf(ResourceNotFoundException);
      expect((e as ResourceNotFoundException).getStatus()).toBe(404);
    });

    // Técnica: critério (arquivo some do storage) | Requisito: CA4 | Lacuna G-05 / ACH-15
    // defeito conhecido ACH-15, abrir issue
    it.fails('obterPdfAssinado: ENOENT do storage vira ResourceNotFoundException (404)', async () => {
      prisma.emprestimo.findFirst.mockResolvedValue(
        emprestimoBase({ termo: termoBase({ arquivoAssinado: '2026/assinados/x.pdf' }) }),
      );
      termoStorage.read.mockRejectedValue(enoent());
      const e = await rejeitada(service.obterPdfAssinado(ESTOQUE_ID, EMP_ID, gestor));
      expect(e).toBeInstanceOf(ResourceNotFoundException);
      expect((e as ResourceNotFoundException).getStatus()).toBe(404);
    });
  });

  /* ---------------- G-07 e G-08: limites do tamanho do anexo ---------------- */

  describe('G-07/G-08 - valores-limite do anexo assinado', () => {
    // Técnica: valor-limite (LM-01, menor PDF aceito) | Requisito: CA6 | Lacuna G-07 / CT-05-21
    // A premissa PR-04 de "PDF aceito com 1 byte" não vale: o menor PDF aceito tem 5 bytes ("%PDF-").
    it('arquivo mínimo válido é aceito (buffer real "%PDF-", 5 bytes)', async () => {
      retornoRefleteGravacao();
      const buffer = Buffer.from('%PDF-');
      const arquivo = pdfValido({ buffer, size: 5, mimetype: 'application/pdf' });

      const r: any = await service.anexarTermoAssinado(ESTOQUE_ID, EMP_ID, arquivo, GESTOR_ID);

      expect(buffer.length).toBe(5);
      expect(termoStorage.write).toHaveBeenCalledTimes(1);
      const [caminho, enviado] = termoStorage.write.mock.calls[0];
      expect(caminho).toMatch(regexAssinado(2026));
      expect(enviado).toBe(buffer);
      expect(prisma.termo.update).toHaveBeenCalledWith({
        where: { id: 'termo-1' },
        data: { arquivoAssinado: caminho },
      });
      expect(r.termoAssinadoAnexado).toBe(true);
    });

    // Técnica: valor-limite (LM-01, 1 byte abaixo do menor PDF) | Requisito: CA6, CA8 | Lacuna G-07 / CT-05-21
    // Comentário: a premissa PR-04 de PDF aceito com 1 byte não vale; 1 byte ("%") é recusado.
    it('arquivo de 1 byte ("%") é recusado com 400', async () => {
      const buffer = Buffer.from('%');
      const e = await rejeitada(
        service.anexarTermoAssinado(
          ESTOQUE_ID,
          EMP_ID,
          pdfValido({ buffer, size: 1, mimetype: 'application/pdf' }),
          GESTOR_ID,
        ),
      );
      esperaErro(e, AppException, 400, ErrorCode.VALIDATION_FAILED);
      expect(termoStorage.write).not.toHaveBeenCalled();
      expect(prisma.termo.update).not.toHaveBeenCalled();
    });

    // Técnica: valor-limite (LM-02, lado válido: exatamente 5 MB) | Requisito: CA6 | Lacuna G-08 / CT-05-22
    it('buffer real de exatamente 5 MB começando por "%PDF-" é aceito', async () => {
      retornoRefleteGravacao();
      const buffer = Buffer.alloc(5 * 1024 * 1024);
      PDF_MAGIC.copy(buffer);
      const arquivo = pdfValido({ buffer, size: buffer.length });

      const r: any = await service.anexarTermoAssinado(ESTOQUE_ID, EMP_ID, arquivo, GESTOR_ID);

      expect(buffer.length).toBe(5_242_880);
      expect(termoStorage.write).toHaveBeenCalledTimes(1);
      expect(termoStorage.write.mock.calls[0][0]).toMatch(regexAssinado(2026));
      expect(termoStorage.write.mock.calls[0][1]).toBe(buffer);
      expect(r.termoAssinadoAnexado).toBe(true);
    });

    // Técnica: valor-limite (LM-02, lado inválido: 5 MB + 1 byte) | Requisito: CA6, CA8 | Lacuna G-08 / CT-05-23
    it('buffer real de 5 MB + 1 byte começando por "%PDF-" é recusado com 400', async () => {
      const buffer = Buffer.alloc(5 * 1024 * 1024 + 1);
      PDF_MAGIC.copy(buffer);
      const arquivo = pdfValido({ buffer, size: buffer.length });

      const e = await rejeitada(
        service.anexarTermoAssinado(ESTOQUE_ID, EMP_ID, arquivo, GESTOR_ID),
      );

      expect(buffer.length).toBe(5_242_881);
      esperaErro(e, AppException, 400, ErrorCode.VALIDATION_FAILED);
      expect(termoStorage.write).not.toHaveBeenCalled();
      expect(prisma.termo.update).not.toHaveBeenCalled();
    });
  });

  /* ---------------- G-09: versões v2 com asserções sobre valores ---------------- */

  describe('G-09 - cenários da v1 com asserções de valor', () => {
    // Técnica: partição válida (PPF-02, ADMIN leitura) | Requisito: CA3, CA5 | Lacuna G-09
    it('ADMIN acessa o PDF assinado sem ser gestor: devolve o conteúdo e o nome corretos', async () => {
      const conteudo = Buffer.from('%PDF-assinado-do-admin');
      prisma.emprestimo.findFirst.mockResolvedValue(
        emprestimoBase({ termo: termoBase({ arquivoAssinado: '2026/assinados/x.pdf' }) }),
      );
      termoStorage.read.mockResolvedValue(conteudo);
      comoNaoGestor();

      const r = await service.obterPdfAssinado(ESTOQUE_ID, EMP_ID, admin);

      expect(r.pdf).toBe(conteudo);
      expect(r.nomeArquivo).toBe('termo-03-2026-assinado.pdf');
      expect(termoStorage.read).toHaveBeenCalledWith('2026/assinados/x.pdf');
      expect(prisma.estoqueGestor.findUnique).not.toHaveBeenCalled();
    });

    // Técnica: partição válida (substituição com falha na limpeza) | Requisito: CA6, CA8 | Lacuna G-09
    it('ignora falha ao remover o arquivo anterior e conclui o upload com os valores corretos', async () => {
      prisma.emprestimo.findFirst.mockResolvedValue(
        emprestimoBase({ termo: termoBase({ arquivoAssinado: '2026/assinados/velho.pdf' }) }),
      );
      termoStorage.remove.mockRejectedValue(new Error('falha de disco'));
      retornoRefleteGravacao();
      const arquivo = pdfValido();

      const r: any = await service.anexarTermoAssinado(ESTOQUE_ID, EMP_ID, arquivo, GESTOR_ID);

      const [caminho, enviado] = termoStorage.write.mock.calls[0];
      expect(caminho).toMatch(regexAssinado(2026));
      expect(enviado).toBe(arquivo.buffer);
      expect(prisma.termo.update).toHaveBeenCalledWith({
        where: { id: 'termo-1' },
        data: { arquivoAssinado: caminho },
      });
      expect(termoStorage.remove).toHaveBeenCalledWith('2026/assinados/velho.pdf');
      expect(termoStorage.remove).not.toHaveBeenCalledWith(caminho);
      expect(r.termoAssinadoAnexado).toBe(true);
    });

    // Técnica: valor-limite (tamanho = máximo) | Requisito: CA6 | Lacuna G-09 / LM-02
    it('aceita arquivo com exatamente 5 MB (size) e grava o buffer enviado', async () => {
      retornoRefleteGravacao();
      const arquivo = pdfValido({ size: TERMO_ASSINADO_MAX_BYTES });

      const r: any = await service.anexarTermoAssinado(ESTOQUE_ID, EMP_ID, arquivo, GESTOR_ID);

      const [caminho, enviado] = termoStorage.write.mock.calls[0];
      expect(caminho).toMatch(regexAssinado(2026));
      expect(enviado).toBe(arquivo.buffer);
      expect(prisma.termo.update).toHaveBeenCalledWith({
        where: { id: 'termo-1' },
        data: { arquivoAssinado: caminho },
      });
      expect(r.termoAssinadoAnexado).toBe(true);
    });

    // Técnica: valor-limite (tamanho = máximo - 1) | Requisito: CA6 | Lacuna G-09 / LM-02
    it('aceita arquivo com 5 MB - 1 byte (size) e grava o buffer enviado', async () => {
      retornoRefleteGravacao();
      const arquivo = pdfValido({ size: TERMO_ASSINADO_MAX_BYTES - 1 });

      const r: any = await service.anexarTermoAssinado(ESTOQUE_ID, EMP_ID, arquivo, GESTOR_ID);

      const [caminho, enviado] = termoStorage.write.mock.calls[0];
      expect(caminho).toMatch(regexAssinado(2026));
      expect(enviado).toBe(arquivo.buffer);
      expect(prisma.termo.update).toHaveBeenCalledWith({
        where: { id: 'termo-1' },
        data: { arquivoAssinado: caminho },
      });
      expect(r.termoAssinadoAnexado).toBe(true);
    });

    // Técnica: valor-limite (exatamente 5 bytes "%PDF-") | Requisito: CA6 | Lacuna G-09 / LM-01
    it('aceita buffer de exatamente 5 bytes "%PDF-" e grava esse buffer', async () => {
      retornoRefleteGravacao();
      const buffer = Buffer.from('%PDF-');
      const arquivo = pdfValido({ buffer, size: 5 });

      const r: any = await service.anexarTermoAssinado(ESTOQUE_ID, EMP_ID, arquivo, GESTOR_ID);

      const [caminho, enviado] = termoStorage.write.mock.calls[0];
      expect(caminho).toMatch(regexAssinado(2026));
      expect(enviado).toBe(buffer);
      expect(Buffer.from(enviado).toString()).toBe('%PDF-');
      expect(prisma.termo.update).toHaveBeenCalledWith({
        where: { id: 'termo-1' },
        data: { arquivoAssinado: caminho },
      });
      expect(r.termoAssinadoAnexado).toBe(true);
    });
  });

  /* ---------------- G-01 (complemento): caminho do PDF gerado ---------------- */

  describe('G-01 - dados enviados à geração e à gravação do termo', () => {
    // Técnica: critério | Requisito: CA1, CA2 | Lacuna G-01 / CT-05-01
    it('o mesmo numeroAno chega a termoPdf.gerar e a tx.termo.create, com caminho no padrão "<ano>/<uuid>.pdf"', async () => {
      prepararCreate();
      await criar();
      const numero = numeroEnviadoAoPdf();
      expect(numero).toBe('01/2026');
      const dadosTermo = prisma.termo.create.mock.calls[0][0].data;
      expect(dadosTermo.numeroAno).toBe(numero);
      expect(dadosTermo.arquivoPdf).toMatch(regexGerado(2026));
      expect(termoStorage.write.mock.calls[0][0]).toBe(dadosTermo.arquivoPdf);
    });
  });
});

/* ------------------------------------------------------------------ */
/* EmprestimosController                                               */
/* ------------------------------------------------------------------ */

describe('US05 v2 - EmprestimosController (G-03)', () => {
  const ESTOQUE_ID = 'estoque-1';
  const EMP_ID = 'emp-1';
  const user = { userId: 'user-gestor', role: AccessRole.USER };

  let service: {
    obterPdf: ReturnType<typeof vi.fn>;
    obterPdfAssinado: ReturnType<typeof vi.fn>;
    anexarTermoAssinado: ReturnType<typeof vi.fn>;
    confirmarEntrega: ReturnType<typeof vi.fn>;
  };
  let controller: EmprestimosController;

  const arquivoRetornado = { pdf: Buffer.from('%PDF-conteudo'), nomeArquivo: 'termo-03-2026.pdf' };

  beforeEach(() => {
    service = {
      obterPdf: vi.fn(),
      obterPdfAssinado: vi.fn(),
      anexarTermoAssinado: vi.fn(),
      confirmarEntrega: vi.fn(),
    };
    controller = new EmprestimosController(service as any);
  });

  const metodos = [
    ['visualizarTermo', 'obterPdf', 'inline'],
    ['baixarTermo', 'obterPdf', 'attachment'],
    ['baixarTermoAssinado', 'obterPdfAssinado', 'attachment'],
  ] as const;

  describe.each(metodos)('%s', (metodo, metodoService, disposicao) => {
    // Técnica: critério | Requisito: CA5 | Lacuna G-03 / CT-05-11, CT-05-12
    it(`devolve StreamableFile application/pdf com disposition "${disposicao}" contendo o nomeArquivo`, async () => {
      service[metodoService].mockResolvedValue(arquivoRetornado);

      const r = await (controller as any)[metodo](ESTOQUE_ID, EMP_ID, user);

      expect(r).toBeInstanceOf(StreamableFile);
      const headers = (r as StreamableFile).getHeaders();
      expect(headers.type).toBe('application/pdf');
      expect(headers.disposition?.startsWith(disposicao)).toBe(true);
      expect(headers.disposition).toContain(arquivoRetornado.nomeArquivo);
    });

    // Técnica: critério | Requisito: CA3 | Lacuna G-03 / CT-05-13
    it('repassa (estoqueId, id, user) ao service', async () => {
      service[metodoService].mockResolvedValue(arquivoRetornado);
      await (controller as any)[metodo](ESTOQUE_ID, EMP_ID, user);
      expect(service[metodoService]).toHaveBeenCalledTimes(1);
      expect(service[metodoService]).toHaveBeenCalledWith(ESTOQUE_ID, EMP_ID, user);
    });

    // Técnica: partição inválida (PPF-03/PPF-04) | Requisito: CA3 | Lacuna G-03 / CT-05-14
    it('propaga sem alterar a AccessDeniedException (403) do service', async () => {
      const erro = new AccessDeniedException();
      service[metodoService].mockRejectedValue(erro);
      const e = await rejeitada((controller as any)[metodo](ESTOQUE_ID, EMP_ID, user));
      expect(e).toBe(erro);
      expect(e).toBeInstanceOf(AccessDeniedException);
      expect((e as AccessDeniedException).getStatus()).toBe(403);
    });

    // Técnica: partição inválida (PEE-02) | Requisito: CA4 | Lacuna G-03 / CT-05-15
    it('propaga sem alterar a ResourceNotFoundException (404) do service', async () => {
      const erro = new ResourceNotFoundException('Empréstimo', EMP_ID);
      service[metodoService].mockRejectedValue(erro);
      const e = await rejeitada((controller as any)[metodo](ESTOQUE_ID, EMP_ID, user));
      expect(e).toBe(erro);
      expect(e).toBeInstanceOf(ResourceNotFoundException);
      expect((e as ResourceNotFoundException).getStatus()).toBe(404);
    });
  });

  describe('anexarTermoAssinado', () => {
    const arquivo = {
      originalname: 'termo.pdf',
      mimetype: 'application/pdf',
      size: 5,
      buffer: Buffer.from('%PDF-'),
    };

    // Técnica: critério | Requisito: CA6, CA8 | Lacuna G-03 / CT-05-17
    it('repassa (estoqueId, id, arquivo, user.userId) e devolve o resultado do service', async () => {
      const resultado = { id: EMP_ID, termoAssinadoAnexado: true };
      service.anexarTermoAssinado.mockResolvedValue(resultado);

      const r = await controller.anexarTermoAssinado(ESTOQUE_ID, EMP_ID, arquivo as any, user);

      expect(service.anexarTermoAssinado).toHaveBeenCalledWith(
        ESTOQUE_ID,
        EMP_ID,
        arquivo,
        'user-gestor',
      );
      expect(r).toBe(resultado);
    });

    // Técnica: partição inválida (sem usuário) | Requisito: CA3, CA6 | Lacuna G-03 / CT-05-26
    it('sem usuário, o userId repassado é undefined', async () => {
      service.anexarTermoAssinado.mockResolvedValue({ id: EMP_ID });
      await controller.anexarTermoAssinado(ESTOQUE_ID, EMP_ID, arquivo as any, undefined);
      expect(service.anexarTermoAssinado).toHaveBeenCalledWith(ESTOQUE_ID, EMP_ID, arquivo, undefined);
    });

    // Técnica: partição inválida (PAX-03, anexo ausente) | Requisito: CA6, CA8 | Lacuna G-03 / CT-05-17
    it('repassa arquivo ausente ao service e propaga o erro 400 sem alterar', async () => {
      const erro = new AppException(ErrorCode.VALIDATION_FAILED, 'Envie o PDF', 400);
      service.anexarTermoAssinado.mockRejectedValue(erro);
      const e = await rejeitada(controller.anexarTermoAssinado(ESTOQUE_ID, EMP_ID, undefined, user));
      expect(e).toBe(erro);
      expect(service.anexarTermoAssinado).toHaveBeenCalledWith(ESTOQUE_ID, EMP_ID, undefined, 'user-gestor');
    });
  });

  describe('confirmarEntrega', () => {
    // Técnica: critério | Requisito: CA7, CA8 | Lacuna G-03 / CT-05-26
    it('repassa (estoqueId, id, user.userId) e devolve o resultado do service', async () => {
      const resultado = { id: EMP_ID, status: StatusEmprestimo.ATIVO };
      service.confirmarEntrega.mockResolvedValue(resultado);

      const r = await controller.confirmarEntrega(ESTOQUE_ID, EMP_ID, user);

      expect(service.confirmarEntrega).toHaveBeenCalledWith(ESTOQUE_ID, EMP_ID, 'user-gestor');
      expect(r).toBe(resultado);
    });

    // Técnica: partição inválida (sem usuário) | Requisito: CA7, CA8 | Lacuna G-03 / CT-05-26
    it('sem usuário, o userId repassado é undefined', async () => {
      service.confirmarEntrega.mockResolvedValue({ id: EMP_ID });
      await controller.confirmarEntrega(ESTOQUE_ID, EMP_ID, undefined);
      expect(service.confirmarEntrega).toHaveBeenCalledWith(ESTOQUE_ID, EMP_ID, undefined);
    });

    // Técnica: partição inválida (PCF-02, sem anexo) | Requisito: CA7, CA8 | Lacuna G-03 / CT-05-26
    it('propaga sem alterar o erro 409 do service (confirmação sem anexo)', async () => {
      const erro = new ResourceConflictException('Anexe o termo assinado');
      service.confirmarEntrega.mockRejectedValue(erro);
      const e = await rejeitada(controller.confirmarEntrega(ESTOQUE_ID, EMP_ID, user));
      expect(e).toBe(erro);
      expect((e as ResourceConflictException).getStatus()).toBe(409);
    });
  });
});

/* ------------------------------------------------------------------ */
/* TermoPdfService                                                     */
/* ------------------------------------------------------------------ */

describe('US05 v2 - TermoPdfService.gerar', () => {
  let service: TermoPdfService;
  let drawTextSpy: ReturnType<typeof vi.spyOn>;

  const dadosBase = (): TermoPdfData => ({
    numeroAno: '01/2026',
    responsavel: {
      nome: 'Maria da Silva',
      siape: '1234567',
      lotacao: 'Departamento de Computação',
      cargo: 'Professora',
    },
    unidade: 'Estoque Central',
    dataAbertura: new Date('2026-11-10T12:00:00Z'),
    dataFechamento: new Date('2026-11-30T12:00:00Z'),
    item: {
      nome: 'Notebook Dell Latitude',
      tombamento: 'TOMB-001',
      numeroSerie: 'SN-999',
      descricao: null,
    },
  });

  const textos = () => drawTextSpy.mock.calls.map((c: any[]) => c[0] as string);
  const todoTexto = () => textos().join('\n');

  beforeEach(() => {
    vi.stubEnv('TZ', 'UTC'); // servidor em UTC
    service = new TermoPdfService();
    drawTextSpy = vi.spyOn(PDFPage.prototype, 'drawText');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  /* ---------------- G-06: datas no fuso America/Recife ---------------- */

  const campos = [
    { campo: 'dataFechamento', rotulo: 'Data Prevista para Fechamento' },
    { campo: 'dataAbertura', rotulo: 'Data de Abertura' },
  ] as const;

  for (const { campo, rotulo } of campos) {
    describe(`G-06 - ${campo} no fuso America/Recife`, () => {
      // Técnica: valor-limite (virada de dia UTC × Recife) | Requisito: CA2 | Lacuna G-06 / ACH-09
      // defeito conhecido ACH-09
      it.fails(`${campo}: 2026-11-21T02:30:00Z é exibida como 20/11/2026`, async () => {
        await service.gerar({ ...dadosBase(), [campo]: new Date('2026-11-21T02:30:00Z') });
        expect(todoTexto()).toContain(`${rotulo}: 20/11/2026`);
      });

      // Técnica: valor-limite (fim do dia em Recife) | Requisito: CA2 | Lacuna G-06 / ACH-09
      // defeito conhecido ACH-09
      it.fails(`${campo}: 2026-11-20T23:59:59-03:00 é exibida como 20/11/2026`, async () => {
        await service.gerar({ ...dadosBase(), [campo]: new Date('2026-11-20T23:59:59-03:00') });
        expect(todoTexto()).toContain(`${rotulo}: 20/11/2026`);
      });

      // Técnica: valor-limite (início do dia em Recife) | Requisito: CA2 | Lacuna G-06 / ACH-09
      it(`${campo}: 2026-11-20T00:00:00-03:00 é exibida como 20/11/2026`, async () => {
        await service.gerar({ ...dadosBase(), [campo]: new Date('2026-11-20T00:00:00-03:00') });
        expect(todoTexto()).toContain(`${rotulo}: 20/11/2026`);
      });
    });
  }

  /* ---------------- G-10: descrição só com espaços ---------------- */

  describe('G-10 - descrição do bem só com espaços', () => {
    // Técnica: partição (descrição em branco; ramo falso de "if (line)") | Requisito: CA2, CA5 | Lacuna G-10
    it('gera PDF válido e mantém denominação e declaração de responsabilidade', async () => {
      const dados = dadosBase();
      dados.item.descricao = '   ';

      const bytes = await service.gerar(dados);

      expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe('%PDF-');
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBe(1);
      const t = todoTexto();
      expect(t).toContain('Denominação: Notebook Dell Latitude');
      expect(t).toContain('DECLARAÇÃO DE RESPONSABILIDADE');
      expect(t).toContain('Declaro ter recebido');
    });
  });
});