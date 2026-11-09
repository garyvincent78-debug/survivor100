# Cible fixe de mise à l'abri (vente limite) : on vend en espèces dès que la valeur de liquidation >= cible.
# Ensuite espèces ; 4 h avant le minuit qui tuerait les espèces, on reprend une position (frais 0,3 % aller-retour).
# Marche aléatoire sans dérive (hypothèse). Pas de 5 min.
import numpy as np
rng=np.random.default_rng(5)
spd=288
def tmin(d,h,m=0): return ((d*24+h)*60+m)-(15*60+25)
bars=[(-1e9,95.5087),(tmin(0,23),97.4189),(tmin(1,23),99.3673),(tmin(2,23),101.3546),(tmin(3,23),103.3817),(tmin(4,23),105.4493),(tmin(5,23),107.5583),(tmin(6,23),109.7095),(tmin(7,23),111.9037),(tmin(8,23),114.1),(tmin(9,23),116.4),(tmin(10,23),118.7)]
def idx(t):
    k=0
    for j,(tt,_) in enumerate(bars):
        if t>=tt:k=j
    return k
N=6000; H=9*spd
def run(sig,target):
    s=sig/np.sqrt(spd); z=rng.standard_normal((N,H))*s-0.5*s*s; price=np.exp(np.cumsum(z,axis=1)); res=np.empty(N); nb=np.zeros(N)
    for n in range(N):
        pos=True; q=99.9/1.0005; cash=0; dead=None
        for i in range(H):
            t=i*5; k=idx(t); b=bars[k][1]; p=price[n,i]
            e=q*p*0.9985 if pos else cash
            if e<b: dead=t; break
            if pos and target and e>=target: cash=e; pos=False; nb[n]+=1
            elif (not pos):
                nxt=bars[min(k+1,len(bars)-1)]
                if cash<nxt[1] and nxt[0]-t<=240: q=cash/1.001/(p*1.0005); pos=True
        res[n]=(H*5 if dead is None else dead)/1440
    return res,nb
def show(nm,r): print(f"{nm:30s} E[T]={r.mean():.2f}j P(>2.4j)={np.mean(r>2.4):.2f} P(>3.4j)={np.mean(r>3.4):.2f} P(>4.4j)={np.mean(r>4.4):.2f} P(>6j)={np.mean(r>6):.2f} P(>8j)={np.mean(r>8):.2f}")
for nm,sig in (("ETH/SOL 3.0%",0.0299),("BTC 2.0%",0.0202)):
    for tg in (None,101.9,103.0,103.9,105.0,106.0):
        r,_=run(sig,tg); show(f"{nm} cible {tg}",r)
