# Matriz de permissões (RBAC) — Sprint 2

> Decisões do PO (Randell). **Atualizado em 01/10/2026** após validação com a Gerência de Infraestrutura do CIn.
> Itens marcados com **[a confirmar]** dependem do cliente ou do time.
> Relacionado a: US02 (Controle de Acesso), RF02, RNF01.

## Papéis

| Papel | Quem é | Escopo |
|---|---|---|
| **ADMIN** | Administração central | Global. Cria estoques, autoriza gestores e **consulta** tudo. Não movimenta estoque. |
| **GESTOR** | Gerência de Infraestrutura, almoxarife, responsável por laboratório, secretaria | **Por estoque.** É gestor apenas dos estoques para os quais o ADMIN o autorizou. |
| **REQUISITANTE** | Servidores e docentes do CIn (demais usuários) | Global, somente consulta. A solicitação de empréstimo é feita **fora do sistema**, à Gerência. |

## Matriz

| Ação | ADMIN | GESTOR (do estoque) | REQUISITANTE |
|---|---|---|---|
| Criar, editar e desativar estoque | Sim | Não | Não |
| Autorizar gestores de um estoque | Sim | Não | Não |
| Ver lista de estoques, itens e **saldo** (somente leitura) | Sim, todos | Sim, todos | Sim, todos |
| Cadastrar categoria **[a confirmar: global ou por estoque]** | Não | Sim, no seu estoque | Não |
| Cadastrar e editar item (tombamento, nº de série, nível mínimo) | Não | Sim, no seu estoque | Não |
| Registrar entrada e saída | Não | Sim, no seu estoque | Não |
| Registrar empréstimo e devolução | Não | Sim, no seu estoque | Não |
| Gerar e baixar o termo (PDF) | Sim, leitura | Sim, do seu estoque | Só os próprios |
| Anexar o termo assinado | Não | Sim, do seu estoque | Não |
| Ver histórico de movimentações | Sim, todos | Sim, do seu estoque | Não |
| Ver empréstimos | Sim, todos | Sim, do seu estoque | Só os próprios |
| Ver alerta de estoque baixo | Sim, todos | Sim, do seu estoque | Não |

## Regras

1. **Ver não é alterar.** Qualquer usuário autenticado vê estoques, itens e saldos (para evitar pedir um item com saldo 0). Alterar ou movimentar exige ser gestor **daquele** estoque (RNF01).
2. **Papel de gestor é por estoque.** Quem é gestor do Estoque A não pode movimentar o Estoque B; nesse caso se comporta como REQUISITANTE.
3. **Só o gestor movimenta.** O ADMIN consulta, mas não registra entrada, saída nem empréstimo. Isso mantém a rastreabilidade: quem movimentou é sempre o responsável pelo estoque. A Gerência confirmou que as movimentações são feitas apenas por ela.
4. **Empréstimo:** a solicitação chega à Gerência fora do sistema. O gestor registra e escolhe o responsável (servidor ou docente). O responsável assina o termo fora do sistema (gov.br, SIPAC ou manual) e o gestor anexa o PDF assinado.
5. **Tentativa sem permissão:** o sistema recusa (403) e nada é alterado.
6. **Estoque sem gestor:** ninguém movimenta até o ADMIN autorizar alguém.

## Pontos para confirmar

- **Cliente:** a ficha do P02 diz que o *gestor* cadastra o próprio estoque (US01) e define quais grupos têm acesso (US02). A proposta é que o *ADMIN* crie os estoques e autorize os gestores. Confirmar se isso atende.
- **Categorias:** valem para todos os estoques ou são de cada um?
- **Aluno como detentor:** é P1; o responsável continua sendo servidor ou docente.

## Nota técnica (proposta para o ADR-002, com Mateus e Artur)

- O papel **ADMIN** pode vir como role do realm do Keycloak.
- O papel **GESTOR** é por estoque, então precisa de uma relação (usuário ↔ estoque) no banco, preenchida pelo ADMIN. Isso encaixa com o RBAC do boilerplate somado a uma checagem de estoque no service.
