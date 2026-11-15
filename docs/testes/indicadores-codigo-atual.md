# Indicadores reexecutados no código atual após as complementações

Vitest 4.1.8, cobertura V8, `vitest.llm.config.ts`; o mesmo filtro amplo de produção instrumenta as seis US (627 linhas e 327 branches), inclusive arquivos não executados por uma story isolada. Cada comparação v1/v2 usa **a mesma revisão e o mesmo filtro**, mas percentuais de stories diferentes não são somáveis. A v1 gerada permanece intacta.

| US | v1: testes; linhas; branches | v2 isolada: testes; linhas; branches | Observação |
|---|---|---|---|
| 01 | 24 pass; 85/627 (13,55%); 44/327 (13,45%) | 57 pass; 113/627 (18,02%); 59/327 (18,04%) | inclui testes novos HTTP/pipe/edição compartilhados com US02 |
| 02 | 13 pass; 84/627 (13,39%); 24/327 (7,33%) | 35 pass; 140/627 (22,32%); 55/327 (16,81%) | inclui os testes compartilhados de edição HTTP |
| 03 | 102 pass, 4 fail; 74/627 (11,80%); 38/327 (11,62%) | 128 pass; 122/627 (19,45%); 66/327 (20,18%) | 3 falhas da v1 esperam a regra anterior à S3-19, 1 falha é oráculo de enum |
| 04 | 132 pass, 4 fail, 2 todo; 206/627 (32,85%); 95/327 (29,05%) | 217 pass; 242/627 (38,59%); 116/327 (35,47%) | 2 falhas de mock e 2 de oráculo antigo por instante |
| 05 | 89 pass, 1 fail; 179/627 (28,54%); 77/327 (23,54%) | v1+v2: 155 pass, 1 fail, 6 expected fail; 248/627 (39,55%); 101/327 (30,88%) | v1 falha no texto de Siape nulo no código atual; a v2 nova isolada teve 66 pass e 6 expected fail |
| 06 | 7 pass; 24/627 (3,82%); 12/327 (3,66%) | 24 pass; 76/627 (12,12%); 36/327 (11,00%) | lista de alertas e autorização exercitadas com Prisma fake |

Relatórios HTML e `coverage-summary.json`: `relatorios/{v1,v2}/us0X-final/`. A execução conjunta final `tests/v2` teve **512 pass, 6 expected fail, 0 fail, 0 todo** em 11 arquivos. O frontend teve **96 pass** em 16 arquivos; builds de ambos passaram. Testes com fake/serviço simulado não substituem Postgres e autenticação Keycloak reais. A contagem US05 v1+v2 não está verde porque a v1 histórica não é editada.
