# Curadoria da Biblioteca

Uma LLM procura itens parecidos com os da Biblioteca; uma pessoa revisa; o SQL entra no banco.
Nada aqui grava no banco nem guarda credencial.

1. **Catálogo atual.** Rode `node curadoria.mjs catalogo-sql`, cole o resultado no SQL Editor
   do Supabase e salve como `catalogo.json`. Sem ele, o script usa a semente do repositório
   (não conhece o que a equipe adicionou depois).
2. **Pedido.** `node curadoria.mjs prompt --catalogo catalogo.json > pedido.txt`. O foco gira
   por semana (use `--foco "tema"` para fixar; `--n 20` para mais itens). Entregue `pedido.txt`
   a uma LLM **com acesso à web**.
3. **Validação.** Salve a resposta como `respostas.json` e rode
   `node curadoria.mjs validar respostas.json --catalogo catalogo.json`. Saem
   `respostas.aprovados.json` e `respostas.rejeitados.json` (com o motivo). Rejeita: endereço
   que não é https, repetido, sem fonte, tipo inválido, fontes de acesso não autorizado.
4. **SQL.** `node curadoria.mjs sql respostas.aprovados.json > novos.sql`. Leia, confira as
   fontes e rode no Supabase. Os itens entram "Ainda não testada" e "Curadoria"; nunca como
   "Padrão da NRO".

Para rodar toda semana, agende o passo 2 (uma rotina do Claude Code, por exemplo) e abra os
resultados para revisão. O contexto da equipe está em `contexto.md`: edite-o quando mudar o foco.

Teste: `node testes/biblioteca-curadoria.mjs`.
