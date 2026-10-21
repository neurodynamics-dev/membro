/* ============================================================
   acesso.test.ts — quem pode sincronizar (2.18.0): os papéis do banco
   (papeis_atuais, com o token da pessoa) e a conta bloqueada.
   Rode com Node 22+:  node --experimental-strip-types acesso.test.ts
   ============================================================ */
(globalThis as Record<string, unknown>).Deno = {
  env: { get: (k: string) => ({
    SUPABASE_URL: "https://proj.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "chave-servico", SUPABASE_ANON_KEY: "chave-anon",
  } as Record<string, string>)[k] },
  serve() { /* os testes chamam servir() direto */ },
};
const { servir, decidirAcesso } = await import("./index.ts");

let falhas = 0;
const ok = (n: string, c: boolean, extra = "") => {
  console.log((c ? "  ok  " : " FAIL ") + n + (c ? "" : "  << " + extra));
  if (!c) falhas++;
};

/* --- a regra --- */
ok("pessoal por grupo é gestor", decidirAcesso(["pessoal", "leitura"], "leitura", 40).gestor);
ok("admin é gestor", decidirAcesso(["admin", "leitura"], "admin", 4).gestor);
ok("liderança não sincroniza a agenda dos outros", !decidirAcesso(["lideranca", "leitura"], "leitura", 42).gestor);
ok("lista vazia é conta bloqueada", decidirAcesso([], "pessoal", 44).bloqueado === true
   && !decidirAcesso([], "pessoal", 44).gestor);
ok("sem a 2.18.0, vale o papel da conta", decidirAcesso(null, "pessoal", 17).gestor && !decidirAcesso(null, "leitura", 11).gestor);

/* --- a função, com o banco de mentira --- */
type Pessoa = { id: string; registro: number; papel: string; papeis: string[] | null };
const pessoas: Record<string, Pessoa> = {
  "tok-fabio": { id: "u40", registro: 40, papel: "leitura", papeis: ["pessoal", "leitura"] },
  "tok-jonas": { id: "u44", registro: 44, papel: "pessoal", papeis: [] },
  "tok-bruno": { id: "u11", registro: 11, papel: "leitura", papeis: ["leitura"] },
  "tok-carla": { id: "u17", registro: 17, papel: "pessoal", papeis: null },
};
let papeisCom: string[] = [];
let agendasPedidas: string[] = [];
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "Content-Type": "application/json" } });
globalThis.fetch = (async (entrada: string | URL | Request, init: RequestInit = {}) => {
  const url = String(entrada);
  const h = (init.headers || {}) as Record<string, string>;
  const tok = String(h.Authorization || "").replace("Bearer ", "");
  if (url.endsWith("/auth/v1/user")) return pessoas[tok] ? json({ id: pessoas[tok].id }) : json({}, 401);
  if (url.endsWith("/rest/v1/rpc/papeis_atuais")) {
    papeisCom.push(tok);
    const p = pessoas[tok];
    return p.papeis === null ? json({ code: "PGRST202", message: "Could not find the function" }, 404) : json(p.papeis);
  }
  const m = /perfis\?id=eq\.(\w+)/.exec(url);
  if (m) {
    const p = Object.values(pessoas).find((x) => x.id === m[1]);
    return json(p ? [{ registro: p.registro, papel: p.papel }] : []);
  }
  if (url.includes("/rest/v1/portal_agendas?")) { agendasPedidas.push(url); return json([]); }
  throw new Error("fetch inesperado: " + url);
}) as typeof fetch;

const pedir = (tok: string, corpo: unknown = {}) => servir(new Request("https://proj.supabase.co/functions/v1/agenda-sync",
  { method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo) }));

{
  papeisCom = []; agendasPedidas = [];
  const r = await pedir("tok-fabio", { todos: true });
  ok("pessoal por grupo sincroniza todas as agendas", r.status === 200 && agendasPedidas.length === 1
     && !agendasPedidas[0].includes("registro=eq"), String(r.status));
  ok("e os papéis foram pedidos com o token da pessoa", papeisCom[0] === "tok-fabio");
}
{
  agendasPedidas = [];
  const r = await pedir("tok-jonas");
  ok("conta bloqueada recebe 403, mesmo com pessoal na conta", r.status === 403 && agendasPedidas.length === 0);
  ok("e o motivo", (await r.json()).erro === "Conta sem acesso ao portal.");
}
{
  const r = await pedir("tok-bruno", { todos: true });
  ok("leitura não sincroniza todas", r.status === 403);
  agendasPedidas = [];
  const r2 = await pedir("tok-bruno");
  ok("mas sincroniza a própria", r2.status === 200 && agendasPedidas[0]?.includes("registro=eq.11"));
}
{
  const r = await pedir("tok-carla", { registro: 11 });
  ok("sem a 2.18.0 no banco, o pessoal da conta continua valendo", r.status === 200);
}
{
  agendasPedidas = [];
  const r = await pedir("chave-servico", { todos: true });
  ok("a service role (cron) sincroniza todas, sem perguntar papel", r.status === 200 && agendasPedidas.length === 1);
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTudo verde.");
if (falhas) (globalThis as { process?: { exit(c: number): void } }).process?.exit(1);
