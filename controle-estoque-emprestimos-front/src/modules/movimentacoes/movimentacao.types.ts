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
  dataMovimentacao: string;
  itemId: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  observacao: string | null;
  usuarioId: string;
   /** Presentes nas duas movimentações geradas por uma transferência entre estoques */
  transferenciaId?: string | null;
  estoqueOrigemId?: string | null;
  estoqueDestinoId?: string | null;
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

export interface TransferirItemDto {
  itemId: string;
  estoqueOrigemId: string;
  estoqueDestinoId: string;
  /** Obrigatória para item de consumo; ignorada em patrimonial (sempre 1 unidade) */
  quantidade?: number;
  observacao?: string;
}

export interface ResultadoTransferencia {
  transferenciaId: string;
  movimentacaoSaida: Omit<Movimentacao, 'item'>;
  movimentacaoEntrada: Omit<Movimentacao, 'item'>;
}