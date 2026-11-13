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


- Resultado: 106 testes · 105 passando · 1 falhando · 0 não compilam
- Problemas observados: o arquivo carregou e rodou sem erro de import ou de setup (incluindo o teste do controller com `Reflect.getMetadata`). Uma falha de asserção.

- Resumo da resposta: A LLM devolveu um único arquivo, `tests/v1-llm/us03-itens.spec.ts`, em três blocos: schemas Zod (`CreateItemSchema` e `UpdateItemSchema`), `ItensService` com o Prisma mockado via `vi.fn()` e `ItensController` instanciado direto, sem módulo Nest. Cada teste traz um comentário com a técnica (partição, valor-limite ou critério) e o requisito. Cobre CA1 a CA7 e inclui casos que não vêm dos CAs: estoque desativado, categoria inexistente, variações de P2002 (tombamento, número de série, outro campo, sem meta), paginação e a ordem das verificações no service.
- Execução: 13/11/2026, 08:48, com `npx vitest run --config vitest.tests.config.ts tests/v1-llm` (o config base só incluía `src/`, então foi criado um config separado; isso não alterou nenhum teste).
- Problemas observados: o arquivo carregou e rodou sem erro de import ou de setup, incluindo o teste do controller que usa `Reflect.getMetadata`. Houve uma falha de asserção. Nenhuma rodada extra foi necessária.
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

## US04 — Empréstimo e devolução (Theo)

## US05 — Termo de Responsabilidade (Randell)

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