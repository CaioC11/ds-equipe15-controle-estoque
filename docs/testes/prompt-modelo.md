# Modelo de prompt único (v1)

Usado por todos os membros, uma story por conversa. Não incluir a matriz de
rastreabilidade nem os specs que já existem em src/.

## Prompt

Você vai gerar testes automatizados com Vitest (TypeScript, NestJS 11, Prisma 5).

USER STORY
[nome e descrição]

CRITÉRIOS DE ACEITAÇÃO
[CA1, CA2... no formato Dado/Quando/Então]

CÓDIGO DO MÓDULO
[para cada arquivo: caminho + conteúdo]

INSTRUÇÕES
1. Aplique partições de equivalência (válidas e inválidas) em cada variável de entrada.
2. Aplique análise de valores-limite dos dois lados de cada fronteira.
3. Garanta que cada critério de aceitação tenha ao menos um teste.
4. Em cada teste, adicione um comentário com a técnica usada
   (partição / valor-limite / critério) e o requisito coberto (ex.: CA2).
5. Use apenas os arquivos e caminhos fornecidos. O arquivo de saída é
   tests/v1-llm/<story>.spec.ts e os imports apontam para ../../src/...
6. Responda com um único bloco de código.

## Arquivos a fornecer por story

| Story | Arquivos |
|---|---|
| 1. Estoques (CRUD, entrada/saída, saldo) | estoques.controller/service, create/update-estoque.dto, movimentacoes.controller/service, registrar-movimentacao.dto |
| 2. Acesso por grupo | auth.guard, roles.guard, roles.decorator, access-role.enum + trechos de autorização por gestor nos services |
| 3. Itens com tombamento | itens.controller/service, create/update-item.dto |
| 4. Empréstimo e devolução | emprestimos.controller/service, create-emprestimo.dto |
| 5. Termo de Responsabilidade | termo-pdf.service, termo-storage.service, termo-assinado.constants, trecho de ativação em emprestimos.service |
| 6. Alerta de estoque baixo | trechos de nível mínimo em movimentacoes.service e itens.service (confirmar onde a regra está) |

## Regras da v1
- Até 3 rodadas por story, só para a suíte compilar/rodar. Pedidos de "mais testes" ficam para a v2.
- Sem edição manual dos testes. Os que não compilam podem ser comentados, com registro no log.