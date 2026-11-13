# Log de análise de código — dívida técnica (propriedades de projeto, SOLID e code smells)

Issue de tech-debt. Prazo: 12/11. Escopo: `controle-estoque-emprestimos-back/src` (2.734 linhas, sem specs) e `controle-estoque-emprestimos-front/src` (5.636 linhas, sem testes). Os módulos `docs-site` ficaram de fora porque são documentação gerada.

## 1. Resumo

| Grupo | Achados confirmados |
|---|---|
| Propriedades de projeto (integridade conceitual, information hiding, acoplamento) | ACH-01, ACH-02, ACH-03, ACH-04, ACH-15 |
| SOLID e coesão | ACH-05, ACH-06 |
| Code smells | ACH-07, ACH-08, ACH-09, ACH-10, ACH-13 |

Total: **12 achados** e **9 falsos positivos** (seção 4). A meta do time era cerca de 8.

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
| FP-01 | "Endpoints de saldo em `MovimentacoesController` sem checagem de gestor" (leitura) | `docs/permissoes.md` libera saldo para qualquer usuário autenticado ("Ver lista de estoques, itens e saldo"). Está de acordo com o requisito. |
| FP-02 | "`GestorGuard` aceita gestor de qualquer estoque, contra a regra por estoque" (leitura) | Categorias são globais (premissa A2) e a matriz diz "Cadastrar e editar categoria: GESTOR". É intencional. |
| FP-03 | "`userId as string` em `emprestimos.service.ts` L124 e L417 é cast inseguro" (heurística de lint) | Conferido por Randell em 13/11. `assertGestorDoEstoque` lança `AccessDeniedException` quando `userId` é indefinido (L469-481) antes de chegar ao cast, então o valor nunca é nulo ali. O cast é feio, mas não causa defeito. (Sugestão de limpeza: estreitar o tipo.) |
| FP-04 | "`api.ts` do front viola responsabilidade única e tem estado global mutável" (LLM) | Token, renovação e logout são o mesmo assunto (cliente HTTP autenticado), a renovação em voo evita várias chamadas paralelas de `signinSilent`, e há testes. A única parte fora de lugar é `getApiErrorMessage`, que já está em ACH-03. |
| FP-05 | "Services dependem das classes concretas `PrismaService` e `TermoStorageService` (inversão de dependência)" (LLM) | Conferido por Caio em 12/11 (commit `751f68e`). No Nest a classe serve de token e pode ser trocada por `useClass`/`overrideProvider`, sem alterar o service. O `EmprestimosService` não usa `fs` direto: todo acesso a arquivo passa por `TermoStorageService` (L155, L173, L203, L240-251, L280), e a premissa A6 prevê trocar essa implementação. Onde a troca é real, já há token (`IDENTITY_SOURCE` em `auth.module.ts` L13, injetado em `auth.guard.ts` L26). O custo de criar interfaces para Prisma e storage não compensa. |
| FP-06 | "`termo-pdf.service.ts` `gerar` é um método longo (cerca de 130 linhas)" (métrica de tamanho) | Conferido por Caio em 12/11 (commit `751f68e`). O `gerar` tem ~130 linhas (167 no arquivo todo), mas é layout linear, com 4 helpers locais pequenos, sem regra de negócio e com uma única responsabilidade (desenhar o PDF). O histórico tem só 2 commits. A mudança pendente (incluir o CPF) é pontual e já está na seção 3. Os problemas reais do arquivo estão no ACH-09. |
| FP-07 | "Blocos de `import` repetidos em 5 páginas do front" (`docs/ferramentas-analise/dup.py`) | A ferramenta casou listas de `import` (`Table`, `TableBody`, `ErrorScreen`). Não há lógica duplicada. |
| FP-08 | "`eslint-disable react-hooks/exhaustive-deps` em `useAsync.ts` L59" (grep) | Desabilitação deliberada: o hook recebe a lista de dependências do chamador (`[...deps, reloadToken]`), e o linter não consegue analisar isso. Está comentado e é o padrão de hooks genéricos. |
| FP-09 | "`TERMO_ASSINADO_MAX_BYTES` é número mágico" (heurística) | Conferido por Randell em 13/11. É uma constante nomeada, com comentário, em `termo-assinado.constants.ts`, e compartilhada pelo controller e pelo service. |

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
| `docs/ferramentas-analise/data-fuso-pdf.mjs` (Node 22, `TZ=UTC` e `TZ=America/Recife`) | formatadores de data do PDF, com a entrada real do front (`fimDoDiaISO`) | prazo de 20/11 sai `21/11/2026` em UTC e `20/11/2026` em Recife; data pura sai `20/11` em UTC e `19/11` em Recife (ACH-09) |
| `grep -rnE "ENOENT\|termoStorage\.read" back/src` | tratamento de arquivo ausente no storage | 2 usos de `read`, nenhum tratamento (ACH-15) |
| `grep -rnE "CANCELADO\|semTombamento\|justificativaPermanencia" back/src` | colunas e estados sem uso | nenhum uso fora dos specs (ACH-10) |
| `Select-String` (PowerShell, back) | Buscar `fs\.`, `writeFile` e `TermoStorageService` em `emprestimos.service.ts` | Confirmou que todo acesso a arquivo passa pelo `TermoStorageService` (ACH-05 e FP-05) |
| `Get-ChildItem` + `Select-String` (PowerShell, back) | Buscar `IDENTITY_SOURCE\|@Inject\(` em `back/src` | Encontrou 1 único uso de token de injeção (`IDENTITY_SOURCE`), confirmando FP-05 |
| `git log --oneline` e `(Get-Content ...).Count` (back) | Histórico e tamanho de `termo-pdf.service.ts` | Mostrou 2 commits e 167 linhas com 4 helpers lineares, confirmando FP-06 |
| `Select-String` (PowerShell, back) | Buscar `\$transaction\|timeout\|maxWait` em `emprestimos.service.ts` | Revelou 3 transações sem `timeout` ou `maxWait` configurado (ACH-05) |
| `(Get-Content ...).Count` + `Select-String` (PowerShell, front) | Tamanho e padrões (`z.object`, `onSubmit`, regex, `<table>`) em `GerenciamentoEstoque.tsx` | Confirmou schema, tradução de erro por regex, formulário e tabela em 327 linhas (ACH-06) |
| `Get-ChildItem` + `Select-String` (PowerShell, front) | Buscar `isGestor\|EhGestor\|gestor` em `front/src` | Encontrou `const usuarioLogadoEhGestor = true` em `estoques/index.tsx` L49 (ACH-13) |

**Ferramentas que não rodaram:** Biome (back) e ESLint (front), `tsc --noEmit` e os testes, porque o ambiente não tinha `node_modules` do projeto nem acesso à rede para instalar. Rodar `npm run lint` nos dois pacotes e comparar com esta lista é um passo que ainda falta.

**Saídas dos dois scripts:**
```
$ node docs/ferramentas-analise/erro.mjs
mensagem exibida ao usuário => {"type":"https://controle-estoque-emprestimos.example/problems/conflict","title":"Conflito de dados","status":409,"detail":"Já existe um item com este tombamento.", ...}

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
