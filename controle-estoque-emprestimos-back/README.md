# controle-estoque-emprestimos

Sistema de controle de estoque e empréstimos

API REST em Node.js com [NestJS 11](https://nestjs.com/), [Prisma](https://www.prisma.io/), [PostgreSQL](https://www.postgresql.org/), [Keycloak](https://www.keycloak.org/) e [Zod](https://zod.dev/). Gerado a partir do `cincoders-nestjs-boilerplate`.

---

## ⚡ Stack Tecnológica

| Ferramenta | Versão | Propósito |
|---|---|---|
| [Node.js](https://nodejs.org/) | 22 LTS | Runtime JavaScript/TypeScript |
| [NestJS](https://nestjs.com/) | 11.x | Framework backend modular |
| [Prisma](https://www.prisma.io/) | 5.x | ORM e gerenciamento de migrations |
| [PostgreSQL](https://www.postgresql.org/) | 14+ | Banco de dados relacional |
| [Keycloak](https://www.keycloak.org/) + [jose](https://github.com/panva/jose) | 26.x / 6.x | Autenticação OIDC / JWT stateless (fail-closed) |
| [Zod](https://zod.dev/) + [nestjs-zod](https://www.npmjs.com/package/nestjs-zod) | 3.x / 5.x | Schemas de validação e OpenAPI |
| [Swagger / OpenAPI](https://swagger.io/) | 11.x | Documentação interativa em `/api/docs` |
| [Vitest](https://vitest.dev/) | 4.x | Testes unitários de alta velocidade |
| [Biome](https://biomejs.dev/) | 2.x | Linter e formatador de código |
| [Husky](https://typicode.github.io/husky/) + [commitlint](https://commitlint.js.org/) | 9.x / 21.x | Git hooks e Conventional Commits |

---

## 🚀 Setup Rápido

Pré-requisitos: Node.js 22 LTS, npm 11+, Docker + Docker Compose.

Execute os passos abaixo em um terminal PowerShell. O `docker-compose.yml` sobe Postgres e Keycloak; a API é iniciada separadamente pelo npm.

```powershell
# 1. Entre na pasta do backend
cd controle-estoque-emprestimos-back

# 2. Crie o arquivo de ambiente local (se ainda não existir) e instale as dependências
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm install

# 3. Suba Postgres e Keycloak
docker compose up -d

# 4. Gere o Prisma Client e aplique as migrations
npm run prisma:generate
npm run migration:run

# 5. Crie os dados de demonstração da US02
npm run seed

# 6. Inicie o backend; mantenha este terminal aberto
npm run dev
```

O seed consulta o Keycloak local para encontrar o `sub` atual do usuário `user`, cria/atualiza o estoque `Estoque demonstração US02` e autoriza esse usuário como gestor. Ele é idempotente: pode ser executado novamente sem duplicar o estoque ou o vínculo. Por padrão usa `admin`/`admin` para a conta administrativa do Keycloak; configure `KEYCLOAK_ADMIN_USERNAME` e `KEYCLOAK_ADMIN_PASSWORD` no `.env` se forem diferentes.

Após o backend iniciar, abra o Swagger no navegador:

```text
http://localhost:3000/api/docs
```

No Swagger, use **Authorize** com um access token do Keycloak. Para obter um token local no PowerShell, copie e execute o exemplo abaixo e cole o resultado de `$token` no diálogo de autorização. Troque `admin`/`admin` por `user`/`user` para conferir as respostas `403` dos endpoints exclusivos do ADMIN.

```powershell
$token = (Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8080/auth/realms/Local/protocol/openid-connect/token" `
  -ContentType "application/x-www-form-urlencoded" `
  -Body @{
    grant_type = "password"
    client_id = "controle-estoque-emprestimos-back"
    client_secret = "dev-secret"
    username = "admin"
    password = "admin"
  }).access_token

$token
```

Para parar Postgres e Keycloak ao terminar, rode `docker compose down` na pasta do backend. Os dados continuam nos volumes locais; para removê-los também, use `docker compose down -v`.

O `.env.example` contém os valores locais padrão. Ajuste as variáveis conforme o seu ambiente.

- **API Base**: `http://localhost:3000/controle-estoque-emprestimos/api` (recursos versionados em `/controle-estoque-emprestimos/api/v1/...`)
- **Health Check**: `http://localhost:3000/controle-estoque-emprestimos/api/health` (público, sem versionamento)
- **Documentação Swagger**: `http://localhost:3000/api/docs`
- **Keycloak Admin**: `http://localhost:8080/auth` (admin/admin, realm: `Local`)
- **Usuários de teste**: `admin`/`admin` (roles `sys_controle-estoque-emprestimos-admin` e `sys_controle-estoque-emprestimos-users`) e `user`/`user` (role `sys_controle-estoque-emprestimos-users`)

### Termos de responsabilidade

Ao registrar um empréstimo, a API gera o termo de acautelamento em PDF e o armazena em `TERMO_STORAGE_PATH` (padrão: `./storage/termos`). O Docker Compose monta um volume persistente nesse diretório. Em produção, configure `TERMO_STORAGE_PATH` para um volume persistente e faça backup dos documentos.

- `GET /controle-estoque-emprestimos/api/v1/estoques/:estoqueId/emprestimos/:id/termo`: visualiza o PDF.
- `GET /controle-estoque-emprestimos/api/v1/estoques/:estoqueId/emprestimos/:id/termo/download`: baixa o PDF.

Ambos os endpoints exigem autenticação e permitem acesso ao gestor do estoque e ao ADMIN. A numeração do termo é sequencial por ano.

---

## 🛠️ Comandos Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor NestJS em modo de desenvolvimento (watch) |
| `npm run build` | Compila o projeto TypeScript para `dist/` |
| `npm run start:prod` | Inicia a aplicação a partir da pasta compilada `dist/` |
| `npm run lint` | Executa o linter Biome e aplica correções automáticas |
| `npm run format` | Formata o código com Biome |
| `npm test` | Executa a suíte de testes unitários com Vitest |
| `npm run test:watch` | Executa os testes unitários em modo watch |
| `npm run test:cov` | Executa os testes e gera relatório de cobertura |
| `npm run prisma:generate` | Gera o Prisma Client a partir de `prisma/schema.prisma` |
| `npm run migration:generate` | Cria e aplica uma nova migration a partir de mudanças no `schema.prisma` (`prisma migrate dev`) |
| `npm run migration:run` | Aplica todas as migrations pendentes no PostgreSQL (`prisma migrate deploy`) |
| `npm run seed` | Cria/atualiza o estoque de demonstração e autoriza `user` como gestor |

---

## 🤝 Contribuição

Para padrões de código, fluxo de branches, convenções de commits e abertura de Pull Requests, consulte o **[CONTRIBUTING.md](CONTRIBUTING.md)**.
