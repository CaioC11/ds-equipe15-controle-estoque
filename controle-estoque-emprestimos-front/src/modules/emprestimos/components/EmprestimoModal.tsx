import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SimpleSelect, Text } from '@cincoders/cinnamon';
import { FormModal } from '../../../components/FormModal';
import type { CreateEmprestimoDto, Item } from '../emprestimo.types';
import { fimDoDiaISO, hojeLocalISO } from '../emprestimo.utils';

const INPUT_CLASS =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 dark:text-gray-300';

const emprestimoFormSchema = z.object({
  itemId: z.string().min(1, 'Selecione o item.'),
  nome: z.string().trim().min(1, 'O nome do responsável é obrigatório.'),
  siape: z.string().trim().min(1, 'O Siape é obrigatório.'),
  lotacao: z.string().trim().min(1, 'A lotação é obrigatória.'),
  cargo: z.string().trim().min(1, 'O cargo é obrigatório.'),
  // Vazio = prazo indefinido
  prazoDevolucao: z
    .string()
    .refine((data) => data === '' || data >= hojeLocalISO(), 'O prazo não pode ser anterior a hoje.'),
});

type EmprestimoFormValues = z.infer<typeof emprestimoFormSchema>;

interface EmprestimoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateEmprestimoDto) => Promise<void>;
  /** Itens patrimoniais disponíveis, sem empréstimo em aberto. */
  itens: Item[];
}

/**
 * Formulário de novo empréstimo. Plano B do responsável: o gestor digita nome,
 * Siape, lotação e cargo. Quem renderiza usa `key` para remontar (e resetar)
 * o formulário a cada abertura — mesmo padrão do `TodoModal`.
 */
export function EmprestimoModal({ isOpen, onClose, onSubmit, itens }: EmprestimoModalProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmprestimoFormValues>({
    resolver: zodResolver(emprestimoFormSchema),
    defaultValues: { itemId: '', nome: '', siape: '', lotacao: '', cargo: '', prazoDevolucao: '' },
  });

  const submitEmprestimo = handleSubmit(async (values) => {
    await onSubmit({
      itemId: values.itemId,
      responsavel: {
        nome: values.nome,
        siape: values.siape,
        lotacao: values.lotacao,
        cargo: values.cargo,
      },
      prazoDevolucao: values.prazoDevolucao ? fimDoDiaISO(values.prazoDevolucao) : undefined,
    });
    onClose();
  });

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={submitEmprestimo}
      title="Novo Empréstimo"
      titleVariant="headline"
      isSubmitting={isSubmitting}
      submitLabel="Registrar Empréstimo"
      size="lg"
    >
      <div>
        <label className={LABEL_CLASS}>Item *</label>
        {itens.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Nenhum item disponível para empréstimo neste estoque.
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
                  value: item.id,
                  label: item.tombamento ? `${item.nome} (tomb. ${item.tombamento})` : item.nome,
                }))}
              />
            )}
          />
        )}
        {errors.itemId && <Text variant="alarm">{errors.itemId.message}</Text>}
      </div>

      <div>
        <label className={LABEL_CLASS}>Nome do responsável *</label>
        <input type="text" {...register('nome')} placeholder="Ex: Maria Silva" className={INPUT_CLASS} />
        {errors.nome && <Text variant="alarm">{errors.nome.message}</Text>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL_CLASS}>Siape *</label>
          <input type="text" {...register('siape')} className={INPUT_CLASS} />
          {errors.siape && <Text variant="alarm">{errors.siape.message}</Text>}
        </div>
        <div>
          <label className={LABEL_CLASS}>Lotação *</label>
          <input type="text" {...register('lotacao')} placeholder="Ex: CIn" className={INPUT_CLASS} />
          {errors.lotacao && <Text variant="alarm">{errors.lotacao.message}</Text>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL_CLASS}>Cargo *</label>
          <input type="text" {...register('cargo')} placeholder="Ex: Professor" className={INPUT_CLASS} />
          {errors.cargo && <Text variant="alarm">{errors.cargo.message}</Text>}
        </div>
        <div>
          <label className={LABEL_CLASS}>Prazo de devolução</label>
          <input type="date" min={hojeLocalISO()} {...register('prazoDevolucao')} className={INPUT_CLASS} />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Vazio = indefinido</p>
          {errors.prazoDevolucao && <Text variant="alarm">{errors.prazoDevolucao.message}</Text>}
        </div>
      </div>
    </FormModal>
  );
}
