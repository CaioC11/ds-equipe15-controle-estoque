import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LoginPage from './index';
import type { AuthContextProps } from 'react-oidc-context';

describe('<LoginPage>', () => {
  let mockSigninRedirect: ReturnType<typeof vi.fn>;
  let mockAuth: Partial<AuthContextProps>;

  beforeEach(() => {
    mockSigninRedirect = vi.fn();
    mockAuth = {
      isAuthenticated: false,
      isLoading: false,
      activeNavigator: undefined,
      signinRedirect: mockSigninRedirect,
      error: undefined,
    };
  });

  it('renderiza o botão "Entrar" e textos informativos', () => {
    render(<LoginPage auth={mockAuth as AuthContextProps} />);

    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
    expect(screen.getByText(/Controle de Estoque e Empréstimos/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Acesse com sua conta institucional do CIn/i),
    ).toBeInTheDocument();
  });

  it('não redireciona automaticamente para o Keycloak ao renderizar', () => {
    render(<LoginPage auth={mockAuth as AuthContextProps} />);

    expect(mockSigninRedirect).not.toHaveBeenCalled();
  });

  it('chama signinRedirect ao clicar no botão "Entrar"', () => {
    render(<LoginPage auth={mockAuth as AuthContextProps} />);

    const button = screen.getByRole('button', { name: /entrar/i });
    fireEvent.click(button);

    expect(mockSigninRedirect).toHaveBeenCalledTimes(1);
  });

  it('desabilita o botão quando isLoading for true', () => {
    mockAuth.isLoading = true;
    render(<LoginPage auth={mockAuth as AuthContextProps} />);

    const button = screen.getByRole('button', { name: /entrar/i });
    expect(button).toBeDisabled();
  });

  it('exibe mensagem de erro quando auth.error estiver presente', () => {
    mockAuth.error = Object.assign(new Error('Falha no provedor de identidade'), {
      source: 'unknown' as const,
    });
    render(<LoginPage auth={mockAuth as AuthContextProps} />);

    expect(
      screen.getByText(/Falha no provedor de identidade/i),
    ).toBeInTheDocument();
  });
});
