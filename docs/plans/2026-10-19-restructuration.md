# Restructuration : des couches à frontières tenues, un noyau de règles appelable par tout hôte (2026-10-19)

Ticket: #2882

> **Plan DATÉ du 2026-10-19** (politique `docs/` de `docs/architecture.md`), à supprimer une fois
> l'épique fermée. Le code et `docs/architecture.md` font foi sur l'état courant.

## 1. Qualification

Demande de Clément, verbatim (2026-10-19) : « Ok. D après le fil sur le nouveau moteur mais aussi sur
les guards et surement d autres tickets, il faudrait modifier la structure du projet. Vu qu on a plus
grand chose qui tourne, on peut se lancer sur ça ? Vu l'ampleur du travail, suivre les recommandations
certif serait une bonne idée ». Constat qu'il avait posé : le projet permet à n'importe quel agent de
se brancher où il veut et de créer de la dette.

- **But réel.** Trois buts, une même structure :
  1. qu'un branchement hors du chemin prévu soit refusé par le lint ou le compilateur, pas mesuré par
     une garde (#2724) ;
  2. que les règles et leur orchestration survivent à la bascule vers Godot, décidée le 2026-10-19
     (#2794, carte « Migrer vers Godot », conséquence affichée : « J'ouvre le plan de migration
     progressive, en commençant par #2817, et le jeu actuel reste jouable jusqu'à la bascule. ») ;
  3. que le jeu actuel reste jouable pendant toute la migration.
- **Livrable.** Ce plan ; une épique à vagues (modèle #2561 : label `épique`, une sous-issue native
  par vague, née à sa vague, index des phases en prose) ; la vague 1 livrée par PR.
- **Critère de fini de l'épique.** (a) une table des zones unique et fermée, tenue par le lint, égale
  à la cible du §3.1 ; (b) l'orchestration des règles appelable sans store ni React, prouvée par le
  graphe d'import et par le pont Godot qui l'appelle à la place de ses copies ; (c) `src/state` réduit
  à l'adaptateur du store web, sans règle ; (d) le compte des modules de garde décroît, solde chiffré à
  la fermeture ; (e) l'hôte Godot vit dans le dépôt, sous CI.
- **Contraintes déjà tranchées.** Décision Godot (ci-dessus) ; credo (zéro dette, structure avant
  garde, réutiliser le canonique) ; règle 3 d'`AGENTS.md` (`src/engine` pur) ; doctrine de #2724
  (une conversion = la structure + la suppression de la garde, de son stock et de son test dans le même
  commit) ; « Il n'est pas interdit de bouger le code mal placé en tout cas. » (2026-10-18).
- **Irréversible.** Rien dans cette épique : tout passe par branche, PR et file de fusion. La bascule
  elle-même (retrait de l'hôte web) relève de #2794 et attendra la décision de Clément.

## 2. État mesuré (HEAD `8c69a827a`, 2026-10-19)

Mesures : matrice d'import des fichiers non-test de `src/` (une paire fichier → zone comptée une fois,
valeur et type séparés), recoupée par une lecture indépendante et par un juge (sonde oxc-parser).

- **Murs de couche existants** (`oxlint.config.mjs:202-240`, `:643-665`) : trois listes `AVALS_ENGINE`,
  `AVALS_DATA`, `AVALS_STATE`, lues par `murs/purete-imports` (alias de `no-restricted-imports`,
  `scripts/guards/lib/mursLint.mjs:15`). `engine` n'importe ni `state`, ni `ui`, ni `gameIso` en
  valeur ; `data` non plus ; `state` n'importe pas `ui` en valeur ni `gameIso` du tout. Aucune autre
  zone n'a de mur, et aucune règle ne déclare l'ensemble des zones : `src/foo/` peut naître sans que
  rien ne le voie.
- **Arêtes d'aujourd'hui contraires à la cible** (fichiers, valeur / type) : `scenes → state` 42 / 44,
  vers 13 modules (`mapSpec` 38, `flow` 20, `campaignNarratif` 3, `worldMap`, `encounterAuthoring`,
  `shipPostes`, `projectLibrary`, `relief`, `asciiMap`, `terrain`, `seating`, `footprint`, et `scene`
  4 en valeur) ; `audio → state` 2 (`audio/music.ts:9` lit `isIndoor` de `state/scene` ;
  `audio/wiring.ts:10-11` lit le bus et le store) ; `net → state` 1 (`net/intents.ts:27`, la table des
  intents du store) ; `data → state` 1 / 5 ; `data → gameIso` 0 / 3 ; `engine → gameIso` 0 / 1
  (`src/engine/types.ts:1855`) ; `scenes → ui` 0 / 1 ; `gameIso → ui` 12 / 5.
- **Cycles de zone en valeur** : `state ↔ net` (`state/netFlow.ts` ↔ `net/intents.ts`), `state ↔ audio`
  (`state/combatEffects.ts:63`, `state/validateScene.ts:26` ↔ `audio/music.ts`, `audio/wiring.ts`),
  `state ↔ scenes` (`state/devtools.ts:108-109` ↔ les 42 ci-dessus).
- **Dérogations au site.** 33 directives `disable` visent un mur dans des fichiers de production
  (24 `marques`, 5 `ordre-total`, 2 `ordre-total-locale`, 1 `conteneur`, 1 `purete-imports` à
  `src/data/props.types.ts:45`). Elles sont bornées par le vocabulaire `MURS_EXEMPTABLES_AU_SITE`
  (`scripts/guards/lib/mursLint.mjs:6`) et la garde `scripts/corpus/guards/directivesMurs.test.mjs` ;
  leur résorption est déjà planifiée par #2864 (lots 2b, 2c, 2d de #2724).
- **Aucune surface publique** : ni `src/state/index.ts` ni `src/engine/index.ts`. 132 des 199 fichiers
  non-test de `src/state` sont importés hors de `src/state` ; `store.ts` par 151 fichiers, `scene.ts`
  par 123.
- **L'orchestration dépend du store par son type.** `combatFlow.ts` (8 668 lignes) n'importe le store
  qu'en type ; son état passe par le couple `Get`/`Set` (`src/state/flowTypes.ts:9-13`), typé par
  `GameState` (`src/state/store.ts:384`). Un hôte qui veut résoudre un coup doit fabriquer un
  `GameState` entier.
- **Registres ouverts par effet de bord** : `registerCascadeApplier` 116 appels dans 28 fichiers,
  `registerCombatHook` 18, `registerNightBandApplier` 17, `registerSequence*` 26, `registerCloture` 10
  (`combatEffects.ts:737`, cause du `ReferenceError` d'ordre d'import relevé par #2817). N'importe quel
  fichier qui importe un registre peut s'y ajouter. L'application d'une attaque passe par
  `fireTriggers` (`src/state/triggeredEffects.ts:480`, qui prend `Get`) et par la cascade
  (`src/state/cascade.ts:110`).
- **Gardes** : 188 modules `scripts/guards/lib/*.mjs` hors tests, 87 tests `*guard.test.ts` dans `src/`,
  dont 31 à la racine de `src/`.
- **Pont Godot** (branche `poc/godot`, jamais fusionnée) : il importe 16 modules de `src/engine`,
  6 de `src/state` (dont `rollSeam`) et 1 de `src/ui` (`difficultyText`), et
  `import '../../../src/state/store'` pour l'ordre d'import (`poc/godot/pont/pont.ts:4-32`). Il a dû
  refaire sept morceaux de `src/state` (`docs/plans/2026-10-19-modale-attaque-godot.md` §53-61) ;
  aucune CI ne le couvre (friction 7).

## 3. Structure cible

### 3.1 Les zones et leurs sens d'import

| Zone | Rôle | Importe | Survit à la bascule |
|---|---|---|---|
| `lib`, `geometry`, `i18n` | feuilles | rien d'autre sous `src/` | oui |
| `engine` | règles WFRP pures | `data`, feuilles | oui |
| `data` | base app-owned et son chargement | `engine`, feuilles | oui |
| `noyau` (neuf) | orchestration pure : (état, intention) → (état, journal, événements) ; état de combat typé ; registres fermés ; le modèle du monde sous `noyau/monde/` | `engine`, `data`, feuilles | oui |
| `scenes` | contenu de campagne | `data`, `engine`, `noyau`, feuilles | oui |
| `web` (neuf) | services d'exécution du navigateur : minuteries, IndexedDB, stockage local, fichiers | feuilles | non |
| `net`, `audio` | services de l'hôte web | feuilles (`audio` : et `web`) | non |
| `state` | adaptateur du store web : pose le résultat du noyau, sélecteurs, persistance | tout ce qui précède | non |
| `ui` + `gameIso` | hôte web, une zone de présentation à deux dossiers | tout ce qui précède | non |
| racine de `src/` | entrée de l'hôte web (`main.tsx`) et tests transverses | tout | non |
| `hote` (neuf, vague 6) | module commun aux hôtes externes : validation des arguments, scénario par id, jetons programmés, projection | `noyau` par sa porte `src/noyau/index.ts`, `scenes`, feuilles | oui |
| `hoteTexte`, `hotes` (`hotes/`, hors `src/`) | hôte texte (MCP) ; hôte Godot : projet et pont TypeScript | les droits de `hote`, et `hote` | oui |

`noyau/monde/` (le schéma de scène et son modèle exécutable, la géométrie des pions, le chemin, la
ligne de vue, les zones) est un dossier de lecture, pas une zone : `COUCHES` ne le distingue pas du
reste du noyau.

Une zone qui survit à la bascule n'importe rien d'une zone qui n'y survit pas, même en type : seule
`state` lit `ui` en type seul, et la présentation n'importe pas la racine de `src/`. Les arcs de type
d'aujourd'hui contraires à cette règle sont des arêtes transitoires (§3.2).

### 3.2 Ce qui tient la structure

- **Une table, une seule source.** `COUCHES` (`scripts/guards/lib/couches.mjs`) remplace
  `AVALS_ENGINE`, `AVALS_DATA`, `AVALS_STATE` ; un seul mur `murs/purete-imports`
  (`scripts/guards/lib/couchesLint.mjs`) la lit pour tout `src/`, sur toutes les formes d'arc
  d'import, motifs d'`import.meta.glob` compris (`scripts/guards/lib/arcsDImport.mjs`, partagé avec
  `murs/interne`). Une arête
  d'aujourd'hui contraire à la cible y est déclarée de zone à zone (jamais par fichier), avec la
  sous-issue qui la retire ; cette sous-issue la retire de la table dans le commit qui la rend
  inutile. Le banc `src/eslint-ordre-total-et-purete.test.ts` lit la table sans la recopier : chaque
  zone nommée existe, chaque arête transitoire cite sa sous-issue, et chaque paire de zones rend, pour
  chaque forme d'import, le verdict de la table ; un oracle écrit à la main fixe le verdict de chaque
  classe de ligne. À l'ouverture, sept arêtes, toutes retirées par la vague 5 (#2884) :
  `scenes → state`, `audio → state` et `data → scenes` (le chargement des projets de campagne par
  `import.meta.glob`, `src/data/dev-validate.ts:17`), et quatre arêtes de type seul
  (`engine → gameIso`, `data → state`, `data → gameIso`, `scenes → ui`). La vague 2 en ajoute
  trois : `noyau → state` en type seul (les types du store, de `flowTypes`, de `stateFields` et de
  trois flux), retirée par la vague 4 (#2889) avec le dernier flux migré ; `audio → noyau`
  (`audio/music.ts` lit le schéma de scène) et `data → noyau` en type seul, retirées par la vague 5.
  Seule dérogation au site : l'arc de valeur de `src/data/props.types.ts` vers `noyau/monde/dir8`,
  dont #2864 (lot 2d) a la charge.
- **Un ensemble de zones fermé.** Une règle neuve `murs/zone`, lue sur le nom du fichier (patron de
  `scripts/guards/lib/interneLint.mjs`), refuse un fichier de `src/` dont la zone n'est pas dans
  `COUCHES` : créer `src/foo/` demande d'écrire sa ligne.
- **Une entrée unique pour les hôtes externes.** `src/noyau/index.ts` naît avec la première fonction
  qu'un hôte externe appelle (l'attaque, vague 3) et reste la seule surface du noyau qu'un hôte
  externe importe. Amendé à la vague 6 (plan `docs/plans/2026-10-21-vague6-hote-godot.md`, B7) : ce
  n'est pas un mur lexical à part mais une ligne de `COUCHES`. `hotes` est une zone de la table, au
  dossier `hotes/`, et les hôtes externes (`hoteTexte`, `hotes`) partagent une seule ligne de droits,
  celle du module commun `hote` plus `hote` lui-même ; la porte du noyau y est `src/noyau/index.ts`. Les zones de `src/` importent les modules du noyau selon
  `COUCHES`, sans porte : une porte réexposerait quelque 400 symboles à 258 importeurs, tous dans des
  zones qui ne survivent pas à la bascule sauf `scenes`. Il n'y a pas de `noyau/interne/`.
- **Des registres fermés.** Dans le noyau, un registre est une table statique typée par une union
  fermée (une entrée manquante ne compile pas), jamais un `registerX()` appelé à l'import.
- **L'état de combat appartient au noyau.** Son type sort de `store.ts` ; `GameState` le compose. Le
  couple `Get`/`Set` disparaît des flux migrés : une fonction du noyau rend un nouvel état,
  l'adaptateur le pose.
- **Aucune dérogation au site, à terme** : `MURS_EXEMPTABLES_AU_SITE` se vide par #2864, et la garde
  existante refuse alors toute directive. Aucune règle neuve n'est écrite pour cela : une règle qui
  lirait les commentaires se ferait taire par une directive qui la nomme (sonde du juge, oxlint 1.86
  sans `noInlineConfig`).

### 3.3 Hypothèses (révisables)

- **H1. Le noyau est une zone distincte de `src/engine`.** `engine` reste la bibliothèque de règles
  pures sans état ; le noyau enchaîne ces règles sur un état de combat. Cela répond à la première
  question de design de #2817, à confirmer par son paragraphe de design.
- **H2. Gel structurel de `ui` et `gameIso`.** Ces deux dossiers seront remplacés : on n'y investit
  aucune restructuration, et les gardes de #2724 dont tout le périmètre est dans `ui` ou `gameIso`
  restent en l'état jusqu'à la bascule, où elles partent avec leur code. Les fonctionnalités
  continuent : le gel porte sur la structure, pas sur le jeu. Amendement de la DoD de #2724, consigné
  sur #2724.
- **H3. La migration de l'orchestration se fait flux par flux**, chaque flux migré entièrement dans sa
  vague : le jeu passe par la fonction du noyau et la copie de `src/state` est supprimée dans la même
  PR, jamais deux implémentations d'une même règle.
- **H4. `lib` est une feuille pure.** Les services d'exécution du navigateur (`minuteries.ts`,
  `indexedDb.ts`, `stockageWeb.ts`, `fileIo.ts`, et `fsPersist.ts` de `data`) forment la zone `web`
  depuis la vague 2 ; le noyau ne la lit pas.

### 3.4 Question reportée

Le Compendium, l'atelier de cartes et les galeries de contrôle restent-ils web après la bascule, ou
partent-ils aussi dans Godot ? Posée à Clément le 2026-10-19, qui a répondu : « Je ne serais répondre à
ta question ni ce que cela implique ». Elle revient, avec des exemples concrets, avant la vague 6 ;
aucune séparation de `src/ui` n'est prévue d'ici là. Les vagues 1 à 5 n'en dépendent pas.
Posée de nouveau à laurent le 2026-10-21 sur une carte ; il a choisi « Plus tard », dont la
conséquence affichée est : « On migre d'abord l'écran de jeu, et on tranche quand le premier écran
Godot tourne. » La vague 6 n'en dépend pas.

## 4. Vagues

Méthode du guide de certification : cadrage et plan jugé avant tout code (3.4) ; vagues prévisibles en
suite fixe, chacune vérifiée, et décomposition adaptative pour la vague 4, dont le contenu dépend de ce
que les vagues 2 et 3 découvrent (1.6) ; exploration par sous-agent en lecture seule, trouvailles
écrites (5.4) ; une frontière tenue par un mécanisme déterministe plutôt que par une consigne.

1. **Vague 1, carte des couches** (#2883). `COUCHES`, à la place des trois listes `AVALS_*`, avec un
   seul mur pour tout `src/` ; la règle `murs/zone` ; `ui` et `gameIso` en une zone ;
   `net/intents.ts` (la table des intents du store) rejoint `src/state/`, ce qui retire le cycle
   `state ↔ net` ; `audio ↔ state` reste déclaré jusqu'à la vague 5 ; `docs/architecture.md` et
   `docs/recette-navigateur.md:1708` suivent dans le même commit. Aucun fichier chaud (`combatFlow.ts`,
   `rollSeam.ts`) ni fichier de la PR #2797. Preuve : lint vert, banc de `murs/zone` sous mutation
   (une zone non déclarée et un sens interdit rougissent), test de contrat positif sur `COUCHES`,
   typecheck complet, suite.
2. **Vague 2, la place du noyau** (#2888), en trois lots. Le lot 2a coupe les arcs de valeur qui
   faisaient entrer un fichier d'hôte dans la fermeture d'import de `fireTriggers` et de la cascade.
   Le lot 2b ouvre `src/noyau/` (orchestration) et `src/noyau/monde/` (modèle du monde) avec les
   modules dont la fermeture en valeur n'atteint aucun fichier d'hôte, ouvre la zone `web`, et fait
   refuser par `murs/purete-imports` tout arc de valeur `noyau → state`. Le lot 2c remplace
   `combatEffects → audio` par un événement que l'hôte joue. La vague ne rend pas `fireTriggers` ni la
   cascade exécutables sans hôte : leur comportement est complété à l'exécution par des crochets et
   registres posés depuis `src/state`, inventoriés au corps des tickets de la vague 3 (#2817, l'attaque)
   et de la vague 4 (#2889, les flux restants), qui les ferment flux par flux (H3).
3. **Vague 3, attaque** = #2817, rattaché ici. Résolution et application d'une attaque (tous les gestes
   du tableau de #2817), défense automatique, registres de combat (`registerCloture`,
   `registerCombatHook`, `registerHitModifier`, les appliers de cascade du combat). Les crochets que le
   combat pose sur le noyau deviennent des paramètres ; les dés (`battleRng`), la cadence et la
   configuration des règles maison deviennent des entrées fournies par l'hôte, pour qu'un hôte montre
   ses propres dés. C'est une déduction d'ingénierie, tirée de la question de Clément du 2026-10-19 :
   « Si je veux automatiser foundry je pourrais presque le brancher dessus ? ». `src/noyau/index.ts`
   naît ici.
   Elle absorbe les items de la vague 3 de #2724 dont
   les sites sont dans le code qu'elle déplace (dont #2763 et `targeting-holder-vs-mode`), nommés au
   paragraphe de design ; les autres (couture `rollSeam`, `SeamRng`, `setScan`, `sceneMutation`…)
   restent à #2724.
4. **Vague 4, autres flux** (#2889). Sorts, tests simples, manœuvres, entretien de fin de round,
   voyage, avec leurs crochets et registres. Une sous-issue de #2889 par famille, ouverte quand la
   précédente fusionne. Le dernier flux migré retire l'arête de type `noyau → state`.
5. **Vague 5, contenu hors du store** (#2884). Le schéma de scène est au noyau depuis la vague 2
   (`src/noyau/monde/scene.ts`) ; la vague en extrait vers `data` les types du schéma que `data` et
   `engine` lisent, et les modules que `src/scenes` importe encore dans `state` vont au noyau ;
   les types que `data` et `engine` lisent dans `state` et `gameIso` (`src/data/index.ts:9,20,23`,
   `materials.types.ts:14-16`, `terrains.types.ts:13`, `schemas/defs-scenes/effets.ts:26`,
   `registres-narratifs.ts:16`, `sortsFusionnes.ts:1`, `src/engine/types.ts:1855`,
   `src/scenes/test-scenarios/_shared.ts:6`) sont rapatriés ; `scenes → state`, `audio → state`, `audio → noyau` et `data → noyau`
   sortent de la table. Après la fusion de #2797 (Taverne), qui touche le schéma de scène.
6. **Vague 6, hôte Godot dans le dépôt.** `hotes/godot/` reprend le projet et le pont de `poc/godot`,
   sous CI (typecheck et tests du pont) ; le pont n'importe du noyau que `src/noyau/index.ts`, ce
   que tient la ligne `hotes` de `COUCHES` (§3.2, amendée) ; il partage avec l'hôte texte le module
   commun `src/hote/` ; GDScript ne garde ni IA, ni chemin, ni carte ; ses sept copies de
   `src/state` sont supprimées, et ce qu'il prend à `rollSeam` et `ui/difficultyText` passe par le
   noyau (coordination avec #2724 et #2778). La suite (écrans un par un) appartient à #2794.
7. **Vague 7, solde.** `src/state` ne contient plus de règle ; `COUCHES` égale la cible ; compte final
   des gardes et des lignes de stock comparé à l'ouverture (188 modules, 87 tests-gardes) ;
   `docs/architecture.md` à jour.

## 5. Articulation avec les tickets existants

- **#2794** (migration Godot) : parent de cette épique, dont elle est la phase de fondation. La
  migration des écrans reste dans #2794.
- **#2817** : devient la vague 3, sous-issue de cette épique (re-parenté depuis #2794, qui reste
  grand-parent).
- **#2724** (gardes vers structure) : reste son épique. Sa vague 3 se partage comme dit à la vague 3
  d'ici ; ses lots sur `engine`, `state`, `data`, `scripts` continuent ; #2864 garde la résorption des
  dérogations au site, dont `state/dir8` (lot 2d) ; ses lots dont tout le périmètre est dans `ui` ou
  `gameIso` suivent H2.
- **#2778** (Difficultés en données) : orthogonale (la valeur lue dans la donnée sert aussi Godot) ;
  coordination par fichiers quand un lot touche un flux en migration.
- **#1463** (cohérence structurelle des datasets) : couche `data`, orthogonale.
- **#2797** (PR ouverte, Taverne) : aucun fichier commun avec la vague 1 ; la vague 5 l'attend.

## 6. Hors périmètre

- La réécriture des écrans dans Godot, la coquille commune des jets, l'art 3D (#2794).
- Le découpage en paquets npm (`workspaces`, `exports`) : `COUCHES` et le mur lexical des hôtes
  externes tiennent la même frontière sans déplacer 3 000 fichiers ni réécrire les chemins des
  gardes. À réévaluer si un mur se révèle contournable.
- Les erreurs de `noUncheckedIndexedAccess` et `exactOptionalPropertyTypes` (#300).
