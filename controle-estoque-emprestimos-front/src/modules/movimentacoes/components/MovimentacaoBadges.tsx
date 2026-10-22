import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { TIPO_MOVIMENTACAO_LABELS, TIPOS_QUE_SOMAM } from '../movimentacao.types';
import type { TipoMovimentacao } from '../movimentacao.types';

/** Badge de alerta do saldo (issue #17 usa a mesma flag `abaixoDoMinimo`). */
export function SaldoBadge({ abaixoDoMinimo }: { abaixoDoMinimo: boolean }) {
  if (abaixoDoMinimo) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800 dark:bg-red-950/50 dark:text-red-300">
        <AlertTriangle className="h-3.5 w-3.5" />
        Abaixo do mínimo
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Normal
    </span>
  );
}

export function TipoBadge({ tipo }: { tipo: TipoMovimentacao }) {
  const soma = TIPOS_QUE_SOMAM.includes(tipo);
  const cor = soma
    ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400'
    : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cor}`}>
      {TIPO_MOVIMENTACAO_LABELS[tipo]}
    </span>
  );
}