# controle-estoque-emprestimos-front

Sistema de controle de estoque e empréstimos — React + Vite + TypeScript. Autenticação via Keycloak (OIDC).

## Requisitos

- Node.js 24.x (`nvm use`)
- Backend rodando (veja [`controle-estoque-emprestimos-back`](../controle-estoque-emprestimos-back))

## Setup

```bash
cp .env.example .env      # já aponta para http://localhost:3000/controle-estoque-emprestimos/api em dev
npm install
```

> O `.env.example` **não** contém segredos. Para clients confidenciais do Keycloak, defina o segredo apenas no seu `.env` local (que está no gitignore).

## Rodando

```bash
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build
npm run preview    # serve o build
npm run lint
npm test           # vitest run
```

## Variáveis de ambiente

Veja [`.env.example`](./.env.example):

- `VITE_API_URL` — URL da API (dev: `http://localhost:3000/controle-estoque-emprestimos/api`).
- `VITE_KEYCLOAK_JSON` — configuração do client Keycloak.
- `VITE_BASE_URL` — base path público da aplicação.

## Estrutura

```
src/
├── app/             # provedores globais (AppProvider) e composição da aplicação
├── modules/         # um diretório por domínio: página, hook, service e types juntos
│   ├── todos/       # módulo de exemplo (gabarito) — aberto a qualquer usuário, ações com <Can>
│   └── team/        # módulo de gerenciamento — rota restrita ao ADMIN (permittedRoles)
├── pages/           # telas fora de um módulo de domínio (ex: login)
├── components/      # componentes compartilhados (ErrorBoundary, Can, layout)
├── services/        # cliente HTTP compartilhado (fetchApi, token/refresh)
├── hooks/           # hooks compartilhados (useAsync, useAuthorization)
├── lib/             # utils genéricos
├── config/          # env
└── utils/           # auth, navegação, enums de roles
```

O código flui numa direção só: **compartilhado → módulo → app**. Um módulo nunca
importa de outro; a composição acontece em `app/` e `routes.tsx`.

### Anatomia de um módulo (`src/modules/todos/`)

| Arquivo             | Papel                                                        |
| ------------------- | ----------------------------------------------------------- |
| `todos.page.tsx`    | A tela. Só orquestra: estado de UI, permissões, render.     |
| `useTodos.ts`       | Estado de cache do servidor + mutações, sobre `useAsync`.   |
| `todo.service.ts`   | Chamadas HTTP ao backend, via `fetchApi`.                   |
| `todo.types.ts`     | Types e o schema `zod` do formulário.                       |
| `TodoModal.tsx`     | Formulário (react-hook-form + zod).                         |

Para criar o módulo do seu domínio, copie a pasta `todos/`, renomeie os
arquivos e ajuste os types.

### Controle de acesso: dois níveis

| Onde                        | Como                                              | Exemplo          |
| --------------------------- | ------------------------------------------------ | ---------------- |
| Página inteira              | `permittedRoles` na rota (`routes.tsx`)          | `team` (só ADMIN) |
| Botão / ação dentro da tela | `<Can roles={[...]}>` (`components/auth/Can.tsx`) | `todos` (escrita) |

O módulo `todos` é aberto a qualquer usuário autenticado e usa `<Can>` para
esconder os botões de escrita. O módulo `team` é uma tela de gerenciamento: a
rota exige `Roles.ADMIN`, o link está em `ADMIN_ONLY_LINKS` (some do menu para
os demais), e por isso a página nem precisa de `<Can>`. Os dois são só UX — o
backend valida a role de novo em cada endpoint.

### Tratamento de erro de renderização

`ErrorBoundary` (`src/components/ErrorBoundary.tsx`) é o boundary padrão. Já
está montado em dois níveis: no `AppProvider` (captura tudo) e por rota em
`routes.tsx` (isola falhas de uma página e se recupera ao navegar). Envolva
qualquer subárvore arriscada com `<ErrorBoundary label="...">`. Ele não pega
erro de evento nem de `async` — para chamadas de API, trate o `error` do
`useAsync`.

## Releases

A pipeline vem de [`cincoders/platform/ci-templates`](https://gitlab.cin.ufpe.br/cincoders/platform/ci-templates), e a aritmética de versão de
[`@cincoders/release-tooling`](https://www.npmjs.com/package/@cincoders/release-tooling). Ambos documentam o fluxo por completo; o que importa aqui:

- A versão exibida no rodapé vem do `package.json`, lida em tempo de build, então
  precisa estar commitada antes de a imagem ser construída.
- Todo merge em `develop` gera um release candidate (`1.4.0-rc.1`, `-rc.2`, ...).
  O merge de `develop` em `main` promove o candidate que chegou lá para a versão
  estável, escreve o `CHANGELOG.md`, cria a tag `vX.Y.Z` e publica a imagem.
- Os commits seguem [Conventional Commits](https://www.conventionalcommits.org). O
  subject vira, literalmente, a entrada do changelog — escreva-os em inglês, assim
  como os comentários de código e a documentação.

Para conferir um cálculo sem alterar nada:

```bash
npm run release:prepare -- --dry-run   # em develop: o próximo candidate
npm run release:promote -- --dry-run   # em main: a versão que seria publicada
```

## Notas

- A aplicação é servida sob um base path (`VITE_BASE_URL`, `/controle-estoque-emprestimos` por padrão), injetado no bundle na inicialização do container pelo `docker-entrypoint.sh`.
- `NODE_ENV` não pode estar definido no `.env`: o Vite carrega o `.env` em todos os modos e usa esse valor para decidir `isProduction`, o que transforma o `npm run build` num build de desenvolvimento.
