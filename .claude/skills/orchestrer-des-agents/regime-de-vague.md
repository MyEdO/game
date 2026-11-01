# Régime de vague et d'épique

Annexe du skill `orchestrer-des-agents` (`.claude/skills/orchestrer-des-agents/SKILL.md`).

**Un orchestrateur qui a des tickets ne s'arrête pas** (utilisateur, 2026-08-31 : « Un orchestrator
n'arrete jamais tant qu'il a des tickets a traiter »). Dès que les agents sont rendus : dispatcher le
prochain lot ancré, ou NOMMER le blocage réel (quota, validation utilisateur, charge machine).
- **Ne remonte à l'utilisateur que** : règles de jeu (cérémonie), goût et forme, budget, `[entériné]`.
- **Agir par défaut**, hors de cette liste (utilisateur, 2026-07-17 : « n'attends vraiment pas mon
  retour pour continuer » ; 2026-09-23 à 2026-09-25 : « Pourquoi tu t'es arrete alors ? Tu ne fais plus
  rien ? ») : une question d'ingénierie
  qu'une bonne pratique tranche se tranche, justifiée au ticket ; une bascule qui touche d'autres
  sessions, leur ÉCRIRE (`SendMessage`) avant ; un sentier dont ma cible dépend et que personne ne tient
  est à moi (utilisateur, 2026-09-20 : « n'hésite pas a reprendre des chantiers dont tu as besoin pour
  avancer sur ta tache. La session en // ne touche aucun de ces chantiers »).
- **Orchestrateur de sessions : j'attribue les tickets et décide du sort des sessions en vol** (finir,
  arrêter, relancer), sans le demander (utilisateur, 2026-09-30 : « tu es l'orchestrator des sessions
  liés a l'épique sur 665. Tu ne fais pas des tickets, tu coordonne les autres sessions claude. », puis
  « C'est toi qui décide, c'est toi qui chappote tout » ; 2026-10-08 : « C'est toi l'orchestrator, c'est
  toi qui décide ») ; je consigne au suivi.
- **Cycle d'une session** : `npm run ops:session -- lancer .git/suivi/consignes/<N>.md` rend le `jeton`
  que `fermer` exige (stdin `{"jeton":"…"}` ou `WFRP_SESSION_JETON`) et la commande `veille` ;
  `archiver` range sous `sessions/archive/` les cartes en ANOMALIE dont aucune identité ne vit.
  `scripts/ops/session.mjs:33` (usage), `scripts/ops/session.mjs:174` (`veille`)
- **Une session lancée orchestre son ticket** (utilisateur, 2026-10-28 : « D'ailleurs pourquoi la
  session n'utilise aucun agent, c'est sensé etre un orchestrator sur son ticket non ? ») : sa consigne
  l'ouvre par le skill `orchestrer-des-agents`. Elle dépêche les codeurs, le juge de diff et le recetteur,
  et committe par chemins sur sa branche. Elle ne reçoit jamais un brief de codeur (« l'orchestrateur
  committe ton diff ») : ce brief-là la fait coder seule.
- **Un plan approuvé s'exécute jusqu'au bout** : avant de le dire terminé, inventaire item par item
  (exécuté, dispatché, ou ancré avec son BLOCAGE NOMMÉ) ; toute annonce « je ferai » est un item.
- **Re-mesurer la sous-tâche contre l'objectif macro** (arbitrer un détail d'un but large = zoom out ;
  utilisateur, 2026-09-28 : « Je te rappel que notre objectif est "Adaptation du chapitre 1 campagne
  impériale" », puis « Enfin le Tome 1, pas le chapitre 1 »).
  Après une interruption, reprendre le CHEMIN CRITIQUE (utilisateur, 2026-09-27 : « Je compte sur toi
  pour ne pas redériver ») ; une trouvaille hors chemin part en ticket sauf
  si elle rougit la CI ou casse le livrable ; un arrêt se dit avec sa vraie cause, jamais « bloqué par
  l'utilisateur » sans verbatim.
- **Défaut dans le périmètre d'un autre chantier** : dédupliquer par symptôme ET remède, lire le ticket
  propriétaire en entier, y déposer faits mesurés et questions, ne rien committer qui préempte sa réponse
  (#1739 ; utilisateur, 2026-09-20 : « On a un vrai chantier dans l'épique sur les sources, il faut
  absoluement éviter de le saboter en prenant des décisions contradictoires »). Un fichier qu'un autre chantier touche s'édite dans mon worktree : la collision se règle à la fusion (utilisateur,
  2026-08-10 : « m en fiche si y a du wip voisin, c'est une excuse pour ne jamais finir son travail »).
- **Frictions** (utilisateur, 2026-10-05 : « si les sessions tombent sur des difficultés, ont fait des
  actions répété mais via des scripts, ou tout axe qui mérite une analyse afin d'apporter des
  améliorations […], ca ùérite peut etre ca place dans un fichier de suivis d'amélioration continue ») : chaque brief de session demande une ligne « Friction : quoi · coût mesuré · outil »,
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
