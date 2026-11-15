import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Emprestimo } from '../../modules/emprestimos/emprestimo.types';
import { emprestimoService } from '../../modules/emprestimos/emprestimo.service';
import TermoPage from './TermoPage';
import { PageWithAuth } from '@cincoders/cinnamon';
import type { OidcAuthLike } from '@cincoders/cinnamon';
import { ALL_ROLES, Roles } from '../../utils/enums';

vi.mock('../../modules/emprestimos/emprestimo.service', () => ({
  emprestimoService: {
    buscarEmprestimo: vi.fn(), obterTermoBlob: vi.fn(),
    anexarTermoAssinado: vi.fn(), confirmarEntrega: vi.fn(),
  },
  HttpError: class HttpError extends Error {},
}));
const service = vi.mocked(emprestimoService);
const base: Emprestimo = {
  id: 'emp-1', itemId: 'item-1', status: 'AGUARDANDO_TERMO',
  dataRetirada: '2026-11-14T12:00:00Z', prazoDevolucao: null,
  dataDevolucaoEfetiva: null, atrasado: false, termoAssinadoAnexado: false,
  termo: { id: 'termo-1', numeroAno: '01/2026' },
  item: { id: 'item-1', nome: 'Notebook', tipo: 'PATRIMONIAL', tombamento: '1', numeroSerie: null, status: 'DISPONIVEL' },
  responsavel: { id: 'r-1', nome: 'Maria', siape: '123', cpf: null, lotacao: 'CIn', cargo: 'Docente' },
};
function abrir() {
  return render(<MemoryRouter initialEntries={['/emprestimos/emp-1/termo?estoque=est-1']}>
    <Routes><Route path="/emprestimos/:id/termo" element={<TermoPage />} /></Routes>
  </MemoryRouter>);
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:termo'), revokeObjectURL: vi.fn() });
  service.buscarEmprestimo.mockResolvedValue(base);
  service.obterTermoBlob.mockResolvedValue(new Blob(['%PDF-'], { type: 'application/pdf' }));
  service.anexarTermoAssinado.mockResolvedValue(undefined as never);
});
describe('US05 — tela do termo (G-11)', () => {
  it('CT-05-16: mostra o PDF gerado e oferece download', async () => {
    abrir();
    expect(await screen.findByTitle('Termo de Responsabilidade')).toHaveAttribute('src', 'blob:termo');
    expect(screen.getByRole('link', { name: 'Baixar PDF' })).toHaveAttribute('download', 'termo-emprestimo-emp-1.pdf');
    expect(service.obterTermoBlob).toHaveBeenCalledWith('est-1', 'emp-1');
  });
  it('CT-05-16: perfil permitido atravessa o guard da rota e vê o PDF', async () => {
    const auth = {
      isAuthenticated: true, isLoading: false,
      user: { access_token: `h.${btoa(JSON.stringify({ realm_access: { roles: [Roles.USERS] } }))}.s`, profile: { email: 'gestor@cin.ufpe.br' } },
      signinRedirect: vi.fn(), signoutRedirect: vi.fn(),
    } as unknown as OidcAuthLike;
    render(<MemoryRouter initialEntries={['/emprestimos/emp-1/termo?estoque=est-1']}>
      <Routes><Route path="/emprestimos/:id/termo" element={
        <PageWithAuth authProps={{ auth, permittedRoles: ALL_ROLES, publicURL: '' }}><TermoPage /></PageWithAuth>
      } /></Routes>
    </MemoryRouter>);
    expect(await screen.findByTitle('Termo de Responsabilidade')).toHaveAttribute('src', 'blob:termo');
  });
  it('CT-05-24: confirmação desabilitada sem anexo', async () => {
    abrir();
    expect(await screen.findByRole('button', { name: 'Confirmar entrega' })).toBeDisabled();
  });
  it('CT-05-25: confirmação habilitada depois que a consulta informa anexo', async () => {
    service.buscarEmprestimo.mockResolvedValue({ ...base, termoAssinadoAnexado: true });
    abrir();
    expect(await screen.findByRole('button', { name: 'Confirmar entrega' })).toBeEnabled();
  });
  it('CT-05-27: upload inválido não libera confirmação; upload válido só libera após recarregar estado', async () => {
    service.buscarEmprestimo.mockResolvedValueOnce(base).mockResolvedValue({ ...base, termoAssinadoAnexado: true });
    abrir();
    const confirmar = await screen.findByRole('button', { name: 'Confirmar entrega' });
    const arquivo = document.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(arquivo, { target: { files: [new File(['não pdf'], 'texto.txt', { type: 'text/plain' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Envie um arquivo em formato PDF.');
    expect(confirmar).toBeDisabled();
    expect(service.anexarTermoAssinado).not.toHaveBeenCalled();
    fireEvent.change(arquivo, { target: { files: [new File(['%PDF-'], 'termo.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(service.anexarTermoAssinado).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar entrega' })).toBeEnabled());
  });
});
