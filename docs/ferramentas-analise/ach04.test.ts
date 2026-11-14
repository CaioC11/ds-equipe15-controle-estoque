// ACH-04. Para rodar: copiar para back/src/modules/movimentacoes/dto/ e executar `npx vitest run src/modules/movimentacoes/dto/ach04.test.ts`
import 'reflect-metadata';
import { it } from 'vitest';
import { validate } from 'class-validator';
import { ZodValidationPipe } from 'nestjs-zod';
import { RegistrarMovimentacaoDto } from './registrar-movimentacao.dto';

it('ACH-04: pipe global valida DTO class-validator?', async () => {
  const entrada = { itemId: 'x', tipo: 'INVALIDO', quantidade: -5 };
  try {
    const saida = new ZodValidationPipe().transform(entrada, { type: 'body', metatype: RegistrarMovimentacaoDto });
    console.log('pipe global devolveu sem erro:', JSON.stringify(saida));
  } catch (e) {
    console.log('pipe global LANCOU:', (e as Error).constructor.name);
  }
  const erros = await validate(Object.assign(new RegistrarMovimentacaoDto(), entrada));
  console.log('class-validator apontaria', erros.length, 'erro(s)');
});
