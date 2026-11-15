import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, StatusEmprestimo, StatusItem, TipoItem, TipoMovimentacao } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { assertGestorDoEstoque } from '../../common/auth/assert-gestor-do-estoque';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/exceptions/error-code.enum';
import { ResourceNotFoundException } from '../../common/exceptions/resource-not-found.exception';
import { PrismaService } from '../../database/prisma.service';
import type { TransferirItemDto } from './dto/transferir-item.dto';
import { MovimentacoesService } from './movimentacoes.service';

type Db = Prisma.TransactionClient;

const MAX_TENTATIVAS = 3;

@Injectable()
export class TransferenciasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movimentacoesService: MovimentacoesService,
  ) {}

  async transferir(dto: TransferirItemDto, usuarioId: string | undefined) {
    if (dto.estoqueOrigemId === dto.estoqueDestinoId) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        'Origem e destino devem ser estoques diferentes',
        HttpStatus.BAD_REQUEST,
      );
    }

    for (let tentativa = 1; ; tentativa++) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.transferirNaTransacao(tx, dto, usuarioId),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (erro) {
        if ((erro as { code?: string } | null)?.code !== 'P2034') throw erro;
        if (tentativa >= MAX_TENTATIVAS) {
          throw new AppException(
            ErrorCode.CONFLICT,
            'Não foi possível concluir a transferência por conflito de concorrência. Tente novamente.',
            HttpStatus.CONFLICT,
          );
        }
      }
    }
  }

  private async transferirNaTransacao(
    tx: Db,
    dto: TransferirItemDto,
    usuarioId: string | undefined,
  ) {
    const origem = await this.buscarEstoqueAtivo(tx, dto.estoqueOrigemId, 'de origem');
    const destino = await this.buscarEstoqueAtivo(tx, dto.estoqueDestinoId, 'de destino');

    await assertGestorDoEstoque(
      tx,
      origem.id,
      usuarioId,
      'Apenas gestores do estoque de origem podem transferir itens.',
    );
    await assertGestorDoEstoque(
      tx,
      destino.id,
      usuarioId,
      'Apenas gestores do estoque de destino podem receber itens por transferência.',
    );

    const item = await tx.item.findFirst({
      where: { id: dto.itemId, estoqueId: origem.id },
    });
    if (!item) {
      throw new ResourceNotFoundException('Item', dto.itemId);
    }

    const emprestimoEmAberto = await tx.emprestimo.findFirst({
      where: {
        itemId: item.id,
        status: { in: [StatusEmprestimo.AGUARDANDO_TERMO, StatusEmprestimo.ATIVO] },
      },
    });
    if (emprestimoEmAberto) {
      throw new AppException(
        ErrorCode.CONFLICT,
        'Item com empréstimo ativo ou aguardando termo não pode ser transferido',
        HttpStatus.CONFLICT,
      );
    }

    const transferenciaId = randomUUID();
    const observacao = dto.observacao;
    let quantidade = 1;
    let itemDestinoId = item.id;

    if (item.tipo === TipoItem.PATRIMONIAL) {
      if (item.status !== StatusItem.DISPONIVEL) {
        throw new AppException(
          ErrorCode.VALIDATION_FAILED,
          'Apenas item patrimonial disponível pode ser transferido',
          HttpStatus.BAD_REQUEST,
        );
      }
      await tx.item.update({ where: { id: item.id }, data: { estoqueId: destino.id } });
    } else {
      if (dto.quantidade === undefined) {
        throw new AppException(
          ErrorCode.VALIDATION_FAILED,
          'Quantidade é obrigatória para item de consumo',
          HttpStatus.BAD_REQUEST,
        );
      }
      quantidade = dto.quantidade;

      const saldoOrigem = await this.movimentacoesService.calcularSaldoItem(item.id, tx, item.tipo);
      if (quantidade > saldoOrigem) {
        throw new AppException(
          ErrorCode.VALIDATION_FAILED,
          `Saldo insuficiente na origem: disponível ${saldoOrigem}, solicitado ${quantidade}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const existente = await tx.item.findFirst({
        where: {
          estoqueId: destino.id,
          tipo: TipoItem.CONSUMO,
          categoriaId: item.categoriaId,
          nome: { equals: item.nome, mode: 'insensitive' },
        },
      });
      const itemDestino =
        existente ??
        (await tx.item.create({
          data: {
            tipo: TipoItem.CONSUMO,
            nome: item.nome,
            descricao: item.descricao,
            nivelMinimo: item.nivelMinimo,
            categoriaId: item.categoriaId,
            estoqueId: destino.id,
          },
        }));
      itemDestinoId = itemDestino.id;
    }

    const dadosComuns = {
      quantidade,
      usuarioId: usuarioId ?? '',
      observacao,
      transferenciaId,
      estoqueOrigemId: origem.id,
      estoqueDestinoId: destino.id,
    };

    const movimentacaoSaida = await tx.movimentacao.create({
      data: { ...dadosComuns, itemId: item.id, tipo: TipoMovimentacao.TRANSFERENCIA },
    });
    const movimentacaoEntrada = await tx.movimentacao.create({
      data: { ...dadosComuns, itemId: itemDestinoId, tipo: TipoMovimentacao.ENTRADA },
    });

    return { transferenciaId, movimentacaoSaida, movimentacaoEntrada };
  }

  private async buscarEstoqueAtivo(tx: Db, estoqueId: string, papel: string) {
    const estoque = await tx.estoque.findUnique({ where: { id: estoqueId } });
    if (!estoque) {
      throw new ResourceNotFoundException('Estoque', estoqueId);
    }
    if (!estoque.ativo) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        `O estoque ${papel} está desativado`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return estoque;
  }
}