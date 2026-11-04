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
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { CurrentUser } from '../../common/auth/current-user.interface';
import { GetCurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { CreateEmprestimoDto } from './dto/create-emprestimo.dto';
import { EmprestimosService } from './emprestimos.service';

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
