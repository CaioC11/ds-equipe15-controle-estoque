# Matriz de rastreabilidade — US01 (Gestão Multiestoque: estoques, movimentação e saldo)

Sprint 3, Parte 1 (suíte de testes gerada por LLM). Responsável: Mateus. Issue: S3B-02 (#61).

Esta matriz foi escrita **antes** de qualquer interação com a LLM. Os resultados esperados vêm dos critérios de aceitação da US01 (README: RF01, RF04, RNF01 e RNF02; issue da US01), não do código. Onde o requisito não define o comportamento, o ponto está registrado como **premissa** (seção 5) e marcado com `*` nas tabelas.

## 1. Escopo

- User story: US01, o gestor de estoque cadastra e gerencia o próprio estoque para controlar os itens sob sua responsabilidade.
- Operações cobertas: cadastrar estoque, editar estoque, registrar entrada e saída de item, consultar saldo por estoque e consultar o histórico de movimentações do estoque.
- Os resultados "recusado" não fixam código HTTP nem texto exato, porque o requisito só define o **403** para quem não é gestor do estoque (RNF01). As mensagens e os demais códigos serão conferidos contra o que a equipe definir.

## 2. Critérios de aceitação

| ID | Critério (fonte) |
|----|------------------|
| CA-01 | Cadastrar estoques independentes por setor, com nome (RF01, US01) |
| CA-02 | Cada estoque é independente: itens e saldos de um não afetam outro (RF01) |
| CA-03 | O gestor gerencia (edita) o próprio estoque (US01) |
| CA-04 | Registrar entrada de item, aumentando o saldo (RF04) |
| CA-05 | Registrar saída de item, diminuindo o saldo (RF04) |
| CA-06 | Consultar o saldo por estoque (RF04) |
| CA-07 | Manter registro das movimentações de entrada e saída por estoque (RNF02) |
| CA-08 | Gestores de um estoque não movimentam nem alteram dados de outros estoques (RNF01) |

## 3. Variáveis de entrada e partições de equivalência

`V` = válida, `I` = inválida, `*` = depende de premissa da seção 5.

| Variável | ID | Partição | Tipo |
|----------|----|----------|------|
| nome do estoque | PNE-01 | texto não vazio e ainda não usado | V |
| nome do estoque | PNE-02 | ausente | I |
| nome do estoque | PNE-03 | vazio ou só espaços | I |
| nome do estoque | PNE-04 | já usado por outro estoque | I* |
| estoque (alvo) | PES-01 | existente | V |
| estoque (alvo) | PES-02 | inexistente | I |
| perfil (cadastrar estoque) | PPC-01 | ADMIN | V* |
| perfil (cadastrar estoque) | PPC-02 | requisitante | I* |
| perfil (editar/movimentar) | PPM-01 | gestor daquele estoque | V |
| perfil (editar/movimentar) | PPM-02 | gestor de outro estoque | I |
| perfil (editar/movimentar) | PPM-03 | requisitante | I* |
| perfil (editar/movimentar) | PPM-04 | ADMIN sem vínculo de gestor com o estoque | I* |
| tipo de movimentação | PTP-01 | ENTRADA | V |
| tipo de movimentação | PTP-02 | SAÍDA | V |
| tipo de movimentação | PTP-03 | ausente | I |
| tipo de movimentação | PTP-04 | valor fora de {ENTRADA, SAÍDA} | I |
| quantidade | PQT-01 | inteiro positivo | V |
| quantidade | PQT-02 | zero | I* |
| quantidade | PQT-03 | negativo | I |
| quantidade | PQT-04 | não inteiro | I* |
| quantidade | PQT-05 | ausente | I |
| item | PIT-01 | existente no estoque | V |
| item | PIT-02 | inexistente | I |
| item | PIT-03 | existente em outro estoque | I* |
| saída × saldo | PSD-01 | saída menor que o saldo | V |
| saída × saldo | PSD-02 | saída igual ao saldo (saldo vai a zero) | V* |
| saída × saldo | PSD-03 | saída maior que o saldo | I* |
| consulta de saldo | PCS-01 | estoque com itens e movimentações | V |
| consulta de saldo | PCS-02 | estoque sem itens | V |
| histórico | PHI-01 | estoque com movimentações | V |
| histórico | PHI-02 | estoque sem movimentações | V |

Total: **31 partições** (21 definidas pelo requisito e 10 dependentes de premissa: PNE-04, PPC-01, PPC-02, PPM-03, PPM-04, PQT-02, PQT-04, PIT-03, PSD-02 e PSD-03).

## 4. Valores-limite (dois lados de cada fronteira)

| ID | Fronteira | Lado inválido | Lado válido |
|----|-----------|---------------|-------------|
| LM-01 | quantidade: zero × um* | 0 | 1 |
| LM-02 | saída × saldo*: saldo + 1 × saldo | saída de saldo + 1 (ex.: 11 com saldo 10) | saída igual ao saldo (ex.: 10 com saldo 10) |
| LM-03 | nome do estoque: vazio × 1 caractere | "" | "A" |
| LM-04 | histórico: nenhuma movimentação × primeira movimentação | 0 movimentações | 1 movimentação |

Total: **4 fronteiras, 8 valores**.

## 5. Premissas a confirmar com a equipe

Pontos que o README e a issue da US01 não definem. Se a resposta for diferente, ajustar a linha correspondente antes do commit.

| ID | Premissa adotada na matriz | Por que precisa confirmar |
|----|----------------------------|---------------------------|
| PR-01 | Quem cadastra estoque é o ADMIN, e o requisitante é recusado. Vale para todos os casos de cadastro | O README diz que o gestor "cadastra e gerencia o próprio estoque", mas a US02 diz que o ADMIN autoriza os gestores de cada estoque |
| PR-02 | O nome do estoque é único | O requisito diz só "estoques independentes por setor" |
| PR-03 | Quantidade aceita só inteiros positivos; zero e não inteiro são recusados | O requisito não define a quantidade válida |
| PR-04 | Requisitante e ADMIN sem vínculo de gestor recebem 403 ao editar ou movimentar | O RNF01 fala em "gestores de um estoque" e em "permissão explícita", sem tratar ADMIN |
| PR-05 | Saída maior que o saldo é recusada (o saldo nunca fica negativo); saída igual ao saldo é aceita e zera o saldo | O RF04 não trata saldo insuficiente |
| PR-06 | Movimentar um item pela rota de outro estoque é recusado | O RNF01 não detalha esse caso |
| PR-07 | O saldo de um item é a soma das entradas menos a soma das saídas | O RF04 diz só "consulta de saldo por estoque" |
| PR-08 | A leitura (listar estoques, consultar saldo e histórico) não é restrita ao gestor, e por isso não é testada como restrição | O RNF01 restringe só "movimentar ou alterar" |
| PR-09 | **Não cobertos** por falta de requisito: desativar estoque, edição que duplica nome de outro estoque, entrada e saída de item patrimonial (saldo 1 por registro, ver US03), ordenação e paginação, alerta de estoque baixo (ver US06) | O requisito não define o comportamento |

## 6. Matriz de rastreabilidade

| Requisito / critério | Variável | Partição ou limite | Caso de teste esperado | Coberto pela v1? | Coberto pela v2? |
|----------------------|----------|--------------------|------------------------|------------------|------------------|
| CA-01 (PR-01*) | nome, perfil | PNE-01, PPC-01 | CT-01-01*: usuário autorizado cadastra o estoque "Laboratório X" → estoque criado, ativo e presente na listagem | (preencher na Etapa 3) | (preencher na Etapa 4) |
| CA-01 | nome | PNE-02 | CT-01-02: cadastro sem nome → recusado, nada criado | | |
| CA-01 | nome | PNE-03, LM-03 (lado inválido) | CT-01-03: cadastro com nome "" → recusado, nada criado | | |
| CA-01 | nome | PNE-03 | CT-01-04: cadastro com nome "   " (só espaços) → recusado, nada criado | | |
| CA-01 | nome | PNE-01, LM-03 (lado válido) | CT-01-05: cadastro com nome "A" → estoque criado | | |
| CA-01 (PR-02*) | nome | PNE-04 | CT-01-06*: cadastro com nome já usado por outro estoque → recusado; apenas 1 estoque com esse nome | | |
| CA-01 (PR-01*) | perfil | PPC-02 | CT-01-07*: requisitante tenta cadastrar estoque → 403, nada criado | | |
| CA-01, CA-02 | nome | PNE-01 | CT-01-08: cadastro de dois estoques com nomes distintos → ambos criados e independentes | | |
| CA-03 | perfil, estoque | PPM-01, PES-01 | CT-01-09: gestor do estoque edita o nome e a descrição do próprio estoque → dados atualizados | | |
| CA-03 | estoque | PES-02 | CT-01-10: editar estoque inexistente → recusado (não encontrado) | | |
| CA-08 | perfil | PPM-02 | CT-01-11: gestor de outro estoque tenta editar → 403, estoque inalterado | | |
| CA-08 (PR-04*) | perfil | PPM-03 | CT-01-12*: requisitante tenta editar → 403, estoque inalterado | | |
| CA-04 | tipo, quantidade, item, perfil | PTP-01, PQT-01, PIT-01, PPM-01 | CT-01-13: gestor registra entrada de 10 unidades de um item do estoque → saldo aumenta em 10 e a movimentação é registrada | | |
| CA-05 | tipo, quantidade, saída × saldo | PTP-02, PQT-01, PSD-01 | CT-01-14: saída de 3 unidades com saldo 10 → saldo passa a 7 e a movimentação é registrada | | |
| CA-05 (PR-05*) | saída × saldo | PSD-02, LM-02 (lado válido) | CT-01-15*: saída de 10 unidades com saldo 10 → aceita, saldo passa a 0 | | |
| CA-05 (PR-05*) | saída × saldo | PSD-03, LM-02 (lado inválido) | CT-01-16*: saída de 11 unidades com saldo 10 → recusada, saldo continua 10, nenhuma movimentação registrada | | |
| CA-04, CA-05 | tipo | PTP-03 | CT-01-17: movimentação sem tipo → recusada, nada registrado | | |
| CA-04, CA-05 | tipo | PTP-04 | CT-01-18: movimentação com tipo "AJUSTE" → recusada, nada registrado | | |
| CA-04, CA-05 | quantidade | PQT-05 | CT-01-19: movimentação sem quantidade → recusada, nada registrado | | |
| CA-04 (PR-03*) | quantidade | PQT-02, LM-01 (lado inválido) | CT-01-20*: entrada com quantidade 0 → recusada, saldo inalterado | | |
| CA-04 | quantidade | PQT-01, LM-01 (lado válido) | CT-01-21: entrada com quantidade 1 → aceita, saldo aumenta em 1 | | |
| CA-04, CA-05 | quantidade | PQT-03 | CT-01-22: movimentação com quantidade -5 → recusada, saldo inalterado | | |
| CA-04 (PR-03*) | quantidade | PQT-04 | CT-01-23*: entrada com quantidade 2.5 → recusada, saldo inalterado | | |
| CA-04, CA-05 | item | PIT-02 | CT-01-24: movimentar item inexistente → recusado (não encontrado), nada registrado | | |
| CA-08 (PR-06*) | item | PIT-03 | CT-01-25*: movimentar, pela rota do estoque A, um item que pertence ao estoque B → recusado, saldo do item inalterado | | |
| CA-08 | perfil | PPM-02 | CT-01-26: gestor de outro estoque tenta registrar entrada → 403, saldo inalterado | | |
| CA-08 | perfil | PPM-02 | CT-01-27: gestor de outro estoque tenta registrar saída → 403, saldo inalterado | | |
| CA-08 (PR-04*) | perfil | PPM-03 | CT-01-28*: requisitante tenta movimentar → 403, saldo inalterado | | |
| CA-08 (PR-04*) | perfil | PPM-04 | CT-01-29*: ADMIN sem vínculo com o estoque tenta movimentar → 403, saldo inalterado | | |
| CA-06 (PR-07*) | consulta de saldo | PCS-01 | CT-01-30*: item com entradas 10 e 5 e saída 4 → saldo 11 na consulta do estoque | | |
| CA-02, CA-06 | consulta de saldo | PCS-01 | CT-01-31: movimentar um item do estoque A → saldos do estoque B não mudam | | |
| CA-06 | consulta de saldo | PCS-02, LM-04 | CT-01-32: estoque sem itens → consulta de saldo devolve lista vazia | | |
| CA-06 | estoque | PES-02 | CT-01-33: consultar saldo de estoque inexistente → recusado (não encontrado) | | |
| CA-07 | histórico | PHI-01, LM-04 (1 movimentação) | CT-01-34: estoque com exatamente 1 movimentação → histórico com 1 registro, com tipo, quantidade, data e responsável | | |
| CA-07 | histórico | PHI-01 | CT-01-35: estoque com 3 movimentações e outro estoque com movimentações → histórico traz exatamente as 3 do estoque consultado | | |
| CA-07 | histórico | PHI-02, LM-04 (0 movimentações) | CT-01-36: estoque sem movimentações → histórico vazio | | |
| CA-07 | histórico | PSD-03 | CT-01-37: movimentação recusada (ex.: CT-01-16) → não aparece no histórico | | |

## 7. Totais (contados nesta matriz)

| Indicador | Total |
|-----------|-------|
| Critérios de aceitação (CA-01 a CA-08) | 8 |
| Partições de equivalência | 31 |
| Fronteiras de valor-limite | 4 (8 valores) |
| Casos de teste esperados | 37 (12 dependem de premissa: CT-01-01, 06, 07, 12, 15, 16, 20, 23, 25, 28, 29, 30) |
