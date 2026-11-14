// tests/v2/us03-itens.spec.ts
import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessDeniedException } from '../../src/common/exceptions/access-denied.exception';
import { AppException } from '../../src/common/exceptions/app.exception';
import { ResourceConflictException } from '../../src/common/exceptions/resource-conflict.exception';
import { ResourceNotFoundException } from '../../src/common/exceptions/resource-not-found.exception';
import { AuthGuard } from '../../src/common/auth/guards/auth.guard';
import { RolesGuard } from '../../src/common/auth/guards/roles.guard';
import { CreateItemSchema } from '../../src/modules/itens/dto/create-item.dto';
import { UpdateItemSchema } from '../../src/modules/itens/dto/update-item.dto';
import { ItensController } from '../../src/modules/itens/itens.controller';
import { ItensService } from '../../src/modules/itens/itens.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const patrimonialValido = {
  tipo: 'PATRIMONIAL' as const,
  nome: 'Notebook',
  categoriaId: 'cat-1',
  tombamento: 'TOMB-001',
};

const consumoValido = {
  tipo: 'CONSUMO' as const,
  nome: 'Papel A4',
  categoriaId: 'cat-1',
};

function mensagens(result: { success: boolean; error?: { issues: { message: string; path: (string | number)[] }[] } }) {
  return result.error?.issues.map((i) => i.message) ?? [];
}

function caminhos(result: { success: boolean; error?: { issues: { message: string; path: (string | number)[] }[] } }) {
  return result.error?.issues.map((i) => i.path.join('.')) ?? [];
}

/** Executa a promise, exige que rejeite com a classe esperada e devolve o erro. */
async function esperarErro(
  promise: Promise<unknown>,
  classe: new (...args: any[]) => Error,
  trecho?: string,
  status?: number,
) {
  let erro: any;
  try {
    await promise;
  } catch (e) {
    erro = e;
  }
  expect(erro, 'era esperado que a chamada lançasse erro').toBeDefined();
  expect(erro).toBeInstanceOf(classe);
  if (trecho) {
    const resposta = typeof erro.getResponse === 'function' ? JSON.stringify(erro.getResponse()) : '';
    expect(`${erro.message} ${resposta}`).toContain(trecho);
  }
  if (status !== undefined && typeof erro.getStatus === 'function') {
    expect(erro.getStatus()).toBe(status);
  }
  return erro;
}

function erroP2002(target: unknown) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.0.0',
    meta: target === undefined ? undefined : { target },
  });
}

// ---------------------------------------------------------------------------
// Fake em memória de prisma (usado nos testes de listagem por estoque e de
// unicidade de tombamento: L1, L2, L3, L4, L5, L6, L7, L8, L9, L10)
//
// Regras reproduzidas do banco:
//  - `tombamento` e `numeroSerie` são @unique GLOBALMENTE (entre todos os estoques).
//  - Valores null/undefined NÃO colidem (comportamento do Postgres para NULL em
//    colunas únicas). Itens de consumo sem tombamento, portanto, nunca conflitam.
//  - Ao violar a unicidade, `create`/`update` lançam P2002 com meta.target = [campo].
//  - Em `update`, o próprio item é ignorado na checagem (manter o próprio
//    tombamento não é conflito) e valores `undefined` no data não sobrescrevem
//    (igual ao Prisma).
//  - `findMany`/`findFirst`/`count` respeitam o `where` (igualdade por campo),
//    `orderBy: { nome: 'asc' }`, `skip` e `take`.
// ---------------------------------------------------------------------------

type ItemFake = Record<string, any>;

function criarPrismaFake() {
  const itens: ItemFake[] = [];
  const estoques = new Map<string, { id: string; ativo: boolean }>();
  const gestores = new Set<string>();
  let seq = 0;

  const casa = (item: ItemFake, where: Record<string, unknown> = {}) =>
    Object.entries(where).every(([chave, valor]) => item[chave] === valor);

  const semUndefined = (obj: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

  const validarUnicidade = (candidato: ItemFake, ignorarId?: string) => {
    for (const campo of ['tombamento', 'numeroSerie']) {
      const valor = candidato[campo];
      if (valor === undefined || valor === null) continue;
      const colide = itens.some((i) => i.id !== ignorarId && i[campo] === valor);
      if (colide) throw erroP2002([campo]);
    }
  };

  const prisma = {
    estoque: {
      findUnique: vi.fn(async ({ where }: any) => estoques.get(where.id) ?? null),
    },
    estoqueGestor: {
      findUnique: vi.fn(async ({ where }: any) => {
        const { estoqueId, usuarioId } = where.estoqueId_usuarioId;
        return gestores.has(`${estoqueId}:${usuarioId}`) ? { estoqueId, usuarioId } : null;
      }),
    },
    categoria: {
      findUnique: vi.fn(async ({ where }: any) => ({ id: where.id })),
    },
    item: {
      create: vi.fn(async ({ data }: any) => {
        validarUnicidade(data);
        const novo = { id: `item-${++seq}`, ...semUndefined(data) };
        itens.push(novo);
        return { ...novo };
      }),
      findMany: vi.fn(async ({ where, skip = 0, take }: any = {}) => {
        const filtrados = itens
          .filter((i) => casa(i, where))
          .sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
        const fim = take === undefined ? undefined : skip + take;
        return filtrados.slice(skip, fim).map((i) => ({ ...i }));
      }),
      findFirst: vi.fn(async ({ where }: any = {}) => {
        const achado = itens.find((i) => casa(i, where));
        return achado ? { ...achado } : null;
      }),
      count: vi.fn(async ({ where }: any = {}) => itens.filter((i) => casa(i, where)).length),
      update: vi.fn(async ({ where, data }: any) => {
        const atual = itens.find((i) => i.id === where.id);
        if (!atual) throw new Error('item inexistente no fake');
        const alterado = { ...atual, ...semUndefined(data) };
        validarUnicidade(alterado, atual.id);
        Object.assign(atual, alterado);
        return { ...atual };
      }),
    },
  };

  return {
    prisma,
    itens,
    registrarEstoque: (id: string, ativo = true) => {
      estoques.set(id, { id, ativo });
    },
    registrarGestor: (estoqueId: string, usuarioId: string) => {
      gestores.add(`${estoqueId}:${usuarioId}`);
    },
    /** Insere item direto no armazenamento, sem passar pelo service. */
    semear: (dados: ItemFake) => {
      const novo = { id: `item-${++seq}`, ...semUndefined(dados) };
      validarUnicidade(novo);
      itens.push(novo);
      return { ...novo };
    },
  };
}

// ---------------------------------------------------------------------------
// Schemas (DTOs)
// ---------------------------------------------------------------------------

describe('US03 - CreateItemSchema', () => {
  describe('tipo', () => {
    // Partição válida (PATRIMONIAL) - CA1
    it('aceita tipo PATRIMONIAL com tombamento', () => {
      expect(CreateItemSchema.safeParse(patrimonialValido).success).toBe(true);
    });

    // Partição válida (CONSUMO) - CA4
    it('aceita tipo CONSUMO sem tombamento', () => {
      expect(CreateItemSchema.safeParse(consumoValido).success).toBe(true);
    });

    // LACUNA: CT-03-04 | Partição inválida (valor fora do enum) - CA1
    // Correção C1: não fixa mais o texto da mensagem; verifica falha e path 'tipo'.
    it('rejeita tipo fora do enum', () => {
      const r = CreateItemSchema.safeParse({ ...patrimonialValido, tipo: 'OUTRO' });
      expect(r.success).toBe(false);
      expect(caminhos(r)).toContain('tipo');
    });

    // Partição inválida (ausente) - CA1
    it('rejeita tipo ausente com mensagem de obrigatório', () => {
      const { tipo: _tipo, ...semTipo } = patrimonialValido;
      const r = CreateItemSchema.safeParse(semTipo);
      expect(r.success).toBe(false);
      expect(mensagens(r)).toContain('Tipo é obrigatório');
    });

    // Partição inválida (tipo de dado errado) - CA1
    it('rejeita tipo numérico', () => {
      const r = CreateItemSchema.safeParse({ ...patrimonialValido, tipo: 1 });
      expect(r.success).toBe(false);
    });

    // Partição inválida (caixa diferente do enum) - CA1
    it('rejeita tipo em minúsculas (enum é case-sensitive)', () => {
      const r = CreateItemSchema.safeParse({ ...patrimonialValido, tipo: 'patrimonial' });
      expect(r.success).toBe(false);
    });
  });

  describe('nome', () => {
    // Partição inválida (ausente) - CA1
    it('rejeita nome ausente', () => {
      const { nome: _n, ...semNome } = patrimonialValido;
      const r = CreateItemSchema.safeParse(semNome);
      expect(r.success).toBe(false);
      expect(mensagens(r)).toContain('Nome é obrigatório');
    });

    // Valor-limite: tamanho 0 (abaixo do mínimo) - CA1
    it('rejeita nome vazio (0 caracteres)', () => {
      const r = CreateItemSchema.safeParse({ ...patrimonialValido, nome: '' });
      expect(r.success).toBe(false);
      expect(mensagens(r)).toContain('Nome é obrigatório');
    });

    // Valor-limite: só espaços vira 0 após trim - CA1
    it('rejeita nome só com espaços (0 após trim)', () => {
      const r = CreateItemSchema.safeParse({ ...patrimonialValido, nome: '   ' });
      expect(r.success).toBe(false);
    });

    // Valor-limite: tamanho 1 (no mínimo) - CA1
    it('aceita nome com 1 caractere', () => {
      const r = CreateItemSchema.safeParse({ ...patrimonialValido, nome: 'A' });
      expect(r.success).toBe(true);
    });

    // Partição válida: trim aplicado - CA1
    it('remove espaços nas pontas do nome', () => {
      const r = CreateItemSchema.safeParse({ ...patrimonialValido, nome: '  Notebook  ' });
      expect(r.success && r.data.nome).toBe('Notebook');
    });

    // Partição inválida (tipo de dado) - CA1
    it('rejeita nome numérico', () => {
      expect(CreateItemSchema.safeParse({ ...patrimonialValido, nome: 123 }).success).toBe(false);
    });
  });

  describe('categoriaId', () => {
    // Partição inválida (ausente) - CA1
    it('rejeita categoriaId ausente', () => {
      const { categoriaId: _c, ...semCategoria } = patrimonialValido;
      const r = CreateItemSchema.safeParse(semCategoria);
      expect(r.success).toBe(false);
      expect(mensagens(r)).toContain('Categoria é obrigatória');
    });

    // Valor-limite: tamanho 0 - CA1
    it('rejeita categoriaId vazio', () => {
      const r = CreateItemSchema.safeParse({ ...patrimonialValido, categoriaId: '' });
      expect(r.success).toBe(false);
      expect(mensagens(r)).toContain('Categoria é obrigatória');
    });

    // Valor-limite: só espaços - CA1
    it('rejeita categoriaId só com espaços', () => {
      expect(CreateItemSchema.safeParse({ ...patrimonialValido, categoriaId: '  ' }).success).toBe(false);
    });

    // Valor-limite: tamanho 1 - CA1
    it('aceita categoriaId com 1 caractere', () => {
      expect(CreateItemSchema.safeParse({ ...patrimonialValido, categoriaId: 'x' }).success).toBe(true);
    });
  });

  describe('tombamento x tipo', () => {
    // Critério S3-19 (CA1): patrimonial sem tombamento (campo ausente) fica pendente
    it('CA1/S3-19: aceita patrimonial sem tombamento', () => {
      const { tombamento: _t, ...semTomb } = patrimonialValido;
      const r = CreateItemSchema.safeParse(semTomb);
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.tombamento).toBeUndefined();
      }
    });

    // Critério S3-19 (CA1): string vazia vira undefined (pendente)
    it('CA1/S3-19: aceita patrimonial com tombamento vazio (vira undefined)', () => {
      const r = CreateItemSchema.safeParse({ ...patrimonialValido, tombamento: '' });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.tombamento).toBeUndefined();
      }
    });

    // Critério S3-19 (CA1): só espaços vira vazio após trim e depois undefined
    it('CA1/S3-19: aceita patrimonial com tombamento só de espaços (vira undefined)', () => {
      const r = CreateItemSchema.safeParse({ ...patrimonialValido, tombamento: '   ' });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.tombamento).toBeUndefined();
      }
    });

    // Valor-limite CA1: 1 caractere (limite válido)
    it('CA1: aceita patrimonial com tombamento de 1 caractere', () => {
      const r = CreateItemSchema.safeParse({ ...patrimonialValido, tombamento: '1' });
      expect(r.success).toBe(true);
    });

    // Partição válida: trim - CA1
    it('CA1: remove espaços nas pontas do tombamento', () => {
      const r = CreateItemSchema.safeParse({ ...patrimonialValido, tombamento: '  TOMB-9  ' });
      expect(r.success && r.data.tombamento).toBe('TOMB-9');
    });

    // Partição inválida (tipo de dado) - CA2
    it('CA2: rejeita tombamento numérico', () => {
      const r = CreateItemSchema.safeParse({ ...patrimonialValido, tombamento: 123 });
      expect(r.success).toBe(false);
    });

    // Critério CA4: consumo sem tombamento é válido
    it('CA4: aceita consumo sem tombamento', () => {
      const r = CreateItemSchema.safeParse(consumoValido);
      expect(r.success).toBe(true);
      expect(r.success && r.data.tombamento).toBeUndefined();
    });

    // Partição inválida CA4: consumo com tombamento
    it('CA4: rejeita consumo com tombamento informado', () => {
      const r = CreateItemSchema.safeParse({ ...consumoValido, tombamento: 'TOMB-1' });
      expect(r.success).toBe(false);
      expect(mensagens(r)).toContain('Item de consumo não possui tombamento');
      expect(caminhos(r)).toContain('tombamento');
    });
  });

  describe('numeroSerie e nivelMinimo opcionais', () => {
    // Critério CA5: omitidos
    it('CA5: aceita cadastro sem número de série e sem nível mínimo', () => {
      const r = CreateItemSchema.safeParse(patrimonialValido);
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.numeroSerie).toBeUndefined();
        expect(r.data.nivelMinimo).toBeUndefined();
      }
    });

    // Critério CA5: informados são mantidos
    it('CA5: mantém número de série e nível mínimo informados', () => {
      const r = CreateItemSchema.safeParse({ ...consumoValido, numeroSerie: 'SN-1', nivelMinimo: 5 });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.numeroSerie).toBe('SN-1');
        expect(r.data.nivelMinimo).toBe(5);
      }
    });

    // Valor-limite numeroSerie: 0 caracteres
    it('CA5: rejeita número de série vazio quando informado', () => {
      const r = CreateItemSchema.safeParse({ ...consumoValido, numeroSerie: '' });
      expect(r.success).toBe(false);
      expect(mensagens(r)).toContain('Nº de série inválido');
    });

    // Valor-limite numeroSerie: só espaços
    it('CA5: rejeita número de série só com espaços', () => {
      expect(CreateItemSchema.safeParse({ ...consumoValido, numeroSerie: '   ' }).success).toBe(false);
    });

    // Valor-limite numeroSerie: 1 caractere
    it('CA5: aceita número de série com 1 caractere', () => {
      expect(CreateItemSchema.safeParse({ ...consumoValido, numeroSerie: 'S' }).success).toBe(true);
    });

    // Valor-limite nivelMinimo: -1 (abaixo da fronteira)
    it('CA5: rejeita nível mínimo -1', () => {
      const r = CreateItemSchema.safeParse({ ...consumoValido, nivelMinimo: -1 });
      expect(r.success).toBe(false);
      expect(mensagens(r)).toContain('Nível mínimo não pode ser negativo');
    });

    // Valor-limite nivelMinimo: 0 (na fronteira)
    it('CA5: aceita nível mínimo 0', () => {
      const r = CreateItemSchema.safeParse({ ...consumoValido, nivelMinimo: 0 });
      expect(r.success).toBe(true);
      expect(r.success && r.data.nivelMinimo).toBe(0);
    });

    // Valor-limite nivelMinimo: 1 (acima da fronteira)
    it('CA5: aceita nível mínimo 1', () => {
      expect(CreateItemSchema.safeParse({ ...consumoValido, nivelMinimo: 1 }).success).toBe(true);
    });

    // Partição inválida: não inteiro
    it('CA5: rejeita nível mínimo decimal', () => {
      const r = CreateItemSchema.safeParse({ ...consumoValido, nivelMinimo: 1.5 });
      expect(r.success).toBe(false);
      expect(mensagens(r)).toContain('Nível mínimo deve ser inteiro');
    });

    // Valor-limite: próximo ao inteiro
    it('CA5: rejeita nível mínimo 0.1 (logo acima de 0, não inteiro)', () => {
      expect(CreateItemSchema.safeParse({ ...consumoValido, nivelMinimo: 0.1 }).success).toBe(false);
    });

    // Partição inválida: string numérica
    it('CA5: rejeita nível mínimo como string', () => {
      const r = CreateItemSchema.safeParse({ ...consumoValido, nivelMinimo: '5' });
      expect(r.success).toBe(false);
      expect(mensagens(r)).toContain('Nível mínimo deve ser um número');
    });

    // Partição inválida: NaN
    it('CA5: rejeita nível mínimo NaN', () => {
      expect(CreateItemSchema.safeParse({ ...consumoValido, nivelMinimo: Number.NaN }).success).toBe(false);
    });

    // Partição válida: valor grande
    it('CA5: aceita nível mínimo grande', () => {
      expect(CreateItemSchema.safeParse({ ...consumoValido, nivelMinimo: 1_000_000 }).success).toBe(true);
    });
  });

  describe('descricao', () => {
    // Partição válida: omitida
    it('CA1: aceita descrição omitida', () => {
      expect(CreateItemSchema.safeParse(patrimonialValido).success).toBe(true);
    });

    // Partição válida: informada com trim
    it('CA1: aceita descrição e remove espaços nas pontas', () => {
      const r = CreateItemSchema.safeParse({ ...patrimonialValido, descricao: '  Dell  ' });
      expect(r.success && r.data.descricao).toBe('Dell');
    });

    // Valor-limite: vazia é aceita (sem min)
    it('CA1: aceita descrição vazia', () => {
      expect(CreateItemSchema.safeParse({ ...patrimonialValido, descricao: '' }).success).toBe(true);
    });

    // Partição inválida: tipo de dado
    it('CA1: rejeita descrição numérica', () => {
      expect(CreateItemSchema.safeParse({ ...patrimonialValido, descricao: 10 }).success).toBe(false);
    });
  });

  // Partição inválida: corpo vazio - CA1
  it('CA1: rejeita objeto vazio acumulando erros dos campos obrigatórios', () => {
    const r = CreateItemSchema.safeParse({});
    expect(r.success).toBe(false);
    const campos = caminhos(r);
    expect(campos).toEqual(expect.arrayContaining(['tipo', 'nome', 'categoriaId']));
  });
});

describe('US03 - UpdateItemSchema', () => {
  // Partição válida: objeto vazio (tudo opcional) - CA5
  it('aceita objeto vazio (todos os campos opcionais)', () => {
    expect(UpdateItemSchema.safeParse({}).success).toBe(true);
  });

  // Partição válida: atualização parcial - CA5
  it('aceita atualização parcial de campos', () => {
    const r = UpdateItemSchema.safeParse({ nome: 'Novo nome', nivelMinimo: 3, numeroSerie: 'SN-2' });
    expect(r.success).toBe(true);
    expect(r.success && r.data).toEqual({ nome: 'Novo nome', nivelMinimo: 3, numeroSerie: 'SN-2' });
  });

  // Critério: tipo não muda depois de cadastrado
  it('descarta o campo tipo (não pode ser alterado)', () => {
    const r = UpdateItemSchema.safeParse({ tipo: 'CONSUMO', nome: 'X' });
    expect(r.success).toBe(true);
    expect(r.success && 'tipo' in r.data).toBe(false);
  });

  // Valor-limite nome: vazio inválido
  it('rejeita nome vazio quando informado', () => {
    const r = UpdateItemSchema.safeParse({ nome: '' });
    expect(r.success).toBe(false);
    expect(mensagens(r)).toContain('Nome é obrigatório');
  });

  // Valor-limite nome: 1 caractere
  it('aceita nome com 1 caractere', () => {
    expect(UpdateItemSchema.safeParse({ nome: 'A' }).success).toBe(true);
  });

  // Valor-limite categoriaId: vazio inválido
  it('rejeita categoriaId vazio quando informado', () => {
    expect(UpdateItemSchema.safeParse({ categoriaId: '' }).success).toBe(false);
  });

  // Valor-limite tombamento: vazio inválido
  it('rejeita tombamento vazio quando informado', () => {
    const r = UpdateItemSchema.safeParse({ tombamento: '' });
    expect(r.success).toBe(false);
    expect(mensagens(r)).toContain('Tombamento inválido');
  });

  // Valor-limite tombamento: 1 caractere
  it('aceita tombamento com 1 caractere', () => {
    expect(UpdateItemSchema.safeParse({ tombamento: 'T' }).success).toBe(true);
  });

  // Valor-limite numeroSerie: vazio inválido / 1 caractere válido
  it('valida número de série nos limites (0 e 1 caractere)', () => {
    expect(UpdateItemSchema.safeParse({ numeroSerie: '' }).success).toBe(false);
    expect(UpdateItemSchema.safeParse({ numeroSerie: 'S' }).success).toBe(true);
  });

  // Valor-limite nivelMinimo: -1 / 0 / 1
  it.each([
    [-1, false],
    [0, true],
    [1, true],
  ])('nível mínimo %s => válido=%s', (valor, esperado) => {
    expect(UpdateItemSchema.safeParse({ nivelMinimo: valor }).success).toBe(esperado);
  });

  // Partição inválida nivelMinimo: decimal e string
  it('rejeita nível mínimo decimal e string', () => {
    expect(UpdateItemSchema.safeParse({ nivelMinimo: 2.5 }).success).toBe(false);
    expect(UpdateItemSchema.safeParse({ nivelMinimo: '2' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

describe('US03 - ItensService', () => {
  const estoqueId = 'est-1';
  const userId = 'user-1';

  let prisma: {
    estoque: { findUnique: ReturnType<typeof vi.fn> };
    estoqueGestor: { findUnique: ReturnType<typeof vi.fn> };
    categoria: { findUnique: ReturnType<typeof vi.fn> };
    item: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
  };
  let service: ItensService;

  beforeEach(() => {
    prisma = {
      estoque: { findUnique: vi.fn().mockResolvedValue({ id: estoqueId, ativo: true }) },
      estoqueGestor: { findUnique: vi.fn().mockResolvedValue({ estoqueId, usuarioId: userId }) },
      categoria: { findUnique: vi.fn().mockResolvedValue({ id: 'cat-1' }) },
      item: {
        create: vi.fn().mockImplementation(async ({ data }) => ({ id: 'item-1', ...data })),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        update: vi.fn().mockImplementation(async ({ where, data }) => ({ id: where.id, ...data })),
        count: vi.fn().mockResolvedValue(0),
      },
    };
    service = new ItensService(prisma as any);
  });

  describe('create', () => {
    // Critério CA1: gestor cadastra patrimonial com categoria e tombamento novo
    it('CA1: cria item patrimonial vinculado ao estoque e inclui a categoria', async () => {
      const resultado: any = await service.create(estoqueId, patrimonialValido, userId);

      expect(prisma.item.create).toHaveBeenCalledTimes(1);
      expect(prisma.item.create).toHaveBeenCalledWith({
        data: {
          tipo: 'PATRIMONIAL',
          nome: 'Notebook',
          descricao: undefined,
          tombamento: 'TOMB-001',
          numeroSerie: undefined,
          nivelMinimo: undefined,
          categoriaId: 'cat-1',
          estoqueId,
        },
        include: { categoria: true },
      });
      expect(resultado.id).toBe('item-1');
      expect(resultado.estoqueId).toBe(estoqueId);
    });

    // Critério CA1/CA7: verificação do vínculo por chave composta estoque+usuário
    it('CA7: consulta o vínculo de gestor pela chave composta estoque + usuário', async () => {
      await service.create(estoqueId, patrimonialValido, userId);
      expect(prisma.estoqueGestor.findUnique).toHaveBeenCalledWith({
        where: { estoqueId_usuarioId: { estoqueId, usuarioId: userId } },
      });
    });

    // Critério CA4: consumo sem tombamento
    it('CA4: cria item de consumo sem tombamento', async () => {
      await service.create(estoqueId, consumoValido, userId);
      const arg = prisma.item.create.mock.calls[0][0];
      expect(arg.data.tipo).toBe('CONSUMO');
      expect(arg.data.tombamento).toBeUndefined();
    });

    // Critério CA5: omitidos
    it('CA5: aceita cadastro com número de série e nível mínimo omitidos', async () => {
      await service.create(estoqueId, consumoValido, userId);
      const arg = prisma.item.create.mock.calls[0][0];
      expect(arg.data.numeroSerie).toBeUndefined();
      expect(arg.data.nivelMinimo).toBeUndefined();
    });

    // Critério CA5: informados são salvos
    it('CA5: salva número de série e nível mínimo quando informados', async () => {
      await service.create(
        estoqueId,
        { ...patrimonialValido, numeroSerie: 'SN-9', nivelMinimo: 4, descricao: 'Desc' },
        userId,
      );
      const arg = prisma.item.create.mock.calls[0][0];
      expect(arg.data.numeroSerie).toBe('SN-9');
      expect(arg.data.nivelMinimo).toBe(4);
      expect(arg.data.descricao).toBe('Desc');
    });

    // Valor-limite nivelMinimo: 0 deve ser repassado (não confundir com ausente)
    it('CA5: repassa nível mínimo 0 ao banco', async () => {
      await service.create(estoqueId, { ...consumoValido, nivelMinimo: 0 }, userId);
      expect(prisma.item.create.mock.calls[0][0].data.nivelMinimo).toBe(0);
    });

    // Critério CA7: usuário sem vínculo
    it('CA7: lança AccessDeniedException (403) quando o usuário não é gestor do estoque', async () => {
      prisma.estoqueGestor.findUnique.mockResolvedValue(null);
      await esperarErro(
        service.create(estoqueId, patrimonialValido, userId),
        AccessDeniedException,
        'Apenas gestores deste estoque',
        HttpStatus.FORBIDDEN,
      );
      expect(prisma.item.create).not.toHaveBeenCalled();
    });

    // Partição inválida userId: ausente
    it('CA7: lança AccessDeniedException quando não há usuário e não consulta vínculo', async () => {
      await esperarErro(service.create(estoqueId, patrimonialValido, undefined), AccessDeniedException);
      expect(prisma.estoqueGestor.findUnique).not.toHaveBeenCalled();
      expect(prisma.item.create).not.toHaveBeenCalled();
    });

    // Partição inválida userId: string vazia (falsy)
    it('CA7: trata userId vazio como sem vínculo', async () => {
      await esperarErro(service.create(estoqueId, patrimonialValido, ''), AccessDeniedException);
      expect(prisma.item.create).not.toHaveBeenCalled();
    });

    // Partição inválida estoque: inexistente
    it('lança ResourceNotFoundException quando o estoque não existe', async () => {
      prisma.estoque.findUnique.mockResolvedValue(null);
      await esperarErro(service.create(estoqueId, patrimonialValido, userId), ResourceNotFoundException);
      expect(prisma.item.create).not.toHaveBeenCalled();
    });

    // Critério: estoque inexistente é verificado antes da autorização
    it('verifica a existência do estoque antes de checar o gestor', async () => {
      prisma.estoque.findUnique.mockResolvedValue(null);
      await esperarErro(service.create(estoqueId, patrimonialValido, userId), ResourceNotFoundException);
      expect(prisma.estoqueGestor.findUnique).not.toHaveBeenCalled();
    });

    // Partição inválida estoque: desativado
    it('recusa cadastro em estoque desativado com 400', async () => {
      prisma.estoque.findUnique.mockResolvedValue({ id: estoqueId, ativo: false });
      await esperarErro(
        service.create(estoqueId, patrimonialValido, userId),
        AppException,
        'Estoque desativado não aceita novos itens',
        HttpStatus.BAD_REQUEST,
      );
      expect(prisma.item.create).not.toHaveBeenCalled();
    });

    // Partição inválida categoria: inexistente
    it('lança ResourceNotFoundException quando a categoria não existe', async () => {
      prisma.categoria.findUnique.mockResolvedValue(null);
      await esperarErro(service.create(estoqueId, patrimonialValido, userId), ResourceNotFoundException);
      expect(prisma.categoria.findUnique).toHaveBeenCalledWith({ where: { id: 'cat-1' } });
      expect(prisma.item.create).not.toHaveBeenCalled();
    });

    // Critério CA3: tombamento duplicado
    it('CA3: converte P2002 em tombamento para ResourceConflictException com mensagem clara', async () => {
      prisma.item.create.mockRejectedValue(erroP2002(['tombamento']));
      await esperarErro(
        service.create(estoqueId, patrimonialValido, userId),
        ResourceConflictException,
        'Já existe um item com este tombamento.',
        HttpStatus.CONFLICT,
      );
    });

    // Partição: target como string em vez de array
    it('CA3: reconhece tombamento duplicado quando meta.target é string', async () => {
      prisma.item.create.mockRejectedValue(erroP2002('Item_tombamento_key'));
      await esperarErro(
        service.create(estoqueId, patrimonialValido, userId),
        ResourceConflictException,
        'Já existe um item com este tombamento.',
      );
    });

    // Partição: número de série duplicado
    it('CA5: converte P2002 em numeroSerie para conflito com mensagem de número de série', async () => {
      prisma.item.create.mockRejectedValue(erroP2002(['numeroSerie']));
      await esperarErro(
        service.create(estoqueId, patrimonialValido, userId),
        ResourceConflictException,
        'Já existe um item com este número de série.',
      );
    });

    // Partição: P2002 em outro campo
    it('converte P2002 em outro campo para mensagem genérica de duplicado', async () => {
      prisma.item.create.mockRejectedValue(erroP2002(['outro_campo']));
      await esperarErro(service.create(estoqueId, patrimonialValido, userId), ResourceConflictException, 'Item duplicado.');
    });

    // Partição: P2002 sem meta
    it('converte P2002 sem meta para mensagem genérica de duplicado', async () => {
      prisma.item.create.mockRejectedValue(erroP2002(undefined));
      await esperarErro(service.create(estoqueId, patrimonialValido, userId), ResourceConflictException, 'Item duplicado.');
    });

    // Partição: erro Prisma com outro código é propagado
    it('propaga erros Prisma que não sejam P2002', async () => {
      const erro = new Prisma.PrismaClientKnownRequestError('Falha', { code: 'P2025', clientVersion: '5.0.0' });
      prisma.item.create.mockRejectedValue(erro);
      await expect(service.create(estoqueId, patrimonialValido, userId)).rejects.toBe(erro);
    });

    // Partição: erro genérico é propagado
    it('propaga erros inesperados sem traduzir', async () => {
      const erro = new Error('boom');
      prisma.item.create.mockRejectedValue(erro);
      await expect(service.create(estoqueId, patrimonialValido, userId)).rejects.toBe(erro);
    });
  });

  describe('findAllByEstoque', () => {
    // Critério CA6: filtro pelo estoque
    it('CA6: busca e conta apenas itens do estoque informado', async () => {
      await service.findAllByEstoque(estoqueId, { page: 1, limit: 10 } as any);
      expect(prisma.item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { estoqueId } }),
      );
      expect(prisma.item.count).toHaveBeenCalledWith({ where: { estoqueId } });
    });

    // Critério CA1: item criado aparece na listagem
    it('CA1: retorna na listagem os itens do estoque com categoria incluída e ordenados por nome', async () => {
      const itens = [{ id: 'i1', nome: 'A', estoqueId }, { id: 'i2', nome: 'B', estoqueId }];
      prisma.item.findMany.mockResolvedValue(itens);
      prisma.item.count.mockResolvedValue(2);

      const resultado = await service.findAllByEstoque(estoqueId, { page: 1, limit: 10 } as any);

      expect(prisma.item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include: { categoria: true }, orderBy: { nome: 'asc' } }),
      );
      const serializado = JSON.stringify(resultado);
      expect(serializado).toContain('i1');
      expect(serializado).toContain('i2');
    });

    // Valor-limite page: 1 (primeira página) => skip 0
    it('página 1 usa skip 0 e take igual ao limite', async () => {
      await service.findAllByEstoque(estoqueId, { page: 1, limit: 10 } as any);
      expect(prisma.item.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 10 }));
    });

    // Valor-limite page: 2 (logo após a fronteira)
    it('página 2 usa skip igual ao limite', async () => {
      await service.findAllByEstoque(estoqueId, { page: 2, limit: 10 } as any);
      expect(prisma.item.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
    });

    // Partição: página alta e limite diferente
    it('página 3 com limite 5 usa skip 10', async () => {
      await service.findAllByEstoque(estoqueId, { page: 3, limit: 5 } as any);
      expect(prisma.item.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 5 }));
    });

    // Valor-limite limite: 1
    it('limite 1 usa take 1', async () => {
      await service.findAllByEstoque(estoqueId, { page: 1, limit: 1 } as any);
      expect(prisma.item.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 1 }));
    });

    // LACUNA: CT-03-26 | Valor-limite: estoque com 0 itens (fronteira inferior da listagem)
    // Correção C2: verifica items = [] e meta.total = 0, em vez de só toBeDefined().
    it('estoque sem itens retorna listagem vazia sem erro', async () => {
      const resultado: any = await service.findAllByEstoque(estoqueId, { page: 1, limit: 10 } as any);
      expect(resultado.items).toEqual([]);
      expect(resultado.meta.total).toBe(0);
    });

    // Partição inválida: estoque inexistente
    it('lança ResourceNotFoundException quando o estoque não existe e não consulta itens', async () => {
      prisma.estoque.findUnique.mockResolvedValue(null);
      await esperarErro(
        service.findAllByEstoque(estoqueId, { page: 1, limit: 10 } as any),
        ResourceNotFoundException,
      );
      expect(prisma.item.findMany).not.toHaveBeenCalled();
      expect(prisma.item.count).not.toHaveBeenCalled();
    });

    // Critério: leitura não exige gestor
    it('CA7: a leitura não consulta vínculo de gestor (qualquer autenticado lê)', async () => {
      await service.findAllByEstoque(estoqueId, { page: 1, limit: 10 } as any);
      expect(prisma.estoqueGestor.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const itemPatrimonial = { id: 'item-1', estoqueId, tipo: 'PATRIMONIAL' };
    const itemConsumo = { id: 'item-2', estoqueId, tipo: 'CONSUMO' };

    // Critério CA7: edição por não gestor
    it('CA7: lança AccessDeniedException (403) quando não é gestor do estoque', async () => {
      prisma.estoqueGestor.findUnique.mockResolvedValue(null);
      await esperarErro(
        service.update(estoqueId, 'item-1', { nome: 'X' }, userId),
        AccessDeniedException,
        'Apenas gestores deste estoque',
        HttpStatus.FORBIDDEN,
      );
      expect(prisma.item.update).not.toHaveBeenCalled();
    });

    // Partição inválida userId: ausente
    it('CA7: lança AccessDeniedException quando não há usuário', async () => {
      await esperarErro(service.update(estoqueId, 'item-1', { nome: 'X' }, undefined), AccessDeniedException);
      expect(prisma.item.update).not.toHaveBeenCalled();
    });

    // Partição inválida estoque inexistente
    it('lança ResourceNotFoundException quando o estoque não existe', async () => {
      prisma.estoque.findUnique.mockResolvedValue(null);
      await esperarErro(service.update(estoqueId, 'item-1', { nome: 'X' }, userId), ResourceNotFoundException);
      expect(prisma.item.update).not.toHaveBeenCalled();
    });

    // Partição inválida item inexistente / de outro estoque
    it('lança ResourceNotFoundException quando o item não pertence ao estoque', async () => {
      prisma.item.findFirst.mockResolvedValue(null);
      await esperarErro(service.update(estoqueId, 'item-x', { nome: 'X' }, userId), ResourceNotFoundException);
      expect(prisma.item.findFirst).toHaveBeenCalledWith({ where: { id: 'item-x', estoqueId } });
      expect(prisma.item.update).not.toHaveBeenCalled();
    });

    // Critério CA5: atualiza número de série e nível mínimo
    it('CA5: atualiza item repassando os campos informados e incluindo a categoria', async () => {
      prisma.item.findFirst.mockResolvedValue(itemPatrimonial);
      const dto = { nome: 'Novo', numeroSerie: 'SN-5', nivelMinimo: 2 };

      await service.update(estoqueId, 'item-1', dto, userId);

      expect(prisma.item.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: dto,
        include: { categoria: true },
      });
    });

    // Partição válida: patrimonial altera tombamento
    it('CA1: permite alterar tombamento de item patrimonial', async () => {
      prisma.item.findFirst.mockResolvedValue(itemPatrimonial);
      await service.update(estoqueId, 'item-1', { tombamento: 'TOMB-NOVO' }, userId);
      expect(prisma.item.update.mock.calls[0][0].data.tombamento).toBe('TOMB-NOVO');
    });

    // Partição inválida: consumo com tombamento (CA4)
    it('CA4: recusa tombamento em item de consumo com 400', async () => {
      prisma.item.findFirst.mockResolvedValue(itemConsumo);
      await esperarErro(
        service.update(estoqueId, 'item-2', { tombamento: 'TOMB-1' }, userId),
        AppException,
        'Item de consumo não possui tombamento',
        HttpStatus.BAD_REQUEST,
      );
      expect(prisma.item.update).not.toHaveBeenCalled();
    });

    // Partição válida: consumo sem tombamento no dto
    it('CA4: permite editar item de consumo sem enviar tombamento', async () => {
      prisma.item.findFirst.mockResolvedValue(itemConsumo);
      await service.update(estoqueId, 'item-2', { nome: 'Papel A3' }, userId);
      expect(prisma.item.update).toHaveBeenCalledTimes(1);
    });

    // Valor-limite: dto vazio em item de consumo (tombamento === undefined)
    it('CA4: permite dto vazio em item de consumo', async () => {
      prisma.item.findFirst.mockResolvedValue(itemConsumo);
      await service.update(estoqueId, 'item-2', {}, userId);
      expect(prisma.item.update).toHaveBeenCalledTimes(1);
    });

    // Partição: categoria informada é validada
    it('valida a existência da nova categoria quando categoriaId é informado', async () => {
      prisma.item.findFirst.mockResolvedValue(itemPatrimonial);
      await service.update(estoqueId, 'item-1', { categoriaId: 'cat-2' }, userId);
      expect(prisma.categoria.findUnique).toHaveBeenCalledWith({ where: { id: 'cat-2' } });
    });

    // Partição inválida: categoria inexistente
    it('lança ResourceNotFoundException quando a nova categoria não existe', async () => {
      prisma.item.findFirst.mockResolvedValue(itemPatrimonial);
      prisma.categoria.findUnique.mockResolvedValue(null);
      await esperarErro(service.update(estoqueId, 'item-1', { categoriaId: 'cat-x' }, userId), ResourceNotFoundException);
      expect(prisma.item.update).not.toHaveBeenCalled();
    });

    // Partição: sem categoriaId não consulta categoria
    it('não consulta categoria quando categoriaId não é informado', async () => {
      prisma.item.findFirst.mockResolvedValue(itemPatrimonial);
      await service.update(estoqueId, 'item-1', { nome: 'X' }, userId);
      expect(prisma.categoria.findUnique).not.toHaveBeenCalled();
    });

    // Critério CA3: duplicidade na edição
    it('CA3: converte P2002 de tombamento na edição em ResourceConflictException', async () => {
      prisma.item.findFirst.mockResolvedValue(itemPatrimonial);
      prisma.item.update.mockRejectedValue(erroP2002(['tombamento']));
      await esperarErro(
        service.update(estoqueId, 'item-1', { tombamento: 'TOMB-001' }, userId),
        ResourceConflictException,
        'Já existe um item com este tombamento.',
      );
    });

    // Partição: duplicidade de número de série na edição
    it('converte P2002 de número de série na edição em conflito', async () => {
      prisma.item.findFirst.mockResolvedValue(itemPatrimonial);
      prisma.item.update.mockRejectedValue(erroP2002(['numeroSerie']));
      await esperarErro(
        service.update(estoqueId, 'item-1', { numeroSerie: 'SN-1' }, userId),
        ResourceConflictException,
        'Já existe um item com este número de série.',
      );
    });

    // Partição: erro inesperado propagado
    it('propaga erros inesperados na edição', async () => {
      prisma.item.findFirst.mockResolvedValue(itemPatrimonial);
      const erro = new Error('boom');
      prisma.item.update.mockRejectedValue(erro);
      await expect(service.update(estoqueId, 'item-1', { nome: 'X' }, userId)).rejects.toBe(erro);
    });
  });
});

// ---------------------------------------------------------------------------
// Service com fake em memória (listagem por estoque, autorização e unicidade
// global de tombamento). Veja a documentação do fake no topo do arquivo.
// ---------------------------------------------------------------------------

describe('US03 - ItensService (fake em memória)', () => {
  const gestorId = 'gestor-1';
  const query = { page: 1, limit: 10 } as any;

  let fake: ReturnType<typeof criarPrismaFake>;
  let service: ItensService;

  beforeEach(() => {
    fake = criarPrismaFake();
    fake.registrarEstoque('est-1');
    fake.registrarEstoque('est-2');
    fake.registrarGestor('est-1', gestorId);
    fake.registrarGestor('est-2', gestorId);
    service = new ItensService(fake.prisma as any);
  });

  describe('listagem', () => {
    // LACUNA: CT-03-27 | Valor-limite: exatamente 1 item no estoque (fronteira entre vazio e vários)
    it('estoque com exatamente 1 item devolve 1 elemento e meta.total 1', async () => {
      fake.semear({ ...patrimonialValido, estoqueId: 'est-1' });

      const resultado: any = await service.findAllByEstoque('est-1', query);

      expect(resultado.items).toHaveLength(1);
      expect(resultado.meta.total).toBe(1);
    });

    // LACUNA: CT-03-24 | Partição válida: estoque com vários itens (3) devolve todos
    it('estoque com 3 itens devolve exatamente os 3', async () => {
      const a = fake.semear({ ...patrimonialValido, nome: 'A', tombamento: 'T-A', estoqueId: 'est-1' });
      const b = fake.semear({ ...patrimonialValido, nome: 'B', tombamento: 'T-B', estoqueId: 'est-1' });
      const c = fake.semear({ ...consumoValido, nome: 'C', estoqueId: 'est-1' });

      const resultado: any = await service.findAllByEstoque('est-1', query);

      expect(resultado.items).toHaveLength(3);
      expect(resultado.items.map((i: any) => i.id).sort()).toEqual([a.id, b.id, c.id].sort());
      expect(resultado.meta.total).toBe(3);
    });

    // LACUNA: CT-03-25 | Partição: isolamento entre estoques (itens de outro estoque não aparecem)
    it('a listagem de um estoque não traz itens de outro estoque', async () => {
      const a1 = fake.semear({ ...patrimonialValido, nome: 'A1', tombamento: 'T-A1', estoqueId: 'est-1' });
      const a2 = fake.semear({ ...consumoValido, nome: 'A2', estoqueId: 'est-1' });
      const b1 = fake.semear({ ...patrimonialValido, nome: 'B1', tombamento: 'T-B1', estoqueId: 'est-2' });
      const b2 = fake.semear({ ...consumoValido, nome: 'B2', estoqueId: 'est-2' });

      const lista1: any = await service.findAllByEstoque('est-1', query);
      const lista2: any = await service.findAllByEstoque('est-2', query);

      expect(lista1.items.map((i: any) => i.id).sort()).toEqual([a1.id, a2.id].sort());
      expect(lista1.items.every((i: any) => i.estoqueId === 'est-1')).toBe(true);
      expect(lista1.meta.total).toBe(2);

      expect(lista2.items.map((i: any) => i.id).sort()).toEqual([b1.id, b2.id].sort());
      expect(lista2.items.every((i: any) => i.estoqueId === 'est-2')).toBe(true);
      expect(lista2.meta.total).toBe(2);
    });
  });

  describe('autorização (só o gestor do estoque cadastra e edita)', () => {
    // LACUNA: CT-03-32 | Partição inválida: requisitante (usuário sem vínculo de gestor) tenta cadastrar
    it('requisitante sem vínculo não cadastra item: 403 e nada criado', async () => {
      await esperarErro(
        service.create('est-1', patrimonialValido, 'requisitante-1'),
        AccessDeniedException,
        undefined,
        HttpStatus.FORBIDDEN,
      );
      expect(fake.itens).toHaveLength(0);
      expect(fake.prisma.item.create).not.toHaveBeenCalled();
    });

    // LACUNA: CT-03-33 | Partição inválida: requisitante (usuário sem vínculo de gestor) tenta editar
    it('requisitante sem vínculo não edita item: 403 e nada alterado', async () => {
      const existente = fake.semear({ ...patrimonialValido, estoqueId: 'est-1' });

      await esperarErro(
        service.update('est-1', existente.id, { nome: 'Nome hackeado' }, 'requisitante-1'),
        AccessDeniedException,
        undefined,
        HttpStatus.FORBIDDEN,
      );

      expect(fake.prisma.item.update).not.toHaveBeenCalled();
      expect(fake.itens).toHaveLength(1);
      expect(fake.itens[0].nome).toBe('Notebook');
    });

    // LACUNA: CT-03-34 | Partição inválida: ADMIN sem vínculo de gestor no estoque tenta cadastrar
    // O service só conhece o userId: o papel ADMIN não substitui o vínculo EstoqueGestor.
    it('usuário ADMIN sem vínculo de gestor no estoque não cadastra item: 403', async () => {
      const adminSemVinculo = 'admin-1';

      await esperarErro(
        service.create('est-1', patrimonialValido, adminSemVinculo),
        AccessDeniedException,
        undefined,
        HttpStatus.FORBIDDEN,
      );
      expect(fake.itens).toHaveLength(0);
      expect(fake.prisma.item.create).not.toHaveBeenCalled();
    });
  });

  describe('unicidade global de tombamento', () => {
    // LACUNA: CT-03-14 | Partição válida: dois patrimoniais com tombamentos distintos
    it('cria dois itens patrimoniais com tombamentos distintos', async () => {
      await service.create('est-1', { ...patrimonialValido, nome: 'N1', tombamento: 'TOMB-A' }, gestorId);
      await service.create('est-1', { ...patrimonialValido, nome: 'N2', tombamento: 'TOMB-B' }, gestorId);

      expect(fake.itens).toHaveLength(2);
      expect(fake.itens.map((i) => i.tombamento).sort()).toEqual(['TOMB-A', 'TOMB-B']);
    });

    // LACUNA: CT-03-15 | Partição válida: ausência de tombamento (NULL) não é duplicado
    it('cria dois itens de consumo sem tombamento no mesmo estoque', async () => {
      await service.create('est-1', { ...consumoValido, nome: 'Papel A4' }, gestorId);
      await service.create('est-1', { ...consumoValido, nome: 'Caneta' }, gestorId);

      expect(fake.itens).toHaveLength(2);
      expect(fake.itens.every((i) => i.tombamento === undefined)).toBe(true);
    });

    // LACUNA: CT-03-13 | Partição inválida: tombamento já usado por item de OUTRO estoque (unicidade global)
    it('recusa com conflito (409) tombamento já usado em outro estoque', async () => {
      fake.semear({ ...patrimonialValido, tombamento: 'TOMB-001', estoqueId: 'est-2' });

      await esperarErro(
        service.create('est-1', { ...patrimonialValido, tombamento: 'TOMB-001' }, gestorId),
        ResourceConflictException,
        undefined,
        HttpStatus.CONFLICT,
      );

      expect(fake.itens).toHaveLength(1);
      expect(fake.itens[0].estoqueId).toBe('est-2');
    });

    // LACUNA: CT-03-37 | Partição válida: editar mantendo o próprio tombamento (não colide consigo mesmo)
    it('edita patrimonial mantendo o próprio tombamento sem conflito', async () => {
      const criado: any = await service.create('est-1', patrimonialValido, gestorId);

      const atualizado: any = await service.update(
        'est-1',
        criado.id,
        { nome: 'Notebook Atualizado', tombamento: 'TOMB-001' },
        gestorId,
      );

      expect(atualizado.tombamento).toBe('TOMB-001');
      expect(atualizado.nome).toBe('Notebook Atualizado');
      expect(fake.itens).toHaveLength(1);
      expect(fake.itens[0].tombamento).toBe('TOMB-001');
    });

    // LACUNA: CT-03-35 | Valor-limite: tombamento vazio (0 caracteres) na edição é barrado pela validação
    it('edição de patrimonial com tombamento vazio é recusada pela validação e o tombamento anterior permanece', async () => {
      const criado: any = await service.create('est-1', patrimonialValido, gestorId);

      const r = UpdateItemSchema.safeParse({ tombamento: '' });
      expect(r.success).toBe(false);
      expect(caminhos(r)).toContain('tombamento');

      // Na aplicação, o pipe de validação impede que o dto inválido chegue ao service.
      if (r.success) {
        await service.update('est-1', criado.id, r.data, gestorId);
      }

      expect(fake.itens).toHaveLength(1);
      expect(fake.itens[0].tombamento).toBe('TOMB-001');
      expect(fake.prisma.item.update).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

describe('US03 - ItensController', () => {
  let itensService: {
    create: ReturnType<typeof vi.fn>;
    findAllByEstoque: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let controller: ItensController;

  beforeEach(() => {
    itensService = {
      create: vi.fn().mockResolvedValue({ id: 'item-1' }),
      findAllByEstoque: vi.fn().mockResolvedValue({ data: [] }),
      update: vi.fn().mockResolvedValue({ id: 'item-1' }),
    };
    controller = new ItensController(itensService as any);
  });

  // Critério CA7: proteção por guards no controller
  it('CA7: aplica AuthGuard e RolesGuard ao controller', () => {
    const guards = Reflect.getMetadata('__guards__', ItensController) as unknown[];
    expect(guards).toEqual(expect.arrayContaining([AuthGuard, RolesGuard]));
  });

  // Critério CA1: delega criação com estoque, dto e userId
  it('CA1: create delega ao service com estoqueId, dto e userId do usuário atual', async () => {
    const dto = { ...patrimonialValido } as any;
    await controller.create('est-1', dto, { userId: 'u1' } as any);
    expect(itensService.create).toHaveBeenCalledWith('est-1', dto, 'u1');
  });

  // Partição inválida: sem usuário
  it('CA7: create repassa userId undefined quando não há usuário atual', async () => {
    const dto = { ...patrimonialValido } as any;
    await controller.create('est-1', dto, undefined);
    expect(itensService.create).toHaveBeenCalledWith('est-1', dto, undefined);
  });

  // Critério CA6: listagem delega com estoque e query
  it('CA6: findAll delega ao service com estoqueId e query de paginação', async () => {
    const query = { page: 2, limit: 5 } as any;
    await controller.findAll('est-1', query);
    expect(itensService.findAllByEstoque).toHaveBeenCalledWith('est-1', query);
  });

  // Critério CA7: edição delega com userId
  it('CA7: update delega ao service com estoqueId, id, dto e userId', async () => {
    const dto = { nome: 'Novo' } as any;
    await controller.update('est-1', 'item-1', dto, { userId: 'u1' } as any);
    expect(itensService.update).toHaveBeenCalledWith('est-1', 'item-1', dto, 'u1');
  });

  // Partição inválida: edição sem usuário
  it('CA7: update repassa userId undefined quando não há usuário atual', async () => {
    const dto = { nome: 'Novo' } as any;
    await controller.update('est-1', 'item-1', dto, undefined);
    expect(itensService.update).toHaveBeenCalledWith('est-1', 'item-1', dto, undefined);
  });

  // Critério: propaga a exceção 403 do service
  it('CA7: propaga AccessDeniedException lançada pelo service', async () => {
    itensService.create.mockRejectedValue(new AccessDeniedException('negado'));
    await esperarErro(
      controller.create('est-1', { ...patrimonialValido } as any, { userId: 'u2' } as any),
      AccessDeniedException,
    );
  });
});
// ---------------------------------------------------------------------------
// S3-19: Tombamento pendente e tombamento posterior
// ---------------------------------------------------------------------------

describe('S3-19 - Tombamento pendente e tombamento posterior', () => {
  const estoqueId = 'est-1';
  const gestorId = 'gestor-1';

  let prisma: {
    estoque: { findUnique: ReturnType<typeof vi.fn> };
    estoqueGestor: { findUnique: ReturnType<typeof vi.fn> };
    categoria: { findUnique: ReturnType<typeof vi.fn> };
    item: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
  };
  let service: ItensService;

  beforeEach(() => {
    prisma = {
      estoque: { findUnique: vi.fn().mockResolvedValue({ id: estoqueId, ativo: true }) },
      estoqueGestor: { findUnique: vi.fn().mockResolvedValue({ estoqueId, usuarioId: gestorId }) },
      categoria: { findUnique: vi.fn().mockResolvedValue({ id: 'cat-1' }) },
      item: {
        create: vi.fn().mockImplementation(async ({ data }) => ({ id: 'item-1', ...data })),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        update: vi.fn().mockImplementation(async ({ where, data }) => ({ id: where.id, ...data })),
        count: vi.fn().mockResolvedValue(0),
      },
    };
    service = new ItensService(prisma as any);
  });

  it('S3-19 CA1: cadastra item patrimonial sem tombamento como pendente (tombamentoPendente=true)', async () => {
    const { tombamento: _t, ...semTomb } = patrimonialValido;
    const criado: any = await service.create(estoqueId, semTomb, gestorId);

    expect(criado.tombamento).toBeUndefined();
    expect(criado.tombamentoPendente).toBe(true);
  });

  it('S3-19 CA2: gestor do estoque completa tombamento de item patrimonial pendente', async () => {
    prisma.item.findFirst.mockResolvedValue({
      id: 'item-1',
      estoqueId,
      tipo: 'PATRIMONIAL',
      tombamento: null,
    });
    prisma.item.update.mockResolvedValue({
      id: 'item-1',
      estoqueId,
      tipo: 'PATRIMONIAL',
      tombamento: 'TOMB-900',
    });

    const atualizado: any = await service.completarTombamento(
      estoqueId,
      'item-1',
      { tombamento: 'TOMB-900' },
      gestorId,
    );

    expect(atualizado.tombamento).toBe('TOMB-900');
    expect(atualizado.tombamentoPendente).toBe(false);
  });

  it('S3-19 CA2: recusa completar tombamento com 403 quando usuário não é gestor do estoque', async () => {
    prisma.estoqueGestor.findUnique.mockResolvedValue(null);

    await esperarErro(
      service.completarTombamento(estoqueId, 'item-1', { tombamento: 'TOMB-900' }, 'outro-user'),
      AccessDeniedException,
      'Apenas gestores deste estoque',
      HttpStatus.FORBIDDEN,
    );
    expect(prisma.item.update).not.toHaveBeenCalled();
  });

  it('S3-19 CA2: recusa completar tombamento quando item já possui tombamento', async () => {
    prisma.item.findFirst.mockResolvedValue({
      id: 'item-1',
      estoqueId,
      tipo: 'PATRIMONIAL',
      tombamento: 'TOMB-001',
    });

    await esperarErro(
      service.completarTombamento(estoqueId, 'item-1', { tombamento: 'TOMB-900' }, gestorId),
      AppException,
      'já possui tombamento cadastrado',
      HttpStatus.BAD_REQUEST,
    );
  });

  it('S3-19 CA2/CA6: recusa completar tombamento em item de consumo', async () => {
    prisma.item.findFirst.mockResolvedValue({
      id: 'item-2',
      estoqueId,
      tipo: 'CONSUMO',
      tombamento: null,
    });

    await esperarErro(
      service.completarTombamento(estoqueId, 'item-2', { tombamento: 'TOMB-900' }, gestorId),
      AppException,
      'Item de consumo não possui tombamento',
      HttpStatus.BAD_REQUEST,
    );
  });

  it('S3-19 CA3: recusa tombamento duplicado ao completar tombamento com 409', async () => {
    prisma.item.findFirst.mockResolvedValue({
      id: 'item-1',
      estoqueId,
      tipo: 'PATRIMONIAL',
      tombamento: null,
    });
    prisma.item.update.mockRejectedValue(erroP2002(['tombamento']));

    await esperarErro(
      service.completarTombamento(estoqueId, 'item-1', { tombamento: 'TOMB-001' }, gestorId),
      ResourceConflictException,
      'Já existe um item com este tombamento.',
      HttpStatus.CONFLICT,
    );
  });

  it('S3-19 CA4: bloqueia apagar tombamento já preenchido na edição (400)', async () => {
    prisma.item.findFirst.mockResolvedValue({
      id: 'item-1',
      estoqueId,
      tipo: 'PATRIMONIAL',
      tombamento: 'TOMB-001',
    });

    await esperarErro(
      service.update(estoqueId, 'item-1', { tombamento: '' }, gestorId),
      AppException,
      'Tombamento já preenchido não pode ser apagado',
      HttpStatus.BAD_REQUEST,
    );
    expect(prisma.item.update).not.toHaveBeenCalled();
  });

  it('S3-19 CA5: listagem aplica filtro pendente=true e marca tombamentoPendente nos itens', async () => {
    prisma.item.findMany.mockResolvedValue([
      { id: 'i1', tipo: 'PATRIMONIAL', tombamento: null },
    ]);
    prisma.item.count.mockResolvedValue(1);

    const res: any = await service.findAllByEstoque(estoqueId, {
      page: 1,
      limit: 10,
      pendente: true,
    } as any);

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { estoqueId, tipo: 'PATRIMONIAL', tombamento: null },
      }),
    );
    expect(res.items[0].tombamentoPendente).toBe(true);
  });

  it('S3-19 CA2 (Controller): delega completarTombamento ao service com estoqueId, id, dto e userId', async () => {
    const itensServiceMock = {
      create: vi.fn(),
      findAllByEstoque: vi.fn(),
      update: vi.fn(),
      completarTombamento: vi.fn().mockResolvedValue({ id: 'item-1', tombamento: 'TOMB-900' }),
    };
    const controller = new ItensController(itensServiceMock as any);
    const dto = { tombamento: 'TOMB-900' } as any;

    await controller.completarTombamento(estoqueId, 'item-1', dto, { userId: gestorId } as any);

    expect(itensServiceMock.completarTombamento).toHaveBeenCalledWith(
      estoqueId,
      'item-1',
      dto,
      gestorId,
    );
  });
});