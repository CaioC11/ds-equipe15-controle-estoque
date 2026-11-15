import { describe, expect, it, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import { AccessRole } from '../../src/common/auth/access-role.enum';
import { ROLES_KEY } from '../../src/common/auth/decorators/roles.decorator';
import { AccessDeniedException } from '../../src/common/exceptions/access-denied.exception';
import { EstoquesController } from '../../src/modules/estoques/estoques.controller';
import { EstoquesService } from '../../src/modules/estoques/estoques.service';

function fixture() {
  const prisma = {
    estoqueGestor: { findUnique: vi.fn() },
    estoque: { findUnique: vi.fn().mockResolvedValue({ id: 'A', itens: [], gestores: [] }),
      findFirst: vi.fn().mockResolvedValue(null), update: vi.fn().mockResolvedValue({ id: 'A', nome: 'Novo' }) },
  };
  const service = new EstoquesService(prisma as never);
  const controller = new EstoquesController(service);
  return { prisma, controller };
}
describe('US01/US02 — edição exige vínculo com o estoque', () => {
  it('CT-01-09 / CT-02-07: gestor vinculado atualiza o próprio estoque', async () => {
    const { prisma, controller } = fixture();
    prisma.estoqueGestor.findUnique.mockResolvedValue({ estoqueId: 'A', usuarioId: 'gestor' });
    await expect(controller.update('A', { nome: 'Novo' }, { userId: 'gestor', role: AccessRole.USER })).resolves.toMatchObject({ nome: 'Novo' });
    expect(prisma.estoque.update).toHaveBeenCalledWith({ where: { id: 'A' }, data: { nome: 'Novo' } });
  });
  it.each([['gestor de B', 'outro'], ['requisitante', 'req'], ['ADMIN sem vínculo', 'admin']])(
    'CT-01-11/12 / CT-02-10/12: %s recebe 403 e não altera dados', async (_, userId) => {
      const { prisma, controller } = fixture();
      prisma.estoqueGestor.findUnique.mockResolvedValue(null);
      const role = userId === 'admin' ? AccessRole.ADMIN : AccessRole.USER;
      await expect(controller.update('A', { nome: 'Novo' }, { userId, role })).rejects.toBeInstanceOf(AccessDeniedException);
      expect(prisma.estoque.update).not.toHaveBeenCalled();
    },
  );
  it('rota admite USER e ADMIN; vínculo é validado pelo serviço', () => {
    const roles = new Reflector().get<AccessRole[]>(ROLES_KEY, EstoquesController.prototype.update);
    expect(roles).toEqual([AccessRole.ADMIN, AccessRole.USER]);
  });
  it('usuário sem identificação não modifica estoque', async () => {
    const { prisma, controller } = fixture();
    await expect(controller.update('A', { nome: 'Novo' })).rejects.toBeInstanceOf(AccessDeniedException);
    expect(prisma.estoque.update).not.toHaveBeenCalled();
  });
});
