/* NRO DS 3.0.0, gerado de brand/design-system/casca.js. Não edite aqui: edite no brand e rode scripts/distribuir.mjs. */
/* ============================================================
   NeuroDynamics · Casca dos sites
   Cabeçalho flutuante, menu do celular e rodapé, iguais nos sites
   públicos (brand, neurodynamics.dev, selecao). O SOMA usa o
   rodapé na variante de app (ver ligar() e ecossistema()).

   Script clássico, sem dependência. No navegador expõe
   window.NDCasca; no Node, module.exports (o brand carimba as
   páginas estáticas com ele, em scripts/carimbar.mjs).

   Uso numa página de site:
     <div id="nd-cab"></div> ... <div id="nd-rod"></div>
     <script src="ds/casca.js"></script>
     NDCasca.montar({ site:'selecao', links:[...], cta:{...} })
   e, a cada troca de rota, NDCasca.marcar('#/cronograma').

   Visual em casca.css. Regras: interface-rules.md, seção 6.
   ============================================================ */
(function (raiz) {
  'use strict';

  /* ---------- os quatro endereços da NeuroDynamics --------- */
  var ECOSSISTEMA = [
    { k: 'site', href: 'https://neurodynamics.dev',
      nome: { pt: 'NeuroDynamics', en: 'NeuroDynamics', fr: 'NeuroDynamics' },
      desc: { pt: 'Site institucional', en: 'Main website', fr: 'Site principal' } },
    { k: 'selecao', href: 'https://selecao.neurodynamics.dev',
      nome: { pt: 'Processo seletivo', en: 'Selection process', fr: 'Recrutement' },
      desc: { pt: 'Inscrições e cronograma', en: 'Join the team', fr: 'Rejoindre l’équipe' } },
    { k: 'brand', href: 'https://brand.neurodynamics.dev',
      nome: { pt: 'Manual da marca', en: 'Brand manual', fr: 'Charte de marque' },
      desc: { pt: 'Logos, cores e recursos', en: 'Logos, colours and assets', fr: 'Logos, couleurs et ressources' } },
    { k: 'soma', href: 'https://membro.neurodynamics.dev',
      nome: { pt: 'SOMA', en: 'SOMA', fr: 'SOMA' },
      desc: { pt: 'Área da equipe', en: 'Team workspace', fr: 'Espace de l’équipe' } }
  ];

  var TEXTOS = {
    pt: {
      menu: 'Abrir menu', fechar: 'Fechar menu', inicio: 'início', idioma: 'Idioma',
      navegacao: 'Navegação', eco: 'NeuroDynamics na web', contato: 'Contato',
      copiar: 'Copiar e-mail', copiado: 'E-mail copiado.', topo: 'Topo',
      hora: 'agora em Belo Horizonte',
      frase: 'Sistemas inteligentes para a saúde humana.',
      desc: 'Iniciativa sem fins lucrativos de pesquisa e desenvolvimento em tecnologia para a saúde, na Escola de Engenharia da UFMG, sediada no LABBIO.',
      local: ['LABBIO, Escola de Engenharia, UFMG', 'Belo Horizonte, MG, Brasil'],
      menuPe: ['Escola de Engenharia, UFMG', 'Belo Horizonte, Brasil'],
      org: 'Sem fins lucrativos', direitos: '© {a} NeuroDynamics'
    },
    en: {
      menu: 'Open menu', fechar: 'Close menu', inicio: 'home', idioma: 'Language',
      navegacao: 'Navigate', eco: 'NeuroDynamics on the web', contato: 'Reach us',
      copiar: 'Copy e-mail', copiado: 'E-mail copied.', topo: 'Top',
      hora: 'now in Belo Horizonte',
      frase: 'Intelligent systems for human health.',
      desc: 'A nonprofit health-tech research and development initiative at the School of Engineering of UFMG, based at LABBIO.',
      local: ['LABBIO, School of Engineering, UFMG', 'Belo Horizonte, MG, Brazil'],
      menuPe: ['School of Engineering, UFMG', 'Belo Horizonte, Brazil'],
      org: 'Nonprofit', direitos: '© {a} NeuroDynamics'
    },
    fr: {
      menu: 'Ouvrir le menu', fechar: 'Fermer le menu', inicio: 'accueil', idioma: 'Langue',
      navegacao: 'Navigation', eco: 'NeuroDynamics sur le web', contato: 'Nous joindre',
      copiar: 'Copier l’e-mail', copiado: 'E-mail copié.', topo: 'Haut',
      hora: 'en ce moment à Belo Horizonte',
      frase: 'Des systèmes intelligents pour la santé humaine.',
      desc: 'Initiative à but non lucratif de recherche et développement en technologies de la santé, à l’École d’Ingénierie de l’UFMG, hébergée au LABBIO.',
      local: ['LABBIO, École d’Ingénierie, UFMG', 'Belo Horizonte, MG, Brésil'],
      menuPe: ['École d’Ingénierie, UFMG', 'Belo Horizonte, Brésil'],
      org: 'À but non lucratif', direitos: '© {a} NeuroDynamics'
    }
  };
  var IDIOMAS = { pt: 'PT', en: 'EN', fr: 'FR' };
  var EMAIL = 'hello@neurodynamics.dev';
  var GEO = '19°52′ S, 43°58′ W';

  /* ---------- utilidades ----------------------------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function t(lang) { return TEXTOS[lang] || TEXTOS.pt; }
  function externo(href) { return /^https?:/.test(href); }
  function alvo(href) { return externo(href) ? ' target="_blank" rel="noopener"' : ''; }
  function atual(l) { return l.atual ? ' aria-current="page"' : ''; }
  var ICONE = {
    copiar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
    feito: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
  };

  /* ---------- cabeçalho ------------------------------------ */
  function idiomaHTML(c, onde) {
    if (!c.idiomas || c.idiomas.length < 2) return '';
    var lang = c.lang || 'pt';
    return '<div class="nd-idioma ' + onde + '" role="group" aria-label="' + esc(t(lang).idioma) + '">' +
      c.idiomas.map(function (l) {
        return '<button type="button" data-nd-idioma="' + l + '" lang="' + l + '" aria-pressed="' + (l === lang) + '">' + IDIOMAS[l] + '</button>';
      }).join('') + '</div>';
  }

  function cabecalho(c) {
    var lang = c.lang || 'pt', tx = t(lang), links = c.links || [];
    var logo = c.logo || BASE + 'marca/imagotipo-branco.webp';
    var tag = c.tag ? '<span class="nd-cab-tag">' + esc(c.tag) + '</span>' : '';
    var cta = c.cta ? '<a class="nd-cta" href="' + esc(c.cta.href) + '"' + alvo(c.cta.href) + '>' + esc(c.cta.rotulo) + '</a>' : '';
    var lista = links.map(function (l, i) {
      var n = (i + 1 < 10 ? '0' : '') + (i + 1);
      return '<li><a href="' + esc(l.href) + '"' + alvo(l.href) + atual(l) + ' data-nd-link="' + esc(l.chave || l.href) + '">' +
        '<span class="n">' + n + '</span><span class="r">' + esc(l.rotulo) + (externo(l.href) ? ' ↗' : '') + '</span></a></li>';
    }).join('');
    return '<header class="nd-cab" data-nd-cab>' +
      '<a class="nd-cab-marca" href="' + esc(c.inicio || '/') + '" aria-label="NeuroDynamics, ' + esc(tx.inicio) + '">' +
        '<img src="' + esc(logo) + '" alt="NeuroDynamics" width="105" height="18">' + tag + '</a>' +
      '<nav class="nd-cab-nav" aria-label="' + esc(tx.navegacao) + '">' +
        links.map(function (l) {
          return '<a href="' + esc(l.href) + '"' + alvo(l.href) + atual(l) + ' data-nd-link="' + esc(l.chave || l.href) + '">' +
            esc(l.rotulo) + (externo(l.href) ? ' ↗' : '') + '</a>';
        }).join('') + '</nav>' +
      '<div class="nd-cab-dir">' + idiomaHTML(c, 'no-cab') + cta +
        '<button class="nd-menu-bt" type="button" aria-expanded="false" aria-controls="nd-menu" aria-label="' + esc(tx.menu) + '"' +
        ' data-rot-abrir="' + esc(tx.menu) + '" data-rot-fechar="' + esc(tx.fechar) + '"><i></i><i></i></button></div>' +
    '</header>' +
    '<div class="nd-menu" id="nd-menu" data-nd-menu hidden>' +
      '<ol class="nd-menu-lista">' + lista + '</ol>' +
      (c.cta ? '<a class="nd-cta nd-menu-cta" href="' + esc(c.cta.href) + '"' + alvo(c.cta.href) + '>' + esc(c.cta.rotulo) + '</a>' : '') +
      '<div class="nd-menu-pe"><span>' + esc(tx.menuPe[0]) + '</span><a href="mailto:' + esc(c.email || EMAIL) + '">' +
        esc(c.email || EMAIL) + '</a><span>' + esc(tx.menuPe[1]) + '</span></div>' +
    '</div>';
  }

  /* ---------- rodapé --------------------------------------- */
  function ecossistema(site, lang) {
    lang = lang || 'pt';
    return '<ul class="nd-eco">' + ECOSSISTEMA.map(function (e) {
      var aqui = e.k === site;
      return '<li><a href="' + e.href + '"' + (aqui ? ' aria-current="page"' : ' target="_blank" rel="noopener"') + '>' +
        '<span class="q" aria-hidden="true"></span><b>' + esc(e.nome[lang]) + (aqui ? '' : ' <span class="seta" aria-hidden="true">↗</span>') +
        '</b><small>' + esc(e.desc[lang]) + '</small></a></li>';
    }).join('') + '</ul>';
  }

  function rodape(c) {
    var lang = c.lang || 'pt', tx = t(lang), email = c.email || EMAIL;
    var links = (c.links || []).map(function (l) {
      return '<li><a href="' + esc(l.href) + '"' + alvo(l.href) + atual(l) + ' data-nd-link="' + esc(l.chave || l.href) + '">' +
        esc(l.rotulo) + (externo(l.href) ? ' ↗' : '') + '</a></li>';
    }).join('');
    var ano = c.ano || new Date().getFullYear();
    return '<footer class="nd-rod" data-nd-rod>' +
      '<div class="nd-rod-in"><div class="nd-rod-topo">' +
        '<div class="nd-rod-marca"><p class="nd-rod-frase">' + esc(c.frase || tx.frase) + '</p>' +
          '<p class="nd-rod-desc">' + esc(c.desc || tx.desc) + '</p></div>' +
        '<nav class="nd-rod-col" aria-label="' + esc(tx.navegacao) + '"><h2 class="nd-rod-rot">' + esc(tx.navegacao) + '</h2><ul>' + links + '</ul></nav>' +
        '<nav class="nd-rod-col" aria-label="' + esc(tx.eco) + '"><h2 class="nd-rod-rot">' + esc(tx.eco) + '</h2>' + ecossistema(c.site, lang) + '</nav>' +
        '<div class="nd-rod-col"><h2 class="nd-rod-rot">' + esc(tx.contato) + '</h2>' +
          '<div class="nd-mail"><a href="mailto:' + esc(email) + '">' + esc(email) + '</a>' +
            '<button class="nd-copiar" type="button" data-nd-copiar="' + esc(email) + '" aria-label="' + esc(tx.copiar) + '" title="' + esc(tx.copiar) + '">' + ICONE.copiar + '</button></div>' +
          '<address>' + esc(tx.local[0]) + '<br>' + esc(tx.local[1]) + '</address>' +
          '<p class="nd-hora"><span class="pt" aria-hidden="true"></span><time data-nd-hora>--:--</time> ' + esc(tx.hora) + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="nd-rod-base"><span>' + esc(tx.direitos.replace('{a}', ano)) + '</span><span>' + esc(tx.org) + '</span>' +
        '<span>' + GEO + '</span><div class="dir">' + idiomaHTML(c, 'no-rod') +
        '<button class="nd-topo-bt" type="button" data-nd-topo>' + esc(tx.topo) + ' <span aria-hidden="true">↑</span></button></div></div>' +
      '<p class="nd-aviso" role="status" aria-live="polite"></p>' +
      '</div></footer>';
  }

  /* ---------- comportamento -------------------------------- */
  function base() {
    if (typeof document === 'undefined') return '';
    var s = document.currentScript;
    if (!s || !/casca\.js/.test(s.src)) s = document.querySelector('script[src*="casca.js"]');
    return s ? s.src.replace(/casca\.js(\?.*)?$/, '') : '';
  }
  var BASE = base();
  var reduz = function () { return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches; };

  function menu(abrir) {
    var bt = document.querySelector('.nd-menu-bt'), m = document.querySelector('[data-nd-menu]');
    if (!bt || !m) return;
    var aberto = abrir === undefined ? bt.getAttribute('aria-expanded') !== 'true' : abrir;
    bt.setAttribute('aria-expanded', String(aberto));
    bt.setAttribute('aria-label', bt.dataset[aberto ? 'rotFechar' : 'rotAbrir']);
    document.documentElement.classList.toggle('nd-menu-aberto', aberto);
    if (aberto) { m.hidden = false; requestAnimationFrame(function () { m.classList.add('aberto'); }); var a = m.querySelector('a'); if (a) a.focus({ preventScroll: true }); }
    else { m.classList.remove('aberto'); setTimeout(function () { if (!m.classList.contains('aberto')) m.hidden = true; }, 260); }
  }

  var relogio = null;
  function hora() {
    var els = document.querySelectorAll('[data-nd-hora]');
    if (!els.length) return;
    var agora = new Date(), f;
    try { f = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(agora); }
    catch (e) { f = agora.toTimeString().slice(0, 5); }
    for (var i = 0; i < els.length; i++) { els[i].textContent = f; els[i].setAttribute('datetime', agora.toISOString()); }
  }


  function ligar(opcoes) {
    opcoes = opcoes || {};
    if (typeof document === 'undefined') return;
    var doc = document;
    if (!doc.__ndCasca) {
      doc.__ndCasca = true;
      doc.addEventListener('click', function (e) {
        var bt = e.target.closest('.nd-menu-bt');
        if (bt) return menu();
        if (e.target.closest('[data-nd-menu] a')) return menu(false);
        var cp = e.target.closest('[data-nd-copiar]');
        if (cp) return copiar(cp);
        if (e.target.closest('[data-nd-topo]')) {
          window.scrollTo({ top: 0, behavior: reduz() ? 'auto' : 'smooth' });
          var alvoFoco = doc.querySelector('main, [role=main]');
          if (alvoFoco) { if (!alvoFoco.hasAttribute('tabindex')) alvoFoco.setAttribute('tabindex', '-1'); alvoFoco.focus({ preventScroll: true }); }
          return;
        }
        var id = e.target.closest('[data-nd-idioma]');
        if (id && NDCasca.aoIdioma) NDCasca.aoIdioma(id.dataset.ndIdioma);
      });
      doc.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && doc.documentElement.classList.contains('nd-menu-aberto')) {
          menu(false); var bt = doc.querySelector('.nd-menu-bt'); if (bt) bt.focus();
        }
      });
      var rolou = function () { var c = doc.querySelector('[data-nd-cab]'); if (c) c.classList.toggle('rolou', window.scrollY > 8); };
      window.addEventListener('scroll', rolou, { passive: true }); rolou();
      if (typeof matchMedia !== 'undefined') matchMedia('(min-width: 961px)').addEventListener('change', function (m) { if (m.matches) menu(false); });
      doc.addEventListener('visibilitychange', function () { if (!doc.hidden) hora(); });
    }
    if (opcoes.aoIdioma) NDCasca.aoIdioma = opcoes.aoIdioma;
    hora(); clearInterval(relogio); relogio = setInterval(hora, 20000);
    var logo = doc.querySelector('.nd-cab-marca img');
    if (logo && !logo.__nd) {
      logo.__nd = true;
      logo.addEventListener('error', function () {
        var s = doc.createElement('span'); s.className = 'nd-logotipo'; s.textContent = 'NeuroDynamics'; logo.replaceWith(s);
      });
    }
  }

  function copiar(bt) {
    var txt = bt.dataset.ndCopiar, aviso = document.querySelector('.nd-aviso');
    var ok = function () {
      var antes = bt.innerHTML; bt.innerHTML = ICONE.feito; bt.classList.add('feito');
      var lang = (document.documentElement.lang || 'pt').slice(0, 2);
      if (aviso) aviso.textContent = t(lang).copiado;
      setTimeout(function () { bt.innerHTML = antes; bt.classList.remove('feito'); if (aviso) aviso.textContent = ''; }, 1600);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(ok, function () { location.href = 'mailto:' + txt; });
    else location.href = 'mailto:' + txt;
  }

  /* Marca o link atual no cabeçalho, no menu e no rodapé. A chave é
     o href (ou o data-chave dado em links). */
  function marcar(chave) {
    if (typeof document === 'undefined') return;
    var els = document.querySelectorAll('[data-nd-link]');
    for (var i = 0; i < els.length; i++) {
      if (els[i].dataset.ndLink === chave) els[i].setAttribute('aria-current', 'page');
      else els[i].removeAttribute('aria-current');
    }
  }

  /* Monta nos marcadores #nd-cab e #nd-rod (ou nos seletores dados)
     e liga o comportamento. Chamar de novo troca o idioma. */
  function montar(c) {
    var cab = document.querySelector(c.cab || '#nd-cab'), rod = document.querySelector(c.rod || '#nd-rod');
    if (cab) cab.innerHTML = cabecalho(c);
    if (rod) rod.innerHTML = rodape(c);
    ligar({ aoIdioma: c.aoIdioma });
  }

  var NDCasca = {
    cabecalho: cabecalho, rodape: rodape, ecossistema: ecossistema,
    montar: montar, ligar: ligar, marcar: marcar, menu: menu,
    ECOSSISTEMA: ECOSSISTEMA, TEXTOS: TEXTOS, EMAIL: EMAIL, BASE: BASE
  };
  if (typeof module === 'object' && module.exports) module.exports = NDCasca;
  else {
    raiz.NDCasca = NDCasca;
    /* página estática com a casca já carimbada: liga sozinha */
    var auto = function () { if (document.querySelector('[data-nd-cab],[data-nd-rod]')) ligar(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
  }
})(typeof window !== 'undefined' ? window : this);
