import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorScreen, ForbiddenPage, httpErrors, PageWithAuth } from '@cincoders/cinnamon';
import type { OidcAuthLike } from '@cincoders/cinnamon';

vi.mock('react-oidc-context', () => ({ useAuth: vi.fn() }));

// Guards the boilerplate's integration with @cincoders/cinnamon v2:
// the ready-made error screens and the PageWithAuth guard behaviour.
describe('@cincoders/cinnamon v2 integration', () => {
  it('ErrorScreen renders the 501 message and illustration', () => {
    render(<ErrorScreen errorType={httpErrors.COMINGSOON_501} />);
    expect(screen.getByText(/em construcao/i)).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /erro 501/i }),
    ).toBeInTheDocument();
  });

  it('ErrorScreen renders the 503 (inactive) message', () => {
    render(<ErrorScreen errorType={httpErrors.INACTIVE_503} />);
    expect(screen.getByText(/temporariamente inacessivel/i)).toBeInTheDocument();
  });

  it('ForbiddenPage renders the 403 screen with the logged-in user', () => {
    render(
      <ForbiddenPage
        auth={{ user: { profile: { email: 'ana@cin.ufpe.br' } } }}
        publicURL="/"
      />,
    );
    expect(screen.getByText(/you are logged in as/i)).toBeInTheDocument();
    expect(screen.getByText(/ana@cin\.ufpe\.br/)).toBeInTheDocument();
  });

  it('PageWithAuth shows ForbiddenPage when the session lacks the permitted role', () => {
    const auth: OidcAuthLike = {
      isAuthenticated: true,
      isLoading: false,
      user: { access_token: 'x', profile: { email: 'bob@cin.ufpe.br' } },
      signinRedirect: vi.fn(),
      signoutRedirect: vi.fn(),
    };
    render(
      <PageWithAuth authProps={{ auth, permittedRoles: ['sys_x-admin'], publicURL: '' }}>
        <div>conteúdo protegido</div>
      </PageWithAuth>,
    );
    expect(screen.getByText(/you are logged in as/i)).toBeInTheDocument();
    expect(screen.queryByText(/conteúdo protegido/i)).toBeNull();
  });

  it('PageWithAuth renders children when the role matches', () => {
    const auth = {
      isAuthenticated: true,
      isLoading: false,
      user: {
        access_token: `h.${btoa(
          JSON.stringify({ realm_access: { roles: ['sys_x-users'] } }),
        )}.s`,
        profile: { email: 'carol@cin.ufpe.br' },
      },
      signinRedirect: vi.fn(),
    } as unknown as OidcAuthLike;
    render(
      <PageWithAuth authProps={{ auth, permittedRoles: ['*'], publicURL: '' }}>
        <div>conteúdo protegido</div>
      </PageWithAuth>,
    );
    expect(screen.getByText(/conteúdo protegido/i)).toBeInTheDocument();
  });
});
