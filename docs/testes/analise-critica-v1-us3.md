# Medição e Análise Crítica da Suíte v1 (LLM) — US03 (Cadastro e Listagem de Itens)

## 1. Tabela de Indicadores da Suíte v1

| Indicador | Resultado v1 | Observações e Evidências |
| :--- | :--- | :--- |
| **Testes gerados** | **106** | 104 blocos `it` + 1 `it.each` com 3 valores em `tests/v1-llm/us03-itens.spec.ts`. |
| **Testes passando** | **105 (99,06%)** | Todos os testes de `ItensService`, `ItensController` e 57/58 testes dos schemas Zod passaram. |
| **Testes falhando** | **1 (0,94%)** | Linha 95 (`rejeita tipo fora do enum`): falha por **oráculo errado** da LLM, não por bug no código. |
| **Testes que não compilam** | **0 (0%)** | Arquivo compilou e executou integralmente sob Vitest v4.1.8. |
| **Cobertura de linhas** | **100% (60/60)** *(com 1 teste falhando)* | `itens.service.ts` (46/46), `itens.controller.ts` (5/5)[cite: 2, 3], `dto/` (9/9). *Nota: o teste que falha também executa código antes da asserção*. |
| **Cobertura de branches** | **97,36% (37/38)** *(com 1 teste falhando)* | `dto/` (8/8 = 100%), `itens.controller.ts` (100%)[cite: 1, 2, 3], `itens.service.ts` (29/30 = 96,66%)[cite: 3]. Único branch descoberto: linha 14 (`@Injectable()`). |
| **Cobertura de statements / funções** | **100% (60/60) / 100% (14/14)** | Medição restrita aos 4 arquivos de produção da US03[cite: 1, 2]. |
| **Partições de equivalência cobertas** | **85,19% (23/27)** | 23 `Sim` (inclui 2 `Sim*` via mock), 3 `Parcial` (totalizando 96,30% se somadas) e 1 `Não` (`PPF-04`). |
| **Valores-limite cobertos** | **75,00% (3/4 fronteiras)** | 3 fronteiras cobertas nos dois lados (`LM-01`, `LM-02`, `LM-03`) e 6/8 valores individuais cobertos (75,00%). |
| **Requisitos (CAs) cobertos** | **85,71% (6/7 CAs)** | Pelo critério de ao menos um teste (`CA-07` sem cobertura; `CA-03` e `CA-05` com cobertura parcial). |
| **Casos de teste da matriz (CTs)** | **62,16% Sim (23/37)** | 23 `Sim` (5 `Sim*` via mock), 6 `Parcial` (16,22%) e 8 `Não` (21,62%: CTs 13–17, 27, 34 e 37). |
| **Testes sem asserção ou triviais** | **1** | **0** sem asserção (139 `expect` nos testes + 3 no helper `esperarErro`) e **1** trivial (linha 705, apenas `toBeDefined()`)[cite: 1]. |
| **Defeitos reais identificados** | **0** | Nenhuma falha do código de produção em relação aos critérios de aceitação foi revelada pela v1[cite: 1]. |

---

## 2. Análise Crítica (Etapa 4)

### 4a. O que a LLM perdeu, inventou e acertou a mais

* **O que a LLM perdeu (lacunas frente à matriz):**
  * **Critério inteiro descoberto (`CA-07` / `CT-03-14`):** nenhum teste verificou que itens de consumo possuem saldo inicial igual a `1` após o cadastro[cite: 1].
  * **Controle de saldo em consumo (`CA-03` / `CT-03-13`):** embora tenha testado o cadastro de item `CONSUMO` sem tombamento, não verificou o controle por saldo[cite: 1].
  * **Distinção de papéis de permissão (`PPF-03`, `PPF-04`, `CT-03-16`, `CT-03-17`):** a suíte testou apenas a ausência genérica de vínculo de gestor (`userId` indefinido ou `findUnique` retornando `null`), sem cenários explícitos para usuário com papel `REQUISITANTE` ou `ADMIN` sem vínculo no estoque[cite: 1].
  * **Fronteira de listagem e isolamento entre estoques (`LM-04`, `PLI-01`, `PLI-02`, `CT-03-15`, `CT-03-27`):** não houve teste com exatamente `1` item retornado (`LM-04` válido), o teste de listagem vazia (`0` itens) usou asserção trivial (`toBeDefined()`) e não houve verificação de que itens de outro estoque não vazam na listagem[cite: 1].
  * **Edição preservando o próprio tombamento (`CT-03-37`):** nenhum teste cobriu a atualização de um item patrimonial mantendo o mesmo `tombamento` sem disparar falso conflito de unicidade[cite: 1].

* **O que a LLM inventou (oráculos incorretos ou regras sem lastro nos CAs):**
  * **Oráculo errado na validação de enum (linha 95):** no teste `rejeita tipo fora do enum`, a LLM assumiu que enviar `'OUTRO'` dispararia `'Tipo deve ser PATRIMONIAL ou CONSUMO'`[cite: 1]. No Zod, `invalid_type_error` aplica-se apenas quando o tipo primitivo não é string (ex.: número/null), enquanto strings fora do enum geram a mensagem padrão do `z.enum(...)`, fazendo o teste falhar[cite: 1].
  * **Regras internas tratadas como requisitos explícitos:** a suíte congelou decisões de implementação que não constavam nos critérios de aceitação da US03, como a ordem de precedência HTTP (`404` de estoque inexistente antes de `403` de permissão), a recusa explícita de `tombamento` em itens `CONSUMO` (`CA4: rejeita consumo com tombamento informado`) e o bloqueio de cadastro em estoque desativado (`400`)[cite: 1].

* **O que a LLM acertou a mais (cenários válidos não previstos na matriz):**
  * **Conflito de número de série (`P2002` em `numeroSerie`):** o `ItensService` trata duplicidade tanto de `tombamento` quanto de `numeroSerie` (linhas 140–145), e a LLM gerou testes cobrindo a tradução de `P2002` para `numeroSerie` duplicado, embora a matriz só listasse duplicidade para tombamento (`PTB-04` / `LM-03`).
  * **Paginação e campo opcional `descricao`:** a LLM criou 4 testes para parâmetros de paginação (`page` 1, 2, 3 e `limit` 1) e 4 testes para `descricao` (aceitação, omissão e limites de tamanho), cobrindo comportamentos reais do `CreateItemDto` e `FindAll` que ficaram fora do recorte da matriz[cite: 1].

---

### 4b. Como o texto dos critérios de aceitação e da matriz influenciou falhas e lacunas

* **Textos de erro não fixados na especificação:** a matriz de rastreabilidade indicava que as mensagens exatas de erro seriam alinhadas com a equipe, sem fixá-las nos CAs[cite: 1]. Sem um contrato textual fechado no requisito, a LLM inferiu mensagens lendo o DTO (`create-item.dto.ts`), o que causou a única falha da suíte (linha 95) e gerou 27 asserções acopladas às strings atuais do código[cite: 1].
* **Critérios dependentes de outros módulos ou premissas (`*`):** requisitos como saldo inicial `1` (`CA-07`) e controle por saldo (`CA-03`) dependem da integração com o módulo de movimentações/saldos, e a diferenciação de papéis (`REQUISITANTE` vs. `ADMIN` em `CA-06`) está documentada em `docs/permissoes.md` e nos guards do NestJS. Como a geração da v1 focou nos arquivos locais de `itens/`, a LLM não simulou metadados de papéis de usuário nem verificou o estado de saldo pós-criação[cite: 1].
* **Critérios descritos em alto nível (`CA-05` — listagem):** o critério de listar itens do estoque sem detalhar formato de envelope paginado, ordenação ou comportamento de lista vazia induziu a LLM a testar apenas os argumentos repassados ao `prisma.item.findMany` e a escrever uma asserção genérica (`toBeDefined()`) para estoque vazio[cite: 1, 3].

---

### 4c. Trecho com linha coberta e branch não coberto (Linhas vs. Branches)

**Trecho em `src/modules/itens/itens.service.ts` (linhas 14–16):**

```ts
@Injectable() // Linha 14: executada 1x (coberta), mas branch-0 marcado como não coberto pelo V8
export class ItensService {
  constructor(private readonly prisma: PrismaService) {}