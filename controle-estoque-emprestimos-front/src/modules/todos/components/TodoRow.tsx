import { CalendarClock, Edit2, Trash2 } from 'lucide-react';
import { TableCell, TableRow } from '@cincoders/cinnamon';
import type { Todo } from '../todo.types';
import { StatusBadge, PriorityBadge } from './TodoBadges';
import { Can } from '../../../components/auth/Can';
import { WRITE_ROLES } from '../../../utils/enums';

interface TodoRowProps {
  todo: Todo;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
}

export function TodoRow({ todo, onEdit, onDelete }: TodoRowProps) {
  return (
    <TableRow>
      <TableCell>
        <div className="font-semibold text-gray-900 dark:text-gray-100">
          {todo.title}
        </div>
        {todo.description && (
          <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
            {todo.description}
          </div>
        )}
      </TableCell>
      <TableCell>
        {todo.dueDate ? (
          <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <CalendarClock className="h-3 w-3" />
            {new Date(todo.dueDate).toLocaleDateString('pt-BR')}
          </span>
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
        )}
      </TableCell>
      <TableCell>
        <StatusBadge status={todo.status} />
      </TableCell>
      <TableCell>
        <PriorityBadge priority={todo.priority} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Can roles={WRITE_ROLES}>
            <button
              onClick={() => onEdit(todo)}
              title="Editar"
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-200 cursor-pointer"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          </Can>

          <Can roles={WRITE_ROLES}>
            <button
              onClick={() => onDelete(todo)}
              title="Excluir"
              className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </Can>
        </div>
      </TableCell>
    </TableRow>
  );
}
