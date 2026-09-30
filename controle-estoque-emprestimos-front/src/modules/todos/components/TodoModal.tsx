import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SimpleSelect, Text } from '@cincoders/cinnamon';
import {
  TODO_PRIORITIES,
  TODO_PRIORITY_LABELS,
  TODO_STATUS_LABELS,
  TODO_STATUSES,
} from '../todo.types';
import type { CreateTodoDto, Todo } from '../todo.types';
import { FormModal } from '../../../components/FormModal';

const todoFormSchema = z.object({
  title: z.string().trim().min(1, 'O título é obrigatório.'),
  description: z.string().trim(),
  status: z.enum(TODO_STATUSES),
  priority: z.enum(TODO_PRIORITIES),
  dueDate: z.string(),
});

type TodoFormValues = z.infer<typeof todoFormSchema>;

interface TodoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTodoDto) => Promise<void>;
  todoToEdit?: Todo | null;
}

/**
 * Formulário de criação/edição de tarefa.
 *
 * O estado do formulário é inicializado a partir de `todoToEdit` sem
 * `useEffect`: quem renderiza este componente usa `key={todoToEdit?.id ??
 * 'new'}` (veja `pages/todos/index.tsx`), então trocar de tarefa remonta o
 * formulário do zero — é o padrão recomendado pelo React para "resetar
 * estado quando uma prop muda" (https://react.dev/learn/you-might-not-need-an-effect).
 */
export function TodoModal({ isOpen, onClose, onSubmit, todoToEdit }: TodoModalProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TodoFormValues>({
    resolver: zodResolver(todoFormSchema),
    defaultValues: {
      title: todoToEdit?.title ?? '',
      description: todoToEdit?.description ?? '',
      status: todoToEdit?.status ?? 'PENDING',
      priority: todoToEdit?.priority ?? 'MEDIUM',
      dueDate: todoToEdit?.dueDate ?? '',
    },
  });

  const submitTodo = handleSubmit(async (values) => {
    await onSubmit({
      title: values.title,
      description: values.description || undefined,
      status: values.status,
      priority: values.priority,
      dueDate: values.dueDate || undefined,
    });
    onClose();
  });

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={submitTodo}
      title={todoToEdit ? 'Editar Tarefa' : 'Nova Tarefa'}
      titleVariant="headline"
      isSubmitting={isSubmitting}
      submitLabel={todoToEdit ? 'Salvar Alterações' : 'Criar Tarefa'}
      size="lg"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Título *
        </label>
        <input
          type="text"
          {...register('title')}
          placeholder="Ex: Atualizar documentação do projeto"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        {errors.title && <Text variant="alarm">{errors.title.message}</Text>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Descrição
        </label>
        <textarea
          rows={3}
          {...register('description')}
          placeholder="Descreva detalhes ou instruções para esta tarefa..."
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Status
          </label>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <SimpleSelect
                value={field.value}
                onValueChange={field.onChange}
                className="mt-1 w-full"
                items={TODO_STATUSES.map((status) => ({
                  value: status,
                  label: TODO_STATUS_LABELS[status],
                }))}
              />
            )}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Prioridade
          </label>
          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <SimpleSelect
                value={field.value}
                onValueChange={field.onChange}
                className="mt-1 w-full"
                items={TODO_PRIORITIES.map((priority) => ({
                  value: priority,
                  label: TODO_PRIORITY_LABELS[priority],
                }))}
              />
            )}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Vencimento
          </label>
          <input
            type="date"
            {...register('dueDate')}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
      </div>
    </FormModal>
  );
}
