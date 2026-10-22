import { useState } from 'react';
import { ClipboardList, History, Lock, Plus, RefreshCw } from 'lucide-react';
import {
  ErrorScreen,
  httpErrors,
  buildSupportMailto,
  Frame,
  SimpleSelect,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableMessageRow,
  TableRow,
  TableSkeletonRows,
  toast,
} from '@cincoders/cinnamon';
import { EmptyState } from '../../components/EmptyState';
import { HttpError } from '../../modules/emprestimos/emprestimo.service';
import { useEstoques } from '../../modules/emprestimos/useEmprestimos';
import { MovimentacaoModal } from '../../modules/movimentacoes/components/MovimentacaoModal';
import { HistoricoRow, SaldoRow } from '../../modules/movimentacoes/components/MovimentacaoRows';
import type { RegistrarMovimentacaoDto } from '../../modules/movimentacoes/movimentacao.types';
import { useMovimentacoes } from '../../modules/movimentacoes/useMovimentacoes';

const SUPPORT_EMAIL = 'helpdesk@cin.ufpe.br';
const COLUNAS_SALDO = 4;
const COLUNAS_HISTORICO = 5;

const BOTAO_PRIMARIO =
  'inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 cursor-pointer';

export default function MovimentacoesPage() {
  // Estados de UI (os dados do servidor ficam nos hooks)
  const [estoqueEscolhido, setEstoqueEscolhido] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Muda a cada abertura, forçando o modal a remontar e resetar o formulário
  const [modalKey, setModalKey] = useState(0);

  const {
    estoques,
    isLoading: carregandoEstoques,
    error: erroEstoques,
    reload: recarregarEstoques,
  } = useEstoques();

  // Sem escolha explícita, usa o primeiro estoque (derivado, sem useEffect)
  const estoqueId = estoqueEscolhido ?? estoques[0]?.id;

  const {
    itensSaldo,
    carregandoSaldo,
    erroSaldo,
    historico,
    carregandoHistorico,
    erroHistorico,
    reload,
    registrar,
  } = useMovimentacoes(estoqueId);

  // O histórico responde 403 a quem não é gestor do estoque nem ADMIN. Esse
  // mesmo sinal esconde o botão de registrar: o front só conhece ADMIN/USERS,
  // e o gestor é por estoque no backend (mesmo critério da tela de empréstimos).
  const semPermissaoHistorico = erroHistorico instanceof HttpError && erroHistorico.status === 403;
  const podeRegistrar = !!estoqueId && !carregandoHistorico && !erroHistorico;

  const handleRegistrar = async (dto: RegistrarMovimentacaoDto) => {
    try {
      const resultado = await registrar(dto);
      toast.success(
        resultado.abaixoDoMinimo
          ? `Movimentação registrada. Saldo atual: ${resultado.saldoAtual} (abaixo do nível mínimo).`
          : `Movimentação registrada. Saldo atual: ${resultado.saldoAtual}.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao registrar movimentação.');
      throw err; // Repassa para o modal não fechar em caso de erro
    }
  };

  const handleAbrirNovo = () => {
    setModalKey((key) => key + 1);
    setIsModalOpen(true);
  };

  const recarregarTudo = () => {
    recarregarEstoques();
    reload();
  };

  const mensagemErro = (erro: unknown, colunas: number) => (
    <TableMessageRow colSpan={colunas}>
      <div className="flex flex-col items-center py-4">
        <ErrorScreen errorType={httpErrors.SERVER_ERROR} />
        <div className="mt-4 flex items-center gap-3">
          <button onClick={recarregarTudo} className={BOTAO_PRIMARIO}>
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </button>
          <a
            href={buildSupportMailto(erro as Error, SUPPORT_EMAIL, 'projeto-base')}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Contatar suporte
          </a>
        </div>
      </div>
    </TableMessageRow>
  );

  const renderSaldo = () => {
    if (carregandoEstoques || carregandoSaldo) {
      return <TableSkeletonRows columns={COLUNAS_SALDO} />;
    }
    if (erroEstoques || erroSaldo) {
      return mensagemErro(erroEstoques ?? erroSaldo, COLUNAS_SALDO);
    }
    if (!estoqueId) {
      return (
        <TableMessageRow colSpan={COLUNAS_SALDO}>
          <EmptyState
            icon={ClipboardList}
            title="Nenhum estoque cadastrado"
            description="Peça a um administrador para cadastrar um estoque."
          />
        </TableMessageRow>
      );
    }
    if (itensSaldo.length === 0) {
      return (
        <TableMessageRow colSpan={COLUNAS_SALDO}>
          <EmptyState
            icon={ClipboardList}
            title="Nenhum item neste estoque"
            description="Os itens do estoque e seus saldos aparecem aqui."
          />
        </TableMessageRow>
      );
    }
    return itensSaldo.map((item) => <SaldoRow key={item.itemId} item={item} />);
  };

  const renderHistorico = () => {
    if (carregandoEstoques || carregandoHistorico) {
      return <TableSkeletonRows columns={COLUNAS_HISTORICO} />;
    }
    if (semPermissaoHistorico) {
      return (
        <TableMessageRow colSpan={COLUNAS_HISTORICO}>
          <EmptyState
            icon={Lock}
            title="Sem acesso ao histórico deste estoque"
            description="Somente os gestores do estoque e os administradores podem consultar o histórico."
          />
        </TableMessageRow>
      );
    }
    if (erroHistorico) {
      return mensagemErro(erroHistorico, COLUNAS_HISTORICO);
    }
    if (!estoqueId || historico.length === 0) {
      return (
        <TableMessageRow colSpan={COLUNAS_HISTORICO}>
          <EmptyState
            icon={History}
            title="Nenhuma movimentação registrada"
            description="As entradas e saídas deste estoque aparecem aqui, da mais recente para a mais antiga."
          />
        </TableMessageRow>
      );
    }
    // A ordem (mais recente primeiro) já vem do backend: não reordenar aqui.
    return historico.map((movimentacao) => (
      <HistoricoRow key={movimentacao.id} movimentacao={movimentacao} />
    ));
  };

  const carregando = carregandoEstoques || carregandoSaldo || carregandoHistorico;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-center dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-3xl">
            Movimentações e Saldo
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Saldo dos itens do estoque selecionado e o histórico de entradas e saídas.
          </p>
        </div>

        {/* Só aparece para quem consegue ver o histórico (gestor do estoque ou
            ADMIN). O ADMIN só consulta: se tentar registrar, o backend recusa. */}
        {podeRegistrar && (
          <button
            onClick={handleAbrirNovo}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-xs transition hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Registrar Movimentação
          </button>
        )}
      </div>

      <div className="mb-6 flex items-center gap-3">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Estoque:</label>
        <SimpleSelect
          value={estoqueId ?? ''}
          onValueChange={(value) => setEstoqueEscolhido(value || null)}
          placeholder="Selecione o estoque"
          items={estoques.map((estoque) => ({ value: estoque.id, label: estoque.nome }))}
        />

        <button
          onClick={recarregarTudo}
          title="Recarregar dados"
          disabled={carregando}
          className="rounded-lg border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Saldo por item</h2>
      <Frame className="mb-10 w-full">
        <Table variant="card">
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Saldo</TableHead>
              <TableHead>Nível mínimo</TableHead>
              <TableHead>Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderSaldo()}</TableBody>
        </Table>
      </Frame>

      <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Histórico</h2>
      <Frame className="w-full">
        <Table variant="card">
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Observação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderHistorico()}</TableBody>
        </Table>
      </Frame>

      <MovimentacaoModal
        key={modalKey}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleRegistrar}
        itens={itensSaldo}
      />
    </div>
  );
}