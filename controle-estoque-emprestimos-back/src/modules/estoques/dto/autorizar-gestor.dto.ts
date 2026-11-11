import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AutorizarGestorSchema = z.object({
  usuarioId: z.string().trim().min(1, 'ID do usuário é obrigatório'),
});

export class AutorizarGestorDto extends createZodDto(AutorizarGestorSchema) {}
