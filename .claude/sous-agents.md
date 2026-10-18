# Règles communes des sous-agents

Injectées au lancement de tout sous-agent qui dispose d'un canal shell (`scripts/hooks/contexte-sous-agent.mjs`).

- **Aucun appel d'outil ne dure plus de 270 s.** Plus long, `test:perimetre` compris : en fond, sous la forme que la garde imprime, sondé par `node scripts/ops/sonde.mjs <base>.code` (Bash, `timeout: 260000`) tant qu'il rend 124. `scripts/hooks/appel-borne-guard.mjs` #2596
- **Rien ne te survit** : toute tâche de fond est bornée (`timeout`, boucle à sortie garantie), arrêtée avant ton rendu, listée avec sa fin. Un `tail -F` porte `--pid=$$` : un pipeline Git Bash survit à l'arrêt de son shell. Un orphelin se tue par PID exact (4e colonne de `ps -W`).
