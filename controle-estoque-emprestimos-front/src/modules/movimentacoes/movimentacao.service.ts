import { request } from '../../services/api';
import type {
  Movimentacao,
  RegistrarMovimentacaoDto,
  ResultadoRegistro,
  SaldoEstoque,
} from './movimentacao.types';

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