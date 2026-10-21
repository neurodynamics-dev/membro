# Imagens do full mailer

PNGs referenciados **por link** nos e-mails gerados em Administração →
E-mails (o Full mailer, `https://membro.neurodynamics.dev/mailer/…`, servidos
pelo GitHub Pages deste repositório). A mesma pasta continua no repositório
antigo, servida por `pessoal.neurodynamics.dev`: e-mail já enviado aponta para
lá. Nada é embutido no HTML do e-mail: imagem
em data-URI vira anexo do documento nos clientes de e-mail — ou é descartada.

## Arquivos

- `logo-<cor>.png` — imagotipo NeuroDynamics recolorido, 564 px de largura
  (3× dos 188 px exibidos). Uma variante por cor `logo` dos temas
  (`THEMES_MAILER` no `mod-mailer.js`): `00594f`, `0f7c8a`, `8a6d1f`, `cedc00`,
  `5c7a00`, `ffffff`, `1d1d1f`, `3b4d9a`.
- `ico-<rede>-<cor>.png` — ícones sociais (site, instagram, linkedin,
  youtube, x, facebook), 63 px (3× dos 21 px exibidos). Uma variante por cor
  `bodyAccent` dos temas: `00594f`, `0f7c8a`, `7a5e15`, `5c7a00`, `1d1d1f`,
  `3b4d9a`.

O `3b4d9a` (anil) é o de Relações Institucionais, desde a 30.0: o
departamento usava o tema escuro, bem mais forte que os outros, que agora é
da Leadership. Os departamentos ficam em tons claros e distintos entre si.

`<cor>` é o hex minúsculo sem `#`.

## Ao criar um tema novo

Se o tema usar uma cor `logo` ou `bodyAccent` que ainda não tem arquivo aqui,
gere as variantes que faltam (senão a imagem quebra no e-mail):

1. logo: recolorir os pixels opacos do
   [imagotipo preto](https://raw.githubusercontent.com/matheusmarcondes1/nro/refs/heads/main/imagotipo%20preto.png)
   para a nova cor (preservando o alfa) e redimensionar para 564 px de largura;
2. ícones: rasterizar os SVGs de 24×24 usados no `_socialImg`/histórico do
   repositório com `fill` na nova cor, em 63×63;
3. salvar aqui seguindo a nomenclatura acima e fazer o merge — o GitHub Pages
   publica junto com o site.

## 2.18.0

Os remetentes agora usam as famílias Cortex, Ion, Lúmen, Retina e Neuron. Leadership usa Cortex escuro. As imagens oficiais branca e preta foram atualizadas; ícones sociais são neutros. Os arquivos de cores anteriores permanecem para mensagens já emitidas. Não usar logo Synapse em novas peças.
