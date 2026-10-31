---
name: user-doctrine-orchestrateur-de-sessions-max5
description: "Régime MAX x5 : l'orchestrateur ne fait jamais le travail d'un chantier ; au plus 2 sessions Claude exécutantes, Codex par le pont à l'effectif de l'annexe codex.md ; une session neuve par ticket, jamais --resume"
metadata:
  type: user
---

**Verbatim (2026-10-06)** : « Inutile de relancer toutes les sessions, controle le flux toi même, je suis passé de MAXx20 a MAXx5 », puis : « Tu es l'orchestrator des sessions, ne fais leur travail »

**Verbatim (2026-10-06)** : « La session n'a pas besoin de connaitre le contexte de l'ancien ticket si ? Vaut mieux le fermer et en relancer une nouvelle ? »

**Verbatim (2026-10-07)** : « On va repasser a 2 sessions claude (en plus de toi) au lieu de 3, donc des que l'un se ferme, ne relance pas. »

**Verbatim (2026-10-07)** : « Tuer mon onglet de powershell est une chose, mais ca ne ferme pas l'onglet »

**Verbatim (2026-10-17)** : « je n'ai plus d'usage sur codex, donc inutile dans lancer de nouveau »

**Verbatim (2026-10-23)** : « Tu peux passer en orchestrator de session et donner du travail a Codex. Par contre pas d'agent claude », puis : « tu peux en avoir 2 des sessions codex »

**Verbatim (2026-10-24)** : « j'ai réinitiatilé l'usage codex, tu peux de nouveau lancé des sessions », puis : « Ok, tu peux lancer un autre codex au besoin », puis : « Pas besoin d'un 3ieme codex ? », puis : « je preferais avoir le pont et utiliser la 0.164 », puis : « Tu peux ouvrir un claude sur ce sujet ? »

*Question posée (AskUserQuestion, non-verbatim utilisateur) : Combien de Codex en parallèle (point E) ?*

**Choix (2026-10-25)** : « 2 au plus »

*Question posée (AskUserQuestion, non-verbatim utilisateur) : Qui relit le diff de Codex avant chaque commit (point B) ?*

**Choix (2026-10-25)** : « Juge Claude + moi »

**Verbatim (2026-10-31)** : « ne garde jamais une session, il va faire un cache miss »

**How to apply :** l'orchestrateur ne fait jamais le travail d'un chantier : il attribue et relaie. Au plus 2 sessions Claude exécutantes ; les sessions Codex passent par le pont 0.164, à l'effectif de l'annexe `codex.md` du skill `orchestrer-des-agents`. Une session NEUVE par ticket, à consigne courte, fermée dès qu'elle rend : ticket publié, bloqué ou en attente, jamais gardée au repos pour un réveil (cache froid) ; son rendu et ses restes vont au ticket, la suivante repart de là. Jamais `claude --resume`. Elle se lance, se liste et se ferme par `npm run ops:session` (skill `orchestrer-des-agents`).
