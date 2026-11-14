// Para rodar: copiar para front/src/services/ e executar `npx vitest run src/services/erro.test.ts`
import { describe, it, expect } from 'vitest';
import { getApiErrorMessage } from './api';

const BASE = 'https://controle-estoque-emprestimos.example/problems';
const make = (status: number, body: object) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });

describe('ACH-03: corpo problem+json do filtro do back', () => {
  it('409 conflito (tombamento duplicado)', async () => {
    const res = make(409, {
      type: `${BASE}/conflict`, title: 'Conflito de dados', status: 409,
      detail: 'Já existe um item com este tombamento.',
      instance: '/x', code: 'CONFLICT', timestamp: new Date().toISOString(),
    });
    const msg = await getApiErrorMessage(res, 'fallback');
    console.log('MENSAGEM 409 =>', msg);
    expect(msg.startsWith('{')).toBe(true);
  });

  it('422 validação Zod (com errors por campo)', async () => {
    const res = make(422, {
      type: `${BASE}/validation-failed`, title: 'Dados inválidos', status: 422,
      detail: 'Um ou mais campos precisam ser corrigidos.',
      instance: '/x', code: 'VALIDATION_FAILED', timestamp: new Date().toISOString(),
      errors: { nome: ['Obrigatório'] },
    });
    const msg = await getApiErrorMessage(res, 'fallback');
    console.log('MENSAGEM 422 =>', msg);
    expect(msg.startsWith('{')).toBe(true);
  });
});

