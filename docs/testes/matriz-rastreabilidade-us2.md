# Matriz de Rastreabilidade - US02 (Controle de Acesso por Grupo em cada Estoque)

## 1. Critérios de Aceitação (Requisitos)
Os critérios abaixo foram extraídos das issues #21 e #41:
* **CA01:** O ADMIN (role do realm do Keycloak) cria estoques e consulta tudo.
* **CA02:** O ADMIN não pode movimentar itens no estoque.
* **CA03:** O ADMIN tem acesso exclusivo aos endpoints para adicionar, remover e listar gestores de um estoque (retorna 403 para os demais).
* **CA04:** O GESTOR altera e movimenta estoques apenas onde está autorizado (relação usuário ↔ estoque).
* **CA05:** O GESTOR se comporta como REQUISITANTE nos estoques em que não possui autorização.
* **CA06:** O REQUISITANTE não cria nem edita estoques, e também não cria/edita itens.
* **CA07:** Estoque sem gestor: ninguém pode movimentar itens até o ADMIN autorizar alguém.
* **CA08:** Qualquer tentativa de acesso negado deve retornar HTTP 403 e nada deve ser alterado no sistema.

---

## 2. Variáveis de Entrada e Partições de Equivalência

### 2.1 Matriz de Permissões (Papel x Ação)
As variáveis de entrada principais são o **Papel do Usuário (Role/Status)** e a **Ação Solicitada**.

| Ação Solicitada / Papel | ADMIN | GESTOR (Autorizado no Estoque) | GESTOR (Não Autorizado) | REQUISITANTE |
| :--- | :--- | :--- | :--- | :--- |
| **Criar Estoque** | Válido (Permitido) | Inválido (403) | Inválido (403) | Inválido (403) |
| **Consultar Estoque (Tudo)** | Válido (Permitido) | Válido (Permitido) | Válido (Permitido) | Válido (Permitido) |
| **Editar Estoque** | Inválido (403)* | Válido (Permitido) | Inválido (403) | Inválido (403) |
| **Movimentar Itens** | Inválido (403) | Válido (Permitido) | Inválido (403) | Inválido (403) |
| **Gerenciar Gestores (Add/Rem/List)**| Válido (Permitido) | Inválido (403) | Inválido (403) | Inválido (403) |

*(Premissa: O CA01 diz que ADMIN cria e consulta, mas o CA04 diz que GESTOR altera. Assumimos que ADMIN não altera dados do estoque, apenas os cria e vincula gestores. Carece de confirmação).*

### 2.2 Estado do Estoque
* **PE01 (Válida):** Estoque possui pelo menos 1 Gestor vinculado.
* **PE02 (Válida):** Estoque possui 0 Gestores vinculados (Neste caso, movimentação bloqueada para todos).

---

## 3. Valores-Limite (Fronteiras)
No contexto de controle de acesso (RBAC), as fronteiras testáveis referem-se à quantidade de gestores por estoque (CA07):
* **Fronteira 1 (Estoque sem gestor):** Quantidade de gestores = 0 (Impede qualquer movimentação).
* **Fronteira 2 (Estoque com gestor mínimo):** Quantidade de gestores = 1 (Permite movimentação pelo gestor específico).

---

## 4. Casos de Teste (Expected Results)

| ID | Cenário / Entrada | Resultado Esperado | Rastreabilidade | Coberto pela v1? | Coberto pela v2? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CT01** | ADMIN tenta criar um novo estoque. | Sucesso (201 Created). O estoque é criado. | CA01 | Não — nenhum teste de criação de estoque por ADMIN | Sim* — ADMIN permitido na matriz de rotas (`permite ADMIN criar estoque`) |
| **CT02** | ADMIN tenta consultar a lista de estoques. | Sucesso (200 OK). Retorna todos os estoques. | CA01 | Não — os testes ADMIN consultam empréstimos/histórico, não a lista de estoques | Sim* — ADMIN permitido na rota `findAll` (matriz de permissões)
| **CT03** | ADMIN tenta movimentar um item em qualquer estoque. | Erro (403 Forbidden). Estado inalterado. | CA02, CA08 | Não — a US02 não testa a rota/operação de movimentar | Sim* — `nega movimentação ao ADMIN com HTTP 403 e sem gravação` |
| **CT04** | ADMIN tenta adicionar um usuário como gestor do Estoque A. | Sucesso (200/201). Usuário é vinculado ao estoque. | CA03 | Parcial — "Roles registra o papel requerido no metadata da classe" (spec:107), sem endpoint de gestores | Parcial — ADMIN passa pelo guard e o controller delega; persistência do vínculo usa service simulado |
| **CT05** | GESTOR tenta adicionar outro gestor ao seu próprio estoque. | Erro (403 Forbidden). | CA03, CA08 | Parcial — `recusa USER quando a rota exige ADMIN` (spec:89), sem representar o perfil GESTOR nem o endpoint | Sim* — GESTOR recebe 403 nas rotas `addGestor`, `removeGestor` e `listGestores`; service não chamado |
| **CT06** | REQUISITANTE tenta acessar a lista de gestores de um estoque. | Erro (403 Forbidden). | CA03, CA08 | Parcial — "recusa USER quando a rota exige ADMIN" (spec:89), sem endpoint/perfil REQUISITANTE | Sim* — REQUISITANTE recebe 403 em `listGestores` antes do service |
| **CT07** | GESTOR (Autorizado) tenta editar as informações do seu estoque. | Sucesso (200 OK). | CA04 | Não — nenhum teste de edição de estoque por gestor | Sim* — `it.fails`: esperado 200, observado 403; defeito real documentado |
| **CT08** | GESTOR (Autorizado) tenta movimentar um item no seu estoque. | Sucesso (200/201). Movimentação registrada. | CA04 | Não — nenhum teste de movimentação autorizada na US02 | Sim* — gestor vinculado registra entrada/saída e o movimento é gravado |
| **CT09** | GESTOR tenta movimentar um item em um estoque onde NÃO está autorizado. | Erro (403 Forbidden). Comporta-se como requisitante. | CA05, CA08 | Parcial — "recusa cadastro de item sem vínculo com o estoque de destino" (spec:117) e "recusa consulta de empréstimos quando não há vínculo" (spec:139), sem teste de movimentação | Sim* — gestor de outro estoque recebe 403 ao movimentar; não grava |
| **CT10** | GESTOR tenta editar um estoque onde NÃO está autorizado. | Erro (403 Forbidden). | CA05, CA08 | Não — nenhum teste de edição por gestor não autorizado | Parcial — USER recebe 403, mas o spec não modela vínculo de gestor na rota de edição |
| **CT11** | REQUISITANTE tenta criar um novo estoque. | Erro (403 Forbidden). | CA06, CA08 | Não — nenhum teste de criação de estoque por requisitante | Sim* — USER recebe 403 antes de chamar `create`
| **CT12** | REQUISITANTE tenta editar um estoque existente. | Erro (403 Forbidden). | CA06, CA08 | Não — nenhum teste de edição por requisitante | Sim* — USER recebe 403 antes de chamar `update`
| **CT13** | GESTOR (Autorizado) tenta movimentar item num estoque que foi recém-criado, mas que o ADMIN ainda não o vinculou (0 gestores). | Erro (403 Forbidden). Movimentação bloqueada para todos. | CA07, CA08 | Parcial — "recusa cadastro de item sem vínculo" (spec:117), "recusa consulta de empréstimos sem vínculo" (spec:139) e "recusa histórico sem vínculo" (spec:176), mas não testa movimentação nem estoque recém-criado | Sim* — PE02: ADMIN, gestor candidato, gestor não autorizado e requisitante recebem 403; nenhum movimento é criado |