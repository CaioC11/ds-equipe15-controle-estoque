---
title: <Nome do Conceito ou Guia>
summary: Uma frase — o que o leitor ganha nesta página sem precisar abri-la.
---

Use este template para páginas de arquitetura (mecanismo transversal, explicado do início ao fim)
ou de guia (passo a passo de uma tarefa). Para um módulo de exemplo, use `example-page.md`.

## O que é

Uma ou duas frases, depois o mecanismo em si — o fluxo real pelo código, não uma repetição de quais
arquivos estão envolvidos. Sempre que possível, trace um exemplo concreto (uma requisição real, um
dado real) pelo mecanismo, em vez de descrevê-lo em abstrato. Descrição abstrata lê bem e não
verifica nada; um exemplo concreto é falseável por qualquer um lendo o mesmo código.

## Onde vive

Aponte para os arquivos específicos (`caminho/do/arquivo.ext`), não só o diretório.

## Como é usado em outros lugares

Links cruzados para páginas de arquitetura ou exemplos que dependem deste mecanismo.

## Lacunas conhecidas

Se parte do mecanismo não está conectada, é um stub, ou só parcialmente aplicada, diga isso aqui
num `<Callout type="warn">` — ver o padrão de código não conectado no [Guia de Documentação](/docs/contributing/documentation-guide#documente-o-que-é-não-o-que-deveria-ser).
Esta seção não é preenchimento opcional — se não houver nada para colocar aqui, vale a pena checar
de novo em vez de assumir, já que mecanismos totalmente conectados são mais raros do que parecem
de fora.
