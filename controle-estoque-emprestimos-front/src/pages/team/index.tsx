import { useState } from 'react';
import { UserPlus, RefreshCw, ShieldCheck, Info, DatabaseZap, Users } from 'lucide-react';
import {
  ErrorScreen,
  httpErrors,
  Text,
  toast,
  Frame,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableMessageRow,
  TableRow,
  TableSkeletonRows,
} from '@cincoders/cinnamon';
import type { CreateMemberDto, Member, MemberStatus } from '../../modules/team/team.types';
import { MemberModal } from '../../modules/team/components/MemberModal';
import { MemberRow } from '../../modules/team/components/MemberRow';
import { useTeam } from '../../modules/team/useTeam';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';

/**
 * Tela de **gerenciamento de equipe** — restrita ao ADMIN pela rota
 * (`permittedRoles={[Roles.ADMIN]}` em `routes.tsx`). Não há `<Can>` aqui:
 * quem não é ADMIN não chega nesta página, então todos os botões podem
 * aparecer sem checagem adicional. Compare com `pages/todos/index.tsx`, que é
 * aberta a qualquer usuário e usa `<Can>` para gatear ações individuais.
 *
 * Mesma anatomia de módulo do `todos`: página (só orquestra, em `pages/`) +
 * `useTeam` (cache do servidor, sobre `useAsync`) + `team.service` (HTTP) +
 * `MemberModal` (formulário RHF + zod) — esses últimos em `modules/team/`.
 */
export default function TeamPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<Member | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

  const { members, isLoading, error, reload, invite, update, remove } = useTeam();

  const handleSaveMember = async (dto: CreateMemberDto) => {
    try {
      if (memberToEdit) {
        await update(memberToEdit.id, { name: dto.name, role: dto.role });
        toast.success('Membro atualizado com sucesso!');
      } else {
        await invite(dto);
        toast.success('Convite enviado com sucesso!');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao salvar membro.';
      toast.error(message);
      throw err;
    }
  };

  const handleToggleStatus = async (member: Member) => {
    const nextStatus: MemberStatus = member.status === 'active' ? 'inactive' : 'active';
    try {
      await update(member.id, { status: nextStatus });
      toast.success(
        nextStatus === 'active' ? 'Membro reativado.' : 'Membro desativado.',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao alterar status.';
      toast.error(message);
    }
  };

  const handleRemoveMember = (member: Member) => {
    setMemberToRemove(member);
    setIsRemoveDialogOpen(true);
  };

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove) return;

    try {
      await remove(memberToRemove);
      toast.success('Membro removido.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao remover membro.';
      toast.error(message);
    }
  };

  const handleOpenInviteModal = () => {
    setMemberToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (member: Member) => {
    setMemberToEdit(member);
    setIsModalOpen(true);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-center dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2">
            <Text variant="title">Gerenciamento de Equipe</Text>
            <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
              <ShieldCheck className="h-3 w-3" />
              Só ADMIN
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              <DatabaseZap className="h-3 w-3" />
              Dados mockados
            </span>
          </div>
          <Text variant="description">
            Exemplo de módulo de gerenciamento com acesso restrito por rota. Aqui não há
            <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 font-mono dark:bg-gray-800">&lt;Can&gt;</code>
            porque a página inteira já exige a role ADMIN.
          </Text>
        </div>

        <button
          onClick={handleOpenInviteModal}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-xs transition hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          Convidar Membro
        </button>
      </div>

      <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <Text variant="whisper">
            A rota desta tela é montada com <code className="rounded bg-blue-100 px-1 py-0.5 font-mono dark:bg-blue-900">permittedRoles={'{[Roles.ADMIN]}'}</code> em
            <code className="mx-1 rounded bg-blue-100 px-1 py-0.5 font-mono dark:bg-blue-900">routes.tsx</code>,
            e o link aparece em <code className="rounded bg-blue-100 px-1 py-0.5 font-mono dark:bg-blue-900">ADMIN_ONLY_LINKS</code> para sumir do menu de quem não é ADMIN.
          </Text>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
        <div className="flex items-start gap-3">
          <DatabaseZap className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <Text variant="whisper">
            Os membros listados abaixo são <strong>dados mockados</strong>, mantidos em memória por
            <code className="mx-1 rounded bg-amber-100 px-1 py-0.5 font-mono dark:bg-amber-900">team.service.ts</code>
            só para exemplificar a tela quando o backend real de membros ainda não existe. Convidar, editar ou
            remover aqui não persiste em lugar nenhum.
          </Text>
        </div>
      </div>

      <div className="mb-4 flex justify-end">
        <button
          onClick={reload}
          title="Recarregar"
          disabled={isLoading}
          className="rounded-lg border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <Frame className="w-full">
        <Table variant="card">
          <TableHeader>
            <TableRow>
              <TableHead>Membro</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows columns={4} />
            ) : error ? (
              <TableMessageRow colSpan={4}>
                <div className="flex flex-col items-center py-4">
                  <ErrorScreen errorType={httpErrors.INACTIVE_503} />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{error.message}</p>
                  <button
                    onClick={reload}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 cursor-pointer"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Tentar novamente
                  </button>
                </div>
              </TableMessageRow>
            ) : members.length === 0 ? (
              <TableMessageRow colSpan={4}>
                <EmptyState
                  icon={Users}
                  title="Nenhum membro encontrado"
                  description="Convide o primeiro membro da equipe."
                />
              </TableMessageRow>
            ) : (
              members.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  onToggleStatus={handleToggleStatus}
                  onEdit={handleOpenEditModal}
                  onRemove={handleRemoveMember}
                />
              ))
            )}
          </TableBody>
        </Table>
      </Frame>

      <MemberModal
        key={memberToEdit?.id ?? 'new'}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSaveMember}
        memberToEdit={memberToEdit}
      />

      <ConfirmDialog
        open={isRemoveDialogOpen}
        onOpenChange={setIsRemoveDialogOpen}
        onConfirm={handleConfirmRemoveMember}
        title="Remover membro"
        description={`Remover "${memberToRemove?.name}" da equipe?`}
        confirmLabel="Remover"
      />
    </div>
  );
}
