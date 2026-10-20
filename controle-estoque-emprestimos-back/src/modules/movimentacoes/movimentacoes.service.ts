import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RegistrarMovimentacaoDto } from './dto/registrar-movimentacao.dto';
import { TipoMovimentacao } from '@prisma/client';

@Injectable()
export class MovimentacoesService {
  constructor(private readonly prisma: PrismaService) {}

  async eGestorDoEstoque(estoqueId: string, usuarioId: string): Promise<boolean> {
    const gestor = await this.prisma.estoqueGestor.findUnique({
      where: {
        estoqueId_usuarioId: {
          estoqueId,
          usuarioId,
        },
      },
    });
    return !!gestor;
  }

  async calcularSaldoItem(itemId: string): Promise<number> {
    const movimentacoes = await this.prisma.movimentacao.findMany({
      where: { itemId },
    });

    return movimentacoes.reduce((saldo, mov) => {
      if (mov.tipo === TipoMovimentacao.ENTRADA || mov.tipo === TipoMovimentacao.DEVOLUCAO) {
        return saldo + mov.quantidade;
      }
      if (
        mov.tipo === TipoMovimentacao.SAIDA ||
        mov.tipo === TipoMovimentacao.TRANSFERENCIA ||
        mov.tipo === TipoMovimentacao.MANUTENCAO
      ) {
        return saldo - mov.quantidade;
      }
      return saldo;
    }, 0);
  }

  async registrarMovimentacao(
    dto: RegistrarMovimentacaoDto,
    usuarioId: string,
    isAdmin: boolean,
  ) {
    if (isAdmin) {
      throw new ForbiddenException('ADMIN tem permissão apenas de consulta');
    }

    const item = await this.prisma.item.findUnique({
      where: { id: dto.itemId },
    });

    if (!item) {
      throw new NotFoundException('Item não encontrado');
    }

    const eGestor = await this.eGestorDoEstoque(item.estoqueId, usuarioId);
    if (!eGestor) {
      throw new ForbiddenException('Apenas o gestor deste estoque pode registrar movimentações');
    }

    const saldoAtual = await this.calcularSaldoItem(dto.itemId);

    if (dto.tipo === TipoMovimentacao.SAIDA && dto.quantidade > saldoAtual) {
      throw new BadRequestException('Saldo insuficiente para realizar a saída');
    }

    const movimentacao = await this.prisma.movimentacao.create({
      data: {
        itemId: dto.itemId,
        tipo: dto.tipo,
        quantidade: dto.quantidade,
        observacao: dto.observacao,
        usuarioId,
      },
    });

    const novoSaldo = await this.calcularSaldoItem(dto.itemId);
    const abaixoDoMinimo =
      item.nivelMinimo !== null && item.nivelMinimo !== undefined
        ? novoSaldo <= item.nivelMinimo
        : false;

    return {
      movimentacao,
      saldoAtual: novoSaldo,
      abaixoDoMinimo,
    };
  }

  async consultarSaldoItem(itemId: string, usuarioId: string, isAdmin: boolean) {
    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException('Item não encontrado');
    }

    const eGestor = await this.eGestorDoEstoque(item.estoqueId, usuarioId);
    if (!isAdmin && !eGestor) {
      throw new ForbiddenException('Acesso negado às informações deste estoque');
    }

    const saldo = await this.calcularSaldoItem(itemId);
    const abaixoDoMinimo =
      item.nivelMinimo !== null && item.nivelMinimo !== undefined
        ? saldo <= item.nivelMinimo
        : false;

    return {
      itemId: item.id,
      nomeItem: item.nome,
      estoqueId: item.estoqueId,
      saldo,
      nivelMinimo: item.nivelMinimo,
      abaixoDoMinimo,
    };
  }

  async consultarHistoricoEstoque(estoqueId: string, usuarioId: string, isAdmin: boolean) {
    const eGestor = await this.eGestorDoEstoque(estoqueId, usuarioId);
    if (!isAdmin && !eGestor) {
      throw new ForbiddenException('Acesso negado ao histórico deste estoque');
    }

    return this.prisma.movimentacao.findMany({
      where: {
        item: { estoqueId },
      },
      include: {
        item: {
          select: {
            id: true,
            nome: true,
            tipo: true,
          },
        },
      },
      orderBy: {
        dataMovimentacao: 'desc',
      },
    });
  }
}