# Restructuration multi-projets : un noyau partagé, des affichages, un dossier par projet

Ticket: #4903

Plan daté du 2026-11-24, mesuré à `3c2531336` (`main`) ; pour le roguelite, à `97e7ecc1` (tête de la PR #4767) et, pour
son combat, à `448271ba9` ; pour l'Atelier des PNJ, à `7ce0a72a6` (tête de la PR brouillon #3633). Il se supprime
quand l'épique #4903 est soldée.

## 1. Qualification

- **Demande** (laurent, 2026-11-24, verbatims à l'épique #4903) : mettre le noyau à l'épreuve par de nombreux
  mini-jeux et des outils (le créateur de PNJ) ; réorganiser le dépôt pour les outils propres à chaque projet, les
  parties communes, leurs workflows et leurs tests ; résorber la duplication des assets, sachant qu'un kit uniforme
  existe sans être validé. Précisé le même jour : le jeu suivant serait « un jeu type total War/mount and blade ou
  on dirige un groupe d homme voir une armée et des terres/vassaux. Le monde serait autonome sans nous et ça
  reprendrais les règles du commerce/bataille navale, combat de masse et autres. Le tout en utilisant l affichage du
  roguelite 2D avec les pions (à opposer à l hôte texte et Godot) » ; « Ça sera surement sur une map en tour par
  tour comme total War/might and magic ». Puis : « Faut intégrer aussi l atelier des pnjs. Surtout que j aurai envie
  de pouvoir lancer des rencontres et le système de combat de l hôte 2D est capable de le faire » ; « C est un énorme
  défaut du jeu de ne pas accepter le bestiaire fan de fonctionner » ; « Pas grave pour le moment si les traits
  manquant ne font rien. On peut faire ça plus tard ».
- **But réel** : qu'ajouter un projet coûte peu, ne crée pas de dette, et *éprouve* le noyau. Un projet qui
  contourne la porte du noyau ne l'éprouve pas : il en lit les internes, et le manque qu'il aurait dû révéler reste
  invisible.
- **Ce que la précision change** : l'affichage et le jeu sont deux choses. Trois affichages existent ou vont
  exister (le texte, Godot, les pions en 2D du roguelite), et un même affichage sert plusieurs jeux : les pions
  serviront le roguelite et le jeu de stratégie.
- **Ce que l'atelier change** : le créateur de PNJ de la demande existe déjà, c'est l'Atelier des PNJ (§ 2.3), hors
  de `main`. Ses rencontres se joueront par l'affichage `pions` : celui-ci a donc un deuxième consommateur proche
  (l'atelier), avant le jeu de stratégie.
- **Livrable** : ce plan et l'épique #4903, par PR. Aucune exécution ici : chaque lot naît en sous-issue à son tour.
- **Fini** (pour l'épique) : tout fichier de code appartient à une zone de `COUCHES` ou à l'outillage déclaré ;
  chaque affichage et chaque projet a sa ligne, ses suites, sa construction, sa recette et ses gates ; un diff
  limité à un projet ne joue que ce qui le lit ; chaque asset partagé a une source.
- **Déjà tranché** : le régime des couches de #2882 (table `COUCHES`, murs de lint, porte `src/noyau/index.ts`,
  droits d'hôte) ; la structure plutôt que la garde (fiche `user-doctrine-structure-avant-garde`) ; une refonte
  emmène ses outils (fiche `user-doctrine-refonte-emmene-ses-outils`) ; les maquettes font foi et restent autonomes
  du jeu (fiche `user-doctrine-maquettes-font-foi-godot-s-adapte`) ; un seul catalogue de modèles, de textures et
  un seul atelier Godot (fiche `user-doctrine-atelier-godot-unique-catalogue-de-textures-unique`) ; web d'abord,
  bureau en plus, par le même hôte (fiche `user-doctrine-web-d-abord-bureau-en-plus`) ; le roguelite range ses
  manques du noyau sous #4899 (`.claude/rules/roguelite.md`, PR #4900) ; le roguelite entre dans `main` après son
  rangement (§ 12) ; le guide fan entre au jeu comme bestiaire d'auteur cité par page (#3656, fiche
  `user-arbitrage-bestiaire-frenchy`) ; le *Bestiaire non officiel* devient un livre du jeu, ses traits entrant
  d'abord sans mécanique (§ 12).
- **Irréversible** : aucun dans ce plan, qui passe par branche, PR et file de fusion. Deux gestes de L10 sortent du
  projet : republier l'artefact de l'atelier, qui a des utilisateurs hors du dépôt, attend l'accord de
  l'utilisateur ; le sort de leurs PNJ gardés au format v1 est tranché (§ 12).
- **Lecture prise** : « kit uniforme pas encore validé » désigne le kit d'interface des maquettes
  (`hotes/godot/cibles/propositions/kit.md`, « Catalogue (étape 2, à valider) », #4411 puis #4585) ; l'autre lecture,
  le kit de modélisation 3D (#2972, #4422), est couverte au § 8.4. « Intégrer l'atelier » se lit comme pour le
  roguelite : le ranger en projet et le faire entrer dans `main` (§ 12), puis lui donner le lancement de ses
  rencontres. « Lancer des rencontres » se lit comme le combat du roguelite : simulé par le noyau en cadence `auto`,
  puis rejoué pas à pas, sans geste du MJ pendant le combat. Le jouer au tour par tour demanderait à `pions` les
  gestes d'un combat, que le roguelite n'a pas : ce serait un lot de plus, sur demande.

## 2. Mesure

### 2.1 Le commun et ses frontières

| Zone | Fichiers de code | Lignes | Suites |
|---|---:|---:|---:|
| `src/engine` | 201 | 39 076 | 310 |
| `src/data` | 371 | 40 216 | 273 |
| `src/noyau` | 362 | 119 777 | 1 040 |
| `src/scenes` | 67 | 7 339 | 33 |
| `src/hote` | 36 | 8 821 | 34 |
| `src/hoteTexte` | 5 | 1 049 | 9 |
| `hotes/godot` | 319 | 55 562 | 86 |
| `scripts` (outillage) | 1 017 | 151 055 | 339 |

- `COUCHES` (`scripts/guards/lib/couches.mjs`) déclare les zones `lib`, `geometry`, `i18n`, `engine`, `data`,
  `noyau`, `scenes`, `hote`, `hoteTexte`, `hotes` (dossier `hotes/`, qui ne porte que `hotes/godot`) et `racine`.
- Un hôte (`DROITS_DES_HOTES`) n'importe que la porte du noyau (`src/noyau/index.ts`, 168 déclarations `export`),
  `scenes`, `hote` et les feuilles : ni `engine`, ni `data`, ni un interne du noyau.
- `murs/zone` ne juge que les fichiers de `src/` : `zoneDe` rend `null` hors de `src/` et des dossiers déclarés, et
  un dossier de code à la racine qui n'est la racine d'aucune zone échappe à tous les murs.
- Un import n'est pas la seule lecture : des suites de `src/` lisent des fichiers de `hotes/`
  (`src/data/sons/epingles-godot.test.ts`, `src/hote/derive-du-noyau.hors-store.test.ts`), et 25 fichiers de
  `scripts/` importent `hotes/`.

### 2.2 Le roguelite (`roguelite/`, PR #4767)

- 8 936 lignes (`.ts`, `.mjs`, `.css`, `.html`) dans un dossier racine hors de `RACINES_DES_ZONES` : aucun mur ne
  le lit. Il mêle sa logique de jeu (`src/jeu/`, sa façade du noyau `src/noyau/`) et son affichage (`src/ui/`,
  figures, lieux, kit).
- 106 imports, depuis 21 fichiers, vers 54 modules de `src/` : 37 de `engine`, 9 internes de `noyau`
  (`acteDeSoin`, `bus`, `combatAuto`, `consumableFlow`, `etat`, `ligneDeJet`, `monde/footprint`, `partie`,
  `restFlow`), 4 de `data`, 2 de `hote` (`partie`, `rencontre`), 1 de `scenes` (`test-scenarios/_shared`, le
  contenu du menu « Scénarios de test » du jeu), 1 de `i18n`. **Aucun ne passe par la porte.** Sous les droits
  d'hôte, 50 des 54 modules seraient refusés.
- Sa suite (105 tests, 16 fichiers) n'est jouée par aucune CI ; `RACINES_DE_LA_SUITE` et le `tsconfig.json` racine
  ne le couvrent pas (`.claude/rules/roguelite.md`).
- Sa construction (`roguelite/construire.mjs`) importe `esbuild`, que `package.json` ne déclare pas : il arrive en
  dépendance transitive (0.28.2). Sa recette charge Playwright « installé hors du dépôt » alors que `playwright`
  1.63.0 est une `devDependency` de la racine. Sa comparaison d'images (`recette/comparer.py`, PIL) tolère 24 niveaux
  par canal.

### 2.3 L'Atelier des PNJ (`outils/atelier-pnj/`, PR brouillon #3633)

- Il vit sur la branche de la PR brouillon #3633, partie de `main` le 2026-11-07, hors de `main`, de la CI et des
  murs. Il est publié en artefact claude.ai et employé hors du dépôt (retour d'un utilisateur relayé le 2026-11-13,
  #4217). Son `LISEZMOI.md` en décrit la construction, la publication et le modèle de données.
- Sa page (`template.html`, 1 298 lignes de HTML, CSS et JavaScript) reçoit à la construction (`build.mjs`, 68
  lignes) 21 datasets de `src/data`, lus par fichier, réduits et injectés. C'est une lecture, pas un import : aucun
  mur ne la voit (§ 2.1).
- La page recode en JavaScript des règles dont le commun a sa version : le profil d'un PNJ de carrière et de ses
  carrières suivantes (`src/engine/pnjDeCarriere.ts`), la bourse (`argentDuPnj`), le nom (`nomDEntite`), les
  carrières ouvertes à l'espèce (`careersForSpecies`), les sorts d'un lanceur (`sortsDuPnj`), la création façon PJ
  (`src/noyau/creation/`), la variation d'un profil (LDB p.314 dans l'atelier ; `randomChars`, LDB 77 l.108, et
  `poserUneTroupe` au noyau), le statbloc (`ficheDuCombattant`, dont les sections suivent l'atelier depuis #3678).
  Deux exemplaires d'une règle divergent sans que rien ne le signale.
- Un PNJ gardé est l'état entier du formulaire : ses Caractéristiques calculées, ses mutations choisies, son origine
  (création façon PJ), son modèle, son profil de héros ou son rôle de bête, ses notes, sa rencontre.
- Ses données propres (`entrees/`, 441 Ko) : les 290 profils du *Guide fan v4.5* (`pnj-guide.json`, 307 Ko)
  correspondent, par libellé et page, aux 288 profils `guide-frenchy` du bestiaire du jeu (#3656), sous d'autres
  ids ; deux d'entre eux (`guide-128-artisan`, `guide-129-maistre-artisan`) réimpriment les pages 80 et 81. Les
  3 traits qu'il ajoute manquent au jeu : règles maison du guide, que l'arbitrage du 2026-11-08 laissait dehors. De ses 62 sorts, 29 ont leur libellé au catalogue ; 32 des autres sont
  listés à #3740, et « Secousse Tellurique » (p.254) n'est suivie nulle part. Le *Bestiaire non officiel* y apporte
  107 créatures, 36 traits, 12 modèles de carrière, 3 profils de héros et 2 rôles de bête, absents du jeu ; ce
  livre n'est pas encore une source du jeu (`AGENTS.md`, § Sources VF), et aucune extraction n'en est au dépôt.
  68 de ses créatures n'ont que des Traits du catalogue.
- Une rencontre y est une étiquette (`renc`) qui range des PNJ gardés dans le `localStorage` ; rien ne la joue.
- Sa feuille est propre (26 propriétés personnalisées, dont 21 couleurs) ; ses polices viennent de Google Fonts.
- Le combat de l'affichage 2D (`roguelite/src/noyau/combat.ts`, 141 lignes) joue une rencontre par
  `jouerLaRencontre` (`src/hote/rencontre.ts`, cadence `auto` : le noyau pilote chaque combattant), sur une arène de
  `scenes/test-scenarios/_shared`, en relève les pas, et `src/ui/rejeu.ts` (270 lignes), `figures.ts` (492) et la
  cour les rejouent. Ses ennemis ne sont que des ids de créature (`jouerLeCombat(groupe, ennemis: string[], …)`).
  Le schéma du noyau porte davantage : une rencontre est une liste d'entités et la définition qui les référence
  (`BuiltEncounter`, `src/noyau/monde/encounterAuthoring.ts`), et une entité y est un PNJ de carrière (un corps du
  bestiaire et ses `carrieres`), un statbloc ou un preset, de l'un ou l'autre camp (`side`, `ai`).
- Une rencontre entre deux camps de PNJ, sans héros, se joue déjà jusqu'à son issue (sonde à `aa123ee1f`, `ouvrirLeLancement` en cadence `auto` et `party: []` :
  deux `homme-du-guet` alliés pilotés contre deux ennemis, issue `victoire`). Les alliés y sont de `kind` `heros`,
  et le groupe que rend la rencontre est vide : l'état des survivants se lit dans la bataille.
- La porte donne la fiche d'un PNJ posé (`ficheDEntite` ou `ficheEditee`, qui passent par `spawnEnemy` : parcours de
  carrière et bourse compris, puis `ficheDuCombattant`) et le type de la scène (`Scene`, dont `Scene['entities']`).
  Elle ne donne, des catalogues que les menus de l'atelier parcourent, que les carrières, leurs niveaux et les sorts
  (`careers`, `findCareerById`, `levelsForCareer`, `findSpellById`) : ni le bestiaire, ni les talents, compétences,
  traits, possessions, espèces, noms, mutations, dieux ou domaines, ni `careersForSpecies` (`src/data`) ou
  `poserUneTroupe` (`src/noyau/sceneEdit.ts`). Ce sont les premiers manques que l'atelier révélera.

### 2.4 L'outillage

- 129 scripts npm à la racine, dont 21 `godot:*` : le préfixe de projet existe déjà pour Godot. Les gestes du
  roguelite et de l'atelier n'ont aucun script npm ; ils se lancent par chemin.
- L'outillage propre à Godot vit dans `hotes/godot/` (construire, recettes, étalons, import et validation
  d'assets) ; la chaîne 3D dans `scripts/personnage-3d/` (381 fichiers) ; la comparaison des maquettes dans
  `scripts/maquettes/`.
- Quatre sites pilotent un navigateur : `scripts/recette/lib.mjs` (Chromium par CDP, pour l'export Web Godot) ; par
  Playwright, `hotes/godot/cibles/propositions/sources/rendre.mjs` (navigateur épinglé `EPINGLE` de
  `hotes/godot/planches.mjs`), `scripts/maquettes/page.mjs` et `roguelite/recette/commun.mjs`.
- Deux comparateurs d'images : `ecart` (`hotes/godot/planches.mjs`, exact, réemployé par
  `scripts/maquettes/pixels.mjs`) et `roguelite/recette/comparer.py`.
- Trois constructions web : `vite` (`hotes/godot/construire.mjs:61`), `esbuild` (le roguelite) et l'injection de
  données dans une page de l'atelier (`build.mjs`, sans bundler).

### 2.5 La CI

- Un workflow `ci.yml` (408 lignes) ; une course de branche (`typecheck`, `test:perimetre`) et une course de file
  qui joue toutes les gates. Sur la course de file 45344893428 : `godot-rendus` 21 min, `suite 2/3` 14 min,
  `docs-tests` 14 min, `types-hooks` 8 min, `godot` et `godot-recette` 7 min.
- Le classement d'un push (`scripts/gates/classerPush.mjs`) est binaire : *documentaire* si tous les fichiers sont
  sous `DOCUMENTAIRE`, sinon *produit*, et alors toutes les gates jouent.
- Les lectures de chaque gate (`ECRIT_LU[gate].lit`, `scripts/gates/toutes.mjs`) ont été mesurées pour une seule
  question : la gate lit-elle du documentaire ? Elles ne forment pas un graphe de dépendances complet : 3 gates sur
  35 seulement citent `package-lock.json` (`test:hooks`, `test:corpus`, `test:corpus-isole`, par `LIT_DES_AUDITS`),
  celle de `test` ne cite ni `package.json` ni le lockfile, et `toutes.mjs` nomme
  lui-même ses angles morts (lectures de `tsc`, d'`eslint`, de `git ls-files`).

### 2.6 Les assets

| Famille | Sources aujourd'hui | Mesure |
|---|---|---|
| Kit d'interface (palette, typographie, primitives) | `hotes/godot/cibles/propositions/sources/gestes.css` et `gestes.js` (maquettes) ; `roguelite/kit.css` ; `roguelite/src/kit.ts` ; la feuille de l'atelier (`template.html`) | deux copies dans le roguelite : `kit.css` (37 841 octets, « repris tel quel de `main` au commit 162a308f3 ») et `kit.ts` (10 698 octets, primitives de `gestes.js` reprises à cfff50879, plus 39 pictogrammes nommés par des chaînes, dont des concepts que le catalogue d'icônes a déjà : `objet/armure`, `ressource/bourse`, `repos/lit`, `interface/oeil`, `interface/balance`, `navigation/des`) ; l'atelier a sa propre palette (16 propriétés CSS) |
| Palette de Godot | 41 ressources `Theme` ; 475 `Color(...)` dans 40 `.tres` du projet | pas une copie du kit : 7 des 142 couleurs distinctes de `theme.tres` égalent un des 57 jetons de `gestes.css`. C'est l'écart que la migration visuelle (#3935, #4411) doit combler, pas une duplication |
| Polices | `hotes/godot/projet/polices/` (8 `.ttf`, 1,6 Mo) ; `hotes/godot/cibles/propositions/sources/polices/` (7 `.ttf`) ; Google Fonts pour le roguelite et pour l'atelier | `GrenzeGotisch-wght.ttf` et deux licences identiques à l'octet dans les deux dossiers |
| Dessins vectoriels | catalogue des dessins (#3935) : `src/data/icons`, `fonds`, `paysages`, `cadres`, exportés par la porte (`ICON_DEFS`, `FONDS`, `CADRES`…), figés pour Godot par `hotes/godot/asset/dessins.ts` | les maquettes en recopient un tracé à la main (`gestes.js:228`), par autonomie voulue ; le roguelite dessine ses figures, lieux et vignettes à part (`figures.ts` 45 Ko, `cour.ts` 24 Ko, `hameau.ts` 21 Ko, `vignettes.ts` 8 Ko) avec son propre vocabulaire (`type Arme = 'epee' \| 'hache' \| …`, `coiffe?: 'casque' \| …`) |
| Modèles 3D, textures, sons | catalogue unique du projet Godot : 261 modèles (`hotes/godot/projet/modeles/`, manifeste et provenance commités, GLB à la Release par empreinte : `hotes/godot/epingles.mjs`, `transfert.yml`), textures (`hotes/godot/projet/textures/provenance.json`) | duplication propre au kit de modélisation suivie par #4422 ; base commune à 54 % (#2972) |
| Preuves | `public/qc/` (119 Mo, 531 PNG de soldes), `hotes/godot/cibles/` (55 Mo) | ce ne sont pas des assets de projet (§ 13) |

### 2.7 Ce que le noyau sait déjà du jeu de stratégie

- Combat de masse : la Puissance de bataille d'ADE II 8 (`src/engine/massBattle.ts`, `src/noyau/massBattleFlow.ts`),
  règle facultative abstraite, centrée sur les Personnages : deux camps, un Attribut de Puissance, des Scènes
  cinématiques. Elle ne décrit pas une bataille d'unités sur une carte.
- Combat naval et voyage en mer (`docs/raw/4e/combat-naval.md`, `src/noyau/seaVoyageFlow.ts`, épique #3002) ;
  économie et commerce (`docs/raw/4e/economie.md`, épique #3004) ; voyage (`src/engine/travel.ts`) ; couche monde
  avec carte et journal au jour le jour (#3534).

## 3. Hypothèses (tranchées par la mesure, révisables)

- **H1. Un seul dépôt.** GitHub est le seul canal commun entre les comptes ; le noyau change plusieurs fois par jour.
  Un noyau publié en paquet versionné allongerait la boucle « manque relevé, couture ajoutée, couture employée » que
  le but veut courte.
- **H2. Une seule `package.json`, pas de workspaces npm.** #2882 avait écarté les paquets npm « à réévaluer si un
  mur se révèle contournable ». Réévaluation : le contournement mesuré (§ 2.2) ne passe par aucune faille d'un mur ;
  il vient d'un dossier qu'aucun mur ne regarde. Fermer ce trou (L1, L3) suffit. Des workspaces ajouteraient une
  `package.json` et une résolution `exports` par projet, qui doubleraient `COUCHES` sans fermer une classe de plus.
  Déclencheur de réévaluation : deux projets qui exigent deux versions incompatibles d'un même paquet.
- **H3. Deux sortes de dossiers.** Un **affichage** (un hôte de présentation du noyau) vit sous `hotes/<affichage>/` :
  `texte`, `godot`, `pions`. Un **projet** (un jeu ou un outil autre que le jeu principal) vit sous
  `projets/<projet>/` : sa logique de jeu (couche scénario du credo), son contenu, sa page ou son entrée. Un projet
  ouvre le ou les affichages qu'il déclare ; un affichage n'importe jamais un projet ; un projet n'importe jamais un
  autre projet. « Projet » est le mot de la demande ; « hôte » reste le mot du code pour ce qui dessine.
  **Droits d'un projet** : ceux d'un hôte (`DROITS_DES_HOTES` : la porte du noyau, `hote`, les feuilles), sans
  `scenes`, plus les affichages qu'il déclare. Il lit le noyau par sa porte, compte donc parmi `HOTES_DU_NOYAU`, et
  survit comme les autres hôtes. L1 en fait une constante de `COUCHES`, à côté de `DROITS_DES_HOTES`. Quand un
  affichage doit jouer la logique d'un projet (le texte, Godot), c'est le projet qui la lui fournit, par une capacité
  de cet affichage et jamais par un second serveur ou un second pont (fiche `user-doctrine-un-hote-jamais-duplique`) ;
  la forme exacte se tranche au premier cas réel.
- **H4. Le commun reste `src/`** : feuilles, `engine`, `data`, `noyau`, `hote`. `scenes` (campagne, scénarios de test,
  arène) est le contenu du jeu principal, que dessinent les affichages `godot` et `texte` ; un projet ne l'ouvre pas.
- **H5. Un projet affiché par Godot reste dans l'unique projet Godot** : sa scène d'entrée, son préréglage d'export,
  son entrée au lot de recettes ; il partage sans machinerie le pont, le thème, les composants
  (`hotes/godot/projet/composants/`, 100 scènes), l'atelier et les catalogues. Sa logique vit dans
  `projets/<projet>/` ; la façon dont le pont l'embarque se tranche au premier cas réel.
- **H6. Une déclaration par zone : sa ligne de `COUCHES`.** Les murs en dérivent ; les suites et le typecheck
  couvrent les racines `hotes/` et `projets/` en bloc (`RACINES_DE_LA_SUITE`, `tsconfig.json`), sans configuration
  par projet. Les fichiers JSON qui ne peuvent pas lire la table restent confrontés à elle par
  `src/racines-des-zones-json-guard.test.ts`.

## 4. Structure cible

```
src/                  LE COMMUN (inchangé de place)
  lib/ geometry/ i18n/  feuilles
  engine/ data/         règles et base app-owned, catalogue des dessins compris
  noyau/                orchestration ; porte unique src/noyau/index.ts
  hote/                 module commun aux affichages : rencontre, partie, projection, sauvegardes…
  scenes/               contenu du jeu principal : campagne, scénarios de test, arène
hotes/                LES AFFICHAGES, une zone de COUCHES chacun
  texte/                l'hôte texte MCP (aujourd'hui src/hoteTexte/)
  godot/                le jeu principal sous Godot, et les projets qu'il affiche (H5)
  pions/                l'affichage 2D en pions et le rejeu de ses combats, extrait du roguelite (L8)
projets/              LES PROJETS, une zone de COUCHES chacun
  roguelite/            aujourd'hui roguelite/, sur sa branche
  atelier-pnj/          l'Atelier des PNJ (§ 9.2), aujourd'hui outils/atelier-pnj/, sur sa branche
  <stratégie>/          le jeu de stratégie (§ 9.1)
scripts/              outillage commun
server/               relais coop : paquet à part, n'importe rien de src/
Source/ docs/         livres ; références vivantes du commun
```

Dans un dossier d'affichage ou de projet : son code, ses suites, ses outils propres et ses documents de conception
(le modèle est `roguelite/CONCEPTION.md`). Ce qui sert à deux projets passe à un affichage ou au commun.

## 5. Outillage

- **Commun** (`scripts/`) : ops, gates, gardes, docs, raw, hooks, migrations, chaîne de prose, test ; et, en L6,
  les outils web que plusieurs sites emploient déjà, chacun réduit à un : la construction par `vite`, le harnais
  Playwright au navigateur épinglé (`EPINGLE`), la comparaison `ecart`. La chaîne 3D (`scripts/personnage-3d/`) reste
  commune aux projets qui affichent de la 3D.
- **Par affichage ou projet** : ses outils propres dans son dossier, et des scripts npm préfixés de son nom, comme
  `godot:*` aujourd'hui, pour ses gestes réels : `<nom>:tests` (la suite filtrée par chemin), `<nom>:construire`,
  `<nom>:recette`. Les gates de la CI se nomment par script npm (`ECRIT_LU`) : un geste sans script n'a pas de gate.
- **Dépendances** : une `package.json` racine (H2). Un paquet employé sans être déclaré se voit par la gate
  existante `deps:unused` (`knip --dependencies`), une fois les entrées du projet déclarées dans `knip.json`.
- **Agents** : une règle `.claude/rules/<nom>.md` à `paths:` sur son dossier (modèles : `roguelite.md` ; pour Godot,
  `hote-godot.md`, `ecrans-godot.md`, `rendus-godot.md`, `attentes-godot.md`). `AGENTS.md` route « travailler dans
  un projet » vers elle et montre `hotes/` et `projets/` dans son § Architecture.

## 6. Suites, typecheck et CI

- **Suites et typecheck.** `RACINES_DE_LA_SUITE` et `tsconfig.json` gagnent la racine `projets/` ; un projet rangé
  est joué par `npm test`, `test:perimetre` et `npm run typecheck`, et son propre `tsconfig.json` disparaît.
  `<nom>:tests` filtre la suite par chemin (`vitest run projets/<projet>`). Un projet Vitest à part ne naît que d'un
  conflit de préparation mesuré. La consigne « jamais `test:perimetre` pour le roguelite » de
  `.claude/rules/roguelite.md` tombe alors, dans le même geste.
- **CI resserrée, fermée par défaut.** Le classement d'un push garde sa règle : tout fichier hors des cas suivants
  fait jouer toute la course. Un seul cas neuf resserre : **tous** les fichiers du diff sont sous un même
  `projets/<projet>/` ou `hotes/<affichage>/`. Alors seules se sautent les gates dont les lectures mesurées
  excluent ce dossier ; les gates transverses (lint, typecheck complet, gardes et suites communes qui lisent
  `hotes/` ou `projets/`) jouent. `package.json`, le lockfile, les workflows et `scripts/` gardent la course
  complète.
- **Ce que le resserrement exige.** Les lectures des gates qui lisent un dossier de projet ou d'affichage, par
  import ou par fichier, se mesurent avant d'être employées pour sauter (les sites du § 2.1 en sont la preuve).
  L4 mesure ce que joue la course de file d'un diff de projet ; si la suite commune domine, la gate `test` se scinde
  par racine de suite, par filtrage de chemin.
- **Le noyau éprouvé en CI.** La suite d'un projet lit `src/` : un changement du noyau la joue. Une couture cassée
  pour le roguelite se voit dans la PR du noyau qui la casse, plus après coup dans la branche du roguelite.
- **Jobs.** Les gates lourdes d'un projet (construction, recette) forment son job, comme `godot`, `godot-rendus` et
  `godot-recette`. Les checks requis se mettent à jour par `npm run ops:ruleset`. Un job sauté rend « Success »,
  comme aujourd'hui (`scripts/ops/ruleset-main.test.mjs`).

## 7. Workflows

- **Tickets.** Chaque projet a son épique de retours sur le noyau, au modèle de #4899 et à son critère
  d'appartenance. Un manque du noyau relevé par un projet devient un ticket sous cette épique, soldé sur son propre
  `chantier/<N>` avec les preuves du noyau.
- **Branches.** `chantier/<N>` et file de fusion, comme tout le dépôt. Un projet vit sur `main` : c'est là que les
  murs et la CI le protègent et l'opposent au noyau.
- **Docs.** `docs/` décrit le commun. Un projet garde sa conception dans son dossier. Chaque lot met à jour dans son
  commit `docs/architecture.md` (§ Couches, § Arborescence, pistes écartées), `AGENTS.md`, les règles et les skills
  qui citent les chemins qu'il change.
- **Créer un projet** (L9) : un geste outillé, écrit au premier projet neuf après le rangement du roguelite : le
  dossier, la ligne de `COUCHES`, la règle d'agent, les scripts, les gates, l'épique de retours.

## 8. Assets

Principe : un asset partagé a une source ; chaque affichage ou projet en dérive son rendu à la construction, en
dérivé pur jamais commité (`docs/architecture.md`, § Politique de `docs/`, « Dérivés PURS ») ; un asset qu'un seul
projet dessine vit dans son dossier, et passe à un affichage ou au commun le jour où un deuxième le dessine. Un
asset se nomme par l'id stable de ce qu'il représente (fiche `user-doctrine-ids-stables-labels-affichage`).

### 8.1 Kit d'interface web et polices (L7)

La source est le kit des maquettes, qui font foi. Une fois son catalogue validé (#4585, tenu par un autre fil), ses
jetons, ses primitives web et ses polices sont lus par les maquettes (le kit n'est pas le jeu : elles restent
autonomes du jeu) et par les affichages et projets web ; les copies `kit.css` et `kit.ts` du roguelite
disparaissent, ses pictogrammes passent au catalogue d'icônes, par id, là où le concept existe, et la palette
propre de l'atelier cède aux jetons du kit. Les polices tiennent dans un dossier,
avec leurs licences ; Godot les reçoit à la construction comme ses textures, et les affichages web servent les
mêmes fichiers, sans Google Fonts. L'emplacement se tranche en L7, sur la forme validée.

La palette de Godot n'est pas une copie du kit (§ 2.6) : la dériver du kit, c'est la migration visuelle de #3935 et
#4411, avec des étalons revalidés par l'utilisateur, hors de ce plan.

### 8.2 Les pions et leurs dessins (L8)

Le catalogue des dessins reste la source des icônes, fonds, paysages et cadres, et un affichage web le lit par la
porte, qui l'exporte déjà. Les figures, bustes et vignettes du roguelite, la cour de ses combats, le relevé de leurs
pas (`roguelite/src/noyau/combat.ts`) et leur rejeu (`src/ui/rejeu.ts`) deviennent l'affichage `pions` quand un
deuxième consommateur les dessine : les rencontres de l'atelier (L11) ou le jeu de stratégie, le premier venu. Leur
API se type alors par les ids de la donnée (arme, coiffure, espèce) au lieu de chaînes littérales ; ce qui ne sert
qu'au roguelite (ses écrans, ses lieux) reste dans son dossier. Les maquettes gardent leurs tracés recopiés : leur
autonomie est voulue.

### 8.3 Ce qui reste à Godot

Modèles 3D, textures et sons restent le catalogue unique du projet Godot, à la Release par empreinte. Les projets
affichés par Godot les partagent par H5. La duplication du kit de modélisation et la base commune restent l'affaire
de #2972, #4422 et #3842 : ce plan n'y touche pas. Déclencheur d'un déplacement hors de `res://` : le premier
affichage autre que Godot qui montre un de ces assets.

### 8.4 L'autre lecture du kit

Si « kit uniforme » désignait le kit de modélisation 3D, il relève de #2972 et #4422 (§ 8.3), qui en suivent la
validation ; ce plan n'y ajoute rien.

## 9. Les projets suivants, situés

### 9.1 Le jeu de stratégie

- **Ce qu'il est** : une carte de campagne au tour par tour (Total War, Might and Magic), un groupe d'hommes puis une
  armée, des terres et des vassaux, un monde qui vit sans le joueur.
- **Où il vit** : `projets/<stratégie>/`, affiché par `pions` (L8).
  Sa logique, séparée de l'affichage, peut aussi se jouer par l'hôte texte, ce qui permet à un agent de la tester
  sans écran : le projet déclare l'affichage `texte` et lui fournit sa partie par une capacité de l'hôte texte
  (H3), au lieu d'un second serveur.
- **Ce qu'il éprouve du noyau** : commerce et économie, combat naval, voyage, couche monde (§ 2.7), Puissance de
  bataille.
- **Ce que le noyau n'a pas** : la bataille d'unités sur une carte, les fiefs et vassaux, les factions autonomes. À
  l'ouverture du jeu, chaque manque se range par le credo : ce que les livres décrivent (Atlas d'abord) est
  implémenté au noyau ; une mécanique de règle que les livres ne couvrent pas est une lacune du système (proposition
  déduite, puis cérémonie d'arbitrage) ; une valeur de jeu (prix, rythme, taille d'une carte) est une valeur
  d'adaptation tracée dans la conception du projet.

### 9.2 L'Atelier des PNJ

- **Ce qu'il est** : l'outil de préparation d'un MJ : fabriquer un PNJ (un profil du Bestiaire, des carrières, une
  création façon PJ), le garder, l'imprimer, en faire une troupe, ranger ses PNJ en rencontres. Il a des
  utilisateurs hors du dépôt.
- **Où il vit** : `projets/atelier-pnj/`, sa page construite en un fichier et publiée en artefact. Ses écrans, son
  impression et ses PNJ gardés y restent ; il n'a aucune donnée de règle propre ; il déclare l'affichage `pions`
  pour jouer ses rencontres.
- **Son PNJ est celui du noyau, dans une enveloppe** : le PNJ a la forme qu'une scène pose (une entité de type
  personnage : un corps du bestiaire et ses `carrieres`, ou un `statblock` ; son inventaire, son nom), la rencontre
  celle que rend `buildEncounter` (les entités et la définition qui les référence). La page ne garde aucune règle du
  commun : elle montre la fiche que la porte rend (`ficheDEntite` ou `ficheEditee`, puis `ficheDuCombattant`),
  celle que l'inspecteur de Godot montre déjà, et un PNJ de l'atelier se pose dans une scène du jeu sans
  conversion. L'enveloppe ne porte que ce qui n'est qu'à l'atelier : les notes et la rencontre où il est rangé.
- **Ce que le schéma ne porte pas encore** : les mutations choisies d'un PNJ (elles ne viennent qu'au hasard du
  spawn) et la création façon PJ (des `carrieres` ne s'attachent qu'à un corps du bestiaire, et un statbloc perd le
  parcours). Ce sont des manques du schéma, tickets de l'épique de l'atelier, à solder avant L10 : sinon l'atelier
  garderait une seconde forme du PNJ.
- **Le *Bestiaire non officiel*** devient un livre du jeu (L12), au modèle du guide fan (#3656 : une migration
  datée depuis les `entrees/` de l'atelier, chaque entrée citée par page) : ses 107 profils au bestiaire, ses 36
  traits au catalogue par leur texte, ses modèles de carrière, profils de héros et rôles de bête en règles du
  noyau. Les 3 traits du guide fan suivent par le même geste : la classe est « le contenu d'un bestiaire fan admis
  qui ne fonctionne pas ». Ces 39 traits entrent sans mécanique : ils ne font rien en jeu jusqu'à L13, qui la leur
  donne (décision du § 12). La prose entre verbatim : sans extraction au dépôt, L12 la vérifie au livre.
- **Lancer une rencontre** : l'atelier compose les deux camps et lance. La rencontre se joue jusqu'à son issue par
  `jouerLaRencontre` (cadence `auto`), et l'affichage `pions` la rejoue pas à pas, comme le roguelite. Le combat de
  l'affichage prend alors la rencontre dans la forme du schéma (entités et définition, PNJ de carrière et statblocs
  compris) et plus seulement des ids de créature : la classe se ferme du même geste pour le roguelite. Sans héros,
  l'issue se lit pour le camp allié, et l'état des survivants dans la bataille (§ 2.3).
- **Ce qui ne se lance pas** : le noyau ne joue que ce qu'il connaît. Un PNJ qui porte un contenu absent du
  catalogue (un sort du guide hors catalogue, #3740) se montre et s'imprime, mais la rencontre qui le contient est
  refusée au lancement, avec la liste de ce qui lui manque. Un trait sans mécanique ne bloque rien : il est au
  catalogue et ne fait rien jusqu'à L13.
- **Ce qu'il éprouve du noyau** : le PNJ de carrière, la création, la fiche, la troupe, le nom, la bourse, les sorts
  d'un lanceur, puis le combat entier par ses rencontres. Les manques de la porte et du schéma mesurés aux § 2.3 et
  ci-dessus sont les premiers tickets de son épique de retours.

## 10. Lots

| Lot | Contenu | Après | Preuve de fini |
|---|---|---|---|
| L1 | Zones par affichage et par projet, sur `main` : la zone `hotes` devient `godot` (chemin inchangé) ; `src/hoteTexte/` devient `hotes/texte/` ; la racine `projets/` est déclarée ; `zoneDe` nomme tout `hotes/<x>` et `projets/<x>` et `murs/zone` refuse celui qu'aucune ligne ne déclare | — | typecheck complet, lint, suite, `docs:check`, l'hôte texte démarre ; un banc de mur refuse un import de `godot` vers `texte`, d'un projet vers un autre, d'un affichage vers un projet |
| L2 | Le roguelite rangé sous `projets/roguelite/`, sur sa branche, puis fusionné (§ 12) : sa ligne de `COUCHES` aux droits d'un projet, plus des ouvertures explicites, chacune nommée par son ticket sous #4899 (`engine`, `data`, le `noyau` sans sa porte, `scenes`) ; sa suite et son typecheck par les racines communes ; ses scripts `roguelite:*` et ses gates ; `.claude/rules/roguelite.md` réécrite (chemins, preuves). Ce lot de #4903 écrit hors de `roguelite/` : la règle « un lot du roguelite n'écrit que sous `roguelite/` » ne le vise pas | L1 | lint, typecheck, suite, construction et recette vertes en course de file ; le roguelite sur `main`, avec ses ouvertures déclarées |
| L3 | Fermer le trou des murs à la racine : tout fichier de code du dépôt est dans une zone ou dans l'outillage déclaré (`scripts/`, `server/`, racines de mod, configurations de la racine) | L2 | un banc de `murs/zone` refuse un fichier de code dans un dossier racine non déclaré |
| L4 | CI resserrée par projet (§ 6) : lectures mesurées des gates qui lisent `hotes/` et `projets/`, cas neuf du classement, job du roguelite, checks requis | L2 | `classerPush.test.mjs` couvre un diff de projet seul, d'affichage seul, du commun, mixte, `package-lock.json` seul, documentaire ; une course de file d'une PR limitée au roguelite mesurée contre les 14 à 21 min d'aujourd'hui |
| L5 | La porte suffit aux projets : chaque ouverture du roguelite, puis de l'atelier, se résorbe par une couture de la porte ou de `src/hote`, ou par le déplacement de sa logique ; l'arène de `scenes/test-scenarios/_shared` devient une couture du noyau | L2 (roguelite), L10 (atelier) | la ligne de chaque projet égale les droits d'un projet |
| L6 | Outils web communs : construction par `vite` (fin d'`esbuild` transitif) ; un harnais, Playwright au navigateur épinglé, que rejoignent la recette du roguelite et `scripts/maquettes/page.mjs`, `scripts/recette/lib.mjs` le rejoignant ou disant au lot pourquoi CDP reste ; une comparaison, `ecart` (fin de `comparer.py`) | L2 | deux passes de la recette d'images du roguelite à la même tête, sur le navigateur épinglé, mesurées par `ecart` : si l'écart n'est pas nul, la tolérance devient un paramètre d'`ecart` ; la référence d'images se pose ensuite sur ce navigateur |
| L7 | Kit d'interface web et polices communs (§ 8.1) | #4585 validé, L6 | comparaison au pixel des maquettes à 0 ; images du roguelite identiques à sa référence du L6 ; plus aucune copie du kit hors de sa source |
| L8 | L'affichage `pions`, extrait du roguelite (§ 8.2) | L5 ; il se fait dans son deuxième consommateur, le premier venu : L11 ou le premier lot du jeu de stratégie | le roguelite et ce consommateur composent `hotes/pions/` ; aucun vocabulaire d'apparence en chaînes littérales dans son API |
| L9 | Créer un projet : le geste outillé (§ 7) | L2, L4, premier projet neuf | ce projet naît par lui |
| L10 | L'Atelier des PNJ rangé sous `projets/atelier-pnj/`, depuis la branche de #3633, puis fusionné (§ 12) : sa ligne de `COUCHES` aux droits d'un projet, ses ouvertures déclarées et ticketées sous son épique de retours ; sa page en TypeScript, qui lit la donnée et la fiche par la porte ; ses règles recopiées retirées, chacune comparée d'abord à celle du commun, un écart se tranchant au `Source/` ; ses PNJ et rencontres dans la forme du noyau, avec leur enveloppe (§ 9.2) ; le convertisseur daté des PNJ v1 de ses utilisateurs, à part de l'atelier (§ 12) ; ses `entrees/` cèdent au commun : les doublons du *Guide fan v4.5* (`pnj-guide.json`, `ajouts-guide.json`) au bestiaire du jeu, ce qui manque au catalogue à #3740 ou à un ticket (« Secousse Tellurique »), le *Bestiaire non officiel* par L12 ; sa construction en un fichier par l'outil commun ; ses scripts `atelier-pnj:*`, sa suite, ses tests DOM et ses gates ; `.claude/rules/atelier-pnj.md` ; la republication de l'artefact, sur accord de l'utilisateur. #4217, livré sur sa branche, se solde à la fusion | L1, L4, L6, L12, les manques du schéma (§ 9.2) | lint, typecheck, suite et construction vertes en course de file ; la construction ne lit aucun fichier sous `src/` : la donnée vient par import de la porte ou d'une ouverture déclarée ; pour un échantillon de PNJ du bestiaire et de carrière, la page montre la fiche que rend `ficheDuCombattant` ; la taille du fichier construit, mesurée, tient sous la limite d'une page d'artefact claude.ai (16 Mo ; `src/data` pèse 7,0 Mo en 134 fichiers JSON) |
| L11 | Lancer une rencontre de l'atelier (§ 9.2) : le combat de `pions` prend la rencontre dans la forme du schéma, en deux camps ; l'atelier compose et lance ; une rencontre qui porte un contenu hors catalogue est refusée par son manque ; L8 s'y fait s'il n'est pas fait | L5, L10 | une rencontre de l'atelier (PNJ de carrière, statbloc, créature du *Bestiaire non officiel*, deux camps, sans héros) se joue jusqu'à son issue et se rejoue, en test du projet ; le roguelite joue un ennemi de carrière par la même couture ; une rencontre qui contient un sort hors catalogue est refusée, son manque nommé |
| L12 | Le *Bestiaire non officiel* livre du jeu (§ 9.2, § 12), par `docs/ajouter-un-livre-source.md` et le skill `integrer-des-pnj` : le livre à `books.json`, `docs/sources-vf.md` et `AGENTS.md` ; ses 107 profils au bestiaire par une migration datée depuis les `entrees/` de l'atelier ; ses 36 traits, et les 3 du guide fan, au catalogue par leur texte verbatim, sans mécanique, leur liste au ticket de L13 ; ses modèles de carrière, profils de héros et rôles de bête en règles du noyau ; la fiche `user-arbitrage-bestiaire-frenchy` mise à jour | — | chaque profil passe `validateScene` posé en scène ; chaque trait est au catalogue, sa page citée ; une rencontre contre une créature du livre se joue jusqu'à son issue ; `docs:check`, typecheck complet, suite |
| L13 | La mécanique des 39 traits des bestiaires fan (§ 12), par le skill `ajouter-une-mecanique`, un sous-lot par famille de mécaniques | L12, quand l'utilisateur le demande | chaque trait a son test de mécanique ; la liste du ticket est vide |

L2 se fait sur la branche du roguelite avec le fil qui tient #4767, par courrier ; L10 part de la branche de #3633,
avec le fil qui la tient, par courrier ; L5, L6, L8, L11, L12 et L13 suivent sur `main`, L12 dès maintenant. Les lots qui touchent `COUCHES`, les
murs ou le classement de la CI (L1, L2, L3, L4, L10) se font juger par une instance neuve : ils touchent un socle.

## 11. Pistes évaluées et écartées

- **Plusieurs dépôts** : H1.
- **Workspaces npm et `exports` par paquet** : H2, avec son déclencheur.
- **Renommer `src/` en `noyau/` ou `packages/noyau/`** : plus de 3 000 fichiers, les chemins des gardes, des docs et
  des skills, sans fermer une classe de plus que `COUCHES`.
- **Ranger les projets sous `hotes/`** : un projet n'est pas un affichage ; deux jeux partageront `pions`, et un
  affichage qui importerait un projet, ou un projet un autre, rouvrirait le couplage que H3 ferme.
- **Déplacer `src/scenes/` dans le projet Godot** : deux affichages et les suites du noyau le lisent ; la ligne d'un
  projet suffit à le lui fermer.
- **Projets Vitest et `tsconfig.json` par projet** : aucun conflit de préparation mesuré ; le filtrage par chemin
  suffit, et un `tsconfig` de projet redéclarerait son dossier (H6).
- **Une liste blanche de paquets par zone** : `deps:unused` relève déjà les paquets non déclarés.
- **Un rapport de couverture des dessins par affichage** : la structure suffit, l'API des figures typée par les ids
  de la donnée.
- **Les filtres `paths:` de GitHub Actions** : un workflow que le filtre ne déclenche pas laisse ses checks requis
  en attente et bloque la file ; ils doubleraient `ECRIT_LU`.
- **Garder l'atelier hors de `main`, en page autonome** : il resterait un second exemplaire des règles des PNJ, que
  rien n'oppose au noyau, et ses rencontres demanderaient un second combat.
- **Garder le *Bestiaire non officiel* à l'atelier, en donnée propre et refusé au lancement** : ses créatures ne
  fonctionneraient pas en jeu, ce que l'utilisateur a refusé (§ 12).

## 12. Décision de l'utilisateur

Carte de décision du 2026-11-24, question « Faire entrer le roguelite dans main une fois rangé sous ses murs et sa
CI ? » ; laurent a choisi « Oui, après son rangement », dont la conséquence affichée était : « Le roguelite passe
sous hotes/roguelite avec ses murs et sa CI, puis sa PR 4767 fusionne ; chaque PR du noyau joue alors ses tests. »
Elle lève, à la fin de L2, le choix « Garder en brouillon » du même jour, dont le motif était qu'aucun plan ne
prévoyait la fusion. Deux précisions que la carte ne portait pas : le dossier devient `projets/roguelite/` (H3,
venu de la précision sur le jeu de stratégie), et le roguelite entre sur `main` avec ses ouvertures déclarées et
ticketées, que L5 résorbe.

Demande du même jour, en fil : « Faut intégrer aussi l atelier des pnjs. Surtout que j aurai envie de pouvoir lancer
des rencontres et le système de combat de l hôte 2D est capable de le faire ». Elle se lit comme la décision sur le
roguelite : l'atelier entre dans `main`, sous `projets/atelier-pnj/`, après son rangement (L10), puis lance ses
rencontres par l'affichage `pions` (L11). Elle lève le statut « hors du jeu » de la PR brouillon #3633 (solde de
#3628, `.claude/soldes/3628.md`).
Demande du même jour, en fil, en réponse au refus au lancement des créatures du *Bestiaire non officiel* : « C est
un énorme défaut du jeu de ne pas accepter le bestiaire fan de fonctionner ». Lue ainsi : le *Bestiaire non
officiel*, que la décision de Clément du 2026-11-06 (citée au `LISEZMOI.md` de l'atelier) admettait dans l'atelier,
devient un livre du jeu, au modèle du guide fan, traits et modèles compris (L12). Les
3 traits propres du guide fan, que l'arbitrage du 2026-11-08 (fiche `user-arbitrage-bestiaire-frenchy`) laissait
dehors avec ses règles maison, suivent : c'est le même défaut. Les autres règles maison du guide (Armure doublée)
ne sont pas du contenu de bestiaire et restent dehors.

Précisé ensuite, en fil : « Pas grave pour le moment si les traits manquant ne font rien. On peut faire ça plus
tard ». Les 39 traits des bestiaires fan entrent donc sans mécanique (L12) et la reçoivent en L13, quand
l'utilisateur le demande. C'est un écart daté à la règle 7 d'`AGENTS.md` (« une règle présente dans la source est
IMPLÉMENTÉE, jamais reportée »), limité à ces traits et tenu ouvert par le ticket de L13.

Carte de décision du 2026-11-24, question « Convertir les PNJ déjà gardés par les utilisateurs de l'atelier au
nouveau format ? » ; laurent a choisi « Convertir une fois », dont la conséquence affichée était : « Un convertisseur
daté, à part de l'atelier, passe un export v1 au nouveau format puis se retire ; l'atelier ne lit que le nouveau. »
Les options écartées étaient « Repartir de zéro » et « Garder l'ancienne page en ligne ». L10 livre ce convertisseur
et annonce sa date de retrait avec la republication de l'artefact.

## 13. Hors périmètre

- `server/` (relais coop) : paquet à part, qui n'importe rien de `src/`.
- Les preuves binaires commitées (`public/qc/`, `hotes/godot/cibles/`) : ce sont des pièces de solde et de
  maquette, pas des assets de projet.
- La palette de Godot dérivée du kit : migration visuelle de #3935 et #4411.
- La conception du jeu de stratégie et l'affichage de chaque futur outil : tranchés à la naissance du projet ; la
  structure accepte les trois affichages.
- Le contenu des tickets du noyau relevés par le roguelite (#4899) et par l'atelier (son épique de retours, ouverte
  en L10).
