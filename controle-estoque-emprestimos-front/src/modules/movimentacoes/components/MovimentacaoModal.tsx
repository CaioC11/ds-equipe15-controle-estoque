import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SimpleSelect, Text } from '@cincoders/cinnamon';
import { FormModal } from '../../../components/FormModal';
import { TIPO_MOVIMENTACAO_LABELS, TIPOS_FORMULARIO } from '../movimentacao.types';
import type { RegistrarMovimentacaoDto, SaldoItem } from '../movimentacao.types';

const INPUT_CLASS =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 dark:text-gray-300';

const movimentacaoFormSchema = z.object({
  itemId: z.string().min(1, 'Selecione o item.'),
  tipo: z.enum(TIPOS_FORMULARIO),
  // Mantida como texto no formulário; convertida para número no envio.
  quantidade: z
    .string()
    .refine(
      (valor) => Number.isInteger(Number(valor)) && Number(valor) >= 1,
      'Informe um número inteiro maior que zero.',
    ),
  observacao: z.string().trim().max(500, 'Máximo de 500 caracteres.'),
});

type MovimentacaoFormValues = z.infer<typeof movimentacaoFormSchema>;

interface MovimentacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dto: RegistrarMovimentacaoDto) => Promise<void>;
  /** Itens do estoque (vêm da tabela de saldo, com o saldo atual de cada um). */
  itens: SaldoItem[];
}

/**
 * Formulário de entrada e saída. Quem renderiza usa `key` para remontar (e
 * resetar) o formulário a cada abertura — mesmo padrão do `EmprestimoModal`.
 */
export function MovimentacaoModal({ isOpen, onClose, onSubmit, itens }: MovimentacaoModalProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MovimentacaoFormValues>({
    resolver: zodResolver(movimentacaoFormSchema),
    defaultValues: { itemId: '', tipo: 'ENTRADA', quantidade: '', observacao: '' },
  });

  const submitMovimentacao = handleSubmit(async (values) => {
    await onSubmit({
      itemId: values.itemId,
      tipo: values.tipo,
      quantidade: Number(values.quantidade),
      observacao: values.observacao || undefined,
    });
    onClose();
  });

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={submitMovimentacao}
      title="Registrar Movimentação"
      titleVariant="headline"
      isSubmitting={isSubmitting}
      submitLabel="Registrar"
      size="lg"
    >
      <div>
        <label className={LABEL_CLASS}>Item *</label>
        {itens.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Este estoque não tem itens cadastrados.
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL_CLASS}>Tipo *</label>
          <Controller
            name="tipo"
            control={control}
            render={({ field }) => (
              <SimpleSelect
                value={field.value}
                onValueChange={(value) => field.onChange(value ?? 'ENTRADA')}
                className="mt-1 w-full"
                placeholder="Selecione o tipo"
                items={TIPOS_FORMULARIO.map((tipo) => ({
                  value: tipo,
                  label: TIPO_MOVIMENTACAO_LABELS[tipo],
                }))}
              />
            )}
          />
          {errors.tipo && <Text variant="alarm">{errors.tipo.message}</Text>}
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
          {errors.quantidade && <Text variant="alarm">{errors.quantidade.message}</Text>}
        </div>
      </div>

      <div>
        <label className={LABEL_CLASS}>Observação</label>
        <input
          type="text"
          {...register('observacao')}
          placeholder="Ex: compra do semestre"
          className={INPUT_CLASS}
        />
        {errors.observacao && <Text variant="alarm">{errors.observacao.message}</Text>}
      </div>
    </FormModal>
  );
}