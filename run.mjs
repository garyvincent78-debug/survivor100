// Collecteur SURVIVOR 100 : un passage = lire les cotations réelles, avancer le moteur, écrire l'état.
// Même moteur que la page (engine.js, extrait de l'artefact). Aucun appel à une IA.
import fs from 'fs';
import path from 'path';

const here = path.dirname(new URL(import.meta.url).pathname);
const E = new Function(fs.readFileSync(path.join(here, 'engine.js'), 'utf8') +
  ';return{H,REF,KR,KR_URL,CB_URL,migrate,ingest,advance,krakenQuotes,planYh,ingestYh,X,fill,liq,thrAt}')();
const { H } = E;
const D = process.env.DATA_DIR || path.join(here, 'data');
const JN = 150; // entrées du journal servies à la page (le journal complet reste dans journal.jsonl)
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'application/json' };
const jget = async url => {
  try { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) }); const t = await r.text(); let j = null; try { j = JSON.parse(t) } catch { } return { status: r.status, json: j } }
  catch (e) { return { status: 0, json: null } }
};
const P = f => path.join(D, f);
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(P(f), 'utf8')) } catch { return d } };
const wr = (f, o) => { fs.mkdirSync(path.dirname(P(f)), { recursive: true }); fs.writeFileSync(P(f), JSON.stringify(o)) };
const zt = ms => new Date(ms).toISOString().slice(0, 19) + 'Z', iso = t => new Date(t).toISOString().slice(0, 10);

const S = rd('state.json', null);
if (!S) { console.error('data/state.json manquant'); process.exit(1) }
E.migrate(S); S.runner = true;
// Stratégie écrite par l'IA (strategy.js) : paramètres, modèles de score, univers, notes.
// Les règles du jeu (frais, glissement, seuil de survie, mort, pas d'anticipation) sont dans engine.js, hors de portée de strategy.js.
// Kraken : actifs sans tiret (PAXGEUR…) et actions/ETF US tokenisés « xStocks » (AAPLxUSD…, asset_class=tokenized_asset), cotes publiques en temps réel sans clé.
const KRT = 'https://api.kraken.com/0/public/Ticker?pair=';
const isKr = x => typeof x === 'string' && /^[A-Za-z0-9]{2,12}(USD|EUR)$/.test(x) && !x.includes('-');
const isTok = x => /[A-Z0-9]x(USD|EUR)$/.test(x);
let WATCH = [];
const LIM = { auto: [0, 1], entryThr: [0.05, 0.9], stopAtr: [0.5, 10], minHold: [1, 96], maxTrades: [1, 200], expFloor: [0.05, 1], dayGoal: [0.005, 1] };
const STRAT = process.env.STRAT_FILE || path.join(here, 'strategy.js');
(function applyStrategy() {
  if (!fs.existsSync(STRAT)) return;
  let st;
  try { const m = { exports: {} }; new Function('module', 'exports', fs.readFileSync(STRAT, 'utf8'))(m, m.exports); st = m.exports || {} }
  catch (e) { S.anom.push({ ts: Date.now(), t: 'strategy.js ignorée : ' + String(e.message).slice(0, 120) }); return }
  const P = {}; for (const [k, [a, b]] of Object.entries(LIM)) { const v = st.params && st.params[k]; if (typeof v === 'number' && isFinite(v)) P[k] = Math.min(b, Math.max(a, v)) }
  E.X.P = P; if (P.entryThr != null) S.entryThr = P.entryThr;
  E.X.mods = (Array.isArray(st.models) ? st.models : []).filter(m => m && /^[a-z][a-z0-9]{1,7}$/.test(m.id) && !/^(tr|rv|bk)\d$/.test(m.id) && typeof m.fn === 'function').slice(0, 12)
    .map(m => ({ id: m.id, fam: String(m.fam || 'IA').slice(0, 30), p: String(m.p || '').slice(0, 40), fn: m.fn }));
  const u = st.universe || {};
  WATCH = (Array.isArray(u.watch) ? u.watch : []).filter(isKr).slice(0, 40);
  for (const sym of u.on || []) { const x = S.uni.find(y => y.sym === sym); if (x) x.on = true }
  for (const sym of u.off || []) { const x = S.uni.find(y => y.sym === sym); if (x) x.on = false }
  for (const a of (u.add || []).slice(0, 30)) {
    if (!a || S.uni.some(y => y.sym === a.sym)) continue;
    const ok = a.src === 'cb' ? /^[A-Z0-9]{2,10}-EUR$/.test(a.sym) : a.src === 'yh' ? /^[A-Za-z0-9.=^-]{1,14}$/.test(a.sym) : false;
    if (ok && S.uni.filter(y => y.on).length < 60) S.uni.push({ sym: a.sym, src: a.src, on: true, nm: String(a.nm || a.sym).slice(0, 30), cls: String(a.cls || 'IA').slice(0, 24), ...(a.ccy === 'USD' ? { ccy: 'USD' } : {}), ...(a.inv ? { inv: true } : {}), fails: 0, lastObs: 0, skipUntil: 0 })
  }
  S.notesSeen = S.notesSeen || [];
  for (const n of st.notes || []) if (n && n.id && !S.notesSeen.includes(String(n.id))) { S.notesSeen.push(String(n.id)); S.evo.push({ ts: Date.now(), kind: 'cerveau', text: String(n.text || '').slice(0, 600) }) }
  S.notesSeen = S.notesSeen.slice(-300); if (S.evo.length > 80) S.evo.splice(0, S.evo.length - 80);
})();
const now = Date.now(), B = {}, health = { t: now, src: {} };
// Courtier : exécute les ordres de l'IA (orders.json) au cours réel du moment (bid/ask Coinbase), jamais sur une cotation passée,
// puis contrôle la mort en direct. Format : {"place":[{id,sym:"XXX-EUR",side:"buy"|"sell",type:"market"|"limit"|"stop",amt(€, achat),qty(unités|"all", vente),px,exp(ms),note}],"cancel":[id]}
const ORD = process.env.ORDERS_FILE || path.join(here, 'orders.json');
const CBT = 'https://api.exchange.coinbase.com/products/';
async function krQuotes(syms) {   // → { sym: {bid, ask, px, t} } en euros (USD converti au taux EUR/USD Kraken)
  const out = {}, t = Date.now(); syms = [...new Set(syms)].filter(x => isKr(x) && !(S.krBad || []).includes(x)); if (!syms.length) return out;
  const get = async (pairs, tok) => { const r = await jget(KRT + pairs.join(',') + (tok ? '&asset_class=tokenized_asset' : '')); health.src['kr:' + (tok ? 'xstocks' : 'spot')] = r.status; const e = (r.json && r.json.error) || []; return { res: r.json && r.json.result && !e.length ? r.json.result : null, unknown: e.some(m => /Unknown asset pair/.test(m)) } };
  let fx = 1;
  if (syms.some(x => /USD$/.test(x))) { const { res } = await get(['EURUSD'], false), k = res && Object.values(res)[0]; if (k && +k.a[0] > 0 && +k.b[0] > 0) fx = (+k.a[0] + +k.b[0]) / 2; else return out }
  for (const tok of [false, true]) {
    const ps = syms.filter(x => isTok(x) === tok); if (!ps.length) continue;
    let { res } = await get(ps, tok);
    if (!res) { res = {}; await Promise.all(ps.map(async p => { const g = await get([p], tok); if (g.res) Object.assign(res, g.res); else if (g.unknown) (S.krBad = S.krBad || []).push(p) })) }
    for (const [k, v] of Object.entries(res)) {
      const sym = ps.find(p => p.toUpperCase() === k.toUpperCase()) || k, a = +v.a[0], b = +v.b[0];
      if (!(a > 0 && b > 0 && a >= b && a / b < 1.05)) continue;
      const d = /USD$/.test(sym) ? fx : 1; out[sym] = { bid: b / d, ask: a / d, px: +v.c[0] / d, t };
      if (tok) {   // marché fermé (week-end…) : cote inchangée depuis 30 min → figée, les ordres attendent
        const key = v.b[0] + '|' + v.a[0], z = (S.krSeen = S.krSeen || {})[sym];
        if (!z || z.k !== key) S.krSeen[sym] = { k: key, t }; else if (t - z.t > 1800000) out[sym].stale = true;
      }
    }
  }
  return out;
}
async function krCatalog() {   // catalogue des xStocks, rafraîchi toutes les 6 h dans data/kraken_xstocks.json
  const t = Date.now(); if (S.krCatAt && t - S.krCatAt < 21600000) return; S.krCatAt = t;
  const r = await jget('https://api.kraken.com/0/public/AssetPairs?aclass_base=tokenized_asset');
  if (r.status === 200 && r.json && r.json.result) wr('kraken_xstocks.json', { t, pairs: Object.values(r.json.result).map(p => ({ p: p.altname, quote: p.quote, min: p.ordermin, st: p.status })) });
}
async function broker(out) {
  const t = Date.now(), r4 = x => Math.round(x * 1e4) / 1e4;
  let od = {}; try { od = JSON.parse(fs.readFileSync(ORD, 'utf8')) } catch { }
  S.orders = S.orders || []; S.oseen = S.oseen || []; S.olog = S.olog || [];
  const log = (id, res) => { S.olog.push({ ts: t, id, res }); S.olog = S.olog.slice(-60) };
  for (const id of od.cancel || []) { const i = S.orders.findIndex(o => o.id === String(id)); if (i >= 0) { S.orders.splice(i, 1); log(String(id), 'annulé') } }
  for (const o of (od.place || []).slice(0, 50)) {
    const id = String((o && o.id) || ''); if (!id || S.oseen.includes(id)) continue;
    S.oseen.push(id);
    const typ = ['market', 'limit', 'stop'].includes(o.type) ? o.type : 'market';
    const isCb = /^[A-Z0-9]{2,10}-EUR$/.test(o.sym || ''), isYh = S.uni.some(u => u.sym === o.sym && u.src === 'yh');
    if (!(isCb || isYh || isKr(o.sym)) || !['buy', 'sell'].includes(o.side) || (typ !== 'market' && !(+o.px > 0))) { log(id, 'refusé : paire Coinbase XXX-EUR, actif Kraken (AAPLxUSD, PAXGEUR…) ou actif Yahoo déclaré dans strategy.js, sens buy/sell, prix px pour limit/stop'); continue }
    if (isCb && !S.uni.some(u => u.sym === o.sym) && S.uni.filter(u => u.on).length < 60) S.uni.push({ sym: o.sym, src: 'cb', on: true, nm: o.sym, cls: 'Crypto', fails: 0, lastObs: 0, skipUntil: 0 });
    S.orders.push({ id, sym: o.sym, side: o.side, type: typ, px: +o.px || 0, amt: +o.amt || 0, qty: o.qty === 'all' ? 'all' : (+o.qty || 0), exp: +o.exp || 0, note: String(o.note || '').slice(0, 200), seen: t });
  }
  S.oseen = S.oseen.slice(-500);
  const syms = [...new Set([...S.orders.map(o => o.sym), ...Object.keys(S.pos)].filter(x => /-EUR$/.test(x)))], Q = {};
  await Promise.all(syms.map(async x => {
    const r = await jget(CBT + x + '/ticker'); health.src['live:' + x] = r.status; const j = r.json;
    if (r.status === 200 && j && +j.bid > 0 && +j.ask > 0 && Math.abs(t - Date.parse(j.time)) < 120000) Q[x] = { bid: +j.bid, ask: +j.ask, px: +j.price || (+j.bid + +j.ask) / 2, t: Date.parse(j.time) };
  }));
  for (const x of new Set([...S.orders.map(o => o.sym), ...Object.keys(S.pos)])) {   // actifs Yahoo : dernier cours lu, au plus 25 min (différé de 15 min à Paris)
    const u = S.uni.find(y => y.sym === x); if (!u || u.src !== 'yh') continue;
    const L = S.last[x]; if (L && L.live > 0 && L.ltT && t - L.ltT <= 1500000 && t - (L.obs || 0) <= 1500000) Q[x] = { bid: L.live, ask: L.live, px: L.live, t: L.ltT };
  }
  await krCatalog();
  const kq = await krQuotes([...S.orders.map(o => o.sym), ...Object.keys(S.pos), ...WATCH]); for (const [k, q] of Object.entries(kq)) if (!q.stale) Q[k] = q;
  S.board = Object.fromEntries(WATCH.filter(x => kq[x]).map(x => [x, Object.assign({ bid: +kq[x].bid.toPrecision(7), ask: +kq[x].ask.toPrecision(7) }, kq[x].stale ? { stale: true } : {})]));
  const oc = { now: t, trades: [], pts: [] };
  for (const o of S.orders.slice()) {
    const done = res => { S.orders.splice(S.orders.indexOf(o), 1); log(o.id, res) };
    if (o.exp && t > o.exp) { done('expiré'); continue }
    const q = Q[o.sym]; if (!q) { if (!o.warned) { o.warned = 1; log(o.id, 'en attente : cote fraîche indisponible (marché fermé, source bloquée ou cours trop ancien)') } continue }
    const L = S.last[o.sym]; if (L && L.x && L.x.ok === false) continue;
    const buy = o.side === 'buy', hit = o.type === 'market' || (o.type === 'limit' && (buy ? q.ask <= o.px : q.bid >= o.px)) || (o.type === 'stop' && (buy ? q.ask >= o.px : q.bid <= o.px));
    if (!hit) continue;
    const p = S.pos[o.sym], pxf = buy ? q.ask : q.bid;
    if (buy && !(o.amt > 0)) { done('refusé : montant amt (€) requis pour un achat'); continue }
    if (!buy && !p) { done('refusé : aucune position à vendre'); continue }
    const qty = buy ? 0 : (o.qty === 'all' ? p.q : o.qty > 0 ? Math.min(o.qty, p.q) : o.amt > 0 ? Math.min(p.q, o.amt / q.bid) : p.q);
    const u = S.uni.find(x => x.sym === o.sym) || { sym: o.sym, src: isKr(o.sym) ? 'kr' : 'cb' };
    S.last[o.sym] = Object.assign(S.last[o.sym] || { c: q.px, t: Math.floor(t / H) * H, x: null }, { live: q.px, ltT: q.t, obs: t, url: isKr(o.sym) ? KRT + o.sym + (isTok(o.sym) ? '&asset_class=tokenized_asset' : '') : CBT + o.sym + '/ticker', src: isKr(o.sym) ? 'kr' : 'cb' });
    const e = E.fill(S, { sym: o.sym, side: o.side, amt: o.amt, qty, decT: Math.min(o.seen, t - 1), model: 'cerveau', why: o.note || ('Ordre ' + o.type + ' de l’IA') }, { u, bar: { t, o: pxf, h: pxf, l: pxf, c: pxf } }, t, oc);
    if (!e) { done('refusé : montant < 5 € ou espèces insuffisantes'); continue }
    out.trades.push(e); done('exécuté à ' + e.price.toFixed(4) + ' €');
  }
  for (const x of Object.keys(S.pos)) if (Q[x]) S.mark[x] = (Q[x].bid + Q[x].ask) / 2;
  const LV = E.liq(S), thr = E.thrAt(S, t), lastT = out.pts.length ? out.pts[out.pts.length - 1][0] : (S.lastPt || 0);
  if (t - lastT >= 290000 || LV < thr) { out.pts.push([t, r4(LV), r4(thr)]); S.lastPt = t }
  if (LV < thr) { S.status = 'dead'; S.died = { ts: t, lv: r4(LV), thr: r4(thr) }; S.pend = []; S.orders = [] }
}
let lim = now;
// Passerelle Firecrawl pour Yahoo, bloqué (HTTP 429) depuis les serveurs GitHub. Clé : secret GitHub FIRECRAWL_KEY (facultatif).
const FCK = process.env.FIRECRAWL_KEY || '';
const slotOf = t => Math.floor((t - 20000) / H);
const eqHours = t => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(t)).map(x => [x.type, x.value])); const m = +p.hour * 60 + +p.minute; return !['Sat', 'Sun'].includes(p.weekday) && m >= 535 && m <= 1325 };
async function fcget(url) {
  try {
    const r = await fetch('https://api.firecrawl.dev/v1/scrape', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + FCK }, body: JSON.stringify({ url, formats: ['rawHtml'], maxAge: 0 }), signal: AbortSignal.timeout(60000) });
    const j = await r.json().catch(() => null); if (!r.ok || !j || !j.success) return { status: r.status || 500, json: null };
    const h = String((j.data && (j.data.rawHtml || j.data.html)) || ''), a = h.indexOf('{'), b = h.lastIndexOf('}'); let d = null; try { d = JSON.parse(h.slice(a, b + 1)) } catch { }
    const sc = (j.data.metadata && j.data.metadata.statusCode) || 200; return { status: d && sc === 200 ? 200 : (sc !== 200 ? sc : 502), json: d };
  } catch { return { status: 0, json: null } }
}
const anomOnce = t => { const l = S.anom[S.anom.length - 1]; if (!l || l.t !== t || now - l.ts > 3600000) S.anom.push({ ts: now, t }) };
const hold = u => { lim = Math.min(lim, u.lastObs || 0) };
let kq = null;
const handle = (u, data, obs, url) => {
  const r = E.ingest(S, B, u, data, obs, kq, url); r.an.forEach(t => S.anom.push({ ts: now, t }));
  if (r.rej) { u.fails++; if (u.fails < 3) hold(u); return }
  u.fails = 0; u.lastObs = obs; lim = Math.min(lim, obs); S.dq.ok += r.added; S.dq.bad += r.bad;
};

if (S.status === 'alive') {
  // cryptos : bougies Coinbase en fenêtres de 290 bougies, depuis 210 bougies avant le curseur
  const cbs = S.uni.filter(u => u.on && u.src === 'cb'), from = Math.floor((Math.min(S.cursor || S.t0, now) - 210 * H) / H) * H, got = {};
  const pairs = cbs.map(u => E.KR[u.sym]).filter(Boolean);
  const [, k] = await Promise.all([
    Promise.all(cbs.map(async u => {
      const arr = []; let ok = true, st = 0;
      for (let s = from; s < now && ok; s += 290 * H) {
        const r = await jget(`${E.CB_URL}${u.sym}/candles?granularity=900&start=${zt(s)}&end=${zt(Math.min(s + 290 * H, now))}`);
        st = r.status; if (r.status === 200 && Array.isArray(r.json)) arr.push(...r.json); else ok = false;
      }
      health.src[u.sym] = st; if (ok) got[u.sym] = arr;
    })),
    pairs.length ? jget(E.KR_URL + pairs.join(',')) : null]);
  if (k) { health.src.kraken = k.status; if (k.status === 200) kq = E.krakenQuotes(k.json) }
  if (pairs.length && !kq) S.anom.push({ ts: now, t: 'Contrôle croisé Kraken indisponible ce passage : cotations crypto non recoupées.' });
  for (const u of cbs) { if (!got[u.sym]) { u.fails++; if (u.fails < 3) hold(u); continue } handle(u, got[u.sym], Date.now(), `${E.CB_URL}${u.sym}/candles?granularity=900`) }
  // actions, ETF, matières premières, devises : lectures groupées Yahoo (20 actifs par lecture)
  const ys = S.uni.filter(u => u.on && u.src === 'yh');
  if (ys.length) {
    const gap = eqHours(now) ? 1 : 8, fcDue = FCK && slotOf(now) - slotOf(S.yfcAt || 0) >= gap;
    for (const it of E.planYh(ys, B, now, S.cursor || undefined)) {
      let r = null;
      if (!S.yDirectFailAt || now - S.yDirectFailAt > 1800000) { r = await jget(it.url); S.yDirectFailAt = r.status === 200 ? 0 : now }
      if ((!r || r.status !== 200) && FCK) {
        if (!fcDue) { if (gap === 1 && (S.yfail || 0) < 3) it.us.forEach(hold); continue }
        S.yfcAt = now; r = await fcget(it.url); S.credits.fc = (S.credits.fc || 0) + 1; S.credits.fcDay = (S.credits.fcDay && S.credits.fcDay.d === iso(now) ? S.credits.fcDay : { d: iso(now), n: 0 }); S.credits.fcDay.n++;
      }
      if (!r) { if ((S.yfail || 0) < 3) it.us.forEach(hold); continue }
      health.src['yh:' + it.us[0].sym] = r.status;
      const d = r.status === 200 && r.json && !r.json.spark ? r.json : null;
      if (!d) { S.yfail = (S.yfail || 0) + 1; if (S.yfail < 3) it.us.forEach(hold); anomOnce('Lecture groupée Yahoo en échec (HTTP ' + r.status + ')'); continue }
      S.yfail = 0; E.ingestYh(it, d, Date.now(), handle).forEach(u => { hold(u); S.anom.push({ ts: now, t: u.sym + ' : absent de la réponse Yahoo' }) });
    }
  }
  const out = E.advance(S, B, lim, now); S.lastFetch = now; S.anom = S.anom.slice(-40);
  if (S.status === 'alive') await broker(out);
  for (const e of out.trades) fs.appendFileSync(P('journal.jsonl'), JSON.stringify(e) + '\n');
  const by = {}; for (const p of out.pts) (by[iso(p[0])] = by[iso(p[0])] || []).push(p);
  for (const [d, pts] of Object.entries(by)) { const doc = rd(`equity/${d}.json`, { day: d, pts: [] }); doc.pts = doc.pts.concat(pts); wr(`equity/${d}.json`, doc) }
  console.log(`cursor ${new Date(S.cursor).toISOString()} | points ${out.pts.length} | trades ${out.trades.length} | statut ${S.status} | santé ${JSON.stringify(health.src)}`);
}
if (S.status === 'alive') {   // horizon de survie lisible par l'IA : seuils des prochains minuits Paris et échéance des espèces seules
  const LV = E.liq(S), nx = [], h = 3600000; let ts = Math.ceil(Date.now() / h) * h, prev = E.thrAt(S, Date.now()), dl = null;
  for (let i = 0; i < 24 * 60 && (nx.length < 8 || dl === null); i++, ts += h) {
    const th = E.thrAt(S, ts); if (th > prev + 1e-9) { if (nx.length < 8) nx.push({ t: ts, thr: Math.round(th * 1e4) / 1e4 }); if (dl === null && th > LV) dl = ts; prev = th }
  }
  S.horizon = { lv: Math.round(LV * 1e4) / 1e4, thr: Math.round(E.thrAt(S, Date.now()) * 1e4) / 1e4, next: nx, cashDeadline: dl };
}
wr('state.json', S);
const jl = fs.existsSync(P('journal.jsonl')) ? fs.readFileSync(P('journal.jsonl'), 'utf8').split('\n').filter(Boolean) : [];
const journal = jl.slice(-JN).map(l => { const e = JSON.parse(l); delete e.url; return e });
const days = fs.existsSync(P('equity')) ? fs.readdirSync(P('equity')).sort().slice(-7) : [];
wr('view.json', { runner: true, updated: now, health, jn: JN, state: S, journal, eq: days.map(f => rd('equity/' + f)) });
