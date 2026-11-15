import { TipoMovimentacao } from '@prisma/client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RegistrarMovimentacaoSchema = z.object({
  itemId: z.string().trim().min(1),
  tipo: z.nativeEnum(TipoMovimentacao),
  quantidade: z.number().int().positive(),
  observacao: z.string().optional(),
});

export class RegistrarMovimentacaoDto extends createZodDto(RegistrarMovimentacaoSchema) {}
