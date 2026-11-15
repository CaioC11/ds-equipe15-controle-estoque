import { PrismaService } from '../../database/prisma.service';
import { AccessDeniedException } from '../exceptions/access-denied.exception';

/** Centraliza a verificação do vínculo; cada módulo fornece sua mensagem pública. */
export async function assertGestorDoEstoque(
  prisma: Pick<PrismaService, 'estoqueGestor'>,
  estoqueId: string,
  userId: string | undefined,
  mensagem: string,
): Promise<void> {
  const vinculo = userId
    ? await prisma.estoqueGestor.findUnique({
        where: { estoqueId_usuarioId: { estoqueId, usuarioId: userId } },
      })
    : null;
  if (!vinculo) throw new AccessDeniedException(mensagem);
}
