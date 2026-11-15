# Medição e Análise Crítica da Suíte v1 (LLM) — US06 (Alerta de Reposição)

Responsável: Mateus · Issue: S3B-09 (#68) · Suíte: `controle-estoque-emprestimos-back/tests/v1-llm/us06-alerta.spec.ts`.

Execução: executado por Costa2208 (Mateus) a pedido de ars10cin (Artur).

```text
cd controle-estoque-emprestimos-back
npx vitest run tests/v1-llm/us06-alerta.spec.ts --config vitest.llm.config.ts
```

Cobertura V8 já registrada em `docs/testes/relatorios/v1/us06/coverage-summary.json`; relatório HTML: `docs/testes/relatorios/v1/us06/index.html`. Escopo do cálculo: os arquivos de `src/modules/itens/` e `src/modules/movimentacoes/` listados no summary (o total do relatório).

## 1. Tabela de Indicadores da Suíte v1

| Indicador | Resultado v1 | Observações e evidências |
| :--- | :--- | :--- |
| **Testes gerados** | **7** | Saída do Vitest: `Tests 7 passed (7)`; 7 declarações `it`, sem expansões `it.each`. |
| **Testes passando** | **7 (100%)** | Execução isolada do spec, Vitest v4.1.8. |
| **Testes falhando** | **0 (0%)** | Saída do Vitest. |
| **Testes que não compilam** | **0 (0%)** | Arquivo carregado integralmente; nenhum marcador `NAO-COMPILA`. |
| **Cobertura de linhas** | **15,38% (24/156)** | `coverage-summary.json`, total do relatório: itens + movimentações. |
| **Cobertura de branches** | **11,34% (11/97)** | Mesmo total e arquivos da cobertura de linhas. |
| **Requisitos (CAs) cobertos** | **66,67% (4/6)** | CA-01, CA-02 e CA-03 têm teste; CA-06 tem cobertura parcial dos campos; CA-04 e CA-05 não têm teste relacionado. |
| **Partições de equivalência cobertas** | **29,17% (7/24 Sim)** | Mais 3 `Parcial` (10/24 = 41,67% incluindo parciais) e 14 `Não`; classificação por partição na matriz. |
| **Valores-limite cobertos** | **25,00% (1/4 fronteiras completas)** | LM-01 completa; 4/8 valores individuais (50%) incluindo um lado de LM-02 e um de LM-03. LM-04 não coberta. |
| **Testes sem asserção ou triviais** | **0** | As 7 execuções têm `expect`; não há `toBeDefined`, `toBeTruthy`, `expect(true)` ou `not.toThrow` isolado. |
| **Defeitos reais identificados** | **0** | Não houve falha de teste investigada; as 7 execuções passaram. |
| **Relatório HTML** | **Presente e consistente** | `relatorios/v1/us06/index.html` e `coverage-summary.json` existem; o HTML mostra 15,38% de linhas e 11,34% de branches, iguais ao summary. |

Fórmulas: requisitos com teste relacionado / total de CAs = 4/6; partições completas (`Sim`) = 7/24; fronteiras completas = 1/4. Os totais (6 CAs, 24 partições, 4 fronteiras e 23 CTs) vêm da seção 7 de `matriz-rastreabilidade-us6.md`. `Sim*` indica execução com Prisma simulado; `Parcial` não entra no numerador de cobertura completa.

### Partições: classificação por linha da matriz

- **Sim/Sim\*** — PNM-01, PNM-02, PSM-01, PSM-02, PSM-03, PES-01 e PES-03. Evidências: mínimo nulo (`us06-alerta.spec.ts:30`), igualdade (`:37`), abaixo (`:44`), acima (`:51`) e item/estoque inexistente (`:24`, `:58`).
- **Parcial** — PTI-01 (fixtures não identificam explicitamente o tipo CONSUMO; `:37`, `:64`), PAL-02 (um item é marcado como alerta, mas a resposta também inclui o item sem alerta; `:64`) e PAL-03 (o teste lista 2 itens e somente 1 está em alerta; `:64`).
- **Não** — PNM-03, PSM-04, PTI-02, PEV-01 a PEV-04, PPF-01 a PPF-04, PES-02, PAL-01 e PAL-04.

### Valores-limite

- **LM-01 — Sim:** saldo 5 com mínimo 5 e saldo 6 com mínimo 5 (`us06-alerta.spec.ts:37`, `:51`).
- **LM-02 — Parcial:** nível mínimo ausente não gera alerta (`:30`); mínimo 0 não é testado.
- **LM-03 — Parcial:** o cálculo por item (`:64`) marca um de dois itens; não verifica lista vazia e filtrada com exatamente um alerta.
- **LM-04 — Não:** não há entrada/reposição que faça o alerta desaparecer ou permanecer.

## 2. Análise Crítica (Etapa 4)

### 4a. O que a LLM perdeu, inventou e acertou a mais

**Lacunas frente à matriz:** os 7 testes se concentram no cálculo do saldo e da flag de alerta; nenhum testa perfil, vínculo com estoque, reposição, mudança do saldo após entrada/saída ou múltiplos estoques. Assim, CA-04 e CA-05 não têm teste, e os CTs 06-08 a 06-13 e 06-18 a 06-22 permanecem `Não`. O teste `calcula alerta para cada item do estoque` (`us06-alerta.spec.ts:64`) usa só dois itens, um abaixo e um acima do mínimo.

**O que foi além da matriz:** `informa item inexistente` (`us06-alerta.spec.ts:24`) e `informa estoque inexistente` (`:58`) verificam `NotFoundException`, embora os critérios não fixem essa resposta. O cálculo individual (`:64`) também verifica um item acima do mínimo junto ao item alertado, algo útil mas não equivalente aos CTs de lista vazia ou de vários alertas.

**Limitação do prompt, separada de falha da LLM:** a v1 recebeu apenas um `CA1`, paráfrase da story, enquanto a matriz de US06 contém 6 CAs e 24 partições. Os testes comentam `CA1` (por exemplo, `us06-alerta.spec.ts:22`); ausência de autorização, reposição e conteúdo completo não deve ser atribuída à LLM como falha frente a requisitos que não estavam separados no prompt.

### 4b. Como o texto dos critérios de aceitação e da matriz influenciou falhas e lacunas

CA-02 da matriz diz que o alerta aparece quando o saldo "atinge" o mínimo; a premissa PR-01 interpreta isso como saldo menor ou igual. A suíte verifica igualdade (`us06-alerta.spec.ts:37`) e saldo abaixo (`:44`), além de saldo acima (`:51`), mas não testa zero com mínimo positivo nem os eventos de reposição da PR-04. O texto da story/prompt, com um único `CA1`, não especificava os perfis e eventos da matriz; essa limitação explica separadamente por que a suíte não distingue PPF-01 a PPF-04 e PEV-01 a PEV-04. A cobertura de partições é 7/24 completa, com 3 parciais e 14 sem teste.

### 4c. Trecho com linha coberta e branch não coberto (Linhas vs. Branches)

Em `src/modules/movimentacoes/movimentacoes.service.ts:48`, o reducer executa `g._sum.quantidade ?? 0` ao calcular saldos. Os mocks fornecem quantidade definida, então a linha é executada, mas o relatório HTML marca o branch que usa `0` como não coberto (`cbranch-no`). Isso ilustra a diferença entre 24/156 linhas cobertas (15,38%) e 11/97 branches (11,34%).

### 4d. Oráculos (comportamento assumido do código, defeitos e asserções triviais)

Não há teste sem asserção nem asserção trivial. Os testes usam `toMatchObject` para verificar saldo, nível mínimo e flag, mas os fixtures não modelam tipo ou perfil; portanto, eles não demonstram o comportamento de autorização nem todos os campos da apresentação do alerta (CT-06-14, parcial). A regra `saldo <= nivelMinimo` (`movimentacoes.service.ts:218`) coincide com a premissa PR-01; a suíte não permite concluir se perfis ou efeitos de reposição estão corretos. Nenhuma falha revelou defeito real; defeitos reais: **0**.

Preparado com apoio do Codex; números reproduzíveis pelos comandos acima; confirmação humana pendente

**Confirmado por:** ______ em __/__
