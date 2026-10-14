import { createZodDto } from 'nestjs-zod';
import { ItemBaseSchema } from './create-item.dto';

// O tipo do item não muda depois de cadastrado.
// As regras que dependem do tipo são checadas no service.
export const UpdateItemSchema = ItemBaseSchema.omit({ tipo: true }).partial();

export class UpdateItemDto extends createZodDto(UpdateItemSchema) {}
