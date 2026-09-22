/* ============================================================
   email.test.ts — conferência do e-mail de notificação
   Rode com Node 22+:  node --experimental-strip-types email.test.ts
   ============================================================ */
import { assuntoDe, corpoHTML, corpoTexto, linkDe, primeiroNome, servir,
         montarEnvio, lerResposta, faltaParaEnviar, pareceEndereco,
         type Destinatario } from "./index.ts";

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
   assuntoDe(pessoa([{}])) === "ORT-14 — Revisar a bancada");
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
   html.includes("ORT-14 — Revisar a bancada") && html.includes("DEP-3 — SOL26-0001"));
ok("diz quantos avisos são", html.includes("Há 2 avisos"));
ok("o e-mail é claro, não escuro", html.includes("#ffffff") && !html.includes("#050807"));
ok("a logo sai por endereço absoluto", /src="https:\/\/[^"]+\/logo-00594f\.png"/.test(html));
ok("explica como mudar a preferência", html.includes("Preferências de e-mail"));

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

console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo verde.");
if (falhas) (globalThis as { process?: { exitCode: number } }).process!.exitCode = 1;
