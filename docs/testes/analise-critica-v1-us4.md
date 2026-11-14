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

### 4a. O que a LLM perdeu, inventou e acertou a mais

* **O que a LLM perdeu (lacunas frente à matriz):**
  * **Liberação depois do atraso (`CT-04-34`, `35`, `36`, `37`; `PRS-03`, `PRS-04`, `PRS-05`):** só existem os dois testes do lado que bloqueia (e eles falham). Nenhum teste cobre responsável com empréstimo dentro do prazo, atraso regularizado pela devolução, justificativa de permanência ou atraso de outro responsável. O `simularResponsavelComAtraso` devolve o empréstimo atrasado para qualquer consulta que não seja por `itemId`, então nem distingue um responsável de outro.
  * **Item patrimonial sem tombamento (`CT-04-02`, `PIT-02`):** a fixture `ITEM` sempre tem `tombamento: '123456'`.
  * **Responsável não informado e identificador inexistente (`CT-04-04`, `CT-04-05`, `PRO-03`, `PRO-04`):** o helper `entrada()` sempre envia o objeto `responsavel`, e o service não tem seleção por identificador.
  * **Item devolvido que volta a ser emprestado (`CT-04-21`, `PIS-04`):** nenhum teste usa um item que já teve empréstimo `DEVOLVIDO`; o mock de `findFirst` retorna `null` e não simula o histórico.
  * **Perfis de acesso (`CT-04-40`, `42`, `43`, `45`):** os services recebem só `userId`, então a suíte testa "sem vínculo de gestor" (403) e não os papéis ADMIN e requisitante, que são decididos nos guards. O prompt enviado para esta story trazia CA1 a CA10 e não incluía o CA-11 nem os guards. Essa lacuna vem do prompt, e não de erro da LLM.
  * **Fluxo completo (`CT-04-46`):** só há testes por método, sem encadeamento registrar → anexar → confirmar → devolver.

* **O que a LLM inventou (oráculos incorretos ou regras sem lastro nos CAs):**
  * **Oráculo errado no retorno do prazo indefinido (linha 470):** a LLM leu `r.prazoDevolucao` do valor devolvido pelo mock, achando que ele refletia o que o service gravou.
  * **Asserções circulares:** `r.status` igual a `AGUARDANDO_TERMO` em `create`, `ATIVO` em `confirmarEntrega` e `DEVOLVIDO` em `devolver` vêm do próprio mock (`emprestimo.create`, `findUniqueOrThrow`), então não provam o comportamento do service. Esses 3 testes passam por outras asserções válidas (chamadas ao `updateMany`, `item.update` etc.).
  * **Classe da exceção do bloqueio por atraso:** o CA-09 pede impedir e informar a pendência, sem dizer o tipo de erro. A LLM fixou `ResourceConflictException` e a regex `/atras|pend/i`. Se a correção usar outro tipo de erro, o primeiro teste falha de novo sem que haja defeito.
  * **Regras da implementação tratadas como requisito:** ordenação por prazo crescente com indefinidos por último (`nulls: 'last'`), `where` e `orderBy` exatos do Prisma, numeração do termo (`01/2026`, `123/2026`) e `AggregateError` quando a limpeza do PDF também falha. Os critérios da US04 não pedem nenhuma dessas.

* **O que a LLM acertou a mais (cenários válidos não previstos na matriz):**
  * **Formato de CPF, Siape e e-mail (`PR-11` declara fora da matriz):** 4 testes de CPF com 10, 11, 12 e 0 dígitos, 1 de normalização da máscara e 4 de e-mail. Há também 1 teste para Siape e CPF de responsáveis diferentes (conflito).
  * **Concorrência:** `updateMany` com `count: 0` em `confirmarEntrega` e `devolver` vira conflito, nos dois casos.
  * **Anexo do termo e PDFs:** 16 testes de `anexarTermoAssinado` (tipo, assinatura `%PDF`, limite de tamanho, substituição do arquivo anterior, desfazer a gravação) e 8 de `obterPdf`, `obterPdfAssinado` e controller. A matriz da US04 deixa o formato do arquivo e o PDF para a US05.
  * **Paginação e vazio na listagem:** 3 testes de `skip`/`take` e 1 de lista vazia (`CA-08`, sem requisito de paginação).
  * **`it.todo` correto:** a LLM percebeu que o módulo não tem consulta de responsáveis nem de histórico e registrou isso, em vez de inventar um teste que passaria com mock.

---

### 4b. Como o texto dos critérios de aceitação e da matriz influenciou falhas e lacunas

* **CA-09 sem contrato de erro:** o critério diz "impede o registro e informa a pendência", sem fixar tipo de erro nem mensagem. Os 2 testes que falham (linhas 679 e 689) falham hoje por causa do defeito real, mas a escolha de `ResourceConflictException` e da regex da mensagem é palpite da LLM, e a matriz avisa que "recusado" não fixa código HTTP nem texto. Quando a Issue 1 for corrigida, a suíte pode continuar falhando por esse palpite.
* **CA-03 não define como o prazo "indefinido" é representado:** a LLM assumiu `null` no dado gravado e no retorno. O dado gravado estava certo (linha 468 passa), mas a leitura do retorno falhou no mock (linha 470). O texto do critério abriu espaço para a falha de oráculo.
* **CA-02 e CA-10 não dizem onde a consulta mora:** "selecionar na lista" e "histórico do responsável" não apontam operação nem rota. Como o controller só tem criar, listar pendentes, devolver, termo e confirmar entrega, a LLM concluiu que a funcionalidade não existe e gerou `it.todo`. O texto do critério só vira teste executável quando a funcionalidade existe no código enviado.
* **PR-04 (atraso por dia) não chegou à LLM e diverge do código:** o critério diz "prazo vencido" sem definir o dia. A LLM leu `estaAtrasado` (`prazoDevolucao < agora`) e testou o instante (agora, agora −1 ms, agora +1 ms). A matriz espera que no dia do prazo ainda não haja atraso (`LM-02`). Por isso `CT-04-28` ficou `Parcial`. Se o prazo for gravado à meia-noite, o código marca atraso a partir das 00:00:01 do próprio dia. É um ponto a confirmar com a equipe, não um defeito confirmado.
* **CA-11 e guards fora do prompt:** o prompt enviado listava até o CA10 e os arquivos do módulo, sem `roles.guard` nem `auth.guard`. A LLM escreveu testes de acesso negado em 6 métodos do service a partir de `assertGestorDoEstoque`, mas não pôde distinguir ADMIN de requisitante.

---

### 4c. Trecho com linha coberta e branch não coberto (Linhas vs. Branches)

**Trecho em `src/modules/emprestimos/emprestimos.service.ts` (linhas 262–266, método `obterPdfAssinado`):**

```ts
async obterPdfAssinado(estoqueId: string, emprestimoId: string, user?: CurrentUser) {
  await this.findEstoqueOrFail(estoqueId);
  if (user?.role !== AccessRole.ADMIN) {            // linha 264: executada, mas só com ADMIN
    await this.assertGestorDoEstoque(estoqueId, user?.userId);  // linha 265: nunca executada
  }
```

Os 2 testes que chamam `obterPdfAssinado` ("devolve o PDF assinado com sufixo -assinado" e "responde 404 quando não há termo assinado anexado") passam `role: ADMIN`. A linha 264 conta como coberta, porque o `if` foi avaliado. Só o ramo "não é ADMIN" nunca foi tomado, e por isso a linha 265 aparece como descoberta e o branch correspondente também. Um teste com o gestor do estoque fecha o ramo, e um com usuário sem vínculo confere o 403.

O mesmo desencontro aparece nos números do service: **98,03% de linhas (150/153) contra 95,34% de branches (82/86)**. Há 3 linhas descobertas (196, 265 e 273: o 404 de empréstimo inexistente em `obterPdf` e em `obterPdfAssinado`, e o ramo não-ADMIN) e 4 branches descobertos. Não consegui identificar o quarto branch sem abrir o relatório HTML.

Mais importante: o `create` tem 100% das linhas cobertas e mesmo assim o CA-09 (bloqueio por atraso) não existe nele. A cobertura mede o código que está escrito, e não detecta regra que falta. Quem achou o defeito foram os testes derivados dos critérios, e não a métrica.

---

### Observações adicionais

* **Divergência de tamanho do anexo (US05):** o doc de critérios fala em cerca de 10 MB, e a constante `TERMO_ASSINADO_MAX_BYTES` vale 5 MB. A LLM seguiu o código. Vale conferir na matriz da US05.
* **Nome do arquivo:** o comando e o log usam `us04-emprestimos.spec.ts`. Se o arquivo ainda estiver como `us04-itens.spec.ts`, renomeie antes do commit.
