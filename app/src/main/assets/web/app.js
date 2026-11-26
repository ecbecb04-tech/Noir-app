/* GATOFLIX — interface (TV e celular). */
'use strict';
(function () {
  const D = window.NoirData;
  const N = window.NoirNative || null;
  const qs = new URLSearchParams(location.search);
  const MODE = (N && N.mode && N.mode()) || qs.get('mode') || (innerWidth > innerHeight ? 'tv' : 'mobile');
  const TV = MODE === 'tv';
  document.documentElement.classList.add(MODE);
  document.body.classList.add(MODE);

  // ---------- utilidades ----------
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => Number(n || 0).toLocaleString('pt-BR');
  const hhmm = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const rel = (ts) => {
    if (!ts) return 'nunca';
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'agora';
    if (m < 60) return `há ${m} min`;
    if (m < 1440) return `há ${Math.round(m / 60)} h`;
    return `há ${Math.round(m / 1440)} dias`;
  };
  const store = {
    get(k, d) { try { const v = localStorage.getItem('noir:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('noir:' + k, JSON.stringify(v)); } catch (e) { /* cheio */ } },
  };
  const idb = (() => {
    let p;
    const open = () => p || (p = new Promise((res, rej) => {
      const r = indexedDB.open('noir', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
    const tx = (mode, fn) => open().then((db) => new Promise((res) => {
      const t = db.transaction('kv', mode);
      const r = fn(t.objectStore('kv'));
      t.oncomplete = () => res(r && r.result);
      t.onerror = () => res(undefined);
    })).catch(() => undefined);
    return {
      get: (k) => tx('readonly', (s) => s.get(k)),
      set: (k, v) => tx('readwrite', (s) => { s.put(v, k); }),
      del: (k) => tx('readwrite', (s) => { s.delete(k); }),
    };
  })();
  const PAL = [['#14303A', '#E8A23A'], ['#3A1D2E', '#C2557A'], ['#1C2B3F', '#5B8DD6'], ['#3D2A14', '#D9893B'],
    ['#1E3324', '#58A06C'], ['#2A2140', '#8B6FD6'], ['#3B1A1A', '#D65B5B'], ['#173236', '#4FB3B3']];
  const pal = (s) => PAL[parseInt(D.hash(s || 'x'), 36) % PAL.length];

  // Logo: carinha de gato (laranja malhado, orelhas e focinho rosa).
  const CAT = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FF8A3D" d="M8.5 21 6 4.5l12.2 7.6q5.8-2 11.6 0L42 4.5 39.5 21q4.5 9-1.2 16.6Q32.4 44 24 44t-14.3-6.4Q4 30 8.5 21z"/><path fill="#FF6FA3" d="M10.6 15.6 9.4 8.8l5.8 3.9zM37.4 15.6l1.2-6.8-5.8 3.9z"/><path fill="#E5702A" d="M24 12.4v5.2M20.5 12.8l1 4.2M27.5 12.8l-1 4.2" stroke="#E5702A" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="17" cy="26" rx="2.7" ry="3.5" fill="#100D14"/><ellipse cx="31" cy="26" rx="2.7" ry="3.5" fill="#100D14"/><circle cx="17.9" cy="24.7" r=".9" fill="#fff"/><circle cx="31.9" cy="24.7" r=".9" fill="#fff"/><path fill="#FF6FA3" d="M21.8 30.4h4.4L24 33z"/><path d="M24 33q-1.6 2.6-3.8 1.2M24 33q1.6 2.6 3.8 1.2" fill="none" stroke="#100D14" stroke-width="1.3" stroke-linecap="round"/><path d="M13.5 31.5 4 30M13.8 34 5 36.5M34.5 31.5 44 30M34.2 34 43 36.5" stroke="#FFE9D2" stroke-width="1.1" stroke-linecap="round" opacity=".85"/></svg>';
  const LOGO = (cls) => `<div class="logo brand ${cls || ''}" role="img" aria-label="Gatoflix"><span class="ear">G</span>ATOFLIX</div>`;
  const PAW = '<svg class="paw" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="12" cy="16.2" rx="5" ry="4.2"/><ellipse cx="5.6" cy="10.4" rx="2.1" ry="2.7"/><ellipse cx="9.6" cy="6.6" rx="2.1" ry="2.8"/><ellipse cx="14.4" cy="6.6" rx="2.1" ry="2.8"/><ellipse cx="18.4" cy="10.4" rx="2.1" ry="2.7"/></svg>';

  const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I = {
    search: P('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    home: P('<path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z"/>'),
    sparkle: P('<path d="M12 3l2 5.5L19.5 10 14 12l-2 6-2-6-5.5-2L10 8.5z"/><path d="M19 16v4M17 18h4"/>'),
    tv: P('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M8 2l4 4 4-4"/>'),
    film: P('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4"/>'),
    series: P('<rect x="2" y="7" width="16" height="13" rx="2"/><path d="M6 4h16v12"/>'),
    gear: P('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'),
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>',
    plus: P('<path d="M12 5v14M5 12h14"/>'),
    check: P('<path d="M5 12l5 5 9-10"/>'),
    info: P('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
    star: P('<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/>'),
    starF: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/></svg>',
    list: P('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
    chev: P('<path d="M9 6l6 6-6 6"/>'),
    qr: P('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v1M14 20h7"/>'),
    kb: P('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'),
    file: P('<path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6"/>'),
    ext: P('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>'),
    x: P('<path d="M6 6l12 12M18 6L6 18"/>'),
    bell: P('<path d="M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 004 0"/>'),
  };

  // ---------- estado ----------
  const S = {
    lists: store.get('lists', []),
    settings: Object.assign({ omdbKey: '', tmdbKey: '', ua: '', subLang: 'pt', audioLang: '', subSize: 'M', showImdb: true, autoUpdate: true, hideAdult: true },
      store.get('settings', {})),
    favs: new Set(store.get('favs', [])),
    history: store.get('history', []),
    recent: store.get('recent', []),
    data: {}, epgData: {},
    cat: { channels: [], movies: [], series: [] },
    groups: { channels: [], movies: [], series: [] },
    byId: new Map(),
    epg: { progs: {}, names: new Map() },
    news: store.get('news', null),
    newsErr: '',
    route: { name: 'home', params: {} },
    stack: [],
    loading: false,
    q: '',
    liveRendered: 0, liveList: [],
    add: null,
    sheet: null,
  };
  const saveLists = () => store.set('lists', S.lists.map((l) => Object.assign({}, l, { fileText: undefined })));
  const saveSettings = () => store.set('settings', S.settings);
  const saveFavs = () => store.set('favs', Array.from(S.favs));

  // ---------- catálogo ----------
  const ADULT = /adult|xxx|\+18|18\+|adulto|erotic|porn|hot\b/i;
  function rebuild() {
    const ch = [], mv = [], se = [];
    for (const l of S.lists) {
      const d = S.data[l.id];
      if (!d) continue;
      const off = new Set(l.groupsOff || []);
      const ok = (x) => !off.has(x.group) && !(S.settings.hideAdult && ADULT.test(x.group + ' ' + x.name));
      (d.channels || []).forEach((x) => ok(x) && ch.push(x));
      (d.movies || []).forEach((x) => ok(x) && mv.push(x));
      (d.series || []).forEach((x) => ok(x) && se.push(x));
    }
    S.cat = { channels: ch, movies: mv, series: se };
    S.byId = new Map();
    for (const arr of [ch, mv, se]) for (const x of arr) S.byId.set(x.id, x);
    const uniq = (a) => Array.from(new Set(a.map((x) => x.group)));
    S.groups = { channels: uniq(ch), movies: uniq(mv), series: uniq(se) };
    // guia
    const progs = {}, names = new Map();
    for (const id in S.epgData) {
      const e = S.epgData[id];
      if (!e || !e.progs) continue;
      for (const k in e.progs) progs[k] = (progs[k] || []).concat(e.progs[k]);
      for (const k in e.channels || {}) names.set(D.norm(e.channels[k].n), k);
    }
    for (const k in progs) progs[k].sort((a, b) => a[0] - b[0]);
    S.epg = { progs, names };
    S.featured = null;
  }
  function epgOf(ch) {
    if (!ch) return null;
    if (ch.tvgId && S.epg.progs[ch.tvgId]) return S.epg.progs[ch.tvgId];
    const k = S.epg.names.get(D.norm(ch.name));
    return k ? S.epg.progs[k] : null;
  }
  function nowNext(ch) {
    const p = epgOf(ch);
    const t = Date.now();
    if (!p) return { now: null, next: null, pct: 0 };
    let i = p.findIndex((x) => x[0] <= t && x[1] > t);
    if (i < 0) { const j = p.findIndex((x) => x[0] > t); return { now: null, next: j >= 0 ? p[j] : null, pct: 0 }; }
    const now = p[i];
    return { now, next: p[i + 1] || null, pct: Math.max(0, Math.min(100, ((t - now[0]) / (now[1] - now[0])) * 100)) };
  }

  async function refreshList(list, silent) {
    try {
      if (list.url === 'file:' && !list.fileText) list.fileText = await idb.get('file:' + list.id);
      const d = await D.loadList(list);
      d.at = Date.now();
      S.data[list.id] = d;
      list.updatedAt = d.at;
      list.error = '';
      list.counts = { c: d.channels.length, m: d.movies.length, s: d.series.length };
      await idb.set('list:' + list.id, d);
      saveLists();
      rebuild();
      if (d.epgUrl) refreshEpg(list, d.epgUrl);
      if (!silent) toast(`Lista “${list.name}” atualizada`);
    } catch (e) {
      list.error = e.message || 'Erro ao carregar';
      saveLists();
      if (!silent) toast(`Erro em “${list.name}”: ${list.error}`);
    }
    softRender();
  }
  async function refreshEpg(list, url) {
    try {
      const e = await D.loadEpg(url);
      e.at = Date.now();
      S.epgData[list.id] = e;
      await idb.set('epg:' + list.id, e);
      rebuild();
      softRender();
    } catch (e) { /* guia é opcional */ }
  }
  async function refreshNews(force) {
    if (!S.settings.tmdbKey) return;
    if (!force && S.news && Date.now() - S.news.at < 6 * 3600000) return;
    S.newsErr = '';
    try {
      S.news = await D.loadNews(S.settings.tmdbKey);
      store.set('news', S.news);
    } catch (e) {
      S.newsErr = e.message;
    }
    softRender();
  }

  // ---------- IMDb nas capas ----------
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      io.unobserve(en.target);
      const it = S.byId.get(en.target.dataset.iq) || newsById(en.target.dataset.iq);
      if (it) fetchImdb(it);
    }
  }, { rootMargin: '200px' }) : null;
  function fetchImdb(it) {
    if (!S.settings.showImdb || !S.settings.omdbKey) return Promise.resolve(null);
    return D.imdbFetch(it, S.settings.omdbKey).then((v) => {
      if (v && v.r) $$(`[data-ik="${CSS.escape(D.imdbKey(it))}"]`).forEach((el) => { el.textContent = 'IMDb ' + v.r.replace('.', ','); });
      return v;
    });
  }
  function observeImdb() {
    if (!io || !S.settings.omdbKey || !S.settings.showImdb) return;
    $$('[data-iq]').forEach((el) => io.observe(el));
  }
  function imdbBadge(it) {
    if (!S.settings.showImdb || !it) return '';
    const c = D.imdbCached(it);
    const r = c && !c.miss && c.r ? 'IMDb ' + c.r.replace('.', ',') : '';
    return `<span class="imdb" data-ik="${esc(D.imdbKey(it))}">${r}</span>`;
  }
  const imdbVal = (it) => { const c = D.imdbCached(it); return c && c.r ? parseFloat(c.r) : 0; };

  // ---------- componentes ----------
  function art(it, img) {
    const [bg, fg] = pal(it.title || it.name);
    const src = img || it.logo;
    return `<div class="ph" style="background:${bg}"><i style="background:${fg};width:80%;height:55%;right:-22%;top:8%"></i></div>`
      + `<div class="tl">${esc(it.title || it.name)}</div>`
      + (src ? `<img loading="lazy" src="${esc(src)}" alt="" onerror="this.remove()">` : '');
  }
  function heroBg(it) {
    if (it.backdrop) return `<img class="cover" src="${esc(it.backdrop)}" alt="" onerror="this.remove()">`;
    if (it.logo) return `<img class="blur" src="${esc(it.logo)}" alt="" onerror="this.remove()"><img class="pst" src="${esc(it.logo)}" alt="" onerror="this.remove()">`;
    return '<span class="art1"></span>';
  }
  function posterCard(it, rk, extra) {
    return `<button class="card poster f" data-act="open" data-id="${it.id}" data-k="${rk}:${it.id}" data-iq="${it.id}" data-hover="hero" aria-label="${esc(it.title || it.name)}">`
      + art(it) + `<div class="bdg">${imdbBadge(it)}</div>${it.lang ? `<div class="bdg r"><span class="dark">${it.lang}</span></div>` : ''}${extra || ''}</button>`;
  }
  function landCard(it, rk, opts) {
    const o = opts || {};
    return `<button class="card ${o.big ? 'big' : 'land'} f" data-act="${o.act || 'open'}" data-id="${it.id}" data-k="${rk}:${it.id}" data-iq="${it.id}" aria-label="${esc(it.title || it.name)}">`
      + art(it, o.img || it.backdrop || it.logo) + (o.img || it.backdrop || it.logo ? '<div class="sh"></div>' : '')
      + `<div class="bdg">${o.badge || ''}${imdbBadge(it)}</div>${o.right ? `<div class="bdg r">${o.right}</div>` : ''}`
      + (o.bar != null ? `<div class="bar"><i style="width:${o.bar}%"></i></div>` : '') + '</button>';
  }
  function chCard(ch, rk) {
    const nn = nowNext(ch);
    return `<button class="card land chcard f" data-act="playCh" data-id="${ch.id}" data-k="${rk}:${ch.id}" aria-label="${esc(ch.name)}" style="background:${pal(ch.name)[0]}">`
      + `<div class="logo">${ch.logo ? `<img loading="lazy" src="${esc(ch.logo)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('b'),{textContent:${esc(JSON.stringify(ch.name))}}))">` : `<b>${esc(ch.name)}</b>`}</div>`
      + '<div class="sh"></div>'
      + `<div class="bdg"><span class="livebadge">AO VIVO</span></div>`
      + `<div class="nw"><span>${esc(nn.now ? nn.now[2] : ch.name)}</span><div class="bar"><i style="width:${nn.pct}%"></i></div></div></button>`;
  }
  const row = (title, small, items, cls) => items ? `<section class="row ${cls || ''}"><h2>${title}${small ? `<small>${small}</small>` : ''}</h2><div class="track">${items}</div></section>` : '';
  const spinner = (msg) => `<div class="empty"><div class="spin"></div><p>${esc(msg)}</p></div>`;
  const chips = (arr, cur, act, extra) => `<div class="chips">${arr.map((c) => `<button class="chip f ${c === cur ? 'on' : ''}" data-act="${act}" data-v="${esc(c)}" data-k="chip:${esc(c)}"${extra || ''}>${esc(c)}</button>`).join('')}</div>`;
  function metaLine(it, more) {
    const c = D.imdbCached(it) || {};
    const parts = [imdbBadge(it)];
    const y = it.year || (c.year || '').slice(0, 4);
    if (y) parts.push(`<span>${esc(y)}</span>`);
    if (c.genre) parts.push(`<span>${esc(c.genre.split(',').slice(0, 2).join(', '))}</span>`);
    if (c.runtime) parts.push(`<span>${esc(c.runtime.replace(' min', ' min'))}</span>`);
    if (more) parts.push(more);
    if (it.lang) parts.push(`<span class="tag">${it.lang}</span>`);
    return `<div class="meta">${parts.join('')}</div>`;
  }

  // ---------- navegação principal ----------
  const NAV = [
    { r: 'search', label: 'Buscar', ic: 'search', tvOnly: true },
    { r: 'home', label: 'Início', ic: 'home' },
    { r: 'news', label: 'Novidades', ic: 'sparkle', tvOnly: true },
    { r: 'live', label: 'TV ao vivo', ic: 'tv' },
    { r: 'movies', label: 'Filmes', ic: 'film' },
    { r: 'series', label: 'Séries', ic: 'series' },
    { r: 'settings', label: TV ? 'Configurações' : 'Ajustes', ic: 'gear' },
  ];
  const TOP = { home: 'home', news: 'news', live: 'live', movies: 'movies', series: 'series', search: 'search', settings: 'settings', add: 'settings', addform: 'settings', detail: null };
  function renderNav() {
    $('#nav').innerHTML = LOGO() + NAV.map((n) =>
      `<button class="ni f ${n.tvOnly ? 'tvonly' : ''}" data-act="nav" data-r="${n.r}" data-k="nav:${n.r}">${I[n.ic]}<span>${n.label}</span></button>`).join('');
  }
  function updateNav() {
    const top = TOP[S.route.name] || (S.stack.length ? TOP[S.stack[0].name] : 'home');
    $$('#nav .ni').forEach((b) => b.classList.toggle('on', b.dataset.r === top));
  }

  // ---------- roteador ----------
  function go(name, params, opts) {
    const o = opts || {};
    if ((S.route.name === 'add' || S.route.name === 'addform') && name !== 'add' && name !== 'addform' && N) N.stopLan();
    if (o.root) S.stack = [];
    else if (!o.replace) S.stack.push({ name: S.route.name, params: S.route.params, focus: focusKey(), scroll: $('#main').scrollTop });
    S.route = { name, params: params || {} };
    render();
  }
  function back() {
    if (S.sheet) { closeSheet(); return true; }
    if (S.stack.length) {
      const prev = S.stack.pop();
      S.route = { name: prev.name, params: prev.params };
      render(prev.focus, prev.scroll);
      return true;
    }
    if (S.route.name !== 'home') { S.route = { name: 'home', params: {} }; render(); return true; }
    return false;
  }
  const focusKey = () => { const a = document.activeElement; return a && a.dataset ? a.dataset.k || '' : ''; };

  function render(focusK, scroll) {
    const fn = SCREENS[S.route.name] || SCREENS.home;
    const main = $('#main');
    main.innerHTML = fn(S.route.params);
    main.scrollTop = scroll || 0;
    updateNav();
    observeImdb();
    afterRender();
    if (TV) {
      let el = focusK ? $(`[data-k="${CSS.escape(focusK)}"]`) : null;
      if (!el) el = $('#main [data-autofocus]') || $('#main .f');
      if (el) focusEl(el, true);
      else { const n = $('#nav .ni.on') || $('#nav .ni'); if (n) n.focus(); }
    }
  }
  /** Re-renderiza a tela atual mantendo o foco (após carregar dados). */
  function softRender() {
    if (S.sheet) return;
    const a = document.activeElement;
    const inMain = a && $('#main').contains(a);
    const k = focusKey();
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    const sc = $('#main').scrollTop;
    const hadF = !!$('#main .f');
    const fn = SCREENS[S.route.name] || SCREENS.home;
    $('#main').innerHTML = fn(S.route.params);
    $('#main').scrollTop = sc;
    observeImdb();
    afterRender();
    if (TV) {
      const el = (inMain && k && $(`[data-k="${CSS.escape(k)}"]`)) || (inMain || !hadF || a === document.body ? ($('#main [data-autofocus]') || $('#main .f')) : null);
      if (el) focusEl(el, true);
    }
  }
  function afterRender() {
    if (S.route.name === 'add') drawQr();
  }

  // ---------- telas ----------
  const SCREENS = {};

  function emptyLists() {
    return `<div class="empty"><div class="cat">${CAT}</div>
      <h1>Miau! Bem-vindo ao Gatoflix</h1>
      <p>Adicione sua lista de canais, filmes e séries (M3U, Xtream Codes ou guia EPG) para começar. Nada é enviado para fora do seu aparelho.</p>
      <button class="btn pri f" data-act="go" data-r="add" data-autofocus>${I.plus}Adicionar lista</button></div>`;
  }
  function pickFeatured(kind) {
    const pool = (kind === 'series' ? S.cat.series : S.cat.movies).filter((x) => x.logo).slice(0, 400);
    if (!pool.length) return (kind === 'series' ? S.cat.series : S.cat.movies)[0] || null;
    const rated = pool.filter((x) => imdbVal(x) >= 7);
    const src = rated.length ? rated : pool;
    const dayN = Math.floor(Date.now() / 86400000);
    return src[dayN % src.length];
  }
  function mobileTop() {
    return `<div class="mtop"><div class="r1">${LOGO()}<div style="display:flex">
      <button class="ib f" data-act="go" data-r="search" aria-label="Buscar">${I.search}</button>
      <button class="ib f" data-act="go" data-r="news" aria-label="Novidades">${I.sparkle}</button></div></div>
      <div class="r2"><a href="#" class="f" data-act="nav" data-r="series">Séries</a><a href="#" class="f" data-act="nav" data-r="movies">Filmes</a><a href="#" class="f" data-act="nav" data-r="live">TV ao vivo</a></div></div>`;
  }
  function heroHtml(it, kicker, withActs) {
    if (!it) return TV ? '' : `<section class="hero" style="height:12rem">${mobileTop()}</section>`;
    const c = D.imdbCached(it) || {};
    const plot = it.plot || c.plot || '';
    return `<section class="hero" data-hero="${it.id}"><div class="bg">${heroBg(it)}</div><div class="scrim"></div>
      ${TV ? '' : mobileTop()}
      <div class="info"><span class="kicker">${PAW}${esc(kicker)}</span><h1>${esc(it.title || it.name)}</h1>${metaLine(it)}
      ${plot ? `<p>${esc(plot)}</p>` : ''}
      ${withActs ? `<div class="acts"><button class="btn pri f" data-act="playItem" data-id="${it.id}" data-k="hero:play">${I.play}Assistir</button>
      <button class="btn f" data-act="open" data-id="${it.id}" data-k="hero:info">${TV ? I.info + 'Mais informações' : I.plus + 'Detalhes'}</button></div>` : ''}</div></section>`;
  }
  function continueItems() {
    if (!N) return [];
    return S.history.map((h) => {
      let p = {};
      try { p = JSON.parse(N.progress(h.url) || '{}'); } catch (e) { p = {}; }
      const pct = p.dur ? Math.round((p.pos / p.dur) * 100) : 0;
      return Object.assign({}, h, { pct });
    }).filter((h) => h.pct > 1 && h.pct < 95);
  }

  SCREENS.home = () => {
    if (!S.lists.length) return emptyLists();
    const any = S.cat.channels.length + S.cat.movies.length + S.cat.series.length;
    if (!any) return S.loading || S.lists.some((l) => !l.updatedAt && !l.error) ? spinner('O gato está buscando suas listas…')
      : `<div class="empty"><h1>Nenhum conteúdo</h1><p>As listas não trouxeram itens. Confira os links em Configurações.</p><button class="btn pri f" data-act="nav" data-r="settings">${I.gear}Configurações</button></div>`;
    if (!S.featured) S.featured = pickFeatured('movies') || pickFeatured('series');
    const f = S.featured;
    let h = heroHtml(f, 'ESCOLHA DO GATO', true);
    const rows = [];
    const cont = continueItems();
    if (cont.length) rows.push(row('Continuar assistindo', '', cont.map((x) => landCard(x, 'cont', { act: 'resume', bar: x.pct })).join('')));
    const favCh = S.cat.channels.filter((c) => S.favs.has(c.id));
    const chs = (favCh.length ? favCh : S.cat.channels).slice(0, 20);
    if (chs.length) rows.push(row(favCh.length ? 'Canais favoritos' : 'Canais', '', chs.map((c) => chCard(c, 'hch')).join('')));
    const myList = [...S.cat.movies, ...S.cat.series].filter((x) => S.favs.has(x.id)).slice(0, 30);
    if (myList.length) rows.push(row('Minha lista', '', myList.map((x) => posterCard(x, 'my')).join('')));
    if (S.settings.tmdbKey && S.news && S.news.recent.length) {
      rows.push(row('Novidades nos streamings', '', S.news.recent.slice(0, 16).map((x) => landCard(x, 'hnews', {
        img: x.backdrop || x.logo, badge: '<span class="livebadge">NOVO</span>', right: `<span class="dark">${esc(x.svc)}</span>`,
      })).join('') + (TV ? '' : '')));
    }
    const recentMovies = recentOf(S.cat.movies).slice(0, 30);
    if (recentMovies.length) rows.push(row('Filmes adicionados recentemente', '', recentMovies.map((x) => posterCard(x, 'hrm')).join('')));
    const ser = recentOf(S.cat.series).slice(0, 30);
    if (ser.length) rows.push(row('Séries', '', ser.map((x) => posterCard(x, 'hse')).join('')));
    const top = topRated([...S.cat.movies, ...S.cat.series]);
    if (top.length >= 6) rows.push(row('Mais bem avaliados no IMDb', '', top.map((x) => posterCard(x, 'htop')).join('')));
    return h + `<div class="rows">${rows.join('')}</div>`;
  };
  const recentOf = (arr) => (arr.some((x) => x.added) ? arr.slice().sort((a, b) => (b.added || 0) - (a.added || 0)) : arr.slice().reverse());
  const topRated = (arr) => arr.filter((x) => imdbVal(x) > 0).sort((a, b) => imdbVal(b) - imdbVal(a)).slice(0, 30);

  // --- TV ao vivo ---
  function liveChannels(cat) {
    if (cat === 'Favoritos') return S.cat.channels.filter((c) => S.favs.has(c.id));
    if (!cat || cat === 'Todos') return S.cat.channels;
    return S.cat.channels.filter((c) => c.group === cat);
  }
  SCREENS.live = (p) => {
    if (!S.lists.length) return emptyLists();
    if (!S.cat.channels.length) return S.loading ? spinner('Carregando canais…') : `<div class="empty"><h1>Sem canais</h1><p>Adicione uma lista M3U ou Xtream com canais de TV.</p><button class="btn pri f" data-act="go" data-r="add">${I.plus}Adicionar lista</button></div>`;
    const cat = p.cat || 'Todos';
    const list = liveChannels(cat);
    S.liveList = list;
    const cats = ['Todos', 'Favoritos'].concat(S.groups.channels);
    if (!TV) {
      S.liveRendered = Math.min(list.length, 150);
      return `<div class="phead"><h1>TV ao vivo</h1><button class="ib f" data-act="go" data-r="search" aria-label="Buscar canal">${I.search}</button></div>
        <div style="padding:1.2rem 2rem">${chips(cats, cat, 'liveCat')}</div>
        <div class="chlist" id="chlist">${list.slice(0, S.liveRendered).map(chRowMobile).join('')}</div>
        ${list.length > S.liveRendered ? `<div style="padding:1.6rem 2rem"><button class="btn f" data-act="moreLive" style="width:100%">Mostrar mais canais</button></div>` : ''}
        ${!list.length ? '<p class="mu" style="padding:2rem">Nenhum canal nesta categoria.</p>' : ''}`;
    }
    const sel = S.byId.get(p.sel) || list[0];
    S.liveRendered = Math.min(list.length, 80);
    const t0 = Math.floor(Date.now() / 1800000) * 1800000;
    return `<div class="live-top" id="livetop">${liveTop(sel)}</div>
      <div class="live-chips">${chips(cats, cat, 'liveCat')}</div>
      <div class="epg"><div class="th"><b>Guia · Hoje</b>${[0, 1, 2, 3].map((i) => `<span>${hhmm(t0 + i * 1800000)}</span>`).join('')}</div>
      <div class="body" id="epgbody"><div class="now" style="left:${24 + ((Date.now() - t0) / 60000) * (33.5 / 30)}rem"></div>
      ${list.slice(0, S.liveRendered).map((c, i) => epgRow(c, i, t0)).join('')}</div>
      ${!list.length ? '<p class="mu" style="font-size:2.2rem">Nenhum canal nesta categoria.</p>' : ''}</div>`;
  };
  function liveTop(ch) {
    if (!ch) return '';
    const nn = nowNext(ch);
    const fav = S.favs.has(ch.id);
    return `<div class="live-prev" style="background:${pal(ch.name)[0]}"><div class="lg">${ch.logo ? `<img src="${esc(ch.logo)}" alt="" onerror="this.remove()">` : `<b>${esc(ch.name)}</b>`}</div>
        <div class="tp"><span class="livebadge">● AO VIVO</span><span class="card"><span class="dark" style="font-size:1.8rem;padding:.4rem 1.2rem">${esc(ch.num || '')}</span></span></div>
        ${nn.now ? `<div class="bt"><span>${hhmm(nn.now[0])}</span><div class="bar"><i style="width:${nn.pct}%"></i></div><span>${hhmm(nn.now[1])}</span></div>` : ''}</div>
      <div class="live-info"><span class="k">CANAL ${esc(ch.num || '')} · ${esc(ch.name.toUpperCase())}</span>
        <h1>${esc(nn.now ? nn.now[2] : ch.name)}</h1>
        <div class="meta">${nn.now ? `<span>${hhmm(nn.now[0])} – ${hhmm(nn.now[1])}</span><span>·</span>` : ''}<span>${esc(ch.group)}</span></div>
        <p>${esc(nn.now && nn.now[3] ? nn.now[3] : (nn.next ? 'A seguir: ' + nn.next[2] + ' às ' + hhmm(nn.next[0]) : 'Programação não disponível para este canal.'))}</p>
        <div class="acts"><button class="btn pri f" data-act="playCh" data-id="${ch.id}" data-k="lt:play">${I.play}Assistir</button>
        <button class="btn f" data-act="fav" data-id="${ch.id}" data-k="lt:fav">${fav ? I.starF : I.star}${fav ? 'Favorito' : 'Favoritar'}</button></div></div>`;
  }
  function epgRow(ch, i, t0) {
    const W = 33.5 / 30;
    const end = t0 + 150 * 60000;
    const p = (epgOf(ch) || []).filter((x) => x[1] > t0 && x[0] < end);
    const t = Date.now();
    const blocks = p.length ? p.map((x) => {
      const s = Math.max(x[0], t0), e = Math.min(x[1], end);
      const w = Math.max(4, ((e - s) / 60000) * W - 0.8);
      return `<span class="ep ${x[0] <= t && x[1] > t ? 'cur' : ''}" style="width:${w}rem"><b>${esc(x[2])}</b><span>${hhmm(x[0])} – ${hhmm(x[1])}</span></span>`;
    }).join('') : `<span class="ep cur" style="width:132rem"><b>${esc(ch.name)}</b><span>Programação não disponível</span></span>`;
    return `<button class="er f" data-act="playCh" data-id="${ch.id}" data-k="er:${ch.id}" data-ri="${i}" data-hover="live">
      <span class="ec"><span class="n">${esc(String(ch.num || '').slice(0, 4))}</span><span class="nm">${esc(ch.name)}</span>${S.favs.has(ch.id) ? I.starF : ''}</span>${blocks}</button>`;
  }
  function chRowMobile(ch) {
    const nn = nowNext(ch);
    const fav = S.favs.has(ch.id);
    return `<div class="chrow"><button class="lg f" data-act="playCh" data-id="${ch.id}" aria-label="Assistir ${esc(ch.name)}" style="border:0;color:inherit">${ch.logo ? `<img loading="lazy" src="${esc(ch.logo)}" alt="" onerror="this.remove()">` : esc(ch.name.slice(0, 8))}</button>
      <button class="tx f" data-act="playCh" data-id="${ch.id}" style="border:0;background:none;color:inherit;text-align:left;padding:0">
      <span class="t1"><span>${esc(nn.now ? nn.now[2] : ch.name)}</span></span>
      ${nn.now ? `<div class="bar"><i style="width:${nn.pct}%"></i></div>` : ''}
      <span class="t2">${esc(ch.name)}${nn.next ? ' · A seguir: ' + esc(nn.next[2]) : ''}</span></button>
      <button class="star f ${fav ? 'on' : ''}" data-act="fav" data-id="${ch.id}" aria-label="Favoritar canal">${fav ? I.starF : I.star}</button></div>`;
  }

  // --- Filmes e Séries ---
  function catalog(kind, p) {
    const label = kind === 'movies' ? 'Filmes' : 'Séries';
    if (!S.lists.length) return emptyLists();
    const all = S.cat[kind];
    if (!all.length) return S.loading ? spinner(`Carregando ${label.toLowerCase()}…`) : `<div class="empty"><h1>Sem ${label.toLowerCase()}</h1><p>Adicione uma lista VOD ou Xtream com ${label.toLowerCase()}.</p><button class="btn pri f" data-act="go" data-r="add">${I.plus}Adicionar lista</button></div>`;
    const cat = p.cat || 'Todos';
    const cats = ['Todos', 'Minha lista'].concat(S.groups[kind]);
    const head = TV ? `<div class="thead"><h1>${label}</h1>${chips(cats.slice(0, 60), cat, 'catChip', ` data-kind="${kind}"`)}</div>`
      : `<div class="phead"><h1>${label}</h1><button class="ib f" data-act="go" data-r="search" aria-label="Buscar">${I.search}</button></div><div style="padding:1.2rem 2rem">${chips(cats, cat, 'catChip', ` data-kind="${kind}"`)}</div>`;
    if (cat !== 'Todos') {
      const items = cat === 'Minha lista' ? all.filter((x) => S.favs.has(x.id)) : all.filter((x) => x.group === cat);
      const lim = p.lim || 140;
      return head + (items.length ? `<div class="grid">${items.slice(0, lim).map((x) => posterCard(x, 'g')).join('')}</div>
        ${items.length > lim ? `<div style="padding:0 ${TV ? '8rem 8rem' : '2rem 2rem'}"><button class="btn f" data-act="moreGrid" data-lim="${lim + 140}">Mostrar mais (${num(items.length - lim)})</button></div>` : ''}`
        : `<p class="mu" style="padding:0 ${TV ? '8rem;font-size:2.2rem' : '2rem'}">Nada aqui ainda.</p>`);
    }
    const f = pickFeatured(kind);
    const rows = [];
    const mine = all.filter((x) => S.favs.has(x.id));
    if (mine.length) rows.push(row('Minha lista', '', mine.slice(0, 30).map((x) => posterCard(x, 'my')).join('')));
    const top = topRated(all);
    if (top.length >= 6) rows.push(row('Mais bem avaliados no IMDb', 'ordenado pela nota', top.map((x) => posterCard(x, 'top')).join('')));
    rows.push(row('Adicionados recentemente', '', recentOf(all).slice(0, 30).map((x) => posterCard(x, 'rec')).join('')));
    S.groups[kind].slice(0, 24).forEach((g, gi) => {
      const items = all.filter((x) => x.group === g);
      rows.push(row(esc(g), `${num(items.length)} títulos`, items.slice(0, 30).map((x) => posterCard(x, 'gr' + gi)).join('')));
    });
    const heroB = TV ? `<section class="hero" style="height:46rem;margin-bottom:0" id="cathero">${heroInner(f, kind === 'movies' ? 'FILME EM DESTAQUE' : 'SÉRIE EM DESTAQUE')}</section>` : '';
    return head + heroB + `<div class="rows">${rows.join('')}</div>`;
  }
  function heroInner(it, kicker) {
    if (!it) return '';
    const c = D.imdbCached(it) || {};
    const plot = it.plot || c.plot || '';
    return `<div class="bg">${heroBg(it)}</div><div class="scrim"></div>
      <div class="info" style="padding-top:2rem"><span class="kicker">${esc(kicker)}</span><h1 style="font-size:9.6rem">${esc(it.title || it.name)}</h1>${metaLine(it)}${plot ? `<p>${esc(plot)}</p>` : ''}</div>`;
  }
  SCREENS.movies = (p) => catalog('movies', p);
  SCREENS.series = (p) => catalog('series', p);

  // --- Detalhe ---
  SCREENS.detail = (p) => {
    const it = S.byId.get(p.id) || newsById(p.id);
    if (!it) return `<div class="empty"><h1>Título não encontrado</h1></div>`;
    const c = D.imdbCached(it) || {};
    const plot = it.plot || c.plot || '';
    const isNews = !!it.tmdb;
    const match = isNews ? matchCatalog(it) : null;
    const fav = S.favs.has(it.id);
    let acts = '';
    if (it.kind === 'movie' && !isNews) {
      let resume = '';
      if (N) { try { const pr = JSON.parse(N.progress(it.url) || '{}'); if (pr.pos > 30000) resume = ` · continuar de ${fmtDur(pr.pos)}`; } catch (e) { /* */ } }
      acts = `<button class="btn pri f" data-act="playItem" data-id="${it.id}" data-autofocus data-k="d:play">${I.play}Assistir${resume}</button>`
        + `<button class="btn f" data-act="fav" data-id="${it.id}" data-k="d:fav">${fav ? I.check + 'Na minha lista' : I.plus + 'Minha lista'}</button>`
        + (N ? `<button class="btn f" data-act="ext" data-id="${it.id}" data-k="d:ext">${I.ext}Player externo</button>` : '');
    } else if (isNews) {
      acts = match ? `<button class="btn pri f" data-act="open" data-id="${match.id}" data-autofocus data-k="d:match">${I.play}Assistir da sua lista</button>`
        : `<span class="tag" style="padding:.6rem 1.4rem">${it.svc ? 'Disponível em ' + esc(it.svc) : (it.date ? 'Estreia ' + new Date(it.date + 'T12:00').toLocaleDateString('pt-BR') : 'Nos streamings')}</span>`;
    } else {
      let first = '';
      if (it.seasons) {
        const ks = Object.keys(it.seasons).sort((x, y) => x - y);
        // continua do último episódio assistido desta série
        const h = S.history.find((x) => x.id === it.id);
        let sk = ks[0], ei = 0;
        if (h) ks.forEach((k) => (it.seasons[k] || []).forEach((e, i) => { if (e.url === h.url) { sk = k; ei = i; } }));
        const e = sk && it.seasons[sk] && it.seasons[sk][ei];
        if (e) first = `<button class="btn pri f" data-act="playEp" data-id="${it.id}" data-season="${sk}" data-i="${ei}" data-autofocus data-k="d:play">${I.play}${h ? 'Continuar' : 'Assistir'} T${sk}:E${e.ep}</button>`;
      }
      acts = first + `<button class="btn f" data-act="fav" data-id="${it.id}" data-k="d:fav">${fav ? I.check + 'Na minha lista' : I.plus + 'Minha lista'}</button>`;
    }
    const kicker = isNews ? (it.svc ? 'NOVIDADE · ' + it.svc.toUpperCase() : 'EM BREVE') : (it.kind === 'series' ? 'SÉRIE · ' + esc(it.group).toUpperCase() : 'FILME · ' + esc(it.group).toUpperCase());
    let html = `<div class="det ${it.kind === 'series' && !isNews ? 'series' : ''}"><div class="bgx">${heroBg(it)}<div class="scrim"></div></div>
      <div class="in"><span class="kicker">${kicker}</span><h1>${esc(it.title || it.name)}</h1>${metaLine(it)}
      ${plot ? `<p>${esc(plot)}</p>` : ''}<div class="acts">${acts}</div></div>`;
    if (it.kind === 'series' && !isNews) html += seasonsHtml(it, p);
    return html + '</div>';
  };
  function seasonsHtml(s, p) {
    if (!s.seasons) {
      if (!s._loading) {
        s._loading = true;
        const list = S.lists.find((l) => l.id === s.list);
        D.loadXtreamSeries(list, s).catch(() => { s.seasons = {}; }).finally(() => { s._loading = false; softRender(); });
      }
      return `<div class="seasons-wrap">${spinner('Carregando episódios…')}</div>`;
    }
    const keys = Object.keys(s.seasons).sort((a, b) => a - b);
    if (!keys.length) return `<div class="seasons-wrap"><p class="mu" style="font-size:${TV ? '2.2rem' : '1.3rem'};padding:0 2rem">Nenhum episódio encontrado.</p></div>`;
    const cur = keys.includes(String(p.season)) ? String(p.season) : keys[0];
    const eps = s.seasons[cur] || [];
    return `<div class="seasons-wrap"><div class="seasons" role="tablist" aria-label="Temporadas">${keys.map((k) =>
      `<button class="season f ${k === cur ? 'on' : ''}" role="tab" data-act="season" data-v="${k}" data-k="sea:${k}">Temporada ${k}</button>`).join('')}</div>
      <div class="eps">${eps.map((e, i) => epHtml(s, cur, e, i)).join('')}</div></div>`;
  }
  function epHtml(s, season, e, i) {
    let pct = null;
    if (N) { try { const pr = JSON.parse(N.progress(e.url) || '{}'); if (pr.dur) pct = Math.round((pr.pos / pr.dur) * 100); } catch (x) { /* */ } }
    const fake = { id: e.id, title: s.title, name: s.name, logo: e.logo || s.logo };
    const card = `<div class="card land" style="pointer-events:none">${art(fake)}${pct != null ? `<div class="bar"><i style="width:${pct}%"></i></div>` : ''}</div>`;
    const t = `${e.ep}. ${e.title}`;
    return TV
      ? `<button class="ep f" data-act="playEp" data-id="${s.id}" data-season="${season}" data-i="${i}" data-k="ep:${e.id}" style="border:0;background:none;padding:0;text-align:left;color:inherit">${card.replace('class="card land"', 'class="card land" ')}<div class="et">${esc(t)}</div><div class="em">${esc(e.dur || '')}${e.plot ? ' · ' + esc(e.plot.slice(0, 60)) : ''}</div></button>`
      : `<button class="ep f" data-act="playEp" data-id="${s.id}" data-season="${season}" data-i="${i}">${card}<div class="tx"><div class="et">${esc(t)}</div><div class="em">${esc(e.dur || '')}</div></div></button>`;
  }
  const fmtDur = (ms) => { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(ss).padStart(2, '0'); };

  // --- Novidades ---
  function newsById(id) {
    if (!S.news || !id || id[0] !== 'n') return null;
    return [...S.news.recent, ...S.news.trend, ...S.news.soon].find((x) => x.id === id) || null;
  }
  function matchCatalog(it) {
    const pool = it.kind === 'series' ? S.cat.series : S.cat.movies;
    const a = D.norm(it.title), b = D.norm(it.original);
    return pool.find((x) => { const n = D.norm(x.title || x.name); return n === a || (b && n === b); }) || null;
  }
  SCREENS.news = (p) => {
    const head = TV ? `<div class="thead"><h1>Novidades nos streamings</h1></div>` : `<div class="phead"><h1>Novidades</h1></div>`;
    if (!S.settings.tmdbKey) {
      return head + `<div class="empty" style="padding-top:${TV ? '2rem' : '1rem'}"><p>Para ver o que chegou na Netflix, Prime Video, Disney+, Max, Globoplay e Apple TV+, informe uma chave gratuita do TMDB em Configurações › Chaves de API.</p>
        <button class="btn pri f" data-act="go" data-r="settings" data-cat="keys" data-autofocus>${I.gear}Configurar chave</button></div>`;
    }
    if (!S.news) { refreshNews(); return head + (S.newsErr ? `<div class="empty"><p>${esc(S.newsErr)}</p></div>` : spinner('Buscando novidades…')); }
    const svc = p.svc || 'Todos';
    const recent = S.news.recent.filter((x) => svc === 'Todos' || x.svc === svc);
    const rows = [];
    rows.push(row('Chegou recentemente', svc === 'Todos' ? '' : svc, recent.slice(0, 24).map((x, i) => landCard(x, 'nr', {
      big: i < 3 && TV, img: x.backdrop || x.logo, badge: '<span class="livebadge">NOVO</span>', right: `<span class="dark">${esc(x.svc)}</span>`,
    })).join('') || ''));
    if (svc === 'Todos') {
      rows.push(row('Em alta nos streamings', '', S.news.trend.map((x) => posterCard(x, 'nt')).join('')));
      rows.push(row('Estreias digitais em breve', '', S.news.soon.map((x) => landCard(x, 'ns', {
        img: x.backdrop || x.logo, badge: `<span class="dark">${x.date ? new Date(x.date + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}</span>`,
        right: `<span class="dark" style="display:flex">${I.bell}</span>`,
      })).join('')));
    }
    return head + `<div style="padding:0 ${TV ? '8rem 2.4rem' : '2rem 1.2rem'}">${chips(['Todos'].concat(D.PROVIDERS.map((x) => x.name)), svc, 'newsSvc')}</div>`
      + `<div class="rows">${rows.join('')}</div>`
      + `<p class="mu" style="padding:0 ${TV ? '8rem 4rem;font-size:1.6rem' : '2rem 2rem;font-size:1rem'}">Dados de disponibilidade: TMDB/JustWatch · atualizado ${rel(S.news.at)}</p>`;
  };

  // --- Busca ---
  function searchResults() {
    const q = D.norm(S.q);
    if (!q) return { mv: [], se: [], ch: [] };
    const has = (x) => D.norm(x.title || x.name).includes(q);
    return { mv: S.cat.movies.filter(has).slice(0, 60), se: S.cat.series.filter(has).slice(0, 60), ch: S.cat.channels.filter(has).slice(0, 30) };
  }
  function resultsHtml() {
    const r = searchResults();
    const vod = [...r.mv, ...r.se];
    if (!S.q) return `<h1>${TV ? 'Digite para buscar' : ''}</h1><p class="mu" style="font-size:${TV ? '2.2rem' : '1.3rem'};margin:0">Filmes, séries e canais das suas listas.</p>`;
    const total = vod.length + r.ch.length;
    let h = `<h1>Resultados para “${esc(S.q)}”</h1>`;
    if (!total) return h + `<p class="mu" style="font-size:${TV ? '2.2rem' : '1.3rem'};margin:0">Nada por aqui… nem o gato achou.</p>`;
    if (vod.length) h += `<div class="sgrid">${vod.slice(0, TV ? 9 : 40).map((x) => `<div class="cap">${landCard(x, 'sr', { right: `<span class="dark">${x.kind === 'series' ? 'SÉRIE' : 'FILME'}</span>` })}<span class="ct">${esc(x.title || x.name)}</span></div>`).join('')}</div>`;
    if (r.ch.length) h += `<span class="lbl">CANAIS</span><div class="track" style="padding:0;gap:${TV ? '2.4rem' : '.8rem'}">${r.ch.slice(0, 12).map((c) => chCard(c, 'sch')).join('')}</div>`;
    return h;
  }
  SCREENS.search = () => {
    if (!TV) {
      return `<div class="phead"><h1>Buscar</h1></div><div class="search"><label class="sinput">${I.search}<input id="sq" type="search" placeholder="Filmes, séries e canais" value="${esc(S.q)}" autocomplete="off" enterkeyhint="search"></label>
        ${!S.q && S.recent.length ? `<div class="recent" style="display:flex;flex-wrap:wrap;gap:.8rem">${S.recent.map((r) => `<button class="chip f" data-act="recentQ" data-v="${esc(r)}">${esc(r)}</button>`).join('')}</div>` : ''}
        <div class="sres" id="sres">${resultsHtml()}</div></div>`;
    }
    const keys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'.split('');
    return `<div class="search"><div class="kb"><div class="sbox"><div class="sfield" id="sfield">${I.search}${S.q ? `<span>${esc(S.q)}</span><span class="caret"></span>` : '<span class="ph">Buscar</span><span class="caret"></span>'}</div></div>
      <div class="keys">${keys.map((k) => `<button class="key f" data-act="key" data-v="${k}" data-k="key:${k}" ${k === 'A' ? 'data-autofocus' : ''}>${k}</button>`).join('')}</div>
      <div class="keys k3"><button class="key f" data-act="key" data-v=" " data-k="key:sp">Espaço</button><button class="key f" data-act="keyDel" data-k="key:del">Apagar</button><button class="key f" data-act="keyClr" data-k="key:clr">Limpar</button></div>
      ${S.recent.length ? `<div style="display:flex;flex-direction:column;gap:1.2rem"><span class="lbl">BUSCAS RECENTES</span><div class="recent">${S.recent.map((r) => `<button class="f" data-act="recentQ" data-v="${esc(r)}" data-k="rq:${esc(r)}">${esc(r)}</button>`).join('')}</div></div>` : ''}
      </div><div class="sres" id="sres">${resultsHtml()}</div></div>`;
  };
  function updateSearch() {
    const f = $('#sfield');
    if (f) f.innerHTML = I.search + (S.q ? `<span>${esc(S.q)}</span><span class="caret"></span>` : '<span class="ph">Buscar</span><span class="caret"></span>');
    const r = $('#sres');
    if (r) { r.innerHTML = resultsHtml(); observeImdb(); }
  }
  function saveRecent() {
    const q = S.q.trim();
    if (!q) return;
    S.recent = [q].concat(S.recent.filter((x) => x !== q)).slice(0, 6);
    store.set('recent', S.recent);
  }

  // --- Configurações ---
  const TYPE_LABEL = { m3u: 'Lista M3U', vod: 'Lista VOD', xtream: 'Xtream Codes', epg: 'Guia EPG' };
  const SUBS = [['pt', 'Português'], ['en', 'Inglês'], ['es', 'Espanhol'], ['off', 'Desligadas']];
  const AUDIO = [['', 'Original'], ['pt', 'Português (dublado)'], ['en', 'Inglês']];
  const SIZES = [['P', 'Pequeno'], ['M', 'Médio'], ['G', 'Grande']];
  const UAS = [['', 'Automático (recomendado)'], ['VLC/3.0.20 LibVLC/3.0.20', 'VLC'], ['IPTVSmartersPlayer', 'IPTV Smarters'],
    ['TiviMate/5.1.6 (Android 11)', 'TiviMate'], ['okhttp/4.12.0', 'Android (okhttp)'],
    ['Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36', 'Navegador']];
  const applyUa = () => { if (N && N.setUserAgent) N.setUserAgent(S.settings.ua || ''); };
  const lab = (arr, v) => (arr.find((x) => x[0] === v) || arr[0])[1];
  function listCard(l) {
    const c = l.counts || {};
    const parts = [];
    if (c.c) parts.push(num(c.c) + ' canais');
    if (c.m) parts.push(num(c.m) + ' filmes');
    if (c.s) parts.push(num(c.s) + ' séries');
    if (l.type === 'epg') { const e = S.epgData[l.id]; if (e) parts.push(num(Object.keys(e.channels || {}).length) + ' canais no guia'); }
    const info = `${TYPE_LABEL[l.type] || ''}${parts.length ? ' · ' + parts.join(' · ') : ''} · atualizada ${rel(l.updatedAt)}`;
    return `<div class="lcard"><div class="ic">${I.list}</div><div class="tx"><b>${esc(l.name)}</b><span>${esc(l.error ? 'Erro: ' + l.error : info)}</span></div>
      <span class="${l.error ? 'err' : 'ok'}">${l.error ? 'ERRO' : (l.updatedAt ? 'OK' : '…')}</span>
      <button class="btn f" data-act="refreshList" data-id="${l.id}" data-k="lr:${l.id}">Atualizar</button>
      ${l.type !== 'epg' ? `<button class="btn f" data-act="editList" data-id="${l.id}" data-k="le:${l.id}">Grupos</button>` : ''}
      <button class="btn f" data-act="delList" data-id="${l.id}" data-k="ld:${l.id}" aria-label="Remover lista">${I.x}</button></div>`;
  }
  function prow(label, value, act, k) {
    return `<button class="prow f" data-act="${act}" data-k="${k}"><span>${label}</span><span class="v">${esc(value)} ›</span></button>`;
  }
  function toggle(label, key) {
    const on = !!S.settings[key];
    return `<button class="prow f" role="switch" aria-checked="${on}" data-act="toggle" data-v="${key}" data-k="tg:${key}"><span>${label}</span><span class="sw ${on ? 'on' : ''}"><i></i></span></button>`;
  }
  const PANES = {
    lists: () => `<h2>Listas de conteúdo</h2>
      ${S.lists.length ? S.lists.map(listCard).join('') : `<p class="hint">Nenhuma lista ainda.</p>`}
      <div style="display:flex;gap:${TV ? '1.8rem' : '1rem'};flex-wrap:wrap">
      ${TV ? `<button class="btn pri f" data-act="go" data-r="add" data-k="cfg:addqr">${I.qr}Adicionar pelo celular (QR Code)</button>` : ''}
      <button class="btn ${TV ? '' : 'pri'} f" data-act="go" data-r="add" data-k="cfg:add">${I.plus}Adicionar lista</button>
      ${S.lists.length ? `<button class="btn f" data-act="refreshAll" data-k="cfg:all">Atualizar todas</button>` : ''}</div>`,
    play: () => `<h2>Reprodução e legendas</h2><div class="panel">
      ${prow('Idioma da legenda', lab(SUBS, S.settings.subLang), 'pickSub', 'p:sub')}
      ${prow('Áudio preferido', lab(AUDIO, S.settings.audioLang), 'pickAudio', 'p:aud')}
      ${prow('Tamanho da legenda', lab(SIZES, S.settings.subSize), 'pickSize', 'p:size')}
      ${prow('Identificar o app como', lab(UAS, S.settings.ua || ''), 'pickUa', 'p:ua')}</div>
      <p class="hint">Alguns servidores só aceitam players conhecidos. No modo automático o app testa VLC, IPTV Smarters, TiviMate e outros até o servidor aceitar.</p>
      <p class="hint">Durante o vídeo, use o botão de legendas e o de configurações do player para trocar faixas de áudio e legenda.</p>`,
    show: () => `<h2>Exibição</h2><div class="panel">${toggle('Mostrar notas IMDb', 'showImdb')}${toggle('Atualizar listas automaticamente', 'autoUpdate')}${toggle('Ocultar conteúdo adulto', 'hideAdult')}</div>`,
    keys: () => `<h2>Chaves de API</h2>
      <p class="hint">Opcionais e gratuitas. Ficam salvas só neste aparelho.</p>
      <label class="field"><span>OMDb — notas IMDb (omdbapi.com › API Key)</span><input class="f" id="kOmdb" value="${esc(S.settings.omdbKey)}" placeholder="ex.: a1b2c3d4" autocomplete="off" data-k="k:omdb"></label>
      <label class="field"><span>TMDB — novidades nos streamings (themoviedb.org › Configurações › API)</span><input class="f" id="kTmdb" value="${esc(S.settings.tmdbKey)}" placeholder="Chave da API (v3) ou token de leitura (v4)" autocomplete="off" data-k="k:tmdb"></label>
      <div><button class="btn pri f" data-act="saveKeys" data-k="k:save">${I.check}Salvar chaves</button></div>`,
    about: () => `<h2>Sobre</h2><div class="panel">
      <button class="prow f" data-act="clearImdb" data-k="ab:imdb"><span>Limpar cache de notas IMDb</span><span class="v">›</span></button>
      <button class="prow f" data-act="clearNews" data-k="ab:news"><span>Recarregar novidades</span><span class="v">›</span></button></div>
      <p class="ver">Gatoflix ${N ? 'v' + esc(N.version()) : '(navegador)'} · ${TV ? 'Android TV' : 'Celular'}</p>`,
  };
  const CFG_CATS = [['lists', 'Listas de conteúdo'], ['play', 'Reprodução e legendas'], ['show', 'Exibição'], ['keys', 'Chaves de API'], ['about', 'Sobre']];
  SCREENS.settings = (p) => {
    if (!TV) {
      return `<div class="phead"><h1>Ajustes</h1></div><div class="cfg"><div class="cfg-pane">${CFG_CATS.map(([k]) => PANES[k]()).join('')}</div></div>`;
    }
    const cur = p.cat || 'lists';
    return `<div class="thead"><h1>Configurações</h1></div><div class="cfg"><div class="cfg-cats">${CFG_CATS.map(([k, l]) =>
      `<button class="cfg-cat f ${k === cur ? 'on' : ''}" data-act="cfgCat" data-v="${k}" data-k="cc:${k}" ${k === cur ? 'data-autofocus' : ''} data-hover="cfg">${l}${I.chev}</button>`).join('')}</div>
      <div class="cfg-pane" id="cfgpane">${PANES[cur]()}</div></div>`;
  };

  // --- Adicionar lista ---
  const TYPES = [
    ['m3u', 'Lista M3U · Canais de TV', 'Link .m3u / .m3u8 com os canais ao vivo'],
    ['vod', 'Lista VOD · Filmes e séries', 'Catálogo sob demanda (M3U com filmes e episódios)'],
    ['xtream', 'Servidor Xtream Codes', 'Endereço do servidor + usuário do seu provedor'],
    ['epg', 'Guia de programação (EPG)', 'Arquivo XMLTV (.xml ou .xml.gz) com os horários'],
  ];
  SCREENS.add = (p) => {
    const type = p.type || 'm3u';
    const crumb = TV ? `<div class="crumb"><span>Configurações</span><span>›</span><span>Listas de conteúdo</span><span>›</span><b>Adicionar lista</b></div><div class="thead" style="padding-top:1rem"><h1>Adicionar lista</h1></div>`
      : `<div class="phead"><h1>Adicionar lista</h1></div>`;
    const types = `<div class="types"><span class="lbl">1 · TIPO DE LISTA</span>${TYPES.map(([k, t, d]) =>
      `<button class="type f ${k === type ? 'on' : ''}" data-act="addType" data-v="${k}" data-k="ty:${k}" ${k === type ? 'data-autofocus' : ''}><span class="rd"><i></i></span><span class="tx"><b>${t}</b><span>${d}</span></span></button>`).join('')}</div>`;
    const fileBtn = `<label class="btn f" tabindex="0" data-act="pickFile" data-k="add:file" style="position:relative">${I.file}Arquivo do aparelho<input type="file" id="fileIn" accept=".m3u,.m3u8,.txt,.xml,.gz,audio/x-mpegurl,application/x-mpegurl,text/plain,*/*" style="position:absolute;inset:0;opacity:0;width:100%" tabindex="-1"></label>`;
    if (!TV) {
      return crumb + `<div class="addwrap">${types}<button class="btn pri f" data-act="go" data-r="addform" data-type="${type}">${I.kb}Continuar</button>${type !== 'xtream' ? fileBtn : ''}</div>`;
    }
    let lan = '';
    if (N) { try { lan = N.startLan(); } catch (e) { lan = ''; } }
    S.lanUrl = lan;
    const qr = lan ? `<div class="qr" id="qr" role="img" aria-label="QR Code para adicionar a lista pelo celular"></div>
        <div class="qrtx"><b>Adicione pelo celular</b><span>1. Conecte o celular no mesmo Wi-Fi da TV<br>2. Aponte a câmera para o QR Code<br>3. Cole o link da lista e toque em Enviar</span><span>ou abra no navegador:</span><code>${esc(lan.replace(/\/\?t=.*/, ''))}</code><span>código <b style="font-size:3rem;letter-spacing:.4rem;color:var(--ac)">${esc((lan.split('t=')[1] || ''))}</b></span></div>`
      : `<div class="qrtx"><b>Adicionar pelo celular</b><span>${N ? 'Conecte a TV ao Wi-Fi ou à rede cabeada para usar o QR Code.' : 'Disponível no app instalado na TV.'}</span></div>`;
    return crumb + `<div class="addwrap" style="padding-top:1rem">${types}
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1.4rem"><span class="lbl">2 · COMO ADICIONAR</span>
      <div class="qrbox">${qr}</div>
      <div style="display:flex;gap:1.6rem;margin-top:.8rem;flex-wrap:wrap"><button class="btn f" data-act="go" data-r="addform" data-type="${type}" data-k="add:kb">${I.kb}Digitar com o controle</button>${type !== 'xtream' ? fileBtn : ''}</div></div></div>`;
  };
  function drawQr() {
    const el = $('#qr');
    if (!el || !S.lanUrl || typeof qrcode !== 'function') return;
    const q = qrcode(0, 'M');
    q.addData(S.lanUrl);
    q.make();
    el.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }

  SCREENS.addform = (p) => {
    const edit = p.edit ? S.lists.find((l) => l.id === p.edit) : null;
    const type = edit ? edit.type : (p.type || 'm3u');
    const pre = Object.assign({}, edit || {}, p.prefill || {});
    const A = S.add && S.add.key === (p.edit || p.type || '') ? S.add : null;
    const crumb = TV ? `<div class="crumb"><span>Configurações</span><span>›</span><span>${edit ? 'Listas' : 'Adicionar lista'}</span><span>›</span><b>${esc(edit ? edit.name : TYPES.find((x) => x[0] === type)[1])}</b></div>
      <div class="thead" style="padding-top:1rem"><h1>${edit ? 'Grupos da lista' : 'Dados da lista'}</h1></div>` : `<div class="phead"><h1>${edit ? 'Grupos da lista' : 'Dados da lista'}</h1></div>`;
    const f = (id, label, val, ph, t) => `<label class="field"><span>${label}</span><input class="f" id="${id}" type="${t || 'text'}" value="${esc(val || '')}" placeholder="${esc(ph || '')}" autocomplete="off" autocapitalize="off" spellcheck="false" data-k="af:${id}"></label>`;
    let form = '';
    if (!edit) {
      form += f('fName', 'Nome da lista', pre.name, type === 'xtream' ? 'Meu provedor' : 'Minha lista');
      if (type === 'xtream') {
        form += f('fServer', 'Servidor (com porta)', pre.server, 'http://servidor:8080', 'url') + f('fUser', 'Usuário', pre.user, '') + f('fPass', 'Senha', pre.pass, '', 'password');
      } else if (pre.url === 'file:' || (S.add && S.add.fileName && S.add.key === type)) {
        form += `<div class="field"><span>Arquivo</span><div class="lcard" style="border-radius:1rem"><div class="ic">${I.file}</div><div class="tx"><b>${esc((S.add && S.add.fileName) || 'arquivo')}</b></div></div></div>`;
      } else {
        form += f('fUrl', type === 'epg' ? 'URL do guia XMLTV' : 'URL da lista (.m3u)', pre.url, type === 'epg' ? 'http://…/guia.xml.gz' : 'http://…/lista.m3u', 'url');
        if (type === 'm3u') form += f('fEpg', 'URL do guia EPG (opcional)', pre.epg, 'http://…/guia.xml');
      }
      form += `<div style="display:flex;gap:1.6rem;flex-wrap:wrap"><button class="btn pri f" data-act="testList" data-type="${type}" data-k="af:test">${A && A.status === 'loading' ? 'Testando…' : 'Testar lista'}</button>
        <button class="btn f" data-act="cancelAdd" data-k="af:cancel">Cancelar</button></div>`;
    }
    let right = '';
    let groups = null;
    if (edit) {
      const d = S.data[edit.id] || { channels: [], movies: [], series: [] };
      groups = groupCounts(d);
      if (!S.add || S.add.key !== edit.id) S.add = { key: edit.id, status: 'ok', off: new Set(edit.groupsOff || []), data: d };
    }
    const A2 = S.add && S.add.key === (p.edit || p.type || '') ? S.add : null;
    if (A2 && A2.status === 'loading') right = spinner('Baixando e verificando a lista…');
    else if (A2 && A2.status === 'error') right = `<div class="res bad">${I.x}<div class="tx"><b>Não deu certo</b><span>${esc(A2.error)}</span></div></div>`;
    else if (A2 && A2.status === 'ok') {
      const d = A2.data;
      groups = groups || groupCounts(d);
      const total = groups.reduce((s, g) => s + (A2.off.has(g[0]) ? 0 : g[1]), 0);
      const sum = type === 'epg' ? `${num(Object.keys(d.epg ? d.epg.channels : {}).length)} canais no guia`
        : [d.channels.length ? num(d.channels.length) + ' canais' : '', d.movies.length ? num(d.movies.length) + ' filmes' : '', d.series.length ? num(d.series.length) + ' séries' : ''].filter(Boolean).join(' · ') + ` em ${groups.length} grupos`;
      right = (edit ? '' : `<div class="res">${I.check}<div class="tx"><b>Lista válida</b><span>${esc(sum)}${d.epgUrl ? ' · guia EPG encontrado' : ''}</span></div></div>`)
        + (groups.length ? `<span class="lbl" style="margin-top:.6rem">ESCOLHA OS GRUPOS PARA ${edit ? 'EXIBIR' : 'IMPORTAR'}</span>
        <div style="display:flex;gap:1.2rem"><button class="chip f" data-act="grpAll" data-v="1" data-k="ga:1">Marcar todos</button><button class="chip f" data-act="grpAll" data-v="0" data-k="ga:0">Desmarcar todos</button></div>
        <div class="groups">${groups.slice(0, 400).map(([g, n]) => { const on = !A2.off.has(g); return `<button class="gck f ${on ? 'on' : ''}" role="checkbox" aria-checked="${on}" data-act="grp" data-v="${esc(g)}" data-k="g:${esc(g)}"><span class="bx">${on ? '✓' : ''}</span><span class="nm">${esc(g)}</span><span class="ct">${num(n)}</span></button>`; }).join('')}</div>` : '')
        + `<div style="display:flex;gap:1.6rem;margin-top:1rem;flex-wrap:wrap"><button class="btn acc f" data-act="${edit ? 'saveGroups' : 'importList'}" data-type="${type}" data-k="af:import">${edit ? 'Salvar' : (type === 'epg' ? 'Importar guia' : `Importar ${num(total)} itens`)}</button>
        <button class="btn f" data-act="cancelAdd" data-k="af:cancel2">Cancelar</button></div>`;
    }
    if (TV) return crumb + `<div class="addwrap" style="padding-top:1rem">${edit ? '' : `<div class="types" style="gap:2.2rem">${form}</div>`}<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1.8rem" id="addright">${right}</div></div>`;
    return crumb + `<div class="addwrap"><div class="types" style="gap:1.4rem">${form}</div>${right}</div>`;
  };
  function groupCounts(d) {
    const m = new Map();
    for (const arr of [d.channels || [], d.movies || [], d.series || []]) for (const x of arr) m.set(x.group, (m.get(x.group) || 0) + 1);
    return Array.from(m.entries());
  }
  function readForm(type) {
    const v = (id) => { const el = $('#' + id); return el ? el.value.trim() : ''; };
    const l = { type, name: v('fName') };
    if (type === 'xtream') {
      Object.assign(l, { server: v('fServer'), user: v('fUser'), pass: v('fPass') });
      // aceita o link completo (get.php / player_api.php?username=…&password=…) no campo Servidor
      try {
        const u = new URL(l.server);
        if (u.searchParams.get('username')) {
          l.user = l.user || u.searchParams.get('username');
          l.pass = l.pass || u.searchParams.get('password') || '';
          l.server = u.origin;
        }
      } catch (e) { /* campo inválido: testList avisa */ }
    } else if (type === 'm3u' && /\/player_api\.php/i.test(v('fUrl'))) {
      // link de API Xtream colado como M3U: converte para a lista M3U completa
      try {
        const u = new URL(v('fUrl'));
        Object.assign(l, { url: `${u.origin}/get.php?username=${encodeURIComponent(u.searchParams.get('username') || '')}&password=${encodeURIComponent(u.searchParams.get('password') || '')}&type=m3u_plus&output=ts`, epg: v('fEpg') });
      } catch (e) { Object.assign(l, { url: v('fUrl'), epg: v('fEpg') }); }
    }
    if (l.url) { /* já definido acima */ } else if (S.add && S.add.fileText != null && S.add.key === type) Object.assign(l, { url: 'file:', fileText: S.add.fileText });
    else if (type !== 'xtream') Object.assign(l, { url: v('fUrl'), epg: v('fEpg') });
    if (!l.name) l.name = l.url === 'file:' ? (S.add.fileName || 'Arquivo') : (type === 'xtream' ? 'Xtream' : TYPE_LABEL[type]);
    return l;
  }
  async function testList(type) {
    const l = readForm(type);
    if (type === 'xtream' && (!l.server || !l.user)) return toast('Informe servidor e usuário');
    if (type !== 'xtream' && !l.url) return toast('Informe o link da lista');
    if (l.url && l.url !== 'file:' && !/^https?:\/\//i.test(l.url)) return toast('O link precisa começar com http:// ou https://');
    l.id = 'l' + Date.now().toString(36);
    const keep = S.add && S.add.key === type ? S.add : {};
    S.add = { key: type, status: 'loading', list: l, off: new Set(), fileText: keep.fileText, fileName: keep.fileName };
    softRenderKeep();
    try {
      let d;
      if (type === 'epg') {
        const e = await D.loadEpg(l.url);
        d = { channels: [], movies: [], series: [], epg: e, epgUrl: l.url };
      } else {
        d = await D.loadList(l);
      }
      const adult = new Set(groupCounts(d).map((g) => g[0]).filter((g) => ADULT.test(g)));
      Object.assign(S.add, { status: 'ok', data: d, off: adult });
    } catch (e) {
      Object.assign(S.add, { status: 'error', error: e.message || 'Falha ao carregar' });
    }
    softRenderKeep();
    if (TV) { const b = $('[data-k="af:import"]') || $('[data-k="af:test"]'); if (b) focusEl(b); }
  }
  function softRenderKeep() {
    // mantém o que foi digitado nos campos
    const vals = {};
    $$('#main input[id]').forEach((i) => { vals[i.id] = i.value; });
    const k = focusKey();
    $('#main').innerHTML = SCREENS[S.route.name](S.route.params);
    for (const id in vals) { const el = $('#' + id); if (el) el.value = vals[id]; }
    if (TV && k) { const el = $(`[data-k="${CSS.escape(k)}"]`); if (el) focusEl(el, true); }
  }
  async function importList() {
    const A = S.add;
    if (!A || A.status !== 'ok') return;
    const l = Object.assign({}, A.list, { groupsOff: Array.from(A.off), updatedAt: Date.now() });
    const d = A.data;
    if (l.type === 'epg') {
      l.counts = {};
      S.lists.push(l);
      d.epg.at = Date.now();
      S.epgData[l.id] = d.epg;
      await idb.set('epg:' + l.id, d.epg);
      S.data[l.id] = { channels: [], movies: [], series: [], epgUrl: l.url, at: Date.now() };
    } else {
      l.counts = { c: d.channels.length, m: d.movies.length, s: d.series.length };
      d.at = Date.now();
      S.lists.push(l);
      S.data[l.id] = d;
      if (l.url === 'file:') { await idb.set('file:' + l.id, l.fileText); }
      await idb.set('list:' + l.id, d);
      if (d.epgUrl) refreshEpg(l, d.epgUrl);
    }
    delete l.fileText;
    saveLists();
    S.add = null;
    rebuild();
    toast(`Miau! Lista “${l.name}” importada`);
    if (N) N.stopLan();
    S.stack = [];
    S.route = { name: 'home', params: {} };
    render();
  }

  // ---------- reprodução ----------
  function playerPrefs() {
    const s = S.settings;
    return { subLang: s.subLang === 'off' ? '' : s.subLang, subsOff: s.subLang === 'off', audioLang: s.audioLang, subSize: s.subSize };
  }
  function nativePlay(payload) {
    if (!N) { toast('A reprodução funciona no app instalado (Android)'); console.log('play', payload); return; }
    N.play(JSON.stringify(Object.assign(playerPrefs(), payload)));
  }
  function playChannel(ch) {
    const list = S.route.name === 'live' && S.liveList.includes(ch) ? S.liveList : (S.favs.has(ch.id) ? S.cat.channels.filter((c) => S.favs.has(c.id)) : S.cat.channels.filter((c) => c.group === ch.group));
    const idx = Math.max(0, list.indexOf(ch));
    const queue = list.slice(Math.max(0, idx - 200), idx + 200);
    nativePlay({
      live: true, title: ch.name, index: queue.indexOf(ch),
      queue: queue.map((c) => { const nn = nowNext(c); return { title: `${c.num ? c.num + ' · ' : ''}${c.name}`, url: c.url, key: c.url, info: nn.now ? `Agora: ${nn.now[2]} (${hhmm(nn.now[0])}–${hhmm(nn.now[1])})` : c.group }; }),
    });
  }
  function addHistory(h) {
    S.history = [h].concat(S.history.filter((x) => x.url !== h.url)).slice(0, 30);
    store.set('history', S.history);
  }
  function playMovie(m) {
    addHistory({ id: m.id, kind: 'movie', title: m.title || m.name, logo: m.logo, url: m.url, at: Date.now() });
    nativePlay({ url: m.url, key: m.url, title: m.title || m.name, info: [m.year, m.lang].filter(Boolean).join(' · ') });
  }
  function playEpisode(s, season, i) {
    const e = (s.seasons[season] || [])[i];
    if (!e) return;
    const t = `${s.title || s.name} · T${season}:E${e.ep}`;
    addHistory({ id: s.id, kind: 'episode', title: t, logo: e.logo || s.logo, url: e.url, at: Date.now() });
    nativePlay({ url: e.url, key: e.url, title: t, info: e.title });
  }

  // ---------- sobreposição ----------
  function openSheet(title, opts, onPick, text) {
    S.sheet = { onPick, prev: document.activeElement };
    const ov = $('#overlay');
    ov.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(title)}"><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${opts.map((o, i) =>
      `<button class="opt f ${o.on ? 'on' : ''}" data-act="sheetPick" data-i="${i}">${esc(o.label)}${o.on ? '<span>✓</span>' : ''}</button>`).join('')}</div>`;
    ov.hidden = false;
    S.sheet.opts = opts;
    const f = $('.opt.on', ov) || $('.opt', ov);
    if (f) f.focus();
  }
  function closeSheet() {
    const prev = S.sheet && S.sheet.prev;
    S.sheet = null;
    $('#overlay').hidden = true;
    $('#overlay').innerHTML = '';
    if (prev && document.contains(prev)) prev.focus();
  }
  function pickFrom(title, arr, key) {
    openSheet(title, arr.map(([v, l]) => ({ label: l, value: v, on: S.settings[key] === v })), (o) => {
      S.settings[key] = o.value;
      saveSettings();
      softRender();
    });
  }
  let toastT = 0;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 3200);
  }

  // ---------- ações ----------
  const ACT = {
    nav: (d) => { S.add = null; go(d.r, {}, { root: true }); },
    go: (d) => { const p = {}; if (d.cat) p.cat = d.cat; if (d.type) p.type = d.type; if (d.r === 'add') S.add = null; go(d.r, p); },
    open: (d) => { const it = S.byId.get(d.id) || newsById(d.id); if (!it) return; if (it.kind === 'channel') return playChannel(it); go('detail', { id: d.id }); },
    playItem: (d) => {
      const it = S.byId.get(d.id);
      if (!it) return;
      if (it.kind === 'movie') playMovie(it);
      else go('detail', { id: d.id });
    },
    resume: (d) => {
      const h = S.history.find((x) => x.id === d.id && x.url) || S.history.find((x) => x.id === d.id);
      if (h) nativePlay({ url: h.url, key: h.url, title: h.title });
    },
    playCh: (d) => { const ch = S.byId.get(d.id); if (ch) playChannel(ch); },
    playEp: (d) => { const s = S.byId.get(d.id); if (s) playEpisode(s, d.season, +d.i); },
    ext: (d) => { const it = S.byId.get(d.id); if (it && N) N.openExternal(it.url, it.title || it.name); },
    fav: (d) => {
      if (S.favs.has(d.id)) S.favs.delete(d.id); else S.favs.add(d.id);
      saveFavs();
      toast(S.favs.has(d.id) ? 'Adicionado aos favoritos' : 'Removido dos favoritos');
      softRender();
    },
    liveCat: (d) => { S.route.params = { cat: d.v }; softRender(); },
    moreLive: () => {
      const box = $('#chlist');
      const next = S.liveList.slice(S.liveRendered, S.liveRendered + 150);
      S.liveRendered += next.length;
      box.insertAdjacentHTML('beforeend', next.map(chRowMobile).join(''));
      if (S.liveRendered >= S.liveList.length) { const b = $('[data-act="moreLive"]'); if (b) b.remove(); }
    },
    catChip: (d) => { S.route.params = { cat: d.v }; render(`chip:${d.v}`); },
    moreGrid: (d) => { S.route.params = Object.assign({}, S.route.params, { lim: +d.lim }); softRender(); },
    season: (d) => { S.route.params = Object.assign({}, S.route.params, { season: d.v }); softRender(); },
    newsSvc: (d) => { S.route.params = { svc: d.v }; softRender(); },
    key: (d) => { S.q += d.v.toLowerCase(); updateSearch(); },
    keyDel: () => { S.q = S.q.slice(0, -1); updateSearch(); },
    keyClr: () => { S.q = ''; updateSearch(); },
    recentQ: (d) => { S.q = d.v; if (TV) updateSearch(); else render(); },
    cfgCat: (d) => { S.route.params = { cat: d.v }; render(`cc:${d.v}`); },
    toggle: (d) => {
      S.settings[d.v] = !S.settings[d.v];
      saveSettings();
      if (d.v === 'hideAdult') rebuild();
      softRender();
    },
    pickSub: () => pickFrom('Idioma da legenda', SUBS, 'subLang'),
    pickAudio: () => pickFrom('Áudio preferido', AUDIO, 'audioLang'),
    pickSize: () => pickFrom('Tamanho da legenda', SIZES, 'subSize'),
    pickUa: () => {
      openSheet('Identificar o app como', UAS.map(([v, l]) => ({ label: l, value: v, on: (S.settings.ua || '') === v })), (o) => {
        S.settings.ua = o.value;
        saveSettings();
        applyUa();
        softRender();
      });
    },
    saveKeys: () => {
      const o = $('#kOmdb'), t = $('#kTmdb');
      const changedTmdb = t && t.value.trim() !== S.settings.tmdbKey;
      if (o) S.settings.omdbKey = o.value.trim();
      if (t) S.settings.tmdbKey = t.value.trim();
      saveSettings();
      toast('Chaves salvas');
      if (changedTmdb) { S.news = null; store.set('news', null); refreshNews(true); }
      if (document.activeElement) document.activeElement.blur();
      softRender();
    },
    clearImdb: () => { try { localStorage.removeItem('noir:imdb'); } catch (e) { /* */ } toast('Cache de notas limpo — reinicie o app'); },
    clearNews: () => { S.news = null; store.set('news', null); refreshNews(true); toast('Buscando novidades…'); },
    refreshList: (d) => { const l = S.lists.find((x) => x.id === d.id); if (l) { toast(`Atualizando “${l.name}”…`); refreshList(l); } },
    refreshAll: () => { toast('Atualizando listas…'); S.lists.forEach((l) => refreshList(l, true)); },
    editList: (d) => { S.add = null; go('addform', { edit: d.id }); },
    delList: (d) => {
      const l = S.lists.find((x) => x.id === d.id);
      if (!l) return;
      openSheet(`Remover “${l.name}”?`, [{ label: 'Remover lista', value: 1 }, { label: 'Cancelar', value: 0, on: true }], async (o) => {
        if (!o.value) return;
        S.lists = S.lists.filter((x) => x.id !== l.id);
        delete S.data[l.id];
        delete S.epgData[l.id];
        saveLists();
        await Promise.all([idb.del('list:' + l.id), idb.del('epg:' + l.id), idb.del('file:' + l.id)]);
        rebuild();
        toast('Lista removida');
        softRender();
      }, 'Os canais, filmes e séries dessa lista deixam de aparecer no app.');
    },
    addType: (d) => { if (!S.add || !S.add.fileName) S.add = null; S.route.params = { type: d.v }; render(`ty:${d.v}`); },
    testList: (d) => testList(d.type),
    importList: () => importList(),
    saveGroups: () => {
      const l = S.lists.find((x) => x.id === S.add.key);
      if (l) { l.groupsOff = Array.from(S.add.off); saveLists(); rebuild(); toast('Grupos salvos'); }
      S.add = null;
      back();
    },
    grp: (d) => { const A = S.add; if (!A) return; if (A.off.has(d.v)) A.off.delete(d.v); else A.off.add(d.v); softRenderKeep(); },
    grpAll: (d) => { const A = S.add; if (!A || !A.data) return; A.off = d.v === '1' ? new Set() : new Set(groupCounts(A.data).map((g) => g[0])); softRenderKeep(); },
    cancelAdd: () => { S.add = null; back(); },
    pickFile: () => { const i = $('#fileIn'); if (i) i.click(); },
    sheetPick: (d) => { const sh = S.sheet; if (!sh) return; const o = sh.opts[+d.i]; closeSheet(); sh.onPick(o); },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.tagName === 'LABEL' && e.target.tagName === 'INPUT') return; // seletor de arquivo
    if (el.tagName === 'A') e.preventDefault();
    const fn = ACT[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el.dataset, el); }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id !== 'fileIn' || !e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const type = (S.route.params && S.route.params.type) || 'm3u';
    const done = (text) => {
      S.add = { key: type, status: 'idle', fileText: text, fileName: file.name, off: new Set() };
      go('addform', { type, prefill: { url: 'file:', name: file.name.replace(/\.[^.]+$/, '') } });
    };
    if (/\.gz$/i.test(file.name) && 'DecompressionStream' in window) {
      new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).text().then(done).catch(() => toast('Não foi possível ler o arquivo'));
    } else {
      file.text().then(done).catch(() => toast('Não foi possível ler o arquivo'));
    }
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'sq') { S.q = e.target.value; const r = $('#sres'); if (r) { r.innerHTML = resultsHtml(); observeImdb(); } }
  });
  document.addEventListener('keyup', (e) => { if (e.target.id === 'sq' && e.key === 'Enter') { saveRecent(); e.target.blur(); } });

  // ---------- navegação por controle remoto (D-pad) ----------
  function focusables() {
    const root = S.sheet ? $('#overlay') : document;
    return $$('.f', root).filter((el) => {
      if (el.disabled) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  }
  function focusEl(el, instant) {
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    scrollIntoViewTV(el, instant);
  }
  function scrollIntoViewTV(el) {
    const main = $('#main');
    if (!main.contains(el)) return;
    const track = el.closest('.track,.eps,.chips');
    if (track) {
      const tr = track.getBoundingClientRect(), r = el.getBoundingClientRect();
      const pad = TV ? innerWidth * 0.045 : 16;
      if (r.left < tr.left + pad) track.scrollLeft -= (tr.left + pad - r.left);
      else if (r.right > tr.right - pad) track.scrollLeft += (r.right - (tr.right - pad));
    }
    const mr = main.getBoundingClientRect(), r = el.getBoundingClientRect();
    const margin = mr.height * 0.12;
    if (el.closest('.hero') || el.closest('.thead')) { if (r.top < mr.top + margin) main.scrollTop = 0; return; }
    const rowEl = el.closest('.row');
    const target = rowEl && rowEl.getBoundingClientRect().height < mr.height * 0.7 ? rowEl : el;
    const tr = target.getBoundingClientRect();
    if (tr.top < mr.top + margin) main.scrollTop -= (mr.top + margin - tr.top);
    else if (tr.bottom > mr.bottom - margin) main.scrollTop += (tr.bottom - (mr.bottom - margin));
  }
  function move(dir) {
    const cur = document.activeElement;
    const list = focusables();
    if (!list.length) return;
    if (!cur || !list.includes(cur)) { focusEl(($('#main [data-autofocus]') && list.includes($('#main [data-autofocus]'))) ? $('#main [data-autofocus]') : list[0]); return; }
    const r = cur.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const curTrack = cur.closest('.track,.chips,.eps,.keys,.sgrid,.grid,.groups');
    let best = null, bestScore = Infinity;
    for (const el of list) {
      if (el === cur) continue;
      const b = el.getBoundingClientRect();
      const ex = b.left + b.width / 2, ey = b.top + b.height / 2;
      let primary, orth;
      if (dir === 'right' || dir === 'left') {
        if (dir === 'right' ? ex <= cx + 1 : ex >= cx - 1) continue;
        primary = dir === 'right' ? Math.max(0, b.left - r.right) : Math.max(0, r.left - b.right);
        const ov = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top);
        orth = ov > 0 ? 0 : Math.min(Math.abs(b.top - r.bottom), Math.abs(r.top - b.bottom));
        if (curTrack && el.closest('.track,.chips,.eps,.keys,.sgrid,.grid,.groups') === curTrack && ov > 0) orth -= 1;
        const s = primary + orth * 4 + Math.abs(ey - cy) * 0.1;
        if (s < bestScore) { bestScore = s; best = el; }
      } else {
        if (dir === 'down' ? ey <= cy + 1 : ey >= cy - 1) continue;
        primary = dir === 'down' ? Math.max(0, b.top - r.bottom) : Math.max(0, r.top - b.bottom);
        const inNav = !!el.closest('#nav'), curNav = !!cur.closest('#nav');
        if (inNav !== curNav) continue; // sobe/desce dentro da mesma coluna
        orth = Math.abs(ex - cx);
        const s = primary * 1.5 + orth * 0.6;
        if (s < bestScore) { bestScore = s; best = el; }
      }
    }
    if (best) focusEl(best);
  }
  document.addEventListener('keydown', (e) => {
    const k = e.key;
    const a = document.activeElement;
    const typing = a && a.tagName === 'INPUT' && a.type !== 'file';
    if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') {
      if (!TV && !typing) return;
      if (typing && (k === 'ArrowLeft' || k === 'ArrowRight')) return;
      e.preventDefault();
      move(k.slice(5).toLowerCase());
    } else if (k === 'Enter' && a && a.classList.contains('f') && !typing && a.tagName !== 'BUTTON' && a.tagName !== 'A') {
      e.preventDefault();
      a.click();
    } else if (k === 'Escape' || k === 'GoBack' || k === 'BrowserBack') {
      e.preventDefault();
      back();
    } else if (TV && S.route.name === 'search' && !typing && /^[a-z0-9 ]$/i.test(k)) {
      S.q += k.toLowerCase();
      updateSearch();
    } else if (TV && S.route.name === 'search' && !typing && k === 'Backspace') {
      e.preventDefault();
      S.q = S.q.slice(0, -1);
      updateSearch();
    }
  });
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (!TV || !el.dataset) return;
    const h = el.dataset.hover;
    if (h === 'live') {
      const ch = S.byId.get(el.dataset.id);
      const top = $('#livetop');
      if (ch && top && top.dataset.id !== ch.id) {
        top.dataset.id = ch.id;
        top.innerHTML = liveTop(ch);
        S.route.params = Object.assign({}, S.route.params, { sel: ch.id });
      }
      const ri = +el.dataset.ri;
      if (ri > S.liveRendered - 12 && S.liveRendered < S.liveList.length) {
        const t0 = Math.floor(Date.now() / 1800000) * 1800000;
        const next = S.liveList.slice(S.liveRendered, S.liveRendered + 80);
        $('#epgbody').insertAdjacentHTML('beforeend', next.map((c, i) => epgRow(c, S.liveRendered + i, t0)).join(''));
        S.liveRendered += next.length;
      }
    } else if (h === 'hero') {
      const hero = $('#cathero');
      const it = S.byId.get(el.dataset.id);
      if (hero && it && hero.dataset.id !== it.id) {
        hero.dataset.id = it.id;
        clearTimeout(hero._t);
        hero._t = setTimeout(() => {
          hero.innerHTML = heroInner(it, it.kind === 'series' ? 'SÉRIE · ' + it.group.toUpperCase() : 'FILME · ' + it.group.toUpperCase());
          fetchImdb(it).then((v) => { if (v && hero.dataset.id === it.id) hero.innerHTML = heroInner(it, it.kind === 'series' ? 'SÉRIE · ' + it.group.toUpperCase() : 'FILME · ' + it.group.toUpperCase()); });
        }, 180);
      }
    } else if (h === 'cfg') {
      const pane = $('#cfgpane');
      if (pane && S.route.params.cat !== el.dataset.v) {
        S.route.params = { cat: el.dataset.v };
        pane.innerHTML = PANES[el.dataset.v]();
        $$('.cfg-cat').forEach((b) => b.classList.toggle('on', b === el));
      }
    }
  });

  // ---------- integração nativa ----------
  window.NOIR = {
    back,
    onResume() {
      if (S.route.name === 'home' || S.route.name === 'detail') softRender();
    },
    onLanAdd(json) {
      let o;
      try { o = JSON.parse(json); } catch (e) { return; }
      const type = ['m3u', 'vod', 'xtream', 'epg'].includes(o.type) ? o.type : 'm3u';
      toast('Lista recebida do celular');
      S.add = null;
      go('addform', { type, prefill: { name: o.name, url: o.url, epg: o.epg, server: o.server, user: o.user, pass: o.pass } });
      setTimeout(() => testList(type), 50);
    },
  };

  // ---------- início ----------
  async function boot() {
    applyUa();
    renderNav();
    S.loading = S.lists.length > 0;
    render();
    for (const l of S.lists) {
      const [d, e] = await Promise.all([idb.get('list:' + l.id), idb.get('epg:' + l.id)]);
      if (d) S.data[l.id] = d;
      if (e) S.epgData[l.id] = e;
    }
    rebuild();
    S.loading = false;
    softRender();
    if (TV && (!document.activeElement || document.activeElement === document.body || $('#nav').contains(document.activeElement))) {
      const el = $('#main [data-autofocus]') || $('#main .f');
      if (el) focusEl(el, true);
    }
    // atualizações em segundo plano
    const stale = (t, h) => !t || Date.now() - t > h * 3600000;
    for (const l of S.lists) {
      const d = S.data[l.id];
      if (!d || (S.settings.autoUpdate && stale(l.updatedAt, 24))) refreshList(l, true);
      else {
        const eu = l.type === 'epg' ? l.url : d.epgUrl;
        if (eu && stale(S.epgData[l.id] && S.epgData[l.id].at, 6)) refreshEpg(l, eu);
      }
    }
    refreshNews();
    setInterval(() => { if (S.route.name === 'live' || S.route.name === 'home') softRender(); }, 60000);
  }
  boot();
})();
