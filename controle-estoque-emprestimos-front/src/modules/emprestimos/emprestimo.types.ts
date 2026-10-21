export const EMPRESTIMO_STATUSES = ['AGUARDANDO_TERMO', 'ATIVO', 'DEVOLVIDO', 'CANCELADO'] as const;
export type EmprestimoStatus = (typeof EMPRESTIMO_STATUSES)[number];

export const EMPRESTIMO_STATUS_LABELS: Record<EmprestimoStatus, string> = {
  AGUARDANDO_TERMO: 'Aguardando termo assinado',
  ATIVO: 'Ativo',
  DEVOLVIDO: 'Devolvido',
  CANCELADO: 'Cancelado',
};

export interface Estoque {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface Item {
  id: string;
  tipo: 'PATRIMONIAL' | 'CONSUMO';
  nome: string;
  tombamento: string | null;
  numeroSerie: string | null;
  status: 'DISPONIVEL' | 'EMPRESTADO' | 'MANUTENCAO' | 'BAIXADO';
}

export interface Responsavel {
  id: string;
  nome: string;
  siape: string | null;
  cpf: string | null;
  lotacao: string;
  cargo: string;
}

export interface Emprestimo {
  id: string;
  itemId: string;
  status: EmprestimoStatus;
  dataRetirada: string;
  /** null = prazo "indefinido" */
  prazoDevolucao: string | null;
  dataDevolucaoEfetiva: string | null;
  item: Item;
  responsavel: Responsavel;
  /** Calculado pelo backend a partir do prazo (não é um status salvo). */
  atrasado: boolean;
}

/**
 * Plano B (#8): o gestor digita os dados do responsável no próprio empréstimo.
 * Quando o PO decidir a origem (Keycloak/LDAP), só este bloco muda.
 */
export interface ResponsavelInput {
  nome: string;
  siape: string;
  lotacao: string;
  cargo: string;
}

export interface CreateEmprestimoDto {
  itemId: string;
  responsavel: ResponsavelInput;
  /** ISO 8601. Omitido = prazo indefinido. */
  prazoDevolucao?: string;
}
