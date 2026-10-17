---
name: orchestrer-des-agents
description: À utiliser pour écrire/modifier du code (même « petit »), dispatcher agent ou workflow, au retour d'un agent, avant tout agent() sans modèle/effort, avant AskUserQuestion, pour répondre à l'utilisateur.
---

# Orchestrer des agents

**Je ne code pas, même un guard d'une ligne** : un agent sous spec précise.
Moi = décomposer, spécifier, vérifier, intégrer ; seul code de ma main : l'intégration triviale et les
gates.

## Index

Ce fichier porte le suivi de vague et les étapes 0 à 6 du cycle. Le reste vit en annexes de ce skill : lis
l'annexe au moment de son déclencheur.

| Déclencheur | Annexe |
|---|---|
| Étape 7 : commit, push, fusion de `main`, `ops:publier`, suite en fond | `.claude/skills/orchestrer-des-agents/publication.md` |
| Étape 8 : fermer un ticket, annoncer une vague | `.claude/skills/orchestrer-des-agents/fermeture.md` |
| Choisir le type, le modèle et l'effort d'un agent ou d'un `agent()` | `.claude/skills/orchestrer-des-agents/calibrage.md` |
| Agents rendus, prochain lot, sessions, épique, métriques | `.claude/skills/orchestrer-des-agents/regime-de-vague.md` |
| Question, `AskUserQuestion`, réponse ou retour de l'utilisateur | `.claude/skills/orchestrer-des-agents/repondre-a-l-utilisateur.md` |

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
