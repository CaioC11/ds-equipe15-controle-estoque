# Medição e Análise da Suíte v2 (LLM) — US03 (Cadastro e Listagem de Itens)

Sprint 3, Parte 1. Issue S3B-10 (#69). A v2 foi gerada pela mesma LLM da v1 (Claude Sonnet 5.5), a partir de um prompt com as lacunas da matriz, e medida com as mesmas ferramentas e o mesmo escopo (Vitest 4.1.8, provider v8, 4 arquivos de produção do módulo `itens`). O relatório HTML está em `docs/testes/relatorios/v2/`.

## 1. Indicadores v1 × v2

| Indicador | v1 | v2 | Observações |
| :--- | :--- | :--- | :--- |
| Testes gerados | 106 | 117 | v1: 103 chamadas de `it` + 1 `it.each` de 3 valores. v2: a v1 mais 11 testes novos. |
| Passando / falhando / não compilam | 105 / 1 / 0 | 117 / 0 / 0 | A falha da v1 (oráculo errado sobre a mensagem do Zod) foi corrigida em C1. |
| Cobertura de linhas | 100% (60/60) | 100% (60/60) | Sem ganho: a v1 já executava todas as linhas. |
| Cobertura de branches | 97,36% (37/38) | 97,36% (37/38) | O único branch descoberto é o do decorator `@Injectable()` (linha 14 de `itens.service.ts`). |
| Statements / funções | 100% / 100% | 100% / 100% | |
| Partições de equivalência cobertas | 23/27 (85,19%) | 27/27 (100%) | Fecharam PLI-01, PLI-02, PPF-03 e PPF-04. |
| Fronteiras de valor-limite cobertas | 3/4 (6/8 valores) | 4/4 (8/8 valores) | Fechou LM-04 (0 itens e 1 item). |
| Critérios de aceitação com ao menos um teste | 6/7 (85,71%) | 6/7 (85,71%) | CA-07 e a parte de saldo do CA-03 seguem sem teste unitário (seção 3). O CA-05 passou de parcial para completo. |
| Casos da matriz cobertos (Sim ou Sim*) | 23/37 (62,16%) | 34/37 (91,89%) | v2: 19 Sim e 15 Sim*. |
| Casos parciais / sem cobertura | 6 / 8 | 1 / 2 | Parcial: CT-03-35. Sem cobertura: CT-03-16 e CT-03-17. |
| Testes com asserção trivial | 1 | 0 | Corrigido em C2 (CT-03-26). |
| Defeitos reais identificados | 0 | 0 | Ver a observação sobre o saldo na seção 3. |

## 2. Lacunas da v1 e testes da v2

| Lacuna na matriz | Teste na v2 | Situação |
| :--- | :--- | :--- |
| CT-03-04 (falha da v1) | C1: tipo fora do enum recusado, conferido pelo path `tipo` | Sim |
| CT-03-26 (asserção trivial) | C2: estoque vazio devolve `items` vazio e `meta.total` 0 | Sim |
| CT-03-27 | L1: estoque com exatamente 1 item | Sim* |
| CT-03-24 | L2: estoque com 3 itens | Sim* |
| CT-03-25 | L3: isolamento entre dois estoques | Sim* |
| CT-03-32 e 33 | L4: requisitante não cadastra nem edita (403) | Sim* |
| CT-03-34 | L5: ADMIN sem vínculo de gestor não cadastra (403) | Sim* |
| CT-03-14 | L6: dois patrimoniais com tombamentos distintos | Sim* |
| CT-03-15 | L7: dois consumos sem tombamento | Sim* |
| CT-03-13 | L8: tombamento de outro estoque recusado (409) | Sim* |
| CT-03-37 | L9: editar mantendo o próprio tombamento | Sim* |
| CT-03-35 | L10: edição com tombamento vazio recusada pelo schema | Parcial |
| CT-03-16 e 17 | Não incluídos (seção 3) | Não |

## 3. Meta mínima da issue

- **Todas as partições e limites exercitados: atingida.** 27/27 partições e 4/4 fronteiras.
- **Branches acima da v1: não atingida, e não é alcançável.** O único branch descoberto está associado ao decorator `@Injectable()`, é um artefato do código gerado na transpilação, e nenhum teste consegue exercitá-lo. Os branches de decisão do service já estavam todos cobertos na v1. A meta passa a ser lida como "100% dos branches alcançáveis, igual à v1".
- **100% dos critérios de aceitação: não atingida (6/7).** O CA-07 (patrimonial com saldo 1) e a parte de saldo do CA-03 (CT-03-16 e 17) exigem integração com o módulo de movimentações e banco real, fora do escopo unitário de `itens`. Pelo trecho de código analisado, o saldo é calculado em `MovimentacoesService.calcularSaldoItem` como soma das movimentações do item, e o `ItensService.create` não cria movimentação. Se isso se confirmar, um patrimonial recém-cadastrado teria saldo 0 até haver uma entrada, o que diverge do texto do requisito ("saldo 1 por registro"). Este ponto não foi testado e precisa ser confirmado com a equipe.

## 4. Limitações da v2

- **CT-03-35 continua parcial.** O teste confere que o `UpdateItemSchema` recusa o tombamento vazio, mas o `ItensService.update` não é chamado, então "tombamento anterior mantido" não é verificado de forma independente. Na aplicação, essa garantia vem do pipe de validação, que não roda em teste unitário.
- **Perfil não é consultado.** O service só verifica o vínculo de gestor do estoque. Os testes de requisitante e de ADMIN sem vínculo percorrem o mesmo caminho, e o papel do usuário não é exercitado na unidade.
- **O fake em memória é simulação.** Os casos que dependem dele (CT-03-13, 14, 15, 24, 25, 27, 32, 33, 34 e 37) estão como Sim*: provam o comportamento do service diante de um banco que se comporta como o schema define, mas não substituem um teste com banco real.
- **Mensagens de erro.** Os testes novos conferem classe da exceção, status HTTP e path, sem fixar textos novos. Os 27 textos fixados na v1 foram mantidos, como pede a regra de que cada mudança se ligue a uma lacuna da matriz.

## 5. Impacto da S3-19 (#95)

A S3-19 permite cadastrar item patrimonial sem tombamento (pendente) e completar o tombamento depois. Os testes de CT-03-08, 09, 10 e 35 (e os de schema equivalentes) valem para o requisito vigente (#7) e serão revisados quando a S3-19 for implementada. A matriz (seção 8) registra essa revisão prevista.