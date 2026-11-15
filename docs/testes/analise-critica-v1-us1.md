# Medição e Análise Crítica da Suíte v1 (LLM) — US01 (Gestão Multiestoque)

Responsável: Mateus · Issue: S3B-09 (#68) · Suíte: `controle-estoque-emprestimos-back/tests/v1-llm/us01-estoques.spec.ts`.

Execução:

```text
cd controle-estoque-emprestimos-back
npx vitest run tests/v1-llm/us01-estoques.spec.ts --config vitest.llm.config.ts
```

Cobertura V8 já registrada em `docs/testes/relatorios/v1/us01/coverage-summary.json`; relatório HTML: `docs/testes/relatorios/v1/us01/index.html`. Escopo do cálculo: os arquivos de `src/modules/estoques/` e `src/modules/movimentacoes/` listados no summary (8 arquivos; o total do relatório).

## 1. Tabela de Indicadores da Suíte v1

| Indicador | Resultado v1 | Observações e evidências |
| :--- | :--- | :--- |
| **Testes gerados** | **24** | Saída do Vitest: `Tests 24 passed (24)`. O spec tem 20 declarações `it`/`it.each`; os três `it.each` expandem quatro casos adicionais. |
| **Testes passando** | **24 (100%)** | Execução isolada do spec, Vitest v4.1.8. |
| **Testes falhando** | **0 (0%)** | Saída do Vitest. |
| **Testes que não compilam** | **0 (0%)** | Arquivo carregado integralmente; nenhum marcador `NAO-COMPILA`. |
| **Cobertura de linhas** | **60,33% (73/121)** | `coverage-summary.json`, total do relatório: estoques + movimentações. |
| **Cobertura de branches** | **62,68% (42/67)** | Mesmo total e arquivos da cobertura de linhas. |
| **Requisitos (CAs) cobertos** | **75,00% (6/8)** | CAs com algum teste relacionado, inclusive parcial: CA-01, CA-03, CA-04, CA-05, CA-06 e CA-08. CA-02 e CA-07 não têm teste correspondente. |
| **Partições de equivalência cobertas** | **48,39% (15/31 Sim)** | Mais 3 `Parcial` (18/31 = 58,06% incluindo parciais) e 13 `Não`; classificação por partição na matriz. |
| **Valores-limite cobertos** | **25,00% (1/4 fronteiras completas)** | LM-01 está coberta nos dois lados. Há 4/8 valores individuais (50%): um lado de LM-02 e um de LM-03; LM-04 não coberta. |
| **Testes sem asserção ou triviais** | **0** | As 24 execuções têm `expect`; não há `toBeDefined`, `toBeTruthy`, `expect(true)` ou `not.toThrow` isolado. |
| **Defeitos reais identificados** | **0** | Não houve falha de teste investigada; as 24 execuções passaram. |
| **Relatório HTML** | **Presente e consistente** | `relatorios/v1/us01/index.html` e `coverage-summary.json` existem; o HTML mostra 60,33% de linhas e 62,68% de branches, iguais ao summary. |

Fórmulas de rastreabilidade: requisitos = CAs com teste relacionado / total de CAs = 6/8; partições completas (`Sim`) = 15/31; fronteiras completas = 1/4. Os totais (8 CAs, 31 partições, 4 fronteiras e 37 CTs) vêm da seção 7 de `matriz-rastreabilidade-us1.md`. `Sim*` indica execução com banco/Prisma simulado; `Parcial` não entra no numerador de cobertura completa.

### Partições: classificação por linha da matriz

- **Sim/Sim\*** — PNE-01, PNE-03, PNE-04, PES-01, PES-02, PPM-01, PPM-04, PTP-01, PTP-02, PQT-01, PQT-02, PQT-03, PQT-04, PIT-01 e PSD-03. Evidências incluem `normaliza o nome` (`us01-estoques.spec.ts:19`), `rejeita nome vazio` (`:26`), `recusa nome já cadastrado` (`:66`), `recusa registro por ADMIN` (`:227`), `rejeita quantidade inválida` (`:215`) e `recusa saída maior que o saldo disponível` (`:253`).
- **Parcial** — PPM-02 (`recusa usuário sem vínculo de gestor`, `:238`, sem representar expressamente um gestor vinculado a outro estoque); PIT-02 (item ausente é testado em consulta, `:208`, não em movimentação); PCS-01 (há cálculo de saldo por item, `:149`, não consulta de saldo por estoque).
- **Não** — PNE-02, PPC-01, PPC-02, PPM-03, PTP-03, PTP-04, PQT-05, PIT-03, PSD-01, PSD-02, PCS-02, PHI-01 e PHI-02.

### Valores-limite

- **LM-01 — Sim:** quantidade 0 recusada (`rejeita quantidade inválida`, `us01-estoques.spec.ts:215`) e quantidade 1 aceita (`registra entrada e informa saldo após a operação`, `:270`).
- **LM-02 — Parcial:** saída maior que o saldo é recusada (`:253`); não há saída igual ao saldo.
- **LM-03 — Parcial:** nome vazio/espaços recusados (`:26`); não há cadastro com nome `"A"`.
- **LM-04 — Não:** nenhum teste de histórico com zero ou uma movimentação.

## 2. Análise Crítica (Etapa 4)

### 4a. O que a LLM perdeu, inventou e acertou a mais

**Lacunas frente à matriz:** só há testes de schemas/estoque, saldo por item e registro de entrada/saída; nenhum exercita histórico (PHI-01/02; CT-01-34 a CT-01-37), saldo agregado por estoque (PCS-01/02; CT-01-30 a CT-01-33), isolamento de dois estoques (CT-01-08/25/31) ou operação válida de saída (CT-01-14/15). Isso aparece nos 15/31 `Sim`, 3 `Parcial` e 13 `Não` das partições.

**O que foi além da matriz:** `desativa estoque em vez de apagar o registro` (`us01-estoques.spec.ts:115`) testa desativação, que a própria matriz lista como não coberta por falta de requisito (PR-09). Os testes de alerta por nível mínimo (`:160`, `:175`, `:193`) também excedem o escopo de US01 e se aproximam da US06.

**Limitação do prompt, separada de falha da LLM:** o prompt da v1 forneceu um único `CA1`, paráfrase da story, enquanto a matriz contém 8 CAs próprios. A ausência de histórico, saldo por estoque e cenários por perfil não deve ser atribuída à LLM como se esses critérios tivessem sido fornecidos. A suíte e seus comentários identificam repetidamente apenas `CA1` (por exemplo, `us01-estoques.spec.ts:19`).

### 4b. Como o texto dos critérios de aceitação e da matriz influenciou falhas e lacunas

A story ampla ("cadastrar e gerenciar meu próprio estoque") e o único `CA1` do prompt levaram a testes de implementação local, como criar estoque (`us01-estoques.spec.ts:54`) e normalizar nomes (`:19`), mas não aos 37 cenários discriminados pela matriz. Dos 37 CTs, 9 são `Sim/Sim*`, 4 `Parcial` e 24 `Não`, conforme as células da coluna v1. A matriz também marca como premissas comportamentos como nome único (PR-02) e bloqueio por saldo insuficiente (PR-05); portanto, a validação de nome duplicado (`:66`) e a recusa de saída excessiva (`:253`) não são critérios explícitos do prompt. As lacunas de CA-02 e CA-07 permanecem separadas da limitação do prompt: não houve teste de independência entre estoques nem de histórico.

### 4c. Trecho com linha coberta e branch não coberto (Linhas vs. Branches)

`estoques.service.ts:35` executa `const where = verInativos ? {} : { ativo: true };` no teste de listagem (`us01-estoques.spec.ts:74`), mas o relatório HTML marca como não coberto o branch `verInativos === true`. Assim, a linha entra nos 73/121 cobertos, embora um dos lados da decisão não entre nos 42/67 branches cobertos. A diferença é observável no código-fonte HTML da cobertura V8.

### 4d. Oráculos (comportamento assumido do código, defeitos e asserções triviais)

Não há asserções triviais ou testes sem `expect`. Há, porém, um oráculo pouco específico em `us01-estoques.spec.ts:27`: `expect(() => CreateEstoqueSchema.parse({ nome })).toThrow()` confirma a rejeição, mas não fixa a classe/erro esperado. As decisões de nome único e saldo insuficiente vêm de premissas da matriz, não do texto do prompt. Os testes usam Prisma simulado (`Sim*`) e não demonstram isolamento nem persistência em banco real. Não foi identificada falha que evidencie defeito real; defeitos reais: **0**.

Preparado com apoio do Codex; números reproduzíveis pelos comandos acima; confirmação humana pendente

**Confirmado por:** ______ em __/__
