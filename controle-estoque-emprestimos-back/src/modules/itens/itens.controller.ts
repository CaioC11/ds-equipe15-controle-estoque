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
