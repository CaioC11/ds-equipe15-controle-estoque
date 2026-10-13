import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';

@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.categoria.findMany({
      orderBy: { nome: 'asc' },
    });
  }

  async create(data: CreateCategoriaDto) {
    const existe = await this.prisma.categoria.findUnique({
      where: { nome: data.nome },
    });

    if (existe) {
      throw new ConflictException('Já existe uma categoria com este nome');
    }

    return this.prisma.categoria.create({ data });
  }

  async update(id: string, data: UpdateCategoriaDto) {
    const categoria = await this.prisma.categoria.findUnique({ where: { id } });
    if (!categoria) {
      throw new NotFoundException('Categoria não encontrada');
    }

    if (data.nome && data.nome !== categoria.nome) {
      const existe = await this.prisma.categoria.findUnique({
        where: { nome: data.nome },
      });
      if (existe) {
        throw new ConflictException('Já existe uma categoria com este nome');
      }
    }

    return this.prisma.categoria.update({
      where: { id },
      data,
    });
  }
}