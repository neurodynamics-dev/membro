-- ============================================================
-- SOMA 18.0 — MIGRAÇÃO · NeuroDynamics
-- UM BOTÃO PARA TESTAR O ENVIO DE E-MAIL.
--
-- Até aqui, conferir se o e-mail funciona exigia esperar alguém
-- atribuir uma atividade a você e o agendamento acordar. Quem
-- está configurando o SMTP precisa de resposta em segundos, e
-- precisa saber QUAL das seis coisas falhou.
--
-- Esta migração traz:
--
--   a) notificacao_teste(), que cria um aviso para quem chamou e
--      devolve para qual endereço ele vai sair;
--   b) uma exceção no lote: o aviso de tipo 'teste_email' sai
--      SEMPRE, mesmo para
--      quem escolheu "resumo por dia" ou "só no portal". Um teste
--      que respeita a preferência não testa nada — a pessoa clica,
--      não chega nada, e não dá para saber se foi a preferência ou
--      o SMTP.
--
-- Pré-requisito: SOMA 16.0 aplicada.
-- Segura para rodar mais de uma vez.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

do $$
begin
  if to_regprocedure('public.notificacoes_email_lote(integer)') is null then
    raise exception using message = 'Falta aplicar o v16_pessoal.sql antes desta migração.',
      detail = 'A 18.0 acrescenta uma exceção ao lote criado pela 16.0.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. CRIAR O AVISO DE TESTE
--    Devolve o endereço e a preferência junto, porque é isso que
--    a pessoa precisa conferir antes de sair procurando defeito:
--    "não chegou" quase sempre é endereço errado na ficha.
-- ------------------------------------------------------------
create or replace function public.notificacao_teste()
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  v_email text;
  v_nome  text;
  v_modo  text;
  v_id    bigint;
begin
  if v_reg is null then
    return jsonb_build_object('status','sem_registro');
  end if;

  select nome, coalesce(nullif(email_nro,''), nullif(email_pessoal,''))
    into v_nome, v_email
    from membros where registro = v_reg;

  if v_email is null then
    return jsonb_build_object('status','sem_email','nome',v_nome);
  end if;

  select email_modo into v_modo
    from notificacao_preferencias where registro = v_reg;
  v_modo := coalesce(v_modo, 'imediato');

  insert into notificacoes (registro, tipo, titulo, corpo, href)
  values (v_reg, 'teste_email',
          'Teste de envio — ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI:SS'),
          'Se este e-mail chegou na sua caixa, o envio do portal está '
          || 'configurado e funcionando. Pode apagar.',
          '#/inicio')
  returning id into v_id;

  return jsonb_build_object('status','ok','id',v_id,'email',v_email,'modo',v_modo);
end $$;
revoke execute on function public.notificacao_teste() from public, anon;
grant  execute on function public.notificacao_teste() to authenticated;

-- ------------------------------------------------------------
-- 2. O LOTE ABRE EXCEÇÃO PARA O TESTE
--    Idêntico ao da 16.0, com uma condição a mais: tipo 'teste'
--    ignora a preferência e a janela do resumo. É um pedido
--    explícito da própria pessoa, para ela mesma.
-- ------------------------------------------------------------
-- Desde a 23.0 a dona desta função é ela (o lembrete da véspera do
-- Studio entra na mesma exceção). Por isso a definição abaixo só vale
-- enquanto a 23.0 não passou: rodar a 18.0 de novo não pode tirar o
-- lembrete do e-mail em silêncio.
do $$
begin
  if to_regclass('public.studio_publicacoes') is null then
    execute $f$
    create or replace function public.notificacoes_email_lote(p_limite integer default 200)
    returns jsonb language sql stable security definer
    set search_path = public as $g$
      with alvo as (
        select n.*, m.nome, coalesce(nullif(m.email_nro,''), nullif(m.email_pessoal,'')) as email,
               coalesce(pr.email_modo, 'imediato') as modo, pr.ultimo_email
          from notificacoes n
          join membros m on m.registro = n.registro
          left join notificacao_preferencias pr on pr.registro = n.registro
         where n.email_em is null
           and n.email_tentativas < 5
           and m.status in ('Ativo','Em pausa / avaliação')
           and coalesce(nullif(m.email_nro,''), nullif(m.email_pessoal,'')) is not null
           and (
                 n.tipo = 'teste_email'    -- pedido explícito: sai sempre
             or (    coalesce(pr.email_modo,'imediato') <> 'nunca'
                 and (coalesce(pr.email_modo,'imediato') = 'imediato'
                      or pr.ultimo_email is null
                      or pr.ultimo_email < now() - interval '20 hours'))
               )
         order by n.criado_em
         limit greatest(coalesce(p_limite,200), 1)
      )
      select coalesce(jsonb_agg(p order by p->>'nome'), '[]'::jsonb) from (
        select jsonb_build_object(
                 'registro', registro, 'nome', nome, 'email', email, 'modo', modo,
                 'itens', jsonb_agg(jsonb_build_object(
                   'id', id, 'tipo', tipo, 'titulo', titulo,
                   'corpo', corpo, 'href', href, 'criado_em', criado_em)
                   order by criado_em)) as p
          from alvo group by registro, nome, email, modo
      ) q;
    $g$
    $f$;
  end if;
end $$;
revoke execute on function public.notificacoes_email_lote(integer) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.notificacoes_email_lote(integer) to service_role;
  end if;
end $$;

-- ------------------------------------------------------------
-- 3. REGISTRO
-- ------------------------------------------------------------
insert into public.migracoes (id, descricao) values
  ('v18_teste_email', 'Aviso de teste de e-mail sob demanda, e a exceção que o faz sair mesmo para quem escolheu resumo ou "só no portal"')
on conflict (id) do nothing;

-- ============================================================
-- FIM — SOMA 18.0
--
-- Depois de rodar, o teste está no portal: sininho ->
-- Preferências de e-mail -> "Enviar um e-mail de teste".
-- ============================================================
