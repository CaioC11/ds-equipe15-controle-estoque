export enum Links {
  ACCOUNT_MANAGEMENT = 'https://account.cin.ufpe.br',
  INTRANET_HOME = 'https://intranet.cin.ufpe.br/',
  HOME = '/',
  FORBIDDEN = '/forbidden',
  TODOS = '/todos',
  TEAM = '/team',
  CATEGORIAS = '/categorias',
}

/**
 * Rotas exclusivas de administradores — ocultadas do menu para os demais perfis.
 * A restrição de verdade é o `permittedRoles` da rota em `routes.tsx`; esta
 * lista só evita mostrar um link que levaria a `/forbidden`.
 */
export const ADMIN_ONLY_LINKS: string[] = [Links.TEAM];

/**
 * Roles do sistema no realm do Keycloak — fonte única do modelo.
 *
 * Precedência de fato: ADMIN faz tudo; quem tem só USERS lê. Isso é
 * expresso listando as roles permitidas em cada rota (`permittedRoles`) e
 * em cada ação (`<Can roles={[...]}>`).
 */
export enum Roles {
  USERS = 'sys_controle-estoque-emprestimos-users',
  ADMIN = 'sys_controle-estoque-emprestimos-admin',
}

/**
 * Rotas de leitura: qualquer usuário autenticado do sistema. ADMIN entra
 * explícito para não depender de composite role no Keycloak — o match do
 * `RequireAuth` é "tem ao menos uma destas".
 */
export const ALL_ROLES: Roles[] = [Roles.USERS, Roles.ADMIN];

/** Roles que podem criar e editar conteúdo. */
export const WRITE_ROLES: Roles[] = [Roles.ADMIN];
