import { useMemo, useState } from 'react';
import { Plus, Search, RefreshCw, Warehouse } from 'lucide-react';
import {
  ErrorScreen,
  httpErrors,
  buildSupportMailto,
  Frame,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableMessageRow,
  TableRow,
  TableSkeletonRows,
  toast,
} from '@cincoders/cinnamon';
import { EstoqueModal } from '../../modules/estoques/components/EstoqueModal';
import {
  ESTOQUE_TABLE_COLUMNS,
  EstoqueRow,
} from '../../modules/estoques/components/EstoqueRow';
import { EstoqueApiError } from '../../modules/estoques/estoque.service';
import type { CreateEstoqueDto, Estoque } from '../../modules/estoques/estoque.types';
import { useEstoques } from '../../modules/estoques/useEstoques';
import { Can } from '../../components/auth/Can';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { WRITE_ROLES } from '../../utils/enums';

const SUPPORT_EMAIL = 'helpdesk@cin.ufpe.br';

export default function EstoquesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [estoqueToEdit, setEstoqueToEdit] = useState<Estoque | null>(null);
  // Muda a cada abertura para criação, forçando o modal a remontar e resetar o formulário.
  const [newEstoqueKey, setNewEstoqueKey] = useState(0);
  const [estoqueToDeactivate, setEstoqueToDeactivate] = useState<Estoque | null>(null);
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);

  const { estoques, isLoading, error, reload, create, update, deactivate } = useEstoques();

  const handleSaveEstoque = async (dto: CreateEstoqueDto) => {
    try {
      if (estoqueToEdit) {
        await update(estoqueToEdit.id, dto);
        toast.success('Estoque atualizado com sucesso!');
      } else {
        await create(dto);
        toast.success('Estoque criado com sucesso!');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao salvar estoque.';
      toast.error(message);
      throw err; // Repassa para o modal não fechar em caso de erro
    }
  };

  const handleAskDeactivate = (estoque: Estoque) => {
    setEstoqueToDeactivate(estoque);
    setIsDeactivateDialogOpen(true);
  };

  const handleConfirmDeactivate = async () => {
    if (!estoqueToDeactivate) return;
    try {
      await deactivate(estoqueToDeactivate);
      toast.success('Estoque desativado com sucesso!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao desativar estoque.';
      toast.error(message);
    }
  };

  const handleOpenCreateModal = () => {
    setEstoqueToEdit(null);
    setNewEstoqueKey((key) => key + 1);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (estoque: Estoque) => {
    setEstoqueToEdit(estoque);
    setIsModalOpen(true);
  };

  const filteredEstoques = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return estoques.filter(
      (estoque) =>
        estoque.nome.toLowerCase().includes(term) ||
        (estoque.localizacao ?? '').toLowerCase().includes(term) ||
        (estoque.descricao ?? '').toLowerCase().includes(term),
    );
  }, [estoques, searchTerm]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* 1. Cabeçalho com ações */}
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-center dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-gray-100">
            Estoques
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Consulte os estoques com seus itens e saldos. Apenas administradores criam, editam e
            desativam estoques.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Can roles={WRITE_ROLES}>
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-xs transition-colors hover:bg-red-700"
            >
              <Plus className="h-4 w-4" />
              Novo Estoque
            </button>
          </Can>
        </div>
      </div>

      {/* 2. Busca */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, localização ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pr-4 pl-9 text-sm text-gray-900 focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        <button
          onClick={reload}
          title="Recarregar dados"
          disabled={isLoading}
          className="cursor-pointer self-start rounded-lg border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 3. Tabela: loading/erro/vazio viram linhas dentro do TableBody */}
      <Frame className="w-full">
        <Table
          variant="card"
          exportEnabled={!isLoading && !error && filteredEstoques.length > 0}
        >
          <TableHeader>
            <TableRow>
              <TableHead>Estoque</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead>Disponíveis</TableHead>
              <TableHead>Emprestados</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows columns={ESTOQUE_TABLE_COLUMNS} />
            ) : error ? (
              <TableMessageRow colSpan={ESTOQUE_TABLE_COLUMNS}>
                <div className="flex flex-col items-center py-4">
                  <ErrorScreen errorType={httpErrors.SERVER_ERROR} />
                  {/* A ilustração é genérica: aqui mostramos a causa real para facilitar o diagnóstico. */}
                  <p
                    data-testid="estoques-error-detail"
                    className="mt-2 max-w-xl text-center text-sm text-gray-600 dark:text-gray-400"
                  >
                    {error instanceof EstoqueApiError
                      ? `Detalhe: ${error.message} (HTTP ${error.status})`
                      : 'Detalhe: não foi possível falar com a API (back fora do ar, endereço errado ou bloqueio de CORS).'}
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={reload}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Tentar novamente
                    </button>
                    <a
                      href={buildSupportMailto(error, SUPPORT_EMAIL, 'controle-estoque-emprestimos')}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                    >
                      Contatar suporte
                    </a>
                  </div>
                </div>
              </TableMessageRow>
            ) : filteredEstoques.length === 0 ? (
              <TableMessageRow colSpan={ESTOQUE_TABLE_COLUMNS}>
                <EmptyState
                  icon={Warehouse}
                  title="Nenhum estoque encontrado"
                  description={
                    searchTerm
                      ? 'Tente alterar os termos da busca.'
                      : 'Ainda não há estoques cadastrados.'
                  }
                  action={
                    <Can roles={WRITE_ROLES}>
                      <button
                        onClick={handleOpenCreateModal}
                        className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                      >
                        <Plus className="h-4 w-4" />
                        Novo Estoque
                      </button>
                    </Can>
                  }
                />
              </TableMessageRow>
            ) : (
              filteredEstoques.map((estoque) => (
                <EstoqueRow
                  key={estoque.id}
                  estoque={estoque}
                  onEdit={handleOpenEditModal}
                  onDeactivate={handleAskDeactivate}
                />
              ))
            )}
          </TableBody>
        </Table>
      </Frame>

      {/* 4. Modal de criação/edição (a `key` reseta o formulário) */}
      <EstoqueModal
        key={estoqueToEdit?.id ?? `new-${newEstoqueKey}`}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSaveEstoque}
        estoqueToEdit={estoqueToEdit}
      />

      {/* 5. Confirmação de desativação */}
      <ConfirmDialog
        open={isDeactivateDialogOpen}
        onOpenChange={setIsDeactivateDialogOpen}
        onConfirm={handleConfirmDeactivate}
        title="Desativar estoque"
        description={`Deseja realmente desativar o estoque "${estoqueToDeactivate?.nome}"? Ele deixará de aparecer na listagem.`}
        confirmLabel="Desativar"
      />
    </div>
  );
}
