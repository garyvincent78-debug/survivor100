
const H=900000,HOUR=3600000,DAY=86400000,START_CASH=100,FLOOR0=90,GROW=1.02;
const FEE={cb:0.001,yh:0.001},SLIP=0.0005,MIN_ORDER=5,MIN_HOLD=4,MAX_TRADES_DAY=12;
const DAY_GOAL=0.02;
const X={mods:[],P:{}},par=(k,d)=>X.P[k]!=null?X.P[k]:d,allM=()=>MODELS.concat(X.mods);
function ensureModels(S){for(const m of X.mods){if(S.w[m.id]==null)S.w[m.id]=1/(MODELS.length+X.mods.length);if(!S.perf[m.id])S.perf[m.id]={m:0,q:0,n:0}}}
const SRC={cb:'Coinbase Exchange',yh:'Yahoo Finance'};
const KR={'BTC-EUR':'XBTEUR','ETH-EUR':'ETHEUR','SOL-EUR':'SOLEUR','XRP-EUR':'XRPEUR'},XTOL=0.01,CHUNK=19,REF='EURUSD=X';
const CB_URL='https://api.exchange.coinbase.com/products/',SP_URL='https://query1.finance.yahoo.com/v8/finance/spark?symbols=',KR_URL='https://api.kraken.com/0/public/Ticker?pair=';
const MODELS=[
 {id:'tr1',fam:'Tendance',p:'EMA 12/48'},{id:'tr2',fam:'Tendance',p:'EMA 24/96'},
 {id:'rv1',fam:'Retour à la moyenne',p:'24 h'},{id:'rv2',fam:'Retour à la moyenne',p:'48 h'},
 {id:'bk1',fam:'Cassure',p:'24 h'},{id:'bk2',fam:'Cassure',p:'72 h'}];
const UNIVERSE=[
 {sym:'BTC-EUR',src:'cb',on:true,nm:'Bitcoin',cls:'Crypto'},{sym:'ETH-EUR',src:'cb',on:true,nm:'Ethereum',cls:'Crypto'},{sym:'SOL-EUR',src:'cb',on:true,nm:'Solana',cls:'Crypto'},{sym:'XRP-EUR',src:'cb',on:false,nm:'XRP',cls:'Crypto'},
 {sym:'CW8.PA',src:'yh',on:true,nm:'ETF MSCI World',cls:'ETF'},{sym:'ESE.PA',src:'yh',on:true,nm:'ETF S&P 500',cls:'ETF'},{sym:'PUST.PA',src:'yh',on:true,nm:'ETF Nasdaq-100',cls:'ETF'},
 {sym:'AIR.PA',src:'yh',on:true,nm:'Airbus',cls:'Action Paris'},{sym:'MC.PA',src:'yh',on:true,nm:'LVMH',cls:'Action Paris'},{sym:'TTE.PA',src:'yh',on:true,nm:'TotalEnergies',cls:'Action Paris'},
 {sym:'SAN.PA',src:'yh',on:true,nm:'Sanofi',cls:'Action Paris'},{sym:'OR.PA',src:'yh',on:true,nm:'L’Oréal',cls:'Action Paris'},{sym:'BNP.PA',src:'yh',on:true,nm:'BNP Paribas',cls:'Action Paris'},
 {sym:'AAPL',src:'yh',on:true,nm:'Apple',cls:'Action US',ccy:'USD'},{sym:'MSFT',src:'yh',on:true,nm:'Microsoft',cls:'Action US',ccy:'USD'},{sym:'NVDA',src:'yh',on:true,nm:'Nvidia',cls:'Action US',ccy:'USD'},{sym:'TSLA',src:'yh',on:true,nm:'Tesla',cls:'Action US',ccy:'USD'},
 {sym:'GC=F',src:'yh',on:true,nm:'Or',cls:'Matière première',ccy:'USD'},{sym:'SI=F',src:'yh',on:true,nm:'Argent',cls:'Matière première',ccy:'USD'},{sym:'CL=F',src:'yh',on:true,nm:'Pétrole WTI',cls:'Matière première',ccy:'USD'},{sym:'BZ=F',src:'yh',on:true,nm:'Pétrole Brent',cls:'Matière première',ccy:'USD'},
 {sym:'EURUSD=X',src:'yh',on:true,nm:'Dollar US',cls:'Devise',inv:true},{sym:'EURGBP=X',src:'yh',on:true,nm:'Livre sterling',cls:'Devise',inv:true},{sym:'EURCHF=X',src:'yh',on:true,nm:'Franc suisse',cls:'Devise',inv:true}];
const clip=(x,a,b)=>Math.max(a,Math.min(b,x)),r4=x=>Math.round(x*1e4)/1e4,f2=x=>x.toFixed(2).replace('.',',');
const PD=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'});
const parisDay=ts=>Date.parse(PD.format(ts)+'T00:00:00Z')/DAY;
const dayN=(S,ts)=>Math.max(0,parisDay(ts)-parisDay(S.t0));
const thrAt=(S,ts)=>FLOOR0*Math.pow(GROW,dayN(S,ts));
const h53=(s,seed=0)=>{let a=0xdeadbeef^seed,b=0x41c6ce57^seed;for(let i=0,c;i<s.length;i++){c=s.charCodeAt(i);a=Math.imul(a^c,2654435761);b=Math.imul(b^c,1597334677)}a=Math.imul(a^(a>>>16),2246822507)^Math.imul(b^(b>>>13),3266489909);b=Math.imul(b^(b>>>16),2246822507)^Math.imul(a^(a>>>13),3266489909);return(4294967296*(2097151&b)+(a>>>0)).toString(16)};
const canon=e=>[e.seq,e.ts,e.decT,e.proc,e.sym,e.side,e.qty,e.price,e.amt,e.fee,e.cashB,e.cashA,e.lvB,e.lvA,e.pnl,e.model,e.mode,e.why].join('|');
function newState(t0,cfg){return{v:2,mig:3,t0,status:'alive',died:null,cash:START_CASH,pos:{},mark:{},cursor:0,pend:[],
 w:Object.fromEntries(MODELS.map(m=>[m.id,1/MODELS.length])),perf:Object.fromEntries(MODELS.map(m=>[m.id,{m:0,q:0,n:0}])),sc:{},
 uni:UNIVERSE.map(u=>({...u,fails:0,lastObs:0,skipUntil:0})),last:{},entryThr:0.30,evo:[],anom:[],dq:{ok:0,bad:0},
 credits:{day:'',today:0,total:0},cfg:cfg||{cadenceMin:15,capDay:600},jr:{n:0,h:'0'},dayIdx:0,tt:{d:0,n:0},
 stats:{fees:0,realized:0,wins:0,losses:0,nSince:0,feeSince:0,grossSince:0},lastFetch:0}}
function idxAt(b,t){let lo=0,hi=b.length-1;while(lo<=hi){const m=(lo+hi)>>1;if(b[m].t===t)return m;if(b[m].t<t)lo=m+1;else hi=m-1}return -1}
const ema=(a,n)=>{const k=2/(n+1);let e=a[0];for(let i=1;i<a.length;i++)e=a[i]*k+e*(1-k);return e};
const sd=a=>{const m=a.reduce((x,y)=>x+y,0)/a.length;return Math.sqrt(a.reduce((x,y)=>x+(y-m)*(y-m),0)/a.length)};
function scores(b,i){
 if(i<100)return null;
 const c=[];for(let k=Math.max(0,i-199);k<=i;k++)c.push(b[k].c);
 const L=c.length,last=c[L-1],r=[];for(let k=L-48;k<L;k++)r.push(Math.log(c[k]/c[k-1]));
 const sig=Math.max(sd(r),1e-4);
 const trend=(f,s)=>{const w=c.slice(-3*s),ef=ema(w,f),es=ema(w,s);return Math.tanh((ef-es)/es/(3*sig))};
 const rev=n=>{const w=c.slice(-n),m=w.reduce((x,y)=>x+y,0)/n,s=Math.max(sd(w),1e-9),z=(last-m)/s;return Math.abs(z)<1?0:-clip(z/2.5,-1,1)};
 const brk=n=>{let hi=-Infinity,lo=Infinity;for(let k=i-n;k<i;k++){hi=Math.max(hi,b[k].h);lo=Math.min(lo,b[k].l)}return last>hi?1:last<lo?-1:clip((last-(hi+lo)/2)/((hi-lo)/2||1),-1,1)*0.3};
 let atr=0;for(let k=i-13;k<=i;k++){const x=b[k],p=b[k-1].c;atr+=Math.max(x.h-x.l,Math.abs(x.h-p),Math.abs(x.l-p))}atr/=14;
 const s={tr1:trend(12,48),tr2:trend(24,96),rv1:rev(24),rv2:rev(48),bk1:brk(24),bk2:brk(72)};
 for(const m of X.mods){let v=0;try{v=clip(+m.fn(b,i,{c,sig,atr,ema,sd,clip})||0,-1,1)}catch(e){v=0}s[m.id]=v}
 return{s,sig,atr}}
const comb=(w,s)=>allM().reduce((a,m)=>a+w[m.id]*s[m.id],0);
function bestModel(S,s){let best=MODELS[0],v=-9;for(const m of allM()){const x=S.w[m.id]*(s[m.id]||0);if(x>v){v=x;best=m}}return{id:best.id,txt:`${best.fam} ${best.p} (s=${f2(s[best.id])}, poids ${f2(S.w[best.id])})`}}
function liq(S){let v=S.cash;for(const[s,p]of Object.entries(S.pos))v+=p.q*(S.mark[s]??p.cost/p.q)*(1-FEE[p.src]-SLIP);return v}
function expo(S){let v=0;for(const[s,p]of Object.entries(S.pos))v+=p.q*(S.mark[s]??0);return v}
const expCap=(LV,thr)=>{const f=par('expFloor',0.30);return clip(f+(1-f)*(1-((LV-thr)/LV)/0.08),f,1)};
const hasPend=(S,s)=>S.pend.some(o=>o.sym===s);
function reweight(S){const raw={};let t=0;for(const m of allM()){const p=S.perf[m.id],sh=p.n>=200?p.m/Math.sqrt(p.q+1e-12):0;raw[m.id]=Math.exp(clip(8*sh,-3,3));t+=raw[m.id]}
 let t2=0;for(const m of allM()){raw[m.id]=Math.max(0.04,raw[m.id]/t);t2+=raw[m.id]}for(const m of allM())S.w[m.id]=raw[m.id]/t2}
function journal(S,out,o,f,px,q,amt,fee,cashB,lvB,pnl){
 const rec=S.last[o.sym]||{};
 const e={seq:S.jr.n+1,ts:f.bar.t,decT:o.decT,proc:out.now,sym:o.sym,side:o.side,qty:q,price:px,amt,fee,cashB,cashA:S.cash,lvB,lvA:liq(S),pnl:pnl??null,model:o.model,why:o.why,
  mode:(out.now-f.bar.t)<3*H?'direct':'rattrapé',src:f.u.src,url:rec.url||'',obs:rec.obs||0,bar:[f.bar.o,f.bar.h,f.bar.l,f.bar.c]};
 e.prev=S.jr.h;e.hash=h53(e.prev+canon(e));S.jr.n++;S.jr.h=e.hash;return e}
function fill(S,o,f,T,out){
 const{u,bar}=f,fr=FEE[u.src],lvB=liq(S),cashB=S.cash,dk=Math.floor(bar.t/DAY);
 if(S.tt.d!==dk)S.tt={d:dk,n:0};
 if(o.side==='buy'){
  const px=bar.o*(1+SLIP),amt=Math.min(o.amt,S.cash/(1+fr));if(amt<MIN_ORDER)return null;
  const q=amt/px,fee=amt*fr;S.cash-=amt+fee;const p0=S.pos[o.sym];if(p0){p0.q+=q;p0.cost+=amt+fee;p0.peak=Math.max(p0.peak,px)}else S.pos[o.sym]={q,cost:amt+fee,peak:px,entryT:T,src:u.src,model:o.model};
  S.stats.fees+=fee;S.stats.feeSince+=fee;S.stats.nSince++;S.tt.n++;
  return journal(S,out,o,f,px,q,amt,fee,cashB,lvB,null)}
 const p=S.pos[o.sym];if(!p)return null;
 const qs=o.qty>0?Math.min(o.qty,p.q):p.q,fr0=qs/p.q,cp=p.cost*fr0,px=bar.o*(1-SLIP),gross=qs*px,fee=gross*fr,pnl=gross-fee-cp;
 S.cash+=gross-fee;if(fr0>=0.999999)delete S.pos[o.sym];else{p.q-=qs;p.cost-=cp}
 S.stats.fees+=fee;S.stats.feeSince+=fee;S.stats.nSince++;S.stats.realized+=pnl;S.stats.grossSince+=pnl+fee;pnl>0?S.stats.wins++:S.stats.losses++;S.tt.n++;
 return journal(S,out,o,f,px,qs,gross,fee,cashB,lvB,pnl)}
function review(S,tau,LV,thr,d){
 const cush=(LV-thr)/LV,st=S.stats;
 for(const e of S.evo)if(e.kind!=='revue'&&e.lv1==null)e.lv1=r4(LV);
 S.evo.push({ts:tau,kind:'revue',text:`J${d} · valeur ${f2(LV)} € pour un seuil de ${f2(thr)} € · ${st.nSince} opération(s), frais ${f2(st.feeSince)} € · poids ${MODELS.map(m=>m.id+' '+f2(S.w[m.id])).join(' · ')}`});
 let ch=null;
 if(st.nSince===0&&cush<0.04&&S.entryThr>0.14)ch=[S.entryThr,r4(S.entryThr-0.04),`aucune opération en 24 h alors que la marge fond (${(cush*100).toFixed(1).replace('.',',')} %)`];
 else if(st.nSince>=2&&st.feeSince>0.4*Math.abs(st.grossSince)&&S.entryThr<0.5)ch=[S.entryThr,r4(S.entryThr+0.04),'les frais absorbent plus de 40 % du résultat brut'];
 if(ch){S.entryThr=ch[1];S.evo.push({ts:tau,kind:'param',text:`Seuil d'entrée ${f2(ch[0])} → ${f2(ch[1])} : ${ch[2]}`,lv0:r4(LV),lv1:null})}
 const on=S.uni.filter(u=>u.on).length,nxt=S.uni.find(u=>!u.on&&!u.dead);
 if(nxt&&expo(S)<0.3*LV&&((S.credits.cyc||5)+(nxt.src==='cb'?1:0))*(1440/S.cfg.cadenceMin)<=S.cfg.capDay){nxt.on=true;S.evo.push({ts:tau,kind:'univers',text:`Univers : ajout de ${nxt.sym} (liquidités > 70 %, ${on} instruments suivis)`,lv0:r4(LV),lv1:null})}
 st.nSince=0;st.feeSince=0;st.grossSince=0;S.dayIdx=d;if(S.evo.length>80)S.evo.splice(0,S.evo.length-80)}
function stepOne(S,B,T,out){
 ensureModels(S);const tau=T+H,learn=tau<=S.t0,fresh=[];
 for(const u of S.uni){if(!u.on)continue;const b=B[u.sym];if(!b)continue;const i=idxAt(b,T);if(i>=0)fresh.push({u,b,i,bar:b[i]})}
 if(!learn)for(const o of S.pend.slice()){const f=fresh.find(x=>x.u.sym===o.sym);if(!f||T<=o.decT)continue;S.pend.splice(S.pend.indexOf(o),1);const e=fill(S,o,f,T,out);if(e)out.trades.push(e)}
 for(const f of fresh)S.mark[f.u.sym]=f.bar.c;
 for(const f of fresh){const pv=S.sc[f.u.sym];if(pv&&f.i>0&&pv.t===f.b[f.i-1].t){const r=f.bar.c/f.b[f.i-1].c-1;
  for(const m of allM()){const g=clip(pv.s[m.id]||0,0,1)*(r-0.0001),p=S.perf[m.id];p.m+=(g-p.m)*0.01;p.q+=(g*g-p.q)*0.01;p.n++}}}
 for(const f of fresh){const sc=scores(f.b,f.i);if(sc){sc.t=f.bar.t;sc.comb=comb(S.w,sc.s);S.sc[f.u.sym]=sc}}
 reweight(S);
 if(learn)return;
 const LV=liq(S),thr=thrAt(S,tau);
 out.pts.push([tau,r4(LV),r4(thr)]);
 if(LV<thr){S.status='dead';S.died={ts:tau,lv:r4(LV),thr:r4(thr)};S.pend=[];return}
 const d=dayN(S,tau);if(d>S.dayIdx)review(S,tau,LV,thr,d);
 if(!S.day0||S.day0.d!==d)S.day0={d,lv:LV,done:false};
 if(!S.day0.done&&LV>=S.day0.lv*(1+par('dayGoal',DAY_GOAL))){S.day0.done=true;S.evo.push({ts:tau,kind:'objectif',text:`Objectif du jour atteint : ${f2(LV)} € (+${f2((LV/S.day0.lv-1)*100)} % depuis minuit) · plus aucun achat jusqu’à minuit, les stops restent actifs`})}
 const E=expCap(LV,thr),dk=Math.floor(tau/DAY);let used=S.tt.d===dk?S.tt.n:0,planned=S.pend.length;
 if(!par('auto',0))return;
 for(const f of fresh){const p=S.pos[f.u.sym],sc=S.sc[f.u.sym];if(!p||!sc||hasPend(S,f.u.sym))continue;
  p.peak=Math.max(p.peak,f.bar.c);const stop=f.bar.c<p.peak-par('stopAtr',3)*sc.atr;
  if((T-p.entryT)/H>=par('minHold',MIN_HOLD)&&(sc.comb<0||stop)){const m=bestModel(S,sc.s);S.pend.push({sym:f.u.sym,side:'sell',decT:T,model:m.id,why:stop?`Stop suiveur : cours sous le plus haut moins ${par('stopAtr',3)} ATR`:`Score combiné ${f2(sc.comb)} < 0 · ${m.txt}`})}}
 const cands=S.day0.done?[]:fresh.map(f=>({f,sc:S.sc[f.u.sym]})).filter(x=>x.sc&&x.sc.t===x.f.bar.t&&x.sc.comb>S.entryThr&&!S.pos[x.f.u.sym]&&!hasPend(S,x.f.u.sym)).sort((a,b)=>b.sc.comb-a.sc.comb).slice(0,2);
 if(cands.length){let room=Math.max(0,E*LV-expo(S)),tot=cands.reduce((a,x)=>a+x.sc.comb,0);
  for(const x of cands){if(used+planned>=par('maxTrades',MAX_TRADES_DAY))break;const amt=Math.min(E*LV*x.sc.comb/tot,room);
   if(amt>=Math.max(MIN_ORDER,0.08*LV)){const m=bestModel(S,x.sc.s);S.pend.push({sym:x.f.u.sym,side:'buy',decT:T,amt:r4(amt),model:m.id,why:`Score combiné ${f2(x.sc.comb)} ≥ seuil ${f2(S.entryThr)} · ${m.txt} · exposition max ${Math.round(E*100)} %`});room-=amt;planned++}}}}
function advance(S,B,limit,now){
 const out={trades:[],pts:[],now};if(S.status!=='alive')return out;
 const ts=new Set();for(const u of S.uni){if(!u.on)continue;for(const b of(B[u.sym]||[]))if(b.t>S.cursor&&b.t+H<=limit)ts.add(b.t)}
 for(const T of[...ts].sort((a,b)=>a-b)){stepOne(S,B,T,out);S.cursor=T;if(S.status!=='alive')break}
 return out}
function parseBars(data){
 if(Array.isArray(data))return{raw:data.map(x=>({t:x[0]*1000,o:x[3],h:x[2],l:x[1],c:x[4],v:x[5]})),lt:null};
 const d=data||{};
 return{raw:d.candles?d.candles.map(x=>({t:x.time*1000,o:x.open,h:x.high,l:x.low,c:x.close,v:x.volume})):(d.bars||[]).map(x=>({t:x.timestamp_ms,o:x.open,h:x.high,l:x.low,c:x.close,v:x.volume})),lt:d.latest_trade||null}}
function krakenQuotes(j){
 const res=j&&j.result;if(!res||typeof res!=='object'||(j.error&&j.error.length))return null;const out={};
 for(const[k,v]of Object.entries(res)){const n=k.replace(/^X(?=[A-Z]{3}Z)/,'').replace(/Z(?=EUR$)/,''),c=+(v.c&&v.c[0]);if(c>0)out[n]={c,bid:+(v.b&&v.b[0]),ask:+(v.a&&v.a[0])}}
 return out}
function ingest(S,B,u,data,obs,kq,url){
 const{raw,lt}=parseBars(data);
 const mx=raw.reduce((a,b)=>b.t>a.t?b:a,{t:-1}),kk=KR[u.sym]&&kq&&kq[KR[u.sym]],liveC=mx.t>0&&(mx.t+H>obs||obs-(mx.t+H)<120000)?mx.c:null;
 let x=null;
 if(kk&&liveC>0){const dev=liveC/kk.c-1;x={px:kk.c,bid:kk.bid,ask:kk.ask,dev:r4(dev),ok:Math.abs(dev)<=XTOL};
  if(!x.ok)return{added:0,bad:0,rej:true,x,an:[`${u.sym} : écart de ${(dev*100).toFixed(2).replace('.',',')} % entre ${SRC[u.src]} (${liveC}) et Kraken (${kk.c}), données rejetées pour ce cycle`]}}
 const m=new Map((B[u.sym]||[]).map(b=>[b.t,b]));let added=0,bad=0,live=null;const an=[];
 for(const b of raw){b.v=Number(b.v)||0;
  const ok=Number.isFinite(b.t)&&[b.o,b.h,b.l,b.c].every(x=>Number.isFinite(x)&&x>0)&&b.h>=Math.max(b.o,b.c)-1e-9&&b.l<=Math.min(b.o,b.c)+1e-9&&b.t<=obs+60000;
  if(!ok){bad++;continue}
  if(b.t+H>obs){live=b.c;continue}
  const old=m.get(b.t);
  if(old){if(Math.abs(b.c/old.c-1)>0.005)an.push(`${u.sym} ${new Date(b.t).toISOString().slice(0,16)} : clôture révisée ${old.c} → ${b.c}, ancienne valeur conservée`);continue}
  m.set(b.t,b);added++}
 const arr=[...m.values()].sort((a,b)=>a.t-b.t);B[u.sym]=arr;const lb=arr[arr.length-1];
 if(lt&&lb&&Math.abs(lt.price/lb.c-1)>0.03)an.push(`${u.sym} : dernier prix ${lt.price} à plus de 3 % de la dernière clôture ${lb.c}`);
 S.last[u.sym]={c:lb?lb.c:null,t:lb?lb.t:null,live:live??(lt?lt.price:null),obs,url:url||(data&&data.source_url)||'',src:u.src,x,ltT:lt&&lt.t||null};
 return{added,bad,an}}
function mkRate(e){const ts=(e&&e.timestamp)||[],cl=(e&&e.close)||[],a=[];
 for(let i=0;i<ts.length;i++)if(cl[i]>0)a.push([ts[i]*1000,cl[i]]);
 if(!a.length)return null;
 return t=>{let lo=0,hi=a.length-1,r=a[0][1];while(lo<=hi){const m=(lo+hi)>>1;if(a[m][0]<=t){r=a[m][1];lo=m+1}else hi=m-1}return r}}
function sparkBars(e,u,rate){
 const ts=(e&&e.timestamp)||[],cl=(e&&e.close)||[],bars=[];let pt=0,pc=0,last=null;
 for(let i=0;i<ts.length;i++){const t=ts[i]*1000,c=cl[i];if(!(c>0))continue;
  let p=c;if(u.inv)p=1/c;else if(u.ccy==='USD'){const r=rate?rate(t):0;if(!(r>0))continue;p=c/r}
  last=p;if(t%H!==0)continue;
  const g=pc>0&&t-pt<=1.5*H,o=g?pc:p;
  bars.push({timestamp_ms:t,open:o,high:Math.max(o,p),low:Math.min(o,p),close:p,volume:0});pt=t;pc=p}
 return{bars,last}}
function migrate(S){
 if(S.mig>=3)return false;
 for(const d of UNIVERSE){const u=S.uni.find(x=>x.sym===d.sym);
  if(!u)S.uni.push({...d,fails:0,lastObs:0,skipUntil:0});
  else{u.nm=d.nm;u.cls=d.cls;if(d.ccy)u.ccy=d.ccy;if(d.inv)u.inv=true;if(!u.dead&&!S.pos[u.sym])u.on=d.on}}
 S.mig=3;return true}
const yhClosed=now=>{const x=new Date(now),d=x.getUTCDay(),m=x.getUTCHours()*60+x.getUTCMinutes();return d===6||(d===5&&m>=1350)||(d===0&&m<1320)};
const lastFri=now=>{const x=new Date(now);x.setUTCHours(22,0,0,0);while(x.getUTCDay()!==5||x.getTime()>now)x.setUTCDate(x.getUTCDate()-1);return x.getTime()};
function planYh(ys,B,now,since){
 const ref=ys.find(u=>u.sym===REF),oth=ys.filter(u=>u.sym!==REF),out=[];
 for(let g=0;g===0||g*CHUNK<oth.length;g++){
  const grp=oth.slice(g*CHUNK,(g+1)*CHUNK),us=g===0&&ref?[...grp,ref]:grp,syms=us.map(u=>u.sym);
  if(!syms.includes(REF)&&us.some(u=>u.ccy==='USD'))syms.push(REF);
  const lts=us.map(u=>{const b=B[u.sym];return b&&b.length?b[b.length-1].t:0}),old=since??Math.min(...lts);
  out.push({us,cost:1,yh:true,url:`${SP_URL}${syms.map(x=>encodeURIComponent(x)).join(',')}&range=${old>0&&now-old>4.5*DAY?'1mo':'5d'}&interval=15m`})}
 return out}
function ingestYh(it,d,obs,handle){
 const rate=mkRate(d[REF]),miss=[];
 for(const u of it.us){const e=d[u.sym];if(!e){miss.push(u);continue}const sb=sparkBars(e,u,rate);handle(u,{bars:sb.bars,latest_trade:sb.last>0?{price:sb.last}:null},obs,it.url)}
 return miss}
function planFetch(S,B,now){
 const day=new Date(now).toISOString().slice(0,10);if(S.credits.day!==day){S.credits.day=day;S.credits.today=0}
 let room=S.cfg.capDay-S.credits.today;const items=[],stall=[],kp=[];
 const act=S.uni.filter(u=>u.on).sort((a,b)=>(S.pos[b.sym]?1:0)-(S.pos[a.sym]?1:0)||a.lastObs-b.lastObs);
 const zt=ms=>new Date(ms).toISOString().slice(0,19)+'Z';
 for(const u of act.filter(x=>x.src==='cb')){
  const bars=B[u.sym]||[],lastT=bars.length?bars[bars.length-1].t:0,need=bars.length<150;
  let from=need?Math.min(S.t0,now)-200*H:lastT-2*H,n=Math.ceil((now-from)/H)+2;if(n>3000){n=3000;from=now-3000*H}
  const st=Math.floor(from/H)*H,it=!u.alt&&n<=290?{us:[u],cost:1,url:`${CB_URL}${u.sym}/candles?granularity=900&start=${zt(st)}&end=${zt(now)}`}
   :{us:[u],cost:5,req:{provider:'api-exchange-coinbase-com',capability:'markets/get_candles',options:{product_id:u.sym,granularity:900,start:new Date(st).toISOString(),end:new Date(now).toISOString(),max_candles:n}}};
  if(room<it.cost){stall.push(u.sym);continue}
  items.push(it);room-=it.cost;if(KR[u.sym])kp.push(KR[u.sym])}
 const ys=act.filter(u=>u.src==='yh');
 if(ys.length&&(ys.some(u=>(B[u.sym]||[]).length<100)||!yhClosed(now)||!ys.every(u=>u.lastObs>=lastFri(now)))){
  for(const it of planYh(ys,B,now)){if(room<1){stall.push(...it.us.map(u=>u.sym));continue}items.push(it);room--}}
 return{items,stall,kr:kp.length&&room>=1?KR_URL+kp.join(','):null}}
function audit(S,J,pts,cap=500){
 const iss=[],add=(sev,t)=>iss.push({sev,t}),full=J.length===S.jr.n;
 let h=full?'0':(J[0]?J[0].prev:'0'),cash=START_CASH;const pos={};
 for(const e of J){
  if(e.prev!==h)add('err',`Chaîne rompue au trade n°${e.seq}`);
  if(e.hash!==h53(e.prev+canon(e)))add('err',`Empreinte invalide au trade n°${e.seq} : entrée modifiée après coup`);
  h=e.hash;
  if(!(e.price>=e.bar[2]*0.999&&e.price<=e.bar[1]*1.001))add('err',`Prix hors de la bougie réelle au trade n°${e.seq}`);
  if(!(e.ts<=e.proc&&e.decT<e.ts))add('err',`Chronologie incohérente au trade n°${e.seq}`);
  if(!e.url||!e.obs)add('warn',`Preuve de source incomplète au trade n°${e.seq}`);
  if(Math.abs(e.fee-e.amt*FEE[e.src])>0.01)add('err',`Frais incohérents au trade n°${e.seq}`);
  if(e.side==='buy'){cash-=e.amt+e.fee;pos[e.sym]=(pos[e.sym]||0)+e.qty}else{cash+=e.qty*e.price-e.fee;pos[e.sym]=(pos[e.sym]||0)-e.qty}}
 if(full){
  if(Math.abs(cash-S.cash)>1e-6)add('err',`Liquidités recalculées ${cash.toFixed(4)} € ≠ liquidités déclarées ${S.cash.toFixed(4)} €`);
  const syms=new Set([...Object.keys(pos),...Object.keys(S.pos)]);
  for(const s of syms){const a=pos[s]||0,b=(S.pos[s]||{}).q||0;if(Math.abs(a-b)>1e-9*Math.max(1,a,b))add('err',`Quantité recalculée de ${s} différente de la position déclarée`)}
  if(J.length&&J[J.length-1].hash!==S.jr.h)add('err','Dernière empreinte différente de celle de l’état')}
 else if(S.jr.n<=cap)add('err',`Journal incomplet : ${J.length} trade(s) présents pour ${S.jr.n} déclarés`);
 else add('warn',`Audit partiel : ${J.length} trades chargés sur ${S.jr.n}`);
 let badThr=0;for(const p of pts)if(Math.abs(p[2]-thrAt(S,p[0]))>1e-3)badThr++;
 if(badThr)add('err',`${badThr} point(s) de seuil ne respectent pas 90 € × 1,02^N`);
 if(S.died&&pts.some(p=>p[0]>S.died.ts))add('err','Valeur enregistrée après la mort de l’agent');
 if(S.anom.length)add('warn',`${S.anom.length} anomalie(s) de données détectée(s) et neutralisée(s)`);
 return{ok:!iss.some(x=>x.sev==='err'),iss,n:J.length,full}}
