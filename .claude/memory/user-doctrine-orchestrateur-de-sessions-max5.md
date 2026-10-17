---
name: user-doctrine-orchestrateur-de-sessions-max5
description: "Régime MAX x5 : l'orchestrateur ne fait jamais le travail d'un chantier ; au plus 2 sessions Claude exécutantes, aucune Codex ; une session neuve par ticket, jamais --resume"
metadata:
  type: user
---

**Verbatim (2026-10-06)** : « Inutile de relancer toutes les sessions, controle le flux toi même, je suis passé de MAXx20 a MAXx5 », puis : « Tu es l'orchestrator des sessions, ne fais leur travail »

**Verbatim (2026-10-06)** : « La session n'a pas besoin de connaitre le contexte de l'ancien ticket si ? Vaut mieux le fermer et en relancer une nouvelle ? »

**Verbatim (2026-10-07)** : « On va repasser a 2 sessions claude (en plus de toi) au lieu de 3, donc des que l'un se ferme, ne relance pas. »

**Verbatim (2026-10-07)** : « Tuer mon onglet de powershell est une chose, mais ca ne ferme pas l'onglet »

**Verbatim (2026-10-17)** : « je n'ai plus d'usage sur codex, donc inutile dans lancer de nouveau »

**How to apply :** l'orchestrateur ne fait jamais le travail d'un chantier : il attribue et relaie. Au plus 2 sessions Claude exécutantes, aucune session Codex. Une session NEUVE par ticket, à consigne courte, fermée une fois le ticket publié, sauf si le ticket suivant retravaille les MÊMES fichiers juste après ; jamais `claude --resume`. Elle se lance, se liste et se ferme par `npm run ops:session` (skill `orchestrer-des-agents`).
