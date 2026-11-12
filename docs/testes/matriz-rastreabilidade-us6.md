# Matriz de rastreabilidade — US06 (Alerta de Reposição)

Sprint 3, Parte 1 (suíte de testes gerada por LLM). Responsável: Mateus. Issue: S3B-02 (#61).

Esta matriz foi escrita **antes** de qualquer interação com a LLM. Os resultados esperados vêm dos critérios de aceitação da US06 (README: RF07 e US06; issue da US06), não do código. Onde o requisito não define o comportamento, o ponto está registrado como **premissa** (seção 5) e marcado com `*` nas tabelas.

## 1. Escopo

- User story: US06, o gestor de estoque visualiza alertas de estoque baixo para providenciar a reposição a tempo.
- Operações cobertas: aparecimento e desaparecimento do alerta conforme o saldo e o nível mínimo do item, e a listagem de alertas por perfil.
- Os resultados "recusado" não fixam código HTTP nem texto exato, porque o requisito não define esses detalhes. As mensagens e os códigos serão conferidos contra o que a equipe definir.
- O cadastro do nível mínimo e a validação dos seus valores (negativo, não inteiro) pertencem à US03 e não são repetidos aqui.

## 2. Critérios de aceitação

| ID | Critério (fonte) |
|----|------------------|
| CA-01 | O gestor visualiza os alertas de estoque baixo (US06) |
| CA-02 | O alerta aparece quando o saldo de um item atinge o nível mínimo (RF07) |
| CA-03 | Item sem nível mínimo informado não gera alerta (nível mínimo é opcional, US03 CA-04) |
| CA-04 | Os alertas são destinados aos gestores do estoque do item (RF07) |
| CA-05 | O alerta serve para providenciar reposição: depois de repor o item, o alerta deixa de ser exibido (US06) |
| CA-06 | O alerta traz as informações necessárias para repor: item, estoque, saldo atual e nível mínimo (US06) |

## 3. Variáveis de entrada e partições de equivalência

`V` = válida, `I` = inválida, `*` = depende de premissa da seção 5.

| Variável | ID | Partição | Tipo |
|----------|----|----------|------|
| nível mínimo | PNM-01 | ausente | V |
| nível mínimo | PNM-02 | inteiro positivo | V |
| nível mínimo | PNM-03 | zero | V* |
| saldo × nível mínimo | PSM-01 | saldo acima do mínimo | V |
| saldo × nível mínimo | PSM-02 | saldo igual ao mínimo | V |
| saldo × nível mínimo | PSM-03 | saldo abaixo do mínimo, maior que zero | V* |
| saldo × nível mínimo | PSM-04 | saldo zero com mínimo positivo | V* |
| tipo do item | PTI-01 | consumo com nível mínimo | V |
| tipo do item | PTI-02 | patrimonial com nível mínimo | V* |
| evento sobre o saldo | PEV-01 | saída que leva o saldo ao mínimo | V |
| evento sobre o saldo | PEV-02 | entrada que leva o saldo acima do mínimo | V* |
| evento sobre o saldo | PEV-03 | entrada que mantém o saldo abaixo do mínimo | V* |
| evento sobre o saldo | PEV-04 | saída recusada (saldo não muda) | V* |
| perfil (visualizar alertas) | PPF-01 | gestor do estoque | V |
| perfil (visualizar alertas) | PPF-02 | gestor de outro estoque | I* |
| perfil (visualizar alertas) | PPF-03 | requisitante | I* |
| perfil (visualizar alertas) | PPF-04 | ADMIN | V* |
| estoque | PES-01 | existente, com item em alerta | V |
| estoque | PES-02 | existente, sem item em alerta | V |
| estoque | PES-03 | inexistente | I |
| quantidade de alertas | PAL-01 | nenhum | V |
| quantidade de alertas | PAL-02 | um | V |
| quantidade de alertas | PAL-03 | vários | V |
| quantidade de alertas | PAL-04 | vários estoques do mesmo gestor | V |

Total: **24 partições** (14 definidas pelo requisito e 10 dependentes de premissa: PNM-03, PSM-03, PSM-04, PTI-02, PEV-02, PEV-03, PEV-04, PPF-02, PPF-03 e PPF-04).

## 4. Valores-limite (dois lados de cada fronteira)

| ID | Fronteira | Lado sem alerta | Lado com alerta |
|----|-----------|-----------------|-----------------|
| LM-01 | saldo × nível mínimo: mínimo + 1 × mínimo | saldo = mínimo + 1 (ex.: 6 com mínimo 5) | saldo = mínimo (ex.: 5 com mínimo 5) |
| LM-02 | nível mínimo: ausente × zero* | sem nível mínimo, saldo 0 | nível mínimo 0, saldo 0 |
| LM-03 | quantidade de alertas: nenhum × primeiro | 0 alertas | 1 alerta |
| LM-04 | reposição: mínimo + 1 × mínimo* | entrada leva o saldo a mínimo + 1 (alerta some) | entrada leva o saldo ao mínimo (alerta permanece) |

Total: **4 fronteiras, 8 valores**.

## 5. Premissas a confirmar com a equipe

Pontos que o README e a issue da US06 não definem. Se a resposta for diferente, ajustar a linha correspondente antes do commit.

| ID | Premissa adotada na matriz | Por que precisa confirmar |
|----|----------------------------|---------------------------|
| PR-01 | "Atingir o nível mínimo" significa saldo menor ou igual ao mínimo: igual ao mínimo gera alerta, e abaixo dele (inclusive saldo zero) também | O RF07 diz só "atingir" |
| PR-02 | Sem nível mínimo, nunca há alerta. Com nível mínimo 0, só o saldo 0 gera alerta | O requisito só diz que o nível mínimo é opcional |
| PR-03 | Só item de consumo gera alerta; item patrimonial (saldo 1 por registro) não gera, mesmo com nível mínimo informado | O requisito fala em "saldo de um item" sem separar os tipos |
| PR-04 | O alerta acompanha o saldo atual: some quando a reposição leva o saldo acima do mínimo, permanece enquanto o saldo continua em ou abaixo do mínimo, e uma saída recusada não altera nada | A US06 só diz "providenciar reposição a tempo" |
| PR-05 | O alerta mostra item, estoque, saldo atual e nível mínimo | O requisito não define o conteúdo do alerta |
| PR-06 | O gestor vê só os alertas dos seus estoques; gestor de outro estoque e requisitante não veem; o ADMIN vê todos | O RF07 diz "notificar os gestores", sem tratar os outros perfis |
| PR-07 | "Notificar" significa exibir o alerta na aplicação (listagem), e não e-mail ou push | O RF07 usa "notificar" e a US06 usa "visualizar" |
| PR-08 | **Não cobertos** por falta de requisito: envio de e-mail ou push, histórico de alertas, ordenação e paginação, alerta repetido para o mesmo item, dispensar um alerta e previsão de reposição (fora do escopo da sprint) | O requisito não define o comportamento |

## 6. Matriz de rastreabilidade

| Requisito / critério | Variável | Partição ou limite | Caso de teste esperado | Coberto pela v1? | Coberto pela v2? |
|----------------------|----------|--------------------|------------------------|------------------|------------------|
| CA-01, CA-02 | saldo × mínimo, tipo, perfil | PSM-02, PTI-01, PPF-01, LM-01 (lado com alerta) | CT-06-01: item de consumo com nível mínimo 5 e saldo 5 → o gestor do estoque vê o alerta do item | (preencher na Etapa 3) | (preencher na Etapa 4) |
| CA-02 | saldo × mínimo | PSM-01, LM-01 (lado sem alerta) | CT-06-02: item de consumo com nível mínimo 5 e saldo 6 → nenhum alerta para o item | | |
| CA-02 (PR-01*) | saldo × mínimo | PSM-03 | CT-06-03*: item de consumo com nível mínimo 5 e saldo 2 → alerta exibido | | |
| CA-02 (PR-01*) | saldo × mínimo | PSM-04 | CT-06-04*: item de consumo com nível mínimo 5 e saldo 0 → alerta exibido | | |
| CA-03 | nível mínimo | PNM-01, LM-02 (lado sem alerta) | CT-06-05: item de consumo sem nível mínimo e saldo 0 → nenhum alerta | | |
| CA-03 (PR-02*) | nível mínimo | PNM-03, LM-02 (lado com alerta) | CT-06-06*: item de consumo com nível mínimo 0 e saldo 0 → alerta exibido | | |
| CA-03 (PR-02*) | nível mínimo | PNM-03 | CT-06-07*: item de consumo com nível mínimo 0 e saldo 1 → nenhum alerta | | |
| CA-02 | evento sobre o saldo | PEV-01, PNM-02 | CT-06-08: item com nível mínimo 5 e saldo 8; saída de 3 unidades → saldo 5 e o alerta passa a aparecer | | |
| CA-05 (PR-04*) | evento sobre o saldo | PEV-02, LM-04 (lado sem alerta) | CT-06-09*: item em alerta (mínimo 5, saldo 3); entrada de 3 unidades → saldo 6 e o alerta deixa de ser exibido | | |
| CA-05 (PR-04*) | evento sobre o saldo | LM-04 (lado com alerta) | CT-06-10*: item em alerta (mínimo 5, saldo 3); entrada de 2 unidades → saldo 5 e o alerta continua exibido | | |
| CA-05 (PR-04*) | evento sobre o saldo | PEV-03 | CT-06-11*: item em alerta (mínimo 5, saldo 1); entrada de 2 unidades → saldo 3 e o alerta continua exibido com o saldo atualizado | | |
| CA-02 (PR-04*) | evento sobre o saldo | PEV-04 | CT-06-12*: item sem alerta (mínimo 5, saldo 8); saída de 9 unidades recusada por saldo insuficiente → saldo continua 8 e nenhum alerta aparece | | |
| CA-02 (PR-03*) | tipo do item | PTI-02 | CT-06-13*: item patrimonial com nível mínimo 1 e saldo 1 → nenhum alerta | | |
| CA-06 (PR-05*) | conteúdo do alerta | PTI-01 | CT-06-14*: item em alerta → o alerta mostra o item, o estoque, o saldo atual e o nível mínimo | | |
| CA-01 | quantidade de alertas | PAL-01, PES-02, LM-03 (0 alertas) | CT-06-15: estoque em que todos os itens estão acima do mínimo → lista de alertas vazia | | |
| CA-01 | quantidade de alertas | PAL-02, PES-01, LM-03 (1 alerta) | CT-06-16: estoque com exatamente 1 item em alerta → lista com 1 alerta | | |
| CA-01 | quantidade de alertas | PAL-03 | CT-06-17: estoque com 3 itens em alerta e 2 acima do mínimo → lista com exatamente os 3 itens em alerta | | |
| CA-04 (PR-06*) | perfil, estoque | PPF-01, PES-01 | CT-06-18*: gestor só do estoque A; há itens em alerta em A e em B → vê somente os alertas de A | | |
| CA-04 | perfil, quantidade de alertas | PAL-04 | CT-06-19: gestor dos estoques A e B, com itens em alerta nos dois → vê os alertas dos dois estoques | | |
| CA-04 (PR-06*) | perfil | PPF-02 | CT-06-20*: gestor de outro estoque consulta os alertas do estoque A → nenhum alerta do estoque A é exibido | | |
| CA-04 (PR-06*) | perfil | PPF-03 | CT-06-21*: requisitante tenta ver os alertas → 403, nenhum alerta devolvido | | |
| CA-04 (PR-06*) | perfil | PPF-04 | CT-06-22*: ADMIN consulta os alertas de qualquer estoque → alertas devolvidos | | |
| CA-01 | estoque | PES-03 | CT-06-23: consultar alertas de estoque inexistente → recusado (não encontrado) | | |

## 7. Totais (contados nesta matriz)

| Indicador | Total |
|-----------|-------|
| Critérios de aceitação (CA-01 a CA-06) | 6 |
| Partições de equivalência | 24 |
| Fronteiras de valor-limite | 4 (8 valores) |
| Casos de teste esperados | 23 (14 dependem de premissa: CT-06-03, 04, 06, 07, 09, 10, 11, 12, 13, 14, 18, 20, 21, 22) |
