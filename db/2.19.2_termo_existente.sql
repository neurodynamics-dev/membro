-- ============================================================
-- SOMA 2.19.2: o termo de sigilo que o membro já tem
--
-- Alguns membros já têm o termo do LABBIO preenchido e assinado. Eles podem
-- enviar esse mesmo arquivo, desde que esteja conforme: o Pessoal confere
-- (conferido ou devolvido) como qualquer outro envio.
--
-- termo_registrar_envio ganha p_existente: com ele, o envio não exige o termo
-- baixado pelo portal (só os dados conferidos no recadastro) e fica marcado
-- como "termo que já existia" (termo_envios.existente, termo_pendencias.existente),
-- para o Pessoal saber o que está conferindo. O painel do Pessoal mostra a marca.
--
-- O admin do SOMA também envia o termo por um membro, pelo painel do LABBIO
-- (termo_admin_caminho e termo_registrar_envio_admin): o arquivo vai para a
-- pasta da pessoa, o envio fica marcado com quem enviou, a pessoa é avisada,
-- e o Pessoal confere como sempre.
--
-- Depois da 2.19.1_termo. Pode rodar de novo.
-- ============================================================
alter table public.termo_envios     add column if not exists existente boolean not null default false;
alter table public.termo_pendencias add column if not exists existente boolean not null default false;

drop function if exists public.termo_registrar_envio(text, text, integer);
create or replace function public.termo_registrar_envio(p_arquivo text, p_sha256 text, p_bytes integer, p_existente boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); v_c text := public.termo_campanha_atual(); t termo_pendencias;
        v_ex boolean := coalesce(p_existente, false);
begin
  if v_reg is null or v_c is null then return jsonb_build_object('status', 'nenhum'); end if;
  select * into t from termo_pendencias where campanha = v_c and registro = v_reg;
  if v_ex then
    -- o termo que já existia: basta ter conferido os dados no recadastro
    if (public.cadastro_ultima(v_reg)).confirmado_em is null then return jsonb_build_object('status', 'dados_pendentes'); end if;
  elsif t.emitido_em is null or t.emitido_dados is distinct from (public.cadastro_ultima(v_reg)).dados then
    return jsonb_build_object('status', 'nao_emitido');
  end if;
  if split_part(p_arquivo, '/', 1) <> v_c or split_part(p_arquivo, '/', 2) <> v_reg::text
     or not exists (select 1 from storage.objects where bucket_id = 'termos' and name = p_arquivo) then
    return jsonb_build_object('status', 'arquivo_ausente');
  end if;
  if p_sha256 !~ '^[0-9a-f]{64}$' or coalesce(p_bytes, 0) <= 0 then return jsonb_build_object('status', 'invalido'); end if;
  insert into termo_pendencias (campanha, registro) values (v_c, v_reg) on conflict (campanha, registro) do nothing;
  insert into termo_envios(campanha, registro, arquivo, sha256, bytes, existente) values (v_c, v_reg, p_arquivo, p_sha256, p_bytes, v_ex);
  update termo_pendencias set enviado_em = clock_timestamp(), arquivo = p_arquivo, arquivo_sha256 = p_sha256, arquivo_bytes = p_bytes,
         existente = v_ex, conferido_em = null, conferido_por = null, rejeitado_em = null
   where campanha = v_c and registro = v_reg;
  if to_regprocedure('public.recadastro_concluir(integer)') is not null then perform public.recadastro_concluir(v_reg); end if;
  return jsonb_build_object('status', 'ok');
end $$;
revoke execute on function public.termo_registrar_envio(text, text, integer, boolean) from public, anon;
grant  execute on function public.termo_registrar_envio(text, text, integer, boolean) to authenticated;

-- o painel do Pessoal: a mesma lista, com a marca do termo que já existia
create or replace function public.termo_painel(p_campanha text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_c text := coalesce(p_campanha, public.termo_campanha_atual());
begin
  if not public.termo_gestao() then return jsonb_build_object('status', 'sem_permissao'); end if;
  return jsonb_build_object('status', 'ok', 'campanha', v_c,
    'pessoas', coalesce((select jsonb_agg(jsonb_build_object(
        'registro', m.registro, 'nome', m.nome, 'status_membro', m.status,
        'situacao', public.termo_situacao(m.registro, v_c),
        'enviado_em', t.enviado_em, 'arquivo', t.arquivo, 'conferido_em', t.conferido_em, 'motivo', t.motivo,
        'existente', coalesce(t.existente, false), 'enviado_por', t.enviado_por)
        order by m.nome)
      from membros m left join termo_pendencias t on t.campanha = v_c and t.registro = m.registro
     where m.status in ('Ativo', 'Em pausa / avaliação')), '[]'::jsonb));
end $$;

-- 3. o admin envia pelo membro ------------------------------------------------------------------
alter table public.termo_envios     add column if not exists enviado_por text;
alter table public.termo_pendencias add column if not exists enviado_por text;

-- quem grava no bucket: a própria pessoa, na pasta dela; o admin, na pasta de qualquer um (da campanha atual)
create or replace function public.termo_arquivo_pode(p_nome text, p_gravar boolean default false)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); partes text[] := string_to_array(p_nome, '/');
begin
  if array_length(partes, 1) <> 3 or partes[3] !~ '^[0-9a-f-]{36}\.pdf$' then return false; end if;
  if p_gravar then
    if partes[1] <> public.termo_campanha_atual() then return false; end if;
    return (v_reg is not null and partes[2] = v_reg::text)
        or (public.conta_ativa() and public.papel_atual() = 'admin' and partes[2] ~ '^\d+$');
  end if;
  return public.termo_gestao() or (public.conta_ativa() and public.papel_atual() = 'admin') or (v_reg is not null and partes[2] = v_reg::text);
end $$;

-- o caminho onde o admin grava o arquivo de um membro
create or replace function public.termo_admin_caminho(p_registro integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_c text := public.termo_campanha_atual();
begin
  if not (public.conta_ativa() and public.papel_atual() = 'admin') then return jsonb_build_object('status', 'sem_permissao'); end if;
  if v_c is null then return jsonb_build_object('status', 'sem_campanha'); end if;
  if not exists (select 1 from membros where registro = p_registro) then return jsonb_build_object('status', 'nao_encontrado'); end if;
  return jsonb_build_object('status', 'ok', 'caminho', v_c || '/' || p_registro || '/' || gen_random_uuid() || '.pdf');
end $$;

create or replace function public.termo_registrar_envio_admin(p_registro integer, p_arquivo text, p_sha256 text, p_bytes integer, p_existente boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_c text := public.termo_campanha_atual(); quem text;
begin
  if not (public.conta_ativa() and public.papel_atual() = 'admin') then return jsonb_build_object('status', 'sem_permissao'); end if;
  if v_c is null then return jsonb_build_object('status', 'sem_campanha'); end if;
  if not exists (select 1 from membros where registro = p_registro) then return jsonb_build_object('status', 'nao_encontrado'); end if;
  if split_part(p_arquivo, '/', 1) <> v_c or split_part(p_arquivo, '/', 2) <> p_registro::text
     or not exists (select 1 from storage.objects where bucket_id = 'termos' and name = p_arquivo) then
    return jsonb_build_object('status', 'arquivo_ausente');
  end if;
  if p_sha256 !~ '^[0-9a-f]{64}$' or coalesce(p_bytes, 0) <= 0 then return jsonb_build_object('status', 'invalido'); end if;
  select coalesce(nome, email) into quem from perfis where id = auth.uid();
  quem := coalesce(quem, 'admin');
  insert into termo_pendencias (campanha, registro) values (v_c, p_registro) on conflict (campanha, registro) do nothing;
  insert into termo_envios(campanha, registro, arquivo, sha256, bytes, existente, enviado_por)
  values (v_c, p_registro, p_arquivo, p_sha256, p_bytes, coalesce(p_existente, true), quem);
  update termo_pendencias set enviado_em = clock_timestamp(), arquivo = p_arquivo, arquivo_sha256 = p_sha256, arquivo_bytes = p_bytes,
         existente = coalesce(p_existente, true), enviado_por = quem, conferido_em = null, conferido_por = null, rejeitado_em = null
   where campanha = v_c and registro = p_registro;
  if to_regprocedure('public.recadastro_concluir(integer)') is not null then perform public.recadastro_concluir(p_registro); end if;
  perform public.notificar(array[p_registro], 'termo', 'Termo de sigilo enviado por você',
    quem || ' enviou o seu termo de sigilo do LABBIO pelo painel do laboratório. O Pessoal confere.', '#/servicos/termo');
  return jsonb_build_object('status', 'ok');
end $$;
revoke execute on function public.termo_admin_caminho(integer) from public, anon;
grant  execute on function public.termo_admin_caminho(integer) to authenticated;
revoke execute on function public.termo_registrar_envio_admin(integer, text, text, integer, boolean) from public, anon;
grant  execute on function public.termo_registrar_envio_admin(integer, text, text, integer, boolean) to authenticated;

insert into public.migracoes(id, descricao) values('2.19.2_termo_existente',
 'SOMA 2.19.2: o membro pode enviar o termo de sigilo do LABBIO que já tem, preenchido e assinado, e o admin pode enviar por ele no painel do LABBIO; o Pessoal confere')
on conflict(id) do nothing;
