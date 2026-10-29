<!-- GENERATED: agents:sync; source=.claude/skills/orchestrer-des-agents/calibrage.md -->
# Calibrage

Annexe du skill `orchestrer-des-agents` (`.agents/skills/orchestrer-des-agents/SKILL.md`).

| Étage | Type (`.claude/agents/`) | Modèle | Effort |
|---|---|---|---|
| Lecture / comparaison de masse | `lecteur` | sonnet | medium |
| Vérification mécanique (existence, famille) | `verif-mecanique` | claude-haiku-5-5 | low |
| Code sous spec précise | `codeur` | opus | medium |
| Jugement dur (réfutation, synthèse de verdicts, archi) | `juge` | opus | high |
| Rédaction fidèle au Source (fiches, synthèses de règles) | `redacteur` | opus | medium |
| Question de règle de jeu, avant l'utilisateur | `arbitre-raw` | opus | medium |
| Élément 3D (GLB et manifeste schéma 3) | `modeleur` | opus | medium |
| Recette navigateur en joueur | `recetteur` | sonnet | medium |
| Joueur cloisonné de table simulée | `joueur` | sonnet | low |
| MJ de table simulée | `mj-de-table` | sonnet | medium |
| Juge de workflow contre le `Source/` (complétude, fidélité, analyse) | `juge-de-source` | opus | high |

Ces types plutôt que `general-purpose` ; **JAMAIS Sonnet en effort haut/xhigh**. La cérémonie suit le
risque RÉEL, pas le flag ultracode : petite feature testée → 1 codeur + gates ; tâche large ou incertaine
(audit moteur, migration, extraction massive), donnée, vérification → workflow multi-agents si l'utilisateur l'a demandé, sinon des agents ; reviewer
adversarial pour les régressions silencieuses et l'art, jamais l'art à l'aveugle.
