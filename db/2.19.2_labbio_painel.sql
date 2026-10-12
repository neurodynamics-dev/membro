-- ============================================================
-- SOMA 2.19.2: o início do painel do LABBIO vira um dashboard
--
-- labbio_inicio() continua devolvendo o que já devolvia (membros,
-- com_acesso, pedidos_abertos e revogacoes) e passa a trazer, numa chamada
-- só, o que o gestor precisa ver ao abrir o painel:
--
--   pedidos     os pedidos de biometria no LABBIO, do mais antigo (até 6)
--   consultas   as consultas de sala sem resposta, de hoje em diante (total e as 6 primeiras)
--   hoje        quem fez check-in hoje (total e os últimos 8) e os eventos de hoje nos espaços do LABBIO
--   serie       pessoas distintas por dia nos últimos 14 dias (com os dias sem ninguém)
--   acesso      membros ativos por estado da biometria (possui, solicitado, não possui)
--   termo       membros ativos por situação do termo de sigilo (null sem campanha)
--   treinamentos_pendentes  membros ativos com algum treinamento obrigatório em aberto
--
-- Só leitura, com as mesmas regras de antes: só gestor ativo ou o admin do
-- SOMA (conta_labbio()), e só os campos combinados (nome e foto, sem dados
-- pessoais). Depois da 2.19.1_labbio_dados e da 2.19.2_salas. Pode
-- rodar de novo.
-- ============================================================

create or replace function public.labbio_inicio()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_camp text;
begin
  if not public.conta_labbio() then return jsonb_build_object('status', 'sem_permissao'); end if;
  v_camp := public.termo_campanha_atual();
  return jsonb_build_object('status', 'ok', 'hoje_data', v_hoje,
    'membros', (select count(*) from membros where status in ('Ativo', 'Em pausa / avaliação')),
    'com_acesso', (select count(*) from acessos_concedidos a join membros m on m.registro = a.registro
                    where a.item_id = public.labbio_item_biometria() and a.ativo and m.status in ('Ativo', 'Em pausa / avaliação')),
    'pedidos_abertos', (select count(*) from labbio_pedidos where etapa = 'labbio'),
    'revogacoes', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'registro', r.registro, 'nome', m.nome,
        'status_para', r.status_para, 'criada_em', r.criada_em) order by r.criada_em)
      from labbio_revogacoes r join membros m on m.registro = r.registro where r.confirmada_em is null), '[]'),

    'pedidos', coalesce((select jsonb_agg(x order by x->>'encaminhado_em') from (
        select jsonb_build_object('id', p.id, 'registro', p.registro, 'nome', m.nome, 'foto_url', m.foto_url,
                                  'encaminhado_em', coalesce(p.encaminhado_em, p.atualizado_em)) x
          from labbio_pedidos p join membros m on m.registro = p.registro
         where p.etapa = 'labbio' order by coalesce(p.encaminhado_em, p.atualizado_em) limit 6) y), '[]'),

    'consultas_pendentes', (select count(*) from labbio_consultas c join eventos e on e.id = c.evento_id
                             where c.situacao = 'pendente' and c.data >= v_hoje and coalesce(e.status, '') <> 'Cancelado'),
    'consultas', coalesce((select jsonb_agg(x order by x->>'data', x->>'hora_inicio') from (
        select jsonb_build_object('id', c.id, 'evento_id', e.id, 'titulo', e.titulo, 'data', c.data,
                                  'hora_inicio', to_char(c.hora_inicio, 'HH24:MI'), 'hora_fim', to_char(c.hora_fim, 'HH24:MI'),
                                  'espaco', s.nome) x
          from labbio_consultas c join eventos e on e.id = c.evento_id join espacos s on s.id = c.espaco_id
         where c.situacao = 'pendente' and c.data >= v_hoje and coalesce(e.status, '') <> 'Cancelado'
         order by c.data, c.hora_inicio limit 6) y), '[]'),

    'hoje', jsonb_build_object(
      'presentes', (select count(distinct registro) from presencas
                     where (registrado_em at time zone 'America/Sao_Paulo')::date = v_hoje),
      'ultimos', coalesce((select jsonb_agg(x order by x->>'registrado_em' desc) from (
          select jsonb_build_object('registro', p.registro, 'nome', m.nome, 'foto_url', m.foto_url,
                                    'registrado_em', max(p.registrado_em)) x
            from presencas p join membros m on m.registro = p.registro
           where (p.registrado_em at time zone 'America/Sao_Paulo')::date = v_hoje
           group by p.registro, m.nome, m.foto_url order by max(p.registrado_em) desc limit 8) y), '[]'),
      'eventos', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'titulo', e.titulo,
            'hora_inicio', to_char(e.hora_inicio, 'HH24:MI'), 'hora_fim', to_char(e.hora_fim, 'HH24:MI'), 'espaco', s.nome,
            'consulta', (select c.situacao from labbio_consultas c where c.evento_id = e.id and c.situacao <> 'invalidada' limit 1))
            order by e.hora_inicio nulls first, e.titulo)
          from eventos e join espacos s on s.id = e.espaco_id
         where s.labbio and e.data = v_hoje and coalesce(e.status, '') <> 'Cancelado'), '[]')),

    'serie', (select jsonb_agg(jsonb_build_object('dia', d::date, 'pessoas',
                (select count(distinct registro) from presencas where (registrado_em at time zone 'America/Sao_Paulo')::date = d::date))
                order by d)
                from generate_series(v_hoje - 13, v_hoje, interval '1 day') d),

    'acesso', (select jsonb_build_object(
                 'possui', count(*) filter (where a->>'estado' = 'possui'),
                 'solicitado', count(*) filter (where a->>'estado' = 'solicitado'),
                 'nao_possui', count(*) filter (where a->>'estado' = 'nao_possui'))
                 from (select public.labbio_acesso_de(registro) a from membros where status in ('Ativo', 'Em pausa / avaliação')) z),

    'termo', case when v_camp is null then null else (select jsonb_build_object(
                 'pendente', count(*) filter (where s = 'pendente'), 'enviado', count(*) filter (where s = 'enviado'),
                 'conferido', count(*) filter (where s = 'conferido'), 'devolvido', count(*) filter (where s = 'devolvido'))
                 from (select public.termo_situacao(registro, v_camp) s from membros where status in ('Ativo', 'Em pausa / avaliação')) z) end,

    'treinamentos_pendentes', (select count(*) from membros m
        where m.status in ('Ativo', 'Em pausa / avaliação')
          and exists (select 1 from treinamentos t where t.status = 'publicado'
                        and public.treinamento_obrigatorio_para(t.id, m.registro)
                        and public.treinamento_situacao(t.id, m.registro) is distinct from 'concluido')));
end $$;

revoke execute on function public.labbio_inicio() from public, anon;
grant execute on function public.labbio_inicio() to authenticated;

insert into public.migracoes(id, descricao) values('2.19.2_labbio_painel',
 'SOMA 2.19.2: o início do painel do LABBIO vira um dashboard (pedidos e consultas para responder, presença de hoje e dos últimos 14 dias, eventos de hoje, biometria, termo e treinamentos em aberto)')
on conflict(id) do nothing;

-- CONFERIR (somente leitura, como admin do SOMA no SQL Editor não passa por conta_labbio(); confira pelo painel)
-- select id, descricao from public.migracoes where id = '2.19.2_labbio_painel';
