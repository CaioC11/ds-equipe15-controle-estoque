import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Package, ShieldAlert, PlusCircle, AlertCircle, CheckCircle2 } from 'lucide-react';

// 1. Zod puro, sem coerções que quebrem a tipagem
const itemSchema = z
  .object({
    categoria: z.string().min(1, 'A categoria é obrigatória'),
    tipo: z.enum(['patrimonial', 'consumo']),
    numeroSerie: z.string().min(1, 'O número de série é obrigatório'),
    // Apenas z.number() direto, sem o objeto de erro interno
    nivelMinimo: z.number().min(0, 'O nível mínimo não pode ser negativo'),
    tombamento: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipo === 'patrimonial' && (!data.tombamento || data.tombamento.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Tombamento é obrigatório para itens de tipo Patrimonial',
        path: ['tombamento'],
      });
    }
  });

// Tipagem perfeitamente alinhada com o formulário
type ItemFormData = z.infer<typeof itemSchema>;

export interface ItemEstoque {
  id: string;
  categoria: string;
  tipo: 'patrimonial' | 'consumo';
  numeroSerie: string;
  nivelMinimo: number;
  tombamento?: string;
}

interface Props {
  estoqueId: string;
  nomeEstoque: string;
  isGestor: boolean;
  itensIniciais?: ItemEstoque[];
  onSalvarItem?: (novoItem: ItemFormData) => Promise<void> | void;
}

export const GerenciamentoEstoque: React.FC<Props> = ({
  estoqueId,
  nomeEstoque,
  isGestor,
  itensIniciais = [],
  onSalvarItem,
}) => {
  const [itens, setItens] = useState<ItemEstoque[]>(itensIniciais);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormData>({
    // O erro do resolver deve sumir agora
    resolver: zodResolver(itemSchema),
    defaultValues: {
      categoria: '',
      tipo: 'patrimonial',
      numeroSerie: '',
      nivelMinimo: 1,
      tombamento: '',
    },
  });

  const tipoSelecionado = watch('tipo');

  // O erro do onSubmit também some
  const onSubmit = async (data: ItemFormData) => {
    setSucessoMsg(null);

    if (data.tipo === 'patrimonial' && data.tombamento) {
      const tombamentoExistente = itens.some(
        (item) => item.tombamento?.trim().toLowerCase() === data.tombamento?.trim().toLowerCase()
      );

      if (tombamentoExistente) {
        setError('tombamento', {
          type: 'manual',
          message: `O tombamento "${data.tombamento}" já existe neste estoque.`,
        });
        return;
      }
    }

    try {
      if (onSalvarItem) {
        await onSalvarItem(data);
      }

      const novoItem: ItemEstoque = {
        id: crypto.randomUUID(),
        ...data,
      };

      setItens((prev) => [novoItem, ...prev]);
      setSucessoMsg('Item cadastrado com sucesso!');
      reset();
    } catch {
      setError('root', {
        type: 'manual',
        message: 'Ocorreu um erro ao salvar o item.',
      });
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-6 space-y-8">
      {/* Cabeçalho */}
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="h-7 w-7 text-blue-600" />
          Estoque: {nomeEstoque}
        </h1>
        <p className="text-sm text-gray-500 mt-1">ID: {estoqueId}</p>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
              <input
                type="text"
                {...register('categoria')}
                className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              {errors.categoria && <p className="text-xs text-red-600 mt-1">{errors.categoria.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
              <select
                {...register('tipo')}
                className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-2 focus:ring-blue-500"
              >
                <option value="patrimonial">Patrimonial</option>
                <option value="consumo">Consumo</option>
              </select>
              {errors.tipo && <p className="text-xs text-red-600 mt-1">{errors.tipo.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nº de Série *</label>
              <input
                type="text"
                {...register('numeroSerie')}
                className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              {errors.numeroSerie && <p className="text-xs text-red-600 mt-1">{errors.numeroSerie.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nível Mínimo *</label>
              <input
                type="number"
                min="0"
                // 3. Adicionado valueAsNumber: true para que o React avise ao Zod que isso é um Number
                {...register('nivelMinimo', { valueAsNumber: true })}
                className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              {errors.nivelMinimo && <p className="text-xs text-red-600 mt-1">{errors.nivelMinimo.message}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tombamento {tipoSelecionado === 'patrimonial' && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                disabled={tipoSelecionado === 'consumo'}
                {...register('tombamento')}
                className={`w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-2 focus:ring-blue-500 ${
                  tipoSelecionado === 'consumo' ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
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

      {/* Listagem */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="text-base font-semibold text-gray-800">Itens do Estoque</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-100 text-gray-700 uppercase text-xs font-medium">
              <tr>
                <th className="px-6 py-3">Categoria</th>
                <th className="px-6 py-3">Tipo</th>
                <th className="px-6 py-3">Série</th>
                <th className="px-6 py-3">Tombamento</th>
                <th className="px-6 py-3">Mínimo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {itens.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Nenhum item cadastrado.</td>
                </tr>
              ) : (
                itens.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">{item.categoria}</td>
                    <td className="px-6 py-4 capitalize">{item.tipo}</td>
                    <td className="px-6 py-4 font-mono">{item.numeroSerie}</td>
                    <td className="px-6 py-4 font-mono">{item.tombamento || '-'}</td>
                    <td className="px-6 py-4">{item.nivelMinimo}</td>
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