export type TipoItem = 'PATRIMONIAL' | 'CONSUMO';
export type StatusItem = 'DISPONIVEL' | 'EMPRESTADO' | 'MANUTENCAO' | 'BAIXADO';

export const TIPO_ITEM_LABELS: Record<TipoItem, string> = {
  PATRIMONIAL: 'Patrimonial',
  CONSUMO: 'Consumo',
};

export const STATUS_ITEM_LABELS: Record<StatusItem, string> = {
  DISPONIVEL: 'Disponível',
  EMPRESTADO: 'Emprestado',
  MANUTENCAO: 'Manutenção',
  BAIXADO: 'Baixado',
};

/** Item de um estoque, como o backend devolve na listagem (somente leitura aqui). */
export interface ItemEstoque {
  id: string;
  nome: string;
  tipo: TipoItem;
  tombamento: string | null;
  numeroSerie: string | null;
  semTombamento: boolean;
  status: StatusItem;
}

/** Saldo calculado pelo backend a partir dos itens do estoque. */
export interface SaldoEstoque {
  totalItens: number;
  disponiveis: number;
  emprestados: number;
}

export interface Estoque {
  id: string;
  nome: string;
  descricao: string | null;
  localizacao: string | null;
  ativo: boolean;
  saldo?: SaldoEstoque;
  itens?: ItemEstoque[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateEstoqueDto {
  nome: string;
  descricao?: string;
  localizacao?: string;
}

export type UpdateEstoqueDto = Partial<CreateEstoqueDto>;
