# Medição da Suíte v2 — US04 (Registro de Empréstimo e Devolução)

Suíte: `tests/v2/us04-emprestimos.spec.ts`. Execução de 14/11/2026, 10:55, com Vitest v4.1.8 e cobertura v8 (`vitest.llm.config.ts`, os mesmos da v1). Relatório HTML e `coverage-summary.json`: `docs/testes/relatorios/v2/us04/`. Matriz: `docs/testes/matriz-rastreabilidade-us4.md` (coluna "Coberto pela v2?" e seção 9).

Escopo da medição: `emprestimos.controller.ts`, `emprestimos.service.ts` e `dto/create-emprestimo.dto.ts`, como na v1. O DTO novo `registrar-justificativa-permanencia.dto.ts` ficou 100% coberto e não entra nas somas abaixo.

## 1. Indicadores v1 × v2

| Indicador | v1 | v2 | Observação |
| :--- | :--- | :--- | :--- |
| Testes gerados | 138 | 200 | 62 testes a mais, todos ligados a uma lacuna da matriz |
| Passando | 132 (95,65%) | 194 (97,00%) | |
| Falhando | 4 (2,90%) | 0 | As 2 falhas de oráculo foram corrigidas, e as 2 do CA-09 passaram a passar com a Issue 1 implementada |
| Não compilam | 0 | 0 | |
| Pendentes (`it.todo`) | 2 | 6 | CT-04-05, 09, 10, 38 e 39 (Issue 2) e CT-04-28 (premissa PR-04) |
| Linhas | 98,29% (172/175) | **100% (201/201)** | Service 178/178, controller 14/14, DTO 9/9 |
| Branches | 95,70% (89/93) | **98,17% (107/109)** | Service 100/102, DTO 7/7 |
| Statements | 97,22% (175/180) | 99,03% (205/207) | |
| Funções | 94,44% (34/36) | 95,24% (40/42) | Service 25/27 |
| Casos da matriz cobertos (CTs) | 27/46 (58,70%) | 40/46 (86,96%) | 2 `Parcial` e 4 `Não` |
| Partições cobertas | 30/43 (69,77%) | 39/43 (90,70%) | Faltam PRO-04, PHR-01 e PHR-02 (`it.todo`) e PRO-01 `Parcial` |
| Valores-limite cobertos | 8/10 (80,00%) | 9/10 (90,00%) | Falta o lado "prazo = hoje" da LM-02 |
| Fronteiras com os dois lados | 3/5 (60,00%) | 4/5 (80,00%) | |
| Critérios (CAs) com ao menos um teste | 10/11 (90,91%) | 10/11 (90,91%) | Falta o CA-10 |
| CAs com todos os casos em `Sim`/`Sim*` | 3/11 (27,27%) | 7/11 (63,64%) | |
| Testes sem asserção | 0 | 0 | |
| Testes triviais | 4 | 1 | Sobra "aceita quando o prazo venceu 1 ms antes de agora" (justificativa), que só confere `resolves` |
| Asserções circulares (status vindo do mock) | 3 | 2 | `confirmarEntrega` e `devolver`, mantidos da v1, ao lado de asserções sobre as chamadas |
| Defeitos reais | 1 defeito (Issue 1) e 1 lacuna (Issue 2) | 0 novos | O defeito da v1 foi corrigido pelo time. A lacuna continua aberta |

Cuidado com a comparação: a v1 foi medida no código anterior à Issue 1, e o service passou de 153 para 178 linhas. Para uma comparação estrita, falta rodar a v1 sobre o código atual (`--coverage.reportsDirectory=../docs/testes/relatorios/v1/us04-codigo-atual`) e trocar a coluna v1 pelos números dessa execução.

## 2. Meta mínima da v2

| Critério da task | Situação |
| :--- | :--- |
| Testes em `tests/v2/`, cada mudança ligada a uma lacuna | Atendido: cada teste novo ou corrigido traz `[v2] Lacuna CT-04-xx` no comentário |
| 100% dos critérios de aceitação | **Não atendido:** 10/11. O CA-10 (histórico do responsável) depende da Issue 2 |
| Todas as partições e limites | **Não atendido:** 39/43 partições e 9/10 valores. O que falta depende da Issue 2 ou da PR-04 |
| Branches acima da v1 | Atendido: 98,17% contra 95,70% (v1 medida no código anterior) |
| Prompt das lacunas no log e revisão contra o requisito | Prompt registrado em `llm-log-v2-us04.md`. A revisão dos testes contra o requisito é do integrante e está marcada como pendente |
| Mesmas ferramentas e mesmo escopo | Atendido: mesma config e os mesmos 3 arquivos |
| Relatório HTML em `docs/testes/relatorios/v2/` | Atendido: `v2/us04/` |
| Matriz com a coluna "coberto pela v2" | Atendido |
| Suíte v2 completa passando | Atendido: 194 passando e 0 falhando. Os 6 `it.todo` são pendentes, e não falhas |

## 3. Lacunas da v1 e como a v2 as cobriu

| Lacuna da v1 | Casos | O que a v2 faz |
| :--- | :--- | :--- |
| Item patrimonial sem tombamento; responsável ausente | CT-04-02, 04 | Teste de `create` com tombamento nulo e dois testes de schema (ausente e nulo) |
| Item devolvido que volta a ser emprestado | CT-04-21 | O mock só devolve o empréstimo se o filtro do service incluir o status dele |
| Liberação depois do atraso e atraso por responsável | CT-04-34, 35, 36, 37 | Seis partições de empréstimo que não bloqueiam, fluxo bloqueio → devolução → liberação, fluxo bloqueio → justificativa → liberação e outro responsável |
| Bloqueio por atraso (Issue 1) | CT-04-33 | Testes de bloqueio, mensagem (com e sem tombamento, e sem item) e filtro enviado ao Prisma |
| Ação de justificativa de permanência (Issue 1) | CT-04-36 | 13 testes do service e 8 do schema |
| Perfis ADMIN, requisitante e gestor de outro estoque | CT-04-40 a 45 | Controller com o service real para registro, devolução e justificativa |
| Fluxo encadeado | CT-04-46 | Registra, anexa o termo, confirma a entrega e devolve, com estado simulado em memória |
| Prazo indefinido (oráculo errado) | CT-04-12 | Confere o dado gravado, sem ler o retorno do mock |
| Testes triviais | CT-04-14 e limite do anexo | Passam a conferir o prazo guardado e a gravação do anexo |
| Branches das linhas 196, 265 e 273 da v1 | (sem CT) | Testes de 404 em `obterPdf` e `obterPdfAssinado`, e `obterPdfAssinado` com o gestor |

## 4. O que ficou de fora

* **Issue 2 (consultas de responsáveis e histórico):** CT-04-05, 09, 10, 38 e 39 seguem como `it.todo`, porque não existe método para chamar.
* **PR-04 (atraso por dia):** o CT-04-28 segue como `it.todo`. O código compara o instante (`prazoDevolucao < agora`), e a matriz espera que no dia do prazo ainda não haja atraso. Falta a equipe decidir qual vale.
* **Linha 40 do service (`termo: termo ? ... : null`):** nenhum teste devolve um empréstimo sem termo por `comFlagTermo`. Um teste de `devolver` com `termo: null` fecha esse branch.
* **Linha 539 do service (`emAtraso.prazoDevolucao ? ... : ''`):** o ramo do prazo nulo não é alcançável pela consulta, que usa `lt` e ignora `null`. É código defensivo.
* **Estado simulado:** o fluxo completo e as liberações usam Prisma simulado. Cobrir o CT-04-35 e o CT-04-46 com banco real exigiria teste de integração, fora do escopo desta suíte.
