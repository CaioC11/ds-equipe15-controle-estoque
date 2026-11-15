import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SimpleSelect, Text } from '@cincoders/cinnamon';
import { FormModal } from '../../../components/FormModal';
import type { SaldoItem, TransferirItemDto } from '../movimentacao.types';

const INPUT_CLASS =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 dark:text-gray-300';

const transferenciaFormSchema = z.object({
  itemId: z.string().min(1, 'Selecione o item.'),
  estoqueDestinoId: z.string().min(1, 'Selecione o estoque de destino.'),
  // Mantida como texto no formulário; convertida para número no envio.
  quantidade: z
    .string()
    .refine(
      (valor) => Number.isInteger(Number(valor)) && Number(valor) >= 1,
      'Informe um número inteiro maior que zero.',
    ),
  observacao: z.string().trim().max(500, 'Máximo de 500 caracteres.'),
});

type TransferenciaFormValues = z.infer<typeof transferenciaFormSchema>;

interface TransferenciaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dto: TransferirItemDto) => Promise<void>;
  /** Estoque de origem: o que está selecionado na tela. */
  estoqueOrigemId: string;
  /** Itens do estoque de origem (vêm da tabela de saldo). */
  itens: SaldoItem[];
  /** Estoques candidatos a destino (a origem é removida aqui dentro). */
  estoques: Array<{ id: string; nome: string }>;
}

/**
 * Formulário de transferência de item entre estoques. Quem renderiza usa `key`
 * para remontar (e resetar) o formulário a cada abertura, como no MovimentacaoModal.
 */
export function TransferenciaModal({
  isOpen,
  onClose,
  onSubmit,
  estoqueOrigemId,
  itens,
  estoques,
}: TransferenciaModalProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TransferenciaFormValues>({
    resolver: zodResolver(transferenciaFormSchema),
    defaultValues: { itemId: '', estoqueDestinoId: '', quantidade: '1', observacao: '' },
  });

  const destinos = estoques.filter((estoque) => estoque.id !== estoqueOrigemId);

  const submitTransferencia = handleSubmit(async (values) => {
    await onSubmit({
      itemId: values.itemId,
      estoqueOrigemId,
      estoqueDestinoId: values.estoqueDestinoId,
      quantidade: Number(values.quantidade),
      observacao: values.observacao || undefined,
    });
    onClose();
  });

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={submitTransferencia}
      title="Transferir Item"
      titleVariant="headline"
      isSubmitting={isSubmitting}
      submitLabel="Transferir"
      size="lg"
    >
      <div>
        <label className={LABEL_CLASS}>Item *</label>
        {itens.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Este estoque não tem itens para transferir.
          </p>
        ) : (
          <Controller
            name="itemId"
            control={control}
            render={({ field }) => (
              <SimpleSelect
                value={field.value}
                onValueChange={(value) => field.onChange(value ?? '')}
                className="mt-1 w-full"
                placeholder="Selecione o item"
                items={itens.map((item) => ({
                  value: item.itemId,
                  label: `${item.nomeItem} (saldo: ${item.saldo})`,
                }))}
              />
            )}
          />
        )}
        {errors.itemId && <Text variant="alarm">{errors.itemId.message}</Text>}
      </div>

      <div>
        <label className={LABEL_CLASS}>Estoque de destino *</label>
        {destinos.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Não há outro estoque disponível como destino.
          </p>
        ) : (
          <Controller
            name="estoqueDestinoId"
            control={control}
            render={({ field }) => (
              <SimpleSelect
                value={field.value}
                onValueChange={(value) => field.onChange(value ?? '')}
                className="mt-1 w-full"
                placeholder="Selecione o estoque de destino"
                items={destinos.map((estoque) => ({ value: estoque.id, label: estoque.nome }))}
              />
            )}
          />
        )}
        {errors.estoqueDestinoId && <Text variant="alarm">{errors.estoqueDestinoId.message}</Text>}
      </div>

      <div>
        <label className={LABEL_CLASS}>Quantidade *</label>
        <input
          type="number"
          min={1}
          step={1}
          {...register('quantidade')}
          placeholder="Ex: 5"
          className={INPUT_CLASS}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Em item patrimonial a transferência é sempre de 1 unidade.
        </p>
        {errors.quantidade && <Text variant="alarm">{errors.quantidade.message}</Text>}
      </div>

      <div>
        <label className={LABEL_CLASS}>Observação</label>
        <input
          type="text"
          {...register('observacao')}
          placeholder="Ex: reposição do laboratório"
          className={INPUT_CLASS}
        />
        {errors.observacao && <Text variant="alarm">{errors.observacao.message}</Text>}
      </div>
    </FormModal>
  );
}