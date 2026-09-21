/* ============================================================
   email.test.ts — conferência do e-mail de notificação
   Rode com Node 22+:  node --experimental-strip-types email.test.ts
   ============================================================ */
import { assuntoDe, corpoHTML, corpoTexto, linkDe, primeiroNome, tlsImplicito,
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

/* --- TLS: a porta decide como a conversa começa criptografada, e
       trocar as duas pendura a conexão sem dizer o motivo --- */
ok("465 fala TLS desde o primeiro byte",      tlsImplicito(465, "") === true);
ok("587 começa em claro e sobe com STARTTLS", tlsImplicito(587, "") === false);
ok("25 idem",                                 tlsImplicito(25,  "") === false);
ok("porta fora da convenção assume STARTTLS", tlsImplicito(2525, "") === false);
ok("SMTP_TLS=implicito vence a porta",        tlsImplicito(587, "implicito") === true);
ok("SMTP_TLS=starttls vence a porta",         tlsImplicito(465, "starttls") === false);
ok("SMTP_TLS=nao continua sem TLS implícito", tlsImplicito(465, "nao") === false);

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
