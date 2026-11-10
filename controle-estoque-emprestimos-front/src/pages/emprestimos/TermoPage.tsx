import { useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Download, Upload } from 'lucide-react';
import { Links } from '../../utils/enums';
import { useTermo } from '../../modules/emprestimos/useTermo';
import type { Feedback } from '../../modules/emprestimos/useTermo';
import { StatusBadge } from '../../modules/emprestimos/components/EmprestimoBadges';

const BTN =
  'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';
const BTN_PRIMARY = `${BTN} bg-red-600 text-white hover:bg-red-700`;
const BTN_OUTLINE = `${BTN} border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800`;

function Alerta({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  const erro = feedback.tipo === 'erro';
  return (
    <p
      role={erro ? 'alert' : 'status'}
      className={`mt-3 rounded-lg px-3 py-2 text-sm ${
        erro
          ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
          : 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400'
      }`}
    >
      {feedback.texto}
    </p>
  );
}

function Passo({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-100">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs text-white">
          {numero}
        </span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export default function TermoPage() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const estoqueId = searchParams.get('estoque');
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);

  const t = useTermo(estoqueId, id);
  const { emprestimo } = t;

  if (t.isLoading) return <p className="p-6 text-sm text-gray-500">Carregando...</p>;
  if (t.error || !emprestimo) {
    return (
      <div className="p-6">
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {t.error ?? 'Empréstimo não encontrado ou já encerrado.'}
        </p>
        <Link to={Links.EMPRESTIMOS} className="mt-3 inline-block text-sm underline">
          Voltar para empréstimos
        </Link>
      </div>
    );
  }

  const entregue = emprestimo.status === 'ATIVO';
  const anexado = emprestimo.termoAssinadoAnexado;
  const nomeTermo = `termo-emprestimo-${emprestimo.id}.pdf`;

  async function enviar() {
    if (!arquivo) return;
    await t.anexar(arquivo);
    setArquivo(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Termo de Responsabilidade
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {emprestimo.item.nome} · {emprestimo.responsavel.nome}
          </p>
        </div>
        <StatusBadge status={emprestimo.status} />
      </header>

      {/* Passo 1: termo gerado pelo sistema (ADMIN e gestor) */}
      <Passo numero={1} titulo="Termo gerado pelo sistema">
        {t.erroPdf && <Alerta feedback={{ tipo: 'erro', texto: t.erroPdf }} />}
        {t.pdfUrl && (
          <>
            <iframe
              src={t.pdfUrl}
              title="Termo de Responsabilidade"
              className="h-[480px] w-full rounded-lg border border-gray-200 dark:border-gray-800"
            />
            <a href={t.pdfUrl} download={nomeTermo} className={`${BTN_OUTLINE} mt-3`}>
              <Download className="h-4 w-4" />
              Baixar PDF
            </a>
          </>
        )}
      </Passo>

      {/* Passo 2: upload do assinado.
          TODO: esconder com <Can> quando o usuário não for gestor do estoque (ADMIN só consulta).
          Enquanto isso, o back responde 403 e a tela mostra a mensagem. */}
      <Passo numero={2} titulo="Termo assinado">
        {anexado ? (
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Termo assinado anexado.
            </span>
            <button type="button" onClick={t.baixarAssinado} className={BTN_OUTLINE}>
              <Download className="h-4 w-4" />
              Baixar assinado
            </button>
          </div>
        ) : null}

        {!entregue && (
          <div className={anexado ? 'mt-4' : ''}>
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
              {anexado ? 'Para substituir, envie um novo PDF.' : 'Envie o PDF assinado (até 5 MB).'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                disabled={t.enviando}
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                className="text-sm"
              />
              <button type="button" onClick={enviar} disabled={!arquivo || t.enviando} className={BTN_PRIMARY}>
                <Upload className="h-4 w-4" />
                {t.enviando ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        )}
        <Alerta feedback={t.feedbackUpload} />
      </Passo>

      {/* Passo 3: confirmar entrega, só depois do anexo */}
      <Passo numero={3} titulo="Confirmar entrega do item">
        <button
          type="button"
          onClick={t.confirmarEntrega}
          disabled={!anexado || entregue || t.confirmando}
          className={BTN_PRIMARY}
        >
          {t.confirmando ? 'Confirmando...' : entregue ? 'Entrega confirmada' : 'Confirmar entrega'}
        </button>
        {!anexado && !entregue && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Anexe o termo assinado para habilitar a confirmação.
          </p>
        )}
        <Alerta feedback={t.feedbackEntrega} />
      </Passo>

      <Link to={Links.EMPRESTIMOS} className={BTN_OUTLINE}>
        <ArrowLeft className="h-4 w-4" />
        Voltar para empréstimos
      </Link>
    </div>
  );
}