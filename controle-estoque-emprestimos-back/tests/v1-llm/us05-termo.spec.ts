// tests/v1-llm/us05-termo.spec.ts
import { mkdtemp, readFile, rm, writeFile, mkdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument, PDFPage } from 'pdf-lib';

import { TermoPdfService, TermoPdfData } from '../../src/modules/emprestimos/termo-pdf.service';
import { TermoStorageService } from '../../src/modules/emprestimos/termo-storage.service';
import {
  TERMO_ASSINADO_MAX_BYTES,
  TERMO_ASSINADO_MIME,
  PDF_MAGIC,
} from '../../src/modules/emprestimos/termo-assinado.constants';
import { EmprestimosService } from '../../src/modules/emprestimos/emprestimos.service';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

// Captura a rejeição para inspecionar classe (por nome), mensagem e status HTTP.
// Os caminhos das exceções não foram fornecidos, então são identificadas pelo nome da classe.
async function erro(promise: Promise<unknown>): Promise<any> {
  try {
    await promise;
  } catch (e) {
    return e;
  }
  throw new Error('Esperava que a promessa fosse rejeitada, mas ela foi resolvida.');
}

const nomeClasse = (e: any) => e?.constructor?.name;

/* ------------------------------------------------------------------ */
/* Constantes do upload                                                */
/* ------------------------------------------------------------------ */

describe('US05 - constantes do termo assinado', () => {
  // Técnica: valor-limite | Requisito: CA6
  it('limite máximo é exatamente 5 MB (5 * 1024 * 1024 bytes)', () => {
    expect(TERMO_ASSINADO_MAX_BYTES).toBe(5_242_880);
  });

  // Técnica: partição válida | Requisito: CA6
  it('MIME aceito é application/pdf', () => {
    expect(TERMO_ASSINADO_MIME).toBe('application/pdf');
  });

  // Técnica: valor-limite | Requisito: CA6
  it('assinatura mágica do PDF é "%PDF-" com 5 bytes', () => {
    expect(PDF_MAGIC.toString()).toBe('%PDF-');
    expect(PDF_MAGIC.length).toBe(5);
  });
});

/* ------------------------------------------------------------------ */
/* TermoPdfService                                                     */
/* ------------------------------------------------------------------ */

describe('US05 - TermoPdfService.gerar', () => {
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
    dataFechamento: new Date('2026-11-20T12:00:00Z'),
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
    service = new TermoPdfService();
    drawTextSpy = vi.spyOn(PDFPage.prototype, 'drawText');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Técnica: critério | Requisito: CA5
  it('devolve bytes de um PDF válido (começa com %PDF-)', async () => {
    const bytes = await service.gerar(dadosBase());
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  // Técnica: critério | Requisito: CA1
  it('exibe o número sequencial no formato "Nº XX/ano" no título e nos metadados', async () => {
    const bytes = await service.gerar(dadosBase());
    expect(textos()).toContain('TERMO DE ACAUTELAMENTO PROVISÓRIO Nº 01/2026');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe('Termo de Acautelamento Provisório Nº 01/2026');
  });

  // Técnica: valor-limite | Requisito: CA1
  it.each(['01/2026', '09/2026', '10/2026', '99/2026', '100/2026'])(
    'reproduz fielmente o número %s no título (limites do padStart de 2 dígitos)',
    async (numeroAno) => {
      await service.gerar({ ...dadosBase(), numeroAno });
      expect(textos()).toContain(`TERMO DE ACAUTELAMENTO PROVISÓRIO Nº ${numeroAno}`);
    },
  );

  // Técnica: partição válida | Requisito: CA2
  it('contém dados do responsável, unidade, datas, bem e declaração', async () => {
    await service.gerar(dadosBase());
    const t = todoTexto();
    expect(t).toContain('Nome: Maria da Silva');
    expect(t).toContain('Siape: 1234567');
    expect(t).toContain('Lotação: Departamento de Computação');
    expect(t).toContain('Cargo: Professora');
    expect(t).toContain('Unidade de Acautelamento: Estoque Central');
    expect(t).toContain('Data de Abertura: 10/11/2026');
    expect(t).toContain('Data Prevista para Fechamento: 20/11/2026');
    expect(t).toContain('BENS ACAUTELADOS');
    expect(t).toContain('Denominação: Notebook Dell Latitude');
    expect(t).toContain('DECLARAÇÃO DE RESPONSABILIDADE');
    expect(t).toContain('Declaro ter recebido');
  });

  // Técnica: partição inválida (ausente) | Requisito: CA2
  it('mostra "INDEFINIDO" quando a data prevista de fechamento é nula', async () => {
    await service.gerar({ ...dadosBase(), dataFechamento: null });
    expect(todoTexto()).toContain('Data Prevista para Fechamento: INDEFINIDO');
  });

  // Técnica: partição inválida (data inválida) | Requisito: CA2
  it('mostra "INDEFINIDO" quando a data de fechamento é uma Date inválida', async () => {
    await service.gerar({ ...dadosBase(), dataFechamento: new Date('invalido') });
    expect(todoTexto()).toContain('Data Prevista para Fechamento: INDEFINIDO');
  });

  // Técnica: partição inválida (ausente) | Requisito: CA2
  it('mostra "Não informado" quando o Siape é nulo', async () => {
    const dados = dadosBase();
    dados.responsavel.siape = null;
    await service.gerar(dados);
    expect(todoTexto()).toContain('Siape: Não informado');
  });

  // Técnica: valor-limite (fronteira de dia em UTC) | Requisito: CA2
  it('formata a data de abertura em UTC no início do dia (00:00:00Z)', async () => {
    await service.gerar({ ...dadosBase(), dataAbertura: new Date('2026-01-01T00:00:00Z') });
    expect(todoTexto()).toContain('Data de Abertura: 01/01/2026');
  });

  // Técnica: valor-limite (fronteira de dia em UTC) | Requisito: CA2
  it('formata a data de abertura em UTC no fim do dia (23:59:59Z)', async () => {
    await service.gerar({ ...dadosBase(), dataAbertura: new Date('2026-12-31T23:59:59Z') });
    expect(todoTexto()).toContain('Data de Abertura: 31/12/2026');
  });

  // Técnica: partição (identificação do bem) | Requisito: CA2
  it('usa o tombamento quando tombamento e nº de série existem', async () => {
    await service.gerar(dadosBase());
    expect(todoTexto()).toContain('Tombamento/Nº de Série: TOMB-001');
    expect(todoTexto()).not.toContain('SN-999');
  });

  // Técnica: partição (identificação do bem) | Requisito: CA2
  it('usa o nº de série quando não há tombamento', async () => {
    const dados = dadosBase();
    dados.item.tombamento = null;
    await service.gerar(dados);
    expect(todoTexto()).toContain('Tombamento/Nº de Série: SN-999');
  });

  // Técnica: partição inválida (ambos ausentes) | Requisito: CA2
  it('mostra "Sem identificação" quando não há tombamento nem nº de série', async () => {
    const dados = dadosBase();
    dados.item.tombamento = null;
    dados.item.numeroSerie = null;
    await service.gerar(dados);
    expect(todoTexto()).toContain('Tombamento/Nº de Série: Sem identificação');
  });

  // Técnica: partição válida (descrição presente) | Requisito: CA2
  it('inclui a descrição do bem quando informada', async () => {
    const dados = dadosBase();
    dados.item.descricao = 'Acompanha carregador e mochila';
    await service.gerar(dados);
    expect(todoTexto()).toContain('Acompanha carregador e mochila');
  });

  // Técnica: partição (descrição ausente) | Requisito: CA2
  it('não desenha descrição quando ela é nula', async () => {
    const dados = dadosBase();
    dados.item.descricao = null;
    await service.gerar(dados);
    expect(todoTexto()).not.toContain('Acompanha');
    // última linha do rodapé de assinatura
    expect(textos()).toContain('Responsável pelo bem');
  });

  // Técnica: valor-limite (1 página vs. quebra de página) | Requisito: CA2
  it('gera uma única página com conteúdo curto', async () => {
    const doc = await PDFDocument.load(await service.gerar(dadosBase()));
    expect(doc.getPageCount()).toBe(1);
  });

  // Técnica: valor-limite (estouro da página) | Requisito: CA2
  it('quebra para nova página quando a descrição é muito longa', async () => {
    const dados = dadosBase();
    dados.item.descricao = 'palavra '.repeat(2000).trim();
    const doc = await PDFDocument.load(await service.gerar(dados));
    expect(doc.getPageCount()).toBeGreaterThan(1);
    // conteúdo posterior à descrição continua presente
    expect(todoTexto()).toContain('DECLARAÇÃO DE RESPONSABILIDADE');
  });

  // Técnica: valor-limite (palavra maior que a largura útil) | Requisito: CA2
  it('não entra em laço infinito com uma palavra maior que a largura da página', async () => {
    const dados = dadosBase();
    dados.item.descricao = 'X'.repeat(500);
    const bytes = await service.gerar(dados);
    expect(bytes.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* TermoStorageService                                                 */
/* ------------------------------------------------------------------ */

describe('US05 - TermoStorageService', () => {
  let root: string;
  let storage: TermoStorageService;
  let config: { get: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'termos-'));
    config = { get: vi.fn().mockReturnValue(root) };
    storage = new TermoStorageService(config as any);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  // Técnica: critério | Requisito: CA5
  it('consulta TERMO_STORAGE_PATH com o padrão ./storage/termos', () => {
    expect(config.get).toHaveBeenCalledWith('TERMO_STORAGE_PATH', './storage/termos');
  });

  // Técnica: partição válida | Requisito: CA5
  it('grava e lê de volta o mesmo conteúdo, criando subpastas', async () => {
    const conteudo = new Uint8Array([37, 80, 68, 70, 45]);
    await storage.write('2026/abc.pdf', conteudo);
    const lido = await storage.read('2026/abc.pdf');
    expect(Buffer.from(lido).equals(Buffer.from(conteudo))).toBe(true);
  });

  // Técnica: partição inválida (arquivo já existente) | Requisito: CA6
  it('não sobrescreve arquivo existente (flag wx)', async () => {
    await storage.write('2026/dup.pdf', new Uint8Array([1]));
    await expect(storage.write('2026/dup.pdf', new Uint8Array([2]))).rejects.toThrow(/EEXIST/);
    expect((await storage.read('2026/dup.pdf'))[0]).toBe(1);
  });

  // Técnica: partição inválida (inexistente) | Requisito: CA4
  it('falha ao ler arquivo inexistente', async () => {
    await expect(storage.read('2026/nao-existe.pdf')).rejects.toThrow(/ENOENT/);
  });

  // Técnica: partição válida | Requisito: CA6
  it('remove um arquivo existente', async () => {
    await storage.write('2026/rm.pdf', new Uint8Array([1]));
    await storage.remove('2026/rm.pdf');
    await expect(access(join(root, '2026/rm.pdf'))).rejects.toThrow();
  });

  // Técnica: partição inválida (inexistente) | Requisito: CA6
  it('remove arquivo inexistente sem lançar erro (force)', async () => {
    await expect(storage.remove('2026/fantasma.pdf')).resolves.toBeUndefined();
  });

  // Técnica: partição inválida (caminho absoluto) | Requisito: CA3
  it('rejeita caminho absoluto', async () => {
    await expect(storage.read('/etc/passwd')).rejects.toThrow(/relativo ao storage/);
    await expect(storage.write('/tmp/x.pdf', new Uint8Array([1]))).rejects.toThrow(
      /relativo ao storage/,
    );
  });

  // Técnica: valor-limite (fronteira da raiz) | Requisito: CA3
  it.each(['..', '../fora.pdf', '../../fora.pdf', '2026/../../fora.pdf'])(
    'rejeita path traversal "%s"',
    async (caminho) => {
      await expect(storage.read(caminho)).rejects.toThrow(/fora do storage/);
    },
  );

  // Técnica: valor-limite (prefixo semelhante à raiz) | Requisito: CA3
  it('rejeita diretório irmão com prefixo igual ao da raiz', async () => {
    const irmao = `../${root.split('/').pop()}-outro/a.pdf`;
    await expect(storage.read(irmao)).rejects.toThrow(/fora do storage/);
  });

  // Técnica: valor-limite (lado válido da fronteira) | Requisito: CA3
  it('aceita caminho que sobe e volta para dentro da raiz', async () => {
    await mkdir(join(root, '2026'), { recursive: true });
    await writeFile(join(root, 'b.pdf'), Buffer.from('ok'));
    const lido = await storage.read('2026/../b.pdf');
    expect(lido.toString()).toBe('ok');
  });

  // Técnica: valor-limite (nome começando com "..") | Requisito: CA3
  it('aceita nome de arquivo que apenas começa com ".." (não é traversal)', async () => {
    await writeFile(join(root, '..oculto.pdf'), Buffer.from('ok'));
    const lido = await storage.read('..oculto.pdf');
    expect(lido.toString()).toBe('ok');
  });
});

/* ------------------------------------------------------------------ */
/* EmprestimosService - PDF, upload e confirmação                      */
/* ------------------------------------------------------------------ */

describe('US05 - EmprestimosService', () => {
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
    status: 'AGUARDANDO_TERMO',
    termo: termoBase(),
    ...over,
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

  const comoGestor = () => prisma.estoqueGestor.findUnique.mockResolvedValue({ id: 'vinculo' });
  const comoNaoGestor = () => prisma.estoqueGestor.findUnique.mockResolvedValue(null);

  beforeEach(() => {
    prisma = {
      estoque: { findUnique: vi.fn().mockResolvedValue({ id: ESTOQUE_ID, nome: 'Estoque Central' }) },
      estoqueGestor: { findUnique: vi.fn().mockResolvedValue({ id: 'vinculo' }) },
      emprestimo: {
        findFirst: vi.fn().mockResolvedValue(emprestimoBase()),
        findUniqueOrThrow: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn(),
      },
      termo: { update: vi.fn().mockResolvedValue({}) },
      item: { update: vi.fn().mockResolvedValue({}) },
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

  /* -------------------------- obterPdf -------------------------- */

  describe('obterPdf (visualizar/baixar termo gerado)', () => {
    // Técnica: partição válida (gestor) | Requisito: CA3, CA5
    it('gestor do estoque recebe o PDF gerado e o nome do arquivo', async () => {
      const r = await service.obterPdf(ESTOQUE_ID, EMP_ID, {
        userId: GESTOR_ID,
        role: 'GESTOR',
      } as any);
      expect(r.pdf.toString()).toBe('%PDF-conteudo');
      expect(r.nomeArquivo).toBe('termo-03-2026.pdf');
      expect(termoStorage.read).toHaveBeenCalledWith('2026/gerado.pdf');
      expect(prisma.estoqueGestor.findUnique).toHaveBeenCalledWith({
        where: { estoqueId_usuarioId: { estoqueId: ESTOQUE_ID, usuarioId: GESTOR_ID } },
      });
    });

    // Técnica: partição válida (ADMIN, leitura) | Requisito: CA3
    it('ADMIN acessa mesmo sem ser gestor e sem consultar o vínculo', async () => {
      comoNaoGestor();
      const r = await service.obterPdf(ESTOQUE_ID, EMP_ID, {
        userId: 'admin-1',
        role: 'ADMIN',
      } as any);
      expect(r.nomeArquivo).toBe('termo-03-2026.pdf');
      expect(prisma.estoqueGestor.findUnique).not.toHaveBeenCalled();
    });

    // Técnica: partição inválida (perfil sem vínculo) | Requisito: CA3
    it('recusa usuário não gestor e não ADMIN', async () => {
      comoNaoGestor();
      const e = await erro(
        service.obterPdf(ESTOQUE_ID, EMP_ID, { userId: 'outro', role: 'REQUISITANTE' } as any),
      );
      expect(nomeClasse(e)).toBe('AccessDeniedException');
      expect(termoStorage.read).not.toHaveBeenCalled();
    });

    // Técnica: partição inválida (sem usuário) | Requisito: CA3
    it('recusa quando não há usuário autenticado', async () => {
      const e = await erro(service.obterPdf(ESTOQUE_ID, EMP_ID, undefined));
      expect(nomeClasse(e)).toBe('AccessDeniedException');
      expect(prisma.estoqueGestor.findUnique).not.toHaveBeenCalled();
      expect(termoStorage.read).not.toHaveBeenCalled();
    });

    // Técnica: partição inválida (usuário sem id, não ADMIN) | Requisito: CA3
    it('recusa usuário não ADMIN sem userId', async () => {
      const e = await erro(service.obterPdf(ESTOQUE_ID, EMP_ID, { role: 'GESTOR' } as any));
      expect(nomeClasse(e)).toBe('AccessDeniedException');
    });

    // Técnica: partição inválida (empréstimo inexistente) | Requisito: CA4
    it('trata empréstimo inexistente como recurso não encontrado', async () => {
      prisma.emprestimo.findFirst.mockResolvedValue(null);
      const e = await erro(
        service.obterPdf(ESTOQUE_ID, 'inexistente', { userId: GESTOR_ID, role: 'GESTOR' } as any),
      );
      expect(nomeClasse(e)).toBe('ResourceNotFoundException');
      expect(termoStorage.read).not.toHaveBeenCalled();
    });

    // Técnica: partição inválida (empréstimo inexistente, perfil ADMIN) | Requisito: CA4
    it('ADMIN consultando empréstimo inexistente também recebe não encontrado', async () => {
      prisma.emprestimo.findFirst.mockResolvedValue(null);
      const e = await erro(
        service.obterPdf(ESTOQUE_ID, 'inexistente', { userId: 'a', role: 'ADMIN' } as any),
      );
      expect(nomeClasse(e)).toBe('ResourceNotFoundException');
    });

    // Técnica: partição inválida (estoque inexistente) | Requisito: CA4
    it('estoque inexistente resulta em não encontrado', async () => {
      prisma.estoque.findUnique.mockResolvedValue(null);
      const e = await erro(
        service.obterPdf('nao-existe', EMP_ID, { userId: GESTOR_ID, role: 'GESTOR' } as any),
      );
      expect(nomeClasse(e)).toBe('ResourceNotFoundException');
    });

    // Técnica: partição inválida (empréstimo sem termo) | Requisito: CA4
    it('empréstimo sem termo gerado resulta em não encontrado', async () => {
      prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase({ termo: null }));
      const e = await erro(
        service.obterPdf(ESTOQUE_ID, EMP_ID, { userId: GESTOR_ID, role: 'GESTOR' } as any),
      );
      expect(nomeClasse(e)).toBe('ResourceNotFoundException');
    });

    // Técnica: critério (isolamento por estoque) | Requisito: CA3, CA4
    it('busca o empréstimo restrito ao estoque informado', async () => {
      await service.obterPdf(ESTOQUE_ID, EMP_ID, { userId: GESTOR_ID, role: 'GESTOR' } as any);
      expect(prisma.emprestimo.findFirst).toHaveBeenCalledWith({
        where: { id: EMP_ID, item: { estoqueId: ESTOQUE_ID } },
        include: { termo: true },
      });
    });
  });

  /* ---------------------- obterPdfAssinado ---------------------- */

  describe('obterPdfAssinado (visualizar/baixar termo assinado)', () => {
    const comAssinado = () =>
      prisma.emprestimo.findFirst.mockResolvedValue(
        emprestimoBase({ termo: termoBase({ arquivoAssinado: '2026/assinados/x.pdf' }) }),
      );

    // Técnica: partição válida (gestor) | Requisito: CA3, CA5
    it('gestor recebe o PDF assinado com nome terminando em -assinado.pdf', async () => {
      comAssinado();
      const r = await service.obterPdfAssinado(ESTOQUE_ID, EMP_ID, {
        userId: GESTOR_ID,
        role: 'GESTOR',
      } as any);
      expect(r.nomeArquivo).toBe('termo-03-2026-assinado.pdf');
      expect(termoStorage.read).toHaveBeenCalledWith('2026/assinados/x.pdf');
    });

    // Técnica: partição válida (ADMIN, leitura) | Requisito: CA3
    it('ADMIN acessa o PDF assinado sem ser gestor', async () => {
      comAssinado();
      comoNaoGestor();
      const r = await service.obterPdfAssinado(ESTOQUE_ID, EMP_ID, {
        userId: 'adm',
        role: 'ADMIN',
      } as any);
      expect(r.pdf).toBeDefined();
      expect(prisma.estoqueGestor.findUnique).not.toHaveBeenCalled();
    });

    // Técnica: partição inválida (perfil sem vínculo) | Requisito: CA3
    it('recusa perfil não gestor e não ADMIN', async () => {
      comAssinado();
      comoNaoGestor();
      const e = await erro(
        service.obterPdfAssinado(ESTOQUE_ID, EMP_ID, { userId: 'x', role: 'REQUISITANTE' } as any),
      );
      expect(nomeClasse(e)).toBe('AccessDeniedException');
    });

    // Técnica: partição inválida (empréstimo inexistente) | Requisito: CA4
    it('empréstimo inexistente resulta em não encontrado', async () => {
      prisma.emprestimo.findFirst.mockResolvedValue(null);
      const e = await erro(
        service.obterPdfAssinado(ESTOQUE_ID, 'nao', { userId: GESTOR_ID, role: 'GESTOR' } as any),
      );
      expect(nomeClasse(e)).toBe('ResourceNotFoundException');
    });

    // Técnica: partição inválida (sem assinado) | Requisito: CA7
    it('termo ainda sem PDF assinado resulta em não encontrado', async () => {
      const e = await erro(
        service.obterPdfAssinado(ESTOQUE_ID, EMP_ID, { userId: GESTOR_ID, role: 'GESTOR' } as any),
      );
      expect(nomeClasse(e)).toBe('ResourceNotFoundException');
      expect(termoStorage.read).not.toHaveBeenCalled();
    });
  });

  /* ----------------------- anexarTermoAssinado ----------------------- */

  describe('anexarTermoAssinado (upload do PDF assinado)', () => {
    const resultadoFinal = (arquivoAssinado: string | null) =>
      prisma.emprestimo.findUniqueOrThrow.mockResolvedValue({
        id: EMP_ID,
        status: 'AGUARDANDO_TERMO',
        termo: { id: 'termo-1', numeroAno: '03/2026', arquivoAssinado },
      });

    // Técnica: partição válida | Requisito: CA6, CA8
    it('valida, grava e anexa o PDF assinado ao empréstimo', async () => {
      const arquivo = pdfValido();
      resultadoFinal('2026/assinados/novo.pdf');

      const r: any = await service.anexarTermoAssinado(ESTOQUE_ID, EMP_ID, arquivo, GESTOR_ID);

      const caminho = termoStorage.write.mock.calls[0][0] as string;
      expect(caminho).toMatch(/^\d{4}\/assinados\/[0-9a-f-]{36}\.pdf$/);
      expect(termoStorage.write.mock.calls[0][1]).toBe(arquivo.buffer);
      expect(prisma.termo.update).toHaveBeenCalledWith({
        where: { id: 'termo-1' },
        data: { arquivoAssinado: caminho },
      });
      expect(r.termoAssinadoAnexado).toBe(true);
      expect(r.termo).toEqual({ id: 'termo-1', numeroAno: '03/2026' });
      expect(r.termo.arquivoAssinado).toBeUndefined();
    });

    // Técnica: partição válida (substituição) | Requisito: CA6
    it('substitui o assinado anterior removendo o arquivo antigo', async () => {
      prisma.emprestimo.findFirst.mockResolvedValue(
        emprestimoBase({ termo: termoBase({ arquivoAssinado: '2026/assinados/antigo.pdf' }) }),
      );
      resultadoFinal('novo');
      await service.anexarTermoAssinado(ESTOQUE_ID, EMP_ID, pdfValido(), GESTOR_ID);
      expect(termoStorage.remove).toHaveBeenCalledWith('2026/assinados/antigo.pdf');
    });

    // Técnica: partição válida (primeiro upload) | Requisito: CA6
    it('não remove nada quando não havia assinado anterior', async () => {
      resultadoFinal('novo');
      await service.anexarTermoAssinado(ESTOQUE_ID, EMP_ID, pdfValido(), GESTOR_ID);
      expect(termoStorage.remove).not.toHaveBeenCalled();
    });

    // Técnica: partição inválida (falha na limpeza) | Requisito: CA6
    it('ignora falha ao remover o arquivo anterior', async () => {
      prisma.emprestimo.findFirst.mockResolvedValue(
        emprestimoBase({ termo: termoBase({ arquivoAssinado: 'velho.pdf' }) }),
      );
      termoStorage.remove.mockRejectedValue(new Error('falha de disco'));
      resultadoFinal('novo');
      await expect(
        service.anexarTermoAssinado(ESTOQUE_ID, EMP_ID, pdfValido(), GESTOR_ID),
      ).resolves.toBeDefined();
    });

    // Técnica: partição inválida (falha no banco) | Requisito: CA8
    it('desfaz o arquivo novo e propaga o erro se a atualização do termo falhar', async () => {
      prisma.emprestimo.findFirst.mockResolvedValue(
        emprestimoBase({ termo: termoBase({ arquivoAssinado: 'anterior.pdf' }) }),
      );
      prisma.termo.update.mockRejectedValue(new Error('db fora'));
      const e = await erro(service.anexarTermoAssinado(ESTOQUE_ID, EMP_ID, pdfValido(), GESTOR_ID));
      expect(e.message).toBe('db fora');
      const novo = termoStorage.write.mock.calls[0][0];
      expect(termoStorage.remove).toHaveBeenCalledWith(novo);
      expect(termoStorage.remove).not.toHaveBeenCalledWith('anterior.pdf');
    });

    // Técnica: partição inválida (perfil) | Requisito: CA3, CA6
    it('recusa quem não é gestor do estoque (inclusive ADMIN, que é somente leitura)', async () => {
      comoNaoGestor();
      const e = await erro(service.anexarTermoAssinado(ESTOQUE_ID, EMP_ID, pdfValido(), 'admin-1'));
      expect(nomeClasse(e)).toBe('AccessDeniedException');
      expect(termoStorage.write).not.toHaveBeenCalled();
    });

    // Técnica: partição inválida (sem usuário) | Requisito: CA3
    it('recusa quando userId é indefinido', async () => {
      const e = await erro(
        service.anexarTermoAssinado(ESTOQUE_ID, EMP_ID, pdfValido(), undefined),
      );
      expect(nomeClasse(e)).toBe('AccessDeniedException');
    });

    // Técnica: partição inválida (estoque inexistente) | Requisito: CA4, CA8
    it('estoque inexistente resulta em não encontrado', async () => {
      prisma.estoque.findUnique.mockResolvedValue(null);
      const e = await erro(service.anexarTermoAssinado('x', EMP_ID, pdfValido(), GESTOR_ID));
      expect(nomeClasse(e)).toBe('ResourceNotFoundException');
    });

    // Técnica: partição inválida (empréstimo inexistente) | Requisito: CA4, CA8
    it('empréstimo inexistente resulta em não encontrado', async () => {
      prisma.emprestimo.findFirst.mockResolvedValue(null);
      const e = await erro(service.anexarTermoAssinado(ESTOQUE_ID, 'x', pdfValido(), GESTOR_ID));
      expect(nomeClasse(e)).toBe('ResourceNotFoundException');
    });

    // Técnica: partição inválida (sem termo) | Requisito: CA8
    it('empréstimo sem termo gerado resulta em não encontrado', async () => {
      prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase({ termo: null }));
      const e = await erro(service.anexarTermoAssinado(ESTOQUE_ID, EMP_ID, pdfValido(), GESTOR_ID));
      expect(nomeClasse(e)).toBe('ResourceNotFoundException');
    });

    // Técnica: partição inválida (status) | Requisito: CA6, CA8
    it.each(['ATIVO', 'DEVOLVIDO'])(
      'recusa anexar quando o status é %s (apenas AGUARDANDO_TERMO)',
      async (status) => {
        prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase({ status }));
        const e = await erro(
          service.anexarTermoAssinado(ESTOQUE_ID, EMP_ID, pdfValido(), GESTOR_ID),
        );
        expect(nomeClasse(e)).toBe('ResourceConflictException');
        expect(e.message).toContain(status);
        expect(termoStorage.write).not.toHaveBeenCalled();
      },
    );

    // Técnica: critério (ordem das validações) | Requisito: CA8
    it('verifica o status antes de validar o arquivo', async () => {
      prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase({ status: 'ATIVO' }));
      const e = await erro(
        service.anexarTermoAssinado(ESTOQUE_ID, EMP_ID, undefined, GESTOR_ID),
      );
      expect(nomeClasse(e)).toBe('ResourceConflictException');
    });

    describe('validação do arquivo', () => {
      const esperaInvalido = async (arquivo: any, trecho: RegExp) => {
        const e = await erro(service.anexarTermoAssinado(ESTOQUE_ID, EMP_ID, arquivo, GESTOR_ID));
        expect(nomeClasse(e)).toBe('AppException');
        expect(e.message).toMatch(trecho);
        if (typeof e.getStatus === 'function') expect(e.getStatus()).toBe(400);
        expect(termoStorage.write).not.toHaveBeenCalled();
        expect(prisma.termo.update).not.toHaveBeenCalled();
      };

      // Técnica: partição inválida (ausente) | Requisito: CA6, CA8
      it('rejeita requisição sem arquivo', async () => {
        await esperaInvalido(undefined, /Envie o PDF assinado/);
      });

      // Técnica: valor-limite (0 bytes) | Requisito: CA6, CA8
      it('rejeita arquivo com buffer vazio (0 bytes)', async () => {
        await esperaInvalido(pdfValido({ buffer: Buffer.alloc(0), size: 0 }), /Envie o PDF assinado/);
      });

      // Técnica: valor-limite (limite + 1) | Requisito: CA6, CA8
      it('rejeita arquivo com 5 MB + 1 byte', async () => {
        await esperaInvalido(
          pdfValido({ size: TERMO_ASSINADO_MAX_BYTES + 1 }),
          /excede o limite de 5 MB/,
        );
      });

      // Técnica: valor-limite (exatamente no limite) | Requisito: CA6
      it('aceita arquivo com exatamente 5 MB', async () => {
        prisma.emprestimo.findUniqueOrThrow.mockResolvedValue({ termo: null });
        await expect(
          service.anexarTermoAssinado(
            ESTOQUE_ID,
            EMP_ID,
            pdfValido({ size: TERMO_ASSINADO_MAX_BYTES }),
            GESTOR_ID,
          ),
        ).resolves.toBeDefined();
      });

      // Técnica: valor-limite (limite - 1) | Requisito: CA6
      it('aceita arquivo com 5 MB - 1 byte', async () => {
        prisma.emprestimo.findUniqueOrThrow.mockResolvedValue({ termo: null });
        await expect(
          service.anexarTermoAssinado(
            ESTOQUE_ID,
            EMP_ID,
            pdfValido({ size: TERMO_ASSINADO_MAX_BYTES - 1 }),
            GESTOR_ID,
          ),
        ).resolves.toBeDefined();
      });

      // Técnica: partição inválida (MIME) | Requisito: CA6, CA8
      it.each(['image/png', 'text/plain', 'application/octet-stream', ''])(
        'rejeita mimetype "%s" mesmo com conteúdo iniciado por %PDF-',
        async (mimetype) => {
          await esperaInvalido(pdfValido({ mimetype }), /apenas PDF é aceito/);
        },
      );

      // Técnica: partição inválida (assinatura mágica) | Requisito: CA6, CA8
      it('rejeita mimetype application/pdf com conteúdo que não é PDF', async () => {
        const buffer = Buffer.from('MZ-executavel-disfarcado');
        await esperaInvalido(pdfValido({ buffer, size: buffer.length }), /apenas PDF é aceito/);
      });

      // Técnica: valor-limite (assinatura quase correta) | Requisito: CA6, CA8
      it('rejeita assinatura "%PDX-" (um byte diferente)', async () => {
        const buffer = Buffer.from('%PDX-1.4');
        await esperaInvalido(pdfValido({ buffer, size: buffer.length }), /apenas PDF é aceito/);
      });

      // Técnica: valor-limite (4 bytes, menor que a assinatura) | Requisito: CA6, CA8
      it('rejeita buffer de 4 bytes "%PDF" (sem o hífen)', async () => {
        const buffer = Buffer.from('%PDF');
        await esperaInvalido(pdfValido({ buffer, size: 4 }), /apenas PDF é aceito/);
      });

      // Técnica: valor-limite (exatamente 5 bytes) | Requisito: CA6
      it('aceita buffer de exatamente 5 bytes "%PDF-"', async () => {
        prisma.emprestimo.findUniqueOrThrow.mockResolvedValue({ termo: null });
        const buffer = Buffer.from('%PDF-');
        await expect(
          service.anexarTermoAssinado(
            ESTOQUE_ID,
            EMP_ID,
            pdfValido({ buffer, size: 5 }),
            GESTOR_ID,
          ),
        ).resolves.toBeDefined();
      });
    });
  });

  /* -------------------------- confirmarEntrega -------------------------- */

  describe('confirmarEntrega (confirmação da entrega)', () => {
    const comAssinado = (arquivoAssinado: string | null = '2026/assinados/x.pdf') =>
      prisma.emprestimo.findFirst.mockResolvedValue(
        emprestimoBase({ termo: termoBase({ arquivoAssinado }) }),
      );

    // Técnica: partição válida | Requisito: CA7, CA8
    it('confirma a entrega: empréstimo vira ATIVO e item vira EMPRESTADO', async () => {
      comAssinado();
      prisma.emprestimo.findUniqueOrThrow.mockResolvedValue({
        id: EMP_ID,
        status: 'ATIVO',
        termo: { id: 'termo-1', numeroAno: '03/2026', arquivoAssinado: 'x.pdf' },
      });

      const r: any = await service.confirmarEntrega(ESTOQUE_ID, EMP_ID, GESTOR_ID);

      expect(prisma.emprestimo.updateMany).toHaveBeenCalledWith({
        where: { id: EMP_ID, status: 'AGUARDANDO_TERMO' },
        data: { status: 'ATIVO' },
      });
      expect(prisma.item.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { status: 'EMPRESTADO' },
      });
      expect(r.status).toBe('ATIVO');
      expect(r.termoAssinadoAnexado).toBe(true);
    });

    // Técnica: partição inválida (sem assinado) | Requisito: CA7, CA8
    it('bloqueia a confirmação enquanto o termo assinado não foi anexado', async () => {
      comAssinado(null);
      const e = await erro(service.confirmarEntrega(ESTOQUE_ID, EMP_ID, GESTOR_ID));
      expect(nomeClasse(e)).toBe('ResourceConflictException');
      expect(e.message).toContain('Anexe o termo de responsabilidade assinado');
      expect(prisma.emprestimo.updateMany).not.toHaveBeenCalled();
      expect(prisma.item.update).not.toHaveBeenCalled();
    });

    // Técnica: valor-limite (string vazia é falsy) | Requisito: CA7
    it('trata caminho assinado vazio como não anexado', async () => {
      comAssinado('');
      const e = await erro(service.confirmarEntrega(ESTOQUE_ID, EMP_ID, GESTOR_ID));
      expect(nomeClasse(e)).toBe('ResourceConflictException');
      expect(prisma.item.update).not.toHaveBeenCalled();
    });

    // Técnica: partição inválida (sem termo) | Requisito: CA7, CA8
    it('bloqueia a confirmação quando o empréstimo não tem termo', async () => {
      prisma.emprestimo.findFirst.mockResolvedValue(emprestimoBase({ termo: null }));
      const e = await erro(service.confirmarEntrega(ESTOQUE_ID, EMP_ID, GESTOR_ID));
      expect(nomeClasse(e)).toBe('ResourceConflictException');
      expect(e.message).toContain('Anexe o termo');
    });

    // Técnica: partição inválida (status) | Requisito: CA7, CA8
    it.each(['ATIVO', 'DEVOLVIDO'])(
      'bloqueia a confirmação quando o status é %s',
      async (status) => {
        prisma.emprestimo.findFirst.mockResolvedValue(
          emprestimoBase({ status, termo: termoBase({ arquivoAssinado: 'x.pdf' }) }),
        );
        const e = await erro(service.confirmarEntrega(ESTOQUE_ID, EMP_ID, GESTOR_ID));
        expect(nomeClasse(e)).toBe('ResourceConflictException');
        expect(e.message).toContain(status);
        expect(prisma.item.update).not.toHaveBeenCalled();
      },
    );

    // Técnica: valor-limite (corrida: count = 0) | Requisito: CA8
    it('informa que a entrega já foi confirmada quando nenhuma linha é atualizada', async () => {
      comAssinado();
      prisma.emprestimo.updateMany.mockResolvedValue({ count: 0 });
      const e = await erro(service.confirmarEntrega(ESTOQUE_ID, EMP_ID, GESTOR_ID));
      expect(nomeClasse(e)).toBe('ResourceConflictException');
      expect(e.message).toContain('já foi confirmada');
      expect(prisma.item.update).not.toHaveBeenCalled();
    });

    // Técnica: partição inválida (perfil) | Requisito: CA3, CA8
    it('recusa quem não é gestor do estoque sem abrir transação', async () => {
      comoNaoGestor();
      const e = await erro(service.confirmarEntrega(ESTOQUE_ID, EMP_ID, 'admin-1'));
      expect(nomeClasse(e)).toBe('AccessDeniedException');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    // Técnica: partição inválida (sem usuário) | Requisito: CA8
    it('recusa quando userId é indefinido', async () => {
      const e = await erro(service.confirmarEntrega(ESTOQUE_ID, EMP_ID, undefined));
      expect(nomeClasse(e)).toBe('AccessDeniedException');
    });

    // Técnica: partição inválida (estoque inexistente) | Requisito: CA4, CA8
    it('estoque inexistente resulta em não encontrado', async () => {
      prisma.estoque.findUnique.mockResolvedValue(null);
      const e = await erro(service.confirmarEntrega('x', EMP_ID, GESTOR_ID));
      expect(nomeClasse(e)).toBe('ResourceNotFoundException');
    });

    // Técnica: partição inválida (empréstimo inexistente) | Requisito: CA4, CA8
    it('empréstimo inexistente resulta em não encontrado', async () => {
      prisma.emprestimo.findFirst.mockResolvedValue(null);
      const e = await erro(service.confirmarEntrega(ESTOQUE_ID, 'x', GESTOR_ID));
      expect(nomeClasse(e)).toBe('ResourceNotFoundException');
      expect(prisma.emprestimo.updateMany).not.toHaveBeenCalled();
    });
  });
});