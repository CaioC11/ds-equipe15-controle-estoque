import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', () => ({
  API_URL: 'http://api.test',
  fetchApi: vi.fn(),
  getApiErrorMessage: vi.fn(async (_response: Response, fallback: string) => fallback),
}));

import { fetchApi } from '../../services/api';
import { EstoqueApiError, estoqueService } from './estoque.service';

const fetchApiMock = vi.mocked(fetchApi);

const envelope = <T>(data: T) =>
  new Response(JSON.stringify({ statusCode: 200, timestamp: '', path: '', data }), { status: 200 });

describe('estoqueService', () => {
  beforeEach(() => {
    fetchApiMock.mockReset();
  });

  it('getAll lê a lista dentro do envelope { data }', async () => {
    fetchApiMock.mockResolvedValue(envelope([{ id: '1', nome: 'Almoxarifado Central' }]));

    const estoques = await estoqueService.getAll();

    expect(estoques).toHaveLength(1);
    expect(estoques[0].nome).toBe('Almoxarifado Central');
    expect(fetchApiMock).toHaveBeenCalledWith('http://api.test/estoques');
  });

  it('create devolve mensagem clara quando o nome já existe (409)', async () => {
    fetchApiMock.mockResolvedValue(new Response('{}', { status: 409 }));

    const promise = estoqueService.create({ nome: 'Almoxarifado Central' });

    await expect(promise).rejects.toBeInstanceOf(EstoqueApiError);
    await expect(promise).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('Já existe um estoque com este nome'),
    });
  });

  it('update explica que só ADMIN altera estoques quando a API nega (403)', async () => {
    fetchApiMock.mockResolvedValue(new Response('{}', { status: 403 }));

    await expect(estoqueService.update('1', { nome: 'Novo nome' })).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining('administradores'),
    });
  });

  it('getAll não usa a mensagem de "apenas administradores" quando a API nega (403)', async () => {
    fetchApiMock.mockResolvedValue(new Response('{}', { status: 403 }));

    await expect(estoqueService.getAll()).rejects.toMatchObject({
      status: 403,
      message: 'Erro ao buscar estoques',
    });
  });

  it('remove chama DELETE no estoque (desativação)', async () => {
    fetchApiMock.mockResolvedValue(new Response('{}', { status: 200 }));

    await estoqueService.remove('abc');

    expect(fetchApiMock).toHaveBeenCalledWith('http://api.test/estoques/abc', { method: 'DELETE' });
  });
});
