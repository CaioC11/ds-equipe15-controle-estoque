# Medição e Análise Crítica da Suíte v2 — US05 (Termo de Responsabilidade)

Responsável: Randell · Issue: S3B-10 (#69) · Suíte v2: `controle-estoque-emprestimos-back/tests/v2/us05-termo.spec.ts` · Commit medido: `b9b67c5` (`main`).

Mesmo escopo e mesma ferramenta da v1 (Vitest 4.1.8 + `@vitest/coverage-v8`): `termo-pdf.service.ts`, `termo-storage.service.ts`, `termo-assinado.constants.ts`, `emprestimos.service.ts` e `emprestimos.controller.ts`, configuração `vitest.us05-v2.config.ts`. O relatório HTML está em `docs/testes/relatorios/v2/us05/index.html` e o resultado em `docs/testes/relatorios/resultados-v2-us05.json`.

Quatro medições entram na comparação:

- **v1 registrada (`24954a2`):** a da S3B-09, só a suíte v1.
- **v1 rebaselinada (`b9b67c5`):** a mesma suíte v1 rodada sobre o código atual. Existe porque o `emprestimos.service.ts` ganhou código depois do `24954a2` (o `assertSemAtraso` do PR #105), então 52,28% e 45,5% não são comparáveis.
- **v2 só novos (`b9b67c5`):** só `tests/v2/us05-termo.spec.ts`.
- **v2 completa (`b9b67c5`):** v1 + v2 rodadas juntas. É a que vale como "v2 (melhorada)".

## 1. Tabela de Indicadores

| Indicador | v1 registrada (24954a2) | v1 rebaselinada (b9b67c5) | v2 só novos | v2 completa |
| :--- | :--- | :--- | :--- | :--- |
| **Testes gerados** | 90 | 90 | 72 | 162 |
| **Testes passando** | 90 | 90 | 66 + 6 `it.fails` | 156 + 6 `it.fails` |
| **Testes falhando** | 0 | 0 | 0 | 0 |
| **Testes que não compilam** | 0 | 0 | 0 | 0 |
| **Linhas / branches, total (%)** | 66,66 / 63,63 | 60,91 / 56,2 | 70,07 / 55,47 | **80,28 / 71,53** |
| `termo-pdf.service.ts` | 100 / 96,15 (linha 67) | 100 / 96,15 (linha 67) | 97,26 / 76,92 (linhas 48-49) | **100 / 100** |
| `termo-storage.service.ts` | 100 / 88,88 (linha 6) | 100 / 88,88 (linha 6) | 12,5 / 11,11 (linhas 11-39) | 100 / 88,88 (linha 6) |
| `termo-assinado.constants.ts` | 100 / 100 | 100 / 100 | 100 / 100 | 100 / 100 |
| `emprestimos.service.ts` | 52,28 / 51,16 | 45,5 / 43,13 | 63,48 / 53,92 | **70,78 / 62,74** |
| `emprestimos.controller.ts` | 0 / 100 | 0 / 100 | 71,42 / 100 (linhas 49-101) | **71,42 / 100** (linhas 49-101) |
| **Casos de teste (CTs) cobertos** | 17/29 (3 Sim, 14 Sim*, 12 Não) | igual à registrada (a suíte é a mesma) | n.d. (a matriz mede a v2 completa) | **25/29 (86,21%)**: 3 Sim, 22 Sim*, 4 Não (CT-05-16, 24, 25, 27, front) |
| **Partições cobertas** | 21/26 | igual à registrada | n.d. | **26/26** (5 Sim, 21 Sim*) |
| **Limites cobertos** | 1/4 fronteiras completas | igual à registrada | n.d. | **4/4** (LM-01 a LM-04, todas Sim*) |
| **Critérios de aceitação (CAs)** | 8/8 com ao menos um teste; ressalvas em CA-01, 03, 05, 07 e 08 | igual à registrada | n.d. | **8/8** |
| **Testes triviais** | 5 `toBeDefined()` + 1 asserção condicional | igual à registrada | 0 | 5 (os da v1, que continuam na v1) + 1 condicional (v1) |
| **Defeitos reais identificados** | 0 | 0 | 2 (6 `it.fails`) | 2 (6 `it.fails`) |

Notas da tabela:

- Os 6 `it.fails` passam enquanto o defeito existe. Entram em "passando" e são informados à parte.
- Na v2, o comando `grep -nE "toBeDefined|toBeTruthy|toBeFalsy" controle-estoque-emprestimos-back/tests/v2/us05-termo.spec.ts` não encontrou nenhuma ocorrência. Os 5 `toBeDefined()` da v1 (linhas 528, 616, 730, 743, 783) continuam na v1, que não foi editada.
- A v1 rebaselinada tem a mesma suíte de CTs, partições e limites da registrada, porque o mapeamento da matriz é por teste e a suíte não mudou. Só a cobertura muda, por causa do código novo no `emprestimos.service.ts`.
- Os CTs, partições e limites da v2 saem da matriz (`matriz-rastreabilidade-us5.md`, seções 6 e 9). A matriz mede a v2 completa.
- O CA-01 conta como coberto na v1, porque `exibe o número sequencial no formato "Nº XX/ano"…` existia, mas com ressalva: só a exibição, sem o `padStart` nem o reinício por ano.

## 2. Efeito de cada lacuna

As medições são por suíte, não por lacuna. Onde o efeito medido aparece, vale para o conjunto da suíte v2.

| Lacuna | Testes novos (nomes na spec) | O que passou a ser coberto | Efeito medido |
| :--- | :--- | :--- | :--- |
| **G-01** numeração em `EmprestimosService.create` | `primeiro termo do ano recebe o número "01/2026"`; `termo seguinte recebe o número anterior + 1, no mesmo ano`; `com o último número do ano em 41, o próximo termo é "42/2026"`; `em 31/12 a sequência do ano que termina continua ("07/2026")`; `em 01/01 o primeiro termo do ano novo é "01/2027" (reinicia)`; `31/12 continua a sequência e 01/01 reinicia, na mesma execução`; `o número nunca é 0: a sequência começa em 1`; `o número %i é formatado como "%s" (sem truncar)` (1, 9, 10, 99, 100); `P2002 ao obter o número…`; `P2002 ao gravar o termo…`; `o mesmo numeroAno chega a termoPdf.gerar e a tx.termo.create…` | CT-05-01 a 06, PNT-01 a 04, LM-03, LM-04 | `emprestimos.service.ts` 45,5 → 63,48 de linhas (v2 só novos, junto de G-02 a G-09) |
| **G-02** consulta não consome número | `obterPdf: duas consultas devolvem o mesmo nomeArquivo e não chamam o contador`; `obterPdf como ADMIN também não consome número`; `obterPdfAssinado: duas consultas devolvem o mesmo nomeArquivo e não chamam o contador` | CT-05-07, PNT-05 | incluído no total do service |
| **G-03** controller | `devolve StreamableFile application/pdf com disposition "inline"` e `"attachment"`; `repassa (estoqueId, id, user) ao service`; `propaga sem alterar a AccessDeniedException (403)`; `propaga sem alterar a ResourceNotFoundException (404)`; `repassa (estoqueId, id, arquivo, user.userId)…`; `sem usuário, o userId repassado é undefined`; `repassa arquivo ausente ao service e propaga o erro 400`; `propaga sem alterar o erro 409 do service (confirmação sem anexo)` | CT-05-11 a 15, 17 e 26 no nível HTTP | `emprestimos.controller.ts` 0 → 71,42 de linhas (linhas 49-101 sem cobertura) |
| **G-04** códigos HTTP estritos | 403 (`gestor de outro estoque (USER sem vínculo)`, `requisitante sem vínculo`, `usuário USER sem userId`, `sem usuário autenticado`), 404 (`empréstimo inexistente`, `estoque inexistente`, `obterPdf: empréstimo sem termo`, `obterPdfAssinado: termo sem PDF assinado`), 400 (`anexar sem arquivo`, `anexar arquivo que não é PDF`), 403 (`anexar por quem não é gestor do estoque`), 409 (`confirmar entrega sem termo assinado`) | CT-05-13 e 14 com o código HTTP verificado | substitui o `if (typeof e.getStatus === 'function')` da v1 (linha 697) |
| **G-05** ACH-15 | `obterPdf: ENOENT do storage vira ResourceNotFoundException (404)`; `obterPdfAssinado: ENOENT do storage vira ResourceNotFoundException (404)` (ambos `it.fails`) | CA-04 diante de arquivo sumido do storage | 2 `it.fails`: o defeito é real |
| **G-06** ACH-09 | para `dataFechamento` e `dataAbertura`: dois `it.fails` (`2026-11-21T02:30:00Z é exibida como 20/11/2026`; `2026-11-20T23:59:59-03:00 é exibida como 20/11/2026`) e um teste normal (`2026-11-20T00:00:00-03:00 é exibida como 20/11/2026`), com `TZ=UTC` | CA-02, fuso das datas | 4 `it.fails`: o defeito é real |
| **G-07** 1 byte | `arquivo mínimo válido é aceito (buffer real "%PDF-", 5 bytes)`; `arquivo de 1 byte ("%") é recusado com 400` | CT-05-21, LM-01 (lado válido reescrito para 5 bytes; PR-04 registrada como não válida) | LM-01 passa de Parcial a coberto |
| **G-08** 5 MB com buffer real | `buffer real de exatamente 5 MB começando por "%PDF-" é aceito`; `buffer real de 5 MB + 1 byte começando por "%PDF-" é recusado com 400` | LM-02, CT-05-22 e 23 sem mock de `size` | LM-02 deixa de depender só do número |
| **G-09** triviais da v1 | `ADMIN acessa o PDF assinado sem ser gestor: devolve o conteúdo e o nome corretos`; `ignora falha ao remover o arquivo anterior e conclui o upload com os valores corretos`; `aceita arquivo com exatamente 5 MB (size) e grava o buffer enviado`; `aceita arquivo com 5 MB - 1 byte (size) e grava o buffer enviado`; `aceita buffer de exatamente 5 bytes "%PDF-" e grava esse buffer` | os 5 `toBeDefined()` da v1 viram asserções de valor | 0 triviais na v2 |
| **G-10** linha 67 do `termo-pdf.service.ts` | `gera PDF válido e mantém denominação e declaração de responsabilidade` | ramo falso de `if (line)` | `termo-pdf.service.ts` 96,15 → 100 de branches (v2 completa) |
| **G-11** botões da tela | nenhum teste de back | CT-05-16, 24, 25, 27 (front-end) | 4 CTs `Não (front)` |

Mapeamento por conteúdo: a spec da v2 usa números de CT que, em G-01, diferem dos da matriz (por exemplo, ela rotula o teste de 31/12 como CT-05-03, e a matriz o chama de CT-05-04). A spec não pode ser editada, então esta análise usa os IDs da matriz.

## 3. Leitura crítica

### (a) Por que a v2 só dos novos cobre menos que a v1 em storage e `termo-pdf`

- **`termo-storage.service.ts`:** a v2 cai para 12,5% de linhas e 11,11% de branches (linhas 11-39 sem cobertura), porque o storage é simulado com `vi.fn()`. A v1 o exercitava de verdade, numa pasta temporária (grava, lê, `wx`, path traversal).
- **`termo-pdf.service.ts`:** a v2 só dos novos fica em 97,26% de linhas e 76,92% de branches, com as linhas 48-49 (quebra de página, `addPageIfNeeded`) descobertas. Só os testes da v1 forçam essa quebra.
- **Consequência:** a v2 não substitui a v1; as duas se complementam. Por isso a medição que vale é a v2 completa (v1 + v2), em que o storage volta a 100% de linhas e o `termo-pdf` chega a 100% nas duas métricas.

### (b) O que a v1 rebaselinada mostra para `emprestimos.service.ts`

O `emprestimos.service.ts` foi de 52,28% de linhas e 51,16% de branches (em `24954a2`) para 45,5% e 43,13% (em `b9b67c5`) com a mesma suíte v1. Nenhum teste da v1 mudou: o que mudou foi o código do arquivo, que ganhou o `assertSemAtraso` e outros trechos do PR #105. As linhas novas entram no denominador e não são exercitadas pela v1. Por isso a comparação de ganho da v2 usa 43,13% como ponto de partida, e não 51,16%.

### (c) Branches acima da v1, por arquivo e no total (v2 completa contra v1 rebaselinada)

| Escopo | v1 rebaselinada | v2 completa | Variação |
| :--- | :--- | :--- | :--- |
| Total | 56,2 | 71,53 | sobe |
| `termo-pdf.service.ts` | 96,15 | 100 | sobe |
| `emprestimos.service.ts` | 43,13 | 62,74 | sobe |
| `termo-storage.service.ts` | 88,88 | 88,88 | igual (linha 6, `@Injectable`, artefato do V8) |
| `emprestimos.controller.ts` | 100 | 100 | igual (na v1, artefato do V8 de arquivo não executado; na v2 há ramo medido) |
| `termo-assinado.constants.ts` | 100 | 100 | igual |

A meta "branches acima da v1" foi atingida no total e nos dois arquivos que tinham espaço para subir; nos outros três ficou igual. Não é estritamente "acima em todos os arquivos".

### (d) Oráculos: onde o requisito manda e onde o código diverge

- **Oráculo do requisito, com o código divergindo (os 2 defeitos reais):**
  - **ACH-15 (2 `it.fails`):** o requisito CA-04 pede erro tratado (404) quando o recurso não existe. Se o storage lança ENOENT em `obterPdf` ou `obterPdfAssinado`, o erro de disco atravessa o storage e vira 500 (`termo-storage.service.ts:21-23`).
  - **ACH-09 (4 `it.fails`):** o requisito CA-02 pede as datas do termo e, no uso real, o instante `2026-11-21T02:30:00Z` é 20/11 em Recife. O PDF não usa o fuso America/Recife e exibe a data do fuso do processo.
- **Oráculos que não vêm literalmente de um CA** (a revisão contra o requisito da Tarefa 1 apontou): os códigos 400 e 409 (G-04), o limite mínimo de 5 bytes (G-07), o fuso America/Recife (G-06) e o 404 para arquivo ausente (G-05). Eles decorrem da premissa da matriz ou do comportamento esperado de uma API, e não de uma frase do critério. Por isso estão registrados como premissa e revisados, e não como regra do requisito.

### (e) Pontos a confirmar com a equipe (não são defeitos)

1. **`traduzirErroDeUnicidade`:** converte qualquer P2002 na mensagem "Responsável já cadastrado com este Siape ou CPF", mesmo quando o conflito é do número do termo (os testes de G-01 com P2002 convivem com isso). Confirmar se a mensagem deve distinguir os dois casos.
2. **Ano do termo:** vem de `new Date().getFullYear()` e não de `dataRetirada`, enquanto a premissa PR-05 diz "ano da data de abertura do empréstimo". Confirmar qual vale.

## 4. Limitações e decisões em aberto

- **`it.fails` contra teste vermelho:** os 6 `it.fails` mantêm a suíte passando enquanto o defeito existe. O grupo precisa decidir se prefere deixar o teste vermelho até corrigir ACH-15 e ACH-09, ou manter `it.fails` e abrir issue.
- **G-11 (front):** CT-05-16, 24, 25 e 27 dependem da tela e ficam fora da suíte de back. O front tem Vitest (`pages/emprestimos/index.test.tsx`); cobri-los lá é outra tarefa.
- **Convenção "v2 completa":** a meta de cobertura vale para v1 + v2 juntas, porque a v2 só dos novos simula o storage e perde linhas que a v1 cobre.
- **Partições PPF-03 e PPF-04:** o código não distingue "gestor de outro estoque" de "requisitante": ambos caem em `assertGestorDoEstoque` e na ausência de vínculo. Os dois testes são equivalentes no código, e a cobertura das duas partições tem a mesma base.
- **Erro de tipo TS2339** na linha 742 da spec da v2 (`headers.disposition?.startsWith`, tipo `string | string[]`). Sem efeito na execução, porque o Vitest não checa tipos; não foi corrigido porque a spec gerada não é editada à mão.
- **Oráculos (4ª pergunta da Etapa 4):** foi respondida para a v1 em `analise-critica-v1-us5.md` (S3B-09). A seção 3(d) desta análise a retoma para a v2.
