import type { MemberRole, MemberStatus } from '../team.types';

export function RoleBadge({ role }: { role: MemberRole }) {
  switch (role) {
    case 'admin':
      return (
        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-950/50 dark:text-purple-300">
          Administrador
        </span>
      );
    case 'editor':
      return (
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
          Editor
        </span>
      );
    case 'viewer':
    default:
      return (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          Leitor
        </span>
      );
  }
}

export function StatusBadge({ status }: { status: MemberStatus }) {
  return status === 'active' ? (
    <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400">
      Ativo
    </span>
  ) : (
    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
      Inativo
    </span>
  );
}
