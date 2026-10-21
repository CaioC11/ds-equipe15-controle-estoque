import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmprestimosPage from './index';
import { emprestimoService, HttpError } from '../../modules/emprestimos/emprestimo.service';
import type { Emprestimo } from '../../modules/emprestimos/emprestimo.types';

vi.mock('../../modules/emprestimos/emprestimo.service', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../modules/emprestimos/emprestimo.service')>();
  return {
    ...original,
    emprestimoService: {
      listarEstoques: vi.fn(),
      listarItensEmprestaveis: vi.fn(),
      listarPendentes: vi.fn(),
      registrar: vi.fn(),
      devolver: vi.fn(),
    },
  };
});

const service = vi.mocked(emprestimoService);

const responsavel = { id: 'r1', nome: 'Maria Silva', siape: '1234567', cpf: null, lotacao: 'CIn', cargo: 'Professora' };
const criarEmprestimo = (extra: Partial<Emprestimo>): Emprestimo => ({
  id: 'emp',
  itemId: 'item',
  status: 'ATIVO',
  dataRetirada: '2030-01-10T12:00:00.000Z',
  prazoDevolucao: '2030-02-10T23:59:59.000Z',
  dataDevolucaoEfetiva: null,
  item: { id: 'item', tipo: 'PATRIMONIAL', nome: 'Notebook', tombamento: '1', numeroSerie: null, status: 'DISPONIVEL' },
  responsavel,
  atrasado: false,
  ...extra,
});

const aguardando = criarEmprestimo({
  id: 'emp-1',
  itemId: 'i1',
  status: 'AGUARDANDO_TERMO',
  prazoDevolucao: null,
  item: { id: 'i1', tipo: 'PATRIMONIAL', nome: 'Projetor', tombamento: '111', numeroSerie: null, status: 'DISPONIVEL' },
});
const ativoAtrasado = criarEmprestimo({
  id: 'emp-2',
  itemId: 'i2',
  atrasado: true,
  item: { id: 'i2', tipo: 'PATRIMONIAL', nome: 'Notebook Dell', tombamento: '222', numeroSerie: null, status: 'EMPRESTADO' },
});
const ativoNoPrazo = criarEmprestimo({
  id: 'emp-3',
  itemId: 'i3',
  item: { id: 'i3', tipo: 'PATRIMONIAL', nome: 'Câmera', tombamento: '333', numeroSerie: null, status: 'EMPRESTADO' },
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <EmprestimosPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.resetAllMocks();
  service.listarEstoques.mockResolvedValue([{ id: 'est-1', nome: 'Almoxarifado', ativo: true }]);
  service.listarItensEmprestaveis.mockResolvedValue([]);
  service.listarPendentes.mockResolvedValue([aguardando, ativoAtrasado, ativoNoPrazo]);
});

describe('<EmprestimosPage>', () => {
  it('lista os pendentes do primeiro estoque, com situação de cada empréstimo', async () => {
    renderPage();

    expect(await screen.findByText('Projetor')).toBeInTheDocument();
    expect(service.listarPendentes).toHaveBeenCalledWith('est-1');
    expect(screen.getByText('Aguardando termo assinado')).toBeInTheDocument();
    expect(screen.getAllByText('Ativo')).toHaveLength(2);
    // prazo vazio aparece como "Indefinido"
    expect(screen.getByText('Indefinido')).toBeInTheDocument();
  });

  it('mostra a tag "Atrasado" só nos empréstimos atrasados', async () => {
    renderPage();
    await screen.findByText('Notebook Dell');

    const tags = screen.getAllByText('Atrasado');
    expect(tags).toHaveLength(1);
    const linhaAtrasada = screen.getByText('Notebook Dell').closest('tr') as HTMLElement;
    expect(within(linhaAtrasada).getByText('Atrasado')).toBeInTheDocument();
  });

  it('oferece "Devolver" só para empréstimo ativo', async () => {
    renderPage();
    await screen.findByText('Projetor');

    const linhaAguardando = screen.getByText('Projetor').closest('tr') as HTMLElement;
    const linhaAtiva = screen.getByText('Câmera').closest('tr') as HTMLElement;

    expect(within(linhaAguardando).queryByText('Devolver')).not.toBeInTheDocument();
    expect(within(linhaAtiva).getByText('Devolver')).toBeInTheDocument();
  });

  it('cada empréstimo leva à tela do termo (#14)', async () => {
    renderPage();
    await screen.findByText('Projetor');

    const links = screen.getAllByRole('link', { name: /termo/i });
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute('href', '/emprestimos/emp-1/termo?estoque=est-1');
  });

  it('devolve o empréstimo depois da confirmação e recarrega a lista', async () => {
    service.devolver.mockResolvedValue({ ...ativoNoPrazo, status: 'DEVOLVIDO' });
    renderPage();
    await screen.findByText('Câmera');

    const linhaAtiva = screen.getByText('Câmera').closest('tr') as HTMLElement;
    fireEvent.click(within(linhaAtiva).getByText('Devolver'));
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar devolução', hidden: true }));

    await waitFor(() => expect(service.devolver).toHaveBeenCalledWith('est-1', 'emp-3'));
    await waitFor(() => expect(service.listarPendentes).toHaveBeenCalledTimes(2));
  });

  it('avisa quando o usuário não é gestor do estoque (403) e bloqueia o novo empréstimo', async () => {
    service.listarPendentes.mockRejectedValue(new HttpError('Apenas gestores deste estoque', 403));
    renderPage();

    expect(await screen.findByText('Sem acesso aos empréstimos deste estoque')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /novo empréstimo/i })).toBeDisabled();
  });

  it('mostra estado vazio quando não há pendências', async () => {
    service.listarPendentes.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('Nenhum empréstimo pendente')).toBeInTheDocument();
  });

  it('o formulário valida os campos obrigatórios (responsável é obrigatório)', async () => {
    renderPage();
    await screen.findByText('Projetor');

    fireEvent.click(screen.getByRole('button', { name: /novo empréstimo/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar Empréstimo' }));

    expect(await screen.findByText('O nome do responsável é obrigatório.')).toBeInTheDocument();
    expect(screen.getByText('O Siape é obrigatório.')).toBeInTheDocument();
    expect(screen.getByText('A lotação é obrigatória.')).toBeInTheDocument();
    expect(screen.getByText('O cargo é obrigatório.')).toBeInTheDocument();
    expect(service.registrar).not.toHaveBeenCalled();
  });

  it('não oferece item que já tem empréstimo em aberto', async () => {
    // i1 está aguardando termo; só "Mouse" deve restar
    service.listarItensEmprestaveis.mockResolvedValue([
      { id: 'i1', tipo: 'PATRIMONIAL', nome: 'Projetor', tombamento: '111', numeroSerie: null, status: 'DISPONIVEL' },
      { id: 'i9', tipo: 'PATRIMONIAL', nome: 'Mouse', tombamento: '999', numeroSerie: null, status: 'DISPONIVEL' },
    ]);
    renderPage();
    await screen.findByText('Projetor');

    fireEvent.click(screen.getByRole('button', { name: /novo empréstimo/i }));

    // 2º combobox = o select de item do formulário (o 1º é o de estoque)
    await waitFor(() => expect(screen.getAllByRole('combobox')).toHaveLength(2));
    fireEvent.click(screen.getAllByRole('combobox')[1]);

    expect(await screen.findByText('Mouse (tomb. 999)')).toBeInTheDocument();
    expect(screen.queryByText('Projetor (tomb. 111)')).not.toBeInTheDocument();
  });

  it('registra o empréstimo com item e responsável digitado (prazo vazio = indefinido)', async () => {
    service.listarItensEmprestaveis.mockResolvedValue([
      { id: 'i9', tipo: 'PATRIMONIAL', nome: 'Mouse', tombamento: '999', numeroSerie: null, status: 'DISPONIVEL' },
    ]);
    service.registrar.mockResolvedValue(aguardando);
    renderPage();
    await screen.findByText('Projetor');

    fireEvent.click(screen.getByRole('button', { name: /novo empréstimo/i }));
    await waitFor(() => expect(screen.getAllByRole('combobox')).toHaveLength(2));
    fireEvent.click(screen.getAllByRole('combobox')[1]);
    fireEvent.click(await screen.findByText('Mouse (tomb. 999)'));

    fireEvent.change(screen.getByPlaceholderText('Ex: Maria Silva'), { target: { value: '  João Souza ' } });
    const campos = screen.getAllByRole('textbox');
    // ordem no formulário: nome, siape, lotação, cargo
    fireEvent.change(campos[1], { target: { value: '7654321' } });
    fireEvent.change(campos[2], { target: { value: 'CIn' } });
    fireEvent.change(campos[3], { target: { value: 'Técnico' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Empréstimo' }));

    await waitFor(() => expect(service.registrar).toHaveBeenCalledTimes(1));
    expect(service.registrar).toHaveBeenCalledWith('est-1', {
      itemId: 'i9',
      responsavel: { nome: 'João Souza', siape: '7654321', lotacao: 'CIn', cargo: 'Técnico' },
      prazoDevolucao: undefined,
    });
    // atualiza a lista depois de registrar
    await waitFor(() => expect(service.listarPendentes).toHaveBeenCalledTimes(2));
  });

  it('avisa quando não há item disponível para emprestar', async () => {
    service.listarItensEmprestaveis.mockResolvedValue([]);
    renderPage();
    await screen.findByText('Projetor');

    fireEvent.click(screen.getByRole('button', { name: /novo empréstimo/i }));

    expect(await screen.findByText(/nenhum item disponível para empréstimo/i)).toBeInTheDocument();
  });
});
