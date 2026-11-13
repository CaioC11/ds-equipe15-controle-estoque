// tests/v1-llm/us03-itens.spec.ts
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

    // Partição inválida (valor fora do enum) - CA1
    it('rejeita tipo fora do enum', () => {
      const r = CreateItemSchema.safeParse({ ...patrimonialValido, tipo: 'OUTRO' });
      expect(r.success).toBe(false);
      expect(mensagens(r)).toContain('Tipo deve ser PATRIMONIAL ou CONSUMO');
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
    // Critério CA2: patrimonial sem tombamento (campo ausente)
    it('CA2: rejeita patrimonial sem tombamento', () => {
      const { tombamento: _t, ...semTomb } = patrimonialValido;
      const r = CreateItemSchema.safeParse(semTomb);
      expect(r.success).toBe(false);
      expect(mensagens(r)).toContain('Tombamento é obrigatório para item patrimonial');
      expect(caminhos(r)).toContain('tombamento');
    });

    // Valor-limite CA2: 0 caracteres (abaixo do mínimo)
    it('CA2: rejeita patrimonial com tombamento vazio', () => {
      const r = CreateItemSchema.safeParse({ ...patrimonialValido, tombamento: '' });
      expect(r.success).toBe(false);
      expect(mensagens(r)).toContain('Tombamento inválido');
    });

    // Valor-limite CA2: só espaços vira vazio após trim
    it('CA2: rejeita patrimonial com tombamento só de espaços', () => {
      const r = CreateItemSchema.safeParse({ ...patrimonialValido, tombamento: '   ' });
      expect(r.success).toBe(false);
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

    // Partição: estoque sem itens
    it('estoque sem itens retorna listagem vazia sem erro', async () => {
      const resultado = await service.findAllByEstoque(estoqueId, { page: 1, limit: 10 } as any);
      expect(resultado).toBeDefined();
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