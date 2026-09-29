# Sprint 2 — Escopo e critérios de aceitação

> Rascunho do PO (Randell) para a issue "#4 — Fechar escopo da sprint e critérios de aceitação das USs".
> Itens marcados com **[a confirmar]** dependem de decisão do time.

---

## Parte 1 — Critérios de aceitação

Formato: **Dado / Quando / Então**.

### US01 — Gestão Multiestoque (RF01)
- **Dado** um gestor autenticado, **quando** cadastra um estoque com nome e setor, **então** o estoque aparece na listagem.
- **Dado** um gestor, **quando** lista os estoques, **então** vê apenas os que pode gerenciar.
- **Dado** um nome de estoque já existente, **quando** tenta cadastrar, **então** o sistema recusa com mensagem clara.

### US02 — Controle de Acesso (RF02, RNF01)
- **Dado** o gestor de um estoque, **quando** define os grupos autorizados, **então** só integrantes desses grupos gerenciam o estoque.
- **Dado** um usuário fora do grupo, **quando** tenta alterar ou movimentar o estoque, **então** recebe acesso negado (403) e nada é alterado.
- **Dado** o papel ADMIN, **quando** consulta qualquer estoque, **então** tem acesso de visualização a todos.

### US03 — Tombamento Patrimonial (RF03)
- **Dado** um item patrimonial, **quando** o gestor informa o número de tombamento, **então** ele fica vinculado ao item.
- **Dado** um tombamento já cadastrado, **quando** alguém tenta repetir o número, **então** o sistema recusa por duplicidade.
- **Dado** qualquer item, **quando** é cadastrado sem tombamento, **então** o cadastro é aceito (o tombamento nunca é obrigatório, pois a etiqueta pode ter caído ou o item não ser patrimonial).
- **Dado** um item cadastrado sem tombamento, **quando** o gestor descobre o número depois, **então** pode informá-lo em uma edição, com a mesma validação de duplicidade.
- **Dado** um item, **quando** é cadastrado, **então** fica associado a um estoque e a uma categoria.

### RF04 — Movimentação e Saldo
- **Dado** um item, **quando** registro entrada de 10, **então** o saldo é 10.
- **Dado** saldo 10, **quando** registro saída de 3, **então** o saldo é 7.
- **Dado** uma movimentação, **quando** é registrada, **então** guarda quem, item, tipo, quantidade e data.
- **Dado** saldo 7, **quando** tento saída de 8, **então** o sistema recusa e o saldo não muda.
- **Dado** um estoque, **quando** consulto o saldo, **então** vejo o saldo de cada item naquele estoque.
- **Dado** um item, **quando** abro seu histórico de movimentações, **então** vejo todas as entradas e saídas, da mais recente para a mais antiga (RNF02).

### US04 — Registro de Empréstimo (RF05)
- **Dado** um item disponível, **quando** o gestor registra o empréstimo escolhendo um responsável (usuário do sistema) e o prazo de devolução, **então** o empréstimo fica "aguardando aceite".
- **Dado** um empréstimo aguardando aceite, **quando** o responsável aceita o termo e o gestor confirma a entrega física, **então** o empréstimo fica "ativo" e o item passa a "emprestado".
- **Dado** um item já emprestado, **quando** tento emprestá-lo de novo, **então** o sistema recusa.
- **Dado** um empréstimo ativo, **quando** registro a devolução, **então** o item volta a ficar disponível.
- **Dado** um prazo vencido, **quando** o gestor lista os empréstimos, **então** o atraso aparece destacado.
- **[a confirmar]** **Dado** um responsável com item em atraso, **quando** tentam registrar novo empréstimo para ele, **então** o sistema recusa e informa a pendência.
- **Dado** um responsável, **quando** o gestor consulta seu histórico, **então** vê o que já pegou e devolveu.
- Empréstimo vale para qualquer item, com ou sem tombamento (regra do cliente: o tombamento é opcional).

### US05 — Termo de Responsabilidade (RF06)
- **Dado** um empréstimo registrado, **quando** é criado, **então** o sistema gera o termo vinculado ao empréstimo e ao responsável.
- O termo contém: responsável (nome e identificação vindos do login institucional), item (com tombamento, se houver), estoque, data de retirada, prazo de devolução e cláusula de guarda e uso.
- **Dado** um empréstimo, **quando** o gestor abre o termo, **então** pode visualizá-lo e baixá-lo em PDF.
- Se o item não tem tombamento, o termo o identifica por nome, categoria e estoque.
- **[a confirmar]** Envio do termo (PDF) para o e-mail do responsável ao confirmar o empréstimo.
- **Dado** um termo gerado, **quando** o responsável entra com o login institucional e clica em "Li e aceito", **então** o sistema registra quem aceitou, a data e a hora.
- **Dado** um termo ainda não aceito, **então** o empréstimo não passa a "ativo".

### US06 — Alerta de Reposição (RF07)
- **Dado** um item com nível mínimo definido, **quando** o saldo chega ao mínimo ou abaixo, **então** o gestor vê o alerta.
- **Dado** um item sem nível mínimo, **então** nenhum alerta é gerado.
- **Dado** saldo reposto acima do mínimo, **então** o alerta desaparece.
- **[a confirmar]** O alerta é visual na tela; notificação por e-mail fica como extra.

### Decisões que afetam a modelagem
| Decisão | Proposta | Responsável |
|---|---|---|
| Nível mínimo é campo do item | Sim (necessário para RF07) | Mateus |
| Tombamento | Campo opcional e único quando preenchido (no Postgres/Prisma, `@unique` em campo opcional aceita vários itens sem valor) | Mateus |
| Item patrimonial: saldo 1 por registro | Sim, mais simples e fiel ao conceito de patrimônio | Time |
| Formato do termo | PDF gerado pelo sistema | Time |
| Aceite do termo | Eletrônico, com login institucional (sem gov.br no MVP) | PO + cliente |
| Responsável pelo empréstimo | Usuário do sistema (vindo do LDAP/Keycloak) | Mateus |
| Bloqueio por atraso | Proposta: quem tem atraso não faz novo empréstimo | PO + Caio |
| Quem é gestor de cada estoque | Tabela estoque ↔ grupos/usuários, com papéis do Keycloak | Mateus / Artur |

---

## Aceite eletrônico do termo (proposta do PO)

Os responsáveis são professores e servidores do CIn, todos com login institucional (LDAP/Keycloak). Por isso, no MVP, o aceite é **eletrônico**, sem assinatura gov.br:

1. O gestor registra o empréstimo escolhendo o responsável (usuário do sistema).
2. O sistema gera o termo (PDF) vinculado ao responsável.
3. O responsável entra com seu login e clica em "Li e aceito"; o sistema guarda quem, quando e qual versão do termo.
4. O gestor confirma a entrega física e o empréstimo fica "ativo".
5. Na devolução, só o gestor marca como devolvido, depois de conferir o item.

Estados do empréstimo: **aguardando aceite → ativo → devolvido** (ou **atrasado**, quando o prazo vence).

**[a confirmar com o cliente]** se o aceite eletrônico com login institucional basta como Termo de Responsabilidade. Se exigirem assinatura, a alternativa é anexar um PDF assinado (gov.br ou papel) ao empréstimo, e a assinatura integrada fica como Extra.

---

## Parte 2 — Seção para o README

```markdown
## 📦 Escopo da Sprint 2

**Dentro da sprint (Essencial/MVP do cliente):**
- Múltiplos estoques (RF01) e controle de acesso por grupo (RF02)
- Categorias de produto e tombamento patrimonial (RF03)
- Entrada, saída e saldo por estoque (RF04)
- Empréstimo e devolução (RF05)
- Termo de Responsabilidade (RF06), com aceite eletrônico do responsável
- Alerta de estoque baixo (RF07)

**Fora da sprint (Extras, planejados para a Sprint 3 se sobrar tempo):**
- Leitura de código de barras/QR para tombamento e movimentação
- Relatório de itens emprestados em atraso
- Assinatura eletrônica integrada do termo (gov.br); no MVP o termo é gerado em PDF e aceito eletronicamente com o login institucional
- Previsão de reposição
- Histórico completo de um item (de qual estoque veio, quem já pegou emprestado)
- Perfis de usuário avançados

**Fluxo da demo:** login → criar estoque → cadastrar item com tombamento → emprestar → gerar termo → devolver.

**Decisão de stack:** backend NestJS + Prisma + PostgreSQL (confirmado pelo CInCoders em 29/09/2026; ver ADR-001).
```

> Lembre de trocar o status do README de "Sprint 1" para "Sprint 2".
