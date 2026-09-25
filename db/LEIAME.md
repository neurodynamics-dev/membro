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
├── v14_unificacao.sql … v27_cofre.sql  as migrações, em ordem
├── testes/                            os testes, em PostgreSQL de verdade
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
| `v19_grupos_hierarquia.sql` | grupos dentro de grupos: pai único, pertença que sobe pela árvore (`esta_no_grupo`), grupo sem quadro, responsáveis por grupo, pôr e tirar várias pessoas de uma vez |
| `v20_projetos_arquivos.sql` | projetos (grupo dentro de `NRO_PROJECTS`, supervisor, logo) e o controle de arquivos: séries `NRO-XXX-YYY`, PNs, revisões que só valem depois de aprovadas pelo grupo revisor, templates, relações pai/filho, padrão de projeto e o bucket privado `arquivos` |
| `v21_rol_nro_pub_001.sql` | o rol inicial: as 46 linhas da planilha NRO-PUB-001 viram séries, com os sete emissores (um por aba; CLI e REL ainda sem linhas) e um padrão de projeto proposto |
| `v22_estrutura_das_series.sql` | a estrutura de cada série pela coluna nova da NRO-PUB-001 — documento único, template → documentos ou template → registros —, 18 séries ajustadas, e a mudança de estrutura no registro de alterações |
| `v23_studio.sql` | o Studio: publicações `POST-N` (ideia → produção → aprovação → pronta → publicada), aprovação pelo grupo aprovador com versão, histórico, o lembrete da véspera por e-mail (pg_cron), os recursos de imagem, a imprensa do site (`site_imprensa_publico`) e o bucket privado `studio` |
| `v24_treinamentos.sql` | os treinamentos: `NRO-TRE-XXX` com revisão (Rev. A, B…), módulos em Markdown com verificação de conhecimento (uma correta, várias, V ou F) corrigida no banco — o gabarito não desce —, atribuição a grupos (obrigatório ou opcional), progresso que aproveita o que não mudou entre revisões, conclusão com certificado `CERT-XXXX-XXXX`, validade, o aviso a quem deve, o README de conteúdo e o prefixo `TRE` reservado em Arquivos |
| `v25_documentos_eventos.sql` | os documentos que o SOMA emite: `doc_emitidos` (código verificador `XXXX-XXXX-XXXX`, código de controle, a fotografia do que foi impresso, a revogação), a validação pública `doc_validar()` — a única porta aberta à chave anônima —, a declaração de vínculo sob demanda (`NRO-DIR-004`, o PN é o registro), os eventos registrados `EXT-N` com aprovação por grupos e versão, a declaração de participação (`NRO-DIR-006`, o PN é o evento), a fila de e-mails `doc_envios` e as séries cujos PNs não moram no rol (`doc_series.pn_origem`) |
| `v26_formularios.sql` | escrever o registro no portal: o formulário da série (`doc_series.formulario`), o rascunho por PN, o envio que gera a revisão pendente com os dados, a conferência da definição no banco, e os dois formulários que já vêm — a ata de reunião (`NRO-PUB-003`) e o relatório de execução de teste (`NRO-PRO-003`) |
| `v27_cofre.sql` | o cofre: as contas de cada acesso do catálogo, com a senha, a anterior, o segredo do 2FA e as notas no **Vault**; quem usa (grupos e acesso concedido) e quem mantém; o código de duas etapas (TOTP, RFC 6238) calculado no banco; o registro de uso; a troca periódica com o lembrete (pg_cron) e a senha exposta por quem saiu |

**Aplique nesta ordem**, e todas são idempotentes: rodar de novo não
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

A **19.0** passa a ser a dona de `meu_nivel_no_grupo` e da view
`grupos_visiveis`: estar num grupo abaixo conta como estar no grupo, e grupo
sem quadro sai da lista de Atividades. A 17.0 continua podendo rodar de novo —
as duas definições dela agora só valem enquanto a 19.0 não passou (o mesmo
cuidado da 15.0 com `sou_do_grupo`). O teste da 19.0 roda a 17.0 de novo no
meio e confere que a herança continua lá.

A **20.0** acha sozinha o pai dos projetos: adota o grupo que já se chame
`NRO_PROJECTS` (ou "Projetos") e, não achando, cria um, sem quadro. O **PMO**
ela não cria nem adivinha — é escolhido em *Arquivos → Configurações → PMO e
projetos*; enquanto não houver, só `admin` administra a documentação. Confira:
`select id, nome, chave from public.grupos where chave in ('projetos', 'pmo');`
A parte do Storage — o bucket privado `arquivos`, até 50 MB por arquivo, e as
políticas em `storage.objects` — só roda onde o schema `storage` existe: no
Supabase, sempre.

A **21.0** é a planilha. O que estava EM VIGÊNCIA entra ativo, com a Rev. A
aprovada e marcada como importada — sem o arquivo, que continua no Drive até
alguém anexá-lo pela tela; o resto entra em rascunho. O que a planilha tinha
de estranho (INEXISTENTE, o EDITAL sem classificação, o termo de abertura
como registro) fica escrito na descrição de cada série, e o cabeçalho do
arquivo explica cada decisão. Rodar de novo não muda nada: ela só semeia a
série que ainda não existe.

A **22.0** é a coluna que a planilha ganhou ao lado do título. Ela diz, em
três frases, o que cada série é — e é isso que o banco guarda em `tipo` e
`multiplo`:

| Na coluna | No banco | A cabeça (sem PN) | Cada PN |
|---|---|---|---|
| "um documento para toda a equipe, sem template e sem filhos" | documento, sem PN | o próprio documento, que revisa | — |
| "um template, cada pn é um documento filho da série" | documento, com PN | o template, que revisa | um documento, que revisa |
| "um template, cada pn é um registro filho da série" | registro, com PN | o template, que revisa | um registro, que não muda depois de aprovado |

A 21.0 tinha tirado o tipo da coluna TIPO; a coluna nova discorda dela em
18 séries, e vale a coluna. O cabeçalho da 22.0 lista quais. O que já
existe não se perde: série que viraria documento único mas já tem PN (ou
está no padrão de projeto) fica como estava, série cujos PNs já são
documentos não vira de registros, e o PN que era registro e vira documento
tem a versão que já tinha chamada de Rev. A. Cada mudança entra no registro
de alterações do arquivo — daqui em diante, também quando o PMO muda a
estrutura de uma série pela tela (um gatilho em `doc_series`). O NRO-PUB-002
veio com a coluna vazia e fica como está: template avulso.

A **23.0** é o Studio. Ela procura um grupo de comunicação ("Marketing",
"Comunicação", "MKT") e, achando, o põe como **grupo de acesso**; os
**aprovadores** ela não escolhe — é em *Studio › Configurações*. Enquanto não
houver grupo aprovador, quem aprova é `admin`. Confira:
`select grupos_acesso, grupos_aprovadores from public.studio_config;`

Três coisas que valem saber:

- **o lembrete da véspera** é agendado no `pg_cron` pela própria migração,
  de hora em hora das 8h às 20h de Brasília — **se o Cron já estiver
  ligado** (Integrations → Cron, o mesmo do `notificar-email`). Sem ele, a
  migração avisa e o lembrete sai quando alguém abre o Studio. Ligou depois?
  Rode a 23.0 de novo. Confira:
  `select jobname, schedule from cron.job where jobname = 'studio-lembretes';`
- **a dona de `notificacoes_email_lote()` passa a ser a 23.0**: o lembrete
  entra na mesma exceção do e-mail de teste (sai mesmo para quem escolheu
  resumo ou "só no portal"). Por isso a 16.0 e a 18.0 só definem essa função
  enquanto a migração seguinte não passou — rodar qualquer uma de novo não
  apaga a exceção. (Antes, rodar a 16.0 de novo apagava a do e-mail de teste,
  em silêncio.)
- **a imprensa** vem com o que o site tinha escrito no código (seis vídeos e
  três matérias), só com a tabela vazia. Daí em diante, o site institucional e
  o do processo seletivo leem do banco, e a edição é pelo Studio.

A **24.0** são os treinamentos. Ela não escolhe ninguém para gerir: além de
`admin` e do papel `pessoal`, geram os grupos escolhidos em *Treinamentos ›
Configurações* — e quem entra nessa lista, só `admin` e o Depto. de Pessoal
decidem (um gatilho confere). Confira:
`select grupos_gestores, nota_minima, readme is null as readme_padrao from public.treinamento_config;`

Três coisas que valem saber:

- **o gabarito não desce.** `treinamento_revisoes` (o conteúdo, com as
  respostas) só quem gere lê. Quem faz o treinamento lê por
  `treinamento_conteudo()`, sem as respostas, e quem corrige é
  `treinamento_responder()`. Progresso, conclusão e certificado nascem de
  funções: as tabelas não têm política de escrita;
- **o README de conteúdo** começa vazio de propósito: vazio, vale o padrão que
  mora no portal (`mod-treinamentos.js`), ao lado do leitor do formato. Só a
  versão que a equipe escrever mora aqui;
- **o prefixo `TRE`** fica reservado em `doc_emissores` (uma restrição
  `not valid`, que não confere o que já existe): um emissor TRE em Arquivos
  daria à equipe dois `NRO-TRE-003` diferentes. Se já houver um, a migração
  avisa e não cria a restrição. Sem a 20.0, a parte é pulada.

A **25.0** são os documentos emitidos e os eventos. Ela acha a série da
declaração de vínculo (a `NRO-DIR-004`, que a 21.0 trouxe como "DECLARAÇÃO DE
MEMBRO"), dá a ela o nome do modelo em uso e a marca: os PNs dela não moram
mais no rol — o PN é o registro do membro, e o banco não aceita PN novo nela.
A de participação ela cria, no próximo SN livre da Diretoria. Quem aprova os
eventos começa sendo o Depto. de Pessoal, e são duas aprovações. Confira:
`select * from public.doc_emissao_config;` e
`select grupos_aprovadores, aprovacoes_minimas from public.eventos_ext_config;`

Três coisas que valem saber:

- **a validação pública** é `doc_validar(código)`, com `execute` para `anon`:
  é o que o `auth.neurodynamics.dev` chama. Ela devolve o que foi impresso,
  com o CPF mascarado, e conta a consulta. Nenhuma tabela da 25.0 se lê
  direto pela chave anônima;
- **o e-mail das declarações** sai pela Edge Function `notificar-email`, que
  passa a ler também a fila `doc_envios` — **publique a função de novo**
  depois de aplicar a 25.0. Membro recebe também no sino, já marcado como
  enviado por e-mail, para não receber dois;
- **o código verificador** tem 60 bits sorteados (`gen_random_uuid`), em
  Crockford base32: adivinhar um código que existe é inviável — é isso que
  deixa a validação ser pública. O código de controle é o SHA-256 do que foi
  impresso, com a hora em UTC.

A **26.0** é escrever o registro no portal. Os dois formulários que ela traz
só entram na série que ainda não tem um — rodar de novo não desfaz o que o
PMO mudou. Precisa da 25.0 (série cujos PNs não moram no rol não ganha
formulário). Confira:
`select prefixo, sn, formulario->>'titulo', jsonb_array_length(formulario->'campos') from public.doc_series where formulario is not null;`

A **27.0** é o cofre. Precisa do **Vault** do Supabase ligado (*Database →
Extensions → supabase_vault*; em geral já vem, e é o mesmo em que a chave do
agendamento do `notificar-email` mora) — sem ele, a migração para e diz onde
ligar. O que é segredo não fica em tabela nenhuma: `cofre_credenciais` guarda
só o identificador no Vault. Quem **gere** o cofre, além de `admin`, são os
grupos que `admin` escolher — e só `admin` muda essa lista (um gatilho
confere); o Depto. de Pessoal não gere o cofre por ser Depto. de Pessoal. O
lembrete da troca é agendado no `pg_cron` (todo dia às 8h de Brasília), se o
Cron estiver ligado; sem ele, sai quando alguém abre o cofre. Confira:
`select grupos_gestores, rotacao_padrao_dias, aviso_dias, anterior_dias from public.cofre_config;`

**O que o SQL Editor responde.** O editor do Supabase mostra só o último
resultado que tem linhas. As migrações até a 20.0 terminam em *Success. No
rows returned*. A 21.0 termina com a tabela **"o que a 21.0 deixou"**: sete
linhas (migração registrada, 7 emissores, 46 séries, a conta por emissor, 29
ativas, 17 em rascunho, 12 no padrão de projeto), todas `ok` numa primeira
execução. A 22.0 termina com uma linha por série que a coluna mudou (ou que
ficou como estava, e por quê), uma linha "27 séries · já estavam como a
coluna diz" e o NRO-PUB-002 — rodada de novo, as 45 já estão como a coluna
diz. Se aparecer um erro em vermelho, nada foi gravado: o editor roda o
arquivo inteiro numa transação só.

Os testes estão em [`testes/`](testes/), e rodam em PostgreSQL de
verdade — não em banco de mentira:

```bash
createdb t16
psql -d t16 -f testes/esqueleto.sql
psql -d t16 -f v15_atividades.sql
psql -d t16 -f v16_pessoal.sql
psql -d t16 -f testes/v16_comportamento.sql   # 33 asserções
psql -d t16 -U <papel não-superusuário> -f testes/v16_rls.sql

# 17.0 a 19.0, no mesmo banco
psql -d t16 -f v17_grupos_acesso.sql -f v18_teste_email.sql -f v19_grupos_hierarquia.sql
psql -d t16 -f testes/v17_acesso.sql          # 29 asserções
psql -d t16 -f testes/v18_teste_email.sql     # 12 asserções
psql -d t16 -f testes/v19_grupos.sql         # 48 asserções (roda a 17.0 e a 19.0 de novo no meio)

# 20.0, num banco novo: o teste da 19.0 deixa um NRO_PROJECT_NEBULA que o da 20.0 quer criar
createdb t20
psql -d t20 -f testes/esqueleto.sql -f testes/esqueleto_storage.sql
psql -d t20 -f v15_atividades.sql -f v16_pessoal.sql -f v17_grupos_acesso.sql \
            -f v18_teste_email.sql -f v19_grupos_hierarquia.sql -f v20_projetos_arquivos.sql
psql -d t20 -f testes/v20_arquivos.sql       # 114 asserções (RLS e Storage inclusos; roda a 20.0 de novo no meio)

# 21.0, também num banco novo: o teste confere a planilha linha a linha
createdb t21
psql -d t21 -f testes/esqueleto.sql -f testes/esqueleto_storage.sql
psql -d t21 -f v15_atividades.sql -f v16_pessoal.sql -f v17_grupos_acesso.sql \
            -f v18_teste_email.sql -f v19_grupos_hierarquia.sql -f v20_projetos_arquivos.sql \
            -f v21_rol_nro_pub_001.sql
psql -d t21 -f testes/v21_rol.sql            # 16 asserções

# 22.0, sobre um banco com a 21.0 e ainda sem a 22.0: o teste prepara PNs que
# ela precisa respeitar e roda a 22.0 no meio (e de novo, no fim)
createdb t22
psql -d t22 -f testes/esqueleto.sql -f testes/esqueleto_storage.sql
psql -d t22 -f v15_atividades.sql -f v16_pessoal.sql -f v17_grupos_acesso.sql \
            -f v18_teste_email.sql -f v19_grupos_hierarquia.sql -f v20_projetos_arquivos.sql \
            -f v21_rol_nro_pub_001.sql
psql -d t22 -f testes/v22_estrutura.sql      # 39 asserções

# 23.0, num banco novo: o Studio não depende da 20.0 à 22.0
createdb t23
psql -d t23 -f testes/esqueleto.sql -f testes/esqueleto_storage.sql
psql -d t23 -f v15_atividades.sql -f v16_pessoal.sql -f v17_grupos_acesso.sql \
            -f v18_teste_email.sql -f v19_grupos_hierarquia.sql -f v23_studio.sql
psql -d t23 -f testes/v23_studio.sql         # 90 asserções (RLS e Storage inclusos; roda a 23.0, a 18.0 e a 16.0 de novo no fim)
```

```bash
# 24.0, num banco novo: os treinamentos não dependem do Studio; a 20.0 entra
# para o teste conferir que o emissor TRE fica reservado
createdb t24
psql -d t24 -f testes/esqueleto.sql -f testes/esqueleto_storage.sql
psql -d t24 -f v15_atividades.sql -f v16_pessoal.sql -f v17_grupos_acesso.sql \
            -f v18_teste_email.sql -f v19_grupos_hierarquia.sql -f v20_projetos_arquivos.sql \
            -f v24_treinamentos.sql
psql -d t24 -f testes/v24_treinamentos.sql   # 117 asserções (RLS inclusa; roda a 24.0 de novo no fim)
```

```bash
# 25.0 a 27.0: cada uma num banco novo, sobre a mesma base (a 15.0 à 24.0)
createdb tbase
psql -d tbase -f testes/esqueleto.sql -f testes/esqueleto_storage.sql
psql -d tbase -f v15_atividades.sql -f v16_pessoal.sql -f v17_grupos_acesso.sql \
              -f v18_teste_email.sql -f v19_grupos_hierarquia.sql -f v20_projetos_arquivos.sql \
              -f v21_rol_nro_pub_001.sql -f v22_estrutura_das_series.sql -f v23_studio.sql -f v24_treinamentos.sql

createdb -T tbase t25
psql -d t25 -f v25_documentos_eventos.sql
psql -d t25 -f testes/v25_documentos.sql     # 130 asserções (anon, RLS, nulos; roda a 25.0 de novo no fim)

createdb -T tbase t26
psql -d t26 -f v25_documentos_eventos.sql -f v26_formularios.sql
psql -d t26 -f testes/v26_formularios.sql    # 48 asserções

createdb -T tbase t27
psql -d t27 -f testes/esqueleto_vault.sql -f v27_cofre.sql
psql -d t27 -f testes/v27_cofre.sql          # 91 asserções (os vetores da RFC 6238; roda a 27.0 de novo no fim)
```

O `esqueleto_vault.sql` faz para o Vault o que o de Storage faz para o
Storage: o schema `vault`, a tabela de segredos, a view que decifra e as duas
funções de gravar — sem a cifra, que é do Supabase. O que o teste prova é o
caminho do cofre: quem lê, quem grava, o que fica registrado.

O `esqueleto_storage.sql` é o mínimo do Supabase que o PostgreSQL puro não
tem — `auth.uid()` e o schema `storage`, com RLS ligada em `storage.objects` —,
e precisa vir **antes** da 20.0, senão a parte do bucket é pulada e o teste
de Storage não prova nada. O `v20_arquivos.sql` testa a RLS por conta
própria: troca para o papel `authenticated` e dá a ele só o que o Supabase
daria.

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
