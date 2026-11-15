import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TipoMovimentacao } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AccessRole } from '../../src/common/auth/access-role.enum';
import { ROLES_KEY } from '../../src/common/auth/decorators/roles.decorator';
import { RolesGuard } from '../../src/common/auth/guards/roles.guard';
import { EstoquesController } from '../../src/modules/estoques/estoques.controller';
import { EstoquesService } from '../../src/modules/estoques/estoques.service';
import { ItensService } from '../../src/modules/itens/itens.service';
import { MovimentacoesService } from '../../src/modules/movimentacoes/movimentacoes.service';

type EstoquesRoute = 'create' | 'findAll' | 'update' | 'addGestor' | 'removeGestor' | 'listGestores';
type Perfil = 'ADMIN' | 'GESTOR autorizado' | 'GESTOR não autorizado' | 'REQUISITANTE';

function invocarRota(route: EstoquesRoute, role: AccessRole) {
  const service = {
    create: vi.fn(),
    findAll: vi.fn(),
    update: vi.fn(),
    addGestor: vi.fn(),
    removeGestor: vi.fn(),
    listGestores: vi.fn(),
  };
  const controller = new EstoquesController(service as unknown as EstoquesService);
  const guard = new RolesGuard(new Reflector());
  const context = {
    getHandler: () => EstoquesController.prototype[route],
    getClass: () => EstoquesController,
    switchToHttp: () => ({ getRequest: () => ({ user: { userId: 'u1', role } }) }),
  };

  try {
    guard.canActivate(context as unknown as ExecutionContext);
    if (route === 'create') controller.create({ nome: 'Estoque A' });
    if (route === 'findAll') controller.findAll();
    if (route === 'update') controller.update('e1', { nome: 'Novo nome' });
    if (route === 'addGestor') controller.addGestor('e1', { usuarioId: 'u2' });
    if (route === 'removeGestor') controller.removeGestor('e1', 'u2');
    if (route === 'listGestores') controller.listGestores('e1');
    return { status: 200, service };
  } catch (error) {
    return { status: (error as HttpException).getStatus(), service };
  }
}

function criarServicoMovimentacoes({
  item,
  gestor,
  saldo = 0,
}: {
  item: { id: string; estoqueId: string } | null;
  gestor: { estoqueId: string; usuarioId: string } | null;
  saldo?: number;
}) {
  const tx = {
    item: { findUnique: vi.fn().mockResolvedValue(item) },
    estoqueGestor: { findUnique: vi.fn().mockResolvedValue(gestor) },
    movimentacao: {
      groupBy: vi.fn().mockResolvedValue(
        saldo > 0 ? [{ tipo: TipoMovimentacao.ENTRADA, _sum: { quantidade: saldo } }] : [],
      ),
      create: vi.fn().mockResolvedValue({ id: 'm1' }),
    },
  };
  const prisma = {
    $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  return { service: new MovimentacoesService(prisma as never), tx, prisma };
}

async function statusDoMovimento(
  service: MovimentacoesService,
  usuarioId: string,
  isAdmin: boolean,
): Promise<number> {
  try {
    await service.registrarMovimentacao(
      { itemId: 'i1', tipo: TipoMovimentacao.ENTRADA, quantidade: 1 },
      usuarioId,
      isAdmin,
    );
    return 200;
  } catch (error) {
    return (error as HttpException).getStatus();
  }
}

describe('US02 — Controle de acesso v2', () => {
  describe('CTs da matriz de permissões Papel × Ação', () => {
    const casos: Array<{
      id: string;
      perfil: Perfil;
      route: EstoquesRoute;
      role: AccessRole;
      esperado: number;
    }> = [
      { id: 'CT01', perfil: 'ADMIN', route: 'create', role: AccessRole.ADMIN, esperado: 200 },
      {
        id: 'CA01 / Matriz 2.1',
        perfil: 'GESTOR autorizado',
        route: 'create',
        role: AccessRole.USER,
        esperado: 403,
      },
      {
        id: 'CA01 / Matriz 2.1',
        perfil: 'GESTOR não autorizado',
        route: 'create',
        role: AccessRole.USER,
        esperado: 403,
      },
      {
        id: 'CT11',
        perfil: 'REQUISITANTE',
        route: 'create',
        role: AccessRole.USER,
        esperado: 403,
      },
      { id: 'CT02', perfil: 'ADMIN', route: 'findAll', role: AccessRole.ADMIN, esperado: 200 },
      {
        id: 'CA01 / Matriz 2.1',
        perfil: 'GESTOR autorizado',
        route: 'findAll',
        role: AccessRole.USER,
        esperado: 200,
      },
      {
        id: 'CA01 / Matriz 2.1',
        perfil: 'GESTOR não autorizado',
        route: 'findAll',
        role: AccessRole.USER,
        esperado: 200,
      },
      {
        id: 'CA01 / Matriz 2.1',
        perfil: 'REQUISITANTE',
        route: 'findAll',
        role: AccessRole.USER,
        esperado: 200,
      },
      {
        id: 'CT10',
        perfil: 'GESTOR não autorizado',
        route: 'update',
        role: AccessRole.USER,
        esperado: 403,
      },
      {
        id: 'CT12',
        perfil: 'REQUISITANTE',
        route: 'update',
        role: AccessRole.USER,
        esperado: 403,
      },
    ];

    it.each(casos)('$id — $perfil em $route retorna $esperado', ({ route, role, esperado }) => {
      const resultado = invocarRota(route, role);
      expect(resultado.status).toBe(esperado);
      if (esperado === 403) {
        expect(resultado.service[route]).not.toHaveBeenCalled();
      } else {
        expect(resultado.service[route]).toHaveBeenCalledTimes(1);
      }
    });

    it.fails('CT07 — gestor autorizado edita o próprio estoque com HTTP 200', () => {
      const resultado = invocarRota('update', AccessRole.USER);
      expect(resultado.status).toBe(200);
      expect(resultado.service.update).toHaveBeenCalledTimes(1);
    });

    // [v2] A premissa “ADMIN não edita estoque” permanece pendente; nenhum oráculo foi escolhido.
  });

  describe('CTs de gerenciamento de gestores', () => {
    const rotas: EstoquesRoute[] = ['addGestor', 'removeGestor', 'listGestores'];
    const perfis: Array<{ perfil: Perfil; role: AccessRole; esperado: number }> = [
      { perfil: 'ADMIN', role: AccessRole.ADMIN, esperado: 200 },
      { perfil: 'GESTOR autorizado', role: AccessRole.USER, esperado: 403 },
      { perfil: 'GESTOR não autorizado', role: AccessRole.USER, esperado: 403 },
      { perfil: 'REQUISITANTE', role: AccessRole.USER, esperado: 403 },
    ];

    it.each(rotas.flatMap((route) =>
      perfis.map((caso) => ({ route, ...caso })),
    ))(
      'CA03 / CA08 — $perfil em $route retorna $esperado',
      ({ route, role, esperado }) => {
        const resultado = invocarRota(route, role);
        expect(resultado.status).toBe(esperado);
        if (esperado === 403) {
          expect(resultado.service[route]).not.toHaveBeenCalled();
        } else {
          expect(resultado.service[route]).toHaveBeenCalledTimes(1);
        }
      },
    );

    it('CT04 — decorator Roles declara ADMIN na rota de gestores', () => {
      const reflector = new Reflector();
      expect(reflector.get(ROLES_KEY, EstoquesController.prototype.addGestor)).toEqual([
        AccessRole.ADMIN,
      ]);
      expect(reflector.get(ROLES_KEY, EstoquesController.prototype.removeGestor)).toEqual([
        AccessRole.ADMIN,
      ]);
      expect(reflector.get(ROLES_KEY, EstoquesController.prototype.listGestores)).toEqual([
        AccessRole.ADMIN,
      ]);
    });
  });

  describe('CTs de movimentação e estado do estoque', () => {
    // [v2] CT03 / CA02 / CA08: ADMIN recebe 403 e a transação não é iniciada.
    it('nega movimentação ao ADMIN com HTTP 403 e sem gravação', async () => {
      const { service, tx, prisma } = criarServicoMovimentacoes({
        item: { id: 'i1', estoqueId: 'e1' },
        gestor: { estoqueId: 'e1', usuarioId: 'admin' },
        saldo: 4,
      });

      expect(await statusDoMovimento(service, 'admin', true)).toBe(403);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.movimentacao.create).not.toHaveBeenCalled();
    });

    // [v2] CT08 / CA04 / PE01 / fronteira 1: o único gestor autorizado movimenta.
    it('permite movimentação ao único gestor vinculado', async () => {
      const { service, tx } = criarServicoMovimentacoes({
        item: { id: 'i1', estoqueId: 'e1' },
        gestor: { estoqueId: 'e1', usuarioId: 'gestor-unico' },
      });

      expect(await statusDoMovimento(service, 'gestor-unico', false)).toBe(200);
      expect(tx.movimentacao.create).toHaveBeenCalledWith({
        data: {
          itemId: 'i1',
          tipo: TipoMovimentacao.ENTRADA,
          quantidade: 1,
          observacao: undefined,
          usuarioId: 'gestor-unico',
        },
      });
    });

    // [v2] CT09 / CA05 / CA08: gestor de outro estoque recebe 403 e não grava.
    it('nega movimentação ao gestor de outro estoque com HTTP 403', async () => {
      const { service, tx } = criarServicoMovimentacoes({
        item: { id: 'i1', estoqueId: 'stock-B' },
        gestor: null,
        saldo: 3,
      });

      expect(await statusDoMovimento(service, 'gestor-A', false)).toBe(403);
      expect(tx.movimentacao.create).not.toHaveBeenCalled();
    });

    // [v2] CT08 / CA04: usuário vinculado ao estoque de destino registra saída válida.
    it('permite movimentação pelo gestor vinculado ao estoque do item', async () => {
      const { service, tx } = criarServicoMovimentacoes({
        item: { id: 'i1', estoqueId: 'e1' },
        gestor: { estoqueId: 'e1', usuarioId: 'gestor-e1' },
        saldo: 5,
      });

      const resultado = await service.registrarMovimentacao(
        { itemId: 'i1', tipo: TipoMovimentacao.SAIDA, quantidade: 2 },
        'gestor-e1',
        false,
      );
      expect(resultado.saldoAtual).toBe(3);
      expect(tx.movimentacao.create).toHaveBeenCalledTimes(1);
    });

    // [v2] CT13 / CA07 / CA08 / PE02 / fronteira 0: ninguém movimenta estoque sem gestor.
    it.each([
      { perfil: 'ADMIN', usuarioId: 'admin', isAdmin: true },
      { perfil: 'GESTOR autorizado sem vínculo efetivo', usuarioId: 'gestor-candidato', isAdmin: false },
      { perfil: 'GESTOR não autorizado', usuarioId: 'gestor-outro', isAdmin: false },
      { perfil: 'REQUISITANTE', usuarioId: 'requisitante', isAdmin: false },
    ])('bloqueia movimento com zero gestores: $perfil', async ({ usuarioId, isAdmin }) => {
      const { service, tx } = criarServicoMovimentacoes({
        item: { id: 'i1', estoqueId: 'e1' },
        gestor: null,
      });

      expect(await statusDoMovimento(service, usuarioId, isAdmin)).toBe(403);
      expect(tx.movimentacao.create).not.toHaveBeenCalled();
    });
  });

  describe('CA06 — operações de item por requisitante', () => {
    // [v2] CA06: requisitante não cadastra item; HTTP 403 antes de gravar.
    it('nega criação de item ao requisitante com HTTP 403', async () => {
      const prisma: any = {
        estoque: { findUnique: vi.fn().mockResolvedValue({ id: 'e1', ativo: true }) },
        estoqueGestor: { findUnique: vi.fn().mockResolvedValue(null) },
        item: { create: vi.fn() },
      };
      const service = new ItensService(prisma);
      const erro = await service.create(
        'e1',
        { tipo: 'CONSUMO', nome: 'Luva', categoriaId: 'c1' } as never,
        'requisitante',
      ).catch((error: unknown) => error);

      expect((erro as HttpException).getStatus()).toBe(403);
      expect(prisma.item.create).not.toHaveBeenCalled();
    });

    // [v2] CA06 / CA08: requisitante não edita item; nenhuma alteração ocorre.
    it('nega edição de item ao requisitante com HTTP 403 e sem alteração', async () => {
      const prisma: any = {
        estoque: { findUnique: vi.fn().mockResolvedValue({ id: 'e1', ativo: true }) },
        estoqueGestor: { findUnique: vi.fn().mockResolvedValue(null) },
        item: { findFirst: vi.fn(), update: vi.fn() },
      };
      const service = new ItensService(prisma);
      const erro = await service.update(
        'e1',
        'i1',
        { nome: 'Novo nome' } as never,
        'requisitante',
      ).catch((error: unknown) => error);

      expect((erro as HttpException).getStatus()).toBe(403);
      expect(prisma.item.findFirst).not.toHaveBeenCalled();
      expect(prisma.item.update).not.toHaveBeenCalled();
    });
  });
});
