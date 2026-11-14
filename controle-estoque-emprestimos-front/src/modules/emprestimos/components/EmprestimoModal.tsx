import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SimpleSelect, Text } from '@cincoders/cinnamon';
import { FormModal } from '../../../components/FormModal';
import type { CreateEmprestimoDto, Item, Responsavel } from '../emprestimo.types';
import { fimDoDiaISO, hojeLocalISO } from '../emprestimo.utils';

const INPUT_CLASS =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 dark:text-gray-300';

const emprestimoFormSchema = z
  .object({
    itemId: z.string().min(1, 'Selecione o item.'),
    responsavelId: z.string(),
    nome: z.string().trim(),
    siape: z.string().trim(),
    cpf: z.string().trim(),
    lotacao: z.string().trim(),
    cargo: z.string().trim(),
    prazoDevolucao: z
      .string()
      .refine(
        (data) => data === '' || data >= hojeLocalISO(),
        'O prazo não pode ser anterior a hoje.',
      ),
  })
  .superRefine((data, ctx) => {
    if (data.responsavelId) return;
    for (const [campo, mensagem] of [
      ['nome', 'O nome do responsável é obrigatório.'],
      ['lotacao', 'A lotação é obrigatória.'],
      ['cargo', 'O cargo é obrigatório.'],
    ] as const) {
      if (!data[campo]) ctx.addIssue({ code: 'custom', path: [campo], message: mensagem });
    }
    if (!data.siape && !data.cpf)
      ctx.addIssue({ code: 'custom', path: ['siape'], message: 'Informe o Siape ou o CPF.' });
    if (data.cpf && data.cpf.replace(/\D/g, '').length !== 11) {
      ctx.addIssue({ code: 'custom', path: ['cpf'], message: 'CPF deve ter 11 dígitos.' });
    }
  });

type EmprestimoFormValues = z.infer<typeof emprestimoFormSchema>;

interface EmprestimoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateEmprestimoDto) => Promise<void>;
  /** Itens patrimoniais disponíveis, sem empréstimo em aberto. */
  itens: Item[];
  responsaveis?: Responsavel[];
}

/**
 * Formulário de novo empréstimo: seleciona um cadastro existente ou informa um novo.
 * A seleção envia somente o identificador, preservando o cadastro. Quem renderiza usa `key` para remontar (e resetar)
 * o formulário a cada abertura — mesmo padrão do `TodoModal`.
 */
export function EmprestimoModal({
  isOpen,
  onClose,
  onSubmit,
  itens,
  responsaveis = [],
}: EmprestimoModalProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmprestimoFormValues>({
    resolver: zodResolver(emprestimoFormSchema),
    defaultValues: {
      itemId: '',
      responsavelId: '',
      nome: '',
      siape: '',
      cpf: '',
      lotacao: '',
      cargo: '',
      prazoDevolucao: '',
    },
  });

  const responsavelId = useWatch({ control, name: 'responsavelId' });

  const submitEmprestimo = handleSubmit(async (values) => {
    await onSubmit({
      itemId: values.itemId,
      ...(values.responsavelId
        ? { responsavelId: values.responsavelId }
        : {
            responsavel: {
              nome: values.nome,
              siape: values.siape || undefined,
              cpf: values.cpf ? values.cpf.replace(/\D/g, '') : undefined,
              lotacao: values.lotacao,
              cargo: values.cargo,
            },
          }),
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
        <label htmlFor="responsavelId" className={LABEL_CLASS}>
          Responsável cadastrado
        </label>
        <select id="responsavelId" {...register('responsavelId')} className={INPUT_CLASS}>
          <option value="">Cadastrar responsável no ato</option>
          {responsaveis.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nome} — {r.siape ? `Siape ${r.siape}` : `CPF ${r.cpf}`}
            </option>
          ))}
        </select>
      </div>

      {!responsavelId && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(
            [
              { name: 'nome', label: 'Nome do responsável *', placeholder: 'Ex: Maria Silva' },
              { name: 'siape', label: 'Siape (ou informe CPF abaixo)', placeholder: '' },
              { name: 'cpf', label: 'CPF (se não houver Siape)', placeholder: '' },
              { name: 'lotacao', label: 'Lotação *', placeholder: 'Ex: CIn' },
              { name: 'cargo', label: 'Cargo *', placeholder: 'Ex: Professor' },
            ] as const
          ).map((campo) => (
            <div key={campo.name} className={campo.name === 'nome' ? 'sm:col-span-2' : undefined}>
              <label htmlFor={`responsavel-${campo.name}`} className={LABEL_CLASS}>
                {campo.label}
              </label>
              <input
                id={`responsavel-${campo.name}`}
                type="text"
                {...register(campo.name)}
                placeholder={campo.placeholder}
                className={INPUT_CLASS}
              />
              {errors[campo.name] && <Text variant="alarm">{errors[campo.name]?.message}</Text>}
            </div>
          ))}
        </div>
      )}
      <div>
        <label htmlFor="prazo-devolucao" className={LABEL_CLASS}>
          Prazo de devolução
        </label>
        <input
          id="prazo-devolucao"
          type="date"
          min={hojeLocalISO()}
          {...register('prazoDevolucao')}
          className={INPUT_CLASS}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Vazio = indefinido</p>
        {errors.prazoDevolucao && <Text variant="alarm">{errors.prazoDevolucao.message}</Text>}
      </div>
    </FormModal>
  );
}
