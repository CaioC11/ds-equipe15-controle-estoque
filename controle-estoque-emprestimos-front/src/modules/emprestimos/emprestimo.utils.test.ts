import { describe, it, expect } from 'vitest';
import { fimDoDiaISO, formatarData, hojeLocalISO } from './emprestimo.utils';

describe('hojeLocalISO', () => {
  it('formata a data local como YYYY-MM-DD, com zeros à esquerda', () => {
    expect(hojeLocalISO(new Date(2030, 0, 5, 23, 59))).toBe('2030-01-05');
    expect(hojeLocalISO(new Date(2030, 11, 31, 0, 0))).toBe('2030-12-31');
  });
});

describe('fimDoDiaISO', () => {
  it('leva o prazo para 23:59:59 do dia escolhido, no fuso local', () => {
    const prazo = new Date(fimDoDiaISO('2030-12-31'));

    expect([prazo.getFullYear(), prazo.getMonth(), prazo.getDate()]).toEqual([2030, 11, 31]);
    expect([prazo.getHours(), prazo.getMinutes(), prazo.getSeconds()]).toEqual([23, 59, 59]);
  });

  it('gera uma data ISO válida', () => {
    expect(fimDoDiaISO('2030-12-31')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

describe('formatarData', () => {
  it('mostra o mesmo dia que o usuário escolheu (sem deslocar pelo fuso)', () => {
    expect(formatarData(fimDoDiaISO('2030-12-31'))).toBe('31/12/2030');
  });

  it('retorna null quando não há data (prazo indefinido)', () => {
    expect(formatarData(null)).toBeNull();
    expect(formatarData(undefined)).toBeNull();
  });
});
