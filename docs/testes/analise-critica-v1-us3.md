# Medição e Análise Crítica da Suíte v1 (LLM) — US03 (Cadastro e Listagem de Itens)

## 1. Tabela de Indicadores da Suíte v1

| Indicador | Resultado v1 | Observações e Evidências |
| :--- | :--- | :--- |
| **Testes gerados** | **106** | 103 chamadas de `it` + 1 `it.each` com 3 valores (nível mínimo -1, 0 e 1), em `tests/v1-llm/us03-itens.spec.ts`. |
| **Testes passando** | **105 (99,06%)** | Todos os testes de `ItensService`, `ItensController` e 57/58 testes dos schemas Zod passaram. |
| **Testes falhando** | **1 (0,94%)** | Linha 95 (`rejeita tipo fora do enum`): falha por **oráculo errado** da LLM, não por bug no código. |
| **Testes que não compilam** | **0 (0%)** | Arquivo compilou e executou integralmente sob Vitest v4.1.8. |
| **Cobertura de linhas** | **100% (60/60)** *(com 1 teste falhando)* | `itens.service.ts` (46/46), `itens.controller.ts` (5/5), `dto/` (9/9). *Nota: o teste que falha também executa código antes da asserção*. |
| **Cobertura de branches** | **97,36% (37/38)** *(com 1 teste falhando)* | `dto/` (8/8 = 100%), `itens.controller.ts` (100%), `itens.service.ts` (29/30 = 96,66%). Único branch descoberto: linha 14 (`@Injectable()`). |
| **Cobertura de statements / funções** | **100% (60/60) / 100% (14/14)** | Medição restrita aos 4 arquivos de produção da US03. |
| **Partições de equivalência cobertas** | **85,19% (23/27)** | 23 `Sim` (inclui 2 `Sim*` via mock), 3 `Parcial` (totalizando 96,30% se somadas) e 1 `Não` (`PPF-04`). |
| **Valores-limite cobertos** | **75,00% (3/4 fronteiras)** | 3 fronteiras cobertas nos dois lados (`LM-01`, `LM-02`, `LM-03`) e 6/8 valores individuais cobertos (75,00%). |
| **Requisitos (CAs) cobertos** | **85,71% (6/7 CAs)** | Pelo critério de ao menos um teste (`CA-07` sem cobertura; `CA-03` e `CA-05` com cobertura parcial). |
| **Casos de teste da matriz (CTs)** | **62,16% Sim (23/37)** | 23 `Sim` (5 `Sim*` via mock), 6 `Parcial` (16,22%) e 8 `Não` (21,62%: CTs 13–17, 27, 34 e 37). |
| **Testes sem asserção ou triviais** | **1** | **0** sem asserção (139 `expect` nos testes + 3 no helper `esperarErro`) e **1** trivial (linha 705, apenas `toBeDefined()`). |
| **Defeitos reais identificados** | **0** | Nenhuma falha do código de produção em relação aos critérios de aceitação foi revelada pela v1. |

---

## 2. Análise Crítica (Etapa 4)

### 4a. O que a LLM perdeu, inventou e acertou a mais

* **O que a LLM perdeu (lacunas frente à matriz):**
  * **Saldo do patrimonial (`CA-07` / `CT-03-17`):** nenhum teste verificou que o item patrimonial recém-cadastrado tem saldo 1. É o único critério sem nenhum teste.
  * **Controle por saldo do consumo (`CA-03` / `CT-03-16`):** o cadastro de item `CONSUMO` sem tombamento foi testado, mas nenhum teste verificou o controle por saldo (entrada de 10 unidades resulta em saldo 10).
  * **Papéis de permissão (`CA-06` / `CT-03-32`, `CT-03-33`, `CT-03-34`):** a suíte só testou a ausência genérica de vínculo de gestor (`userId` indefinido ou `findUnique` retornando `null`). Não há cenário explícito de `REQUISITANTE` nem de `ADMIN` sem vínculo no estoque.
  * **Listagem (`CA-05` / `CT-03-24` a `CT-03-27`):** não houve teste com exatamente 1 item (`CT-03-27`); o estoque vazio usou asserção trivial (`toBeDefined()`, `CT-03-26`); o teste de 3 itens ficou com 2 vindos do mock (`CT-03-24`); e o isolamento entre estoques só conferiu o argumento `where { estoqueId }`, sem dois estoques com itens (`CT-03-25`).
  * **Unicidade e criação múltipla (`CA-02` e `CA-03` / `CT-03-13`, `CT-03-14`, `CT-03-15`):** nenhum teste com tombamento já usado em outro estoque, com dois patrimoniais de tombamentos distintos ou com dois consumos sem tombamento, porque o mock não modela a unicidade.
  * **Edição de tombamento (`CA-02` / `CT-03-35`, `CT-03-37`):** nenhum teste de editar mantendo o próprio tombamento sem falso conflito (`CT-03-37`), e a remoção do tombamento na edição só foi testada no schema, sem verificar que o valor anterior permanece (`CT-03-35`).

* **O que a LLM inventou (oráculos incorretos ou regras sem lastro nos CAs):**
  * **Oráculo errado na validação de enum (linha 95):** no teste `rejeita tipo fora do enum`, a LLM assumiu que enviar `'OUTRO'` dispararia `'Tipo deve ser PATRIMONIAL ou CONSUMO'`. No Zod, `invalid_type_error` aplica-se apenas quando o tipo primitivo não é string (ex.: número/null), enquanto strings fora do enum geram a mensagem padrão do `z.enum(...)`, fazendo o teste falhar.
  * **Regras internas tratadas como requisitos explícitos:** a suíte congelou decisões de implementação que não constavam nos critérios de aceitação da US03, como a ordem de precedência HTTP (`404` de estoque inexistente antes de `403` de permissão), a recusa explícita de `tombamento` em itens `CONSUMO` (`CA4: rejeita consumo com tombamento informado`) e o bloqueio de cadastro em estoque desativado (`400`).

* **O que a LLM acertou a mais (cenários válidos não previstos na matriz):**
  * **Conflito de número de série (`P2002` em `numeroSerie`):** o `ItensService` trata duplicidade tanto de `tombamento` quanto de `numeroSerie` (linhas 140–145), e a LLM gerou testes cobrindo a tradução de `P2002` para `numeroSerie` duplicado, embora a matriz só listasse duplicidade para tombamento (`PTB-04` / `LM-03`).
  * **Paginação e campo opcional `descricao`:** a LLM criou 4 testes para parâmetros de paginação (`page` 1, 2, 3 e `limit` 1) e 4 testes para `descricao` (aceitação, omissão e limites de tamanho), cobrindo comportamentos reais do `CreateItemDto` e `FindAll` que ficaram fora do recorte da matriz.

---

### 4b. Como o texto dos critérios de aceitação e da matriz influenciou falhas e lacunas

* **Textos de erro não fixados na especificação:** a matriz de rastreabilidade indicava que as mensagens exatas de erro seriam alinhadas com a equipe, sem fixá-las nos CAs. Sem um contrato textual fechado no requisito, a LLM inferiu mensagens lendo o DTO (`create-item.dto.ts`), o que causou a única falha da suíte (linha 95) e gerou 27 asserções acopladas às strings atuais do código.
* **Critérios dependentes de outros módulos ou premissas (`*`):** requisitos como saldo inicial `1` (`CA-07`) e controle por saldo (`CA-03`) dependem da integração com o módulo de movimentações/saldos, e a diferenciação de papéis (`REQUISITANTE` vs. `ADMIN` em `CA-06`) está documentada em `docs/permissoes.md` e nos guards do NestJS. Como a geração da v1 focou nos arquivos locais de `itens/`, a LLM não simulou metadados de papéis de usuário nem verificou o estado de saldo pós-criação.
* **Critérios descritos em alto nível (`CA-05` — listagem):** o critério de listar itens do estoque sem detalhar formato de envelope paginado, ordenação ou comportamento de lista vazia induziu a LLM a testar apenas os argumentos repassados ao `prisma.item.findMany` e a escrever uma asserção genérica (`toBeDefined()`) para estoque vazio.

---

### 4c. Trecho com linha coberta e branch não coberto (Linhas vs. Branches)

Em `src/modules/itens/itens.service.ts`, a linha 14 aparece como coberta (executada 1x), mas o relatório marca 1 branch não coberto nela (29/30 branches no service). A marca está dentro dos parênteses do decorator:

```ts
@Injectable()                  // linha 14: linha executada, branch não coberto
export class ItensService {    // linha 15
  constructor(private readonly prisma: PrismaService) {}
```

A linha roda uma vez, quando o módulo é carregado, então conta como coberta. O branch descoberto está ligado ao decorator, e não a uma decisão do código de negócio: é um artefato do código gerado na transpilação, e nenhum teste consegue exercitar o outro caminho. Isso mostra a diferença entre os indicadores: cobertura de linhas só diz que a linha rodou; cobertura de branches diz se os dois lados de cada decisão rodaram. Todos os branches de decisão do service (`if`, ternário e `??`) foram exercitados.

---

### 4d. Oráculos (comportamento assumido do código, defeitos e asserções triviais)

* **Casos em que a LLM assumiu o comportamento do código atual em vez do requisito (`27` + `17` ocorrências):** como teve acesso direto ao código de produção durante a geração, a LLM copiou **27 strings exatas de erro** de `create-item.dto.ts` e `itens.service.ts` como oráculo (em vez de validar apenas o status HTTP e a semântica da rejeição, já que a matriz não fixava textos de erro) e acoplou **17 testes** aos argumentos internos repassados ao Prisma (`toHaveBeenCalledWith`). Em **1 caso** (linha 95), ao inferir a mensagem interna do Zod sem ler o requisito, a LLM escreveu um oráculo incorreto e gerou a única falha da suíte (`1/106`):

```ts
// tests/v1-llm/us03-itens.spec.ts (linhas 92–96)
it('rejeita tipo fora do enum', () => {
  const r = CreateItemSchema.safeParse({ ...patrimonialValido, tipo: 'OUTRO' });
  expect(r.success).toBe(false);
  expect(mensagens(r)).toContain('Tipo deve ser PATRIMONIAL ou CONSUMO');
});
```

* **Testes que passaram validando um defeito (`0` ocorrências):** nenhum dos 105 testes que passaram ocultou ou validou um bug funcional do sistema, e nenhum defeito real foi revelado no código de produção (`src/modules/itens/`).
* **Testes sem asserção ou com asserção trivial (`0` sem asserção / `1` com asserção trivial na linha 707):** não há testes sem `expect(...)`, mas há **1 teste com asserção trivial** no cenário de estoque vazio (`CT-03-26`), que verifica apenas `toBeDefined()` sem conferir se a lista retornada veio vazia (`[]`) nem os metadados de paginação:

```ts
// tests/v1-llm/us03-itens.spec.ts (linhas 705–708)
it('estoque sem itens retorna listagem vazia sem erro', async () => {
  const resultado = await service.findAllByEstoque(estoqueId, { page: 1, limit: 10 } as any);
  expect(resultado).toBeDefined();
});
```