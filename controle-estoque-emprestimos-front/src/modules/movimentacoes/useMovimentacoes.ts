import { useAsync } from '../../hooks/useAsync';
import { movimentacaoService } from './movimentacao.service';
import type {
  Movimentacao,
  RegistrarMovimentacaoDto,
  ResultadoRegistro,
  SaldoEstoque,
} from './movimentacao.types';

/**
 * Saldo e histórico do estoque escolhido + a mutação de registro.
 * Sem estoque escolhido, não busca nada. O saldo é aberto a todos; o histórico
 * responde 403 a quem não é gestor do estoque nem ADMIN (a tela trata isso).
 */
export function useMovimentacoes(estoqueId: string | undefined) {
  const saldoAsync = useAsync(
    async (): Promise<SaldoEstoque | null> =>
      estoqueId ? await movimentacaoService.listarSaldo(estoqueId) : null,
    [estoqueId],
  );

  const historicoAsync = useAsync(
    async (): Promise<Movimentacao[]> =>
      estoqueId ? await movimentacaoService.listarHistorico(estoqueId) : [],
    [estoqueId],
  );

  const reload = () => {
    saldoAsync.reload();
    historicoAsync.reload();
  };

  const registrar = async (dto: RegistrarMovimentacaoDto): Promise<ResultadoRegistro> => {
    const resultado = await movimentacaoService.registrar(dto);
    reload();
    return resultado;
  };

  return {
    itensSaldo: saldoAsync.data?.itens ?? [],
    carregandoSaldo: saldoAsync.isLoading,
    erroSaldo: saldoAsync.error,
    historico: historicoAsync.data ?? [],
    carregandoHistorico: historicoAsync.isLoading,
    erroHistorico: historicoAsync.error,
    reload,
    registrar,
  };
}