# Log de uso da LLM (v1)

O modelo do prompt está em `prompt-modelo.md`. Este arquivo registra o que foi feito com ele.

## Decisão (igual para todos)
- LLM: Claude (Anthropic), pelo app claude.ai
- Modelo e versão:Claude Sonnet 5.5
- Configuração: esforço médio (ou "padrão, sem opção de ajuste"), busca na web desligada, conversa nova sem anexos
- Data da decisão:13/11/2026
- Matriz de rastreabilidade: não mostrada à LLM; commitada antes da geração.

## Regras
- Até 3 rodadas por story, só para compilar ou rodar. Pedido de "mais testes" fica para a v2.
- Sem edição manual dos testes; os que não compilam são comentados com registro aqui.

---

## US01 — Estoques e movimentação/saldo (Mateus)
(preencher conforme o modelo da seção abaixo)

## US02 — Controle de acesso por grupo (Artur)

## US03 — Itens com tombamento (Caio)

#### Prompt Completo
Você vai gerar testes automatizados com Vitest (TypeScript, NestJS 11, Prisma 5).

USER STORY
US03 — Itens com tombamento: (CRUD de itens vinculados a um estoque, com categoria, tipo (patrimonial ou consumo), tombamento, nº de série e nível mínimo. Item patrimonial tem saldo 1 por registro.)

CRITÉRIOS DE ACEITAÇÃO
CA1: Dado um gestor do estoque, quando cadastra item patrimonial com categoria e tombamento ainda não usado, então o item é criado e aparece na listagem daquele estoque.
CA2: Dado um gestor do estoque, quando cadastra item patrimonial sem tombamento, então o cadastro é recusado.
CA3: Dado um item patrimonial já cadastrado com um tombamento, quando se cadastra outro com o mesmo tombamento, então é recusado com mensagem clara de duplicado.
CA4: Dado um gestor do estoque, quando cadastra item de consumo sem tombamento, então o item é criado e controlado por saldo.
CA5: Dado um cadastro de item, quando número de série e nível mínimo são omitidos, então o cadastro é aceito; quando informados, são salvos.
CA6: Dado um estoque com itens, quando se consulta os itens dele, então a listagem traz só os itens daquele estoque.
CA7: Dado um usuário que não é gestor do estoque, quando tenta cadastrar ou editar item nele, então recebe 403.

CÓDIGO DO MÓDULO
// ARQUIVO: .\src\modules\itens\dto\create-item.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const texto = (obrigatorio: string) =>
  z.string({ required_error: obrigatorio }).trim().min(1, obrigatorio);

export const ItemBaseSchema = z.object({
  tipo: z.enum(['PATRIMONIAL', 'CONSUMO'], {
    required_error: 'Tipo é obrigatório',
    invalid_type_error: 'Tipo deve ser PATRIMONIAL ou CONSUMO',
  }),
  nome: texto('Nome é obrigatório'),
  categoriaId: texto('Categoria é obrigatória'),
  descricao: z.string().trim().optional(),
  tombamento: z.string().trim().min(1, 'Tombamento inválido').optional(),
  numeroSerie: z.string().trim().min(1, 'Nº de série inválido').optional(),
  nivelMinimo: z
    .number({ invalid_type_error: 'Nível mínimo deve ser um número' })
    .int('Nível mínimo deve ser inteiro')
    .min(0, 'Nível mínimo não pode ser negativo')
    .optional(),
});

export const CreateItemSchema = ItemBaseSchema.superRefine((data, ctx) => {
  if (data.tipo === 'PATRIMONIAL' && !data.tombamento) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tombamento'],
      message: 'Tombamento é obrigatório para item patrimonial',
    });
  }
  if (data.tipo === 'CONSUMO' && data.tombamento) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tombamento'],
      message: 'Item de consumo não possui tombamento',
    });
  }
});

export class CreateItemDto extends createZodDto(CreateItemSchema) {}


// ARQUIVO: .\src\modules\itens\dto\update-item.dto.ts
import { createZodDto } from 'nestjs-zod';
import { ItemBaseSchema } from './create-item.dto';

// O tipo do item não muda depois de cadastrado.
// As regras que dependem do tipo são checadas no service.
export const UpdateItemSchema = ItemBaseSchema.omit({ tipo: true }).partial();

export class UpdateItemDto extends createZodDto(UpdateItemSchema) {}


// ARQUIVO: .\src\modules\itens\itens.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { CurrentUser } from '../../common/auth/current-user.interface';
import { GetCurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ItensService } from './itens.service';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';

@Controller('estoques/:estoqueId/itens')
@UseGuards(AuthGuard, RolesGuard)
export class ItensController {
  constructor(private readonly itensService: ItensService) {}

  // Cadastro e edição: só o gestor daquele estoque (403 para os demais)
  @Post()
  create(
    @Param('estoqueId') estoqueId: string,
    @Body() dto: CreateItemDto,
    @GetCurrentUser() user?: CurrentUser,
  ) {
    return this.itensService.create(estoqueId, dto, user?.userId);
  }

  // Leitura: qualquer usuário autenticado
  @Get()
  findAll(@Param('estoqueId') estoqueId: string, @Query() query: PaginationQueryDto) {
    return this.itensService.findAllByEstoque(estoqueId, query);
  }

  @Patch(':id')
  update(
    @Param('estoqueId') estoqueId: string,
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
    @GetCurrentUser() user?: CurrentUser,
  ) {
    return this.itensService.update(estoqueId, id, dto, user?.userId);
  }
}


// ARQUIVO: .\src\modules\itens\itens.service.ts
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccessDeniedException } from '../../common/exceptions/access-denied.exception';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/exceptions/error-code.enum';
import { ResourceConflictException } from '../../common/exceptions/resource-conflict.exception';
import { ResourceNotFoundException } from '../../common/exceptions/resource-not-found.exception';
import { PaginatedResponseDto } from '../../common/pagination/paginated-response.dto';
import type { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { PrismaService } from '../../database/prisma.service';
import type { CreateItemDto } from './dto/create-item.dto';
import type { UpdateItemDto } from './dto/update-item.dto';

@Injectable()
export class ItensService {
  constructor(private readonly prisma: PrismaService) {}

  async create(estoqueId: string, dto: CreateItemDto, userId?: string) {
    const estoque = await this.findEstoqueOrFail(estoqueId);
    await this.assertGestorDoEstoque(estoqueId, userId);
    if (!estoque.ativo) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        'Estoque desativado não aceita novos itens',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.assertCategoriaExiste(dto.categoriaId);

    try {
      return await this.prisma.item.create({
        data: {
          tipo: dto.tipo,
          nome: dto.nome,
          descricao: dto.descricao,
          tombamento: dto.tombamento,
          numeroSerie: dto.numeroSerie,
          nivelMinimo: dto.nivelMinimo,
          categoriaId: dto.categoriaId,
          estoqueId,
        },
        include: { categoria: true },
      });
    } catch (error) {
      this.traduzirErroDeUnicidade(error);
    }
  }

  async findAllByEstoque(estoqueId: string, query: PaginationQueryDto) {
    await this.findEstoqueOrFail(estoqueId);

    const where = { estoqueId };
    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      this.prisma.item.findMany({
        where,
        include: { categoria: true },
        orderBy: { nome: 'asc' },
        skip,
        take: query.limit,
      }),
      this.prisma.item.count({ where }),
    ]);

    return PaginatedResponseDto.of(items, total, query);
  }

  async update(estoqueId: string, itemId: string, dto: UpdateItemDto, userId?: string) {
    await this.findEstoqueOrFail(estoqueId);
    await this.assertGestorDoEstoque(estoqueId, userId);

    const item = await this.prisma.item.findFirst({
      where: { id: itemId, estoqueId },
    });
    if (!item) {
      throw new ResourceNotFoundException('Item', itemId);
    }

    if (item.tipo === 'CONSUMO' && dto.tombamento !== undefined) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        'Item de consumo não possui tombamento',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (dto.categoriaId) {
      await this.assertCategoriaExiste(dto.categoriaId);
    }

    try {
      return await this.prisma.item.update({
        where: { id: itemId },
        data: dto,
        include: { categoria: true },
      });
    } catch (error) {
      this.traduzirErroDeUnicidade(error);
    }
  }

  private async findEstoqueOrFail(estoqueId: string) {
    const estoque = await this.prisma.estoque.findUnique({
      where: { id: estoqueId },
    });
    if (!estoque) {
      throw new ResourceNotFoundException('Estoque', estoqueId);
    }
    return estoque;
  }

  private async assertCategoriaExiste(categoriaId: string) {
    const categoria = await this.prisma.categoria.findUnique({
      where: { id: categoriaId },
    });
    if (!categoria) {
      throw new ResourceNotFoundException('Categoria', categoriaId);
    }
  }

  // Papel de gestor é por estoque (docs/permissoes.md, regra 2)
  private async assertGestorDoEstoque(estoqueId: string, userId?: string) {
    const vinculo = userId
      ? await this.prisma.estoqueGestor.findUnique({
          where: { estoqueId_usuarioId: { estoqueId, usuarioId: userId } },
        })
      : null;

    if (!vinculo) {
      throw new AccessDeniedException(
        'Apenas gestores deste estoque podem cadastrar ou editar itens.',
      );
    }
  }

  private traduzirErroDeUnicidade(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const campos = String(error.meta?.target ?? '');
      if (campos.includes('tombamento')) {
        throw new ResourceConflictException('Já existe um item com este tombamento.');
      }
      if (campos.includes('numeroSerie')) {
        throw new ResourceConflictException('Já existe um item com este número de série.');
      }
      throw new ResourceConflictException('Item duplicado.');
    }
    throw error;
  }
}

INSTRUÇÕES
1. Aplique partições de equivalência (válidas e inválidas) em cada variável de entrada.
2. Aplique análise de valores-limite dos dois lados de cada fronteira.
3. Garanta que cada critério de aceitação tenha ao menos um teste.
4. Em cada teste, adicione um comentário com a técnica usada
   (partição / valor-limite / critério) e o requisito coberto (ex.: CA2).
5. Use apenas os arquivos e caminhos fornecidos. O arquivo de saída é
   tests/v1-llm/us03-itens.spec.ts e os imports apontam para ../../src/...
6. Responda com um único bloco de código.


#### Rodada 1
- Data e hora: 13/11/2026, 08:48
- Prompt completo: o da seção acima.
- Resumo da resposta: A LLM devolveu um único arquivo, `tests/v1-llm/us03-itens.spec.ts`, em três blocos: schemas Zod (`CreateItemSchema` e `UpdateItemSchema`), `ItensService` com o Prisma mockado via `vi.fn()` e `ItensController` instanciado direto, sem módulo Nest. Cada teste traz um comentário com a técnica (partição, valor-limite ou critério) e o requisito. Cobre CA1 a CA7 e inclui casos que não vêm dos CAs: estoque desativado, categoria inexistente, variações de P2002 (tombamento, número de série, outro campo, sem meta), paginação e a ordem das verificações no service.
- Execução: `npx vitest run --config vitest.tests.config.ts tests/v1-llm` (o config base só incluía `src/`, então foi criado um config separado; isso não alterou nenhum teste).
- Problemas observados: o arquivo carregou e rodou sem erro de import ou de setup, incluindo o teste do controller que usa `Reflect.getMetadata`. Uma falha de asserção. Nenhuma rodada extra foi necessária.
- Resultado: 106 testes · 105 passando · 1 falhando · 0 não compilam

#### Contagem final
| Passando | Falhando | Não compilam |
|---|---|---|
| 105 | 1 | 0 |

#### Testes comentados por não compilar
| Teste | Motivo |
|---|---|
| nenhum | não se aplica |

#### Investigação das falhas
| Teste | Erro | Classificação | Evidência | Issue |
|---|---|---|---|---|
| CreateItemSchema > tipo > rejeita tipo fora do enum | a lista de mensagens não contém 'Tipo deve ser PATRIMONIAL ou CONSUMO' | oráculo errado | `invalid_type_error` do Zod só vale para tipo de dado errado. Para um texto fora do enum o Zod devolve a mensagem padrão (`Invalid enum value. Expected 'A' \| 'B', received 'X'`, verificado com um enum de exemplo). Nenhum CA define a mensagem para tipo inválido. | não se aplica |

Observação (fora dos CAs): para tipo inválido o sistema devolve a mensagem padrão do Zod, em inglês, inconsistente com as demais mensagens, que são em português.

### US03 — v2 (S3B-10)

#### Prompt Completo (v2, prompt das lacunas)
O prompt traz a suíte v1, o código do módulo `itens`, o trecho do schema do `Item`, o requisito vigente, as duas correções (C1, C2) e as dez lacunas (L1 a L10) da matriz. A matriz em si não foi mostrada à LLM.

````
Você vai evoluir uma suíte de testes Vitest (TypeScript, NestJS 11, Prisma 5) da US03 — Itens com tombamento.

SUÍTE v1 (arquivo atual, tests/v1-llm/us03-itens.spec.ts)
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

CÓDIGO DO MÓDULO (não altere)

// ARQUIVO: .\src\modules\itens\dto\create-item.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const texto = (obrigatorio: string) =>
  z.string({ required_error: obrigatorio }).trim().min(1, obrigatorio);

export const ItemBaseSchema = z.object({
  tipo: z.enum(['PATRIMONIAL', 'CONSUMO'], {
    required_error: 'Tipo é obrigatório',
    invalid_type_error: 'Tipo deve ser PATRIMONIAL ou CONSUMO',
  }),
  nome: texto('Nome é obrigatório'),
  categoriaId: texto('Categoria é obrigatória'),
  descricao: z.string().trim().optional(),
  tombamento: z.string().trim().min(1, 'Tombamento inválido').optional(),
  numeroSerie: z.string().trim().min(1, 'Nº de série inválido').optional(),
  nivelMinimo: z
    .number({ invalid_type_error: 'Nível mínimo deve ser um número' })
    .int('Nível mínimo deve ser inteiro')
    .min(0, 'Nível mínimo não pode ser negativo')
    .optional(),
});

export const CreateItemSchema = ItemBaseSchema.superRefine((data, ctx) => {
  if (data.tipo === 'PATRIMONIAL' && !data.tombamento) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tombamento'],
      message: 'Tombamento é obrigatório para item patrimonial',
    });
  }
  if (data.tipo === 'CONSUMO' && data.tombamento) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tombamento'],
      message: 'Item de consumo não possui tombamento',
    });
  }
});

export class CreateItemDto extends createZodDto(CreateItemSchema) {}


// ARQUIVO: .\src\modules\itens\dto\update-item.dto.ts
import { createZodDto } from 'nestjs-zod';
import { ItemBaseSchema } from './create-item.dto';

// O tipo do item não muda depois de cadastrado.
// As regras que dependem do tipo são checadas no service.
export const UpdateItemSchema = ItemBaseSchema.omit({ tipo: true }).partial();

export class UpdateItemDto extends createZodDto(UpdateItemSchema) {}


// ARQUIVO: .\src\modules\itens\itens.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { CurrentUser } from '../../common/auth/current-user.interface';
import { GetCurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ItensService } from './itens.service';

@Controller('estoques/:estoqueId/itens')
@UseGuards(AuthGuard, RolesGuard)
export class ItensController {
  constructor(private readonly itensService: ItensService) {}

  // Cadastro e edição: só o gestor daquele estoque (403 para os demais)
  @Post()
  create(
    @Param('estoqueId') estoqueId: string,
    @Body() dto: CreateItemDto,
    @GetCurrentUser() user?: CurrentUser,
  ) {
    return this.itensService.create(estoqueId, dto, user?.userId);
  }

  // Leitura: qualquer usuário autenticado
  @Get()
  findAll(@Param('estoqueId') estoqueId: string, @Query() query: PaginationQueryDto) {
    return this.itensService.findAllByEstoque(estoqueId, query);
  }

  @Patch(':id')
  update(
    @Param('estoqueId') estoqueId: string,
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
    @GetCurrentUser() user?: CurrentUser,
  ) {
    return this.itensService.update(estoqueId, id, dto, user?.userId);
  }
}


// ARQUIVO: .\src\modules\itens\itens.service.ts
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccessDeniedException } from '../../common/exceptions/access-denied.exception';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/exceptions/error-code.enum';
import { ResourceConflictException } from '../../common/exceptions/resource-conflict.exception';
import { ResourceNotFoundException } from '../../common/exceptions/resource-not-found.exception';
import { PaginatedResponseDto } from '../../common/pagination/paginated-response.dto';
import type { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { PrismaService } from '../../database/prisma.service';
import type { CreateItemDto } from './dto/create-item.dto';
import type { UpdateItemDto } from './dto/update-item.dto';

@Injectable()
export class ItensService {
  constructor(private readonly prisma: PrismaService) {}

  async create(estoqueId: string, dto: CreateItemDto, userId?: string) {
    const estoque = await this.findEstoqueOrFail(estoqueId);
    await this.assertGestorDoEstoque(estoqueId, userId);
    if (!estoque.ativo) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        'Estoque desativado não aceita novos itens',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.assertCategoriaExiste(dto.categoriaId);

    try {
      return await this.prisma.item.create({
        data: {
          tipo: dto.tipo,
          nome: dto.nome,
          descricao: dto.descricao,
          tombamento: dto.tombamento,
          numeroSerie: dto.numeroSerie,
          nivelMinimo: dto.nivelMinimo,
          categoriaId: dto.categoriaId,
          estoqueId,
        },
        include: { categoria: true },
      });
    } catch (error) {
      this.traduzirErroDeUnicidade(error);
    }
  }

  async findAllByEstoque(estoqueId: string, query: PaginationQueryDto) {
    await this.findEstoqueOrFail(estoqueId);

    const where = { estoqueId };
    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      this.prisma.item.findMany({
        where,
        include: { categoria: true },
        orderBy: { nome: 'asc' },
        skip,
        take: query.limit,
      }),
      this.prisma.item.count({ where }),
    ]);

    return PaginatedResponseDto.of(items, total, query);
  }

  async update(estoqueId: string, itemId: string, dto: UpdateItemDto, userId?: string) {
    await this.findEstoqueOrFail(estoqueId);
    await this.assertGestorDoEstoque(estoqueId, userId);

    const item = await this.prisma.item.findFirst({
      where: { id: itemId, estoqueId },
    });
    if (!item) {
      throw new ResourceNotFoundException('Item', itemId);
    }

    if (item.tipo === 'CONSUMO' && dto.tombamento !== undefined) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        'Item de consumo não possui tombamento',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (dto.categoriaId) {
      await this.assertCategoriaExiste(dto.categoriaId);
    }

    try {
      return await this.prisma.item.update({
        where: { id: itemId },
        data: dto,
        include: { categoria: true },
      });
    } catch (error) {
      this.traduzirErroDeUnicidade(error);
    }
  }

  private async findEstoqueOrFail(estoqueId: string) {
    const estoque = await this.prisma.estoque.findUnique({
      where: { id: estoqueId },
    });
    if (!estoque) {
      throw new ResourceNotFoundException('Estoque', estoqueId);
    }
    return estoque;
  }

  private async assertCategoriaExiste(categoriaId: string) {
    const categoria = await this.prisma.categoria.findUnique({
      where: { id: categoriaId },
    });
    if (!categoria) {
      throw new ResourceNotFoundException('Categoria', categoriaId);
    }
  }

  // Papel de gestor é por estoque (docs/permissoes.md, regra 2)
  private async assertGestorDoEstoque(estoqueId: string, userId?: string) {
    const vinculo = userId
      ? await this.prisma.estoqueGestor.findUnique({
          where: { estoqueId_usuarioId: { estoqueId, usuarioId: userId } },
        })
      : null;

    if (!vinculo) {
      throw new AccessDeniedException(
        'Apenas gestores deste estoque podem cadastrar ou editar itens.',
      );
    }
  }

  private traduzirErroDeUnicidade(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const campos = String(error.meta?.target ?? '');
      if (campos.includes('tombamento')) {
        throw new ResourceConflictException('Já existe um item com este tombamento.');
      }
      if (campos.includes('numeroSerie')) {
        throw new ResourceConflictException('Já existe um item com este número de série.');
      }
      throw new ResourceConflictException('Item duplicado.');
    }
    throw error;
  }
}


// ARQUIVO: .\src\common\pagination\paginated-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import type { PaginationQueryDto } from './pagination-query.dto';

export class PaginationMetaDto {
  @ApiProperty({ example: 1, description: 'Página atual' })
  page: number;

  @ApiProperty({ example: 20, description: 'Itens por página' })
  limit: number;

  @ApiProperty({ example: 150, description: 'Total de itens' })
  total: number;

  @ApiProperty({ example: 8, description: 'Total de páginas' })
  totalPages: number;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ type: 'array', description: 'Lista de itens' })
  items: T[];

  @ApiProperty({ description: 'Metadados de paginação' })
  meta: PaginationMetaDto;

  static of<T>(items: T[], total: number, query: PaginationQueryDto): PaginatedResponseDto<T> {
    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}


TRECHO DO SCHEMA PRISMA (para o fake em memória)
model Item {
  id          String   @id @default(uuid())
  tipo        TipoItem            // PATRIMONIAL | CONSUMO
  tombamento  String?  @unique    // único globalmente, opcional
  numeroSerie String?  @unique
  nome        String
  nivelMinimo Int?
  categoriaId String
  estoqueId   String
}
No Postgres, valores NULL não colidem em colunas @unique.

REQUISITO VIGENTE (não mude estas regras)
- Item patrimonial exige tombamento, único globalmente (entre todos os estoques); item de consumo não tem tombamento.
- Só o gestor do estoque (vínculo EstoqueGestor) cadastra e edita; qualquer outro usuário recebe 403, seja requisitante ou ADMIN sem vínculo.
- Nível mínimo: inteiro >= 0. Listagem: só itens do estoque pedido, no formato { items, meta: { page, limit, total, totalPages } }.

TAREFA
Gere o arquivo completo tests/v2/us03-itens.spec.ts (imports apontando para ../../src/...).
Mantenha todos os testes da v1 exatamente como estão, exceto pelas correções (C) e inclusões (L) abaixo.
Cada teste novo ou alterado leva o comentário "// LACUNA: CT-03-xx" e o ID de partição ou limite.
Não fixe textos de mensagem de erro novos: use a classe da exceção, o status HTTP e o path do campo.

CORREÇÕES
C1 (CT-03-04): o teste "rejeita tipo fora do enum" falha porque espera a mensagem 'Tipo deve ser PATRIMONIAL ou CONSUMO'. Troque por: success false e path contendo 'tipo'.
C2 (CT-03-26): o teste "estoque sem itens retorna listagem vazia sem erro" só faz toBeDefined(). Verifique que items é [] e meta.total é 0.

LACUNAS A INCLUIR
L1 (CT-03-27): estoque com exatamente 1 item: items com 1 elemento e meta.total 1.
L2 (CT-03-24): estoque com 3 itens: devolve exatamente os 3.
L3 (CT-03-25): dois estoques com itens: a listagem de um não traz itens do outro (fake em memória que respeite o where).
L4 (CT-03-32/33): requisitante (userId sem vínculo de gestor) tenta cadastrar e editar: 403, nada criado nem alterado.
L5 (CT-03-34): usuário ADMIN sem vínculo de gestor no estoque tenta cadastrar: 403.
L6 (CT-03-14): dois patrimoniais com tombamentos distintos: ambos criados.
L7 (CT-03-15): dois itens de consumo sem tombamento no mesmo estoque: ambos criados (ausência de tombamento não é duplicado).
L8 (CT-03-13): tombamento já usado por item de outro estoque: recusado com conflito (409).
L9 (CT-03-37): editar patrimonial mantendo o próprio tombamento: aceito, sem conflito.
L10 (CT-03-35): editar patrimonial enviando tombamento vazio: recusado pela validação (UpdateItemSchema) e o tombamento anterior permanece.
Para L6 a L9 use um fake em memória de prisma.item com unicidade global de tombamento (valores nulos/undefined não colidem), documentado no próprio arquivo.

Responda com um único bloco de código.
````

#### Rodada 1 (v2)
- Data: 14/11/2026
- LLM e configuração: a mesma da v1 (Claude Sonnet 5.5, claude.ai), conversa nova, sem anexos, busca na web desligada.
- Prompt completo: o da seção acima.
- Resumo da resposta: um único arquivo, `tests/v2/us03-itens.spec.ts`, com os 106 testes da v1 mais 11 testes novos. As duas correções entraram nos testes existentes: C1 (CT-03-04, tipo fora do enum, agora confere o path `tipo` e não o texto da mensagem) e C2 (CT-03-26, estoque vazio, agora confere `items` vazio e `meta.total` 0). Os 11 testes novos usam um fake em memória de `prisma.item`, com unicidade global de `tombamento` e `numeroSerie` e sem colisão para valores nulos, e cobrem as lacunas L1 a L10 (CT-03-27, 24, 25, 32, 33, 34, 14, 15, 13, 37 e 35). Cada teste novo ou alterado traz o comentário `// LACUNA: CT-03-xx`.
- Verificação contra a v1 (`git diff --no-index`): 291 linhas adicionadas e 6 removidas. As 6 removidas são o cabeçalho do arquivo, o comentário e a asserção de C1 e o comentário e as duas linhas de C2. Nenhum outro teste da v1 foi alterado.
- Execução: `npx vitest run --config vitest.tests.config.ts tests/v2`
- Problemas observados: nenhum erro de import, de tipo ou de setup. Nenhuma falha de asserção. Nenhuma rodada extra foi necessária.
- Resultado: 117 testes · 117 passando · 0 falhando · 0 não compilam
- Ajustes manuais: dois textos com palavras coladas, o comentário do CT-03-37 (`consigomesmo` passou a `consigo mesmo`) e o nome do teste do CT-03-35 (`anteriorpermanece` passou a `anterior permanece`). Nenhuma lógica foi alterada.

#### Contagem final
| Passando | Falhando | Não compilam |
|---|---|---|
| 117 | 0 | 0 |

#### Testes comentados por não compilar
| Teste | Motivo |
|---|---|
| nenhum | não se aplica |

#### Investigação das falhas
| Teste | Erro | Classificação | Evidência | Issue |
|---|---|---|---|---|
| nenhuma falha | não se aplica | não se aplica | `npx vitest run --config vitest.tests.config.ts tests/v2`: 117 de 117 passando. O teste que falhava na v1 (oráculo errado sobre a mensagem do Zod) foi corrigido em C1. | não se aplica |

#### Cobertura (execução com `--coverage --coverage.reportsDirectory=../docs/testes/relatorios/v2`)
Mesmo escopo e mesmas ferramentas da v1 (Vitest 4.1.8, provider v8, 4 arquivos de produção do módulo `itens`).

| Arquivo | Statements | Branches | Funções | Linhas | Linhas com ramo não coberto |
|---|---|---|---|---|---|
| `itens.controller.ts` | 100% | 100% | 100% | 100% | — |
| `itens.service.ts` | 100% | 96,66% (29/30) | 100% | 100% | 14 |
| `dto/create-item.dto.ts` | 100% | 100% | 100% | 100% | — |
| `dto/update-item.dto.ts` | 100% | 100% | 100% | 100% | — |
| **Total** | **100% (60/60)** | **97,36% (37/38)** | **100% (14/14)** | **100% (60/60)** | |

O branch não coberto é o da linha 14 (`@Injectable()`), o mesmo da v1, associado ao decorator e não a uma decisão do código de negócio.

#### Revisão dos testes novos contra o requisito
- O fake reproduz o que o schema define: `tombamento` e `numeroSerie` únicos globalmente, valores nulos sem colisão, o próprio item ignorado na checagem de unicidade na edição.
- O 409 de CT-03-13 e o 403 de CT-03-32, 33 e 34 saem do `ItensService` real, que traduz o P2002 do fake e consulta o vínculo de gestor. Nenhum erro é lançado direto pelo teste.
- A listagem (CT-03-24, 25, 26 e 27) usa o `where`, o `skip` e o `take` que o service envia e confere `items` e `meta.total`.
- Ressalva 1 (CT-03-35): o teste confere que o `UpdateItemSchema` recusa o tombamento vazio, mas o `service.update` não é chamado. As asserções "update não chamado" e "tombamento anterior permanece" são sempre verdadeiras, e a parte "anterior mantido" não é verificada de forma independente. O caso continua Parcial na matriz.
- Ressalva 2 (CT-03-32, 33 e 34): o service só consulta o vínculo de gestor e não lê o perfil. O teste de ADMIN sem vínculo percorre o mesmo caminho do requisitante.
- Ressalva 3: o fake é simulação, e não banco real. Os casos que dependem dele ficam como Sim* na matriz.

## US04 — Empréstimo e devolução (Theo)

#### Rodada 1
- Data e hora: 13/11/2026, 20:24 (execução com `npm run test:v1`, config `vitest.llm.config.ts`; a execução rodou US03 e US04 juntas)
- Prompt completo:

<details>
<summary>Prompt enviado (modelo de <code>prompt-modelo.md</code> preenchido para a US04)</summary>

```text
Você vai gerar testes automatizados com Vitest (TypeScript, NestJS 11, Prisma 5).

USER STORY
US04 — Empréstimo e devolução: (o gestor registra a saída de um item patrimonial para um responsável, servidor ou docente, com prazo de devolução opcional; o empréstimo passa por aguardando termo assinado, ativo e devolvido; atraso é derivado do prazo.)

CRITÉRIOS DE ACEITAÇÃO
CA1: Dado um item disponível, quando o gestor registra o empréstimo escolhendo ou cadastrando, no próprio ato, o responsável, então o empréstimo fica "aguardando termo assinado".
CA2: Dado um responsável já cadastrado, quando o gestor faz um novo empréstimo, então pode selecioná-lo na lista (nome e Siape ou CPF), sem digitar os dados de novo.
CA3: Dado o registro de um empréstimo, quando o prazo de devolução é informado, então ele é guardado; quando não é informado, então o prazo fica "indefinido".
CA4: Dado um empréstimo aguardando termo assinado, quando o gestor anexa o termo assinado e confirma a entrega física, então o empréstimo fica "ativo" e o item passa a "emprestado".
CA5: Dado um item já emprestado, quando se tenta emprestá-lo de novo, então o sistema recusa.
CA6: Dado um item de consumo, quando o gestor tenta registrar um empréstimo, então o sistema não permite (itens de consumo só têm entrada e saída, com controle por saldo).
CA7: Dado um empréstimo ativo, quando se registra a devolução, então o item volta a ficar disponível.
CA8: Dado um empréstimo com prazo vencido, quando o gestor lista os empréstimos, então o atraso aparece destacado.
CA9: Dado um responsável com item em atraso, quando o gestor tenta registrar novo empréstimo para ele, então o sistema impede o registro e informa a pendência.
CA10: Dado um responsável, quando o gestor consulta seu histórico, então vê o que já pegou e devolveu.

CÓDIGO DO MÓDULO
// ARQUIVO: src/modules/emprestimos/emprestimos.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { CurrentUser } from '../../common/auth/current-user.interface';
import { GetCurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { CreateEmprestimoDto } from './dto/create-emprestimo.dto';
import { EmprestimosService } from './emprestimos.service';
import { type ArquivoUpload, TERMO_ASSINADO_MAX_BYTES } from './termo-assinado.constants';

@ApiTags('Empréstimos')
@Controller('estoques/:estoqueId/emprestimos')
@UseGuards(AuthGuard, RolesGuard)
export class EmprestimosController {
  constructor(private readonly emprestimosService: EmprestimosService) {}

  // Registro e devolução: só o gestor daquele estoque (403 para os demais, inclusive ADMIN)
  @Post()
  @ApiOperation({ summary: 'Registra empréstimo (nasce em AGUARDANDO_TERMO)' })
  @ApiResponse({ status: 201, description: 'Empréstimo registrado' })
  @ApiResponse({ status: 403, description: 'Usuário não é gestor do estoque' })
  @ApiResponse({ status: 404, description: 'Estoque ou item não encontrado' })
  @ApiResponse({ status: 409, description: 'Item já emprestado ou indisponível' })
  create(
    @Param('estoqueId') estoqueId: string,
    @Body() dto: CreateEmprestimoDto,
    @GetCurrentUser() user?: CurrentUser,
  ) {
    return this.emprestimosService.create(estoqueId, dto, user?.userId);
  }

  // Consulta: gestor do estoque ou ADMIN
  @Get()
  @ApiOperation({
    summary: 'Lista empréstimos pendentes (aguardando termo e ativos) com "atrasado"',
  })
  @ApiResponse({ status: 403, description: 'Sem permissão para consultar este estoque' })
  findPendentes(
    @Param('estoqueId') estoqueId: string,
    @Query() query: PaginationQueryDto,
    @GetCurrentUser() user?: CurrentUser,
  ) {
    return this.emprestimosService.findPendentes(estoqueId, query, user);
  }

  @Post(':id/devolucao')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registra a devolução de um empréstimo ativo e libera o item' })
  @ApiResponse({ status: 403, description: 'Usuário não é gestor do estoque' })
  @ApiResponse({ status: 404, description: 'Empréstimo não encontrado neste estoque' })
  @ApiResponse({ status: 409, description: 'Empréstimo não está ativo' })
  devolver(
    @Param('estoqueId') estoqueId: string,
    @Param('id') id: string,
    @GetCurrentUser() user?: CurrentUser,
  ) {
    return this.emprestimosService.devolver(estoqueId, id, user?.userId);
  }

  @Post(':id/termo/assinado')
  @UseInterceptors(
    // Sem "storage", o multer mantém o arquivo em memória (file.buffer); acima do limite -> 413
    FileInterceptor('arquivo', { limits: { fileSize: TERMO_ASSINADO_MAX_BYTES, files: 1 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['arquivo'],
      properties: { arquivo: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Anexa o PDF do termo assinado (PDF, até 5 MB)' })
  @ApiResponse({ status: 201, description: 'Termo assinado anexado' })
  @ApiResponse({ status: 400, description: 'Arquivo ausente, não-PDF ou acima do limite' })
  @ApiResponse({ status: 403, description: 'Usuário não é gestor do estoque' })
  @ApiResponse({ status: 404, description: 'Empréstimo não encontrado neste estoque' })
  @ApiResponse({ status: 409, description: 'Empréstimo não está aguardando termo' })
  anexarTermoAssinado(
    @Param('estoqueId') estoqueId: string,
    @Param('id') id: string,
    @UploadedFile() arquivo: ArquivoUpload | undefined,
    @GetCurrentUser() user?: CurrentUser,
  ) {
    return this.emprestimosService.anexarTermoAssinado(estoqueId, id, arquivo, user?.userId);
  }

  @Get(':id/termo/assinado')
  @ApiOperation({ summary: 'Baixa o PDF do termo assinado' })
  @ApiResponse({ status: 200, description: 'PDF assinado', content: { 'application/pdf': {} } })
  @ApiResponse({ status: 403, description: 'Sem permissão para consultar este estoque' })
  @ApiResponse({ status: 404, description: 'Empréstimo ou termo assinado não encontrado' })
  async baixarTermoAssinado(
    @Param('estoqueId') estoqueId: string,
    @Param('id') id: string,
    @GetCurrentUser() user?: CurrentUser,
  ): Promise<StreamableFile> {
    const { pdf, nomeArquivo } = await this.emprestimosService.obterPdfAssinado(
      estoqueId,
      id,
      user,
    );
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="${nomeArquivo}"`,
    });
  }

  @Post(':id/confirmar-entrega')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirma a entrega física: empréstimo vira ATIVO e item EMPRESTADO' })
  @ApiResponse({ status: 200, description: 'Empréstimo ativado' })
  @ApiResponse({ status: 403, description: 'Usuário não é gestor do estoque' })
  @ApiResponse({ status: 404, description: 'Empréstimo não encontrado neste estoque' })
  @ApiResponse({ status: 409, description: 'Sem termo assinado anexado ou status inválido' })
  confirmarEntrega(
    @Param('estoqueId') estoqueId: string,
    @Param('id') id: string,
    @GetCurrentUser() user?: CurrentUser,
  ) {
    return this.emprestimosService.confirmarEntrega(estoqueId, id, user?.userId);
  }

  @Get(':id/termo')
  @ApiOperation({ summary: 'Visualiza o termo de responsabilidade em PDF' })
  @ApiResponse({ status: 200, description: 'PDF do termo', content: { 'application/pdf': {} } })
  @ApiResponse({ status: 403, description: 'Sem permissão para consultar este estoque' })
  @ApiResponse({ status: 404, description: 'Empréstimo ou termo não encontrado' })
  async visualizarTermo(
    @Param('estoqueId') estoqueId: string,
    @Param('id') id: string,
    @GetCurrentUser() user?: CurrentUser,
  ): Promise<StreamableFile> {
    const { pdf, nomeArquivo } = await this.emprestimosService.obterPdf(estoqueId, id, user);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `inline; filename="${nomeArquivo}"`,
    });
  }

  @Get(':id/termo/download')
  @ApiOperation({ summary: 'Baixa o termo de responsabilidade em PDF' })
  @ApiResponse({ status: 200, description: 'PDF do termo', content: { 'application/pdf': {} } })
  @ApiResponse({ status: 403, description: 'Sem permissão para consultar este estoque' })
  @ApiResponse({ status: 404, description: 'Empréstimo ou termo não encontrado' })
  async baixarTermo(
    @Param('estoqueId') estoqueId: string,
    @Param('id') id: string,
    @GetCurrentUser() user?: CurrentUser,
  ): Promise<StreamableFile> {
    const { pdf, nomeArquivo } = await this.emprestimosService.obterPdf(estoqueId, id, user);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="${nomeArquivo}"`,
    });
  }
}

// ARQUIVO: src/modules/emprestimos/emprestimos.service.ts
import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, StatusEmprestimo, StatusItem, TipoItem, TipoMovimentacao } from '@prisma/client';
import { AccessRole } from '../../common/auth/access-role.enum';
import type { CurrentUser } from '../../common/auth/current-user.interface';
import { AccessDeniedException } from '../../common/exceptions/access-denied.exception';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/exceptions/error-code.enum';
import { ResourceConflictException } from '../../common/exceptions/resource-conflict.exception';
import { ResourceNotFoundException } from '../../common/exceptions/resource-not-found.exception';
import { PaginatedResponseDto } from '../../common/pagination/paginated-response.dto';
import type { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { PrismaService } from '../../database/prisma.service';
import type { CreateEmprestimoDto } from './dto/create-emprestimo.dto';
import {
  type ArquivoUpload,
  PDF_MAGIC,
  TERMO_ASSINADO_MAX_BYTES,
  TERMO_ASSINADO_MIME,
} from './termo-assinado.constants';
import { TermoPdfService } from './termo-pdf.service';
import { TermoStorageService } from './termo-storage.service';

// Empréstimo que ainda ocupa o item: aguardando o termo assinado ou ativo
const STATUS_PENDENTES = [StatusEmprestimo.AGUARDANDO_TERMO, StatusEmprestimo.ATIVO];

const INCLUDE_EMPRESTIMO = {
  item: true,
  responsavel: true,
  termo: { select: { id: true, numeroAno: true, arquivoAssinado: true } },
} as const;

function comFlagTermo<T extends { termo: { id: string; numeroAno: string; arquivoAssinado: string | null } | null }>(
  emprestimo: T,
) {
  const { termo, ...resto } = emprestimo;
  return {
    ...resto,
    termo: termo ? { id: termo.id, numeroAno: termo.numeroAno } : null,
    termoAssinadoAnexado: !!termo?.arquivoAssinado,
  };
}

type ResponsavelInput = CreateEmprestimoDto['responsavel'];

// Atraso é derivado, não é status (premissa A5): empréstimo ATIVO com prazo vencido
export function estaAtrasado(
  emprestimo: { status: StatusEmprestimo; prazoDevolucao: Date | null },
  agora: Date = new Date(),
): boolean {
  return (
    emprestimo.status === StatusEmprestimo.ATIVO &&
    emprestimo.prazoDevolucao !== null &&
    emprestimo.prazoDevolucao < agora
  );
}

@Injectable()
export class EmprestimosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly termoPdf: TermoPdfService,
    private readonly termoStorage: TermoStorageService,
  ) {}

  async create(estoqueId: string, dto: CreateEmprestimoDto, userId?: string) {
    const estoque = await this.findEstoqueOrFail(estoqueId);
    await this.assertGestorDoEstoque(estoqueId, userId);

    const item = await this.prisma.item.findFirst({ where: { id: dto.itemId, estoqueId } });
    if (!item) {
      throw new ResourceNotFoundException('Item', dto.itemId);
    }
    if (item.tipo === TipoItem.CONSUMO) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        'Item de consumo não pode ser emprestado: use entrada e saída.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (item.status !== StatusItem.DISPONIVEL) {
      throw new ResourceConflictException(`Item indisponível para empréstimo (${item.status}).`);
    }

    const dataRetirada = dto.dataRetirada ?? new Date();
    if (dto.prazoDevolucao && dto.prazoDevolucao < dataRetirada) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        'O prazo de devolução não pode ser anterior à data de retirada.',
        HttpStatus.BAD_REQUEST,
      );
    }

    let arquivoPdfCriado: string | undefined;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const emAberto = await tx.emprestimo.findFirst({
          where: { itemId: item.id, status: { in: STATUS_PENDENTES } },
        });
        if (emAberto) {
          throw new ResourceConflictException(
            'Este item já possui um empréstimo aguardando termo ou ativo.',
          );
        }

        const responsavel = await this.obterResponsavel(tx, dto.responsavel);

        const emprestimo = await tx.emprestimo.create({
          data: {
            itemId: item.id,
            responsavelId: responsavel.id,
            dataRetirada,
            prazoDevolucao: dto.prazoDevolucao ?? null,
            observacoes: dto.observacoes,
          },
          include: INCLUDE_EMPRESTIMO,
        });

        await tx.movimentacao.create({
          data: {
            itemId: item.id,
            tipo: TipoMovimentacao.SAIDA,
            quantidade: 1,
            usuarioId: userId as string,
            observacao: `Empréstimo ${emprestimo.id} (responsável: ${responsavel.nome})`,
          },
        });

        const ano = new Date().getFullYear();
        const contador = await tx.contadorTermo.upsert({
          where: { ano },
          create: { ano, ultimoNumero: 1 },
          update: { ultimoNumero: { increment: 1 } },
        });
        const numeroAno = `${String(contador.ultimoNumero).padStart(2, '0')}/${ano}`;
        const arquivoPdf = `${ano}/${randomUUID()}.pdf`;
        const pdf = await this.termoPdf.gerar({
          numeroAno,
          responsavel: {
            nome: responsavel.nome,
            siape: responsavel.siape,
            lotacao: responsavel.lotacao,
            cargo: responsavel.cargo,
          },
          unidade: estoque.nome,
          dataAbertura: emprestimo.dataRetirada,
          dataFechamento: emprestimo.prazoDevolucao,
          item: {
            nome: item.nome,
            tombamento: item.tombamento,
            numeroSerie: item.numeroSerie,
            descricao: item.descricao,
          },
        });
        await this.termoStorage.write(arquivoPdf, pdf);
        arquivoPdfCriado = arquivoPdf;

        const termo = await tx.termo.create({
          data: { numeroAno, arquivoPdf },
        });

        const resultado = await tx.emprestimo.update({
          where: { id: emprestimo.id },
          data: { termoId: termo.id },
          include: INCLUDE_EMPRESTIMO,
        });

        return comFlagTermo(resultado);
      });
    } catch (error) {
      if (arquivoPdfCriado) {
        try {
          await this.termoStorage.remove(arquivoPdfCriado);
        } catch (cleanupError) {
          throw new AggregateError(
            [error, cleanupError],
            'Falha ao salvar o empréstimo e ao remover o PDF temporário do termo.',
          );
        }
      }
      this.traduzirErroDeUnicidade(error);
    }
  }

  async obterPdf(estoqueId: string, emprestimoId: string, user?: CurrentUser) {
    await this.findEstoqueOrFail(estoqueId);
    if (user?.role !== AccessRole.ADMIN) {
      await this.assertGestorDoEstoque(estoqueId, user?.userId);
    }

    const emprestimo = await this.prisma.emprestimo.findFirst({
      where: { id: emprestimoId, item: { estoqueId } },
      include: { termo: true },
    });
    if (!emprestimo) {
      throw new ResourceNotFoundException('Empréstimo', emprestimoId);
    }
    if (!emprestimo.termo) {
      throw new ResourceNotFoundException('Termo', emprestimoId);
    }

    return {
      pdf: await this.termoStorage.read(emprestimo.termo.arquivoPdf),
      nomeArquivo: `termo-${emprestimo.termo.numeroAno.replace('/', '-')}.pdf`,
    };
  }

  // Anexa (ou substitui, enquanto aguarda) o PDF assinado. Não ativa o empréstimo.
  async anexarTermoAssinado(
    estoqueId: string,
    emprestimoId: string,
    arquivo: ArquivoUpload | undefined,
    userId?: string,
  ) {
    await this.findEstoqueOrFail(estoqueId);
    await this.assertGestorDoEstoque(estoqueId, userId);

    const emprestimo = await this.prisma.emprestimo.findFirst({
      where: { id: emprestimoId, item: { estoqueId } },
      include: { termo: true },
    });
    if (!emprestimo) {
      throw new ResourceNotFoundException('Empréstimo', emprestimoId);
    }
    if (!emprestimo.termo) {
      throw new ResourceNotFoundException('Termo', emprestimoId);
    }
    if (emprestimo.status !== StatusEmprestimo.AGUARDANDO_TERMO) {
      throw new ResourceConflictException(
        `Só é possível anexar o termo assinado a empréstimo aguardando termo (status atual: ${emprestimo.status}).`,
      );
    }

    this.validarPdf(arquivo);

    const anterior = emprestimo.termo.arquivoAssinado;
    const ano = new Date().getFullYear();
    const novoCaminho = `${ano}/assinados/${randomUUID()}.pdf`;

    await this.termoStorage.write(novoCaminho, arquivo.buffer);
    try {
      await this.prisma.termo.update({
        where: { id: emprestimo.termo.id },
        data: { arquivoAssinado: novoCaminho },
      });
    } catch (error) {
      await this.termoStorage.remove(novoCaminho).catch(() => undefined);
      throw error;
    }
    if (anterior) {
      await this.termoStorage.remove(anterior).catch(() => undefined);
    }

    const resultado = await this.prisma.emprestimo.findUniqueOrThrow({
      where: { id: emprestimoId },
      include: INCLUDE_EMPRESTIMO,
    });

    return comFlagTermo(resultado);
  }

  async obterPdfAssinado(estoqueId: string, emprestimoId: string, user?: CurrentUser) {
    await this.findEstoqueOrFail(estoqueId);
    if (user?.role !== AccessRole.ADMIN) {
      await this.assertGestorDoEstoque(estoqueId, user?.userId);
    }

    const emprestimo = await this.prisma.emprestimo.findFirst({
      where: { id: emprestimoId, item: { estoqueId } },
      include: { termo: true },
    });
    if (!emprestimo) {
      throw new ResourceNotFoundException('Empréstimo', emprestimoId);
    }
    if (!emprestimo.termo?.arquivoAssinado) {
      throw new ResourceNotFoundException('Termo assinado', emprestimoId);
    }

    return {
      pdf: await this.termoStorage.read(emprestimo.termo.arquivoAssinado),
      nomeArquivo: `termo-${emprestimo.termo.numeroAno.replace('/', '-')}-assinado.pdf`,
    };
  }

  // Confirma a entrega física: AGUARDANDO_TERMO -> ATIVO e item -> EMPRESTADO
  async confirmarEntrega(estoqueId: string, emprestimoId: string, userId?: string) {
    await this.findEstoqueOrFail(estoqueId);
    await this.assertGestorDoEstoque(estoqueId, userId);

    return this.prisma.$transaction(async (tx) => {
      const emprestimo = await tx.emprestimo.findFirst({
        where: { id: emprestimoId, item: { estoqueId } },
        include: { termo: true },
      });
      if (!emprestimo) {
        throw new ResourceNotFoundException('Empréstimo', emprestimoId);
      }
      if (emprestimo.status !== StatusEmprestimo.AGUARDANDO_TERMO) {
        throw new ResourceConflictException(
          `Só é possível confirmar a entrega de empréstimo aguardando termo (status atual: ${emprestimo.status}).`,
        );
      }
      if (!emprestimo.termo?.arquivoAssinado) {
        throw new ResourceConflictException(
          'Anexe o termo de responsabilidade assinado antes de confirmar a entrega.',
        );
      }

      const { count } = await tx.emprestimo.updateMany({
        where: { id: emprestimoId, status: StatusEmprestimo.AGUARDANDO_TERMO },
        data: { status: StatusEmprestimo.ATIVO },
      });
      if (count === 0) {
        throw new ResourceConflictException('A entrega deste empréstimo já foi confirmada.');
      }

      await tx.item.update({
        where: { id: emprestimo.itemId },
        data: { status: StatusItem.EMPRESTADO },
      });

      const resultado = await tx.emprestimo.findUniqueOrThrow({
        where: { id: emprestimoId },
        include: INCLUDE_EMPRESTIMO,
      });

      return comFlagTermo(resultado);
    });
  }

  // Valida tipo, tamanho e assinatura real do arquivo (não confia só no mimetype do cliente)
  private validarPdf(arquivo: ArquivoUpload | undefined): asserts arquivo is ArquivoUpload {
    const invalido = (mensagem: string) =>
      new AppException(ErrorCode.VALIDATION_FAILED, mensagem, HttpStatus.BAD_REQUEST);

    if (!arquivo?.buffer?.length) {
      throw invalido('Envie o PDF assinado no campo "arquivo" (multipart/form-data).');
    }
    if (arquivo.size > TERMO_ASSINADO_MAX_BYTES) {
      throw invalido(
        `O arquivo excede o limite de ${TERMO_ASSINADO_MAX_BYTES / (1024 * 1024)} MB.`,
      );
    }
    if (
      arquivo.mimetype !== TERMO_ASSINADO_MIME ||
      !arquivo.buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)
    ) {
      throw invalido('Arquivo inválido: apenas PDF é aceito.');
    }
  }

  // Pendentes = aguardando termo + ativos, com "atrasado" calculado na hora
  async findPendentes(estoqueId: string, query: PaginationQueryDto, user?: CurrentUser) {
    await this.findEstoqueOrFail(estoqueId);
    if (user?.role !== AccessRole.ADMIN) {
      await this.assertGestorDoEstoque(estoqueId, user?.userId);
    }

    const where = { status: { in: STATUS_PENDENTES }, item: { estoqueId } };
    const skip = (query.page - 1) * query.limit;

    const [emprestimos, total] = await Promise.all([
      this.prisma.emprestimo.findMany({
        where,
        include: INCLUDE_EMPRESTIMO,
        orderBy: [{ prazoDevolucao: { sort: 'asc', nulls: 'last' } }, { dataRetirada: 'desc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.emprestimo.count({ where }),
    ]);

    const agora = new Date();
    const items = emprestimos.map((emprestimo) => ({
      ...comFlagTermo(emprestimo),
      atrasado: estaAtrasado(emprestimo, agora),
    }));

    return PaginatedResponseDto.of(items, total, query);
  }

  async devolver(estoqueId: string, emprestimoId: string, userId?: string) {
    await this.findEstoqueOrFail(estoqueId);
    await this.assertGestorDoEstoque(estoqueId, userId);

    return this.prisma.$transaction(async (tx) => {
      const emprestimo = await tx.emprestimo.findFirst({
        where: { id: emprestimoId, item: { estoqueId } },
      });
      if (!emprestimo) {
        throw new ResourceNotFoundException('Empréstimo', emprestimoId);
      }
      if (emprestimo.status !== StatusEmprestimo.ATIVO) {
        throw new ResourceConflictException(
          `Só é possível devolver empréstimo ativo (status atual: ${emprestimo.status}).`,
        );
      }

      const { count } = await tx.emprestimo.updateMany({
        where: { id: emprestimoId, status: StatusEmprestimo.ATIVO },
        data: { status: StatusEmprestimo.DEVOLVIDO, dataDevolucaoEfetiva: new Date() },
      });
      if (count === 0) {
        throw new ResourceConflictException('Este empréstimo já foi devolvido.');
      }

      await tx.item.update({
        where: { id: emprestimo.itemId },
        data: { status: StatusItem.DISPONIVEL },
      });

      await tx.movimentacao.create({
        data: {
          itemId: emprestimo.itemId,
          tipo: TipoMovimentacao.DEVOLUCAO,
          quantidade: 1,
          usuarioId: userId as string,
          observacao: `Devolução do empréstimo ${emprestimo.id}`,
        },
      });

      const resultado = await tx.emprestimo.findUniqueOrThrow({
        where: { id: emprestimoId },
        include: INCLUDE_EMPRESTIMO,
      });

      return comFlagTermo(resultado);
    });
  }

  // Responsável é cadastro simples reaproveitado (A3): acha por Siape ou CPF; se não existir, cria.
  private async obterResponsavel(tx: Prisma.TransactionClient, dados: ResponsavelInput) {
    const filtros: Prisma.ResponsavelWhereInput[] = [];
    if (dados.siape) filtros.push({ siape: dados.siape });
    if (dados.cpf) filtros.push({ cpf: dados.cpf });

    const existentes = await tx.responsavel.findMany({ where: { OR: filtros } });
    if (existentes.length > 1) {
      throw new ResourceConflictException(
        'Siape e CPF informados pertencem a responsáveis diferentes já cadastrados.',
      );
    }

    const data = {
      nome: dados.nome,
      siape: dados.siape,
      cpf: dados.cpf,
      lotacao: dados.lotacao,
      cargo: dados.cargo,
      email: dados.email,
    };

    // Já cadastrado: atualiza com o que o gestor digitou agora (o termo usa os dados mais recentes)
    if (existentes.length === 1) {
      return tx.responsavel.update({ where: { id: existentes[0].id }, data });
    }
    return tx.responsavel.create({ data });
  }

  private async findEstoqueOrFail(estoqueId: string) {
    const estoque = await this.prisma.estoque.findUnique({ where: { id: estoqueId } });
    if (!estoque) {
      throw new ResourceNotFoundException('Estoque', estoqueId);
    }
    return estoque;
  }

  // Papel de gestor é por estoque (docs/permissoes.md, regra 2)
  private async assertGestorDoEstoque(estoqueId: string, userId?: string) {
    const vinculo = userId
      ? await this.prisma.estoqueGestor.findUnique({
          where: { estoqueId_usuarioId: { estoqueId, usuarioId: userId } },
        })
      : null;

    if (!vinculo) {
      throw new AccessDeniedException(
        'Apenas gestores deste estoque podem registrar ou consultar empréstimos.',
      );
    }
  }

  private traduzirErroDeUnicidade(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ResourceConflictException(
        'Responsável já cadastrado com este Siape ou CPF. Tente novamente.',
      );
    }
    throw error;
  }
}

// ARQUIVO: src/modules/emprestimos/dto/create-emprestimo.dto.ts
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

INSTRUÇÕES
1. Aplique partições de equivalência (válidas e inválidas) em cada variável de entrada.
2. Aplique análise de valores-limite dos dois lados de cada fronteira.
3. Garanta que cada critério de aceitação tenha ao menos um teste.
4. Em cada teste, adicione um comentário com a técnica usada
   (partição / valor-limite / critério) e o requisito coberto (ex.: CA2).
5. Use apenas os arquivos e caminhos fornecidos. O arquivo de saída é
   tests/v1-llm/us04-emprestimos.spec.ts e os imports apontam para ../../src/...
6. Responda com um único bloco de código.
```

</details>

- Resumo da resposta: A LLM devolveu um único arquivo com 138 testes (a saída do Vitest aponta `tests/v1-llm/us04-itens.spec.ts`), organizados em: schema `CreateEmprestimoSchema` (responsável por Siape ou CPF, normalização do CPF com limites de 10, 11 e 12 dígitos, campos obrigatórios, e-mail, `itemId`, prazo e data de retirada), função `estaAtrasado` (limites de 1 ms), `EmprestimosService` (`create`, `anexarTermoAssinado`, `confirmarEntrega`, `devolver`, `findPendentes`, `obterPdf` e `obterPdfAssinado`) com Prisma e storage mockados, e `EmprestimosController` delegando ao service. Inclui casos além dos CAs: numeração do termo (01/2026, 10/2026, 123/2026), limpeza do PDF quando a transação falha, concorrência (0 linhas atualizadas) e validação de PDF (tipo, assinatura `%PDF`, tamanho no limite). Para CA2 (selecionar responsável já cadastrado) e CA10 (histórico do responsável) a LLM deixou dois `it.todo`, com a justificativa "consulta ausente no módulo".
- Problemas observados: o arquivo carregou e rodou sem erro de import ou de setup. Quatro falhas de asserção (detalhadas abaixo), dois `it.todo` e nenhum teste que não compila. O arquivo foi salvo como `us04-itens.spec.ts`, e o nome indicado no prompt era `us04-emprestimos.spec.ts`. O primeiro teste do service levou 3,3 s (carga dos módulos), sem relação com falha.
- Resultado: 138 testes · 132 passando · 4 falhando · 0 não compilam · 2 todo

#### Contagem final
| Passando | Falhando | Não compilam | Todo (não contam como falha) |
|---|---|---|---|
| 132 | 4 | 0 | 2 |

#### Testes comentados por não compilar
| Teste | Motivo |
|---|---|
| nenhum | não se aplica |

#### Investigação das falhas
| Teste | Erro | Classificação | Evidência | Issue |
|---|---|---|---|---|
| EmprestimosService.create > deixa o prazo indefinido (null) quando omitido | `expected undefined to be null` (linha 470) | erro do teste (setup do mock) | A asserção da linha 468, que exige `prazoDevolucao: null` na chamada de `tx.emprestimo.create`, passou, então o service grava `null` (`dto.prazoDevolucao ?? null`). A linha 470 lê o retorno de `create`, que é o resultado do `tx.emprestimo.update` mockado repassado por `comFlagTermo`. O mock do update não traz `prazoDevolucao`, daí `undefined`. | não se aplica |
| EmprestimosService.create > deixa o prazo indefinido (null) quando nulo | igual ao anterior | erro do teste (setup do mock) | Mesma causa e mesma linha. | não se aplica |
| EmprestimosService.create > responsável com item em atraso > impede novo empréstimo para responsável com item em atraso | a promise resolveu (`AGUARDANDO_TERMO`) em vez de rejeitar | defeito real | `create` não consulta empréstimos ativos vencidos do responsável. `estaAtrasado` só é usado em `findPendentes` e não há menção a atraso ou pendência no fluxo de criação. O CA9 (premissa A5) não está implementado. O campo `justificativaPermanencia` já existe no schema, sem uso. | Issue 1 |
| EmprestimosService.create > responsável com item em atraso > informa a pendência na mensagem de erro | `Esperava que a promessa fosse rejeitada` | defeito real (mesma causa do anterior) | Como não há bloqueio, nenhum erro é lançado, então não existe mensagem de pendência. | Issue 1 |

## US04 — Suíte v2 (Theo)

> Trecho para colar no `docs/testes/llm-log.md`, depois da seção da v1 da US04. Revise os campos marcados antes do commit.

#### Rodada v2-1
- Data e hora: 14/11/2026 (escrita da suíte; a execução fica registrada abaixo)
- Modelo e contexto: Claude Sonnet 5.5, na mesma conversa da v1 da US04, com o zip atualizado do projeto anexado (código com a Issue 1 implementada, `tests/v1-llm/us04-emprestimos.spec.ts` já commitada e a matriz com a coluna "Coberto pela v1?" preenchida).
- Prompt das lacunas: texto da task S3B (suíte v2 em `tests/v2/`, cada mudança ligada a uma lacuna da matriz, meta de 100% dos CAs, partições e limites, e branches acima da v1) mais a ordem de analisar o projeto antes. As lacunas informadas vieram da coluna "Coberto pela v1?":
  - 13 casos `Não`: CT-04-02, 04, 05, 09, 34, 35, 36, 37, 38, 39, 40, 43 e 46.
  - 6 casos `Parcial`: CT-04-01, 10, 21, 28, 42 e 45.
  - 2 testes da v1 que falhavam por oráculo errado (prazo indefinido, CT-04-12) e 4 testes triviais (`toBeDefined`).
  - 3 branches descobertos do `emprestimos.service.ts` (linhas 196, 265 e 273).
- Resumo da resposta: arquivo `tests/v2/us04-emprestimos.spec.ts` com todos os testes da v1 (mantidos ou corrigidos) e os novos, cada um com o comentário `[v2] Lacuna CT-04-xx`. Novos grupos: perfis de acesso pelo controller com o service real (ADMIN, requisitante e gestor de outro estoque), fluxo completo com estado simulado, `registrarJustificativaPermanencia` e seu schema, bloqueio por atraso com as partições da matriz e os branches de `obterPdf` e `obterPdfAssinado`. `it.todo` para o que depende da Issue 2 (CT-04-05, 09, 10, 38 e 39) e para a PR-04 (CT-04-28).
- Problemas observados:
  - A primeira versão do arquivo foi escrita contra o código anterior, em que o bloqueio por atraso não existia, e usava `it.fails` para o CA-09. O zip atualizado mostrou a Issue 1 implementada, então esses testes viraram testes normais e foram acrescentados os da ação `justificativa-permanencia`.
  - O simulador de empréstimos existentes teve de respeitar os filtros novos do service (`prazoDevolucao.lt` e `justificativaPermanencia` nula), senão os casos "aceita" falhariam.
  - A LLM não executou a suíte. A execução e a contagem abaixo são do integrante.
- Revisão contra o requisito (marque ao concluir):
  - [ ] Cada teste `[v2]` confere o resultado esperado do CT que cita, e não só o que o código faz.
  - [ ] Os testes que usam o estado simulado (fluxo completo, devolver e emprestar de novo, justificativa e liberação) foram lidos contra a matriz.

#### Execução e contagem
Execução de 14/11/2026, 10:55 (`vitest run tests/v2/us04-emprestimos.spec.ts --config vitest.llm.config.ts`, Vitest v4.1.8, cobertura v8). Primeira rodada da v2, sem ajustes depois da execução.

| Passando | Falhando | Não compilam | Todo |
|---|---|---|---|
| 194 | 0 | 0 | 6 |

#### Investigação das falhas
Não houve falhas na v2. Os 6 `it.todo` não são falhas: CT-04-05, 09, 10, 38 e 39 dependem da Issue 2, e o CT-04-28 depende de confirmar a premissa PR-04.






#### Lacunas sinalizadas pela LLM (`it.todo`)
| Teste | CA | Verificação no código | Issue |
|---|---|---|---|
| lista responsáveis cadastrados com nome e Siape/CPF para seleção | CA2 | O controller só expõe criar, listar pendentes, devolução, termo e confirmar entrega. Não há consulta de responsáveis. | Issue 2 |
| retorna o histórico de empréstimos e devoluções de um responsável | CA10 | Também não há consulta de histórico por responsável. | Issue 2 |

Observação (fora dos CAs): as linhas 196, 265 e 273 do `emprestimos.service.ts` ficaram sem cobertura (caminhos de 404 em `obterPdf` e `obterPdfAssinado`).

## US05 — Termo de Responsabilidade (Randell)

#### Prompt Completo
````text
Você vai gerar testes automatizados com Vitest (TypeScript, NestJS 11, Prisma 5).

USER STORY
US05 — Termo de Responsabilidade: o requisitante recebe o Termo de Responsabilidade ao retirar um item emprestado, formalizando a posse temporária do equipamento.

CRITÉRIOS DE ACEITAÇÃO
- CA1: Dado que um empréstimo é registrado no sistema, quando o Termo de Responsabilidade em PDF é gerado, então ele recebe um número sequencial por ano (contador simples) no formato "Nº XX/ano".
- CA2: Dado que o Termo de Responsabilidade em PDF é gerado para um empréstimo, quando o documento é produzido, então ele contém os dados do responsável (nome, Siape, lotação e cargo), a unidade de acautelamento (estoque), a data de abertura, a data prevista para fechamento (ou "INDEFINIDO" quando ausente), os bens acautelados (tombamento ou nº de série, e denominação) e a declaração de responsabilidade.
- CA3: Dado que existe um termo gerado para um empréstimo, quando um usuário solicita visualizar ou baixar o PDF, então o acesso é permitido ao gestor do estoque do empréstimo e em modo leitura ao ADMIN, sendo recusado aos demais perfis.
- CA4: Dado que um usuário solicita visualizar ou baixar o termo de um empréstimo inexistente, quando a consulta é processada, então o erro é tratado como recurso não encontrado.
- CA5: Dado que o Termo de Responsabilidade em PDF foi gerado pelo sistema, quando o usuário autorizado visualiza ou baixa o arquivo, então o PDF do termo gerado é devolvido.
- CA6: Dado um empréstimo aguardando termo assinado, quando o gestor realiza o upload do PDF assinado, então o arquivo é validado e anexado ao empréstimo.
- CA7: Dado um empréstimo aguardando termo assinado, quando se verifica a confirmação da entrega, então a confirmação só é habilitada e permitida após o termo assinado ser anexado.
- CA8: Dado o fluxo de upload do termo assinado e confirmação da entrega, quando as operações são executadas com entradas válidas ou inválidas, então o sistema retorna as respectivas mensagens de sucesso ou de erro.

CÓDIGO DO MÓDULO

Arquivo: controle-estoque-emprestimos-back/src/modules/emprestimos/termo-pdf.service.ts
```ts
import { Injectable } from '@nestjs/common';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface TermoPdfData {
  numeroAno: string;
  responsavel: {
    nome: string;
    siape: string | null;
    lotacao: string;
    cargo: string;
  };
  unidade: string;
  dataAbertura: Date;
  dataFechamento: Date | null;
  item: {
    nome: string;
    tombamento: string | null;
    numeroSerie: string | null;
    descricao: string | null;
  };
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const formatarData = (val: any): string => {
  if (!val || val === 'null') return 'INDEFINIDO';
  const d = new Date(val);
  return isNaN(d.getTime()) ? 'INDEFINIDO' : d.toLocaleDateString('pt-BR');
};

@Injectable()
export class TermoPdfService {
  async gerar(data: TermoPdfData): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    pdf.setTitle(`Termo de Acautelamento Provisório Nº ${data.numeroAno}`);
    pdf.setSubject('Termo de responsabilidade de bem acautelado');

    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;

    const addPageIfNeeded = (height: number) => {
      if (y - height < MARGIN) {
        page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
      }
    };

    const drawWrapped = (text: string, font = regular, size = 10, lineHeight = 14) => {
      const words = text.split(/\s+/);
      let line = '';
      const lines: string[] = [];

      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) > CONTENT_WIDTH && line) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) lines.push(line);

      for (const lineText of lines) {
        addPageIfNeeded(lineHeight);
        page.drawText(lineText, {
          x: MARGIN,
          y: y - size,
          size,
          font,
          color: rgb(0.12, 0.16, 0.2),
        });
        y -= lineHeight;
      }
    };

    const drawField = (label: string, value: string) => {
      drawWrapped(`${label}: ${value}`);
    };

    const drawSection = (title: string) => {
      y -= 20;
      addPageIfNeeded(24);
      page.drawRectangle({
        x: MARGIN,
        y: y - 5,
        width: CONTENT_WIDTH,
        height: 20,
        color: rgb(0.91, 0.94, 0.97),
      });
      page.drawText(title, {
        x: MARGIN + 8,
        y,
        size: 11,
        font: bold,
        color: rgb(0.12, 0.16, 0.2),
      });
      y -= 24;
    };

    const date = (value: Date) =>
      new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(value);

    drawWrapped(
      'Conforme o item 10 da Instrução Normativa nº 205/88, todo servidor público poderá ser chamado à responsabilidade pelo desaparecimento do material que lhe for confiado, para guarda ou uso, bem como pelo dano que, doloso ou culposamente, causar a qualquer material, esteja ou não sob sua guarda.',
      regular,
      9,
      13,
    );
    y -= 12;

    const title = `TERMO DE ACAUTELAMENTO PROVISÓRIO Nº ${data.numeroAno}`;
    const titleWidth = bold.widthOfTextAtSize(title, 14);
    addPageIfNeeded(28);
    page.drawText(title, {
      x: (PAGE_WIDTH - titleWidth) / 2,
      y,
      size: 14,
      font: bold,
      color: rgb(0.08, 0.16, 0.26),
    });
    y -= 32;

    drawField('Nome', data.responsavel.nome);
    drawField('Siape', data.responsavel.siape ?? 'Não informado');
    drawField('Lotação', data.responsavel.lotacao);
    drawField('Cargo', data.responsavel.cargo);
    drawField('Unidade de Acautelamento', data.unidade);
    drawField('Data de Abertura', date(data.dataAbertura));
    drawField(
      'Data Prevista para Fechamento',
      formatarData(data.dataFechamento),
    );

    drawSection('BENS ACAUTELADOS');
    drawField(
      'Tombamento/Nº de Série',
      data.item.tombamento ?? data.item.numeroSerie ?? 'Sem identificação',
    );
    drawField('Denominação', data.item.nome);
    if (data.item.descricao) drawWrapped(data.item.descricao);

    drawSection('DECLARAÇÃO DE RESPONSABILIDADE');
    drawWrapped(
      'Declaro ter recebido o(s) bem(ns) patrimonial(ais) relacionado(s) no presente Termo. Assumindo total responsabilidade pela guarda e zelo do(s) mesmo(s), comprometendo-me a informar à Gerência de Infraestrutura sobre todas as ocorrências relativas ao(aos) referido(s) bem(ns) e ainda ressarcir o Órgão por perdas e danos caso comprovada a omissão da responsabilidade de minha parte.',
    );

    y -= 56;
    addPageIfNeeded(54);
    page.drawLine({
      start: { x: MARGIN + 45, y },
      end: { x: PAGE_WIDTH - MARGIN - 45, y },
      thickness: 1,
      color: rgb(0.25, 0.29, 0.33),
    });
    y -= 18;
    drawWrapped(data.responsavel.nome, bold, 10, 14);
    drawWrapped('Responsável pelo bem', regular, 9, 12);

    return pdf.save();
  }
}
```

Arquivo: controle-estoque-emprestimos-back/src/modules/emprestimos/termo-storage.service.ts
```ts
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TermoStorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    const configuredPath = config.get<string>('TERMO_STORAGE_PATH', './storage/termos');
    this.root = resolve(configuredPath);
  }

  async write(relativePath: string, contents: Uint8Array): Promise<void> {
    const absolutePath = this.resolvePath(relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, contents, { flag: 'wx' });
  }

  async read(relativePath: string): Promise<Buffer> {
    return readFile(this.resolvePath(relativePath));
  }

  async remove(relativePath: string): Promise<void> {
    await rm(this.resolvePath(relativePath), { force: true });
  }

  private resolvePath(relativePath: string): string {
    if (isAbsolute(relativePath)) {
      throw new Error('O caminho do arquivo do termo deve ser relativo ao storage.');
    }

    const absolutePath = resolve(this.root, relativePath);
    const fromRoot = relative(this.root, absolutePath);
    if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
      throw new Error('O caminho do arquivo do termo está fora do storage configurado.');
    }
    return absolutePath;
  }
}
```

Arquivo: controle-estoque-emprestimos-back/src/modules/emprestimos/termo-assinado.constants.ts
```ts
export const TERMO_ASSINADO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const TERMO_ASSINADO_MIME = 'application/pdf';
// Todo PDF válido começa com "%PDF-"
export const PDF_MAGIC = Buffer.from('%PDF-');

export interface ArquivoUpload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
```

Arquivo: controle-estoque-emprestimos-back/src/modules/emprestimos/emprestimos.service.ts (trechos de obtenção/anexo do termo e ativação em confirmarEntrega)
```ts
  async obterPdf(estoqueId: string, emprestimoId: string, user?: CurrentUser) {
    await this.findEstoqueOrFail(estoqueId);
    if (user?.role !== AccessRole.ADMIN) {
      await this.assertGestorDoEstoque(estoqueId, user?.userId);
    }

    const emprestimo = await this.prisma.emprestimo.findFirst({
      where: { id: emprestimoId, item: { estoqueId } },
      include: { termo: true },
    });
    if (!emprestimo) {
      throw new ResourceNotFoundException('Empréstimo', emprestimoId);
    }
    if (!emprestimo.termo) {
      throw new ResourceNotFoundException('Termo', emprestimoId);
    }

    return {
      pdf: await this.termoStorage.read(emprestimo.termo.arquivoPdf),
      nomeArquivo: `termo-${emprestimo.termo.numeroAno.replace('/', '-')}.pdf`,
    };
  }

  // Anexa (ou substitui, enquanto aguarda) o PDF assinado. Não ativa o empréstimo.
  async anexarTermoAssinado(
    estoqueId: string,
    emprestimoId: string,
    arquivo: ArquivoUpload | undefined,
    userId?: string,
  ) {
    await this.findEstoqueOrFail(estoqueId);
    await this.assertGestorDoEstoque(estoqueId, userId);

    const emprestimo = await this.prisma.emprestimo.findFirst({
      where: { id: emprestimoId, item: { estoqueId } },
      include: { termo: true },
    });
    if (!emprestimo) {
      throw new ResourceNotFoundException('Empréstimo', emprestimoId);
    }
    if (!emprestimo.termo) {
      throw new ResourceNotFoundException('Termo', emprestimoId);
    }
    if (emprestimo.status !== StatusEmprestimo.AGUARDANDO_TERMO) {
      throw new ResourceConflictException(
        `Só é possível anexar o termo assinado a empréstimo aguardando termo (status atual: ${emprestimo.status}).`,
      );
    }

    this.validarPdf(arquivo);

    const anterior = emprestimo.termo.arquivoAssinado;
    const ano = new Date().getFullYear();
    const novoCaminho = `${ano}/assinados/${randomUUID()}.pdf`;

    await this.termoStorage.write(novoCaminho, arquivo.buffer);
    try {
      await this.prisma.termo.update({
        where: { id: emprestimo.termo.id },
        data: { arquivoAssinado: novoCaminho },
      });
    } catch (error) {
      await this.termoStorage.remove(novoCaminho).catch(() => undefined);
      throw error;
    }
    if (anterior) {
      await this.termoStorage.remove(anterior).catch(() => undefined);
    }

    const resultado = await this.prisma.emprestimo.findUniqueOrThrow({
      where: { id: emprestimoId },
      include: INCLUDE_EMPRESTIMO,
    });

    return comFlagTermo(resultado);
  }

  async obterPdfAssinado(estoqueId: string, emprestimoId: string, user?: CurrentUser) {
    await this.findEstoqueOrFail(estoqueId);
    if (user?.role !== AccessRole.ADMIN) {
      await this.assertGestorDoEstoque(estoqueId, user?.userId);
    }

    const emprestimo = await this.prisma.emprestimo.findFirst({
      where: { id: emprestimoId, item: { estoqueId } },
      include: { termo: true },
    });
    if (!emprestimo) {
      throw new ResourceNotFoundException('Empréstimo', emprestimoId);
    }
    if (!emprestimo.termo?.arquivoAssinado) {
      throw new ResourceNotFoundException('Termo assinado', emprestimoId);
    }

    return {
      pdf: await this.termoStorage.read(emprestimo.termo.arquivoAssinado),
      nomeArquivo: `termo-${emprestimo.termo.numeroAno.replace('/', '-')}-assinado.pdf`,
    };
  }

  // Confirma a entrega física: AGUARDANDO_TERMO -> ATIVO e item -> EMPRESTADO
  async confirmarEntrega(estoqueId: string, emprestimoId: string, userId?: string) {
    await this.findEstoqueOrFail(estoqueId);
    await this.assertGestorDoEstoque(estoqueId, userId);

    return this.prisma.$transaction(async (tx) => {
      const emprestimo = await tx.emprestimo.findFirst({
        where: { id: emprestimoId, item: { estoqueId } },
        include: { termo: true },
      });
      if (!emprestimo) {
        throw new ResourceNotFoundException('Empréstimo', emprestimoId);
      }
      if (emprestimo.status !== StatusEmprestimo.AGUARDANDO_TERMO) {
        throw new ResourceConflictException(
          `Só é possível confirmar a entrega de empréstimo aguardando termo (status atual: ${emprestimo.status}).`,
        );
      }
      if (!emprestimo.termo?.arquivoAssinado) {
        throw new ResourceConflictException(
          'Anexe o termo de responsabilidade assinado antes de confirmar a entrega.',
        );
      }

      const { count } = await tx.emprestimo.updateMany({
        where: { id: emprestimoId, status: StatusEmprestimo.AGUARDANDO_TERMO },
        data: { status: StatusEmprestimo.ATIVO },
      });
      if (count === 0) {
        throw new ResourceConflictException('A entrega deste empréstimo já foi confirmada.');
      }

      await tx.item.update({
        where: { id: emprestimo.itemId },
        data: { status: StatusItem.EMPRESTADO },
      });

      const resultado = await tx.emprestimo.findUniqueOrThrow({
        where: { id: emprestimoId },
        include: INCLUDE_EMPRESTIMO,
      });

      return comFlagTermo(resultado);
    });
  }

  // Valida tipo, tamanho e assinatura real do arquivo (não confia só no mimetype do cliente)
  private validarPdf(arquivo: ArquivoUpload | undefined): asserts arquivo is ArquivoUpload {
    const invalido = (mensagem: string) =>
      new AppException(ErrorCode.VALIDATION_FAILED, mensagem, HttpStatus.BAD_REQUEST);

    if (!arquivo?.buffer?.length) {
      throw invalido('Envie o PDF assinado no campo "arquivo" (multipart/form-data).');
    }
    if (arquivo.size > TERMO_ASSINADO_MAX_BYTES) {
      throw invalido(
        `O arquivo excede o limite de ${TERMO_ASSINADO_MAX_BYTES / (1024 * 1024)} MB.`,
      );
    }
    if (
      arquivo.mimetype !== TERMO_ASSINADO_MIME ||
      !arquivo.buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)
    ) {
      throw invalido('Arquivo inválido: apenas PDF é aceito.');
    }
  }
```

INSTRUÇÕES
1. Aplique partições de equivalência (válidas e inválidas) em cada variável de entrada.
2. Aplique análise de valores-limite dos dois lados de cada fronteira.
3. Garanta que cada critério de aceitação tenha ao menos um teste.
4. Em cada teste, adicione um comentário com a técnica usada
   (partição / valor-limite / critério) e o requisito coberto (ex.: CA2).
5. Use apenas os arquivos e caminhos fornecidos. O arquivo de saída é
   tests/v1-llm/<story>.spec.ts e os imports apontam para ../../src/...
6. Responda com um único bloco de código.
````

#### Rodada 1
- Data e hora: 13/11/2026 às 20:22
- Prompt completo: o da seção acima.
- Resumo da resposta: um único arquivo, `tests/v1-llm/us05-termo.spec.ts`, com 90 testes em quatro blocos: constantes do upload, `TermoPdfService.gerar` (verifica o texto desenhado espionando `PDFPage.prototype.drawText`), `TermoStorageService` (grava em diretório temporário, cobre caminho absoluto, `..` e diretório irmão) e `EmprestimosService` (`obterPdf`, `obterPdfAssinado`, `anexarTermoAssinado` e `confirmarEntrega`, com Prisma e storage simulados). Cada teste traz o comentário de técnica e de requisito pedido no prompt. A LLM identificou as exceções pelo nome da classe, porque os caminhos delas não foram fornecidos.
- Problemas observados: o arquivo carregou e rodou sem erro de import, de tipo ou de setup, depois do `npm install` e do `npx prisma generate` do ambiente. Isso não conta como rodada com a LLM. No VS Code apareceram sublinhados de "módulo não encontrado" enquanto as dependências do back não estavam instaladas. Nenhuma falha de asserção. Nenhuma rodada extra foi necessária.
- Resultado: 90 testes · 90 passando · 0 falhando · 0 não compilam

#### Contagem final
| Passando | Falhando | Não compilam |
|---|---|---|
| 90 | 0 | 0 |

#### Testes comentados por não compilar
| Teste | Motivo |
|---|---|
| nenhum | não se aplica |

#### Investigação das falhas
| Teste | Erro | Classificação | Evidência | Issue |
|---|---|---|---|---|
| nenhuma falha | não se aplica | não se aplica | `npm run test:v1`: `us05-termo.spec.ts (90 tests)` passou por inteiro. A falha única da execução é de `us03-itens.spec.ts` e está na seção da US03. | não se aplica |

#### Cobertura (execução do `npm run test:v1`)
Os valores abaixo vêm da saída do comando. As linhas de `src/modules/emprestimos` só são exercidas pela suíte da US05, já que a US03 testa o módulo de itens.

| Arquivo | Linhas | Branch | Linhas com ramo não coberto |
|---|---|---|---|
| `termo-pdf.service.ts` | 100% | 96,15% | 67 |
| `termo-storage.service.ts` | 100% | 88,88% | 6 |
| `termo-assinado.constants.ts` | 100% | 100% | — |
| `emprestimos.service.ts` | 52,28% | 51,16% | 51, 67-181, 354-457, 484-489 |
| `emprestimos.controller.ts` | 0% | 100% | 29-167 |
| `dto/create-emprestimo.dto.ts` | 0% | 0% | 4-40 |

#### Observações da análise crítica (fora dos CAs)
Os itens 1 e 2 estão confirmados pela cobertura; os demais são de leitura do código do teste.
1. **CA1 coberto só pela exibição.** O sequencial por ano nasce em `EmprestimosService.create` (`contadorTermo.upsert` e `padStart(2, '0')`), nas linhas 67-181 do service, que ficaram sem cobertura. O `it.each` de "limites do padStart" (`01/2026` a `100/2026`) só confere que o PDF imprime a string recebida; não exercita o `padStart`.
2. **Controller sem teste.** `emprestimos.controller.ts` tem 0% de cobertura. O CA3 ("visualizar ou baixar") é testado no service, e os cabeçalhos `inline` e `attachment` do `StreamableFile` não são testados.
3. **Teste que passa por causa de um defeito.** `TermoStorageService › falha ao ler arquivo inexistente` espera rejeitar com `/ENOENT/`. Ele passa porque o erro de disco vaza pelo storage sem tradução (ACH-15, `docs/log-analise.md`). Nenhum teste verifica o que a API devolve quando o arquivo do termo some.
4. **Fuso da data prevista.** As datas de teste usam `12:00Z`, longe da virada de dia, e só a data de abertura tem teste de fronteira (`00:00:00Z` e `23:59:59Z`). A data de fechamento, que usa o fuso do servidor, não tem (ACH-09).
5. **Asserções frouxas.** Em `esperaInvalido`, `if (typeof e.getStatus === 'function') expect(...).toBe(400)` não falha se o método não existir.
6. **Limite de 5 MB só no número.** Nos testes de 5 MB, 5 MB − 1 e 5 MB + 1, o `size` é um valor do mock e o buffer real é de poucos bytes. Isso testa a comparação, não o recebimento de um arquivo grande.

## US06 — Alerta de estoque baixo (Mateus)

---

### Modelo de seção (copiar para cada story)

#### Rodada N
- Data e hora: ______
- Prompt completo: (colar o prompt já preenchido, com a story, os CAs e o código)
- Resumo da resposta: ______
- Problemas observados: ______
- Resultado: __ passando · __ falhando · __ não compilam

#### Contagem final
| Passando | Falhando | Não compilam |
|---|---|---|

#### Testes comentados por não compilar
| Teste | Motivo |
|---|---|

#### Investigação das falhas
| Teste | Erro | Classificação (oráculo errado, API inventada, setup, defeito real) | Evidência | Issue (se defeito real) |
|---|---|---|---|---|