# Modelagem de Entidades e Contratos da API

## 1. Diagrama de Entidades e Relacionamentos (ERD)

```mermaid
erDiagram
    ESTOQUE ||--o{ ITEM : "possui"
    ITEM ||--o{ EMPRESTIMO : "pertence a"
    ITEM ||--o{ MOVIMENTACAO : "gera histórico"

    ESTOQUE {
        string id PK
        string nome
        string descricao
        string localizacao
        datetime createdAt
        datetime updatedAt
    }

    ITEM {
        string id PK
        string tombamento UK "Opcional - Número de tombamento institucional"
        string nome
        string descricao
        string categoria
        int nivelMinimo "Nível mínimo para alerta de estoque"
        string status "DISPONIVEL | EMPRESTADO | MANUTENCAO | BAIXADO"
        string estoqueId FK
        datetime createdAt
        datetime updatedAt
    }

    EMPRESTIMO {
        string id PK
        string itemId FK
        string usuarioSolicitanteId "Sub / ID do Keycloak"
        datetime dataEmprestimo
        datetime dataPrevistaDevolucao
        datetime dataDevolucaoEfetiva
        string status "SOLICITADO | ATIVO | DEVOLVIDO | ATRASADO | CANCELADO"
        string observacoes
        datetime createdAt
        datetime updatedAt
    }

    MOVIMENTACAO {
        string id PK
        string itemId FK
        string tipo "ENTRADA | SAIDA | DEVOLUCAO | TRANSFERENCIA | MANUTENCAO"
        int quantidade "Quantidade de itens na movimentação"
        string usuarioId "ID de quem realizou a ação"
        datetime dataMovimentacao
        string observacao
    }