# Contrato do LABBIO

Migrações: `db/2.19.1_labbio_base.sql` (L1, identidade) e
`db/2.19.1_labbio_acesso.sql` (L5, pedido de biometria). Testes:
`db/testes/2.19.1_labbio.sql` e `db/testes/2.19.1_labbio_acesso.sql`.
Stub de navegador: bloco "2.19.1: gestores do LABBIO" em
`testes/stub-supabase.js`, ligado por `window.__teste.labbio` (opções no
comentário do bloco).

## A regra que a tela precisa respeitar

Uma conta de gestor do LABBIO ("conta externa") **só** consegue chamar
funções `labbio_*`. Qualquer outra chamada (tabela, `conta_ativa`,
`papeis_atuais`, `perfis`...) volta erro `42501` com a mensagem "Esta conta
é do painel do LABBIO e não acessa o portal da equipe." Por isso:

- o painel `/labbio` só chama `labbio_*`;
- o portal (`index.html`) chama `labbio_eu` **antes** de qualquer outra
  coisa ao abrir uma sessão e, se a conta for externa, manda para `/labbio/`.

## Identidade (L1)

| RPC | Quem | Devolve |
|---|---|---|
| `labbio_eu()` | qualquer conta logada | `{ status: 'ok', gestor }` (ativo) · `'convidado'` · `'revogado'` · `'nao_gestor'` (conta de membro) · `'sem_sessao'` |
| `labbio_gestores_lista()` | admin do SOMA ou gestor ativo | `{ status, gestores: [gestor] }` (ativos e convidados primeiro, revogados no fim) |
| `labbio_convidar(p_email, p_nome)` | admin ou gestor ativo | `{ status, id }`; motivos `email_invalido`, `nome_obrigatorio`, `email_de_membro`, `ja_ativo` |
| `labbio_aceitar(p_token)` | a conta logada com o e-mail do convite | `{ status, gestor }`; motivos `invalido`, `usado`, `expirado`, `email_diferente`, `conta_de_membro`, `sem_sessao` |
| `labbio_principal(p_id)` | admin ou o principal atual | `{ status }`; `invalido` se o alvo não está ativo |
| `labbio_revogar(p_id, p_motivo)` | admin ou o principal | `{ status }`; `transfira_antes` (é o principal e há outros ativos) |

`gestor`:
```json
{ "id": "uuid", "nome": "Gestora Um", "email": "gestora@labbio.test", "situacao": "ativo",
  "principal": true, "convidado_em": "...", "aceito_em": "...", "revogado_em": null,
  "revogado_motivo": null, "ultimo_acesso": "...", "tem_conta": true, "convidado_por": "Ana Figueiredo" }
```

O e-mail do convite leva o link `https://membro.neurodynamics.dev/labbio/#/aceitar?c=<token>`
(48 caracteres hexadecimais). O token nunca passa pela tela de quem convida.

## Pedido de biometria (L5)

Lado do **membro** (portal, `#/servicos/biometria`):

| RPC | Devolve |
|---|---|
| `labbio_pedido_meu()` | `{ status, tem_acesso, dados (campos do LABBIO + nome + confirmado_em, ou null se os dados não foram conferidos nos últimos 180 dias), campos: [...], pedido (ou null) }` |
| `labbio_pedido_criar(p_justificativa, p_tempo)` | `{ status, pedido }`; motivos `ja_existe` (devolve o aberto), `ja_tem_acesso`, `invalido` + `campo` |
| `labbio_pedido_enviar(p_id, p_versao, p_foto_path, p_justificativa?, p_tempo?)` | `{ status, pedido }`; motivos `foto_pendente`, `dados_pendentes`, `conflito`, `encerrado` |
| `labbio_pedido_cancelar(p_id)` | `{ status }` |

Foto: suba **antes** de enviar, no bucket `biometria`, caminho
`<registro>/<pedido.id>/<pedido.versao>.jpg` (ou `.png`), JPEG ou PNG até 5 MB.

Lado do **Pessoal** (no SOMA): a triagem de sempre já funciona ("Aprovar"
encaminha). Para ver os dados e a foto: `labbio_pedido_ler(p_id)`. Ações
diretas: `labbio_pedido_pessoal(p_id, p_versao, 'encaminhar'|'negar'|'devolver', p_motivo)`.

Lado do **LABBIO** (`/labbio`):

| RPC | Devolve |
|---|---|
| `labbio_solicitacoes(p_situacao 'abertos'\|'encerrados'\|'todos')` | `{ status, pedidos: [pedido] }` (só os que o Pessoal encaminhou) |
| `labbio_pedido_ler(p_id)` | `{ status, pedido }` |
| `labbio_pedido_decidir(p_id, p_versao, 'implantado'\|'negar'\|'devolver', p_motivo)` | `{ status, pedido }`; `motivo_obrigatorio` para negar e devolver; `conflito` com versão velha |

`pedido`:
```json
{ "id": "uuid", "registro": 11, "nome": "Bruno Tavares", "protocolo": "SOL-0042",
  "etapa": "rascunho|pessoal|labbio|concedido|devolvido|negado_pessoal|negado_labbio|cancelado",
  "versao": 2, "devolvido_por": "labbio", "justificativa": "...", "tempo": "...",
  "encaminhado_em": "...", "criado_em": "...", "atualizado_em": "...",
  "enviada": { "versao": 2, "dados": { "nome_civil": "...", "cpf": "...", "matricula": "...", "nome": "...", "confirmado_em": "..." },
               "foto_path": "11/<id>/2.jpg", "enviada_em": "..." },
  "eventos": [ { "versao": 1, "de": "rascunho", "para": "pessoal", "ator": "membro|pessoal|labbio",
                 "ator_nome": "...", "motivo": null, "quando": "..." } ] }
```

A foto se abre com `sb.storage.from('biometria').createSignedUrl(foto_path, 120)`.

## Consultas do painel (L3)

Todas exigem gestor ativo; senão `{ status: 'sem_permissao' }`.

| RPC | Devolve |
|---|---|
| `labbio_inicio()` | `{ status, membros, com_acesso, pedidos_abertos, revogacoes: [{ id, registro, nome, status_para, criada_em }] }` |
| `labbio_membros(p_busca default null)` | `{ status, membros: [pessoa] }` (ativos e quem tem revogação pendente; busca por nome ou registro) |
| `labbio_membro(p_registro)` | `{ status, membro: pessoa, liderados: [{ registro, nome }], pedidos: [pedido], revogacoes: [...] }`; `nao_encontrado` |
| `labbio_checkins(p_de, p_ate, p_registro?, p_origem? 'quiosque'\|'folha', p_pagina default 1)` | `{ status, pagina, por_pagina: 50, total, itens: [{ registro, nome, registrado_em, origem }] }`; `invalido` se o período é invertido ou passa de 366 dias |
| `labbio_treinamentos()` | `{ status, treinamentos: [{ id, codigo, titulo, categoria, revisao, validade_meses }], pessoas: [{ registro, nome, area, celulas: { <treinamento id>: { situacao, obrigatorio, concluido_em, revisao, vence_em } } }] }` |
| `labbio_revogacoes(p_abertas default true)` | `{ status, revogacoes: [{ id, registro, nome, status_de, status_para, criada_em, confirmada_em, observacao, confirmada_por }] }` |
| `labbio_revogacao_confirmar(p_id, p_observacao?)` | `{ status }` (tira o acesso da ficha) |

`pessoa`:
```json
{ "registro": 11, "nome": "Bruno Tavares", "foto_url": null, "email_nro": "...", "email_pessoal": "...",
  "telefone": "...", "status": "Ativo", "cargo": "...", "area": "...", "trainee": false,
  "gestor": 4, "gestor_nome": "Ana Figueiredo",
  "termo": { "situacao": "sem_campanha|pendente|enviado|conferido|devolvido", "enviado_em": null, "conferido_em": null,
             "arquivo": "labbio-2026/11/<uuid>.pdf (só se enviado ou conferido)" },
  "acesso": { "estado": "possui|solicitado|nao_possui", "sub": "revogacao_pendente|pessoal|labbio|devolvido|null", "desde": "2026-10-11" } }
```

- Situação do treinamento (`treinamento_situacao`): `concluido`, `andamento`,
  `pendente`, `nova_revisao`, `vencido` ou `null` (não publicado).
  `obrigatorio`: `true`, `false` (opcional) ou `null` (não atribuído).
- O termo assinado abre com `sb.storage.from('termos').createSignedUrl(arquivo, 120)`
  (em nova guia).
- Revogação pendente nunca notifica ninguém: só aparece no início do painel.
