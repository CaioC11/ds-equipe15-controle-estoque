import { API_URL, fetchApi, getApiErrorMessage } from '../../services/api';
import type { StatusItem, TipoItem } from './estoque.types';

interface ApiEnvelope<T> {
  data: T;
}

interface PaginatedResponse<T> {
  items: T[];
}

export interface ItemListado {
  id: string;
  nome: string;
  tipo: TipoItem;
  tombamento: string | null;
  tombamentoPendente?: boolean;
  numeroSerie: string | null;
  nivelMinimo: number | null;
  status: StatusItem;
  categoria?: { id: string; nome: string };
}

export interface CreateItemDto {
  tipo: TipoItem;
  nome: string;
  categoriaId: string;
  tombamento?: string;
  numeroSerie?: string;
  nivelMinimo?: number;
}

export interface CompletarTombamentoDto {
  tombamento: string;
}

export interface ListarItensFiltro {
  pendente?: boolean;
}

/** Erro de API com o status HTTP, para a tela decidir onde mostrar (ex.: 409 = duplicado). */
export class ItemApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ItemApiError';
    this.status = status;
  }
}

// Limite máximo por página aceito pelo backend (PaginationQuerySchema).
const LIMITE_PAGINA = 500;

async function failFrom(response: Response, fallback: string): Promise<never> {
  const apiMessage = await getApiErrorMessage(response, fallback);
  if (response.status === 403) {
    throw new ItemApiError(
      'Apenas gestores deste estoque podem cadastrar, editar ou tombar itens.',
      403,
    );
  }
  if (response.status === 400) {
    throw new ItemApiError(`Dados inválidos: ${apiMessage}`, 400);
  }
  // 404 (estoque/categoria/item inexistente) e 409 (tombamento/série duplicado) já vêm claros do back.
  throw new ItemApiError(apiMessage, response.status);
}

export class ItemService {
  async listar(estoqueId: string, filtro?: ListarItensFiltro): Promise<ItemListado[]> {
    const params = new URLSearchParams({ limit: String(LIMITE_PAGINA) });
    if (filtro?.pendente !== undefined) {
      params.set('pendente', String(filtro.pendente));
    }

    const response = await fetchApi(
      `${API_URL}/estoques/${encodeURIComponent(estoqueId)}/itens?${params.toString()}`,
    );
    if (!response.ok) return failFrom(response, 'Erro ao buscar itens do estoque');
    const envelope = (await response.json()) as ApiEnvelope<PaginatedResponse<ItemListado>>;
    return envelope.data.items;
  }

  async criar(estoqueId: string, dto: CreateItemDto): Promise<ItemListado> {
    const response = await fetchApi(`${API_URL}/estoques/${encodeURIComponent(estoqueId)}/itens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (!response.ok) return failFrom(response, 'Erro ao cadastrar item');
    const envelope = (await response.json()) as ApiEnvelope<ItemListado>;
    return envelope.data;
  }

  async completarTombamento(
    estoqueId: string,
    itemId: string,
    dto: CompletarTombamentoDto,
  ): Promise<ItemListado> {
    const response = await fetchApi(
      `${API_URL}/estoques/${encodeURIComponent(estoqueId)}/itens/${encodeURIComponent(itemId)}/tombamento`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      },
    );
    if (!response.ok) return failFrom(response, 'Erro ao informar tombamento do item');
    const envelope = (await response.json()) as ApiEnvelope<ItemListado>;
    return envelope.data;
  }
}

export const itemService = new ItemService();