# Publicação da 2.19.0

Duas migrações: `db/2.19.0_quiosque.sql` (abaixo, com ordem que importa) e
`db/2.19.0_avisos.sql` (quadro de avisos; só acrescenta, pode ir antes ou
depois do merge, mas sem ela o editor não salva cor nem valor e os layouts
novos são recusados).

## Quiosque com conta de serviço

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

# 2.19.1: recadastro e termo de sigilo do LABBIO

1. **Aplicar** `db/2.19.1_recadastro.sql` e, depois, `db/2.19.1_termo.sql`.
   Nada aparece para os membros até a campanha começar.
2. **Publicar o HTML** (merge). O modelo do termo vai junto, em
   `termos/termo_sigilo_labbio_3.pdf`, sem nenhuma alteração; o portal
   confere o SHA-256 dele antes de gerar cada termo.
3. **Começar o recadastro**: Administração › Recadastro, código `2026-2`,
   marcar "Incluir o termo de sigilo do LABBIO". Todos os membros ativos
   recebem o aviso; na entrada, o painel de quatro passos aparece (dados,
   baixar, assinar no gov.br, enviar). Uma dispensa por pessoa; depois, o
   SOMA leva ao recadastro até concluir. Férias e afastamento pausam.
4. **Conferir os termos**: Administração › Termo de sigilo (abrir o PDF,
   conferir ou devolver com motivo). A coluna do termo aparece também no
   quadro de pessoal.
5. Nos próximos semestres, o recadastro é só a conferência dos dados: não
   marque o termo.

# 2.19.1: reporte por liderança direta

1. **Antes**: em Administração › Grupos, confirme que existem os grupos do
   PMO (nome `NRO_PMO` ou chave `pmo`), `NRO_PESSOAL` (ou chave `pessoal`),
   `NRO_COORD_OFFICE` e `NRO_MANAGERS`, e que cada liderado tem o gestor
   preenchido na ficha (`gestor_registro`). A migração avisa o grupo que
   faltar; as sinalizações ficam registradas sem cartão até ele existir.
2. **Aplicar** `db/2.19.1_reporte.sql`. O prazo passa a sexta 16h. O modelo
   novo começa nesta semana se ninguém abriu reporte por frente nela; senão,
   na próxima segunda (`reporte_config.modelo_lider_desde`).
3. **Publicar o HTML** só depois das fichas R2 a R5: até lá, a tela é a do
   modelo por frente e não enxerga o reporte novo.

# 2.19.1: gestores do LABBIO

1. **Confira** se o papel `authenticator` já tem um `pgrst.db_pre_request`:
   `select setconfig from pg_db_role_setting s join pg_roles r on r.oid = s.setrole where r.rolname = 'authenticator';`
   Se tiver outro, a migração para e avisa (as duas funções precisam ser juntadas).
2. **Aplicar** `db/2.19.1_labbio_base.sql` (depois da `2.19.0_quiosque.sql`).
   Ela liga a porta da API e manda o PostgREST recarregar a configuração.
3. **Publicar de novo** a Edge Function `notificar-email` (ela passa a mandar
   os convites do LABBIO).
4. **Conferir**: logado como membro, o portal funciona como antes. Uma conta
   de gestor (depois do convite) não lê nada do portal: qualquer chamada fora
   de `labbio_*` volta "Esta conta é do painel do LABBIO".
5. O primeiro gestor é convidado por um admin logado no SOMA, em
   Administração › LABBIO (a tela vem na ficha L2). O SQL Editor não serve:
   o convite precisa saber quem convidou.

**Plano de volta**: `alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';`
(as contas de gestor continuam sem ler tabelas, pela `conta_ativa()`).

# 2.19.1: pedido de acesso biométrico ao LABBIO

1. **Aplicar** `db/2.19.1_labbio_acesso.sql` (depois da `2.19.1_labbio_base`
   e da `2.19.1_recadastro`). Ela cria o item "Acesso biométrico ao LABBIO"
   no catálogo com a chave `labbio_biometria`. Se já havia um item para isso,
   mova a chave para ele (instrução no fim da migração).
2. **Confirmar com o LABBIO** os campos que a Intelbras pede:
   `update public.labbio_config set campos = '{nome_civil,cpf,matricula}' where id;`
   (só campos de Meus dados). A foto é obrigatória.
3. **Publicar de novo** a `notificar-email` (o aviso ao responsável principal).
4. A triagem do Pessoal continua igual: "Aprovar" num pedido de biometria
   encaminha ao LABBIO e não concede nada; o acesso entra quando o gestor
   confirma o cadastro no painel.

# 2.19.1: trainees

1. **Criar o grupo** NRO_TRAINEE em Administração › Grupos (a migração avisa
   se faltar e a admissão recusa sem ele).
2. **Aplicar** `db/2.19.1_trainees.sql`.
3. A admissão é pela tela de Seleção (ficha T2). A ps_integrar antiga continua
   existindo, mas não deve ser usada para trainees: ela cria membro efetivo.

# Ordem das migrações da 2.19.1

`2.19.1_labbio_base` → `2.19.1_recadastro` → `2.19.1_termo` →
`2.19.1_labbio_acesso` → `2.19.1_reporte` → `2.19.1_trainees`.
