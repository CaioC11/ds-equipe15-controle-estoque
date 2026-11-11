# Log de análise de código — dívida técnica (propriedades de projeto, SOLID e code smells)

Issue de tech-debt. Prazo: 12/11. Escopo: `controle-estoque-emprestimos-back/src` (2.734 linhas, sem specs) e `controle-estoque-emprestimos-front/src` (5.636 linhas, sem testes). Os módulos `docs-site` ficaram de fora porque são documentação gerada.

## 1. Resumo

| Grupo | Achados confirmados |
|---|---|
| Propriedades de projeto (integridade conceitual, information hiding, acoplamento) | ACH-01, ACH-02, ACH-03, ACH-04 |
| SOLID e coesão | ACH-05, ACH-06 |
| Code smells | ACH-07, ACH-08, ACH-09, ACH-10 |

Total: **10 achados** e **9 falsos positivos** (seção 4). A meta do time era cerca de 8.

**Como ler o campo "Confirmação":**
- **Leitura**: o trecho foi lido e o problema aparece no código.
- **Executado**: reproduzi o comportamento rodando um script (os scripts estão em `docs/ferramentas-analise/` e a saída na seção 5).
- **A confirmar**: depende de rodar a API com banco, que não estava disponível nesta análise.

> **Pendência de quem assina a issue.** A primeira passada foi feita por LLM (Claude) com leitura dos arquivos e dois scripts. O critério da issue pede que **uma pessoa** confirme cada achado olhando o código. Cada achado tem a linha "Confirmado por" para isso. A tabela da seção 6 sugere uma divisão de 2 achados por pessoa.

---

## 2. Achados

### Grupo 1 — Propriedades de projeto

#### ACH-01 — O empréstimo escreve direto na tabela de movimentações e pula a regra de saldo
- **Onde:** `back/src/modules/emprestimos/emprestimos.service.ts`, métodos `create` (L119-127) e `devolver` (L412-420). Relacionados: `itens.service.ts` `create` (L18-47) e `movimentacoes.service.ts` `registrarNaTransacao` (L173-177).
- **Categoria:** information hiding e acoplamento. Quem decide o saldo é o `MovimentacoesService`, mas o `EmprestimosService` conhece o formato da tabela `movimentacao` e grava nela por conta própria.
- **Problema:** `create` grava uma `SAIDA` de quantidade 1 sem consultar o saldo. A regra "saldo insuficiente" só existe em `MovimentacoesService.registrarNaTransacao`. Além disso, `ItensService.create` não grava `ENTRADA` ao cadastrar o item, e o `seed.mjs` não cria movimentações.
- **Por que atrapalha:** um item patrimonial recém-cadastrado, sem `ENTRADA` registrada à mão, vai a saldo **-1** ao primeiro empréstimo. A tela de saldo passa a mostrar valor negativo e `abaixoDoMinimo` fica verdadeiro, mesmo com o item na prateleira. Qualquer mudança na regra de saldo precisa ser repetida no módulo de empréstimos.
- **Como foi encontrado:** leitura manual do fluxo de `create`; `grep` por `movimentacao` mostrou escrita fora do módulo dono (`grep -rn "movimentacao\." src`).
- **Confirmação:** leitura. O saldo -1 é dedução do código e **a confirmar** com um teste de integração (criar item, emprestar, consultar `/movimentacoes/saldo/item/:id`).
- **Confirmado por:** ______ em __/__
- **Ideia de correção:** o `EmprestimosService` chamar um método do `MovimentacoesService` (ou um serviço de saldo) em vez de gravar na tabela, e `ItensService.create` registrar a `ENTRADA` inicial do item patrimonial.

#### ACH-02 — "Saldo" significa duas coisas diferentes
- **Onde:** `estoques.service.ts` `formatEstoqueComSaldo` (L142-157) contra `movimentacoes.service.ts` `calcularSaldoItem` (L40-51) e `consultarSaldoEstoque` (L98-128).
- **Categoria:** integridade conceitual.
- **Problema:** na listagem de estoques, `saldo` é uma contagem de itens por status (`totalItens`, `disponiveis`, `emprestados`). No módulo de movimentações, `saldo` é a soma de entradas menos saídas de cada item. O mesmo termo vale para conceitos distintos, em endpoints diferentes (`/estoques` e `/movimentacoes/saldo/...`).
- **Por que atrapalha:** os dois valores divergem em situações normais. Entre o registro do empréstimo e a confirmação da entrega (estado `AGUARDANDO_TERMO`), a `SAIDA` já foi gravada (saldo cai) mas o status do item continua `DISPONIVEL` (L81 verifica, L317-320 só muda na confirmação). A tela de estoques mostra o item disponível enquanto a de movimentações mostra saldo 0.
- **Como foi encontrado:** leitura cruzada dos dois services ao procurar quem calcula "saldo" (`grep -rn "saldo" src`).
- **Confirmação:** leitura.
- **Confirmado por:** ______ em __/__
- **Ideia de correção:** nomear os conceitos (`contagemPorStatus` e `saldo`) ou calcular o resumo do estoque a partir de uma única fonte.

#### ACH-03 — O front não entende o formato de erro do back
- **Onde:** `back/src/common/filters/http-exception.filter.ts` (L45-54, corpo `application/problem+json` com `detail`) e `front/src/services/api.ts` `getApiErrorMessage` (L135-156, lê `message` ou `error`). Efeitos em `front/src/modules/estoques/item.service.ts` `failFrom` (L46-56) e `front/src/components/GerenciamentoEstoque.tsx` (L105-115).
- **Categoria:** acoplamento por contrato implícito e integridade conceitual entre as duas partes.
- **Problema:** o filtro global (registrado em `main.ts` L22) devolve `{type, title, status, detail, code, ...}`. O front espera o formato padrão do Nest (`{message}`). Como não acha `message`, cai na leitura do corpo como texto e **devolve o JSON inteiro como mensagem**. Além disso, o back responde 422 para erro de Zod e 400 para `AppException` de validação, e o front só trata o 400 como "dados inválidos".
- **Por que atrapalha:** o usuário que tenta cadastrar um tombamento duplicado vê na tela o JSON bruto (`{"type":"https://controle-estoque-emprestimos.example/problems/conflict",...,"detail":"Já existe um item com este tombamento."}`) em vez da frase. A tela de itens só marca o campo certo porque a regex `/tombamento/i` casa com o texto cru do JSON, o que funciona por acaso.
- **Como foi encontrado:** leitura da cadeia de erro nos dois lados; depois, um script em Node que alimenta a função do front com o corpo exato que o filtro gera (`docs/ferramentas-analise/erro.mjs`). O `api.test.ts` do front não tem nenhum caso com `detail`.
- **Confirmação:** executado (saída na seção 5).
- **Confirmado por:** ______ em __/__
- **Ideia de correção:** `getApiErrorMessage` ler `detail` (e `errors` por campo), e o back/front concordarem em um único código de status para validação.

#### ACH-04 — Dois estilos para o mesmo problema: exceções e validação de entrada
- **Onde:** exceções em `movimentacoes.service.ts` (9 usos de `BadRequestException`, `ConflictException`, `ForbiddenException`, `NotFoundException`), `estoques.service.ts`, `categorias.service.ts` e `gestor.guard.ts` (17 no total), contra a família `AppException`/`ResourceNotFoundException`/`AccessDeniedException` em `emprestimos.service.ts` (24 usos) e `itens.service.ts` (9). Validação: Zod em `create-item.dto.ts`, `create-emprestimo.dto.ts`, `create-estoque.dto.ts` e outros; `class-validator` em `categorias/dto/create-categoria.dto.ts` e `movimentacoes/dto/registrar-movimentacao.dto.ts`.
- **Categoria:** integridade conceitual (o sistema não parece desenhado por uma única cabeça).
- **Problema:** o `estoques.service.ts` usa os dois estilos no mesmo arquivo (`ConflictException` na L23 e `ResourceConflictException` na L113). Só o `ZodValidationPipe` está registrado como pipe global (`app.module.ts` L37), e `main.ts` não registra `ValidationPipe`.
- **Por que atrapalha:** o formato do erro e o código `ErrorCode` dependem do módulo que lançou. Quem mexe em um módulo copia o estilo errado. Os dois DTOs com `class-validator` **podem não estar sendo validados**, porque as anotações `@IsEnum`, `@IsInt` e `@Min(1)` só têm efeito com um `ValidationPipe`. Isso explica por que `registrarMovimentacao` repete à mão a checagem de quantidade (L58-60).
- **Como foi encontrado:** `grep` por `new (BadRequest|Conflict|Forbidden|NotFound)Exception` contra `new (AppException|ResourceConflict|...)`, e por `class-validator` contra `nestjs-zod`.
- **Confirmação:** leitura para os dois estilos. O efeito de "DTO sem validação" está **a confirmar** rodando `POST /movimentacoes` com `tipo` inválido e `POST /categorias` com `nome` numérico (a dependência `nestjs-zod` não estava instalada aqui).
- **Confirmado por:** ______ em __/__
- **Ideia de correção:** migrar os dois DTOs para Zod e padronizar as exceções na família `AppException`.

### Grupo 2 — SOLID e coesão

#### ACH-05 — `EmprestimosService` faz coisas demais (SRP, baixa coesão)
- **Onde:** `back/src/modules/emprestimos/emprestimos.service.ts` (491 linhas, 13 métodos), principalmente `create` (L66-183, cerca de 118 linhas).
- **Categoria:** SOLID (responsabilidade única) e coesão.
- **Problema:** a mesma classe cuida da regra de empréstimo, do cadastro/atualização de responsável (`obterResponsavel`), da numeração anual do termo (`contadorTermo.upsert`, L129-135), da geração do PDF (L137-154), da escrita em disco (L155), da validação do arquivo enviado (`validarPdf`) e da checagem de permissão (`assertGestorDoEstoque`).
- **Por que atrapalha:** no `create`, a geração do PDF e a escrita em disco acontecem **dentro** do `$transaction` (L96-169), que usa as opções padrão do Prisma (o padrão documentado é 5 s para transações interativas). Um disco lento pode estourar a transação e obrigar a limpeza manual do arquivo (L170-181). Para testar a regra de empréstimo é preciso simular PDF, storage e Prisma ao mesmo tempo.
- **Como foi encontrado:** tamanho dos arquivos (`wc -l`) e contagem de métodos por classe; depois leitura do método mais longo.
- **Confirmação:** leitura. O estouro de timeout não foi medido.
- **Confirmado por:** ______ em __/__
- **Ideia de correção:** extrair `TermoService` (numeração, PDF e storage) e `ResponsaveisService`, e gerar o PDF fora da transação.

#### ACH-06 — `GerenciamentoEstoque` mistura formulário, regra de validação, tradução de erro e tabela (SRP)
- **Onde:** `front/src/components/GerenciamentoEstoque.tsx` (326 linhas): schema Zod (L13-32), `onSubmit` com tradução de erro (L89-123), formulário (L155-263), tabela de itens (L272-324).
- **Categoria:** SOLID (responsabilidade única) e coesão. O componente também está na pasta `components/` genérica, mas só serve à página de estoques (`pages/estoques/index.tsx` L244), enquanto o resto do domínio vive em `modules/estoques/`.
- **Problema:** o componente decide qual campo marcar com erro olhando o **texto** da mensagem (`/tombamento/i.test(message)` e `/s[eé]rie/i.test(message)`, L109-111).
- **Por que atrapalha:** se o back mudar a frase de "Já existe um item com este tombamento." para outra redação, o erro de duplicidade deixa de aparecer no campo e vai para o aviso geral, sem nenhum teste falhar. A lista de itens e o formulário não podem ser reaproveitados separadamente.
- **Como foi encontrado:** leitura do maior componente do front; busca por `.test(message)`.
- **Confirmação:** leitura.
- **Confirmado por:** ______ em __/__
- **Ideia de correção:** o back devolver um código de campo (`errors.tombamento`) e o componente usar isso; separar `ItemForm` e `ItemTable` em `modules/estoques/components/`.

### Grupo 3 — Code smells

#### ACH-07 — Regra de "gestor do estoque" duplicada e espalhada (duplicação e shotgun surgery)
- **Onde:** `assertGestorDoEstoque` em `emprestimos.service.ts` (L469-481) e `itens.service.ts` (L123-135), idênticos exceto pela mensagem; `findEstoqueOrFail` em `emprestimos.service.ts` (L460-466), `itens.service.ts` (L103-111) e `assertEstoqueExiste` em `estoques.service.ts` (L135-140); `eGestorDoEstoque` e `garantirAcessoLeitura` em `movimentacoes.service.ts` (L28-37 e L198-209); `GestorGuard` (`categorias/guards/gestor.guard.ts`); e o desvio do ADMIN (`user?.role !== AccessRole.ADMIN`) repetido em `emprestimos.service.ts` (L187, L264, L355).
- **Categoria:** code smell (código duplicado, shotgun surgery).
- **Problema:** a mesma regra do `docs/permissoes.md` ("papel de gestor é por estoque") existe em pelo menos cinco versões.
- **Por que atrapalha:** o `permissoes.md` de 09/10 diz que o ADMIN da Gerência também acumula o papel de GESTOR. Aplicar isso exige alterar cada cópia e conferir se cada uma trata o ADMIN do mesmo jeito. Hoje cada cópia tem a sua própria mensagem de 403, e o desvio do ADMIN é decidido método a método, não em um lugar só.
- **Como foi encontrado:** `docs/ferramentas-analise/dup.py` (detector de janelas de 6 linhas iguais) apontou o par `assertGestorDoEstoque`; as demais cópias vieram de `grep -rnE "estoqueGestor\.find"`.
- **Confirmação:** leitura (o par idêntico) e ferramenta.
- **Confirmado por:** ______ em __/__
- **Ideia de correção:** um `EstoqueAccessService` (ou guard por estoque) injetado nos módulos.

#### ACH-08 — Cliente HTTP do front copiado em vários módulos
- **Onde:** `front/src/modules/emprestimos/emprestimo.service.ts` (`ApiEnvelope` L5, `HttpError` L19, `request<T>` L32-42) e `modules/movimentacoes/movimentacao.service.ts` (`ApiEnvelope` L11, `request<T>` L18-28, idêntica); `modules/estoques/estoque.service.ts` (`ApiEnvelope` L5, `EstoqueApiError` L13); `modules/estoques/item.service.ts` (`ApiEnvelope` L4, `ItemApiError` L33); `services/categoriaService.ts` (erro com `any`, L34 e L51).
- **Categoria:** code smell (duplicação) e acoplamento inadequado entre módulos.
- **Problema:** três classes de erro com a mesma estrutura (mensagem + status), quatro definições de `ApiEnvelope`, duas cópias da função `request<T>`. `movimentacao.service.ts` importa `HttpError` de `../emprestimos/`, ou seja, o módulo de movimentações depende do de empréstimos só para reaproveitar uma classe. Os tipos `Estoque` e `Item` também existem em dois lugares (`emprestimo.types.ts` L11-24 e `estoque.types.ts` L34).
- **Por que atrapalha:** ao corrigir o ACH-03 será preciso mexer em cada cópia, e uma tela que testa `instanceof ItemApiError` não reconhece o erro lançado por outro serviço. Os dois tipos `Item` já divergem (o de empréstimos não tem `nivelMinimo` nem `categoria`).
- **Como foi encontrado:** `docs/ferramentas-analise/dup.py` apontou `request<T>` idêntica nos dois serviços; `grep -rnE "class [A-Za-z]*Error"` achou as três classes.
- **Confirmação:** leitura e ferramenta.
- **Confirmado por:** ______ em __/__
- **Ideia de correção:** mover `request<T>`, `ApiEnvelope` e uma única `ApiError` para `services/api.ts` e usar os tipos de domínio de um só módulo.

#### ACH-09 — Tipos frouxos (`any`) e textos soltos no lugar de enums; datas formatadas de dois jeitos
- **Onde:** `back/.../estoques.service.ts` `formatEstoqueComSaldo(estoque: any)` (L142-157, com `'DISPONIVEL'` e `'EMPRESTADO'` como texto nas L145 e L147); `back/.../termo-pdf.service.ts` `formatarData(val: any)` (L28-32) e o formatador `date` (L106-107); `front/src/services/categoriaService.ts` (L34, L51) e `front/src/pages/categorias/index.tsx` (L26, L74).
- **Categoria:** code smell (uso de `any`, "magic strings", falta de tipagem).
- **Problema:** o back já tem o enum `StatusItem` (usado em `emprestimos.service.ts` L81), mas `formatEstoqueComSaldo` compara com texto. No PDF, `dataAbertura` é formatada com `timeZone: 'UTC'` (L134), e `dataFechamento` com `toLocaleDateString` no **fuso do servidor** (L135-138).
- **Por que atrapalha:** (1) renomear um valor do enum compila sem erro e faz o resumo do estoque contar 0 itens. (2) Quando o prazo chega como data pura (ex.: `2026-11-20`, que vira meia-noite UTC), a data prevista sai **um dia antes** se o back roda em fuso brasileiro, e certa se roda em UTC (saída na seção 5). Em desenvolvimento local isso gera termos com datas diferentes das da produção. O `val === 'null'` na L29 mostra que o tipo foi relaxado para esconder um dado mal formado.
- **Como foi encontrado:** `grep -rnE ": any\b|as any"` e `grep` por literais de enum; a diferença de fuso foi vista na leitura e reproduzida em Node (`docs/ferramentas-analise/data.mjs`).
- **Confirmação:** executado (a data); leitura (os `any` e os literais).
- **Confirmado por:** ______ em __/__
- **Ideia de correção:** tipar com `Prisma.EstoqueGetPayload` e usar `StatusItem`; usar `timeZone: 'UTC'` nas duas datas.

#### ACH-10 — Código de exemplo e provisório ainda no produto (código morto)
- **Onde:** `front/src/modules/todos`, `modules/team`, `pages/todos`, `pages/team` (1.325 das 5.636 linhas do front, **23,5%**); `front/src/routes.tsx` (L114-118: usuário autenticado vai para `/todos`); `front/src/utils/sidebar.ts` ("Tarefas de Exemplo" na L19-23 e "Gerenciar Equipe" na L49); `back/prisma/schema.prisma` (`CANCELADO` em `StatusEmprestimo` e coluna `semTombamento` em `Item`, nunca referenciados em `back/src`); `front/src/pages/categorias/index.tsx` L9 (`const isGestor = true`).
- **Categoria:** code smell (código morto, generalidade especulativa, stub esquecido).
- **Problema:** módulos do boilerplate permanecem ativos e fazem parte da navegação do produto. A tela inicial depois do login é a lista de tarefas de exemplo.
- **Por que atrapalha:** o primeiro contato do gestor com o sistema é uma tela que não faz parte do domínio, e os testes e a manutenção seguem pagando por esse código. O estado `CANCELADO` aparece no front (`emprestimo.types.ts` L1) e no schema, mas nenhuma operação do back o produz, então um empréstimo em `AGUARDANDO_TERMO` não tem como ser desfeito. `semTombamento` está no schema, mas o critério da US03 (marcar como "sem tombamento") não é atendido pelo DTO. Com `isGestor = true`, o botão de criar categoria aparece para qualquer perfil e só falha com 403 ao clicar.
- **Como foi encontrado:** `wc -l` dos módulos de exemplo contra o total; `grep -rn "CANCELADO\|semTombamento" back/src` (sem resultados); leitura de `routes.tsx` e `sidebar.ts`.
- **Confirmação:** leitura e `grep`.
- **Confirmado por:** ______ em __/__
- **Ideia de correção:** remover `todos`/`team` (ou esconder da navegação), redirecionar para `/estoques`, ligar `isGestor` à role real e decidir o destino de `CANCELADO` e `semTombamento`.

---

## 3. Observações fora das categorias da issue

Pontos vistos durante a leitura que são defeitos ou lacunas funcionais, não de projeto. Ficam registrados para quem priorizar.

- **O termo em PDF não mostra o CPF.** `TermoPdfData.responsavel` não tem `cpf` e o PDF imprime "Siape: Não informado" para quem foi identificado só pelo CPF (`termo-pdf.service.ts` L130), embora os critérios da US05 peçam "Siape ou CPF".
- **O ano do termo sai da data de hoje**, não da data de abertura (`emprestimos.service.ts` L129 e L237): um empréstimo com `dataRetirada` em outro ano recebe o número do ano corrente.
- **`consultarSaldoEstoque` faz uma consulta por item** (`movimentacoes.service.ts` L111-122, `Promise.all` de `calcularSaldoItem`): com o limite de 500 itens por página que o front usa, são até 500 consultas por chamada.
- **Os endpoints `GET .../termo` e `GET .../termo/download`** (e o `.../termo/assinado`) diferem só pelo cabeçalho `inline`/`attachment` (`emprestimos.controller.ts` L139-171).

## 4. Falsos positivos (candidatos descartados e o motivo)

| # | Candidato (quem apontou) | Por que foi descartado |
|---|---|---|
| FP-01 | "Endpoints de saldo em `MovimentacoesController` sem checagem de gestor" (leitura) | `docs/permissoes.md` libera saldo para qualquer usuário autenticado ("Ver lista de estoques, itens e saldo"). Está de acordo com o requisito. |
| FP-02 | "`GestorGuard` aceita gestor de qualquer estoque, contra a regra por estoque" (leitura) | Categorias são globais (premissa A2) e a matriz diz "Cadastrar e editar categoria: GESTOR". É intencional. |
| FP-03 | "`userId as string` em `emprestimos.service.ts` L124 e L417 é cast inseguro" (heurística de lint) | `assertGestorDoEstoque` lança `AccessDeniedException` quando `userId` é indefinido (L469-481) antes de chegar ao cast, então o valor nunca é nulo ali. O cast é feio, mas não causa defeito. (Sugestão de limpeza: estreitar o tipo.) |
| FP-04 | "`api.ts` do front viola responsabilidade única e tem estado global mutável" (LLM) | Token, renovação e logout são o mesmo assunto (cliente HTTP autenticado), a renovação em voo evita várias chamadas paralelas de `signinSilent`, e há testes. A única parte fora de lugar é `getApiErrorMessage`, que já está em ACH-03. |
| FP-05 | "Services dependem das classes concretas `PrismaService` e `TermoStorageService` (inversão de dependência)" (LLM) | No Nest, a classe serve de token e pode ser trocada por `useClass`/`useValue` no módulo. A premissa A6 já prevê trocar a implementação do storage. Onde a troca é real, o código usa token (`IDENTITY_SOURCE`). O custo de corrigir não compensa. |
| FP-06 | "`termo-pdf.service.ts` `gerar` é um método longo (cerca de 130 linhas)" (métrica de tamanho) | É código de layout linear, com funções locais pequenas, uma só responsabilidade (desenhar o PDF) e baixa frequência de mudança. Os problemas reais desse arquivo (datas e `any`) estão em ACH-09. |
| FP-07 | "Blocos de `import` repetidos em 5 páginas do front" (`docs/ferramentas-analise/dup.py`) | A ferramenta casou listas de `import` (`Table`, `TableBody`, `ErrorScreen`). Não há lógica duplicada. |
| FP-08 | "`eslint-disable react-hooks/exhaustive-deps` em `useAsync.ts` L59" (grep) | Desabilitação deliberada: o hook recebe a lista de dependências do chamador (`[...deps, reloadToken]`), e o linter não consegue analisar isso. Está comentado e é o padrão de hooks genéricos. |
| FP-09 | "`TERMO_ASSINADO_MAX_BYTES` é número mágico" (heurística) | É uma constante nomeada, com comentário, em `termo-assinado.constants.ts`, e compartilhada pelo controller e pelo service. |

## 5. Ferramentas, comandos e prompts (para o log)

**Ferramentas que rodaram:**

| Ferramenta | Uso | Resultado |
|---|---|---|
| Leitura manual | `emprestimos`, `movimentacoes`, `estoques`, `itens`, `categorias`, filtro de erros, guards, DTOs, `api.ts`, serviços e páginas do front | base de todos os achados |
| `wc -l`, contagem de métodos por classe | tamanho e coesão | `EmprestimosService`: 491 linhas e 13 métodos |
| `grep`/ripgrep | `any`, `as string`, literais de enum, exceções nativas × próprias, `class-validator` × `nestjs-zod`, `CANCELADO`/`semTombamento` | ACH-04, ACH-09, ACH-10 |
| `docs/ferramentas-analise/dup.py` (script próprio, janelas de 6 e 7 linhas normalizadas) | duplicação | achou `assertGestorDoEstoque` e `request<T>`; 1 resultado era falso (FP-07) |
| `docs/ferramentas-analise/erro.mjs` (Node 22) | alimenta a cópia de `getApiErrorMessage` com o corpo do filtro do back | reproduziu o JSON cru como mensagem (ACH-03) |
| `docs/ferramentas-analise/data.mjs` (Node 22, `TZ=UTC` e `TZ=America/Sao_Paulo`) | formatadores de data do PDF | `20/11/2026` em UTC e `19/11/2026` em São Paulo (ACH-09) |

**Ferramentas que não rodaram:** Biome (back) e ESLint (front), `tsc --noEmit` e os testes, porque o ambiente não tinha `node_modules` do projeto nem acesso à rede para instalar. Rodar `npm run lint` nos dois pacotes e comparar com esta lista é um passo que ainda falta.

**Saídas dos dois scripts:**
```
$ node docs/ferramentas-analise/erro.mjs
mensagem exibida ao usuário => {"type":"https://controle-estoque-emprestimos.example/problems/conflict","title":"Conflito de dados","status":409,"detail":"Já existe um item com este tombamento.", ...}

$ TZ=UTC node docs/ferramentas-analise/data.mjs                  -> abertura=20/11/2026  prevista=20/11/2026
$ TZ=America/Sao_Paulo node docs/ferramentas-analise/data.mjs    -> abertura=20/11/2026  prevista=19/11/2026
```

**Prompts usados com a LLM (Claude):**

1. Prompt da issue, colado na íntegra: "Percorrer o código procurando violações de propriedades de projeto (integridade conceitual, information hiding, coesão, acoplamento), de SOLID e code smells, por leitura manual, ferramentas e LLM. Cada achado precisa ser confirmado por alguém olhando o código; falsos positivos são anotados com o motivo." (acompanhado do repositório em `.zip`).
2. A LLM leu os arquivos do back e do front, escreveu os scripts da seção acima e propôs os candidatos. Cada achado voltou ao código (arquivo e linha) antes de entrar na lista, e os que a leitura não sustentou foram para a seção 4.

> Quem usar outra LLM ou ferramenta para a própria parte deve acrescentar aqui o prompt e a ferramenta, uma linha por uso.

## 6. Divisão sugerida e conferência da issue

Sugestão para fechar "2 ou mais achados confirmados por pessoa". Cada um confirma lendo o código e preenche "Confirmado por" no achado.

| Pessoa | Achados sugeridos |
|---|---|
| Mateus | ACH-01, ACH-02 |
| Artur | ACH-03, ACH-04 |
| Caio | ACH-05, ACH-06 |
| Theo | ACH-07, ACH-08 |
| Randell | ACH-09, ACH-10 |

| Critério da issue | Situação |
|---|---|
| 2 ou mais achados confirmados por pessoa (meta de cerca de 8 no time) | 10 achados prontos, **faltam as confirmações humanas** (campo "Confirmado por") |
| Achado com arquivo/função, problema, categoria, consequência e como foi encontrado | feito |
| Falsos positivos anotados com o motivo | feito (9) |
| Prompts e ferramentas registrados | feito (seção 5) |
