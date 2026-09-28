/* ============================================================
   sw.js — o carteiro das notificações do SOMA (32.0)

   Recebe o aviso que a passada da fila empurra (Web Push, cifrado para
   este navegador) e o mostra como notificação do aparelho, com o SOMA
   aberto ou fechado. Tocar na notificação abre o SOMA na tela do aviso.

   De propósito, só isso: não guarda nada em cache e não intercepta
   pedido nenhum (não há "fetch" aqui). O portal continua indo à rede
   como sempre, e um deploy novo vale na hora, sem versão presa no
   aparelho de ninguém.
   ============================================================ */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

/* a mensagem: { t: título, c: corpo, h: '#/tela', tag } — a função manda
   um aviso, ou o resumo de vários de uma vez */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { t: e.data ? e.data.text() : '' }; }
  const titulo = String(d.t || 'SOMA');
  e.waitUntil(self.registration.showNotification(titulo, {
    body: String(d.c || ''),
    icon: 'icone-192.png',
    badge: 'icone-badge.png',
    tag: d.tag ? String(d.tag) : undefined,
    renotify: !!d.tag,
    lang: 'pt-BR',
    data: { href: /^#\/[\w\-\/.%]*$/.test(String(d.h || '')) ? String(d.h) : '#/' }
  }));
});

/* tocar leva à tela do aviso: numa janela do SOMA que já esteja aberta,
   ou numa nova */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const alvo = new URL(e.notification.data?.href || '#/', self.registration.scope).href;
  e.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const doSoma = janelas.find((j) => j.url.startsWith(self.registration.scope));
    if (doSoma) {
      await doSoma.focus();
      try { await doSoma.navigate(alvo); } catch (_) { doSoma.postMessage({ ir: e.notification.data?.href }); }
      return;
    }
    await self.clients.openWindow(alvo);
  })());
});
