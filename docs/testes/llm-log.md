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