import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ResourceConflictException } from '../../common/exceptions/resource-conflict.exception';
import { ResourceNotFoundException } from '../../common/exceptions/resource-not-found.exception';
import { PrismaService } from '../../database/prisma.service';
import { CreateEstoqueDto } from './dto/create-estoque.dto';
import { UpdateEstoqueDto } from './dto/update-estoque.dto';

@Injectable()
export class EstoquesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createEstoqueDto: CreateEstoqueDto) {
    const existing = await this.prisma.estoque.findFirst({
      where: {
        nome: {
          equals: createEstoqueDto.nome,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      throw new ConflictException('Já existe um estoque com este nome');
    }

    return this.prisma.estoque.create({
      data: {
        ...createEstoqueDto,
        ativo: true,
      },
    });
  }

  async findAll(verInativos?: boolean) {
    const where = verInativos ? {} : { ativo: true };

    const estoques = await this.prisma.estoque.findMany({
      where,
      include: {
        itens: true,
        gestores: true,
      },
      orderBy: { nome: 'asc' },
    });

    return estoques.map((estoque) => this.formatEstoqueComSaldo(estoque));
  }

  async findOne(id: string) {
    const estoque = await this.prisma.estoque.findUnique({
      where: { id },
      include: {
        itens: true,
        gestores: true,
      },
    });

    if (!estoque) {
      throw new NotFoundException('Estoque não encontrado');
    }

    return this.formatEstoqueComSaldo(estoque);
  }

  async update(id: string, updateEstoqueDto: UpdateEstoqueDto) {
    await this.findOne(id);

    if (updateEstoqueDto.nome) {
      const existing = await this.prisma.estoque.findFirst({
        where: {
          nome: {
            equals: updateEstoqueDto.nome,
            mode: 'insensitive',
          },
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException('Já existe um estoque com este nome');
      }
    }

    return this.prisma.estoque.update({
      where: { id },
      data: updateEstoqueDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.estoque.update({
      where: { id },
      data: { ativo: false },
    });
  }

  async listGestores(estoqueId: string) {
    await this.assertEstoqueExiste(estoqueId);
    return this.prisma.estoqueGestor.findMany({
      where: { estoqueId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addGestor(estoqueId: string, usuarioId: string) {
    await this.assertEstoqueExiste(estoqueId);
    const existente = await this.prisma.estoqueGestor.findUnique({
      where: { estoqueId_usuarioId: { estoqueId, usuarioId } },
    });
    if (existente) {
      throw new ResourceConflictException('Este usuário já é gestor deste estoque.');
    }

    return this.prisma.estoqueGestor.create({
      data: { estoqueId, usuarioId },
    });
  }

  async removeGestor(estoqueId: string, usuarioId: string) {
    await this.assertEstoqueExiste(estoqueId);
    const vinculo = await this.prisma.estoqueGestor.findUnique({
      where: { estoqueId_usuarioId: { estoqueId, usuarioId } },
    });
    if (!vinculo) {
      throw new ResourceNotFoundException('Vínculo de gestor', usuarioId);
    }

    return this.prisma.estoqueGestor.delete({
      where: { estoqueId_usuarioId: { estoqueId, usuarioId } },
    });
  }

  private async assertEstoqueExiste(estoqueId: string) {
    const estoque = await this.prisma.estoque.findUnique({ where: { id: estoqueId } });
    if (!estoque) {
      throw new ResourceNotFoundException('Estoque', estoqueId);
    }
  }

  private formatEstoqueComSaldo(estoque: any) {
    const totalItens = estoque.itens?.length || 0;
    const itensDisponiveis =
      estoque.itens?.filter((item: any) => item.status === 'DISPONIVEL').length || 0;
    const itensEmprestados =
      estoque.itens?.filter((item: any) => item.status === 'EMPRESTADO').length || 0;

    return {
      ...estoque,
      saldo: {
        totalItens,
        disponiveis: itensDisponiveis,
        emprestados: itensEmprestados,
      },
    };
  }
}
