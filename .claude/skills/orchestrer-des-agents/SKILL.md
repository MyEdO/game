---
name: orchestrer-des-agents
description: À utiliser dès qu'une tâche implique d'écrire ou modifier du code, de dispatcher un agent ou un workflow — ou dès qu'on est tenté de coder soi-même « parce que c'est petit ». Aussi au retour d'un agent (avant de vérifier/committer son travail) et avant tout agent() sans modèle/effort explicites.
---

# Orchestrer des agents

**Je ne code pas — même le trivial.** Un guard d'une ligne, une regex, un refacto « couplé » → un agent
sous spec précise. Moi = décomposer, spécifier, vérifier, intégrer ; seul code de ma main :
l'intégration triviale et les gates.

## Suivi

- **Le suivi de vague `.git/suivi/<N>.json` est la SEULE source du plan et du prochain geste** — un
  fichier par épique `<N>`, dans le répertoire git commun (utilisateur, 2026-09-28 : « Il faut
  absoluelement faire un truc pour ce fichier de suivis, c'est vital si on veux éviter la dérive »).
  Il se relit EN PREMIER à toute reprise (compaction, lendemain) : `npm run ops:suivi -- <N>` (la
  situation), `-- <N> --rendu` (le suivi entier), `-- <N> --mesurer [--sans-fetch]` (la mesure).
- **Il ne s'écrit que par son outil** (utilisateur, 2026-10-07, #2460 : « Ca aurait du etre un json
  modifiable que via des outils adaptés, histoire d'éviter de faire n'importe quoi dessus, non ? ») :
  l'outil `mcp__harnais__suivi` (mod `harnais`) ou `npm run ops:suivi -- <N> --<geste> <args>…` (table
  des gestes de `scripts/ops/suiviDonnee.mjs`, arité fixe : un texte se cite en UN argument), plusieurs gestes
  par appel ou `--lot <json>`, appliqués TOUT OU RIEN, sous verrou ; `--creer <titre>` ouvre une vague
  neuve. La garde `suivi-ecriture` refuse toute autre écriture, et un suivi édité à la main se relit
  « écrit hors de l'outil » : seul `--reconnaitre <motif>`, EN TÊTE de lot, le re-scelle, et il pose
  d'office un signalement « écrit hors de l'outil, reconnu le <date> » ; un suivi hors schéma reste illisible.
- **Il tient dans son BUDGET** (`BUDGET_DU_SUIVI` = `PLAFOND_INJECTION`, sur le plan complet) : un lot qui
  le dépasse ET grossit est refusé avec ses gestes de condensation candidats (`--retirer-item`,
  `--retirer-etape`, `--retirer-signalement`) ; un lot qui réduit, ou qui condense puis ajoute, passe.
- **Il est CONFRONTÉ à la mesure à chaque lecture** (`confronter`, `scripts/ops/suiviDonnee.mjs`) : en
  ligne 1 du bandeau, ⚠ suivi illisible ou hors outil, mesure absente, PÉRIMÉE ou portée changée — le
  lecteur ne mesure jamais, il demande la re-mesure (`aMesurer`), que le mod `harnais` lance
  (`--mesurer --sans-fetch`, verrou de mesure : une seule à la fois) ; côté Codex, `ops:suivi -- <N>
  --mesurer` à la main. Puis « anomalies : k — … » : ticket fermé d'un item ouvert (ou item clos, ticket
  ouvert), chantier vivant qu'aucun suivi ne nomme, prochain geste « à revalider », hors budget,
  anomalies de la mesure (les récurrentes en une ligne), disposition sans objet. Une anomalie ACCEPTÉE se
  tait par `--ignorer-anomalie <genre> <clé> <motif>` (`--lever-disposition` la rend) ; les autres se
  corrigent. La ligne d'item dit « lot publié le <date>, ticket ouvert » ou « clos » selon la mesure.
- **Un ticket prévu = un item** (`--ajouter-item <ticket> <libellé>`, ou `--enfiler` en file puis
  `--demarrer`), d'état `actif | attente | gare | clos` ; ses étapes (`--ajouter-etape <ticket> <texte>`,
  `--cocher <ticket>.<n>`) s'écrivent AU FIL DE L'EAU — dispatch, verdict, commit, publication — et se
  rendent numérotées `#<ticket>.<n>`. Aucun état de branche, d'issue ou de publication n'y est saisi :
  la mesure (`<N>.mesure.json`) le porte.
- **À la FERMETURE d'un ticket**, ses arbitrages utilisateur partent au TICKET, verbatim et datés, PUIS
  son item passe `clos` et se condense (`--condenser <ticket> <résumé>` : ce qui a été publié, sha et
  pointeurs). Le suivi reste un PLAN.
- **Le task-tracker n'est qu'un miroir de session**, jamais une source : ce qu'il porte et que le suivi
  n'a pas est perdu à la reprise.
- **L'épique porte le design validé** en commentaire daté VERBATIM ; un ticket par lot (gabarit #101+,
  labels, Bloqué par / Débloque, DoD mesurable). Le commentaire de pilotage d'épique n'est qu'une
  PROJECTION du suivi, postée à la publication — jamais relue comme état.
- **Un brief de codeur est un commentaire DATÉ du ticket du chantier**, jamais un fichier sous `docs/`.

## Cycle

**0. Audit de DoD d'abord.** Vague qui reprend des tickets « déjà livrés » → un `juge` relit le DoD MOT
À MOT, preuve par point, AVANT le travail : le constat réordonne la vague et sort les dépendances
jamais écrites. Fermer sur « déjà implémenté » ou « documenté » appelle la même relecture.

**1. Grounding.** Sweep de 3+ fichiers → `lecteur` ; 1-2 lectures ciblées inline = OK. La décision
d'archi reste dans mon fil, **primitives cibles NOMMÉES avant tout code**. Mon grounding est fort en
LARGEUR et faible en PROFONDEUR sur le `Source/` : l'ouvrir moi-même est ma pratique au meilleur
rendement. Tout ticket de plus de 30 jours est RÉ-INSTRUIT par un `lecteur` avant dispatch. Vague
transversale → paragraphe de DESIGN (invariant, qui possède quoi, critère « N+1 = une ligne ») attaqué
par un juge AVANT le premier codeur ; deux passes sur la même classe = défaut de design, remonter d'un
niveau.

**2. Brief.** Périmètre de fichiers exact, primitives cibles nommées, réfs RAW nues (`LDB 13 l.142`),
chemin ABSOLU du worktree, interdit de tout `git checkout/restore/reset/stash/add/commit`, « rendu
final = données brutes », et un **BUDGET D'HORLOGE + UN livrable** (juge de diff 30 min, corrections
45 min, lot 2 h : rendre à l'échéance ce qui est fait, le reste NOMMÉ) — un budget écrit n'est pas une
borne, la borne est un `Monitor` sur l'horloge + `TaskStop`.
- **Socle → trois sections, le codeur REFUSE sinon** (`.claude/agents/codeur.md`) : `## Invariant`
  (verbatim + source + la QUESTION à laquelle il répondait), le CAS CANONIQUE déjà couvert
  (`fichier:ligne`) + la preuve que le nouveau cas en est une INSTANCE, pas une variante à branche,
  `## Design jugé :` (un agent `juge` dépêché juge le design, son rendu est cité au brief).
- **Le brief ne liste PLUS les tests du périmètre** : il prescrit `npm run test:perimetre`, qui les
  dérive des fichiers touchés (#2400).
- **Un brief POSE les questions, il ne les pré-répond pas** : toute classification que l'agent peut
  établir (provenance d'une règle, existence d'un consommateur, état d'un fichier) se demande en
  SORTIE, citation exigée. Le banni est l'affirmation NON citée ; citation verbatim, réf RAW nue, ligne
  de `package.json` ou sortie de sonde collées restent vérifiables, donc légitimes.
- **Toute RÈGLE affirmée porte sa CITATION VERBATIM** : le brief a force de CONSIGNE et finit recopié
  en commentaire dans le dépôt. Le grounding de SECONDE MAIN est le danger — un rendu d'agent n'est pas
  une source ; recyclé dans un brief, il gagne l'autorité qu'il n'a jamais eue.
- **Une citation prouve ce qu'elle RÉPOND** : en position de justification (limitation, absence,
  simplification), reconstruire la paire — à quelle question la phrase répond DANS SON CONTEXTE (lire
  avant/après ; la troncature à la ponctuation est la variante vicieuse) contre celle que le code lui
  fait porter. Différence = ÉTIRÉE. Étalon : `src/engine/conditions.ts`.
- **Tout pointeur s'écrit DÉRÉFÉRENCÉ** : `#N` avec son titre recollé de `gh api
  repos/{owner}/{repo}/issues/<N> --jq .title`, lib prescrite avec sa ligne de `package.json`, « bloqué par <externe> » avec sa sonde
  d'absence collée. **Toute affirmation d'ABSENCE porte sa sonde ET son périmètre** — « aucun X » est
  irrecevable, et deux mesures ne se confirment que si leurs MÉTHODES DIFFÈRENT. Un diagnostic s'écrit
  en HYPOTHÈSE À RÉFUTER avec sa sonde discriminante : le fix que je prescris peut être faux aussi.
- **Un brief de juge ne prescrit JAMAIS de mutation**, ni dans l'arbre, ni sur une copie ou un dépôt
  jetable : la preuve par mutation est au codeur (`.claude/agents/codeur.md`), le juge la vérifie et
  rejoue les tests.
- **UI** : nommer AUSSI la couche atomique — aucun élément nu (`<button>` → `.btn`/`.chip`/primitive,
  conteneur → `.panel`, focusable custom → focus maison) ; citer `docs/primitives.md` +
  `docs/charte-ui.md`.
- **Mise aux normes** : « la zone touchée sort AUX NORMES — nommage COHÉRENT (un concept = un terme),
  duplication adjacente mutualisée ou ticketée, morts adjacents purgés » ; tout juge de cumul porte la
  lentille jumelle de la LANGUE, pas seulement de l'architecture. Un lot qui touche un CHAMP embarque
  TOUTES les conventions de ce champ.
- **Tout compromis de TRANSITION** (shim, branchement gardé) s'inscrit au REGISTRE DES FOSSILES du
  ticket-mère à sa création, avec la phase qui le tue ; le cliquet de migration meurt dans le commit de
  la dernière démolition — une garde qui nomme l'ancien monde est un test-tombale.

**3. Dispatch.** L'effort de chaque étage est MAÎTRISÉ, jamais subi : Workflow `agent()` (`model` +
`effort` par appel), tool Agent (`model` seul — l'effort vient du frontmatter du type, sinon HÉRITE de
la session : ultracode = xhigh silencieux), définition épinglée. Workflows lourds SÉQUENTIELS (en
parallèle : rate-limit, finders morts). Un type qui hérite tous les outils (`tools:` omis) porte
`disallowedTools: Agent, Workflow`, sinon il se re-délègue sa mission à l'infini. **UN juge par
jugement** (design, diff, fermeture) : les lentilles tiennent dans un seul prompt nourri du grounding
déjà écrit, il ne re-mesure que ce qu'il conteste ; un workflow multi-agents ne se justifie que sur des
travaux DIFFÉRENTS aux entrées différentes, jamais pour multiplier les regards sur la même entrée.
**Un train = 4 ou 5 gestes au plus** : le codeur rend le diff → je committe sur la branche du worktree
→ je pousse la branche, dont le run CI joue les gates → juge de diff en parallèle → corrections en
train court.

**4. Isolation.** Agent qui MUTE des fichiers pendant qu'une session // est active →
`isolation: "worktree"` (créé sur `origin/main`, `npm ci` + `npm --prefix server ci`) ; à défaut
committer au retour. **Les recetteurs sont un étage SÉQUENTIEL** : jamais deux en vol (même serveur
dev, même navigateur — clics croisés, captures polluées).

**5. Attente et reprise.** Un agent background n'est PAS fini avant sa `<task-notification>` : ne pas
lire ni tester son WIP. Avant de relancer un agent mort, vérifier le CONTENU du livrable (le symbole,
la garde, le slot existe-t-il ?), jamais `git status` — un arbre propre confond « rien fait », « déjà
committé » et « fait dans un autre worktree » ; le brief de relance porte l'état VÉRIFIÉ et daté et dit
« si le livrable existe déjà, PIVOTE en revue ». Tout geste POSTÉRIEUR à une mesure la périme : le
rendu d'un agent repris (stall, watchdog) porte des TESTS de périmètre PÉRIMÉS, je rejoue
`npm run test:perimetre` avant de committer.

**6. Vérification — par MOI, jamais sur la foi du rapport.** Typecheck complet et `npm run test:perimetre`
avant commit — la suite complète est jouée UNE fois par le run CI de la branche, jamais en local avant
commit ; revue du diff, UI → skill `recette-navigateur`. Deux suites complètes simultanées sur la
machine = effondrement de contention : les suites lourdes se SÉRIALISENT, ping inter-session avant
lancement.
- ⚠ **Les portes machine sont un PLANCHER, jamais un signal de correction** : sur une session mesurée,
  typecheck + suite ont attrapé 0 des 10 trouvailles (toutes prises par sonde ou recette). « Portes
  vertes » ne se dit jamais « vérifié ». La classe « mécanique juste, chemin absent » est invisible à
  qui regarde le diff : **tout lot qui ajoute une donnée ou une mécanique NOMME sa PORTE** — le geste
  joueur qui l'atteint — dans son DoD, et la recette la traverse (donnée écrite jamais tirée = dette,
  garde `src/data/tables.test.ts`).
- **Les CLAIMS ARCHITECTURAUX se contre-grep comme des faits** (« X est le seul seam », « la primitive
  n'existe pas ») : des tests verts sur un câblage PARTIEL ne révèlent jamais la surface oubliée.
  Exiger la SORTIE BRUTE des portes au rendu — un exit code allégué est fabriqué.
- **Toute trouvaille établie par une SONDE : la sonde est promue en test committé dans le commit de
  fix**, sinon le jugement reste un consommable.
- **Livraison d'ÉCRAN → trois passes** : recette fonctionnelle (DoD), jugement d'écran (captures →
  juge en lentilles : charte/primitives, hiérarchie-densité, cohérence inter-écrans, « prototype ou
  produit ? » — défauts concrets, jamais des scores), lisibilité si du style a bougé. Sur un
  sous-système, audit adversarial : un raccourci qui « borne le reste » est un défaut, pas un choix.
- **Outillage qui MENT** : `ctx_search` rend un faux « 0 match » quand il s'arrête au budget de temps
  (le message le dit) ou saute les gros fichiers — une absence se recoupe par `git grep` ;
  `Measure-Object -Line` (PowerShell) ne compte pas les lignes vides — `wc -l` ou `git grep -c ""` ;
  `npm run typecheck:fast` est incrémental sur un tsbuildinfo PARTAGÉ entre sessions
  (`scripts/typecheck-fast.mjs:37-38`) — au doute, la porte complète `npm run typecheck`
  (script `typecheck` de `package.json`, `--incremental false`) ;
  le hook `read-dedup` rend un faux « unchanged since last read » sur un
  fichier JAMAIS lu (`ctx_read(mode=raw, fresh=true)`) ; un agent d'art à qui `Read` d'une image est
  refusé relance `node C:/Users/gauch/.claude/fix-leanctx-settings.mjs`.

**7. Push.** Le verdict d'une suite en fond se LIT puis se DÉCIDE — jamais un `tail … && git push` (le
tail sort 0 quel que soit le rouge). La branche `chantier/**` se pousse LIBREMENT : son run CI
(`.github/workflows/ci.yml`, `push.branches`) joue les mêmes gates que `main`, une fois. **Après CHAQUE
push de branche, attendre son run EN FOND** par `npm run ops:ci -- --attendre` (`run_in_background` ou
`Monitor`), qui sort sur le verdict du sha poussé avec un code par verdict et, sur un rouge, les tests en
échec de chaque job rouge ; `npm run ops:ci -- --echecs <run>` relit ceux d'une course nommée — jamais
un `gh run` ni un `sleep` à la main. Un rouge de branche ne bloque que cette branche, et se rejoue
localement gate par gate (`npm run gates -- --gates <noms>`). `main` n'avance que par la FILE DE FUSION, où `ops:publier` fait entrer la PR de la branche
(étapes `pr` puis `file`), et le ruleset serveur refuse tout le reste. Un train `--detache` se suit par la
commande `veille=` qu'il imprime (`Monitor`), jamais par un filtre de son log : COMPOSITE, la veille puis
son constat (`… --veiller <run>; … --veiller <run> --constat`), elle sort sur un code de verdict (0, 1, 3, 4,
5), jamais 127 ; ré-armée, `… --veiller <run> --depuis <dernier #seq>; … --veiller <run> --constat`.
Migrations : le job `migrations` de `ci.yml`
les joue sur la branche, aucun rejeu local. Au retour de chaque agent, vérifier qu'il ne laisse aucun
processus derrière lui.

**8. Fermeture.** Toute vague qui ferme des tickets se termine par une **passe de réfutation NON
demandée** (« tente de réfuter cette fermeture sur pièces ») AVANT toute annonce ; l'annonce porte les
VERDICTS (TIENT / FRAGILE / RÉFUTÉ), jamais un score. Périmètre = les DÉCISIONS de la vague :
fermetures, splits (prémisse vérifiée ?), claims d'agents, écarts consignés non ticketés, les
ABSTENTIONS (« bloqué / dépendance externe » → question inversée « prouve que le blocage n'existe
pas », une sonde d'existence suffit, étage `verif-mecanique`) et MES PROPRES COMMITS (gates, hooks,
glue : le canal « trivial » est le seul que personne ne relit). Ces règles se DURCISSENT sous pression
de temps, elles ne s'y suspendent pas.
- **Chaque clôture de phase : passe de juge « ARCHITECTURE À REBOURS »** — si on partait de zéro avec
  la cible d'aujourd'hui, cette couture existerait-elle ?
- **C'est le TRAVAIL qui se ferme, pas le ticket.** Une fermeture qui émettrait PLUS D'UN ticket de
  reste n'est pas fermable : le lot GROSSIT, ou le ticket RESTE OUVERT sur ce reste (le sas
  « réserve / hors périmètre » est EXCEPTIONNEL). Tout reste naît rattaché à une VAGUE NOMMÉE.
  « LIVRÉ » exige des restes soldés ou GELÉS par un arbitrage utilisateur daté. Une vague ferme au
  moins autant de tickets qu'elle en ouvre.
- Un ticket que J'ÉCRIS sur un socle porte son `## Invariant` comme un brief ; une question qu'il pose
  se confronte D'ABORD à la chaîne d'invariants (tickets-programmes, fiches doctrine) : si une doctrine
  répond, le ticket ÉNONCE — il ne « réserve » pas une décision produit.

## Régime de vague et d'épique

**Un orchestrateur qui a des tickets ne s'arrête pas** (utilisateur, 2026-08-31 : « Un orchestrator
n'arrete jamais tant qu'il a des tickets a traiter »). Un « bilan » est un point d'étape ENTRE deux
dispatchs : dès que tous les agents sont rendus, l'action suivante est de dispatcher le prochain lot
ancré, ou de NOMMER le blocage réel (quota, validation utilisateur, charge machine).
- **Un lot fait 10-12 tickets d'un MÊME domaine** : la cérémonie de vague coûte ~5-6 h FIXES.
- **Validation utilisateur = ASYNCHRONE** : le lot en attente de goût se PARQUE (worktree conservé,
  capture prête, question consignée), la vague CONTINUE — jamais gelée entière. En ABSENCE, dispatcher
  ce qui n'appelle aucun goût (données, gardes, ré-instruction) ; écrans et arbitrages en PRÉSENCE.
- **Checkpoint avant épuisement de quota** : suivi de vague à jour (`npm run ops:suivi -- <N>`),
  tickets commentés.
- **Épique : pas de salve d'ouverture** — premier lot + index des phases EN PROSE, les enfants naissent
  à leur vague. Pas de checklist dans le corps (elle meurt toujours) : le plan et l'ÉTAT vivent dans le
  suivi de vague, la STRUCTURE dans les sous-issues (épique → famille → tickets). Une vague d'épique
  fait DÉCROÎTRE le compteur qu'elle vise.
  Épique muette depuis 14 jours sans label `gelée` = anomalie à SIGNALER.
- **Métriques**, à l'ouverture de session et au moins une fois par SEMAINE, écrites dans le suivi de
  vague : travail restant, croissance nette (cible ≤ 0), orphelins et balance par vague, mesurés par
  `npm run ops:stock-issues` ; part des fermetures dépilant du stock de plus de 28 jours (≥ 50 %),
  résorption des restes (≥ 60 % sous deux semaines). Deux semaines sans mesure = anomalie à signaler.

## Calibrage

| Étage | Type (`.claude/agents/`) | Modèle | Effort |
|---|---|---|---|
| Lecture / comparaison de masse | `lecteur` | sonnet | medium |
| Vérification mécanique (existence, famille) | `verif-mecanique` | haiku | low |
| Code sous spec précise | `codeur` | opus | medium |
| Jugement dur (réfutation, synthèse de verdicts, archi) | `juge` | opus | high |
| Rédaction fidèle au Source (fiches, synthèses de règles) | `lecteur` | opus | medium |
| Art vectoriel sur le rig SVG | `artiste` | opus | medium |
| Recette navigateur en joueur | `recetteur` | sonnet | medium |
| Joueur cloisonné de table simulée | `joueur` | sonnet | low |

**Workflows multi-agents (sur opt-in « ultracode »)** : bons pour la **donnée/extraction/vérification**
(audit de fidélité des règles, extraction d'un livre en dossiers, sprites depuis l'art officiel par
lecture d'image), pas l'art à l'aveugle.

Préférer ces types (modèle + effort épinglés) à `general-purpose`, qui hérite l'effort de session.
**JAMAIS Sonnet en effort haut/xhigh** : plus cher qu'un Opus medium. La cérémonie se calibre à la
taille et au risque RÉELS, pas au flag ultracode : petite feature testée → 1 codeur + gates, sans
fan-out ni reviewer dédié ; tâche large ou incertaine (audit moteur, migration, extraction massive) →
workflow ; reviewer adversarial réservé aux régressions silencieuses possibles et à l'art. Un arbitrage
utilisateur nécessaire → couper la boucle et poser les questions GROUPÉES, jamais les parquer dans une
spec.
