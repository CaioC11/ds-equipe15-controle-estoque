# Medição e Análise Crítica da Suíte v1 (LLM) — US04 (Registro de Empréstimo e Devolução)

Suíte: `tests/v1-llm/us04-emprestimos.spec.ts`. Execução de 13/11/2026 com Vitest v4.1.8 (`npm run test:v1`, config `vitest.llm.config.ts`). Matriz usada: `docs/testes/matriz-rastreabilidade-us4.md` (coluna "Coberto pela v1?" preenchida). Relatório HTML: `docs/testes/relatorios/v1/us04/index.html` (o `coverage-summary.json` está na mesma pasta).

## 1. Tabela de Indicadores da Suíte v1

| Indicador | Resultado v1 | Observações e Evidências |
| :--- | :--- | :--- |
| **Testes gerados** | **138** | Inclui 2 `it.todo` e os casos expandidos de `it.each`. |
| **Testes passando** | **132 (95,65%)** | Passaram todos os testes de `estaAtrasado`, `anexarTermoAssinado`, `confirmarEntrega`, `devolver`, `findPendentes`, `obterPdf`/`obterPdfAssinado` e do controller, e todos os de `CreateEmprestimoSchema` e `create`, exceto os 4 que falham. |
| **Testes falhando** | **4 (2,90%)** | 2 por erro do teste (mock do retorno, linha 470) e 2 por defeito real do sistema (CA-09, linhas 679 e 689). |
| **Testes que não compilam** | **0 (0%)** | O arquivo foi importado e executado por inteiro. |
| **Testes pendentes (`it.todo`)** | **2 (1,45%)** | CA-02 (lista de responsáveis) e CA-10 (histórico do responsável), com a justificativa "consulta ausente no módulo". Não contam como falha nem como "não compila". |
| **Cobertura de linhas** | **98,29% (172/175)** | `emprestimos.service.ts` 150/153, `emprestimos.controller.ts` 13/13 e `dto/create-emprestimo.dto.ts` 9/9. Medição restrita aos 3 arquivos de produção da US04 enviados no prompt. Linhas descobertas: 196, 265 e 273 do service. |
| **Cobertura de branches** | **95,70% (89/93)** | Service 82/86 (95,34%), DTO 7/7, controller sem branches. |
| **Cobertura de statements / funções** | **97,22% (175/180) / 94,44% (34/36)** | Service: 153/158 statements e 20/22 funções. As 2 funções descobertas estão no service. |
| **Partições de equivalência cobertas** | **69,77% (30/43)** | 30 `Sim` (6 por schema e 24 `Sim*` por mock), 4 `Parcial` (PPF-04, PIS-04, PRO-01, PRS-01) e 9 `Não`: PPF-02, PIT-02, PRO-03, PRO-04, PRS-03, PRS-04, PRS-05, PHR-01 e PHR-02. Somando os `Parcial`, 79,07% (34/43). |
| **Valores-limite cobertos** | **80,00% (8/10 valores)** | 3 de 5 fronteiras cobertas nos dois lados (60,00%: LM-01, LM-04, LM-05). LM-02 (lado "prazo = hoje") e LM-03 (lado "0 em atraso") ficaram `Parcial`. |
| **Requisitos (CAs) cobertos** | **90,91% (10/11 CAs)** | Pelo critério de ao menos um teste (`CA-10` sem cobertura). `CA-02` e `CA-11` com cobertura parcial; `CA-09` tem testes, mas eles falham. Pelo critério estrito (todos os CTs do CA em `Sim`/`Sim*`), só `CA-03`, `CA-04` e `CA-06`: 27,27% (3/11). |
| **Casos de teste da matriz (CTs)** | **58,70% Sim (27/46)** | 5 `Sim` e 22 `Sim*` via mock, 6 `Parcial` (13,04%: CT-04-01, 10, 21, 28, 42, 45) e 13 `Não` (28,26%: CT-04-02, 04, 05, 09, 34, 35, 36, 37, 38, 39, 40, 43, 46). |
| **Testes sem asserção ou triviais** | **4** | **0** sem asserção (todo `it` tem `expect` ou usa o helper `erroDe`, que lança se a promessa não for rejeitada). **4** triviais, só com `resolves.toBeDefined()`: "aceita prazo igual à retirada / 1 ms depois da retirada" (2) e "aceita arquivo com tamanho exatamente no limite / 1 byte abaixo do limite" (2). Há ainda 3 asserções circulares dentro de testes que têm outras asserções válidas (ver 4a). |
| **Defeitos reais identificados** | **1 defeito e 1 lacuna** | Defeito: `create` não bloqueia responsável com item em atraso (CA-09, Issue 1, revelado por 2 testes que falham). Lacuna funcional: não existem consultas de responsáveis nem de histórico (CA-02 e CA-10, Issue 2, revelada pelos 2 `it.todo`). |

Falhas investigadas (detalhe em `docs/testes/llm-log.md`):

| Teste | Classificação | Evidência |
| :--- | :--- | :--- |
| `create > deixa o prazo indefinido (null) quando omitido` e `... quando nulo` (linha 470) | Erro do teste (setup do mock) | A asserção da linha 468 passa: o service grava `prazoDevolucao: null`. A linha 470 lê o retorno de `create`, que sai do `tx.emprestimo.update` mockado em `configurarCaminhoFelizDeCreate`, e esse mock não devolve `prazoDevolucao`. |
| `responsável com item em atraso > impede novo empréstimo` (linha 679) e `informa a pendência` (linha 689) | Defeito real | A promessa resolve com `status: 'AGUARDANDO_TERMO'`. O `create` não consulta empréstimos ativos vencidos do responsável, e `estaAtrasado` só é usado em `findPendentes`. |

---

## 2. Análise Crítica (Etapa 4)

As quatro perguntas seguem o roteiro da Sprint 3 (Etapa 4). Os números vêm da execução de 13/11/2026, do `coverage-summary.json` e da matriz `matriz-rastreabilidade-us4.md`.

### Pergunta 1. Técnicas funcionais: a LLM identificou as mesmas partições e limites que a equipe?

Das 43 partições da matriz, a v1 exercitou 30 (69,77%), deixou 4 `Parcial` e perdeu 9. Dos 10 valores-limite, cobriu 8 (80,00%).

* **O que a LLM perdeu:**
  * **Liberação depois do atraso (`PRS-03`, `PRS-04`, `PRS-05`; `CT-04-34`, `35`, `36`, `37`):** só existem os 2 testes do lado que bloqueia, e eles falham. Nenhum teste cobre responsável com empréstimo dentro do prazo, atraso regularizado pela devolução, justificativa de permanência ou atraso de outro responsável. O helper `simularResponsavelComAtraso` devolve o empréstimo atrasado para qualquer consulta que não seja por `itemId`, então nem distingue um responsável de outro.
  * **Item patrimonial sem tombamento (`PIT-02`, `CT-04-02`):** a fixture `ITEM` sempre tem `tombamento: '123456'`.
  * **Responsável não informado e identificador inexistente (`PRO-03`, `PRO-04`; `CT-04-04`, `05`):** o helper `entrada()` sempre envia o objeto `responsavel`, e o service não tem seleção por identificador.
  * **Histórico do responsável (`PHR-01`, `PHR-02`; `CT-04-38`, `39`):** só `it.todo`.
  * **Perfis de acesso (`PPF-02`; `CT-04-40`, `43`; `PPF-04` `Parcial`):** os services recebem só `userId`, então a suíte testa "sem vínculo de gestor" (403) e não ADMIN nem requisitante, que são decididos nos guards. O prompt desta story trazia CA1 a CA10 e não incluía o CA-11 nem os guards: essa lacuna vem do prompt.
  * **Item devolvido que volta a ser emprestado (`PIS-04`, `CT-04-21`):** o mock de `findFirst` retorna `null` e nunca simula um empréstimo `DEVOLVIDO`.
  * **Fronteira do atraso no dia do prazo (`LM-02`, lado "hoje") e `0 em atraso` (`LM-03`):** ficaram `Parcial`.
* **O que a LLM inventou (partições e limites que a matriz não tem):**
  * **Tamanho do CPF com 10, 11, 12 e 0 dígitos, máscara do CPF e formato do e-mail:** 9 testes que a matriz declara fora do escopo (`PR-11`).
  * **Campos `lotacao` e `cargo` obrigatórios:** 8 testes (`describe.each`), a partir do DTO, sem partição na matriz.
  * **Limite de 5 MB do anexo:** 3 testes em torno de `TERMO_ASSINADO_MAX_BYTES`, que pertencem à matriz da US05.
* **O que a LLM acertou que a equipe não tinha previsto:**
  * **Conflito de Siape e CPF de responsáveis diferentes:** 1 teste.
  * **Concorrência:** `updateMany` com `count: 0` em `confirmarEntrega` e `devolver` vira conflito (2 testes).
  * **Falha na gravação do termo:** o PDF é removido e o erro é traduzido (4 testes).
  * **`it.todo` correto:** a LLM percebeu que o módulo não tem consulta de responsáveis nem de histórico e registrou isso, em vez de inventar um teste que passaria com mock.

### Pergunta 2. Requisitos: algum critério ficou sem teste? Algum teste não corresponde a requisito nenhum?

| CA | Situação na v1 | Casos da matriz |
| :--- | :--- | :--- |
| CA-01 | Coberto, com lacunas | `CT-04-03`, `06`, `07`, `08` cobertos; `CT-04-01` `Parcial`; `CT-04-02`, `04`, `05` sem teste |
| CA-02 | Parcial | `CT-04-10` `Parcial`; `CT-04-09` sem teste (`it.todo`) |
| CA-03 | Coberto | `CT-04-11` a `15` |
| CA-04 | Coberto | `CT-04-16` a `18` |
| CA-05 | Coberto | `CT-04-19`, `20`; `CT-04-21` `Parcial` |
| CA-06 | Coberto | `CT-04-22` |
| CA-07 | Coberto | `CT-04-23` a `25`; `CT-04-21` `Parcial` |
| CA-08 | Coberto | `CT-04-26` a `32`; `CT-04-28` `Parcial` |
| CA-09 | Testes existem e falham | `CT-04-33` falha por defeito real; `CT-04-34` a `37` sem teste |
| CA-10 | **Sem teste** | `CT-04-38`, `39` só como `it.todo` |
| CA-11 | Parcial | `CT-04-41`, `44` cobertos; `CT-04-42`, `45` `Parcial`; `CT-04-40`, `43` sem teste |

Resultado: 10 de 11 CAs com ao menos um teste (90,91%). Com o critério estrito (todos os casos do CA em `Sim`/`Sim*`), só `CA-03`, `CA-04` e `CA-06`: 27,27%.

**Testes sem correspondência na matriz:** pelo menos 39 dos 138 testes (28,26%) exercitam comportamentos que nenhum CA da US04 pede, e todos trazem no comentário um `Requisito: CA...` que não corresponde a eles:
* 9 de formato de CPF e e-mail (`PR-11`) e 1 de conflito Siape × CPF;
* 4 de paginação e lista vazia (`CA-08` não fala em paginação);
* 4 de numeração do termo e 4 de remoção do PDF quando a transação falha (US05);
* 2 de concorrência;
* 7 de validação do arquivo anexado (tipo, `%PDF`, tamanho) e 8 de `obterPdf`, `obterPdfAssinado` e controller de PDF (US05).

São testes válidos, mas não rastreáveis à matriz da US04.

### Pergunta 3. Linhas versus branches

**Trecho em `src/modules/emprestimos/emprestimos.service.ts` (linhas 262–266, método `obterPdfAssinado`):**

```ts
async obterPdfAssinado(estoqueId: string, emprestimoId: string, user?: CurrentUser) {
  await this.findEstoqueOrFail(estoqueId);
  if (user?.role !== AccessRole.ADMIN) {            // linha 264: executada, mas só com ADMIN
    await this.assertGestorDoEstoque(estoqueId, user?.userId);  // linha 265: nunca executada
  }
```

Os 2 testes que chamam `obterPdfAssinado` ("devolve o PDF assinado com sufixo -assinado" e "responde 404 quando não há termo assinado anexado") passam `role: ADMIN`. A linha 264 conta como coberta, porque o `if` foi avaliado, e só o ramo "não é ADMIN" nunca foi tomado. Por isso a linha 265 e o branch correspondente aparecem como descobertos. Um teste com o gestor do estoque fecha o ramo, e um com usuário sem vínculo confere o 403.

O mesmo desencontro aparece nos números do service: **98,03% de linhas (150/153) contra 95,34% de branches (82/86)**. Há 3 linhas descobertas (196, 265 e 273: o 404 de empréstimo inexistente em `obterPdf` e em `obterPdfAssinado`, e o ramo não-ADMIN) e 4 branches descobertos. Não identifiquei o quarto branch sem abrir o relatório HTML.

Mais importante: o `create` tem 100% das linhas cobertas e mesmo assim o CA-09 (bloqueio por atraso) não existe nele. A cobertura mede o código que está escrito e não detecta regra que falta. Quem achou o defeito foram os testes derivados dos critérios, e não a métrica.

### Pergunta 4. Oráculos: a LLM assumiu o comportamento do código em vez do requisito?

* **Testes que seguem o código quando o requisito é omisso ou diverge: 16 de 138 (11,59%).**
  * **Atraso por instante (3 testes de `estaAtrasado`):** os de 1 ms antes, exato e 1 ms depois seguem `prazoDevolucao < agora`. O critério diz só "prazo vencido", e a matriz (`PR-04`) espera que no dia do prazo ainda não haja atraso.
  * **Ordem e filtro exatos do Prisma (2 testes):** `findPendentes` assere `orderBy` com `nulls: 'last'` e o `where` literal. Nenhum critério define ordem.
  * **Limite do anexo (3 testes):** os testes de tamanho usam `TERMO_ASSINADO_MAX_BYTES`, que vale 5 MB. Conforme o doc de critérios da US05, o limite seria de cerca de 10 MB.
  * **`lotacao` e `cargo` obrigatórios (8 testes):** vêm do DTO. O critério A3 lista os campos, mas não diz que são obrigatórios, e a matriz (`PR-07`) exige só nome e Siape ou CPF.
* **Algum teste passou validando um defeito?** Nenhum confirmado. Os 6 testes dos grupos de atraso e de limite do anexo passam hoje e passariam a validar um defeito se a equipe confirmar que o requisito é "no dia do prazo ainda não há atraso" e "limite de 10 MB". Ficam como pontos a confirmar.
* **Oráculos que a LLM inventou (não vêm do código nem do requisito):**
  * **Retorno do prazo indefinido (linha 470):** as 2 falhas do `create` leem `r.prazoDevolucao` do retorno do mock, que não traz o campo. É erro do teste, e a asserção do dado gravado (linha 468) passa.
  * **Classe do erro do bloqueio por atraso:** o CA-09 pede impedir e informar a pendência, sem fixar o erro. A LLM escolheu `ResourceConflictException` e a regex `/atras|pend/i`. Hoje os testes falham pelo defeito real, mas depois da correção da Issue 1 podem falhar de novo só por esse palpite.
* **Testes sem asserção ou triviais:**
  * **Sem asserção:** 0. Todo `it` tem `expect` ou usa o helper `erroDe`, que lança se a promessa não for rejeitada.
  * **Triviais:** 4, só com `resolves.toBeDefined()` ("aceita prazo igual à retirada" e "1 ms depois da retirada", e "aceita arquivo com tamanho exatamente no limite" e "1 byte abaixo do limite").
  * **Asserções circulares:** 3. O `r.status` de `AGUARDANDO_TERMO` em `create`, `ATIVO` em `confirmarEntrega` e `DEVOLVIDO` em `devolver` vêm do próprio mock. Esses testes passam por outras asserções válidas.

---

### Observações adicionais

* **Nome do arquivo:** o comando e o log usam `us04-emprestimos.spec.ts`. Se o arquivo ainda estiver como `us04-itens.spec.ts`, renomeie antes do commit.