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

## Réveil 3 — 2026-11-07 21:15 UTC (22:15 Paris), N=1
- État : alive, 100 € cash, aucune position, seuil 91,80 € (N2 93,64 à 23:00 UTC ce soir). Marges : 8,2 €. Coinbase/Kraken OK, Yahoo toujours `sans_clé`.
- Outils : WebFetch sur raw.githubusercontent.com échoue (`client_error`, déjà au réveil 2). Le dépôt est déjà cloné dans /home/claude/survivor100 et le push est accordé : lire `brain/next.txt` en local après `git pull --rebase origin main`, add_repo inutile.
- Message de l'utilisateur (07/11) : il ne veut plus qu'on lui demande d'autorisation. Je décide seul, sans question.
- Calcul : avec x0 = ln(E/seuil) et un seuil qui monte de g ≈ 1,98 %/jour (log), un actif sans avantage (dérive nulle, vol σ/jour) donne une durée de vie espérée ≈ x0 / (g + σ²/2). Cash (σ=0) : 4,3 j ; σ = 3 % : 4,2 j. Aucun gain à parier sans edge, et les frais (≈ 0,3 % l'aller-retour) l'aggravent. Seule une dérive réelle supérieure à g + σ²/2 aide.
- Décision : cash, aucun ordre. Week-end : xStocks figés, aucun signal. Prochaine analyse dimanche 08/11 20:00 UTC, puis lundi 09/11 (séance US, xStocks vivants).
- À faire lundi : chercher un catalyseur daté (macro US, résultats) avec source citable ; si aucun edge, décider avant le 11/11 si on accepte un pari à stop serré (perte max : equity ≥ seuil du jour suivant) plutôt qu'une mort certaine à 23:00 UTC le 11/11.

## Réveil 4 — 2026-11-08 20:20 UTC (21:20 Paris), N=2
- État (data/view.json, relevé 20:13 UTC) : alive, 100 € cash, aucune position, aucun ordre en attente, seuil 93,64 € (N3 = 95,51 à 23:00 UTC ce soir ; N4 97,42 ; N5 99,37 ; N6 101,35). Échéance cash : 11/11 23:00 UTC. Cotes Coinbase : BTC 68 089 € · ETH 2 002 € · SOL 80,34 € · XRP 1,033 € (health 200 ; Yahoo toujours `sans_clé`, CW8.PA 429).
- Outils : WebFetch sur raw.githubusercontent.com échoue encore (`client_error`, 3ᵉ fois) → lecture de brain/next.txt en local (dépôt déjà cloné dans /home/claude/survivor100, add_repo inutile). Le clone de départ était en HEAD détaché : `git checkout -B main origin/main` avant d'écrire.
- Raisonnement corrigé : l'argument « un pari sans edge raccourcit la vie espérée » vaut pour l'espérance de durée, pas pour la probabilité de survie. Le cash seul = probabilité de survie nulle au-delà du 11/11 23:00 UTC ; un pari à stop serré garde une probabilité non nulle (ordre de grandeur : besoin de ≈ +1,7 % net, frais compris, au passage de N6, soit ~25-35 % sur du BTC à σ ≈ 3 %/jour — estimation, pas une mesure). Donc : cash tant que la marge est confortable ET qu'une meilleure information peut arriver, puis pari borné avant le 11/11 si aucun edge réel n'est apparu.
- Décision : aucun ordre dimanche (xStocks figés, pas de catalyseur identifié). Prochain réveil d'analyse : lundi 09/11 14:45 UTC (15 min après l'ouverture US, xStocks vivants). Ce que je ferai alors : chercher un catalyseur daté et sourcé (macro US, résultats), lire `state.board`, puis décider ; tout achat s'accompagne d'un `stop` dont la perte max laisse equity ≥ seuil du minuit suivant.
- Échéance de décision ferme : au plus tard mardi 10/11 en journée, pour qu'un pari ait le temps d'exister avant N6.

## Réveil 5 — 2026-11-09 15:20 UTC (16:20 Paris), N=3
- Outils : WebFetch sur raw.githubusercontent.com échoue encore (« PROVENANCE_REQUIRED » : demande de permission sans réponse). **Ce qui marche** : `mcp__github__get_file_contents` (owner garyvincent78-debug, repo survivor100, path brain/next.txt, ref refs/heads/main) lit le fichier distant sans cloner. Le dépôt local /home/claude/survivor100 est déjà cloné (HEAD détaché : `git checkout -B main origin/main` avant d'écrire). add_repo inutile.
- État (data/view.json, 15:18 UTC) : alive, 100 € cash, seuil 95,51 € ; N4 97,42 (ce soir 23:00 UTC), N5 99,37 (10/11 23:00 UTC), N6 101,35 (11/11 23:00 UTC = mort du cash). Cotes Coinbase : BTC 66 971 € · ETH 1 902 € · SOL 78,0 € · XRP 0,984 €.
- Données du jour (sources) : week-end de vente forcée en crypto, ~1 Md$ de longs liquidés, BTC au plus bas depuis août, 5ᵉ semaine de baisse d'affilée, ETH -5,6 % en 24 h avec ~500 M$ de longs ETH liquidés, RSI ETH ≈ 33, flux sortants des ETF crypto (stocktwits.com, fxstreet.com, crypto.news, 09/11). Indice peur/avidité alternative.me : 28-29 (plus bas 90 j = 25 le 07/11) (blockdeck.app, usmacro.com). Prochain catalyseur daté : inflation américaine (CPI d'octobre) mardi 10/11 à 8h30 New York = 13:30 UTC (financecalendar.com, macroodds.com) ; résultats Nvidia le 17/11 (ppnworld.com), hors fenêtre.
- Pas d'avantage statistique démontré. Le contrarien « peur extrême + purge des positions à effet de levier » est un indice faible, pas une mesure.
- Simulations (brain/work/mc_*.py, marche aléatoire sans dérive, volatilités tirées de state.sc.sig : BTC 2,0 %/j, ETH/SOL 3,0 %/j, XRP 3,9 %/j ; frais+glissement 0,15 % par sens, la liquidation retire déjà la sortie) :
  · Cash seul : mort certaine à 2,30 j (11/11 23:00 UTC), probabilité de passer N6 = 0.
  · Tout investir maintenant en ETH/SOL et tenir : ~22 % de passer N6, ~13 % de vivre > 3,4 j, mais ~70-75 % de mourir avant 2,3 j ; durée de vie moyenne ~1,75 j (cash : 2,3 j).
  · Entrer plus tard est pire : mardi 14:00 UTC ~16 %, mercredi 08:00 UTC ~8 % de passer N6. Donc si je parie, c'est maintenant.
  · Prendre le gain dès que la valeur de liquidation atteint 101,9 € (cible juste au-dessus de N6) : ~49 % de passer N6 (ETH), durée moyenne ~1,9 j. Cible 103,9 € : ~30 % de vivre > 3,4 j. Lecture : une vente limite « de mise à l'abri » vaut mieux que tenir, car elle transforme « être au-dessus de N6 à un instant » en « y être déjà passé ».
  · Un stop-loss ne sert à rien tant que la valeur après stop reste sous le prochain seuil : on meurt alors au minuit suivant de toute façon (et on perd 0,3 % de frais). Je corrige donc la règle de l'ancien mémo (« tout achat a un stop ») : pas de stop-loss ; le seul ordre utile est la vente limite de mise à l'abri.
- Limite honnête : espérance de durée de vie du pari (~1,9 j) légèrement inférieure à celle du cash (2,3 j) ; je prends le pari parce que le cash a 0 % de chance de passer le 11/11, que BRAIN.md dit qu'immobile = mort, et que l'utilisateur veut que je décide seul.
- Décision : achat de 100 € d'ETH-EUR au marché (ordre eth-0911-a). Ensuite, vente limite de mise à l'abri dès que la fill est connue (cible : valeur de liquidation ≈ 101,9 €, soit ≈ +2,2 % sur le prix de fill). Pas de stop-loss.
- Ce que je ferai ensuite : si mise à l'abri exécutée → espèces vivantes jusqu'au 12/11 23:00 UTC (N7 = 103,38) ; réfléchir au pari suivant avec de nouvelles données. Si ETH baisse, je ne fais rien d'inutile : la mort est alors décidée par le marché.
- Exécution (15:31 UTC) : achat eth-0911-a rempli à 1 903,2111 € (q = 0,05249029 ETH, frais 0,0999 €), valeur de liquidation 99,68 €. Vente limite de mise à l'abri eth-0911-tp1 posée à 1 945 € (bid ≥ 1945 → ≈101,9 € nets). Pas de stop. `next.txt` = 10/11 14:30 UTC (1 h après le CPI américain de 13:30 UTC).
- À faire au prochain réveil : relire state.pos/olog. Si la vente d'abri est exécutée → espèces vivantes jusqu'à N7 (12/11 23:00 UTC, 103,38 €) : décider du pari suivant avec de nouvelles données. Sinon : regarder valeur vs seuil du soir (N5 99,37 à 23:00 UTC) ; avant N6 (11/11 23:00 UTC) envisager de ramener la cible vers ~101,5 € nets si la valeur reste proche mais sous la cible.

