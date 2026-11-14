# Matriz de rastreabilidade — US04 (Registro de Empréstimo e devolução)

Sprint 3, Parte 1 (suíte de testes gerada por LLM). Responsável: Theo. Prazo: 11/11, até 12:00.

Esta matriz foi escrita **antes** de qualquer interação com a LLM. Os resultados esperados vêm dos critérios de aceitação da US04 (`docs/criterios-aceitacao-sprint2.md`), da matriz de permissões (`docs/permissoes.md`) e das premissas A3 e A5 (`docs/adr/ADR-002-premissas-sem-cliente.md`), não do código. Onde o requisito não define o comportamento, o ponto está registrado como **premissa** (seção 5) e marcado com `*` nas tabelas.

## 1. Escopo

- User story: US04 (RF05), o gestor de estoque registra a saída de um item associado a um responsável e a um prazo de devolução, para acompanhar as pendências.
- Operações cobertas: registrar empréstimo (escolhendo ou cadastrando o responsável), guardar o prazo, ativar o empréstimo (anexo do termo assinado e confirmação da entrega), registrar a devolução, destacar atraso na listagem, bloquear novo empréstimo de quem está em atraso e consultar o histórico do responsável.
- Estados do empréstimo (fonte: fluxo do termo): **aguardando termo assinado → ativo → devolvido**. O atraso não é um estado: é um empréstimo ativo com prazo vencido.
- Fora desta matriz: a geração do PDF do termo, o formato do arquivo anexado e seu tamanho (US05, matriz própria); detentor aluno (P1); relatório de atrasos (Extra).
- Os resultados "recusado" não fixam código HTTP nem texto exato, porque o requisito só define o **403** para quem não é gestor do estoque. As mensagens e os demais códigos serão conferidos contra o que a equipe definir.

## 2. Critérios de aceitação

| ID | Critério (fonte: US04 em `criterios-aceitacao-sprint2.md`, salvo indicação) |
|----|------------------------------------------------------------------------------|
| CA-01 | Item disponível + responsável escolhido ou cadastrado no ato: o empréstimo fica "aguardando termo assinado" (A3) |
| CA-02 | Responsável já cadastrado pode ser selecionado na lista (nome e Siape ou CPF), sem digitar os dados de novo (A3) |
| CA-03 | Prazo de devolução informado é guardado; se não informado, fica "indefinido" |
| CA-04 | Empréstimo aguardando termo: ao anexar o termo assinado e confirmar a entrega física, fica "ativo" e o item passa a "emprestado" (com a regra "sem termo anexado não fica ativo", da US05) |
| CA-05 | Item já emprestado não pode ser emprestado de novo |
| CA-06 | Item de consumo não permite empréstimo (só entrada e saída, por saldo) |
| CA-07 | Devolução de empréstimo ativo: o item volta a ficar disponível (só o gestor registra, depois de conferir o item) |
| CA-08 | Empréstimo com prazo vencido aparece com o atraso destacado na listagem |
| CA-09 | Responsável com item em atraso: novo empréstimo é impedido, com informação da pendência, até a devolução ou o registro de justificativa de permanência (A5) |
| CA-10 | Histórico do responsável mostra o que já pegou e devolveu |
| CA-11 | Só o gestor daquele estoque registra empréstimo e devolução; ADMIN, gestor de outro estoque e requisitante recebem 403 e nada é alterado (US02, RNF01 e `permissoes.md`) |

Os textos sobre aluno como detentor (P1) e sobre solicitações que chegam fora do sistema não são comportamentos a testar e não entram na contagem de cobertura.

## 3. Variáveis de entrada e partições de equivalência

`V` = válida, `I` = inválida, `*` = depende de premissa da seção 5.

| Variável | ID | Partição | Tipo |
|----------|----|----------|------|
| perfil de quem registra ou devolve | PPF-01 | gestor do estoque do item | V |
| perfil de quem registra ou devolve | PPF-02 | ADMIN | I |
| perfil de quem registra ou devolve | PPF-03 | gestor de outro estoque | I |
| perfil de quem registra ou devolve | PPF-04 | requisitante | I |
| item (existência) | PIE-01 | existente | V |
| item (existência) | PIE-02 | inexistente | I* |
| item (tipo) | PIT-01 | patrimonial com tombamento | V |
| item (tipo) | PIT-02 | patrimonial sem tombamento, com nº de série | V |
| item (tipo) | PIT-03 | de consumo | I |
| item (situação) | PIS-01 | disponível (nunca emprestado) | V |
| item (situação) | PIS-02 | emprestado (empréstimo ativo) | I |
| item (situação) | PIS-03 | com empréstimo aguardando termo assinado | I* |
| item (situação) | PIS-04 | devolvido, voltou a ficar disponível | V |
| responsável (origem) | PRO-01 | já cadastrado, selecionado na lista | V |
| responsável (origem) | PRO-02 | cadastrado no ato do empréstimo | V |
| responsável (origem) | PRO-03 | não informado | I |
| responsável (origem) | PRO-04 | identificador que não existe no cadastro | I* |
| responsável (dados do novo cadastro) | PRD-01 | nome e Siape ou CPF informados | V |
| responsável (dados do novo cadastro) | PRD-02 | nome ausente | I* |
| responsável (dados do novo cadastro) | PRD-03 | nem Siape nem CPF informados | I* |
| responsável (situação) | PRS-01 | sem empréstimos em atraso | V |
| responsável (situação) | PRS-02 | com ao menos um empréstimo em atraso | I |
| responsável (situação) | PRS-03 | atraso regularizado pela devolução | V |
| responsável (situação) | PRS-04 | atraso com justificativa de permanência registrada | V* |
| responsável (situação) | PRS-05 | com empréstimo ativo ainda dentro do prazo | V |
| prazo de devolução | PPZ-01 | informado, posterior à data de retirada | V |
| prazo de devolução | PPZ-02 | ausente (fica "indefinido") | V |
| prazo de devolução | PPZ-03 | anterior à data de retirada | I* |
| prazo de devolução | PPZ-04 | igual à data de retirada | V* |
| prazo de devolução | PPZ-05 | valor que não é uma data | I* |
| termo assinado e entrega | PTA-01 | termo anexado e entrega confirmada | V |
| termo assinado e entrega | PTA-02 | entrega confirmada sem termo anexado | I |
| termo assinado e entrega | PTA-03 | termo anexado, entrega ainda não confirmada | V* |
| estado do empréstimo (devolução) | PED-01 | ativo | V |
| estado do empréstimo (devolução) | PED-02 | aguardando termo assinado | I* |
| estado do empréstimo (devolução) | PED-03 | já devolvido | I* |
| empréstimo na listagem (atraso) | PAT-01 | ativo com prazo vencido | V |
| empréstimo na listagem (atraso) | PAT-02 | ativo com prazo ainda vigente | V |
| empréstimo na listagem (atraso) | PAT-03 | ativo com prazo indefinido | V* |
| empréstimo na listagem (atraso) | PAT-04 | aguardando termo, com prazo vencido | V |
| empréstimo na listagem (atraso) | PAT-05 | devolvido, com prazo que já passou | V |
| histórico do responsável | PHR-01 | com empréstimos ativos e devolvidos | V |
| histórico do responsável | PHR-02 | sem nenhum empréstimo | V* |

Total: **43 partições** (29 definidas pelo requisito e 14 dependentes de premissa: PIE-02, PIS-03, PRO-04, PRD-02, PRD-03, PRS-04, PPZ-03, PPZ-04, PPZ-05, PTA-03, PED-02, PED-03, PAT-03 e PHR-02).

## 4. Valores-limite (dois lados de cada fronteira)

"Lado recusado" é o valor que o sistema deve rejeitar (ou o estado em que a ação não ocorre); "lado aceito" é o valor que ele deve aceitar (ou o estado em que a ação ocorre).

| ID | Fronteira | Lado recusado / sem efeito | Lado aceito / com efeito |
|----|-----------|----------------------------|--------------------------|
| LM-01 | prazo × data de retirada* | prazo um dia antes da retirada | prazo no mesmo dia da retirada |
| LM-02 | vencimento do prazo (atraso)* | prazo = hoje: ainda não está em atraso | prazo = ontem: em atraso |
| LM-03 | empréstimos em atraso do responsável (A5) | 1 empréstimo em atraso: novo empréstimo impedido | 0 empréstimos em atraso: novo empréstimo permitido |
| LM-04 | empréstimos abertos do mesmo item (item patrimonial tem saldo 1) | 1 empréstimo ativo: novo empréstimo recusado | 0 empréstimos abertos: novo empréstimo aceito |
| LM-05 | termo assinado anexado × ativação | 0 anexos: a entrega não ativa o empréstimo | 1 anexo: a confirmação da entrega ativa o empréstimo |

Total: **5 fronteiras, 10 valores**.

## 5. Premissas a confirmar com a equipe

Pontos que os critérios da US04 não definem. Se a resposta for diferente, ajustar a linha correspondente antes do commit.

| ID | Premissa adotada na matriz | Por que precisa confirmar |
|----|----------------------------|---------------------------|
| PR-01 | Item inexistente e identificador de responsável inexistente são recusados com erro "não encontrado" e nada é criado | Os critérios não tratam esses casos |
| PR-02 | Item com empréstimo "aguardando termo assinado" já está reservado: novo empréstimo para ele é recusado | O critério só fala em "item já emprestado", e o item passa a "emprestado" apenas quando o empréstimo fica ativo |
| PR-03 | Prazo anterior à data de retirada é inválido; prazo no mesmo dia da retirada é válido; valor que não é data é inválido | Os critérios dizem só que o prazo é guardado ou fica "indefinido" |
| PR-04 | Atraso: o empréstimo está atrasado quando a data atual é posterior ao dia do prazo (no dia do prazo ainda não há atraso). Empréstimo ativo com prazo indefinido nunca fica em atraso | O fluxo diz "ativo com prazo vencido", sem definir o dia exato do vencimento nem o caso do prazo indefinido |
| PR-05 | O bloqueio por atraso (A5) está em vigor. Se ele ficar para a Sprint 3 (P1), CT-04-33, CT-04-36 e CT-04-37 passam a esperar só o aviso, sem impedir o registro | A5 diz que, se não der tempo, vale só o aviso |
| PR-06 | A justificativa de permanência libera novo empréstimo ao responsável, e seus campos não são testados | O critério cita a justificativa, mas não diz o que ela contém. **Implementada na [S3-20 (#100)](https://github.com/CaioC11/ds-equipe15-controle-estoque/issues/100) (ver seção 8):** texto livre obrigatório, uma por empréstimo |
| PR-07 | Novo responsável cadastrado no ato exige ao menos nome e Siape ou CPF; sem eles o registro é recusado | O critério lista nome e Siape ou CPF para a seleção, mas não diz o que é obrigatório |
| PR-08 | Anexar o termo sem confirmar a entrega mantém o empréstimo "aguardando termo assinado" | O critério descreve anexar e confirmar juntos |
| PR-09 | Devolver um empréstimo que não está ativo (aguardando termo ou já devolvido) é recusado e o estado fica como estava | Os critérios só descrevem a devolução de empréstimo ativo |
| PR-10 | Histórico de responsável sem empréstimos é uma lista vazia, sem erro | O critério só descreve o histórico com itens |
| PR-11 | **Não cobertos** por falta de requisito: formato e tamanho de Siape, CPF e e-mail; responsável duplicado (mesmo Siape ou CPF) cadastrado no ato; ordem do histórico do responsável; empréstimo de item em estoque desativado; mais de um item por empréstimo; detentor aluno (P1) | Os critérios não definem o comportamento |

## 6. Matriz de rastreabilidade

Os casos usam "hoje" como a data de registro do empréstimo.

| Requisito / critério | Variável | Partição ou limite | Caso de teste esperado | Coberto pela v1? | Coberto pela v2? |
|----------------------|----------|--------------------|------------------------|------------------|------------------|
| CA-01 | item, responsável, perfil | PPF-01, PIE-01, PIT-01, PIS-01, PRO-01, PRS-01 | CT-04-01: gestor do estoque registra o empréstimo de um item patrimonial com tombamento, disponível, para um responsável já cadastrado e sem atraso → empréstimo criado no estado "aguardando termo assinado", vinculado ao item e ao responsável | Parcial — 'registra o empréstimo de item disponível aguardando o termo assinado' usa responsável novo, não o já cadastrado. O status AGUARDANDO_TERMO vem do próprio mock e o vínculo com o item não é conferido | Sim* — '[v2] registra o empréstimo de item disponível, para responsável já cadastrado, aguardando o termo assinado' (create sem status explícito: o status nasce do default do banco) |
| CA-01 | item (tipo) | PIT-02 | CT-04-02: item patrimonial sem tombamento, com nº de série, disponível → empréstimo "aguardando termo assinado" | Não — o item usado em todos os testes tem tombamento | Sim* — '[v2] registra empréstimo de item patrimonial sem tombamento, identificado pelo nº de série' (termo gerado com tombamento nulo) |
| CA-01 (A3) | responsável (origem e dados) | PRO-02, PRD-01 | CT-04-03: gestor cadastra o responsável no próprio ato (nome, Siape ou CPF, lotação, cargo, e-mail) e registra o empréstimo → empréstimo "aguardando termo assinado" e responsável gravado no cadastro | Sim* — 'cadastra o responsável no ato quando ele ainda não existe' (create com nome, Siape, lotação e cargo; e-mail não enviado; Prisma simulado) | Sim* — v1 mantido: 'cadastra o responsável no ato quando ele ainda não existe' |
| CA-01 | responsável (origem) | PRO-03 | CT-04-04: registrar empréstimo sem informar o responsável → recusado, nenhum empréstimo criado | Não — o objeto responsável está sempre presente na entrada | Sim — '[v2] rejeita a entrada com o responsável ausente / nulo' (schema) |
| CA-01 (PR-01*) | responsável (origem) | PRO-04 | CT-04-05*: registrar empréstimo com identificador de responsável que não existe → recusado (não encontrado), nenhum empréstimo criado | Não — o módulo não aceita identificador de responsável, só dados digitados | Sim* — S3-21: identificador inexistente retorna 404 sem criar empréstimo, movimentação ou PDF |
| CA-01 (PR-07*) | responsável (dados do novo cadastro) | PRD-02 | CT-04-06*: cadastrar responsável no ato sem nome → recusado, nenhum cadastro nem empréstimo criado | Sim — schema: nome ausente, vazio e só com espaços são rejeitados | Sim — v1 mantido (schema: nome ausente, vazio e só com espaços) |
| CA-01 (PR-07*) | responsável (dados do novo cadastro) | PRD-03 | CT-04-07*: cadastrar responsável no ato sem Siape e sem CPF → recusado, nenhum cadastro nem empréstimo criado | Sim — schema: 'rejeita responsável sem Siape e sem CPF' | Sim — v1 mantido (schema: sem Siape e sem CPF) |
| CA-01 (PR-01*) | item (existência) | PIE-02 | CT-04-08*: registrar empréstimo de item inexistente → recusado (não encontrado), nenhum empréstimo criado | Sim* — 'recusa item inexistente (ou de outro estoque) com 404' (não confere que nada foi criado) | Sim* — v1 reforçado: 'recusa item inexistente (ou de outro estoque) com 404' agora confere que nenhum empréstimo foi criado |
| CA-02 (A3) | responsável (origem) | PRO-01, PRO-02 | CT-04-09: depois do CT-04-03, a lista de responsáveis traz o responsável recém-cadastrado, com nome e Siape ou CPF | Não — `it.todo` (consulta ausente no módulo; [S3-21 (#101)](https://github.com/CaioC11/ds-equipe15-controle-estoque/issues/101)) | Sim* — S3-21: cadastro feito no empréstimo aparece na consulta com nome e Siape; consulta também exercita cadastro só por CPF |
| CA-02 (A3) | responsável (origem) | PRO-01 | CT-04-10: novo empréstimo para o mesmo responsável, selecionado na lista, sem enviar seus dados de novo → empréstimo "aguardando termo assinado" ligado ao mesmo cadastro, sem cadastro duplicado | Parcial — 'reaproveita o responsável já cadastrado (encontrado por Siape) sem duplicar', mas o gestor reenvia os dados | Sim* — S3-21: seleciona por responsavelId, sem reenviar os dados, criar duplicata ou atualizar o cadastro; bloqueio por atraso continua ativo |
| CA-03 | prazo | PPZ-01 | CT-04-11: registrar com prazo de devolução 7 dias após hoje → prazo guardado exatamente como informado | Sim* — 'guarda o prazo de devolução quando informado' (prazo a 37 dias, mesma partição) | Sim* — v1 mantido: 'guarda o prazo de devolução quando informado' |
| CA-03 | prazo | PPZ-02 | CT-04-12: registrar sem informar o prazo → empréstimo criado com prazo "indefinido" (não é erro) | Sim* — 'deixa o prazo indefinido (null) quando omitido/nulo': a asserção do dado gravado passa e o teste falha na leitura do retorno do mock (erro do teste) | Sim* — '[v2] deixa o prazo indefinido (null) quando omitido / nulo' corrigido: confere o dado gravado, sem ler o retorno do mock |
| CA-03 (PR-03*) | prazo | PPZ-03, LM-01 (lado recusado) | CT-04-13*: registrar com prazo um dia antes de hoje → recusado, nenhum empréstimo criado | Sim — schema e service: prazo 1 ms antes da retirada é recusado e o create não é chamado | Sim — v1 mantido (schema e service: prazo 1 ms antes da retirada é recusado) |
| CA-03 (PR-03*) | prazo | PPZ-04, LM-01 (lado aceito) | CT-04-14*: registrar com prazo igual a hoje → aceito, prazo guardado | Sim — schema: prazo igual à retirada é válido; no service só confere que a chamada resolve | Sim — '[v2] aceita prazo igual à retirada e o guarda como informado' (substitui o teste trivial da v1) |
| CA-03 (PR-03*) | prazo | PPZ-05 | CT-04-15*: registrar com prazo que não é uma data (ex.: "amanhã cedo") → recusado, nenhum empréstimo criado | Sim — schema: 'rejeita prazo inválido' (texto e vazio) | Sim — v1 mantido (schema: prazo que não é data) |
| CA-04 | termo assinado e entrega, item | PTA-01, LM-05 (lado aceito) | CT-04-16: empréstimo aguardando termo, gestor anexa o termo assinado e confirma a entrega física → empréstimo "ativo" e item "emprestado" | Sim* — 'anexa o PDF assinado sem ativar' e 'torna o empréstimo ATIVO e o item EMPRESTADO', em dois testes separados | Sim* — v1 mantido (anexar e confirmar) e '[v2] Fluxo completo do empréstimo' |
| CA-04 (US05) | termo assinado e entrega | PTA-02, LM-05 (lado recusado) | CT-04-17: gestor confirma a entrega sem termo anexado → recusado; empréstimo continua "aguardando termo assinado" e o item não passa a "emprestado" | Sim* — 'recusa a entrega sem termo assinado anexado' (409; updateMany e item.update não chamados) | Sim* — v1 mantido: 'recusa a entrega sem termo assinado anexado' |
| CA-04 (PR-08*) | termo assinado e entrega | PTA-03 | CT-04-18*: gestor anexa o termo mas não confirma a entrega → empréstimo continua "aguardando termo assinado" | Sim* — 'anexa o PDF assinado sem ativar o empréstimo' | Sim* — v1 mantido: 'anexa o PDF assinado sem ativar o empréstimo' e etapa 2 do fluxo completo |
| CA-05 | item (situação) | PIS-02, LM-04 (lado recusado) | CT-04-19: item com empréstimo ativo, novo empréstimo para outro responsável → recusado; o empréstimo ativo original fica inalterado | Sim* — 'recusa empréstimo de item que já está emprestado' (409; create não chamado) | Sim* — v1 mantido, agora também confere que o item não foi alterado |
| CA-05 (PR-02*) | item (situação) | PIS-03 | CT-04-20*: item com empréstimo aguardando termo, novo empréstimo → recusado; o empréstimo existente fica inalterado | Sim* — 'recusa quando já existe empréstimo aguardando termo ou ativo para o item' (409) | Sim* — v1 mantido: 'recusa quando já existe empréstimo aguardando termo ou ativo' |
| CA-05, CA-07 | item (situação) | PIS-04, LM-04 (lado aceito) | CT-04-21: item devolvido (voltou a ficar disponível), novo empréstimo → aceito, "aguardando termo assinado" | Parcial — nenhum teste usa item que já foi emprestado e devolvido, só o disponível comum | Sim* — '[v2] aceita novo empréstimo de item que já foi emprestado e devolvido' (o filtro do service exclui o empréstimo DEVOLVIDO) |
| CA-06 | item (tipo) | PIT-03 | CT-04-22: registrar empréstimo de item de consumo → recusado; saldo do item e quantidade de empréstimos inalterados | Sim* — 'recusa item de consumo com erro de validação (400)' sem abrir transação | Sim* — v1 mantido: 'recusa item de consumo com erro de validação (400)' |
| CA-07 | estado do empréstimo, item | PED-01 | CT-04-23: gestor registra a devolução de empréstimo ativo → empréstimo "devolvido" e item volta a ficar disponível | Sim* — 'marca o empréstimo como DEVOLVIDO e libera o item' | Sim* — v1 mantido: 'marca o empréstimo como DEVOLVIDO e libera o item' e etapa 4 do fluxo completo |
| CA-07 (PR-09*) | estado do empréstimo | PED-02 | CT-04-24*: devolver empréstimo ainda aguardando termo → recusado; estado inalterado | Sim* — 'recusa devolver empréstimo AGUARDANDO_TERMO' (409; nada alterado) | Sim* — v1 mantido: 'recusa devolver empréstimo AGUARDANDO_TERMO' |
| CA-07 (PR-09*) | estado do empréstimo | PED-03 | CT-04-25*: devolver empréstimo já devolvido → recusado; estado e disponibilidade do item inalterados | Sim* — 'recusa devolver empréstimo DEVOLVIDO' (409; nada alterado) | Sim* — v1 mantido: 'recusa devolver empréstimo DEVOLVIDO' |
| CA-08 | empréstimo na listagem | PAT-01 | CT-04-26: empréstimo ativo com prazo vencido há 5 dias, gestor lista os empréstimos → atraso aparece destacado nesse empréstimo | Sim* — 'destaca como atrasado somente o empréstimo ativo com prazo vencido' (vencido há 1 dia) | Sim* — '[v2] é atraso quando o prazo venceu há 5 dias' (função) e '[v2] destaca o atraso de empréstimo vencido há 5 dias' (listagem) |
| CA-08 | empréstimo na listagem | PAT-02 | CT-04-27: empréstimo ativo com prazo daqui a 5 dias → listado sem destaque de atraso | Sim* — mesmo teste (prazo daqui a 1 dia: atrasado = false) | Sim* — os mesmos testes '[v2]', com prazo daqui a 5 dias (atrasado = false) |
| CA-08 (PR-04*) | prazo | LM-02 (lado recusado) | CT-04-28*: empréstimo ativo com prazo igual a hoje → listado sem destaque de atraso | Parcial — `estaAtrasado` com prazo exatamente igual a agora (instante), não o dia inteiro da PR-04 | Parcial — v1 mantido (prazo exatamente igual a agora, instante); `it.todo` para o dia inteiro, que depende de confirmar a PR-04 |
| CA-08 (PR-04*) | prazo | LM-02 (lado aceito) | CT-04-29*: empréstimo ativo com prazo igual a ontem → atraso destacado | Sim* — listagem (prazo de ontem) e `estaAtrasado` (1 ms antes de agora) | Sim* — v1 mantido (listagem e `estaAtrasado` 1 ms antes de agora) |
| CA-08 (PR-04*) | empréstimo na listagem | PAT-03 | CT-04-30*: empréstimo ativo com prazo indefinido, mesmo após muitos dias → listado sem destaque de atraso | Sim* — listagem e `estaAtrasado`: prazo indefinido não é atraso | Sim* — v1 mantido (listagem e `estaAtrasado`: prazo indefinido) |
| CA-08 | empréstimo na listagem | PAT-04 | CT-04-31: empréstimo aguardando termo com prazo já vencido → listado sem destaque de atraso (atraso é de empréstimo ativo) | Sim* — listagem e `estaAtrasado`: aguardando termo com prazo vencido não é atraso | Sim* — v1 mantido (listagem e `estaAtrasado`: aguardando termo com prazo vencido) |
| CA-08 | empréstimo na listagem | PAT-05 | CT-04-32: empréstimo devolvido, com prazo que já passou → listado sem destaque de atraso | Sim* — `estaAtrasado` com DEVOLVIDO; a listagem exclui devolvidos (where conferido) em vez de listá-los sem destaque | Sim* — v1 mantido e '[v2] não destaca atraso de empréstimo devolvido' na listagem |
| CA-09 (PR-05*) | responsável (situação) | PRS-02, LM-03 (lado recusado) | CT-04-33*: responsável com 1 empréstimo em atraso, gestor registra novo empréstimo para ele → impedido, com informação da pendência; nenhum empréstimo criado | Sim* — 'impede novo empréstimo para responsável com item em atraso' e 'informa a pendência na mensagem de erro': os dois FALHAM (defeito real, [S3-20 (#100)](https://github.com/CaioC11/ds-equipe15-controle-estoque/issues/100)) | Sim* — '[v2] impede novo empréstimo para responsável com item em atraso' e '[v2] informa a pendência na mensagem' (passam com a [S3-20 (#100)](https://github.com/CaioC11/ds-equipe15-controle-estoque/issues/100) implementada) |
| CA-09 | responsável (situação) | PRS-05, LM-03 (lado aceito) | CT-04-34: responsável com empréstimo ativo ainda dentro do prazo (0 em atraso), novo empréstimo → aceito | Não — nenhum teste monta responsável com outro empréstimo ativo dentro do prazo | Sim* — '[v2] aceita novo empréstimo quando o responsável tem empréstimo ativo dentro do prazo / com prazo indefinido / aguardando termo / devolvido' |
| CA-09 | responsável (situação) | PRS-03 | CT-04-35: responsável em atraso devolve o item em atraso e depois recebe novo empréstimo → aceito | Não — sem teste de devolução seguida de novo empréstimo ao mesmo responsável | Sim* — '[v2] aceita novo empréstimo depois que o responsável devolve o item em atraso' (bloqueia, devolve, libera; Prisma simulado) |
| CA-09 (PR-05*, PR-06*) | responsável (situação) | PRS-04 | CT-04-36*: responsável em atraso com justificativa de permanência registrada, novo empréstimo → aceito | Não — a justificativa de permanência não existe no service | Sim* — '[v2] libera o novo empréstimo depois que o gestor registra a justificativa de permanência', mais os testes de `registrarJustificativaPermanencia` e do schema |
| CA-09 (PR-05*) | responsável (situação) | PRS-02 | CT-04-37*: o atraso de um responsável não impede o empréstimo de outro responsável sem atraso, para o mesmo estoque → aceito | Não — nenhum teste usa dois responsáveis | Sim* — '[v2] o atraso de um responsável não impede o empréstimo de outro responsável' |
| CA-10 | histórico do responsável | PHR-01 | CT-04-38: responsável com um empréstimo ativo e um devolvido, gestor consulta o histórico → os dois aparecem, cada um com o item e a situação (ativo ou devolvido) | Não — `it.todo` (histórico ausente no módulo; [S3-21 (#101)](https://github.com/CaioC11/ds-equipe15-controle-estoque/issues/101)) | Sim* — S3-21: histórico mostra item e estado de empréstimo ativo e devolvido, com data da devolução; filtra responsável e estoque |
| CA-10 (PR-10*) | histórico do responsável | PHR-02 | CT-04-39*: responsável sem nenhum empréstimo → histórico vazio, sem erro | Não — idem CT-04-38 | Sim* — S3-21: responsável cadastrado sem empréstimos recebe histórico vazio, sem erro |
| CA-11 | perfil | PPF-02 | CT-04-40: ADMIN tenta registrar empréstimo → 403, nenhum empréstimo criado | Não — `create` recebe só o userId e nenhum teste usa o papel ADMIN | Sim* — '[v2] registro de empréstimo: ADMIN recebe 403 e nada é criado' (controller e service reais, Prisma simulado) |
| CA-11 | perfil | PPF-03 | CT-04-41: gestor de outro estoque tenta registrar empréstimo → 403, nenhum empréstimo criado | Sim* — 'nega acesso a usuário sem vínculo de gestor' (403; create não chamado) | Sim* — '[v2] registro de empréstimo: gestor de outro estoque recebe 403' e v1 mantido |
| CA-11 | perfil | PPF-04 | CT-04-42: requisitante tenta registrar empréstimo → 403, nenhum empréstimo criado | Parcial — só o caso genérico sem vínculo; o papel de requisitante não é testado | Sim* — '[v2] registro de empréstimo: requisitante (perfil USER sem vínculo) recebe 403' |
| CA-11 | perfil, estado do empréstimo | PPF-02, PED-01 | CT-04-43: ADMIN tenta registrar a devolução de empréstimo ativo → 403; empréstimo continua "ativo" | Não — nenhum teste de devolução com o papel ADMIN | Sim* — '[v2] devolução: ADMIN recebe 403 e o empréstimo continua ativo' |
| CA-11 | perfil, estado do empréstimo | PPF-03, PED-01 | CT-04-44: gestor de outro estoque tenta registrar a devolução → 403; empréstimo continua "ativo" | Sim* — 'devolver > nega acesso a quem não é gestor do estoque' | Sim* — '[v2] devolução: gestor de outro estoque recebe 403' e v1 mantido |
| CA-11 | perfil, estado do empréstimo | PPF-04, PED-01 | CT-04-45: requisitante tenta registrar a devolução → 403; empréstimo continua "ativo" | Parcial — idem CT-04-42, para a devolução | Sim* — '[v2] devolução: requisitante recebe 403 e o empréstimo continua ativo' |
| CA-01, CA-03, CA-04, CA-07 | fluxo completo | PPF-01, PIS-01, PTA-01, PED-01 | CT-04-46: gestor registra o empréstimo com prazo, anexa o termo assinado, confirma a entrega e registra a devolução → estados em sequência: aguardando termo, ativo, devolvido; item disponível, emprestado, disponível | Não — só testes unitários por método, sem fluxo encadeado | Sim* — '[v2] Fluxo completo do empréstimo': registra, anexa o termo, confirma a entrega e devolve, com estado simulado em memória (não é banco real) |
| CA-02, RNF01 | perfil na consulta | gestor do estoque | CT-04-47: lista de responsáveis, gestor do estoque → consulta autorizada | Não avaliado na medição histórica | Sim* — S3-21: gestor do estoque consulta a lista pelo controller e service reais |
| CA-02, RNF01 | perfil na consulta | ADMIN | CT-04-48: lista de responsáveis, ADMIN → consulta autorizada | Não avaliado na medição histórica | Sim* — S3-21: ADMIN sem vínculo consulta a lista |
| CA-02, RNF01 | perfil na consulta | requisitante | CT-04-49: lista de responsáveis, requisitante → 403, sem expor dados | Não avaliado na medição histórica | Sim* — S3-21: requisitante recebe 403 antes da leitura de responsáveis |
| CA-02, RNF01 | perfil na consulta | gestor de outro estoque | CT-04-50: lista de responsáveis, gestor de outro estoque → 403, sem expor dados | Não avaliado na medição histórica | Sim* — S3-21: gestor de outro estoque recebe 403 antes da leitura de responsáveis |
| CA-10, RNF01 | perfil na consulta | gestor do estoque | CT-04-51: histórico do responsável, gestor do estoque → consulta autorizada | Não avaliado na medição histórica | Sim* — S3-21: gestor consulta histórico com ativo e devolvido, restrito ao estoque |
| CA-10, RNF01 | perfil na consulta | ADMIN | CT-04-52: histórico do responsável, ADMIN → consulta autorizada | Não avaliado na medição histórica | Sim* — S3-21: ADMIN consulta histórico no estoque solicitado |
| CA-10, RNF01 | perfil na consulta | requisitante | CT-04-53: histórico do responsável, requisitante → 403, sem expor dados | Não avaliado na medição histórica | Sim* — S3-21: requisitante recebe 403 sem consultar ou expor o histórico |
| CA-10, RNF01 | perfil na consulta | gestor de outro estoque | CT-04-54: histórico do responsável, gestor de outro estoque → 403, sem expor dados | Não avaliado na medição histórica | Sim* — S3-21: gestor de outro estoque recebe 403 sem consultar ou expor o histórico |

Legenda da coluna "Coberto pela v1?" (medição de 13/11/2026, suíte `tests/v1-llm/us04-emprestimos.spec.ts`):

- **Sim**: há teste com entrada na partição e asserção sobre o resultado esperado, sobre código real (schema Zod ou função pura).
- **Sim\***: o teste existe e confere o resultado esperado, mas o estado do banco é simulado (Prisma e armazenamento com mock). Um teste que falha por defeito real também conta aqui.
- **Parcial**: há teste relacionado, mas ele não distingue a partição ou não confere parte do resultado esperado.
- **Não**: nenhum teste exercita o caso.

Resumo histórico da v1 nos 46 casos originais (CT-04-01 a 46; os oito complementares estão fora desta medição histórica): **27 Sim** (5 Sim e 22 Sim\*, 58,70%), **6 Parcial** (13,04%) e **13 Não** (28,26%: CT-04-02, 04, 05, 09, 34, 35, 36, 37, 38, 39, 40, 43 e 46).

## 7. Totais (contados nesta matriz)

| Indicador | Total |
|-----------|-------|
| Critérios de aceitação (CA-01 a CA-11) | 11 |
| Partições de equivalência | 43 |
| Fronteiras de valor-limite | 5 (10 valores) |
| Casos de teste esperados | 54: 46 originais + 8 complementares de permissão S3-21 (18 dos originais dependem de premissa: CT-04-05, 06, 07, 08, 13, 14, 15, 18, 20, 24, 25, 28, 29, 30, 33, 36, 37, 39) |

## 8. Atualização após a [S3-20 (#100)](https://github.com/CaioC11/ds-equipe15-controle-estoque/issues/100) (bloqueio por atraso, A5)

As seções 1 a 7 e a coluna "Coberto pela v1?" registram a medição de 13/11/2026 e **não foram alteradas**. Esta seção registra o efeito da correção.

**O que mudou no código**

- `EmprestimosService.create` recusa (409) o empréstimo quando o responsável (mesmo Siape ou CPF) tem empréstimo ATIVO com prazo vencido e sem justificativa. A mensagem informa o item, o vencimento e como regularizar. Prazo indefinido, ativo no prazo, devolvido e aguardando termo não bloqueiam.
- Nova ação `POST /estoques/:estoqueId/emprestimos/:id/justificativa-permanencia`, só para o gestor do estoque (403 para os demais, inclusive ADMIN). Corpo: `justificativa` (texto, 1 a 1000 caracteres). Só vale para empréstimo ativo em atraso (409 nos demais casos) e uma única vez por empréstimo (409 se repetida). O empréstimo continua ativo e "atrasado" na listagem, e o responsável passa a poder receber novo empréstimo.
- O campo `justificativaPermanencia` já existia no schema: não há migração.

**Decisões que a Issue deixou em aberto** (PR-06 e PR-05): o bloqueio entra completo, sem a alternativa de só avisar; a justificativa é texto livre obrigatório, sem anexo nem prazo de validade.

**Efeito nos casos desta matriz**

| Caso | Situação | Onde está coberto |
|------|----------|-------------------|
| CT-04-33 | Os 2 testes da v1 que falhavam ('impede novo empréstimo...' e 'informa a pendência...') passam a ter a regra implementada | `tests/v1-llm/us04-emprestimos.spec.ts` (não alterado) e `emprestimos.service.spec.ts` |
| CT-04-34 | Prazo vigente, indefinido ou devolvido não bloqueia | `emprestimos.service.spec.ts`: 'aceita quando não há empréstimo em atraso' e a consulta só considera ATIVO e vencido |
| CT-04-35 | Devolução regulariza: a consulta exige status ATIVO | Parcial: confere o filtro da consulta, sem o fluxo devolver e emprestar de novo |
| CT-04-36 | Justificativa registrada libera: a consulta exige `justificativaPermanencia` nula | `emprestimos.service.spec.ts` (consulta) e `registrarJustificativaPermanencia` (grava, 403, 404, 409) |
| CT-04-37 | Atraso de outro responsável não bloqueia: a consulta filtra por `responsavelId` | Parcial: confere o filtro da consulta |

Os testes novos usam Prisma simulado, como os demais do módulo, então valem como "Sim\*" pela legenda da seção 6. O fluxo encadeado (CT-04-35 completo e CT-04-46) segue dependendo de teste com banco real.

## 9. Cobertura pela v2 após a S3-21 (`tests/v2/us04-emprestimos.spec.ts`)

Execução de 14/11/2026: **217 testes, 216 passando, 0 falhando e 1 `it.todo`** (CT-04-28, PR-04). As pendências da S3-21 foram transformadas em testes executáveis. A coluna v1 e as seções históricas anteriores registram a medição original e não foram reclassificadas.

| Indicador | v1 (avaliação funcional histórica) | v2 após S3-21 |
|---|---|---|
| CTs originais cobertos (CT-04-01 a 46) | 27/46 (58,70%) | 45/46 (97,83%) |
| CTs originais parciais | 6 | 1 (CT-04-28) |
| CTs originais sem teste | 13 | 0 |
| CTs complementares de permissão (47 a 54) | Não avaliados na medição histórica | 8/8 Sim* |
| Total ampliado de CTs cobertos | — | 53/54 (98,15%), 1 Parcial |
| Partições cobertas | 30/43 (69,77%) | 43/43 (100%) |
| Valores-limite | 8/10 (80,00%) | 9/10 (90,00%) |
| Fronteiras com dois lados | 3/5 (60,00%) | 4/5 (80,00%) |
| CAs com ao menos um teste | 10/11 | 11/11 |
| CAs com todos os CTs originais em Sim/Sim* | 3/11 | 10/11 (falta CA-08 por CT-04-28) |

Comparação estrutural sobre **o mesmo código, após S3-21**, mesmas ferramentas (Vitest 4.1.8/v8), mesma configuração e recorte (controller, service e `create-emprestimo.dto.ts`):

| Indicador | v1 no código atual | v2 no código atual |
|---|---|---|
| Linhas | 83,64% (184/220) | 100% (220/220) |
| Branches | 81,51% (97/119) | 99,16% (118/119) |
| Statements | 82,82% (188/227) | 99,12% (225/227) |
| Funções | 77,08% (37/48) | 95,83% (46/48) |

Fontes: `relatorios/v1/us04-codigo-atual/coverage-summary.json` e `relatorios/v2/us04/coverage-summary.json`, regenerados após a implementação. O total global do HTML inclui outros módulos e não é o recorte US04 acima.

## 10. S3-21 implementada — seleção e histórico

- [S3-21 (#101)](https://github.com/CaioC11/ds-equipe15-controle-estoque/issues/101): CA-02 e CA-10 agora cobertos. CT-04-05, 09, 10, 38, 39 e 47 a 54 deixaram de ser pendentes na v2. A v1 permanece congelada, inclusive seus `it.todo`.
- Lista paginada do cadastro global com nome, Siape/CPF e id para seleção; empréstimo aceita `responsavelId` sem os dados do cadastro. Não cria duplicata nem altera os dados do responsável selecionado.
- Histórico paginado inclui todos os estados, o item e a data efetiva da devolução. A consulta é por responsável e estoque: não expõe empréstimos de outros responsáveis ou estoques. Responsável cadastrado sem empréstimos retorna lista vazia; identificador inexistente retorna 404.
- Permissões (RNF01): ADMIN consulta; gestor consulta seu estoque; requisitante, gestor de outro estoque e usuário ausente recebem 403 antes da leitura dos dados. ADMIN continua sem autorização para registrar empréstimos se não for gestor do estoque.
- [S3-20 (#100)](https://github.com/CaioC11/ds-equipe15-controle-estoque/issues/100): selecionar responsável existente não contorna o bloqueio por atraso; a contraprova está na v2.
- Frontend: seleção de cadastro ou novo cadastro no modal; painel de histórico acessível mesmo sem empréstimos pendentes; paginação completa, estados de carregamento, vazio e erro, e limpeza do histórico ao trocar estoque.
- **Única pendência remanescente: CT-04-28 / PR-04**, sobre considerar o dia inteiro do prazo como sem atraso. O código continua comparando instantes. A meta global de todos os limites ainda não foi cumprida.
- Os testes do backend usam Prisma simulado (`Sim*`): verificam comportamento, filtros, permissões e ausência de gravações, sem equivaler a uma execução com banco real.
