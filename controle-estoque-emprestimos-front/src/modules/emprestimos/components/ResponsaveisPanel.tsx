import { useState } from 'react';
import { useAsync } from '../../../hooks/useAsync';
import { emprestimoService } from '../emprestimo.service';
import { EMPRESTIMO_STATUS_LABELS, type Responsavel } from '../emprestimo.types';

const data = (value: string | null) => (value ? new Date(value).toLocaleDateString('pt-BR') : '—');

function Historico({ estoqueId, responsavelId }: { estoqueId: string; responsavelId: string }) {
  const {
    data: emprestimos = [],
    isLoading,
    error,
    reload,
  } = useAsync(
    () => emprestimoService.historicoResponsavel(estoqueId, responsavelId),
    [estoqueId, responsavelId],
  );
  if (isLoading) return <p role="status">Carregando histórico…</p>;
  if (error)
    return (
      <div role="alert">
        {error.message}{' '}
        <button type="button" onClick={reload}>
          Tentar novamente
        </button>
      </div>
    );
  if (!emprestimos.length) return <p>Nenhum empréstimo deste responsável neste estoque.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          Histórico de empréstimos e devoluções do responsável no estoque selecionado
        </caption>
        <thead>
          <tr>
            <th>Item</th>
            <th>Situação</th>
            <th>Retirada</th>
            <th>Prazo</th>
            <th>Devolução</th>
          </tr>
        </thead>
        <tbody>
          {emprestimos.map((e) => (
            <tr key={e.id} className="border-t border-gray-200 dark:border-gray-700">
              <td className="py-3">
                {e.item.nome}
                {e.item.tombamento ? ` (${e.item.tombamento})` : ''}
              </td>
              <td>
                {EMPRESTIMO_STATUS_LABELS[e.status]}
                {e.atrasado ? ' — Atrasado' : ''}
              </td>
              <td>{data(e.dataRetirada)}</td>
              <td>{e.prazoDevolucao ? data(e.prazoDevolucao) : 'Indefinido'}</td>
              <td>{data(e.dataDevolucaoEfetiva)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResponsaveisPanel({
  estoqueId,
  responsaveis,
  isLoading,
  error,
  reload,
}: {
  estoqueId: string;
  responsaveis: Responsavel[];
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
}) {
  const [responsavelId, setResponsavelId] = useState('');
  return (
    <section
      className="mt-8 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
      aria-labelledby="titulo-historico"
    >
      <h2 id="titulo-historico" className="mb-2 text-lg font-semibold">
        Histórico por responsável
      </h2>
      <p className="mb-3 text-sm text-gray-500">Empréstimos e devoluções no estoque selecionado.</p>
      {isLoading ? (
        <p role="status">Carregando responsáveis…</p>
      ) : error ? (
        <div role="alert">
          {error.message}{' '}
          <button type="button" onClick={reload}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          <label htmlFor="historico-responsavel" className="block text-sm">
            Responsável
          </label>
          <select
            id="historico-responsavel"
            value={responsavelId}
            onChange={(e) => setResponsavelId(e.target.value)}
            className="mb-4 mt-1 w-full rounded-lg border border-gray-300 p-2 dark:border-gray-700 dark:bg-gray-800"
          >
            <option value="">Selecione um responsável</option>
            {responsaveis.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome} — {r.siape ? `Siape ${r.siape}` : `CPF ${r.cpf}`}
              </option>
            ))}
          </select>
          {!responsaveis.length && <p>Nenhum responsável cadastrado.</p>}
          {responsavelId && (
            <Historico
              key={`${estoqueId}:${responsavelId}`}
              estoqueId={estoqueId}
              responsavelId={responsavelId}
            />
          )}
        </>
      )}
    </section>
  );
}
