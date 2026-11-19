# P02 — Controle de Estoque + Empréstimos

Repositório oficial da **Equipe 15** para o projeto da disciplina de Desenvolvimento de Software (CIN0136 — 2026.2).

---

## 📌 Sobre o Projeto

O sistema tem como objetivo automatizar e centralizar o controle de estoque multi-setorial, a rastreabilidade de movimentações e a concessão de empréstimos de materiais e equipamentos do CIn, substituindo controles manuais em planilhas soltas.

* **Status Atual:** Sprint 3 Finalizada | **Sprint 4 em Progresso** (Deploy e Pitch).
* **Repositório:** `ds-equipe15-controle-estoque`

---

## 👥 Equipe e Papéis

| Integrante | Função / Papéis | Responsabilidades Principais |
| :--- | :--- | :--- |
| **Randell Lima** | Product Owner (PO) | Levantamento de requisitos, estruturação do Product Backlog e User Stories. |
| **Artur Regis** | Facilitador Ágil & Dev Lead | Facilitação do fluxo Kanban, gestão do repositório, CI/CD e liderança técnica. |
| **Mateus Costa** | Desenvolvedor / Architect | Modelagem de dados, arquitetura do sistema e desenvolvimento full-stack. |
| **Caio França** | Desenvolvedor / Requisitos | Mapeamento de causa-raiz, análise de stakeholders, refatoração e documentação. |
| **Theo Bessa** | Desenvolvedor / QA | Especificação e execução de suítes de testes (V1/V2), qualidade e desenvolvimento. |

> **Nota sobre a organização da equipe:** Embora a equipe tenha definido inicialmente papéis inspirados no Scrum para estruturar a condução do projeto, percebeu-se ao longo das entregas que a distribuição rígida por cargos geraria desequilíbrio na carga de trabalho. Dessa forma, o grupo adaptou sua dinâmica para uma **divisão funcional orientada aos requisitos e histórias de usuário (US01 a US06)**, permitindo que todos os integrantes atuassem de forma colaborativa e equilibrada tanto no desenvolvimento (back-end e front-end) quanto na documentação e nos testes de cada funcionalidade.

---

## 🔄 Processo Ágil & Dinâmica da Equipe

A equipe adota uma abordagem híbrida baseada no **Scrumban**, combinando entregas incrementais em **4 Sprints** com a gestão visual e fluxo contínuo do **Kanban**:

* **Gestão de Backlog:** Os requisitos foram consolidados em um *Product Backlog* único; no início de cada ciclo (*Sprint Planning*), as tarefas prioritárias são selecionadas para o *Sprint Backlog*.
* **Quadro Visual & Limite de WIP:** Acompanhamento por meio de quadros **Kanban** individuais por sprint no **GitHub Projects**, aplicando limite de trabalho em andamento (*Work in Progress — WIP*) para evitar gargalos.
* **Alinhamento Contínuo:** *Dailies* assíncronas realizadas continuamente via aplicativos de mensagens instantâneas para acompanhamento de progresso e remoção rápida de bloqueios.
* **Evolução por Sprints:**
  * **Sprint 1 (Concluída):** Concepção, levantamento de requisitos, prototipação e arquitetura inicial.
  * **Sprint 2 (Concluída):** Entrega do MVP funcional (estoques, controle de acesso, itens, empréstimos, termo PDF e alertas).
  * **Sprint 3 (Concluída):** Evoluções funcionais (transferência entre estoques, campos completos do responsável no termo, upload de termo assinado, bloqueio por atraso, tombamento pendente), suítes de testes V1/V2 e pagamento de dívida técnica via refatoração.
  * **Sprint 4 (Em Progresso):** Deploy em ambiente de produção e preparação do Pitch final.

---

## 🎯 Escopo Funcional e Requisitos

### Requisitos Funcionais (RF) & User Stories
* **RF01 / US01 — Gestão Multiestoque:** Cadastro e gerenciamento de estoques independentes por setor/laboratório.
* **RF02 / US02 — Controle de Acesso por Grupo:** Restrição de gestão e movimentação por estoque aos gestores autorizados (RBAC).
* **RF03 / US03 — Categorização, Tombamento e Transferência:** Cadastro de categorias, controle de tombamento patrimonial (incluindo pendências de tombamento) e transferência de itens entre estoques.
* **RF04 — Movimentação e Saldo:** Registro de entradas, saídas, transferências e consulta de saldo atualizado por estoque.
* **RF05 / US04 — Módulo de Empréstimos:** Registro de empréstimos e devoluções com vínculo ao responsável (nome, CPF, e-mail, curso, telefone), prazo de devolução e bloqueio automático para empréstimos em atraso.
* **RF06 / US05 — Termo de Responsabilidade:** Geração automática do Termo de Responsabilidade em PDF no ato do empréstimo e fluxo de upload/validação do termo assinado.
* **RF07 / US06 — Alerta de Estoque Baixo:** Identificação e alerta visual para itens abaixo do estoque mínimo configurado.

### Requisitos Não Funcionais (RNF)
* **RNF01 — Segurança & Isolamento:** Autenticação federada via Keycloak e isolamento de acesso por estoque.
* **RNF02 — Rastreabilidade:** Histórico auditável de movimentações, empréstimos, termos e decisões arquiteturais (ADRs).

---

## 🏗️ Arquitetura e Stack Tecnológica

O sistema segue uma arquitetura **Cliente-Servidor em Camadas (N-Tier)** com API RESTful modularizada por domínio:

* **Back-end (`controle-estoque-emprestimos-back`):**
  * **Framework:** NestJS (Node.js + TypeScript)
  * **Persistência:** PostgreSQL + Prisma ORM (com migrações versionadas)
  * **Autenticação / RBAC:** Keycloak (`realm.json` pré-configurado)
  * **Qualidade & Testes:** Vitest (unitários, integração e E2E), Biome, Husky e Commitlint
* **Front-end (`controle-estoque-emprestimos-front`):**
  * **Framework:** React + TypeScript + Vite
  * **Estilização & UI:** Tailwind CSS + componentes modulares
  * **Testes:** Vitest + Testing Library
* **Infraestrutura & Documentação:**
  * Docker e Docker Compose para orquestração local de banco e identidade
  * Sites de documentação técnica (`docs-site`) e pasta `docs/` (ADRs, matrizes de rastreabilidade, relatórios de qualidade, dívida técnica e análise crítica de testes)

---

## 📂 Estrutura do Repositório

```text
├── controle-estoque-emprestimos-back/   # API REST NestJS, Prisma, Keycloak e testes
├── controle-estoque-emprestimos-front/  # Aplicação SPA React/Vite e testes
├── docs/                                # Documentação do projeto
│   ├── adr/                             # Registros de Decisões Arquiteturais (ADRs)
│   ├── qualidade/                       # Mapeamento de dívida técnica e relatórios de refatoração
│   └── testes/                          # Matrizes de rastreabilidade, relatórios e cobertura (V1/V2)
└── README.md                            # Documentação principal do projeto
```

---

## 🛠️ Versionamento & Fluxo de Desenvolvimento

### Estratégia de Branches (*GitHub Flow*)
* `main`: Branch protegida contendo apenas código estável e revisado.
* `feature/...`: Desenvolvimento de novas funcionalidades (ex.: `feature/s3-18-transferencia-estoques`).
* `fix/...`: Correções de falhas (ex.: `fix/bloqueio-emprestimo-atraso`).
* `refactor/...`: Pagamento de dívida técnica e melhoria estrutural (ex.: `refactor/s3b-14-dt12`).
* `test/...` e `docs/...`: Suítes de testes e atualizações documentais.

### Convenção de Commits & Code Review
* Padrão **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`) validado automaticamente via **Husky** + **Commitlint**.
* Todo merge na `main` exige abertura de **Pull Request** com template padronizado e aprovação obrigatória de **pelo menos 1 revisor**.

---

## 🚀 Como Executar o Projeto Localmente

### 1. Clonar o repositório
```bash
git clone [https://github.com/CaioC11/ds-equipe15-controle-estoque.git](https://github.com/CaioC11/ds-equipe15-controle-estoque.git)
cd ds-equipe15-controle-estoque
```

### 2. Subir a infraestrutura e o Back-end
```bash
cd controle-estoque-emprestimos-back
cp .env.example .env

# Subir PostgreSQL e Keycloak via Docker
docker compose up -d

# Instalar dependências, aplicar migrações e popular dados iniciais
npm install
npx prisma migrate dev
npx prisma db seed

# Iniciar a API em modo desenvolvimento
npm run start:dev
```

### 3. Iniciar o Front-end
```bash
cd ../controle-estoque-emprestimos-front
cp .env.example .env

npm install
npm run dev
```

### 4. Executar as Suítes de Testes
```bash
# No diretório do back-end
npm test

# No diretório do front-end
npm test
```

---

## 🔗 Protótipo

* [Protótipo Interativo no Figma](https://www.figma.com/make/iyrfGuPAa2LeLPKsqoCPxD/Inventory-Management-System?fullscreen=1&t=ItGKDJwkApNyGiXR-1&code-node-id=0-6)