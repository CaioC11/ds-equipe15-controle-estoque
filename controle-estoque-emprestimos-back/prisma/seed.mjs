import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ESTOQUE_DEMO = {
  nome: 'Estoque demonstração US02',
  descricao: 'Estoque local para demonstrar a autorização de gestores por estoque.',
  localizacao: 'Demonstração',
};

async function obterIdUsuarioKeycloak(username) {
  const authServerUrl = (process.env.KEYCLOAK_AUTH_SERVER_URL || 'http://localhost:8080/auth')
    .replace(/\/$/, '');
  const realm = process.env.KEYCLOAK_REALM || 'Local';
  const adminUsername = process.env.KEYCLOAK_ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';

  const tokenResponse = await fetch(
    `${authServerUrl}/realms/master/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: 'admin-cli',
        username: adminUsername,
        password: adminPassword,
      }),
    },
  );

  if (!tokenResponse.ok) {
    throw new Error(
      `Não foi possível autenticar no Keycloak (${tokenResponse.status}). ` +
        'Confira se ele está ativo e se KEYCLOAK_ADMIN_USERNAME/KEYCLOAK_ADMIN_PASSWORD estão corretos.',
    );
  }

  const { access_token: accessToken } = await tokenResponse.json();
  const usersUrl = new URL(
    `${authServerUrl}/admin/realms/${encodeURIComponent(realm)}/users`,
  );
  usersUrl.search = new URLSearchParams({ username, exact: 'true' }).toString();

  const usersResponse = await fetch(usersUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!usersResponse.ok) {
    throw new Error(
      `Não foi possível buscar o usuário "${username}" no realm "${realm}" ` +
        `(${usersResponse.status}). Confira o realm e as permissões do administrador.`,
    );
  }

  const users = await usersResponse.json();
  const user = users.find((candidate) => candidate.username === username);
  if (!user?.id) {
    throw new Error(
      `Usuário "${username}" não encontrado no realm "${realm}". ` +
        'Suba o Keycloak com o realm de desenvolvimento importado.',
    );
  }

  return user.id;
}

async function main() {
  const usuarioId = await obterIdUsuarioKeycloak('user');

  const estoque = await prisma.estoque.upsert({
    where: { nome: ESTOQUE_DEMO.nome },
    update: {
      descricao: ESTOQUE_DEMO.descricao,
      localizacao: ESTOQUE_DEMO.localizacao,
      ativo: true,
    },
    create: ESTOQUE_DEMO,
  });

  await prisma.estoqueGestor.upsert({
    where: {
      estoqueId_usuarioId: {
        estoqueId: estoque.id,
        usuarioId,
      },
    },
    update: {},
    create: {
      estoqueId: estoque.id,
      usuarioId,
    },
  });

  console.log(`Estoque de demonstração pronto: ${estoque.nome} (${estoque.id})`);
  console.log(`Usuário Keycloak "user" autorizado como gestor (sub: ${usuarioId}).`);
}

main()
  .catch((error) => {
    console.error('Falha ao executar o seed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
