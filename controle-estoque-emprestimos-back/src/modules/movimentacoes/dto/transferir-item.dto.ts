import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const texto = (obrigatorio: string) =>
  z.string({ required_error: obrigatorio }).trim().min(1, obrigatorio);

export const TransferirItemSchema = z.object({
  itemId: texto('Item é obrigatório'),
  estoqueOrigemId: texto('Estoque de origem é obrigatório'),
  estoqueDestinoId: texto('Estoque de destino é obrigatório'),
  // Obrigatória para item de consumo; em item patrimonial é ignorada (sempre 1 unidade)
  quantidade: z
    .number({ invalid_type_error: 'Quantidade deve ser um número' })
    .int('Quantidade deve ser um inteiro')
    .min(1, 'Quantidade deve ser maior que zero')
    .optional(),
  observacao: z.string().trim().optional(),
});

export class TransferirItemDto extends createZodDto(TransferirItemSchema) {}