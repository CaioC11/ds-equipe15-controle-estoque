import { ForbiddenPage } from '@cincoders/cinnamon';
import type { AuthContextProps } from 'react-oidc-context';
import PageCin from './PageCin';
import { Links } from '../utils/enums';

interface ForbiddenPageCinProps {
  auth: AuthContextProps;
}

/**
 * Tela de acesso negado. O `RequireAuth` do cinnamon redireciona para
 * `/forbidden` quando o usuário está autenticado mas não tem nenhuma das
 * `permittedRoles` da rota — sem esta rota o usuário cairia numa tela vazia.
 *
 * Espelha o `ForbiddenPageCIn` do prorank.
 */
export default function ForbiddenPageCin({ auth }: ForbiddenPageCinProps) {
  return (
    <PageCin auth={auth} permittedRoles={['*']}>
      {/* publicURL aqui é o destino do "voltar" quando se abre /forbidden direto. */}
      <ForbiddenPage auth={auth} publicURL={Links.HOME} />
    </PageCin>
  );
}
