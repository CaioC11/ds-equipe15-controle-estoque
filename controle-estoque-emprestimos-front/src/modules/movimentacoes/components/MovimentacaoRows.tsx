import { TableCell, TableRow } from '@cincoders/cinnamon';
import { TIPOS_QUE_SOMAM } from '../movimentacao.types';
import type { Movimentacao, SaldoItem } from '../movimentacao.types';
import { SaldoBadge, TipoBadge } from './MovimentacaoBadges';

export function SaldoRow({ item }: { item: SaldoItem }) {
  return (
    <TableRow>
      <TableCell>
        <div className="font-semibold text-gray-900 dark:text-gray-100">{item.nomeItem}</div>
      </TableCell>
      <TableCell>
        <span className="font-semibold text-gray-900 dark:text-gray-100">{item.saldo}</span>
      </TableCell>
      <TableCell>
        {item.nivelMinimo ?? <span className="text-xs text-gray-400 dark:text-gray-500">Não definido</span>}
      </TableCell>
      <TableCell>
        <SaldoBadge abaixoDoMinimo={item.abaixoDoMinimo} />
      </TableCell>
    </TableRow>
  );
}

function formatarDataHora(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? '—' : data.toLocaleString('pt-BR');
}

export function HistoricoRow({ movimentacao }: { movimentacao: Movimentacao }) {
  const soma = TIPOS_QUE_SOMAM.includes(movimentacao.tipo);

  return (
    <TableRow>
      <TableCell>{formatarDataHora(movimentacao.dataMovimentacao)}</TableCell>
      <TableCell>
        <div className="font-semibold text-gray-900 dark:text-gray-100">{movimentacao.item.nome}</div>
      </TableCell>
      <TableCell>
        <TipoBadge tipo={movimentacao.tipo} />
      </TableCell>
      <TableCell>
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          {soma ? '+' : '−'}
          {movimentacao.quantidade}
        </span>
      </TableCell>
      <TableCell>
        {movimentacao.observacao ?? <span className="text-xs text-gray-400 dark:text-gray-500">—</span>}
      </TableCell>
    </TableRow>
  );
}