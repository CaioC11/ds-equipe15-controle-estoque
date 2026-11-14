import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useResponsaveis } from './useEmprestimos';
import { emprestimoService, HttpError } from './emprestimo.service';

vi.mock('./emprestimo.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./emprestimo.service')>()),
  emprestimoService: { listarResponsaveis: vi.fn() },
}));

describe('S3-21 — troca de estoque e acesso aos responsáveis', () => {
  it('limpa os dados anteriores durante a troca e não os reapresenta se o novo estoque negar acesso', async () => {
    let rejeitar!: (erro: Error) => void;
    const segundaConsulta = new Promise<never>((_resolve, reject) => {
      rejeitar = reject;
    });
    vi.mocked(emprestimoService.listarResponsaveis)
      .mockResolvedValueOnce([
        { id: 'r1', nome: 'Maria', siape: '123', cpf: null, lotacao: 'CIn', cargo: 'Docente' },
      ])
      .mockReturnValueOnce(segundaConsulta);
    const { result, rerender } = renderHook(({ estoqueId }) => useResponsaveis(estoqueId), {
      initialProps: { estoqueId: 'est-1' },
    });
    await waitFor(() => expect(result.current.responsaveis).toHaveLength(1));
    rerender({ estoqueId: 'est-2' });
    expect(result.current.responsaveis).toEqual([]);
    expect(emprestimoService.listarResponsaveis).toHaveBeenCalledWith('est-2');
    await act(async () => rejeitar(new HttpError('Sem acesso', 403)));
    await waitFor(() => expect(result.current.error).toMatchObject({ status: 403 }));
    expect(result.current.responsaveis).toEqual([]);
  });
});
