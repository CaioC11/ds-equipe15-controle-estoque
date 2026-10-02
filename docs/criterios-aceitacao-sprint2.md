# Sprint 2 — Escopo e critérios de aceitação

> Rascunho do PO (Randell) para a issue "#4 — Fechar escopo da sprint e critérios de aceitação das USs".
> **Atualizado em 01/10/2026**, após validação do processo atual de termos e tombamento com a Gerência de Infraestrutura do CIn.
> Itens marcados com **[a confirmar]** dependem de decisão do time ou do cliente.

---

## Parte 1 — Critérios de aceitação

Formato: **Dado / Quando / Então**.

### US01 — Gestão Multiestoque (RF01)
- **Dado** um ADMIN autenticado, **quando** cadastra um estoque com nome e setor, **então** o estoque aparece na listagem. **[a confirmar]** A ficha do cliente diz que o gestor cadastra o próprio estoque; a proposta é que o ADMIN cadastre e autorize os gestores (ver `permissoes.md`).
- **Dado** qualquer usuário autenticado, **quando** lista os estoques, **então** vê todos, com itens e saldos, em modo somente leitura.
- **Dado** um nome de estoque já existente, **quando** tenta cadastrar, **então** o sistema recusa com mensagem clara.

### US02 — Controle de Acesso (RF02, RNF01)
- **Dado** o ADMIN, **quando** autoriza um usuário como gestor de um estoque, **então** esse usuário passa a gerenciar apenas aquele estoque. **[a confirmar]** (a ficha diz que o gestor define os grupos com acesso).
- **Dado** um usuário que não é gestor do estoque, **quando** tenta alterar ou movimentar, **então** recebe acesso negado (403) e nada é alterado.
- **Dado** o ADMIN, **quando** consulta qualquer estoque, **então** vê os dados em leitura, mas não registra movimentações.

### US03 — Tombamento Patrimonial (RF03)
Regra validada com a Gerência de Infraestrutura: o tombamento é **obrigatório para todo bem público**, seja de projeto, doação, empréstimo ou transferência.
- **Dado** um item patrimonial (bem público), **quando** é cadastrado, **então** o sistema exige o número de tombamento.
- **Dado** um tombamento já cadastrado, **quando** alguém tenta repetir o número, **então** o sistema recusa por duplicidade.
- **[a confirmar]** **Dado** um item cuja etiqueta caiu ou que ainda não recebeu tombamento, **quando** o gestor informa o nº de série, **então** o cadastro é aceito e o tombamento pode ser completado depois, com a mesma validação de duplicidade.
- **Dado** um item de consumo (não patrimonial), **quando** é cadastrado, **então** o tombamento não é exigido e o controle é por saldo. **[a confirmar]**
- **Dado** um item, **quando** é cadastrado, **então** fica associado a um estoque e a uma categoria, com nº de série opcional.
- Bem pessoal (identificação e controle de entrada e saída) fica **fora do MVP** (Extra).

### RF04 — Movimentação e Saldo
- **Dado** um item, **quando** registro entrada de 10, **então** o saldo é 10.
- **Dado** saldo 10, **quando** registro saída de 3, **então** o saldo é 7.
- **Dado** uma movimentação, **quando** é registrada, **então** guarda quem, item, tipo, quantidade e data.
- **Dado** saldo 7, **quando** tento saída de 8, **então** o sistema recusa e o saldo não muda.
- **Dado** um estoque, **quando** consulto o saldo, **então** vejo o saldo de cada item naquele estoque.
- **Dado** um item, **quando** abro seu histórico de movimentações, **então** vejo todas as entradas e saídas, da mais recente para a mais antiga (RNF02).

### US04 — Registro de Empréstimo (RF05)
- **Dado** um item disponível, **quando** o gestor registra o empréstimo escolhendo o responsável (servidor ou docente, usuário do sistema), **então** o empréstimo fica "aguardando termo assinado".
- **Dado** o registro de um empréstimo, **quando** o prazo de devolução é informado, **então** ele é guardado; **quando** não é informado, **então** o prazo fica "indefinido" (como no modelo de termo do CIn).
- **Dado** um empréstimo aguardando termo assinado, **quando** o gestor anexa o termo assinado e confirma a entrega física, **então** o empréstimo fica "ativo" e o item passa a "emprestado".
- **Dado** um item já emprestado, **quando** tento emprestá-lo de novo, **então** o sistema recusa.
- **Dado** um empréstimo ativo, **quando** registro a devolução, **então** o item volta a ficar disponível.
- **Dado** um empréstimo com prazo vencido, **quando** o gestor lista os empréstimos, **então** o atraso aparece destacado.
- **[a confirmar]** **Dado** um responsável com item em atraso, **quando** tentam registrar novo empréstimo para ele, **então** o sistema recusa e informa a pendência.
- **Dado** um responsável, **quando** o gestor consulta seu histórico, **então** vê o que já pegou e devolveu.
- **Aluno:** só pode ter empréstimo com um servidor ou docente como responsável, que solicita e acompanha o processo (ocorre em ocasiões muito pontuais). No MVP o responsável é sempre servidor ou docente; o **detentor aluno** (com o modelo de termo de aluno) é **P1**, se sobrar tempo.
- As solicitações de empréstimo chegam à Gerência **fora do sistema**; quem registra é o gestor.

### US05 — Termo de Responsabilidade (RF06)
- **Dado** um empréstimo registrado, **quando** é criado, **então** o sistema gera o termo vinculado ao empréstimo e ao responsável, seguindo o modelo do CIn, em PDF.
- O termo contém: número sequencial (`Nº XX/ano`), responsável (nome, Siape, lotação e cargo), unidade de acautelamento (o estoque), data de abertura, data prevista de fechamento (ou "INDEFINIDO"), bens (tombamento ou nº de série e denominação) e a declaração de responsabilidade.
- **[a confirmar com Mateus e Artur]** Quais dados (Siape, lotação, cargo) vêm do login institucional e quais o gestor preenche.
- **Dado** um termo gerado, **quando** o gestor o abre, **então** pode visualizá-lo e baixá-lo em PDF.
- **Dado** que a assinatura é feita fora do sistema (gov.br, SIPAC ou manual, com o termo escaneado), **quando** o gestor anexa o PDF assinado ao empréstimo, **então** o arquivo fica guardado e vinculado a ele.
- **Dado** que o processo foi feito pelo SIPAC, **quando** o gestor baixa o termo de lá, **então** pode anexá-lo ao empréstimo da mesma forma.
- **Dado** um empréstimo sem termo assinado anexado, **então** ele não passa a "ativo".
- Modelo de termo de aluno: **P1**, junto do detentor aluno. Envio do termo por e-mail: Extra.

### US06 — Alerta de Reposição (RF07)
- **Dado** um item com nível mínimo definido, **quando** o saldo chega ao mínimo ou abaixo, **então** o gestor vê o alerta.
- **Dado** um item sem nível mínimo, **então** nenhum alerta é gerado.
- **Dado** saldo reposto acima do mínimo, **então** o alerta desaparece.
- **[a confirmar]** O alerta é visual na tela; notificação por e-mail fica como extra.

### Decisões que afetam a modelagem
| Decisão | Proposta | Responsável |
|---|---|---|
| Nível mínimo é campo do item | Sim (necessário para RF07) | Mateus |
| Tipo do item | Patrimonial (tombamento obrigatório) ou consumo (controle por saldo) | Mateus |
| Tombamento | Único; obrigatório em item patrimonial. Nº de série como campo à parte | Mateus |
| Item patrimonial: saldo 1 por registro | Sim, mais simples e fiel ao conceito de patrimônio | Time |
| Prazo de devolução | Opcional ("indefinido") | Mateus |
| Termo | PDF gerado no modelo do CIn, com número sequencial por ano | Time |
| Assinatura | Fora do sistema; o gestor anexa o PDF assinado (upload e armazenamento de arquivo) | Mateus / Artur |
| Responsável pelo empréstimo | Servidor ou docente, usuário do sistema (LDAP/Keycloak) | Mateus |
| Detentor aluno | P1 (campo opcional e modelo de termo de aluno) | PO |
| Estados do empréstimo | aguardando termo assinado → ativo → devolvido (ou atrasado) | Mateus |
| Bloqueio por atraso | Proposta: quem tem atraso não faz novo empréstimo | PO + Caio |
| Quem é gestor de cada estoque | Relação estoque ↔ usuários, preenchida pelo ADMIN | Mateus / Artur |

---

## Termo de Responsabilidade: fluxo (validado com a Gerência de Infraestrutura em 01/10)

1. O gestor registra o empréstimo escolhendo o responsável (servidor ou docente).
2. O sistema gera o termo em PDF, no modelo do CIn.
3. O responsável assina fora do sistema: gov.br, SIPAC ou manual (escaneado).
4. O gestor anexa o PDF assinado ao empréstimo (se foi pelo SIPAC, baixa o termo de lá).
5. O gestor confirma a entrega física e o empréstimo fica "ativo".
6. Na devolução, só o gestor marca como devolvido, depois de conferir o item.

Estados do empréstimo: **aguardando termo assinado → ativo → devolvido** (ou **atrasado**, quando o prazo vence).

A assinatura gov.br **integrada ao sistema** continua sendo Extra. O que entra no MVP é o upload do arquivo assinado, que a Gerência pediu.

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
- Assinatura eletrônica integrada do termo (gov.br)
- Envio do termo e de avisos por e-mail
- Previsão de reposição
- Histórico completo de um item (de qual estoque veio, quem já pegou emprestado)
- Identificação de bens pessoais
- Perfis de usuário avançados

**Fluxo da demo:** login → criar estoque → cadastrar item com tombamento → emprestar → gerar termo → anexar termo assinado → devolver.

**Decisão de stack:** backend NestJS + Prisma + PostgreSQL (confirmado pelo CInCoders em 29/09/2026; ver ADR-001).
```

> Lembre de trocar o status do README de "Sprint 1" para "Sprint 2" se ainda não foi feito.
