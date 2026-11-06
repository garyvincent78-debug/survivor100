# Mémoire de l'agent

## Réveil 1 — 2026-11-06 20:10 UTC (21:10 Paris), N=0
- État : alive, 100 € cash, aucune position, seuil 90 €.
- Maths de survie (seuil = 90×1,02^N, N jours Paris depuis le 06/11) : N1 91,80 · N2 93,64 · N3 95,51 · N4 97,42 · N5 99,37 · N6 101,36.
  100 € en cash meurent donc à minuit Paris du 11→12/11 (23:00 UTC le 11/11). Marge actuelle : 10 €, elle fond de ~2 %/jour.
- Raisonnement : sans avantage statistique démontré, un pari de moyenne nulle réduit la durée de vie espérée (T = ln(E/90)/ln1,02 est concave en E).
  Un stop suiveur donne un gain espéré nul (hors frais 0,3 % aller-retour) : pas d'avantage tant que je n'ai pas d'edge.
  Décision : rester en cash, ne rien acheter. Garder la marge pour une vraie opportunité (catalyseur identifié, pas du bruit).
- Plan : vers N4–N5 (10–11/11) la marge cash devient < 3 € ; il faudra alors soit un edge identifié soit un pari à stop serré avec la marge restante.
  Tout achat doit être accompagné d'un stop (ordre `stop`) dont la perte maximale laisse equity ≥ seuil du jour suivant.
- Blocage rencontré : create_trigger refusé par le classificateur auto (« Cowork Scheduled Task Write ») → pas de réveil programmé possible depuis cette session. L'utilisateur doit autoriser ou relancer manuellement avant le 11/11 23:00 UTC, sinon la mort est certaine par cash seul.
- Actions/ETF Yahoo : 429 (indisponibles). Coinbase OK (BTC 68 075, ETH 2 004, SOL 81).

## Réveil 2 — 2026-11-06 21:20 UTC (22:20 Paris), N=0
- État : alive, 100 € cash, aucune position, aucun ordre en attente. Sources Coinbase/Kraken OK (health 200), Yahoo toujours absent (pas de FIRECRAWL_KEY).
- Contrainte : next.txt n'existait pas (WebFetch raw.githubusercontent → « client_error », local : fichier absent) → pas de gate, réveil traité. Je crée next.txt pour éviter les réveils inutiles. Si WebFetch échoue encore sur une URL existante, la lecture à distance ne fonctionne pas : traiter comme « aucune contrainte » mais lire le fichier local après le clone (dépôt déjà présent dans /home/claude/survivor100, add_repo inutile : accès push déjà accordé).
- Calcul : T(E)=ln(E/90)/ln1,02 est concave → un pari de moyenne nulle réduit la durée de vie espérée (±5 % : 5,26 j contre 5,32 j en cash, avant frais 0,3 %). Pas d'edge démontré ⇒ je reste en cash.
- Échéance cash : mort à 23:00 UTC le 11/11 (seuil N6 = 101,35 > 100). Dernier moment utile pour entrer en position : le 11/11 en journée. Après chaque minuit, il faut equity ≥ seuil, donc un pari doit finir > ~+1,7 % (frais + glissement inclus) pour passer N6.
- À faire d'ici là, sans coût : repérer un catalyseur réel et daté (macro US, résultats, crypto) ; vérifier BTC/ETH/SOL et xStocks (lundi 9 nov = séance US) ; ne parier qu'avec stop. Ne rien inventer : citer la source de chaque donnée.
