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
    if (!/^[A-Z0-9]{2,10}-EUR$/.test(o.sym || '') || !['buy', 'sell'].includes(o.side) || (typ !== 'market' && !(+o.px > 0))) { log(id, 'refusé : paire XXX-EUR Coinbase, sens buy/sell et prix px (limit/stop) requis'); continue }
    if (!S.uni.some(u => u.sym === o.sym) && S.uni.filter(u => u.on).length < 60) S.uni.push({ sym: o.sym, src: 'cb', on: true, nm: o.sym, cls: 'Crypto', fails: 0, lastObs: 0, skipUntil: 0 });
    S.orders.push({ id, sym: o.sym, side: o.side, type: typ, px: +o.px || 0, amt: +o.amt || 0, qty: o.qty === 'all' ? 'all' : (+o.qty || 0), exp: +o.exp || 0, note: String(o.note || '').slice(0, 200), seen: t });
  }
  S.oseen = S.oseen.slice(-500);
  const syms = [...new Set([...S.orders.map(o => o.sym), ...Object.keys(S.pos)].filter(x => /-EUR$/.test(x)))], Q = {};
  await Promise.all(syms.map(async x => {
    const r = await jget(CBT + x + '/ticker'); health.src['live:' + x] = r.status; const j = r.json;
    if (r.status === 200 && j && +j.bid > 0 && +j.ask > 0 && Math.abs(t - Date.parse(j.time)) < 120000) Q[x] = { bid: +j.bid, ask: +j.ask, px: +j.price || (+j.bid + +j.ask) / 2, t: Date.parse(j.time) };
  }));
  const oc = { now: t, trades: [], pts: [] };
  for (const o of S.orders.slice()) {
    const done = res => { S.orders.splice(S.orders.indexOf(o), 1); log(o.id, res) };
    if (o.exp && t > o.exp) { done('expiré'); continue }
    const q = Q[o.sym]; if (!q) continue;
    const L = S.last[o.sym]; if (L && L.x && L.x.ok === false) continue;
    const buy = o.side === 'buy', hit = o.type === 'market' || (o.type === 'limit' && (buy ? q.ask <= o.px : q.bid >= o.px)) || (o.type === 'stop' && (buy ? q.ask >= o.px : q.bid <= o.px));
    if (!hit) continue;
    const p = S.pos[o.sym], pxf = buy ? q.ask : q.bid;
    if (buy && !(o.amt > 0)) { done('refusé : montant amt (€) requis pour un achat'); continue }
    if (!buy && !p) { done('refusé : aucune position à vendre'); continue }
    const qty = buy ? 0 : (o.qty === 'all' ? p.q : o.qty > 0 ? Math.min(o.qty, p.q) : o.amt > 0 ? Math.min(p.q, o.amt / q.bid) : p.q);
    const u = S.uni.find(x => x.sym === o.sym) || { sym: o.sym, src: 'cb' };
    const e = E.fill(S, { sym: o.sym, side: o.side, amt: o.amt, qty, decT: Math.min(o.seen, t - 1), model: 'cerveau', why: o.note || ('Ordre ' + o.type + ' de l’IA') }, { u, bar: { t, o: pxf, h: pxf, l: pxf, c: pxf } }, t, oc);
    if (!e) { done('refusé : montant < 5 € ou espèces insuffisantes'); continue }
    out.trades.push(e); done('exécuté à ' + e.price.toFixed(4) + ' €');
    S.last[o.sym] = Object.assign(S.last[o.sym] || { c: q.px, t: Math.floor(t / H) * H, x: null }, { live: q.px, ltT: q.t, obs: t, url: CBT + o.sym + '/ticker', src: 'cb' });
  }
  for (const x of Object.keys(S.pos)) if (Q[x]) S.mark[x] = (Q[x].bid + Q[x].ask) / 2;
  const LV = E.liq(S), thr = E.thrAt(S, t), lastT = out.pts.length ? out.pts[out.pts.length - 1][0] : 0;
  if (t > lastT) out.pts.push([t, r4(LV), r4(thr)]);
  if (LV < thr) { S.status = 'dead'; S.died = { ts: t, lv: r4(LV), thr: r4(thr) }; S.pend = []; S.orders = [] }
}
let lim = now;
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
  if (ys.length) for (const it of E.planYh(ys, B, now, S.cursor || undefined)) {
    let r = await jget(it.url); if (r.status !== 200) { const r2 = await jget(it.url.replace('query1.', 'query2.')); if (r2.status === 200) r = r2 } health.src['yh:' + it.us[0].sym] = r.status;
    const d = r.status === 200 && r.json && !r.json.spark ? r.json : null;
    if (!d) { S.yfail = (S.yfail || 0) + 1; if (S.yfail < 3) it.us.forEach(hold); S.anom.push({ ts: now, t: 'Lecture groupée Yahoo en échec (HTTP ' + r.status + ')' }); continue }
    S.yfail = 0; E.ingestYh(it, d, Date.now(), handle).forEach(u => { hold(u); S.anom.push({ ts: now, t: u.sym + ' : absent de la réponse Yahoo' }) });
  }
  const out = E.advance(S, B, lim, now); S.lastFetch = now; S.anom = S.anom.slice(-40);
  if (S.status === 'alive') await broker(out);
  for (const e of out.trades) fs.appendFileSync(P('journal.jsonl'), JSON.stringify(e) + '\n');
  const by = {}; for (const p of out.pts) (by[iso(p[0])] = by[iso(p[0])] || []).push(p);
  for (const [d, pts] of Object.entries(by)) { const doc = rd(`equity/${d}.json`, { day: d, pts: [] }); doc.pts = doc.pts.concat(pts); wr(`equity/${d}.json`, doc) }
  console.log(`cursor ${new Date(S.cursor).toISOString()} | points ${out.pts.length} | trades ${out.trades.length} | statut ${S.status} | santé ${JSON.stringify(health.src)}`);
}
wr('state.json', S);
const jl = fs.existsSync(P('journal.jsonl')) ? fs.readFileSync(P('journal.jsonl'), 'utf8').split('\n').filter(Boolean) : [];
const journal = jl.slice(-JN).map(l => { const e = JSON.parse(l); delete e.url; return e });
const days = fs.existsSync(P('equity')) ? fs.readdirSync(P('equity')).sort().slice(-7) : [];
wr('view.json', { runner: true, updated: now, health, jn: JN, state: S, journal, eq: days.map(f => rd('equity/' + f)) });
