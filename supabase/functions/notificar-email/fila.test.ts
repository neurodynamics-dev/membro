/* ============================================================
   fila.test.ts — a passada inteira (32.0), com o banco e a rede de
   mentira: quem pode chamar, uma passada por vez, o aviso cifrado para o
   aparelho e o e-mail, na mesma passada.
   Rode com Node 22+:  node --experimental-strip-types fila.test.ts
   ============================================================ */
type Chamada = { nome: string; corpo: Record<string, unknown>; headers: Record<string, string> };

/* o ambiente da função: lido quando o arquivo carrega, por isso antes do import */
(globalThis as Record<string, unknown>).Deno = {
  env: { get: (k: string) => ({
    SUPABASE_URL: "https://proj.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "chave-servico",
    CF_ACCOUNT_ID: "conta", CF_API_TOKEN: "token-cf", EMAIL_DE: "portal@soma.neurodynamics.dev",
    EMAIL_RESPONDER_PARA: "soma@neurodynamics.dev",
  } as Record<string, string>)[k] },
  serve() { /* os testes chamam servir() direto */ },
};
const { servir, b64u, deb64u } = await import("./index.ts");

let falhas = 0;
const ok = (n: string, c: boolean, extra = "") => {
  console.log((c ? "  ok  " : " FAIL ") + n + (c ? "" : "  << " + extra));
  if (!c) falhas++;
};

/* ---------- o banco e a rede de mentira ---------- */
let rpcs: Chamada[] = [];
let pushes: { url: string; headers: Record<string, string>; corpo: Uint8Array }[] = [];
let emails: { url: string; corpo: Record<string, unknown> }[] = [];
let banco: Record<string, (c: Record<string, unknown>, h: Record<string, string>) => unknown> = {};
let respostaPush = 201;
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "Content-Type": "application/json" } });
globalThis.fetch = (async (entrada: string | URL | Request, init: RequestInit = {}) => {
  const url = String(entrada);
  const headers = Object.fromEntries(Object.entries((init.headers || {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]));
  const m = /\/rest\/v1\/rpc\/(\w+)$/.exec(url);
  if (m) {
    const corpo = JSON.parse(String(init.body || "{}"));
    rpcs.push({ nome: m[1], corpo, headers });
    const f = banco[m[1]];
    if (!f) return json({ code: "PGRST202", message: `Could not find the function public.${m[1]}` }, 404);
    const r = f(corpo, headers);
    return r instanceof Response ? r : json(r);
  }
  if (url.startsWith("https://api.cloudflare.com/")) {
    emails.push({ url, corpo: JSON.parse(String(init.body)) });
    return json({ success: true, result: {} });
  }
  if (url.startsWith("https://push.exemplo/")) {
    pushes.push({ url, headers, corpo: new Uint8Array(init.body as ArrayBuffer) });
    return new Response("", { status: respostaPush });
  }
  throw new Error("fetch inesperado: " + url);
}) as typeof fetch;

/* um navegador inscrito: o par de chaves dele e o segredo */
const ua = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
const uaPub = b64u(new Uint8Array(await crypto.subtle.exportKey("raw", ua.publicKey)));
const uaAuth = b64u(crypto.getRandomValues(new Uint8Array(16)));
async function decifrar(body: Uint8Array): Promise<string> {
  const salt = body.slice(0, 16), idlen = body[20], asPub = body.slice(21, 21 + idlen), cifra = body.slice(21 + idlen);
  const asK = await crypto.subtle.importKey("raw", asPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asK }, ua.privateKey, 256));
  const hk = async (s: Uint8Array, ikm: Uint8Array, info: Uint8Array, n: number) => new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: s, info }, await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]), n * 8));
  const te = new TextEncoder();
  const ikm = await hk(deb64u(uaAuth), ecdh, new Uint8Array([...te.encode("WebPush: info\0"), ...deb64u(uaPub), ...asPub]), 32);
  const cek = await hk(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hk(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const claro = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce },
    await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]), cifra));
  return new TextDecoder().decode(claro.slice(0, claro.lastIndexOf(2)));
}

/* o banco de uma passada normal: a 32.0 aplicada, uma pessoa com um aparelho */
let chaves: { publica: string | null; privada: string | null } = { publica: null, privada: null };
function bancoNormal(): void {
  rpcs = []; pushes = []; emails = [];
  banco = {
    fila_token_confere: (c) => c.p_token === "a".repeat(64),
    fila_quem_sou: (_c, h) => h.authorization === "Bearer ey.sessao.valida" ? { papel: "authenticated", registro: 11 }
      : h.authorization === "Bearer ey.anon.antiga" ? { papel: "anon", registro: null }
      : json({ code: "PGRST301", message: "JWT invalid" }, 401),
    fila_passada_inicio: () => ({ status: "ok", id: 41 }),
    fila_passada_fim: () => null,
    push_chaves: () => chaves,
    push_chaves_gravar: (c) => { if (!chaves.publica) chaves = { publica: String(c.p_publica), privada: String(c.p_privada) }; return chaves; },
    push_lote: () => [{
      registro: 11,
      itens: [
        { id: 900, tipo: "x", titulo: "Antes do aparelho", corpo: "velho", href: "#/", criado_em: "2026-09-28T08:00:00Z" },
        { id: 901, tipo: "atividade_atribuida", titulo: "ORT-14 Calibrar o encoder", corpo: "Você é responsável.",
          href: "#/atividades/card/ORT-14", criado_em: "2026-09-28T12:00:00Z" },
      ],
      inscricoes: [{ id: "insc-1", endpoint: "https://push.exemplo/abc", p256dh: uaPub, auth: uaAuth, criado_em: "2026-09-28T10:00:00Z" }],
    }],
    push_baixa: () => ({ status: "ok" }),
    doc_envios_lote: () => [], agenda_envios_lote: () => [], email_programados_lote: () => [], ps_envios_lote: () => [],
    notificacoes_email_lote: () => [{ registro: 11, nome: "Bruno Tavares", email: "bruno@nro.dev", modo: "imediato",
      itens: [{ id: 901, tipo: "atividade_atribuida", titulo: "ORT-14 Calibrar o encoder", corpo: "Você é responsável.",
                href: "#/atividades/card/ORT-14", criado_em: "2026-09-28T12:00:00Z" }] }],
    notificacoes_email_baixa: () => ({ status: "ok", enviadas: 1 }),
  };
}
const pedir = (headers: Record<string, string>, corpo: unknown = {}) =>
  servir(new Request("https://proj.supabase.co/functions/v1/notificar-email",
    { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(corpo) }));
const chamou = (nome: string) => rpcs.filter((r) => r.nome === nome);

/* ---------- 1. quem pode chamar ---------- */
{
  bancoNormal();
  const r = await pedir({});
  ok("sem credencial nenhuma, a função recusa", r.status === 401 && (await r.json()).detalhe === "sem_credencial");
  ok("e nem pega a vez da fila", chamou("fila_passada_inicio").length === 0);
}
{
  bancoNormal();
  const r = await pedir({ "x-soma-fila": "b".repeat(64) });
  ok("a senha errada do agendamento é recusada", r.status === 401 && (await r.json()).detalhe === "senha_errada");
}
{
  bancoNormal();
  const r = await pedir({ Authorization: "Bearer ey.token.forjado" });
  ok("um JWT que o banco não aceita é recusado", r.status === 401 && (await r.json()).detalhe === "credencial_recusada");
  ok("e quem confere é o próprio PostgREST, com o token de quem chamou",
     chamou("fila_quem_sou")[0]?.headers.authorization === "Bearer ey.token.forjado");
}

/* ---------- 2. a passada do agendamento, inteira ---------- */
{
  bancoNormal();
  const r = await pedir({ "x-soma-fila": "a".repeat(64) }, { origem: "agendamento" });
  const b = await r.json();
  ok("a senha do Vault abre a passada", r.status === 200 && b.status === "ok", JSON.stringify(b));
  ok("que pega a vez como agendamento", chamou("fila_passada_inicio")[0]?.corpo.p_origem === "agendamento");
  ok("na primeira passada, a função gera o par VAPID e guarda", chamou("push_chaves_gravar").length === 1
     && deb64u(String(chaves.publica)).length === 65 && JSON.parse(String(chaves.privada)).d);
  ok("um aviso foi para o aparelho", b.push === 1 && pushes.length === 1);
  const p = pushes[0];
  ok("cifrado em aes128gcm, com validade de um dia", p.headers["content-encoding"] === "aes128gcm" && p.headers.ttl === "86400");
  const [, t, k] = /^vapid t=([^,]+), k=(.+)$/.exec(p.headers.authorization || "") || [];
  ok("assinado com a chave VAPID, que vai junto", !!t && k === chaves.publica);
  const [cab, corpoJwt, ass] = String(t).split(".");
  const pubK = await crypto.subtle.importKey("raw", deb64u(String(chaves.publica)), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  ok("e a assinatura confere", await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pubK, deb64u(ass),
     new TextEncoder().encode(`${cab}.${corpoJwt}`)));
  const claims = JSON.parse(new TextDecoder().decode(deb64u(corpoJwt)));
  ok("para o serviço de push do aparelho, em nome do SOMA", claims.aud === "https://push.exemplo" && claims.sub === "mailto:soma@neurodynamics.dev");
  const msg = JSON.parse(await decifrar(p.corpo));
  ok("o aparelho decifra a mensagem: o título, o corpo e o endereço", msg.t === "ORT-14 Calibrar o encoder"
     && msg.c === "Você é responsável." && msg.h === "#/atividades/card/ORT-14", JSON.stringify(msg));
  ok("e só o aviso que nasceu depois da inscrição", msg.tag === "n901");
  const baixa = chamou("push_baixa")[0]?.corpo.p as Record<string, unknown[]>;
  ok("a baixa leva os dois avisos da pessoa, e o aparelho que recebeu",
     JSON.stringify(baixa?.itens) === "[900,901]" && JSON.stringify(baixa?.ok) === '["insc-1"]');
  ok("o e-mail sai na mesma passada", b.enviadas === 1 && emails.length === 1
     && (emails[0].corpo.to as { address: string }[])[0].address === "bruno@nro.dev");
  const fim = chamou("fila_passada_fim")[0]?.corpo;
  ok("e no fim a vez é devolvida, com o resultado e a origem", fim?.p_id === 41
     && (fim?.p_resultado as Record<string, unknown>)?.status === "ok" && (fim?.p_resultado as Record<string, unknown>)?.origem === "agendamento");
}
{
  bancoNormal();
  await pedir({ "x-soma-fila": "a".repeat(64) });
  ok("na segunda passada, o par que já existe é usado (não gera outro)", chamou("push_chaves_gravar").length === 0 && pushes.length === 1);
}

/* ---------- 3. uma passada de cada vez ---------- */
{
  bancoNormal();
  banco.fila_passada_inicio = () => ({ status: "ocupada", origem: "agendamento", desde: "2026-09-28T12:00:00Z" });
  const r = await pedir({ "x-soma-fila": "a".repeat(64) });
  const b = await r.json();
  ok("com outra passada rodando, a função responde ocupada", b.status === "ocupada" && b.origem === "agendamento");
  ok("e não mexe em fila nenhuma", !chamou("push_lote").length && !chamou("notificacoes_email_lote").length && !emails.length);
  ok("nem devolve uma vez que não é dela", !chamou("fila_passada_fim").length);
}
{
  bancoNormal();
  let vezes = 0;
  banco.fila_passada_inicio = () => (++vezes === 1 ? { status: "ocupada", origem: "agendamento" } : { status: "ok", id: 42 });
  const r = await pedir({ Authorization: "Bearer ey.sessao.valida" }, { origem: "teste" });
  const b = await r.json();
  ok("o teste do portal espera a vez em vez de desistir", vezes === 2 && b.status === "ok" && b.enviadas === 1, JSON.stringify(b));
  ok("e passa como teste", (chamou("fila_passada_fim")[0]?.corpo.p_resultado as Record<string, unknown>)?.origem === "teste");
}
{
  bancoNormal();
  const r = await pedir({ Authorization: "Bearer ey.sessao.valida" }, { origem: "agendamento" });
  const b = await r.json();
  ok("a sessão de quem está no portal vira empurrão, diga o que disser", b.status === "ok"
     && chamou("fila_passada_inicio")[0]?.corpo.p_origem === "portal");
}
{
  bancoNormal();
  const r = await pedir({ Authorization: "Bearer ey.anon.antiga" });
  ok("o agendamento antigo, com a chave anônima, continua passando", (await r.json()).status === "ok"
     && chamou("fila_passada_inicio")[0]?.corpo.p_origem === "anon");
}
{
  bancoNormal();
  const r = await pedir({ Authorization: "Bearer chave-servico" }, { origem: "manual" });
  ok("a service role por extenso entra, e diz de onde vem", (await r.json()).status === "ok"
     && chamou("fila_passada_inicio")[0]?.corpo.p_origem === "manual");
}

/* ---------- 4. o aparelho que sumiu, o erro no meio ---------- */
{
  bancoNormal(); respostaPush = 410;
  const b = await (await pedir({ "x-soma-fila": "a".repeat(64) })).json();
  const baixa = chamou("push_baixa")[0]?.corpo.p as Record<string, unknown[]>;
  ok("o serviço de push diz que a inscrição morreu (410): ela sai", b.push === 0 && b.push_mortas === 1
     && JSON.stringify(baixa?.mortas) === '["insc-1"]');
  respostaPush = 500;
  bancoNormal();
  const c = await (await pedir({ "x-soma-fila": "a".repeat(64) })).json();
  ok("um erro do serviço conta como falha, e o e-mail sai do mesmo jeito", c.push_falhas === 1 && c.enviadas === 1
     && /500/.test(String(c.push_detalhe)));
  respostaPush = 201;
}
{
  bancoNormal();
  banco.notificacoes_email_lote = () => json({ message: "banco caiu" }, 500);
  const r = await pedir({ "x-soma-fila": "a".repeat(64) });
  const b = await r.json();
  ok("o banco caiu no meio: a passada diz onde", r.status === 500 && b.status === "erro_no_lote" && b.push === 1);
  ok("e ainda devolve a vez, com o erro no registro", chamou("fila_passada_fim").length === 1
     && (chamou("fila_passada_fim")[0].corpo.p_resultado as Record<string, unknown>).status === "erro_no_lote");
}

/* ---------- 5. sem a 32.0 aplicada: tudo como antes ---------- */
{
  bancoNormal();
  for (const n of ["fila_quem_sou", "fila_passada_inicio", "fila_passada_fim", "push_chaves", "push_chaves_gravar", "push_lote", "push_baixa"]) delete banco[n];
  const r = await pedir({ Authorization: "Bearer ey.qualquer.jwt" });
  const b = await r.json();
  ok("sem a 32.0, vale a verificação do painel, como era", r.status === 200 && b.status === "ok", JSON.stringify(b));
  ok("o aparelho diz que falta a migração, e o e-mail sai", b.push === "sem_migracao_32" && b.enviadas === 1);
}

console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo verde.");
if (falhas) (globalThis as { process?: { exitCode: number } }).process!.exitCode = 1;
