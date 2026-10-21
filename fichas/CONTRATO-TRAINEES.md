# Contrato dos trainees e do onboarding

Migrações: `db/2.19.1_trainees.sql` (T1) e `db/2.19.1_onboarding.sql` (T3).
Stub: bloco "2.19.1: agenda das salas (L7), tablets (L9), trainees (T1) e
onboarding (T3)" em `testes/stub-supabase.js` (usa o papel do perfil do
stub; para testar como Pessoal, mude `DADOS.perfis[0].papel` como os testes
de papel já fazem).

## Trainees

Trainee é quem tem **cargo `Trainee`** (status Ativo, grupo NRO_TRAINEE).
Na tela, use o chip "Trainee" sempre que `cargo` for "Trainee" (sem
diferenciar maiúsculas), em qualquer lista de pessoas.

| RPC | Quem | Devolve |
|---|---|---|
| `ps_trainees_pendentes(p_edicao?)` | admin, Pessoal, Seleção | `{ status, grupo_trainee (nome ou null), candidatos: [{ id, nome, email, protocolo, edicao, areas_interesse, curso, instituicao, membro_mesmo_email (registro ou null) }] }` |
| `ps_admitir_trainees(p_itens)` | admin, Pessoal, Seleção | `{ status:'ok', admitidos: [{ candidato, registro, ja_admitido? }] }` ou `{ status:'invalido', erros: [{ candidato, erro, ... }] }` (nada é gravado); `sem_grupo_trainee` |
| `trainees_quadro(p_area_interesse?)` | admin, Pessoal, Seleção, liderança | `{ status, trainees: [{ registro, nome, alocacao, status, areas_interesse, gestor, gestor_nome, grupos, data_ingresso, edicao }] }` |
| `trainee_efetivar(p_reg, p_cargo, p_departamento?)` | admin, Pessoal | `{ status }`; `invalido` (cargo vazio ou "Trainee"), `nao_trainee` |
| `trainee_dispensar(p_reg, p_motivo)` | admin, Pessoal | `{ status, atividades_abertas, acessos, card }`; `motivo_obrigatorio`, `nao_trainee` |

`p_itens`: `[{ candidato, registro? (vazio = o próximo livre), area, gestor (registro), grupos: [nomes] }]`.
Erros por item: `nao_encontrado`, `status_invalido`, `email_de_membro`,
`registro_em_uso`, `area_obrigatoria`, `gestor_invalido`, `grupo_invalido` (+ `grupo`).

## Onboarding

| RPC | Quem | Devolve |
|---|---|---|
| `onboarding_meu()` | membro logado | `{ status, versao, etapas: [etapa], feitas, total }`; `sem_registro` |
| `onboarding_marcar(p_etapa, p_feita default true)` | membro logado | o mesmo; `invalido` para etapa de fato ou inexistente |
| `onboarding_painel()` | admin, Pessoal, liderança | `{ status, versao, pessoas: [{ registro, nome, trainee, gestor_nome, feitas, total, pendentes: [títulos] }] }` (trainees primeiro) |

`etapa`: `{ id, titulo, tipo: 'leitura'|'fato', fato? ('dados'|'termo'|'treinamentos'), ancora (a etapa do tour.html), feita, feita_em }`.
Etapa de fato não tem botão: ela fica feita quando o SOMA confere o fato.
