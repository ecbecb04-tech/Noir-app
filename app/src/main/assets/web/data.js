/* GATOFLIX — dados: listas M3U/VOD/Xtream, guia EPG, IMDb (OMDb) e novidades (TMDB). */
'use strict';
(function (root) {
  const N = root.NoirNative || null;

  // ---------- utilidades ----------
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(hd|fhd|uhd|sd|4k|h265|hevc|\[.*?\]|\(.*?\))/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  const hash = (s) => { let h = 5381; s = String(s); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const enc = encodeURIComponent;

  /** Baixa texto: no app passa pelo proxy nativo (sem CORS, aceita http e .gz). */
  async function fetchText(url) {
    const target = N ? '/proxy?u=' + enc(url) : url;
    const r = await fetch(target);
    const t = await r.text();
    if (!r.ok) {
      if ([401, 403, 404, 405, 406, 451, 456, 458, 884].includes(r.status)) {
        throw new Error(`O servidor recusou o acesso (HTTP ${r.status}). Confira o link e, se funcionar em outro app, troque em Configurações › Reprodução › Identificar o app como.`);
      }
      throw new Error((t.slice(0, 160) || '') + ` (HTTP ${r.status})`);
    }
    return t;
  }
  async function fetchJSON(url) {
    const t = await fetchText(url);
    try { return JSON.parse(t); } catch (e) { throw new Error('Resposta inválida do servidor'); }
  }

  // ---------- M3U ----------
  function splitExtinf(line) {
    let q = false;
    const start = line.indexOf(':') + 1;
    for (let i = start; i < line.length; i++) {
      const c = line[i];
      if (c === '"') q = !q;
      else if (c === ',' && !q) return i;
    }
    return line.length;
  }
  function parseExtinf(line) {
    const ci = splitExtinf(line);
    const head = line.slice(0, ci);
    const attrs = {};
    const re = /([\w-]+)="([^"]*)"/g;
    let m;
    while ((m = re.exec(head))) attrs[m[1].toLowerCase()] = m[2];
    const name = line.slice(ci + 1).trim() || attrs['tvg-name'] || 'Sem nome';
    return { name, attrs, group: attrs['group-title'] || '' };
  }

  const EP_RE = /^(.*?)[\s._\-|]*(?:S|T)(\d{1,2})[\s._-]*E(\d{1,3})\b(.*)$/i;
  const EP_RE2 = /^(.*?)[\s._\-|]+(\d{1,2})x(\d{1,3})\b(.*)$/i;
  function langOf(name) {
    if (/\b(leg|legendado|legendada|sub)\b/i.test(name)) return 'LEG';
    if (/\b(dub|dublado|dublada)\b/i.test(name)) return 'DUB';
    return '';
  }
  function cleanTitle(name) {
    let t = String(name)
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\((?:19|20)\d{2}\)/g, ' ')
      .replace(/\b(4k|uhd|fhd|hd|sd|h265|hevc|1080p|720p|2160p)\b/gi, ' ')
      .replace(/[|\-–]\s*(leg|legendado|dub|dublado|dual|nacional)\b.*$/i, ' ')
      .replace(/\b(legendado|legendada|dublado|dublada|dual audio|dual|leg|dub|nacional)\b\.?/gi, ' ')
      .replace(/\s{2,}/g, ' ').trim();
    t = t.replace(/[\s\-–|]+$/, '');
    return t || String(name);
  }
  function yearOf(name) {
    const m = String(name).match(/\b(19[3-9]\d|20[0-4]\d)\b/);
    return m ? m[1] : '';
  }

  /**
   * Converte o texto M3U em {channels, movies, series}.
   * type: 'm3u' (canais; também separa filmes/séries de listas "m3u_plus") ou 'vod'.
   */
  function parseM3U(text, type, listId) {
    const out = { channels: [], movies: [], series: [] };
    const seriesMap = new Map();
    const lines = String(text).split(/\r?\n/);
    let meta = null;
    let num = 0;
    for (let raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith('#EXTINF')) { meta = parseExtinf(line); continue; }
      if (line.startsWith('#EXTGRP:')) { if (meta) meta.group = line.slice(8).trim(); continue; }
      if (line.startsWith('#')) continue;
      const url = line;
      if (!meta) meta = { name: decodeURIComponent(url.split('/').pop().split('?')[0] || 'Sem nome'), attrs: {}, group: '' };
      const a = meta.attrs;
      const name = meta.name;
      const logo = a['tvg-logo'] || a['logo'] || '';
      const group = meta.group || (type === 'vod' ? 'Filmes' : 'Canais');
      const path = url.toLowerCase().split('?')[0];
      const isFile = /\.(mp4|mkv|avi|mov|m4v|wmv)$/.test(path);
      let kind = 'channel';
      if (/\/series\//.test(path)) kind = 'episode';
      else if (/\/movie\//.test(path)) kind = 'movie';
      else if (type === 'vod' || isFile) kind = (EP_RE.test(name) || EP_RE2.test(name)) ? 'episode' : 'movie';
      if (kind === 'episode' && !(EP_RE.test(name) || EP_RE2.test(name))) kind = 'movie';

      if (kind === 'channel') {
        num++;
        out.channels.push({
          id: 'c' + hash(listId + url), kind: 'channel', name, logo, group, url,
          tvgId: a['tvg-id'] || '', num: a['tvg-chno'] || String(num), list: listId,
        });
      } else if (kind === 'movie') {
        out.movies.push({
          id: 'm' + hash(listId + url), kind: 'movie', name, title: cleanTitle(name), year: yearOf(name),
          logo, group, url, lang: langOf(name + ' ' + group), list: listId,
        });
      } else {
        const m = name.match(EP_RE) || name.match(EP_RE2);
        const show = cleanTitle(m[1]) || 'Série';
        const season = String(parseInt(m[2], 10));
        const ep = parseInt(m[3], 10);
        const key = norm(show) + '|' + group;
        let s = seriesMap.get(key);
        if (!s) {
          s = { id: 's' + hash(listId + key), kind: 'series', name: show, title: show, year: yearOf(name), logo, group,
            lang: langOf(name + ' ' + group), seasons: {}, list: listId };
          seriesMap.set(key, s);
          out.series.push(s);
        }
        if (!s.logo && logo) s.logo = logo;
        (s.seasons[season] = s.seasons[season] || []).push({
          id: 'e' + hash(listId + url), ep, title: (m[4] || '').replace(/^[\s\-–:|]+/, '').trim() || ('Episódio ' + ep), url, logo,
        });
      }
      meta = null;
    }
    for (const s of out.series) for (const k in s.seasons) s.seasons[k].sort((x, y) => x.ep - y.ep);
    return out;
  }

  // ---------- Xtream Codes ----------
  function xtreamBase(list) {
    const base = String(list.server || '').trim().replace(/\/+$/, '').replace(/\/player_api\.php.*$/, '');
    return { base, u: enc(list.user || ''), p: enc(list.pass || '') };
  }
  async function loadXtream(list) {
    const { base, u, p } = xtreamBase(list);
    const api = (action, extra) => fetchJSON(`${base}/player_api.php?username=${u}&password=${p}&action=${action}${extra || ''}`);
    const auth = await fetchJSON(`${base}/player_api.php?username=${u}&password=${p}`);
    if (!auth || !auth.user_info || String(auth.user_info.auth) === '0') throw new Error('Usuário ou senha recusados pelo servidor');
    const cats = async (a) => { try { const c = await api(a); const m = {}; (c || []).forEach((x) => { m[x.category_id] = x.category_name; }); return m; } catch (e) { return {}; } };
    const [lc, vc, sc] = await Promise.all([cats('get_live_categories'), cats('get_vod_categories'), cats('get_series_categories')]);
    const safe = async (a) => { try { const r = await api(a); return Array.isArray(r) ? r : []; } catch (e) { return []; } };
    const [live, vod, ser] = await Promise.all([safe('get_live_streams'), safe('get_vod_streams'), safe('get_series')]);
    const id = list.id;
    return {
      channels: live.map((s, i) => ({
        id: 'x' + hash(id + 'l' + s.stream_id), kind: 'channel', name: s.name || 'Canal', logo: s.stream_icon || '',
        group: lc[s.category_id] || 'Canais', url: `${base}/live/${u}/${p}/${s.stream_id}.ts`,
        tvgId: s.epg_channel_id || '', num: String(s.num || i + 1), list: id,
      })),
      movies: vod.map((s) => ({
        id: 'x' + hash(id + 'v' + s.stream_id), kind: 'movie', name: s.name || 'Filme', title: cleanTitle(s.name || ''),
        year: yearOf(s.name || '') || String(s.year || ''), logo: s.stream_icon || '', group: vc[s.category_id] || 'Filmes',
        url: `${base}/movie/${u}/${p}/${s.stream_id}.${s.container_extension || 'mp4'}`,
        lang: langOf((s.name || '') + ' ' + (vc[s.category_id] || '')), added: (+s.added || 0) * 1000, list: id,
        rating: parseFloat(s.rating) || 0,
      })),
      series: ser.map((s) => ({
        id: 'x' + hash(id + 's' + s.series_id), kind: 'series', name: s.name || 'Série', title: cleanTitle(s.name || ''),
        year: String(s.releaseDate || s.release_date || '').slice(0, 4) || yearOf(s.name || ''), logo: s.cover || '',
        group: sc[s.category_id] || 'Séries', plot: s.plot || '', lang: langOf((s.name || '') + ' ' + (sc[s.category_id] || '')),
        added: (+s.last_modified || 0) * 1000, xt: { seriesId: s.series_id }, seasons: null, list: id,
        rating: parseFloat(s.rating) || 0,
      })),
      epgUrl: list.epg || `${base}/xmltv.php?username=${u}&password=${p}`,
    };
  }
  async function loadXtreamSeries(list, series) {
    const { base, u, p } = xtreamBase(list);
    const info = await fetchJSON(`${base}/player_api.php?username=${u}&password=${p}&action=get_series_info&series_id=${series.xt.seriesId}`);
    const seasons = {};
    const eps = info && info.episodes ? info.episodes : {};
    for (const sn of Object.keys(eps)) {
      seasons[String(parseInt(sn, 10))] = (eps[sn] || []).map((e) => ({
        id: 'e' + hash(list.id + e.id), ep: +e.episode_num || 0, title: e.title || ('Episódio ' + e.episode_num),
        url: `${base}/series/${u}/${p}/${e.id}.${e.container_extension || 'mp4'}`,
        plot: (e.info && e.info.plot) || '', dur: (e.info && (e.info.duration || '')) || '',
        logo: (e.info && e.info.movie_image) || '',
      })).sort((a, b) => a.ep - b.ep);
    }
    series.seasons = seasons;
    if (info && info.info) {
      series.plot = series.plot || info.info.plot || '';
      series.genre = info.info.genre || '';
    }
    return series;
  }

  // ---------- Carregar uma lista ----------
  async function loadList(list) {
    if (list.type === 'xtream') return loadXtream(list);
    if (list.type === 'epg') return { channels: [], movies: [], series: [], epgUrl: list.url };
    const text = list.url === 'file:' ? (list.fileText || '') : await fetchText(list.url);
    if (!/#EXTM3U|#EXTINF/i.test(text.slice(0, 5000))) throw new Error('O link não parece ser uma lista M3U');
    const r = parseM3U(text, list.type, list.id);
    const head = text.slice(0, 600).match(/(?:x-tvg-url|url-tvg)="([^"]+)"/i);
    r.epgUrl = list.epg || (head ? head[1].split(',')[0].trim() : '');
    return r;
  }

  // ---------- Guia de programação ----------
  async function loadEpg(url) {
    if (N) {
      const r = await fetch('/epg?u=' + enc(url));
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    }
    // Navegador (testes): XMLTV simples via DOMParser
    const xml = new DOMParser().parseFromString(await fetchText(url), 'text/xml');
    const out = { channels: {}, progs: {} };
    xml.querySelectorAll('channel').forEach((c) => {
      const icon = c.querySelector('icon');
      out.channels[c.getAttribute('id')] = { n: (c.querySelector('display-name') || {}).textContent || '', i: icon ? icon.getAttribute('src') : '' };
    });
    const t = (s) => {
      const m = String(s || '').match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/);
      if (!m) return 0;
      let ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
      if (m[7]) { const sg = m[7][0] === '-' ? -1 : 1; ms -= sg * ((+m[7].slice(1, 3)) * 60 + (+m[7].slice(3, 5))) * 60000; }
      return ms;
    };
    xml.querySelectorAll('programme').forEach((p) => {
      const ch = p.getAttribute('channel');
      (out.progs[ch] = out.progs[ch] || []).push([t(p.getAttribute('start')), t(p.getAttribute('stop')),
        (p.querySelector('title') || {}).textContent || '', (p.querySelector('desc') || {}).textContent || '']);
    });
    return out;
  }

  // ---------- IMDb via OMDb ----------
  const OMDB_KEY = 'noir:imdb';
  let imdbCache = {};
  try { imdbCache = JSON.parse(localStorage.getItem(OMDB_KEY) || '{}'); } catch (e) { imdbCache = {}; }
  let imdbSaveT = 0;
  const imdbQueue = [];
  let imdbActive = 0;
  const imdbWaiters = new Map();
  function imdbKey(item) {
    if (item._ik) return item._ik;
    const k = norm(item.original || item.title || item.name) + '|' + (item.year || '');
    try { Object.defineProperty(item, '_ik', { value: k, enumerable: false, writable: true }); } catch (e) { /* */ }
    return k;
  }
  function imdbCached(item) { return imdbCache[imdbKey(item)] || null; }
  function saveImdb() {
    clearTimeout(imdbSaveT);
    imdbSaveT = setTimeout(() => {
      const keys = Object.keys(imdbCache);
      if (keys.length > 5000) keys.sort((a, b) => (imdbCache[a].ts || 0) - (imdbCache[b].ts || 0)).slice(0, keys.length - 4000).forEach((k) => delete imdbCache[k]);
      try { localStorage.setItem(OMDB_KEY, JSON.stringify(imdbCache)); } catch (e) { /* cheio */ }
    }, 1500);
  }
  /** Busca a nota IMDb (com cache). Resolve com {r, plot, genre, runtime, year, id} ou null. */
  function imdbFetch(item, apiKey) {
    const key = imdbKey(item);
    if (imdbCache[key]) return Promise.resolve(imdbCache[key].miss ? null : imdbCache[key]);
    if (!apiKey) return Promise.resolve(null);
    if (imdbWaiters.has(key)) return imdbWaiters.get(key);
    const pr = new Promise((resolve) => {
      imdbQueue.push({ item, key, apiKey, resolve });
      pumpImdb();
    });
    imdbWaiters.set(key, pr);
    return pr;
  }
  function pumpImdb() {
    while (imdbActive < 4 && imdbQueue.length) {
      const job = imdbQueue.shift();
      imdbActive++;
      const it = job.item;
      const type = it.kind === 'series' ? '&type=series' : (it.kind === 'movie' ? '&type=movie' : '');
      const q = (y) => `https://www.omdbapi.com/?apikey=${enc(job.apiKey)}&t=${enc(it.original || it.title || it.name)}${y ? '&y=' + enc(y) : ''}${type}`;
      const once = (u) => fetch(u).then((r) => r.json());
      once(q(it.year)).then((j) => (j && j.Response === 'True') || !it.year ? j : once(q(''))).then((j) => {
        let v;
        if (j && j.Response === 'True') {
          v = { r: j.imdbRating && j.imdbRating !== 'N/A' ? j.imdbRating : '', plot: j.Plot && j.Plot !== 'N/A' ? j.Plot : '',
            genre: j.Genre && j.Genre !== 'N/A' ? j.Genre : '', runtime: j.Runtime && j.Runtime !== 'N/A' ? j.Runtime : '',
            year: j.Year || '', id: j.imdbID || '', ts: Date.now() };
        } else if (j && /limit/i.test(j.Error || '')) {
          v = null; // limite diário: não grava
        } else {
          v = { miss: 1, ts: Date.now() };
        }
        if (v) { imdbCache[job.key] = v; saveImdb(); }
        job.resolve(v && !v.miss ? v : null);
      }).catch(() => job.resolve(null)).finally(() => {
        imdbActive--;
        imdbWaiters.delete(job.key);
        pumpImdb();
      });
    }
  }

  // ---------- Novidades nos streamings (TMDB) ----------
  const PROVIDERS = [
    { id: 8, name: 'Netflix' }, { id: 119, name: 'Prime Video' }, { id: 337, name: 'Disney+' },
    { id: 1899, name: 'Max' }, { id: 307, name: 'Globoplay' }, { id: 350, name: 'Apple TV+' },
  ];
  async function tmdb(key, path, params) {
    const bearer = key.length > 40;
    const qs = new URLSearchParams(Object.assign({ language: 'pt-BR' }, params || {}, bearer ? {} : { api_key: key }));
    const r = await fetch(`https://api.themoviedb.org/3/${path}?${qs}`, { headers: bearer ? { Authorization: 'Bearer ' + key } : {} });
    if (!r.ok) throw new Error(r.status === 401 ? 'Chave TMDB inválida' : 'TMDB indisponível');
    return r.json();
  }
  const day = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  function mapTmdb(x, type, svc) {
    return {
      id: 'n' + type + x.id, kind: type === 'tv' ? 'series' : 'movie', tmdb: x.id, tmdbType: type, svc: svc || '',
      title: x.title || x.name || '', original: x.original_title || x.original_name || '',
      year: String(x.release_date || x.first_air_date || '').slice(0, 4), date: x.release_date || x.first_air_date || '',
      plot: x.overview || '', logo: x.poster_path ? 'https://image.tmdb.org/t/p/w342' + x.poster_path : '',
      backdrop: x.backdrop_path ? 'https://image.tmdb.org/t/p/w780' + x.backdrop_path : '',
    };
  }
  async function loadNews(key) {
    const base = { watch_region: 'BR', with_watch_monetization_types: 'flatrate', 'vote_count.gte': 5 };
    const recent = [];
    await Promise.all(PROVIDERS.map(async (pv) => {
      try {
        const [mv, tv] = await Promise.all([
          tmdb(key, 'discover/movie', Object.assign({}, base, { with_watch_providers: pv.id, sort_by: 'popularity.desc', 'primary_release_date.gte': day(-150), 'primary_release_date.lte': day(0) })),
          tmdb(key, 'discover/tv', Object.assign({}, base, { with_watch_providers: pv.id, sort_by: 'popularity.desc', 'air_date.gte': day(-30), 'air_date.lte': day(0) })),
        ]);
        const items = [].concat((mv.results || []).slice(0, 8).map((x) => mapTmdb(x, 'movie', pv.name)), (tv.results || []).slice(0, 8).map((x) => mapTmdb(x, 'tv', pv.name)));
        recent.push(...items);
      } catch (e) {
        if (/inválida/.test(e.message)) throw e;
      }
    }));
    const all = PROVIDERS.map((p) => p.id).join('|');
    const [trend, soon] = await Promise.all([
      tmdb(key, 'discover/movie', Object.assign({}, base, { with_watch_providers: all, sort_by: 'popularity.desc' })).catch(() => ({ results: [] })),
      tmdb(key, 'discover/movie', { region: 'BR', with_release_type: '4', sort_by: 'primary_release_date.asc', 'primary_release_date.gte': day(1), 'primary_release_date.lte': day(60), 'vote_count.gte': 0 }).catch(() => ({ results: [] })),
    ]);
    return {
      at: Date.now(),
      recent: recent.sort((a, b) => (b.date || '').localeCompare(a.date || '')),
      trend: (trend.results || []).slice(0, 20).map((x) => mapTmdb(x, 'movie', '')),
      soon: (soon.results || []).filter((x) => x.poster_path).slice(0, 20).map((x) => mapTmdb(x, 'movie', '')),
    };
  }

  /** Quantas notas ainda podem ser buscadas hoje (OMDb grátis: 1.000/dia). */
  function imdbBudget(max) {
    const today = new Date().toISOString().slice(0, 10);
    let b = {};
    try { b = JSON.parse(localStorage.getItem('noir:imdbday') || '{}'); } catch (e) { b = {}; }
    if (b.d !== today) b = { d: today, n: 0 };
    return { left: Math.max(0, max - b.n), use(n) { b.n += n; try { localStorage.setItem('noir:imdbday', JSON.stringify(b)); } catch (e) { /* */ } } };
  }

  const API = { imdbBudget, norm, hash, fetchText, fetchJSON, parseM3U, parseExtinf, cleanTitle, yearOf, langOf, loadList, loadXtreamSeries, loadEpg,
    imdbFetch, imdbCached, imdbKey, PROVIDERS, loadNews };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.NoirData = API;
})(typeof window !== 'undefined' ? window : globalThis);
