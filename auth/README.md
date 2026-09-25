# auth.neurodynamics.dev — a validação dos documentos

A página pública em que qualquer pessoa confere um documento emitido pelo
SOMA: a declaração de vínculo e a declaração de participação em evento. Quem
recebe o papel digita o **código verificador** do rodapé — ou lê o QR Code,
que abre a página com o código preenchido — e vê, do nosso lado, o que foi
impresso: o documento, o titular (com o CPF mascarado), a data da emissão, o
código de controle e se o documento continua válido ou foi revogado.

É de propósito mais sóbria que as outras páginas da equipe: fundo branco,
tabela com borda, texto de repartição. Quem abre é de fora — uma empresa, uma
universidade, um órgão público — e o que precisa é de certeza, não de marca.

## O que tem aqui

```
auth/
├── index.html    a página inteira (HTML, CSS e JS num arquivo só)
├── CNAME         auth.neurodynamics.dev
├── favicon.png
└── README.md     este arquivo
```

- **O banco:** a página chama só `doc_validar(código)`, a única função da
  migração 25.0 aberta à chave anônima. Ela devolve o que foi impresso e
  conta a consulta (quem emitiu vê, no portal, quantas vezes o documento
  foi conferido). Nenhuma tabela é lida direto.
- **O modelo de documento:** a frase declarada e a segunda via da
  declaração de participação saem do `doc-nro.js` do portal, carregado de
  `https://membro.neurodynamics.dev/doc-nro.js`. Não existe uma segunda
  cópia dele: mudou o modelo no portal, mudou aqui também.
- **A segunda via:** só a da declaração de participação, porque o
  participante externo não tem conta no portal. A de vínculo o próprio
  membro emite em Serviços › Declaração de vínculo.

## Publicar

O GitHub Pages serve um domínio por repositório, e o `membro` já serve
`membro.neurodynamics.dev`. O `auth` precisa do seu:

1. Crie o repositório público `neurodynamics-dev/auth` e ponha nele, na
   raiz, o conteúdo desta pasta (`index.html`, `CNAME`, `favicon.png`).
2. Em **Settings › Pages**: *Deploy from a branch*, branch `main`, pasta
   `/ (root)`. O domínio `auth.neurodynamics.dev` já vem do `CNAME`;
   marque **Enforce HTTPS** quando o certificado sair.
3. No DNS de `neurodynamics.dev`, um registro `CNAME` de `auth` para
   `neurodynamics-dev.github.io`.
4. Confira: `https://auth.neurodynamics.dev/?c=XXXX-XXXX-XXXX` com o código
   de uma declaração emitida no portal.

Do lado do Supabase não há nada a fazer: a migração 25.0 já abre
`doc_validar` à chave anônima, e o endereço de validação que vai impresso
nos documentos (`https://auth.neurodynamics.dev`) está em
`doc_emissao_config` — o Depto. de Pessoal muda em Serviços › Eventos ›
Configurações, se um dia o endereço mudar.

## Atualizar

Esta pasta é a fonte. Mudou aqui, copie de novo para o repositório `auth`
(é um arquivo só). O teste `testes/validacao.mjs` abre a página com o
Supabase falso e confere cada resultado — autêntico, revogado, código de
controle que não confere, código que não existe — e a segunda via.
