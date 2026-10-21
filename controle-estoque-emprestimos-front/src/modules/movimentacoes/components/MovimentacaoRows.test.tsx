import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SaldoItem } from '../movimentacao.types';
import { SaldoRow } from './MovimentacaoRows';

const itemBase: SaldoItem = {
  itemId: 'item-1',
  nomeItem: 'Cabo HDMI',
  saldo: 10,
  nivelMinimo: 3,
  abaixoDoMinimo: false,
};

const tabela = (item: SaldoItem) => (
  <table>
    <tbody>
      <SaldoRow item={item} />
    </tbody>
  </table>
);

describe('<SaldoRow> — alerta de estoque baixo', () => {
  it('mostra o badge de alerta quando o saldo está no mínimo ou abaixo', () => {
    render(tabela({ ...itemBase, saldo: 3, abaixoDoMinimo: true }));

    expect(screen.getByText('Abaixo do mínimo')).toBeTruthy();
    expect(screen.queryByText('Normal')).toBeNull();
  });

  it('não mostra alerta quando o saldo está acima do mínimo', () => {
    render(tabela({ ...itemBase, saldo: 10, abaixoDoMinimo: false }));

    expect(screen.queryByText('Abaixo do mínimo')).toBeNull();
    expect(screen.getByText('Normal')).toBeTruthy();
  });

  it('sem nível mínimo definido, nunca mostra alerta', () => {
    render(tabela({ ...itemBase, saldo: 0, nivelMinimo: null, abaixoDoMinimo: false }));

    expect(screen.queryByText('Abaixo do mínimo')).toBeNull();
    expect(screen.getByText('Não definido')).toBeTruthy();
  });

  it('o alerta some quando o saldo é reposto acima do mínimo', () => {
    const { rerender } = render(tabela({ ...itemBase, saldo: 2, abaixoDoMinimo: true }));
    expect(screen.getByText('Abaixo do mínimo')).toBeTruthy();

    rerender(tabela({ ...itemBase, saldo: 8, abaixoDoMinimo: false }));

    expect(screen.queryByText('Abaixo do mínimo')).toBeNull();
    expect(screen.getByText('Normal')).toBeTruthy();
  });
});