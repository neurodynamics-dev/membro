\set ON_ERROR_STOP on
\pset pager off
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;

-- 1. o teste diz para onde vai
do $$ declare r jsonb; begin
  set local teste.registro='11'; set local teste.papel='leitura';
  r := notificacao_teste();
  perform ok(r->>'status'='ok', 'criou o aviso de teste');
  perform ok(r->>'email'='bruno@nro.dev', 'e diz para qual endereço vai ('||(r->>'email')||')');
  perform ok(r->>'modo'='imediato', 'e qual é a preferência atual ('||(r->>'modo')||')');
end $$;

-- 2. quem escolheu "só no portal" ainda recebe o TESTE
do $$ declare lote jsonb; begin
  set local teste.registro='17'; set local teste.papel='leitura';
  insert into notificacao_preferencias(registro,email_modo) values (17,'nunca')
    on conflict (registro) do update set email_modo='nunca';
  perform notificar(array[17], 'atividade_atribuida', 'Um aviso comum', 'corpo', '#/x');
  perform notificacao_teste();
  select notificacoes_email_lote(200) into lote;
  perform ok(exists(select 1 from jsonb_array_elements(lote) x
                    where (x->>'registro')::int=17), 'quem está em "nunca" entra no lote pelo teste');
  perform ok((select count(*) from jsonb_array_elements(lote) x,
                    jsonb_array_elements(x->'itens') i
              where (x->>'registro')::int=17) = 1,
             'e leva SÓ o teste — o aviso comum continua fora');
  perform ok((select i->>'tipo' from jsonb_array_elements(lote) x,
                    jsonb_array_elements(x->'itens') i
              where (x->>'registro')::int=17) = 'teste_email', 'e o que entrou é o de tipo teste_email');
end $$;

-- 3. quem está em resumo e já recebeu hoje também recebe o teste
do $$ declare lote jsonb; begin
  set local teste.registro='23'; set local teste.papel='leitura';
  insert into notificacao_preferencias(registro,email_modo,ultimo_email)
  values (23,'resumo', now()) on conflict (registro)
    do update set email_modo='resumo', ultimo_email=now();
  perform notificar(array[23], 'atividade_atribuida', 'Aviso do dia', 'corpo', '#/x');
  select notificacoes_email_lote(200) into lote;
  perform ok(not exists(select 1 from jsonb_array_elements(lote) x
                        where (x->>'registro')::int=23),
             'em resumo, tendo recebido agora, o aviso comum espera');
  perform notificacao_teste();
  select notificacoes_email_lote(200) into lote;
  perform ok(exists(select 1 from jsonb_array_elements(lote) x
                    where (x->>'registro')::int=23), 'mas o teste fura a janela do resumo');
end $$;

-- 4. sem vínculo com o quadro, o teste diz isso em vez de falhar em silêncio
do $$ declare r jsonb; begin
  set local teste.registro=''; set local teste.papel='leitura';
  r := notificacao_teste();
  perform ok(r->>'status'='sem_registro', 'conta sem registro recebe um motivo, não um erro');
end $$;

-- 5. sem e-mail na ficha, idem
do $$ declare r jsonb; begin
  update membros set email_nro=null, email_pessoal=null where registro=4;
  set local teste.registro='4'; set local teste.papel='admin';
  r := notificacao_teste();
  perform ok(r->>'status'='sem_email', 'ficha sem e-mail recebe um motivo');
  perform ok((select count(*) from notificacoes where registro=4 and tipo='teste')=0,
             'e nada é criado à toa');
end $$;

-- 6. depois da baixa, o teste não volta
do $$ declare lote jsonb; ids bigint[]; begin
  select notificacoes_email_lote(200) into lote;
  select array_agg((i->>'id')::bigint) into ids
    from jsonb_array_elements(lote) x, jsonb_array_elements(x->'itens') i;
  perform notificacoes_email_baixa(jsonb_build_object('enviadas', to_jsonb(ids)));
  select notificacoes_email_lote(200) into lote;
  perform ok(not exists(select 1 from jsonb_array_elements(lote) x,
                        jsonb_array_elements(x->'itens') i where i->>'tipo'='teste'),
             'depois da baixa o teste não é reenviado');
end $$;
