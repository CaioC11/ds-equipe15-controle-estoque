import { useMemo } from 'react';
import { useAuth } from 'react-oidc-context';
import type { User } from 'oidc-client-ts';
import { Roles } from '../utils/enums';

/** Decodifica o payload (base64url) de um JWT sem dependência externa. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Extrai as roles do realm do usuário. As roles do Keycloak vivem em
 * `realm_access.roles` — normalmente no access token. Faz fallback para o
 * perfil do id token, caso um mapper as inclua lá.
 */
export function extractRealmRoles(user: User | null | undefined): string[] {
  if (!user) return [];

  const fromAccess = user.access_token
    ? decodeJwtPayload(user.access_token)
    : null;
  const accessRoles = (fromAccess?.realm_access as { roles?: string[] } | undefined)
    ?.roles;
  if (Array.isArray(accessRoles)) return accessRoles;

  const profileRoles = (
    user.profile?.realm_access as { roles?: string[] } | undefined
  )?.roles;
  if (Array.isArray(profileRoles)) return profileRoles;

  return [];
}

export interface Authorization {
  /** Roles do sistema + quaisquer outras presentes no token. */
  roles: string[];
  /** True se o usuário tem ao menos uma das roles informadas. */
  hasRole: (...roles: Roles[]) => boolean;
  isAdmin: boolean;
  /**
   * Usuário sem privilégio de escrita. Derivado, e não lido de uma
   * role própria: `sys_controle-estoque-emprestimos-guest` não existe no Keycloak.
   */
  isReadOnly: boolean;
}

/**
 * Lê as roles do token para gatear a UI. Mesma checagem que o `RequireAuth` do
 * cinnamon faz com `permittedRoles` (match "alguma das roles"), exposta para
 * uso fora do gating de rota — em botões e itens de menu.
 *
 * É só UX: a autorização real é validada pelo backend.
 */
export function useAuthorization(): Authorization {
  const auth = useAuth();

  return useMemo<Authorization>(() => {
    const roles = extractRealmRoles(auth.user);
    const hasRole = (...wanted: Roles[]) =>
      wanted.some((role) => roles.includes(role));

    return {
      roles,
      hasRole,
      isAdmin: hasRole(Roles.ADMIN),
      isReadOnly: hasRole(Roles.USERS) && !hasRole(Roles.ADMIN),
    };
    // Recalcula quando o token muda (login/refresh).
  }, [auth.user]);
}
