# S3-21 — Consulta, seleção e histórico de responsáveis

Implementação da [S3-21 (#101)](https://github.com/CaioC11/ds-equipe15-controle-estoque/issues/101), US04. Não requer migração: usa `Responsavel` e a relação com `Emprestimo` já existentes.

## Contrato da API

Todas as rotas abaixo ficam sob `estoques/:estoqueId/emprestimos`, com o prefixo global já configurado pela aplicação.

| Método e sufixo | Comportamento | Acesso |
|---|---|---|
| GET `responsaveis?page=1&limit=20` | Lista paginada com id, nome, Siape, CPF, lotação e cargo | ADMIN ou gestor do estoque |
| GET `responsaveis/:responsavelId/historico?page=1&limit=20` | Histórico paginado com item, estado, retirada, prazo e devolução efetiva | ADMIN ou gestor do estoque |
| POST (rota de registro existente) | Aceita cadastro novo ou `responsavelId`, exclusivamente | Somente gestor do estoque |

As respostas das consultas usam `items` e `meta`, dentro do envelope padrão da API. Limite entre 1 e 500, como no restante da aplicação. A lista de responsáveis é global porque o cadastro não pertence a um estoque; o histórico filtra o estoque autorizado da rota e o responsável, incluindo todos os estados. ADMIN pode consultar cada estoque, sem receber dados fora do estoque solicitado.

Exemplo de registro por seleção:

```json
{
  "itemId": "identificador-do-item",
  "responsavelId": "identificador-selecionado"
}
```

O cliente não envia nome, Siape, CPF, lotação ou cargo nesse modo. O backend lê os dados salvos sem atualizar ou duplicar o cadastro e mantém o bloqueio por atraso da S3-20. Cadastro inexistente retorna 404; ambas as alternativas presentes ou nenhuma delas retornam erro de validação. O modo anterior, com objeto `responsavel`, continua funcionando.

## Critérios de aceitação

- [x] Lista responsáveis cadastrados com nome e Siape ou CPF.
- [x] Novo empréstimo aceita responsável selecionado sem redigitar dados.
- [x] Histórico mostra empréstimos e devoluções do responsável no estoque consultado.
- [x] Consultas negam acesso a requisitante ou gestor de outro estoque (403), antes de ler os dados; ADMIN consulta.
- [x] Matriz atualizada e todo de CA-02/CA-10 convertidos em testes executáveis na v2.

Frontend: na tela Empréstimos, o modal permite selecionar cadastro existente ou cadastrar no ato (Siape ou CPF). O painel Histórico por responsável funciona mesmo sem empréstimos pendentes. O cliente percorre todas as páginas das duas consultas e mostra carregamento, vazio e erro, com tentativa novamente. O painel é reiniciado ao trocar o estoque.

## Verificação

Backend:

```bash
npm run build
npm test
npx vitest run tests/v2/us04-emprestimos.spec.ts --config vitest.llm.config.ts
```

Frontend:

```bash
npm run build
npm test -- src/pages/emprestimos/index.test.tsx src/modules/emprestimos/emprestimo.service.test.ts src/modules/emprestimos/useEmprestimos.test.ts
```

Resultados: backend existente 151 testes passando; v2 US04 216 passando, 0 falhas, 1 todo (CT-04-28 / PR-04, fora desta task); testes específicos do frontend 27 passando. Builds dos dois projetos concluídos.

A regressão geral do frontend possui três falhas preexistentes: dois textos esperados em `cinnamon-v2.test.tsx` e um caso de papel em `components/auth/Can.test.tsx`. Foram reproduzidas no código original do ZIP com as mesmas dependências; não foram alteradas nesta task. As suítes específicas da S3-21 passam.

Os testes usam Prisma/API simulados. Antes de publicar, a verificação manual com banco e autenticação reais deve cadastrar um responsável, selecioná-lo em outro empréstimo, registrar devolução e consultar o histórico como gestor e ADMIN; requisitante deve receber 403. Isso não foi executado nesta entrega.
