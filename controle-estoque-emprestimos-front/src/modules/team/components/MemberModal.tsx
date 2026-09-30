import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Text } from '@cincoders/cinnamon';
import type { CreateMemberDto, Member, MemberFormValues } from '../team.types';
import { memberFormSchema } from '../team.types';
import { FormModal } from '../../../components/FormModal';

interface MemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateMemberDto) => Promise<void>;
  memberToEdit?: Member | null;
}

/**
 * Formulário de convite/edição de membro. Mesmo padrão do `TodoModal`:
 * react-hook-form + zod (`memberFormSchema`), `defaultValues` a partir da prop
 * e reset via `key` (ver `pages/team/index.tsx`), sem `useEffect`.
 *
 * Ao editar, o e-mail é somente-leitura: ele identifica a conta no Keycloak.
 */
export function MemberModal({ isOpen, onClose, onSubmit, memberToEdit }: MemberModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: {
      name: memberToEdit?.name ?? '',
      email: memberToEdit?.email ?? '',
      role: memberToEdit?.role ?? 'viewer',
    },
  });

  const submit = handleSubmit(async (values) => {
    await onSubmit({
      name: values.name,
      email: values.email,
      role: values.role,
    });
    onClose();
  });

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={submit}
      title={memberToEdit ? 'Editar Membro' : 'Convidar Membro'}
      isSubmitting={isSubmitting}
      submitLabel={memberToEdit ? 'Salvar Alterações' : 'Enviar Convite'}
    >
      <div>
        <Text variant="tag">Nome *</Text>
        <input
          type="text"
          {...register('name')}
          placeholder="Ex: Maria Silva"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        {errors.name && <Text variant="alarm">{errors.name.message}</Text>}
      </div>

      <div>
        <Text variant="tag">E-mail *</Text>
        <input
          type="email"
          readOnly={!!memberToEdit}
          {...register('email')}
          placeholder="pessoa@cin.ufpe.br"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none read-only:bg-gray-100 read-only:text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:read-only:bg-gray-800/60"
        />
        {errors.email && <Text variant="alarm">{errors.email.message}</Text>}
      </div>

      <div>
        <Text variant="tag">Papel</Text>
        <select
          {...register('role')}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="viewer">Leitor</option>
          <option value="editor">Editor</option>
          <option value="admin">Administrador</option>
        </select>
      </div>
    </FormModal>
  );
}
