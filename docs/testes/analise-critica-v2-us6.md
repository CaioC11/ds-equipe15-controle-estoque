# Medição e análise crítica da suíte v2 — US06 (Alerta de Reposição)

Issue S3B-10 (#69). Execução: Costa2208 (Mateus), a pedido de ars10cin (Artur). Suíte: `controle-estoque-emprestimos-back/tests/v2/us06-alerta.spec.ts`. Ferramenta: Vitest 4.1.8 com cobertura V8. O relatório HTML e o `coverage-summary.json` estão em `relatorios/v2/us06/`.

## 1. Indicadores v1 × v2

| Indicador | v1 | v2 |
|---|---:|---:|
| Testes gerados | 7 | 25 |
| Passando | 7 | 19 |
| Falhando | 0 | 0 |
| Falhas esperadas (`it.fails`, defeito real) | 0 | 6 |
| Não compilam | 0 | 0 |
| Linhas | 15,38% (24/156) | **30,76% (48/156)** |
| Branches | 11,34% (11/97) | **26,80% (26/97)** |
| Critérios de aceitação com teste | 2/6 na v1 | **6/6** |
| Partições da matriz com teste | 7/24 completas na v1 | **24/24 exercitadas** |
| Fronteiras com os dois lados testados | 0/4 na v1 | **4/4** |
| Testes triviais/sem asserção | 0 | 0 |
| Defeitos reais evidenciados | 0 | **3 grupos** |

Fontes: saídas isoladas do Vitest e `relatorios/v1/us06/coverage-summary.json` / `relatorios/v2/us06/coverage-summary.json`. O escopo foi mantido nos mesmos arquivos de `itens` e `movimentacoes` (156 linhas e 97 branches); os percentuais são `covered/total` do campo `total`. A meta de branches acima da v1 foi atingida: 26,80% contra 11,34%.

## 2. Ligação das mudanças às lacunas

| Lacunas da matriz | Testes v2 que as exercitam |
|---|---|
| CT-06-01 a CT-06-07: saldo igual, acima, abaixo, zero, mínimo ausente e mínimo zero | Testes de igualdade/maior/menor, saldo zero com mínimo positivo, nível nulo com saldo zero e mínimo zero com saldo 0/1 |
| CT-06-08 a CT-06-12: evento no saldo e reposição | Testes de saída ao mínimo, entradas acima/igual/abaixo do mínimo e saída sem saldo, verificando saldo/ledger |
| CT-06-13 e CT-06-14: tipo e conteúdo | Patrimonial no limite (falha esperada: alerta indevido) e conteúdo do alerta com item, nome, saldo, estoque e mínimo |
| CT-06-15 a CT-06-17: zero, um e vários alertas | Três testes `it.fails` verificam lista vazia e filtragem; a implementação devolve também itens sem alerta |
| CT-06-18 a CT-06-22: perfil/estoque | Gestor de um estoque, gestor com dois estoques, gestor não autorizado, requisitante e ADMIN; CT-06-20 e CT-06-21 esperam 403 e estão como falhas esperadas |
| CT-06-23 e branch de soma nula | Estoque inexistente retorna not found; o teste adicional ligado a CT-06-05 cobre `_sum.quantidade === null` e o fallback `?? 0` em `movimentacoes.service.ts:48` |

As 24 partições e as 4 fronteiras foram exercitadas. LM-01 testa saldo mínimo + 1 e saldo igual ao mínimo; LM-02 testa nível mínimo ausente e zero com saldo zero; LM-03 testa lista com zero e um alerta; LM-04 testa reposição que leva o saldo acima do mínimo e exatamente ao mínimo. Os casos com `it.fails` exercitam o oráculo da matriz, mas registram divergências reais do código, não comportamento aprovado.

## 3. Defeitos reais e limites

1. **Tipo patrimonial (CT-06-13):** o requisito/matriz espera nenhum alerta para item patrimonial, mas `consultarSaldoEstoque` inclui o item com saldo 1 e mínimo 1.
2. **Lista de alertas (CT-06-15 a CT-06-17):** a consulta retorna todos os itens e não filtra pelos itens com `abaixoDoMinimo`; a lista vazia, a lista de um alerta e a de três alertas falham.
3. **Autorização (CT-06-20 e CT-06-21):** `MovimentacoesController.consultarSaldoEstoque` (`movimentacoes.controller.ts:37-38`) não recebe o usuário e encaminha apenas `estoqueId`; o serviço também não recebe identidade. Gestor de outro estoque e requisitante obtêm dados em vez de HTTP 403.

Esses casos permanecem como `it.fails`, com as asserções de requisito intactas. Nenhuma alteração foi feita em `src/`. Os testes de Prisma usam um ledger simulado (`Sim*`).

A execução da suíte completa `npm run test:v2` terminou com 503 passando, 14 falhas esperadas, 1 todo e 1 falha em `tests/v2/us04-emprestimos.spec.ts:2380` (`result.meta` indefinido). Esse arquivo não foi modificado nesta tarefa; se a falha já existia antes da branch, fica **a confirmar**.

## 4. Meta da issue

- CAs com teste: 6/6.
- Partições exercitadas: 24/24; as falhas esperadas mostram onde a implementação diverge.
- Limites: 4/4.
- Branches: 26,80%, acima dos 11,34% da v1.
- HTML V8: `relatorios/v2/us06/index.html`.
