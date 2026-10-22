import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class GestorGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Preenchido pelo guard de autenticação existente (#5)

    if (!user?.userId) {
      throw new ForbiddenException('Usuário não autenticado');
    }

    const userId = user.userId;

    //Checa na tabela EstoqueGestor se o usuário é gestor de ao menos um estoque
    const ehGestor = await this.prisma.estoqueGestor.findFirst({
      where: { usuarioId: userId },
    });

    if (!ehGestor) {
      throw new ForbiddenException(
        'Apenas gestores de estoque têm permissão para realizar esta ação',
      );
    }

    return true;
  }
}
