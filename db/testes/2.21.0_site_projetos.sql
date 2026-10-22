\set ON_ERROR_STOP on
\pset pager off
set check_function_bodies = off;
-- ============================================================
-- Teste da 2.21.0, os projetos do site como páginas.
-- Rode num banco feito do tbase (esqueleto, Storage e a 15.0 à
-- 24.0; ver db/LEIAME.md):
--   bash testes/preparar-base.sh teste t2210 2.21.0_site_projetos.sql
-- O teste aplica a soma_v09 e a soma_v13 (o site), põe a eh_gestao()
-- da 2.18.0 e roda a 2.21.0 duas vezes, com edição no meio.
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;
create or replace function eu(p_reg integer, p_papel text) returns void language plpgsql as $$
begin
  perform set_config('teste.registro', coalesce(p_reg::text, ''), false);
  perform set_config('teste.papel', p_papel, false);
end $$;
-- os ajudantes leem como dono: o teste roda como authenticated e anon
create or replace function conta(p_sql text) returns integer language plpgsql security definer as $$
declare n integer; begin execute 'select count(*)::integer from (' || p_sql || ') q' into n; return n; end $$;
create or replace function sid(p_slug text) returns uuid language sql security definer as $$
  select id from site_projetos where slug = p_slug $$;
-- uma escrita que deve ser recusada: devolve a mensagem do erro
create or replace function recusa(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return null;
exception when others then return sqlerrm; end $$;

-- o que a produção já tem antes da 2.21.0
create or replace function public.fn_atualizado() returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;
\ir ../aplicadas/soma_v09_site.sql
\ir ../aplicadas/soma_v13_site_idiomas.sql
create or replace function public.eh_gestao() returns boolean language sql stable as $$
  select public.papel_atual() in ('admin','pessoal','lideranca') $$;
-- como a 2.18.0 deixou a política dos projetos do site
drop policy if exists siteprj_write on site_projetos;
create policy siteprj_write on site_projetos for all to authenticated
  using (public.eh_gestao()) with check (public.eh_gestao());
grant select, insert, update, delete on site_projetos to authenticated;

-- dois projetos no SOMA: a Nebula, com a Carla (17) de supervisora,
-- e o Órion, com o Bruno (11)
do $$ begin
  perform eu(4, 'admin');
  perform ok(projeto_salvar(jsonb_build_object('codigo','NEBULA','nome','Nebula','supervisor',17))->>'status' = 'ok',
             'projeto NEBULA criado no SOMA');
  perform ok(projeto_salvar(jsonb_build_object('codigo','ORION','nome','Órion','supervisor',11))->>'status' = 'ok',
             'projeto ORION criado no SOMA');
end $$;

-- ------------------------------------------------------------
-- 1. A migração
-- ------------------------------------------------------------
\ir ../2.21.0_site_projetos.sql

do $$ begin
  perform ok(conta('select 1 from site_projetos_antes_2_21') = 5, 'a cópia guarda os cinco projetos de antes');
  perform ok((select tagline from site_projetos_antes_2_21 where slug = 'calima') = 'Monitoring that follows the patient',
             'a cópia tem o texto antigo da Calima');
  perform ok((select tagline_pt from site_projetos where slug = 'calima') = 'Pedalar com os próprios músculos.',
             'a Calima ganhou o texto da planilha');
  perform ok(conta('select 1 from site_projetos where publicado') = 8, 'oito projetos no ar');
  perform ok(not (select publicado from site_projetos where slug = 'deriva'), 'a Deriva saiu do ar');
  perform ok((select status from site_projetos where slug = 'deriva') = 'On hold', 'e está em pausa');
  perform ok(not (select publicado from site_projetos where slug = 'arabella'), 'a Arabella fica oculta');
  perform ok((select familia || '/' || animacao from site_projetos where slug = 'opalina') = 'ion/opalina',
             'a Opalina tem família e animação');
  perform ok((select p.codigo from site_projetos s join projetos p on p.id = s.projeto_id where s.slug = 'nebula') = 'NEBULA',
             'a Nebula do site se ligou ao projeto NEBULA do SOMA');
  perform ok((select p.codigo from site_projetos s join projetos p on p.id = s.projeto_id where s.slug = 'orion') = 'ORION',
             'o Órion também (o slug sem acento é o código)');
  perform ok((select projeto_id from site_projetos where slug = 'calima') is null, 'a Calima fica sem projeto: não há CALIMA');
  perform ok(conta('select 1 from site_projeto_numeros where publicado') = 10, 'dez números no ar');
  perform ok(conta($q$select 1 from site_projeto_numeros where origem = 'literatura' and coalesce(fonte,'') = ''$q$) = 0,
             'todo número da literatura tem fonte');
  perform ok(conta($q$select 1 from site_projeto_saidas where tipo = 'parceria' and publicado$q$) = 8, 'oito parcerias no ar');
  perform ok(conta($q$select 1 from site_projeto_saidas where titulo = 'BCI-FES Integration for Motor Rehabilitation' and not publicado$q$) = 1,
             'a apresentação do CBEB entra como rascunho da Nebula');
  perform ok((select count(*) from migracoes where id = '2.21.0_site_projetos') = 1, 'a migração se registra');
end $$;

do $$ begin
  perform ok(recusa($q$insert into site_projeto_numeros (site_projeto_id, valor, rotulo_pt, origem)
                       values (sid('gaia'), 3, 'sem fonte', 'literatura')$q$) is not null,
             'número da literatura sem fonte não entra');
  perform ok(recusa($q$insert into site_projeto_numeros (site_projeto_id, valor, origem)
                       values (sid('gaia'), 3, 'projeto')$q$) is not null,
             'número sem rótulo em idioma nenhum não entra');
  perform ok(recusa($q$update site_projetos set familia = 'synapse' where slug = 'gaia'$q$) is not null,
             'Synapse não é família de página');
  perform ok(recusa($q$insert into site_projeto_saidas (site_projeto_id, tipo, titulo, imagem_url)
                       values (sid('gaia'), 'parceria', 'X', 'javascript:alert(1)')$q$) is not null,
             'logo só com https ou de assets/');
end $$;

-- ------------------------------------------------------------
-- 2. O que o site lê, com a chave anon
-- ------------------------------------------------------------
set role anon;
do $$
declare j jsonb;
begin
  j := site_projetos_publico();
  perform ok(jsonb_array_length(j) = 8, 'o site lê os oito projetos no ar');
  perform ok(j->0->>'slug' = 'opalina' and j->0->>'familia' = 'ion' and j->0->>'animacao' = 'opalina',
             'na ordem, com a família e a animação');
  j := site_projeto_publico('orion');
  perform ok(j->>'status' = 'ok', 'a página do Órion responde');
  perform ok(jsonb_array_length(j->'numeros') = 3, 'com os três números');
  perform ok((j->'numeros'->1->>'prefixo') = 'menos' and (j->'numeros'->1->>'unidade') = 'dias',
             'o prefixo e a unidade vão como chave');
  perform ok(jsonb_array_length(j->'saidas') = 3, 'e as três parcerias');
  j := site_projeto_publico('nebula');
  perform ok(jsonb_array_length(j->'saidas') = 0, 'o rascunho da Nebula não chega ao site');
  perform ok(site_projeto_publico('arabella')->>'status' = 'nao_encontrado', 'projeto oculto não tem página');
  perform ok(site_projeto_publico('nao-existe')->>'status' = 'nao_encontrado', 'nem slug que não existe');
end $$;
do $$ begin
  perform ok(recusa('select count(*) from site_projeto_numeros') is not null, 'o anon não lê as tabelas direto');
end $$;
reset role;

-- ------------------------------------------------------------
-- 3. O supervisor rascunha; a gestão publica
-- ------------------------------------------------------------
set role authenticated;
select eu(17, 'leitura');
do $$
declare v_id uuid;
begin
  perform ok(site_projeto_pode_editar(sid('nebula')), 'a Carla, supervisora da Nebula, edita a página dela');
  perform ok(not site_projeto_pode_editar(sid('orion')), 'e não a do Órion');
  insert into site_projeto_saidas (site_projeto_id, tipo, titulo, veiculo, situacao, publicado, nota_pt)
  values (sid('nebula'), 'artigo', 'Beta-band ERD for early movement intention', 'J Neural Eng', 'submetido', true,
          'Artigo da detecção pela banda beta.')
  returning id into v_id;
  perform ok(not (select publicado from site_projeto_saidas where id = v_id), 'o que ela manda publicado chega como rascunho');
  perform ok((select criado_por from site_projeto_saidas where id = v_id) = 17, 'com a autoria dela');
  update site_projeto_saidas set situacao = 'aceito' where id = v_id;
  perform ok((select situacao from site_projeto_saidas where id = v_id) = 'aceito', 'ela corrige o rascunho');
  perform ok(recusa(format($q$insert into site_projeto_saidas (site_projeto_id, tipo, titulo)
                              values (%L, 'artigo', 'Intruso')$q$, sid('orion'))) is not null,
             'na página de outro projeto, a escrita é recusada');
  perform ok(recusa($q$update site_projetos set tagline_pt = 'Outro' where slug = 'nebula'$q$) is null
             and (select tagline_pt from site_projetos where slug = 'nebula') <> 'Outro',
             'o texto da página continua só da gestão (a atualização não pega linha)');
end $$;

select eu(31, 'pessoal');
do $$ begin
  update site_projeto_saidas set publicado = true where titulo = 'Beta-band ERD for early movement intention';
  perform ok((select publicado from site_projeto_saidas where titulo = 'Beta-band ERD for early movement intention'),
             'o Pessoal publica');
end $$;

select eu(17, 'leitura');
do $$ begin
  perform ok(recusa($q$update site_projeto_saidas set titulo = 'Outro'
                       where titulo = 'Beta-band ERD for early movement intention'$q$) like '%no_ar%',
             'publicado, o artigo não muda mais pela supervisora');
  perform ok(recusa($q$delete from site_projeto_saidas
                       where titulo = 'Beta-band ERD for early movement intention'$q$) like '%no_ar%',
             'nem sai do ar por ela');
  insert into site_projeto_numeros (site_projeto_id, valor, unidade, rotulo_pt, origem)
  values (sid('nebula'), 120, 'ms', 'de latência na detecção, em bancada', 'projeto');
  perform ok(conta($q$select 1 from site_projeto_numeros where unidade = 'ms' and not publicado$q$) = 1,
             'o número dela também entra como rascunho');
  delete from site_projeto_numeros where unidade = 'ms';
  perform ok(conta($q$select 1 from site_projeto_numeros where unidade = 'ms'$q$) = 0, 'e o rascunho ela mesma apaga');
end $$;

select eu(11, 'leitura');
do $$ begin
  perform ok(conta('select 1 from site_projeto_saidas') > 0, 'qualquer conta lê a produção, com os rascunhos');
  perform ok(recusa($q$update site_projeto_numeros set valor = 1 where site_projeto_id = sid('nebula')$q$) is null
             and conta($q$select 1 from site_projeto_numeros where valor = 1$q$) = 0,
             'quem não supervisiona não altera número de outra página');
end $$;
reset role;

-- ------------------------------------------------------------
-- 4. Rodar de novo não desfaz o painel
-- ------------------------------------------------------------
update site_projetos set tagline_pt = 'Editado no painel.' where slug = 'calima';
\ir ../2.21.0_site_projetos.sql
do $$ begin
  perform ok((select tagline_pt from site_projetos where slug = 'calima') = 'Editado no painel.',
             'a segunda passada não sobrescreve o que o painel editou');
  perform ok(conta('select 1 from site_projeto_numeros where publicado') = 10, 'nem duplica os números');
  perform ok(conta('select 1 from site_projetos_antes_2_21') = 5, 'e a cópia continua a de antes');
end $$;

\echo 'Tudo certo: 2.21.0.'
