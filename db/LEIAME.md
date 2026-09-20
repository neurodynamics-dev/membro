# Banco — migrações do SOMA

Uma linha só de migrações, para um banco só. O SOMA · Gestão e o Portal do
Membro sempre usaram o mesmo projeto Supabase (`rxzmkyjttzzpwtodqkve`); o que
mudou na versão 14.0 é que agora isso está escrito em algum lugar.

## Como aplicar

No SQL Editor do Supabase, na ordem numérica, cada arquivo uma vez. Depois da
14.0, o banco responde sozinho o que já rodou:

```sql
select id, aplicada_em from public.migracoes order by id;
```

Migração nova termina inserindo a própria linha em `migracoes` — siga o rodapé
da `v14_unificacao.sql` como modelo.

## A colisão de numeração (e por que os nomes são estes)

Até a 13.0, as migrações eram escritas em **dois repositórios ao mesmo tempo**,
sem que um soubesse do outro. O resultado foi que as versões 10 a 13 existem em
duplicata, com conteúdos completamente diferentes e o mesmo número:

| Número | No `nro-pessoal` era | No `membro` era |
|---|---|---|
| 10.0 | apontamento semanal | portal: avisos, solicitações, ouvidoria |
| 11.0 | FAQ do processo seletivo | portal: biblioteca de documentos |
| 12.0 | dinâmica em grupo | portal: agenda e Google Calendar |
| 13.0 | site institucional em três idiomas | agenda unificada |

Os oito arquivos foram aplicados no mesmo banco — funcionaram porque tocavam
tabelas diferentes, não porque o esquema estivesse coerente. Olhando um arquivo
chamado `soma_v12.sql`, não dava para saber qual dos dois era.

Em `aplicadas/`, cada um carrega no nome o assunto que trata, então a ambiguidade
acaba. **O conteúdo não foi alterado** — são o registro do que já rodou, e ficam
congelados.

## O que tem aqui

```
db/
├── LEIAME.md                          este arquivo
├── v14_unificacao.sql                 ← a próxima a aplicar
└── aplicadas/                         história, congelada
    ├── soma_v06_selecao.sql                 processo seletivo
    ├── soma_v07_selecao_slots.sql           agendamento das etapas
    ├── soma_v08_okrs.sql                    OKRs
    ├── soma_v09_site.sql                    site institucional
    ├── soma_v10_apontamento.sql             apontamento semanal
    ├── soma_v10_portal.sql                  portal: avisos e solicitações
    ├── soma_v11_ps_faq.sql                  seleção: FAQ
    ├── soma_v11_portal_documentos.sql       portal: documentos
    ├── soma_v12_ps_dinamica.sql             seleção: dinâmica em grupo
    ├── soma_v12_portal_agenda.sql           portal: agenda e Google
    ├── soma_v13_site_idiomas.sql            site em três idiomas
    └── soma_v13_agenda_unificada.sql        agenda unificada
```

As migrações de 1.0 a 5.0 são anteriores a estes repositórios e não estão
versionadas em lugar nenhum. Elas criaram o núcleo que tudo usa — `perfis`,
`membros`, `eventos`, `avaliacoes`, `auditoria`, `itens_de_acesso` — e por isso
não constam do registro retroativo da 14.0: não dá para afirmar o que cada uma
fez. Um `pg_dump --schema-only` do projeto é a única descrição fiel do que
existe hoje, e vale guardar um ao lado deste arquivo na próxima oportunidade.

## Sobre as cópias que ainda estão no `nro-pessoal`

Os quatro arquivos vindos de lá (`soma_v06` a `soma_v13_site_idiomas`) também
continuam na raiz daquele repositório, com os nomes antigos, **até a fase de
corte da unificação** — os READMEs de lá ainda os citam, e quebrar aquelas
referências no meio da migração não ajudaria ninguém. Como são arquivos
congelados, não há risco de divergirem. Quando o `nro-pessoal` virar repositório
de redirecionamento, ficam só estes aqui.
