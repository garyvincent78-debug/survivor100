# Compare : (A) tenir la position, (B) "cliquet" = vendre en espèces dès que la valeur de liquidation
# dépasse le seuil du 2e minuit suivant + marge, (C) cliquet plus bas (dépasse le prochain minuit + marge).
# Marche aléatoire sans dérive, pas de 5 min, frais 0,1 % + glissement 0,05 % par sens. Hypothèses, pas des mesures.
import numpy as np
rng=np.random.default_rng(11)
spd=288
def tmin(d,h,m=0): return ((d*24+h)*60+m)-(15*60+25)
bars=[(-1e9,95.5087),(tmin(0,23),97.4189),(tmin(1,23),99.3673),(tmin(2,23),101.3546),(tmin(3,23),103.3817),(tmin(4,23),105.4493),(tmin(5,23),107.5583),(tmin(6,23),109.7095),(tmin(7,23),111.9037),(tmin(8,23),114.1),(tmin(9,23),116.4)]
def idx(t):
    k=0
    for j,(tt,_) in enumerate(bars):
        if t>=tt:k=j
    return k
def B(t,ahead=0): return bars[min(idx(t)+ahead,len(bars)-1)][1]
N=20000; H=8*spd
def run(sig, lock_ahead, margin, hold_forever=False):
    s=sig/np.sqrt(spd); res=np.empty(N)
    z=rng.standard_normal((N,H))*s-0.5*s*s
    price=np.exp(np.cumsum(z,axis=1))
    for n in range(N):
        cash=None; q=99.9/(1.0005); pos=True; dead=None
        for i in range(H):
            t=i*5; p=price[n,i]
            if pos: e=q*p*0.9985
            else: e=cash
            if e<B(t): dead=t; break
            if pos and not hold_forever and e>=B(t,lock_ahead)*(1+margin):
                cash=e; pos=False                                  # banque
            elif (not pos) and cash<B(t,1)*(1+0.0):
                # le prochain minuit tue : il faut reprendre du risque maintenant (entrée = coût 0,15 %)
                # on le fait ~2h avant le minuit pour laisser une chance
                if (bars[min(idx(t)+1,len(bars)-1)][0]-t)<=240:
                    q=cash*0.999/(1.0005*p)*1.0; q=cash/1.001/(p*1.0005); cash=None; pos=True
        res[n]=(H*5 if dead is None else dead)/1440
    return res
def show(name,r): print(f"{name:42s} E[T]={r.mean():.2f}j P(>2.4j)={np.mean(r>2.4):.2f} P(>3.4j)={np.mean(r>3.4):.2f} P(>4.4j)={np.mean(r>4.4):.2f} P(>6j)={np.mean(r>6):.2f} P(<2.3j)={np.mean(r<2.3):.2f}")
for nm,sig in (("BTC 2.0%",0.0202),("ETH/SOL 3.0%",0.0299),("XRP 3.9%",0.0388)):
    show(nm+" tenir",run(sig,0,0,True))
    show(nm+" cliquet +2 minuits, marge 0,5%",run(sig,2,0.005))
    show(nm+" cliquet +1 minuit, marge 0,5%",run(sig,1,0.005))
    show(nm+" cliquet +3 minuits, marge 0,5%",run(sig,3,0.005))
