import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CompletarTombamentoSchema = z.object({
  tombamento: z
    .string({
      required_error: 'Tombamento é obrigatório',
      invalid_type_error: 'Tombamento inválido',
    })
    .trim()
    .min(1, 'Tombamento é obrigatório'),
});

export class CompletarTombamentoDto extends createZodDto(CompletarTombamentoSchema) {}