# Refatorações da Sprint 3 — DT-09, DT-10 e DT-11

## Contexto e resultados

O documento da Parte 2 atribui nota máxima ao Passo 3 com **pelo menos três itens refatorados**. A task individual descreve uma refatoração; esta entrega contém três, cada uma em commit local separado. O ZIP de origem não continha `.git`, então os hashes abaixo são de uma sequência local reproduzível. Os patches em `docs/qualidade/patches/` podem ser aplicados ao checkout real com `git am` na ordem numérica. Eles não foram publicados no remoto.

Antes de qualquer alteração, `npx vitest run tests/v2 --config vitest.llm.config.ts --silent` no backend: **6 arquivos; 481 passando, 6 falhas esperadas (`it.fails`), 6 pendentes (`it.todo`)**. Não havia falha inesperada. Os IDs DT-09 a DT-11 foram registrados na tabela antes das mudanças. As oito DTs originais permanecem com seu status anterior; DT-11 é apenas o recorte de literais de status do ACH-09, sem declarar resolvido o fuso de DT-07.

| ID e commit local | Refatoração de catálogo | Antes → depois | Testes após o passo |
|---|---|---|---|
| DT-09 · `0c33176` | **Extract Function** | `ItensService` e `EmprestimosService` repetiam a consulta `estoqueGestor.findUnique` e a negação. `assertGestorDoEstoque` em `src/common/auth/` centraliza a consulta e recebe a mensagem original de cada módulo. | Backend v2: 481 pass, 6 `it.fails`, 6 `todo`. |
| DT-10 · `21a3e60` | **Move Function** | Duas funções `request<T>` idênticas abriam o envelope HTTP e criavam `HttpError`. A função e o erro foram movidos para `front/src/services/api.ts`; o export antigo de `HttpError` permanece para compatibilidade. | Testes direcionados: 13 pass; `tsc -b` do frontend passou. Teste de caracterização foi registrado antes da refatoração (`9de31a9`). |
| DT-11 · `3e7d8ae` | **Replace Magic Literal** | A contagem por status comparava `'DISPONIVEL'` e `'EMPRESTADO'`. Agora usa `StatusItem.DISPONIVEL` e `StatusItem.EMPRESTADO`. A resposta pública é a mesma. | Backend v2: 481 pass, 6 `it.fails`, 6 `todo`; `npm run build` passou. |

Depois dos três passos, a suíte v2 completa do backend voltou a **481 pass, 6 `it.fails`, 6 `todo`**. Os 13 testes dos serviços HTTP do frontend passaram. A execução geral do frontend resultou em 87 pass e 3 falhas nos testes de `Can` e `cinnamon-v2`, já descritas na análise anterior; estes arquivos e a lógica testada não foram alterados aqui. Isso limita a afirmação à suíte v2 backend e aos testes direcionados front.

## Revisão do comportamento e limites

A verificação de vínculo preserva a consulta, a ordem da checagem e as mensagens de 403; o teste v2 de US03/US04 continuou verde. O cliente HTTP mantém URL, envelope, fallback, erro e status; o teste novo caracteriza ambos os caminhos de sucesso e erro. O enum tem os mesmos valores usados nos literais. As três mudanças não alteram o contrato externo.

O registro original ACH-07 ainda aponta outras cópias da autorização fora do par extraído; DT-09 delimita somente a duplicação entre itens e empréstimos. ACH-08 cita outros clientes HTTP; DT-10 delimita as duas funções `request` idênticas. DT-07 permanece aberta para tipagem e fuso; DT-11 trata apenas os literais de status. Os itens não resolvidos não foram marcados como `Refatorado`.

## Comparação dos métodos de análise

A leitura manual revelou o contexto das mensagens de erro e do contrato público; a busca textual localizou os trechos duplicados e os literais; a LLM ajudou a organizar candidatos, mas cada DT selecionada foi novamente conferida no código e exercitada por testes. O detector de duplicação original encontrou o par de autorização e o par de funções HTTP; a simples semelhança de imports foi descartada como FP-07. As medições de antes/depois dão evidência de preservação do comportamento coberto, sem substituir teste integrado com banco e autenticação real.
