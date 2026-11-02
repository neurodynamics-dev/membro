# Curadoria de fotos

Página da equipe em `membro.neurodynamics.dev/curadoria/`, para a campanha de seleção das fotografias da galeria do manual da marca.

## Acesso

- **Só pelo link.** Nenhum menu, rota ou página do SOMA aponta para ela, e ela pede aos buscadores que não a indexem (`noindex,nofollow`). `testes/curadoria.mjs` confere que nenhum arquivo do portal passa a apontar para `/curadoria/`.
- **Só com a conta do SOMA.** Por estar no mesmo endereço do portal, a página usa a mesma sessão: quem já entrou no SOMA naquele aparelho cai direto na campanha. Sem sessão, ela pede o e-mail e a senha do SOMA ali mesmo. "Esqueci minha senha" manda o link do portal, que é onde se cria a senha nova.
- **Quem não entra:** a conta de membro Desligado, Egresso ou Sob demanda (`conta_ativa` falso), a conta sem perfil e a conta externa do painel do LABBIO. Para elas, a página explica que a conta não tem acesso e oferece sair.
- **Sair** (em Ajustes) encerra também a sessão do SOMA naquele aparelho, porque é a mesma.

A barreira é da página: o GitHub Pages serve os arquivos para quem pedir o endereço exato. Nada aqui é sigiloso (são links públicos de bancos de imagem), e nenhum dado da equipe é lido além do nome e do e-mail da própria conta.

No celular, cada foto aparece dentro de uma peça da marca. Quem avalia arrasta o cartão ou usa os botões:

| Gesto ou tecla | Decisão |
| --- | --- |
| Arrastar para a direita, seta direita | Aprovar |
| Arrastar para a esquerda, seta esquerda | Descartar |
| Arrastar para cima, seta para cima | Talvez |
| Tocar na foto, tecla E | Próximo enquadramento |
| Tecla P | Próxima paleta |
| Tecla Z | Desfazer |

## Enquadramentos

Tudo é chapado: nenhum degradê, brilho, véu ou desfoque, nem nas peças nem na tela da curadoria. A foto é retangular ou tem raio de 18px, sem filtro nem duotone; cada superfície usa uma família em cor sólida; o texto sobre o primary da família vai no dark dela, exceto em Cortex, Retina e Nexo, que levam branco.

| Peça | Proporção | O que testa |
| --- | --- | --- |
| Feed | 4:5 | A foto em cima e a faixa sólida no dark da família (em Cortex, o Cortex escuro com o marcador em Synapse). |
| Story | 9:16 | O modelo de story da marca, em Void sólido com a grade técnica: foto com raio de 18px e o botão (Synapse em Cortex; medium da família nas outras). |
| Banda | 1:1 | A foto sobre uma banda de família, com o símbolo grande e discreto na borda direita. |
| Site | 4:5 | O cartão de projeto do site institucional. |

A paleta **Auto** usa a família ligada ao tema da foto (`fam` em `fila.js`). As peças formais ficam de fora: nelas o manual só admite fotos fornecidas pela equipe.

## A fila

`fila.js` guarda os temas e as fotos. A ordem é: fotos adicionadas por link ou busca, depois a seleção da equipe (`o: 'voce'`), depois as sugestões, intercaladas por tema.

As sugestões vieram de buscas no Unsplash e no Pexels com os termos de cada tema, em 2 de novembro de 2026. Só entraram fotos com a Licença Unsplash ou a Licença Pexels; fotos Unsplash+ (pagas) ficaram de fora. Confira a licença e a autorização de imagem na página de cada foto antes de publicar.

Pela própria página, em **Fila**, dá para:

- tirar temas da fila;
- colar links do Unsplash ou do Pexels (um por linha ou todos juntos, inclusive com o endereço em português);
- buscar fotos novas nos bancos, com uma chave salva em **Ajustes**.

Para pôr fotos na fila de todo mundo, acrescente-as em `fila.js`.

## Como as fotos carregam

Sem chave, o Unsplash carrega por `unsplash.com/photos/<id>/download`, que redireciona para a imagem, e o Pexels por `images.pexels.com/photos/<id>/pexels-photo-<id>.jpeg`. Se a imagem não vier e houver chave em **Ajustes**, a página pede o endereço pela API do banco. Sem chave, o cartão mostra o link para abrir a foto no banco e a opção de pular.

As chaves (Access Key do Unsplash, API Key do Pexels) ficam só no aparelho de quem as salvou. Não as coloque no repositório.

## Do resultado para a galeria

As decisões ficam no navegador de cada pessoa, separadas por conta (`nro-curadoria-v1:<id da conta>`). Em **Resultados**, **Copiar resultado** gera um JSON com as aprovadas, as marcadas como talvez e as descartadas. Cada aprovada traz o banco, o código, a página, a descrição, o tema, o autor, o enquadramento e a paleta em que foi aprovada:

```json
{
  "campanha": "Fotografia da marca 2026",
  "aprovadas": [
    { "banco": "Unsplash", "id": "9xHsWmh3m_4", "pagina": "https://unsplash.com/photos/9xHsWmh3m_4",
      "descricao": "Braço robótico de laboratório em luz azul", "tema": "laboratorio", "autor": "Testalize.me",
      "enquadramento": "feed", "paleta": "cortex", "busca": null, "origem": "equipe" }
  ],
  "talvez": [],
  "descartadas": [{ "banco": "Unsplash", "id": "SVmaaACzcJ8" }]
}
```

Quando mais de uma pessoa avaliar, junte os resultados e fique com as fotos aprovadas por mais gente. Depois baixe cada aprovada pela página do banco e guarde o arquivo no repositório, com o autor e a licença.

**Recomeçar a campanha**, em Ajustes, apaga as decisões e as fotos adicionadas neste aparelho. As chaves continuam salvas.
