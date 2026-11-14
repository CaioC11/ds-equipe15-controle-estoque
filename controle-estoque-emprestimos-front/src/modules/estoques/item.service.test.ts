import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', () => ({
  API_URL: 'http://api.test',
  fetchApi: vi.fn(),
  getApiErrorMessage: vi.fn(async (_response: Response, fallback: string) => fallback),
}));

import { fetchApi, getApiErrorMessage } from '../../services/api';
import { ItemApiError, itemService } from './item.service';

const fetchApiMock = vi.mocked(fetchApi);
const getApiErrorMessageMock = vi.mocked(getApiErrorMessage);

const envelope = <T>(data: T, status = 200) =>
  new Response(JSON.stringify({ statusCode: status, timestamp: '', path: '', data }), { status });

describe('itemService', () => {
  beforeEach(() => {
    fetchApiMock.mockReset();
    getApiErrorMessageMock.mockClear();
  });

  it('listar busca os itens sem filtro de pendência por padrão', async () => {
    fetchApiMock.mockResolvedValue(
      envelope({
        items: [{ id: 'i1', nome: 'Notebook', tipo: 'PATRIMONIAL', tombamento: null, tombamentoPendente: true, status: 'DISPONIVEL' }],
      }),
    );

    const itens = await itemService.listar('est-1');

    expect(itens).toHaveLength(1);
    expect(itens[0].tombamentoPendente).toBe(true);
    expect(fetchApiMock).toHaveBeenCalledWith('http://api.test/estoques/est-1/itens?limit=500');
  });

  it('listar repassa ?pendente=true e ?pendente=false quando informado', async () => {
    fetchApiMock.mockImplementation(() => Promise.resolve(envelope({ items: [] })));

    await itemService.listar('est-1', { pendente: true });
    expect(fetchApiMock).toHaveBeenLastCalledWith(
      'http://api.test/estoques/est-1/itens?limit=500&pendente=true',
    );

    await itemService.listar('est-1', { pendente: false });
    expect(fetchApiMock).toHaveBeenLastCalledWith(
      'http://api.test/estoques/est-1/itens?limit=500&pendente=false',
    );
  });

  it('criar envia item patrimonial sem tombamento quando omitido', async () => {
    fetchApiMock.mockResolvedValue(
      envelope(
        { id: 'i1', nome: 'Projetor', tipo: 'PATRIMONIAL', tombamento: null, tombamentoPendente: true, status: 'DISPONIVEL' },
        201,
      ),
    );

    const criado = await itemService.criar('est-1', {
      tipo: 'PATRIMONIAL',
      nome: 'Projetor',
      categoriaId: 'cat-1',
    });

    expect(criado.tombamentoPendente).toBe(true);
    expect(fetchApiMock).toHaveBeenCalledWith(
      'http://api.test/estoques/est-1/itens',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          tipo: 'PATRIMONIAL',
          nome: 'Projetor',
          categoriaId: 'cat-1',
        }),
      }),
    );
  });

  it('completarTombamento envia PATCH /estoques/:estoqueId/itens/:id/tombamento', async () => {
    fetchApiMock.mockResolvedValue(
      envelope({
        id: 'i1',
        nome: 'Projetor',
        tipo: 'PATRIMONIAL',
        tombamento: 'PAT-2026-099',
        tombamentoPendente: false,
        status: 'DISPONIVEL',
      }),
    );

    const atualizado = await itemService.completarTombamento('est-1', 'i1', {
      tombamento: 'PAT-2026-099',
    });

    expect(atualizado.tombamento).toBe('PAT-2026-099');
    expect(atualizado.tombamentoPendente).toBe(false);
    expect(fetchApiMock).toHaveBeenCalledWith(
      'http://api.test/estoques/est-1/itens/i1/tombamento',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ tombamento: 'PAT-2026-099' }),
      }),
    );
  });

  it('completarTombamento propaga erro 409 de tombamento duplicado', async () => {
    getApiErrorMessageMock.mockResolvedValueOnce('Já existe um item com este tombamento');
    fetchApiMock.mockResolvedValue(new Response('{}', { status: 409 }));

    await expect(
      itemService.completarTombamento('est-1', 'i1', { tombamento: 'PAT-DUP' }),
    ).rejects.toMatchObject({
      name: 'ItemApiError',
      status: 409,
      message: 'Já existe um item com este tombamento',
    });
  });

  it('falha com mensagem de permissão quando API retorna 403', async () => {
    fetchApiMock.mockResolvedValue(new Response('{}', { status: 403 }));

    const promise = itemService.completarTombamento('est-1', 'i1', { tombamento: 'PAT-1' });
    await expect(promise).rejects.toBeInstanceOf(ItemApiError);
    await expect(promise).rejects.toMatchObject({ status: 403 });
  });
});