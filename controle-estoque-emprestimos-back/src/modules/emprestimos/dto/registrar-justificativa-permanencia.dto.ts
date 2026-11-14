import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Justificativa de permanência (A5): motivo pelo qual o item segue com o responsável após o prazo.
export const RegistrarJustificativaPermanenciaSchema = z.object({
  justificativa: z
    .string({ required_error: 'Justificativa é obrigatória' })
    .trim()
    .min(1, 'Justificativa é obrigatória')
    .max(1000, 'Justificativa deve ter no máximo 1000 caracteres'),
});

export class RegistrarJustificativaPermanenciaDto extends createZodDto(
  RegistrarJustificativaPermanenciaSchema,
) {}
