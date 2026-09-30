---
title: <nome do módulo>
summary: Uma frase — o que este exemplo demonstra que os outros módulos de exemplo não demonstram.
---

# <nome do módulo>

O que este módulo existe para ensinar, em uma ou duas frases. Se ele repete o padrão de outro exemplo sem acrescentar nada, ele não deveria virar uma página nova — ver [Guia de Documentação](/docs/contributing/documentation-guide#quando-um-exemplo-ganha-página-própria).

## 📂 Estrutura

| Arquivo | Papel |
|---|---|
| `<entidade>.page.tsx` | |
| `use<Entidade>.ts` | |
| `<entidade>.service.ts` | |
| `<entidade>.types.ts` | |

## Entidade

```typescript
interface <Entidade> {
  // ...
}
```

## Rota e acesso

`permittedRoles` da rota, e se as ações usam `<Can>` ou se a página inteira já é restrita — ver [Autenticação & Autorização](/docs/architecture/authentication).

## O que este exemplo demonstra

A(s) parte(s) do padrão que só aparece(m) aqui — o motivo de existir uma página em vez de só uma linha na tabela de [Visão Geral dos Exemplos](/docs/examples/overview).

## Gotchas

Qualquer coisa que um leitor erraria assumindo que este módulo segue o padrão-padrão sem desvio.
