# Monte Carlo : probabilité de survie d'une position selon l'actif et l'heure d'entrée.
# Hypothèses (non mesurées, à lire comme un ordre de grandeur) : marche aléatoire sans dérive, pas de 5 min.
import numpy as np, sys
rng=np.random.default_rng(7)
T0=0  # minutes depuis maintenant = lun 9/11 15:25 UTC
steps_per_day=288                       # 5 min
# barrières (liquidation >= seuil) : (minutes depuis T0, seuil)
HOUR=12
def tmin(day_off, hh, mm=0):            # minutes depuis 9/11 15:25 UTC
    return ((day_off*24+hh)*60+mm)-(15*60+25)
bars=[(-1e9,95.5087),(tmin(0,23),97.4189),(tmin(1,23),99.3673),(tmin(2,23),101.3546),(tmin(3,23),103.3817),(tmin(4,23),105.4493),(tmin(5,23),107.5583),(tmin(6,23),109.7095)]
def barrier(t):
    b=bars[0][1]
    for tt,th in bars:
        if t>=tt: b=th
    return b
N=40000; H=int(5.0*steps_per_day)
fee=0.0015
def sim(sig_day, entry_min, cash_after_stop=False, stop_buf=None, mu_day=0.0):
    s=sig_day/np.sqrt(steps_per_day); mu=mu_day/steps_per_day
    z=rng.standard_normal((N,H))*s+mu-0.5*s*s
    lp=np.cumsum(z,axis=1)
    price=np.exp(lp)
    alive=np.ones(N,bool); death=np.full(N,np.nan)
    eq=np.empty((N,H))
    ent=int(entry_min/5)
    p_entry=np.where(ent>0, price[:,max(ent-1,0)], 1.0) if ent>0 else np.ones(N)
    q=99.9/(p_entry*1.0005)
    for i in range(H):
        t=i*5
        if i<ent: e=np.full(N,100.0)
        else: e=q*price[:,i]*(1-fee)
        b=barrier(t)
        newly=alive&(e<b)
        death[newly]=t
        alive&=~newly
        eq[:,i]=e
    return alive,death
def summarize(name,alive,death):
    dd=np.where(np.isnan(death),H*5,death)/1440
    out={d:np.mean(dd>d) for d in (2.4,3.4,4.4)}
    print(f"{name:34s} P(survit N6/>2.4j)={out[2.4]:.2f}  >3.4j={out[3.4]:.2f}  >4.4j={out[4.4]:.2f}  E[T]={dd.mean():.2f}j  P(mort avant 2.3j)={np.mean(dd<2.3):.2f}")
print("cash seul : T = 2.30 j exactement (mort à N6 = 11/11 23:00 UTC)")
for name,sig in (("BTC",0.020),("ETH",0.028),("SOL/XRP",0.034),("alt volatile",0.06)):
    for lab,em in (("entrée maintenant",0),("entrée mar 10/11 14:00 UTC (après CPI)",tmin(1,14)),("entrée mer 11/11 08:00 UTC",tmin(2,8))):
        a,d=sim(sig,em); summarize(f"{name:12s} {lab}",a,d)
