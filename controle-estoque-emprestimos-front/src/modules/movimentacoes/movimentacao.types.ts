export type TipoMovimentacao =
  | 'ENTRADA'
  | 'SAIDA'
  | 'DEVOLUCAO'
  | 'TRANSFERENCIA'
  | 'MANUTENCAO';

/** O formulário só registra entrada e saída (issue #32). */
export const TIPOS_FORMULARIO = ['ENTRADA', 'SAIDA'] as const;
export type TipoFormulario = (typeof TIPOS_FORMULARIO)[number];

export const TIPO_MOVIMENTACAO_LABELS: Record<TipoMovimentacao, string> = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saída',
  DEVOLUCAO: 'Devolução',
  TRANSFERENCIA: 'Transferência',
  MANUTENCAO: 'Manutenção',
};

/** Tipos que aumentam o saldo (os demais diminuem). Espelha o backend. */
export const TIPOS_QUE_SOMAM: TipoMovimentacao[] = ['ENTRADA', 'DEVOLUCAO'];

export interface SaldoItem {
  itemId: string;
  nomeItem: string;
  saldo: number;
  /** null = sem nível mínimo definido (nunca fica "abaixo do mínimo") */
  nivelMinimo: number | null;
  abaixoDoMinimo: boolean;
}

export interface SaldoEstoque {
  estoqueId: string;
  itens: SaldoItem[];
}

export interface Movimentacao {
  id: string;
  itemId: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  observacao: string | null;
  usuarioId: string;
  dataMovimentacao: string;
  item: { id: string; nome: string; tipo: 'PATRIMONIAL' | 'CONSUMO' };
}

export interface RegistrarMovimentacaoDto {
  itemId: string;
  tipo: TipoFormulario;
  quantidade: number;
  observacao?: string;
}

export interface ResultadoRegistro {
  movimentacao: Movimentacao;
  saldoAtual: number;
  abaixoDoMinimo: boolean;
}