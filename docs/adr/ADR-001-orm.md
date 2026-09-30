# ADR-001: ORM do backend

- **Status:** Aceito
- **Data:** 29/09/2026
- **Responsável:** Randell Lima (PO)
- **Issue relacionada:** #14 ("#3 — Confirmar com o CInCoders o ORM do backend")

## Contexto

O anúncio dos boilerplates do CInCoders informa que o backend usa **NestJS 11 + Prisma + PostgreSQL**. Já os metadados e alguns cards da documentação do NestJS StarterKit mencionam **TypeORM**. A modelagem de dados da Sprint 2 (entidades de Estoque, Categoria, Item, Movimentação, Empréstimo e Termo) depende dessa definição, então era preciso resolver a contradição antes de modelar.

## Alternativas consideradas

1. **Prisma**
2. **TypeORM**

## Critérios

- Confirmação do cliente (CInCoders), que mantém o boilerplate e dá suporte às equipes.
- Aderência ao que o boilerplate oficial suporta e documenta.
- Padronização com os demais projetos da disciplina, o que facilita revisão e suporte.

## Restrições

- O catálogo de projetos exige usar as bases padronizadas (NestJS, React, Keycloak) como ponto de partida.
- Prazo curto: entrega da Sprint 2 em 06/10/2026, com corte de funcionalidades em 04/10.

## Decisão

Usar **Prisma** com PostgreSQL.

Confirmado por Eliseu Brito (CInCoders) no canal do projeto no Discord, em 29/09/2026 às 17:08:

> "Boa tarde, o correto é o Prisma. Notei agora que os metadados e alguns cards dizem 'Typeorm', mas a documentação possui o módulo do Prisma, indicando como usar."

## Consequências

- A modelagem é feita em `schema.prisma`, e as migrations seguem o fluxo do Prisma.
- A equipe deve seguir o módulo do Prisma da documentação e **ignorar as referências a TypeORM**, que estão desatualizadas.
- Quem ler a documentação sem conhecer esta decisão pode se confundir. Por isso ela foi comunicada ao grupo e registrada na issue #14.
- Trocar de ORM depois teria custo alto (reescrita da camada de persistência e das migrations), então a decisão é considerada final para o projeto.
- Verificado em 30/09/2026 no `package.json` do backend gerado: dependências `@prisma/client` e `prisma`, sem TypeORM; o schema fica na pasta `prisma/`.

## Trade-offs

A escolha veio do cliente e do boilerplate, então não comparamos a fundo as diferenças técnicas entre os dois ORMs. O ganho é o alinhamento com o padrão CInCoders e o suporte direto; o custo é trabalhar com uma documentação parcialmente inconsistente até que ela seja corrigida.
