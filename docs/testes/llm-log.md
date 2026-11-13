# Log de uso da LLM (v1)

O modelo do prompt está em `prompt-modelo.md`. Este arquivo registra o que foi feito com ele.

## Decisão (igual para todos)
- LLM: Claude (Anthropic), pelo app claude.ai
- Modelo e versão:Claude Sonnet 5.5
- Configuração: esforço médio (ou "padrão, sem opção de ajuste"), busca na web desligada, conversa nova sem anexos
- Data da decisão:13/11/2026
- Matriz de rastreabilidade: não mostrada à LLM; commitada antes da geração.

## Regras
- Até 3 rodadas por story, só para compilar ou rodar. Pedido de "mais testes" fica para a v2.
- Sem edição manual dos testes; os que não compilam são comentados com registro aqui.

---

## US01 — Estoques e movimentação/saldo (Mateus)
(preencher conforme o modelo da seção abaixo)

## US02 — Controle de acesso por grupo (Artur)

## US03 — Itens com tombamento (Caio)

## US04 — Empréstimo e devolução (Theo)

## US05 — Termo de Responsabilidade (Randell)

## US06 — Alerta de estoque baixo (Mateus)

---

### Modelo de seção (copiar para cada story)

#### Rodada N
- Data e hora: ______
- Prompt completo: (colar o prompt já preenchido, com a story, os CAs e o código)
- Resumo da resposta: ______
- Problemas observados: ______
- Resultado: __ passando · __ falhando · __ não compilam

#### Contagem final
| Passando | Falhando | Não compilam |
|---|---|---|

#### Testes comentados por não compilar
| Teste | Motivo |
|---|---|

#### Investigação das falhas
| Teste | Erro | Classificação (oráculo errado, API inventada, setup, defeito real) | Evidência | Issue (se defeito real) |
|---|---|---|---|---|