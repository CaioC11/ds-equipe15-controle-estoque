import { BrowserRouter, Route, Routes, Navigate, useLocation, Outlet } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useAuth } from 'react-oidc-context';
import { setAuthToken, setRefreshTokenFn, setLogoutFn } from './services/api';
import PageCin from './components/PageCin';
import ForbiddenPageCin from './components/ForbiddenPageCin';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ErrorScreen, httpErrors } from '@cincoders/cinnamon';
import { ALL_ROLES, Links, Roles } from './utils/enums';
import TodosPage from './pages/todos';
import TeamPage from './pages/team';
import LoginPage from './pages/login';

/**
 * Error boundary de nível de rota: um erro de renderização numa página mostra a
 * tela de erro padrão só naquela área, e `resetKey={pathname}` faz o boundary
 * se recuperar sozinho ao navegar para outra rota — sem isso a aplicação ficaria
 * presa na tela de erro. Envolve o `<Outlet />` das rotas protegidas.
 */
function RouteErrorBoundary() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary label={`rota ${pathname}`} resetKey={pathname}>
      <Outlet />
    </ErrorBoundary>
  );
}

function RouteMap() {
  const auth = useAuth();
  const hasCheckedSession = useRef(false);

  useEffect(() => {
    if (auth.isAuthenticated && !auth.isLoading && !auth.activeNavigator && !hasCheckedSession.current) {
      hasCheckedSession.current = true;
      auth.signinSilent().catch(async (err) => {
        console.error('Session validation failed on load:', err);
        try {
          await auth.removeUser();
          await auth.clearStaleState();
        } catch {
          // ignore clean up error
        }
      });
    }
  }, [auth]);

  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      setAuthToken(auth.user.access_token);
    } else {
      setAuthToken(null);
    }

    const refreshFn = async () => {
      try {
        console.log('Token expirado, tentando refresh silencioso...');
        const user = await auth.signinSilent();
        if (user) {
          setAuthToken(user.access_token);
          return user.access_token;
        }
      } catch (renewError) {
        console.error('Refresh silencioso falhou:', renewError);
      }
      return null;
    };

    setRefreshTokenFn(refreshFn);

    return () => {
      setRefreshTokenFn(null);
    };
  }, [auth]);

  useEffect(() => {
    const handleExpired = async () => {
      try {
        await auth.removeUser();
        await auth.clearStaleState();
      } catch {
        // ignore clean up error
      }
    };

    auth.events.addAccessTokenExpired(handleExpired);
    auth.events.addSilentRenewError(handleExpired);
    auth.events.addUserSignedOut(handleExpired);

    // Acionado pelo fetchApi quando uma chamada ao backend segue negada mesmo
    // após tentar renovar o token — a sessão morreu, então deslogamos. Limpar
    // o estado do auth basta: RouteMap re-renderiza e a rota / já cai para a
    // tela de login por não haver mais usuário autenticado.
    setLogoutFn(() => {
      void handleExpired();
    });

    return () => {
      auth.events.removeAccessTokenExpired(handleExpired);
      auth.events.removeSilentRenewError(handleExpired);
      auth.events.removeUserSignedOut(handleExpired);
      setLogoutFn(null);
    };
  }, [auth]);

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        {/* Rota raiz /: se autenticado vai para /todos, caso contrário exibe tela de login */}
        <Route
          path={Links.HOME}
          element={
            auth.isAuthenticated ? (
              <Navigate to={Links.TODOS} replace />
            ) : (
              <LoginPage auth={auth} />
            )
          }
        />

        {/* Acesso negado: destino do redirect do RequireAuth (cinnamon). */}
        <Route path={Links.FORBIDDEN} element={<ForbiddenPageCin auth={auth} />} />

        {/* Rotas protegidas abertas a qualquer usuário do sistema. O
            RouteErrorBoundary isola falhas de renderização por página. */}
        <Route element={<PageCin auth={auth} permittedRoles={ALL_ROLES} />}>
          <Route element={<RouteErrorBoundary />}>
            <Route path={Links.TODOS} element={<TodosPage />} />
            {/* Rota desconhecida: componente de erro pronto da cinnamon (404). */}
            <Route path="*" element={<ErrorScreen errorType={httpErrors.NOTFOUND_404} />} />
          </Route>
        </Route>

        {/* Rotas de gerenciamento — só ADMIN. Mesma tela do CIn, mas com
            `permittedRoles={[Roles.ADMIN]}`: quem não é ADMIN é redirecionado
            para /forbidden pelo RequireAuth do cinnamon. */}
        <Route element={<PageCin auth={auth} permittedRoles={[Roles.ADMIN]} />}>
          <Route element={<RouteErrorBoundary />}>
            <Route path={Links.TEAM} element={<TeamPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default RouteMap;
