import { RegistrarJustificativaPermanenciaSchema } from './registrar-justificativa-permanencia.dto';

const analisar = (entrada: unknown) => RegistrarJustificativaPermanenciaSchema.safeParse(entrada);

describe('RegistrarJustificativaPermanenciaSchema', () => {
  it('aceita justificativa preenchida e remove espaços nas pontas', () => {
    const resultado = analisar({ justificativa: '  Em uso no projeto  ' });

    expect(resultado.success && resultado.data.justificativa).toBe('Em uso no projeto');
  });

  it.each([[{}], [{ justificativa: '' }], [{ justificativa: '   ' }]])('recusa %j', (entrada) => {
    expect(analisar(entrada).success).toBe(false);
  });

  it('aceita 1000 caracteres e recusa 1001', () => {
    expect(analisar({ justificativa: 'a'.repeat(1000) }).success).toBe(true);
    expect(analisar({ justificativa: 'a'.repeat(1001) }).success).toBe(false);
  });
});
