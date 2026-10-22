# Vague 6 de l'épique #2882 : l'hôte Godot dans le dépôt (plan v2)

Ticket: #2928

Date : 2026-10-21. Carte : `docs/plans/2026-10-21-vague6-carte-poc-godot.md`, lecture de `origin/poc/godot` (3baf8483b). La v1 a été refusée par un juge neuf (huit bloquants, huit majeurs) ; la v2 les intègre, chaque correction citée par son repère (B1… M8).

## Qualification

- **But réel** : que le prototype Godot (#2793, #2809, modale #2870) devienne un hôte du noyau tenu par la CI, sans aucune règle recopiée ni en TypeScript ni en GDScript, pour que la migration écran par écran (#2794) parte d'un pont qui ne diverge plus du jeu.
- **Livrable** : `hotes/godot/` sur `main` (pont, projet Godot, outillage), joué par les mêmes gestes que l'hôte texte, sous les mêmes murs, testé en CI, recetté au navigateur.
- **Critère de fini** : (1) mur : la zone `hotes` n'ouvre que la porte du noyau, `scenes` et les feuilles, et l'ORACLE le tient (une copie d'encaissement ne compile plus, `engine` et `data` étant fermés, M4) ; (2) `git grep -E "AStarGrid2D|_jouer_ia|_adjacent|class_name Carte|departs" -- hotes/godot/projet` rend 0 (M4) ; (3) typecheck, lint, knip et tests du pont verts en CI ; (4) l'export web Godot, servi et piloté au clic dans Chromium, joue un tour complet : déplacement, attaque d'un héros par la modale, attaque adverse jouée par le noyau, Défense du héros, console à 0 erreur et `erreursGlobales()` vide (B2).
- **Contraintes tranchées** : invariant de laurent (2026-10-21) « si je modifie le moteur, je n ai pas à toucher ni au mcp, ni à l hôte, sauf si je dois inventer des nouveaux tools » ; credo (zéro copie, zéro code mort, une garde de synchronisation est un smell) ; règle 2 (aucune scène en dur) ; « Arrête de vérifier des règles du jeu » (2026-10-21). Question §3.4 : laurent, 2026-10-21, carte « Plus tard » — « On migre d'abord l'écran de jeu, et on tranche quand le premier écran Godot tourne. »
- **Irréversible** : aucun geste. Les `.glb` KayKit (CC0, 8,5 Mo) entrent dans l'historique sans LFS (H4).

## Principe

Godot est un second hôte du noyau, exactement comme l'hôte texte : il envoie des **intentions** (`Intention`, `src/noyau/partie.ts:29-31`, ou une offre désignée, `offreDesignee`) et lit une **vue** faite des lecteurs du noyau (`etatDeLaBarre`, `porteesDuTour`, `validTargets`, `fenetreDuJeu`) ; il rejoue les **jetons** programmés (`{type:'programme', jeton, delai}` → `reprendre`, `partie.ts:37-40`, `:174-180`). Ce qui, dans l'hôte texte, ne dépend pas de l'hôte (validation des arguments `formes.ts`/`verbes.generated.ts`, recherche du scénario par id, reprise des jetons) sort vers un module commun aux deux hôtes (B1). Les projections que le pont du prototype calculait lui-même (aperçu et jet de la modale, influences) deviennent des lecteurs du noyau (M1). GDScript ne garde aucune règle : ni IA, ni chemin, ni adjacence, ni carte (B3).

## Lots

**6a. Contrat v2 et épique amendée (documents seuls).** `CONTRAT.md` v2 : transport et erreurs inchangés ; méthodes = `demarrer {scenario, graine}`, `vue`, `jouer {intention | offre}`, `reprendre {jeton}`, `erreursGlobales` ; la réponse porte la vue et les jetons programmés avec leur délai ; les méthodes de la modale ne sont que des noms d'intentions du noyau (`attackSetLocation`, `attackRoll`, `attackReroll`, `attackBonusSL`, `attackCancel`, `attackConfirm`, `actionsDuNoyau.ts:537-556`) ; toute fenêtre que Godot ne dessine pas encore se rend de façon générique depuis `fenetreDuJeu` (clé et verbes en boutons). `simulerAttaque`, `sondeExceptionNue` et `mesures.gd` sont des mesures du prototype : supprimés (B3). Amender §3.1, §3.2, §4.6 du plan d'épique, le corps de #2882 et `docs/architecture.md` : la règle des hôtes externes est une zone de `COUCHES` (B7). Livré comme fichier du chantier, publié avec 6b.

**6b. Zone `hotes`, module commun, lecteurs du noyau, pont v2 (une PR verte, sans `projet/`).**
- `COUCHES` déclare le dossier de chaque zone (`src/<zone>` par défaut, `hotes` vit dans `hotes/`) ; une seule ligne de droits pour les hôtes externes, lue par `hoteTexte` et `hotes` (B6, B7). `couchesLint.zoneDe`, le banc `src/eslint-ordre-total-et-purete.test.ts` (PÉRIMÈTRE, FORMES, PORTES) et `fermetureDuNoyau.mjs` en dérivent ; la copie de `zoneDe` de `fermetureDuNoyau.mjs:39-42` disparaît.
- oxlint (blocs `files: ['src/**']`, `oxlint.config.mjs:617-626`) et knip couvrent `hotes/**` ; `tsconfig.json` l'inclut ; les tests du pont prennent la suite `test:noyau` par `MOTIF_HORS_STORE` étendu à `hotes/**/*.hors-store.test.ts` (M5) ; pas de `tsconfig`/`vitest.config` propres au pont.
- Module commun aux deux hôtes sorti de `src/hoteTexte` (B1). `src/hoteTexte` est touché : son fil est clos (#2925 fusionnée), et son comportement ne change pas (ses tests restent verts).
- Dans le noyau, exportés par l'index : `difficultyText`/`difficultyShownText` déplacés de `src/ui` (lus aussi par `ui/RollLine.tsx` et les autres consommateurs, en-tête réécrit, garde `state/roll-line-combat.test.ts` revue ; B4) ; les lecteurs de la modale (aperçu, jet, influences par `rerollAvailable`/`actorInfluenceView`) et ses libellés en clés i18n lues par le web et le noyau (M1, M3). Les exports de l'index sans consommateur hôte (`opReroll`, `opBonusSL`, `rederiveAttack`, `resolveAttack`, `defenseDodgeMods`, `modDeRegle`, à remesurer) sont retirés (M2).
- `hotes/godot/pont/` : `pont.ts` v2 (transport JSON, dispatch vers le module commun, aucune règle), `entree.ts`, tests `*.hors-store.test.ts` écrits depuis le contrat v2. Le bundle se bâtit par Vite (lib, iife) avec `proseSource()`, pas par esbuild brut (B5). Scénario : un combat existant du catalogue (celui que joue l'hôte texte), aucun neuf (M8).
- Documents vivants : `docs/architecture.md` (ligne `hotes/`), bloc « Architecture » d'`AGENTS.md` (M7).

**6c. Projet Godot v2, outillage et recette (une PR).** Godot 4.7 (binaire de l'éditeur et modèles d'export web, hors dépôt) dans le conteneur. `projet/` entre déjà adapté : `carte.gd`, `cartes/arene.tres`, `_jouer_ia`, l'A*, `_adjacent`, `_placer` par départs supprimés ; le plateau se dessine depuis la `Scene` et les positions de la vue ; l'IA et les chemins viennent du noyau ; minuteurs pour les jetons ; fenêtre générique. `.gitattributes` : `*.glb binary` ; licence KayKit avec les modèles ; `captures/` du prototype non reprises. `construire.mjs` (Vite + export Godot), `servir.mjs`. Sonde de CI `godot --headless --check-only` sur les scripts, avec le seul binaire de l'éditeur (M6) ; si le binaire ne s'installe pas en CI, la recette navigateur du lot en tient lieu et le plan le dit. Recette du tour complet (critère 4), captures sous `public/qc/soldes/`.

Chaque lot : un codeur, un juge sur le diff entier (juge-vision pour 6c), commit, PR sur `chantier/<N>`, ticket de vague sous #2882.

## Hypothèses

- **H1** : export web de Godot (JavaScriptBridge) ; pas d'hôte natif dans ce chantier.
- **H2** : une zone `hotes` dans `COUCHES`, mêmes droits que `hoteTexte` (porte du noyau, `scenes`, feuilles), lus d'une constante unique ; le texte « `src/noyau/index.ts` seul » de l'épique est amendé en 6a (aucun verbatim utilisateur ne le portait).
- **H3** : la CI ne télécharge pas les modèles d'export (1,28 Go) ; elle peut installer le binaire de l'éditeur pour `--check-only`.
- **H4** : `.glb` dans l'historique, sans LFS.

## Hors périmètre

Les écrans suivants dans Godot, la coquille commune des jets, l'art 3D (#2794) ; la question des outils d'auteur (§3.4, reportée par laurent) ; les règles de jeu.

## Corrections du second juge (2026-10-21, ACCEPTÉ AVEC CORRECTIONS), intégrées sans troisième juge

- **B8 (v1)** : l'ordre des lots ne publie jamais un projet Godot cassé : `projet/` n'entre qu'en 6c, déjà adapté au contrat v2.
- **B-a** : le module commun vit dans une zone neuve `src/hote/`, de mêmes droits que les hôtes (`importe: ['noyau','scenes',...FEUILLES]`, porte du noyau) ; la ligne des hôtes externes (`hoteTexte`, `hotes`) devient « ces droits + `hote` », lue d'une constante unique. `verbes.generated.ts` et son générateur suivent.
- **B-b** : un jeton ne traverse pas le JSON (identité d'objet, `partie.ts:95,130`) : la réponse porte `programme: { id: entier, delai }`, le pont tient `Map<number, Jeton>` ; chaque hôte garde sa propre horloge (l'hôte texte draine sur une horloge virtuelle, Godot arme de vrais minuteurs).
- **B-c** : un lanceur unique, partagé avec `scripts/hote-texte.mjs`, bâtit l'entrée (module virtuel `overrides`, `proseSource()`) ; étape CI `construire.mjs --pont-seul` (sans Godot) dès 6b, pour qu'un changement du moteur qui casse le bundle navigateur ne passe pas vert.
- **M-a** : `ENTREES_FERMEES` (`fermetureDuNoyau.mjs:23`) reçoit l'entrée du pont et le module commun ; la `zoneDe` unique vit dans `couches.mjs`.
- **M-b** : `PERIMETRE_DES_GARDES.racines` (`commentPoison.mjs:25`) couvre `hotes`.
- **M-c** : la vue-données de la fenêtre d'attaque descend au noyau dans un lot À PART, avant le pont v2 : `useAttackJetProps` lit ce lecteur, `useAttackJetProps.conformance.test.tsx` reste l'oracle.
- **M-d** : la garde `state/roll-line-combat.test.ts:626` nomme la nouvelle maison unique du mot « Combinée » et mord partout ailleurs.
- **M-e** : garde CI dans `scripts/guards/lib/` sur `hotes/godot/projet/**/*.gd` : ni `AStar*`, ni `RandomNumberGenerator`/`randi`/`randf`, ni arithmétique de distance sur les positions ; cases et cibles ne viennent que de la vue.
- **M-f** : tranché : binaire de l'éditeur Godot à version et somme épinglées, en cache CI ; `godot --headless --path hotes/godot/projet --import`, puis `--check-only` sur chaque script. Angle mort mesuré au lot 6c (juge, 2026-10-22) : `--check-only` ne voit pas l'appel d'une méthode renommée d'une autre classe (`class_name`), ni une clé de la vue lue dans un `Dictionary` ; la recette du tour complet au navigateur (`hotes/godot/recette.mjs`) les voit, la sonde non.
- **M-g** : un `demarrer` par page ; un second appel rend une erreur structurée ; recommencer = recharger.
- **M-h** : `knip.json` ne prend plus `src/noyau/index.ts` en entrée mais ses vrais consommateurs (entrée du pont, CLI texte, tests) : knip tient les exports morts de l'index.
- **M-i** : `projeter` (`src/hoteTexte/vue.ts:221`, sans les rendus bornés) entre dans le module commun.

## Découpage final

- **6b1** : zones (`COUCHES` par dossier, `src/hote/`, `hotes`), banc des murs, oxlint, knip, périmètre des gardes, `MOTIF_HORS_STORE`, `ENTREES_FERMEES` ; module commun sorti de l'hôte texte (validation, scénario par id, numérotation des jetons, `projeter`) ; lanceur unique ; amendements de l'épique et de `docs/architecture.md`.
- **6b2** : vue-données de la fenêtre d'attaque et `difficultyText` dans le noyau, lus par le web (oracle de conformance vert) ; exports morts de l'index retirés.
- **6b3** : pont v2 (`hotes/godot/pont/`), contrat v2, tests hors store, étape CI du bundle ; reportés de 6b1, faute de consommateur avant le pont : l'ouvreur commun de partie (`creerPartie`, scénario, lancement, tenue des jetons, pour `demarrer`), le `resolveId` du module virtuel pour le build Vite (`scripts/entree-d-hote.mjs`), les champs de projection mis en texte, la lecture d'un verbe et son refus « verbe inconnu » (`src/hoteTexte/serveur.ts`), la traduction de l'issue d'un appel en catégorie d'erreur (`src/hoteTexte/partieTexte.ts`) ; `hotes` entre dans `PERIMETRE_DES_GARDES` et les `lit` des gates avec son premier fichier (`RACINES_PRESENTES`).
- **6c** : projet Godot v2, garde GDScript, sonde Godot en CI, recette du tour complet.
