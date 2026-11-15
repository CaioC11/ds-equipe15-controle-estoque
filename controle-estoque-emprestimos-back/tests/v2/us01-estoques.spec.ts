// A v2 preserva os cenários da v1 e acrescenta os casos abaixo.
import '../v1-llm/us01-estoques.spec';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TipoMovimentacao } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CreateEstoqueSchema } from '../../src/modules/estoques/dto/create-estoque.dto';
import { EstoquesService } from '../../src/modules/estoques/estoques.service';
import { MovimentacoesService } from '../../src/modules/movimentacoes/movimentacoes.service';

// Lacunas CT-01-02/05/08/10/13/14/15/16/24 da matriz US01.
describe('US01 v2 — fronteiras e independência de estoque', () => {
  it.each([{}, { nome: '' }, { nome: '   ' }])('CT-01-02/03/04: rejeita cadastro sem nome válido', (input) => {
    expect(() => CreateEstoqueSchema.parse(input)).toThrow();
  });
  it('CT-01-05: aceita nome com um caractere', () => {
    expect(CreateEstoqueSchema.parse({ nome: 'A' })).toEqual({ nome: 'A' });
  });
  it('CT-01-08: dois estoques permanecem independentes', async () => {
    const records: any[] = [];
    const prisma: any = { estoque: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(({ data }) => { const row = { id: `e${records.length + 1}`, ...data, itens: [], gestores: [] }; records.push(row); return row; }),
      findMany: vi.fn().mockImplementation(() => records),
    } };
    const service = new EstoquesService(prisma);
    await service.create({ nome: 'A' });
    await service.create({ nome: 'B' });
    expect((await service.findAll()).map(({ id, nome }) => ({ id, nome }))).toEqual([{ id: 'e1', nome: 'A' }, { id: 'e2', nome: 'B' }]);
    expect(prisma.estoque.create).toHaveBeenCalledTimes(2);
  });
  it('CT-01-10: editar estoque inexistente não grava', async () => {
    const prisma: any = { estoque: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() } };
    await expect(new EstoquesService(prisma).update('ausente', { nome: 'Novo' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.estoque.update).not.toHaveBeenCalled();
  });
  it.each([
    [TipoMovimentacao.ENTRADA, 10, 20],
    [TipoMovimentacao.SAIDA, 3, 7],
    [TipoMovimentacao.SAIDA, 10, 0],
  ])('CT-01-13/14/15: %s %i com saldo 10 resulta em %i', async (tipo, quantidade, esperado) => {
    const tx: any = {
      item: { findUnique: vi.fn().mockResolvedValue({ id: 'i', estoqueId: 'e', nivelMinimo: null }) },
      estoqueGestor: { findUnique: vi.fn().mockResolvedValue({ estoqueId: 'e', usuarioId: 'u' }) },
      movimentacao: { groupBy: vi.fn().mockResolvedValue([{ tipo: TipoMovimentacao.ENTRADA, _sum: { quantidade: 10 } }]), create: vi.fn().mockResolvedValue({ id: 'm' }) },
    };
    const prisma: any = { $transaction: vi.fn((cb) => cb(tx)) };
    expect(await new MovimentacoesService(prisma).registrarMovimentacao({ itemId: 'i', tipo, quantidade }, 'u', false)).toMatchObject({ saldoAtual: esperado, movimentacao: { id: 'm' } });
    expect(tx.movimentacao.create).toHaveBeenCalledWith({ data: { itemId: 'i', tipo, quantidade, usuarioId: 'u', observacao: undefined } });
  });
  it('CT-01-16: saída acima do saldo preserva o registro', async () => {
    const tx: any = { item: { findUnique: vi.fn().mockResolvedValue({ id: 'i', estoqueId: 'e' }) }, estoqueGestor: { findUnique: vi.fn().mockResolvedValue({}) }, movimentacao: { groupBy: vi.fn().mockResolvedValue([{ tipo: TipoMovimentacao.ENTRADA, _sum: { quantidade: 10 } }]), create: vi.fn() } };
    await expect(new MovimentacoesService({ $transaction: (cb: any) => cb(tx) } as any).registrarMovimentacao({ itemId: 'i', tipo: TipoMovimentacao.SAIDA, quantidade: 11 }, 'u', false)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.movimentacao.create).not.toHaveBeenCalled();
  });
  it('CT-01-32/33: consulta estoque vazio e rejeita estoque inexistente', async () => {
    const prisma: any = {
      estoque: { findUnique: vi.fn().mockResolvedValueOnce({ id: 'e' }).mockResolvedValueOnce(null) },
      item: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new MovimentacoesService(prisma);
    expect(await service.consultarSaldoEstoque('e')).toEqual({ estoqueId: 'e', itens: [] });
    await expect(service.consultarSaldoEstoque('ausente')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.item.findMany).toHaveBeenCalledTimes(1);
  });
  it('CT-01-34/35/36: histórico limita a consulta ao estoque e ordena por data', async () => {
    const registros = [{ id: 'm2' }, { id: 'm1' }];
    const prisma: any = { estoqueGestor: { findUnique: vi.fn().mockResolvedValue({ usuarioId: 'u' }) }, movimentacao: { findMany: vi.fn().mockResolvedValue(registros) } };
    const result = await new MovimentacoesService(prisma).consultarHistoricoEstoque('e', 'u', false);
    expect(result).toEqual(registros);
    expect(prisma.movimentacao.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { item: { estoqueId: 'e' } }, orderBy: { dataMovimentacao: 'desc' } }));
  });
  it.todo('CT-01-07/09/11/12: autorização de edição por gestor; controller atual só permite ADMIN');
  it.todo('CT-01-17/18/19: validar tipo e quantidade antes de chamar o serviço pela rota HTTP');
});
