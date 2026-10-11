#!/usr/bin/env bash
# Monta o banco-modelo `tbase` (esqueleto + v15 a v24) num PostgreSQL 16 local
# e roda os testes da 2.18.0 em diante num banco copiado dele.
#   PGHOST/PGPORT/PGUSER apontam para o servidor (ex.: PGHOST=/tmp/pg PGPORT=5544 PGUSER=postgres)
# Uso, da pasta db/:
#   bash testes/preparar-base.sh            monta tbase (uma vez)
#   bash testes/preparar-base.sh teste NOME arquivos-de-teste...
#        cria NOME a partir de tbase e roda, em ordem, os testes indicados
set -euo pipefail
cd "$(dirname "$0")/.."
P="psql -X -q -v ON_ERROR_STOP=1"
if [ "${1:-}" = teste ]; then
  db=$2; shift 2
  dropdb --if-exists "$db"; createdb -T tbase "$db"
  for f in "$@"; do $P -d "$db" -f "testes/$(basename "$f")"; done
  exit 0
fi
dropdb --if-exists tbase; createdb tbase
$P -d tbase -f testes/esqueleto.sql -f testes/esqueleto_storage.sql
for v in v15_atividades v16_pessoal v17_grupos_acesso v18_teste_email v19_grupos_hierarquia v20_projetos_arquivos \
         v21_rol_nro_pub_001 v22_estrutura_das_series v23_studio v24_treinamentos; do
  $P -d tbase -f "$v.sql"
done
echo "tbase pronta."
