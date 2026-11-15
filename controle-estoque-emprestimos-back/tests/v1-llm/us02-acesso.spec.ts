import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessRole } from '../../src/common/auth/access-role.enum';
import { AuthGuard } from '../../src/common/auth/guards/auth.guard';
import { RolesGuard } from '../../src/common/auth/guards/roles.guard';
import { ROLES_KEY, Roles } from '../../src/common/auth/decorators/roles.decorator';
import { PrismaService } from '../../src/database/prisma.service';
import { EmprestimosService } from '../../src/modules/emprestimos/emprestimos.service';
import { ItensService } from '../../src/modules/itens/itens.service';
import { MovimentacoesService } from '../../src/modules/movimentacoes/movimentacoes.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const makeContext = (request: Record<string, unknown> = {}) => {
  const handler = () => undefined;
  class TestController {}
  return {
    getHandler: () => handler,
    getClass: () => TestController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
};

describe('US02 — Controle de acesso', () => {
  describe('AuthGuard', () => {
    let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
    let identity: { extract: ReturnType<typeof vi.fn> };
    let guard: AuthGuard;

    beforeEach(() => {
      reflector = { getAllAndOverride: vi.fn() };
      identity = { extract: vi.fn() };
      guard = new AuthGuard(reflector as unknown as Reflector, identity as any);
    });

    // Técnica: partição válida; CA1 — rota pública não exige identidade.
    it('permite rota pública sem consultar a identidade', async () => {
      reflector.getAllAndOverride.mockReturnValue(true);

      await expect(guard.canActivate(makeContext())).resolves.toBe(true);
      expect(identity.extract).not.toHaveBeenCalled();
    });

    // Técnica: partição inválida; CA1 — identidade ausente é recusada.
    it('recusa requisição sem usuário autenticado', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      identity.extract.mockResolvedValue(null);

      await expect(guard.canActivate(makeContext({ headers: {} }))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    // Técnica: partição válida; CA1 — identidade autenticada é anexada à requisição.
    it('anexa o usuário extraído ao request', async () => {
      const user = { userId: 'user-1', role: AccessRole.USER };
      const request: Record<string, unknown> = { headers: { authorization: 'Bearer token' } };
      reflector.getAllAndOverride.mockReturnValue(false);
      identity.extract.mockResolvedValue(user);

      await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
      expect(request.user).toEqual(user);
    });
  });

  describe('RolesGuard e decorator', () => {
    let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
    let guard: RolesGuard;

    beforeEach(() => {
      reflector = { getAllAndOverride: vi.fn() };
      guard = new RolesGuard(reflector as unknown as Reflector);
    });

    // Técnica: partição válida; CA1 — rota sem metadado de papel não impõe papel global.
    it('permite rota sem roles requeridas', () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      expect(guard.canActivate(makeContext())).toBe(true);
    });

    // Técnica: partição válida de papel; CA1 — ADMIN satisfaz requisito ADMIN.
    it('permite ADMIN quando a rota exige ADMIN', () => {
      reflector.getAllAndOverride.mockReturnValue([AccessRole.ADMIN]);

      expect(guard.canActivate(makeContext({ user: { role: AccessRole.ADMIN } }))).toBe(true);
    });

    // Técnica: partição inválida de papel; CA1 — USER não satisfaz requisito ADMIN.
    it('recusa USER quando a rota exige ADMIN', () => {
      reflector.getAllAndOverride.mockReturnValue([AccessRole.ADMIN]);

      expect(() => guard.canActivate(makeContext({ user: { role: AccessRole.USER } }))).toThrow(
        'Você não tem permissão para acessar este recurso.',
      );
    });

    // Técnica: partição inválida; CA1 — metadado de acesso não substitui identidade.
    it('recusa rota restrita quando request não tem usuário', () => {
      reflector.getAllAndOverride.mockReturnValue([AccessRole.USER]);

      expect(() => guard.canActivate(makeContext())).toThrow(
        'Você não tem permissão para acessar este recurso.',
      );
    });

    // Técnica: partição válida; CA1 — decorator grava os papéis declarados.
    it('Roles registra o papel requerido no metadata da classe', () => {
      class AdminController {}
      Roles(AccessRole.ADMIN)(AdminController);

      expect(new Reflector().get(ROLES_KEY, AdminController)).toEqual([AccessRole.ADMIN]);
    });
  });

  describe('acesso por vínculo gestor-estoque', () => {
    // Técnica: partição inválida; CA1 — gestor de outro estoque não cadastra item.
    it('recusa cadastro de item sem vínculo com o estoque de destino', async () => {
      const prisma: any = {
        estoque: { findUnique: vi.fn().mockResolvedValue({ id: 'stock-B', ativo: true }) },
        estoqueGestor: { findUnique: vi.fn().mockResolvedValue(null) },
        item: { create: vi.fn() },
      };
      const service = new ItensService(prisma as PrismaService);

      await expect(
        service.create(
          'stock-B',
          { tipo: 'PATRIMONIAL', nome: 'Notebook', categoriaId: 'cat-1' } as any,
          'manager-of-A',
        ),
      ).rejects.toThrow('Apenas gestores deste estoque podem cadastrar ou editar itens.');
      expect(prisma.estoqueGestor.findUnique).toHaveBeenCalledWith({
        where: { estoqueId_usuarioId: { estoqueId: 'stock-B', usuarioId: 'manager-of-A' } },
      });
      expect(prisma.item.create).not.toHaveBeenCalled();
    });

    // Técnica: partição inválida; CA1 — gestor de outro estoque não lista empréstimos.
    it('recusa consulta de empréstimos quando não há vínculo para o estoque consultado', async () => {
      const prisma: any = {
        estoque: { findUnique: vi.fn().mockResolvedValue({ id: 'stock-B' }) },
        estoqueGestor: { findUnique: vi.fn().mockResolvedValue(null) },
        emprestimo: { findMany: vi.fn(), count: vi.fn() },
      };
      const service = new EmprestimosService(prisma, {} as any, {} as any);

      await expect(
        service.findPendentes(
          'stock-B',
          { page: 1, limit: 10 } as any,
          { userId: 'manager-of-A', role: AccessRole.USER },
        ),
      ).rejects.toThrow('Apenas gestores deste estoque podem registrar ou consultar empréstimos.');
      expect(prisma.emprestimo.findMany).not.toHaveBeenCalled();
    });

    // Técnica: partição válida de papel; CA1 — ADMIN pode consultar sem vínculo de gestor.
    it('permite ADMIN listar empréstimos sem consultar vínculo de gestor', async () => {
      const prisma: any = {
        estoque: { findUnique: vi.fn().mockResolvedValue({ id: 'stock-B' }) },
        estoqueGestor: { findUnique: vi.fn() },
        emprestimo: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
      };
      const service = new EmprestimosService(prisma, {} as any, {} as any);

      await service.findPendentes(
        'stock-B',
        { page: 1, limit: 10 } as any,
        { userId: 'admin-1', role: AccessRole.ADMIN },
      );
      expect(prisma.estoqueGestor.findUnique).not.toHaveBeenCalled();
      expect(prisma.emprestimo.findMany).toHaveBeenCalled();
    });

    // Técnica: partição inválida; CA1 — consulta do histórico nega usuário sem vínculo.
    it('recusa histórico de estoque para usuário sem vínculo', async () => {
      const prisma: any = {
        estoqueGestor: { findUnique: vi.fn().mockResolvedValue(null) },
        movimentacao: { findMany: vi.fn() },
      };
      const service = new MovimentacoesService(prisma as PrismaService);

      await expect(service.consultarHistoricoEstoque('stock-B', 'manager-of-A', false)).rejects.toThrow(
        'Acesso negado ao histórico deste estoque',
      );
      expect(prisma.movimentacao.findMany).not.toHaveBeenCalled();
    });

    // Técnica: partição válida de papel; CA1 — ADMIN tem leitura global do histórico.
    it('permite ADMIN consultar histórico sem verificar vínculo', async () => {
      const history = [{ id: 'm1' }];
      const prisma: any = {
        estoqueGestor: { findUnique: vi.fn() },
        movimentacao: { findMany: vi.fn().mockResolvedValue(history) },
      };
      const service = new MovimentacoesService(prisma as PrismaService);

      await expect(service.consultarHistoricoEstoque('stock-B', 'admin-1', true)).resolves.toEqual(
        history,
      );
      expect(prisma.estoqueGestor.findUnique).not.toHaveBeenCalled();
    });
  });
});
