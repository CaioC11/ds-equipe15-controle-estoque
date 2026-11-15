# Log da análise de qualidade e consolidação

## Escopo e proveniência

Esta consolidação da S3B-07 → task de dívida técnica usa o registro original [`docs/log-analise.md`](../log-analise.md), os scripts em `docs/ferramentas-analise/` e a leitura do código do ZIP recebido em 15/11/2026. O registro original contém 14 achados `ACH`, 14 falsos positivos `FP`, evidências, autores das confirmações e saídas de ferramenta. Oito achados com confirmação registrada e causa ainda visível receberam IDs definitivos **DT-01…DT-08** em [`divida-tecnica.md`](divida-tecnica.md). Os commits e números de linha do registro original são históricos; neste código, localizar pela função, não pela linha antiga.

| ID fixado | Achado original | Confirmação registrada no original | Evidência novamente conferida nesta consolidação |
|---|---|---|---|
| DT-01 | ACH-01 | Mateus, 14/11 | Gravações diretas `tx.movimentacao.create` no `EmprestimosService`; cálculo no `MovimentacoesService` |
| DT-02 | ACH-02 | Mateus, 14/11 | `formatEstoqueComSaldo` conta status; `calcularSaldoItem` soma movimentos |
| DT-03 | ACH-03 | Mateus, 14/11 | Filtro produz `detail`; `getApiErrorMessage` lê `message`/`error` |
| DT-04 | ACH-04 | Mateus, 14/11 | Pipe global Zod e DTOs com `class-validator` |
| DT-05 | ACH-05 | Caio, 12/11 | `termoStorage.write` dentro do `$transaction` do empréstimo |
| DT-06 | ACH-06 | Caio, 12/11 | Schema, `onSubmit`, regex de erro e tabela no mesmo componente |
| DT-07 | ACH-09 | Randell, 13/11 | `any` e dois formatos de data no PDF; script histórico de fuso |
| DT-08 | ACH-15 | Randell, 13/11 | `readFile` sem tradução de `ENOENT`; testes `it.fails` da US05 |

## Prompts e intervenção da LLM

O log original registra estas entradas. Reproduzimos o texto disponível, sem inventar histórico de conversa nem parâmetros não registrados:

1. **Claude, análise ampla (prompt da issue):** “Percorrer o código procurando violações de propriedades de projeto (integridade conceitual, information hiding, coesão, acoplamento), de SOLID e code smells, por leitura manual, ferramentas e LLM. Cada achado precisa ser confirmado por alguém olhando o código; falsos positivos são anotados com o motivo.” O repositório foi anexado em ZIP. Modelo, temperatura e versão exata dessa rodada ampla não estão documentados no log original.
2. **Gemini, empréstimos:** “Análise de violações de SOLID e code smells no arquivo emprestimos.service.ts”. Versão e parâmetros não registrados.
3. **Revisões por integrantes:** Randell pediu conferência de ACH-09/10 e achado de PDF/storage; Mateus pediu conferência de ACH-01…04 e depois ACH-11/12; Caio conferiu ACH-01…04 e descartes FP-01/02/04/07/08, sempre contra o código local. A redação literal completa desses prompts não foi preservada; o original registra seu propósito e os commits examinados.
4. **Esta consolidação:** pedido do usuário para criar `docs/qualidade/divida-tecnica.md` com sete colunas, cerca de oito itens confirmados, e `docs/qualidade/log-analise.md` com prompts, ferramentas, configurações e falsos positivos. A LLM agrupou oito `ACH` existentes; a leitura dos trechos no código confirmou que a causa persiste. Nenhum teste novo foi gerado e nenhuma refatoração foi aplicada.

**Regra de revisão:** a sugestão da LLM não é confirmação. A confirmação humana histórica está atribuída somente a quem já consta do log original. Os efeitos ainda sem reprodução integrada aparecem como pendência, sem alegar execução própria.

## Ferramentas, configuração e resultados

| Ferramenta | Configuração/comando registrado | Resultado e limite |
|---|---|---|
| Leitura manual e buscas | Back `src` e front `src`, sem specs nem `docs-site`; PowerShell `Select-String`, `Get-Content`, `wc -l`, `grep`/`rg` por `movimentacao.create`, `saldo`, `detail`, exceções, pipes, `any`, `termoStorage` | Localizaram os fluxos e duplicações; números de linha históricos podem mudar. |
| Script `erro.test.ts` | Vitest no front, copiado de `docs/ferramentas-analise/` | Dois casos (409 e 422) exibiram JSON bruto; execução histórica do registro original, não repetida aqui. |
| Script `ach04.test.ts` | Vitest no back, copiado de `docs/ferramentas-analise/` | Pipe global aceitou DTO inválido; `class-validator` isolado apontaria dois erros. Sem execução HTTP integrada. |
| `data-fuso-pdf.mjs` | Node com `TZ=UTC` e `TZ=America/Recife` | Diferentes datas impressas em fronteira de dia; a regra de negócio do fuso ainda requer decisão. |
| Análise estática | Biome 2.4.16 no back (`npx biome ci src/ test/`, sem escrita); ESLint 9.39.5 no front (`npm run lint`, sem `--fix`) | Alertas de `any`, estilo, hooks e escopo do lint foram triados; avisos sem evidência concreta foram descartados. |
| Releitura nesta consolidação | `rg` sobre arquivos citados; sem alterações do produto | Persistência dos padrões das oito DTs. Não foram rodados API, banco ou testes de integração. |

## Falsos positivos e candidatos descartados

Os **14 FP** têm justificativa detalhada na seção 4 do registro original. A decisão foi preservada nesta consolidação:

| IDs | Motivo de descarte |
|---|---|
| FP-01/02 | Leitura de saldo por autenticado e categorias globais seguem as permissões documentadas; a visibilidade de saldo ainda depende da decisão do PO. |
| FP-03 | Cast de `userId` ocorre após verificação que rejeita ausência; limpeza de tipo é opcional. |
| FP-04/05/06 | Cliente de autenticação tem responsabilidade coesa; tokens de classe são substituíveis no Nest; gerador de PDF é layout linear de uma responsabilidade. |
| FP-07/08 | Imports repetidos não duplicam lógica; desabilitação do lint no hook atende a dependências passadas pelo chamador. |
| FP-09/10/11/12 | Limite é constante nomeada; `isNaN` recebe número; sintaxe de array é estilo; React Compiler não está habilitado. |
| FP-13/14 | Replay do StrictMode não provou corrida; erros em `docs-site` são de configuração de escopo, fora do critério de achado de código. |

**Outros ACH não convertidos nesta lista de oito:** ACH-07/08 têm campo “Confirmado por” em branco no registro original; ACH-10/11/12/13 permanecem achados registrados e podem ser priorizados em outra rodada. Isso não os classifica como falsos positivos. O identificador ACH-14 não consta da sequência original. Não reutilizar IDs DT nem renumerá-los após a refatoração: registrar `DT-xx` no PR e mudar apenas o status da linha correspondente.

## Complemento para refatorações da S3B-12 (15/11/2026)

Antes da alteração de código, a leitura dos dois `assertGestorDoEstoque` confirmou ACH-07 (agora DT-09); a comparação dos dois `request<T>` confirmou ACH-08 (DT-10). DT-11 é um recorte específico, ainda não resolvido, das strings de status registradas em ACH-09; DT-07 permanece com os demais problemas de tipagem e fuso. Os IDs DT-09/10/11 foram acrescentados antes dos commits de refatoração. A confirmação desta rodada é uma conferência de código e testes, sem atribuí-la retroativamente a integrantes da equipe.

## Execução das refatorações (15/11/2026)

- Antes: `npx vitest run tests/v2 --config vitest.llm.config.ts --silent` no backend: 481 pass, 6 `it.fails`, 6 `it.todo`, 0 falhas inesperadas.
- DT-09 (`0c33176`): Extract Function de `assertGestorDoEstoque`; após o passo, mesmo resultado da v2 backend.
- Preparação DT-10 (`9de31a9`): dois testes de caracterização do serviço de movimentação passaram antes de mover a função. Os 11 testes de `emprestimo.service.test.ts` também passaram.
- DT-10 (`21a3e60`): Move Function de `request<T>` e `HttpError` para `services/api.ts`, mantendo reexport antigo. Após o passo, 13 testes direcionados passaram e `tsc -b` do frontend passou.
- DT-11 (`3e7d8ae`): Replace Magic Literal por `StatusItem`; após o passo, backend v2 com 481 pass, 6 `it.fails`, 6 `it.todo`; `npm run build` passou.
- Verificação final do frontend completo: 87 pass e três falhas em `Can.test.tsx` e `cinnamon-v2.test.tsx`, nos mesmos cenários apontados na revisão anterior; não há alteração desses arquivos nesta refatoração.

O relatório curto e os patches numerados ficam nesta pasta. O ZIP usado como base não tinha `.git`; os commits foram feitos em histórico local e devem ser aplicados ao checkout real, sem assumir hash remoto idêntico.
