import { useAsync } from '../../hooks/useAsync';
import { todoService } from './todo.service';
import type { CreateTodoDto, Todo, UpdateTodoDto } from './todo.types';

/**
 * Estado da listagem de tarefas + ações de mutação, prontos para a página
 * consumir sem lidar com useState/useEffect diretamente.
 *
 * Padrão a seguir para os módulos do seu domínio: um hook `use<Entidade>`
 * por tela de listagem, construído em cima de `useAsync` para a leitura, com
 * um método por mutação que chama o service e recarrega a lista ao terminar.
 */
export function useTodos() {
  const { data: todos = [], isLoading, error, reload } = useAsync(() => todoService.getAll(), []);

  const create = async (dto: CreateTodoDto) => {
    await todoService.create(dto);
    reload();
  };

  const update = async (id: string, dto: UpdateTodoDto) => {
    await todoService.update(id, dto);
    reload();
  };

  const remove = async (todo: Todo) => {
    await todoService.remove(todo.id);
    reload();
  };

  return { todos, isLoading, error, reload, create, update, remove };
}
