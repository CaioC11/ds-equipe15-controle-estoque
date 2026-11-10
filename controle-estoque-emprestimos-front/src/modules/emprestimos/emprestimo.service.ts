import { API_URL, fetchApi, getApiErrorMessage } from '../../services/api';
import type { CreateEmprestimoDto, Emprestimo, Estoque, Item } from './emprestimo.types';

/** Envelope aplicado a toda resposta pelo TransformInterceptor do backend. */
interface ApiEnvelope<T> {
  statusCode: number;
  timestamp: string;
  path: string;
  data: T;
}

/** Formato de resposta paginada do backend (ver PaginatedResponseDto). */
interface PaginatedResponse<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/** Erro HTTP com o status, para a tela distinguir "sem permissão" de falha de servidor. */
export class HttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

// Limite máximo de itens por página aceito pelo backend (PaginationQuerySchema).
const LIMITE_PAGINA = 500;

async function request<T>(path: string, fallback: string, init?: RequestInit): Promise<T> {
  const response = await fetchApi(`${API_URL}${path}`, init);

  if (!response.ok) {
    const message = await getApiErrorMessage(response, fallback);
    throw new HttpError(message, response.status);
  }

  const envelope = (await response.json()) as ApiEnvelope<T>;
  return envelope.data;
}

/**
 * Comunicação HTTP da tela de empréstimos (backend #8).
 *
 * Estoques e itens entram aqui só como leitura, para o gestor escolher onde e o
 * quê emprestar. Se um módulo próprio de estoques/itens surgir, essas duas
 * leituras podem migrar para lá.
 */
export class EmprestimoService {
  async listarEstoques(): Promise<Estoque[]> {
    const estoques = await request<Estoque[]>('/estoques', 'Erro ao buscar estoques');
    return estoques.filter((estoque) => estoque.ativo);
  }

  /** Itens que podem ser emprestados: patrimoniais e disponíveis. Consumo não é emprestável. */
  async listarItensEmprestaveis(estoqueId: string): Promise<Item[]> {
    const pagina = await request<PaginatedResponse<Item>>(
      `/estoques/${encodeURIComponent(estoqueId)}/itens?limit=${LIMITE_PAGINA}`,
      'Erro ao buscar itens do estoque',
    );
    return pagina.items.filter((item) => item.tipo === 'PATRIMONIAL' && item.status === 'DISPONIVEL');
  }

  /** Empréstimos aguardando termo e ativos, com `atrasado` já calculado pelo backend. */
  async listarPendentes(estoqueId: string): Promise<Emprestimo[]> {
    const pagina = await request<PaginatedResponse<Emprestimo>>(
      `/estoques/${encodeURIComponent(estoqueId)}/emprestimos?limit=${LIMITE_PAGINA}`,
      'Erro ao buscar empréstimos',
    );
    return pagina.items;
  }

  async registrar(estoqueId: string, dto: CreateEmprestimoDto): Promise<Emprestimo> {
    return request<Emprestimo>(
      `/estoques/${encodeURIComponent(estoqueId)}/emprestimos`,
      'Erro ao registrar empréstimo',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      },
    );
  }

  async devolver(estoqueId: string, emprestimoId: string): Promise<Emprestimo> {
    return request<Emprestimo>(
      `/estoques/${encodeURIComponent(estoqueId)}/emprestimos/${encodeURIComponent(emprestimoId)}/devolucao`,
      'Erro ao registrar devolução',
      { method: 'POST' },
    );
  }

  private base(estoqueId: string, emprestimoId: string) {
    return `/estoques/${encodeURIComponent(estoqueId)}/emprestimos/${encodeURIComponent(emprestimoId)}`;
  }

  /** Não há GET por id no back: procura na lista de pendentes do estoque. */
  async buscarEmprestimo(estoqueId: string, emprestimoId: string): Promise<Emprestimo> {
    const lista = await this.listarPendentes(estoqueId);
    const encontrado = lista.find((e) => e.id === emprestimoId);
    if (!encontrado) throw new HttpError('Empréstimo não encontrado ou já encerrado.', 404);
    return encontrado;
  }

  private async pdfBlob(path: string, fallback: string): Promise<Blob> {
    const response = await fetchApi(`${API_URL}${path}`);
    if (!response.ok) {
      throw new HttpError(await getApiErrorMessage(response, fallback), response.status);
    }
    return response.blob();
  }

  obterTermoBlob(estoqueId: string, emprestimoId: string): Promise<Blob> {
    return this.pdfBlob(`${this.base(estoqueId, emprestimoId)}/termo`, 'Erro ao carregar o termo');
  }

  obterTermoAssinadoBlob(estoqueId: string, emprestimoId: string): Promise<Blob> {
    return this.pdfBlob(`${this.base(estoqueId, emprestimoId)}/termo/assinado`, 'Erro ao baixar o termo assinado');
  }

  async anexarTermoAssinado(estoqueId: string, emprestimoId: string, arquivo: File): Promise<Emprestimo> {
    const form = new FormData();
    form.append('arquivo', arquivo); // nome do campo exigido pelo FileInterceptor
    return request<Emprestimo>(`${this.base(estoqueId, emprestimoId)}/termo/assinado`, 'Erro ao anexar o termo assinado', {
      method: 'POST',
      body: form,
    });
  }

  async confirmarEntrega(estoqueId: string, emprestimoId: string): Promise<Emprestimo> {
    return request<Emprestimo>(`${this.base(estoqueId, emprestimoId)}/confirmar-entrega`, 'Erro ao confirmar a entrega', {
      method: 'POST',
    });
  }
}

/** Instância única do serviço — mesma vida útil da aplicação. */
export const emprestimoService = new EmprestimoService();
