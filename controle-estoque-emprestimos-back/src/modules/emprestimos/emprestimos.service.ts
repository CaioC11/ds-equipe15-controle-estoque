import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, StatusEmprestimo, StatusItem, TipoItem, TipoMovimentacao } from '@prisma/client';
import { AccessRole } from '../../common/auth/access-role.enum';
import type { CurrentUser } from '../../common/auth/current-user.interface';
import { AccessDeniedException } from '../../common/exceptions/access-denied.exception';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/exceptions/error-code.enum';
import { ResourceConflictException } from '../../common/exceptions/resource-conflict.exception';
import { ResourceNotFoundException } from '../../common/exceptions/resource-not-found.exception';
import { PaginatedResponseDto } from '../../common/pagination/paginated-response.dto';
import type { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { PrismaService } from '../../database/prisma.service';
import type { CreateEmprestimoDto } from './dto/create-emprestimo.dto';
import {
  type ArquivoUpload,
  PDF_MAGIC,
  TERMO_ASSINADO_MAX_BYTES,
  TERMO_ASSINADO_MIME,
} from './termo-assinado.constants';
import { TermoPdfService } from './termo-pdf.service';
import { TermoStorageService } from './termo-storage.service';

// Empréstimo que ainda ocupa o item: aguardando o termo assinado ou ativo
const STATUS_PENDENTES = [StatusEmprestimo.AGUARDANDO_TERMO, StatusEmprestimo.ATIVO];

const INCLUDE_EMPRESTIMO = {
  item: true,
  responsavel: true,
  termo: { select: { id: true, numeroAno: true, arquivoAssinado: true } },
} as const;

function comFlagTermo<T extends { termo: { id: string; numeroAno: string; arquivoAssinado: string | null } | null }>(
  emprestimo: T,
) {
  const { termo, ...resto } = emprestimo;
  return {
    ...resto,
    termo: termo ? { id: termo.id, numeroAno: termo.numeroAno } : null,
    termoAssinadoAnexado: !!termo?.arquivoAssinado,
  };
}

type ResponsavelInput = CreateEmprestimoDto['responsavel'];

// Atraso é derivado, não é status (premissa A5): empréstimo ATIVO com prazo vencido
export function estaAtrasado(
  emprestimo: { status: StatusEmprestimo; prazoDevolucao: Date | null },
  agora: Date = new Date(),
): boolean {
  return (
    emprestimo.status === StatusEmprestimo.ATIVO &&
    emprestimo.prazoDevolucao !== null &&
    emprestimo.prazoDevolucao < agora
  );
}

@Injectable()
export class EmprestimosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly termoPdf: TermoPdfService,
    private readonly termoStorage: TermoStorageService,
  ) {}

  async create(estoqueId: string, dto: CreateEmprestimoDto, userId?: string) {
    const estoque = await this.findEstoqueOrFail(estoqueId);
    await this.assertGestorDoEstoque(estoqueId, userId);

    const item = await this.prisma.item.findFirst({ where: { id: dto.itemId, estoqueId } });
    if (!item) {
      throw new ResourceNotFoundException('Item', dto.itemId);
    }
    if (item.tipo === TipoItem.CONSUMO) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        'Item de consumo não pode ser emprestado: use entrada e saída.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (item.status !== StatusItem.DISPONIVEL) {
      throw new ResourceConflictException(`Item indisponível para empréstimo (${item.status}).`);
    }

    const dataRetirada = dto.dataRetirada ?? new Date();
    if (dto.prazoDevolucao && dto.prazoDevolucao < dataRetirada) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        'O prazo de devolução não pode ser anterior à data de retirada.',
        HttpStatus.BAD_REQUEST,
      );
    }

    let arquivoPdfCriado: string | undefined;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const emAberto = await tx.emprestimo.findFirst({
          where: { itemId: item.id, status: { in: STATUS_PENDENTES } },
        });
        if (emAberto) {
          throw new ResourceConflictException(
            'Este item já possui um empréstimo aguardando termo ou ativo.',
          );
        }

        const responsavel = await this.obterResponsavel(tx, dto.responsavel);

        const emprestimo = await tx.emprestimo.create({
          data: {
            itemId: item.id,
            responsavelId: responsavel.id,
            dataRetirada,
            prazoDevolucao: dto.prazoDevolucao ?? null,
            observacoes: dto.observacoes,
          },
          include: INCLUDE_EMPRESTIMO,
        });

        await tx.movimentacao.create({
          data: {
            itemId: item.id,
            tipo: TipoMovimentacao.SAIDA,
            quantidade: 1,
            usuarioId: userId as string,
            observacao: `Empréstimo ${emprestimo.id} (responsável: ${responsavel.nome})`,
          },
        });

        const ano = new Date().getFullYear();
        const contador = await tx.contadorTermo.upsert({
          where: { ano },
          create: { ano, ultimoNumero: 1 },
          update: { ultimoNumero: { increment: 1 } },
        });
        const numeroAno = `${String(contador.ultimoNumero).padStart(2, '0')}/${ano}`;
        const arquivoPdf = `${ano}/${randomUUID()}.pdf`;
        const pdf = await this.termoPdf.gerar({
          numeroAno,
          responsavel: {
            nome: responsavel.nome,
            siape: responsavel.siape,
            lotacao: responsavel.lotacao,
            cargo: responsavel.cargo,
          },
          unidade: estoque.nome,
          dataAbertura: emprestimo.dataRetirada,
          dataFechamento: emprestimo.prazoDevolucao,
          item: {
            nome: item.nome,
            tombamento: item.tombamento,
            numeroSerie: item.numeroSerie,
            descricao: item.descricao,
          },
        });
        await this.termoStorage.write(arquivoPdf, pdf);
        arquivoPdfCriado = arquivoPdf;

        const termo = await tx.termo.create({
          data: { numeroAno, arquivoPdf },
        });

        const resultado = await tx.emprestimo.update({
          where: { id: emprestimo.id },
          data: { termoId: termo.id },
          include: INCLUDE_EMPRESTIMO,
        });

        return comFlagTermo(resultado);
      });
    } catch (error) {
      if (arquivoPdfCriado) {
        try {
          await this.termoStorage.remove(arquivoPdfCriado);
        } catch (cleanupError) {
          throw new AggregateError(
            [error, cleanupError],
            'Falha ao salvar o empréstimo e ao remover o PDF temporário do termo.',
          );
        }
      }
      this.traduzirErroDeUnicidade(error);
    }
  }

  async obterPdf(estoqueId: string, emprestimoId: string, user?: CurrentUser) {
    await this.findEstoqueOrFail(estoqueId);
    if (user?.role !== AccessRole.ADMIN) {
      await this.assertGestorDoEstoque(estoqueId, user?.userId);
    }

    const emprestimo = await this.prisma.emprestimo.findFirst({
      where: { id: emprestimoId, item: { estoqueId } },
      include: { termo: true },
    });
    if (!emprestimo) {
      throw new ResourceNotFoundException('Empréstimo', emprestimoId);
    }
    if (!emprestimo.termo) {
      throw new ResourceNotFoundException('Termo', emprestimoId);
    }

    return {
      pdf: await this.termoStorage.read(emprestimo.termo.arquivoPdf),
      nomeArquivo: `termo-${emprestimo.termo.numeroAno.replace('/', '-')}.pdf`,
    };
  }

  // Anexa (ou substitui, enquanto aguarda) o PDF assinado. Não ativa o empréstimo.
  async anexarTermoAssinado(
    estoqueId: string,
    emprestimoId: string,
    arquivo: ArquivoUpload | undefined,
    userId?: string,
  ) {
    await this.findEstoqueOrFail(estoqueId);
    await this.assertGestorDoEstoque(estoqueId, userId);

    const emprestimo = await this.prisma.emprestimo.findFirst({
      where: { id: emprestimoId, item: { estoqueId } },
      include: { termo: true },
    });
    if (!emprestimo) {
      throw new ResourceNotFoundException('Empréstimo', emprestimoId);
    }
    if (!emprestimo.termo) {
      throw new ResourceNotFoundException('Termo', emprestimoId);
    }
    if (emprestimo.status !== StatusEmprestimo.AGUARDANDO_TERMO) {
      throw new ResourceConflictException(
        `Só é possível anexar o termo assinado a empréstimo aguardando termo (status atual: ${emprestimo.status}).`,
      );
    }

    this.validarPdf(arquivo);

    const anterior = emprestimo.termo.arquivoAssinado;
    const ano = new Date().getFullYear();
    const novoCaminho = `${ano}/assinados/${randomUUID()}.pdf`;

    await this.termoStorage.write(novoCaminho, arquivo.buffer);
    try {
      await this.prisma.termo.update({
        where: { id: emprestimo.termo.id },
        data: { arquivoAssinado: novoCaminho },
      });
    } catch (error) {
      await this.termoStorage.remove(novoCaminho).catch(() => undefined);
      throw error;
    }
    if (anterior) {
      await this.termoStorage.remove(anterior).catch(() => undefined);
    }

    const resultado = await this.prisma.emprestimo.findUniqueOrThrow({
      where: { id: emprestimoId },
      include: INCLUDE_EMPRESTIMO,
    });

    return comFlagTermo(resultado);
  }

  async obterPdfAssinado(estoqueId: string, emprestimoId: string, user?: CurrentUser) {
    await this.findEstoqueOrFail(estoqueId);
    if (user?.role !== AccessRole.ADMIN) {
      await this.assertGestorDoEstoque(estoqueId, user?.userId);
    }

    const emprestimo = await this.prisma.emprestimo.findFirst({
      where: { id: emprestimoId, item: { estoqueId } },
      include: { termo: true },
    });
    if (!emprestimo) {
      throw new ResourceNotFoundException('Empréstimo', emprestimoId);
    }
    if (!emprestimo.termo?.arquivoAssinado) {
      throw new ResourceNotFoundException('Termo assinado', emprestimoId);
    }

    return {
      pdf: await this.termoStorage.read(emprestimo.termo.arquivoAssinado),
      nomeArquivo: `termo-${emprestimo.termo.numeroAno.replace('/', '-')}-assinado.pdf`,
    };
  }

  // Confirma a entrega física: AGUARDANDO_TERMO -> ATIVO e item -> EMPRESTADO
  async confirmarEntrega(estoqueId: string, emprestimoId: string, userId?: string) {
    await this.findEstoqueOrFail(estoqueId);
    await this.assertGestorDoEstoque(estoqueId, userId);

    return this.prisma.$transaction(async (tx) => {
      const emprestimo = await tx.emprestimo.findFirst({
        where: { id: emprestimoId, item: { estoqueId } },
        include: { termo: true },
      });
      if (!emprestimo) {
        throw new ResourceNotFoundException('Empréstimo', emprestimoId);
      }
      if (emprestimo.status !== StatusEmprestimo.AGUARDANDO_TERMO) {
        throw new ResourceConflictException(
          `Só é possível confirmar a entrega de empréstimo aguardando termo (status atual: ${emprestimo.status}).`,
        );
      }
      if (!emprestimo.termo?.arquivoAssinado) {
        throw new ResourceConflictException(
          'Anexe o termo de responsabilidade assinado antes de confirmar a entrega.',
        );
      }

      const { count } = await tx.emprestimo.updateMany({
        where: { id: emprestimoId, status: StatusEmprestimo.AGUARDANDO_TERMO },
        data: { status: StatusEmprestimo.ATIVO },
      });
      if (count === 0) {
        throw new ResourceConflictException('A entrega deste empréstimo já foi confirmada.');
      }

      await tx.item.update({
        where: { id: emprestimo.itemId },
        data: { status: StatusItem.EMPRESTADO },
      });

      const resultado = await tx.emprestimo.findUniqueOrThrow({
        where: { id: emprestimoId },
        include: INCLUDE_EMPRESTIMO,
      });

      return comFlagTermo(resultado);
    });
  }

  // Valida tipo, tamanho e assinatura real do arquivo (não confia só no mimetype do cliente)
  private validarPdf(arquivo: ArquivoUpload | undefined): asserts arquivo is ArquivoUpload {
    const invalido = (mensagem: string) =>
      new AppException(ErrorCode.VALIDATION_FAILED, mensagem, HttpStatus.BAD_REQUEST);

    if (!arquivo?.buffer?.length) {
      throw invalido('Envie o PDF assinado no campo "arquivo" (multipart/form-data).');
    }
    if (arquivo.size > TERMO_ASSINADO_MAX_BYTES) {
      throw invalido(
        `O arquivo excede o limite de ${TERMO_ASSINADO_MAX_BYTES / (1024 * 1024)} MB.`,
      );
    }
    if (
      arquivo.mimetype !== TERMO_ASSINADO_MIME ||
      !arquivo.buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)
    ) {
      throw invalido('Arquivo inválido: apenas PDF é aceito.');
    }
  }

  // Pendentes = aguardando termo + ativos, com "atrasado" calculado na hora
  async findPendentes(estoqueId: string, query: PaginationQueryDto, user?: CurrentUser) {
    await this.findEstoqueOrFail(estoqueId);
    if (user?.role !== AccessRole.ADMIN) {
      await this.assertGestorDoEstoque(estoqueId, user?.userId);
    }

    const where = { status: { in: STATUS_PENDENTES }, item: { estoqueId } };
    const skip = (query.page - 1) * query.limit;

    const [emprestimos, total] = await Promise.all([
      this.prisma.emprestimo.findMany({
        where,
        include: INCLUDE_EMPRESTIMO,
        orderBy: [{ prazoDevolucao: { sort: 'asc', nulls: 'last' } }, { dataRetirada: 'desc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.emprestimo.count({ where }),
    ]);

    const agora = new Date();
    const items = emprestimos.map((emprestimo) => ({
      ...comFlagTermo(emprestimo),
      atrasado: estaAtrasado(emprestimo, agora),
    }));

    return PaginatedResponseDto.of(items, total, query);
  }

  async devolver(estoqueId: string, emprestimoId: string, userId?: string) {
    await this.findEstoqueOrFail(estoqueId);
    await this.assertGestorDoEstoque(estoqueId, userId);

    return this.prisma.$transaction(async (tx) => {
      const emprestimo = await tx.emprestimo.findFirst({
        where: { id: emprestimoId, item: { estoqueId } },
      });
      if (!emprestimo) {
        throw new ResourceNotFoundException('Empréstimo', emprestimoId);
      }
      if (emprestimo.status !== StatusEmprestimo.ATIVO) {
        throw new ResourceConflictException(
          `Só é possível devolver empréstimo ativo (status atual: ${emprestimo.status}).`,
        );
      }

      const { count } = await tx.emprestimo.updateMany({
        where: { id: emprestimoId, status: StatusEmprestimo.ATIVO },
        data: { status: StatusEmprestimo.DEVOLVIDO, dataDevolucaoEfetiva: new Date() },
      });
      if (count === 0) {
        throw new ResourceConflictException('Este empréstimo já foi devolvido.');
      }

      await tx.item.update({
        where: { id: emprestimo.itemId },
        data: { status: StatusItem.DISPONIVEL },
      });

      await tx.movimentacao.create({
        data: {
          itemId: emprestimo.itemId,
          tipo: TipoMovimentacao.DEVOLUCAO,
          quantidade: 1,
          usuarioId: userId as string,
          observacao: `Devolução do empréstimo ${emprestimo.id}`,
        },
      });

      const resultado = await tx.emprestimo.findUniqueOrThrow({
        where: { id: emprestimoId },
        include: INCLUDE_EMPRESTIMO,
      });

      return comFlagTermo(resultado);
    });
  }

  // Responsável é cadastro simples reaproveitado (A3): acha por Siape ou CPF; se não existir, cria.
  private async obterResponsavel(tx: Prisma.TransactionClient, dados: ResponsavelInput) {
    const filtros: Prisma.ResponsavelWhereInput[] = [];
    if (dados.siape) filtros.push({ siape: dados.siape });
    if (dados.cpf) filtros.push({ cpf: dados.cpf });

    const existentes = await tx.responsavel.findMany({ where: { OR: filtros } });
    if (existentes.length > 1) {
      throw new ResourceConflictException(
        'Siape e CPF informados pertencem a responsáveis diferentes já cadastrados.',
      );
    }

    const data = {
      nome: dados.nome,
      siape: dados.siape,
      cpf: dados.cpf,
      lotacao: dados.lotacao,
      cargo: dados.cargo,
      email: dados.email,
    };

    // Já cadastrado: atualiza com o que o gestor digitou agora (o termo usa os dados mais recentes)
    if (existentes.length === 1) {
      return tx.responsavel.update({ where: { id: existentes[0].id }, data });
    }
    return tx.responsavel.create({ data });
  }

  private async findEstoqueOrFail(estoqueId: string) {
    const estoque = await this.prisma.estoque.findUnique({ where: { id: estoqueId } });
    if (!estoque) {
      throw new ResourceNotFoundException('Estoque', estoqueId);
    }
    return estoque;
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
        'Apenas gestores deste estoque podem registrar ou consultar empréstimos.',
      );
    }
  }

  private traduzirErroDeUnicidade(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ResourceConflictException(
        'Responsável já cadastrado com este Siape ou CPF. Tente novamente.',
      );
    }
    throw error;
  }
}
