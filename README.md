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
| **[Nome 2]** |Facilitador Ágil & Dev Lead | Facilitar o fluxo do quadro Kanban, gerenciar repositório e garantir o fluxo dev. |
| **[Nome 3]** | Desenvolvedor(a) / Architect | Modelagem do sistema, arquitetura e desenvolvimento da aplicação. |
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
