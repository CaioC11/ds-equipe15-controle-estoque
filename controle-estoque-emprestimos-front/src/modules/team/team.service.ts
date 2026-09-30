import { API_URL, fetchApi } from '../../services/api';
import type { CreateMemberDto, Member, UpdateMemberDto } from './team.types';

/** Formato de resposta paginada do backend (ver PaginatedResponseDto). */
interface PaginatedResponse<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/**
 * Módulo de membros — ainda sem backend real (ver aviso "Dados mockados" na
 * tela). Só `getAll` tenta o endpoint HTTP, com fallback pro mock caso o
 * backend não responda; `create`/`update`/`remove` operam direto sobre o
 * mock em memória, sem tentativa de rede, para nunca surgir erro ao
 * convidar, editar, desativar ou remover um membro nesta demo.
 *
 * Este é um módulo de **gerenciamento**: as telas que o consomem são restritas
 * ao ADMIN pela rota (`permittedRoles={[Roles.ADMIN]}` em `routes.tsx`). O
 * gate de rota é só UX — o backend continua sendo a autoridade final quando
 * a integração real existir.
 */
export class TeamService {
  private mockMembers: Member[] = [
    {
      id: '1',
      name: 'Ana Souza',
      email: 'ana.souza@cin.ufpe.br',
      role: 'admin',
      status: 'active',
      createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    },
    {
      id: '2',
      name: 'Bruno Lima',
      email: 'bruno.lima@cin.ufpe.br',
      role: 'editor',
      status: 'active',
      createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    },
    {
      id: '3',
      name: 'Carla Nunes',
      email: 'carla.nunes@cin.ufpe.br',
      role: 'viewer',
      status: 'inactive',
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ];

  /** Lista todos os membros. */
  async getAll(): Promise<Member[]> {
    try {
      const response = await fetchApi(`${API_URL}/members`);
      if (response.ok) {
        const data = (await response.json()) as PaginatedResponse<Member>;
        return data.items;
      }
    } catch {
      console.info('[TeamService] Backend não disponível, utilizando mock de desenvolvimento.');
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
    return [...this.mockMembers];
  }

  /** Convida um novo membro. Só mock, sem rede — ver classe. */
  async create(dto: CreateMemberDto): Promise<Member> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const newMember: Member = {
      id: Math.random().toString(36).substring(2, 9),
      status: 'active',
      ...dto,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.mockMembers = [newMember, ...this.mockMembers];
    return newMember;
  }

  /** Atualiza papel ou status de um membro. Só mock, sem rede — ver classe. */
  async update(id: string, dto: UpdateMemberDto): Promise<Member> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const index = this.mockMembers.findIndex((member) => member.id === id);
    if (index === -1) {
      throw new Error('Membro não encontrado');
    }

    const updatedMember: Member = {
      ...this.mockMembers[index],
      ...dto,
      updatedAt: new Date().toISOString(),
    };
    this.mockMembers[index] = updatedMember;
    return updatedMember;
  }

  /** Remove um membro pelo ID. Só mock, sem rede — ver classe. */
  async remove(id: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    this.mockMembers = this.mockMembers.filter((member) => member.id !== id);
  }
}

/** Instância única do serviço — mesma vida útil da aplicação. */
export const teamService = new TeamService();
