import { useMemo, useState } from 'react';
import { ClipboardList, Lock, Plus, RefreshCw } from 'lucide-react';
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
import { EmprestimoModal } from '../../modules/emprestimos/components/EmprestimoModal';
import { EmprestimoRow } from '../../modules/emprestimos/components/EmprestimoRow';
import { HttpError } from '../../modules/emprestimos/emprestimo.service';
import type { CreateEmprestimoDto, Emprestimo } from '../../modules/emprestimos/emprestimo.types';
import {
  useEmprestimos,
  useEstoques,
  useItensEmprestaveis,
} from '../../modules/emprestimos/useEmprestimos';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';

const SUPPORT_EMAIL = 'helpdesk@cin.ufpe.br';
const COLUNAS = 6;

export default function EmprestimosPage() {
  // Estados de UI (os dados do servidor ficam nos hooks)
  const [estoqueEscolhido, setEstoqueEscolhido] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Muda a cada abertura, forçando o modal a remontar e resetar o formulário
  const [modalKey, setModalKey] = useState(0);
  const [emprestimoADevolver, setEmprestimoADevolver] = useState<Emprestimo | null>(null);
  const [isDevolverOpen, setIsDevolverOpen] = useState(false);

  const {
    estoques,
    isLoading: carregandoEstoques,
    error: erroEstoques,
    reload: recarregarEstoques,
  } = useEstoques();

  // Sem escolha explícita, usa o primeiro estoque (derivado, sem useEffect)
  const estoqueId = estoqueEscolhido ?? estoques[0]?.id;

  const { emprestimos, isLoading, error, reload, registrar, devolver } = useEmprestimos(estoqueId);
  const { itens } = useItensEmprestaveis(estoqueId);

  // O backend recusa item que já tem empréstimo aguardando termo ou ativo;
  // aqui só deixamos de oferecê-lo no formulário.
  const itensDisponiveis = useMemo(() => {
    const emUso = new Set(emprestimos.map((emprestimo) => emprestimo.itemId));
    return itens.filter((item) => !emUso.has(item.id));
  }, [itens, emprestimos]);

  const semPermissao = error instanceof HttpError && error.status === 403;
  const carregando = carregandoEstoques || isLoading;

  const handleRegistrar = async (dto: CreateEmprestimoDto) => {
    try {
      await registrar(dto);
      toast.success('Empréstimo registrado. Aguardando o termo assinado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao registrar empréstimo.');
      throw err; // Repassa para o modal não fechar em caso de erro
    }
  };

  const handleAbrirDevolucao = (emprestimo: Emprestimo) => {
    setEmprestimoADevolver(emprestimo);
    setIsDevolverOpen(true);
  };

  const handleConfirmarDevolucao = async () => {
    if (!emprestimoADevolver) return;

    try {
      await devolver(emprestimoADevolver);
      toast.success('Devolução registrada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao registrar devolução.');
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

  const renderCorpo = () => {
    if (carregando) {
      return <TableSkeletonRows columns={COLUNAS} />;
    }

    if (erroEstoques || (error && !semPermissao)) {
      return (
        <TableMessageRow colSpan={COLUNAS}>
          <div className="flex flex-col items-center py-4">
            <ErrorScreen errorType={httpErrors.SERVER_ERROR} />
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={recarregarTudo}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </button>
              <a
                href={buildSupportMailto((erroEstoques ?? error) as Error, SUPPORT_EMAIL, 'projeto-base')}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Contatar suporte
              </a>
            </div>
          </div>
        </TableMessageRow>
      );
    }

    if (!estoqueId) {
      return (
        <TableMessageRow colSpan={COLUNAS}>
          <EmptyState
            icon={ClipboardList}
            title="Nenhum estoque cadastrado"
            description="Peça a um administrador para cadastrar um estoque."
          />
        </TableMessageRow>
      );
    }

    if (semPermissao) {
      return (
        <TableMessageRow colSpan={COLUNAS}>
          <EmptyState
            icon={Lock}
            title="Sem acesso aos empréstimos deste estoque"
            description="Somente os gestores do estoque e os administradores podem consultar e registrar empréstimos."
          />
        </TableMessageRow>
      );
    }

    if (emprestimos.length === 0) {
      return (
        <TableMessageRow colSpan={COLUNAS}>
          <EmptyState
            icon={ClipboardList}
            title="Nenhum empréstimo pendente"
            description="Os empréstimos aguardando termo e os ativos deste estoque aparecem aqui."
          />
        </TableMessageRow>
      );
    }

    return emprestimos.map((emprestimo) => (
      <EmprestimoRow
        key={emprestimo.id}
        emprestimo={emprestimo}
        estoqueId={estoqueId}
        onDevolver={handleAbrirDevolucao}
      />
    ));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-center dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-3xl">
            Empréstimos
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Empréstimos aguardando termo assinado e ativos do estoque selecionado.
          </p>
        </div>

        {/* Sem <Can>: gestor é por estoque no backend, e o front só conhece ADMIN/USERS.
            Quem não é gestor recebe 403 e vê a mensagem de acesso negado. */}
        <button
          onClick={handleAbrirNovo}
          disabled={!estoqueId || semPermissao}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-xs transition hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Novo Empréstimo
        </button>
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

      <Frame className="w-full">
        <Table variant="card">
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Retirada</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderCorpo()}</TableBody>
        </Table>
      </Frame>

      <EmprestimoModal
        key={modalKey}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleRegistrar}
        itens={itensDisponiveis}
      />

      <ConfirmDialog
        open={isDevolverOpen}
        onOpenChange={setIsDevolverOpen}
        onConfirm={handleConfirmarDevolucao}
        title="Registrar devolução"
        description={`Confirmar a devolução de "${emprestimoADevolver?.item.nome}" por ${emprestimoADevolver?.responsavel.nome}? O item voltará a ficar disponível.`}
        confirmLabel="Registrar devolução"
      />
    </div>
  );
}
