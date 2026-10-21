import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { EMPRESTIMO_STATUS_LABELS } from '../emprestimo.types';
import type { EmprestimoStatus } from '../emprestimo.types';

export function StatusBadge({ status }: { status: EmprestimoStatus }) {
  switch (status) {
    case 'ATIVO':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {EMPRESTIMO_STATUS_LABELS.ATIVO}
        </span>
      );
    case 'AGUARDANDO_TERMO':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400">
          <Clock className="h-3.5 w-3.5" />
          {EMPRESTIMO_STATUS_LABELS.AGUARDANDO_TERMO}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          {EMPRESTIMO_STATUS_LABELS[status]}
        </span>
      );
  }
}

/** Tag simples de atraso (calculado pelo backend, sem estado salvo). */
export function AtrasadoTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950/50 dark:text-red-300">
      <AlertTriangle className="h-3 w-3" />
      Atrasado
    </span>
  );
}
