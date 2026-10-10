# Matriz de permissões (RBAC) — Sprint 2

> Decisões do PO (Randell). **Atualizado em 09/10/2026.** As escolhas que não tiveram confirmação do cliente são **premissas da Sprint 2** (A1 a A7, em `criterios-aceitacao-sprint2.md`) e foram validadas pela Gerência de Infraestrutura em 09/10/2026.
>
> **Validação de 09/10/2026:** a Gerência confirmou que cria os estoques e autoriza os responsáveis e que, na prática, é quem utiliza e movimenta. Por isso, o mesmo usuário da Gerência acumula os papéis ADMIN e GESTOR (o ADMIN se autoriza como gestor dos estoques).
> Relacionado a: US02 (Controle de Acesso), RF02, RNF01.

## Papéis

| Papel | Quem é | Escopo |
|---|---|---|
| **ADMIN** | Administração central | Global. Cria estoques, autoriza gestores e **consulta** tudo. Não movimenta estoque. |
| **GESTOR** | Gerência de Infraestrutura, almoxarife, responsável por laboratório, secretaria | **Por estoque.** É gestor apenas dos estoques para os quais o ADMIN o autorizou. |
| **REQUISITANTE** | Servidores e docentes do CIn com login | Global, somente consulta de estoques, itens e saldos. A solicitação de empréstimo é feita **fora do sistema**, à Gerência. |

O **responsável pelo empréstimo** não é um papel do sistema: é um cadastro feito pelo gestor (premissa A3), e não precisa de login.

## Matriz

| Ação | ADMIN | GESTOR (do estoque) | REQUISITANTE |
|---|---|---|---|
| Criar, editar e desativar estoque | Sim | Não | Não |
| Autorizar gestores de um estoque | Sim | Não | Não |
| Ver lista de estoques, itens e **saldo** (somente leitura) | Sim, todos | Sim, todos | Sim, todos |
| Cadastrar e editar categoria (global) | Não | Sim | Não |
| Cadastrar e editar item (tombamento, nº de série, nível mínimo) | Não | Sim, no seu estoque | Não |
| Registrar entrada e saída | Não | Sim, no seu estoque | Não |
| Cadastrar responsável e registrar empréstimo e devolução | Não | Sim, no seu estoque | Não |
| Gerar e baixar o termo (PDF) | Sim, leitura | Sim, do seu estoque | Não |
| Anexar o termo assinado | Não | Sim, do seu estoque | Não |
| Ver histórico de movimentações | Sim, todos | Sim, do seu estoque | Não |
| Ver empréstimos | Sim, todos | Sim, do seu estoque | Não |
| Ver alerta de estoque baixo | Sim, todos | Sim, do seu estoque | Não |

## Regras

1. **Ver não é alterar.** Qualquer usuário autenticado vê estoques, itens e saldos (para evitar pedir um item com saldo 0). Alterar ou movimentar exige ser gestor **daquele** estoque (RNF01).
2. **Papel de gestor é por estoque.** Quem é gestor do Estoque A não pode movimentar o Estoque B; nesse caso se comporta como REQUISITANTE.
3. **Só o gestor movimenta.** O ADMIN consulta, mas não registra entrada, saída nem empréstimo. Isso mantém a rastreabilidade: quem movimentou é sempre o responsável pelo estoque. A Gerência de Infraestrutura confirmou que as movimentações são feitas apenas por ela.
4. **Empréstimo:** a solicitação chega à Gerência fora do sistema. O gestor registra e escolhe (ou cadastra) o responsável. O responsável assina o termo fora do sistema (gov.br, SIPAC ou manual) e o gestor anexa o PDF assinado.
5. **Tentativa sem permissão:** o sistema recusa (403) e nada é alterado.
6. **Estoque sem gestor:** ninguém movimenta até o ADMIN autorizar alguém.
7. **Categorias são globais:** qualquer gestor cria e edita; o ADMIN só consulta (premissa A2).

## Premissas (validadas pela Gerência de Infraestrutura) e pontos em aberto

- **A1** (validada em 09/10): o ADMIN cria os estoques e autoriza os gestores; na prática, é a Gerência quem usa e movimenta. A ficha do P02 diz que o *gestor* cadastra o próprio estoque (US01) e define os grupos (US02), então esse ponto ainda não foi confirmado com o CInCoders.
- **A2** (validada em 09/10): categorias globais, com possibilidade de adicionar novas.
- **A3** (validada em 09/10): o responsável é um cadastro simples feito pelo gestor, sem login, gravado para reaproveitar. Se um dia o cadastro for ligado ao login (Siape ou e-mail), o REQUISITANTE poderia ver os próprios empréstimos e termos.
- **Aluno como detentor:** é P1; o responsável continua sendo servidor ou docente.
- **Visibilidade de saldos para todos os usuários autenticados:** decisão do PO, ainda não validada pela Gerência. Se for um problema, restringir aos gestores e ao ADMIN.

## Nota técnica (proposta para o ADR-002, com Mateus e Artur)

- O papel **ADMIN** pode vir como role do realm do Keycloak.
- O papel **GESTOR** é por estoque, então precisa de uma relação (usuário ↔ estoque) no banco, preenchida pelo ADMIN. Isso encaixa com o RBAC do boilerplate somado a uma checagem de estoque no service.
