import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Roles } from '../../utils/enums';
import { useAuthorization } from '../../hooks/useAuthorization';

interface CanProps {
  /** Roles que podem ver/usar os filhos (basta ter uma delas). */
  roles: Roles[];
  /**
   * `hide` (padrão): não renderiza nada quando sem permissão.
   * `disable`: renderiza os filhos com a prop `disabled` (útil para botões).
   */
  mode?: 'hide' | 'disable';
  /** Conteúdo alternativo quando sem permissão (apenas no modo `hide`). */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Gate declarativo de UI por role. Complementa o `permittedRoles` das rotas,
 * que só consegue gatear a página inteira — aqui é o nível de botão/ação.
 * A checagem é só de UX: o backend é a autoridade final.
 *
 *   <Can roles={WRITE_ROLES}><Button>Novo</Button></Can>
 *   <Can roles={[Roles.ADMIN]} mode="disable"><Button>Excluir</Button></Can>
 */
export function Can({ roles, mode = 'hide', fallback = null, children }: CanProps) {
  const { hasRole } = useAuthorization();
  const allowed = hasRole(...roles);

  if (allowed) return <>{children}</>;

  if (mode === 'disable' && isValidElement(children)) {
    return cloneElement(children as ReactElement<{ disabled?: boolean }>, {
      disabled: true,
    });
  }

  return <>{fallback}</>;
}
