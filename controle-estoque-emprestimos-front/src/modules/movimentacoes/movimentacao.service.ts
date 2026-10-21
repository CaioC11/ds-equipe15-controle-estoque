import { API_URL, fetchApi, getApiErrorMessage } from '../../services/api';
import { HttpError } from '../emprestimos/emprestimo.service';
import type {
  Movimentacao,
  RegistrarMovimentacaoDto,
  ResultadoRegistro,
  SaldoEstoque,
} from './movimentacao.types';

/** Envelope aplicado a toda resposta pelo TransformInterceptor do backend. */
interface ApiEnvelope<T> {
  statusCode: number;
  timestamp: string;
  path: string;
  data: T;
}

async function request<T>(path: string, fallback: string, init?: RequestInit): Promise<T> {
  const response = await fetchApi(`${API_URL}${path}`, init);

  if (!response.ok) {
    const message = await getApiErrorMessage(response, fallback);
    throw new HttpError(message, response.status);
  }

  const envelope = (await response.json()) as ApiEnvelope<T>;
  return envelope.data;
}

/** Comunicação HTTP da tela de movimentações e saldo (backend #31). */
export class MovimentacaoService {
  /** Saldo de todos os itens do estoque. Aberto a qualquer usuário autenticado. */
  async listarSaldo(estoqueId: string): Promise<SaldoEstoque> {
    return request<SaldoEstoque>(
      `/movimentacoes/saldo/estoque/${encodeURIComponent(estoqueId)}`,
      'Erro ao buscar saldo do estoque',
    );
  }

  /** Histórico, da mais recente para a mais antiga. Só gestor do estoque e ADMIN (403 nos demais). */
  async listarHistorico(estoqueId: string): Promise<Movimentacao[]> {
    return request<Movimentacao[]>(
      `/movimentacoes/historico/estoque/${encodeURIComponent(estoqueId)}`,
      'Erro ao buscar histórico de movimentações',
    );
  }

  /** Só o gestor do estoque registra (403 para ADMIN e demais). */
  async registrar(dto: RegistrarMovimentacaoDto): Promise<ResultadoRegistro> {
    return request<ResultadoRegistro>('/movimentacoes', 'Erro ao registrar movimentação', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
  }
}

export const movimentacaoService = new MovimentacaoService();