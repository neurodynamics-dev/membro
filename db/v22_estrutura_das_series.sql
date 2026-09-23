-- ============================================================
-- SOMA 22.0 — MIGRAÇÃO · NeuroDynamics
-- A ESTRUTURA DE CADA SÉRIE, PELA COLUNA NOVA DA NRO-PUB-001.
--
-- A planilha ganhou uma coluna ao lado do título que diz o que cada
-- série é. São três frases, e só três:
--
--   "um documento para toda a equipe, sem template e sem filhos"
--        DOCUMENTO ÚNICO. A série é o próprio documento, sem PN.
--        Revisa: Rev. A, B, C…
--   "um template, cada pn é um documento filho da série"
--        TEMPLATE → DOCUMENTOS. A cabeça (sem PN) é o template; cada
--        PN é um documento, que revisa por conta própria.
--   "um template, cada pn é um registro filho da série"
--        TEMPLATE → REGISTROS. A cabeça é o template, que revisa;
--        cada PN é um registro — preenchido, aprovado, e não muda mais.
--
-- No banco, isso é o tipo e o multiplo da série:
--   documento único          tipo documento, sem PN
--   template → documentos    tipo documento, com PN
--   template → registros     tipo registro,  com PN
--
-- A 21.0 tirou o tipo da coluna TIPO e o PN de uma regra ("registro
-- sempre tem PN"). A coluna nova discorda das duas em 18 séries, e
-- vale a coluna:
--   viram documento único         PUB-001, PES-005, PES-016, DIR-003, MKT-002
--   viram template → registros    PES-019 (edital), DIR-004 (declaração de membro)
--   viram template → documentos   PRO-002, PRO-004, PRO-006, PRO-007, PRO-009,
--                                 PRO-010, PRO-011, PRO-013, PRO-014,
--                                 MKT-004, MKT-005
-- As outras 27 já estavam como a coluna diz. O NRO-PUB-002 veio com a
-- coluna vazia e fica como está: um template avulso, sem PN — o
-- modelo de base dos outros.
--
-- O que já existe não se perde:
--   - série que viraria documento único mas já tem PN, ou está no
--     padrão de projeto, fica como estava (o resumo do fim diz qual);
--   - série de documentos com PN não vira de registros: o que já se
--     revisou não se desfaz;
--   - PN que era registro e vira documento leva o que já tinha: a
--     versão sem letra (registro não tem) passa a ser a Rev. A;
--   - toda mudança entra no registro de alterações do arquivo, com a
--     frase de agora e a de antes. Daqui em diante, também quando o
--     PMO muda a estrutura de uma série pela tela.
--
-- Pré-requisito: SOMA 20.0 (e a 21.0, para haver o que ajustar).
-- Segura para rodar mais de uma vez: o que já está como a coluna diz
-- não muda, e nada entra duas vezes no registro de alterações.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run. Ao terminar,
-- o editor mostra, série a série, o que mudou.
-- ============================================================

do $$
begin
  if to_regclass('public.doc_series') is null then
    raise exception using message = 'Falta aplicar a v20 antes desta migração.',
      detail = 'A 22.0 ajusta as séries do controle de arquivos, criadas pela 20.0.';
  end if;
end $$;

-- ============================================================
-- 1. AS TRÊS ESTRUTURAS, NUM LUGAR SÓ
--    doc_estrutura() diz qual é; doc_estrutura_frase(), como a
--    planilha escreve. "avulso" é o caso do NRO-PUB-002: documento
--    sem PN cujo subtipo é template.
-- ------------------------------------------------------------
create or replace function public.doc_estrutura(p_tipo text, p_multiplo boolean, p_subtipo text default null)
returns text language sql immutable as $$
  select case
    when p_multiplo and p_tipo = 'registro' then 'registros'
    when p_multiplo                         then 'documentos'
    when p_subtipo = 'template'             then 'avulso'
    else                                         'unico'
  end
$$;

create or replace function public.doc_estrutura_frase(p_estrutura text)
returns text language sql immutable as $$
  select case p_estrutura
    when 'unico'      then 'um documento para toda a equipe, sem template e sem filhos'
    when 'documentos' then 'um template, cada pn é um documento filho da série'
    when 'registros'  then 'um template, cada pn é um registro filho da série'
    when 'avulso'     then 'um template avulso, sem pn'
  end
$$;
comment on function public.doc_estrutura_frase(text) is
  'A frase da coluna de estrutura da NRO-PUB-001, ao lado do título. A tela usa as mesmas (mod-arquivos.js, ARQ_ESTRUTURAS).';

revoke execute on function public.doc_estrutura(text, boolean, text) from public, anon;
revoke execute on function public.doc_estrutura_frase(text)         from public, anon;
grant  execute on function public.doc_estrutura(text, boolean, text) to authenticated;
grant  execute on function public.doc_estrutura_frase(text)         to authenticated;

-- ============================================================
-- 2. MUDAR A ESTRUTURA DEIXA RASTRO
--    No registro de alterações da cabeça da série: a frase de agora
--    e a de antes. Vale para esta migração e para a tela, que muda a
--    série pela doc_serie_salvar. Quem mudou é a pessoa — ou o que
--    estiver em doc.quem, que é como esta migração assina.
-- ------------------------------------------------------------
create or replace function public.tg_doc_serie_estrutura()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_antes text := public.doc_estrutura(old.tipo, old.multiplo, old.subtipo);
  v_agora text := public.doc_estrutura(new.tipo, new.multiplo, new.subtipo);
begin
  if v_antes is distinct from v_agora then
    insert into doc_eventos (arquivo_id, tipo, detalhe, registro, nome)
    select a.id, 'estrutura',
           public.doc_estrutura_frase(v_agora) || ' (era: ' || public.doc_estrutura_frase(v_antes) || ')',
           public.portal_registro_atual(),
           coalesce(nullif(current_setting('doc.quem', true), ''), public.doc_meu_nome())
      from doc_arquivos a
     where a.serie_id = new.id and a.pn is null;
  end if;
  return new;
end $$;
revoke execute on function public.tg_doc_serie_estrutura() from public, anon, authenticated;

drop trigger if exists tg_doc_serie_estrutura on public.doc_series;
create trigger tg_doc_serie_estrutura
  after update of tipo, multiplo, subtipo on public.doc_series
  for each row execute function public.tg_doc_serie_estrutura();

-- ============================================================
-- 3. A COLUNA, SÉRIE A SÉRIE — as 45 linhas que têm a coluna preenchida
-- ------------------------------------------------------------
drop table if exists pg_temp.v22_coluna;
create temp table v22_coluna (prefixo text, sn integer, estrutura text);
insert into v22_coluna (prefixo, sn, estrutura) values
  -- NRO-PUB
  ('PUB', 1, 'unico'), ('PUB', 3, 'registros'),
  -- NRO-PES
  ('PES', 1, 'registros'), ('PES', 2, 'registros'), ('PES', 3, 'registros'), ('PES', 4, 'unico'),
  ('PES', 5, 'unico'), ('PES', 6, 'unico'), ('PES', 7, 'unico'), ('PES', 8, 'registros'),
  ('PES', 9, 'unico'), ('PES', 10, 'registros'), ('PES', 11, 'registros'), ('PES', 12, 'unico'),
  ('PES', 13, 'unico'), ('PES', 14, 'unico'), ('PES', 15, 'unico'), ('PES', 16, 'unico'),
  ('PES', 17, 'unico'), ('PES', 18, 'unico'), ('PES', 19, 'registros'),
  -- NRO-PRO
  ('PRO', 1, 'documentos'), ('PRO', 2, 'documentos'), ('PRO', 3, 'registros'), ('PRO', 4, 'documentos'),
  ('PRO', 5, 'documentos'), ('PRO', 6, 'documentos'), ('PRO', 7, 'documentos'), ('PRO', 8, 'registros'),
  ('PRO', 9, 'documentos'), ('PRO', 10, 'documentos'), ('PRO', 11, 'documentos'), ('PRO', 12, 'documentos'),
  ('PRO', 13, 'documentos'), ('PRO', 14, 'documentos'),
  -- NRO-DIR
  ('DIR', 1, 'unico'), ('DIR', 2, 'unico'), ('DIR', 3, 'unico'), ('DIR', 4, 'registros'),
  ('DIR', 5, 'unico'),
  -- NRO-MKT
  ('MKT', 1, 'unico'), ('MKT', 2, 'unico'), ('MKT', 3, 'registros'), ('MKT', 4, 'documentos'),
  ('MKT', 5, 'documentos');

-- o retrato de antes, para o resumo do fim
drop table if exists pg_temp.v22_antes;
create temp table v22_antes as
select s.id, s.prefixo, s.sn, public.doc_codigo(s.prefixo, s.sn, null) as codigo, s.titulo,
       public.doc_estrutura(s.tipo, s.multiplo, s.subtipo) as estrutura,
       -- a comparação com a coluna olha só tipo e PN: documento sem PN
       -- com subtipo template (avulso) conta como documento único
       public.doc_estrutura(s.tipo, s.multiplo) as base,
       (select count(*) from public.doc_arquivos a where a.serie_id = s.id and a.pn is not null) as n_pn,
       exists (select 1 from public.doc_padrao_projeto p where p.serie_id = s.id) as no_padrao
  from public.doc_series s;

-- ============================================================
-- 4. AJUSTAR
-- ------------------------------------------------------------
do $$
declare
  c record;
begin
  perform set_config('doc.quem', 'Migração 22.0 — coluna nova da NRO-PUB-001', true);
  for c in
    select s.id, s.tipo, s.multiplo,
           case when k.estrutura = 'registros' then 'registro' else 'documento' end as tipo_novo,
           k.estrutura <> 'unico' as multiplo_novo,
           exists (select 1 from public.doc_arquivos a where a.serie_id = s.id and a.pn is not null) as tem_pn,
           exists (select 1 from public.doc_padrao_projeto p where p.serie_id = s.id) as no_padrao
      from v22_coluna k
      join public.doc_series s on s.prefixo = k.prefixo and s.sn = k.sn
  loop
    continue when c.tipo = c.tipo_novo and c.multiplo = c.multiplo_novo;
    -- documento único não tem PN, nem fica no padrão de projeto
    continue when not c.multiplo_novo and (c.tem_pn or c.no_padrao);
    -- PN que já é documento não vira registro
    continue when c.tipo = 'documento' and c.tipo_novo = 'registro' and c.tem_pn;

    update public.doc_series
       set tipo = c.tipo_novo, multiplo = c.multiplo_novo, atualizado_em = now()
     where id = c.id;

    -- PN que era registro e vira documento: as versões que ele tem
    -- ganham a letra que registro não tinha
    if c.tipo = 'registro' and c.tipo_novo = 'documento' and c.tem_pn then
      insert into public.doc_eventos (arquivo_id, tipo, detalhe, nome)
      select a.id, 'estrutura',
             'documento filho da série (era: registro filho da série)'
             || case when exists (select 1 from public.doc_revisoes r where r.arquivo_id = a.id and r.rev is null)
                     then ' — a versão que já tinha passa a ser a Rev. A' else '' end,
             current_setting('doc.quem', true)
        from public.doc_arquivos a
       where a.serie_id = c.id and a.pn is not null;
      update public.doc_revisoes r
         set rev = 'A'
        from public.doc_arquivos a
       where r.arquivo_id = a.id and a.serie_id = c.id and a.pn is not null and r.rev is null;
      update public.doc_arquivos a
         set rev_vigente = 'A'
       where a.serie_id = c.id and a.pn is not null and a.rev_vigente is null
         and exists (select 1 from public.doc_revisoes r where r.arquivo_id = a.id and r.estado = 'aprovada');
      update public.doc_arquivos a
         set rev_pendente = 'A'
       where a.serie_id = c.id and a.pn is not null and a.rev_pendente = '—';
    end if;
  end loop;
end $$;

-- ============================================================
-- 5. REGISTRO
-- ------------------------------------------------------------
insert into public.migracoes (id, descricao) values
  ('v22_estrutura_das_series', 'A estrutura de cada série pela coluna nova da NRO-PUB-001 — documento único, template de documentos ou template de registros —, e a mudança de estrutura no registro de alterações')
on conflict (id) do nothing;

-- ============================================================
-- 6. O QUE O SQL EDITOR MOSTRA NO FIM
--    O editor do Supabase exibe só o último resultado que tem linhas.
--    Numa primeira execução, logo depois da 21.0: 18 séries "mudou",
--    uma linha "27 séries · já estavam assim" e o NRO-PUB-002, que a
--    coluna não diz. Rodando de novo, as 45 já estão assim.
-- ------------------------------------------------------------
select x.codigo as "série", x.titulo as "título", x.coluna as "coluna nova da NRO-PUB-001",
       x.antes as "como estava", x.situacao as "situação"
  from (
    select 1 as ordem, a.codigo, a.titulo,
           public.doc_estrutura_frase(k.estrutura) as coluna,
           public.doc_estrutura_frase(a.estrutura) as antes,
           case
             when public.doc_estrutura(s.tipo, s.multiplo) = k.estrutura then 'mudou'
             when k.estrutura = 'unico' and a.n_pn > 0 then 'ficou como estava: já tem PN'
             when k.estrutura = 'unico' and a.no_padrao then 'ficou como estava: está no padrão de projeto'
             else 'ficou como estava: os PNs já são documentos'
           end as situacao
      from v22_antes a
      join v22_coluna k on k.prefixo = a.prefixo and k.sn = a.sn
      join public.doc_series s on s.id = a.id
     where a.base <> k.estrutura
    union all
    select 2, count(*)::text || ' séries', '', '', '', 'já estavam como a coluna diz'
      from v22_antes a
      join v22_coluna k on k.prefixo = a.prefixo and k.sn = a.sn
     where a.base = k.estrutura
    union all
    select 3, a.codigo, a.titulo, '(vazia)', public.doc_estrutura_frase(a.estrutura), 'fica como está: a coluna não diz'
      from v22_antes a
     where not exists (select 1 from v22_coluna k where k.prefixo = a.prefixo and k.sn = a.sn)
  ) x
 order by x.ordem, x.codigo;

-- ============================================================
-- FIM — SOMA 22.0
-- ============================================================
