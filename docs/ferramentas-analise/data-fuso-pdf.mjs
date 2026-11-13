// ACH-09: reproduz os dois formatadores de data de termo-pdf.service.ts (L28-32 e L106-107).
// Uso: TZ=UTC node data-fuso-pdf.mjs | TZ=America/Recife node data-fuso-pdf.mjs
// Entradas: o que o front realmente envia. emprestimo.utils.ts fimDoDiaISO("2026-11-20") =
// new Date("2026-11-20T23:59:59").toISOString() no navegador do gestor (Recife, UTC-3).

const formatarData = (val) => {
  if (!val || val === 'null') return 'INDEFINIDO';
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? 'INDEFINIDO' : d.toLocaleDateString('pt-BR');
};
const date = (value) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(value);

const prazoDoFront = new Date('2026-11-20T23:59:59-03:00');
const prazoDataPura = new Date('2026-11-20');
const retiradaNoite = new Date('2026-11-13T22:00:00-03:00');

console.log(`TZ=${process.env.TZ ?? '(padrão)'}`);
console.log(`  prevista (front, 20/11 23:59 local)  -> ${formatarData(prazoDoFront)}`);
console.log(`  prevista (API, "2026-11-20")         -> ${formatarData(prazoDataPura)}`);
console.log(`  abertura (13/11 22:00 local, em UTC) -> ${date(retiradaNoite)}`);
