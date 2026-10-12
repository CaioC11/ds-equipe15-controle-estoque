# Modelagem de Entidades e Contratos da API

## 1. Diagrama de Entidades e Relacionamentos (ERD)

```mermaid
erDiagram
    ESTOQUE ||--o{ ITEM : "possui"
    CATEGORIA ||--o{ ITEM : "classifica"
    ITEM ||--o{ EMPRESTIMO : "pertence a"
    ITEM ||--o{ MOVIMENTACAO : "gera histórico"
    TERMO ||--o| EMPRESTIMO : "formaliza"

    CATEGORIA {
        string id PK
        string nome UK
        string descricao
        datetime createdAt
        datetime updatedAt
    }

    ESTOQUE {
        string id PK
        string nome UK
        string descricao
        string localizacao
        boolean ativo
        string gestorId "ID do Gestor (Keycloak)"
        datetime createdAt
        datetime updatedAt
    }

    ITEM {
        string id PK
        string tipo "PATRIMONIAL | CONSUMO"
        string tombamento UK "Obrigatório se PATRIMONIAL"
        string numeroSerie "Opcional"
        string nome
        string descricao
        int nivelMinimo "Nível mínimo para alerta"
        string status "DISPONIVEL | EMPRESTADO | MANUTENCAO | BAIXADO"
        string categoriaId FK
        string estoqueId FK
        datetime createdAt
        datetime updatedAt
    }

    TERMO {
        string id PK
        string numeroAno UK "Ex: 001/2026"
        string arquivoPdf "URL ou Caminho do arquivo"
        datetime createdAt
        datetime updatedAt
    }

    EMPRESTIMO {
        string id PK
        string itemId FK
        string responsavelNome
        string responsavelSiape
        string responsavelLotacao
        string responsavelCargo
        string termoId FK "Opcional no início"
        datetime dataRetirada
        datetime prazoDevolucao
        datetime dataDevolucaoEfetiva
        string status "AGUARDANDO_TERMO | ATIVO | DEVOLVIDO | CANCELADO"
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