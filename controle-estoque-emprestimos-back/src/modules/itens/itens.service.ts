import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccessDeniedException } from '../../common/exceptions/access-denied.exception';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/exceptions/error-code.enum';
import { ResourceConflictException } from '../../common/exceptions/resource-conflict.exception';
import { ResourceNotFoundException } from '../../common/exceptions/resource-not-found.exception';
import { PaginatedResponseDto } from '../../common/pagination/paginated-response.dto';
import { PrismaService } from '../../database/prisma.service';
import type { CompletarTombamentoDto } from './dto/completar-tombamento.dto';
import type { CreateItemDto } from './dto/create-item.dto';
import type { ListItensQueryDto } from './dto/list-itens-query.dto';
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
      const item = await this.prisma.item.create({
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
      return this.comTombamentoPendente(item);
    } catch (error) {
      this.traduzirErroDeUnicidade(error);
    }
  }

  async findAllByEstoque(estoqueId: string, query: ListItensQueryDto) {
    await this.findEstoqueOrFail(estoqueId);

    const where: Prisma.ItemWhereInput = { estoqueId };
    if (query.pendente === true) {
      where.tipo = 'PATRIMONIAL';
      where.tombamento = null;
    } else if (query.pendente === false) {
      where.OR = [{ tipo: { not: 'PATRIMONIAL' } }, { tombamento: { not: null } }];
    }

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

    const itemsComStatus = items.map((item) => this.comTombamentoPendente(item));
    return PaginatedResponseDto.of(itemsComStatus, total, query);
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

    if (
      item.tombamento &&
      dto.tombamento !== undefined &&
      (dto.tombamento === null || dto.tombamento.trim() === '')
    ) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        'Tombamento já preenchido não pode ser apagado',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (dto.categoriaId) {
      await this.assertCategoriaExiste(dto.categoriaId);
    }

    try {
      const atualizado = await this.prisma.item.update({
        where: { id: itemId },
        data: dto,
        include: { categoria: true },
      });
      return this.comTombamentoPendente(atualizado);
    } catch (error) {
      this.traduzirErroDeUnicidade(error);
    }
  }

  async completarTombamento(
    estoqueId: string,
    itemId: string,
    dto: CompletarTombamentoDto,
    userId?: string,
  ) {
    await this.findEstoqueOrFail(estoqueId);
    await this.assertGestorDoEstoque(estoqueId, userId);

    const item = await this.prisma.item.findFirst({
      where: { id: itemId, estoqueId },
    });
    if (!item) {
      throw new ResourceNotFoundException('Item', itemId);
    }

    if (item.tipo !== 'PATRIMONIAL') {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        'Item de consumo não possui tombamento',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (item.tombamento) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        'Este item já possui tombamento cadastrado',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const atualizado = await this.prisma.item.update({
        where: { id: itemId },
        data: { tombamento: dto.tombamento },
        include: { categoria: true },
      });
      return this.comTombamentoPendente(atualizado);
    } catch (error) {
      this.traduzirErroDeUnicidade(error);
    }
  }

  private comTombamentoPendente<T extends { tipo?: string; tombamento?: string | null }>(item: T) {
    return {
      ...item,
      tombamentoPendente: item.tipo === 'PATRIMONIAL' && !item.tombamento,
    };
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