# Análise crítica da suíte v2 — US01 (Gestão multiestoque e movimentações)

Suíte: `controle-estoque-emprestimos-back/tests/v2/us01-estoques.spec.ts`. A v2 importa a suíte v1 correspondente sem alterá-la e acrescenta testes associados à `matriz-rastreabilidade-us1.md`. Comparação sobre o mesmo código atual, com Vitest 4.1.8 e V8 no escopo de `vitest.llm.config.ts`.

## 1. Indicadores

| Indicador | v1 no código atual | v2 completa |
|---|---:|---:|
| Linhas | 77/551 (13,97%) | 88/551 (15,97%) |
| Branches | 42/289 (14,53%) | 46/289 (15,91%) |
| Testes passando | 24 | 36 |
| Pendentes `it.todo` | 0 | 2 |
| Falhando / não compilam | 0 / 0 | 0 / 0 |

Os dois relatórios `coverage-summary.json` foram produzidos separadamente para v1 e v2. O escopo instrumentado inclui também arquivos de outras US, por isso os percentuais não são exclusivos desta story. HTML: `docs/testes/relatorios/v2/us01/index.html`.

## 2. Lacunas abordadas

CT-01-02/03/04/05 (nome), CT-01-08 (dois estoques em mock), CT-01-10 (estoque ausente), CT-01-13/14/15/16 (entradas e saídas), CT-01-32/33 (estoque vazio ou ausente) e CT-01-34/35/36 (consulta histórica). As asserções verificam valores e chamadas do serviço ou guard. A coluna v2 da matriz diferencia cobertura integral, parcial e ausente; importar a v1 preserva seus cenários, mas não converte automaticamente CTs parciais em completos.

## 3. Pendências e análise crítica

- `it.todo`: CT-01-07/09/11/12: edição por gestor vinculado; CT-01-17/18/19: validar tipo e quantidade no fluxo HTTP.
- O controller de estoques marca `update` com `@Roles(ADMIN)`, sem autorização do gestor por vínculo. O teste de dois estoques e o histórico usam mocks, portanto não demonstram persistência ou isolamento real entre operações.
- A meta de 100% dos critérios, partições e limites **não foi demonstrada**. O ganho de branches ocorreu, mas testes unitários com mocks não substituem a execução integrada de rota, validação e banco. Não há evidência para declarar defeito novo identificado pela execução; as incompatibilidades já visíveis no código exigem decisão e correção de produto.

## 4. Reprodução

No backend:

```sh
npx vitest run tests/v2/us01-estoques.spec.ts --config vitest.llm.config.ts --coverage --coverage.reportsDirectory ../docs/testes/relatorios/v2/us01 --coverage.reporter=html --coverage.reporter=json-summary
```

Para comparar, trocar `tests/v2/` por `tests/v1-llm/` e a saída por `../docs/testes/relatorios/v1-codigo-atual/us01`. A execução conjunta `npx vitest run tests/v2 --config vitest.llm.config.ts` passou com 481 aprovados, 6 falhas esperadas (`it.fails`) e 6 pendentes em seis arquivos.

## Complementação posterior — edição por gestor

A rota de edição agora admite `USER` e `ADMIN`, mas o serviço exige vínculo de gestor no estoque antes de gravar. `tests/v2/us01-us02-edicao-vinculo.spec.ts` acrescenta seis execuções para vínculo, negação com 403 sem escrita, metadata da rota e usuário ausente. As células CT-01-09/11/12 ficam parciais até teste HTTP integrado e verificação de descrição. Esta complementação é posterior à medição v1/v2 da seção 1; não altera seus percentuais históricos. Os `it.todo` da spec gerada permanecem intactos.

## Complementação posterior — validação das movimentações

O DTO de movimentação passou a usar `createZodDto`, compatível com o `ZodValidationPipe` global. `tests/v2/us01-movimentacao-validacao.spec.ts` executa o pipe: tipo ausente/inválido e quantidades zero/negativa/fracionária são rejeitados; inteiro positivo é aceito (6 testes). CT-01-17/18/19 permanecem parciais até teste HTTP que também comprove ausência de escrita. Os percentuais acima são históricos.
