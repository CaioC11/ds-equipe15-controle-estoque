# Matriz de rastreabilidade — US05 (Termo de Responsabilidade)

Sprint 3, Parte 1 (suíte de testes gerada por LLM). Responsável: Randell. Issue: S3B-06 (#65).

Esta matriz foi escrita **antes** de qualquer interação com a LLM. Os resultados esperados vêm dos critérios de aceitação da US05 (issues #9 e #14), não do código. Onde o requisito não define o comportamento, o ponto está registrado como **premissa** (seção 5) e marcado com `*` nas tabelas.

## 1. Escopo

- User story: US05, o requisitante recebe o Termo de Responsabilidade ao retirar um item emprestado, formalizando a posse temporária do equipamento.
- Operações cobertas: gerar o termo em PDF para um empréstimo (#9), visualizar e baixar o PDF (#9 e #14), anexar o PDF assinado (#14) e confirmar a entrega (#14).
- Os resultados "recusado" não fixam código HTTP nem texto exato, porque o requisito não define esses detalhes. As mensagens e os códigos serão conferidos contra o que a equipe definir.

## 2. Critérios de aceitação

| ID | Critério (fonte) |
|----|------------------|
| CA-01 | PDF gerado com número sequencial por ano (contador simples), no formato "Nº XX/ano" (#9) |
| CA-02 | O PDF contém: responsável (nome, Siape, lotação e cargo), unidade de acautelamento (estoque), data de abertura, data prevista (ou "INDEFINIDO"), bens (tombamento ou nº de série, e denominação) e declaração de responsabilidade (#9) |
| CA-03 | Endpoint para visualizar e baixar o PDF; acesso do gestor do estoque e leitura do ADMIN (#9) |
| CA-04 | Erro tratado para empréstimo inexistente (#9) |
| CA-05 | Visualizar e baixar o PDF do termo gerado pelo sistema (#14) |
| CA-06 | Anexar o PDF assinado ao empréstimo (upload) (#14) |
| CA-07 | Botão de confirmar entrega, habilitado só após o anexo (#14) |
| CA-08 | Mensagens de erro e sucesso para o upload e para a confirmação (#14) |

O critério "Nenhum modelo oficial com dados reais no repositório" da issue #9 é regra de repositório e não um comportamento do sistema, então não entra na contagem de cobertura de requisitos.

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

Pontos que as issues #9 e #14 não definem. Se a resposta for diferente, ajustar a linha correspondente antes do commit.

| ID | Premissa adotada na matriz | Por que precisa confirmar |
|----|----------------------------|---------------------------|
| PR-01 | O upload do PDF assinado e a confirmação da entrega têm suporte no backend, e a recusa de confirmar sem anexo vale também fora do botão | A #9 cobre só a geração e a consulta do PDF; a #14 descreve só a tela |
| PR-02 | O empréstimo fica pendente depois de gerado o termo e vira ativo ao confirmar a entrega (não ao anexar) | A #14 só diz que o botão é habilitado após o anexo; a #65 cita "upload do assinado e ativação" sem dizer o estado |
| PR-03 | Gestor de outro estoque e requisitante recebem 403 ao visualizar ou baixar o termo | A #9 diz só quem tem acesso (gestor do estoque e ADMIN) |
| PR-04 | O tamanho máximo do anexo é 5 MB e arquivo de 0 bytes é inválido | A #14 não define limite de tamanho |
| PR-05 | A numeração começa em 1 a cada ano e o ano é o da data de abertura do empréstimo | A #9 diz só "Nº XX/ano" e "contador simples" |
| PR-06 | Cada empréstimo recebe um único número de termo; visualizar ou baixar de novo não consome número novo | A #9 não diz se o número é fixado na geração ou a cada consulta |
| PR-07 | Anexar ou confirmar em empréstimo com entrega já confirmada é recusado | Nenhuma das issues trata esse caso |
| PR-08 | **Não cobertos** por falta de requisito: dados incompletos do responsável (ex.: sem Siape), item sem tombamento e sem nº de série, data prevista anterior à data de abertura, e quem pode anexar ou confirmar | As issues não definem o comportamento |

## 6. Matriz de rastreabilidade

| Requisito / critério | Variável | Partição ou limite | Caso de teste esperado | Coberto pela v1? | Coberto pela v2? |
|----------------------|----------|--------------------|------------------------|------------------|------------------|
| CA-01 | número do termo | PNT-01 | CT-05-01: gerar o termo do 1º empréstimo do ano → PDF gerado com número sequencial 1 do ano | (preencher na Etapa 3) | (preencher na Etapa 4) |
| CA-01 | número do termo | PNT-02 | CT-05-02: gerar o termo de um novo empréstimo após um termo existente → número = anterior + 1 | | |
| CA-01 (PR-05*) | número do termo | PNT-03, LM-03 (lado válido) | CT-05-03*: gerar o termo de um empréstimo aberto em 01/01 do ano seguinte → número reinicia em 1 do novo ano | | |
| CA-01 (PR-05*) | número do termo | LM-03 (lado inválido) | CT-05-04*: gerar o termo de um empréstimo aberto em 31/12 após o termo N → número é N + 1 do mesmo ano, sem reiniciar | | |
| CA-01 | número do termo | PNT-04 | CT-05-05: gerar dois termos seguidos → números distintos; apenas 1 termo por número no ano | | |
| CA-01 (PR-05*) | número do termo | LM-04 (lado inválido) | CT-05-06*: primeiro termo do ano → número é 1, nunca 0 | | |
| CA-01 (PR-06*) | número do termo | PNT-05 | CT-05-07*: consultar duas vezes o termo do mesmo empréstimo → mesmo número nas duas consultas; o contador não avança | | |
| CA-02 | dados do responsável, data prevista, bens | PRS-01, PDP-01, PBE-01 | CT-05-08: termo de item com tombamento e data prevista informada → PDF com responsável (nome, Siape, lotação, cargo), unidade de acautelamento (estoque), data de abertura, data prevista, tombamento e denominação do bem, e declaração de responsabilidade | | |
| CA-02 | data prevista | PDP-02 | CT-05-09: termo de empréstimo sem data prevista → PDF mostra "INDEFINIDO" no campo da data prevista | | |
| CA-02 | bens | PBE-02 | CT-05-10: termo de item sem tombamento, com nº de série → bem identificado pelo nº de série e pela denominação | | |
| CA-03 | perfil, empréstimo | PPF-01, PEE-01 | CT-05-11: gestor do estoque do empréstimo visualiza e baixa o PDF → PDF devolvido | | |
| CA-03 | perfil, empréstimo | PPF-02, PEE-01 | CT-05-12: ADMIN consulta o PDF de qualquer empréstimo → PDF devolvido (leitura) | | |
| CA-03 (PR-03*) | perfil | PPF-03 | CT-05-13*: gestor de outro estoque tenta ver o PDF → 403, nenhum PDF devolvido | | |
| CA-03 (PR-03*) | perfil | PPF-04 | CT-05-14*: requisitante tenta ver o PDF → 403, nenhum PDF devolvido | | |
| CA-04 | empréstimo | PEE-02 | CT-05-15: consultar o PDF de empréstimo inexistente → erro tratado (não encontrado), nenhum PDF gerado | | |
| CA-05 | perfil, empréstimo | PPF-01, PEE-01 | CT-05-16: na tela do termo, usuário com acesso vê o PDF do termo gerado e consegue baixá-lo | | |
| CA-06, CA-08 (PR-04*, PR-02*) | anexo, tamanho, estado do empréstimo | PAX-01, PTM-01, PEM-01 | CT-05-17*: anexar PDF de 2 MB a empréstimo pendente → upload aceito, com mensagem de sucesso | | |
| CA-06, CA-08 | anexo | PAX-02 | CT-05-18: anexar arquivo que não é PDF → recusado, com mensagem de erro; nenhum anexo registrado | | |
| CA-06, CA-08 | anexo | PAX-03 | CT-05-19: enviar sem selecionar arquivo → recusado, com mensagem de erro | | |
| CA-06, CA-08 (PR-04*) | anexo, tamanho | PAX-04, LM-01 (lado inválido) | CT-05-20*: anexar PDF de 0 bytes → recusado, com mensagem de erro; nenhum anexo registrado | | |
| CA-06 (PR-04*) | tamanho | PTM-01, LM-01 (lado válido) | CT-05-21*: anexar PDF com 1 byte → aceito pela regra de tamanho | | |
| CA-06 (PR-04*) | tamanho | PTM-01, LM-02 (lado válido) | CT-05-22*: anexar PDF com exatamente 5 MB → aceito | | |
| CA-06, CA-08 (PR-04*) | tamanho | PTM-02, LM-02 (lado inválido) | CT-05-23*: anexar PDF com 5 MB + 1 byte → recusado, com mensagem de erro | | |
| CA-07 | confirmação da entrega | PCF-02 | CT-05-24: empréstimo sem anexo → botão "Confirmar entrega" desabilitado | | |
| CA-07 | confirmação da entrega | PCF-01 | CT-05-25: depois de anexar um PDF válido → botão "Confirmar entrega" habilitado | | |
| CA-07, CA-08 (PR-02*) | confirmação da entrega, estado do empréstimo | PCF-01, PEM-01 | CT-05-26*: confirmar a entrega com anexo → entrega confirmada, empréstimo ativo e mensagem de sucesso | | |
| CA-06, CA-07 | anexo, confirmação da entrega | PAX-02, PAX-01, PCF-02 | CT-05-27: upload inválido seguido de upload válido → o botão só é habilitado depois do upload válido | | |
| CA-06, CA-07, CA-08 (PR-07*) | estado do empréstimo | PEM-02 | CT-05-28*: anexar ou confirmar em empréstimo com entrega já confirmada → recusado, com mensagem de erro; estado inalterado | | |
| CA-07, CA-08 (PR-01*) | confirmação da entrega | PCF-02 | CT-05-29*: tentar confirmar a entrega sem anexo, sem usar o botão → recusado, com mensagem de erro; entrega não confirmada | | |

## 7. Totais (contados nesta matriz)

| Indicador | Total |
|-----------|-------|
| Critérios de aceitação (CA-01 a CA-08) | 8 |
| Partições de equivalência | 26 |
| Fronteiras de valor-limite | 4 (8 valores) |
| Casos de teste esperados | 29 (14 dependem de premissa: CT-05-03, 04, 06, 07, 13, 14, 17, 20, 21, 22, 23, 26, 28, 29) |
