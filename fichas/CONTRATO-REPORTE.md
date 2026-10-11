# Contrato do reporte por liderança direta (R1, pronto)

Migração: `db/2.19.1_reporte.sql`. Teste: `db/testes/2.19.1_reporte.sql`
(70 asserções + as 18 do modelo antigo). Stub de navegador: bloco
"2.19.1: reporte por liderança direta" em `testes/stub-supabase.js`,
ligado por `window.__teste.reporteLider` (opções no comentário do bloco).

Toda RPC devolve `{ status: 'ok', ... }` ou `{ status: '<motivo>' }`.
Motivos comuns: `sem_permissao`, `conflito` (versão velha), `encerrado`
(enviado ou sprint seguinte já aberta), `invalido`, `incompleto`,
`nao_encontrado`. A função `repRPC` de `mod-reporte.js` já transforma os
motivos em mensagem; acrescente lá os novos (`justificativa_obrigatoria`,
`duplicado`, `modelo_anterior`).

## Regras de tempo (o servidor decide; a tela só mostra)

- Ciclo = semana da sprint (segunda a domingo). `ciclo.prazo` = sexta 16h,
  a reunião da gerência. `ciclo.fecha_em` = segunda 0h seguinte.
- Antes do `prazo`: editar e enviar normalmente.
- Entre `prazo` e `fecha_em`: ainda pode editar e enviar; o envio volta
  `atrasado: true`.
- Depois de `fecha_em`: só leitura (`encerrado`).

## `reporte_meu(p_ciclo uuid default null)`

Abre (cria, se preciso) o reporte do líder logado na semana atual.

```json
{
  "status": "ok",
  "ciclo": { "id": "uuid", "semana": "2026-10-05", "modelo": "lider",
             "prazo": "2026-10-09T19:00:00+00:00", "reuniao_em": "2026-10-09T19:00:00+00:00",
             "fecha_em": "2026-10-12T03:00:00+00:00", "fechado": false },
  "reporte": {
    "id": "uuid", "ciclo_id": "uuid", "autor": 42, "modelo": "lider", "etapa": 1, "versao": 3,
    "enviado_em": null, "atrasado": false, "atualizado_em": "...",
    "pessoas": [
      { "registro": 23, "nome": "Diego Prado", "cargo": null, "origem": "direto", "justificativa": null },
      { "registro": 11, "nome": "Bruno Tavares", "cargo": null, "origem": "excepcional",
        "justificativa": "Apoia o projeto de sinais neste mês" }
    ],
    "apontamentos": [
      { "registro": 23, "entregas": "SUFICIENTE", "assiduidade": "SUFICIENTE", "sinalizacao": null },
      { "registro": 11, "entregas": "INSUFICIENTE", "assiduidade": "SUFICIENTE",
        "sinalizacao": { "relato": "Combinamos a entrega na terça e não veio", "conversa_confirmada": true } }
    ],
    "escalonamentos": [ { "texto": "Falta verba", "atividade_id": "uuid opcional", "codigo": "ORT-1 (só da tela)" } ]
  },
  "feed": [ { "id": "uuid", "titulo": "...", "subtitulo": "...", "texto": "...", "imagem_path": null, "publicado_em": null } ],
  "mudancas": null
}
```

- `mudancas` só vem antes do envio, quando a cadeia mudou desde a abertura:
  `{ "entram": [pessoa...], "saem": [pessoa...] }`.
- `reporte: null` quando a sprint seguinte já abriu e o líder não abriu o
  reporte desta semana.
- `{ status: 'modelo_anterior', ciclo }`: a semana ainda é do modelo por
  frente (antes da ativação). A tela mostra a lista antiga (ver R3).
- `pessoas` vazia: líder sem liderados (pode escalonar e divulgar).

## Edição

| RPC | Argumentos | Devolve |
|---|---|---|
| `reporte_salvar` | `{ p: { id, versao, etapa (1..3), apontamentos, escalonamentos, feed } }` | `{ status, versao }` |
| `reporte_participante` | `{ p_id, p_versao, p_registro, p_justificativa, p_incluir }` | `{ status, versao }`; motivos `justificativa_obrigatoria`, `duplicado`, `invalido` |
| `reporte_cadeia_atualizar` | `{ p_id, p_versao }` | `{ status, versao }` (aceita `mudancas`) |
| `reporte_enviar` | `{ p_id, p_versao }` | `{ status, atrasado }`; `incompleto` se `etapa ≠ 3` ou alguém sem apontamento |

- `apontamentos[]` tem exatamente uma linha por pessoa de `pessoas`.
- `sinalizacao` é `null` ou `{ relato (texto não vazio), conversa_confirmada: true }`.
  Sem `conversa_confirmada: true` o banco devolve `invalido`.
- Insuficiente não é sinalização: são campos separados.
- Depois de cada RPC de edição, guarde a `versao` nova.

## Cobrança

| RPC | Devolve |
|---|---|
| `reporte_cobranca_estado()` | `{ status: 'nenhuma' \| 'aviso' \| 'obrigatoria', ciclo_id, prazo, fecha_em, agora, motivo? }` |
| `reporte_ausente(p_ciclo)` | `{ status }` (resolve a cobrança sem avaliar ninguém) |

- `aviso`: sexta 7h–16h, reporte não enviado. Pop-up dispensável.
- `obrigatoria`: depois de sexta 16h até o envio ou "Estive ausente".
- Férias ou afastamento no instante do prazo: `nenhuma`, `motivo: 'ausencia'`.

## Consolidado (admin e NRO_MANAGERS)

| RPC | Devolve |
|---|---|
| `reporte_consolidado_pode()` | `boolean` |
| `reporte_lider_painel(p_ciclo default null)` | `{ status, ciclo, config, lideres: [{ registro, nome, reporte_id, enviado_em, atrasado, situacao: 'enviado'\|'ausente'\|'ferias'\|'pendente' }] }` |
| `reporte_unificado(p_ciclo)` | modelo líder: `{ status, modelo:'lider', gerado_em, ciclo, cobertura: { lideres, enviados, atrasados, ausentes, pendentes }, apontamentos: [{ registro, nome, lider, lider_nome, entregas, assiduidade, sinalizado, relato }], escalonamentos: [{ lider_nome, texto, atividade_codigo, atividade_titulo, responsavel_nome }], atrasados: [{ codigo, titulo, responsavel_nome, prazo, dias, status }], feed: [{ titulo, subtitulo, autor, publicado_em }] }`. Modelo antigo: `{ modelo:'frente', painel, reportes, ... }` como na 2.18 |
| `reporte_avaliacoes_de(p_registro, p_limite default 26)` | `{ status, itens: [{ semana, autor, autor_nome, entregas, assiduidade, origem, sinalizado }] }` (admin, pessoal, liderança) |
| `reporte_configurar({ p })` | `p`: `dia_prazo, hora_prazo, dia_reuniao, hora_reuniao` e opcional `modelo_lider_desde` (data). Dias: 0 = segunda … 4 = sexta |

`apontamentos` do consolidado já vem filtrado: só quem teve insuficiência
em qualquer dimensão ou sinalização.

## Efeitos que a tela NÃO faz (o banco faz no envio)

Gravar na ficha, criar cards no PMO / Pessoal / Coord. Office, publicar o
feed, resolver a cobrança. A tela só explica, antes de enviar, o que vai
acontecer.
