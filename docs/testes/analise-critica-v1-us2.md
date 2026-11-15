# Medição e Análise Crítica da Suíte v1 (LLM) — US02 (Controle de Acesso)

Responsável: Mateus · Issue: S3B-09 (#68) · Suíte: `controle-estoque-emprestimos-back/tests/v1-llm/us02-acesso.spec.ts`.

Execução:

```text
cd controle-estoque-emprestimos-back
npx vitest run tests/v1-llm/us02-acesso.spec.ts --config vitest.llm.config.ts
```

Cobertura V8 já registrada em `docs/testes/relatorios/v1/us02/coverage-summary.json`; relatório HTML: `docs/testes/relatorios/v1/us02/index.html`. O total do relatório inclui os arquivos selecionados de `src/common/auth/`, `src/modules/itens/`, `src/modules/emprestimos/` e `src/modules/movimentacoes/`, conforme o procedimento registrado em `llm-log.md`.

## 1. Tabela de Indicadores da Suíte v1

| Indicador | Resultado v1 | Observações e evidências |
| :--- | :--- | :--- |
| **Testes gerados** | **13** | Saída do Vitest: `Tests 13 passed (13)`; 13 declarações `it`, sem expansões `it.each`. |
| **Testes passando** | **13 (100%)** | Execução isolada do spec, Vitest v4.1.8. |
| **Testes falhando** | **0 (0%)** | Saída do Vitest. |
| **Testes que não compilam** | **0 (0%)** | Arquivo carregado integralmente; nenhum marcador `NAO-COMPILA`. |
| **Cobertura de linhas** | **16,12% (89/552)** | Total do `coverage-summary.json`; os arquivos de auth, itens, empréstimos e movimentações incluídos no relatório. |
| **Cobertura de branches** | **9,30% (28/301)** | Mesmo total e escopo da cobertura de linhas. |
| **Requisitos (CAs) cobertos** | **75,00% (6/8, todos parciais)** | Há teste relacionado para CA-03 a CA-08, mas nenhum cobre por inteiro o comportamento da matriz. CA-01 e CA-02 não têm teste correspondente. |
| **Partições de equivalência cobertas** | **0,00% (0/22 completas)** | Para tornar o total reproduzível, foram contadas as 20 células papel×ação (5 ações × 4 perfis) e PE01/PE02. Há 5 `Parcial` (incluindo PE02) e 17 `Não`; 5/22 = 22,73% se parciais forem somadas. |
| **Valores-limite cobertos** | **0/2 estados completos (0%)** | Um dos dois estados tem evidência parcial: ausência de vínculo; o caso com exatamente 1 gestor autorizado não é testado. |
| **Testes sem asserção ou triviais** | **0** | As 13 execuções têm `expect`; não há `toBeDefined`, `toBeTruthy`, `expect(true)` ou `not.toThrow` isolado. |
| **Defeitos reais identificados** | **0** | Não houve falha de teste investigada; as 13 execuções passaram. |
| **Relatório HTML** | **Presente e consistente** | `relatorios/v1/us02/index.html` e `coverage-summary.json` existem; o HTML mostra 16,12% de linhas e 9,30% de branches, iguais ao summary. |

Fórmulas: requisitos com teste relacionado / total de CAs = 6/8; partições completas (`Sim`) = 0/22; estados-limite completos = 0/2. Os 8 CAs, 5 ações, 4 perfis, 2 estados e 13 CTs são contáveis em `matriz-rastreabilidade-us2.md`. Para a matriz papel×ação, `Parcial` significa que a suíte verifica o guard/metadata genérico ou um serviço adjacente, mas não a combinação no endpoint indicado. `Sim*` não foi atribuído a nenhuma linha.

### Partições e fronteiras: classificação por linha da matriz

- **Sim:** nenhuma célula ou estado tem teste com a combinação completa de papel, ação e resultado prevista.
- **Parcial:** células de **Gerenciar Gestores × ADMIN/GESTOR autorizado/GESTOR não autorizado/REQUISITANTE**: testes genéricos de `RolesGuard`/`Roles` (`us02-acesso.spec.ts:82`, `:89`, `:107`) não exercitam os endpoints nem distinguem GESTOR de REQUISITANTE; PE02 (zero gestores) tem negação por ausência de vínculo em serviços (`:117`, `:139`, `:176`), mas não em movimentação de estoque recém-criado.
- **Não:** as 16 outras células papel×ação e PE01 (estoque com um gestor autorizado) não são exercitadas pela US02.
- **Limite 0 gestores:** Parcial — não há teste de movimento num estoque confirmado sem nenhum gestor. **Limite 1 gestor:** Não — nenhum cenário autoriza a operação de um gestor vinculado; logo, o contraste não está completo.

## 2. Análise Crítica (Etapa 4)

### 4a. O que a LLM perdeu, inventou e acertou a mais

**Lacunas frente à matriz:** a suíte cobre guards, metadados de papéis e algumas verificações de vínculo, mas não testa criação/listagem de estoques por ADMIN, movimentação vedada ao ADMIN, gestão efetiva de gestores, alteração de estoque nem movimentação por gestor autorizado. Por isso, 0/22 partições estão completas e só 6/8 CAs têm evidência parcial. Exemplos: `recusa cadastro de item sem vínculo com o estoque de destino` (`us02-acesso.spec.ts:117`) e `permite ADMIN listar empréstimos sem consultar vínculo de gestor` (`:158`).

**O que foi além da matriz:** há testes genéricos de rota pública (`us02-acesso.spec.ts:36`), extração/anexação da identidade ao request (`:54`) e gravação do metadata pelo decorator (`:107`), aspectos de autenticação que a matriz não descreve como CTs de estoque.

**Limitação do prompt, separada de falha da LLM:** o prompt registrou apenas um `CA1` como paráfrase da story; a matriz tem 8 CAs independentes. Não foram fornecidos os casos de ADMIN, gestor autorizado/não autorizado, requisitante e estoque sem gestor em detalhe. As lacunas específicas dessas combinações não devem ser apresentadas como falha da LLM em cumprir critérios que não estavam no prompt.

### 4b. Como o texto dos critérios de aceitação e da matriz influenciou falhas e lacunas

A matriz distingue ADMIN, GESTOR autorizado, GESTOR não autorizado e REQUISITANTE, enquanto os testes usam principalmente `AccessRole.ADMIN` e `AccessRole.USER`; por exemplo, `recusa USER quando a rota exige ADMIN` (`us02-acesso.spec.ts:89`). Isso cobre o guard, mas não separa os dois perfis não ADMIN da matriz. Os testes de vínculo exercitam serviços de itens, empréstimos e histórico (`:117`, `:139`, `:176`), não os CTs de gerenciamento de estoque/movimentação por endpoint. A suíte obteve 13/13 aprovações, mas o relatório agregado ficou em 89/552 linhas e 28/301 branches: aprovação da suíte não significa cobertura das 20 combinações papel×ação.

### 4c. Trecho com linha coberta e branch não coberto (Linhas vs. Branches)

Em `src/common/auth/guards/roles.guard.ts:8`, `@Injectable()` é carregado e a linha está coberta (11/11 linhas no arquivo), mas o HTML marca o branch gerado no decorator como não coberto (`cbranch-no`). O arquivo tem 9/10 branches cobertos. Esse ramo é artefato da instrumentação/transpilação do decorator, não uma decisão RBAC; a cobertura global do relatório é 28/301 branches (9,30%).

### 4d. Oráculos (comportamento assumido do código, defeitos e asserções triviais)

Não há testes sem asserção, triviais, `.skip` ou `.only`. Um oráculo está acoplado à mensagem do código: `us02-acesso.spec.ts:92` exige `"Você não tem permissão para acessar este recurso."`, enquanto CA-08 exige HTTP 403 e estado inalterado, não esse texto específico. Os testes de negação usam `toThrow`/`rejects.toThrow` e verificam chamadas que não ocorreram, mas não consultam `getStatus()` para comprovar 403. Não houve falha investigada que indique defeito real; defeitos reais: **0**.

Preparado com apoio do Codex; números reproduzíveis pelos comandos acima; confirmação humana pendente

**Confirmado por:** ______ em __/__
