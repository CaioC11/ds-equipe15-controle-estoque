import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GerenciamentoEstoque } from './GerenciamentoEstoque';
import type { Estoque } from '../modules/estoques/estoque.types';
import { ItemApiError, itemService } from '../modules/estoques/item.service';
import { categoriasService } from '../services/categoriaService';

vi.mock('../modules/estoques/item.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../modules/estoques/item.service')>();
  return {
    ...actual,
    itemService: {
      listar: vi.fn(),
      criar: vi.fn(),
      completarTombamento: vi.fn(),
    },
  };
});

vi.mock('../services/categoriaService', () => ({
  categoriasService: {
    listar: vi.fn(),
  },
}));

const listarItensMock = vi.mocked(itemService.listar);
const criarItemMock = vi.mocked(itemService.criar);
const completarTombamentoMock = vi.mocked(itemService.completarTombamento);
const listarCategoriasMock = vi.mocked(categoriasService.listar);

const estoquesMock: Estoque[] = [
  {
    id: 'est-1',
    nome: 'Almoxarifado TI',
    descricao: null,
    localizacao: 'Bloco A',
    ativo: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

describe('GerenciamentoEstoque (S3-19 - Tombamento pendente)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listarCategoriasMock.mockResolvedValue([{ id: 'cat-1', nome: 'Informática' }]);
    listarItensMock.mockResolvedValue([]);
  });

  it('permite cadastrar item patrimonial sem tombamento (ficando pendente)', async () => {
    criarItemMock.mockResolvedValue({
      id: 'item-1',
      nome: 'Monitor Dell 24"',
      tipo: 'PATRIMONIAL',
      tombamento: null,
      tombamentoPendente: true,
      numeroSerie: null,
      nivelMinimo: null,
      status: 'DISPONIVEL',
      categoria: { id: 'cat-1', nome: 'Informática' },
    });

    const onItemCriado = vi.fn();
    render(
      <GerenciamentoEstoque
        estoques={estoquesMock}
        isGestor={true}
        onItemCriado={onItemCriado}
      />,
    );

    await waitFor(() => expect(listarCategoriasMock).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/Estoque \*/i), { target: { value: 'est-1' } });
    fireEvent.change(screen.getByLabelText(/Categoria \*/i), { target: { value: 'cat-1' } });
    fireEvent.change(screen.getByLabelText(/Nome \*/i), { target: { value: 'Monitor Dell 24"' } });

    fireEvent.click(screen.getByRole('button', { name: /Cadastrar Item/i }));

    await waitFor(() => {
      expect(criarItemMock).toHaveBeenCalledWith('est-1', {
        tipo: 'PATRIMONIAL',
        nome: 'Monitor Dell 24"',
        categoriaId: 'cat-1',
        tombamento: undefined,
        numeroSerie: undefined,
        nivelMinimo: undefined,
      });
    });

    expect(
      await screen.findByText(/Item patrimonial cadastrado com tombamento pendente!/i),
    ).toBeInTheDocument();
    expect(onItemCriado).toHaveBeenCalled();
  });

  it('exibe badge de tombamento pendente, filtra por pendência e permite informar tombamento depois', async () => {
    listarItensMock.mockResolvedValue([
      {
        id: 'item-pend-1',
        nome: 'Switch 24 portas',
        tipo: 'PATRIMONIAL',
        tombamento: null,
        tombamentoPendente: true,
        numeroSerie: 'SN-900',
        nivelMinimo: null,
        status: 'DISPONIVEL',
        categoria: { id: 'cat-1', nome: 'Informática' },
      },
    ]);

    completarTombamentoMock.mockResolvedValue({
      id: 'item-pend-1',
      nome: 'Switch 24 portas',
      tipo: 'PATRIMONIAL',
      tombamento: 'PAT-2026-500',
      tombamentoPendente: false,
      numeroSerie: 'SN-900',
      nivelMinimo: null,
      status: 'DISPONIVEL',
      categoria: { id: 'cat-1', nome: 'Informática' },
    });

    render(<GerenciamentoEstoque estoques={estoquesMock} isGestor={true} />);

    fireEvent.change(screen.getByLabelText(/Estoque \*/i), { target: { value: 'est-1' } });

    expect(await screen.findByText('Switch 24 portas')).toBeInTheDocument();
    expect(screen.getByText('Tombamento pendente')).toBeInTheDocument();

    // Testa filtro "Pendentes de tombamento"
    fireEvent.click(screen.getByRole('button', { name: 'Pendentes de tombamento' }));
    await waitFor(() => {
      expect(listarItensMock).toHaveBeenLastCalledWith('est-1', { pendente: true });
    });

    // Abre modal para completar tombamento
    fireEvent.click(screen.getByRole('button', { name: /Informar tombamento/i }));
    expect(screen.getByRole('heading', { name: /Informar Tombamento/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Código de Tombamento \*/i), {
      target: { value: 'PAT-2026-500' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Tombamento/i }));

    await waitFor(() => {
      expect(completarTombamentoMock).toHaveBeenCalledWith('est-1', 'item-pend-1', {
        tombamento: 'PAT-2026-500',
      });
    });

    expect(await screen.findByText(/Tombamento informado com sucesso!/i)).toBeInTheDocument();
  });

  it('mostra erro no modal quando o tombamento já está em uso (409)', async () => {
    listarItensMock.mockResolvedValue([
      {
        id: 'item-pend-1',
        nome: 'Switch 24 portas',
        tipo: 'PATRIMONIAL',
        tombamento: null,
        tombamentoPendente: true,
        numeroSerie: null,
        nivelMinimo: null,
        status: 'DISPONIVEL',
      },
    ]);

    completarTombamentoMock.mockRejectedValueOnce(
      new ItemApiError('Já existe um item com este tombamento', 409),
    );

    render(<GerenciamentoEstoque estoques={estoquesMock} isGestor={true} />);

    fireEvent.change(screen.getByLabelText(/Estoque \*/i), { target: { value: 'est-1' } });
    fireEvent.click(await screen.findByRole('button', { name: /Informar tombamento/i }));

    fireEvent.change(screen.getByLabelText(/Código de Tombamento \*/i), {
      target: { value: 'PAT-DUP' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Tombamento/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Já existe um item com este tombamento',
    );
  });
});