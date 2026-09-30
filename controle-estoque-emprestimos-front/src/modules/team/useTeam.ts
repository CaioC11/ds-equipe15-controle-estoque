import { useAsync } from '../../hooks/useAsync';
import { teamService } from './team.service';
import type { CreateMemberDto, Member, UpdateMemberDto } from './team.types';

/**
 * Estado da lista de membros + ações de mutação. Mesmo padrão do `useTodos`:
 * um hook `use<Entidade>` por tela de listagem, construído sobre `useAsync`
 * para a leitura, com um método por mutação que chama o service e recarrega.
 */
export function useTeam() {
  const { data: members = [], isLoading, error, reload } = useAsync(
    () => teamService.getAll(),
    [],
  );

  const invite = async (dto: CreateMemberDto) => {
    await teamService.create(dto);
    reload();
  };

  const update = async (id: string, dto: UpdateMemberDto) => {
    await teamService.update(id, dto);
    reload();
  };

  const remove = async (member: Member) => {
    await teamService.remove(member.id);
    reload();
  };

  return { members, isLoading, error, reload, invite, update, remove };
}
