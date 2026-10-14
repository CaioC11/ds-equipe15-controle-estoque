import { createZodDto } from 'nestjs-zod';
import { CreateEstoqueSchema } from './create-estoque.dto';

export const UpdateEstoqueSchema = CreateEstoqueSchema.partial();

export class UpdateEstoqueDto extends createZodDto(UpdateEstoqueSchema) {}