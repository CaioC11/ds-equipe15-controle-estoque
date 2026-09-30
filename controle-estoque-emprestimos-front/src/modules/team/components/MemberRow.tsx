import { Edit2, Trash2 } from 'lucide-react';
import { TableCell, TableRow } from '@cincoders/cinnamon';
import type { Member } from '../team.types';
import { RoleBadge, StatusBadge } from './TeamBadges';

interface MemberRowProps {
  member: Member;
  onToggleStatus: (member: Member) => void;
  onEdit: (member: Member) => void;
  onRemove: (member: Member) => void;
}

export function MemberRow({ member, onToggleStatus, onEdit, onRemove }: MemberRowProps) {
  return (
    <TableRow>
      <TableCell>
        <div className="font-semibold text-gray-900 dark:text-gray-100">{member.name}</div>
        <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{member.email}</div>
      </TableCell>
      <TableCell>
        <RoleBadge role={member.role} />
      </TableCell>
      <TableCell>
        <StatusBadge status={member.status} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onToggleStatus(member)}
            className="rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer"
          >
            {member.status === 'active' ? 'Desativar' : 'Reativar'}
          </button>
          <button
            onClick={() => onEdit(member)}
            title="Editar"
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-200 cursor-pointer"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onRemove(member)}
            title="Remover"
            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </TableCell>
    </TableRow>
  );
}
