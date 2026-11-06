#!/bin/bash
# Boucle de l'agent : un passage par minute pendant ~5 h 40, publication des données toutes les 5 passes (ou à chaque trade),
# puis relance d'un nouveau job. Le calendrier (cron) ne sert que de filet de secours.
# Ce script, run.mjs et engine.js sont exécutés depuis une copie du commit TRUST_SHA fixé dans tick.yml (dossier CORE) :
# un commit du cerveau sur ces fichiers n'a aucun effet. Le cerveau n'écrit que orders.json, strategy.js et brain/.
git config user.name survivor100-bot; git config user.email survivor100-bot@users.noreply.github.com
CORE=${CORE:-$(cd "$(dirname "$0")" && pwd)}
export DATA_DIR=$PWD/data ORDERS_FILE=$PWD/orders.json STRAT_FILE=$PWD/strategy.js
KEEP=${KEEP_DIR:-/tmp/datacopy}; rm -rf "$KEEP"; cp -a data "$KEEP"   # copie privée de data/, hors dépôt : référence que le cerveau ne peut pas toucher
END=$(( $(date +%s) + ${LOOP_SECONDS:-20400} )); n=0; PF=0; NF=0
push() {
  git add -A data; git diff --cached --quiet || git commit -q -m "tick $(date -u +%FT%TZ)"
  for k in 1 2 3; do
    if git pull -q --rebase -X theirs origin main && git push -q origin HEAD:main; then PF=0; return; fi
    git rebase --abort 2>/dev/null; sleep 3
  done
  PF=$((PF+1)); echo "publication échouée ($PF cycles de suite)" >&2
  [ "$PF" -ge 12 ] && { echo "publication impossible depuis 12 cycles : arrêt (le job est relancé par le calendrier)" >&2; exit 1; }
}
while [ "$(date +%s)" -lt "$END" ]; do
  s=$(date +%s)
  PREV=$(git rev-parse HEAD)
  git pull -q --rebase --autostash -X theirs origin main || echo "lecture des ordres/stratégie (pull) échouée" >&2   # ordres et stratégie poussés par l'IA
  F=$(git diff --name-only "$PREV" HEAD -- data 2>/dev/null | tr '\n' ' ')
  if [ -n "$F" ] && [ -d "$KEEP" ]; then   # commit étranger sur data/ : on remet la copie privée du job (hors dépôt) et on le signale
    rm -rf data; cp -a "$KEEP" data; echo "{\"ts\":$(date +%s)000,\"files\":\"$F\"}" > data/guard.json
  fi
  b=$(wc -c < data/journal.jsonl 2>/dev/null || echo 0)
  if env -u GH_TOKEN timeout 120 node "$CORE/run.mjs"; then NF=0; rm -rf "$KEEP"; cp -a data "$KEEP"; else NF=$((NF+1)); echo "run.mjs en échec ($NF de suite)" >&2; [ "$NF" -ge 10 ] && { echo "run.mjs en échec depuis 10 passages : arrêt" >&2; exit 1; }; fi
  a=$(wc -c < data/journal.jsonl 2>/dev/null || echo 0)
  n=$((n+1))
  if [ $((n % 5)) -eq 0 ] || [ "$a" != "$b" ]; then push; fi
  grep -q '"status":"dead"' data/state.json 2>/dev/null && { push; exit 0; }
  d=$(( ${LOOP_PERIOD:-60} - ( $(date +%s) - s ) )); [ "$d" -gt 0 ] && sleep "$d"
done
push
gh workflow run tick.yml --ref main || true
