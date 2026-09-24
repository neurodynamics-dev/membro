# Roteiros dos vídeos dos treinamentos

Cada treinamento em `treinamentos/` marca, no ponto do texto em que o vídeo
entra, uma linha assim:

```
[VÍDEO A GRAVAR: NRO-TRE-002/V1 — marcar um compromisso, convidar pessoas e responder a um convite]
```

Enquanto essa linha existir, o portal **não deixa publicar** o treinamento —
é uma pendência, como o `[CONFIRMAR: …]`. Este diretório tem o roteiro de
cada vídeo, um arquivo por treinamento:

| Arquivo | Vídeos | Tempo total |
|---|---|---|
| [NRO-TRE-001-roteiros.md](NRO-TRE-001-roteiros.md) — Introdução ao SOMA | V1, V2 | ~6 min |
| [NRO-TRE-002-roteiros.md](NRO-TRE-002-roteiros.md) — Gestão de tempo e agenda | V1, V2, V3, V4 | ~11 min |
| [NRO-TRE-003-roteiros.md](NRO-TRE-003-roteiros.md) — ISO 9001: documentação e Arquivos | V1, V2, V3 | ~9 min |
| [NRO-TRE-004-roteiros.md](NRO-TRE-004-roteiros.md) — Gestão de redes sociais | V1, V2, V3 | ~10 min |
| [NRO-TRE-005-roteiros.md](NRO-TRE-005-roteiros.md) — Confidencialidade da informação | V1, V2 | ~6 min |
| [NRO-TRE-006-roteiros.md](NRO-TRE-006-roteiros.md) — Gestão de projetos | V1, V2, V3, V4 | ~11 min |

São 18 vídeos curtos, de 2 a 4 minutos. Curto de propósito: um vídeo por
tarefa, no ponto do texto em que a pessoa precisa dele. Quem quiser rever
"como sinaliza uma atividade" acha o vídeo de 3 minutos, não o minuto 23 de
uma aula.

## Antes de gravar

**A tela**

- Grave em **1920 × 1080**, só a janela do navegador, com o zoom em **125%**
  — o texto fica legível no celular.
- Esconda a barra de favoritos, as extensões e as notificações do sistema.
- Use sempre o **mesmo tema** (claro ou escuro) em todos os vídeos de um
  treinamento.
- Ligue o destaque do cursor, se o gravador tiver; mova o mouse devagar e
  pare sobre o que a narração cita.

**O som**

- Microfone perto da boca, num lugar sem eco (um quarto com cortina é
  melhor que uma sala vazia).
- Leia a narração em voz alta uma vez antes de gravar. Ela está escrita para
  ser falada: frases curtas, em segunda pessoa, no mesmo tom do texto.
- Dá para gravar a tela primeiro e a voz depois, por cima.

**Os dados** — é aqui que o treinamento de confidencialidade vale para nós

- **Nada de dado pessoal de terceiros na tela**: telefone, e-mail pessoal,
  ficha, avaliação. Onde aparecer, desfoque na edição (o editor do YouTube
  Studio tem *Desfocar › Desfoque personalizado*).
- **Nada de projeto que ainda não é público**: grave com um projeto cujas
  informações já estão nas informações públicas de projetos (NRO-MKT-002,
  em Arquivos), ou desfoque.
- **O endereço secreto `.ics`** (vídeo NRO-TRE-002/V3) é uma credencial.
  Desfoque-o e, depois de gravar, gere um novo — os passos estão no roteiro.
- Tudo o que você criar só para o vídeo leva **`[TESTE]`** no título e é
  apagado ou cancelado logo depois. Quem for convidado ou marcado recebe
  aviso de verdade: combine antes com a pessoa.
- Onde o roteiro precisa de **duas pessoas** (aprovar o que outro enviou —
  os quatro olhos), está escrito em *Preparação*.

## Depois de gravar

1. Suba no canal da NeuroDynamics no YouTube como **Não listado**. (Privado
   não toca no portal.)
2. Título no YouTube: `SOMA · <título do vídeo> | NRO-TRE-00X V<n>` —
   por exemplo, `SOMA · Marcar um compromisso na agenda | NRO-TRE-002 V1`.
3. Capa: no **Studio › Criar publicação**, tamanho **Thumbnail 16:9
   (1280 × 720)**, com o título curto e o código do treinamento.
4. No portal, abra o treinamento em **Treinamentos › Gestão** e depois
   **Editar** (`#/treinamentos/NRO-TRE-00X/editar`). No módulo indicado no
   roteiro, troque a linha do marcador pelo bloco de vídeo:

   ````
   ```video
   https://www.youtube.com/watch?v=XXXXXXXXXXX
   Marcar um compromisso na agenda
   ```
   ````

   A primeira linha é o link; a segunda, o título que aparece no player.
5. Quando o último marcador sai, **Publicar** fica livre.

> Se preferir editar o `.md` deste repositório e importar de novo pelo
> editor, o efeito é o mesmo: o portal lê o formato do README dos
> treinamentos.
