# Régime de vague et d'épique

Annexe du skill `orchestrer-des-agents` (`.claude/skills/orchestrer-des-agents/SKILL.md`).

**Un orchestrateur qui a des tickets ne s'arrête pas** (#1679). Dès que les agents sont rendus : dispatcher le
prochain lot ancré, ou NOMMER le blocage réel (quota, validation utilisateur, charge machine).
- **Ne remonte à l'utilisateur que** : règles de jeu (cérémonie), goût et forme, budget, `[entériné]`.
- **Agir par défaut**, hors de cette liste (#583) : une question d'ingénierie
  qu'une bonne pratique tranche se tranche, justifiée au ticket ; une bascule qui touche d'autres
  sessions, leur ÉCRIRE (`SendMessage`) avant ; un sentier dont ma cible dépend et que personne ne tient
  est à moi (#1739).
- **Orchestrateur de sessions : j'attribue les tickets et décide du sort des sessions en vol** (finir,
  arrêter, relancer), sans le demander (#2683) ; je consigne au suivi.
- **Cycle d'une session** : `npm run ops:session -- lancer .git/suivi/consignes/<N>.md` rend le `jeton`
  que `fermer` exige (stdin `{"jeton":"…"}` ou `WFRP_SESSION_JETON`) et la commande `veille` ;
  `archiver` range sous `sessions/archive/` les cartes en ANOMALIE dont aucune identité ne vit.
  `scripts/ops/session.mjs:33` (usage), `scripts/ops/session.mjs:174` (`veille`)
- **Une session lancée orchestre son ticket** (#3160) : sa consigne
  l'ouvre par le skill `orchestrer-des-agents`. Elle dépêche les codeurs, le juge de diff et le recetteur,
  et committe par chemins sur sa branche. Elle ne reçoit jamais un brief de codeur (« l'orchestrateur
  committe ton diff ») : ce brief-là la fait coder seule.
- **Un plan approuvé s'exécute jusqu'au bout** : avant de le dire terminé, inventaire item par item
  (exécuté, dispatché, ou ancré avec son BLOCAGE NOMMÉ) ; toute annonce « je ferai » est un item.
- **Re-mesurer la sous-tâche contre l'objectif macro** (arbitrer un détail d’un but large = zoom out ; #1993).
  Après une interruption, reprendre le CHEMIN CRITIQUE (#1816) ; une trouvaille hors chemin part en ticket sauf
  si elle rougit la CI ou casse le livrable ; un arrêt se dit avec sa vraie cause, jamais « bloqué par
  l'utilisateur » sans verbatim.
- **Défaut dans le périmètre d'un autre chantier** : dédupliquer par symptôme ET remède, lire le ticket
  propriétaire en entier, y déposer faits mesurés et questions, ne rien committer qui préempte sa réponse
  (fiche `user-doctrine-format-unifie-reextraction-permise`). Un fichier qu'un autre chantier touche s'édite dans mon worktree : la collision se règle à la fusion (fiche `user-doctrine-wip-voisin-s-edite`).
- **Frictions** (#2683) : chaque brief de session demande une ligne « Friction : quoi · coût mesuré · outil »,
  versée au sas du suivi (`--friction <texte>`) ; elle n'en sort en ticket (gabarit #101,
  `domaine:outillage`, sous-issue de #2189, `--verser-friction <n> <ticket>`) que VIVANTE sur
  `origin/main` (sonde, ou occurrence postérieure au correctif), chiffrée, récurrente ou d'au moins
  30 min. Même critère pour tout candidat d'audit (mod, garde, outil).
- **Un lot fait 10-12 tickets d'un MÊME domaine**, les tickets ouverts qui citent un même fichier :
  `gh api "search/issues?q=repo:MyEdO/game+is:issue+is:open+%22<chemin>%22+in:body&per_page=100"`.
- **Validation utilisateur = ASYNCHRONE** : le lot en attente de goût se PARQUE (worktree conservé,
  capture prête, question consignée), la vague CONTINUE ; en ABSENCE, dispatcher ce qui n'appelle aucun
  goût ; écrans et arbitrages en PRÉSENCE. **Checkpoint avant épuisement de quota** : suivi à jour,
  tickets commentés.
- **Épique : pas de salve d'ouverture** — premier lot + index des phases EN PROSE, enfants nés à leur
  vague ; ÉTAT au suivi, STRUCTURE aux sous-issues, aucune checklist au corps. Une vague fait DÉCROÎTRE
  son compteur. Épique muette 14 jours sans label `gelée` = à SIGNALER.
- **Métriques** au suivi, à l'ouverture de session et chaque SEMAINE (`npm run ops:stock-issues`) :
  travail restant, croissance nette (≤ 0), émises sans épique, balance par vague ; fermetures dépilant
  le stock de plus de 28 jours (≥ 50 %), restes résorbés sous deux semaines (≥ 60 %). Deux semaines
  sans mesure = anomalie à signaler.
