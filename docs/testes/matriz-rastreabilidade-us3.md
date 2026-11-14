# Matriz de rastreabilidade — US03 (Itens com tombamento)

Sprint 3, Parte 1 (suíte de testes gerada por LLM). Responsável: Caio. Issue: S3B-05 (#64).

Esta matriz foi escrita **antes** de qualquer interação com a LLM. Os resultados esperados vêm dos critérios de aceitação da US03 (issue #7), não do código. Onde o requisito não define o comportamento, o ponto está registrado como **premissa** (seção 5) e marcado com `*` nas tabelas.

## 1. Escopo

- User story: US03, itens vinculados a um estoque (categoria, tipo patrimonial ou consumo, tombamento, nº de série, nível mínimo).
- Operações cobertas: cadastrar item, editar item, listar itens por estoque.
- Os resultados "recusado" não fixam código HTTP nem texto exato, porque o requisito só define o **403** para quem não é gestor do estoque. As mensagens e os demais códigos serão conferidos contra o que a equipe definir.

## 2. Critérios de aceitação

| ID | Critério (fonte: issue #7) |
|----|----------------------------|
| CA-01 | Cadastrar item em um estoque, com categoria e tipo |
| CA-02 | Item patrimonial exige tombamento, único; duplicado é recusado |
| CA-03 | Item de consumo não exige tombamento e é controlado por saldo |
| CA-04 | Nº de série e nível mínimo são opcionais |
| CA-05 | Listagem de itens por estoque |
| CA-06 | Só o gestor daquele estoque cadastra e edita (403 para os demais) |
| CA-07 | Item patrimonial tem saldo 1 por registro (da descrição da issue) |

O critério "Testes unitários básicos passando" da issue #7 é meta de processo e não um comportamento do sistema, então não entra na contagem de cobertura de requisitos.

## 3. Variáveis de entrada e partições de equivalência

`V` = válida, `I` = inválida, `*` = depende de premissa da seção 5.

| Variável | ID | Partição | Tipo |
|----------|----|----------|------|
| tipo | PT-01 | PATRIMONIAL | V |
| tipo | PT-02 | CONSUMO | V |
| tipo | PT-03 | ausente | I |
| tipo | PT-04 | valor fora de {PATRIMONIAL, CONSUMO} | I |
| tombamento (patrimonial) | PTB-01 | texto não vazio e ainda não usado | V |
| tombamento (patrimonial) | PTB-02 | ausente | I |
| tombamento (patrimonial) | PTB-03 | vazio ou só espaços | I |
| tombamento (patrimonial) | PTB-04 | já usado por outro item | I |
| tombamento (consumo) | PTC-01 | ausente | V |
| nº de série | PNS-01 | ausente | V |
| nº de série | PNS-02 | informado | V |
| nível mínimo | PNM-01 | ausente | V |
| nível mínimo | PNM-02 | inteiro positivo | V |
| nível mínimo | PNM-03 | zero | V* |
| nível mínimo | PNM-04 | negativo | I* |
| nível mínimo | PNM-05 | não inteiro | I* |
| categoria | PCA-01 | existente | V |
| categoria | PCA-02 | ausente | I |
| categoria | PCA-03 | inexistente | I |
| estoque | PES-01 | existente | V |
| estoque | PES-02 | inexistente | I |
| perfil (cadastrar/editar) | PPF-01 | gestor daquele estoque | V |
| perfil (cadastrar/editar) | PPF-02 | gestor de outro estoque | I |
| perfil (cadastrar/editar) | PPF-03 | requisitante | I |
| perfil (cadastrar/editar) | PPF-04 | ADMIN sem vínculo de gestor com o estoque | I* |
| listagem | PLI-01 | estoque com itens (incluindo itens de outros estoques existentes) | V |
| listagem | PLI-02 | estoque sem itens | V |

Total: **27 partições** (23 definidas pelo requisito e 4 dependentes de premissa: PNM-03, PNM-04, PNM-05 e PPF-04).

## 4. Valores-limite (dois lados de cada fronteira)

| ID | Fronteira | Lado inválido | Lado válido |
|----|-----------|---------------|-------------|
| LM-01 | nível mínimo: negativo × zero* | -1 | 0 |
| LM-02 | tombamento: vazio × 1 caractere | "" | "1" |
| LM-03 | tombamento: duplicado × inédito | tombamento já existente | tombamento ainda não usado (e, na edição, o próprio valor do item) |
| LM-04 | listagem: nenhum item × primeiro item | 0 itens | 1 item |

Total: **4 fronteiras, 8 valores**.

## 5. Premissas a confirmar com a equipe

Pontos que a issue #7 não define. Se a resposta for diferente, ajustar a linha correspondente antes do commit.

| ID | Premissa adotada na matriz | Por que precisa confirmar |
|----|----------------------------|---------------------------|
| PR-01 | Item patrimonial exige tombamento sempre (sem alternativa de nº de série ou `semTombamento`) | A issue #7 diz "exige tombamento", mas as premissas A1–A7 e o schema mencionam "tombamento ou nº de série" |
| PR-02 | A unicidade do tombamento é global (vale entre estoques) | A issue diz só "único"; o schema marca `@unique` sem escopo de estoque |
| PR-03 | Nível mínimo aceita inteiros maiores ou iguais a 0; negativo e não inteiro são recusados | A issue só diz que é opcional |
| PR-04 | ADMIN sem vínculo de gestor com o estoque recebe 403 ao cadastrar | A issue diz "só o gestor daquele estoque"; a ADMIN pode ter regra própria |
| PR-05 | Saldo de item de consumo muda por movimentação de entrada (US01) | A issue diz "controlado por saldo" sem detalhar como |
| PR-06 | A listagem não é restrita ao gestor (não testada por falta de requisito) | CA-06 restringe só cadastro e edição |

## 6. Matriz de rastreabilidade

| Requisito / critério | Variável | Partição ou limite | Caso de teste esperado | Coberto pela v1? | Coberto pela v2? |
|----------------------|----------|--------------------|------------------------|------------------|------------------|
| CA-01 | tipo, tombamento, categoria, estoque, perfil | PT-01, PTB-01, PCA-01, PES-01, PPF-01 | CT-03-01: gestor do estoque cadastra item PATRIMONIAL com categoria existente e tombamento inédito → item criado, vinculado ao estoque e à categoria | Sim* — service CA1: cria item patrimonial (banco simulado) | Sim* — mantido da v1 |
| CA-01, CA-03 | tipo, tombamento | PT-02, PTC-01 | CT-03-02: gestor cadastra item CONSUMO sem tombamento → item criado | Sim — schema e service CA4 consumo sem tombamento | Sim — mantido da v1 |
| CA-01 | tipo | PT-03 | CT-03-03: cadastro sem tipo → recusado, nada criado | Sim — schema: rejeita tipo ausente | Sim — mantido da v1 |
| CA-01 | tipo | PT-04 | CT-03-04: cadastro com tipo "OUTRO" → recusado, nada criado | Sim — schema: tipo fora do enum (teste falha só na mensagem) e minúsculas | Sim — corrigido (C1): recusa conferida pelo path `tipo`, sem fixar a mensagem |
| CA-01 | categoria | PCA-02 | CT-03-05: cadastro sem categoria → recusado | Sim — schema: rejeita categoriaId ausente | Sim — mantido da v1 |
| CA-01 | categoria | PCA-03 | CT-03-06: cadastro com categoria inexistente → recusado | Sim — service: categoria não existe, nada criado | Sim — mantido da v1 |
| CA-01 | estoque | PES-02 | CT-03-07: cadastro em estoque inexistente → recusado (não encontrado) | Sim — service: estoque não existe, nada criado | Sim — mantido da v1 |
| CA-02 | tombamento | PTB-02 | CT-03-08: PATRIMONIAL sem tombamento → recusado | Sim — schema CA2: patrimonial sem tombamento | Sim — mantido da v1; sujeito à S3-19 |
| CA-02 | tombamento | PTB-03, LM-02 (lado inválido) | CT-03-09: PATRIMONIAL com tombamento "" → recusado | Sim — schema CA2: tombamento vazio | Sim — mantido da v1; sujeito à S3-19 |
| CA-02 | tombamento | PTB-03 | CT-03-10: PATRIMONIAL com tombamento "   " (só espaços) → recusado | Sim — schema CA2: tombamento só de espaços | Sim — mantido da v1; sujeito à S3-19 |
| CA-02 | tombamento | PTB-01, LM-02 (lado válido) | CT-03-11: PATRIMONIAL com tombamento "1" → item criado | Sim — schema CA1: tombamento de 1 caractere | Sim — mantido da v1 |
| CA-02 | tombamento | PTB-04, LM-03 (lado inválido) | CT-03-12: PATRIMONIAL com tombamento já usado por outro item do mesmo estoque → recusado, com mensagem clara de duplicidade; apenas 1 item com esse tombamento no banco | Sim* — service CA3: P2002 simulado, mensagem clara; banco real não verificado | Sim* — mantido da v1 |
| CA-02 | tombamento | PTB-04 (PR-02*) | CT-03-13*: PATRIMONIAL com tombamento já usado por item de outro estoque → recusado | Não — mock não distingue estoques | Sim* — L8: conflito (409) com tombamento de outro estoque; fake em memória |
| CA-02 | tombamento | PTB-01, LM-03 (lado válido) | CT-03-14: dois PATRIMONIAIS com tombamentos distintos → ambos criados | Não — nenhum teste com duas criações | Sim* — L6: dois patrimoniais com tombamentos distintos; fake em memória |
| CA-03 | tombamento | PTC-01 | CT-03-15: dois itens de CONSUMO sem tombamento no mesmo estoque → ambos criados (ausência de tombamento não conta como duplicado) | Não — nenhum teste com dois consumos | Sim* — L7: dois consumos sem tombamento; fake em memória |
| CA-03 (PR-05*) | saldo | PT-02 | CT-03-16*: item CONSUMO recebe entrada de 10 unidades → saldo 10 | Não — nenhum teste de saldo | Não — o saldo é calculado em `movimentacoes.service`; exige integração com banco, fora do escopo unitário de itens |
| CA-07 | saldo | PT-01 | CT-03-17: item PATRIMONIAL recém-cadastrado → saldo 1 | Não — nenhum teste de saldo 1 | Não — idem; o cadastro de item não cria movimentação (ver observação no relatório) |
| CA-04 | nº de série, nível mínimo | PNS-01, PNM-01 | CT-03-18: cadastro sem nº de série e sem nível mínimo → item criado | Sim — schema e service CA5: opcionais omitidos | Sim — mantido da v1 |
| CA-04 | nº de série | PNS-02 | CT-03-19: cadastro com nº de série "SN-123" → item criado com esse nº de série | Sim — service CA5: nº de série informado é salvo | Sim — mantido da v1 |
| CA-04 | nível mínimo | PNM-02 | CT-03-20: cadastro de CONSUMO com nível mínimo 5 → item criado com nível mínimo 5 | Sim — schema CA5: nível mínimo 5 mantido | Sim — mantido da v1 |
| CA-04 (PR-03*) | nível mínimo | PNM-03, LM-01 (lado válido) | CT-03-21*: nível mínimo 0 → item criado | Sim — schema, service e update: nível mínimo 0 | Sim — mantido da v1 |
| CA-04 (PR-03*) | nível mínimo | PNM-04, LM-01 (lado inválido) | CT-03-22*: nível mínimo -1 → recusado | Sim — schema e update: nível mínimo -1 | Sim — mantido da v1 |
| CA-04 (PR-03*) | nível mínimo | PNM-05 | CT-03-23*: nível mínimo 2.5 → recusado | Sim — schema: 1.5 e 0.1; update: 2.5 | Sim — mantido da v1 |
| CA-05 | listagem | PLI-01 | CT-03-24: estoque com 3 itens → listagem devolve exatamente esses 3 | Parcial — 2 itens vindos do mock, não 3 | Sim* — L2: 3 itens, `meta.total` 3; fake em memória |
| CA-05 | listagem | PLI-01 | CT-03-25: dois estoques com itens → listagem de um não traz itens do outro | Parcial — só confere where { estoqueId } | Sim* — L3: isolamento entre dois estoques; fake em memória |
| CA-05 | listagem | PLI-02, LM-04 (0 itens) | CT-03-26: estoque sem itens → lista vazia | Parcial — só toBeDefined(), não verifica lista vazia | Sim — C2: `items` vazio e `meta.total` 0 |
| CA-05 | listagem | LM-04 (1 item) | CT-03-27: estoque com exatamente 1 item → lista com 1 elemento | Não — nenhum teste com exatamente 1 item | Sim* — L1: 1 item, `meta.total` 1; fake em memória |
| CA-05 | estoque | PES-02 | CT-03-28: listagem de estoque inexistente → não encontrado | Sim — service: estoque não existe, não consulta itens | Sim — mantido da v1 |
| CA-06 | perfil | PPF-01 | CT-03-29: gestor do estoque edita o nome de um item → atualizado | Sim — service CA5: update repassa nome (confere a chamada ao Prisma) | Sim — mantido da v1 |
| CA-06 | perfil | PPF-02 | CT-03-30: gestor de outro estoque tenta cadastrar → 403, nada criado | Sim* — service CA7: vínculo null, 403, nada criado | Sim* — mantido da v1 |
| CA-06 | perfil | PPF-02 | CT-03-31: gestor de outro estoque tenta editar → 403, item inalterado | Sim* — service CA7: vínculo null, 403, update não chamado | Sim* — mantido da v1 |
| CA-06 | perfil | PPF-03 | CT-03-32: requisitante tenta cadastrar → 403, nada criado | Parcial — só o caso genérico sem vínculo; sem requisitante | Sim* — L4: 403 e nada criado; o service não lê o perfil, só o vínculo de gestor |
| CA-06 | perfil | PPF-03 | CT-03-33: requisitante tenta editar → 403, item inalterado | Parcial — só o caso genérico sem vínculo; sem requisitante | Sim* — L4: 403 e item inalterado; o service não lê o perfil, só o vínculo de gestor |
| CA-06 (PR-04*) | perfil | PPF-04 | CT-03-34*: ADMIN sem vínculo com o estoque tenta cadastrar → 403 | Não — nenhum teste com ADMIN | Sim* — L5: 403; o service não lê o perfil, só o vínculo de gestor |
| CA-02 | tombamento | PTB-02 | CT-03-35: editar item PATRIMONIAL removendo o tombamento → recusado, tombamento anterior mantido | Parcial — schema update rejeita tombamento vazio; 'anterior mantido' não verificado | Parcial — L10: o schema recusa (path `tombamento`); 'anterior mantido' não é verificado de forma independente; sujeito à S3-19 |
| CA-02 | tombamento | PTB-04, LM-03 (lado inválido) | CT-03-36: editar o tombamento de um item para o valor de outro item → recusado | Sim* — service CA3: P2002 de tombamento na edição | Sim* — mantido da v1 |
| CA-02 | tombamento | LM-03 (lado válido) | CT-03-37: editar um item PATRIMONIAL mantendo o próprio tombamento → aceito (não conta como duplicado) | Não — nenhum teste de manter o próprio tombamento | Sim* — L9: edição mantendo o próprio tombamento, sem conflito; fake em memória |

Legenda da coluna v1: **Sim** = teste com entrada na partição e asserção sobre o resultado esperado; **Sim\*** = idem, mas só com o banco simulado (mock); **Parcial** = há teste, mas a asserção é trivial ou não distingue o caso; **Não** = nenhum teste. Na coluna da v2, **Sim\*** também cobre os casos verificados com o fake em memória de `prisma.item` (unicidade global de tombamento simulada), que continuam sendo simulação e não banco real.

## 7. Totais (contados nesta matriz)

| Indicador | Total |
|-----------|-------|
| Critérios de aceitação (CA-01 a CA-07) | 7 |
| Partições de equivalência | 27 |
| Fronteiras de valor-limite | 4 (8 valores) |
| Casos de teste esperados | 37 (6 dependem de premissa: CT-03-13, 16, 21, 22, 23, 34) |

Medição da v2 (mesmo escopo e ferramentas da v1): 34 dos 37 casos cobertos (Sim ou Sim\*), 1 parcial (CT-03-35) e 2 sem cobertura (CT-03-16 e CT-03-17, saldo). Partições: 27/27. Fronteiras: 4/4 (8/8 valores).

## 8. Revisão prevista na S3-19 (#95)

A S3-19 permite cadastrar item patrimonial sem tombamento (pendente) e completar o tombamento depois. Os casos abaixo valem para o requisito vigente (#7) e serão revisados quando a S3-19 for implementada:

| Caso | Hoje (#7) | Após a S3-19 |
|------|-----------|--------------|
| CT-03-08 | PATRIMONIAL sem tombamento é recusado | Aceito, fica pendente |
| CT-03-09 | PATRIMONIAL com tombamento "" é recusado | Aceito, fica pendente |
| CT-03-10 | PATRIMONIAL com tombamento só de espaços é recusado | Aceito, fica pendente |
| CT-03-35 | Editar removendo o tombamento é recusado, anterior mantido | Continua recusado (tombamento preenchido não pode ser apagado) |

Os testes de schema equivalentes (CA2 na v1) também mudam.