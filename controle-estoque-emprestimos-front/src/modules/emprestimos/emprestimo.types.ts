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
  termo: { id: string; numeroAno: string } | null;
  termoAssinadoAnexado: boolean;
}

/**
 * Cadastro no ato (A3). Alternativa: selecionar cadastro existente por responsavelId (S3-21).
 */
export interface ResponsavelInput {
  nome: string;
  siape?: string;
  cpf?: string;
  lotacao: string;
  cargo: string;
}

export interface CreateEmprestimoDto {
  itemId: string;
  responsavel?: ResponsavelInput;
  responsavelId?: string;
  /** ISO 8601. Omitido = prazo indefinido. */
  prazoDevolucao?: string;
}
