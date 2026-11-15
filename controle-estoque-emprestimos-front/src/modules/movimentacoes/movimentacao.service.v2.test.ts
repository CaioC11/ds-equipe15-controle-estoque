import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MovimentacaoService } from './movimentacao.service';
import { HttpError } from '../emprestimos/emprestimo.service';

const fetchMock = vi.fn();
const service = new MovimentacaoService();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe('DT-10 — contrato HTTP da movimentação', () => {
  it('desembrulha data do envelope ao listar saldo', async () => {
    const saldo = { estoqueId: 'e', itens: [] };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: saldo }), { status: 200 }));
    await expect(service.listarSaldo('e')).resolves.toEqual(saldo);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/movimentacoes\/saldo\/estoque\/e$/);
  });
  it('preserva status e mensagem de erro da API', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'Sem acesso' }), { status: 403 }));
    await expect(service.listarHistorico('e')).rejects.toMatchObject({ name: 'HttpError', status: 403, message: 'Sem acesso' });
    expect(HttpError).toBeDefined();
  });

  it('envia POST para /movimentacoes/transferencias e desembrulha data', async () => {
    const dto = {
      itemId: 'item-1',
      estoqueOrigemId: 'est-1',
      estoqueDestinoId: 'est-2',
      quantidade: 3,
      observacao: 'Reposição',
    };
    const resultado = {
      transferenciaId: 'transf-1',
      movimentacaoSaida: { id: 'mov-1' },
      movimentacaoEntrada: { id: 'mov-2' },
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: resultado }), { status: 201 }));

    await expect(service.transferir(dto)).resolves.toEqual(resultado);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/movimentacoes\/transferencias$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(dto);
  });
});
