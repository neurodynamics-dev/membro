#!/usr/bin/env bash
# ============================================================
# Carga e concorrência do NeuroQuiz (2.29.0), num PostgreSQL de verdade.
# 40 jogadores, cada um na sua conexão, ao mesmo tempo:
#   A. todos respondem juntos (e tentam responder de novo): uma resposta
#      por jogador, a contagem fecha com o que entrou;
#   B. a TV fecha a rodada no meio das respostas: o que entrou antes
#      conta, o que chegou depois é recusado, ninguém fica pela metade;
#   C. o prazo vence com os 40 consultando o estado ao mesmo tempo: a
#      rodada fecha uma vez só, e nada entra depois de prazo + 0,5 s;
#   D. duas TVs apertam o espaço juntas, dez vezes: anda um passo por vez.
# Uso, da pasta db/ (PGHOST/PGPORT/PGUSER como no preparar-base.sh, com
# o tbase pronto):
#   bash testes/2.29.0_neuroquiz_carga.sh
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
DB=tcarga_quiz
N=40
P="psql -X -q -v ON_ERROR_STOP=1 -d $DB"
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT

dropdb --if-exists "$DB" >/dev/null; createdb -T tbase "$DB"
$P -f testes/2.18.0_soma.sql >/dev/null 2>&1
$P -f 2.29.0_neuroquiz.sql >/dev/null 2>&1
$P >/dev/null <<SQL
create or replace function eu(p_uid text) returns void language sql as \$\$ select set_config('teste.uid', p_uid, false) \$\$;
insert into membros (registro, nome, grupos, status) values (90, 'Lia Quintas', '{NRO_LEADERSHIP}', 'Ativo') on conflict do nothing;
insert into perfis (id, email, papel, registro, nome) values ('00000000-0000-0000-0000-000000000090', 'lia@nro.dev', 'leitura', 90, 'Lia Quintas') on conflict do nothing;
insert into membros (registro, nome, status)
  select 100 + g, 'Jogador ' || g || ' Teste', 'Ativo' from generate_series(1, $N) g on conflict do nothing;
insert into perfis (id, email, papel, registro, nome)
  select ('00000000-0000-0000-0000-' || lpad((100 + g)::text, 12, '0'))::uuid, 'j' || g || '@nro.dev', 'leitura', 100 + g, 'Jogador ' || g
    from generate_series(1, $N) g on conflict do nothing;
select eu('00000000-0000-0000-0000-000000000090');
select quiz_pergunta_salvar(jsonb_build_object('texto', 'Pergunta ' || g, 'tempo_s', case when g = 3 then 5 else 20 end,
  'alternativas', '[{"texto":"a","correta":true},{"texto":"b"},{"texto":"c"},{"texto":"d"}]'::jsonb)) from generate_series(1, 14) g;
select quiz_sessao_criar('{"leitura_s":0,"placar_cada":0}');
SQL
SID=$($P -t -A -c "select id from quiz_sessoes order by criada_em desc limit 1")
PIN=$($P -t -A -c "select pin from quiz_sessoes where id = '$SID'")
host() { $P -t -A -c "select eu('00000000-0000-0000-0000-000000000090')" -c "$1" | tail -1; }
uid() { printf '00000000-0000-0000-0000-%012d' $((100 + $1)); }
vez() { $P -t -A -c "select seq from quiz_sessoes where id = '$SID'"; }

# todos entram, ao mesmo tempo
for i in $(seq 1 $N); do
  $P -t -A -c "select eu('$(uid $i)')" -c "select quiz_entrar('$PIN')->>'status'" | tail -1 > "$T/entrar.$i" &
done; wait
[ "$(cat "$T"/entrar.* | sort -u)" = "ok" ] || { echo "FALHOU: nem todos entraram"; exit 1; }
echo "  ok   $N entraram juntos pelo PIN"

# ---------- A. todos respondem juntos, e de novo --------------------------
host "select quiz_avancar('$SID', $(vez))->>'passo'" >/dev/null
t0=$(date +%s%N)
for i in $(seq 1 $N); do
  l=$((RANDOM % 4))
  $P -t -A -c "select eu('$(uid $i)')" -c "select quiz_responder('$SID', 1, $l)->>'status'" \
     -c "select quiz_responder('$SID', 1, $(( (l + 1) % 4 )))->>'status'" | tail -2 | tr '\n' ' ' | sed 's/ $/\n/' > "$T/a.$i" &
done; wait
t1=$(date +%s%N)
$P -v ON_ERROR_STOP=1 >/dev/null <<SQL
do \$\$ begin
  if (select count(*) from quiz_respostas where sessao_id = '$SID' and ordem = 1) <> $N then raise exception 'FALHOU: A, respostas'; end if;
end \$\$;
SQL
[ "$(cat "$T"/a.* | sort -u)" = "ok ja_respondeu" ] || { echo "FALHOU: A, status: $(cat "$T"/a.* | sort | uniq -c)"; exit 1; }
host "select quiz_avancar('$SID', $(vez))->>'passo'" >/dev/null
$P >/dev/null <<SQL
do \$\$ begin
  if (select (select sum(c) from unnest(contagem) c) from quiz_rodadas where sessao_id = '$SID' and ordem = 1) <> $N then raise exception 'FALHOU: A, contagem'; end if;
  if (select count(distinct posicao) from quiz_jogadores where sessao_id = '$SID') <> $N then raise exception 'FALHOU: A, posições'; end if;
end \$\$;
SQL
echo "  ok   A: $N responderam juntos (e de novo): $N respostas, a segunda recusada, contagem e posições fecham ($(( (t1 - t0) / 1000000 )) ms para as $((N * 2)) chamadas)"

# ---------- B. a TV fecha no meio das respostas -----------------------------
host "select quiz_avancar('$SID', $(vez))->>'passo'" >/dev/null
S=$(vez)
for i in $(seq 1 $N); do
  d=$(awk -v r=$RANDOM 'BEGIN { printf "%.3f", r / 32767 * 1.2 }')
  $P -t -A -c "select eu('$(uid $i)')" -c "select pg_sleep($d)" -c "select quiz_responder('$SID', 2, $((RANDOM % 4)))->>'status'" | tail -1 > "$T/b.$i" &
done
sleep 0.6; host "select quiz_avancar('$SID', $S)->>'passo'" > "$T/b.host"
wait
ACEITAS=$(grep -l '^ok$' "$T"/b.[0-9]* | wc -l | tr -d ' ')
RECUSADAS=$(grep -l '^encerrada$' "$T"/b.[0-9]* | wc -l | tr -d ' ')
$P >/dev/null <<SQL
do \$\$ declare r quiz_rodadas; begin
  select * into r from quiz_rodadas where sessao_id = '$SID' and ordem = 2;
  if (select count(*) from quiz_respostas where sessao_id = '$SID' and ordem = 2) <> $ACEITAS then raise exception 'FALHOU: B, aceitas ≠ gravadas'; end if;
  if (select sum(c) from unnest(r.contagem) c) <> $ACEITAS then raise exception 'FALHOU: B, a contagem não fecha'; end if;
  if exists (select 1 from quiz_respostas where sessao_id = '$SID' and ordem = 2 and recebida_em > r.encerrada_em) then raise exception 'FALHOU: B, resposta depois de fechar'; end if;
  if (select count(*) from quiz_jogadores j where sessao_id = '$SID' and pontos <> (select coalesce(sum(pontos + bonus), 0) from quiz_respostas x where x.sessao_id = j.sessao_id and x.uid = j.uid)) > 0
    then raise exception 'FALHOU: B, pontos do jogador ≠ soma das respostas'; end if;
end \$\$;
SQL
[ $((ACEITAS + RECUSADAS)) -eq $N ] || { echo "FALHOU: B, $ACEITAS + $RECUSADAS ≠ $N: $(cat "$T"/b.[0-9]* | sort | uniq -c)"; exit 1; }
echo "  ok   B: a TV fechou no meio: $ACEITAS entraram antes e contam, $RECUSADAS chegaram depois e foram recusadas; pontos = soma das respostas"

# ---------- C. o prazo vence com todos consultando -------------------------
host "select quiz_avancar('$SID', $(vez))->>'passo'" >/dev/null   # rodada 3, 5 s
S=$(vez)
for i in $(seq 1 $N); do
  d=$(awk -v r=$RANDOM 'BEGIN { printf "%.3f", 4.0 + r / 32767 * 2.0 }')   # de 4 a 6 s: o prazo é 5 s (+0,5)
  $P -t -A -c "select eu('$(uid $i)')" -c "select pg_sleep($d)" -c "select quiz_responder('$SID', 3, 0)->>'status'" | tail -1 > "$T/c.$i" &
done; wait
for i in $(seq 1 $N); do
  $P -t -A -c "select eu('$(uid $i)')" -c "select quiz_estado('$SID')->'sessao'->>'fase'" | tail -1 > "$T/ce.$i" &
done; wait
$P >/dev/null <<SQL
do \$\$ declare r quiz_rodadas; begin
  select * into r from quiz_rodadas where sessao_id = '$SID' and ordem = 3;
  if exists (select 1 from quiz_respostas where sessao_id = '$SID' and ordem = 3 and recebida_em > r.prazo + interval '500 milliseconds')
    then raise exception 'FALHOU: C, entrou depois de prazo + 0,5 s'; end if;
  if exists (select 1 from quiz_respostas where sessao_id = '$SID' and ordem = 3 and tempo_ms > 5000) then raise exception 'FALHOU: C, tempo acima do limite'; end if;
  if (select seq from quiz_sessoes where id = '$SID') <> $S + 1 then raise exception 'FALHOU: C, a rodada fechou mais de uma vez'; end if;
  if (select fase from quiz_sessoes where id = '$SID') <> 'revelacao' then raise exception 'FALHOU: C, não fechou'; end if;
end \$\$;
SQL
NOPRAZO=$(grep -l '^ok$' "$T"/c.[0-9]* | wc -l | tr -d ' ')
FORA=$(grep -l '^fora_do_prazo$' "$T"/c.[0-9]* | wc -l | tr -d ' ')
echo "  ok   C: o prazo de 5 s: $NOPRAZO dentro (até 5,5 s), $FORA fora; os $N consultaram juntos e a rodada fechou uma vez só"

# ---------- D. duas TVs, o mesmo toque -------------------------------------
for k in $(seq 1 10); do
  S=$(vez); R0=$($P -t -A -c "select rodada from quiz_sessoes where id = '$SID'")
  host "select quiz_avancar('$SID', $S)->>'passo'" > "$T/d1" & host "select quiz_avancar('$SID', $S)->>'passo'" > "$T/d2" & wait
  [ "$(vez)" -eq $((S + 1)) ] || { echo "FALHOU: D, andou $(( $(vez) - S )) passos"; exit 1; }
  [ "$(sort "$T/d1" "$T/d2" | tr '\n' ' ')" = "desatualizado ok " ] || { echo "FALHOU: D, $(cat "$T/d1" "$T/d2")"; exit 1; }
done
echo "  ok   D: duas TVs apertaram juntas 10 vezes: cada vez, um passo só (a outra recebeu 'desatualizado')"
dropdb "$DB"
echo "2.29.0, carga: tudo certo"
