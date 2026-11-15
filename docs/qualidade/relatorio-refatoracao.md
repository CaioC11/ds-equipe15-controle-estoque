# Relatório de refatoração — DT-09, DT-10 e DT-11

O documento da Sprint 3 pede pelo menos três itens para a nota máxima. Os IDs foram registrados antes das mudanças e cada refatoração recebeu um commit separado. **Use os títulos dos commits como referência:** hashes locais como `0c33176`, `21a3e60` e `3e7d8ae` podem mudar após `git am` ou a correção de autoria no PR.

## DT-09 — Extract Function

- **Commit:** `DT-09: Extract Function da verificacao de gestor por estoque`.
- **Antes:** `ItensService` e `EmprestimosService` repetiam a consulta `estoqueGestor.findUnique({ where: { estoqueId_usuarioId: { estoqueId, usuarioId: userId } } })`, seguida de `if (!vinculo) throw new AccessDeniedException(mensagem)`.
- **Depois:** `assertGestorDoEstoque(prisma, estoqueId, userId, mensagem)` em `back/src/common/auth/` concentra a consulta e a negação; os dois services mantêm as respectivas mensagens públicas.
- **Melhoria:** reduz o *Duplicated Code* do par do ACH-07 (DT-09) e o risco de alterar apenas uma das duas regras de vínculo. As demais cópias citadas em ACH-07 não foram eliminadas.
- **Antes → depois:** backend v2 **481 pass, 6 `it.fails`, 6 `todo` → 481 pass, 6 `it.fails`, 6 `todo`**. Sem falha inesperada.

## DT-10 — Move Function

- **Commit:** `DT-10: Move Function request para cliente HTTP compartilhado`. O teste de caracterização entrou antes, em `test: caracteriza contrato HTTP antes de DT-10`.
- **Antes:** empréstimos e movimentações tinham cópias de `request<T>` que chamavam `fetchApi`, abriam `envelope.data` e criavam `HttpError` para respostas sem sucesso.
- **Depois:** `request<T>` e `HttpError` ficam em `front/src/services/api.ts`. Os dois módulos importam a mesma função; o export antigo de `HttpError` continua disponível para os consumidores.
- **Melhoria:** remove o *Duplicated Code* desse par do ACH-08 (DT-10) e concentra a manutenção do contrato HTTP. Outras classes de erro citadas em ACH-08 permanecem fora deste recorte.
- **Antes → depois:** 11 testes existentes de empréstimo e 2 novos de caracterização de movimentações, **13 pass → 13 pass**. `tsc -b` do frontend passou após a mudança. O backend não foi alterado neste passo; sua v2 foi verificada após os três passos.

## DT-11 — Replace Magic Literal

- **Commit:** `DT-11: Replace Magic Literal por StatusItem`.
- **Antes:** `formatEstoqueComSaldo` comparava `item.status === 'DISPONIVEL'` e `item.status === 'EMPRESTADO'`.
- **Depois:** as comparações usam `StatusItem.DISPONIVEL` e `StatusItem.EMPRESTADO` do Prisma; o objeto de resposta conserva os mesmos campos e valores.
- **Melhoria:** elimina as *magic strings* desse trecho e permite ao compilador detectar mudanças no enum. É um recorte do ACH-09; a DT-07 continua aberta para tipagem e fuso.
- **Antes → depois:** backend v2 **481 pass, 6 `it.fails`, 6 `todo` → 481 pass, 6 `it.fails`, 6 `todo`**. `npm run build` passou.

## Resultado conjunto e limites

A suíte v2 do backend passou antes e depois das refatorações, sem falhas inesperadas. A suíte geral do frontend terminou com **87 pass e 3 falhas** em `Can.test.tsx` e `cinnamon-v2.test.tsx`, reproduzidas no ZIP original `ds-equipe15-controle-estoque-main.zip` recebido antes destas refatorações, com as mesmas dependências: 3 falhas e 8 aprovações nesses dois arquivos. Essa comparação não substitui executar a `main` atual. Na revisão posterior, os testes do frontend foram alinhados às roles atuais (`ADMIN` para escrita) e às mensagens renderizadas pelo Cinnamon; a suíte geral passou com 91/91. A tipagem de `Movimentacao.dataMovimentacao` foi completada para o build do frontend. Esses ajustes são posteriores às três refatorações e não são evidência dos resultados medidos em cada commit. Os 13 testes direcionados dos serviços HTTP passaram durante DT-10. Não houve teste integrado com banco e autenticação real. A tabela `divida-tecnica.md` marca DT-09/10/11 como `Refatorado` e mantém os demais itens abertos.

## Comparação das formas de identificação

A **leitura manual** encontrou que as duas mensagens de 403 eram diferentes e precisavam continuar diferentes, detalhe que uma busca por blocos duplicados não resolve. A **busca e o detector de duplicação** apontaram rapidamente os dois `request<T>` e as consultas de vínculo repetidas. A **LLM** ajudou a relacionar os trechos aos achados ACH-07/08/09, mas também havia sugerido imports repetidos como dívida; a conferência manual descartou esse FP-07 porque imports compartilhados não duplicam lógica. Testes antes e depois sustentam a preservação do comportamento coberto.
