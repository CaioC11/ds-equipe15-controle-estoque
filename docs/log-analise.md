# Log de análise de código — dívida técnica (propriedades de projeto, SOLID e code smells)

Issue de tech-debt. Prazo: 12/11. Escopo: `controle-estoque-emprestimos-back/src` (2.734 linhas, sem specs) e `controle-estoque-emprestimos-front/src` (5.636 linhas, sem testes). Os módulos `docs-site` ficaram de fora porque são documentação gerada.

## 1. Resumo

| Grupo | Achados confirmados |
|---|---|
| Propriedades de projeto (integridade conceitual, information hiding, acoplamento) | ACH-01, ACH-02, ACH-03, ACH-04, ACH-15 |
| SOLID e coesão | ACH-05, ACH-06 |
| Code smells | ACH-07, ACH-08, ACH-09, ACH-10, ACH-11, ACH-12, ACH-13 |

Total: **14 achados** e **14 falsos positivos** (seção 4). A meta do time era cerca de 8.

**Como ler o campo "Confirmação":**
- **Leitura**: o trecho foi lido e o problema aparece no código.
- **Executado**: reproduzi o comportamento rodando um script (os scripts estão em `docs/ferramentas-analise/` e a saída na seção 5).
- **A confirmar**: depende de rodar a API com banco, que não estava disponível nesta análise.

> **Pendência de quem assina a issue.** Mateus confirmou ACH-01 a ACH-04, ACH-11 e ACH-12 lendo o código local no commit `b9b67c5`. Permanecem pendentes as confirmações humanas de outros achados com "Confirmado por" em branco e as verificações marcadas **a confirmar**, que ainda dependem de execução. A divisão sugerida da seção 6 é apenas uma proposta de distribuição.

---

## 2. Achados

### Grupo 1 — Propriedades de projeto

#### ACH-01 — O empréstimo escreve direto na tabela de movimentações e pula a regra de saldo
- **Onde:** `back/src/modules/emprestimos/emprestimos.service.ts`, métodos `create` (L134-142) e `devolver` (L475-483). Relacionados: `itens.service.ts` `create` (a partir da L18) e `movimentacoes.service.ts` `registrarNaTransacao` (L161-196, com a checagem de saldo nas L173-177).
- **Categoria:** information hiding e acoplamento. Quem decide o saldo é o `MovimentacoesService`, mas o `EmprestimosService` conhece o formato da tabela `movimentacao` e grava nela por conta própria.
- **Problema:** `create` grava uma `SAIDA` de quantidade 1 sem consultar o saldo, e `devolver` grava uma `DEVOLUCAO` de quantidade 1 do mesmo jeito, ambos direto com `tx.movimentacao.create`. A regra "saldo insuficiente" só existe em `MovimentacoesService.registrarNaTransacao`; o `emprestimos.service.ts` não tem nenhuma referência a saldo. Além disso, `ItensService.create` não grava `ENTRADA` ao cadastrar o item, e o `seed.mjs` não cria movimentações. Em `back/src` (fora dos specs), `ENTRADA` só aparece na lista de tipos que somam (`movimentacoes.service.ts` L14) e numa mensagem de erro (`emprestimos.service.ts` L91).
- **Por que atrapalha:** um item patrimonial recém-cadastrado, sem `ENTRADA` registrada à mão, vai a saldo **-1** ao primeiro empréstimo (o saldo vem de `calcularSaldoItem`, L40-51, que soma `ENTRADA` e `DEVOLUCAO` e subtrai `SAIDA`). A tela de saldo passa a mostrar valor negativo e, se o item tiver nível mínimo, `abaixoDoMinimo` fica verdadeiro, mesmo com o item na prateleira. Qualquer mudança na regra de saldo precisa ser repetida no módulo de empréstimos.
- **Como foi encontrado:** leitura manual do fluxo de `create` e `devolver`; `Select-String` por `movimentacao`, por `ENTRADA` e por `saldo|calcularSaldo|insuficiente` (seção 5).
- **Confirmação:** leitura, no commit `b9b67c5`. O saldo -1 é dedução do código e continua **a confirmar** com um teste de integração (criar item, emprestar, consultar `/movimentacoes/saldo/item/:id`).
- **Confirmado por:** Mateus em 14/11 (commit `b9b67c5`)
- **Ideia de correção:** o `EmprestimosService` chamar um método do `MovimentacoesService` (ou um serviço de saldo) em vez de gravar na tabela, e `ItensService.create` registrar a `ENTRADA` inicial do item patrimonial.

#### ACH-02 — "Saldo" significa duas coisas diferentes
- **Onde:** `estoques.service.ts` `formatEstoqueComSaldo` (L142-157, usado na listagem L46 e no detalhe L62) contra `movimentacoes.service.ts` `calcularSaldoItem` (L40-51) e `consultarSaldoEstoque` (L98-128).
- **Categoria:** integridade conceitual.
- **Problema:** na listagem de estoques, `saldo` é uma contagem de itens por status (`totalItens`, `disponiveis`, `emprestados`). No módulo de movimentações, `saldo` é a soma de entradas menos saídas de cada item. O mesmo termo vale para conceitos distintos, em endpoints diferentes (`/estoques` e `/movimentacoes/saldo/...`).
- **Por que atrapalha:** os dois valores divergem em situações normais. Entre o registro do empréstimo e a confirmação da entrega (estado `AGUARDANDO_TERMO`), o `create` já gravou a `SAIDA` (`emprestimos.service.ts` L134), mas o status do item continua `DISPONIVEL`: o `create` só confere o status (L95) e quem muda o item para `EMPRESTADO` é a confirmação da entrega (L334). A tela de estoques conta o item como disponível enquanto a de movimentações já o desconta do saldo.
- **Como foi encontrado:** leitura cruzada dos dois services ao procurar quem calcula "saldo"; `Select-String` por `saldo|disponiveis|emprestados|totalItens`, por `calcularSaldoItem|consultarSaldoEstoque` e por `StatusItem|AGUARDANDO_TERMO` (seção 5).
- **Confirmação:** leitura, no commit `b9b67c5`. As duas telas não foram comparadas rodando a API.
- **Confirmado por:** Mateus em 14/11 (commit `b9b67c5`)
- **Ideia de correção:** nomear os conceitos (`contagemPorStatus` e `saldo`) ou calcular o resumo do estoque a partir de uma única fonte.

#### ACH-03 — O front não entende o formato de erro do back
- **Onde:** `back/src/common/filters/http-exception.filter.ts` (L45-54, corpo `application/problem+json` com `detail`; `resolve` L59-93; `fromZodError` L95-108) e `front/src/services/api.ts` `getApiErrorMessage` (L135-156, lê `message` ou `error`). Efeitos em `front/src/modules/estoques/item.service.ts` `failFrom` (L46-56) e `front/src/components/GerenciamentoEstoque.tsx` (L105-115).
- **Categoria:** acoplamento por contrato implícito e integridade conceitual entre as duas partes.
- **Problema:** o filtro global (registrado em `main.ts` L22) devolve `{type, title, status, detail, code, ...}`. O front espera o formato padrão do Nest (`{message}`, como diz o comentário das L130-134 de `api.ts`). Como não acha `message`, cai na leitura do corpo como texto e **devolve o JSON inteiro como mensagem**. Além disso, o back responde **422** para erro de Zod (`fromZodError`, L103) e **400** para `BadRequestException` do Nest (mapeado para `VALIDATION_FAILED` em `mapStatusToErrorCode`), e o `failFrom` só trata o 400 como "dados inválidos" (L51-53); um 422 cai no ramo genérico da L55.
- **Por que atrapalha:** o usuário que tenta cadastrar um tombamento duplicado vê na tela o JSON bruto (`{"type":"https://controle-estoque-emprestimos.example/problems/conflict",...,"detail":"Já existe um item com este tombamento."}`) em vez da frase. A tela de itens só marca o campo certo porque a regex `/tombamento/i` (L109 do componente) casa com o texto cru do JSON, o que funciona por acaso. Os erros por campo (`errors`) nunca chegam à tela.
- **Como foi encontrado:** leitura da cadeia de erro nos dois lados; `Select-String` por `\.detail|problem\+json` em `front/src` (sem resultados) e por `detail|problem` em `api.test.ts` (sem resultados); teste `docs/ferramentas-analise/erro.test.ts` (vitest) que alimenta `getApiErrorMessage` com o corpo que o filtro gera, para 409 e 422 (seção 5).
- **Confirmação:** executado em 14/11 no commit `b9b67c5`; os dois casos imprimiram o JSON cru como mensagem.
- **Confirmado por:** Mateus em 14/11 (commit `b9b67c5`)
- **Ideia de correção:** `getApiErrorMessage` ler `detail` (e `errors` por campo), e o back e o front concordarem em um único código de status para validação.

#### ACH-04 — Dois estilos para o mesmo problema: exceções e validação de entrada
- **Onde:** exceções nativas do Nest em `movimentacoes.service.ts` (9 usos), `estoques.service.ts` (3), `categorias.service.ts` (3) e `gestor.guard.ts` (2): 17 no total. Família própria (`AppException`, `ResourceNotFoundException`, `ResourceConflictException`, `AccessDeniedException`) em `emprestimos.service.ts` (29), `itens.service.ts` (9), `estoques.service.ts` (3), `keycloak.identity-source.ts` (2) e `roles.guard.ts` (1): 44 no total. Validação: Zod em 8 DTOs (`create-item`, `update-item`, `create-emprestimo`, `create-estoque`, `update-estoque`, `autorizar-gestor`, `registrar-justificativa-permanencia`, `pagination-query`); `class-validator` em 2 (`categorias/dto/create-categoria.dto.ts` e `movimentacoes/dto/registrar-movimentacao.dto.ts`).
- **Categoria:** integridade conceitual (o sistema não parece desenhado por uma única cabeça).
- **Problema:** o `estoques.service.ts` usa os dois estilos no mesmo arquivo, inclusive para o **mesmo conceito**: "estoque não encontrado" é `NotFoundException('Estoque não encontrado')` na L59 e `ResourceNotFoundException('Estoque', estoqueId)` na L138; o conflito é `ConflictException` nas L23 e L80 e `ResourceConflictException` na L113. Só o `ZodValidationPipe` está registrado como pipe global (`app.module.ts` L36-37); `main.ts` não registra `ValidationPipe` e nenhum arquivo de `src` usa `@UsePipes` ou `ValidationPipe`.
- **Por que atrapalha:** o formato do erro e o `ErrorCode` dependem do módulo que lançou. Quem mexe em um módulo copia o estilo errado. Os dois DTOs com `class-validator` **não são validados**: no teste, o pipe global deixou passar `{tipo: 'INVALIDO', quantidade: -5}` sem erro, enquanto o `class-validator` executado à mão apontou 2 erros. Isso é compatível com a checagem manual de quantidade em `registrarMovimentacao` (L58-60), que repete o `@IsInt` e o `@Min(1)` do DTO.
- **Como foi encontrado:** `Select-String` por `new (BadRequest|Conflict|Forbidden|NotFound)Exception` contra `new (AppException|ResourceNotFoundException|ResourceConflictException|AccessDeniedException)`, com contagem por arquivo; por `Pipe` em `main.ts` e `app.module.ts`; por `ValidationPipe|UsePipes|ZodValidationPipe` em `src`; por `class-validator|nestjs-zod|from 'zod'` nos `*.dto.ts`; teste `docs/ferramentas-analise/ach04.test.ts` (vitest) (seção 5).
- **Confirmação:** leitura para os dois estilos e para o pipe; executado em teste do pipe global contra `RegistrarMovimentacaoDto` no commit `b9b67c5`. Não foi feito por HTTP (`POST /movimentacoes`), e `create-categoria.dto.ts` está confirmado só por leitura e grep.
- **Confirmado por:** Mateus em 14/11 (commit `b9b67c5`)
- **Ideia de correção:** migrar os dois DTOs para Zod e padronizar as exceções na família `AppException`.

### Grupo 2 — SOLID e coesão

#### ACH-05 — Coesão baixa e risco de timeout na transação de empréstimo (EmprestimosService)
- **Onde:** `back/src/modules/emprestimos/emprestimos.service.ts` (491 linhas, 13 métodos), principalmente `create` (L66-183, cerca de 118 linhas).
- **Categoria:** code smell / violação de SRP.
- **Problema:** a mesma classe cuida da regra de empréstimo, do cadastro/atualização de responsável (`obterResponsavel`, L432), da numeração anual do termo (`contadorTermo.upsert`, L130), da geração do PDF e da gravação, leitura e remoção dos arquivos via `termoStorage` (L155, L173, L203, L240-251, L280), da validação do arquivo enviado (`validarPdf`, L332) e da checagem de permissão (`assertGestorDoEstoque`).
- **Por que atrapalha:** no `create`, a geração do PDF e a gravação via `termoStorage.write` (L155) acontecem **dentro** do `$transaction` (L96-169). Nenhum dos três `$transaction` do arquivo (L96, L290, L386) define `timeout` ou `maxWait`, então valem os padrões do Prisma (5 s para transações interativas). Um disco lento pode estourar a transação, e a limpeza do arquivo é feita à mão (L170-181). Para testar a regra de empréstimo é preciso simular PDF, storage e Prisma ao mesmo tempo.
- **Como foi encontrado:** `wc -l` e contagem de métodos; leitura do método mais longo; `Select-String` por `$transaction|timeout|maxWait` e por `termoStorage` (sem timeout configurado).
- **Confirmação:** leitura e `Select-String`. O estouro de timeout **não foi medido** (a confirmar).
- **Confirmado por:** Caio em 12/11 (commit `751f68e`)
- **Ideia de correção:** extrair `TermoService` (numeração, PDF e storage) e `ResponsaveisService`, e gerar o PDF fora da transação.

#### ACH-06 — Componente inflado violando SRP (GerenciamentoEstoque)
- **Onde:** `front/src/components/GerenciamentoEstoque.tsx` (327 linhas). Schema de validação (L13-34), `onSubmit` com tradução de erros (L89-125), renderização do formulário (L155) e da tabela de listagem (L272-324).
- **Categoria:** code smell (God Component / quebra de SRP).
- **Problema:** O componente mistura múltiplas responsabilidades: define as regras de validação do Zod, lida com a submissão, inspeciona e traduz mensagens de erro da API usando regex (`/tombamento/i.test(message)` na L109 e `/s[eé]rie/i.test(message)` na L111), e ainda renderiza tanto o formulário de criação quanto a tabela HTML de itens.
- **Por que atrapalha:** A manutenção fica difícil e arriscada. O acoplamento da tradução de erros com regex cria uma fragilidade grave (relacionado ao ACH-03): se o backend mudar o texto do erro 409, o formulário para de mostrar o erro no campo certo. Além disso, se a tabela precisar de paginação ou o formulário crescer, o arquivo ficará insustentável.
- **Como foi encontrado:** Leitura manual guiada pela análise; uso de `(Get-Content ...).Count` e `Select-String` buscando por padrões como `z.object`, `onSubmit`, regexes e tags HTML de tabela.
- **Confirmação:** Leitura e `Select-String`.
- **Confirmado por:** Caio em 12/11 (commit `751f68e`)
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
- **Por que atrapalha:** (1) renomear um valor do enum compila sem erro e faz o resumo do estoque contar 0 itens. (2) As duas datas do mesmo PDF seguem regras de fuso diferentes: a abertura usa UTC e a data prevista usa o fuso do servidor. O front envia o prazo como fim do dia local (`fimDoDiaISO`, `front/src/modules/emprestimos/emprestimo.utils.ts` L13-15), por exemplo `2026-11-21T02:59:59Z` para quem escolheu 20/11 em Recife. Com o back em UTC (o serviço da API no `docker-compose.yml` não define `TZ`; só o Keycloak define), a data prevista sai **um dia depois** (21/11). Com o back em fuso brasileiro, sai certa (20/11). Quem chama a API com data pura (`2026-11-20`) vê o inverso: um dia antes em fuso brasileiro. A abertura em UTC também mostra o dia seguinte para empréstimo registrado depois das 21h em Recife. O termo impresso, que é um documento formal, pode trazer uma data de devolução diferente da que o gestor escolheu, conforme o fuso de onde o back roda (saída na seção 5). O `val === 'null'` na L29 mostra que o tipo foi relaxado para esconder um dado mal formado.
- **Como foi encontrado:** `grep -rnE ": any\b|as any"` e `grep` por literais de enum; a diferença de fuso foi vista na leitura e reproduzida em Node (`docs/ferramentas-analise/data-fuso-pdf.mjs`), usando como entrada o valor que o front realmente envia (`fimDoDiaISO`).
- **Confirmação:** executado (a data); leitura (os `any` e os literais).
- **Confirmado por:** Randell em 13/11
- **Ideia de correção:** tipar com `Prisma.EstoqueGetPayload` e usar `StatusItem`; formatar as duas datas com um fuso fixo de negócio (`timeZone: 'America/Recife'`). Usar `'UTC'` nas duas não resolve: o prazo enviado pelo front (fim do dia local) sairia no dia seguinte.

#### ACH-10 — Código de exemplo e provisório ainda no produto (código morto)
- **Onde:** `front/src/modules/todos`, `modules/team`, `pages/todos`, `pages/team` (1.325 das 5.636 linhas do front, **23,5%**); `front/src/routes.tsx` (L114-119: usuário autenticado vai para `/todos`); `front/src/utils/sidebar.ts` ("Tarefas de Exemplo" na L19-23 e "Gerenciar Equipe" na L49); `back/prisma/schema.prisma` (`CANCELADO` em `StatusEmprestimo`, coluna `semTombamento` em `Item` e coluna `justificativaPermanencia` em `Emprestimo`, nunca referenciados em `back/src` fora dos specs); `front/src/pages/categorias/index.tsx` L9 (`const isGestor = true`).
- **Categoria:** code smell (código morto, generalidade especulativa, stub esquecido).
- **Problema:** módulos do boilerplate permanecem ativos e fazem parte da navegação do produto. A tela inicial depois do login é a lista de tarefas de exemplo.
- **Por que atrapalha:** o primeiro contato do gestor com o sistema é uma tela que não faz parte do domínio, e os testes e a manutenção seguem pagando por esse código. O estado `CANCELADO` aparece no front (`emprestimo.types.ts` L1) e no schema, mas nenhuma operação do back o produz, então um empréstimo em `AGUARDANDO_TERMO` não tem como ser desfeito. `semTombamento` está no schema, mas o critério da US03 (marcar como "sem tombamento") não é atendido pelo DTO. Com `isGestor = true`, o botão de criar categoria aparece para qualquer perfil e só falha com 403 ao clicar.
- **Como foi encontrado:** `wc -l` dos módulos de exemplo contra o total; `grep -rnE "CANCELADO|semTombamento|justificativaPermanencia" back/src` (sem resultados fora dos specs); leitura de `routes.tsx` e `sidebar.ts`.
- **Confirmação:** leitura e `grep`.
- **Confirmado por:** Randell em 13/11
- **Ideia de correção:** remover `todos`/`team` (ou esconder da navegação), redirecionar para `/estoques`, ligar `isGestor` à role real e decidir o destino de `CANCELADO` e `semTombamento`.

#### ACH-11 — O hook do termo mantém no estado uma URL de PDF já revogada
- **Onde:** `controle-estoque-emprestimos-front/src/modules/emprestimos/useTermo.ts`, estado e efeito de `pdfUrl` (`L33-52`); consumido em `controle-estoque-emprestimos-front/src/pages/emprestimos/TermoPage.tsx` (`L52-56` e `L96-106`), rota parametrizada em `controle-estoque-emprestimos-front/src/routes.tsx` (`L137`).
- **Categoria:** code smell (estado de recurso assíncrono fica obsoleto ao trocar a entidade).
- **Problema:** quando `estoqueId` ou `emprestimoId` muda, a limpeza do efeito marca a requisição anterior como cancelada e revoga sua URL (`URL.revokeObjectURL`), mas não limpa `pdfUrl` nem `erroPdf`. O novo `obterTermoBlob` roda em paralelo com a busca do empréstimo do `useAsync`. Se a busca do empréstimo terminar primeiro, `TermoPage` deixa o loading e renderiza o iframe/link com a URL antiga, já revogada, até o novo blob chegar.
- **Por que atrapalha:** ao navegar diretamente entre termos sem desmontar a página, o documento pode ficar temporariamente em branco ou indisponível; se a nova carga falhar, o estado antigo continua apontando para a URL revogada. O estado local e a limpeza estão no código; a sequência temporal descrita é dedução e não foi reproduzida no navegador.
- **Como foi encontrado:** leitura de `useTermo` e do ponto de renderização do iframe/link em `TermoPage`, além da rota parametrizada que mantém o mesmo elemento de página.
- **Confirmação:** leitura; efeito visual da troca ainda **a confirmar** em execução no navegador.
- **Confirmado por:** Mateus em 14/11 (commit `b9b67c5`)
- **Ideia de correção:** limpar `pdfUrl` e `erroPdf` ao iniciar a carga de novos IDs, revogando a URL anterior, e só renderizar o documento correspondente aos parâmetros atuais.

#### ACH-12 — A validação de audiência do token é desativada se faltar configuração
- **Onde:** `controle-estoque-emprestimos-back/src/config/keycloak.config.ts` (`clientId`, L6-7); `controle-estoque-emprestimos-back/src/common/auth/identity/keycloak.identity-source.ts` (leitura do valor L52-55 e `hasValidAudience`, L110-120); `controle-estoque-emprestimos-back/src/common/auth/guards/auth.guard.ts` (L39-47). A documentação descreve o client backend como esperado em `controle-estoque-emprestimos-back/docs-site/content/docs/architecture/authentication.mdx` (L89).
- **Categoria:** code smell de segurança (validação fail-open condicionada à configuração).
- **Problema:** `KEYCLOAK_CLIENT_ID` assume string vazia e é convertido para `undefined`. Nessa condição, `hasValidAudience` retorna `true` sem verificar `aud` ou `azp`; o `AuthGuard` aceita o `CurrentUser` retornado pelo identity source. Assinatura, issuer, expiração e papel continuam sendo verificados, mas não há restrição ao client emissor/consumidor esperado. O comentário do código (`keycloak.config.ts` L6 e `hasValidAudience`, L112) indica que a validação é opcional por decisão; o risco está no padrão aberto, não em um erro acidental.
- **Por que atrapalha:** se a variável ficar ausente, um token válido do mesmo realm, emitido para outro client e com uma role reconhecida, pode autenticar na API. O valor padrão e o desvio estão no código; não foi feito teste HTTP com token de outro client.
- **Como foi encontrado:** leitura da configuração, do ramo `if (!this.clientId) return true`, do retorno de identidade e do `AuthGuard`; `controle-estoque-emprestimos-back/docs-site/content/docs/architecture/authentication.mdx` (L89) descreve a validação da audiência contra `KEYCLOAK_CLIENT_ID`.
- **Confirmação:** leitura; aceitação ponta a ponta de token de outro client **a confirmar** com configuração e token de teste.
- **Confirmado por:** Mateus em 14/11 (commit `b9b67c5`)
- **Ideia de correção:** exigir `KEYCLOAK_CLIENT_ID` na validação de configuração e falhar o bootstrap ou rejeitar o token quando a audiência esperada não estiver configurada.

#### ACH-13 — Permissão do formulário de itens fixada em `true` no front (stub esquecido)
- **Onde:** `front/src/pages/estoques/index.tsx`, `EstoquesPage`: `const usuarioLogadoEhGestor = true;` (L49), passada em `<GerenciamentoEstoque isGestor={usuarioLogadoEhGestor} />`. O componente usa essa prop para exibir o formulário (L134) ou o aviso de restrição (L268).
- **Categoria:** code smell (valor fixo/stub esquecido, generalidade especulativa). Mesmo padrão do `isGestor = true` de `categorias/index.tsx` L9 (ACH-10), mas em outro arquivo e com efeito sobre o cadastro de itens do estoque.
- **Problema:** A página decide por uma constante fixa que o usuário é gestor. O critério da US03 pede que o formulário de itens apareça só para o gestor daquele estoque.
- **Por que atrapalha:** Qualquer perfil (REQUISITANTE ou gestor de outro estoque) vê o formulário de cadastro de itens e só descobre que não tem permissão ao enviar, quando o backend responde 403 e o `item.service.ts` (L49) exibe "Apenas gestores deste estoque podem cadastrar ou editar itens.". A regra de permissão real fica oculta no front e nenhum teste cobre essa quebra de UI.
- **Como foi encontrado:** Leitura manual do fluxo; validado via `Select-String` por `isGestor`, revelando a constante e seu uso em `GerenciamentoEstoque.tsx`.
- **Confirmação:** Leitura e análise dos componentes.
- **Confirmado por:** Caio em 12/11 (commit `751f68e`)
- **Ideia de correção:** derivar a constante `usuarioLogadoEhGestor` a partir da verificação real do papel do usuário e da lista de gestores do estoque selecionado (ou envolver o componente num `<Can>`), além de cobrir o comportamento com testes de renderização.

#### ACH-15 — Arquivo do termo ausente no storage vira erro 500 (o erro de disco atravessa o storage)
- **Onde:** `back/src/modules/emprestimos/termo-storage.service.ts` `read` (L21-23); chamado em `emprestimos.service.ts` `obterPdf` (L203) e `obterPdfAssinado` (L280); expostos em `emprestimos.controller.ts` `visualizarTermo` e `baixarTermo` (L139-171). Filtro global em `common/filters/http-exception.filter.ts` (L88-92).
- **Categoria:** information hiding e acoplamento (o erro do sistema de arquivos sai pela fronteira do `TermoStorageService` sem tradução) e code smell (tratamento de erro incompleto).
- **Problema:** o banco guarda só o caminho do PDF (`Termo.arquivoPdf`, `arquivoAssinado`). O service trata a falta do **registro** (404), mas não a falta do **arquivo**. Se o arquivo sumiu (volume recriado, storage limpo, backup incompleto), `readFile` rejeita com `ENOENT`. Não há `catch` nem `ENOENT` em `back/src`. O filtro só conhece `ZodError`, `AppException` e `HttpException`; todo o resto vira `INTERNAL_ERROR` 500 com a mensagem "Erro interno do servidor." e é registrado como falha do servidor. O Swagger desses endpoints documenta 404 "Empréstimo ou termo não encontrado", mas não o 500. O `termo-storage.service.spec.ts` só testa escrita/leitura e caminho fora do storage, sem caso de arquivo ausente.
- **Por que atrapalha:** o gestor que abre o termo de um empréstimo antigo recebe "Erro interno do servidor", sem saber que o empréstimo existe e o documento é que sumiu. O termo é o documento de responsabilidade do bem, e sua perda fica indistinguível de um bug da API. A premissa A6 prevê trocar a implementação do storage, e cada implementação nova teria de lembrar de tratar a ausência por conta própria, porque o contrato não define o que acontece.
- **Como foi encontrado:** leitura manual da área (storage, service, controller e filtro); `grep -rnE "ENOENT|termoStorage\.read" back/src` achou os 2 usos de `read` e nenhum tratamento; `docker-compose.yml` mostra que o storage usa o volume nomeado `termos`, então o cenário é falha de operação, não uso normal.
- **Confirmação:** leitura. O 500 de ponta a ponta está **a confirmar**: subir a API, criar um empréstimo, apagar o PDF em `storage/termos` e chamar `GET /estoques/:estoqueId/emprestimos/:id/termo`.
- **Confirmado por:** Randell em 13/11
- **Ideia de correção:** `TermoStorageService.read` traduzir `ENOENT` para uma exceção própria (por exemplo `ResourceNotFoundException('Arquivo do termo', caminho)`), e adicionar o caso de arquivo ausente no spec.

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
| FP-01 | "Endpoints de saldo em `MovimentacoesController` sem checagem de gestor" (leitura) | Conferido por Caio em 14/11 (commit `4fa5aa4`). `docs/permissoes.md` libera saldo para qualquer usuário autenticado (L24 e L38: "Ver lista de estoques, itens e saldo", para evitar pedir um item com saldo 0), e as rotas `saldo/item/:itemId` e `saldo/estoque/:estoqueId` têm só o `AuthGuard` da classe. Está de acordo com o requisito. Ressalva: a L52 do `permissoes.md` diz que essa visibilidade é decisão do PO, ainda não validada pela Gerência. |
| FP-02 | "`GestorGuard` aceita gestor de qualquer estoque, contra a regra por estoque" (leitura) | Conferido por Caio em 14/11 (commit `4fa5aa4`). Categorias são globais (premissa A2, confirmada pela Gerência em 09/10) e `docs/permissoes.md` L44 diz que qualquer gestor cria e edita categoria. O guard consulta `estoqueGestor.findFirst` só por `usuarioId`, sem `estoqueId`, o que é o comportamento esperado para um recurso que não pertence a um estoque. Não há desvio para o ADMIN, que recebe 403 (também de acordo com o `permissoes.md`). É intencional. |
| FP-03 | "`userId as string` em `emprestimos.service.ts` L124 e L417 é cast inseguro" (heurística de lint) | Conferido por Randell em 13/11. `assertGestorDoEstoque` lança `AccessDeniedException` quando `userId` é indefinido (L469-481) antes de chegar ao cast, então o valor nunca é nulo ali. O cast é feio, mas não causa defeito. (Sugestão de limpeza: estreitar o tipo.) |
| FP-04 | "`api.ts` do front viola responsabilidade única e tem estado global mutável" (LLM) | Conferido por Caio em 14/11 (commit `4fa5aa4`). Token, expiração, renovação e logout são o mesmo assunto (cliente HTTP autenticado). O estado de módulo (`authToken`, `tokenExpiresAt`, `inFlightRefresh`, `refreshTokenFn`, `logoutFn`) é global, mas serve a esse único cliente, e a renovação em voo (`refreshOnce`) evita várias chamadas paralelas de `signinSilent`. O `api.test.ts` cobre o Bearer, o retry em 401, a renovação proativa e a renovação compartilhada entre requisições concorrentes (não cobre o logout em sessão morta). A única parte fora de lugar é `getApiErrorMessage`, que já está em ACH-03. |
| FP-05 | "Services dependem das classes concretas `PrismaService` e `TermoStorageService` (inversão de dependência)" (LLM) | Conferido por Caio em 12/11 (commit `751f68e`). No Nest a classe serve de token e pode ser trocada por `useClass`/`overrideProvider`, sem alterar o service. O `EmprestimosService` não usa `fs` direto: todo acesso a arquivo passa por `TermoStorageService` (L155, L173, L203, L240-251, L280), e a premissa A6 prevê trocar essa implementação. Onde a troca é real, já há token (`IDENTITY_SOURCE` em `auth.module.ts` L13, injetado em `auth.guard.ts` L26). O custo de criar interfaces para Prisma e storage não compensa. |
| FP-06 | "`termo-pdf.service.ts` `gerar` é um método longo (cerca de 130 linhas)" (métrica de tamanho) | Conferido por Caio em 12/11 (commit `751f68e`). O `gerar` tem ~130 linhas (167 no arquivo todo), mas é layout linear, com 4 helpers locais pequenos, sem regra de negócio e com uma única responsabilidade (desenhar o PDF). O histórico tem só 2 commits. A mudança pendente (incluir o CPF) é pontual e já está na seção 3. Os problemas reais do arquivo estão no ACH-09. |
| FP-07 | "Blocos de `import` repetidos em 5 páginas do front" (`docs/ferramentas-analise/dup.py`) | Conferido por Caio em 14/11 (commit `4fa5aa4`). A ferramenta casou listas de `import` (`Table`, `TableBody`, `ErrorScreen`). Contagem por `Select-String` nas 5 páginas (`emprestimos`, `estoques`, `movimentacoes`, `team`, `todos`): 2 ocorrências de `import` e de 2 a 4 de uso em cada uma, ou seja, reaproveitamento de componentes compartilhados, sem lógica duplicada. O `dup.py` não estava no clone usado na conferência, então a contagem é por leitura. |
| FP-08 | "`eslint-disable react-hooks/exhaustive-deps` em `useAsync.ts` L59" (grep) | Conferido por Caio em 14/11 (commit `4fa5aa4`). Desabilitação deliberada: o hook recebe a lista de dependências do chamador (`deps`) e usa `[...deps, reloadToken]` (L60), que o linter não consegue analisar. O JSDoc do hook documenta `deps` e a flag `cancelled`, mas a linha do `eslint-disable` não tem comentário próprio. Melhoria barata, não é defeito: acrescentar uma linha explicando o motivo. |
| FP-09 | "`TERMO_ASSINADO_MAX_BYTES` é número mágico" (heurística) | Conferido por Randell em 13/11. É uma constante nomeada, com comentário, em `termo-assinado.constants.ts`, e compartilhada pelo controller e pelo service. |
| FP-10 | `noGlobalIsNan` em `termo-pdf.service.ts` (Biome) | `isNaN` recebe `d.getTime()`, que retorna número; não há coerção de entrada heterogênea neste ponto. O alerta não demonstra defeito concreto no fluxo atual. |
| FP-11 | `useConsistentArrayType` (Biome) | Só recomenda padronização de sintaxe de tipo; é estilo e não evidencia problema de comportamento ou manutenção neste caso. |
| FP-12 | `react-hooks/incompatible-library` em `GerenciamentoEstoque.tsx` (ESLint) | O aviso trata da otimização pelo React Compiler; a configuração Vite atual não habilita o React Compiler. Não há efeito de runtime demonstrado nesta configuração. |
| FP-13 | `set-state-in-effect` em `categorias/index.tsx` (ESLint), usado no antigo ACH-11 | A regra aponta a chamada do helper que atualiza estado; a repetição da consulta citada decorre do replay esperado de efeitos pelo React StrictMode em desenvolvimento. A possível corrida não foi reproduzida, então esse sinal não basta para sustentar smell independente. |
| FP-14 | `eslint .` inclui `docs-site` (antigo ACH-12) | A execução de fato falha com nove erros nessa pasta, mas trata-se exclusivamente de configuração/escopo do lint; o critério desta issue exclui configuração de ferramenta como achado. |

## 5. Ferramentas, comandos e prompts (para o log)

**Ferramentas que rodaram:**

| Ferramenta | Uso | Resultado |
|---|---|---|
| Leitura manual | `emprestimos`, `movimentacoes`, `estoques`, `itens`, `categorias`, filtro de erros, guards, DTOs, `api.ts`, serviços e páginas do front | base de todos os achados |
| `wc -l`, contagem de métodos por classe | tamanho e coesão | `EmprestimosService`: 491 linhas e 13 métodos |
| `grep`/ripgrep | `any`, `as string`, literais de enum, exceções nativas × próprias, `class-validator` × `nestjs-zod`, `CANCELADO`/`semTombamento` | ACH-04, ACH-09, ACH-10 |
| `docs/ferramentas-analise/dup.py` (script próprio, janelas de 6 e 7 linhas normalizadas) | duplicação | achou `assertGestorDoEstoque` e `request<T>`; 1 resultado era falso (FP-07) |
| `docs/ferramentas-analise/erro.test.ts` (vitest, front) | alimenta `getApiErrorMessage` com o corpo do filtro do back, em 409 e 422 | devolveu o JSON cru como mensagem nos dois casos (ACH-03) |
| `docs/ferramentas-analise/data.mjs` (Node 22, `TZ=UTC` e `TZ=America/Sao_Paulo`) | formatadores de data do PDF | `20/11/2026` em UTC e `19/11/2026` em São Paulo (ACH-09) |
| `docs/ferramentas-analise/data-fuso-pdf.mjs` (Node 22, `TZ=UTC` e `TZ=America/Recife`) | formatadores de data do PDF, com a entrada real do front (`fimDoDiaISO`) | prazo de 20/11 sai `21/11/2026` em UTC e `20/11/2026` em Recife; data pura sai `20/11` em UTC e `19/11` em Recife (ACH-09) |
| `grep -rnE "ENOENT\|termoStorage\.read" back/src` | tratamento de arquivo ausente no storage | 2 usos de `read`, nenhum tratamento (ACH-15) |
| `grep -rnE "CANCELADO\|semTombamento\|justificativaPermanencia" back/src` | colunas e estados sem uso | nenhum uso fora dos specs (ACH-10) |
| `Select-String` (PowerShell, back) | Buscar `fs\.`, `writeFile` e `TermoStorageService` em `emprestimos.service.ts` | Confirmou que todo acesso a arquivo passa pelo `TermoStorageService` (ACH-05 e FP-05) |
| `Get-ChildItem` + `Select-String` (PowerShell, back) | Buscar `IDENTITY_SOURCE\|@Inject\(` em `back/src` | Encontrou 1 único uso de token de injeção (`IDENTITY_SOURCE`), confirmando FP-05 |
| `git log --oneline` e `(Get-Content ...).Count` (back) | Histórico e tamanho de `termo-pdf.service.ts` | Mostrou 2 commits e 167 linhas com 4 helpers lineares, confirmando FP-06 |
| `Select-String` (PowerShell, back) | Buscar `\$transaction\|timeout\|maxWait` em `emprestimos.service.ts` | Revelou 3 transações sem `timeout` ou `maxWait` configurado (ACH-05) |
| `(Get-Content ...).Count` + `Select-String` (PowerShell, front) | Tamanho e padrões (`z.object`, `onSubmit`, regex, `<table>`) em `GerenciamentoEstoque.tsx` | Confirmou schema, tradução de erro por regex, formulário e tabela em 327 linhas (ACH-06) |
| `Get-ChildItem` + `Select-String` (PowerShell, front) | Buscar `isGestor\|EhGestor\|gestor` em `front/src` | Encontrou `const usuarioLogadoEhGestor = true` em `estoques/index.tsx` L49 (ACH-13) |
| `Select-String` e leitura manual (PowerShell, back) | `movimentacao` em `emprestimos.service.ts`, `saldo\|insuficiente\|registrarNaTransacao` em `movimentacoes.service.ts`, `movimentacao\|ENTRADA\|TipoMovimentacao` em `itens.service.ts`, e `movimentacao\.create` em todo o back | 2 gravações diretas no empréstimo (L139 e L530), regra de saldo só em `registrarNaTransacao`, nenhuma `ENTRADA` no cadastro do item (ACH-01) |
| `Select-String` (PowerShell, back) | `saldo\|totalItens\|disponiveis\|emprestados` em `estoques.service.ts` e `StatusItem\.\|AGUARDANDO_TERMO` em `emprestimos.service.ts` | `saldo` como contagem por status; status do item só muda nas L389 e L527 (ACH-02) |
| `Select-String` (PowerShell, back e front) | `problem\+json\|detail\|message` no filtro e `getApiErrorMessage\|message\|detail` em `api.ts` | mensagem em `detail` no back; front lê só `message` ou `error` (ACH-03) |
| `Get-ChildItem` + `Select-String` (PowerShell, back) | contagem por arquivo de `new (BadRequest\|Conflict\|Forbidden\|NotFound)Exception` e de `new (AppException\|ResourceNotFound\|ResourceConflict\|AccessDenied)Exception`; `ValidationPipe\|UsePipes\|class-validator\|nestjs-zod` | 17 exceções nativas (4 arquivos) e 50 da família própria (5 arquivos); nenhum `ValidationPipe` em `src` (ACH-04) |
| `Select-String`, `Get-Content` e leitura de `docs/permissoes.md` | conferência de FP-01, FP-02, FP-04, FP-07 e FP-08 | descartes mantidos, com ressalvas anotadas na seção 4 |
| `git rev-parse --short HEAD` | commit analisado | `b9b67c5` |
| `Select-String` (PowerShell, back) | `movimentacao`, `ENTRADA`, `saldo\|calcularSaldo\|insuficiente`, `saldo\|disponiveis\|emprestados\|totalItens`, `calcularSaldoItem\|consultarSaldoEstoque`, `StatusItem\|AGUARDANDO_TERMO` | sustentou ACH-01 e ACH-02 |
| `Get-Content -Encoding UTF8` + numeração (função `Num`, PowerShell) | leitura de trechos com número de linha | linhas citadas nos achados |
| `Select-String` + `Group-Object` (PowerShell, back) | exceções nativas × família `AppException`, `Pipe`, `class-validator\|nestjs-zod\|from 'zod'` | 17 contra 44 usos; só o `ZodValidationPipe` global (ACH-04) |
| `Select-String` (PowerShell, front) | `\.detail\|problem\+json` em `front/src` e em `api.test.ts` | sem resultados (ACH-03) |
| `docs/ferramentas-analise/ach04.test.ts` (vitest, back) | pipe global contra `RegistrarMovimentacaoDto` | pipe não lançou erro; `class-validator` apontaria 2 erros (ACH-04) |
| Biome 2.4.16 (back) | `npx biome ci src/ test/` (sem `--write`) | 74 arquivos; 32 erros de formatação, 6 avisos (4 `noExplicitAny`, já cobertos no ACH-09; 1 `noGlobalIsNan`, FP-10; 1 `useConsistentArrayType`, FP-11). Os erros de formatação são apenas estilo; nenhum foi aplicado. |
| ESLint 9.39.5 (front) | `npm --prefix controle-estoque-emprestimos-front run lint` (`eslint .`, sem `--fix`) | 14 erros e 1 aviso: quatro `@typescript-eslint/no-explicit-any` (ACH-09), `react-hooks/set-state-in-effect` em categorias L36 e no docs-site (FP-13), seis `react-refresh/only-export-components` e duas regras não definidas no docs-site (FP-14); um aviso `react-hooks/incompatible-library` (FP-12). Nesta auditoria, saída salva em `%TEMP%\ach11-12-eslint-audit.txt`; exit code 1. |


**Ferramentas que não rodaram:** `tsc --noEmit` e as suítes de testes nesta etapa.

**Saídas dos scripts e testes:**
```
$ npx vitest run src/services/erro.test.ts   (front, copiado de docs/ferramentas-analise/)
MENSAGEM 409 => {"type":"https://controle-estoque-emprestimos.example/problems/conflict","title":"Conflito de dados","status":409,"detail":"Já existe um item com este tombamento.","instance":"/x","code":"CONFLICT",...}
MENSAGEM 422 => {"type":".../problems/validation-failed","title":"Dados inválidos","status":422,"detail":"Um ou mais campos precisam ser corrigidos.",...,"errors":{"nome":["Obrigatório"]}}
Tests  2 passed (2)

$ npx vitest run src/modules/movimentacoes/dto/ach04.test.ts   (back, copiado de docs/ferramentas-analise/)
pipe global devolveu sem erro: {"itemId":"x","tipo":"INVALIDO","quantidade":-5}
class-validator apontaria 2 erro(s)

$ TZ=UTC node docs/ferramentas-analise/data.mjs                  -> abertura=20/11/2026  prevista=20/11/2026
$ TZ=America/Sao_Paulo node docs/ferramentas-analise/data.mjs    -> abertura=20/11/2026  prevista=19/11/2026

$ TZ=UTC node docs/ferramentas-analise/data-fuso-pdf.mjs
  prevista (front, 20/11 23:59 local)  -> 21/11/2026
  prevista (API, "2026-11-20")         -> 20/11/2026
  abertura (13/11 22:00 local, em UTC) -> 14/11/2026
$ TZ=America/Recife node docs/ferramentas-analise/data-fuso-pdf.mjs
  prevista (front, 20/11 23:59 local)  -> 20/11/2026
  prevista (API, "2026-11-20")         -> 19/11/2026
  abertura (13/11 22:00 local, em UTC) -> 14/11/2026
```

**Prompts usados com a LLM (Claude):**

1. Prompt da issue, colado na íntegra: "Percorrer o código procurando violações de propriedades de projeto (integridade conceitual, information hiding, coesão, acoplamento), de SOLID e code smells, por leitura manual, ferramentas e LLM. Cada achado precisa ser confirmado por alguém olhando o código; falsos positivos são anotados com o motivo." (acompanhado do repositório em `.zip`).
2. A LLM leu os arquivos do back e do front, escreveu os scripts da seção acima e propôs os candidatos. Cada achado voltou ao código (arquivo e linha) antes de entrar na lista, e os que a leitura não sustentou foram para a seção 4.
3. LLM (Gemini) para análise do EmprestimosService. Prompt: "Análise de violações de SOLID e code smells no arquivo emprestimos.service.ts".
4. Randell (ACH-09, ACH-10, ACH-15, FP-03 e FP-09): prompt com o roteiro da S3B-07 colado, pedindo apoio para conferir ACH-09 e ACH-10, propor um achado em termo em PDF/storage e validar os trechos no código local (`8de43cf`). O script `data-fuso-pdf.mjs` foi executado em `TZ=UTC` e `TZ=America/Recife`, e todos os trechos citados foram lidos diretamente nos arquivos antes da assinatura.
5. Mateus (ACH-01 a ACH-04): prompt com o contexto da S3B-07 pedindo para conferir os blocos ACH-01 a ACH-04 contra o código local (`b9b67c5`) e interpretar as saídas do PowerShell; os testes `erro.test.ts` e `ach04.test.ts` foram escritos com apoio da LLM e executados localmente.
6. Mateus (revisão de ACH-11 e ACH-12): prompt com a descrição da S3B-07 pedindo auditoria contra o código local (`b9b67c5`), nova execução do ESLint sem correções e substituição dos candidatos que não atendem aos critérios da issue. Saída do lint salva em `%TEMP%\ach11-12-eslint-audit.txt`; trechos de `useTermo` e `KeycloakIdentitySource` lidos nesta revisão.
7. Caio (ACH-01 a ACH-04, FP-01, FP-02, FP-04, FP-07 e FP-08): conversa com Claude passo a passo, com o roteiro da S3B-07 colado e o `log-analise.md` anexado. A LLM indicou o comando de cada verificação, e eu rodei no código local (`4fa5aa4`) e colei a saída. Os trechos e as contagens foram lidos nas saídas antes da assinatura; o que não pôde ser comprovado (saldo -1, DTOs sem validação e o 422 tratado no front) ficou como "a confirmar".


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
| 2 ou mais achados confirmados por pessoa (meta de cerca de 8 no time) | Mateus confirmou ACH-01 a ACH-04, ACH-11 e ACH-12 lendo o código local no commit `b9b67c5`; faltam confirmações humanas dos demais achados com campo "Confirmado por" em branco. As verificações ainda marcadas **a confirmar** dependem de execução. |
| Achado com arquivo/função, problema, categoria, consequência e como foi encontrado | feito |
| Falsos positivos anotados com o motivo | feito (14) |
| Prompts e ferramentas registrados | feito (seção 5) |
