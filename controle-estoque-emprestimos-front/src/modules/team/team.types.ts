import { z } from 'zod';

/**
 * Papel de um membro dentro do sistema. Espelha as roles do realm do Keycloak
 * (ver `src/utils/enums.ts`), mas aqui é só o valor de negócio — a role real é
 * atribuída no Keycloak pelo backend.
 */
export type MemberRole = 'admin' | 'editor' | 'viewer';
export type MemberStatus = 'active' | 'inactive';

export interface Member {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Schema do formulário de convite/edição de membro (react-hook-form + zod).
 * Mantenha em sincronia com o DTO correspondente do backend.
 */
export const memberFormSchema = z.object({
  name: z.string().trim().min(1, 'O nome é obrigatório.'),
  email: z.string().trim().email('Informe um e-mail válido.'),
  role: z.enum(['admin', 'editor', 'viewer']),
});

export type MemberFormValues = z.infer<typeof memberFormSchema>;

export interface CreateMemberDto {
  name: string;
  email: string;
  role: MemberRole;
}

export type UpdateMemberDto = Partial<Omit<CreateMemberDto, 'email'>> & {
  status?: MemberStatus;
};
