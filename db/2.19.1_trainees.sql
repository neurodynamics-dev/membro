-- ============================================================
-- SOMA 2.19.1: trainees no SOMA principal
--
-- Três passos, separados: candidato → trainee → efetivo (ou dispensado).
-- Trainee é quem tem o cargo 'Trainee' (sem coluna nova): status Ativo,
-- então usa o SOMA como qualquer membro (tarefas, agenda, check-in,
-- treinamentos, Serviços, recadastro e termo), mas só vê os grupos em que
-- está. A regra mora em eh_trainee().
--
--   ps_trainees_pendentes()   os candidatos que o comitê já pôs em
--                             'trainee' e ainda não entraram no quadro
--   ps_admitir_trainees(itens) admissão individual ou em lote, tudo ou
--                             nada: cria o membro com cargo Trainee, área
--                             (departamento), gestor direto, NRO_TRAINEE e
--                             os grupos escolhidos; liga a conta que já
--                             existir com o e-mail. Clique repetido não
--                             duplica (ps_candidatos.registro_membro). O
--                             candidato continua 'trainee' no PS.
--   trainees_quadro(area)     os trainees, com a área de interesse (do PS)
--                             separada da área de alocação (departamento)
--   trainee_efetivar(reg, cargo) troca o cargo, sai de NRO_TRAINEE, fecha o
--                             PS ('integrado'). Registro, conta, histórico,
--                             atividades, termos e treinamentos ficam.
--   trainee_dispensar(reg, motivo) status Desligado (a conta perde o
--                             acesso ao SOMA na hora), sai dos grupos, PS
--                             'reprovado_final', e um card no Pessoal para
--                             redistribuir as atividades e revogar os
--                             acessos do catálogo. A pessoa não é apagada e
--                             nenhum acesso físico é dado como revogado.
--
-- ANTES: o grupo NRO_TRAINEE precisa existir (Administração › Grupos).
-- Só acrescenta; pode rodar de novo.
-- ============================================================

create or replace function public.eh_trainee(p_reg integer)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select lower(btrim(cargo)) = 'trainee' from membros where registro = p_reg), false) $$;

create or replace function public.trainee_gestao()
returns boolean language sql stable security definer set search_path = public as $$
  select public.conta_ativa() and (public.papel_atual() in ('admin', 'pessoal') or public.tenho_papel('selecao')) $$;

create or replace function public.trainee_grupo()
returns text language sql stable security definer set search_path = public as $$
  select nome from grupos where upper(nome) = 'NRO_TRAINEE' and ativo limit 1 $$;

-- os candidatos em 'trainee' que ainda não estão no quadro
create or replace function public.ps_trainees_pendentes(p_edicao uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.trainee_gestao() then jsonb_build_object('status', 'sem_permissao')
    else jsonb_build_object('status', 'ok', 'grupo_trainee', public.trainee_grupo(),
      'candidatos', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'email', c.email,
          'protocolo', c.protocolo, 'edicao', e.nome, 'areas_interesse', c.areas_interesse, 'curso', c.curso,
          'instituicao', c.instituicao,
          'membro_mesmo_email', (select registro from membros m where lower(m.email_pessoal) = lower(c.email)
                                   or lower(m.email_nro) = lower(c.email) limit 1)) order by c.nome)
        from ps_candidatos c join ps_edicoes e on e.id = c.edicao_id
       where c.status = 'trainee' and c.registro_membro is null and (p_edicao is null or c.edicao_id = p_edicao)), '[]')) end $$;

-- admitir: itens = [{ candidato, registro?, area, gestor, grupos: [nomes] }]
create or replace function public.ps_admitir_trainees(p_itens jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare x jsonb; c ps_candidatos; v_ed ps_edicoes; v_reg integer; v_trainee text := trainee_grupo(); v_erros jsonb := '[]';
  v_ok jsonb := '[]'; v_grupos text[]; v_resp text; g text; v_usados integer[] := '{}';
begin
  if not trainee_gestao() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if v_trainee is null then return jsonb_build_object('status', 'sem_grupo_trainee'); end if;
  if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens) = 0 then
    return jsonb_build_object('status', 'invalido'); end if;
  perform pg_advisory_xact_lock(hashtext('ps_admitir_trainees'));
  -- 1. confere tudo antes de gravar qualquer coisa
  for x in select * from jsonb_array_elements(p_itens) loop
    select * into c from ps_candidatos where id = nullif(x->>'candidato', '')::uuid;
    if not found then v_erros := v_erros || jsonb_build_object('candidato', x->>'candidato', 'erro', 'nao_encontrado'); continue; end if;
    if c.registro_membro is not null then continue; end if;                      -- já admitido: não duplica
    if c.status <> 'trainee' then v_erros := v_erros || jsonb_build_object('candidato', c.id, 'erro', 'status_invalido', 'atual', c.status); continue; end if;
    if exists (select 1 from membros where lower(email_pessoal) = lower(c.email) or lower(email_nro) = lower(c.email)) then
      v_erros := v_erros || jsonb_build_object('candidato', c.id, 'erro', 'email_de_membro'); continue; end if;
    if nullif(x->>'registro', '') is not null and (exists (select 1 from membros where registro = (x->>'registro')::integer)
                                                   or (x->>'registro')::integer = any(v_usados)) then
      v_erros := v_erros || jsonb_build_object('candidato', c.id, 'erro', 'registro_em_uso'); continue; end if;
    if nullif(x->>'registro', '') is not null then v_usados := v_usados || (x->>'registro')::integer; end if;
    if length(btrim(coalesce(x->>'area', ''))) = 0 then v_erros := v_erros || jsonb_build_object('candidato', c.id, 'erro', 'area_obrigatoria'); continue; end if;
    if not exists (select 1 from membros where registro = nullif(x->>'gestor', '')::integer and status in ('Ativo', 'Em pausa / avaliação')) then
      v_erros := v_erros || jsonb_build_object('candidato', c.id, 'erro', 'gestor_invalido'); continue; end if;
    for g in select jsonb_array_elements_text(coalesce(x->'grupos', '[]')) loop
      if not exists (select 1 from grupos where nome = g and ativo) then
        v_erros := v_erros || jsonb_build_object('candidato', c.id, 'erro', 'grupo_invalido', 'grupo', g); end if;
    end loop;
  end loop;
  if jsonb_array_length(v_erros) > 0 then return jsonb_build_object('status', 'invalido', 'erros', v_erros); end if;

  -- 2. grava
  select coalesce(nome, email) into v_resp from perfis where id = auth.uid();
  for x in select * from jsonb_array_elements(p_itens) loop
    select * into c from ps_candidatos where id = (x->>'candidato')::uuid for update;
    if c.registro_membro is not null then
      v_ok := v_ok || jsonb_build_object('candidato', c.id, 'registro', c.registro_membro, 'ja_admitido', true); continue; end if;
    -- sem registro escolhido: o próximo livre, sem pisar nos escolhidos deste lote
    v_reg := coalesce(nullif(x->>'registro', '')::integer,
                      greatest((select coalesce(max(registro), 0) from membros), coalesce((select max(u) from unnest(v_usados) u), 0)) + 1);
    select array_agg(distinct n) into v_grupos
      from (select v_trainee as n union select jsonb_array_elements_text(coalesce(x->'grupos', '[]'))) q;
    select * into v_ed from ps_edicoes where id = c.edicao_id;
    insert into membros (registro, status, nome, departamento, cargo, email_pessoal, telefone, data_ingresso, forma_ingresso,
                         grupos, gestor_registro)
    values (v_reg, 'Ativo', c.nome, btrim(x->>'area'), 'Trainee', c.email, c.telefone,
            (now() at time zone 'America/Sao_Paulo')::date, 'Processo Seletivo (trainee)', v_grupos, (x->>'gestor')::integer);
    insert into dados_pessoais (registro, data_nascimento, cidade_origem, instituicao, curso, matricula, periodo_ingresso,
                                background, lattes, github, instagram, genero, autodeclaracao_racial, acessibilidade, autorizacao_imagem)
    values (v_reg, c.data_nascimento, c.cidade_origem, c.instituicao, c.curso, c.matricula, c.periodo, c.background, c.lattes,
            c.github, c.instagram, c.genero, c.autodeclaracao_racial, c.acessibilidade, c.autorizacao_imagem)
    on conflict (registro) do nothing;
    insert into ocorrencias (registro, tipo, descricao, responsavel)
    values (v_reg, 'Ingresso', 'Admitido(a) como trainee no ' || v_ed.nome || ' (protocolo ' || coalesce(c.protocolo, '—') || ').', v_resp);
    update ps_candidatos set registro_membro = v_reg where id = c.id;
    -- a conta que já existe com este e-mail (e não é de outro membro nem do LABBIO) passa a ser deste registro
    update perfis p set registro = v_reg
     where lower(p.email) = lower(c.email) and p.registro is null
       and (to_regclass('public.labbio_gestores') is null or not public.trainee_conta_externa(p.id));
    v_ok := v_ok || jsonb_build_object('candidato', c.id, 'registro', v_reg);
  end loop;
  return jsonb_build_object('status', 'ok', 'admitidos', v_ok);
end $$;

-- a conta é de gestor do LABBIO? (sem depender da migração do LABBIO estar aplicada)
create or replace function public.trainee_conta_externa(p_uid uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v boolean := false;
begin
  if to_regclass('public.labbio_gestores') is null then return false; end if;
  execute 'select exists (select 1 from labbio_gestores where user_id = $1)' into v using p_uid;
  return v;
end $$;

-- o quadro dos trainees: área de interesse (PS) separada da alocação
create or replace function public.trainees_quadro(p_area_interesse text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not (public.trainee_gestao() or public.tenho_papel('lideranca')) then jsonb_build_object('status', 'sem_permissao')
    else jsonb_build_object('status', 'ok', 'trainees', coalesce((select jsonb_agg(jsonb_build_object(
        'registro', m.registro, 'nome', m.nome, 'alocacao', m.departamento, 'status', m.status,
        'areas_interesse', coalesce(c.areas_interesse, '{}'), 'gestor', m.gestor_registro,
        'gestor_nome', (select nome from membros g where g.registro = m.gestor_registro),
        'grupos', m.grupos, 'data_ingresso', m.data_ingresso, 'edicao', e.nome) order by m.nome)
      from membros m left join ps_candidatos c on c.registro_membro = m.registro left join ps_edicoes e on e.id = c.edicao_id
     where public.eh_trainee(m.registro) and m.status in ('Ativo', 'Em pausa / avaliação')
       and (p_area_interesse is null or p_area_interesse = any(coalesce(c.areas_interesse, '{}')))), '[]')) end $$;

create or replace function public.trainee_efetivar(p_reg integer, p_cargo text, p_departamento text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare m membros; v_resp text;
begin
  if not (conta_ativa() and papel_atual() in ('admin', 'pessoal')) then return jsonb_build_object('status', 'sem_permissao'); end if;
  select * into m from membros where registro = p_reg for update;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  if not eh_trainee(p_reg) then return jsonb_build_object('status', 'nao_trainee'); end if;
  if length(btrim(coalesce(p_cargo, ''))) = 0 or lower(btrim(p_cargo)) = 'trainee' then
    return jsonb_build_object('status', 'invalido', 'campo', 'cargo'); end if;
  select coalesce(nome, email) into v_resp from perfis where id = auth.uid();
  update membros set cargo = btrim(p_cargo), departamento = coalesce(nullif(btrim(p_departamento), ''), departamento),
         grupos = array_remove(grupos, trainee_grupo())
   where registro = p_reg;
  update ps_candidatos set status = 'integrado' where registro_membro = p_reg and status = 'trainee';
  insert into ocorrencias (registro, tipo, descricao, responsavel)
  values (p_reg, 'Efetivação', 'Efetivado(a) depois do período trainee, como ' || btrim(p_cargo) || '.', v_resp);
  return jsonb_build_object('status', 'ok');
end $$;

create or replace function public.trainee_dispensar(p_reg integer, p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare m membros; v_resp text; v_acessos text; v_ativs integer; v_card uuid;
begin
  if not (conta_ativa() and papel_atual() in ('admin', 'pessoal')) then return jsonb_build_object('status', 'sem_permissao'); end if;
  if length(btrim(coalesce(p_motivo, ''))) = 0 then return jsonb_build_object('status', 'motivo_obrigatorio'); end if;
  select * into m from membros where registro = p_reg for update;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  if not eh_trainee(p_reg) then return jsonb_build_object('status', 'nao_trainee'); end if;
  if m.status = 'Desligado' then return jsonb_build_object('status', 'ok', 'ja_dispensado', true); end if;
  select coalesce(nome, email) into v_resp from perfis where id = auth.uid();
  select string_agg(i.nome, ', ' order by i.nome) into v_acessos
    from acessos_concedidos a join itens_de_acesso i on i.id = a.item_id where a.registro = p_reg and a.ativo;
  select count(*) into v_ativs from atividades where responsavel = p_reg and status <> 'concluida' and not coalesce(arquivada, false);
  update membros set status = 'Desligado', grupos = '{}' where registro = p_reg;
  update ps_candidatos set status = 'reprovado_final' where registro_membro = p_reg and status = 'trainee';
  insert into ocorrencias (registro, tipo, descricao, responsavel)
  values (p_reg, 'Dispensa', 'Dispensado(a) do período trainee: ' || btrim(p_motivo)
          || ' Grupos que tinha: ' || coalesce(array_to_string(m.grupos, ', '), '') || '.', v_resp);
  -- o que precisa de mão humana vai para o quadro do Pessoal
  v_card := atividade_de_origem('ocorrencia', 'trainee_dispensa:' || p_reg,
    'Dispensa de trainee: ' || m.nome,
    'Motivo: ' || btrim(p_motivo) || E'\n\n'
    || 'Atividades abertas a redistribuir: ' || v_ativs || '.' || E'\n'
    || 'Acessos do catálogo a revogar: ' || coalesce(v_acessos, 'nenhum') || '.' || E'\n'
    || 'A conta no SOMA já foi bloqueada. Acesso físico (como a biometria do LABBIO) só conta como revogado depois da confirmação de quem o retira.',
    'alta', true);
  return jsonb_build_object('status', 'ok', 'atividades_abertas', v_ativs, 'acessos', v_acessos,
                            'card', (select codigo from atividades where id = v_card));
end $$;

do $$ declare f text; begin
  foreach f in array array['trainee_grupo()', 'trainee_conta_externa(uuid)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array['eh_trainee(integer)', 'trainee_gestao()', 'ps_trainees_pendentes(uuid)', 'ps_admitir_trainees(jsonb)',
                           'trainees_quadro(text)', 'trainee_efetivar(integer,text,text)', 'trainee_dispensar(integer,text)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;

do $$ begin
  if public.trainee_grupo() is null then
    raise notice 'Trainees 2.19.1: não achei o grupo NRO_TRAINEE. Crie em Administração › Grupos antes de admitir.';
  end if;
end $$;

insert into public.migracoes(id, descricao) values('2.19.1_trainees',
 'SOMA 2.19.1: trainees no SOMA principal (cargo Trainee, NRO_TRAINEE): admissão em lote sem duplicar, quadro por área de interesse, efetivação e dispensa preservando o histórico')
on conflict(id) do nothing;
