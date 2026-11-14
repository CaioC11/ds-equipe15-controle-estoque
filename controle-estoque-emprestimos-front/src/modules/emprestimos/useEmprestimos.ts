import { useAsync } from '../../hooks/useAsync';
import { emprestimoService } from './emprestimo.service';
import type { CreateEmprestimoDto, Emprestimo } from './emprestimo.types';

export function useEstoques() {
  const {
    data: estoques = [],
    isLoading,
    error,
    reload,
  } = useAsync(() => emprestimoService.listarEstoques(), []);

  return { estoques, isLoading, error, reload };
}

/** Itens que o gestor pode escolher no formulário de novo empréstimo. */
export function useItensEmprestaveis(estoqueId: string | undefined) {
  const { data: itens = [] } = useAsync(
    () => (estoqueId ? emprestimoService.listarItensEmprestaveis(estoqueId) : Promise.resolve([])),
    [estoqueId],
  );

  return { itens };
}

/**
 * Empréstimos pendentes do estoque escolhido + as duas mutações da tela.
 * Sem estoque escolhido, não busca nada.
 */
export function useEmprestimos(estoqueId: string | undefined) {
  const {
    data: emprestimos = [],
    isLoading,
    error,
    reload,
  } = useAsync(
    () => (estoqueId ? emprestimoService.listarPendentes(estoqueId) : Promise.resolve([])),
    [estoqueId],
  );

  const registrar = async (dto: CreateEmprestimoDto) => {
    if (!estoqueId) return;
    await emprestimoService.registrar(estoqueId, dto);
    reload();
  };

  const devolver = async (emprestimo: Emprestimo) => {
    if (!estoqueId) return;
    await emprestimoService.devolver(estoqueId, emprestimo.id);
    reload();
  };

  return { emprestimos, isLoading, error, reload, registrar, devolver };
}

/** Não reutiliza os dados do estoque anterior durante troca ou erro de autorização. */
export function useResponsaveis(estoqueId: string | undefined) {
  const state = useAsync(
    async () => ({
      estoqueId,
      items: estoqueId ? await emprestimoService.listarResponsaveis(estoqueId) : [],
    }),
    [estoqueId],
  );
  return {
    responsaveis:
      state.data && state.data.estoqueId === estoqueId && !state.error ? state.data.items : [],
    isLoading: state.isLoading,
    error: state.error,
    reload: state.reload,
  };
}
