import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { RegistrarMovimentacaoDto } from './dto/registrar-movimentacao.dto';
import { MovimentacoesService } from './movimentacoes.service';

@Controller('movimentacoes')
export class MovimentacoesController {
  constructor(private readonly movimentacoesService: MovimentacoesService) {}

  @Post()
  async registrar(@Body() dto: RegistrarMovimentacaoDto, @Req() req: any) {
    const usuarioId = req.user?.sub || req.user?.id;
    const roles: string[] = req.user?.roles || req.user?.realm_access?.roles || [];
    const isAdmin = roles.includes('ADMIN');

    return this.movimentacoesService.registrarMovimentacao(dto, usuarioId, isAdmin);
  }

  @Get('saldo/item/:itemId')
  async consultarSaldoItem(@Param('itemId') itemId: string, @Req() req: any) {
    const usuarioId = req.user?.sub || req.user?.id;
    const roles: string[] = req.user?.roles || req.user?.realm_access?.roles || [];
    const isAdmin = roles.includes('ADMIN');

    return this.movimentacoesService.consultarSaldoItem(itemId, usuarioId, isAdmin);
  }

  @Get('saldo/estoque/:estoqueId')
  async consultarSaldoEstoque(@Param('estoqueId') estoqueId: string, @Req() req: any) {
    const usuarioId = req.user?.sub || req.user?.id;
    const roles: string[] = req.user?.roles || req.user?.realm_access?.roles || [];
    const isAdmin = roles.includes('ADMIN');

    return this.movimentacoesService.consultarSaldoEstoque(estoqueId, usuarioId, isAdmin);
  }

  @Get('historico/estoque/:estoqueId')
  async consultarHistoricoEstoque(@Param('estoqueId') estoqueId: string, @Req() req: any) {
    const usuarioId = req.user?.sub || req.user?.id;
    const roles: string[] = req.user?.roles || req.user?.realm_access?.roles || [];
    const isAdmin = roles.includes('ADMIN');

    return this.movimentacoesService.consultarHistoricoEstoque(estoqueId, usuarioId, isAdmin);
  }
}
