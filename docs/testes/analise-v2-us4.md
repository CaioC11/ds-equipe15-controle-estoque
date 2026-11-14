# Medição da Suíte v2 — US04 (Registro de Empréstimo e Devolução)

Suíte: `tests/v2/us04-emprestimos.spec.ts`. Execução revisada de 14/11/2026, com Vitest v4.1.8 e cobertura v8 (`vitest.llm.config.ts`, os mesmos da v1). Relatório HTML e `coverage-summary.json`: `docs/testes/relatorios/v2/us04/`. Matriz: `docs/testes/matriz-rastreabilidade-us4.md` (coluna "Coberto pela v2?" e seção 9).

Escopo da medição: `emprestimos.controller.ts`, `emprestimos.service.ts` e `dto/create-emprestimo.dto.ts`, como na v1. O DTO novo `registrar-justificativa-permanencia.dto.ts` ficou 100% coberto e não entra nas somas abaixo.

## 1. Indicadores v1 × v2

| Indicador | v1 (execução no código atual; avaliação funcional histórica) | v2 | Observação |
| :--- | :--- | :--- | :--- |
| Testes gerados | 138 | 209 | 71 testes a mais; inclui 14 pendências explícitas |
| Passando | 134 (97,10%) | 195 (93,30%) | |
| Falhando | 2 (1,45%) | 0 | As 2 falhas restantes da v1 são de mock (linha 470); corrigidas na v2. O CA-09 já passa com a [S3-20 (#100)](https://github.com/CaioC11/ds-equipe15-controle-estoque/issues/100) implementada |
| Não compilam | 0 | 0 | |
| Pendentes (`it.todo`) | 2 | 14 | CT-04-05, 09, 10, 38 e 39 ([S3-21 (#101)](https://github.com/CaioC11/ds-equipe15-controle-estoque/issues/101)) e CT-04-28 (premissa PR-04), mais CT-04-47 a 54 (permissões das consultas S3-21) |
| Linhas | 90,55% (182/201) | **100% (201/201)** | Service 178/178, controller 14/14, DTO 9/9 |
| Branches | 86,24% (94/109) | **98,17% (107/109)** | Service 100/102, DTO 7/7 |
| Statements | 89,86% (186/207) | 99,03% (205/207) | |
| Funções | 88,10% (37/42) | 95,24% (40/42) | Service 25/27 |
| Casos da matriz cobertos (CTs) | 27/46 (58,70%) | 40/46 (86,96%) | 2 `Parcial` e 4 `Não` |
| Partições cobertas | 30/43 (69,77%) | 39/43 (90,70%) | Faltam PRO-04, PHR-01 e PHR-02 (`it.todo`) e PRO-01 `Parcial` |
| Valores-limite cobertos | 8/10 (80,00%) | 9/10 (90,00%) | Falta o lado "prazo = hoje" da LM-02 |
| Fronteiras com os dois lados | 3/5 (60,00%) | 4/5 (80,00%) | |
| Critérios (CAs) com ao menos um teste | 10/11 (90,91%) | 10/11 (90,91%) | Falta o CA-10 |
| CAs com todos os casos originais em `Sim`/`Sim*` | 3/11 (27,27%) | 7/11 (63,64%) | |
| Testes sem asserção | 0 | 0 | |
| Testes triviais | 4 | 1 | Sobra "aceita quando o prazo venceu 1 ms antes de agora" (justificativa), que só confere `resolves` |
| Asserções circulares (status vindo do mock) | 3 | 2 | `confirmarEntrega` e `devolver`, mantidos da v1, ao lado de asserções sobre as chamadas |
| Defeitos reais | Histórico: 1 defeito ([S3-20 (#100)](https://github.com/CaioC11/ds-equipe15-controle-estoque/issues/100)) e 1 lacuna ([S3-21 (#101)](https://github.com/CaioC11/ds-equipe15-controle-estoque/issues/101)) | 0 novos | O defeito da v1 foi corrigido pelo time. A lacuna continua aberta |

A coluna v1 usa o código atual, com cobertura extraída de `relatorios/v1/us04-codigo-atual/coverage-summary.json`, somando apenas os mesmos 3 arquivos da US04. A v2 usa `relatorios/v2/us04/coverage-summary.json`: ganho de **11,93 pontos percentuais em branches** e **9,45 em linhas**. Os percentuais são calculados pelas contagens agregadas e arredondados a duas casas. O total global do HTML inclui outros módulos da configuração e não representa esse recorte. As contagens funcionais da v1 continuam sendo as da avaliação histórica da matriz; não foram reclassificadas pela nova execução.

Os indicadores de CTs acima usam os **46 casos originais**, para preservar a comparação. Os **8 CTs complementares (CT-04-47 a 54)** de permissão das consultas S3-21 estão pendentes. No conjunto ampliado: **40/54 Sim/Sim* (74,07%), 2 Parcial e 12 Não**. Pendência não equivale a teste aprovado.

## 2. Meta mínima da v2

| Critério da task | Situação |
| :--- | :--- |
| Testes em `tests/v2/`, cada mudança ligada a uma lacuna | Atendido: cada teste novo ou corrigido traz `[v2] Lacuna CT-04-xx` no comentário |
| 100% dos critérios de aceitação | **Não atendido integralmente:** CA-02 (seleção na lista) e CA-10 (histórico) pendentes da [S3-21 (#101)](https://github.com/CaioC11/ds-equipe15-controle-estoque/issues/101) |
| Todas as partições e limites | **Não atendido:** 39/43 partições e 9/10 valores. O que falta depende da [S3-21 (#101)](https://github.com/CaioC11/ds-equipe15-controle-estoque/issues/101) ou da PR-04 |
| Branches acima da v1 | Atendido: 98,17% (107/109) contra 86,24% (94/109), no mesmo código |
| Prompt das lacunas no log e revisão contra o requisito | Prompt e revisão registrados em `llm-log.md`, seção US04 — Suíte v2 e rodada de correções do feedback |
| Mesmas ferramentas e mesmo escopo | Atendido: mesma config e os mesmos 3 arquivos |
| Relatório HTML em `docs/testes/relatorios/v2/` | Atendido: `v2/us04/` |
| Matriz com a coluna "coberto pela v2" | Atendido |
| Suíte v2 completa passando | Execução sem falhas: 195 passando e 14 `it.todo`. A completude funcional segue pendente da S3-21 e da PR-04 |

## 3. Lacunas da v1 e como a v2 as cobriu

| Lacuna da v1 | Casos | O que a v2 faz |
| :--- | :--- | :--- |
| Item patrimonial sem tombamento; responsável ausente | CT-04-02, 04 | Teste de `create` com tombamento nulo e dois testes de schema (ausente e nulo) |
| Item devolvido que volta a ser emprestado | CT-04-21 | O mock só devolve o empréstimo se o filtro do service incluir o status dele |
| Liberação depois do atraso e atraso por responsável | CT-04-34, 35, 36, 37 | Seis partições de empréstimo que não bloqueiam, fluxo bloqueio → devolução → liberação, fluxo bloqueio → justificativa → liberação e outro responsável |
| Bloqueio por atraso ([S3-20 (#100)](https://github.com/CaioC11/ds-equipe15-controle-estoque/issues/100)) | CT-04-33 | Testes de bloqueio por Siape e somente CPF, mensagem (com e sem tombamento, e sem item) e filtro enviado ao Prisma |
| Ação de justificativa de permanência ([S3-20 (#100)](https://github.com/CaioC11/ds-equipe15-controle-estoque/issues/100)) | CT-04-36 | 13 testes do service e 8 do schema |
| Perfis ADMIN, requisitante e gestor de outro estoque | CT-04-40 a 45 | Controller com o service real para registro, devolução e justificativa; 403 sem consulta ao empréstimo nem gravações |
| Fluxo encadeado | CT-04-46 | Registra, anexa o termo, confirma a entrega e devolve, com estado simulado em memória |
| Prazo indefinido (oráculo errado) | CT-04-12 | Confere o dado gravado, sem ler o retorno do mock |
| Testes triviais | CT-04-14 e limite do anexo | Passam a conferir o prazo guardado e a gravação do anexo |
| Branches das linhas 196, 265 e 273 da v1 | (sem CT) | Testes de 404 em `obterPdf` e `obterPdfAssinado`, e `obterPdfAssinado` com o gestor |

## 4. O que ficou de fora

* **[S3-21 (#101)](https://github.com/CaioC11/ds-equipe15-controle-estoque/issues/101) (consultas de responsáveis e histórico):** CT-04-05, 09, 10, 38 e 39 seguem como `it.todo`, porque não existe método para chamar.
* **PR-04 (atraso por dia):** o CT-04-28 segue como `it.todo`. O código compara o instante (`prazoDevolucao < agora`), e a matriz espera que no dia do prazo ainda não haja atraso. Falta a equipe decidir qual vale.
* **Linha 40 do service (`termo: termo ? ... : null`):** nenhum teste devolve um empréstimo sem termo por `comFlagTermo`. Um teste de `devolver` com `termo: null` fecha esse branch.
* **Linha 539 do service (`emAtraso.prazoDevolucao ? ... : ''`):** o ramo do prazo nulo não é alcançável pela consulta, que usa `lt` e ignora `null`. É código defensivo.
* **Estado simulado:** o fluxo completo e as liberações usam Prisma simulado. Cobrir o CT-04-35 e o CT-04-46 com banco real exigiria teste de integração, fora do escopo desta suíte.


## 5. Permissões das consultas pendentes da S3-21

CT-04-47 a 50 cobrem a lista de responsáveis (CA-02), e CT-04-51 a 54 o histórico (CA-10): gestor do estoque e ADMIN autorizados; requisitante e gestor de outro estoque recusados com 403, sem expor dados. Os oito casos estão como `it.todo`, pois não há API implementada. A expectativa segue `docs/permissoes.md` (ADMIN consulta, gestor consulta seu estoque, requisitante não consulta empréstimos).
