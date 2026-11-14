import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const texto = (obrigatorio: string) =>
  z.string({ required_error: obrigatorio }).trim().min(1, obrigatorio);

export const ItemBaseSchema = z.object({
  tipo: z.enum(['PATRIMONIAL', 'CONSUMO'], {
    required_error: 'Tipo é obrigatório',
    invalid_type_error: 'Tipo deve ser PATRIMONIAL ou CONSUMO',
  }),
  nome: texto('Nome é obrigatório'),
  categoriaId: texto('Categoria é obrigatória'),
  descricao: z.string().trim().optional(),
  tombamento: z.string().trim().min(1, 'Tombamento inválido').optional(),
  numeroSerie: z.string().trim().min(1, 'Nº de série inválido').optional(),
  nivelMinimo: z
    .number({ invalid_type_error: 'Nível mínimo deve ser um número' })
    .int('Nível mínimo deve ser inteiro')
    .min(0, 'Nível mínimo não pode ser negativo')
    .optional(),
});

// No cadastro, tombamento vazio é aceito em item patrimonial (fica pendente de tombamento).
// Na edição (UpdateItemSchema) continua valendo o min(1): não dá para esvaziar.
export const CreateItemSchema = ItemBaseSchema.extend({
  tombamento: z
    .string()
    .trim()
    .optional()
    .transform((valor) => (valor === '' ? undefined : valor)),
}).superRefine((data, ctx) => {
  if (data.tipo === 'CONSUMO' && data.tombamento) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tombamento'],
      message: 'Item de consumo não possui tombamento',
    });
  }
});

export class CreateItemDto extends createZodDto(CreateItemSchema) {}