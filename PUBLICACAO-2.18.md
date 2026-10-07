# Publicação do SOMA 2.18.0

Este checklist não foi executado contra produção. As validações de desenvolvimento usam PostgreSQL local e Supabase simulado.

## Estado real e regra de ouro

- **Produção já tem a migração do #35 aplicada** (papéis por grupo, folha única, espelhos, avisos por categoria). Aquela versão **não registrou** linha em `migracoes`. O #36 acrescenta reporte, feed, newsletters, ata e Marca ao mesmo arquivo `db/2.18.0_soma.sql`, que é idempotente: aplicá-la por cima não perde nada do #35 e a semente de papéis por grupo não roda de novo (a tabela já existe).
- **Mergear o PR #36 é publicar o portal.** O GitHub Pages publica no instante do merge. Por isso a migração vem **antes** do merge. Com o front novo sobre o banco só do #35, Reporte, Feed, Newsletters, Marca e Ata falham e salvar um evento predefinido é recusado (`gera_ata` não existe).
- **Não mergear** `revert-35-claude/soma-2.18` (membro) nem `revert-12-claude/manual-paginas` (brand): o primeiro põe o front 2.17.1 sobre um banco 2.18 (presença, apontamentos e preferências quebram) e o segundo remove arquivos que o #36 usa. Fechar os PRs e apagar os branches.

## Passo 0. Confirmar o estado (somente leitura)

Esperado no cenário real: `0, t, t, t, >0, f, f, f, f`. Se vier diferente, parar e reavaliar. Com o #36 já aplicado viria `1, t, t, t, 89, t, t, t, t`; reaplicar é inofensivo, siga do passo 3.

```sql
select
  (select count(*) from public.migracoes where id = '2.18.0_soma')                    as linha_migracoes,
  to_regclass('public.grupo_papeis') is not null                                      as tem_35_papeis,
  to_regclass('public.notificacao_canais') is not null                                as tem_35_canais,
  to_regprocedure('public.atividade_espelhar(jsonb)') is not null                     as tem_35_espelho,
  (select count(*) from pg_policies where schemaname='public' and policyname='conta_ativa') as tabelas_com_trava,
  to_regclass('public.reporte_ciclos') is not null                                    as tem_36_reporte,
  to_regclass('public.newsletters') is not null                                       as tem_36_newsletter,
  to_regclass('public.marca_vinculos') is not null                                    as tem_36_marca,
  exists (select 1 from storage.buckets where id = 'feed')                            as tem_36_bucket_feed;
```

Guarde também o estado de segurança atual (as consultas abaixo; no cenário real servem de auditoria, não de pré-condição):

### Conferências guardadas

Rode cada consulta no SQL Editor e guarde o resultado.

1. **Os grupos da semente existem com esses nomes?**
   ```sql
   select id, nome, chave, ativo, pai_id from grupos
    where upper(nome) in ('NRO_PESSOAL','NRO_PS','NRO_LEADERSHIP') or chave = 'pessoal';
   ```
   Se o nome real for outro (por exemplo "Depto de Pessoal" sem `NRO_PESSOAL`), a semente usa o de `chave='pessoal'` para pessoal. Seleção e liderança ficam sem grupo, com um aviso, e precisam ser definidas em Administração › Grupos logo depois.

2. **Relatório `perfis.papel` × grupos (quem ganha e quem perde).**
   ```sql
   with gp(nome, papel) as (values ('NRO_PESSOAL','pessoal'), ('NRO_PS','selecao'), ('NRO_LEADERSHIP','lideranca'))
   select p.email, p.papel as papel_na_conta, m.nome, m.status,
          (select string_agg(gp.papel || ' via ' || g.nome, ', ')
             from gp join grupos g on upper(g.nome) = gp.nome
            where g.id = any(grupos_de(p.registro))) as papeis_por_grupo
     from perfis p left join membros m on m.registro = p.registro
    order by p.papel, p.email;
   ```
   - `papel_na_conta = 'pessoal'` ou `'selecao'` sem o papel correspondente por grupo: a pessoa continua com acesso nesta versão (legado), mas perde quando a transição acabar. Ponha-a no grupo.
   - `papeis_por_grupo` com liderança: a pessoa passa a ler a ficha de todos (dados pessoais, avaliações, acessos) e todos os quadros. Confira se é isso.

3. **Quem fica bloqueado ao aplicar** (contas que perdem tudo na hora, inclusive admin):
   ```sql
   select p.email, p.papel, m.nome, m.status from perfis p join membros m on m.registro = p.registro
    where m.status in ('Desligado','Egresso','Sob demanda') order by p.papel, m.status;
   ```
   Um **admin** que apareça aqui perde o acesso. Antes de aplicar, corrija o status ou desvincule a conta (registro nulo).

4. **As funções e políticas da lista existem com o texto esperado?** Depois de aplicar, procure no resultado do Run as linhas `NOTICE: Papéis por grupo: não reconheci ...` e `Card espelhado: não reconheci ...`. Cada uma é uma função cujo teste de papel ficou como estava e precisa de ajuste à mão. O resultado também mostra `N trocas na lista de escrita` e `N tabelas com a trava`. Para conferir:
   ```sql
   select tablename, policyname, qual, with_check from pg_policies
    where policyname in ('okr_insert','okr_delete','okrcom_delete','pavisos_select','pavisos_write','plinks_write',
      'pdocs_select','pdocs_write','evtipos_write','agpred_write','siteprj_write','eroteiros_gestao','eprog_ler',
      'doc_emcfg_update','evx_cfg_update','doc_emit_select');
   select proname from pg_proc where pronamespace = 'public'::regnamespace
      and prosrc ~ 'papel_atual\(\)\s*(not\s+)?in\s*\(\s*''admin''\s*,\s*''pessoal''\s*\)';   -- o que ficou admin/pessoal
   ```

5. **Políticas da ficha de produção.** A migração apaga e recria `dados_all`, `aval_select`, `aval_insert`, `acessos_select`, `ocorr_select` e `ocorr_insert`. Se produção tiver outra política nessas tabelas com `using (true)`, ela continua abrindo a leitura:
   ```sql
   select tablename, policyname, cmd, qual, with_check from pg_policies
    where tablename in ('dados_pessoais','avaliacoes','acessos_concedidos','ocorrencias') order by 1, 2;
   ```


## Ordem de publicação

1. **Fechar** os PRs de revert (`revert-35-claude/soma-2.18` no membro e `revert-12-claude/manual-paginas` no brand) e apagar os branches. Não mergear.
2. **Backup**: Database › Backups, ou `pg_dump` pelo connection string; guardar também a saída do passo 0 e das conferências acima, e `select gp.papel, g.nome from grupo_papeis gp join grupos g on g.id = gp.grupo_id;`.
3. **Aplicar `db/2.18.0_soma.sql`** (a do #36) inteira no SQL Editor. Esperado: sem erro, nenhum aviso "não reconheci", o aviso "semente não aplicada (já existia)" e uma linha nova em `migracoes`. O limite do bucket `feed` (5 MB, PNG/JPEG/WebP) já vem na própria migração. Reconferir:
   ```sql
   select id, aplicada_em from migracoes where id = '2.18.0_soma';
   select gp.papel, g.nome from grupo_papeis gp join grupos g on g.id = gp.grupo_id;   -- igual ao de antes
   select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'feed';
   select tipo, periodo_ini, status from newsletters order by criado_em desc limit 5;
   select chave, serie_id from marca_vinculos order by chave;
   ```
4. **Republicar as Edge Functions** `notificar-email` (verificação de JWT continua desligada, autorização interna da fila) e `agenda-sync`. Não alterar os segredos. Conferir que a passada seguinte termina `ok` e sem `newsletters: erro`:
   ```sql
   select inicio, origem, resultado from fila_passadas order by id desc limit 3;
   ```
5. **Templates de Auth**: colar o conteúdo de `supabase/templates/*.html` em Authentication › Email Templates, no template correspondente, e enviar um e-mail de teste.
6. **Mergear o #36** (o brand `main` já tem os assets usados; não há o que publicar nele). O Pages publica. Conferir `/rsvp?t=…`, `/descadastrar?t=…`, `/quiosque` e o carregamento de Reporte, Feed, Newsletters, Marca e Ata.
7. **Teste controlado** com destinatário autorizado: preferências, aprovação do boletim, envio, baixa e descadastro. Conferir no provedor antes de repetir um envio cuja baixa falhou. Depois, uma conta ativa, uma liderança, um admin e uma conta bloqueada. Gerar a folha única de check-in somente quando o QR anterior puder ser substituído.
8. Conferir configuração de prazo/reunião do reporte (só admin altera), responsáveis dos grupos, vínculos de Marca e tipos de evento com ata.

Conferências finais (somente leitura):

```sql
select count(*),count(distinct registro) from notificacao_canais;
select email_modo,count(*) from notificacao_preferencias group by 1;
select jsonb_array_length(notificacoes_email_lote(500));
select jobname,schedule,active from cron.job where jobname='soma-fila';
select chave,serie_id from marca_vinculos order by chave;
select nome,responsaveis from grupos where ativo and cardinality(responsaveis)>0;
```

Quem estava em "imediato" sem escolha explícita passa ao resumo semanal; isso está nas notas da versão. Os papéis legados de Pessoal e Seleção ainda funcionam nesta versão, mas devem ser transferidos para os grupos.

## Plano de volta

- **Não reverta o front do #36 para o 2.17.1** (nem o #35) com o banco em 2.18: o banco 2.18 é incompatível com o front antigo.
- Se o problema estiver só no #36: reverta **somente o merge do #36** no membro. O front volta ao do #35, que funciona com o banco 2.18 (o banco do #36 é superconjunto e não muda assinaturas que o #35 usa). Não é preciso desfazer a migração; as tabelas novas ficam sem uso.
- Se houver defeito no banco: corrija com uma migração nova (2.18.1) para frente, ou, em último caso, restaure o backup do passo 2 **junto** com o front compatível com aquele estado, sabendo que dados gravados depois do backup se perdem.
- Edge Functions: republicar a versão anterior; com o banco 2.18 ela funciona (só os boletins deixam de sair e os resumos mostram o texto antigo).

## Limites da validação local

PostgreSQL local não reproduz os serviços gerenciados Cron, Vault, Storage, Google e provedores de e-mail. Os testes usam seus contratos e fixtures. Nenhum e-mail real foi enviado e nenhuma migração foi aplicada no Supabase de produção.

No manual da marca, redução mínima dos logos, unidade de área de proteção e equivalências oficiais CMYK/Pantone continuam pendentes de definição institucional.
