# Medição e análise crítica da suíte v2 — US01 (Gestão Multiestoque)

Issue S3B-10 (#69). Suíte: `controle-estoque-emprestimos-back/tests/v2/us01-estoques.spec.ts`. Ferramenta: Vitest 4.1.8 com cobertura V8. O relatório HTML e o `coverage-summary.json` estão em `relatorios/v2/us01/`.

## 1. Indicadores v1 × v2

| Indicador | v1 | v2 |
|---|---:|---:|
| Testes gerados | 24 | 45 |
| Passando | 24 | 44 |
| Falhando | 0 | 0 |
| Falhas esperadas (`it.fails`, defeito real) | 0 | 1 |
| Não compilam | 0 | 0 |
| Linhas | 60,33% (73/121) | **63,63% (77/121)** |
| Branches | 62,68% (42/67) | **67,16% (45/67)** |
| Critérios de aceitação com teste | 6/8 na v1 | **8/8** |
| Partições da matriz com teste | 15/31 Sim na v1 | **31/31 exercitadas** |
| Fronteiras com os dois lados testados | 1/4 na v1 | **4/4** |
| Testes triviais/sem asserção | 0 | 0 |
| Defeitos reais evidenciados | 0 | **1** |

Fontes: saídas isoladas do Vitest e `relatorios/v1/us01/coverage-summary.json` / `relatorios/v2/us01/coverage-summary.json`. O escopo de cobertura foi mantido nos mesmos 8 arquivos de `estoques` e `movimentacoes`; os percentuais usam `covered/total` do campo `total` de cada summary. A meta de branches acima da v1 foi atingida: 67,16% contra 62,68%.

## 2. Ligação das mudanças às lacunas

| Lacunas da matriz | Testes v2 que as exercitam |
|---|---|
| CT-01-01 a CT-01-08: criação, validação do nome, perfil e estoques independentes | `cria e lista o mesmo estoque ativo`; `rejeita cadastro sem nome`; `rejeita nome vazio`; `aceita estoque com nome de um caractere`; `recusa nome já cadastrado`; `nega criação ao requisitante`; `cria dois estoques distintos sem compartilhar identidade` |
| CT-01-09 a CT-01-12: edição, estoque inexistente e permissões | `atualiza estoque existente`; `retorna não encontrado para estoque ausente`; `permite ao gestor autorizado editar o próprio estoque` (`it.fails`); testes de negação para gestor sem vínculo e requisitante |
| CT-01-13 a CT-01-29: entradas/saídas, tipos, quantidades, item/estoque e perfis | Testes identificados por CT-01-13 a CT-01-29 na spec, incluindo quantidades 0, 1, negativa, fracionária e ausente, saída acima/igual/abaixo do saldo, usuário sem vínculo e ADMIN |
| CT-01-30 a CT-01-37: saldo agregado, isolamento e histórico | Testes de consulta agregada, dois estoques isolados, estoque vazio/inexistente, histórico com 0/1/vários movimentos e movimento recusado |

As 31 partições e 4 fronteiras foram exercitadas com Prisma simulado (`Sim*` na matriz). A fronteira LM-01 testa 0 e 1 unidade; LM-02 testa saída acima e igual ao saldo; LM-03 testa nome vazio e `"A"`; LM-04 testa histórico vazio e com uma movimentação.

## 3. Defeito real e limites

O caso CT-01-09 espera HTTP 200 para o gestor autorizado, mas recebe 403. A rota `update` exige `@Roles(AccessRole.ADMIN)` em `src/modules/estoques/estoques.controller.ts:35`. O teste permanece como `it.fails`, com a asserção de requisito intacta; não houve alteração em `src/`. A verificação direta do service confirma atualização do nome, mas não cobre a descrição no mesmo cenário.

A execução da suíte completa `npm run test:v2` terminou com 503 passando, 14 falhas esperadas, 1 todo e 1 falha em `tests/v2/us04-emprestimos.spec.ts:2380` (`result.meta` indefinido). Esse arquivo não foi modificado nesta tarefa; se a falha já existia antes da branch, fica **a confirmar**.

## 4. Meta da issue

- CAs com teste: 8/8.
- Partições exercitadas: 31/31; CT-01-09 documenta a divergência real entre requisito e autorização implementada.
- Fronteiras: 4/4.
- Branches: 67,16%, acima dos 62,68% da v1.
- HTML V8: `relatorios/v2/us01/index.html`.
