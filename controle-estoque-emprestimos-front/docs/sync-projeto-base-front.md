# Sincronização com projeto-base-front (2026-09-14)

`teste1/projeto-base-front` tinha mudanças **não commitadas** no working tree
(`git status`/`git diff HEAD`, branch `master`) migrando de uma versão antiga
da `@cincoders/cinnamon` para uma versão mais nova, ainda não publicada nem
vendorizada neste boilerplate. Esta é a segunda passada da análise — a
primeira, que concluiu erroneamente que não havia nada a trazer, comparou só
o conteúdo em disco sem checar `git status`, então ignorou justamente essas
mudanças não commitadas. Elas foram trazidas para o boilerplate nesta rodada.

## O que foi aplicado

1. **`@cincoders/cinnamon` atualizada para a versão nova.** A versão antiga
   (`sideMenuLinks`, footer manual com `title`/`telephone`/etc.) foi trocada
   pela API nova (`sidebar: SidebarData`, `activeHref`, `linkComponent`,
   `footer.variant: "cin"`, e as 9 variantes novas de `<Text>`). Localmente,
   `package.json` aponta para `file:../vendor/cincoders-cinnamon-2.0.0.tgz`,
   empacotado a partir do fonte real em `/home/ecb/projects/work/cinnamon-v2`
   (`npm pack` equivalente via `tar`, porque o cache do npm estava sem
   permissão de escrita nesta sessão). **Antes de publicar o boilerplate de
   verdade, troque essa linha por `^2.0.0`** — a versão publicada no npm —
   e remova `vendor/`. Sempre que a cinnamon-v2 mudar, repacotar com:
   ```
   cd /home/ecb/projects/work/cinnamon-v2 && npm run build && npm pack
   cp cincoders-cinnamon-2.0.0.tgz <repo>/vendor/
   ```
   - Um `file:` apontando para um diretório vira symlink no `node_modules`
     do npm, o que quebra tanto a inferência de tipos genéricos do
     `tailwind-variants` no `tsc` quanto a resolução de `react/jsx-runtime`
     do Vite. Por isso o tgz manual (`vendor/cincoders-cinnamon-2.0.0.tgz`),
     não um path direto — reproduz o que vai acontecer com a versão do
     registry.
   - `@base-ui/react` precisou ser adicionado como dependência explícita: é
     usado internamente pelo `Sheet`/Drawer da sidebar nova mas não está
     declarado nos `peerDependencies` do pacote da cinnamon — vale reportar
     isso a quem mantém a cinnamon.
   - `tailwind-variants` também não veio automaticamente na primeira
     instalação (dependência de um pacote `file:` de diretório) — teve que
     ser instalado à parte. Não deve ser um problema ao usar `^2.0.0` do
     registry.

2. **`src/app/provider.tsx`, `team.page.tsx`**: `sonner` (`Toaster`/`toast`)
   trocado por `ToastContainer`/`toast` da cinnamon. `sonner` foi removido
   das dependências.

3. **`src/components/PageCin/index.tsx`**: migrado para `sidebar`/`activeHref`/
   `linkComponent` (com um adapter `CinnamonRouterLink` para navegação sem
   full reload) e `footer={{ variant: "cin", appVersion }}`. Mantido
   `publicURL: ""` e sem `URL_PREFIX` fixo — isso é específico do
   `projeto-base-front` (que fixa `/projeto-base`); o boilerplate usa
   `controle-estoque-emprestimos` como placeholder e `basename={import.meta.env.BASE_URL}`
   genérico, que já resolve o base path sem hardcode.

4. **`src/utils/sideMenuLinks.ts` → `src/utils/sidebar.ts`**: `SideMenuLink[]`
   virou `SidebarData` (`navMain`), mantendo os dois itens do boilerplate
   (`Tarefas de Exemplo`, `Gerenciar Equipe` — admin-only via `ADMIN_ONLY_LINKS`,
   que `projeto-base-front` não tinha por ter sido gerado antes do módulo `team`).

5. **`src/modules/todos/todos.page.tsx`**: HTML cru (`<input>`, `<select>`,
   `<table>`) trocado pelos componentes da cinnamon (`SearchInput`,
   `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue`,
   `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`,
   `Text`). O filtro por query string (`useSearchParams`) e os ícones lucide
   já eram melhores no boilerplate que no `projeto-base-front` e foram
   mantidos como estavam.

6. **`<Text>` aplicado em toda tag de texto crua identificada** (`h1`–`h6`,
   `p`, `span`, `label`), usando as 12 variantes disponíveis na cinnamon —
   as 3 originais (`title`/`subtitle`/`description`) e as 9 adicionadas a
   pedido (`announce`, `tag`, `alarm`, `headline`, `alert`, `murmur`,
   `emphasis`, `whisper`, `faint`). Ver a tabela abaixo.

## O que **não** foi trazido (específico do `projeto-base-front`, não do padrão do boilerplate)

- `URL_PREFIX` fixo (`/projeto-base`) e rota "mãe" em `routes.tsx` — o
  boilerplate resolve isso via `controle-estoque-emprestimos` + `basename`.
- Remoção das classes `dark:` (o `projeto-base-front` tirou dark mode do
  login e do `PageCin`) — o boilerplate mantém dark mode em toda a UI.
- `src/components/ui/{input,select}.tsx` (radix-ui + pacote `cn`) — não são
  importados em lugar nenhum no `projeto-base-front`, resíduo de um
  `shadcn add` que não chegou a ser usado; a listagem usa `Select` da
  cinnamon, não esses componentes locais.

## Variantes de `<Text>`

Padrão do time: sempre `<Text>` no lugar de `h1`–`h6`, `p`, `span`, `label`,
etc. — nunca a tag HTML crua com className solto. A cinnamon (a partir do
tgz empacotado em 2026-09-14, `vendor/cincoders-cinnamon-2.0.0.tgz`) tem 12
variantes; cada uma já define sua tag HTML padrão internamente
(`tagByVariant` em `Text.tsx`), então normalmente não é preciso passar `as`:

| Variante | Tag padrão | Uso | Aplicada em |
|---|---|---|---|
| `title` | `h1` | Título de página | `login/index.tsx`, `team.page.tsx` |
| `subtitle` | `h2` | Subtítulo | — |
| `description` | `p` | Texto de apoio de página | `login/index.tsx`, `team.page.tsx` |
| `announce` | `h2` | Título de modal | `TodoModal.tsx`, `MemberModal.tsx` |
| `tag` | `label` | Rótulo de campo | `TodoModal.tsx`, `MemberModal.tsx` |
| `alarm` | `p` | Erro de validação inline | `TodoModal.tsx`, `MemberModal.tsx` |
| `headline` | `h3` | Título de card/seção | `todos.page.tsx` (estado vazio) |
| `alert` | `h2` | Título de tela de erro | `ErrorBoundary.tsx` |
| `murmur` | `p` | Corpo explicativo de erro | `ErrorBoundary.tsx` |
| `emphasis` | `span` | Ênfase em negrito | `todos.page.tsx` (usa `as="p"` — está dentro de um parágrafo próprio, não inline) |
| `whisper` | `p` | Texto pequeno em callout | `todos.page.tsx`, `team.page.tsx` |
| `faint` | `span` | Metadado/texto apagado | `todos.page.tsx` (célula "—" de data vazia) |

Casos que **não** foram convertidos porque as classes não batem com nenhuma
variante (evita alterar o visual só para trocar a tag): o filtro de status
(`todos.page.tsx`, `text-xs font-medium text-gray-500`, é rótulo de UI
compacto, não `tag`) e as mensagens de estado vazio/erro de carregamento
(`text-sm text-gray-500`, mais próximas de `description` mas não idênticas).
Badges coloridos (status, prioridade, "Gabarito", "Só ADMIN") continuam como
`span` com classes de badge — são componentes visuais com fundo/borda, não
texto de conteúdo.

## Verificação

`tsc -b --noEmit`, `eslint .` e `vitest run` (38/38) passam após as mudanças
acima, com a cinnamon-v2 vendorizada localmente em `vendor/`.
