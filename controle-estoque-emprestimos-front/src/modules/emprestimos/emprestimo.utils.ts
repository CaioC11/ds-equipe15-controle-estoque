const pad = (valor: number) => String(valor).padStart(2, '0');

/** Data de hoje no fuso local, no formato do `<input type="date">` (YYYY-MM-DD). */
export function hojeLocalISO(agora: Date = new Date()): string {
  return `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
}

/**
 * O prazo vale até o fim do dia escolhido, no fuso do usuário. Enviar só
 * "2030-12-31" faria o backend ler meia-noite UTC, e no Brasil isso mostraria
 * 30/12 e marcaria o empréstimo como atrasado quase um dia antes.
 */
export function fimDoDiaISO(data: string): string {
  return new Date(`${data}T23:59:59`).toISOString();
}

export function formatarData(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('pt-BR');
}
