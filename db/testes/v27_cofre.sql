\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 27.0 — o cofre.
-- Rode num banco com o esqueleto (e o de Storage e o do Vault), a
-- 15.0 a 19.0 e a 27.0.
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;
create or replace function gid(p_nome text) returns integer language sql as $$
  select id from grupos where nome = p_nome $$;
create or replace function eu(p_reg integer, p_papel text) returns void language plpgsql as $$
begin
  perform set_config('teste.registro', coalesce(p_reg::text, ''), true);
  perform set_config('teste.papel', p_papel, true);
  perform set_config('teste.uid', coalesce((select id::text from perfis where registro = p_reg), ''), true);
end $$;
create or replace function item(p_nome text) returns uuid language sql as $$
  select id from itens_de_acesso where nome = p_nome $$;
create or replace function conta(p_rotulo text) returns uuid language sql as $$
  select id from cofre_credenciais where rotulo = p_rotulo $$;
create or replace function usos(p_id uuid, p_acao text) returns integer language sql as $$
  select count(*)::integer from cofre_log where credencial_id = p_id and acao = p_acao $$;

-- ------------------------------------------------------------
-- A equipe do teste, além do esqueleto:
--   4  Ana      admin
--   11 Bruno    Sinais — o Instagram é do grupo Sinais
--   17 Carla    Órtese — tem o "Drive da equipe" concedido na ficha
--   23 Diego    Comunicação — responsável pelo Instagram
--   31 Elis     Depto de Pessoal (papel pessoal) — não gere o cofre
--   52 Gabi     TI — o grupo gestor
-- ------------------------------------------------------------
insert into membros(registro, nome, grupos, status, email_nro) values
  (52, 'Gabi Rocha', '{TI}', 'Ativo', 'gabi@nro.dev')
on conflict do nothing;
insert into perfis(id, email, papel, registro) values
  ('00000000-0000-0000-0000-000000000004', 'ana@nro.dev',   'admin',   4),
  ('00000000-0000-0000-0000-000000000011', 'bruno@nro.dev', 'leitura', 11),
  ('00000000-0000-0000-0000-000000000017', 'carla@nro.dev', 'leitura', 17),
  ('00000000-0000-0000-0000-000000000023', 'diego@nro.dev', 'leitura', 23),
  ('00000000-0000-0000-0000-000000000031', 'elis@nro.dev',  'pessoal', 31),
  ('00000000-0000-0000-0000-000000000052', 'gabi@nro.dev',  'leitura', 52)
on conflict do nothing;
insert into itens_de_acesso(nome, categoria) values ('Instagram da equipe', 'sistema') on conflict do nothing;
insert into acessos_concedidos (registro, item_id, ativo, concedido_em)
values (17, (select id from itens_de_acesso where nome = 'Drive da equipe'), true, current_date);
do $$ begin
  perform eu(4, 'admin');
  perform grupo_salvar(jsonb_build_object('nome','TI','prefixo','TIN'));
end $$;

-- 1. o código de duas etapas, pelos vetores da RFC 6238 (apêndice B)
do $$
declare
  k1 bytea := convert_to('12345678901234567890', 'UTF8');
  k2 bytea := convert_to('12345678901234567890123456789012', 'UTF8');
  k5 bytea := convert_to('1234567890123456789012345678901234567890123456789012345678901234', 'UTF8');
begin
  perform ok(cofre_base32('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ') = k1, 'o base32 decodifica o segredo da RFC');
  perform ok(cofre_base32('gezd gnbv gy3t qojq gezd gnbv gy3t qojq') = k1, 'com espaços e minúsculas, como os serviços mostram');
  perform ok(cofre_base32('GEZD1') is null, '1 não é base32');
  perform ok(cofre_totp_calc(k1, 59 / 30, 8) = '94287082', 'SHA1, T=59: 94287082');
  perform ok(cofre_totp_calc(k1, 1111111109 / 30, 8) = '07081804', 'SHA1, T=1111111109: 07081804 (o zero à esquerda fica)');
  perform ok(cofre_totp_calc(k1, 1234567890 / 30, 8) = '89005924', 'SHA1, T=1234567890: 89005924');
  perform ok(cofre_totp_calc(k1, 20000000000 / 30, 8) = '65353130', 'SHA1, T=20000000000: 65353130');
  perform ok(cofre_totp_calc(k2, 59 / 30, 8, 'SHA256') = '46119246', 'SHA256, T=59: 46119246');
  perform ok(cofre_totp_calc(k5, 1111111111 / 30, 8, 'SHA512') = '99943326', 'SHA512, T=1111111111: 99943326');
  perform ok(cofre_totp_calc(k1, 0, 6) = '755224', 'e o HOTP da RFC 4226, contador 0: 755224');
end $$;

-- 2. quem gere
do $$ declare pegou text; begin
  perform eu(4, 'admin');   perform ok(cofre_gestor(), 'admin gere o cofre');
  perform eu(31, 'pessoal'); perform ok(not cofre_gestor(), 'o Depto. de Pessoal, não: senha não é pessoal');
  perform eu(52, 'leitura'); perform ok(not cofre_gestor(), 'nem a Gabi, antes de a TI ser escolhida');
  perform eu(4, 'admin');
  update cofre_config set grupos_gestores = array[gid('TI')];
  perform eu(52, 'leitura'); perform ok(cofre_gestor(), 'com a TI na gestão, a Gabi gere');
  begin
    update cofre_config set grupos_gestores = '{}';
  exception when others then pegou := sqlerrm; end;
  perform ok(pegou = 'cofre_so_admin', 'mas quem entra na gestão, só admin escolhe');
  update cofre_config set aviso_dias = 10;
  perform ok((select aviso_dias from cofre_config) = 10 and (select atualizado_por from cofre_config) = 'Gabi Rocha',
             'os prazos, a gestão muda');
end $$;

-- 3. cadastrar
do $$ declare r jsonb; begin
  perform eu(11, 'leitura');
  r := cofre_salvar(jsonb_build_object('item_id', item('Instagram da equipe'), 'senha', 'x'));
  perform ok(r->>'status' = 'sem_permissao', 'quem não gere não cadastra conta');
  perform eu(52, 'leitura');
  r := cofre_salvar(jsonb_build_object('item_id', gen_random_uuid()));
  perform ok(r->>'campo' = 'item_id', 'a conta é de um acesso do catálogo');
  r := cofre_salvar(jsonb_build_object('item_id', item('Instagram da equipe'), 'url', 'instagram.com'));
  perform ok(r->>'campo' = 'url', 'o endereço é http(s)');
  r := cofre_salvar(jsonb_build_object('item_id', item('Instagram da equipe'), 'totp', jsonb_build_object('segredo', 'ABC1')));
  perform ok(r->>'campo' = 'totp', 'segredo de 2FA que não é base32 não entra');
  r := cofre_salvar(jsonb_build_object('item_id', item('Instagram da equipe'), 'rotulo', 'Conta principal',
         'url', 'https://www.instagram.com/accounts/login/', 'usuario', 'neurodynamics.dev',
         'senha', 'T6#qv9!Lm2@xR8$wZ4pB', 'notas', 'Códigos de recuperação: 1111 2222 3333',
         'instrucoes', 'A conta é do e-mail comunicacao@. Entre pelo navegador, não pelo app.',
         'grupos', jsonb_build_array(gid('Sinais')), 'responsaveis', '[23]'::jsonb,
         'totp', jsonb_build_object('segredo', 'gezd gnbv gy3t qojq gezd gnbv gy3t qojq', 'digitos', 6, 'periodo', 30)));
  perform ok(r->>'status' = 'ok', 'a Gabi cadastra o Instagram, com senha, 2FA e notas');
  perform ok((select senha_id is not null and totp_id is not null and notas_id is not null from cofre_credenciais where id = conta('Conta principal')),
             'os três segredos vão para o Vault');
  perform ok((select decrypted_secret from vault.decrypted_secrets where id = (select senha_id from cofre_credenciais where id = conta('Conta principal')))
             = 'T6#qv9!Lm2@xR8$wZ4pB', 'e lá está a senha');
  perform ok((select description from vault.secrets where id = (select senha_id from cofre_credenciais where id = conta('Conta principal')))
             = 'cofre: Instagram da equipe — Conta principal (senha)', 'com uma descrição que diz de onde é');
  perform ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cofre_credenciais'
                          and column_name in ('senha','totp','notas','segredo')), 'a tabela não tem coluna de segredo');
  perform ok((select trocada_em is not null from cofre_credenciais where id = conta('Conta principal')), 'o prazo começa agora');
  r := cofre_salvar(jsonb_build_object('item_id', item('Drive da equipe'), 'rotulo', 'Administrador do Drive',
         'usuario', 'admin@neurodynamics.dev', 'senha', 'outra-senha-forte-123', 'rotacao_dias', 90));
  perform ok(r->>'status' = 'ok', 'e o administrador do Drive, que ninguém tem por grupo');
  r := cofre_salvar(jsonb_build_object('item_id', item('Laboratório 2'), 'rotulo', 'Porta', 'senha', '4815'));
  perform ok(r->>'status' = 'ok', 'um acesso físico também tem segredo: o código da porta');
end $$;

-- 4. quem usa
do $$ declare r jsonb; begin
  perform eu(11, 'leitura');
  perform ok((select count(*) from cofre_lista()) = 1 and (select via from cofre_lista() limit 1) = 'grupo',
             'o Bruno vê só o Instagram, pelo grupo Sinais');
  perform ok((select tem_senha and tem_totp and tem_notas and not tem_anterior from cofre_lista() limit 1),
             'e a lista diz o que a conta tem — sem dizer o que é');
  perform eu(17, 'leitura');
  perform ok((select string_agg(item_nome || ':' || via, ',') from cofre_lista()) = 'Drive da equipe:acesso',
             'a Carla vê o Drive, pelo acesso concedido na ficha');
  perform eu(23, 'leitura');
  perform ok((select via from cofre_lista() where rotulo = 'Conta principal') = 'responsavel', 'o Diego, como responsável');
  perform eu(31, 'pessoal');
  perform ok((select count(*) from cofre_lista()) = 0, 'o Depto. de Pessoal não vê senha nenhuma');
  perform eu(52, 'leitura');
  perform ok((select count(*) from cofre_lista()) = 3, 'a gestão vê as três');

  -- revogar o acesso tira a conta
  update acessos_concedidos set ativo = false where registro = 17;
  perform eu(17, 'leitura');
  perform ok((select count(*) from cofre_lista()) = 0, 'revogado o acesso na ficha, a Carla perde a conta na hora');
  perform ok((cofre_revelar(conta('Administrador do Drive')))->>'status' = 'nao_encontrado', 'e não revela mais a senha');
  update acessos_concedidos set ativo = true where registro = 17;
end $$;

-- 5. o segredo sai registrado
do $$ declare r jsonb; v uuid := conta('Conta principal'); begin
  perform eu(11, 'leitura');
  r := cofre_revelar(v, 'senha', 'copiar');
  perform ok(r->>'status' = 'ok' and r->>'valor' = 'T6#qv9!Lm2@xR8$wZ4pB', 'o Bruno copia a senha');
  perform ok(usos(v, 'copiou_senha') = 1 and (select nome from cofre_log where credencial_id = v and acao = 'copiou_senha') = 'Bruno Tavares',
             'e fica registrado quem copiou');
  r := cofre_revelar(v, 'notas', 'ver');
  perform ok(r->>'valor' like 'Códigos de recuperação%' and usos(v, 'viu_notas') = 1, 'as notas também, e registradas');
  r := cofre_revelar(v, 'anterior', 'ver');
  perform ok(r->>'status' = 'sem_permissao', 'a senha anterior é de quem mantém');
  r := cofre_revelar(v, 'senha', 'imprimir');
  perform ok(r->>'status' = 'invalido', 'ação desconhecida não');
  r := cofre_codigo(v);
  perform ok(r->>'status' = 'ok' and r->>'codigo' ~ '^\d{6}$' and (r->>'restante')::int between 1 and 30,
             'o código de duas etapas sai do banco, com os segundos que faltam: ' || (r->>'codigo'));
  perform ok(r->>'codigo' = cofre_totp_calc(cofre_base32('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'),
             floor(extract(epoch from clock_timestamp()))::bigint / 30, 6)
             or (r->>'restante')::int >= 29, 'e é o da janela de agora');
  perform ok(r->>'segredo' is null and not (r ? 'totp'), 'o segredo do 2FA não desce');
  perform ok(usos(v, 'codigo') = 1, 'gerar código também fica registrado');
  perform eu(17, 'leitura');
  r := cofre_codigo(v);
  perform ok(r->>'status' = 'nao_encontrado', 'a Carla não gera o código do Instagram');
end $$;

-- 6. manter e trocar
do $$ declare r jsonb; v uuid := conta('Conta principal'); v_antes uuid; begin
  perform eu(11, 'leitura');
  r := cofre_trocar_senha(v, 'nova');
  perform ok(r->>'status' = 'sem_permissao', 'quem só usa não troca a senha');
  perform eu(23, 'leitura');
  r := cofre_salvar(jsonb_build_object('id', v, 'grupos', '[]'::jsonb));
  perform ok(r->>'status' = 'sem_permissao', 'o responsável não muda quem usa');
  r := cofre_salvar(jsonb_build_object('id', v, 'senha', 'direto'));
  perform ok(r->>'campo' = 'senha', 'nem troca a senha por fora da troca');
  r := cofre_salvar(jsonb_build_object('id', v, 'usuario', 'neurodynamics', 'instrucoes', 'Entre pelo navegador.'));
  perform ok(r->>'status' = 'ok', 'mas ajusta o usuário e as instruções');
  perform ok((select detalhe from cofre_log where credencial_id = v and acao = 'editou' order by id desc limit 1) = 'usuário, instruções',
             'e o registro diz o que mudou — nunca o valor');
  -- a tela da gestão manda o formulário inteiro: o que não mudou não entra no registro
  perform eu(4, 'admin');
  r := cofre_salvar(jsonb_build_object('id', v, 'usuario', 'neurodynamics', 'rotacao_dias', null,
                                       'grupos', (select to_jsonb(grupos) from cofre_credenciais where id = v),
                                       'responsaveis', (select to_jsonb(responsaveis) from cofre_credenciais where id = v)));
  perform ok(r->>'status' = 'ok' and (select detalhe from cofre_log where credencial_id = v and acao = 'editou'
                                        order by id desc limit 1) is null,
             'salvar sem mudar nada não diz que mudou o prazo, os grupos ou os responsáveis');
  r := cofre_salvar(jsonb_build_object('id', v, 'rotacao_dias', 90));
  perform ok((select detalhe from cofre_log where credencial_id = v and acao = 'editou' order by id desc limit 1) = 'prazo de troca',
             'mudar o prazo, sim');
  r := cofre_salvar(jsonb_build_object('id', v, 'rotacao_dias', null));
  perform eu(23, 'leitura');
  r := cofre_trocar_senha(v, 'T6#qv9!Lm2@xR8$wZ4pB');
  perform ok(r->>'motivo' = 'igual', 'trocar pela mesma senha não é trocar');
  select senha_id into v_antes from cofre_credenciais where id = v;
  update cofre_credenciais set trocada_em = now() - interval '200 days' where id = v;
  r := cofre_trocar_senha(v, 'Nv8!pQ2#tR6$wX9@zL4&');
  perform ok(r->>'status' = 'ok', 'o Diego troca a senha');
  perform ok((select senha_anterior_id from cofre_credenciais where id = v) = v_antes, 'a anterior fica guardada');
  perform ok((select senha_anterior_ate::date from cofre_credenciais where id = v) = (now() + interval '30 days')::date,
             'por 30 dias');
  perform ok((select trocada_em > now() - interval '1 minute' from cofre_credenciais where id = v), 'e o prazo recomeça');
  r := cofre_revelar(v, 'anterior', 'ver');
  perform ok(r->>'valor' = 'T6#qv9!Lm2@xR8$wZ4pB', 'quem mantém vê a anterior, se o serviço não aceitou a nova');
  r := cofre_trocar_senha(v, 'Terceira-senha-99!');
  perform ok((select count(*) from vault.secrets where description like 'cofre: Instagram da equipe — Conta principal (senha)') = 2,
             'trocar de novo apaga a anterior da anterior: ficam duas no Vault, a de agora e a de antes');
  r := cofre_salvar(jsonb_build_object('id', v, 'totp', null));
  perform ok(r->>'status' = 'ok' and (select totp_id from cofre_credenciais where id = v) is null, 'tirar o 2FA apaga o segredo');
  perform ok((select count(*) from vault.secrets where description like '%Conta principal (2FA)') = 0, 'do Vault também');
end $$;

-- 7. a troca periódica
do $$ declare v uuid := conta('Administrador do Drive'); n integer; begin
  perform eu(52, 'leitura');
  perform ok((select situacao from cofre_lista() where id = v) = 'em_dia', 'o Drive está em dia');
  update cofre_credenciais set trocada_em = now() - interval '85 days' where id = v;
  perform ok((select situacao from cofre_lista() where id = v) = 'vence_logo', 'faltando 5 dias (aviso de 10), vence logo');
  perform ok(cofre_pendencias() = 1, 'e é pendência da gestão, porque não tem responsável');
  n := cofre_lembretes();
  perform ok(n = 1, 'o lembrete sai para uma conta');
  perform ok((select count(*) from notificacoes where tipo = 'cofre_troca' and titulo = 'Trocar a senha: Drive da equipe — Administrador do Drive') = 2,
             'para a gestão (Gabi) e para admin (Ana)');
  perform ok(cofre_lembretes() = 0, 'e não sai de novo no mesmo dia');
  update cofre_credenciais set trocada_em = now() - interval '100 days', lembrado_em = now() - interval '8 days' where id = v;
  perform ok((select situacao from cofre_lista() where id = v) = 'vencida', 'passado o prazo, vencida');
  perform ok(cofre_lembretes() = 1, 'e o lembrete volta uma semana depois');
  update cofre_credenciais set rotacao_dias = 0 where id = v;
  perform ok((select situacao from cofre_lista() where id = v) = 'sem_troca', 'prazo zero: não pede troca');
end $$;

-- 8. quem viu e saiu deixa a senha exposta
do $$ declare v uuid := conta('Conta principal'); begin
  perform eu(11, 'leitura');
  perform cofre_revelar(v, 'senha', 'ver');
  update membros set status = 'Desligado' where registro = 11;
  perform eu(23, 'leitura');
  perform ok((select situacao from cofre_lista() where id = v) = 'exposta', 'o Bruno viu a senha e saiu: a conta pede troca');
  perform ok(cofre_pendencias() = 1, 'e é pendência do responsável');
  perform eu(11, 'leitura');
  perform ok((select count(*) from cofre_lista()) = 0, 'desligado, o Bruno não vê mais nada');
  perform eu(23, 'leitura');
  perform cofre_trocar_senha(v, 'Quarta-senha-depois-da-saida!');
  perform ok((select situacao from cofre_lista() where id = v) = 'em_dia', 'trocada, deixa de estar exposta');
  update membros set status = 'Ativo' where registro = 11;
end $$;

-- 9. o registro de uso e excluir
do $$ declare r jsonb; v uuid := conta('Porta'); begin
  perform eu(23, 'leitura');
  perform ok((select count(*) from cofre_log_ler(conta('Conta principal'))) >= 8, 'o responsável lê o registro de uso da conta dele');
  perform ok((select count(*) from cofre_log_ler(null)) = 0, 'mas não o de todas');
  perform ok((select count(*) from cofre_log_ler(v)) = 0, 'nem o de outra conta');
  perform eu(52, 'leitura');
  perform ok((select count(*) from cofre_log_ler(null)) > 10, 'a gestão lê tudo');
  perform eu(23, 'leitura');
  r := cofre_excluir(v);
  perform ok(r->>'status' = 'sem_permissao', 'o responsável não exclui');
  perform eu(52, 'leitura');
  r := cofre_excluir(v);
  perform ok(r->>'status' = 'ok' and not exists (select 1 from cofre_credenciais where id = v), 'a gestão exclui');
  perform ok((select count(*) from vault.secrets where description like '%— Porta%') = 0, 'e os segredos saem do Vault');
  perform ok((select conta from cofre_log where acao = 'excluiu' order by id desc limit 1) = 'Laboratório 2 — Porta',
             'o registro de uso fica, com o nome da conta');
end $$;

-- 10. RLS: nada se lê direto
grant select, insert, update, delete on all tables in schema public to authenticated, anon;
do $$ begin perform set_config('teste.registro', '52', false); perform set_config('teste.papel', 'leitura', false); end $$;
set role authenticated;
do $$ declare pegou boolean := false; begin
  perform ok((select count(*) from cofre_credenciais) = 0, 'nem a gestão lê a tabela das contas direto');
  perform ok((select count(*) from cofre_log) = 0, 'nem o registro de uso');
  begin
    perform count(*) from vault.decrypted_secrets;
  exception when insufficient_privilege then pegou := true; end;
  perform ok(pegou, 'e o Vault é fechado para authenticated');
  pegou := false;
  begin
    perform cofre_segredo((select gen_random_uuid()));
  exception when insufficient_privilege then pegou := true; end;
  perform ok(pegou, 'como a função que lê um segredo do Vault');
  pegou := false;
  begin
    perform cofre_totp_calc('\x00'::bytea, 1);
  exception when insufficient_privilege then pegou := true; end;
  perform ok(pegou, 'e a que calcula o código');
end $$;
reset role;
set role anon;
do $$ declare pegou boolean := false; begin
  begin
    perform cofre_lista();
  exception when insufficient_privilege then pegou := true; end;
  perform ok(pegou, 'a chave anônima não chega perto do cofre');
end $$;
reset role;

-- 11. rodar de novo não muda nada
\ir ../v27_cofre.sql
do $$ begin
  perform ok((select grupos_gestores from cofre_config) = array[gid('TI')], 'rodar a 27.0 de novo não desfaz a gestão');
  perform ok((select count(*) from cofre_credenciais) = 2, 'nem as contas');
end $$;
\echo '== 27.0: tudo certo'
