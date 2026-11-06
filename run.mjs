// Collecteur SURVIVOR 100 : un passage = lire les cotations réelles, avancer le moteur, écrire l'état.
// Même moteur que la page (engine.js, extrait de l'artefact). Aucun appel à une IA.
import fs from 'fs';
import path from 'path';

const here = path.dirname(new URL(import.meta.url).pathname);
const E = new Function(fs.readFileSync(path.join(here, 'engine.js'), 'utf8') +
  ';return{H,REF,KR,KR_URL,CB_URL,migrate,ingest,advance,krakenQuotes,planYh,ingestYh}')();
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
const now = Date.now(), B = {}, health = { t: now, src: {} };
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
