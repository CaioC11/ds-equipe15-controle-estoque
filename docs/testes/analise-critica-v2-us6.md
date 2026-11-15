# Análise crítica da suíte v2 — US06 (Alertas de reposição)

Suíte: `controle-estoque-emprestimos-back/tests/v2/us06-alerta.spec.ts`. A v2 importa a suíte v1 correspondente sem alterá-la e acrescenta testes associados à `matriz-rastreabilidade-us6.md`. Comparação sobre o mesmo código atual, com Vitest 4.1.8 e V8 no escopo de `vitest.llm.config.ts`.

## 1. Indicadores

| Indicador | v1 no código atual | v2 completa |
|---|---:|---:|
| Linhas | 24/551 (4,35%) | 42/551 (7,62%) |
| Branches | 11/289 (3,80%) | 23/289 (7,95%) |
| Testes passando | 7 | 17 |
| Pendentes `it.todo` | 0 | 2 |
| Falhando / não compilam | 0 / 0 | 0 / 0 |

Os dois relatórios `coverage-summary.json` foram produzidos separadamente para v1 e v2. O escopo instrumentado inclui também arquivos de outras US, por isso os percentuais não são exclusivos desta story. HTML: `docs/testes/relatorios/v2/us06/index.html`.

## 2. Lacunas abordadas

CT-06-04/05/06/07 (saldo e mínimo 0 ou nulo), CT-06-08/09/10 (movimentação cruza o limite), CT-06-14 (campos do alerta), CT-06-15/16/17 (classificação em cinco itens). As asserções verificam valores e chamadas do serviço ou guard. A coluna v2 da matriz diferencia cobertura integral, parcial e ausente; importar a v1 preserva seus cenários, mas não converte automaticamente CTs parciais em completos.

## 3. Pendências e análise crítica

- `it.todo`: CT-06-18/20/21/22: autorização por vínculo, requisitante e ADMIN; CT-06-13: regra para patrimonial depende de premissa.
- As consultas de saldo não recebem usuário e não autorizam por vínculo. A consulta de estoque retorna todos os itens com `abaixoDoMinimo`, sem filtrar somente os alertas. Os CT-06-15/16/17 são parciais.
- A meta de 100% dos critérios, partições e limites **não foi demonstrada**. O ganho de branches ocorreu, mas testes unitários com mocks não substituem a execução integrada de rota, validação e banco. Não há evidência para declarar defeito novo identificado pela execução; as incompatibilidades já visíveis no código exigem decisão e correção de produto.

## 4. Reprodução

No backend:

```sh
npx vitest run tests/v2/us06-alerta.spec.ts --config vitest.llm.config.ts --coverage --coverage.reportsDirectory ../docs/testes/relatorios/v2/us06 --coverage.reporter=html --coverage.reporter=json-summary
```

Para comparar, trocar `tests/v2/` por `tests/v1-llm/` e a saída por `../docs/testes/relatorios/v1-codigo-atual/us06`. A execução conjunta `npx vitest run tests/v2 --config vitest.llm.config.ts` passou com 481 aprovados, 6 falhas esperadas (`it.fails`) e 6 pendentes em seis arquivos.
