# Publicação do quiosque com conta de serviço (2.19.0)

O quiosque deixa de usar o segredo escrito no `quiosque.html`. A ordem
importa: com o HTML novo no ar e o banco antigo, a TV fica sem dados; com o
banco novo e o HTML antigo, também.

## O que mudou
- `quiosque.html`, `quiosque.css`, `quiosque.js`: o painel novo (layouts A e B,
  widgets que giram, a chegada, a hora do dia). Entra com a conta do quiosque.
- `db/2.19.0_quiosque.sql`: a conta de serviço, `quiosque_estado_conta()`,
  `quiosque_painel()`, e o segredo antigo deixa de servir.

## Passo a passo
1. **Conferir o banco** (a migração para com mensagem se algo faltar):
   `public.quiosque_estado(text)` existe? `public.config_sistema(chave, valor)`
   tem a linha `segredo_quiosque`? Se a chave tem outro nome, ajuste `v_chave`
   na migração antes de aplicar. A função `quiosque_estado` não está neste
   repositório (veio do SOMA antigo), então esta conferência é sua.
2. **Criar a conta**: Supabase, Authentication, Users, Add user. E-mail
   `quiosque@neurodynamics.dev` (ou outro), senha forte, sem vínculo com membro.
   Guarde a senha no cofre da equipe; ela só é digitada uma vez na TV.
3. **Aplicar** `db/2.19.0_quiosque.sql` no SQL Editor e, logo depois, ligar a conta:
   ```sql
   insert into public.quiosque_conta(user_id)
     select id from auth.users where email = 'quiosque@neurodynamics.dev'
   on conflict (id) do update set user_id = excluded.user_id;
   ```
4. **Publicar o HTML** (merge). Na TV, abrir `quiosque.html`, entrar com a conta
   uma vez. Com `?layout=b` abre a composição de faixa e palco.
5. **Trocar o segredo antigo** em `config_sistema`: ele ficou no histórico do git.

## Conferir
- Na TV: o QR gira, a agenda de hoje aparece, o check-in de teste mostra
  "Chegada registrada".
- Logado como a conta do quiosque, `select count(*) from membros` pela API
  devolve 0 (a `conta_ativa()` falsa trava toda tabela).
- Com o segredo antigo, `quiosque_estado('...')` devolve permissão negada.

## Plano de volta
Reverter o merge do HTML e, no banco, devolver `execute` da
`quiosque_estado(text)` a `anon`:
`grant execute on function public.quiosque_estado(text) to anon, authenticated;`
(`conta_ativa()` pode ficar como está: só afeta a conta do quiosque.)

## Um cuidado
A sessão da conta do quiosque fica no navegador da TV. Por isso ela não lê
tabela nenhuma (passo 3 da migração), mas ainda pode chamar as funções do banco
liberadas a qualquer conta autenticada. Não use essa conta para mais nada, e
troque a senha se a TV for trocada de lugar.
