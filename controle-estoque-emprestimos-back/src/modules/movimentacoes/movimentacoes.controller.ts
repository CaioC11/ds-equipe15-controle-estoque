import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
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
    const userObj = user as any;
    return userObj?.sub || userObj?.id || '';
  }

  private checkIsAdmin(user: CurrentUser): boolean {
    const userObj = user as any;
    const roles: string[] = userObj?.roles || userObj?.realm_access?.roles || [];
    return roles.includes('ADMIN');
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
  consultarSaldoItem(@Param('itemId') itemId: string) {
    return this.movimentacoesService.consultarSaldoItem(itemId);
  }

  @Get('saldo/estoque/:estoqueId')
  consultarSaldoEstoque(@Param('estoqueId') estoqueId: string) {
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
