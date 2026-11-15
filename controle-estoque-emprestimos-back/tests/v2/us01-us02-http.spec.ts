import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { AuthGuard } from '../../src/common/auth/guards/auth.guard';
import { AccessRole } from '../../src/common/auth/access-role.enum';
import { PrismaService } from '../../src/database/prisma.service';
import { EstoquesController } from '../../src/modules/estoques/estoques.controller';
import { EstoquesService } from '../../src/modules/estoques/estoques.service';
import { MovimentacoesController } from '../../src/modules/movimentacoes/movimentacoes.controller';
import { MovimentacoesService } from '../../src/modules/movimentacoes/movimentacoes.service';
import { TransferenciasService } from '../../src/modules/movimentacoes/transferencias.service';
import { RolesGuard } from '../../src/common/auth/guards/roles.guard';

const prisma = {
  estoque: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  estoqueGestor: { findUnique: vi.fn() },
};
const movimentacoes = { registrarMovimentacao: vi.fn() };
let app: INestApplication;
let url: string;
const requisicao = (method: string, path: string, user: string, body: unknown) => fetch(`${url}${path}`, {
  method, headers: { 'content-type': 'application/json', 'x-test-user': user }, body: JSON.stringify(body),
});
beforeAll(async () => {
  const module = await Test.createTestingModule({
    controllers: [EstoquesController, MovimentacoesController],
    providers: [EstoquesService, RolesGuard,
      { provide: PrismaService, useValue: prisma },
      { provide: MovimentacoesService, useValue: movimentacoes },
      { provide: TransferenciasService, useValue: {} },
    ],
  }).overrideGuard(AuthGuard).useValue({ canActivate: (context: any) => {
    const request = context.switchToHttp().getRequest();
    const id = request.headers['x-test-user'];
    request.user = { userId: id, role: id === 'admin' ? AccessRole.ADMIN : AccessRole.USER };
    return true;
  } }).compile();
  app = module.createNestApplication();
  app.useGlobalPipes(new ZodValidationPipe());
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  url = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => { await app?.close(); });
beforeEach(() => {
  vi.clearAllMocks();
  prisma.estoque.findUnique.mockResolvedValue({ id: 'A', itens: [], gestores: [] });
  prisma.estoque.findFirst.mockResolvedValue(null);
  prisma.estoque.update.mockResolvedValue({ id: 'A', nome: 'Novo', descricao: 'Setor A' });
  prisma.estoqueGestor.findUnique.mockImplementation(({ where }) => Promise.resolve(
    where.estoqueId_usuarioId.usuarioId === 'gestor' ? { id: 'v' } : null));
});
describe('US01/US02 — autorização HTTP do estoque', () => {
  it('CT-01-09 / CT07: gestor vinculado edita o estoque', async () => {
    expect((await requisicao('PATCH', '/estoques/A', 'gestor', { nome: 'Novo', descricao: 'Setor A' })).status).toBe(200);
    expect(prisma.estoque.update).toHaveBeenCalledWith({ where: { id: 'A' }, data: { nome: 'Novo', descricao: 'Setor A' } });
  });
  it.each(['requisitante', 'outro', 'admin'])('CT-01-11/12 e CT10/12: %s recebe 403 e não grava', async (user) => {
    expect((await requisicao('PATCH', '/estoques/A', user, { nome: 'Novo' })).status).toBe(403);
    expect(prisma.estoque.update).not.toHaveBeenCalled();
  });
  it('CT-01-07: requisitante não cadastra estoque', async () => {
    expect((await requisicao('POST', '/estoques', 'requisitante', { nome: 'Novo' })).status).toBe(403);
    expect(prisma.estoque.create).not.toHaveBeenCalled();
  });
});
describe('US01 — entrada HTTP rejeitada antes da escrita', () => {
  it.each([
    ['CT-01-17 tipo ausente', { itemId: 'i', quantidade: 1 }],
    ['CT-01-18 tipo inválido', { itemId: 'i', tipo: 'INVENTADO', quantidade: 1 }],
    ['CT-01-19 quantidade zero', { itemId: 'i', tipo: 'ENTRADA', quantidade: 0 }],
    ['CT-01-19 quantidade fracionária', { itemId: 'i', tipo: 'ENTRADA', quantidade: 1.5 }],
  ])('%s', async (_, dto) => {
    expect((await requisicao('POST', '/movimentacoes', 'gestor', dto)).status).toBe(400);
    expect(movimentacoes.registrarMovimentacao).not.toHaveBeenCalled();
  });
});
