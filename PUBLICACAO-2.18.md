# Publicação do SOMA 2.18.0

Este checklist não foi executado contra produção. As validações de desenvolvimento usam PostgreSQL local e Supabase simulado.

### O que um admin confere em produção ANTES de aplicar

Rode cada consulta no SQL Editor e guarde o resultado.

1. **Os grupos da semente existem com esses nomes?**
   ```sql
   select id, nome, chave, ativo, pai_id from grupos
    where upper(nome) in ('NRO_PESSOAL','NRO_PS','NRO_LEADERSHIP') or chave = 'pessoal';
   ```
   Se o nome real for outro (por exemplo "Depto de Pessoal" sem `NRO_PESSOAL`), a semente usa o de `chave='pessoal'` para pessoal. Seleção e liderança ficam sem grupo, com um aviso, e precisam ser definidas em Administração › Grupos logo depois.

2. **Relatório `perfis.papel` × grupos (quem ganha e quem perde).**
   ```sql
   with gp(nome, papel) as (values ('NRO_PESSOAL','pessoal'), ('NRO_PS','selecao'), ('NRO_LEADERSHIP','lideranca'))
   select p.email, p.papel as papel_na_conta, m.nome, m.status,
          (select string_agg(gp.papel || ' via ' || g.nome, ', ')
             from gp join grupos g on upper(g.nome) = gp.nome
            where g.id = any(grupos_de(p.registro))) as papeis_por_grupo
     from perfis p left join membros m on m.registro = p.registro
    order by p.papel, p.email;
   ```
   - `papel_na_conta = 'pessoal'` ou `'selecao'` sem o papel correspondente por grupo: a pessoa continua com acesso nesta versão (legado), mas perde quando a transição acabar. Ponha-a no grupo.
   - `papeis_por_grupo` com liderança: a pessoa passa a ler a ficha de todos (dados pessoais, avaliações, acessos) e todos os quadros. Confira se é isso.

3. **Quem fica bloqueado ao aplicar** (contas que perdem tudo na hora, inclusive admin):
   ```sql
   select p.email, p.papel, m.nome, m.status from perfis p join membros m on m.registro = p.registro
    where m.status in ('Desligado','Egresso','Sob demanda') order by p.papel, m.status;
   ```
   Um **admin** que apareça aqui perde o acesso. Antes de aplicar, corrija o status ou desvincule a conta (registro nulo).

4. **As funções e políticas da lista existem com o texto esperado?** Depois de aplicar, procure no resultado do Run as linhas `NOTICE: Papéis por grupo: não reconheci ...` e `Card espelhado: não reconheci ...`. Cada uma é uma função cujo teste de papel ficou como estava e precisa de ajuste à mão. O resultado também mostra `N trocas na lista de escrita` e `N tabelas com a trava`. Para conferir:
   ```sql
   select tablename, policyname, qual, with_check from pg_policies
    where policyname in ('okr_insert','okr_delete','okrcom_delete','pavisos_select','pavisos_write','plinks_write',
      'pdocs_select','pdocs_write','evtipos_write','agpred_write','siteprj_write','eroteiros_gestao','eprog_ler',
      'doc_emcfg_update','evx_cfg_update','doc_emit_select');
   select proname from pg_proc where pronamespace = 'public'::regnamespace
      and prosrc ~ 'papel_atual\(\)\s*(not\s+)?in\s*\(\s*''admin''\s*,\s*''pessoal''\s*\)';   -- o que ficou admin/pessoal
   ```

5. **Políticas da ficha de produção.** A migração apaga e recria `dados_all`, `aval_select`, `aval_insert`, `acessos_select`, `ocorr_select` e `ocorr_insert`. Se produção tiver outra política nessas tabelas com `using (true)`, ela continua abrindo a leitura:
   ```sql
   select tablename, policyname, cmd, qual, with_check from pg_policies
    where tablename in ('dados_pessoais','avaliacoes','acessos_concedidos','ocorrencias') order by 1, 2;
   ```


## Ordem de publicação

1. Guardar backup e os resultados das consultas acima. Confirmar que existe admin ativo e que os grupos/responsáveis estão corretos.
2. Aplicar `db/2.18.0_soma.sql` inteiro, após a 2.17.0. Conferir todos os avisos “não reconheci” e as consultas CONFERIR no rodapé. A migração não corrige automaticamente políticas de produção com nomes desconhecidos.
3. Publicar o `brand` com os downloads e assets novos; publicar o portal e a página pública de validação junto com `fontes-pdf.js` e `fontes/`. Confirmar `/rsvp`, `/quiosque` e `/descadastrar` no host estático.
4. Republicar `notificar-email` e `agenda-sync`. A primeira continua com verificação automática de JWT desligada e autorização interna da fila. Não alterar os segredos existentes.
5. Conferir o cron `soma-fila` e a configuração do provedor. A mesma passagem cria o ciclo semanal e os boletins dos períodos anteriores, mas não envia boletim sem três aprovações. Conferir configuração de prazo/reunião, responsáveis dos grupos, vínculos de Marca e tipos de evento com ata.
6. Fazer um teste controlado com destinatário autorizado: preferências, aprovação do boletim, envio, baixa e descadastro. Conferir no provedor antes de repetir um envio cuja baixa falhou. O link público de descadastro exige confirmação; o cabeçalho de descadastro de um clique é enviado quando o provedor suporta esse contrato.
7. Conferir uma conta ativa, uma liderança, um admin e uma conta bloqueada. Gerar a folha única de check-in somente quando o QR anterior puder ser substituído.

```sql
select count(*),count(distinct registro) from notificacao_canais;
select email_modo,count(*) from notificacao_preferencias group by 1;
select notificacoes_email_lote(500);
select jobname,schedule,active from cron.job where jobname='soma-fila';
select chave,serie_id from marca_vinculos order by chave;
select nome,responsaveis from grupos where ativo and cardinality(responsaveis)>0;
```

Quem estava em “imediato” sem escolha explícita passa ao resumo semanal; isso está nas notas da versão. Os papéis legados de Pessoal e Seleção ainda funcionam nesta versão, mas devem ser transferidos para os grupos.

## Limites da validação local

PostgreSQL local não reproduz os serviços gerenciados Cron, Vault, Storage, Google e provedores de e-mail. Os testes usam seus contratos e fixtures. Nenhum e-mail real foi enviado e nenhuma migração foi aplicada no Supabase de produção.

No manual da marca, redução mínima dos logos, unidade de área de proteção e equivalências oficiais CMYK/Pantone continuam pendentes de definição institucional.
