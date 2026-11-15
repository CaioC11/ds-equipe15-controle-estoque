import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AccessRole } from '../../common/auth/access-role.enum';
import type { CurrentUser } from '../../common/auth/current-user.interface';
import { GetCurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import { RegistrarMovimentacaoDto } from './dto/registrar-movimentacao.dto';
import { TransferirItemDto } from './dto/transferir-item.dto';
import { MovimentacoesService } from './movimentacoes.service';
import { TransferenciasService } from './transferencias.service';

@Controller('movimentacoes')
@UseGuards(AuthGuard)
export class MovimentacoesController {
  constructor(
    private readonly movimentacoesService: MovimentacoesService,
    private readonly transferenciasService: TransferenciasService,
  ) {}

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

  // Transferência entre estoques: exige ser gestor da origem e do destino (403 para os demais)
  @Post('transferencias')
  async transferir(@Body() dto: TransferirItemDto, @GetCurrentUser() user: CurrentUser) {
    return this.transferenciasService.transferir(dto, this.getUserId(user));
  }

  @Get('saldo/item/:itemId')
  async consultarSaldoItem(@Param('itemId') itemId: string, @GetCurrentUser() user: CurrentUser) {
    return this.movimentacoesService.consultarSaldoItemAutorizado(
      itemId,
      this.getUserId(user),
      this.checkIsAdmin(user),
    );
  }

  @Get('saldo/estoque/:estoqueId')
  async consultarSaldoEstoque(
    @Param('estoqueId') estoqueId: string,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.movimentacoesService.consultarSaldoEstoqueAutorizado(
      estoqueId,
      this.getUserId(user),
      this.checkIsAdmin(user),
    );
  }

  @Get('alertas/estoque/:estoqueId')
  consultarAlertasEstoque(
    @Param('estoqueId') estoqueId: string,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.movimentacoesService.consultarAlertasEstoque(
      estoqueId,
      this.getUserId(user),
      this.checkIsAdmin(user),
    );
  }

  @Get('alertas')
  consultarMeusAlertas(@GetCurrentUser() user: CurrentUser) {
    return this.movimentacoesService.consultarMeusAlertas(
      this.getUserId(user),
      this.checkIsAdmin(user),
    );
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
