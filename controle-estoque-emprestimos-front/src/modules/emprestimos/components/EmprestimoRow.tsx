import { FileText, Undo2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TableCell, TableRow } from '@cincoders/cinnamon';
import { Links } from '../../../utils/enums';
import type { Emprestimo } from '../emprestimo.types';
import { formatarData } from '../emprestimo.utils';
import { AtrasadoTag, StatusBadge } from './EmprestimoBadges';

interface EmprestimoRowProps {
  emprestimo: Emprestimo;
  estoqueId: string;
  onDevolver: (emprestimo: Emprestimo) => void;
}

export function EmprestimoRow({ emprestimo, estoqueId, onDevolver }: EmprestimoRowProps) {
  const { item, responsavel } = emprestimo;
  const prazo = formatarData(emprestimo.prazoDevolucao);
  const identificacao = [responsavel.siape && `Siape ${responsavel.siape}`, responsavel.lotacao]
    .filter(Boolean)
    .join(' · ');

  return (
    <TableRow>
      <TableCell>
        <div className="font-semibold text-gray-900 dark:text-gray-100">{item.nome}</div>
        {item.tombamento && (
          <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Tombamento {item.tombamento}
          </div>
        )}
      </TableCell>
      <TableCell>
        <div className="text-gray-900 dark:text-gray-100">{responsavel.nome}</div>
        <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{identificacao}</div>
      </TableCell>
      <TableCell>{formatarData(emprestimo.dataRetirada)}</TableCell>
      <TableCell>
        {prazo ?? <span className="text-xs text-gray-400 dark:text-gray-500">Indefinido</span>}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={emprestimo.status} />
          {emprestimo.atrasado && <AtrasadoTag />}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          {/* A tela do termo é a issue #14. Ela precisa registrar a rota
              /emprestimos/:id/termo (o estoque vai em ?estoque=). */}
          <Link
            to={`${Links.EMPRESTIMOS}/${emprestimo.id}/termo?estoque=${estoqueId}`}
            title="Ver termo de responsabilidade"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <FileText className="h-3.5 w-3.5" />
            Termo
          </Link>

          {/* Devolução só de empréstimo ativo */}
          {emprestimo.status === 'ATIVO' && (
            <button
              type="button"
              onClick={() => onDevolver(emprestimo)}
              title="Registrar devolução"
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 cursor-pointer"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Devolver
            </button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
