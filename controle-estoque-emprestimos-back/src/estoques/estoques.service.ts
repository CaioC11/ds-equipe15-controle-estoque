import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateEstoqueDto } from './dto/create-estoque.dto';
import { UpdateEstoqueDto } from './dto/update-estoque.dto';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class EstoquesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createEstoqueDto: CreateEstoqueDto) {
    // Regra: Nome único, com mensagem clara em caso de duplicidade
    const estoqueExistente = await this.prisma.estoque.findUnique({
      where: { nome: createEstoqueDto.nome },
    });

    if (estoqueExistente) {
      throw new ConflictException('Já existe um estoque cadastrado com este nome.');
    }

    // Cria o estoque (o campo 'ativo' será true por defeito, conforme a base de dados)
    return this.prisma.estoque.create({
      data: {
        nome: createEstoqueDto.nome,
        descricao: createEstoqueDto.descricao,
        localizacao: createEstoqueDto.localizacao,
        //gestorId: createEstoqueDto.gestorId,//
        ativo: true, 
      },
    });
  }

  async findAll() {
    return this.prisma.estoque.findMany();
  }

  async findOne(id: string) {
    const estoque = await this.prisma.estoque.findUnique({
      where: { id },
    });

    if (!estoque) {
      throw new NotFoundException('Estoque não encontrado.');
    }

    return estoque;
  }

  async update(id: string, updateEstoqueDto: UpdateEstoqueDto) {
    await this.findOne(id); // Verifica se existe antes de atualizar

    return this.prisma.estoque.update({
      where: { id },
      data: updateEstoqueDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Verifica se existe

    // Regra: "desativar" = campo ativo, não apaga da base de dados
    return this.prisma.estoque.update({
      where: { id },
      data: { ativo: false },
    });
  }
}