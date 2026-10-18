---
name: orchestrer-des-agents
description: À utiliser pour écrire/modifier du code (même « petit »), dispatcher agent ou workflow, au retour d'un agent, avant tout agent() sans modèle/effort, avant AskUserQuestion, pour répondre à l'utilisateur.
---
<!-- GENERATED: agents:sync; source=.claude/skills/orchestrer-des-agents/SKILL.md -->

# Orchestrer des agents

**Je ne code pas, même un guard d'une ligne** : un agent sous spec précise.
Moi = décomposer, spécifier, vérifier, intégrer ; seul code de ma main : l'intégration triviale et les
gates.

## Suivi

- **Le suivi de vague `.git/suivi/<N>.json` est, sur le poste, la SEULE source du plan et du prochain
  geste**, un par épique (utilisateur, 2026-09-28 : « Il faut absoluelement faire un truc pour ce fichier
  de suivis, c'est vital si on veux éviter la dérive »). Il se relit EN PREMIER à toute reprise : `npm run
  ops:suivi -- <N>` (situation), `-- <N> --rendu` (suivi entier), `-- <N> --mesurer [--sans-fetch]` (mesure).
- **Il vit dans le `.git` du POSTE, jamais versionné** : une épique ne se REPREND que sur le poste. Une
  session hors du poste (cloud) exécute le lot que nomme son ticket et consigne au TICKET, en commentaire
  daté, ce qu'elle décide ; à la reprise sur le poste, ces commentaires entrent au suivi par son outil
  (`--arbitrer`, `--ajouter-etape`, `--signaler`) avant tout autre geste.
- **Il ne s'écrit que par son outil** (utilisateur, 2026-10-07, #2460 : « Ca aurait du etre un json
  modifiable que via des outils adaptés, histoire d'éviter de faire n'importe quoi dessus, non ? ») :
  `mcp__harnais__suivi` ou `npm run ops:suivi -- <N> --<geste> <args>…` (gestes de
  `scripts/ops/suiviDonnee.mjs`, arité fixe : un texte = UN argument), plusieurs gestes ou `--lot <json>`,
  TOUT OU RIEN, sous verrou ; `--creer <titre>` ouvre une vague. Un suivi édité à la main reste « écrit
  hors de l'outil » jusqu'à `--reconnaitre <motif>` EN TÊTE de lot.
- **Il tient dans son BUDGET** (`BUDGET_DU_SUIVI`) : un lot qui le dépasse ET grossit est refusé avec ses
  gestes de condensation.
- **Chaque lecture le CONFRONTE à la mesure** (`confronter`) : le lecteur ne mesure jamais, il demande
  `aMesurer` (mod `harnais` ; Codex : `--mesurer` à la main). Chaque anomalie se corrige, ou, ACCEPTÉE,
  se tait par `--ignorer-anomalie <genre> <clé> <motif>`.
- **Un ticket prévu = un item** (`--ajouter-item`, ou `--enfiler` puis `--demarrer`), d'état `actif |
  attente | gare | clos` ; ses étapes (`--ajouter-etape`, `--cocher <ticket>.<n>`) s'écrivent AU FIL DE
  L'EAU. Aucun état de branche, d'issue ou de publication n'y est saisi : la mesure (`<N>.mesure.json`)
  le porte.
- **À la FERMETURE d'un ticket**, ses arbitrages utilisateur partent au TICKET, verbatim et datés, PUIS
  l'item passe `clos` et se condense (`--condenser <ticket> <résumé>`). Le task-tracker n'est qu'un
  miroir de session.
- **L'épique porte le design validé** en commentaire daté VERBATIM ; un ticket par lot (gabarit #101,
  labels, Bloqué par / Débloque, DoD mesurable). Le commentaire de pilotage n'est qu'une PROJECTION du
  suivi, jamais relue comme état. Un brief de codeur est un commentaire DATÉ du ticket, jamais un `docs/`.

## Cycle

**0. Audit de DoD d'abord.** Vague qui reprend des tickets « déjà livrés » → un `juge` relit le DoD MOT
À MOT, preuve par point, AVANT le travail : le constat réordonne la vague et sort les dépendances
jamais écrites. Fermer sur « déjà implémenté » ou « documenté » appelle la même relecture.

**1. Grounding.** Sweep de 3+ fichiers → `lecteur` ; 1-2 lectures ciblées inline = OK. La décision
d'archi reste dans mon fil, **primitives cibles NOMMÉES avant tout code** ; le `Source/`, je l'ouvre
moi-même. Les COMMENTAIRES d'un ticket se lisent à la composition et vont au juge de design (#1561).
Vague transversale → paragraphe de DESIGN (invariant, qui possède quoi, critère « N+1 = une ligne »)
attaqué par un juge AVANT le premier codeur ; deux passes sur la même classe = remonter d'un niveau.
- **Arbre à jour avant toute lecture qui conclut** : bloc `synchroniser` du démarrage, ou `git rev-parse
  HEAD origin/main`. Ouvrir le chantier (`npm run ops:chantier -- <N>`) AVANT le grounding et donner au
  lecteur le chemin ABSOLU du worktree. Refus de synchronisation : corriger la cause nommée puis `npm run
  ops:synchroniser`, jamais `git pull` (#2187).
- **Ticket de plus de ~2 semaines, ou repris d'une session fermée** : RE-MESURE en lecture seule sur
  l'arbre courant contre `docs/doctrines.md`, plus l'inventaire des analyses déjà faites ; commentaire
  « RE-MESURE » au ticket. Un arbitrage UI ancien est un CONTEXTE, jamais un veto ; un arbitrage de règle
  de jeu ne périme pas.
- **Avant de prescrire le traitement d'une CLASSE** (texte joueur, références, surfaces, formes de
  données) ou d'ouvrir un ticket : `gh search issues "<mots>" -R MyEdO/game`, les épiques du domaine, et
  pour une décision d'interface les messages `user` des transcripts ; citer l'arbitrage trouvé avec sa date.

**2. Brief.** Périmètre de fichiers exact, primitives cibles nommées, réfs RAW nues,
chemin ABSOLU du worktree, interdit de tout `git checkout/restore/reset/stash/add/commit`, « rendu
final = données brutes », UN livrable, `npm run test:perimetre` au lieu d'une liste de tests (#2400).
- **Un brief de codeur tient en ~45 min** (juge de diff : 30 min) : découper en lots partitionnés par
  FICHIERS disjoints, lancés en parallèle. Au-delà d'1 h, le codeur rend l'item en cours et le reste se
  répartit ; jamais d'items ajoutés par `SendMessage` à un codeur en vol. La borne est un `Monitor` sur
  l'horloge + `TaskStop`, pas le budget écrit.
- **Socle → les trois sections de `.claude/agents/codeur.md`, sinon le codeur REFUSE** ; `## Design
  jugé :` cite le rendu du `juge`.
- **Le brief ne prescrit jamais un appel d'outil de plus de 270 s** (#2596).
- **Un brief POSE les questions, il ne les pré-répond pas** : provenance d'une règle, consommateur, état
  d'un fichier se demandent en SORTIE, citation exigée. Le banni est l'affirmation NON citée : verbatim,
  réf RAW nue, ligne de `package.json`, sortie de sonde collés restent légitimes. **Toute RÈGLE affirmée
  porte sa CITATION VERBATIM** : un rendu d'agent n'est pas une source, recyclé il gagne une fausse autorité.
- **Une citation prouve ce qu'elle RÉPOND** : en justification (limitation, absence, simplification),
  confronter la question à laquelle elle répond DANS SON CONTEXTE (la troncature est la variante
  vicieuse) à celle que le code lui fait porter. Étalon : `src/engine/conditions.ts`.
- **Tout pointeur s'écrit DÉRÉFÉRENCÉ** : `#N` avec son titre (`gh api repos/{owner}/{repo}/issues/<N>
  --jq .title`), lib avec sa ligne de `package.json`, blocage externe avec sa sonde. **Toute ABSENCE
  porte sa sonde ET son périmètre** ; deux mesures ne se confirment que si leurs MÉTHODES DIFFÈRENT. Un
  diagnostic s'écrit en HYPOTHÈSE À RÉFUTER avec sa sonde discriminante.
- **Un brief de juge ne prescrit JAMAIS de mutation** : elle est au codeur, le juge la vérifie.
- **Code de règle : jamais de « parité de comportement »** : le codeur rouvre `Source/`, migre la version
  CORRIGÉE ; un commentaire qui avoue une interprétation se re-vérifie.
- **UI** : nommer AUSSI la couche atomique — aucun élément nu (`<button>` → `.btn`/`.chip`, conteneur →
  `.panel`, focusable custom → focus maison) ; citer `docs/primitives.md` + `docs/charte-ui.md`.
- **Mise aux normes** : la zone touchée sort AUX NORMES (un concept = un terme, duplication adjacente
  mutualisée ou ticketée, morts adjacents purgés) ; tout juge de cumul porte aussi la lentille de la
  LANGUE. Un lot qui touche un CHAMP embarque TOUTES ses conventions.
- **Lot de structure = UN concept sur TOUS ses porteurs** (datasets, ops, tables, scènes, saves,
  éditeur, Codex), jamais par dataset ni « données d'abord » ; N sites à la même retouche → le lot est le
  SOCLE qui les rend déclaratifs. Fermeture : un motif qui ne compile plus, ou une garde rouge.
- **Tout compromis de TRANSITION** (shim, branchement gardé) s'inscrit au REGISTRE DES FOSSILES du
  ticket-mère avec la phase qui le tue ; le cliquet de migration meurt avec la dernière démolition. Une
  garde qui nomme l'ancien monde est un test-tombale.

**3. Dispatch.** L'effort de chaque étage est MAÎTRISÉ : Workflow `agent()` (`model` + `effort` par
appel), tool Agent (`model` seul ; l'effort vient du frontmatter du type, sinon HÉRITE de la session) ;
un type au `model` épinglé ne reçoit pas de `model` à l'appel (#2537). Workflows
lourds SÉQUENTIELS. Un type qui hérite tous les outils porte `disallowedTools: Agent, Workflow`. **UN
juge par jugement** (design, diff, fermeture), nourri du grounding écrit : il ne re-mesure que ce qu'il
conteste ; un workflow multi-agents ne sert que des travaux DIFFÉRENTS. **Un train = 4 ou 5 gestes** :
diff du codeur → commit sur la branche du worktree → push (CI) → juge de diff en parallèle → corrections.
**Au-delà de 10 fichiers modifiés, le juge de diff se DÉCOUPE** : une passe locale par lot de fichiers
liés, puis une passe d'intégration sur leurs verdicts et les coutures entre lots ; une passe unique
sur un grand diff dilue l'attention.
- **Au 2e CORRIGER sur un même livrable, re-cadrer avant tout 3e juge** : grief DANS la classe gardée →
  corrigé ; voisin → ticket hors périmètre ; le juge suivant reçoit la barre FIGÉE et l'interdit de
  l'élargir. Un « 0 occurrence » qui ne réimplémente pas la garde étendue ne prouve rien (#1765).

**4. Isolation.** Agent qui MUTE des fichiers pendant qu'une session // est active →
`isolation: "worktree"`, à défaut committer au retour. **Les recetteurs sont SÉQUENTIELS** : jamais deux en vol (même serveur dev, même
navigateur).

**5. Attente et reprise.** Un agent background n'est PAS fini avant sa `<task-notification>` : ne pas
lire ni tester son WIP. Avant de relancer un agent mort, vérifier le CONTENU du livrable, jamais `git
status` ; le brief de relance porte l'état VÉRIFIÉ et dit « si le livrable existe déjà, PIVOTE en revue ». Rendu d'un agent repris = tests PÉRIMÉS : je rejoue
`npm run test:perimetre`.
- **Agent rendu depuis plus de 5 min = agent NEUF au brief COURT, jamais `SendMessage`** : son cache vit
  5 min, au-delà la reprise réécrit tout son contexte (#2568).
- **Signal de vie** : l'mtime de `~/.claude/projects/<slug>/<session>/subagents/agent-<id>.jsonl`
  (pas `tasks/<id>.output`), sous `Monitor`, seuil 15 min. Un appel figé sans `tool_result` est tenu par
  un hook vivant depuis plus de 2 min ou un `cygwin-console-helper` orphelin : `Stop-Process` par PID dans
  un `.ps1` (`pwsh -NoProfile -File`), jamais par nom, ni sur `scripts/git-hooks/` ou un `node --test`.
  Puis un agent NEUF, briefé sur le diff partiel relu (#2112).
- **Reprise d'un worktree : mesurer l'INDEX** (`git diff --cached --stat HEAD`, `--cached --stat
  MERGE_HEAD`, `git diff --stat`, stashes du chantier) : le brief donne ces chiffres et dit « couches à
  séparer », jamais « sans conflit ».
- **Tant qu'un agent ou une commande est en vol, une HORLOGE `Monitor`** sur `sleep 1740`, ré-armée tant
  que l'attente dure : mon cache vit 1 h (#2596). `ScheduleWakeup` ne sert qu'en `/loop`. Au fil
  principal, `commande-piege` refuse toute attente en fond et au premier plan celle sans borne (#2603).

**6. Vérification — par MOI, jamais sur la foi du rapport.** `npm run typecheck:fast` et `npm run
test:perimetre` avant commit, revue du diff, UI → skill `recette-navigateur`.
- **Aucun créneau, file ni feu vert pour les gestes lourds** (fusion, `ops:chantier`, publication,
  `test:perimetre`) : chaque session les lance quand son travail l'exige (utilisateur, 2026-10-08 :
  « Vivement qu'on en finisse avec les demandes d'autorisation pour faire son travail »). Une mesure
  faussée par la charge se rejoue, la charge se note au ticket.
- ⚠ **Les portes machine sont un PLANCHER** : « portes vertes » ne se dit jamais « vérifié ». **Tout lot
  qui ajoute une donnée ou une mécanique NOMME sa PORTE** (le geste joueur qui l'atteint) dans son DoD, et
  la recette la traverse (garde `src/data/tables.test.ts`).
- **Les CLAIMS ARCHITECTURAUX se contre-grep** ; exiger la SORTIE BRUTE des
  portes au rendu. **Une trouvaille de SONDE devient un test committé** dans le commit de fix.
- **Friction de recette MESURÉE par script = hypothèse** ; seule la capture vaut fait. Avant tout brief de
  correction, le recetteur la re-mesure isolément (sonde discriminante nommée, tableau brut).
- **Livraison d'ÉCRAN → trois passes** : recette fonctionnelle (DoD), jugement d'écran (captures → juge
  en lentilles : charte/primitives, hiérarchie-densité, cohérence inter-écrans, « prototype ou
  produit ? », défauts concrets), lisibilité si du style a bougé. Sur un sous-système, audit adversarial :
  un raccourci qui « borne le reste » est un défaut, pas un choix.

**7. Publication au fil de l’eau (#2626).** Le lot est l’unité de composition et de jugement ; chaque
tête committée à CI verte se publie aussitôt par `npm run ops:publier -- --detache`, lot fini ou non.
Commits intermédiaires `refs #N`, seul le solde clôt.
- **Un lot = un chantier** (`npm run ops:chantier -- <N>`), même urgent pendant un train : jamais deux
  lots dans un worktree. Une sonde non suivie sort de l'arbre avant `ops:publier`.
- **Fusionner main seulement en CONFLIT, ou pour amener un fichier qu'une porte exige** (le train fusionne
  seul sur éjection) : index STAGÉ → `git restore --staged` d'abord ; `git fetch`, `git merge --no-commit
  origin/main`, jamais un rebase (#2178) ; aucune reconstruction des dérivés sous `MERGE_HEAD` ; `git rm`
  d'une cible pure → `npm run gen` ; gardes du périmètre rejouées sur l'arbre fusionné. Fusion propre ou
  non substantielle : SANS trailers ; `CLIQUET:` pour le seul apport de la résolution ; 10 lignes ou plus
  sous `src/` → `JUGE:`/`REFUTATION:` (+ `JUGE-VISION:` si un écran change) au message, ou dans un commit
  DESCENDANT ou le solde `.claude/soldes/ref-<N>.md` ou `<N>.md` d'un ticket cité qui NOMME son sha
  (`npm run livraison:plage`).
- **Jamais une veille, un train ou un outil `scripts/ops/` lancé depuis un worktree où un agent édite cet
  outil** : il exécute le WIP. Publier avant de dispatcher, ou suivre par `gh pr view` ; un « train mort »
  se recoupe par le pid réel et `git ls-remote` avant toute relance.
- **Sur l'arbre partagé, aucun `checkout`/`restore`/`reset`/`stash` n'est sûr**, même sur un généré ou ma
  propre écriture : un stray se défait en supprimant ou recréant les fichiers puis en rejouant le
  générateur ; un WIP écrasé se récupère par `git stash apply <sha>`, jamais `pop` ; du travail à porter
  sur la branche d'une autre session, c'est elle qui le porte, à l'arrêt.

Le verdict d'une suite en fond se LIT puis se DÉCIDE, jamais `tail … && git push`. Une branche
`chantier/**` se pousse LIBREMENT ; après CHAQUE push, attendre son run EN FOND par `npm run ops:ci --
--attendre` (`Monitor`), `--echecs <run>` pour relire une course, jamais `gh run` ni `sleep` ; un rouge se
rejoue par `npm run gates -- --gates <noms>`. Un train `--detache` se suit par la commande `veille=`
qu'il imprime (`Monitor`, ré-armée par `--depuis <dernier #seq>`), jamais par un filtre de son log.
Migrations : le job `migrations` de `ci.yml` les joue sur la branche, aucun rejeu local. Au retour de
chaque agent, vérifier qu'il ne laisse aucun processus.

**8. Fermeture.** Toute vague qui ferme des tickets se termine par une **passe de réfutation NON
demandée** AVANT toute annonce ; l'annonce porte les VERDICTS (TIENT / FRAGILE / RÉFUTÉ), jamais un score.
Périmètre : fermetures, splits, claims d'agents, écarts non ticketés, ABSTENTIONS (« bloqué » → « prouve
que le blocage n'existe pas », étage `verif-mecanique`) et MES PROPRES COMMITS. Ces règles se DURCISSENT sous pression de temps, elles ne s'y suspendent pas.
- **Le juge de fermeture est NEUF** : brief = DoD, diff, tests. Le `verdict:` d'un solde est SA sortie.
  Un DoD ou un solde QUANTIFIÉ (« tout », « jamais », « chaque ») porte l'ÉNUMÉRATION de sa classe :
  commande et sortie, jamais une liste de mémoire (#1561).
- **Chaque clôture de phase : juge « ARCHITECTURE À REBOURS »** — partant de zéro, cette couture
  existerait-elle ?
- **C'est le TRAVAIL qui se ferme.** Une clause de DoD portée par un ticket ouvert n'est pas soldée
  (« FERMABLE SOUS DÉCISION » = « NON FERMABLE ») ; l'objectif suivant ne raccourcit jamais le DoD. Hors
  DoD, plus d'un ticket de reste → le lot GROSSIT ou le ticket RESTE OUVERT ; tout reste naît rattaché à
  une VAGUE NOMMÉE ; « LIVRÉ » exige des restes soldés ou GELÉS par arbitrage utilisateur daté. Une vague
  ferme au moins autant qu'elle ouvre.
- Un ticket que J'ÉCRIS sur un socle porte son `## Invariant` ; une question qu'il pose se confronte
  D'ABORD aux invariants (tickets-programmes, doctrines) : si une doctrine répond, le ticket ÉNONCE.

## Régime de vague et d'épique

**Un orchestrateur qui a des tickets ne s'arrête pas** (utilisateur, 2026-08-31 : « Un orchestrator
n'arrete jamais tant qu'il a des tickets a traiter »). Dès que les agents sont rendus : dispatcher le
prochain lot ancré, ou NOMMER le blocage réel (quota, validation utilisateur, charge machine).
- **Ne remonte à l'utilisateur que** : règles de jeu (cérémonie), goût et forme, budget, `[entériné]`.
- **Agir par défaut**, hors de cette liste : une question d'ingénierie
  qu'une bonne pratique tranche se tranche, justifiée au ticket ; une bascule qui touche d'autres
  sessions, leur ÉCRIRE (`SendMessage`) avant ; un sentier dont ma cible dépend et que personne ne tient
  est à moi.
- **Orchestrateur de sessions : j'attribue les tickets et décide du sort des sessions en vol** (finir,
  arrêter, relancer), sans le demander (utilisateur, 2026-10-08 : « C'est toi l'orchestrator, c'est toi
  qui décide ») ; je consigne au suivi.
- **Cycle d'une session** : `npm run ops:session -- lancer .git/suivi/consignes/<N>.md` rend le `jeton`
  que `fermer` exige (stdin `{"jeton":"…"}` ou `WFRP_SESSION_JETON`) et la commande `veille`.
  `scripts/ops/session.mjs:19`
- **Au plus 3 agents en vol** (utilisateur, 2026-10-17 : « En tout cas évite de lancer autant d'agent a la
  fois s'il te plait ») : lots par FICHIERS disjoints, le reste en FILE, retouches comprises, chemin
  critique d'abord, preuves différées en série. Type épinglé, modèle non forcé (Calibrage).
- **Un plan approuvé s'exécute jusqu'au bout** : avant de le dire terminé, inventaire item par item
  (exécuté, dispatché, ou ancré avec son BLOCAGE NOMMÉ) ; toute annonce « je ferai » est un item.
- **Re-mesurer la sous-tâche contre l'objectif macro** (arbitrer un détail d'un but large = zoom out).
  Après une interruption, reprendre le CHEMIN CRITIQUE ; une trouvaille hors chemin part en ticket sauf
  si elle rougit la CI ou casse le livrable ; un arrêt se dit avec sa vraie cause, jamais « bloqué par
  l'utilisateur » sans verbatim.
- **Défaut dans le périmètre d'un autre chantier** : dédupliquer par symptôme ET remède, lire le ticket
  propriétaire en entier, y déposer faits mesurés et questions, ne rien committer qui préempte sa réponse
  (#1739). Un fichier qu'un autre chantier touche s'édite dans mon worktree : la collision se règle à la
  fusion.
- **Frictions** : chaque brief de session demande une ligne « Friction : quoi · coût mesuré · outil »,
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

## Répondre à l'utilisateur

- **Toute décision passe par AskUserQuestion** : plusieurs questions par appel, un item par question,
  jamais en prose de fin de message ni dans une spec. Un arbitrage de règle passe d'abord par
  `arbitre-raw` (#2601), puis arrive avec verbatim du livre, situation chiffrée de nos données, code
  (`fichier:ligne`) et ce que l'arbitre a établi ; un bloc manque → pas de question. Une réponse libre
  est souvent une CONTRE-QUESTION ou une correction : boucle suspendue jusqu'à réponse.
- **Une option est une AFFIRMATION** : chaque coût et bénéfice se sonde, sonde collée, ou se dit non
  vérifié ; relire le rapport d'agent plutôt que ma mémoire. Une sortie VIDE avec un compteur non nul
  est une sonde cassée.
- **Toute demande de PERMISSION d'outil qui atteint l'utilisateur est un défaut** : nommer son émetteur (hook
  `scripts/hooks/*`, classificateur du harnais, mon propre enchaînement) et corriger à la racine ; un hook fautif se ticketise avec ses sondes. « Pourquoi
  X n'est pas fait ? » est l'ordre de faire X : ne soumettre que les RÉSULTATS, jamais le droit de commencer.
- **Avant de classer un sujet « arbitrage utilisateur », relire l'ATTENDU validé et le RAW** : s'ils
  répondent, EXÉCUTER. Un « non » vaut au périmètre EXACT refusé.
- **Une phrase qui constate une ABSENCE** se lit comme un DÉFAUT quand l'élément figure au dessin ou au
  spécimen. Si les deux lectures mènent à des gestes opposés, redemander en une ligne ; ne jamais défaire
  du travail livré sur une phrase ambiguë.
- **Retours en rafale sur un sujet complexe** : accuser réception, laisser atterrir le travail en vol,
  synthétiser le problème de FOND, proposer UNE direction argumentée, la faire VALIDER, puis exécuter ;
  sans cette synthèse, ni tout jeter, ni inverser une décision de la veille, ni re-briefer un agent en
  vol. Retours de playtest : par THÈMES, flux réel cartographié (`fichier:ligne` + réf RAW), cluster
  corrigé en lot, audit de ce que le joueur n'a pas nommé (information parfaite, télégraphe de la menace,
  lisibilité positionnelle, économie d'action, cause→effet).
- **Juger avant d'exposer au goût** : planche, maquette ou capture passe d'abord un juge-vision ou mon
  jugement écrit défaut par défaut ; les défauts nommés se corrigent et se recapturent ; n'exposer que des
  candidats défendus (#1343).
- **Jamais « complet » sur un trou connu** : la limite de couverture s'écrit dans le livrable ET
  l'annonce ; un « reste » ne se cite que vérifié dans le code et rattaché au travail fait.

## Calibrage

| Étage | Type (`.claude/agents/`) | Modèle | Effort |
|---|---|---|---|
| Lecture / comparaison de masse | `lecteur` | sonnet | medium |
| Vérification mécanique (existence, famille) | `verif-mecanique` | claude-haiku-5-5 | low |
| Code sous spec précise | `codeur` | opus | medium |
| Jugement dur (réfutation, synthèse de verdicts, archi) | `juge` | opus | high |
| Rédaction fidèle au Source (fiches, synthèses de règles) | `redacteur` | opus | medium |
| Question de règle de jeu, avant l'utilisateur | `arbitre-raw` | opus | medium |
| Art vectoriel sur le rig SVG | `artiste` | opus | medium |
| Recette navigateur en joueur | `recetteur` | sonnet | medium |
| Joueur cloisonné de table simulée | `joueur` | sonnet | low |
| MJ de table simulée | `mj-de-table` | sonnet | medium |
| Juge de workflow contre le `Source/` (complétude, fidélité, analyse) | `juge-de-source` | opus | high |

Ces types plutôt que `general-purpose` ; **JAMAIS Sonnet en effort haut/xhigh**. La cérémonie suit le
risque RÉEL, pas le flag ultracode : petite feature testée → 1 codeur + gates ; tâche large ou incertaine
(audit moteur, migration, extraction massive), donnée, vérification → workflow multi-agents ; reviewer
adversarial pour les régressions silencieuses et l'art, jamais l'art à l'aveugle.
