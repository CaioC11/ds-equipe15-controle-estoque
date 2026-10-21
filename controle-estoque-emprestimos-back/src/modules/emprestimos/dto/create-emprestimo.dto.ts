import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const texto = (obrigatorio: string) =>
  z.string({ required_error: obrigatorio }).trim().min(1, obrigatorio);

// Plano B (A3): o gestor digita os dados do responsável no próprio empréstimo.
// Siape ou CPF identifica o responsável para reaproveitá-lo em novos empréstimos.
export const ResponsavelInputSchema = z
  .object({
    nome: texto('Nome do responsável é obrigatório'),
    siape: z.string().trim().min(1, 'Siape inválido').optional(),
    cpf: z
      .string()
      .trim()
      .transform((valor) => valor.replace(/\D/g, ''))
      .refine((valor) => valor.length === 11, 'CPF deve ter 11 dígitos')
      .optional(),
    lotacao: texto('Lotação do responsável é obrigatória'),
    cargo: texto('Cargo do responsável é obrigatório'),
    email: z.string().trim().email('E-mail inválido').optional(),
  })
  .refine((dados) => Boolean(dados.siape || dados.cpf), {
    path: ['siape'],
    message: 'Informe o Siape ou o CPF do responsável',
  });

export const CreateEmprestimoSchema = z
  .object({
    itemId: texto('Item é obrigatório'),
    responsavel: ResponsavelInputSchema,
    // Omitida = agora
    dataRetirada: z.coerce.date({ invalid_type_error: 'Data de retirada inválida' }).optional(),
    // Omitido ou null = prazo "indefinido"
    prazoDevolucao: z.coerce.date({ invalid_type_error: 'Prazo de devolução inválido' }).nullish(),
    observacoes: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.dataRetirada && data.prazoDevolucao && data.prazoDevolucao < data.dataRetirada) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['prazoDevolucao'],
        message: 'O prazo de devolução não pode ser anterior à data de retirada',
      });
    }
  });

export class CreateEmprestimoDto extends createZodDto(CreateEmprestimoSchema) {}
