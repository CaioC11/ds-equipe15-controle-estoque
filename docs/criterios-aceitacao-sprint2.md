# Sprint 2 — Escopo e critérios de aceitação

> Rascunho do PO (Randell) para a issue "#4 — Fechar escopo da sprint e critérios de aceitação das USs".
> **Atualizado em 09/10/2026.** O processo de termos e tombamento e as demais regras foram validados com a Gerência de Infraestrutura do CIn (e-mails de 01/10 a 09/10). Durante a Sprint 2, o PO assumiu as premissas A1 a A7 para destravar o time (seção "Premissas validadas", no fim da Parte 1). Ponto ainda sem resposta do CInCoders: A1 diverge do texto literal da ficha (US01 e US02).
>
> **Atualização de 05/10/2026:** a Gerência de Infraestrutura respondeu às dúvidas restantes. A premissa **A4** foi confirmada, a **A5** mudou (atraso passa a impedir novo empréstimo) e a **A7** foi confirmada como mínimo (o e-mail fica para depois). Ver a tabela de premissas.
>
> **Confirmação de 06/10/2026:** a Gerência de Infraestrutura confirmou por e-mail os quatro pontos: bens de consumo como foco principal, impedimento de novos empréstimos em caso de atraso, notificações de estoque mínimo **e máximo** (com e-mail de aquisição, se possível) e e-mail ou alerta na entrada e na saída de bens.
>
> **Confirmação de 09/10/2026:** a Gerência de Infraestrutura validou as demais premissas: **A1** (a Gerência cria os estoques e autoriza os responsáveis; na prática, é quem utiliza e movimenta), **A2** (categorias únicas, com possibilidade de adicionar), **A3** (gravar o responsável para reaproveitar em devoluções e novos empréstimos), **A6** (VM do CIn com Docker e volumes, com backup diário e semanal) e o **estoque máximo** (útil para evitar acúmulo de itens). Todas as premissas A1 a A7 foram validadas.

---

## Parte 1 — Critérios de aceitação

Formato: **Dado / Quando / Então**.

### US01 — Gestão Multiestoque (RF01)
- **Dado** um ADMIN autenticado, **quando** cadastra um estoque com nome e setor, **então** o estoque aparece na listagem. *(Premissa A1)*
- **Dado** qualquer usuário autenticado, **quando** lista os estoques, **então** vê todos, com itens e saldos, em modo somente leitura.
- **Dado** um nome de estoque já existente, **quando** tenta cadastrar, **então** o sistema recusa com mensagem clara.

### US02 — Controle de Acesso (RF02, RNF01)
- **Dado** o ADMIN, **quando** autoriza um usuário como gestor de um estoque, **então** esse usuário passa a gerenciar apenas aquele estoque. *(Premissa A1)*
- **Dado** um usuário que não é gestor do estoque, **quando** tenta alterar ou movimentar, **então** recebe acesso negado (403) e nada é alterado.
- **Dado** o ADMIN, **quando** consulta qualquer estoque, **então** vê os dados em leitura, mas não registra movimentações.

### US03 — Tombamento Patrimonial (RF03)
Regra validada com a Gerência de Infraestrutura: o tombamento é **obrigatório para todo bem público**, seja de projeto, doação, empréstimo ou transferência.
- **Dado** um item patrimonial (bem público), **quando** é cadastrado, **então** o sistema exige a identificação do bem: número de tombamento ou, se a plaqueta caiu, o número de série.
- **Dado** um tombamento já cadastrado, **quando** alguém tenta repetir o número, **então** o sistema recusa por duplicidade.
- **Dado** um bem sem tombamento e sem nº de série (ainda não tombado ou plaqueta caída), **quando** o gestor o cadastra, **então** pode marcá-lo como "sem tombamento", como a Gerência já faz na planilha de inventário, e completar a identificação depois, com a mesma validação de duplicidade. *(Premissa A4, confirmada em 05/10)*
- **Dado** um item de consumo (não patrimonial), **quando** é cadastrado, **então** o tombamento não é exigido e o controle é por saldo. Segundo a Gerência, os bens de consumo são o **foco principal** do sistema. *(Premissa A4, confirmada em 05/10)*
- **Dado** um item, **quando** é cadastrado, **então** fica associado a um estoque e a uma categoria global, com nº de série opcional. *(Premissa A2)*
- Bem pessoal (identificação e controle de entrada e saída) fica **fora do MVP** (Extra).

### RF04 — Movimentação e Saldo
- **Dado** um item, **quando** registro entrada de 10, **então** o saldo é 10.
- **Dado** saldo 10, **quando** registro saída de 3, **então** o saldo é 7.
- **Dado** uma movimentação, **quando** é registrada, **então** guarda quem, item, tipo, quantidade e data.
- **Dado** saldo 7, **quando** tento saída de 8, **então** o sistema recusa e o saldo não muda.
- **Dado** um estoque, **quando** consulto o saldo, **então** vejo o saldo de cada item naquele estoque.
- **Dado** um item, **quando** abro seu histórico de movimentações, **então** vejo todas as entradas e saídas, da mais recente para a mais antiga (RNF02).

### US04 — Registro de Empréstimo (RF05)
- **Dado** um item disponível, **quando** o gestor registra o empréstimo escolhendo ou cadastrando, no próprio ato, o responsável (servidor ou docente), **então** o empréstimo fica "aguardando termo assinado". *(Premissa A3)*
- **Dado** um responsável já cadastrado, **quando** o gestor faz um novo empréstimo, **então** pode selecioná-lo na lista (nome e Siape ou CPF), sem digitar os dados de novo. *(Premissa A3)*
- **Dado** o registro de um empréstimo, **quando** o prazo de devolução é informado, **então** ele é guardado; **quando** não é informado, **então** o prazo fica "indefinido" (como no modelo de termo do CIn).
- **Dado** um empréstimo aguardando termo assinado, **quando** o gestor anexa o termo assinado e confirma a entrega física, **então** o empréstimo fica "ativo" e o item passa a "emprestado".
- **Dado** um item já emprestado, **quando** tento emprestá-lo de novo, **então** o sistema recusa.
- **Dado** um item de consumo, **quando** o gestor tenta registrar um empréstimo, **então** o sistema não permite: itens de consumo só têm entrada e saída (controle por saldo); o empréstimo e o termo são para bens patrimoniais. *(Decisão do PO, a confirmar na demonstração: a Gerência trata o consumo por saldo e o termo por bem)*
- **Dado** um empréstimo ativo, **quando** registro a devolução, **então** o item volta a ficar disponível.
- **Dado** um empréstimo com prazo vencido, **quando** o gestor lista os empréstimos, **então** o atraso aparece destacado.
- **Dado** um responsável com item em atraso, **quando** o gestor tenta registrar novo empréstimo para ele, **então** o sistema impede o registro e informa a pendência, até a devolução ou o registro de uma justificativa de permanência. *(Premissa A5, confirmada pela Gerência em 05/10; P1: se não der tempo, vale só o aviso e o bloqueio fica para a Sprint 3)*
- **Dado** um responsável, **quando** o gestor consulta seu histórico, **então** vê o que já pegou e devolveu.
- **Aluno:** só pode ter empréstimo com um servidor ou docente como responsável, que solicita e acompanha o processo (ocorre em ocasiões muito pontuais). No MVP o responsável é sempre servidor ou docente; o **detentor aluno** (com o modelo de termo de aluno) é **P1**, se sobrar tempo.
- As solicitações de empréstimo chegam à Gerência **fora do sistema**; quem registra é o gestor.

### US05 — Termo de Responsabilidade (RF06)
- **Dado** um empréstimo registrado, **quando** é criado, **então** o sistema gera o termo vinculado ao empréstimo e ao responsável, seguindo o modelo do CIn, em PDF.
- O termo contém: número sequencial (`Nº XX/ano`), responsável (nome, Siape ou CPF, lotação e cargo, vindos do cadastro feito pelo gestor), unidade de acautelamento (o estoque), data de abertura, data prevista de fechamento (ou "INDEFINIDO"), bens (tombamento ou nº de série e denominação) e a declaração de responsabilidade.
- **Dado** um termo gerado, **quando** o gestor o abre, **então** pode visualizá-lo e baixá-lo em PDF.
- **Dado** que a assinatura é feita fora do sistema (gov.br, SIPAC ou manual, com o termo escaneado), **quando** o gestor anexa o PDF assinado ao empréstimo, **então** o arquivo fica guardado e vinculado a ele.
- **Dado** que o processo foi feito pelo SIPAC, **quando** o gestor baixa o termo de lá, **então** pode anexá-lo ao empréstimo da mesma forma.
- **Dado** um empréstimo sem termo assinado anexado, **então** ele não passa a "ativo".
- **Dado** um arquivo anexado, **quando** não é PDF ou passa do limite de tamanho (cerca de 10 MB), **então** o sistema recusa com mensagem clara. *(Premissa A6)*
- Modelo de termo de aluno: **P1**, junto do detentor aluno. Envio do termo por e-mail: Extra.

### US06 — Alerta de Reposição (RF07)
- **Dado** um item com nível mínimo definido, **quando** o saldo chega ao mínimo ou abaixo, **então** o gestor vê o alerta na tela. *(Premissa A7)*
- **Dado** um item sem nível mínimo, **então** nenhum alerta é gerado.
- **Dado** saldo reposto acima do mínimo, **então** o alerta desaparece.
- Notificação por e-mail fica como Extra.

### Decisões que afetam a modelagem
| Decisão | Proposta | Responsável |
|---|---|---|
| Nível mínimo é campo do item | Sim; `null` quando não há mínimo | Mateus |
| Tipo do item | Patrimonial (tombamento ou nº de série, ou marcado como "sem tombamento") ou consumo (controle por saldo) | Mateus |
| Tombamento | Único; obrigatório em item patrimonial. Nº de série como campo à parte | Mateus |
| Item patrimonial: saldo 1 por registro | Proposta do PO, mais simples e fiel ao conceito de patrimônio. A planilha de controle da Gerência registra alguns equipamentos por quantidade, então vale confirmar | Time |
| Categoria | Tabela global, usada por todos os estoques (A2) | Mateus |
| Prazo de devolução | Opcional ("indefinido") | Mateus |
| Responsável pelo empréstimo | Cadastro simples feito pelo gestor (nome, Siape ou CPF, lotação, cargo, e-mail); não precisa ser usuário do sistema (A3) | Mateus |
| Termo | PDF gerado no modelo do CIn, com número sequencial por ano | Time |
| Assinatura | Fora do sistema; o gestor anexa o PDF assinado | Mateus / Artur |
| Armazenamento do PDF | Disco persistente (volume Docker), com o caminho no banco, atrás de um serviço de storage (A6) | Artur |
| Estados do empréstimo | aguardando termo assinado → ativo → devolvido (ou atrasado) | Mateus |
| Atraso | Impede novo empréstimo até a devolução ou justificativa de permanência (A5, confirmado em 05/10; P1) | Time |
| Quem é gestor de cada estoque | Relação estoque ↔ usuários, preenchida pelo ADMIN (A1) | Mateus / Artur |

### Premissas validadas pela Gerência de Infraestrutura
Durante a Sprint 2, o PO assumiu estas premissas para destravar o time. Todas foram validadas pela Gerência de Infraestrutura entre 05/10 e 09/10. A1 continua divergindo do texto literal da ficha (US01 e US02), e não houve resposta do CInCoders sobre esse ponto.

| # | Premissa | Motivo | Se o cliente discordar |
|---|---|---|---|
| A1 | O ADMIN cria os estoques e autoriza os gestores (a ficha diz que o gestor cadastra e define os grupos) | **Confirmada em 09/10:** a Gerência cria e autoriza os responsáveis e, na prática, é quem utiliza e movimenta os estoques | Mudar quem pode criar e autorizar; a relação usuário ↔ estoque continua igual |
| A2 | Categorias são globais; qualquer gestor cria e edita | **Confirmada em 09/10:** categorias únicas, com possibilidade de adicionar novas | Acrescentar um estoque opcional à categoria |
| A3 | O responsável é um cadastro simples feito pelo gestor, sem exigir login | **Confirmada em 09/10:** o sistema deve gravar o responsável para reaproveitar em devoluções e novos empréstimos, criando o histórico dele | Ligar o cadastro ao login (Keycloak/LDAP) pelo Siape ou e-mail |
| A4 | Item de consumo não tem tombamento; sem etiqueta, vale o nº de série | **Confirmada em 05/10:** o foco principal são os bens de consumo; bens com tombo são equipamentos e bens móveis, identificáveis também pelo nº de série | Ajustar a validação no service |
| A5 | Atraso impede novo empréstimo até regularizar a devolução ou registrar justificativa de permanência | **Mudou em 05/10 e foi reconfirmada em 06/10:** a Gerência confirmou que a pessoa fica impedida | Se não der tempo, entra só o aviso na Sprint 2 e o bloqueio fica para a Sprint 3 |
| A6 | PDF assinado em disco persistente | **Confirmada em 09/10:** o CIn disponibiliza uma VM com Docker e volumes para os documentos, com backup diário e semanal | Trocar a implementação do serviço de storage |
| A7 | Alerta de estoque baixo na tela; e-mail de aquisição e notificação de estoque máximo ficam para a Sprint 3 | **Confirmada pela Gerência em 06/10**, que pediu notificações de estoque mínimo e máximo e, se possível, e-mail para aquisição | Acrescentar o envio de e-mail |

---

## Termo de Responsabilidade: fluxo (validado com a Gerência de Infraestrutura em 01/10)

1. O gestor registra o empréstimo escolhendo (ou cadastrando) o responsável, servidor ou docente.
2. O sistema gera o termo em PDF, no modelo do CIn.
3. O responsável assina fora do sistema: gov.br, SIPAC ou manual (escaneado).
4. O gestor anexa o PDF assinado ao empréstimo (se foi pelo SIPAC, baixa o termo de lá).
5. O gestor confirma a entrega física e o empréstimo fica "ativo".
6. Na devolução, só o gestor marca como devolvido, depois de conferir o item.

Estados do empréstimo: **aguardando termo assinado → ativo → devolvido** (ou **atrasado**, quando o prazo vence).

A assinatura gov.br **integrada ao sistema** continua sendo Extra. O que entra no MVP é o upload do arquivo assinado, que a Gerência pediu.

Segundo a Gerência (e-mail de 01/10), para bens com tombamento o servidor pode assinar o termo pelo SIPAC, e o gestor baixa e anexa o arquivo; para bens sem tombamento, usa-se o modelo do CIn gerado pelo sistema, assinado por gov.br ou manualmente.

A regra "o empréstimo só fica ativo depois de anexado o termo assinado" é decisão do PO: a ficha do cliente diz que o termo é assinado ao retirar o item, mas a Gerência não tratou desse momento. Se atrapalhar a operação, a alternativa é ativar o empréstimo e deixar o termo marcado como "pendente".

> Os modelos oficiais de termo contêm dados reais de pessoas. Como o repositório é público, não versionar os arquivos originais; usar só a estrutura com campos em branco.

---

## Parte 2 — Seção para o README

```markdown
## 📦 Escopo da Sprint 2

**Dentro da sprint (Essencial/MVP do cliente):**
- Múltiplos estoques (RF01) e controle de acesso por grupo (RF02)
- Categorias de produto e tombamento patrimonial, obrigatório para bens públicos (RF03)
- Entrada, saída e saldo por estoque (RF04)
- Empréstimo e devolução (RF05)
- Termo de Responsabilidade gerado em PDF; o termo assinado (gov.br, SIPAC ou manual) é anexado ao empréstimo (RF06)
- Alerta de estoque baixo (RF07)

**Fora da sprint (Extras, planejados para a Sprint 3 se sobrar tempo):**
- Leitura de código de barras/QR para tombamento e movimentação
- Relatório de itens emprestados em atraso
- Relatório de consumo mensal e consumo médio mensal por item (como na planilha da Gerência)
- Notificação de estoque máximo (além do mínimo), pedida pela Gerência
- Situação do bem após vistoria da oficina (em uso, ocioso, recuperável, inservível)
- Transferência de bens entre locais ou setores (por exemplo, movimentação de mobiliário)
- E-mail de entrada e saída de bens e de aquisição de itens abaixo do mínimo
- Assinatura eletrônica integrada do termo (gov.br)
- Envio do termo e de avisos por e-mail
- Previsão de reposição
- Histórico completo de um item (de qual estoque veio, quem já pegou emprestado)
- Identificação de bens pessoais
- Perfis de usuário avançados

**Premissas assumidas na Sprint 2** (pendentes de validação com o cliente): ver `docs/criterios-aceitacao-sprint2.md`.

**Fluxo da demo:** login → criar estoque → cadastrar item com tombamento → emprestar → gerar termo → anexar termo assinado → devolver.

**Decisão de stack:** backend NestJS + Prisma + PostgreSQL (confirmado pelo CInCoders em 29/09/2026; ver ADR-001).
```
