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

## 15.0 e 16.0 — a fase das atividades

| Arquivo | O que faz |
|---|---|
| `v15_atividades.sql` | o quadro de trabalho por grupo, os grupos como tabela, as notificações, a edição de marcos e ausências — e a trava do **quadro reservado** |
| `v16_pessoal.sql` | solicitação, apontamento e ocorrência viram cartão no quadro do Pessoal; a decisão concede acesso na mesma transação; notificação por e-mail |
| `v17_grupos_acesso.sql` | nível por pessoa em cada quadro (nenhum/leitura/edicao), acessos concedidos, e a tela de Grupos: renomear, fundir e conceder |
| `v18_teste_email.sql` | o aviso de teste de e-mail sob demanda, e a exceção que o faz sair mesmo para quem escolheu resumo ou "só no portal" |

**Aplique nesta ordem**, e as duas são idempotentes: rodar de novo não
duplica nada.

Duas coisas que valem saber antes de rodar:

- a 15.0 **semeia os grupos** a partir de `membros.grupos` e dá um prefixo a
  cada um. O prefixo entra no código de toda atividade (`ORT-14`) e **não muda
  retroativamente**. Confira antes de a equipe começar a usar:
  `select id, nome, prefixo from public.grupos order by nome;`
- a 16.0 escolhe **qual grupo é o do Depto de Pessoal** (procura por "pessoal"
  ou "pessoas" no nome; não achando, cria um). Confira:
  `select id, nome, prefixo, reservado from public.grupos where chave = 'pessoal';`

A **17.0** corrige, além do que ela traz de novo, três funções da 15.0 que
escreviam sem checar grupo nenhum (`atividade_comentar`, `atividade_sinalizar`,
`atividade_seguir`). Como são `security definer`, elas passavam por cima da RLS.
Os corpos corrigidos estão nas duas migrações, idênticos: a 15.0 serve a quem
instala do zero, a 17.0 a quem já tinha a 15.0 aplicada. Rodar qualquer uma, em
qualquer ordem, chega no mesmo lugar.

Pelo mesmo motivo, a 15.0 **deixou de redefinir `sou_do_grupo`** quando a 17.0
já passou: essa função passou a enxergar os acessos concedidos, e a 15.0
sobrescrevendo-a apagaria todos eles em silêncio.

O quadro reservado nasce na **15.0**, e não na 16.0, de propósito: se as duas
definissem a política de leitura, rodar a 15.0 de novo — coisa que ela diz ser
segura — devolvia o quadro do Pessoal para "todo mundo lê", em silêncio. Cada
coisa tem uma dona só.

Os testes das duas estão em [`testes/`](testes/), e rodam em PostgreSQL de
verdade — não em banco de mentira:

```bash
createdb t16
psql -d t16 -f testes/esqueleto.sql
psql -d t16 -f v15_atividades.sql
psql -d t16 -f v16_pessoal.sql
psql -d t16 -f testes/v16_comportamento.sql   # 33 asserções
psql -d t16 -U <papel não-superusuário> -f testes/v16_rls.sql
```

O `v16_rls.sql` precisa rodar como um papel **sem** superusuário (e sem ser
dono das tabelas): RLS não vale para quem tem `BYPASSRLS`, e um teste de RLS
rodado como `postgres` passa sempre, sem provar nada.

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
