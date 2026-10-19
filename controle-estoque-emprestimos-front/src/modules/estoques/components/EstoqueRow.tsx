import { useState } from 'react';
import { ChevronDown, ChevronRight, Edit2, PowerOff } from 'lucide-react';
import { TableCell, TableRow } from '@cincoders/cinnamon';
import { Can } from '../../../components/auth/Can';
import { WRITE_ROLES } from '../../../utils/enums';
import { STATUS_ITEM_LABELS, TIPO_ITEM_LABELS } from '../estoque.types';
import type { Estoque, ItemEstoque } from '../estoque.types';

/** Número de colunas da tabela de estoques (usado nos estados de loading/erro/vazio). */
export const ESTOQUE_TABLE_COLUMNS = 6;

interface EstoqueRowProps {
  estoque: Estoque;
  onEdit: (estoque: Estoque) => void;
  onDeactivate: (estoque: Estoque) => void;
}

function identificacao(item: ItemEstoque): string {
  if (item.tombamento) return `Tombamento ${item.tombamento}`;
  if (item.numeroSerie) return `Nº de série ${item.numeroSerie}`;
  if (item.semTombamento) return 'Sem tombamento';
  return '—';
}

export function EstoqueRow({ estoque, onEdit, onDeactivate }: EstoqueRowProps) {
  const [expanded, setExpanded] = useState(false);
  const itens = estoque.itens ?? [];
  const saldo = estoque.saldo ?? { totalItens: itens.length, disponiveis: 0, emprestados: 0 };

  return (
    <>
      <TableRow>
        <TableCell>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            title={expanded ? 'Ocultar itens' : 'Ver itens'}
            className="flex cursor-pointer items-start gap-2 text-left"
          >
            {expanded ? (
              <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
            ) : (
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
            )}
            <span className="block">
              <span className="block font-semibold text-gray-900 dark:text-gray-100">
                {estoque.nome}
              </span>
              {estoque.descricao && (
                <span className="mt-0.5 line-clamp-1 block text-xs text-gray-500 dark:text-gray-400">
                  {estoque.descricao}
                </span>
              )}
            </span>
          </button>
        </TableCell>
        <TableCell>
          {estoque.localizacao ? (
            <span className="text-sm text-gray-700 dark:text-gray-300">{estoque.localizacao}</span>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
          )}
        </TableCell>
        <TableCell>{saldo.totalItens}</TableCell>
        <TableCell>{saldo.disponiveis}</TableCell>
        <TableCell>{saldo.emprestados}</TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            <Can roles={WRITE_ROLES}>
              <button
                onClick={() => onEdit(estoque)}
                title="Editar"
                className="cursor-pointer rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            </Can>
            <Can roles={WRITE_ROLES}>
              <button
                onClick={() => onDeactivate(estoque)}
                title="Desativar"
                className="cursor-pointer rounded-lg p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
              >
                <PowerOff className="h-4 w-4" />
              </button>
            </Can>
          </div>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell colSpan={ESTOQUE_TABLE_COLUMNS}>
            {itens.length === 0 ? (
              <p className="py-2 text-sm text-gray-500 dark:text-gray-400">
                Nenhum item cadastrado neste estoque.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {itens.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{item.nome}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {TIPO_ITEM_LABELS[item.tipo]}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {identificacao(item)}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {STATUS_ITEM_LABELS[item.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
