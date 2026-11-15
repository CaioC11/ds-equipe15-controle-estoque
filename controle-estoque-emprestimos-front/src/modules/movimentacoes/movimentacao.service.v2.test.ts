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
    let erro: unknown;
    try {
      await service.listarHistorico('e');
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(HttpError);
    expect(erro).toMatchObject({ status: 403, message: 'Sem acesso' });
  });
});
