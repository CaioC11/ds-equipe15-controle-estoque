# Medição da Suíte v2 — US04 após S3-21

Execução de 14/11/2026. Suíte: `tests/v2/us04-emprestimos.spec.ts`. Vitest 4.1.8, provider v8, `vitest.llm.config.ts`. Relatórios: `relatorios/v2/us04/` e `relatorios/v1/us04-codigo-atual/`. Log: `llm-log.md`, rodada S3-21. Matriz: `matriz-rastreabilidade-us4.md`, seções 6, 9 e 10.

## 1. Indicadores comparáveis

Ambas as suítes foram executadas novamente sobre o código com a S3-21 implementada. O recorte estrutural continua sendo `emprestimos.controller.ts`, `emprestimos.service.ts` e `dto/create-emprestimo.dto.ts`. As contagens funcionais da coluna v1 da matriz permanecem históricas; não são reclassificadas por essa execução.

| Indicador | v1 no código atual | v2 após S3-21 |
|---|---|---|
| Total de testes (inclui todo) | 138 | 217 |
| Passando | 134 (97,10%) | 216 (99,54%) |
| Falhando | 2 (1,45%, mock da linha 470) | 0 |
| Todo | 2 (CA-02 e CA-10, preservados na v1) | 1 (CT-04-28 / PR-04) |
| Não compilam | 0 | 0 |
| Linhas | 83,64% (184/220) | **100% (220/220)** |
| Branches | 81,51% (97/119) | **99,16% (118/119)** |
| Statements | 82,82% (188/227) | 99,12% (225/227) |
| Funções | 77,08% (37/48) | 95,83% (46/48) |

Os denominadores aumentaram em relação à rodada anterior porque a S3-21 acrescentou consultas e seleção por identificador. Os resumos JSON foram regenerados para as duas suítes no mesmo código. Os percentuais acima são as contagens dos três arquivos somadas, arredondadas a duas casas; o total global do HTML inclui outros módulos e não representa esse recorte.

| Indicador funcional | v2 |
|---|---|
| CTs originais (01 a 46) | 45/46 Sim/Sim* (97,83%), 1 Parcial (28), 0 Não |
| CTs complementares de permissão (47 a 54) | 8/8 Sim* |
| Conjunto ampliado | 53/54 Sim/Sim* (98,15%), 1 Parcial |
| Partições | 43/43 (100%) |
| Valores-limite | 9/10 (90%) |
| Fronteiras com dois lados exercitados | 4/5 (80%) |
| CAs com ao menos um teste | 11/11 (100%) |
| CAs com todos os casos originais em Sim/Sim* | 10/11 (90,91%); CA-08 depende de PR-04 |

## 2. S3-21: lacunas agora cobertas

| Casos | Verificação |
|---|---|
| CT-04-05 | Identificador de responsável inexistente: 404, sem empréstimo, movimentação ou PDF |
| CT-04-09 | Cadastro feito no empréstimo aparece na lista com nome e Siape; consulta também inclui cadastro só com CPF |
| CT-04-10 | Seleção por `responsavelId`: não reenvia dados, não duplica nem atualiza cadastro; usa os dados salvos no termo |
| CT-04-38 | Histórico com ativo e devolvido, item, estado e data de devolução; todos os estados são consultáveis |
| CT-04-39 | Cadastro sem empréstimos: histórico vazio, sem erro |
| CT-04-47 a 54 | Gestor do estoque e ADMIN consultam lista e histórico; requisitante e gestor de outro estoque recebem 403 antes da leitura |
| CT-04-10 + 33 | Selecionar o responsável não contorna o bloqueio por atraso da S3-20 |

Também foram exercitados: exclusividade entre cadastro novo e identificador, ausência de autenticação no service (403), estoque e responsável inexistentes (404), paginação e isolamento entre responsáveis/estoques. O histórico respeita o estoque da rota mesmo para ADMIN; o cadastro de responsáveis permanece global, conforme o modelo existente.

No frontend, o modal permite selecionar nome + Siape/CPF ou cadastrar no ato. A seleção envia apenas o identificador. O painel mostra histórico mesmo sem pendências, inclui devoluções, percorre todas as páginas e trata carregamento, vazio, erro/403 e troca de estoque.

## 3. Critérios da task de suíte v2

| Critério | Situação |
|---|---|
| Testes em tests/v2 ligados às lacunas | Atendido; CTs identificados nos comentários |
| 100% dos CAs com ao menos um teste | Atendido (11/11); atendimento integral de todos os CTs ainda depende de PR-04 |
| Todas as partições | Atendido (43/43) |
| Todos os limites | Pendente: CT-04-28 / LM-02 lado hoje, depende da decisão PR-04 |
| Branches acima da v1 no mesmo código | Atendido: 99,16% contra 81,51% |
| Prompt e revisão | Registrados em `llm-log.md` |
| Mesmas ferramentas e escopo | Atendido; mesmos três arquivos, Vitest/v8/config |
| HTML e matriz atualizados | Atendido |
| Suíte v2 sem falhas | 216 passando, 0 falhando; 1 todo explicitamente pendente |

## 4. Limites da evidência

- A v1 não foi modificada: continua com dois erros conhecidos de mock na linha 470 e dois todo, mesmo após implementar a funcionalidade. A v2 é quem comprova os cenários novos.
- As consultas e fluxos do backend são testados com Prisma simulado (`Sim*`), não com banco real. Os testes do frontend simulam a API.
- O único branch remanescente no recorte é o caso defensivo de prazo nulo na mensagem de bloqueio; a consulta por prazo vencido não retorna nulos.
- CA-02 e CA-10 não estão mais pendentes da S3-21. Só o CT-04-28 continua pendente da PR-04; não foi presumida uma decisão da equipe.

## Decisão posterior da PR-04

Foi decidido que o dia inteiro do prazo em `America/Recife` ainda está no prazo. A v2 foi revisada a partir desta regra: os oráculos por instante foram substituídos por fronteiras de dia, CT-04-28 tornou-se executável e o filtro de bloqueio no banco usa o início do dia corrente. A execução conjunta passou com 488 aprovados, 6 falhas esperadas e 5 `todo` (sete arquivos); o build backend passou. Os percentuais estruturais das seções 1–4 continuam históricos até gerar cobertura comparável na revisão atual. A v1 gerada permanece intacta e seus oráculos antigos podem falhar no código novo.

### Indicadores reexecutados no código da PR-04

Mesmo Vitest 4.1.8, V8 e recorte dos três arquivos (`emprestimos.controller.ts`, `emprestimos.service.ts`, `create-emprestimo.dto.ts`), ambos em `us04-pr04-codigo-atual/`:

| Indicador | v1 original no código atual | v2 revista |
|---|---:|---:|
| Execuções | 132 passando, 4 falhando, 2 todo (138) | 217 passando, 0 falhando, 0 todo |
| Linhas | 185/221 (83,71%) | 221/221 (100%) |
| Branches | 93/115 (80,86%) | 114/115 (99,13%) |

A v1 falha em dois mocks antigos e em dois oráculos da comparação por instante. Falhas executam código e entram na cobertura. HTML e JSON: `relatorios/v1/us04-pr04-codigo-atual/` e `relatorios/v2/us04-pr04-codigo-atual/`. Estes indicadores substituem os percentuais anteriores apenas para a comparação da US04 após PR-04; não substituem a medição conjunta das outras stories.
