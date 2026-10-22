import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AccessRole } from '../../common/auth/access-role.enum';
import type { CurrentUser } from '../../common/auth/current-user.interface';
import { GetCurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import { RegistrarMovimentacaoDto } from './dto/registrar-movimentacao.dto';
import { MovimentacoesService } from './movimentacoes.service';

@Controller('movimentacoes')
@UseGuards(AuthGuard)
export class MovimentacoesController {
  constructor(private readonly movimentacoesService: MovimentacoesService) {}

  private getUserId(user: CurrentUser): string {
    return user.userId ?? '';
  }

  private checkIsAdmin(user: CurrentUser): boolean {
    return user.role === AccessRole.ADMIN;
  }

  @Post()
  async registrar(@Body() dto: RegistrarMovimentacaoDto, @GetCurrentUser() user: CurrentUser) {
    return this.movimentacoesService.registrarMovimentacao(
      dto,
      this.getUserId(user),
      this.checkIsAdmin(user),
    );
  }

  @Get('saldo/item/:itemId')
  async consultarSaldoItem(@Param('itemId') itemId: string) {
    return this.movimentacoesService.consultarSaldoItem(itemId);
  }

  @Get('saldo/estoque/:estoqueId')
  async consultarSaldoEstoque(@Param('estoqueId') estoqueId: string) {
    return this.movimentacoesService.consultarSaldoEstoque(estoqueId);
  }

  @Get('historico/estoque/:estoqueId')
  async consultarHistoricoEstoque(
    @Param('estoqueId') estoqueId: string,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.movimentacoesService.consultarHistoricoEstoque(
      estoqueId,
      this.getUserId(user),
      this.checkIsAdmin(user),
    );
  }
}
