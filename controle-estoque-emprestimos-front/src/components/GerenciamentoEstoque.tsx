import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Package,
  ShieldAlert,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Tag,
} from 'lucide-react';
import { FormModal } from './FormModal';
import { useAsync } from '../hooks/useAsync';
import { STATUS_ITEM_LABELS, TIPO_ITEM_LABELS } from '../modules/estoques/estoque.types';
import type { Estoque } from '../modules/estoques/estoque.types';
import { ItemApiError, itemService } from '../modules/estoques/item.service';
import type { CreateItemDto, ItemListado } from '../modules/estoques/item.service';
import { categoriasService } from '../services/categoriaService';

const itemSchema = z.object({
  estoqueId: z.string().min(1, 'Selecione um estoque'),
  categoriaId: z.string().min(1, 'A categoria é obrigatória'),
  nome: z.string().trim().min(1, 'O nome é obrigatório'),
  tipo: z.enum(['PATRIMONIAL', 'CONSUMO']),
  numeroSerie: z.string().optional(),
  // string no formulário (vazio = sem alerta); convertida para número no envio
  nivelMinimo: z.string().regex(/^\d*$/, 'Informe um número inteiro maior ou igual a 0'),
  tombamento: z.string().optional(),
});

type ItemFormData = z.infer<typeof itemSchema>;
type FiltroPendencia = 'TODOS' | 'PENDENTES' | 'TOMBADOS';

const valoresIniciais: ItemFormData = {
  estoqueId: '',
  categoriaId: '',
  nome: '',
  tipo: 'PATRIMONIAL',
  numeroSerie: '',
  nivelMinimo: '',
  tombamento: '',
};

function isItemPendente(item: ItemListado): boolean {
  return item.tombamentoPendente ?? (item.tipo === 'PATRIMONIAL' && !item.tombamento);
}

interface Props {
  estoques: Estoque[];
  isGestor: boolean;
  /** Chamado depois de criar ou atualizar um item (a página usa para recarregar os saldos). */
  onItemCriado?: () => void;
}

export const GerenciamentoEstoque: React.FC<Props> = ({ estoques, isGestor, onItemCriado }) => {
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);
  const [filtroPendencia, setFiltroPendencia] = useState<FiltroPendencia>('TODOS');
  const [itemParaTombar, setItemParaTombar] = useState<ItemListado | null>(null);
  const [novoTombamento, setNovoTombamento] = useState('');
  const [erroTombamentoModal, setErroTombamentoModal] = useState<string | null>(null);
  const [salvandoTombamento, setSalvandoTombamento] = useState(false);

  const estoquesAtivos = estoques.filter((estoque) => estoque.ativo);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: valoresIniciais,
  });

  const tipoSelecionado = watch('tipo');
  const estoqueSelecionado = watch('estoqueId');

  const { data: categorias = [], error: erroCategorias } = useAsync(
    () => categoriasService.listar(),
    [],
  );

  const filtroApi =
    filtroPendencia === 'PENDENTES'
      ? { pendente: true }
      : filtroPendencia === 'TOMBADOS'
        ? { pendente: false }
        : undefined;

  const {
    data: itens = [],
    isLoading: carregandoItens,
    error: erroItens,
    reload: recarregarItens,
  } = useAsync<ItemListado[]>(
    () =>
      estoqueSelecionado
        ? itemService.listar(estoqueSelecionado, filtroApi)
        : Promise.resolve([]),
    [estoqueSelecionado, filtroPendencia],
  );

  const nomeEstoque = estoquesAtivos.find((e) => e.id === estoqueSelecionado)?.nome;

  const onSubmit = async (data: ItemFormData) => {
    setSucessoMsg(null);

    const dto: CreateItemDto = {
      tipo: data.tipo,
      nome: data.nome.trim(),
      categoriaId: data.categoriaId,
      // Patrimonial sem tombamento é enviado como undefined para ficar pendente
      tombamento: data.tipo === 'PATRIMONIAL' ? data.tombamento?.trim() || undefined : undefined,
      numeroSerie: data.numeroSerie?.trim() || undefined,
      nivelMinimo: data.nivelMinimo === '' ? undefined : Number(data.nivelMinimo),
    };

    try {
      await itemService.criar(data.estoqueId, dto);
    } catch (err) {
      const message =
        err instanceof ItemApiError
          ? err.message
          : 'Não foi possível falar com a API. Tente novamente.';
      if (err instanceof ItemApiError && err.status === 409 && /tombamento/i.test(message)) {
        setError('tombamento', { type: 'server', message });
      } else if (err instanceof ItemApiError && err.status === 409 && /s[eé]rie/i.test(message)) {
        setError('numeroSerie', { type: 'server', message });
      } else {
        setError('root', { type: 'server', message });
      }
      return;
    }

    setSucessoMsg(
      dto.tipo === 'PATRIMONIAL' && !dto.tombamento
        ? 'Item patrimonial cadastrado com tombamento pendente!'
        : 'Item cadastrado com sucesso!',
    );
    reset({ ...valoresIniciais, estoqueId: data.estoqueId });
    recarregarItens();
    onItemCriado?.();
  };

  const abrirModalTombamento = (item: ItemListado) => {
    setItemParaTombar(item);
    setNovoTombamento('');
    setErroTombamentoModal(null);
  };

  const fecharModalTombamento = () => {
    if (salvandoTombamento) return;
    setItemParaTombar(null);
    setNovoTombamento('');
    setErroTombamentoModal(null);
  };

  const handleConfirmarTombamento = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!itemParaTombar || !estoqueSelecionado) return;

    const codigo = novoTombamento.trim();
    if (!codigo) {
      setErroTombamentoModal('Informe o código de tombamento.');
      return;
    }

    setSalvandoTombamento(true);
    setErroTombamentoModal(null);
    setSucessoMsg(null);

    try {
      await itemService.completarTombamento(estoqueSelecionado, itemParaTombar.id, {
        tombamento: codigo,
      });
      setItemParaTombar(null);
      setNovoTombamento('');
      setSucessoMsg('Tombamento informado com sucesso!');
      recarregarItens();
      onItemCriado?.();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível informar o tombamento.';
      setErroTombamentoModal(message);
    } finally {
      setSalvandoTombamento(false);
    }
  };

  const totalColunas = isGestor ? 8 : 7;

  return (
    <div className="w-full max-w-5xl mx-auto p-6 space-y-8">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="h-7 w-7 text-blue-600" />
          Itens do estoque{nomeEstoque ? `: ${nomeEstoque}` : ''}
        </h1>
      </div>

      {sucessoMsg && (
        <div
          role="status"
          className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm flex items-center gap-2"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {sucessoMsg}
        </div>
      )}

      {isGestor ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-blue-600" />
            Cadastrar Novo Item
          </h2>

          {errors.root && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {errors.root.message}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="item-estoque" className="block text-sm font-medium text-gray-700 mb-1">
                Estoque *
              </label>
              <select
                id="item-estoque"
                {...register('estoqueId')}
                className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione um estoque</option>
                {estoquesAtivos.map((estoque) => (
                  <option key={estoque.id} value={estoque.id}>
                    {estoque.nome}
                  </option>
                ))}
              </select>
              {errors.estoqueId && (
                <p className="text-xs text-red-600 mt-1">{errors.estoqueId.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="item-categoria"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Categoria *
              </label>
              <select
                id="item-categoria"
                {...register('categoriaId')}
                className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione uma categoria</option>
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nome}
                  </option>
                ))}
              </select>
              {errors.categoriaId && (
                <p className="text-xs text-red-600 mt-1">{errors.categoriaId.message}</p>
              )}
              {erroCategorias && (
                <p className="text-xs text-red-600 mt-1">Não foi possível carregar as categorias.</p>
              )}
            </div>

            <div>
              <label htmlFor="item-nome" className="block text-sm font-medium text-gray-700 mb-1">
                Nome *
              </label>
              <input
                id="item-nome"
                type="text"
                {...register('nome')}
                className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              {errors.nome && <p className="text-xs text-red-600 mt-1">{errors.nome.message}</p>}
            </div>

            <div>
              <label htmlFor="item-tipo" className="block text-sm font-medium text-gray-700 mb-1">
                Tipo *
              </label>
              <select
                id="item-tipo"
                {...register('tipo')}
                className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-2 focus:ring-blue-500"
              >
                <option value="PATRIMONIAL">{TIPO_ITEM_LABELS.PATRIMONIAL}</option>
                <option value="CONSUMO">{TIPO_ITEM_LABELS.CONSUMO}</option>
              </select>
            </div>

            <div>
              <label htmlFor="item-serie" className="block text-sm font-medium text-gray-700 mb-1">
                Nº de Série
              </label>
              <input
                id="item-serie"
                type="text"
                {...register('numeroSerie')}
                className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              {errors.numeroSerie && (
                <p className="text-xs text-red-600 mt-1">{errors.numeroSerie.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="item-nivel-minimo"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Nível Mínimo
              </label>
              <input
                id="item-nivel-minimo"
                type="number"
                min="0"
                step="1"
                {...register('nivelMinimo')}
                className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              {errors.nivelMinimo && (
                <p className="text-xs text-red-600 mt-1">{errors.nivelMinimo.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="item-tombamento"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Tombamento{' '}
                {tipoSelecionado === 'PATRIMONIAL' && (
                  <span className="font-normal text-gray-500">
                    (opcional — deixe em branco para cadastrar com tombamento pendente)
                  </span>
                )}
              </label>
              <input
                id="item-tombamento"
                type="text"
                placeholder={
                  tipoSelecionado === 'PATRIMONIAL'
                    ? 'Ex.: PAT-2026-001 (ou deixe em branco)'
                    : 'Não aplicável para item de consumo'
                }
                disabled={tipoSelecionado === 'CONSUMO'}
                {...register('tombamento')}
                className={`w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-2 focus:ring-blue-500 ${
                  tipoSelecionado === 'CONSUMO' ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                }`}
              />
              {errors.tombamento && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.tombamento.message}
                </p>
              )}
            </div>

            <div className="md:col-span-2 flex justify-end mt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md text-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Salvando...' : 'Cadastrar Item'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3 text-amber-800 text-sm">
          <ShieldAlert className="h-5 w-5 flex-shrink-0" />
          <span>Apenas o gestor deste estoque pode cadastrar novos itens.</span>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-gray-800">Itens do Estoque</h2>

          <div
            role="group"
            aria-label="Filtrar por status de tombamento"
            className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 text-xs"
          >
            {(
              [
                { id: 'TODOS', label: 'Todos' },
                { id: 'PENDENTES', label: 'Pendentes de tombamento' },
                { id: 'TOMBADOS', label: 'Tombados' },
              ] as const
            ).map((opcao) => {
              const ativo = filtroPendencia === opcao.id;
              return (
                <button
                  key={opcao.id}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setFiltroPendencia(opcao.id)}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                    ativo
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {opcao.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-100 text-gray-700 uppercase text-xs font-medium">
              <tr>
                <th className="px-6 py-3">Nome</th>
                <th className="px-6 py-3">Categoria</th>
                <th className="px-6 py-3">Tipo</th>
                <th className="px-6 py-3">Série</th>
                <th className="px-6 py-3">Tombamento</th>
                <th className="px-6 py-3">Mínimo</th>
                <th className="px-6 py-3">Status</th>
                {isGestor && <th className="px-6 py-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {!estoqueSelecionado ? (
                <tr>
                  <td colSpan={totalColunas} className="px-6 py-8 text-center text-gray-500">
                    Selecione um estoque para ver os itens.
                  </td>
                </tr>
              ) : carregandoItens ? (
                <tr>
                  <td colSpan={totalColunas} className="px-6 py-8 text-center text-gray-500">
                    Carregando itens...
                  </td>
                </tr>
              ) : erroItens ? (
                <tr>
                  <td colSpan={totalColunas} className="px-6 py-8 text-center text-red-600">
                    {erroItens.message}
                  </td>
                </tr>
              ) : itens.length === 0 ? (
                <tr>
                  <td colSpan={totalColunas} className="px-6 py-8 text-center text-gray-500">
                    Nenhum item encontrado.
                  </td>
                </tr>
              ) : (
                itens.map((item) => {
                  const pendente = isItemPendente(item);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{item.nome}</td>
                      <td className="px-6 py-4">{item.categoria?.nome ?? '-'}</td>
                      <td className="px-6 py-4">{TIPO_ITEM_LABELS[item.tipo]}</td>
                      <td className="px-6 py-4 font-mono">{item.numeroSerie || '-'}</td>
                      <td className="px-6 py-4">
                        {item.tombamento ? (
                          <span className="font-mono text-gray-900">{item.tombamento}</span>
                        ) : pendente ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                            <Clock className="h-3 w-3" />
                            Tombamento pendente
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4">{item.nivelMinimo ?? '-'}</td>
                      <td className="px-6 py-4">{STATUS_ITEM_LABELS[item.status]}</td>
                      {isGestor && (
                        <td className="px-6 py-4 text-right">
                          {pendente ? (
                            <button
                              type="button"
                              onClick={() => abrirModalTombamento(item)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer"
                            >
                              <Tag className="h-3.5 w-3.5" />
                              Informar tombamento
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <FormModal
        isOpen={itemParaTombar !== null}
        onClose={fecharModalTombamento}
        onSubmit={handleConfirmarTombamento}
        title="Informar Tombamento"
        isSubmitting={salvandoTombamento}
        submitLabel="Salvar Tombamento"
      >
        {itemParaTombar && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 border border-gray-200">
              <p className="font-medium text-gray-900">{itemParaTombar.nome}</p>
              {itemParaTombar.numeroSerie && (
                <p className="mt-0.5 text-xs text-gray-500">
                  Nº de série: <span className="font-mono">{itemParaTombar.numeroSerie}</span>
                </p>
              )}
            </div>

            {erroTombamentoModal && (
              <div
                role="alert"
                className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {erroTombamentoModal}
              </div>
            )}

            <div>
              <label
                htmlFor="modal-novo-tombamento"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Código de Tombamento *
              </label>
              <input
                id="modal-novo-tombamento"
                type="text"
                autoFocus
                placeholder="Ex.: PAT-2026-001"
                value={novoTombamento}
                onChange={(e) => setNovoTombamento(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </FormModal>
    </div>
  );
};