import { useAsync } from '../../hooks/useAsync';
import { estoqueService } from './estoque.service';
import type { CreateEstoqueDto, Estoque, UpdateEstoqueDto } from './estoque.types';

/**
 * Estado da listagem de estoques + ações de mutação (mesmo padrão do `useTodos`).
 */
export function useEstoques() {
  const {
    data: estoques = [],
    isLoading,
    error,
    reload,
  } = useAsync(() => estoqueService.getAll(), []);

  const create = async (dto: CreateEstoqueDto) => {
    await estoqueService.create(dto);
    reload();
  };

  const update = async (id: string, dto: UpdateEstoqueDto) => {
    await estoqueService.update(id, dto);
    reload();
  };

  /** Desativa o estoque (o backend não apaga o registro). */
  const deactivate = async (estoque: Estoque) => {
    await estoqueService.remove(estoque.id);
    reload();
  };

  return { estoques, isLoading, error, reload, create, update, deactivate };
}
