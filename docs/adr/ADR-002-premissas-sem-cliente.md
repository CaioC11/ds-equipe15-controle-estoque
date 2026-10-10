# ADR-002: Premissas de negócio assumidas sem resposta do cliente

- **Status:** Aceito e validado pela Gerência de Infraestrutura em 09/10/2026 (revisável)
- **Data:** 02/10/2026
- **Responsável:** Randell Lima (PO)
- **Relacionado a:** issue #15 (escopo e critérios de aceitação), PR #39, `docs/criterios-aceitacao-sprint2.md`, `docs/permissoes.md`

## Contexto

Na Sprint 2, sete pontos de regra de negócio estavam em aberto: quem cria os estoques e autoriza os gestores, escopo das categorias, como cadastrar o responsável pelo empréstimo, item de consumo e etiqueta de tombamento caída, tratamento de atraso, local de armazenamento do PDF assinado e forma do alerta de estoque baixo.

A Gerência de Infraestrutura do CIn respondeu em 01/10 sobre o processo de termos e tombamento. Para os demais pontos, o cliente foi procurado, mas não respondeu a tempo. O corte de funcionalidades é em 04/10 e a entrega em 06/10, e as tarefas de modelagem, backend e frontend dependiam dessas definições.

## Alternativas consideradas

1. **Esperar a resposta do cliente** antes de implementar os pontos em aberto.
2. **Implementar só o que já está confirmado** e deixar os demais pontos de fora da Sprint 2.
3. **O PO assume premissas razoáveis**, documenta cada uma com motivo e plano de reversão, e valida com o cliente depois.

## Critérios

- Não bloquear o time dentro do prazo da sprint.
- Baixo custo de reverter se o cliente discordar.
- Fidelidade à ficha do P02 e ao processo real descrito pela Gerência.
- Esforço de implementação compatível com o MVP.

## Restrições

- Prazo curto: corte de funcionalidades em 04/10 e entrega em 06/10 (depois adiada para 15/10).
- Sem acesso ao cliente em tempo hábil.
- Todos os itens do "Essencial (MVP)" da ficha precisam ser cobertos.

## Decisão

Adotar a **alternativa 3**. O PO assume as premissas A1 a A7 para a Sprint 2:

| # | Premissa | Se o cliente discordar |
|---|---|---|
| A1 | O ADMIN cria os estoques e autoriza os gestores (a ficha diz que o gestor cadastra e define os grupos) (**confirmada pela Gerência em 09/10**) | Mudar quem pode criar e autorizar; a relação usuário ↔ estoque continua igual |
| A2 | Categorias são globais; qualquer gestor cria e edita (**confirmada em 09/10**) | Acrescentar um estoque opcional à categoria |
| A3 | O responsável é um cadastro simples feito pelo gestor, sem exigir login (**confirmada em 09/10**) | Ligar o cadastro ao login (Keycloak/LDAP) pelo Siape ou e-mail |
| A4 | Item de consumo não tem tombamento; sem etiqueta, vale o nº de série (**confirmada pela Gerência em 05/10**) | Ajustar a validação no service |
| A5 | Atraso impede novo empréstimo até a devolução ou justificativa de permanência (**mudou em 05/10**; antes era só aviso) | Se não der tempo, só o aviso na Sprint 2 e o bloqueio na Sprint 3 |
| A6 | PDF assinado em disco persistente (volume Docker), atrás de um serviço de storage (**confirmada em 09/10**) | Trocar a implementação do serviço de storage por um bucket |
| A7 | Alerta de estoque baixo na tela; e-mail de aquisição e notificação de estoque máximo depois (**confirmada pela Gerência em 06/10**) | Acrescentar o envio de e-mail |

As escolhas privilegiam **reversibilidade**: nenhuma delas muda a forma central do modelo de dados se o cliente pedir outra coisa.

## Consequências

- O time pode seguir com modelagem, backend e frontend sem esperar o cliente.
- Há risco de retrabalho se o cliente discordar. A coluna "Se o cliente discordar" delimita o tamanho do ajuste em cada caso.
- A1 diverge do texto literal das US01 e US02 da ficha, e por isso é a premissa mais importante de validar.
- As premissas aparecem identificadas nos critérios de aceitação e no README, para ficar claro o que ainda não foi validado.
- A Gerência de Infraestrutura validou todas as premissas entre 05/10 e 09/10. Falta a validação do CInCoders sobre A1, que diverge do texto da ficha; este ADR deve ser atualizado se houver resposta.

## Trade-offs

Ganhamos velocidade e uma entrega completa do MVP, ao custo de possível divergência da ficha em alguns pontos. Esperar o cliente (alternativa 1) ou cortar escopo (alternativa 2) reduziria o risco de retrabalho, mas colocaria em risco a entrega dentro do prazo da disciplina.


## Atualização (05/10/2026)

A Gerência de Infraestrutura respondeu às dúvidas restantes: bens de consumo são o foco principal; bens com tombo são equipamentos e bens móveis, identificáveis também pelo nº de série; o atraso impede novos empréstimos até a devolução ou justificativa; notificações de estoque mínimo e e-mails de entrada, saída e aquisição são desejados.
Resultado: **A4 confirmada**, **A5 alterada** (de aviso para bloqueio, P1) e **A7 confirmada em parte** (e-mail fica para a Sprint 3). As demais premissas (A1, A2, A3 e A6) continuam sem validação.

## Atualização (06/10/2026)

A Gerência de Infraestrutura confirmou por e-mail os quatro pontos acima (A4, A5 e A7, além do e-mail de entrada e saída) e acrescentou a notificação de estoque **máximo**, que entra no backlog da Sprint 3. As premissas A1, A2, A3 e A6 continuam sem validação.

## Atualização (09/10/2026)

A Gerência de Infraestrutura respondeu às dúvidas restantes e à de hospedagem: **A1, A2, A3 e A6 foram confirmadas**. Segundo ela, é a Gerência quem de fato utiliza e movimenta os estoques; as categorias são únicas, com possibilidade de adicionar novas; o responsável deve ser gravado para reaproveitar em devoluções e novos empréstimos; e o CIn disponibiliza uma VM com Docker e volumes para os documentos, com backup diário e semanal. O estoque máximo foi considerado útil para evitar acúmulo de itens.
Com isso, **todas as premissas A1 a A7 foram validadas** pelos usuários da Gerência. Ressalva: A1 diverge do texto literal da ficha (US01 e US02), e não houve resposta do CInCoders sobre esse ponto.
