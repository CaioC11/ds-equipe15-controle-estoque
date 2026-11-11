import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Package, ShieldAlert, PlusCircle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAsync } from '../hooks/useAsync';
import { STATUS_ITEM_LABELS, TIPO_ITEM_LABELS } from '../modules/estoques/estoque.types';
import type { Estoque } from '../modules/estoques/estoque.types';
import { ItemApiError, itemService } from '../modules/estoques/item.service';
import type { CreateItemDto, ItemListado } from '../modules/estoques/item.service';
import { categoriasService } from '../services/categoriaService';

const itemSchema = z
  .object({
    estoqueId: z.string().min(1, 'Selecione um estoque'),
    categoriaId: z.string().min(1, 'A categoria é obrigatória'),
    nome: z.string().trim().min(1, 'O nome é obrigatório'),
    tipo: z.enum(['PATRIMONIAL', 'CONSUMO']),
    numeroSerie: z.string().optional(),
    // string no formulário (vazio = sem alerta); convertida para número no envio
    nivelMinimo: z.string().regex(/^\d*$/, 'Informe um número inteiro maior ou igual a 0'),
    tombamento: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipo === 'PATRIMONIAL' && (!data.tombamento || data.tombamento.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Tombamento é obrigatório para itens de tipo Patrimonial',
        path: ['tombamento'],
      });
    }
  });

type ItemFormData = z.infer<typeof itemSchema>;

const valoresIniciais: ItemFormData = {
  estoqueId: '',
  categoriaId: '',
  nome: '',
  tipo: 'PATRIMONIAL',
  numeroSerie: '',
  nivelMinimo: '',
  tombamento: '',
};

interface Props {
  estoques: Estoque[];
  isGestor: boolean;
  /** Chamado depois de criar um item (a página usa para recarregar os saldos). */
  onItemCriado?: () => void;
}

export const GerenciamentoEstoque: React.FC<Props> = ({ estoques, isGestor, onItemCriado }) => {
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);
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

  const {
    data: itens = [],
    isLoading: carregandoItens,
    error: erroItens,
    reload: recarregarItens,
  } = useAsync<ItemListado[]>(
    () => (estoqueSelecionado ? itemService.listar(estoqueSelecionado) : Promise.resolve([])),
    [estoqueSelecionado],
  );

  const nomeEstoque = estoquesAtivos.find((e) => e.id === estoqueSelecionado)?.nome;

  const onSubmit = async (data: ItemFormData) => {
    setSucessoMsg(null);

    const dto: CreateItemDto = {
      tipo: data.tipo,
      nome: data.nome.trim(),
      categoriaId: data.categoriaId,
      // o back recusa tombamento vazio e tombamento em item de consumo
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

    setSucessoMsg('Item cadastrado com sucesso!');
    reset({ ...valoresIniciais, estoqueId: data.estoqueId });
    recarregarItens();
    onItemCriado?.();
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-6 space-y-8">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="h-7 w-7 text-blue-600" />
          Itens do estoque{nomeEstoque ? `: ${nomeEstoque}` : ''}
        </h1>
      </div>

      {isGestor ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-blue-600" />
            Cadastrar Novo Item
          </h2>

          {sucessoMsg && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {sucessoMsg}
            </div>
          )}

          {errors.root && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {errors.root.message}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estoque *</label>
              <select
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
              {errors.estoqueId && <p className="text-xs text-red-600 mt-1">{errors.estoqueId.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
              <select
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
              {errors.categoriaId && <p className="text-xs text-red-600 mt-1">{errors.categoriaId.message}</p>}
              {erroCategorias && (
                <p className="text-xs text-red-600 mt-1">Não foi possível carregar as categorias.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input
                type="text"
                {...register('nome')}
                className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              {errors.nome && <p className="text-xs text-red-600 mt-1">{errors.nome.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
              <select
                {...register('tipo')}
                className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-2 focus:ring-blue-500"
              >
                <option value="PATRIMONIAL">{TIPO_ITEM_LABELS.PATRIMONIAL}</option>
                <option value="CONSUMO">{TIPO_ITEM_LABELS.CONSUMO}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nº de Série</label>
              <input
                type="text"
                {...register('numeroSerie')}
                className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              {errors.numeroSerie && <p className="text-xs text-red-600 mt-1">{errors.numeroSerie.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nível Mínimo</label>
              <input
                type="number"
                min="0"
                step="1"
                {...register('nivelMinimo')}
                className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              {errors.nivelMinimo && <p className="text-xs text-red-600 mt-1">{errors.nivelMinimo.message}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tombamento {tipoSelecionado === 'PATRIMONIAL' && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
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
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md text-sm transition-colors disabled:opacity-50"
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
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="text-base font-semibold text-gray-800">Itens do Estoque</h2>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {!estoqueSelecionado ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Selecione um estoque para ver os itens.
                  </td>
                </tr>
              ) : carregandoItens ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">Carregando itens...</td>
                </tr>
              ) : erroItens ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-red-600">{erroItens.message}</td>
                </tr>
              ) : itens.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">Nenhum item cadastrado.</td>
                </tr>
              ) : (
                itens.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">{item.nome}</td>
                    <td className="px-6 py-4">{item.categoria?.nome ?? '-'}</td>
                    <td className="px-6 py-4">{TIPO_ITEM_LABELS[item.tipo]}</td>
                    <td className="px-6 py-4 font-mono">{item.numeroSerie || '-'}</td>
                    <td className="px-6 py-4 font-mono">{item.tombamento || '-'}</td>
                    <td className="px-6 py-4">{item.nivelMinimo ?? '-'}</td>
                    <td className="px-6 py-4">{STATUS_ITEM_LABELS[item.status]}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};