import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Can } from './Can';
import { ALL_ROLES, Roles, WRITE_ROLES } from '../../utils/enums';

// Mock do react-oidc-context: controlamos as roles do "access_token".
const mockUseAuth = vi.fn();
vi.mock('react-oidc-context', () => ({
  useAuth: () => mockUseAuth(),
}));

/** Monta um access_token JWT falso (header.payload.sig) com as roles dadas. */
function fakeToken(roles: string[]): string {
  const payload = btoa(JSON.stringify({ realm_access: { roles } }));
  return `header.${payload}.sig`;
}

function setRoles(roles: string[] | null) {
  mockUseAuth.mockReturnValue({
    user: roles ? { access_token: fakeToken(roles) } : null,
  });
}

describe('<Can>', () => {
  beforeEach(() => mockUseAuth.mockReset());

  it('renderiza os filhos quando o usuário tem a role (editor + escrita)', () => {
    setRoles(['sys_controle-estoque-emprestimos-editor']);
    render(
      <Can roles={WRITE_ROLES}>
        <button>Novo</button>
      </Can>,
    );
    expect(screen.queryByText('Novo')).not.toBeNull();
  });

  it('esconde os filhos quando não tem a role (usuário comum + escrita)', () => {
    setRoles(['sys_controle-estoque-emprestimos-users']);
    render(
      <Can roles={WRITE_ROLES}>
        <button>Novo</button>
      </Can>,
    );
    expect(screen.queryByText('Novo')).toBeNull();
  });

  it('esconde delete para editor mas mostra para admin', () => {
    setRoles(['sys_controle-estoque-emprestimos-editor']);
    const { rerender } = render(
      <Can roles={[Roles.ADMIN]}>
        <button>Excluir</button>
      </Can>,
    );
    expect(screen.queryByText('Excluir')).toBeNull();

    setRoles(['sys_controle-estoque-emprestimos-admin']);
    rerender(
      <Can roles={[Roles.ADMIN]}>
        <button>Excluir</button>
      </Can>,
    );
    expect(screen.queryByText('Excluir')).not.toBeNull();
  });

  it('mode="disable" desabilita em vez de esconder', () => {
    setRoles(['sys_controle-estoque-emprestimos-users']);
    render(
      <Can roles={WRITE_ROLES} mode="disable">
        <button>Novo</button>
      </Can>,
    );
    expect(screen.getByText('Novo').hasAttribute('disabled')).toBe(true);
  });

  it('renderiza o fallback quando sem permissão', () => {
    setRoles(['sys_controle-estoque-emprestimos-users']);
    render(
      <Can roles={[Roles.ADMIN]} fallback={<span>sem acesso</span>}>
        <button>Config</button>
      </Can>,
    );
    expect(screen.queryByText('sem acesso')).not.toBeNull();
    expect(screen.queryByText('Config')).toBeNull();
  });

  it('usuário sem role reconhecida não vê nada protegido', () => {
    setRoles(['offline_access']);
    render(
      <Can roles={ALL_ROLES}>
        <button>Ver</button>
      </Can>,
    );
    expect(screen.queryByText('Ver')).toBeNull();
  });
});
