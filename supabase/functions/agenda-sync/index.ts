/* ============================================================
   agenda-sync — Edge Function do Portal do Membro
   NeuroDynamics

   Lê o link .ics do Google Agenda de cada membro e grava os
   BLOCOS DE OCUPAÇÃO em portal_agenda_blocos, que é o que o
   Assistente de agendamento mostra. O link nunca sai daqui e
   o conteúdo do calendário não é guardado: só início, fim e —
   se a pessoa autorizar — o título.

   Chamadas aceitas (POST, corpo JSON):
     {}                      sincroniza a agenda de quem chamou
     { "registro": 12 }      idem, e admin/pessoal podem pedir
                             a de outra pessoa
     { "todos": true }       todas as agendas conectadas
                             (admin/pessoal ou service role/cron)

   Variáveis de ambiente (o Supabase já injeta as três):
     SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
   ============================================================ */

import { blocosDoIcs, fusoValido } from "./ics.ts";

/** Janela sincronizada: uma semana para trás, dois meses para frente. */
const DIAS_ATRAS = 7;
const DIAS_ADIANTE = 60;
/** Só links destes hosts são buscados. Ampliar aqui e na regex do soma_v12.sql. */
const HOSTS = ["calendar.google.com", "www.google.com"];
const TIMEOUT_MS = 20_000;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_BLOCOS = 3000;
const LOTE = 500;
const PARALELAS = 5;

const env = (nome: string): string =>
  (globalThis as { Deno?: { env: { get(k: string): string | undefined } } })
    .Deno?.env.get(nome) ?? "";

const URL_BASE = env("SUPABASE_URL");
const CHAVE_SERVICO = env("SUPABASE_SERVICE_ROLE_KEY");
const CHAVE_ANON = env("SUPABASE_ANON_KEY");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/* ---------------- acesso ao banco (PostgREST, service role) ---------------- */

async function rest(caminho: string, init: RequestInit = {}): Promise<Response> {
  return await fetch(`${URL_BASE}/rest/v1/${caminho}`, {
    ...init,
    headers: {
      apikey: CHAVE_SERVICO,
      Authorization: `Bearer ${CHAVE_SERVICO}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function consultar<T>(caminho: string): Promise<T[]> {
  const r = await rest(caminho);
  if (!r.ok) throw new Error(`banco (${r.status}): ${(await r.text()).slice(0, 200)}`);
  return await r.json() as T[];
}

/* ---------------- quem está chamando ---------------- */

interface Chamador { registro: number | null; papel: string; servico: boolean; }

async function identificar(req: Request): Promise<Chamador | null> {
  const cabecalho = req.headers.get("Authorization") ?? "";
  const token = cabecalho.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  if (CHAVE_SERVICO && token === CHAVE_SERVICO) {
    return { registro: null, papel: "servico", servico: true };
  }
  const r = await fetch(`${URL_BASE}/auth/v1/user`, {
    headers: { apikey: CHAVE_ANON || CHAVE_SERVICO, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const usuario = await r.json() as { id?: string };
  if (!usuario.id) return null;
  const perfis = await consultar<{ registro: number | null; papel: string | null }>(
    `perfis?id=eq.${encodeURIComponent(usuario.id)}&select=registro,papel&limit=1`);
  if (!perfis.length) return null;
  return {
    registro: perfis[0].registro ?? null,
    papel: perfis[0].papel ?? "leitura",
    servico: false,
  };
}

/* ---------------- sincronização de uma agenda ---------------- */

interface Agenda { registro: number; fuso: string; compartilha_titulos: boolean; }

async function baixarIcs(url: string): Promise<string> {
  let alvo: URL;
  try { alvo = new URL(url); } catch { throw new Error("Link inválido."); }
  if (alvo.protocol !== "https:" || !HOSTS.includes(alvo.hostname)) {
    throw new Error("Link fora do Google Agenda. Use o endereço secreto em formato iCal.");
  }
  const corta = AbortSignal.timeout ? AbortSignal.timeout(TIMEOUT_MS) : undefined;
  const r = await fetch(alvo.toString(), {
    redirect: "follow",
    headers: { Accept: "text/calendar, text/plain" },
    signal: corta,
  });
  if (r.status === 404 || r.status === 401 || r.status === 403) {
    throw new Error("O Google recusou o link (" + r.status +
      "). Ele pode ter sido redefinido — copie o endereço secreto de novo.");
  }
  if (!r.ok) throw new Error(`O Google respondeu ${r.status}.`);
  const tamanho = Number(r.headers.get("content-length") ?? 0);
  if (tamanho > MAX_BYTES) throw new Error("Calendário grande demais para sincronizar.");
  const texto = (await r.text()).slice(0, MAX_BYTES);
  if (!texto.includes("BEGIN:VCALENDAR")) {
    throw new Error("O link não devolveu um calendário iCal.");
  }
  return texto;
}

async function sincronizar(agenda: Agenda, url: string, de: Date, ate: Date) {
  const texto = await baixarIcs(url);
  const fuso = fusoValido(agenda.fuso) ? agenda.fuso : "America/Sao_Paulo";
  const blocos = blocosDoIcs(texto, { fuso, de, ate, maxBlocos: MAX_BLOCOS });

  const apagar = await rest(`portal_agenda_blocos?registro=eq.${agenda.registro}`, { method: "DELETE" });
  if (!apagar.ok) throw new Error(`ao limpar os blocos: ${(await apagar.text()).slice(0, 200)}`);

  const linhas = blocos.map((b) => ({
    registro: agenda.registro,
    inicio: b.inicio.toISOString(),
    fim: b.fim.toISOString(),
    dia_inteiro: b.diaInteiro,
    titulo: agenda.compartilha_titulos ? b.titulo : null,
    uid: b.uid,
  }));
  for (let i = 0; i < linhas.length; i += LOTE) {
    const gravar = await rest("portal_agenda_blocos", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(linhas.slice(i, i + LOTE)),
    });
    if (!gravar.ok) throw new Error(`ao gravar os blocos: ${(await gravar.text()).slice(0, 200)}`);
  }
  return linhas.length;
}

async function anotar(registro: number, blocos: number | null, erro: string | null) {
  await rest(`portal_agendas?registro=eq.${registro}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      ultima_sync: new Date().toISOString(),
      ultimo_erro: erro ? erro.slice(0, 400) : null,
      blocos_sync: blocos,
    }),
  });
}

/* ---------------- entrada ---------------- */

async function servir(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ erro: "Use POST." }, 405);
  if (!URL_BASE || !CHAVE_SERVICO) {
    return resposta({ erro: "Função sem SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY." }, 500);
  }

  const quem = await identificar(req);
  if (!quem) return resposta({ erro: "Sessão inválida." }, 401);

  let pedido: { registro?: number; todos?: boolean } = {};
  try { pedido = await req.json(); } catch { /* corpo vazio = sincroniza a própria */ }

  const gestor = quem.servico || ["admin", "pessoal"].includes(quem.papel);
  let filtro: string;
  if (pedido.todos) {
    if (!gestor) return resposta({ erro: "Só o Depto. de Pessoal sincroniza todas as agendas." }, 403);
    filtro = "";
  } else {
    const alvo = pedido.registro ?? quem.registro;
    if (alvo == null) {
      return resposta({ erro: "Sua conta ainda não está vinculada a um registro de membro." }, 400);
    }
    if (alvo !== quem.registro && !gestor) {
      return resposta({ erro: "Você só pode sincronizar a sua própria agenda." }, 403);
    }
    filtro = `&registro=eq.${alvo}`;
  }

  const agendas = await consultar<Agenda>(
    `portal_agendas?select=registro,fuso,compartilha_titulos&conectado=is.true&ativo=is.true${filtro}`);
  if (!agendas.length) {
    return resposta({ ok: true, sincronizadas: 0, resultados: [],
      aviso: "Nenhuma agenda conectada e ativa para sincronizar." });
  }

  const agora = Date.now();
  const de = new Date(agora - DIAS_ATRAS * 86400000);
  const ate = new Date(agora + DIAS_ADIANTE * 86400000);

  const registros = agendas.map((a) => a.registro);
  const segredos = await consultar<{ registro: number; ics_url: string }>(
    `portal_agenda_segredo?select=registro,ics_url&registro=in.(${registros.join(",")})`);
  const links = new Map(segredos.map((s) => [s.registro, s.ics_url]));

  const resultados: { registro: number; blocos: number | null; erro: string | null }[] = [];
  for (let i = 0; i < agendas.length; i += PARALELAS) {
    await Promise.all(agendas.slice(i, i + PARALELAS).map(async (agenda) => {
      const url = links.get(agenda.registro);
      if (!url) {
        await anotar(agenda.registro, null, "Nenhum link .ics guardado.");
        resultados.push({ registro: agenda.registro, blocos: null, erro: "sem link" });
        return;
      }
      try {
        const n = await sincronizar(agenda, url, de, ate);
        await anotar(agenda.registro, n, null);
        resultados.push({ registro: agenda.registro, blocos: n, erro: null });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await anotar(agenda.registro, null, msg);
        resultados.push({ registro: agenda.registro, blocos: null, erro: msg });
      }
    }));
  }

  resultados.sort((a, b) => a.registro - b.registro);
  return resposta({
    ok: true,
    janela: { de: de.toISOString(), ate: ate.toISOString() },
    sincronizadas: resultados.filter((r) => !r.erro).length,
    falhas: resultados.filter((r) => r.erro).length,
    resultados,
  });
}

const servidor = (globalThis as { Deno?: { serve(h: (r: Request) => Promise<Response>): unknown } }).Deno;
servidor?.serve(async (req: Request) => {
  try {
    return await servir(req);
  } catch (e) {
    return resposta({ erro: e instanceof Error ? e.message : String(e) }, 500);
  }
});
