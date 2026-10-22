import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TipoMovimentacao } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RegistrarMovimentacaoDto } from './dto/registrar-movimentacao.dto';

type Db = Prisma.TransactionClient;

const TIPOS_QUE_SOMAM: TipoMovimentacao[] = [TipoMovimentacao.ENTRADA, TipoMovimentacao.DEVOLUCAO];

const TIPOS_QUE_SUBTRAEM: TipoMovimentacao[] = [
  TipoMovimentacao.SAIDA,
  TipoMovimentacao.TRANSFERENCIA,
  TipoMovimentacao.MANUTENCAO,
];

const MAX_TENTATIVAS = 3;

@Injectable()
export class MovimentacoesService {
  constructor(private readonly prisma: PrismaService) {}

  async eGestorDoEstoque(
    estoqueId: string,
    usuarioId: string,
    db: Db = this.prisma,
  ): Promise<boolean> {
    const gestor = await db.estoqueGestor.findUnique({
      where: { estoqueId_usuarioId: { estoqueId, usuarioId } },
    });
    return !!gestor;
  }

  /** Soma no banco (groupBy) em vez de carregar todas as movimentações em memória. */
  async calcularSaldoItem(itemId: string, db: Db = this.prisma): Promise<number> {
    const grupos = await db.movimentacao.groupBy({
      by: ['tipo'],
      where: { itemId },
      _sum: { quantidade: true },
    });

    return grupos.reduce(
      (saldo, g) => saldo + this.aplicarSinal(g.tipo, g._sum.quantidade ?? 0),
      0,
    );
  }

  async registrarMovimentacao(dto: RegistrarMovimentacaoDto, usuarioId: string, isAdmin: boolean) {
    if (isAdmin) {
      throw new ForbiddenException('ADMIN tem permissão apenas de consulta');
    }

    if (!Number.isInteger(dto.quantidade) || dto.quantidade <= 0) {
      throw new BadRequestException('A quantidade deve ser um inteiro maior que zero');
    }

    for (let tentativa = 1; ; tentativa++) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.registrarNaTransacao(tx, dto, usuarioId),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (erro) {
        if (!this.eConflitoDeSerializacao(erro)) throw erro;
        if (tentativa >= MAX_TENTATIVAS) {
          throw new ConflictException(
            'Não foi possível registrar a movimentação por conflito de concorrência. Tente novamente.',
          );
        }
      }
    }
  }

  async consultarSaldoItem(itemId: string) {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });

    if (!item) {
      throw new NotFoundException('Item não encontrado');
    }

    const saldo = await this.calcularSaldoItem(itemId);

    return {
      itemId: item.id,
      nomeItem: item.nome,
      estoqueId: item.estoqueId,
      saldo,
      nivelMinimo: item.nivelMinimo,
      abaixoDoMinimo: this.abaixoDoMinimo(saldo, item.nivelMinimo),
    };
  }

  async consultarSaldoEstoque(estoqueId: string) {
    const estoque = await this.prisma.estoque.findUnique({
      where: { id: estoqueId },
    });

    if (!estoque) {
      throw new NotFoundException('Estoque não encontrado');
    }

    const itens = await this.prisma.item.findMany({
      where: { estoqueId },
    });

    const saldos = await Promise.all(
      itens.map(async (item) => {
        const saldo = await this.calcularSaldoItem(item.id);
        return {
          itemId: item.id,
          nomeItem: item.nome,
          saldo,
          nivelMinimo: item.nivelMinimo,
          abaixoDoMinimo: this.abaixoDoMinimo(saldo, item.nivelMinimo),
        };
      }),
    );

    return {
      estoqueId,
      itens: saldos,
    };
  }

  async consultarHistoricoEstoque(estoqueId: string, usuarioId: string, isAdmin: boolean) {
    await this.garantirAcessoLeitura(
      estoqueId,
      usuarioId,
      isAdmin,
      'Acesso negado ao histórico deste estoque',
    );

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

  // ---------------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------------

  private async registrarNaTransacao(tx: Db, dto: RegistrarMovimentacaoDto, usuarioId: string) {
    const item = await tx.item.findUnique({ where: { id: dto.itemId } });

    if (!item) {
      throw new NotFoundException('Item não encontrado');
    }

    const eGestor = await this.eGestorDoEstoque(item.estoqueId, usuarioId, tx);
    if (!eGestor) {
      throw new ForbiddenException('Apenas o gestor deste estoque pode registrar movimentações');
    }

    const saldoAtual = await this.calcularSaldoItem(dto.itemId, tx);

    if (TIPOS_QUE_SUBTRAEM.includes(dto.tipo) && dto.quantidade > saldoAtual) {
      throw new BadRequestException('Saldo insuficiente para realizar a movimentação');
    }

    const movimentacao = await tx.movimentacao.create({
      data: {
        itemId: dto.itemId,
        tipo: dto.tipo,
        quantidade: dto.quantidade,
        observacao: dto.observacao,
        usuarioId,
      },
    });

    const novoSaldo = saldoAtual + this.aplicarSinal(dto.tipo, dto.quantidade);

    return {
      movimentacao,
      saldoAtual: novoSaldo,
      abaixoDoMinimo: this.abaixoDoMinimo(novoSaldo, item.nivelMinimo),
    };
  }

  private async garantirAcessoLeitura(
    estoqueId: string,
    usuarioId: string,
    isAdmin: boolean,
    mensagem: string,
  ): Promise<void> {
    if (isAdmin) return;
    const eGestor = await this.eGestorDoEstoque(estoqueId, usuarioId);
    if (!eGestor) {
      throw new ForbiddenException(mensagem);
    }
  }

  private aplicarSinal(tipo: TipoMovimentacao, quantidade: number): number {
    if (TIPOS_QUE_SOMAM.includes(tipo)) return quantidade;
    if (TIPOS_QUE_SUBTRAEM.includes(tipo)) return -quantidade;
    return 0;
  }

  private abaixoDoMinimo(saldo: number, nivelMinimo: number | null | undefined): boolean {
    return nivelMinimo !== null && nivelMinimo !== undefined && saldo <= nivelMinimo;
  }

  private eConflitoDeSerializacao(erro: unknown): boolean {
    return (erro as { code?: string } | null)?.code === 'P2034';
  }
}
