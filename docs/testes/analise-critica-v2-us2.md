# Análise crítica da suíte v2 — US02 (Controle de acesso por grupo)

Suíte: `controle-estoque-emprestimos-back/tests/v2/us02-acesso.spec.ts`. A v2 importa a suíte v1 correspondente sem alterá-la e acrescenta testes associados à `matriz-rastreabilidade-us2.md`. Comparação sobre o mesmo código atual, com Vitest 4.1.8 e V8 no escopo de `vitest.llm.config.ts`.

## 1. Indicadores

| Indicador | v1 no código atual | v2 completa |
|---|---:|---:|
| Linhas | 88/551 (15,97%) | 117/551 (21,23%) |
| Branches | 28/289 (9,68%) | 45/289 (15,57%) |
| Testes passando | 13 | 15 |
| Pendentes `it.todo` | 0 | 1 |
| Falhando / não compilam | 0 / 0 | 0 / 0 |

Os dois relatórios `coverage-summary.json` foram produzidos separadamente para v1 e v2. O escopo instrumentado inclui também arquivos de outras US, por isso os percentuais não são exclusivos desta story. HTML: `docs/testes/relatorios/v2/us02/index.html`. Aumento de branches: true.

## 2. Lacunas abordadas

CT01/04/05/06/11 (metadata do guard para ADMIN e USER), CT03 (ADMIN proibido de movimentar) e CT08/09/13 (gestor com vínculo e sem vínculo). As asserções verificam valores e chamadas do serviço ou guard. A coluna v2 da matriz diferencia cobertura integral, parcial e ausente; importar a v1 preserva seus cenários, mas não converte automaticamente CTs parciais em completos.

## 3. Pendências e análise crítica

- `it.todo`: CT07/10/12: editar estoque pelo gestor vinculado e negar quem não é autorizado; o controller atual exige ADMIN para toda edição.
- O teste de guard verifica o status 403 no nível do guard, não uma requisição HTTP. A matriz registra esses CTs como parciais. CT02 (ADMIN lista estoques) não foi exercitado no fluxo da v2.
- A meta de 100% dos critérios, partições e limites **não foi demonstrada**. O ganho de branches ocorreu, mas testes unitários com mocks não substituem a execução integrada de rota, validação e banco. Não há evidência para declarar defeito novo identificado pela execução; as incompatibilidades já visíveis no código exigem decisão e correção de produto.

## 4. Reprodução

No backend:

```sh
npx vitest run tests/v2/us02-acesso.spec.ts --config vitest.llm.config.ts --coverage --coverage.reportsDirectory ../docs/testes/relatorios/v2/us02 --coverage.reporter=html --coverage.reporter=json-summary
```

Para comparar, trocar `tests/v2/` por `tests/v1-llm/` e a saída por `../docs/testes/relatorios/v1-codigo-atual/us02`. A execução conjunta `npx vitest run tests/v2 --config vitest.llm.config.ts` passou com 481 aprovados, 6 falhas esperadas (`it.fails`) e 6 pendentes em seis arquivos.
