// A v2 preserva os cenários da v1 e acrescenta os casos abaixo.
import '../v1-llm/us02-acesso.spec';
import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TipoMovimentacao } from '@prisma/client';
import { AccessDeniedException } from '../../src/common/exceptions/access-denied.exception';
import { AccessRole } from '../../src/common/auth/access-role.enum';
import { RolesGuard } from '../../src/common/auth/guards/roles.guard';
import { EstoquesController } from '../../src/modules/estoques/estoques.controller';
import { MovimentacoesService } from '../../src/modules/movimentacoes/movimentacoes.service';

// Lacunas CT03, CT04–06, CT08–09 e CT13 da matriz US02.
describe('US02 v2 — permissões por perfil e estoque', () => {
  const gate = (method: keyof EstoquesController, role: AccessRole) => {
    const reflector = new Reflector();
    return () => new RolesGuard(reflector).canActivate({
      getHandler: () => EstoquesController.prototype[method],
      getClass: () => EstoquesController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    } as any);
  };
  it.each(['create', 'addGestor', 'listGestores', 'removeGestor'] as const)('CT01/04/05/06: %s só aceita ADMIN', (method) => {
    expect(gate(method, AccessRole.ADMIN)()).toBe(true);
    expect(gate(method, AccessRole.USER)).toThrow(AccessDeniedException);
  });
  it('CT03: ADMIN não pode registrar movimentação e não altera dados', async () => {
    const prisma: any = { $transaction: vi.fn(), movimentacao: { create: vi.fn() } };
    await expect(new MovimentacoesService(prisma).registrarMovimentacao({ itemId: 'i', tipo: TipoMovimentacao.ENTRADA, quantidade: 1 }, 'admin', true)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it.each([false, true])('CT08/09/13: vínculo de gestor %s controla a movimentação', async (vinculado) => {
    const tx: any = {
      item: { findUnique: vi.fn().mockResolvedValue({ id: 'i', estoqueId: 'e', nivelMinimo: 1 }) },
      estoqueGestor: { findUnique: vi.fn().mockResolvedValue(vinculado ? { usuarioId: 'u' } : null) },
      movimentacao: { groupBy: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 'm' }) },
    };
    const prisma: any = { $transaction: vi.fn((cb) => cb(tx)) };
    const action = new MovimentacoesService(prisma).registrarMovimentacao({ itemId: 'i', tipo: TipoMovimentacao.ENTRADA, quantidade: 1 }, 'u', false);
    if (vinculado) { expect(await action).toMatchObject({ saldoAtual: 1 }); expect(tx.movimentacao.create).toHaveBeenCalledOnce(); }
    else { await expect(action).rejects.toBeInstanceOf(ForbiddenException); expect(tx.movimentacao.create).not.toHaveBeenCalled(); }
  });
  it.todo('CT07/10/12: edição de estoque por gestor vinculado; rota atual exige ADMIN indiscriminadamente');
});
