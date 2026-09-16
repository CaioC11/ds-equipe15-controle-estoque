# P02 — Controle de Estoque + Empréstimos

Repositório oficial da **Equipe 15** para o projeto da disciplina de Engenharia de Software (2026.2).

---

## 📌 Sobre o Projeto
O sistema tem como objetivo automatizar e gerenciar o fluxo de controle de estoque e a concessão de empréstimos de materiais do CIn.

* **Status Atual:** Sprint 1 — MVP Conceitual + Modelo de Gestão.
* **Data da Entrega:** 03/09/2026.

---

## 👥 Equipe e Papéis

| Integrante | Função / Papéis | Responsabilidades Principais |
| :--- | :--- | :--- |
| **Randell Lima** | Product Owner (PO) | Levantar requisitos, estruturar o Product Backlog e User Stories. |
| **Artur Regis** |Facilitador Ágil & Dev Lead | Facilitar o fluxo do quadro Kanban, gerenciar repositório e garantir o fluxo dev. |
| **Mateus Costa** | Desenvolvedor(a) / Architect | Modelagem do sistema, arquitetura e desenvolvimento da aplicação. |
| **Caio França** | Desenvolvedor(a) / Requisitos | Mapeamento de causa-raiz, análise de stakeholders e documentação. |
| **Theo Bessa** | Desenvolvedor(a) / QA | Apoio na especificação de testes, validação de regras de negócio e dev. |

---

## 🔄 Processo Ágil & Ritos

A equipe adota o **Scrumban**, combinando as entregas fixas das Sprints da disciplina com a flexibilidade e gestão visual do fluxo contínuo (Kanban).

* **Dailies Assíncronas:** Alinhamento diário no Discord/WhatsApp sobre o andamento das demandas e remoção de impedimentos.
* **Planejamento por Sprint:** Seleção e priorização de tarefas do *Backlog* para o ciclo vigente com base nas metas da entrega.
* **Quadro Visual & Limite de WIP:** Monitoramento no **GitHub Projects**, aplicando limite de trabalho em andamento (*Work in Progress - WIP*) na coluna *In Progress* para evitar gargalos.
* **Melhoria Contínua:** Reunião de alinhamento ao final de cada Sprint para ajustar o fluxo de trabalho e validar os incrementos.

---

## 🎯 MVP Conceitual

> Em contato com o CinCoders (cliente) para retirar dúvidas sobre o tema, antes de concretizar esses 3 tópicos.

### 1. Análise do Problema

* **Problema Principal:** Descontrole e ausência de rastreabilidade na gestão de materiais e equipamentos dos setores e laboratórios, atualmente controlados por planilhas soltas.
* **Sintomas:** Perda de rastreabilidade sobre quem retirou um item e quando, ausência de controle formal na retirada de equipamentos de maior valor (notebooks, projetores, equipamentos de laboratório).
* **Causa-Raiz:** Inexistência de um sistema centralizado que unifique a gestão multiestoque, o controle de acesso por setor e a formalização das retiradas através de termo de responsabilidade.
* **Stakeholders Afetados:**
  * **Gestores de Estoque (Almoxarifes, Responsáveis por Laboratórios, Secretarias):** responsáveis por gerenciar o próprio estoque, com controle de acesso e alertas de reposição.
  * **Requisitantes/Tomadores de Empréstimo:** necessitam solicitar itens emprestados e assinar o termo correspondente.
  * **Administração Central:** ponto de referência geral sobre os estoques dos diferentes setores.

---

### 2. Levantamento de Requisitos

#### Requisitos Funcionais (RF)
* **RF01 — Múltiplos Estoques:** Cadastrar e gerenciar estoques independentes por setor (ex.: almoxarifado central, laboratório X, secretaria).
* **RF02 — Controle de Acesso por Grupo:** Restringir a gestão de cada estoque a um grupo de pessoas autorizado.
* **RF03 — Categorização e Tombamento:** Cadastrar tipos/categorias de produto e vincular número de tombamento (patrimônio) aos itens aplicáveis.
* **RF04 — Movimentação e Saldo:** Registrar entradas e saídas, permitindo consulta de saldo por estoque.
* **RF05 — Módulo de Empréstimos:** Registrar empréstimos associando item, responsável, data de retirada e prazo de devolução.
* **RF06 — Termo de Responsabilidade:** Gerar o Termo de Responsabilidade (termo de responsabilidade de guarda e uso) vinculado a cada empréstimo, para assinatura do responsável no ato da retirada.
* **RF07 — Alerta de Estoque Baixo:** Notificar os gestores quando o saldo de um item atingir o nível mínimo.

#### Requisitos Não Funcionais (RNF)
* **RNF01 — Segurança & Isolamento:** Garantir que gestores de um estoque não movimentem ou alterem dados de outros estoques sem permissão explícita.
* **RNF02 — Rastreabilidade:** Manter registro das movimentações de entrada, saída e empréstimos por estoque.

---

### 3. Histórias de Usuário Priorizadas (User Stories)

* **US01 (Gestão Multiestoque):** Como gestor de estoque, quero cadastrar e gerenciar meu próprio estoque para controlar os itens sob minha responsabilidade. *(Prioridade: Alta)*
* **US02 (Controle de Acesso):** Como gestor de estoque, quero definir quais grupos têm acesso ao meu estoque para evitar movimentações não autorizadas. *(Prioridade: Alta)*
* **US03 (Tombamento Patrimonial):** Como gestor de estoque, quero cadastrar o número de tombamento dos equipamentos para manter o controle patrimonial dos itens. *(Prioridade: Alta)*
* **US04 (Registro de Empréstimo):** Como gestor de estoque, quero registrar a saída de um item associado a um responsável e prazo de devolução para acompanhar as pendências. *(Prioridade: Alta)*
* **US05 (Termo de Responsabilidade):** Como requisitante, quero receber o Termo de Responsabilidade ao retirar um item emprestado para formalizar a posse temporária do equipamento. *(Prioridade: Alta)*
* **US06 (Alerta de Reposição):** Como gestor de estoque, quero visualizar alertas de estoque baixo para providenciar reposição a tempo. *(Prioridade: Média)*

## 🛠️ Versionamento & Fluxo de Desenvolvimento

Para garantir a organização e qualidade do código, a equipe segue as diretrizes abaixo:

### Estratégia de Branches (*GitHub Flow*)
* `main`: Branch protegida contendo apenas código estável e revisado.
* `feature/nome-da-feature`: Para desenvolvimento de novos requisitos (ex: `feature/cadastro-item`).
* `fix/nome-do-bug`: Para correções de falhas (ex: `fix/erro-autenticacao`).
* `docs/nome-da-doc`: Para inclusão de documentações e arquivos de texto (ex: `docs/mvp-conceitual`).

### Convenção de Commits (*Conventional Commits*)
A mensagem de commit deve sempre seguir a estrutura `tipo: descrição sucinta`:
* `feat:` Adição de nova funcionalidade.
* `fix:` Correção de erros ou problemas de lógica.
* `docs:` Alterações na documentação do projeto.
* `style:` Ajustes de formatação sem alteração na lógica de código.
* `refactor:` Reformulação de código existente sem alterar seu comportamento final.

### Fluxo de Code Review & Pull Request (PR)
1. Commits diretos na branch `main` são bloqueados.
2. Todo trabalho deve ser feito em uma branch secundária derivada da `main`.
3. Para integrar o código à `main`, abra um **Pull Request (PR)** descrevendo as alterações realizadas.
4. É obrigatória a revisão e **aprovação de pelo menos 1 integrante** para permitir o merge do PR.

---

## 🚀 Como Executar o Projeto Localmente

```bash
# Clonar o repositório
git clone [https://github.com/CaioC11/ds-equipe15-controle-estoque.git](https://github.com/CaioC11/ds-equipe15-controle-estoque.git)

# Acessar a pasta do repositório
cd ds-equipe15-controle-estoque
