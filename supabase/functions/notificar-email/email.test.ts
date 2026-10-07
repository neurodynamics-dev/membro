/* ============================================================
   email.test.ts — conferência do e-mail de notificação
   Rode com Node 22+:  node --experimental-strip-types email.test.ts
   ============================================================ */
import { nomeExibicao, assuntoDe, corpoHTML, corpoTexto, linkDe, primeiroNome, servir,
         montarEnvio, lerResposta, faltaParaEnviar, pareceEndereco,
         declaracaoHTML, declaracaoTexto, dataExtensa, periodoTexto, horasTexto,
         agendaHTML, agendaTexto, agendaFrase, linkResposta, linkGoogle, antecedenciaTexto,
         personalizar, diaExtenso, quandoPS, linkAcompanhar, fraseCandidato, candidatoHTML, candidatoTexto,
         resumoHTML, resumoTexto, dinamicaTexto, linkGooglePS,
         b64u, deb64u, cifrarPush, jwtVapid, gerarChavesVapid, mensagemPush, paraOAparelho,
         origemDoPapel, origemDoBanco, porCategoria,
         type Destinatario, type EnvioPS, type EnvioDocumento, type EnvioAgenda } from "./index.ts";

let falhas = 0;
const ok = (n: string, c: boolean, extra = "") => {
  console.log((c ? "  ok  " : " FAIL ") + n + (c ? "" : "  << " + extra));
  if (!c) falhas++;
};

const pessoa = (itens: Partial<Destinatario["itens"][number]>[]): Destinatario => ({
  registro: 17, nome: "Carla Mendonça de Souza", email: "carla@nro.dev", modo: "imediato",
  itens: itens.map((i, n) => ({
    id: n + 1, tipo: "atividade_atribuida", titulo: "ORT-14 — Revisar a bancada",
    corpo: "Você é responsável por esta atividade.",
    href: "#/atividades/card/ORT-14", criado_em: "2026-09-21T12:00:00Z", ...i,
  })),
});

/* --- CORS e método: o botão de teste do portal chama esta função do
       NAVEGADOR. Sem estes cabeçalhos o navegador descarta a resposta, e
       sem tratar o OPTIONS a sondagem executava a rotina inteira e
       mandava e-mail de verdade para nada. --- */
{
  const r = await servir(new Request("https://x/", { method: "OPTIONS" }));
  ok("a sondagem do navegador é respondida", r.status === 200);
  ok("e autoriza a origem",
     r.headers.get("Access-Control-Allow-Origin") === "*");
  ok("e autoriza o cabeçalho de autenticação",
     (r.headers.get("Access-Control-Allow-Headers") || "").includes("authorization"));
  ok("e a sondagem NÃO executa o envio", (await r.text()) === "ok");
}
{
  const r = await servir(new Request("https://x/", { method: "POST" }));
  ok("o POST responde com CORS também",
     r.headers.get("Access-Control-Allow-Origin") === "*", String(r.status));
  ok("e em JSON",
     (r.headers.get("Content-Type") || "").includes("application/json"));
}
{
  const r = await servir(new Request("https://x/", { method: "PUT" }));
  ok("método que não serve é recusado", r.status === 405);
  ok("e mesmo a recusa vem com CORS — senão o erro fica invisível",
     r.headers.get("Access-Control-Allow-Origin") === "*");
}

/* --- o pedido HTTP de cada provedor. O envio deixou de ser SMTP: o
       import dinâmico do cliente não entrava no pacote publicado e em
       produção virava "Module not found". Agora é fetch, sem
       dependência — e por isso o formato do pedido tem teste. --- */
{
  const e = montarEnvio("cloudflare", "portal@nd.dev", "Portal", "ana@nd.dev", "Ana Figueiredo",
                        "Assunto", "<b>oi</b>", "oi", "conta123", "tok123");
  ok("Cloudflare: endereço monta com o id da conta",
     e.url === "https://api.cloudflare.com/client/v4/accounts/conta123/email/sending/send", e.url);
  ok("Cloudflare: autentica com o token", e.headers.Authorization === "Bearer tok123");
  const c = e.corpo as Record<string, never>;
  ok("Cloudflare: o remetente usa 'address', não 'email'",
     (c.from as unknown as { address: string }).address === "portal@nd.dev",
     JSON.stringify(c.from));
  ok("Cloudflare: o destinatário é uma lista de objetos com 'address'",
     Array.isArray(c.to) && (c.to as unknown as Array<{ address: string }>)[0].address === "ana@nd.dev",
     JSON.stringify(c.to));
  ok("Cloudflare: manda html E texto — cliente que só lê texto existe",
     !!(c.html && c.text));
}
{
  const e = montarEnvio("resend", "portal@nd.dev", "Portal", "ana@nd.dev", "Ana",
                        "Assunto", "<b>oi</b>", "oi", "", "", "re_123");
  ok("Resend: outro endereço", e.url === "https://api.resend.com/emails");
  ok("Resend: o remetente vai em uma linha só",
     (e.corpo as unknown as { from: string }).from === "Portal <portal@nd.dev>");
  ok("Resend: o destinatário é uma lista de textos",
     JSON.stringify((e.corpo as unknown as { to: string[] }).to) === '["ana@nd.dev"]');
}

/* --- ler a resposta. A armadilha da Cloudflare é responder 200 com
       success:false — quem olha só o código HTTP dá o envio por certo. --- */
ok("Cloudflare: 200 com success:false é RECUSA, não sucesso",
   lerResposta("cloudflare", 200,
     '{"success":false,"errors":[{"code":1004,"message":"from address not verified"}]}')
     .includes("from address not verified"));
ok("Cloudflare: 200 com success:true é sucesso",
   lerResposta("cloudflare", 200, '{"success":true,"errors":[],"result":{}}') === "");
ok("Cloudflare: erro sem corpo legível ainda diz o código",
   lerResposta("cloudflare", 403, "forbidden").includes("403"));
ok("Resend: 4xx traz a mensagem do provedor",
   lerResposta("resend", 422, '{"message":"Invalid to field"}').includes("Invalid to field"));
ok("Resend: 200 é sucesso", lerResposta("resend", 200, '{"id":"x"}') === "");

/* --- responder-para. O remetente mora no subdomínio de ENVIO, que não
       recebe nada; sem reply_to, responder um aviso cai no vazio. --- */
{
  const e = montarEnvio("cloudflare", "portal@soma.nd.dev", "SOMA", "ana@nd.dev", "Ana",
                        "S", "<b>h</b>", "t", "conta", "tok", "", "soma@nd.dev");
  ok("Cloudflare: reply_to vai como objeto com 'address'",
     JSON.stringify((e.corpo as unknown as { reply_to: unknown }).reply_to)
       === '{"address":"soma@nd.dev"}');
}
{
  const e = montarEnvio("resend", "portal@soma.nd.dev", "SOMA", "ana@nd.dev", "Ana",
                        "S", "<b>h</b>", "t", "", "", "re_1", "soma@nd.dev");
  ok("Resend: reply_to vai como texto",
     (e.corpo as unknown as { reply_to: string }).reply_to === "soma@nd.dev");
}
{
  const e = montarEnvio("cloudflare", "portal@soma.nd.dev", "SOMA", "ana@nd.dev", "Ana",
                        "S", "<b>h</b>", "t", "conta", "tok", "", "");
  ok("sem responder-para configurado, o campo nem é enviado",
     !("reply_to" in (e.corpo as Record<string, unknown>)));
}

/* --- o 10202 da Cloudflare diz "email.invalid" e nada mais: não diz
       qual endereço nem por quê. A causa quase sempre é o remetente
       estar fora do subdomínio habilitado — e descobrir isso custou uma
       rodada inteira, então a dica viaja junto com o erro. --- */
{
  const m = lerResposta("cloudflare", 200,
    '{"success":false,"errors":[{"code":10202,"message":"email.sending.error.email.invalid"}]}');
  ok("o 10202 preserva a mensagem original", m.includes("email.sending.error.email.invalid"));
  ok("e explica que o domínio de envio é por subdomínio", m.includes("SUBDOMÍNIO"));
  ok("e diz onde olhar", m.includes("cf-bounce"));
}
{
  const m = lerResposta("cloudflare", 200,
    '{"success":false,"errors":[{"code":10001,"message":"token invalido"}]}');
  ok("outro erro NÃO recebe a dica do remetente", !m.includes("cf-bounce"), m);
}

/* --- o remetente. Este caso custou uma rodada inteira: o SMTP_USER
       era a string literal "api_token" (o usuário da autenticação, não
       um endereço), e eu o tinha posto como último recurso do
       remetente. A Cloudflare recusava TUDO com "email.invalid", e as
       12 falhas de uma vez não diziam de onde vinha. --- */
ok('"api_token" não é endereço', pareceEndereco("api_token") === false);
ok("endereço de verdade passa", pareceEndereco("portal@neurodynamics.dev") === true);
ok("vazio não passa", pareceEndereco("") === false);
ok('"Nome <a@b.dev>" não passa — o campo é só o endereço',
   pareceEndereco("Portal <portal@nd.dev>") === false);
ok("sem arroba não passa", pareceEndereco("sem-arroba.dev") === false);
ok("domínio de uma letra só não passa", pareceEndereco("a@b.c") === false);

ok("remetente que não é endereço é barrado ANTES de gastar tentativa",
   faltaParaEnviar("cloudflare", "conta", "tok", "", "api_token").includes("api_token"));
ok("e a mensagem diz o que fazer",
   faltaParaEnviar("cloudflare", "conta", "tok", "", "api_token").includes("EMAIL_DE"));

/* --- o que falta configurar, em uma frase --- */
ok("sem o id da conta, diz qual segredo falta",
   faltaParaEnviar("cloudflare", "", "tok", "", "portal@nd.dev").includes("CF_ACCOUNT_ID"));
ok("sem o token, idem",
   faltaParaEnviar("cloudflare", "conta", "", "", "portal@nd.dev").includes("CF_API_TOKEN"));
ok("sem remetente, idem",
   faltaParaEnviar("cloudflare", "conta", "tok", "", "").includes("EMAIL_DE"));
ok("provedor desconhecido é recusado com o nome dele",
   faltaParaEnviar("correio", "", "", "", "portal@nd.dev").includes("correio"));
ok("configurado direito não reclama de nada",
   faltaParaEnviar("cloudflare", "conta", "tok", "", "portal@nd.dev") === "");

/* --- assunto --- */
ok("um aviso vira assunto do próprio aviso",
   assuntoDe(pessoa([{}])) === "ORT-14: Revisar a bancada");
ok("vários viram contagem",
   assuntoDe(pessoa([{}, {}, {}])) === "3 avisos no portal");

/* --- nome --- */
ok("trata a pessoa pelo primeiro nome", primeiroNome("Carla Mendonça de Souza") === "Carla");
ok("nome vazio não quebra a saudação", primeiroNome("") === "você");

/* --- links --- */
ok("hash do portal vira endereço absoluto",
   linkDe("#/atividades/card/ORT-14").startsWith("https://") &&
   linkDe("#/atividades/card/ORT-14").endsWith("/#/atividades/card/ORT-14"),
   linkDe("#/atividades/card/ORT-14"));
ok("endereço já absoluto passa intacto",
   linkDe("https://exemplo.dev/x") === "https://exemplo.dev/x");
ok("sem href, o link é a home do portal",
   linkDe(null).startsWith("https://") && !linkDe(null).includes("null"));

/* --- HTML --- */
const html = corpoHTML(pessoa([{}, { titulo: "DEP-3 — SOL26-0001", href: null }]));
ok("o HTML traz os dois títulos",
   html.includes("ORT-14: Revisar a bancada") && html.includes("DEP-3: SOL26-0001"));
ok("diz quantos avisos são", html.includes("Há 2 avisos"));
ok("o e-mail é claro, não escuro", html.includes("#ffffff") && !html.includes("#050807"));
ok("a logo sai por endereço absoluto", /src="https:\/\/[^"]+\/logo-1d1d1f\.png"/.test(html));
ok("explica como mudar a preferência", html.includes("Preferências de avisos"));
ok("o envio na hora não agrupa por categoria", !html.includes("ATIVIDADES") && !/Atividades \(\d+\)/.test(html));

/* --- os resumos (2.18.0): agrupados por categoria, na ordem da tela --- */
{
  const d = pessoa([
    { categoria: "documentos", titulo: "NRO-PES-007 em revisão" },
    { categoria: "atividades" },
    { categoria: "atividades", titulo: "ORT-15 — Molde" },
    { categoria: "inventada", titulo: "Algo novo" },
  ]);
  const sem = { ...d, modo: "semanal" as const }, dia = { ...d, modo: "diario" as const };
  ok("o assunto do semanal diz que é resumo e conta", assuntoDe(sem) === "Resumo semanal do SOMA (4 avisos)", assuntoDe(sem));
  ok("o do diário também", assuntoDe(dia) === "Resumo diário do SOMA (4 avisos)", assuntoDe(dia));
  ok("um aviso só, no singular", assuntoDe({ ...dia, itens: d.itens.slice(0, 1) }) === "Resumo diário do SOMA (1 aviso)");
  const g = porCategoria(d.itens);
  ok("agrupa na ordem da tela, e o desconhecido vai para Sistema",
     g.map((x) => x.nome).join("|") === "Atividades|Documentos|Sistema" && g[0].itens.length === 2, JSON.stringify(g.map((x) => x.nome)));
  const h = corpoHTML(sem);
  ok("o HTML do resumo tem o título de cada grupo, com a contagem",
     h.includes("Atividades (2)") && h.includes("Documentos (1)") && h.indexOf("Atividades (2)") < h.indexOf("Documentos (1)"));
  ok("e a abertura do semanal", h.includes("Os 4 avisos da última semana no portal."));
  const t = corpoTexto(dia);
  ok("o texto do resumo agrupa também", t.includes("ATIVIDADES (2)") && t.includes("Os 4 avisos do último dia no portal."), t);
  ok("sem travessão nem ponto médio no rodapé", !/·/.test(t.split("Preferências")[1] || "x"));
  ok("o modo antigo (imediato) segue sem grupo", !corpoHTML(pessoa([{ categoria: "atividades" }])).includes("Atividades (1)"));
}

/* --- a armadilha: conteúdo escrito por gente --- */
const perigoso = corpoHTML(pessoa([{
  titulo: 'Fulano <script>alert("x")</script> & cia',
  corpo: 'aspas "duplas" e <b>tags</b>',
}]));
ok("título com HTML é escapado, não interpretado",
   !perigoso.includes("<script>") && perigoso.includes("&lt;script&gt;"),
   perigoso.slice(perigoso.indexOf("Fulano") - 20, perigoso.indexOf("Fulano") + 80));
ok("o & vira entidade", perigoso.includes("&amp; cia"));
ok("aspas no corpo não fecham atributo", perigoso.includes("&quot;duplas&quot;"));

/* --- texto puro --- */
const txt = corpoTexto(pessoa([{}]));
ok("a versão em texto não tem tag", !/<[a-z]/i.test(txt), txt);
ok("a versão em texto traz o link", txt.includes("/#/atividades/card/ORT-14"));
ok("e é uma saudação de verdade", txt.startsWith("Olá, Carla."));

/* --- a declaração de participação (25.0): um e-mail por documento,
       para o membro e para o externo, que não tem conta no portal --- */
ok("a data por extenso", dataExtensa("2026-09-24") === "24 de setembro de 2026");
ok("um dia só", periodoTexto("2026-09-24", null) === "em 24 de setembro de 2026");
ok("o mesmo dia no fim é um dia só", periodoTexto("2026-09-24", "2026-09-24") === "em 24 de setembro de 2026");
ok("dias do mesmo mês", periodoTexto("2026-09-05", "2026-09-07") === "de 5 a 7 de setembro de 2026");
ok("virando o mês", periodoTexto("2026-09-30", "2026-10-02") === "de 30 de setembro a 2 de outubro de 2026");
ok("virando o ano", periodoTexto("2026-12-30", "2027-01-02") === "de 30 de dezembro de 2026 a 2 de janeiro de 2027");
ok("horas inteiras", horasTexto(8) === "8 horas" && horasTexto(1) === "1 hora");
ok("horas e minutos", horasTexto(2.5) === "2 horas e 30 minutos" && horasTexto("0.25") === "15 minutos");
const envio = (d: Partial<EnvioDocumento["dados"]> = {}, o: Partial<EnvioDocumento> = {}): EnvioDocumento => ({
  id: 7, tipo: "participacao", para_nome: "Helena Prado", para_email: "helena@exemplo.org",
  assunto: "Declaração de participação — CBEB 2026",
  dados: { evento: "CBEB 2026", evento_codigo: "EXT-1", data_inicio: "2026-09-05", data_fim: "2026-09-07",
    local: "Centro de Convenções de Vitória (ES)", modalidade: "presencial", horas: 16, papel: "Coautor(a)",
    membro: false, documento: "NRO-DIR-006-1", codigo: "3HVN-8Z2C-QW6E",
    url: "https://auth.neurodynamics.dev/?c=3HVN-8Z2C-QW6E", href: "#/servicos/eventos/EXT-1", ...d },
  ...o,
});
{
  const h = declaracaoHTML(envio());
  ok("a declaração traz o evento, o período e o local",
     h.includes("CBEB 2026") && h.includes("de 5 a 7 de setembro de 2026") && h.includes("Centro de Convenções de Vitória (ES)"));
  ok("o documento e o código verificador", h.includes("NRO-DIR-006-1") && h.includes("3HVN-8Z2C-QW6E"));
  ok("a função e as horas por extenso", h.includes("Coautor(a)") && h.includes("16 horas"));
  ok("o link vai para a validação pública, com o código",
     h.includes('href="https://auth.neurodynamics.dev/?c=3HVN-8Z2C-QW6E"'));
  ok("e diz onde se confere", h.includes(">auth.neurodynamics.dev</a>"));
  ok("o externo não recebe link do portal, que ele não tem", !h.includes("#/servicos/eventos/EXT-1"));
  ok("e é tratado pelo primeiro nome", h.includes("Olá, Helena."));
  ok("o e-mail é claro, como os outros", h.includes("#ffffff"));
}
{
  const h = declaracaoHTML(envio({ membro: true }, { para_nome: "Ana Figueiredo" }));
  ok("o membro ganha também o link do portal", h.includes("/#/servicos/eventos/EXT-1"));
  ok("online não diz lugar", declaracaoHTML(envio({ modalidade: "online", local: null })).includes(", online."));
  ok("sem papel, participante", declaracaoHTML(envio({ papel: null })).includes(">Participante<"));
}
{
  const h = declaracaoHTML(envio({ evento: 'Congresso <script>alert(1)</script> & "cia"' }));
  ok("o nome do evento é escapado — quem registra escreve o que quiser",
     !h.includes("<script>") && h.includes("&lt;script&gt;") && h.includes("&amp; &quot;cia&quot;"));
}
{
  const t = declaracaoTexto(envio({ membro: true }));
  ok("a versão em texto não tem tag", !/<[a-z]/i.test(t), t);
  ok("e traz o código e o link", t.includes("3HVN-8Z2C-QW6E") && t.includes("https://auth.neurodynamics.dev/?c=3HVN-8Z2C-QW6E"));
  ok("e, para o membro, o portal", t.includes("/#/servicos/eventos/EXT-1"));
}

/* --- a agenda (28.0): convite, alteração, cancelamento e lembrete --- */
const convite = (tipo: EnvioAgenda["tipo"], d: Partial<EnvioAgenda["dados"]> = {}, e: Partial<EnvioAgenda> = {}): EnvioAgenda => ({
  id: 1, tipo, para_nome: "Bruno Tavares", para_email: "bruno@nro.dev", token: "0f5c-tok", resposta: "pendente",
  membro: true, assunto: "Convite: Revisão · sábado", ...e,
  dados: { evento_id: "ev1", titulo: "Revisão do protótipo", data: "2026-10-03", hora_inicio: "14:00", hora_fim: "15:30",
    quando: "sábado, 3 de outubro de 2026, das 14:00 às 15:30", local: "Sala 2", meet_url: "https://meet.google.com/abc-defg-hij",
    descricao: "Levar a órtese.", recorrencia: "Única", organizador: "Carla Mendonça", href: "#/agenda/evento/ev1", ...d },
});
{
  const h = agendaHTML(convite("convite"));
  ok("convite: quem convidou, o título e quando", h.includes("Carla Mendonça convidou você") && h.includes("Revisão do protótipo")
     && h.includes("sábado, 3 de outubro de 2026, das 14:00 às 15:30"));
  ok("os três botões respondem pelo token", h.includes(linkResposta("0f5c-tok", "vou").replace(/&/g, "&amp;"))
     && h.includes("rsvp?t=0f5c-tok&amp;r=talvez") && h.includes("r=nao") && /Não vou<\/a>/.test(h));
  ok("o link do Google Agenda leva o horário e o fuso", linkGoogle(convite("convite").dados).includes("dates=20261003T140000%2F20261003T153000")
     && linkGoogle(convite("convite").dados).includes("ctz=America%2FSao_Paulo"));
  ok("dia inteiro de vários dias vai até o dia seguinte ao fim",
     linkGoogle(convite("convite", { hora_inicio: null, hora_fim: null, data_fim: "2026-10-05" }).dados).includes("dates=20261003%2F20261006"));
  ok("o membro ganha o link do portal", h.includes("/#/agenda/evento/ev1"));
  ok("o de fora não", !agendaHTML(convite("convite", {}, { membro: false })).includes("#/agenda/evento/ev1"));
}
{
  ok("alteração diz o que mudou", agendaFrase(convite("alteracao", { mudou: "data, horário" })) === "Este evento mudou (data, horário).");
  const c = agendaHTML(convite("cancelamento"));
  ok("cancelamento risca o título e não pergunta se vai", c.includes("line-through") && !c.includes("rsvp"));
  ok("lembrete: quanto falta", agendaFrase(convite("lembrete", { minutos: 1440 })) === "Começa em 1 dia."
     && antecedenciaTexto(90) === "1 hora e 30 minutos");
  ok("a resposta dada fica marcada", agendaHTML(convite("lembrete", {}, { resposta: "vou" })).includes("background:#00594F;color:#ffffff;border:1px solid #00594F\">\n      Vou"));
}
{
  const h = agendaHTML(convite("convite", { titulo: 'Reunião <img src=x onerror=alert(1)> & "cia"', descricao: "<b>oi</b>" }));
  ok("título e descrição de quem criou o evento são escapados", !h.includes("<img src=x") && !h.includes("<b>oi</b>") && h.includes("&amp; &quot;cia&quot;"));
  const t = agendaTexto(convite("convite"));
  ok("a versão em texto traz os três links e o portal", !/<[a-z]/i.test(t) && t.includes("Vou: ") && t.includes("Não vou: ") && t.includes("/#/agenda/evento/ev1"));
}

/* ---------- os programados (30.0) ---------- */
{
  const html = '<p>Olá, {{primeiro_nome}}.</p><p>{{ nome }}</p>';
  ok("o primeiro nome entra no lugar do marcador", personalizar(html, "Ana Figueiredo", true) === "<p>Olá, Ana.</p><p>Ana Figueiredo</p>");
  ok("nome com HTML é escapado no HTML", personalizar(html, "<b>Zé</b> & Cia", true).includes("&lt;b&gt;Zé&lt;/b&gt;") && !personalizar(html, "<b>Zé</b>", true).includes("<b>"));
  ok("no texto, vai cru", personalizar("Olá, {{primeiro_nome}}.", "Bruno Tavares", false) === "Olá, Bruno.");
  ok("sem nome, o marcador some", personalizar("Olá, {{primeiro_nome}}.", "", false) === "Olá, .");
  const e = montarEnvio("cloudflare", "portal@neurodynamics.dev", "Leadership | NeuroDynamics", "ana@nro.dev", "Ana", "x", "<p>x</p>", "x", "c", "t", "", "");
  ok("o remetente da área vai no nome de exibição", (e.corpo as { from: { name: string } }).from.name === "Leadership | NeuroDynamics");
  const r = montarEnvio("resend", "portal@nd.dev", "Depto. de Pessoal | NeuroDynamics", "a@b.dev", "", "x", "<p>x</p>", "x");
  ok("no Resend, nome com ponto vai entre aspas", (r.corpo as unknown as { from: string }).from === '"Depto. de Pessoal | NeuroDynamics" <portal@nd.dev>');
  ok("sem caractere especial, vai como está", nomeExibicao("Leadership | NeuroDynamics") === "Leadership | NeuroDynamics"
    && nomeExibicao('P&D "x"') === "P&D x");
}

/* ---------- as entrevistas do processo seletivo (31.0) ---------- */
{
  const envio = (tipo: EnvioPS["tipo"], dados: Partial<EnvioPS["dados"]> = {}): EnvioPS => ({
    id: 1, tipo, para_nome: "Lia Moreira", para_email: "lia@exemplo.com", assunto: "Entrevista confirmada: 14/10, 14:00",
    dados: { data: "2026-10-14", hora_inicio: "14:00", hora_fim: "14:30", link: "https://meet.google.com/abc-defg-hij",
             responsavel: "Ana Figueiredo", protocolo: "PS26-0001", email: "lia@exemplo.com", ...dados },
  });
  ok("o dia por extenso, com a semana", diaExtenso("2026-10-14") === "quarta-feira, 14 de outubro");
  ok("o quando da entrevista", quandoPS({ data: "2026-10-14", hora_inicio: "14:00", hora_fim: "14:30" })
     === "quarta-feira, 14 de outubro, das 14:00 às 14:30");
  ok("a página de acompanhamento já vem preenchida",
     linkAcompanhar(envio("confirmacao").dados) === "https://selecao.neurodynamics.dev/#/acompanhar?protocolo=PS26-0001&email=lia%40exemplo.com");
  const c = candidatoHTML(envio("confirmacao"));
  ok("a confirmação traz o link, o botão de entrar e quem conduz",
     c.includes('href="https://meet.google.com/abc-defg-hij"') && c.includes("Entrar na chamada") && c.includes("Ana Figueiredo")
     && c.includes("Olá, Lia.") && c.includes("quarta-feira, 14 de outubro, das 14:00 às 14:30"));
  ok("e o Google Agenda com a chamada", c.includes("calendar.google.com") && linkGooglePS(envio("confirmacao").dados).includes("meet.google.com"));
  const r = candidatoHTML(envio("reagendamento", { hora_inicio: "16:00", hora_fim: "16:30", motivo: "Imprevisto",
    antes: { data: "2026-10-14", hora_inicio: "14:00", hora_fim: "14:30" } }));
  ok("o reagendamento risca o horário antigo e diz o motivo", r.includes("line-through") && r.includes("das 14:00 às 14:30")
     && r.includes("das 16:00 às 16:30") && r.includes("Imprevisto"));
  const x = candidatoHTML(envio("cancelamento", { link: null, motivo: "Doença" }));
  ok("o cancelamento pede um novo horário, sem link de chamada", x.includes("Escolher novo horário") && !x.includes("Entrar na chamada")
     && x.includes("#/acompanhar?protocolo=PS26-0001"));
  ok("o aviso de link diferencia a primeira vez da troca",
     fraseCandidato(envio("link")).startsWith("Sua entrevista será online")
     && fraseCandidato(envio("link", { antes: { link: "https://meet.google.com/old" } })).startsWith("O link da chamada"));
  const pres = candidatoHTML(envio("confirmacao", { link: null, local: "LABBIO" }));
  ok("horário antigo, presencial: diz onde e não fala em chamada", pres.includes("LABBIO") && !pres.includes("Google Meet")
     && !pres.includes("Entrar na chamada"));
  const inj = candidatoHTML(envio("confirmacao", { responsavel: '<img src=x onerror=alert(1)>', motivo: "<b>x</b>" }));
  ok("o que veio do banco é escapado", !inj.includes("<img src=x") && !inj.includes("<b>x</b>"));
  const t = candidatoTexto(envio("confirmacao"));
  ok("a versão em texto do candidato", !/<[a-z]/i.test(t) && t.includes("Chamada: https://meet.google.com/abc-defg-hij") && t.includes("Página de acompanhamento: "));

  const resumo: EnvioPS = { id: 2, tipo: "resumo", para_nome: "Ana Figueiredo", para_email: "ana@nro.dev", assunto: "Entrevistas de amanhã: 2",
    dados: { dia: "2026-10-14", atualizacao: false, itens: [
      { hora_inicio: "14:00", hora_fim: "14:30", link: "https://meet.google.com/abc-defg-hij", href: "#/selecao/candidatos/c1",
        candidato: { nome: "Lia Moreira", curso: "Engenharia Biomédica", instituicao: "UFMG", periodo: "5º", areas: ["Órtese", "Sinais"],
          motivacao: "Quero trabalhar com reabilitação.", github: "https://github.com/lia", lattes: "javascript:alert(1)",
          email: "lia@exemplo.com", telefone: "31 99999-0001" },
        dinamica: { nota: 4.0, avaliacoes: 2, aprovar: 1, em_duvida: 1, reprovar: 0 } },
      { hora_inicio: "14:30", hora_fim: "15:00", link: "https://meet.google.com/abc-defg-hij", href: "#/selecao/candidatos/c2",
        candidato: { nome: "Rui Campos" }, dinamica: { avaliacoes: 0 } }] } };
  const h = resumoHTML(resumo);
  ok("o resumo lista as entrevistas do dia, com o perfil", h.includes("2 entrevistas, quarta-feira, 14 de outubro")
     && h.includes("Lia Moreira") && h.includes("Rui Campos") && h.includes("Engenharia Biomédica, UFMG, 5º período")
     && h.includes("Órtese, Sinais") && h.includes("Quero trabalhar com reabilitação."));
  ok("com a chamada e a ficha no portal", h.includes("Entrar na chamada") && h.includes("https://membro.neurodynamics.dev/#/selecao/candidatos/c1"));
  ok("os links do candidato, só os http(s)", h.includes('href="https://github.com/lia"') && !h.includes("javascript:alert"));
  ok("a dinâmica em uma linha", dinamicaTexto(resumo.dados.itens![0].dinamica) === "nota média 4 em 2 avaliações: 1 aprovar, 1 em dúvida"
     && dinamicaTexto({ avaliacoes: 0 }) === "sem avaliação registrada");
  ok("o resumo atualizado avisa que substitui o anterior",
     resumoHTML({ ...resumo, dados: { ...resumo.dados, atualizacao: true } }).includes("este resumo substitui o anterior"));
  const rt = resumoTexto(resumo);
  ok("a versão em texto do resumo", !/<[a-z]/i.test(rt) && rt.includes("14:00 às 14:30: Lia Moreira") && rt.includes("GitHub: https://github.com/lia")
     && rt.includes("Ficha: https://membro.neurodynamics.dev/#/selecao/candidatos/c1"));
}

/* --- as notificações no aparelho (32.0). A cifra é a da RFC 8291, e o
       vetor de exemplo da própria RFC (seção 5) confere byte a byte: com
       as mesmas chaves e o mesmo sal, o corpo tem de sair idêntico. --- */
{
  const as = {  // o servidor de aplicação, no exemplo da RFC
    d: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
    pub: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  };
  const uaPub = "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
  const uaPriv = "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94";
  const auth = "BTBZMqHH6r4Tts7J_aSIgg";
  const sal = deb64u("DGv6ra1nlYgDCS1FRnbzlw");
  const esperado = "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN";
  const pub = deb64u(as.pub);
  const jwk = (d: string | null, p: Uint8Array) => ({ kty: "EC", crv: "P-256", x: b64u(p.slice(1, 33)), y: b64u(p.slice(33, 65)), ...(d ? { d } : {}) });
  const par = {
    privateKey: await crypto.subtle.importKey("jwk", jwk(as.d, pub), { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]),
    publicKey: await crypto.subtle.importKey("jwk", jwk(null, pub), { name: "ECDH", namedCurve: "P-256" }, true, []),
  } as CryptoKeyPair;
  const corpo = await cifrarPush("When I grow up, I want to be a watermelon", uaPub, auth, { sal, par });
  ok("a cifra do Web Push reproduz o exemplo da RFC 8291", b64u(corpo) === esperado, b64u(corpo));
  ok("base64url vai e volta", b64u(deb64u(uaPub)) === uaPub && deb64u(uaPub).length === 65);

  /* e o navegador consegue ler: decifrar como o navegador decifraria */
  const decifrar = async (body: Uint8Array, privUa: string, pubUa: string, segredo: string): Promise<string> => {
    const salt = body.slice(0, 16), idlen = body[20], asPubB = body.slice(21, 21 + idlen), cifra = body.slice(21 + idlen);
    const pu = deb64u(pubUa);
    const k = await crypto.subtle.importKey("jwk", jwk(privUa, pu), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
    const asK = await crypto.subtle.importKey("raw", asPubB, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asK }, k, 256));
    const hk = async (s: Uint8Array, ikm: Uint8Array, info: Uint8Array, n: number) => new Uint8Array(await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: s, info }, await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]), n * 8));
    const te = new TextEncoder();
    const ikm = await hk(deb64u(segredo), ecdh, new Uint8Array([...te.encode("WebPush: info\0"), ...pu, ...asPubB]), 32);
    const cek = await hk(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
    const nonce = await hk(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
    const claro = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce },
      await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]), cifra));
    let fim = claro.length - 1; while (fim >= 0 && claro[fim] === 0) fim--;   // o preenchimento, se houver
    if (claro[fim] !== 2) throw new Error("sem o delimitador do último registro");
    return new TextDecoder().decode(claro.slice(0, fim));
  };
  ok("o navegador decifra o exemplo da RFC", (await decifrar(corpo, uaPriv, uaPub, auth)) === "When I grow up, I want to be a watermelon");
  const msg = JSON.stringify({ t: "ORT-14 Calibrar", c: "Você é responsável", h: "#/atividades/card/ORT-14", tag: "n1" });
  const c2 = await cifrarPush(msg, uaPub, auth);
  ok("uma mensagem de verdade, com sal e chave sorteados, também se decifra", (await decifrar(c2, uaPriv, uaPub, auth)) === msg);
  ok("e duas cifras da mesma mensagem nunca são iguais", b64u(await cifrarPush(msg, uaPub, auth)) !== b64u(c2));
  ok("o cabeçalho diz registros de 4096 e a chave de 65 bytes", new DataView(c2.buffer).getUint32(16) === 4096 && c2[20] === 65);
}
{
  const v = await gerarChavesVapid();
  const pub = deb64u(v.publica), priv = JSON.parse(v.privada);
  ok("o par VAPID novo: a pública em 65 bytes, sem compressão", pub.length === 65 && pub[0] === 4);
  ok("e a privada em JWK, com d, x e y", !!priv.d && !!priv.x && !!priv.y && priv.crv === "P-256");
  const agora = 1_790_000_000;
  const jwt = await jwtVapid("https://fcm.googleapis.com", "mailto:soma@neurodynamics.dev", priv, agora);
  const [cab, corpo, ass] = jwt.split(".");
  const claims = JSON.parse(new TextDecoder().decode(deb64u(corpo)));
  ok("o JWT do servidor é ES256", JSON.parse(new TextDecoder().decode(deb64u(cab))).alg === "ES256");
  ok("para o serviço de push certo, de quem manda, por 12 horas",
     claims.aud === "https://fcm.googleapis.com" && claims.sub === "mailto:soma@neurodynamics.dev" && claims.exp === agora + 43200);
  const k = await crypto.subtle.importKey("raw", pub, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  ok("e a assinatura confere com a chave pública",
     await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, k, deb64u(ass), new TextEncoder().encode(`${cab}.${corpo}`)));
}
{
  const it = (id: number, titulo: string, criado = "2026-09-28T12:00:00Z", href: string | null = "#/atividades/card/ORT-" + id) =>
    ({ id, tipo: "x", titulo, corpo: "corpo " + id, href, criado_em: criado });
  const um = mensagemPush([it(7, "ORT-7 Revisar")]);
  ok("um aviso vira uma notificação com o título, o corpo e o endereço", um.t === "ORT-7 Revisar" && um.c === "corpo 7"
     && um.h === "#/atividades/card/ORT-7" && um.tag === "n7");
  ok("endereço que não é do portal vira o início", mensagemPush([it(8, "x", undefined, "javascript:alert(1)")]).h === "#/");
  const varios = mensagemPush([it(1, "um"), it(2, "dois"), it(3, "três"), it(4, "quatro"), it(5, "cinco")]);
  ok("vários de uma vez viram um resumo", varios.t === "5 avisos novos no SOMA" && varios.tag === "resumo" && varios.h === "#/");
  ok("com os quatro mais novos primeiro", varios.c.split("\n")[0] === "cinco" && varios.c.split("\n").length === 4);
  ok("título comprido é cortado", mensagemPush([it(9, "a".repeat(300))]).t.length === 120);
  const insc = { id: "i", endpoint: "https://x", p256dh: "", auth: "", criado_em: "2026-09-28T12:00:00Z" };
  const itens = [it(1, "antes", "2026-09-28T11:00:00Z"), it(2, "depois", "2026-09-28T12:30:00Z")];
  ok("o aparelho recém-inscrito não recebe o acumulado", paraOAparelho(itens, insc).map((i) => i.titulo).join() === "depois");
}
{
  ok("a sessão de quem está no portal é o empurrão", JSON.stringify(origemDoPapel("authenticated", "")) === '{"origem":"portal"}');
  ok("ou o teste, quando o portal diz que é teste", JSON.stringify(origemDoPapel("authenticated", "teste")) === '{"origem":"teste"}');
  ok("a service role diz de onde vem", JSON.stringify(origemDoPapel("service_role", "evento")) === '{"origem":"evento"}'
     && JSON.stringify(origemDoPapel("service_role", "qualquer")) === '{"origem":"servico"}');
  ok("a chave anônima antiga do agendamento continua entrando", JSON.stringify(origemDoPapel("anon", "")) === '{"origem":"anon"}');
  ok("papel desconhecido não entra", "erro" in origemDoPapel("postgres", ""));
  ok("a senha do banco é agendamento, a não ser que diga evento",
     origemDoBanco("") === "agendamento" && origemDoBanco("evento") === "evento" && origemDoBanco("portal") === "agendamento");
}

console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo verde.");
if (falhas) (globalThis as { process?: { exitCode: number } }).process!.exitCode = 1;
