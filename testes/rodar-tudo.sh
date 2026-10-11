#!/usr/bin/env bash
# Roda todos os testes de navegador, um por vez, e resume o resultado.
# Antes: `npm install` nesta pasta e o portal servido da raiz do repositório:
#   (cd .. && python3 -m http.server 8765)
# Uso: bash testes/rodar-tudo.sh      (os logs ficam em testes/.logs/)
cd "$(dirname "$0")"
mkdir -p .logs
falhou=0
for t in *.mjs; do
  n=${t%.mjs}
  timeout 300 node "$t" > ".logs/$n.log" 2>&1; c=$?
  [ $c -ne 0 ] && falhou=1
  printf '%-28s exit=%s  %s\n' "$n" "$c" "$(tail -1 ".logs/$n.log" | cut -c1-70)"
done
# os testes do quiosque regravam as capturas: não entram no commit
git -C .. checkout -- testes/testes/ 2>/dev/null
exit $falhou
