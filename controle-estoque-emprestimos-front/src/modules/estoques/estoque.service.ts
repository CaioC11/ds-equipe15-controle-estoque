import { API_URL, fetchApi, getApiErrorMessage } from '../../services/api';
import type { CreateEstoqueDto, Estoque, UpdateEstoqueDto } from './estoque.types';

/** Envelope aplicado a toda resposta de sucesso pelo TransformInterceptor do backend. */
interface ApiEnvelope<T> {
  statusCode: number;
  timestamp: string;
  path: string;
  data: T;
}

/** Erro de API com o status HTTP, para a tela decidir como mostrar (ex.: 409 = nome duplicado). */
export class EstoqueApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'EstoqueApiError';
    this.status = status;
  }
}

async function failFrom(response: Response, fallback: string): Promise<never> {
  if (response.status === 409) {
    throw new EstoqueApiError('Já existe um estoque com este nome. Escolha outro nome.', 409);
  }
  if (response.status === 403) {
    throw new EstoqueApiError(
      'Apenas administradores podem criar, editar ou desativar estoques.',
      403,
    );
  }
  const message = await getApiErrorMessage(response, fallback);
  throw new EstoqueApiError(message, response.status);
}

/**
 * Comunicação HTTP com o módulo de estoques do backend (`/estoques`).
 * Listar é liberado a qualquer usuário; criar, editar e desativar exigem ADMIN.
 */
export class EstoqueService {
  /** Lista os estoques ativos, com itens e saldo. */
  async getAll(): Promise<Estoque[]> {
    const response = await fetchApi(`${API_URL}/estoques`);
    if (!response.ok) return failFrom(response, 'Erro ao buscar estoques');
    const envelope = (await response.json()) as ApiEnvelope<Estoque[]>;
    return envelope.data;
  }

  async create(dto: CreateEstoqueDto): Promise<Estoque> {
    const response = await fetchApi(`${API_URL}/estoques`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (!response.ok) return failFrom(response, 'Erro ao criar estoque');
    const envelope = (await response.json()) as ApiEnvelope<Estoque>;
    return envelope.data;
  }

  async update(id: string, dto: UpdateEstoqueDto): Promise<Estoque> {
    const response = await fetchApi(`${API_URL}/estoques/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (!response.ok) return failFrom(response, 'Erro ao atualizar estoque');
    const envelope = (await response.json()) as ApiEnvelope<Estoque>;
    return envelope.data;
  }

  /** "Remover" no backend é desativar o estoque (ele deixa de aparecer na listagem). */
  async remove(id: string): Promise<void> {
    const response = await fetchApi(`${API_URL}/estoques/${id}`, { method: 'DELETE' });
    if (!response.ok) return failFrom(response, 'Erro ao desativar estoque');
  }
}

export const estoqueService = new EstoqueService();
