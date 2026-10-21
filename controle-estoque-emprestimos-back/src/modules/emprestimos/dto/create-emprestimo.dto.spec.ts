import { CreateEmprestimoSchema } from './create-emprestimo.dto';

const base = {
  itemId: 'item-1',
  responsavel: { nome: 'Maria Silva', siape: '1234567', lotacao: 'CIn', cargo: 'Professora' },
};

describe('CreateEmprestimoSchema', () => {
  it('aceita empréstimo sem prazo (indefinido) e sem data de retirada', () => {
    const r = CreateEmprestimoSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it('aceita prazo nulo', () => {
    expect(CreateEmprestimoSchema.safeParse({ ...base, prazoDevolucao: null }).success).toBe(true);
  });

  it('converte o prazo de texto ISO para Date', () => {
    const r = CreateEmprestimoSchema.parse({ ...base, prazoDevolucao: '2030-01-31' });
    expect(r.prazoDevolucao).toBeInstanceOf(Date);
  });

  it('exige o item', () => {
    expect(CreateEmprestimoSchema.safeParse({ responsavel: base.responsavel }).success).toBe(false);
  });

  it('exige o responsável com nome, lotação e cargo', () => {
    expect(CreateEmprestimoSchema.safeParse({ itemId: 'i' }).success).toBe(false);
    for (const campo of ['nome', 'lotacao', 'cargo']) {
      const responsavel = { ...base.responsavel, [campo]: '' };
      expect(CreateEmprestimoSchema.safeParse({ ...base, responsavel }).success).toBe(false);
    }
  });

  it('exige Siape ou CPF', () => {
    const { siape: _siape, ...semId } = base.responsavel;
    expect(CreateEmprestimoSchema.safeParse({ ...base, responsavel: semId }).success).toBe(false);
    expect(
      CreateEmprestimoSchema.safeParse({
        ...base,
        responsavel: { ...semId, cpf: '123.456.789-01' },
      }).success,
    ).toBe(true);
  });

  it('normaliza o CPF para só dígitos e recusa CPF com tamanho inválido', () => {
    const ok = CreateEmprestimoSchema.parse({
      ...base,
      responsavel: { ...base.responsavel, cpf: '123.456.789-01' },
    });
    expect(ok.responsavel.cpf).toBe('12345678901');
    expect(
      CreateEmprestimoSchema.safeParse({
        ...base,
        responsavel: { ...base.responsavel, cpf: '123' },
      }).success,
    ).toBe(false);
  });

  it('recusa e-mail inválido', () => {
    const responsavel = { ...base.responsavel, email: 'nao-e-email' };
    expect(CreateEmprestimoSchema.safeParse({ ...base, responsavel }).success).toBe(false);
  });

  it('recusa prazo anterior à data de retirada', () => {
    const r = CreateEmprestimoSchema.safeParse({
      ...base,
      dataRetirada: '2030-02-01',
      prazoDevolucao: '2030-01-01',
    });
    expect(r.success).toBe(false);
  });

  it('recusa data inválida', () => {
    expect(CreateEmprestimoSchema.safeParse({ ...base, prazoDevolucao: 'amanhã' }).success).toBe(
      false,
    );
  });
});
