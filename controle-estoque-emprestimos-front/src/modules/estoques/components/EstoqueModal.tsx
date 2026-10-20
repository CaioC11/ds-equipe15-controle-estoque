import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Text } from '@cincoders/cinnamon';
import { FormModal } from '../../../components/FormModal';
import { EstoqueApiError } from '../estoque.service';
import type { CreateEstoqueDto, Estoque } from '../estoque.types';

const estoqueFormSchema = z.object({
  nome: z.string().trim().min(1, 'O nome do estoque é obrigatório.'),
  localizacao: z.string().trim(),
  descricao: z.string().trim(),
});

type EstoqueFormValues = z.infer<typeof estoqueFormSchema>;

interface EstoqueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateEstoqueDto) => Promise<void>;
  estoqueToEdit?: Estoque | null;
}

const INPUT_CLASS =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

/**
 * Formulário de criação/edição de estoque. Quem renderiza usa `key` para
 * remontar o formulário a cada abertura (mesmo padrão do TodoModal).
 */
export function EstoqueModal({ isOpen, onClose, onSubmit, estoqueToEdit }: EstoqueModalProps) {
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EstoqueFormValues>({
    resolver: zodResolver(estoqueFormSchema),
    defaultValues: {
      nome: estoqueToEdit?.nome ?? '',
      localizacao: estoqueToEdit?.localizacao ?? '',
      descricao: estoqueToEdit?.descricao ?? '',
    },
  });

  const submitEstoque = handleSubmit(async (values) => {
    // Na edição enviamos os textos como estão (vazio limpa o campo); na criação,
    // campos vazios são omitidos.
    const dto: CreateEstoqueDto = estoqueToEdit
      ? { nome: values.nome, localizacao: values.localizacao, descricao: values.descricao }
      : {
          nome: values.nome,
          localizacao: values.localizacao || undefined,
          descricao: values.descricao || undefined,
        };

    try {
      await onSubmit(dto);
      onClose();
    } catch (err) {
      // A página já mostrou o toast de erro; aqui destacamos o nome duplicado no campo.
      if (err instanceof EstoqueApiError && err.status === 409) {
        setError('nome', { type: 'server', message: err.message });
      }
    }
  });

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={submitEstoque}
      title={estoqueToEdit ? 'Editar Estoque' : 'Novo Estoque'}
      titleVariant="headline"
      isSubmitting={isSubmitting}
      submitLabel={estoqueToEdit ? 'Salvar Alterações' : 'Criar Estoque'}
      size="lg"
    >
      <div>
        <label
          htmlFor={`${formId}-nome`}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Nome *
        </label>
        <input
          id={`${formId}-nome`}
          type="text"
          {...register('nome')}
          placeholder="Ex: Almoxarifado Central"
          className={INPUT_CLASS}
        />
        {errors.nome && <Text variant="alarm">{errors.nome.message}</Text>}
      </div>

      <div>
        <label
          htmlFor={`${formId}-localizacao`}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Localização
        </label>
        <input
          id={`${formId}-localizacao`}
          type="text"
          {...register('localizacao')}
          placeholder="Ex: Bloco A, sala 101"
          className={INPUT_CLASS}
        />
      </div>

      <div>
        <label
          htmlFor={`${formId}-descricao`}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Descrição
        </label>
        <textarea
          id={`${formId}-descricao`}
          rows={3}
          {...register('descricao')}
          placeholder="Descrição opcional do estoque"
          className={INPUT_CLASS}
        />
      </div>
    </FormModal>
  );
}
