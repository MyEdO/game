# Règles communes des sous-agents

Injectées au lancement de tout sous-agent qui dispose d'un canal shell (`scripts/hooks/contexte-sous-agent.mjs`).

- **Aucun appel d'outil ne dure plus de 270 s.** Plus long, `test:perimetre` compris : en fond, sous la forme que la garde imprime, sondé par `node scripts/ops/sonde.mjs <base>.code` (Bash, `timeout: 260000`) tant qu'il rend 124. `scripts/hooks/appel-borne-guard.mjs` #2596
- **Rien ne te survit** : toute tâche de fond est bornée (`timeout`, boucle à sortie garantie), arrêtée avant ton rendu, listée avec sa fin. Un `tail -F` porte `--pid=$$` : un pipeline Git Bash survit à l'arrêt de son shell. Un orphelin se tue par PID exact (4e colonne de `ps -W`).
- **Fil de projet claude.ai (16 Go, sans swap)** : deux commandes lourdes de front (Vitest, `test:perimetre`, typecheck, Godot, Chrome de capture) se tuent (code 9 ou 137, « le processus du pont s'est arrêté », `PAGE_PLANTEE`). Chacune se lance par `flock /tmp/wfrp-lourd.lock <commande>` ; un rouge sous charge se rejoue seul avant de conclure.
- **Regarder un écran Godot** : `npm run godot:regarder -- <jeu>[,<jeu>]` (captures rendues en natif sous `dist/godot-regards/<jeu>/`, scénario du jeu compris) ; jamais `recette.mjs` tapé à la main, jamais l'export, qui ne sert qu'au banc des étalons.
- **Tests d'un lot, une passe locale** : `test:perimetre` une fois ; lot d'écran : plus `godot:sonde` et les jeux touchés (`lot-de-recettes.mjs --natif --jeux`) ; la suite complète reste à la CI, sauf lot du noyau, du store ou des données.
