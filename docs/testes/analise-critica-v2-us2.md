# Medição e análise crítica da suíte v2 — US02 (Controle de Acesso)

Issue S3B-10 (#69). Suíte: `controle-estoque-emprestimos-back/tests/v2/us02-acesso.spec.ts`. Ferramenta: Vitest 4.1.8 com cobertura V8. O relatório HTML e o `coverage-summary.json` estão em `relatorios/v2/us02/`.

## 1. Indicadores v1 × v2

| Indicador | v1 | v2 |
|---|---:|---:|
| Testes gerados | 13 | 34 |
| Passando | 13 | 33 |
| Falhando | 0 | 0 |
| Falhas esperadas (`it.fails`, defeito real) | 0 | 1 |
| Não compilam | 0 | 0 |
| Linhas | 16,12% (89/552) | 11,59% (64/552) |
| Branches | 9,30% (28/301) | **11,29% (34/301)** |
| Critérios de aceitação com teste | 6/8 parciais na v1 | **8/8** |
| Células papel × ação | 0/20 completas na v1 | **19/20** exercitadas |
| Estados-limite de gestores | 0/2 completos na v1 | **2/2** |
| Testes triviais/sem asserção | 0 | 0 |
| Defeitos reais evidenciados | 0 | **1** |

Fontes: saídas isoladas do Vitest e `relatorios/v1/us02/coverage-summary.json` / `relatorios/v2/us02/coverage-summary.json`. O escopo foi mantido nos mesmos 552 itens de linha e 301 branches dos arquivos de autenticação, itens, empréstimos e movimentações selecionados na v1. A fórmula é `covered/total` do campo `total` de cada summary. A meta de branches acima da v1 foi atingida (11,29% contra 9,30%); linhas diminuíram de 16,12% para 11,59% na spec v2 isolada.

## 2. Ligação das mudanças às lacunas

| Lacunas da matriz | Testes v2 que as exercitam |
|---|---|
| Criar estoque: ADMIN permitido; gestor autorizado/não autorizado e requisitante negados | Matriz papel × ação, rota `create`; negações verificam HTTP 403 e que o service não foi chamado |
| Consultar estoques: ADMIN, gestor autorizado/não autorizado e requisitante | Matriz papel × ação, rota `findAll`; os quatro perfis têm resultado testado |
| Editar estoque: gestor autorizado, gestor sem vínculo e requisitante | CT07 está como `it.fails` (HTTP 200 esperado, 403 observado); CT10 e CT12 verificam a negação ao USER |
| Gerenciar gestores | `addGestor`, `removeGestor` e `listGestores` para ADMIN, GESTOR e REQUISITANTE; CT04 confere também o metadata `Roles` |
| Movimentar item e estado de autorização | CT03 (ADMIN negado), CT08 (gestor autorizado), CT09 (gestor de outro estoque) e CT13/PE02 (estoque sem gestor, todos negados) |
| CA06 e CA08 | Serviços de itens negam criação/edição ao requisitante com HTTP 403 e sem gravação/alteração |

Foram exercitadas 19 das 20 células papel × ação, além de PE01 (um gestor autorizado) e PE02 (zero gestores), totalizando 21/22 partições. A única célula não escolhida é ADMIN × editar estoque: a premissa “ADMIN não edita estoque” continua pendente conforme decisão do usuário; não foi inventado um oráculo. PE01 e PE02 foram testados com 1 e 0 gestores, respectivamente.

## 3. Defeito real e limites

CT07 espera que o gestor autorizado edite o próprio estoque com HTTP 200, mas a rota retorna 403 porque `update` exige `@Roles(AccessRole.ADMIN)` em `src/modules/estoques/estoques.controller.ts:35`. O caso está marcado `it.fails` sem alterar a expectativa nem `src/`. É a mesma causa observada em CT-01-09 da US01, não um segundo defeito independente.

Os testes modelam GESTOR/REQUISITANTE com `AccessRole.USER`; o estado de autorização por estoque é representado separadamente no serviço de movimentação. As permissões das rotas de estoque são unitárias, com service simulado; CT04 verifica delegação/metadata, não persistência de vínculo em banco real.

A execução da suíte completa `npm run test:v2` terminou com 503 passando, 14 falhas esperadas, 1 todo e 1 falha em `tests/v2/us04-emprestimos.spec.ts:2380` (`result.meta` indefinido). Esse arquivo não foi modificado nesta tarefa; se a falha já existia antes da branch, fica **a confirmar**.

## 4. Meta da issue

- CAs com teste: 8/8.
- Partições: 21/22 exercitadas; 1 célula papel × ação fica pendente pela premissa do ADMIN.
- Limites: 2/2.
- Branches: 11,29%, acima dos 9,30% da v1.
- HTML V8: `relatorios/v2/us02/index.html`.
