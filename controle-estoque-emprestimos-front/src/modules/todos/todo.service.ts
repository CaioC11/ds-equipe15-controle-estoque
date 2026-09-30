import { API_URL, fetchApi, getApiErrorMessage } from '../../services/api';
import type { CreateTodoDto, Todo, UpdateTodoDto } from './todo.types';

/** Formato de resposta paginada do backend (ver PaginatedResponseDto). */
interface PaginatedResponse<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/** Envelope aplicado a toda resposta pelo TransformInterceptor do backend. */
interface ApiEnvelope<T> {
  statusCode: number;
  timestamp: string;
  path: string;
  data: T;
}

/**
 * Comunicação HTTP com o módulo de tarefas do backend (`/tasks`).
 *
 * Padrão a seguir para os módulos do seu domínio: uma classe `<Entidade>Service`
 * com um método por operação, usando `fetchApi` (cuida de token/refresh) e
 * `getApiErrorMessage` para extrair mensagens de erro do NestJS.
 */
export class TodoService {
  /** Busca a lista completa de tarefas. */
  async getAll(): Promise<Todo[]> {
    const response = await fetchApi(`${API_URL}/tasks`);

    if (!response.ok) {
      const message = await getApiErrorMessage(response, 'Erro ao buscar tarefas');
      throw new Error(message);
    }

    const envelope = (await response.json()) as ApiEnvelope<PaginatedResponse<Todo>>;
    return envelope.data.items;
  }

  /** Cria uma nova tarefa no sistema. */
  async create(dto: CreateTodoDto): Promise<Todo> {
    const response = await fetchApi(`${API_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });

    if (!response.ok) {
      const message = await getApiErrorMessage(response, 'Erro ao criar tarefa');
      throw new Error(message);
    }

    const envelope = (await response.json()) as ApiEnvelope<Todo>;
    return envelope.data;
  }

  /** Atualiza uma tarefa existente. */
  async update(id: string, dto: UpdateTodoDto): Promise<Todo> {
    const response = await fetchApi(`${API_URL}/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });

    if (!response.ok) {
      const message = await getApiErrorMessage(response, 'Erro ao atualizar tarefa');
      throw new Error(message);
    }

    const envelope = (await response.json()) as ApiEnvelope<Todo>;
    return envelope.data;
  }

  /** Remove uma tarefa pelo ID. */
  async remove(id: string): Promise<void> {
    const response = await fetchApi(`${API_URL}/tasks/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const message = await getApiErrorMessage(response, 'Erro ao excluir tarefa');
      throw new Error(message);
    }
  }
}

/** Instância única do serviço — mesma vida útil da aplicação. */
export const todoService = new TodoService();
