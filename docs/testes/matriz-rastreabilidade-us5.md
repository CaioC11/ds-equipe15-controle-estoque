# Matriz de rastreabilidade — US05 (Termo de Responsabilidade)

Sprint 3, Parte 1 (suíte de testes gerada por LLM). Responsável: Randell. Issue: S3B-06 (#65).

Esta matriz foi escrita **antes** de qualquer interação com a LLM. Os resultados esperados vêm dos critérios de aceitação da US05 (issues #20 e #83), não do código. Onde o requisito não define o comportamento, o ponto está registrado como **premissa** (seção 5) e marcado com `*` nas tabelas.

## 1. Escopo

- User story: US05, o requisitante recebe o Termo de Responsabilidade ao retirar um item emprestado, formalizando a posse temporária do equipamento.
- Operações cobertas: gerar o termo em PDF para um empréstimo (#20), visualizar e baixar o PDF (#20 e #83), anexar o PDF assinado (#83) e confirmar a entrega (#83).
- Os resultados "recusado" não fixam código HTTP nem texto exato, porque o requisito não define esses detalhes. As mensagens e os códigos serão conferidos contra o que a equipe definir.

## 2. Critérios de aceitação

| ID | Critério (fonte) |
|----|------------------|
| CA-01 | PDF gerado com número sequencial por ano (contador simples), no formato "Nº XX/ano" (#20) |
| CA-02 | O PDF contém: responsável (nome, Siape, lotação e cargo), unidade de acautelamento (estoque), data de abertura, data prevista (ou "INDEFINIDO"), bens (tombamento ou nº de série, e denominação) e declaração de responsabilidade (#20) |
| CA-03 | Endpoint para visualizar e baixar o PDF; acesso do gestor do estoque e leitura do ADMIN (#20) |
| CA-04 | Erro tratado para empréstimo inexistente (#20) |
| CA-05 | Visualizar e baixar o PDF do termo gerado pelo sistema (#83) |
| CA-06 | Anexar o PDF assinado ao empréstimo (upload) (#83) |
| CA-07 | Botão de confirmar entrega, habilitado só após o anexo (#83) |
| CA-08 | Mensagens de erro e sucesso para o upload e para a confirmação (#83) |

O critério "Nenhum modelo oficial com dados reais no repositório" da issue #20 é regra de repositório e não um comportamento do sistema, então não entra na contagem de cobertura de requisitos.

## 3. Variáveis de entrada e partições de equivalência

`V` = válida, `I` = inválida, `*` = depende de premissa da seção 5.

| Variável | ID | Partição | Tipo |
|----------|----|----------|------|
| número do termo | PNT-01 | primeiro termo do ano | V |
| número do termo | PNT-02 | termo seguinte ao último do ano | V |
| número do termo | PNT-03 | primeiro termo do ano seguinte (reinicia) | V |
| número do termo | PNT-04 | número já usado no mesmo ano | I |
| número do termo | PNT-05 | consulta repetida ao termo do mesmo empréstimo | V* |
| empréstimo | PEE-01 | existente | V |
| empréstimo | PEE-02 | inexistente | I |
| perfil (visualizar/baixar) | PPF-01 | gestor do estoque do empréstimo | V |
| perfil (visualizar/baixar) | PPF-02 | ADMIN (leitura) | V |
| perfil (visualizar/baixar) | PPF-03 | gestor de outro estoque | I* |
| perfil (visualizar/baixar) | PPF-04 | requisitante | I* |
| dados do responsável | PRS-01 | nome, Siape, lotação e cargo informados | V |
| data prevista | PDP-01 | informada | V |
| data prevista | PDP-02 | ausente (indefinida) | V |
| bens | PBE-01 | item com tombamento | V |
| bens | PBE-02 | item sem tombamento, com nº de série | V |
| anexo (termo assinado) | PAX-01 | arquivo PDF | V |
| anexo (termo assinado) | PAX-02 | arquivo que não é PDF | I |
| anexo (termo assinado) | PAX-03 | ausente | I |
| anexo (termo assinado) | PAX-04 | arquivo vazio (0 bytes) | I* |
| tamanho do anexo | PTM-01 | de 1 byte até o tamanho máximo | V* |
| tamanho do anexo | PTM-02 | acima do tamanho máximo | I* |
| confirmação da entrega | PCF-01 | com anexo | V |
| confirmação da entrega | PCF-02 | sem anexo | I |
| estado do empréstimo | PEM-01 | pendente (termo gerado, entrega não confirmada) | V* |
| estado do empréstimo | PEM-02 | entrega já confirmada (ativo) | I* |

Total: **26 partições** (18 definidas pelo requisito e 8 dependentes de premissa: PNT-05, PPF-03, PPF-04, PAX-04, PTM-01, PTM-02, PEM-01 e PEM-02).

## 4. Valores-limite (dois lados de cada fronteira)

| ID | Fronteira | Lado inválido | Lado válido |
|----|-----------|---------------|-------------|
| LM-01 | tamanho do anexo: vazio × mínimo* | 0 bytes | 1 byte |
| LM-02 | tamanho do anexo: máximo × máximo + 1* | máximo + 1 byte (5 MB + 1 byte) | máximo (5 MB) |
| LM-03 | virada de ano: 31/12 × 01/01* | 31/12: reiniciar a numeração (o ano ainda é o mesmo) | 01/01: reiniciar a numeração (ano novo) |
| LM-04 | início da sequência do ano: 0 × 1* | número 0 | número 1 |

Total: **4 fronteiras, 8 valores**.

## 5. Premissas a confirmar com a equipe

Pontos que as issues #20 e #83 não definem. Se a resposta for diferente, ajustar a linha correspondente antes do commit.

| ID | Premissa adotada na matriz | Por que precisa confirmar |
|----|----------------------------|---------------------------|
| PR-01 | O upload do PDF assinado e a confirmação da entrega têm suporte no backend, e a recusa de confirmar sem anexo vale também fora do botão | A #20 cobre só a geração e a consulta do PDF; a #83 descreve só a tela |
| PR-02 | O empréstimo fica pendente depois de gerado o termo e vira ativo ao confirmar a entrega (não ao anexar) | A #83 só diz que o botão é habilitado após o anexo; a #65 cita "upload do assinado e ativação" sem dizer o estado |
| PR-03 | Gestor de outro estoque e requisitante recebem 403 ao visualizar ou baixar o termo | A #20 diz só quem tem acesso (gestor do estoque e ADMIN) |
| PR-04 | O tamanho máximo do anexo é 5 MB e arquivo de 0 bytes é inválido | A #83 não define limite de tamanho |
| PR-05 | A numeração começa em 1 a cada ano e o ano é o da data de abertura do empréstimo | A #20 diz só "Nº XX/ano" e "contador simples" |
| PR-06 | Cada empréstimo recebe um único número de termo; visualizar ou baixar de novo não consome número novo | A #20 não diz se o número é fixado na geração ou a cada consulta |
| PR-07 | Anexar ou confirmar em empréstimo com entrega já confirmada é recusado | Nenhuma das issues trata esse caso |
| PR-08 | **Não cobertos** por falta de requisito: dados incompletos do responsável (ex.: sem Siape), item sem tombamento e sem nº de série, data prevista anterior à data de abertura, e quem pode anexar ou confirmar | As issues não definem o comportamento |

## 6. Matriz de rastreabilidade

Legenda das colunas "Coberto pela v1?" (preenchida na S3B-09, suíte `tests/v1-llm/us05-termo.spec.ts`, commit `24954a2`) e "Coberto pela v2?" (preenchida na S3B-10, v2 completa = `tests/v1-llm/us05-termo.spec.ts` + `tests/v2/us05-termo.spec.ts`, medida no commit `b9b67c5`):

- **Sim:** coberto por teste sem simular a lógica sob teste (o PDF é gerado de verdade).
- **Sim\*:** coberto só com Prisma e/ou `TermoStorageService` simulados (mocks), ou com o `EmprestimosService` simulado no teste do controller.
- **Parcial:** coberto em parte (nenhum CT ficou nesta categoria; só o limite LM-01 na v1).
- **Não:** nenhum teste da suíte cobre; o motivo vem na célula.

Na coluna da v2, "v1" indica que a v2 não muda nada e o teste citado é o da v1. Os demais nomes são testes de `tests/v2/us05-termo.spec.ts`. Os testes `it.fails` (ACH-15 e ACH-09) não são a única evidência de nenhum CT.

| Requisito / critério | Variável | Partição ou limite | Caso de teste esperado | Coberto pela v1? | Coberto pela v2? |
|----------------------|----------|--------------------|------------------------|------------------|------------------|
| CA-01 | número do termo | PNT-01 | CT-05-01: gerar o termo do 1º empréstimo do ano → PDF gerado com número sequencial 1 do ano | Não — numeração por ano nasce em `EmprestimosService.create` (`emprestimos.service.ts:130-135`), sem teste na suíte da US05. | Sim\* — lacuna G-01: `primeiro termo do ano recebe o número "01/2026"`; `o mesmo numeroAno chega a termoPdf.gerar e a tx.termo.create, com caminho no padrão "<ano>/<uuid>.pdf"`. Contador simulado em `tx.contadorTermo.upsert`, respeitando os argumentos recebidos. |
| CA-01 | número do termo | PNT-02 | CT-05-02: gerar o termo de um novo empréstimo após um termo existente → número = anterior + 1 | Não — numeração por ano nasce em `EmprestimosService.create` (`emprestimos.service.ts:130-135`), sem teste na suíte da US05. | Sim\* — lacuna G-01: `termo seguinte recebe o número anterior + 1, no mesmo ano`; `com o último número do ano em 41, o próximo termo é "42/2026"`. |
| CA-01 (PR-05*) | número do termo | PNT-03, LM-03 (lado válido) | CT-05-03*: gerar o termo de um empréstimo aberto em 01/01 do ano seguinte → número reinicia em 1 do novo ano | Não — numeração por ano nasce em `EmprestimosService.create` (`emprestimos.service.ts:130-135`), sem teste na suíte da US05. Virada de ano não exercitada. | Sim\* — lacuna G-01: `em 01/01 o primeiro termo do ano novo é "01/2027" (reinicia)`; `31/12 continua a sequência e 01/01 reinicia, na mesma execução`. O ano vem de `new Date()` com relógio fixo (ponto a confirmar sobre a PR-05). |
| CA-01 (PR-05*) | número do termo | LM-03 (lado inválido) | CT-05-04*: gerar o termo de um empréstimo aberto em 31/12 após o termo N → número é N + 1 do mesmo ano, sem reiniciar | Não — numeração por ano nasce em `EmprestimosService.create` (`emprestimos.service.ts:130-135`), sem teste na suíte da US05. Virada de ano não exercitada. | Sim\* — lacuna G-01: `em 31/12 a sequência do ano que termina continua ("07/2026")`; `31/12 continua a sequência e 01/01 reinicia, na mesma execução`. |
| CA-01 | número do termo | PNT-04 | CT-05-05: gerar dois termos seguidos → números distintos; apenas 1 termo por número no ano | Não — numeração por ano nasce em `EmprestimosService.create` (`emprestimos.service.ts:130-135`), sem teste na suíte da US05. O `it.each` de `termo-pdf.service.ts:117` só imprime a string recebida, não prova unicidade. | Sim\* — lacuna G-01: `termo seguinte recebe o número anterior + 1, no mesmo ano` (números distintos); `P2002 ao obter o número: erro vira ResourceConflictException (409) e nada é gerado`; `P2002 ao gravar o termo: empréstimo não é vinculado e o erro vira 409`. A mensagem do 409 não é afirmada (ponto a confirmar sobre `traduzirErroDeUnicidade`). |
| CA-01 (PR-05*) | número do termo | LM-04 (lado inválido) | CT-05-06*: primeiro termo do ano → número é 1, nunca 0 | Não — numeração por ano nasce em `EmprestimosService.create` (`emprestimos.service.ts:130-135`), sem teste na suíte da US05. Número 0 nunca é produzido nem verificado. | Sim\* — lacuna G-01: `o número nunca é 0: a sequência começa em 1`; `o número %i é formatado como "%s" (sem truncar)` (casos 1, 9, 10, 99 e 100). |
| CA-01 (PR-06*) | número do termo | PNT-05 | CT-05-07*: consultar duas vezes o termo do mesmo empréstimo → mesmo número nas duas consultas; o contador não avança | Não — nenhum teste verifica que `obterPdf` (`emprestimos.service.ts:185`) deixa o `contadorTermo` intacto. | Sim\* — lacuna G-02: `obterPdf: duas consultas devolvem o mesmo nomeArquivo e não chamam o contador`; `obterPdf como ADMIN também não consome número`; `obterPdfAssinado: duas consultas devolvem o mesmo nomeArquivo e não chamam o contador`. |
| CA-02 | dados do responsável, data prevista, bens | PRS-01, PDP-01, PBE-01 | CT-05-08: termo de item com tombamento e data prevista informada → PDF com responsável (nome, Siape, lotação, cargo), unidade de acautelamento (estoque), data de abertura, data prevista, tombamento e denominação do bem, e declaração de responsabilidade | Sim — `devolve bytes de um PDF válido`; `exibe o número sequencial no formato "Nº XX/ano"…`; `contém dados do responsável, unidade, datas, bem e declaração` (`termo-pdf.service.ts:117-150`). | Sim — v1 (sem mudança no status). A v2 acrescenta, na lacuna G-06: `dataFechamento: 2026-11-20T00:00:00-03:00 é exibida como 20/11/2026` e `dataAbertura: 2026-11-20T00:00:00-03:00 é exibida como 20/11/2026`. Os outros instantes ficam nos `it.fails` do ACH-09. |
| CA-02 | data prevista | PDP-02 | CT-05-09: termo de empréstimo sem data prevista → PDF mostra "INDEFINIDO" no campo da data prevista | Sim — `mostra "INDEFINIDO" quando a data prevista de fechamento é nula` e `…é uma Date inválida` (`termo-pdf.service.ts:28-31, 135-138`). | Sim — v1 (sem mudança). |
| CA-02 | bens | PBE-02 | CT-05-10: termo de item sem tombamento, com nº de série → bem identificado pelo nº de série e pela denominação | Sim — `usa o nº de série quando não há tombamento`; `usa o tombamento quando…`; `mostra "Sem identificação"…` (`termo-pdf.service.ts:141-145`). | Sim — v1. A v2 complementa, na lacuna G-10: `gera PDF válido e mantém denominação e declaração de responsabilidade` (descrição do bem só com espaços). |
| CA-03 | perfil, empréstimo | PPF-01, PEE-01 | CT-05-11: gestor do estoque do empréstimo visualiza e baixa o PDF → PDF devolvido | Sim* — `gestor do estoque recebe o PDF gerado e o nome do arquivo` (`obterPdf`, `emprestimos.service.ts:185`; Prisma e storage simulados). Controller sem teste. | Sim\* — v1 (service) e, na lacuna G-03, no controller com o service simulado: `devolve StreamableFile application/pdf com disposition "inline" contendo o nomeArquivo` (`visualizarTermo`); `devolve StreamableFile application/pdf com disposition "attachment" contendo o nomeArquivo` (`baixarTermo`); `repassa (estoqueId, id, user) ao service`. |
| CA-03 | perfil, empréstimo | PPF-02, PEE-01 | CT-05-12: ADMIN consulta o PDF de qualquer empréstimo → PDF devolvido (leitura) | Sim* — `ADMIN acessa mesmo sem ser gestor e sem consultar o vínculo` (Prisma e storage simulados). | Sim\* — v1; a v2 acrescenta `obterPdf como ADMIN também não consome número` (G-02) e `ADMIN acessa o PDF assinado sem ser gestor: devolve o conteúdo e o nome corretos` (G-09, no lugar do `toBeDefined` da v1). |
| CA-03 (PR-03*) | perfil | PPF-03 | CT-05-13*: gestor de outro estoque tenta ver o PDF → 403, nenhum PDF devolvido | Sim* — `recusa usuário não gestor e não ADMIN` (AccessDeniedException; o código HTTP 403 não é verificado). | Sim\* — lacuna G-04, agora com `getStatus()` igual a 403: `gestor de outro estoque (USER sem vínculo) recebe 403 AccessDeniedException`; no controller, `propaga sem alterar a AccessDeniedException (403) do service`. |
| CA-03 (PR-03*) | perfil | PPF-04 | CT-05-14*: requisitante tenta ver o PDF → 403, nenhum PDF devolvido | Sim* — `recusa usuário não gestor e não ADMIN` e `recusa quando não há usuário autenticado` (perfil REQUISITANTE; 403 não verificado). | Sim\* — lacuna G-04, com 403 verificado: `requisitante sem vínculo recebe 403 AccessDeniedException`; `usuário USER sem userId recebe 403 AccessDeniedException`; `sem usuário autenticado recebe 403 AccessDeniedException`. |
| CA-04 | empréstimo | PEE-02 | CT-05-15: consultar o PDF de empréstimo inexistente → erro tratado (não encontrado), nenhum PDF gerado | Sim* — `trata empréstimo inexistente como recurso não encontrado` e `estoque inexistente resulta em não encontrado`. | Sim\* — v1; a v2 acrescenta, com 404 verificado (lacuna G-04): `empréstimo inexistente recebe 404 ResourceNotFoundException`; `estoque inexistente recebe 404 ResourceNotFoundException`; no controller, `propaga sem alterar a ResourceNotFoundException (404) do service`. O arquivo ausente no storage (ENOENT, ACH-15) não é um CT da matriz; ver os 2 `it.fails` da lacuna G-05. |
| CA-05 | perfil, empréstimo | PPF-01, PEE-01 | CT-05-16: na tela do termo, usuário com acesso vê o PDF do termo gerado e consegue baixá-lo | Não — depende da tela (front-end); a suíte cobre só o back. | Não (front) — lacuna G-11: depende da tela e fica fora dos testes de back; a v2 não gera teste para ela. |
| CA-06, CA-08 (PR-04*, PR-02*) | anexo, tamanho, estado do empréstimo | PAX-01, PTM-01, PEM-01 | CT-05-17*: anexar PDF de 2 MB a empréstimo pendente → upload aceito, com mensagem de sucesso | Sim* — `valida, grava e anexa o PDF assinado ao empréstimo` (`anexarTermoAssinado`, `emprestimos.service.ts:209`). Mensagem de sucesso fica no controller (0%). | Sim\* — v1; a v2 acrescenta `repassa (estoqueId, id, arquivo, user.userId) e devolve o resultado do service` (controller, lacuna G-03) e `ignora falha ao remover o arquivo anterior e conclui o upload com os valores corretos` (G-09). |
| CA-06, CA-08 | anexo | PAX-02 | CT-05-18: anexar arquivo que não é PDF → recusado, com mensagem de erro; nenhum anexo registrado | Sim* — `rejeita mimetype "image/png"/"text/plain"/…` e `rejeita mimetype application/pdf com conteúdo que não é PDF` (`validarPdf`, `emprestimos.service.ts:332-350`). | Sim\* — v1; a v2 acrescenta `anexar arquivo que não é PDF recebe 400 AppException VALIDATION_FAILED` (G-04). |
| CA-06, CA-08 | anexo | PAX-03 | CT-05-19: enviar sem selecionar arquivo → recusado, com mensagem de erro | Sim* — `rejeita requisição sem arquivo` (`emprestimos.service.ts:336-338`). | Sim\* — v1; a v2 acrescenta `anexar sem arquivo recebe 400 AppException VALIDATION_FAILED` (G-04) e, no controller, `repassa arquivo ausente ao service e propaga o erro 400 sem alterar` (G-03). |
| CA-06, CA-08 (PR-04*) | anexo, tamanho | PAX-04, LM-01 (lado inválido) | CT-05-20*: anexar PDF de 0 bytes → recusado, com mensagem de erro; nenhum anexo registrado | Sim* — `rejeita arquivo com buffer vazio (0 bytes)` (`emprestimos.service.ts:336`). | Sim\* — v1 (sem mudança no status). |
| CA-06 (PR-04*) | tamanho | PTM-01, LM-01 (lado válido) | CT-05-21*: arquivo mínimo válido (5 bytes, `%PDF-`) é aceito. A premissa PR-04 (PDF aceito com 1 byte) não é válida: `validarPdf` exige `%PDF-` | Não — um PDF de 1 byte nunca é aceito: `validarPdf` exige `%PDF-` (`emprestimos.service.ts:344-348`). O menor aceito é `aceita buffer de exatamente 5 bytes "%PDF-"`; a premissa PR-04 não se sustenta como escrita. | Sim\* — lacuna G-07: `arquivo mínimo válido é aceito (buffer real "%PDF-", 5 bytes)`; `arquivo de 1 byte ("%") é recusado com 400`; e, na G-09, `aceita buffer de exatamente 5 bytes "%PDF-" e grava esse buffer`. Premissa PR-04 (1 byte) registrada como não válida. |
| CA-06 (PR-04*) | tamanho | PTM-01, LM-02 (lado válido) | CT-05-22*: anexar PDF com exatamente 5 MB → aceito | Sim* — `aceita arquivo com exatamente 5 MB` e `…5 MB - 1 byte`; o `size` vem do mock, o buffer real tem poucos bytes. | Sim\* — lacuna G-08, com buffer real: `buffer real de exatamente 5 MB começando por "%PDF-" é aceito`; e, na G-09, `aceita arquivo com exatamente 5 MB (size) e grava o buffer enviado` e `aceita arquivo com 5 MB - 1 byte (size) e grava o buffer enviado`. |
| CA-06, CA-08 (PR-04*) | tamanho | PTM-02, LM-02 (lado inválido) | CT-05-23*: anexar PDF com 5 MB + 1 byte → recusado, com mensagem de erro | Sim* — `rejeita arquivo com 5 MB + 1 byte` (`size` simulado; `emprestimos.service.ts:339`). | Sim\* — lacuna G-08, com buffer real: `buffer real de 5 MB + 1 byte começando por "%PDF-" é recusado com 400`. |
| CA-07 | confirmação da entrega | PCF-02 | CT-05-24: empréstimo sem anexo → botão "Confirmar entrega" desabilitado | Não — depende do botão no front-end. | Não (front) — lacuna G-11: depende do botão da tela e fica fora dos testes de back. |
| CA-07 | confirmação da entrega | PCF-01 | CT-05-25: depois de anexar um PDF válido → botão "Confirmar entrega" habilitado | Não — depende do botão no front-end. | Não (front) — lacuna G-11: depende do botão da tela e fica fora dos testes de back. |
| CA-07, CA-08 (PR-02*) | confirmação da entrega, estado do empréstimo | PCF-01, PEM-01 | CT-05-26*: confirmar a entrega com anexo → entrega confirmada, empréstimo ativo e mensagem de sucesso | Sim* — `confirma a entrega: empréstimo vira ATIVO e item vira EMPRESTADO` (`confirmarEntrega`, `emprestimos.service.ts:286`). Mensagem de sucesso fica no controller (0%). | Sim\* — v1; a v2 acrescenta, no controller (lacuna G-03): `repassa (estoqueId, id, user.userId) e devolve o resultado do service`; `sem usuário, o userId repassado é undefined`. |
| CA-06, CA-07 | anexo, confirmação da entrega | PAX-02, PAX-01, PCF-02 | CT-05-27: upload inválido seguido de upload válido → o botão só é habilitado depois do upload válido | Não — depende do estado do botão no front-end. | Não (front) — lacuna G-11: depende do estado do botão da tela e fica fora dos testes de back. |
| CA-06, CA-07, CA-08 (PR-07*) | estado do empréstimo | PEM-02 | CT-05-28*: anexar ou confirmar em empréstimo com entrega já confirmada → recusado, com mensagem de erro; estado inalterado | Sim* — `recusa anexar quando o status é ATIVO`/`DEVOLVIDO`; `bloqueia a confirmação quando o status é ATIVO`/`DEVOLVIDO`; `informa que a entrega já foi confirmada…`. | Sim\* — v1 (sem mudança no status). |
| CA-07, CA-08 (PR-01*) | confirmação da entrega | PCF-02 | CT-05-29*: tentar confirmar a entrega sem anexo, sem usar o botão → recusado, com mensagem de erro; entrega não confirmada | Sim* — `bloqueia a confirmação enquanto o termo assinado não foi anexado`; `trata caminho assinado vazio como não anexado`. | Sim\* — v1; a v2 acrescenta `confirmar entrega sem termo assinado recebe 409 ResourceConflictException` (G-04) e, no controller, `propaga sem alterar o erro 409 do service (confirmação sem anexo)` (G-03). |


## 7. Totais (contados nesta matriz)

| Indicador | Total |
|-----------|-------|
| Critérios de aceitação (CA-01 a CA-08) | 8 |
| Partições de equivalência | 26 |
| Fronteiras de valor-limite | 4 (8 valores) |
| Casos de teste esperados | 29 (14 dependem de premissa: CT-05-03, 04, 06, 07, 13, 14, 17, 20, 21, 22, 23, 26, 28, 29) |

## 8. Cobertura da suíte v1 (S3B-09)

Medição: `npx vitest run --config vitest.us05.config.ts tests/v1-llm/us05-termo.spec.ts --coverage`, commit `24954a2`. Relatório HTML em `docs/testes/relatorios/v1/us05/index.html`.

| Indicador | Resultado |
|-----------|-----------|
| Casos de teste cobertos (CT-05-01 a 29) | 17/29 (58,62%): 3 Sim, 14 Sim\*, 0 Parcial, 12 Não |
| CTs não cobertos | CT-05-01 a 07 (numeração), 16, 24, 25, 27 (front-end), 21 (1 byte, contradiz a regra `%PDF-`) |
| Partições de equivalência | 21/26 (80,77%): 5 Sim, 16 Sim\*, 5 Não (PNT-01 a PNT-05) |
| Valores-limite | 1/4 fronteiras completas (LM-02, Sim\*); LM-01 Parcial (0 byte rejeitado, 1 byte não testável); LM-03 e LM-04 Não |

### Partições (cobertura da v1)

| Partição | Coberto? | Teste ou motivo |
|----------|----------|-----------------|
| PNT-01 a PNT-05 | Não | A numeração fica em `create` (`emprestimos.service.ts:130-135`), fora da suíte |
| PEE-01, PEE-02 | Sim\* | `gestor do estoque recebe o PDF…`; `trata empréstimo inexistente…` |
| PPF-01, PPF-02 | Sim\* | `gestor do estoque recebe o PDF…`; `ADMIN acessa mesmo sem ser gestor…` |
| PPF-03, PPF-04 | Sim\* | `recusa usuário não gestor e não ADMIN` (vínculo nulo; papel REQUISITANTE) |
| PRS-01, PDP-01, PDP-02, PBE-01, PBE-02 | Sim | `contém dados do responsável…`; `mostra "INDEFINIDO"…`; `usa o tombamento…`; `usa o nº de série…` |
| PAX-01 a PAX-04 | Sim\* | `valida, grava e anexa…`; `rejeita mimetype…`; `rejeita requisição sem arquivo`; `rejeita arquivo com buffer vazio (0 bytes)` |
| PTM-01, PTM-02 | Sim\* | `aceita arquivo com exatamente 5 MB`; `…5 MB - 1 byte`; `rejeita arquivo com 5 MB + 1 byte` |
| PCF-01, PCF-02 | Sim\* | `confirma a entrega…`; `bloqueia a confirmação enquanto o termo assinado não foi anexado` |
| PEM-01, PEM-02 | Sim\* | `valida, grava e anexa…`; `recusa anexar quando o status é ATIVO`/`DEVOLVIDO` |

### Valores-limite (cobertura da v1)

| Limite | Coberto? | Teste ou motivo |
|--------|----------|-----------------|
| LM-01 | Parcial | Lado inválido (0 byte): `rejeita arquivo com buffer vazio (0 bytes)`. Lado válido (1 byte): não há teste, e um PDF de 1 byte é rejeitado por `%PDF-` (`emprestimos.service.ts:344-348`) |
| LM-02 | Sim\* | `aceita arquivo com exatamente 5 MB`; `rejeita arquivo com 5 MB + 1 byte` (só o `size` do mock muda) |
| LM-03 | Não | Virada de ano é do `create`, fora da suíte |
| LM-04 | Não | Número 0 × 1 é do `create`, fora da suíte |

## 9. Cobertura da suíte v2 (S3B-10)

Medição: v2 completa, `npx vitest run --config vitest.us05-v2.config.ts tests/v1-llm/us05-termo.spec.ts tests/v2/us05-termo.spec.ts --coverage`, commit `b9b67c5`. Relatório HTML em `docs/testes/relatorios/v2/us05/index.html`. A contagem abaixo vem desta matriz (v2 completa = v1 + testes novos).

| Indicador | Resultado |
|-----------|-----------|
| Casos de teste cobertos (CT-05-01 a 29) | 25/29 (86,21%): 3 Sim, 22 Sim\*, 0 Parcial, 4 Não |
| CTs não cobertos | CT-05-16, 24, 25, 27 (front-end, lacuna G-11) |
| Partições de equivalência | 26/26 (100%): 5 Sim, 21 Sim\*, 0 Não |
| Valores-limite | 4/4 fronteiras completas (LM-01 a LM-04, todas Sim\*) |

Comparação com a v1 (seção 8): CTs de 17/29 para 25/29 (de 3 Sim, 14 Sim\* e 12 Não para 3 Sim, 22 Sim\* e 4 Não); partições de 21/26 para 26/26; fronteiras de 1/4 para 4/4. Os 8 CTs que passaram de Não para Sim\* são CT-05-01 a 07 (numeração) e CT-05-21 (reescrito, 5 bytes). Os 4 que continuam Não são os do front-end.

### Partições (cobertura da v2)

| Partição | Coberto? | Teste ou motivo |
|----------|----------|-----------------|
| PNT-01 a PNT-03 | Sim\* | `primeiro termo do ano recebe o número "01/2026"`; `termo seguinte recebe o número anterior + 1, no mesmo ano`; `em 01/01 o primeiro termo do ano novo é "01/2027" (reinicia)` |
| PNT-04 | Sim\* | `P2002 ao obter o número: erro vira ResourceConflictException (409) e nada é gerado`; `P2002 ao gravar o termo: empréstimo não é vinculado e o erro vira 409` |
| PNT-05 | Sim\* | `obterPdf: duas consultas devolvem o mesmo nomeArquivo e não chamam o contador`; `obterPdfAssinado: duas consultas devolvem o mesmo nomeArquivo e não chamam o contador` |
| PEE-01, PEE-02 | Sim\* | v1: `gestor do estoque recebe o PDF…`; `trata empréstimo inexistente…`. v2: `empréstimo inexistente recebe 404 ResourceNotFoundException` |
| PPF-01, PPF-02 | Sim\* | v1: `gestor do estoque recebe o PDF…`; `ADMIN acessa mesmo sem ser gestor…`. v2: controller (`inline` e `attachment`); `ADMIN acessa o PDF assinado sem ser gestor: devolve o conteúdo e o nome corretos` |
| PPF-03, PPF-04 | Sim\* | v2: `gestor de outro estoque (USER sem vínculo) recebe 403 AccessDeniedException`; `requisitante sem vínculo recebe 403 AccessDeniedException` |
| PRS-01, PDP-01, PDP-02, PBE-01, PBE-02 | Sim | v1: `contém dados do responsável…`; `mostra "INDEFINIDO"…`; `usa o tombamento…`; `usa o nº de série…` |
| PAX-01 a PAX-04 | Sim\* | v1: `valida, grava e anexa…`; `rejeita mimetype…`; `rejeita requisição sem arquivo`; `rejeita arquivo com buffer vazio (0 bytes)`. v2: `anexar arquivo que não é PDF recebe 400 AppException VALIDATION_FAILED`; `anexar sem arquivo recebe 400 AppException VALIDATION_FAILED` |
| PTM-01, PTM-02 | Sim\* | v2 (buffer real): `arquivo mínimo válido é aceito (buffer real "%PDF-", 5 bytes)`; `buffer real de exatamente 5 MB começando por "%PDF-" é aceito`; `buffer real de 5 MB + 1 byte começando por "%PDF-" é recusado com 400`. A faixa válida começa em 5 bytes, não em 1 byte (PR-04 não vale) |
| PCF-01, PCF-02 | Sim\* | v1: `confirma a entrega…`; `bloqueia a confirmação enquanto o termo assinado não foi anexado`. v2: `confirmar entrega sem termo assinado recebe 409 ResourceConflictException` |
| PEM-01, PEM-02 | Sim\* | v1: `valida, grava e anexa…`; `recusa anexar quando o status é ATIVO`/`DEVOLVIDO` (sem mudança na v2) |

### Valores-limite (cobertura da v2)

| Limite | Coberto? | Teste ou motivo |
|--------|----------|-----------------|
| LM-01 | Sim\* | Lado inválido (0 byte): v1 `rejeita arquivo com buffer vazio (0 bytes)`. Lado válido, reescrito como o menor PDF aceito (5 bytes): `arquivo mínimo válido é aceito (buffer real "%PDF-", 5 bytes)`. Complemento: `arquivo de 1 byte ("%") é recusado com 400` |
| LM-02 | Sim\* | `buffer real de exatamente 5 MB começando por "%PDF-" é aceito`; `buffer real de 5 MB + 1 byte começando por "%PDF-" é recusado com 400` (buffer real, não só o `size` do mock) |
| LM-03 | Sim\* | `em 31/12 a sequência do ano que termina continua ("07/2026")`; `em 01/01 o primeiro termo do ano novo é "01/2027" (reinicia)` |
| LM-04 | Sim\* | `o número nunca é 0: a sequência começa em 1` |
