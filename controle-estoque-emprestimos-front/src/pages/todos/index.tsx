import { useMemo, useState } from 'react';
import { Plus, Search, RefreshCw, FolderOpen } from 'lucide-react';
import {
  ErrorScreen,
  httpErrors,
  buildSupportMailto,
  Frame,
  SimpleSelect,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableMessageRow,
  TableRow,
  TableSkeletonRows,
  toast,
} from '@cincoders/cinnamon';
import { TODO_STATUS_LABELS, TODO_STATUSES } from '../../modules/todos/todo.types';
import type { CreateTodoDto, Todo } from '../../modules/todos/todo.types';
import { TodoModal } from '../../modules/todos/components/TodoModal';
import { TodoRow } from '../../modules/todos/components/TodoRow';
import { useTodos } from '../../modules/todos/useTodos';
import { Can } from '../../components/auth/Can';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { WRITE_ROLES } from '../../utils/enums';

const SUPPORT_EMAIL = 'helpdesk@cin.ufpe.br';

export default function TodosPage() {
  // 1. Estados de UI (não são dados do servidor — esses ficam no hook useTodos)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [todoToEdit, setTodoToEdit] = useState<Todo | null>(null);
  // Muda a cada abertura para criação, forçando o TodoModal a remontar
  // (via key) e resetar seu estado mesmo quando todoToEdit já era null.
  const [newTodoKey, setNewTodoKey] = useState(0);
  const [todoToDelete, setTodoToDelete] = useState<Todo | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // 2. Dados do servidor e mutações — nenhum useState/useEffect aqui, ver useTodos.
  const { todos, isLoading, error, reload, create, update, remove } = useTodos();

  const handleSaveTodo = async (dto: CreateTodoDto) => {
    try {
      if (todoToEdit) {
        await update(todoToEdit.id, dto);
        toast.success('Tarefa atualizada com sucesso!');
      } else {
        await create(dto);
        toast.success('Nova tarefa criada com sucesso!');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao salvar tarefa.';
      toast.error(message);
      throw err; // Repassa para o modal não fechar em caso de erro
    }
  };

  const handleDeleteTodo = (todo: Todo) => {
    setTodoToDelete(todo);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDeleteTodo = async () => {
    if (!todoToDelete) return;

    try {
      await remove(todoToDelete);
      toast.success('Tarefa removida com sucesso!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao remover tarefa.';
      toast.error(message);
    }
  };

  const handleOpenCreateModal = () => {
    setTodoToEdit(null);
    setNewTodoKey((key) => key + 1);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (todo: Todo) => {
    setTodoToEdit(todo);
    setIsModalOpen(true);
  };

  /**
   * Filtragem de tarefas no frontend
   */
  const filteredTodos = useMemo(() => {
    return todos.filter((todo) => {
      const matchesSearch =
        todo.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (todo.description ?? '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || todo.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [todos, searchTerm, statusFilter]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* 1. Header explicativo com ações */}
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-center dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-3xl">
              Módulo de Exemplo (Tarefas)
            </h1>
            <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-400">
              Gabarito
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Esta página exemplifica o padrão de listagem via hook + service, formulário modal, e controle de acesso (RBAC).
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* O componente <Can /> condiciona a renderização conforme as roles do usuário */}
          <Can roles={WRITE_ROLES}>
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-xs transition hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Nova Tarefa
            </button>
          </Can>
        </div>
      </div>

      {/* 2. Barra de busca e filtros */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por título ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Status:</label>
          <SimpleSelect
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value ?? 'all')}
            items={[
              { value: 'all', label: 'Todos' },
              ...TODO_STATUSES.map((status) => ({
                value: status,
                label: TODO_STATUS_LABELS[status],
              })),
            ]}
          />

          <button
            onClick={reload}
            title="Recarregar dados"
            disabled={isLoading}
            className="rounded-lg border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 3. Tabela sempre montada; loading/erro/vazio viram linhas dentro do TableBody,
          usando os drop-ins da cinnamon (TableSkeletonRows / TableMessageRow). */}
      <Frame className="w-full">
        <Table variant="card" exportEnabled={!isLoading && !error && filteredTodos.length > 0}>
          <TableHeader>
            <TableRow>
              <TableHead>Tarefa & Descrição</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows columns={5} />
            ) : error ? (
              <TableMessageRow colSpan={5}>
                {/* Componente de erro pronto da cinnamon v2: ilustração + mensagem
                    padronizadas. Sem detalhes técnicos na tela — eles vão só no
                    e-mail de suporte, como no ErrorBoundary da cinnamon. */}
                <div className="flex flex-col items-center py-4">
                  <ErrorScreen errorType={httpErrors.SERVER_ERROR} />
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={reload}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 cursor-pointer"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Tentar novamente
                    </button>
                    <a
                      href={buildSupportMailto(error, SUPPORT_EMAIL, 'projeto-base')}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Contatar suporte
                    </a>
                  </div>
                </div>
              </TableMessageRow>
            ) : filteredTodos.length === 0 ? (
              <TableMessageRow colSpan={5}>
                <EmptyState
                  icon={FolderOpen}
                  title="Nenhuma tarefa encontrada"
                  description={
                    searchTerm || statusFilter !== 'all'
                      ? 'Tente alterar os termos da busca ou limpar os filtros.'
                      : 'Comece criando a sua primeira tarefa de exemplo.'
                  }
                  action={
                    <Can roles={WRITE_ROLES}>
                      <button
                        onClick={handleOpenCreateModal}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                        Nova Tarefa
                      </button>
                    </Can>
                  }
                />
              </TableMessageRow>
            ) : (
              filteredTodos.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  onEdit={handleOpenEditModal}
                  onDelete={handleDeleteTodo}
                />
              ))
            )}
          </TableBody>
        </Table>
      </Frame>

      {/* 4. Modal de Criação/Edição.
          A `key` força remontar o formulário ao trocar de tarefa (ou abrir
          para criar), o que reseta seu estado interno sem precisar de
          useEffect — ver TodoModal. */}
      <TodoModal
        key={todoToEdit?.id ?? `new-${newTodoKey}`}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSaveTodo}
        todoToEdit={todoToEdit}
      />

      {/* 5. Confirmação de exclusão */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleConfirmDeleteTodo}
        title="Excluir tarefa"
        description={`Deseja realmente excluir "${todoToDelete?.title}"?`}
        confirmLabel="Excluir"
      />
    </div>
  );
}
