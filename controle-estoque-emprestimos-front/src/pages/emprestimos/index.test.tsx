import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmprestimosPage from './index';
import { emprestimoService, HttpError } from '../../modules/emprestimos/emprestimo.service';
import type { Emprestimo } from '../../modules/emprestimos/emprestimo.types';

vi.mock('../../modules/emprestimos/emprestimo.service', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../modules/emprestimos/emprestimo.service')>();
  return {
    ...original,
    emprestimoService: {
      listarEstoques: vi.fn(),
      listarItensEmprestaveis: vi.fn(),
      listarPendentes: vi.fn(),
      listarResponsaveis: vi.fn(),
      historicoResponsavel: vi.fn(),
      registrar: vi.fn(),
      devolver: vi.fn(),
    },
  };
});

const service = vi.mocked(emprestimoService);

const responsavel = {
  id: 'r1',
  nome: 'Maria Silva',
  siape: '1234567',
  cpf: null,
  lotacao: 'CIn',
  cargo: 'Professora',
};
const criarEmprestimo = (extra: Partial<Emprestimo>): Emprestimo => ({
  id: 'emp',
  itemId: 'item',
  status: 'ATIVO',
  dataRetirada: '2030-01-10T12:00:00.000Z',
  prazoDevolucao: '2030-02-10T23:59:59.000Z',
  dataDevolucaoEfetiva: null,
  item: {
    id: 'item',
    tipo: 'PATRIMONIAL',
    nome: 'Notebook',
    tombamento: '1',
    numeroSerie: null,
    status: 'DISPONIVEL',
  },
  responsavel,
  atrasado: false,
  termo: null,
  termoAssinadoAnexado: false,
  ...extra,
});

const aguardando = criarEmprestimo({
  id: 'emp-1',
  itemId: 'i1',
  status: 'AGUARDANDO_TERMO',
  prazoDevolucao: null,
  item: {
    id: 'i1',
    tipo: 'PATRIMONIAL',
    nome: 'Projetor',
    tombamento: '111',
    numeroSerie: null,
    status: 'DISPONIVEL',
  },
});
const ativoAtrasado = criarEmprestimo({
  id: 'emp-2',
  itemId: 'i2',
  atrasado: true,
  item: {
    id: 'i2',
    tipo: 'PATRIMONIAL',
    nome: 'Notebook Dell',
    tombamento: '222',
    numeroSerie: null,
    status: 'EMPRESTADO',
  },
});
const ativoNoPrazo = criarEmprestimo({
  id: 'emp-3',
  itemId: 'i3',
  item: {
    id: 'i3',
    tipo: 'PATRIMONIAL',
    nome: 'Câmera',
    tombamento: '333',
    numeroSerie: null,
    status: 'EMPRESTADO',
  },
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
  service.listarResponsaveis.mockResolvedValue([responsavel]);
  service.historicoResponsavel.mockResolvedValue([]);
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
    fireEvent.click(
      await screen.findByRole('button', { name: 'Registrar devolução', hidden: true }),
    );

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
    expect(screen.getByText('Informe o Siape ou o CPF.')).toBeInTheDocument();
    expect(screen.getByText('A lotação é obrigatória.')).toBeInTheDocument();
    expect(screen.getByText('O cargo é obrigatório.')).toBeInTheDocument();
    expect(service.registrar).not.toHaveBeenCalled();
  });

  it('não oferece item que já tem empréstimo em aberto', async () => {
    // i1 está aguardando termo; só "Mouse" deve restar
    service.listarItensEmprestaveis.mockResolvedValue([
      {
        id: 'i1',
        tipo: 'PATRIMONIAL',
        nome: 'Projetor',
        tombamento: '111',
        numeroSerie: null,
        status: 'DISPONIVEL',
      },
      {
        id: 'i9',
        tipo: 'PATRIMONIAL',
        nome: 'Mouse',
        tombamento: '999',
        numeroSerie: null,
        status: 'DISPONIVEL',
      },
    ]);
    renderPage();
    await screen.findByText('Projetor');

    fireEvent.click(screen.getByRole('button', { name: /novo empréstimo/i }));

    // 2º combobox = o select de item do formulário (o 1º é o de estoque)
    const form = screen
      .getByRole('button', { name: 'Registrar Empréstimo' })
      .closest('form') as HTMLElement;
    fireEvent.click(within(form).getAllByRole('combobox')[0]);

    expect(await screen.findByText('Mouse (tomb. 999)')).toBeInTheDocument();
    expect(screen.queryByText('Projetor (tomb. 111)')).not.toBeInTheDocument();
  });

  it('registra o empréstimo com item e responsável digitado (prazo vazio = indefinido)', async () => {
    service.listarItensEmprestaveis.mockResolvedValue([
      {
        id: 'i9',
        tipo: 'PATRIMONIAL',
        nome: 'Mouse',
        tombamento: '999',
        numeroSerie: null,
        status: 'DISPONIVEL',
      },
    ]);
    service.registrar.mockResolvedValue(aguardando);
    renderPage();
    await screen.findByText('Projetor');

    fireEvent.click(screen.getByRole('button', { name: /novo empréstimo/i }));
    const form = screen
      .getByRole('button', { name: 'Registrar Empréstimo' })
      .closest('form') as HTMLElement;
    fireEvent.click(within(form).getAllByRole('combobox')[0]);
    fireEvent.click(await screen.findByText('Mouse (tomb. 999)'));

    fireEvent.change(screen.getByPlaceholderText('Ex: Maria Silva'), {
      target: { value: '  João Souza ' },
    });
    fireEvent.change(screen.getByLabelText(/Siape \(ou informe/), { target: { value: '7654321' } });
    fireEvent.change(screen.getByLabelText('Lotação *'), { target: { value: 'CIn' } });
    fireEvent.change(screen.getByLabelText('Cargo *'), { target: { value: 'Técnico' } });
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

describe('S3-21 — seleção e histórico', () => {
  it('seleciona o responsável por nome e identificação e envia somente seu id', async () => {
    service.listarItensEmprestaveis.mockResolvedValue([{ ...aguardando.item, id: 'livre' }]);
    service.registrar.mockResolvedValue(aguardando);
    renderPage();
    await screen.findByText('Projetor');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /novo empréstimo/i })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: /novo empréstimo/i }));
    const form = screen
      .getByRole('button', { name: 'Registrar Empréstimo' })
      .closest('form') as HTMLElement;
    fireEvent.click(within(form).getAllByRole('combobox')[0]);
    fireEvent.click(await screen.findByText('Projetor (tomb. 111)'));
    const select = screen.getByLabelText('Responsável cadastrado');
    expect(within(select).getByText('Maria Silva — Siape 1234567')).toBeInTheDocument();
    fireEvent.change(select, { target: { value: responsavel.id } });
    expect(screen.queryByPlaceholderText('Ex: Maria Silva')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Empréstimo' }));
    await waitFor(() =>
      expect(service.registrar).toHaveBeenCalledWith('est-1', {
        itemId: 'livre',
        responsavelId: 'r1',
        prazoDevolucao: undefined,
      }),
    );
  });

  it('mostra histórico com empréstimos ativos e devolvidos, mesmo sem pendências', async () => {
    service.listarPendentes.mockResolvedValue([]);
    service.historicoResponsavel.mockResolvedValue([
      ativoNoPrazo,
      criarEmprestimo({
        id: 'devolvido',
        status: 'DEVOLVIDO',
        dataDevolucaoEfetiva: '2030-01-20T12:00:00Z',
      }),
    ]);
    renderPage();
    fireEvent.change(await screen.findByLabelText('Responsável'), { target: { value: 'r1' } });
    expect(await screen.findByText('Devolvido')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(screen.getByText('20/01/2030')).toBeInTheDocument();
    expect(service.historicoResponsavel).toHaveBeenCalledWith('est-1', 'r1');
  });

  it('mostra histórico vazio para responsável sem empréstimos', async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText('Responsável'), { target: { value: 'r1' } });
    expect(
      await screen.findByText('Nenhum empréstimo deste responsável neste estoque.'),
    ).toBeInTheDocument();
  });

  it('mostra o 403 do histórico sem exibir dados e permite tentar novamente', async () => {
    service.historicoResponsavel.mockRejectedValue(
      new HttpError('Sem permissão para consultar histórico', 403),
    );
    renderPage();
    fireEvent.change(await screen.findByLabelText('Responsável'), { target: { value: 'r1' } });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sem permissão para consultar histórico',
    );
    service.historicoResponsavel.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(
      await screen.findByText('Nenhum empréstimo deste responsável neste estoque.'),
    ).toBeInTheDocument();
  });
});
