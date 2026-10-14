import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateEstoqueSchema = z.object({
  nome: z
    .string({ required_error: 'Nome é obrigatório' })
    .trim()
    .min(1, 'Nome é obrigatório'),
  descricao: z.string().optional(),
  localizacao: z.string().optional(),
});

export class CreateEstoqueDto extends createZodDto(CreateEstoqueSchema) {}