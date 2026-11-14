# Medição e Análise Crítica da Suíte v1 (LLM) — US05 (Termo de Responsabilidade)

Responsável: Randell · Issue: S3B-09 (#68) · Suíte: `controle-estoque-emprestimos-back/tests/v1-llm/us05-termo.spec.ts` · Commit medido: `24954a2` (`main`).

As linhas de emprestimos.service.ts e termo-pdf.service.ts citadas valem para o commit 24954a2; os PRs #104 e #105, mergeados, as deslocam.

Medição feita só com o spec da US05, com `vitest.us05.config.ts` (escopo: os 5 arquivos de `src/modules/emprestimos/` que o termo usa):

```
npx vitest run --config vitest.us05.config.ts tests/v1-llm/us05-termo.spec.ts --coverage
```

Relatório HTML: `docs/testes/relatorios/v1/us05/index.html`. Resultados em `docs/testes/relatorios/resultados-v1-us05.json`. A suíte da US04 (`us04-emprestimos.spec.ts`) não entra na conta; por isso `create`, `findPendentes` e `devolver` aparecem sem cobertura.

## 1. Tabela de Indicadores da Suíte v1

| Indicador | Resultado v1 | Observações e Evidências |
| :--- | :--- | :--- |
| **Testes gerados** | **90** | 73 blocos `it` + 5 `it.each` que se expandem em 17 execuções (`padStart`, path traversal, status, mimetype), no spec da US05. |
| **Testes passando** | **90 (100%)** | `Tests 90 passed (90)` na saída do Vitest 4.1.8. |
| **Testes falhando** | **0 (0%)** | Nenhuma falha de asserção. |
| **Testes que não compilam** | **0 (0%)** | O arquivo carregou e rodou inteiro. Os sublinhados do VS Code eram dependências do back ainda não instaladas, sem relação com o teste. |
| **Cobertura de linhas** | **66,66%** (5 arquivos) | `termo-pdf.service.ts` 100%, `termo-storage.service.ts` 100%, `termo-assinado.constants.ts` 100%, `emprestimos.service.ts` 52,28%, `emprestimos.controller.ts` **0%**. |
| **Cobertura de branches** | **63,63%** (5 arquivos) | `termo-pdf.service.ts` 96,15% (linha 67), `termo-storage.service.ts` 88,88% (linha 6), constants 100%, `emprestimos.service.ts` 51,16%. O 100% do controller é artefato do V8: o arquivo nunca executa e não há ramo medido. |
| **Cobertura de statements / funções** | **66,16% / 55,81%** | Mesmo escopo de 5 arquivos. O controller tem 0% de funções. |
| **Partições de equivalência cobertas** | **80,77% (21/26)** | 5 `Sim`, 16 `Sim*` (via mock) e 5 `Não` (PNT-01 a PNT-05, a numeração do termo). |
| **Valores-limite cobertos** | **1/4 fronteiras completas (25%)** | LM-02 (5 MB) nos dois lados, via mock de `size`. LM-01 `Parcial` (0 byte rejeitado; 1 byte não é testável). LM-03 e LM-04 `Não`. 3/8 valores individuais. |
| **Requisitos (CAs) cobertos** | **8/8 com ao menos um teste; 3 sem ressalva** | CA-02, CA-04 e CA-06 sem ressalva. CA-01 só pela exibição do número; CA-03 e CA-05 só no service (controller 0%); CA-07 sem o botão (front); CA-08 só as mensagens de erro. |
| **Casos de teste da matriz (CTs)** | **58,62% (17/29)** | 3 `Sim` (CT-05-08, 09, 10), 14 `Sim*` e 12 `Não` (CT-05-01 a 07, 16, 21, 24, 25, 27). Detalhe em `matriz-rastreabilidade-us5.md`. |
| **Testes sem asserção ou triviais** | **5 triviais + 1 condicional** | 5 `toBeDefined()` (spec, linhas 528, 616, 730, 743, 783) e o `if (typeof e.getStatus === 'function')` da linha 697, que não falha se o método não existir. O spec tem 130 `expect` em 90 testes. |
| **Defeitos reais identificados** | **0 por falha de teste** | A suíte passou inteira. Um teste passa por causa de um defeito conhecido: `falha ao ler arquivo inexistente` espera `/ENOENT/` (ACH-15, `docs/log-analise.md`). |

---

## 2. Análise Crítica (Etapa 4)

### 4a. O que a LLM perdeu, inventou e acertou a mais

* **O que a LLM perdeu (lacunas frente à matriz):**
  * **Numeração por ano (CA-01, CT-05-01 a 07, PNT-01 a 05, LM-03, LM-04):** o contador nasce em `EmprestimosService.create` (`contadorTermo.upsert` e `padStart(2, '0')`, `emprestimos.service.ts:130-135`), que ficou fora da suíte. Os 5 testes `reproduz fielmente o número XX/2026…` só conferem que o PDF imprime a string recebida (`termo-pdf.service.ts:117`); não exercitam o `padStart`, o reinício em 01/01 nem a unicidade.
  * **Camada HTTP (CA-03, CA-05, CT-05-11 a 15 e 17, 26 no nível do endpoint):** `emprestimos.controller.ts` tem 0% (linhas 29-167). Os cabeçalhos `inline` e `attachment` do `StreamableFile`, os códigos HTTP e o `multipart/form-data` não são testados.
  * **403 de verdade (CT-05-13 e 14):** os testes conferem o nome da classe `AccessDeniedException`, não o código HTTP.
  * **Limite de 5 MB com arquivo real (LM-02, CT-05-22 e 23):** só o `size` do mock muda; o buffer tem poucos bytes.
  * **1 byte (LM-01 lado válido, CT-05-21):** não há teste, e um PDF de 1 byte é rejeitado por `%PDF-` (`emprestimos.service.ts:344-348`).
  * **Fuso da data prevista (CA-02):** só a data de abertura tem fronteira (`00:00:00Z` e `23:59:59Z`). A data de fechamento usa `toLocaleDateString('pt-BR')` no fuso do servidor (`termo-pdf.service.ts:31`) e não tem teste de virada de dia (ACH-09).
  * **Arquivo do termo sumido do disco:** nenhum teste de `obterPdf` ou `obterPdfAssinado` verifica o que a API devolve quando o storage lança ENOENT (ACH-15).
  * **CTs de tela (CT-05-16, 24, 25, 27):** exigem o front-end; a suíte é só do back.

* **O que a LLM inventou (oráculos ou regras sem lastro nos CAs):**
  * **ENOENT como comportamento esperado:** `TermoStorageService › falha ao ler arquivo inexistente` fixa que o erro de disco atravessa o storage sem tradução (`termo-storage.service.ts:21-23`). Isso é o defeito ACH-15 virado em oráculo.
  * **Quem pode anexar e confirmar:** a suíte afirma que "o ADMIN é somente leitura" para anexar e confirmar. A matriz (PR-08) registra que as issues não definem esse ponto.
  * **Mensagens e exceções por nome de classe:** como os caminhos das exceções não foram dados no prompt, a LLM as identificou por `nomeClasse(e)`; a conferência do 400 ficou condicional (spec, linha 697).
  * **Assinatura `%PDF-` e MIME como regra de aceitação:** a matriz só diz "arquivo que não é PDF"; a checagem dos 5 bytes mágicos vem do código (`emprestimos.service.ts:344-348`), não dos CAs.

* **O que a LLM acertou a mais (cenários válidos não previstos na matriz):**
  * **Storage:** `não sobrescreve arquivo existente (flag wx)`, caminho absoluto, `..`, `../../fora.pdf` e diretório irmão com prefixo igual ao da raiz (`termo-storage.service.ts:29-40`).
  * **Rollback e substituição no upload:** `substitui o assinado anterior removendo o arquivo antigo`, `ignora falha ao remover o arquivo anterior` e `desfaz o arquivo novo e propaga o erro se a atualização do termo falhar`.
  * **PDF:** `Date` inválida como `INDEFINIDO`, Siape nulo como `Não informado`, bem sem identificação, descrição longa quebrando de página e palavra maior que a largura sem laço infinito.
  * **Ordem das checagens:** `verifica o status antes de validar o arquivo` e `recusa quem não é gestor do estoque sem abrir transação`.

---

### 4b. Como o texto dos critérios de aceitação e da matriz influenciou falhas e lacunas

* **Resultados "recusado" sem código nem texto (matriz, seção 1):** a matriz não fixa o código HTTP nem a mensagem. A LLM não tinha o que verificar além do tipo da exceção, e o resultado foi `nomeClasse(e)` e o `if` condicional da linha 697. Nenhum teste prova 403 ou 400.
* **"Contador simples" sem dizer onde o contador mora (CA-01):** o critério descreve o formato "Nº XX/ano", não a regra de geração. O prompt trouxe só trechos de `emprestimos.service.ts`, e a LLM testou a exibição do número, que era o que o texto descrevia. A regra (`padStart`, reinício por ano) ficou sem teste.
* **Critério que fala de botão (CA-07) e de endpoint (CA-03, CA-05):** os CTs 16, 24, 25 e 27 dependem da tela, e "endpoint para visualizar e baixar" não descreve cabeçalhos. A suíte testou o service e deixou o controller em 0%.
* **Premissa PR-04 (mínimo de 1 byte, máximo de 5 MB):** a matriz escreve "PDF de 1 byte aceito pela regra de tamanho" (CT-05-21). O código também exige `%PDF-`, então um PDF válido tem no mínimo 5 bytes. A premissa e o código não combinam, e a LLM ficou com o limite de 5 bytes (`aceita buffer de exatamente 5 bytes "%PDF-"`).
* **Data sem fuso (CA-02):** o critério fala em "data de abertura" e "data prevista" sem dizer o fuso. A LLM usou UTC para a abertura, porque o código usa UTC, e deixou o fechamento sem fronteira. O defeito ACH-09 vive nessa lacuna do texto.

---

### 4c. Trecho com linha coberta e branch não coberto (Linhas vs. Branches)

**Trecho em `src/modules/emprestimos/termo-pdf.service.ts` (linhas 53-67, `drawWrapped`):**

```ts
const drawWrapped = (text: string, font = regular, size = 10, lineHeight = 14) => {
  const words = text.split(/\s+/);
  let line = '';
  const lines: string[] = [];

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > CONTENT_WIDTH && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);   // linha 67
```

A linha 67 é executada em todos os testes que geram o PDF, então o arquivo tem 100% de linhas. O V8 aponta a linha 67 como o único ramo não coberto (96,15% de branches): o `if (line)` só foi avaliado como verdadeiro. O ramo falso aparece quando o texto termina com `line` vazio, por exemplo uma descrição do bem só com espaços (`'   '` vira `['', '']`), caso que nenhum teste usa. Quem olha só os 100% de linhas conclui que o arquivo está completo.

O mesmo vale para `termo-storage.service.ts:6` (`@Injectable()`, 88,88% de branches): ali o ramo é artefato do decorator no V8, sem risco real.

---

### 4d. Oráculos: a LLM assumiu o comportamento do código em vez do requisito?

**Sim, na maior parte dos casos em que o requisito era omisso ou onde o código já continha um defeito.** Como o prompt recebeu tanto a matriz de rastreabilidade quanto os arquivos-fonte da US05, a LLM usou o comportamento implementado como fonte de verdade sempre que a matriz trazia resultados genéricos ("recusado") ou registrava pontos em aberto:

- **Defeito de armazenamento transformado em oráculo (ACH-15):** em `TermoStorageService › falha ao ler arquivo inexistente` (spec, linhas 277-279), o teste espera `rejects.toThrow(/ENOENT/)`. Os requisitos (CA-03, CA-04, CA-05) exigem tratamento de erro quando o termo não é encontrado, mas `termo-storage.service.ts:21-23` deixa o erro cru do `fs/promises` atravessar a fronteira (gerando HTTP 500 na API). A LLM cristalizou o defeito como comportamento esperado.
- **Premissa da matriz substituída pela validação do código:** a matriz (PR-04 / CT-05-21) previa "PDF com 1 byte aceito pela regra de tamanho", mas `emprestimos.service.ts:344-348` exige os 5 bytes mágicos `%PDF-`. A LLM descartou o caso de 1 byte da matriz e criou `aceita buffer de exatamente 5 bytes "%PDF-"` espelhando a implementação.
- **Textos de fallback copiados do código sem lastro nos CAs:** os oráculos `'Siape: Não informado'` (spec, linha 155), `'Tombamento/Nº de Série: Sem identificação'` (linha 191) e o tratamento de `new Date('invalido')` como `'INDEFINIDO'` (linhas 145-148) não aparecem no CA-02 e estavam marcados na matriz (PR-08) como *não cobertos por falta de requisito*; foram copiados diretamente de `termo-pdf.service.ts:28-31, 141-145`.
- **Regra de permissão para upload e confirmação:** a suíte afirma que o `ADMIN` é bloqueado por ser "somente leitura" ao anexar e confirmar, replicando `assertGestorDoEstoque` em `emprestimos.service.ts`, embora a matriz (PR-08) registre que as issues não definem quem pode executar essas ações.
- **Exceções internas em vez de contratos HTTP:** sem código HTTP nem mensagem fixados na matriz, a LLM conferiu o nome das classes internas (`AccessDeniedException`, `BusinessException`, `NotFoundException`) por `nomeClasse(e)` e colocou a verificação do status 400 dentro de um `if` condicional (spec, linha 697) para não falhar contra o código.
- **Assimetria de fuso horário espelhada da implementação (ACH-09):** a fronteira de dia (`00:00:00Z` e `23:59:59Z`) foi testada só na data de abertura porque `termo-pdf.service.ts:134` fixa `timeZone: 'UTC'` nela, enquanto `dataFechamento` (linha 135) fica sem fuso explícito e sem teste de virada de dia.

Nos pontos em que o critério de aceitação já era explícito e coincidia com o código — formato `"Nº XX/ano"` (CA-01), `"INDEFINIDO"` para data prevista nula (CA-02), rejeição de arquivo não-PDF (CA-06) e bloqueio de confirmação sem anexo (CA-07) — os oráculos atenderam ao requisito.
