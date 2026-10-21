import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmprestimoService, HttpError } from './emprestimo.service';

const envelope = <T,>(data: T) => ({ statusCode: 200, timestamp: 'x', path: '/x', data });
const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

const fetchMock = vi.fn();
const service = new EmprestimoService();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const urlChamada = () => String(fetchMock.mock.calls[0][0]);
const initChamada = () => fetchMock.mock.calls[0][1] as RequestInit;

describe('EmprestimoService', () => {
  it('lista só estoques ativos, abrindo o envelope da API', async () => {
    fetchMock.mockResolvedValue(
      resposta(
        envelope([
          { id: 'a', nome: 'Almoxarifado', ativo: true },
          { id: 'b', nome: 'Antigo', ativo: false },
        ]),
      ),
    );

    const estoques = await service.listarEstoques();

    expect(estoques.map((estoque) => estoque.id)).toEqual(['a']);
    expect(urlChamada()).toMatch(/\/estoques$/);
  });

  it('só oferece itens patrimoniais e disponíveis para empréstimo', async () => {
    fetchMock.mockResolvedValue(
      resposta(
        envelope({
          items: [
            { id: '1', tipo: 'PATRIMONIAL', status: 'DISPONIVEL' },
            { id: '2', tipo: 'CONSUMO', status: 'DISPONIVEL' },
            { id: '3', tipo: 'PATRIMONIAL', status: 'EMPRESTADO' },
            { id: '4', tipo: 'PATRIMONIAL', status: 'MANUTENCAO' },
          ],
          meta: { page: 1, limit: 500, total: 4, totalPages: 1 },
        }),
      ),
    );

    const itens = await service.listarItensEmprestaveis('est-1');

    expect(itens.map((item) => item.id)).toEqual(['1']);
    expect(urlChamada()).toMatch(/\/estoques\/est-1\/itens\?limit=500$/);
  });

  it('lista os empréstimos pendentes do estoque', async () => {
    const emprestimo = { id: 'emp-1', status: 'ATIVO', atrasado: true };
    fetchMock.mockResolvedValue(
      resposta(envelope({ items: [emprestimo], meta: { page: 1, limit: 500, total: 1, totalPages: 1 } })),
    );

    await expect(service.listarPendentes('est-1')).resolves.toEqual([emprestimo]);
    expect(urlChamada()).toMatch(/\/estoques\/est-1\/emprestimos\?limit=500$/);
  });

  it('registra o empréstimo com POST e o corpo em JSON', async () => {
    fetchMock.mockResolvedValue(resposta(envelope({ id: 'emp-1', status: 'AGUARDANDO_TERMO' }), 201));
    const dto = {
      itemId: 'item-1',
      responsavel: { nome: 'Maria', siape: '123', lotacao: 'CIn', cargo: 'Professora' },
    };

    const emprestimo = await service.registrar('est-1', dto);

    expect(emprestimo).toMatchObject({ id: 'emp-1', status: 'AGUARDANDO_TERMO' });
    expect(urlChamada()).toMatch(/\/estoques\/est-1\/emprestimos$/);
    expect(initChamada().method).toBe('POST');
    expect(JSON.parse(initChamada().body as string)).toEqual(dto);
  });

  it('registra a devolução em POST /devolucao', async () => {
    fetchMock.mockResolvedValue(resposta(envelope({ id: 'emp-1', status: 'DEVOLVIDO' })));

    await service.devolver('est-1', 'emp-1');

    expect(urlChamada()).toMatch(/\/estoques\/est-1\/emprestimos\/emp-1\/devolucao$/);
    expect(initChamada().method).toBe('POST');
  });

  it('lança HttpError com a mensagem do backend e o status (ex.: 403 de quem não é gestor)', async () => {
    fetchMock.mockResolvedValue(
      resposta({ message: 'Apenas gestores deste estoque podem registrar ou consultar empréstimos.' }, 403),
    );

    const erro = await service.listarPendentes('est-1').catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(HttpError);
    expect((erro as HttpError).status).toBe(403);
    expect((erro as HttpError).message).toContain('Apenas gestores');
  });

  it('usa a mensagem padrão quando o erro não traz corpo', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 500 }));

    await expect(service.registrar('est-1', {} as never)).rejects.toThrow('Erro ao registrar empréstimo');
  });
});
