# NeuroQuiz

O quiz ao vivo da equipe, dentro do SOMA. Fica em `membro.neurodynamics.dev/quiz/` e não tem link em nenhum menu (`noindex`).

| Endereço | Quem usa | O que é |
| --- | --- | --- |
| `/quiz/` | quem joga | o celular: digita o PIN |
| `/quiz/#123456` | quem joga | o celular, já na partida (é o que o QR da TV abre) |
| `/quiz/#editor` | gestão | as perguntas, a importação do docx e as partidas |
| `/quiz/#tv/<partida>` | gestão | a TV: lobby, pergunta, revelação, placar e pódio |

- **Só com a conta do SOMA.** Quem joga entra com o nome e a foto do SOMA, sem digitar apelido. A conta Desligada, Egressa ou Sob demanda não joga (`conta_ativa`).
- **Editar e conduzir é da gestão:** admin, Depto. de Pessoal e liderança (`eh_gestao`). A regra fica no banco (RLS e as funções `quiz_*` da `db/2.29.0_neuroquiz.sql`). A interface só não oferece o que a pessoa não pode fazer.
- **O tempo é do banco.** A pergunta abre em `iniciada_em`, que é o horário do banco ao liberar mais a leitura. A resposta conta pela hora de chegada no banco. As telas usam a diferença para o relógio do banco, medida a cada chamada, então a contagem da TV e a do celular andam juntas.
- **O tempo real** vem do Supabase Realtime, no canal `neuroquiz:<partida>`. O canal leva só a fase, o seq, os horários e, na revelação, as letras certas; nunca nome, foto ou texto. Sem Realtime, as telas consultam sozinhas a cada 1 a 3 segundos.
- **O som** só toca na TV. São trilhas e efeitos originais, sintetizados no navegador (`sons.js`): lobby, contagem, tique dos últimos 5 s, gongo, revelação, placar, rufar e fanfarra do pódio.

## Os pontos

- **Errar ou não responder:** 0.
- **Acertar em até 0,5 s:** todos os pontos da pergunta.
- **Acertar depois de 0,5 s:** `pontos × (1 − tempo ÷ limite ÷ 2)`, ou seja, de 1000 até 500 no fim do tempo.
- **Valor da pergunta:** 1000 (padrão), 2000 (dobro) ou 0 (sem pontos).
- **Bônus de sequência** (pode ser desligado na partida): do 2º acerto seguido em diante, +100 por acerto anterior, até +500.
- **Mais de uma certa:** qualquer uma das certas vale.
- **Tolerância:** a resposta que chega até 0,5 s depois do prazo ainda vale, para cobrir o atraso da rede.

## O ritmo (2.30.0)

- **Tempo padrão:** 8 s por pergunta (pergunta nova e importada). Dá para mudar pergunta por pergunta no editor.
- **Ordem aleatória:** cada partida nova embaralha as perguntas ativas. Desmarque "Ordem aleatória" ao criar a partida para usar a ordem do editor.
- **Avanço sozinho:** quando todos respondem, a revelação vem na hora. Depois, a TV avança sozinha: em 5 s, da revelação para a próxima pergunta, passando pelo placar quando for a vez dele, e da última revelação para o pódio. Ao criar a partida dá para escolher 3, 5 ou 8 s, ou "Só no espaço". O **espaço** avança antes e o **P** pausa e continua.

## Antes do dia (uma vez)

1. **O banco.** No Supabase, SQL Editor, cole `db/2.29.0_neuroquiz.sql` inteiro e clique em Run. No fim deve aparecer 32 funções, 12 políticas e "Realtime disponível" = `true`. Depois faça o mesmo com `db/2.30.0_neuroquiz_ritmo.sql` (8 s, ordem aleatória e o avanço sozinho).
2. **O portal.** Faça o merge do PR no `main`. O GitHub Pages publica em um ou dois minutos.
3. **As perguntas.** Abra `membro.neurodynamics.dev/quiz/#editor` com uma conta da gestão e use **Importar docx**. A revisão mostra:
   - os nomes que vieram do SOMA pelo registro;
   - o que fica desativado (sem resposta, registro inexistente, `[apelido]`);
   - o que conferir (gênero, comentários entre colchetes, "Kahoot" trocado por "NeuroQuiz").

   Clique em **Importar**.
4. **Corrigir no editor** o que ficou desativado ou com aviso. Use o lápis para editar e o interruptor para ativar. Para mudar a ordem, use as setas.
5. **Ensaio** (10 min, com duas pessoas):
   - **Nova partida**, entrar com dois celulares e jogar duas perguntas;
   - recarregar um celular no meio (ele volta igual);
   - **Partidas → Encerrar**.

## No dia

1. **Prepare o computador da TV.** Notebook no projetor (HDMI), Chrome atualizado e o som do notebook na caixa. Deixe o notebook na tomada e desligue a proteção de tela.
2. **Ligue o Wi-Fi ou o 4G.** Se o Wi-Fi do auditório estiver ruim, peça para usarem o 4G: o jogo gasta pouquíssimo.
3. **Abra a partida.** Entre em `membro.neurodynamics.dev/quiz/#editor` e use **Nova partida**. A recomendação:
   - placar a cada 3 perguntas;
   - leitura de 5 s;
   - bônus ligado;
   - texto no celular desligado; ligue se o projetor estiver muito apagado, aí o celular mostra também as alternativas.
4. **Ligue a TV.** A TV abre no lobby. Tecle **F** para tela cheia e **clique uma vez na tela** (o navegador só libera o som depois de um clique). **M** liga e desliga o som.
5. **Coloque todo mundo para dentro.** Peça para lerem o QR ou digitarem `membro.neurodynamics.dev/quiz` e o PIN. Todo mundo precisa saber a senha do SOMA: avise antes da reunião.
6. **Espaço** começa a partida. A pergunta fecha sozinha quando o tempo acaba ou quando todos respondem, e a TV avança sozinha 5 s depois de cada revelação, até o pódio (3º, 2º e 1º, com rufar e fanfarra). Espaço adianta qualquer passo; **P** pausa e continua o avanço, para quando a sala quiser rir de uma resposta.

## Se algo falhar

| O que aconteceu | O que fazer |
| --- | --- |
| Alguém não lembra a senha | "Esqueci minha senha" na própria tela. O link chega por e-mail e a senha nova se cria no portal. |
| "Esta conta não joga" | A conta é de membro Desligado, Egresso ou Sob demanda, ou não tem perfil. Só o Depto. de Pessoal muda isso no SOMA. |
| O celular recarregou, travou ou trocou de app | Abrir o mesmo link (ou o PIN de novo). Volta na mesma partida, com os mesmos pontos e, se já respondeu, em "Resposta enviada". |
| A internet do celular caiu | O envio tenta de novo sozinho. Se aparecer "Não foi enviada", tocar em **Mandar de novo**. Se chegar depois do prazo, não vale (aparece o aviso). |
| A TV travou, fechou ou o notebook reiniciou | Abrir de novo pelo **Editor → Partidas → Abrir na TV**, em qualquer computador com conta da gestão. Continua de onde estava. Duas TVs abertas não pulam pergunta: cada toque só avança o passo que a TV estava vendo. |
| Sem som | Clicar na TV, apertar **M** e conferir o volume do notebook e da caixa. |
| Uma pergunta com erro | Corrigir no editor durante o jogo. A correção vale para as perguntas que ainda não abriram. |
| As telas ficaram lentas para mudar | O Realtime caiu. As telas passam a consultar sozinhas e seguem funcionando, com um ou dois segundos a mais. |
| Ninguém consegue nada | Último recurso: **Partidas → Encerrar** e criar outra partida. Os pontos começam do zero. |

## Os arquivos

| Arquivo | O que faz |
| --- | --- |
| `index.html` | a página; carrega o supabase-js, o gerador de QR (`vendor/`) e os três scripts |
| `quiz.js` | a entrada, as rotas, o relógio do banco, o Realtime com o plano B, e as telas do celular, da TV e do editor |
| `importar.js` | lê o `.docx` (com o JSZip de `vendor/`), troca os registros pelos nomes do SOMA e monta a revisão |
| `sons.js` | as trilhas e os efeitos da TV, com a Web Audio API |
| `quiz.css` | as telas, com os tokens de `ds/`; na TV, `--u` é 1% da altura de uma tela 16:9 |

As alternativas usam cor, forma e letra:

| Letra | Forma | Família |
| --- | --- | --- |
| A | quadrado | Retina |
| B | triângulo | Lúmen |
| C | círculo | Impulso |
| D | cruz | Neuron |

As perguntas **não** moram no repositório, que é público: elas entram pelo editor e ficam no banco. Os testes do banco estão em `db/testes/2.29.0_neuroquiz.sql` (102 asserções), `db/testes/2.30.0_neuroquiz.sql` (16) e `db/testes/2.29.0_neuroquiz_carga.sh` (40 conexões ao mesmo tempo).
