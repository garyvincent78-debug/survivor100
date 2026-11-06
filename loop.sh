#!/bin/bash
# Boucle de l'agent : un passage par minute pendant ~5 h 40, publication des données toutes les 5 min (ou à chaque trade),
# puis relance d'un nouveau job. Le calendrier (cron) ne sert que de filet de secours.
git config user.name survivor100-bot; git config user.email survivor100-bot@users.noreply.github.com
END=$(( $(date +%s) + 20400 )); n=0
push() {
  git add -A data; git diff --cached --quiet && return
  git commit -q -m "tick $(date -u +%FT%TZ)"
  for k in 1 2 3; do git pull -q --rebase origin main 2>/dev/null && git push -q origin main 2>/dev/null && return; sleep 3; done
  git rebase --abort 2>/dev/null; git fetch -q origin main && git reset -q --hard origin/main
}
while [ "$(date +%s)" -lt "$END" ]; do
  s=$(date +%s)
  git pull -q --rebase --autostash origin main 2>/dev/null || true   # ordres et stratégie poussés par l'IA
  b=$(wc -c < data/journal.jsonl 2>/dev/null || echo 0)
  node run.mjs || true
  a=$(wc -c < data/journal.jsonl 2>/dev/null || echo 0)
  n=$((n+1))
  if [ $((n % 5)) -eq 0 ] || [ "$a" != "$b" ]; then push; fi
  grep -q '"status":"dead"' data/state.json 2>/dev/null && { push; exit 0; }
  d=$(( 60 - ( $(date +%s) - s ) )); [ "$d" -gt 0 ] && sleep "$d"
done
push
gh workflow run tick.yml --ref main || true
