import { fetchApi, API_URL, getApiErrorMessage } from './api';

export interface Categoria {
  id: string;
  nome: string;
  descricao?: string;
}

export interface CreateCategoriaInput {
  nome: string;
  descricao?: string;
}

export const categoriasService = {
  async listar(): Promise<Categoria[]> {
    const response = await fetchApi(`${API_URL}/categorias`);
    if (!response.ok) {
      const errorMsg = await getApiErrorMessage(response, 'Erro ao listar categorias');
      throw new Error(errorMsg);
    }
    return response.json();
  },

  async criar(data: CreateCategoriaInput): Promise<Categoria> {
    const response = await fetchApi(`${API_URL}/categorias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorMsg = await getApiErrorMessage(response, 'Erro ao criar categoria');
      const error: any = new Error(errorMsg);
      error.status = response.status;
      throw error;
    }

    return response.json();
  },

  async atualizar(id: string, data: CreateCategoriaInput): Promise<Categoria> {
    const response = await fetchApi(`${API_URL}/categorias/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorMsg = await getApiErrorMessage(response, 'Erro ao atualizar categoria');
      const error: any = new Error(errorMsg);
      error.status = response.status;
      throw error;
    }

    return response.json();
  },
};