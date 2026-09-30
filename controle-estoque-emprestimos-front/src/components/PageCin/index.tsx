import { PageWithAuth } from "@cincoders/cinnamon";
import { Outlet, Navigate, Link as RouterLink, useLocation } from "react-router-dom";
import type { AuthContextProps } from "react-oidc-context";
import { sidebar } from "../../utils/sidebar";
import { useAuthorization } from "../../hooks/useAuthorization";
import { ADMIN_ONLY_LINKS, Links } from "../../utils/enums";
// Named import: lets the bundler drop the rest of package.json.
import { version as appVersion } from "../../../package.json";

interface PageCinProps {
  auth: AuthContextProps;
  /** Roles que podem acessar a rota; `['*']` libera qualquer autenticado. */
  permittedRoles: string[];
  /** Conteúdo. Sem children, renderiza o `<Outlet />` da rota aninhada. */
  children?: JSX.Element | JSX.Element[];
}

/**
 * Adapta o `Link` do react-router à interface `LinkComponent` da cinnamon
 * (que espera `href`, não `to`). Deixa a navegação da sidebar/menus
 * client-side, sem full reload.
 */
function CinnamonRouterLink({ href, ...rest }: React.ComponentProps<"a"> & { href: string }) {
  return <RouterLink to={href} {...rest} />;
}

export default function PageCin({ auth, permittedRoles, children }: PageCinProps) {
  const { isAdmin } = useAuthorization();
  const { pathname } = useLocation();

  // Admin-only items stay hidden from every other profile.
  const visibleNavMain = sidebar.navMain.filter(
    (link) => isAdmin || !ADMIN_ONLY_LINKS.includes(link.href ?? ""),
  );

  // Título do header: nome da página atual (ex: "Tarefas de Exemplo"), não o
  // nome do projeto — o nome da app já aparece no topo da sidebar.
  const currentPageTitle =
    sidebar.navMain.find((link) => link.href === pathname)?.title ?? sidebar.appName;

  if (auth.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <Navigate to={Links.HOME} replace />;
  }

  return (
    <PageWithAuth
      // publicURL vazio é necessário: o RequireAuth do cinnamon redireciona
      // para `${publicURL}/forbidden` e, sem ele, cai em "undefined/forbidden".
      authProps={{ auth, permittedRoles, publicURL: "" }}
      navbar={{
        title: currentPageTitle,
        auth,
        accountManagementUrl: Links.ACCOUNT_MANAGEMENT,
        logoRedirectUrl: Links.INTRANET_HOME,
        // Sidebar em Drawer, aberta pelo botão de menu do Navbar.
        sidebar: { ...sidebar, navMain: visibleNavMain },
        // Rota atual: a SideMenu destaca o item cujo `href` bate com isto
        // e marca `aria-current="page"`.
        activeHref: pathname,
        // Navegação interna sem full reload (sidebar, popup de sistemas, menu da conta).
        linkComponent: CinnamonRouterLink,
      }}
      footer={{
        // Preset "cin": traz o bloco de Suporte Técnico do CIn pronto.
        variant: "cin",
        appVersion,
      }}
      centralized={false}
      haveToast={false} // Toasts already handled in App.tsx
    >
      {children ?? <Outlet />}
    </PageWithAuth>
  );
}
