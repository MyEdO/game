# Structures de la donnée — carte GÉNÉRÉE (observé × déclaré)

> ⚠️ Fichier GÉNÉRÉ par `npx tsx scripts/docs/build-structures.mts` (`npm run docs:structures`) — NE PAS ÉDITER À LA MAIN.
> Toute correction se fait dans le générateur, dans le lexique `scripts/docs/lib/structures-lexique.mts`
> ou dans la donnée. `npm run docs:check` échoue si ce fichier diverge de la mesure.
>
> Question à laquelle ce doc répond : **sous quelle forme ce concept est-il écrit, dans quel dataset, sous quel CHAMP ?**
> Stock nominatif décroissant des formes à éteindre : `scripts/guards/lib/structuresStock.mjs`
> (garde `src/data/structures-contrat.test.ts`).

## Périmètre mesuré et angles morts (à dire pour ne pas se lire comme exhaustif)

Périmètre : les documents AUTHORÉS des deux racines (`src/data`, `src/scenes`), leurs schémas zod
du registre, et les littéraux d’objet zod des `src/data/schemas/defs/*.ts`.
Ce que la mesure ci-dessous **ne voit pas** — un compte n’a de sens qu’avec son périmètre.

- La référence est ANCRÉE SUR L’INDEX DES IDS, scopé par DATASET : une occurrence de référence est une paire (objet, clé) dont la valeur RÉSOUT vers un document indexé d’une CIBLE MAJORITAIRE de son site. Le CHAMP PORTEUR (`skills`, `ops`, `members`…) est MESURÉ, jamais déclaré.
- La RÉSOLUTION est PAR SITE `(dataset, champ, clé)` : cible(s) MAJORITAIRE(S) = les datasets qui couvrent ≥ 50 % des valeurs résolvantes du site. Une valeur qui ne résout QUE vers une cible non majoritaire est comptée AMBIGUË (§1bis, imprimée avec son site et son dataset parasite) et n’ouvre PAS de référence.
- Les COLLISIONS d’ids restent un angle mort du PILOTAGE, pas de la résolution : la colonne « cibles » d’une forme liste tous les datasets atteignables par les valeurs de la ligne.
- LOT, MOTIF et DATE d’une forme sont du PILOTAGE : la sonde ne les mesure pas — la forme OBSERVÉE les reprend du stock par son SITE (concept, dataset, champ, signature), si bien que la véracité d’un `motif` est une décision de REVUE qu’aucune garde ne contrôle.
- La RÉSOLVABILITÉ d’un `{text}` se mesure sur le LIBELLÉ NORMALISÉ (casse, accents, ponctuation, espaces) d’une entité d’un dataset de la CIBLE MAJORITAIRE de son site — de n’importe quel dataset quand le site n’a pas de cible ; elle ne vérifie AUCUN type d’entité attendu, et un `label` qui est aussi un id peut la faire mordre sur un homonyme : la forme `text (résolvable)` est un candidat à migrer en `{id}`, pas un verdict.
- Le partage d’un SITE tranche entre référence cassée et document embarqué, mais les TELLS de document passent avant le ratio (`label` + `source`, ou `label` + ≥ 2 clés de charge utile) et l’égalité tranche pour le DOCUMENT ; un site à UNE seule valeur est un document, sauf si la clé est `…Id`/`…Ids`/`…Ref`.
- L’ORDRE DES PASSES est un angle mort déclaré : l’index est complété par les documents EMBARQUÉS (passe 3) AVANT que la résolution ne soit mesurée (passe 4) — un site comme `arene-projet.json › members {entityId}` ne résout que grâce à cet ordre.
- Une clé dont la valeur est un LITTÉRAL D’ENUM du schéma zod du document n’ouvre jamais de référence (discriminants `kind`/`type`/`class`/`op`…). Depuis #1466 L1a les DEUX racines sont au registre (`SCHEMA_DEFS` + `SCHEMA_DEFS_SCENES`, joints par BASENAME) : les discriminants des scènes sont fermés comme les autres. La fermeture reste bornée à ce que l’introspection atteint — un littéral sous une enveloppe qu’`enfantsDe` ne traverse pas y échappe.
- Une clé de RÉFÉRENCE SCOPÉE (`CLES_REFERENCE_SCOPEE`) n’ouvre jamais de référence vers l’index des ids : sa valeur nomme une identité d’un espace CLOS tenu par un document, que le scan n’indexe pas. Unique entrée : `entry` (lieu de carte, embuscade de route, effet `transition`), dont la cible est une CLÉ de `scenes[].entryPoints` — le scan n’indexant que des VALEURS porteuses d’identité, toute résolution de `entry` contre l’index serait une HOMONYMIE par construction (mesuré 2026-09-06 : `arene-projet.json › entry: "route"` classé référence vers `terrains.json`).
- Les clés de PROSE `label`/`nom`/`desc`/`title` n’ouvrent jamais de référence ; `text` sous un champ de dotation est l’exception unique (résolution NARRATIVE #624). Le porteur ADRESSÉ de la prose (`descRef`, #1389) suit la même règle, `descRef>book` compris : `book` désigne un LIVRE, pas un document indexé — une adresse de prose n’ouvre aucune référence.
- La strate `Instance` du design v2 (SkillInstance, ItemInstance, saves) est DÉCLARÉE HORS PÉRIMÈTRE, pas absente : elle existe en SNAPSHOTS nommés dans la racine `src/scenes` — `barge-du-sel-projet.json` et `loup-et-saumure-projet.json` sous `scenes[].entities[].postes[].ammo[]` (des `ItemInstance` recopiées par `src/engine/items.ts`). Ces chemins ne sont pas mesurés ; `saves` a en outre sa propre politique de version (`src/state/saves.ts`).
- Les ABSENCES d’enveloppe ne se comptent que sur les ENTRÉES DE RACINE (`id` et `source` partout, `label` sur les familles `entité`/`table`) : un document EMBARQUÉ n’est jamais sommé de porter un `id`.
- Le RÉGIME D’ENTRÉES vient de la famille DÉCLARÉE par le schéma zod (`liste` → les éléments, `record` → les valeurs, `config` → le document EST son entrée) ; un document qu’aucune def ne déclare serait classé par sa racine JSON — depuis #1466 L1a il n’y en a plus aucun, les quatre projets de `src/scenes` sont déclarés `config`. La FAMILLE mesurée (`entité`/`table`/`config`/`record`) se déduit du régime : `record` et `config` RECOPIENT la déclaration (régime `valeurs` / `racine`), seule la partition `entité` ⊕ `table` est observée (part des entrées à bornes numériques). Depuis #1467 L1b V-FLIP-RECORD, le régime `valeurs` descend dans `entries` quand le record porte son enveloppe.
- Une valeur mesurée hors de sa forme propre est enregistrée sous sa PROJECTION sur le vocabulaire du concept, suffixée `+…` ; de même pour une référence (clés de graphie + clés qui résolvent, charge utile repliée).
- La candidature `plage` est STRUCTURELLE et non plus positionnelle : tout objet portant `min` ET `max` NUMÉRIQUES est candidat, élément d’un TABLEAU comme porté par un CHAMP (#1659, 2026-09-01 — les 5 `{min,max}` hors tableau des 2 racines entrent dans la mesure : `sea-events › params.impressed`, `› params.wrathful`, `tavernGames › pot.targetRange`, `› volley.libre`, `water-exposure › modifiers[].auto`). Ce qui reste hors candidature est le TYPE : une borne non numérique (`null` d’une bande ouverte comprise) n’ouvre pas la plage. `bornes` reste borné au tableau — aucun `{min,max}` hors tableau ne porte `default`/`step`.
- Une paire de bornes encodée en TUPLE `[min,max]` n’est mesurée par AUCUN concept : la mesure ne classe que des OBJETS, un tableau de deux nombres reste une valeur nue. 36 tuples à l’arbre sur 10 sites (2 racines, 2026-09-06 après l’entrée du dataset des terrains #1690 ; 7 sites au 2026-09-05 après la fusion des matières #1686 lot 2, 8 sites au 2026-09-01 après #1659 L-1659-3, 99 sur 18 à l’ouverture de la vague), et AUCUN n’est une plage — tous sont exclus nommément : 34 paramètres de recette de rendu (`detail.courses.blockWM` 15, `detail.speckle.rM` 17, `detail.tufts.hM` 2, sous `structureAppearance.json`/`materials.json`/`terrains.json`), `qualities.json › [].capabilities.fumbleDigits` (un ENSEMBLE de chiffres) et `structureAppearance.json › [].door.herse.traverseFracs` (des positions fractionnaires). SORTIES du stock parce que devenues des fourchettes `{min,max}` mesurées par le concept `plage` : les 72 disponibilités saisonnières (`sea-cargo.json › cargoes[].avail` 44, `land-cargo.json › cargoes[].avail` 28, L-1659-2), les 7 `ship-construction.json › standard[].lengthM` et les 4 `stars.json › [].sub` (L-1659-3). L’inventaire de ces 36 vit dans `src/data/plage-bornes-contrat.test.ts` (volet F) : il n’a plus à décroître, il a à ne pas repousser.
- Un concept exprimé en SCALAIRE hors liste (`species: "humain"`) est mesuré sous la forme `id-nu`, sans signature d’objet.
- `kind` est polysémique et n’est pas dédoublonné (Condition, Flow, événement de mer, pion de scène).
- Le classement est ORDONNÉ : une VALEUR (reconnue à son noyau) passe avant une RÉFÉRENCE ; un objet qui recoupe deux concepts n’est compté qu’une fois.
- Deux comparateurs de `water-exposure.json` (`<=`/`>=` sous `woundsRemaining`/`woundsLost`) échappent à `conditionSchema` et restent comptés en op.
- Le scan AST est borné aux littéraux `z.object`/`z.strictObject`/`z.looseObject` des `src/data/schemas/defs/*.ts` : il ne voit ni les clés ajoutées par `.extend(...)`, ni un schéma composé par une fabrique, ni les defs hors de ce dossier. Le « schéma commun candidat » est apparié par SIGNATURE EXACTE.
- `schemasCommuns` ne garde qu’UN nom par SIGNATURE (le premier vu, racines avant niches) : deux nœuds de grammaire de même signature se masquent l’un l’autre, et l’arrivée du second RENOMME le « commun » recommandé d’une ligne de redéclaration sans qu’aucun porteur n’ait bougé — mesuré 2026-09-01, `miscast.ts | dice` est passé de `formulaSchema` à `prixTireSchema` (#1463 L-gram-3) à donnée, def et signature INCHANGÉS.
- Les portes MOTEUR (`src/engine`, `src/state`) et les JSON hors documents (outillage, `public/qc/*`, baselines de gardes) ne sont pas mesurés : ce contrat parle de la DONNÉE authorée et de ses schémas.
- Les CACHES de parse AST (`CACHE_SOURCE`, `CACHE_LITTERAUX`) sont module-level et ne sont jamais invalidés : en mode watch, une édition d’un `defs/*.ts` n’est pas re-mesurée sans redémarrage.
- Le concept `test` CÈDE tout objet qui DÉSIGNE une entité (clause `horsDesignation` : clé de `CLES_IDENTITE`, ou clé en `RX_CLE_REFERENCE`) et passe APRÈS `plage` : 12 objets porteurs de `difficulty` restent classés `test` sans en être un — `tavernGames.json › volley.rows` 7 (rangées sans bornes authorées), `sea-events.json › params` 3 (le sujet du jet y vit sous `testType`) et `etats.json › difficultyBy` 2. Ce qui leur manque n’est pas TOUT discriminant structurel (`difficultyBy` porte `{cond, difficulty}`, et `cond` en est un) : c’est une clé de DÉSIGNATION, la seule que ce concept cède.
- Le scan AST des redéclarations ne lit QUE `src/data/schemas/defs/` : les 148 littéraux zod de `src/data/schemas/defs-scenes/` (`effets.ts` 71, `scene.ts` 53, `worldmap.ts` 15, `narratif.ts` 7, `communs.ts` 2) en sont HORS PÉRIMÈTRE — un seul d’entre eux serait classé par le lexique s’il y entrait (`scene.ts:438` `wallClimbSchema`, concept `test` par le noyau `difficulty`). L’autre cas mesuré du concept `test`, `extendedTestSchema`, vit en grammaire (`src/data/schemas/grammaire/mecanique.ts`), hors périmètre elle aussi (#1657).
- Le lexique FERMÉ est le PLAFOND de détection des redéclarations : un littéral dont le concept n’est pas au lexique n’est compté que s’il a un schéma commun de MÊME signature exacte — deux defs divergents sur un champ d’un concept absent restent invisibles aux occurrences, et seul le compte GLOBAL des littéraux (`totalLitteraux`, 482 après ce lot, 487 à `9739ee1f4`) bouge.

## 1. Racines

| Racine | Fichiers retenus | Documents | Au registre zod |
|---|---|---|---|
| `src/data` | `*.json` | 124 | 124 / 124 |
| `src/scenes` | `*-projet.json` (récursif) | 4 | 4 / 4 |

Documents qu’AUCUNE def ne déclare : **0**.
Defs dont le relevé déclaré est TRONQUÉ par la borne d’introspection : **0**. Au-delà de la
borne, `classeZod`/`clesDeclarees` écrivent le marqueur `(profondeur)` au lieu de la forme : la
troncature se COMPTE ici, elle ne se tait pas.

### 1bis. Index des ids (le cœur du détecteur)

Identités indexées : **5970** (entrées de racine + documents embarqués) ; libellés
normalisés : **5208**. Un id vu dans PLUSIEURS datasets rend la résolution
AMBIGUË (jamais fausse) : **402** collisions, et **3472** ids
sont aussi le libellé d’une entité (faux positif possible sur la résolvabilité d’un `{text}`).

| Id | Datasets |
|---|---|
| `ogre` | `creatures.json` `groups.json` `names.json` `raceAppearance.json` `species.json` `traits.json` |
| `halfling` | `creatures.json` `groups.json` `names.json` `raceAppearance.json` `skills.json` |
| `herboriste` | `careers.json` `creatures.json` `merchants.json` `skills.json` `talents.json` |
| `nain` | `creatures.json` `groups.json` `names.json` `raceAppearance.json` `tavernGames.json` |
| `resistance` | `activities.json` `maladies.json` `skills.json` `talents.json` `water-exposure.json` |
| `apothicaire` | `careers.json` `creatures.json` `skills.json` `talents.json` |
| `armurier` | `loup-et-saumure-projet.json` `merchants.json` `skills.json` `talents.json` |
| `belier` | `mass-battle.json` `naval-traits.json` `qualities.json` `spells.json` |
| `corruption` | `characteristics.json` `systemes.manifest.json` `talents.json` `traits.json` |
| `feu` | `breath-types.json` `damage-types.json` `domains.json` `obsessions.json` |
| `forgeron` | `arene-projet.json` `lieux-services.json` `skills.json` `talents.json` |
| `humain` | `creatures.json` `groups.json` `names.json` `raceAppearance.json` |
| `ingenierie` | `axes.json` `skills.json` `talents.json` `weaponGroups.json` |
| `magie` | `obsessions.json` `skills.json` `systemes.manifest.json` `talents.json` |
| `magique` | `damage-types.json` `lightTones.json` `qualities.json` `traits.json` |
| `medecin` | `arene-projet.json` `careers.json` `creatures.json` `merchants.json` |
| `nains` | `obsessions.json` `skills.json` `species.json` `talents.json` |
| `noble` | `careers.json` `groups.json` `skills.json` `talents.json` |
| `poison` | `breath-types.json` `damage-types.json` `skills.json` `talents.json` |
| `porte` | `mass-battle.json` `structureAppearance.json` `structures.json` `terrains.json` |
| `skaven` | `creatures.json` `groups.json` `raceAppearance.json` `talents.json` |
| `alchimiste` | `careers.json` `skills.json` `talents.json` |
| `arme` | `maneuvers.json` `qualitySubtypes.json` `traits.json` |
| `artilleur` | `careers.json` `crew-roles.json` `talents.json` |
| `bois` | `land-cargo.json` `sea-cargo.json` `terrains.json` |
| `calme` | `drunkenness.json` `river-navigation.json` `skills.json` |
| `cartographe` | `careers.json` `skills.json` `talents.json` |
| `cartographie` | `activities.json` `skills.json` `talents.json` |
| `chaland` | `arene-projet.json` `skills.json` `vehicles.json` |
| `chandelier` | `props.json` `skills.json` `talents.json` |
| `charpentier` | `loup-et-saumure-projet.json` `skills.json` `talents.json` |
| `charrette` | `props.json` `structures.json` `vehicles.json` |
| `chien` | `creatures.json` `montures.json` `skills.json` |
| `cogue` | `loup-et-saumure-projet.json` `skills.json` `vehicles.json` |
| `combat` | `donnees.manifest.json` `skills.json` `systemes.manifest.json` |
| `commerce` | `land-cargo.json` `sea-cargo.json` `systemes.manifest.json` |
| `contrebandier` | `careers.json` `creatures.json` `skills.json` |
| `crepuscule` | `arene-projet.json` `calendarPhases.json` `lightLevels.json` |
| `cuisinier` | `crew-roles.json` `skills.json` `talents.json` |
| `demonologie` | `domains.json` `skills.json` `talents.json` |
| `diligence` | `diligence-projet.json` `structures.json` `vehicles.json` |
| `discretion` | `axes.json` `creatures.json` `skills.json` |
| `explosifs` | `skills.json` `talents.json` `weaponGroups.json` |
| `fouiller` | `arene-projet.json` `barge-du-sel-projet.json` `loup-et-saumure-projet.json` |
| `frenesie` | `psychology.json` `talents.json` `traits.json` |
| `garde` | `arene-projet.json` `careers.json` `groups.json` |
| `gnome` | `groups.json` `names.json` `raceAppearance.json` |
| `haine` | `psychology.json` `talents.json` `traits.json` |
| `ingenieur` | `careers.json` `skills.json` `talents.json` |
| `khorne` | `gods.json` `groups.json` `skills.json` |
| `maladie` | `obsessions.json` `talents.json` `traits.json` |
| `mauvais-oeil` | `mutations.json` `spells.json` `traits.json` |
| `mort-vivant` | `groups.json` `skills.json` `traits.json` |
| `mouvement` | `actions.json` `characteristics.json` `regles.json` |
| `mur-en-bois` | `mass-battle.json` `structureAppearance.json` `structures.json` |
| `mur-en-pierre` | `mass-battle.json` `structureAppearance.json` `structures.json` |
| `necromancie` | `domains.json` `skills.json` `talents.json` |
| `nurgle` | `gods.json` `groups.json` `skills.json` |
| `p0` | `arene-projet.json` `barge-du-sel-projet.json` `loup-et-saumure-projet.json` |
| `peur` | `mass-battle.json` `psychology.json` `traits.json` |
| `pont` | `ship-stations.json` `spells.json` `vehicles.json` |
| `porte-blindee` | `mass-battle.json` `structureAppearance.json` `structures.json` |
| `porte-de-ville` | `mass-battle.json` `structureAppearance.json` `structures.json` |
| `protection` | `activities.json` `spells.json` `traits.json` |
| `rapide` | `qualities.json` `ship-construction.json` `traits.json` |
| `reikland` | `locations.json` `skills.json` `talents.json` |
| `rocher` | `props.json` `sea-perils.json` `trappings.json` |
| `salzenmund` | `books.json` `loup-et-saumure-projet.json` `naval-ports.json` |
| `siege` | `props.json` `qualities.json` `skills.json` |
| `sigmar` | `gods.json` `skills.json` `talents.json` |
| `slaanesh` | `gods.json` `groups.json` `skills.json` |
| `start` | `arene-projet.json` `barge-du-sel-projet.json` `loup-et-saumure-projet.json` |
| `tatouage` | `skills.json` `talents.json` `trappings.json` |
| `tzeentch` | `gods.json` `groups.json` `skills.json` |
| `voleur` | `careers.json` `creatures.json` `skills.json` |
| `altdorf` | `diligence-projet.json` `locations.json` |
| `amour` | `psychology.json` `traits.json` |
| `anatomie` | `skills.json` `talents.json` |
| `animaux` | `skills.json` `talents.json` |
| `animosite` | `psychology.json` `traits.json` |
| `arbalete` | `trappings.json` `weaponGroups.json` |
| `arc` | `trappings.json` `weaponGroups.json` |
| `arene` | `arene-projet.json` `tavernGames.json` |
| `armes-de-siege` | `mass-battle.json` `weaponGroups.json` |
| `armure` | `qualitySubtypes.json` `traits.json` |
| `art` | `skills.json` `talents.json` |
| `artiste` | `careers.json` `talents.json` |
| `astrologie` | `skills.json` `talents.json` |
| `augure` | `activities.json` `skills.json` |
| `avitailleur` | `loup-et-saumure-projet.json` `merchants.json` |
| `bailli` | `careers.json` `groups.json` |
| `baliste` | `mass-battle.json` `trappings.json` |
| `barbier` | `skills.json` `talents.json` |
| `barque` | `props.json` `vehicles.json` |
| `bateau-de-patrouille` | `structures.json` `vehicles.json` |
| `batelier` | `careers.json` `creatures.json` |
| `battement` | `actions.json` `talents.json` |
| `batterie-tonnerre-de-feu` | `mass-battle.json` `trappings.json` |
| `batteur-d-armure` | `skills.json` `talents.json` |
| `beni` | `talents.json` `traits.json` |
| `bete` | `domains.json` `groups.json` |
| `betes-sauvages` | `skills.json` `talents.json` |
| `blaireau` | `creatures.json` `skills.json` |
| `blizzard` | `spells.json` `weather.json` |
| `boeuf` | `creatures.json` `montures.json` |
| `bouclier` | `spells.json` `trappings.json` |
| `bourse` | `props.json` `trappings.json` |
| `brasseur` | `skills.json` `talents.json` |
| `bricoleur` | `skills.json` `talents.json` |
| `broyeur-d-os` | `spells.json` `trappings.json` |
| `cale` | `naval-traits.json` `ship-stations.json` |
| `calligraphe` | `skills.json` `talents.json` |
| `calligraphie` | `skills.json` `talents.json` |
| `calme-plat` | `sea-events.json` `sea-weather.json` |
| `camaraderie` | `psychology.json` `traits.json` |
| `campagne` | `donnees.manifest.json` `water-exposure.json` |
| `canon-a-repetition-feu-d-enfer` | `mass-battle.json` `trappings.json` |
| `carreau` | `spells.json` `trappings.json` |
| `cavalerie` | `talents.json` `weaponGroups.json` |
| `chaise` | `props.json` `vehicles.json` |
| `chaloupe` | `structures.json` `vehicles.json` |
| `chansonnier` | `careers.json` `crew-roles.json` |
| `chaos` | `skills.json` `talents.json` |
| `chapelle` | `arene-projet.json` `buildings.json` |
| `charge` | `actions.json` `activities.json` |
| `chariot-leger` | `structures.json` `vehicles.json` |
| `chariot-lourd` | `structures.json` `vehicles.json` |
| `chariot-moyen` | `structures.json` `vehicles.json` |
| `charlatan` | `careers.json` `creatures.json` |
| `charpentier-naval` | `skills.json` `talents.json` |
| `chasseur` | `careers.json` `skills.json` |
| `cheval` | `creatures.json` `skills.json` |
| `cheval-de-monte` | `creatures.json` `montures.json` |
| `cheval-de-trait` | `creatures.json` `montures.json` |
| `cheval-de-trait-lourd` | `creatures.json` `montures.json` |
| `chevalier` | `careers.json` `groups.json` |
| `chimie` | `skills.json` `talents.json` |
| `chute` | `regles.json` `spells.json` |
| `cirier` | `skills.json` `talents.json` |
| `citadins` | `classes.json` `talents.json` |
| `cloture-en-clayonnage` | `structureAppearance.json` `structures.json` |
| `cogue-gun` | `barge-du-sel-projet.json` `loup-et-saumure-projet.json` |
| `cogue-helm` | `barge-du-sel-projet.json` `loup-et-saumure-projet.json` |
| `cogue-pirate` | `barge-du-sel-projet.json` `sea-events.json` |
| `colifichets` | `skills.json` `talents.json` |
| `colporteur` | `careers.json` `interludeEvents.json` |
| `construction-de-bateaux` | `skills.json` `talents.json` |
| `cordonnier` | `skills.json` `talents.json` |
| `cornes` | `maneuvers.json` `traits.json` |
| `cotes-et-marees` | `skills.json` `talents.json` |
| `course` | `actions.json` `regles.json` |
| `couvert` | `lightLevels.json` `trappings.json` |
| `criminel` | `groups.json` `talents.json` |
| `cultiste` | `creatures.json` `groups.json` |
| `cultistes` | `skills.json` `talents.json` |
| `debris-marins` | `sea-events.json` `sea-perils.json` |
| `demigriffon` | `creatures.json` `skills.json` |
| `demon` | `groups.json` `raceAppearance.json` |
| `distraire` | `actions.json` `talents.json` |
| `dragons` | `skills.json` `talents.json` |
| `dressage` | `activities.json` `skills.json` |
| `eau` | `obsessions.json` `terrains.json` |
| `echoppe` | `arene-projet.json` `buildings.json` |
| `eclaireur` | `careers.json` `skills.json` |
| `ecriture` | `skills.json` `talents.json` |
| `effrayant` | `spells.json` `talents.json` |
| `electrique` | `breath-types.json` `damage-types.json` |
| `elfe` | `groups.json` `tavernGames.json` |
| `elfe-sylvain` | `names.json` `raceAppearance.json` |
| `elfes` | `obsessions.json` `skills.json` |
| `embaumeur` | `skills.json` `talents.json` |
| `empire` | `skills.json` `talents.json` |
| `empoisonneur` | `skills.json` `talents.json` |
| `epaves` | `skills.json` `talents.json` |
| `equipage` | `systemes.manifest.json` `talents.json` |
| `erengrad` | `loup-et-saumure-projet.json` `naval-ports.json` |
| `erudit` | `careers.json` `creatures.json` |
| `esprits` | `skills.json` `talents.json` |
| `etreinte-glaciale` | `maneuvers.json` `traits.json` |
| `explosion` | `spells.json` `steam-breakdown.json` |
| `exposure` | `night-stakes.json` `voyage-stakes.json` |
| `fabricant-d-arcs` | `skills.json` `talents.json` |
| `ferronnier` | `skills.json` `talents.json` |
| `filet` | `qualities.json` `trappings.json` |
| `fimir` | `creatures.json` `raceAppearance.json` |
| `flagellant` | `careers.json` `talents.json` |
| `flamme` | `lightTones.json` `spells.json` |
| `fleau` | `trappings.json` `weaponGroups.json` |
| `flechette` | `spells.json` `trappings.json` |
| `folklore` | `skills.json` `talents.json` |
| `foret` | `arene-projet.json` `talents.json` |
| `forge` | `arene-projet.json` `buildings.json` |
| `fort` | `river-navigation.json` `sea-perils.json` |
| `frisson-paralysant` | `maneuvers.json` `traits.json` |
| `fronde` | `trappings.json` `weaponGroups.json` |
| `fuite` | `regles.json` `talents.json` |
| `geants` | `skills.json` `talents.json` |
| `genealogie` | `skills.json` `talents.json` |
| `geographie` | `skills.json` `talents.json` |
| `geologie` | `skills.json` `talents.json` |
| `gobelin` | `creatures.json` `raceAppearance.json` |
| `goule` | `creatures.json` `raceAppearance.json` |
| `gouvernail-brise` | `etats.json` `ship-criticals.json` |
| `grand-loup` | `creatures.json` `skills.json` |
| `graveur` | `skills.json` `talents.json` |
| `gravure` | `skills.json` `talents.json` |
| `griffon` | `creatures.json` `skills.json` |
| `gris` | `eyes.json` `hairs.json` |
| `guerre` | `skills.json` `talents.json` |
| `guerrier-du-chaos` | `creatures.json` `raceAppearance.json` |
| `guilde` | `lieux-services.json` `skills.json` |
| `halflings` | `obsessions.json` `species.json` |
| `haut-elfe` | `names.json` `raceAppearance.json` |
| `heraldique` | `skills.json` `talents.json` |
| `herbes` | `skills.json` `talents.json` |
| `herse` | `structureAppearance.json` `structures.json` |
| `histoire` | `skills.json` `talents.json` |
| `homme-bete` | `groups.json` `raceAppearance.json` |
| `hors-la-loi` | `careers.json` `talents.json` |
| `hurlement-de-la-bete-indomptable` | `maneuvers.json` `traits.json` |
| `hurlement-fantomatique` | `maneuvers.json` `traits.json` |
| `icones` | `skills.json` `talents.json` |
| `imprimerie` | `skills.json` `talents.json` |
| `inconscient` | `etats.json` `water-exposure.json` |
| `infecte` | `qualities.json` `traits.json` |
| `intrus` | `activities.json` `talents.json` |
| `itineraires` | `skills.json` `talents.json` |
| `joallier` | `skills.json` `talents.json` |
| `juriste` | `careers.json` `groups.json` |
| `la-gueule` | `skills.json` `spells.json` |
| `laine` | `land-cargo.json` `sea-cargo.json` |
| `langue-prehensile` | `maneuvers.json` `traits.json` |
| `lanterne` | `lightTones.json` `trappings.json` |
| `lapidaire` | `skills.json` `talents.json` |
| `le-moot` | `skills.json` `talents.json` |
| `leger` | `qualities.json` `river-navigation.json` |
| `lettres` | `classes.json` `talents.json` |
| `local` | `skills.json` `talents.json` |
| `loi` | `skills.json` `talents.json` |
| `loup` | `creatures.json` `skills.json` |
| `lumiere` | `domains.json` `spells.json` |
| `macon` | `skills.json` `talents.json` |
| `maelstrom` | `sea-events.json` `sea-perils.json` |
| `magick` | `skills.json` `talents.json` |
| `magie-noire` | `skills.json` `talents.json` |
| `mal-de-mer` | `maladies.json` `spells.json` |
| `manann` | `gods.json` `skills.json` |
| `mantelet-de-bois` | `structureAppearance.json` `structures.json` |
| `marais` | `arene-projet.json` `talents.json` |
| `marchandage` | `sea-cargo.json` `skills.json` |
| `marechal-ferrant` | `skills.json` `talents.json` |
| `marmite` | `props.json` `trappings.json` |
| `maroquinier` | `skills.json` `talents.json` |
| `materiel-artistique` | `skills.json` `talents.json` |
| `maudit` | `qualities.json` `spells.json` |
| `mauvaise-influence` | `peripeties.json` `rencontres-edoc.json` |
| `melee` | `axes.json` `merchantFamilies.json` |
| `metal` | `domains.json` `land-cargo.json` |
| `metallurgie` | `skills.json` `talents.json` |
| `middenheim` | `books.json` `skills.json` |
| `mineur` | `careers.json` `skills.json` |
| `minotaure` | `creatures.json` `raceAppearance.json` |
| `monstres` | `obsessions.json` `talents.json` |
| `morsure` | `maneuvers.json` `traits.json` |
| `mortier` | `mass-battle.json` `trappings.json` |
| `mosaique` | `skills.json` `talents.json` |
| `moyen` | `sea-perils.json` `ship-construction.json` |
| `mur-a-ossature-en-bois` | `structureAppearance.json` `structures.json` |
| `mur-de-chateau` | `structureAppearance.json` `structures.json` |
| `mur-de-forteresse-naine` | `structureAppearance.json` `structures.json` |
| `mur-de-pierre-aa` | `structureAppearance.json` `structures.json` |
| `mur-en-pierres-seches` | `structureAppearance.json` `structures.json` |
| `mutation` | `talents.json` `traits.json` |
| `natation` | `sea-perils.json` `skills.json` |
| `nautonier` | `careers.json` `creatures.json` |
| `navigation` | `axes.json` `skills.json` |
| `neige` | `terrains.json` `weather.json` |
| `nid-de-pie` | `naval-traits.json` `ship-stations.json` |
| `noir` | `eyes.json` `hairs.json` |
| `nuee` | `spells.json` `traits.json` |
| `nuit` | `calendarPhases.json` `lightLevels.json` |
| `officier` | `careers.json` `creatures.json` |
| `ogres` | `skills.json` `species.json` |
| `orc` | `creatures.json` `raceAppearance.json` |
| `orfevre` | `skills.json` `talents.json` |
| `orientation` | `crew-test-types.json` `skills.json` |
| `palissade-de-pieux` | `structureAppearance.json` `structures.json` |
| `parade` | `skills.json` `weaponGroups.json` |
| `patrouilleur-fluvial` | `careers.json` `creatures.json` |
| `pegase` | `creatures.json` `skills.json` |
| `peintre` | `skills.json` `talents.json` |
| `peinture` | `skills.json` `talents.json` |
| `percee` | `activities.json` `structure-criticals.json` |
| `perception` | `crew-test-types.json` `skills.json` |
| `perturbant` | `spells.json` `traits.json` |
| `phobie` | `psychology.json` `traits.json` |
| `pieces-detachees-de-navire` | `sea-cargo.json` `trappings.json` |
| `pierre` | `materials.json` `terrains.json` |
| `pieuvre-des-tourbieres` | `creatures.json` `groups.json` |
| `pigeon` | `creatures.json` `skills.json` |
| `pilleur-de-tombes` | `careers.json` `creatures.json` |
| `pirate-1` | `barge-du-sel-projet.json` `loup-et-saumure-projet.json` |
| `pirate-2` | `barge-du-sel-projet.json` `loup-et-saumure-projet.json` |
| `pistolet` | `qualities.json` `trappings.json` |
| `plantes` | `skills.json` `talents.json` |
| `poisons` | `skills.json` `talents.json` |
| `politique` | `skills.json` `talents.json` |
| `potier` | `skills.json` `talents.json` |
| `poudre-impregnee-d-aqshy` | `qualities.json` `trappings.json` |
| `poulet` | `creatures.json` `trappings.json` |
| `prejuge` | `psychology.json` `traits.json` |
| `produits-de-luxe` | `land-cargo.json` `sea-cargo.json` |
| `prophetie` | `skills.json` `talents.json` |
| `proue-idole-de-stromfels` | `loup-et-saumure-projet.json` `naval-traits.json` |
| `puissant-vortex` | `sea-events.json` `sea-perils.json` |
| `rage-meurtriere` | `spells.json` `symptoms.json` |
| `ranald` | `gods.json` `skills.json` |
| `rat-ogre` | `creatures.json` `skills.json` |
| `rats` | `skills.json` `talents.json` |
| `rebouteux` | `creatures.json` `skills.json` |
| `receleur` | `careers.json` `creatures.json` |
| `regard-petrifiant` | `maneuvers.json` `traits.json` |
| `regeneration` | `spells.json` `traits.json` |
| `region` | `skills.json` `talents.json` |
| `religion` | `groups.json` `skills.json` |
| `remedes` | `skills.json` `talents.json` |
| `renforce` | `barge-du-sel-projet.json` `naval-traits.json` |
| `repurgateur` | `careers.json` `creatures.json` |
| `resistance-a-la-magie` | `talents.json` `traits.json` |
| `rhinox` | `creatures.json` `skills.json` |
| `robuste` | `naval-traits.json` `talents.json` |
| `sang-corrosif` | `spells.json` `traits.json` |
| `sanglier` | `creatures.json` `skills.json` |
| `savoir` | `axes.json` `skills.json` |
| `savoir-vivre` | `skills.json` `talents.json` |
| `science` | `skills.json` `talents.json` |
| `sculpture` | `skills.json` `talents.json` |
| `sea-shipwreck-swim` | `reglesOptionnelles.json` `voyage-stakes.json` |
| `serpent` | `creatures.json` `groups.json` |
| `silence` | `spells.json` `trappings.json` |
| `singe` | `creatures.json` `trappings.json` |
| `snotling` | `creatures.json` `raceAppearance.json` |
| `soins` | `axes.json` `spells.json` |
| `soldat` | `careers.json` `groups.json` |
| `soleil-flamboyant` | `skills.json` `spells.json` |
| `solide` | `naval-traits.json` `qualities.json` |
| `solide-porte-en-bois` | `structureAppearance.json` `structures.json` |
| `sorcier` | `careers.json` `talents.json` |
| `sorcieres` | `skills.json` `talents.json` |
| `souffle` | `spells.json` `traits.json` |
| `squelette` | `creatures.json` `raceAppearance.json` |
| `squig` | `creatures.json` `skills.json` |
| `stromfels` | `gods.json` `skills.json` |
| `sulpteur-sur-bois` | `skills.json` `talents.json` |
| `surpris` | `activities.json` `etats.json` |
| `taille` | `qualities.json` `traits.json` |
| `tailleur` | `skills.json` `talents.json` |
| `tailleur-de-pierre` | `skills.json` `talents.json` |
| `tanneur` | `skills.json` `talents.json` |
| `taverne` | `arene-projet.json` `buildings.json` |
| `taverniere` | `arene-projet.json` `merchants.json` |
| `taxes` | `skills.json` `talents.json` |
| `tempete` | `mass-battle.json` `sea-events.json` |
| `tentacules` | `maneuvers.json` `traits.json` |
| `tente` | `props.json` `trappings.json` |
| `terrassement` | `structureAppearance.json` `structures.json` |
| `terre` | `materials.json` `terrains.json` |
| `terreur` | `psychology.json` `traits.json` |
| `theologie` | `skills.json` `talents.json` |
| `tileen` | `groups.json` `skills.json` |
| `timonier` | `crew-roles.json` `river-criticals.json` |
| `tissage` | `skills.json` `talents.json` |
| `tisseur` | `skills.json` `talents.json` |
| `toile` | `props.json` `traits.json` |
| `tonneau` | `props.json` `trappings.json` |
| `tonnelier` | `skills.json` `talents.json` |
| `torture` | `skills.json` `talents.json` |
| `tourbillon` | `sea-perils.json` `spells.json` |
| `tout` | `groups.json` `talents.json` |
| `tres-fort` | `river-navigation.json` `talents.json` |
| `triton` | `creatures.json` `sea-events.json` |
| `troll` | `creatures.json` `raceAppearance.json` |
| `trolls` | `skills.json` `talents.json` |
| `tueur` | `careers.json` `talents.json` |
| `ulric` | `gods.json` `skills.json` |
| `vampire` | `creatures.json` `raceAppearance.json` |
| `vents-favorables` | `sea-events.json` `spells.json` |
| `verrier` | `skills.json` `talents.json` |
| `vers` | `creatures.json` `trappings.json` |
| `vers-de-carie` | `maladies.json` `symptoms.json` |
| `vers-du-reik` | `maladies.json` `symptoms.json` |
| `vigneron` | `skills.json` `talents.json` |
| `villageois` | `careers.json` `creatures.json` |
| `villageois-1` | `arene-projet.json` `careerLevels.json` |
| `villageois-2` | `arene-projet.json` `careerLevels.json` |
| `vin` | `land-cargo.json` `sea-cargo.json` |
| `vision-nocturne` | `talents.json` `traits.json` |
| `voies-fluviales` | `skills.json` `talents.json` |
| `vol` | `spells.json` `traits.json` |
| `voleurs` | `peripeties.json` `rencontres-edoc.json` |
| `vomissement` | `maneuvers.json` `traits.json` |
| `zombie` | `creatures.json` `raceAppearance.json` |

#### Résolutions AMBIGUËS (la collision qui MORD)

La résolution est mesurée PAR SITE `(dataset, champ, clé)` : les cibles MAJORITAIRES d’un site
sont les datasets qui couvrent ≥ 50 % de ses valeurs résolvantes. Une valeur qui ne résout QUE
vers un dataset HORS de ces cibles est AMBIGUË : elle compte encore comme référence, mais le
dataset atteint n’est pas celui que le site vise — c’est là qu’une collision d’ids peut mentir.

**208** valeurs ambiguës, **953** occurrences. Les 40 plus fréquentes :

| Dataset | Champ | Clé | Valeur | Résout vers | Cibles majoritaires du site | Occurrences |
|---|---|---|---|---|---|---|
| `creatures.json` | `skills` | `spec` | `base` | `weaponGroups.json` | `skills.json` | 148 |
| `creatures.json` | `skills` | `spec` | `bagarre` | `weaponGroups.json` | `skills.json` | 89 |
| `careerLevels.json` | `skills` | `spec` | `base` | `weaponGroups.json` | `skills.json` | 73 |
| `creatures.json` | `skills` | `spec` | `armes-d-hast` | `weaponGroups.json` | `skills.json` | 51 |
| `creatures.json` | `skills` | `spec` | `arc` | `trappings.json` `weaponGroups.json` | `skills.json` | 23 |
| `creatures.json` | `skills` | `spec` | `deux-mains` | `weaponGroups.json` | `skills.json` | 18 |
| `arene-projet.json` | `entities` | `ref` | `gobelin` | `creatures.json` `raceAppearance.json` | `props.json` | 17 |
| `careerLevels.json` | `skills` | `spec` | `armes-d-hast` | `weaponGroups.json` | `skills.json` | 17 |
| `creatures.json` | `skills` | `spec` | `poudre-noire` | `weaponGroups.json` | `skills.json` | 17 |
| `creatures.json` | `skills` | `spec` | `lancer` | `weaponGroups.json` | `skills.json` | 16 |
| `arene-projet.json` | `entities` | `ref` | `humain` | `creatures.json` `groups.json` `names.json` `raceAppearance.json` | `props.json` | 15 |
| `careerLevels.json` | `skills` | `spec` | `bagarre` | `weaponGroups.json` | `skills.json` | 15 |
| `careerLevels.json` | `skills` | `spec` | `poudre-noire` | `weaponGroups.json` | `skills.json` | 15 |
| `creatures.json` | `skills` | `spec` | `arbalete` | `trappings.json` `weaponGroups.json` | `skills.json` | 15 |
| `creatures.json` | `skills` | `spec` | `entraves` | `weaponGroups.json` | `skills.json` | 14 |
| `species.json` | `skills` | `spec` | `base` | `weaponGroups.json` | `skills.json` | 13 |
| `careerLevels.json` | `skills` | `spec` | `arbalete` | `trappings.json` `weaponGroups.json` | `skills.json` | 9 |
| `careerLevels.json` | `skills` | `spec` | `arc` | `trappings.json` `weaponGroups.json` | `skills.json` | 9 |
| `arene-projet.json` | `entities` | `ref` | `gor` | `creatures.json` | `props.json` | 8 |
| `arene-projet.json` | `entities` | `ref` | `zombie` | `creatures.json` `raceAppearance.json` | `props.json` | 8 |
| `careerLevels.json` | `skills` | `spec` | `cavalerie` | `talents.json` `weaponGroups.json` | `skills.json` | 8 |
| `creatures.json` | `skills` | `spec` | `fleau` | `trappings.json` `weaponGroups.json` | `skills.json` | 8 |
| `arene-projet.json` | `entities` | `ref` | `ungor` | `creatures.json` | `props.json` | 7 |
| `careerLevels.json` | `skills` | `spec` | `fronde` | `trappings.json` `weaponGroups.json` | `skills.json` | 7 |
| `careerLevels.json` | `skills` | `spec` | `lancer` | `weaponGroups.json` | `skills.json` | 7 |
| `creatures.json` | `skills` | `spec` | `dhar` | `domains.json` | `skills.json` | 7 |
| `creatures.json` | `optionals` | `arg` | `fievre-du-rongeur` | `maladies.json` | `ship-construction.json` | 7 |
| `spells.json` | `ops` | `op` | `corruption` | `characteristics.json` `systemes.manifest.json` `talents.json` `traits.json` | `actions.json` | 7 |
| `careerLevels.json` | `skills` | `spec` | `deux-mains` | `weaponGroups.json` | `skills.json` | 6 |
| `careerLevels.json` | `skills` | `spec` | `entraves` | `weaponGroups.json` | `skills.json` | 6 |
| `species.json` | `skills` | `spec` | `arc` | `trappings.json` `weaponGroups.json` | `skills.json` | 6 |
| `arene-projet.json` | `entities` | `ref` | `rat-geant` | `creatures.json` | `props.json` | 5 |
| `arene-projet.json` | `entities` | `ref` | `snotling` | `creatures.json` `raceAppearance.json` | `props.json` | 5 |
| `arene-projet.json` | `entities` | `ref` | `squelette` | `creatures.json` `raceAppearance.json` | `props.json` | 5 |
| `creatures.json` | `appearance` | `tenue` | `guerrier-du-chaos` | `creatures.json` `raceAppearance.json` | `careers.json` | 5 |
| `creatures.json` | `appearance` | `tenue` | `ogre` | `creatures.json` `groups.json` `names.json` `raceAppearance.json` `species.json` `traits.json` | `careers.json` | 5 |
| `creatures.json` | `talents` | `spec` | `ulric` | `gods.json` `skills.json` | `talents.json` | 5 |
| `arene-projet.json` | `entities` | `ref` | `cultiste` | `creatures.json` `groups.json` | `props.json` | 4 |
| `arene-projet.json` | `entities` | `ref` | `guerrier-des-clans` | `creatures.json` | `props.json` | 4 |
| `arene-projet.json` | `entities` | `ref` | `serpent` | `creatures.json` `groups.json` | `props.json` | 4 |

## 2. Enveloppe des documents

### 2.1 Un document, sa racine, ses clés de premier niveau

Racine JSON = forme réelle du fichier ; famille déclarée = ce que dit son schéma zod (vide si le
document n’est pas au registre) ; famille MESURÉE = `entité` / `table` (liste dont la moitié des
entrées portent une plage) / `config` / `record`. C’est la famille déclarée qui donne le RÉGIME
D’ENTRÉES, donc à qui appartiennent les clés. Chaque clé porte ses classes de type observées et le
nombre d’entrées qui la portent.

| Document | Racine JSON | Famille déclarée | Famille mesurée | Entrées | Clés de 1er niveau |
|---|---|---|---|---|---|
| `src/data/actions.json` | array | liste | entité | 55 | `armed`:string(5) `candidates`:string(20) `coutAction`:string(55) `exitSafe`:boolean(6) `gate`:array/string(55) `hote`:string(1) `icon`:string(55) `id`:string(55) `intent`:string(4) `keys`:array(41) `label`:string(55) `maison`:string(30) `mode`:string(12) `panneau`:boolean(2) `role`:string(6) `rule`:string(32) `ruleCategory`:string(32) `run`:string(52) `source`:object(12) `stance`:string(2) `surface`:string(55) `type`:string(55) |
| `src/data/activities.json` | array | liste | entité | 63 | `assisted`:boolean(1) `blocked`:object(7) `classGate`:object(12) `combined`:boolean(2) `contexts`:array(63) `desc`:string(62) `difficulty`:string(52) `difficultyFrom`:object(1) `encounter`:string(3) `extended`:object(1) `failExtenue`:boolean(7) `freeSkill`:boolean(1) `generalDownOn`:string(2) `grantsFlag`:string(2) `hold`:object(1) `icon`:string(63) `id`:string(63) `label`:string(63) `maison`:string(9) `minInvest`:object(1) `onSuccess`:array(1) `outcomes`:array(36) `requires`:array(2) `resolver`:string(21) `rounds`:number(7) `rule`:string(1) `ruleCategory`:string(1) `sceneKind`:string(13) `skills`:array(49) `source`:object(63) `stageOutcome`:string(7) `stake`:string(47) `stakeForm`:string(47) `testModFrom`:string(1) `testMods`:array(1) `threat`:object(1) `type`:string(63) `unavailableIfExtenue`:boolean(1) `weatherMod`:object(2) `where`:array(5) `worldRolls`:array(1) |
| `src/data/advancementCosts.json` | array | liste | table | 15 | `coutCarac`:number(15) `coutCompetence`:number(15) `id`:string(15) `label`:string(15) `max`:null/number(15) `min`:number(15) `source`:object(15) `type`:string(15) |
| `src/data/ambiance.json` | object | pipe à la racine | config | 1 | `ambientFloor`:number(1) `entreeEnScene`:object(1) `faceShade`:object(1) `fogTint`:object(1) `id`:string(1) `iso`:object(1) `label`:string(1) `pov`:object(1) `type`:string(1) |
| `src/data/arcane-phenomena.json` | object | pipe à la racine | config | 1 | `id`:string(1) `label`:string(1) `phenomena`:array(1) `saturationLevels`:array(1) `tables`:array(1) `type`:string(1) `windSaturationEffects`:array(1) |
| `src/data/artillery-misfire.json` | object | pipe à la racine | config | 1 | `die`:string(1) `entries`:array(1) `id`:string(1) `label`:string(1) `source`:object(1) `type`:string(1) |
| `src/data/astrology.json` | array | liste | entité | 5 | `desc`:string(5) `id`:string(5) `label`:string(5) `rand`:number(5) `source`:object(5) `type`:string(5) |
| `src/data/axes.json` | array | liste | entité | 9 | `core`:boolean(6) `desc`:string(9) `id`:string(9) `label`:string(9) `maison`:string(9) `skills`:array(9) `talents`:array(3) `type`:string(9) |
| `src/data/books.json` | array | liste | entité | 30 | `abbr`:string(30) `coeur`:string(2) `desc`:string(18) `dir`:string(17) `extractionDir`:string(1) `folder`:string(30) `id`:string(30) `label`:string(30) `language`:string(30) `niveauDeSection`:number(12) `pdf`:string(17) `teneur`:string(6) `type`:string(30) |
| `src/data/breath-types.json` | array | liste | entité | 6 | `id`:string(6) `label`:string(6) `type`:string(6) |
| `src/data/buildings.json` | array | liste | entité | 7 | `features`:array(4) `id`:string(7) `label`:string(7) `maison`:string(7) `roofMaterial`:string(7) `type`:string(7) |
| `src/data/calendarIntercalary.json` | array | liste | entité | 6 | `afterMonth`:number(6) `id`:string(6) `label`:string(6) `source`:object(6) `type`:string(6) |
| `src/data/calendarMonths.json` | array | liste | entité | 12 | `days`:number(12) `id`:string(12) `label`:string(12) `source`:object(12) `type`:string(12) |
| `src/data/calendarPhases.json` | array | liste | entité | 7 | `icon`:string(7) `id`:string(7) `label`:string(7) `start`:number(7) `type`:string(7) |
| `src/data/calendarWeekdays.json` | array | liste | entité | 8 | `id`:string(8) `label`:string(8) `source`:object(8) `type`:string(8) |
| `src/data/careerLevels.json` | array | liste | entité | 432 | `career`:string(432) `characteristics`:array(432) `id`:string(432) `label`:string(432) `labelF`:string(297) `level`:number(432) `skills`:array(432) `source`:object(432) `status`:string(432) `talents`:array(432) `trappings`:array(432) `type`:string(432) |
| `src/data/careers.json` | array | liste | entité | 108 | `class`:string(108) `desc`:string(108) `grantGroups`:array(6) `id`:string(108) `label`:string(108) `labelF`:string(79) `rand`:object(108) `source`:object(108) `tenue`:string(15) `type`:string(108) |
| `src/data/characteristics.json` | array | liste | entité | 19 | `abr`:string(19) `desc`:string(19) `id`:string(19) `label`:string(19) `nature`:string(19) `options`:array(1) `source`:object(19) `type`:string(19) |
| `src/data/classes.json` | array | liste | entité | 9 | `desc`:string(9) `grantGroups`:array(1) `id`:string(9) `label`:string(9) `source`:object(9) `trappings`:array(9) `type`:string(9) |
| `src/data/combat-stakes.json` | array | liste | entité | 37 | `entryCategory`:string(11) `entryFromSource`:boolean(1) `form`:string(32) `id`:string(37) `kind`:string(37) `label`:string(37) `rule`:string(25) `ruleCategory`:string(25) `source`:object(37) `template`:string(32) `type`:string(37) |
| `src/data/creatures.json` | array | liste | entité | 493 | `alsoIn`:array(5) `appearance`:object(485) `char`:object(493) `desc`:string(196) `folder`:string(493) `followsCharacterRules`:boolean(163) `grantGroups`:array(90) `harvest`:object(54) `id`:string(493) `label`:string(493) `maison`:string(1) `named`:boolean(66) `optionals`:array(493) `purchase`:object(14) `skills`:array(493) `source`:object(493) `spells`:array(493) `talents`:array(493) `title`:null/string(493) `traits`:array(493) `trappings`:array(493) `type`:string(493) |
| `src/data/crew-morale.json` | object | pipe à la racine | config | 1 | `bands`:array(1) `base`:number(1) `factors`:array(1) `id`:string(1) `label`:string(1) `source`:object(1) `type`:string(1) |
| `src/data/crew-roles.json` | array | liste | entité | 9 | `desc`:string(9) `id`:string(9) `label`:string(9) `maison`:string(7) `skills`:array(9) `source`:object(2) `type`:string(9) `wage`:object(9) |
| `src/data/crew-test-types.json` | object | pipe à la racine | config | 1 | `id`:string(1) `label`:string(1) `type`:string(1) `types`:array(1) |
| `src/data/criticals.json` | array | liste | entité | 8 | `entries`:array(8) `id`:string(8) `jeu`:string(8) `label`:string(8) `localisation`:string(8) `source`:object(8) `type`:string(8) |
| `src/data/damage-types.json` | array | liste | entité | 4 | `id`:string(4) `label`:string(4) `type`:string(4) |
| `src/data/decorPalette.json` | object | record | record | 0 | — |
| `src/data/defauts-de-compilation.json` | object | pipe à la racine | config | 1 | `cheminDeRonde`:string(1) `id`:string(1) `label`:string(1) `maison`:string(1) `masse`:string(1) `pont`:string(1) `type`:string(1) |
| `src/data/details.json` | object | pipe à la racine | config | 1 | `ageBase`:object(1) `ageRoll`:object(1) `heightBase`:object(1) `heightRoll`:object(1) `id`:string(1) `label`:string(1) `texts`:object(1) `type`:string(1) |
| `src/data/disponibilite.json` | object | pipe à la racine | config | 1 | `barterRatios`:array(1) `dispoPct`:array(1) `id`:string(1) `label`:string(1) `type`:string(1) |
| `src/data/domains.json` | array | liste | entité | 20 | `alsoIn`:array(6) `arcane`:boolean(18) `breathType`:string(4) `castBonus`:object(1) `casterOps`:array(1) `castingChar`:string(1) `dark`:boolean(2) `desc`:string(14) `effects`:array(5) `environmentBonus`:object(1) `id`:string(20) `label`:string(20) `missile`:object(3) `seaModifier`:object(4) `sorcery`:boolean(1) `source`:object(20) `tables`:object(8) `type`:string(20) `wind`:string(9) `windModifiers`:array(8) |
| `src/data/donnees.manifest.json` | object | pipe à la racine | config | 1 | `homonymes`:object(1) `id`:string(1) `label`:string(1) `reglesOr`:string(1) `rubriques`:array(1) `type`:string(1) |
| `src/data/driving-mishap.json` | object | pipe à la racine | config | 1 | `entries`:array(1) `id`:string(1) `label`:string(1) `source`:object(1) `type`:string(1) |
| `src/data/drunkenness.json` | object | pipe à la racine | config | 1 | `entries`:array(1) `id`:string(1) `label`:string(1) `source`:object(1) `type`:string(1) |
| `src/data/encumbranceTiers.json` | array | liste | entité | 4 | `agilityPenalty`:number(4) `id`:string(4) `immobile`:boolean(4) `label`:string(4) `moveFloor`:number(4) `movePenalty`:null/number(4) `source`:object(4) `tier`:number(4) `travelFatigue`:number(4) `type`:string(4) |
| `src/data/etats.json` | array | liste | entité | 21 | `aiThreat`:number(10) `desc`:string(21) `effects`:array(11) `gating`:object(5) `icon`:string(12) `id`:string(21) `label`:string(21) `lockedReason`:string(1) `lockedUntil`:object(1) `maison`:string(1) `nonCumulable`:boolean(3) `passive`:array(9) `perStack`:boolean(7) `persistsAfterCombat`:boolean(7) `recover`:object(2) `resolveHeals`:number(1) `restrictsAction`:boolean(1) `severity`:number(12) `source`:object(21) `stacksReducedBy`:string(1) `type`:string(21) |
| `src/data/eyes.json` | array | liste | entité | 10 | `color`:object(10) `id`:string(10) `label`:string(10) `rand`:number(10) `source`:object(10) `type`:string(10) |
| `src/data/flow-stakes.json` | array | liste | entité | 34 | `entryCategory`:string(2) `flow`:string(34) `form`:string(34) `id`:string(34) `label`:string(34) `phase`:string(34) `rule`:string(33) `ruleCategory`:string(33) `source`:object(34) `template`:string(34) `type`:string(34) |
| `src/data/gods.json` | array | liste | entité | 41 | `blessings`:array(41) `chaosSpells`:array(3) `desc`:string(40) `grantGroups`:array(2) `id`:string(41) `label`:string(41) `miracles`:array(41) `sinLocks`:object(1) `source`:object(41) `title`:string(40) `type`:string(41) |
| `src/data/grapple.json` | object | pipe à la racine | config | 1 | `id`:string(1) `init`:array(1) `label`:string(1) `source`:object(1) `type`:string(1) `win`:object(1) |
| `src/data/groups.json` | array | liste | entité | 38 | `exceptGroups`:array(1) `id`:string(38) `label`:string(38) `matchesAll`:boolean(2) `type`:string(38) |
| `src/data/hairs.json` | array | liste | entité | 10 | `color`:object(10) `id`:string(10) `label`:string(10) `rand`:number(10) `randByRace`:object(2) `source`:object(10) `type`:string(10) |
| `src/data/incidents-monture.json` | object | pipe à la racine | config | 1 | `die`:string(1) `entries`:array(1) `id`:string(1) `label`:string(1) `source`:object(1) `type`:string(1) |
| `src/data/interludeEvents.json` | array | liste | table | 31 | `atelierNote`:string(10) `desc`:string(31) `fx`:object(15) `id`:string(31) `label`:string(31) `max`:number(31) `min`:number(31) `source`:object(31) `type`:string(31) |
| `src/data/land-cargo.json` | object | pipe à la racine | config | 1 | `buy`:object(1) `cargoes`:array(1) `gossip`:object(1) `id`:string(1) `label`:string(1) `rumours`:array(1) `sell`:object(1) `type`:string(1) `wineQuality`:array(1) |
| `src/data/lieux-services.json` | array | liste | entité | 7 | `backdrop`:string(4) `desc`:string(2) `editorNote`:string(1) `enterLabel`:string(1) `hostLine`:string(3) `icon`:string(7) `id`:string(7) `label`:string(7) `merchantArchetype`:string(1) `opensScreen`:string(1) `type`:string(7) |
| `src/data/lightLevels.json` | array | liste | entité | 5 | `baseSightTiles`:number(5) `id`:string(5) `label`:string(5) `scalar`:number(5) `type`:string(5) |
| `src/data/lightTones.json` | array | liste | entité | 4 | `color`:string(4) `flicker`:object(2) `id`:string(4) `intensity`:number(4) `label`:string(4) `type`:string(4) |
| `src/data/localisation.json` | object | pipe à la racine | config | 1 | `id`:string(1) `label`:string(1) `navire`:object(1) `navire-fluvial`:object(1) `personnage`:object(1) `type`:string(1) |
| `src/data/locations.json` | array | liste | entité | 55 | `desc`:string(55) `id`:string(55) `label`:string(55) `parent`:null/string(55) `prefix`:null(55) `source`:object(55) `suffix`:null/string(55) `type`:string(55) |
| `src/data/maladies.json` | array | liste | entité | 18 | `contaminatesWaterBarrel`:boolean(4) `contractDifficulty`:string(18) `dailyTest`:object(1) `desc`:string(18) `duration`:object(18) `id`:string(18) `immuneAfterCure`:boolean(2) `incubation`:object(18) `infectionPassive`:array(1) `label`:string(18) `mutation`:object(1) `reExposition`:object(1) `source`:object(18) `symptoms`:array(18) `type`:string(18) |
| `src/data/maneuvers.json` | array | liste | entité | 20 | `activation`:string(20) `advantageCost`:number(20) `advantageMode`:string(2) `blast`:object(7) `defense`:string(18) `effects`:array(20) `id`:string(20) `kind`:string(20) `label`:string(20) `magic`:boolean(8) `range`:object(8) `source`:object(20) `stake`:string(20) `stakeForm`:string(20) `stat`:string(16) `targeting`:string(20) `type`:string(20) |
| `src/data/mass-battle.json` | object | pipe à la racine | config | 1 | `hazards`:array(1) `id`:string(1) `label`:string(1) `mightModifiers`:array(1) `powerEstimate`:array(1) `structures`:array(1) `type`:string(1) `warMachines`:array(1) |
| `src/data/materials.json` | array | liste | entité | 16 | `E`:string(3) `N`:string(3) `O`:string(3) `S`:string(3) `built`:boolean(2) `color`:string(9) `couverture`:boolean(3) `detail`:object(5) `domain`:string(16) `eaveOverhangM`:number(3) `face`:string(3) `fascia`:string(2) `fasciaDropM`:number(2) `foot`:string(2) `id`:string(16) `label`:string(16) `line`:string(3) `metalness`:number(9) `planBody`:string(1) `planEdge`:string(1) `planInner`:string(1) `planText`:string(1) `ridgeCap`:string(2) `roughness`:number(9) `shadeDark`:number(2) `slopeTop`:string(2) `soffite`:string(3) `type`:string(16) `vueDeDessus`:boolean(1) |
| `src/data/merchantFamilies.json` | array | liste | entité | 7 | `columns`:array(7) `id`:string(7) `label`:string(7) `match`:object(7) `type`:string(7) |
| `src/data/merchants.json` | array | liste | entité | 6 | `bargainSkill`:number(6) `boniment`:string(6) `category`:object(6) `curated`:array(3) `id`:string(6) `label`:string(6) `resaleRate`:number(6) `settlement`:string(6) `type`:string(6) `unitKinds`:array(1) |
| `src/data/miscast.json` | array | liste | entité | 5 | `codexCategory`:string(3) `entries`:array(5) `id`:string(5) `label`:string(5) `source`:object(5) `type`:string(5) |
| `src/data/montures.json` | object | pipe à la racine | config | 1 | `entries`:array(1) `id`:string(1) `label`:string(1) `source`:object(1) `type`:string(1) |
| `src/data/mutationTables.json` | array | liste | entité | 17 | `id`:string(17) `label`:string(17) `ranges`:array(17) `source`:object(17) `type`:string(17) |
| `src/data/mutations.json` | array | liste | entité | 116 | `appearance`:object(73) `desc`:string(116) `effects`:array(1) `id`:string(116) `kind`:string(116) `label`:string(116) `nonVisual`:boolean(5) `note`:string(57) `passive`:array(84) `source`:object(116) `subTable`:string(1) `type`:string(116) |
| `src/data/names.json` | array | liste | entité | 7 | `femaleFirstNames`:array(7) `id`:string(7) `label`:string(7) `lastNameSuffixes`:object(1) `lastNames`:array(7) `maleFirstNames`:array(7) `type`:string(7) |
| `src/data/naval-ports.json` | array | liste | entité | 39 | `cosmopolite`:boolean(2) `demande`:object(32) `desc`:string(29) `dirigeant`:string(39) `id`:string(39) `label`:string(39) `production`:array(38) `region`:string(39) `richesse`:number(39) `source`:object(39) `surplus`:object(20) `taille`:number(39) `type`:string(39) |
| `src/data/naval-progression.json` | object | pipe à la racine | config | 1 | `entries`:array(1) `id`:string(1) `label`:string(1) `type`:string(1) |
| `src/data/naval-traits.json` | array | liste | entité | 27 | `alsoIn`:array(1) `deckCover`:string(3) `desc`:string(27) `id`:string(27) `install`:object(21) `kind`:string(27) `label`:string(27) `maison`:string(3) `navTestMod`:number(2) `passive`:array(9) `ram`:object(1) `ranked`:boolean(4) `source`:object(26) `type`:string(27) |
| `src/data/night-stakes.json` | array | liste | entité | 15 | `form`:string(2) `id`:string(15) `kind`:string(15) `label`:string(15) `rule`:string(15) `ruleCategory`:string(2) `source`:object(15) `stake`:string(15) `type`:string(15) |
| `src/data/obsessions.json` | object | pipe à la racine | config | 1 | `entries`:array(1) `id`:string(1) `label`:string(1) `source`:object(1) `type`:string(1) |
| `src/data/oups.json` | array | liste | table | 8 | `id`:string(8) `kind`:string(8) `label`:string(8) `max`:number(7) `min`:number(7) `source`:object(8) `type`:string(8) |
| `src/data/peripeties.json` | array | liste | entité | 10 | `desc`:string(10) `id`:string(10) `kind`:string(10) `label`:string(10) `roll`:number(10) `source`:object(10) `type`:string(10) |
| `src/data/pregens.json` | array | liste | entité | 8 | `ambitionLong`:string(8) `ambitionShort`:string(8) `build`:number(2) `career`:string(8) `careerTalent`:string(2) `id`:string(8) `label`:string(8) `motivation`:string(8) `pettySpells`:array(1) `seed`:number(8) `sex`:string(2) `species`:string(8) `type`:string(8) |
| `src/data/primitives.manifest.json` | array | liste | entité | 101 | `concept`:string(101) `css`:string(50) `fichier`:string(101) `id`:string(101) `label`:string(101) `nature`:string(8) `perimetre`:string(101) `poseurs`:array(12) `type`:string(101) `verrou`:string(101) |
| `src/data/problemes-vehicule.json` | object | pipe à la racine | config | 1 | `die`:string(1) `entries`:array(1) `id`:string(1) `label`:string(1) `source`:object(1) `type`:string(1) |
| `src/data/progression-schemas.derived.json` | object | pipe à la racine | config | 1 | `id`:string(1) `label`:string(1) `livres`:array(1) `schemas`:array(1) `type`:string(1) |
| `src/data/props.json` | array | liste | entité | 124 | `cover`:string(32) `foot`:object(20) `id`:string(124) `label`:string(124) `light`:object(10) `maison`:string(41) `opaque`:boolean(5) `seatSlots`:array(2) `solid`:boolean(92) `type`:string(124) `volume`:object(46) |
| `src/data/psychology.json` | array | liste | entité | 9 | `attackDR`:object(5) `becomes`:string(1) `containedSocialMod`:number(2) `descRef`:object(9) `effects`:array(1) `endedByOtherPsych`:boolean(2) `failAmount`:object(1) `failCondition`:string(1) `icon`:string(9) `id`:string(9) `immuneToFromTarget`:array(1) `immuneWhileActive`:array(1) `label`:string(9) `passive`:array(1) `psychImmune`:boolean(1) `resolution`:string(7) `source`:object(9) `stake`:string(7) `stakeForm`:string(7) `targetCauses`:object(1) `targeted`:boolean(6) `test`:object(7) `triggerOn`:string(2) `type`:string(9) |
| `src/data/qualities.json` | array | liste | entité | 59 | `alsoIn`:array(2) `capabilities`:object(31) `desc`:string(59) `effects`:array(10) `id`:string(59) `indice`:object(2) `label`:string(59) `passive`:array(17) `polarite`:string(59) `source`:object(59) `subType`:string(59) `type`:string(59) |
| `src/data/qualitySubtypes.json` | array | liste | entité | 3 | `id`:string(3) `label`:string(3) `type`:string(3) |
| `src/data/qualityTypes.json` | array | liste | entité | 2 | `id`:string(2) `label`:string(2) `type`:string(2) |
| `src/data/raceAppearance.json` | array | liste | entité | 21 | `colors`:object(4) `dropHeadgear`:boolean(1) `extremites`:string(3) `eyes`:object(1) `featureKeys`:array(13) `gabarit`:string(21) `gabaritOverride`:object(6) `head`:string(13) `id`:string(21) `label`:string(21) `legs`:string(3) `palette`:object(20) `paletteF`:object(5) `parts`:object(1) `pose`:object(9) `sex`:string(1) `tenue`:string(21) `tirageIndividuel`:object(1) `type`:string(21) |
| `src/data/raw.manifest.json` | array | liste | entité | 12 | `bloque`:string(4) `id`:string(12) `label`:string(12) `ticket`:string(10) `type`:string(12) |
| `src/data/regles.json` | array | liste | entité | 86 | `desc`:string(85) `descRef`:object(1) `id`:string(86) `label`:string(86) `source`:object(86) `type`:string(86) |
| `src/data/reglesOptionnelles.json` | array | liste | entité | 87 | `action`:object(1) `default`:boolean/number/string(87) `group`:string(87) `hint`:string(87) `id`:string(87) `kind`:string(87) `label`:string(87) `maison`:string(33) `max`:number(29) `min`:number(29) `options`:array(12) `ref`:string(87) `source`:object(54) `step`:number(19) `type`:string(87) |
| `src/data/rencontres-edoc.json` | object | pipe à la racine | config | 1 | `die`:string(1) `id`:string(1) `label`:string(1) `source`:object(1) `tables`:object(1) `type`:string(1) |
| `src/data/renduMonte.json` | object | pipe à la racine | config | 1 | `harnaisParDefaut`:string(1) `id`:string(1) `label`:string(1) `type`:string(1) |
| `src/data/reseau-routier.json` | array | liste | entité | 15 | `desc`:string(9) `effectifMax`:number(1) `effectifMin`:number(1) `effectifRouteReculeeMax`:number(1) `effectifRouteReculeeMin`:number(1) `espacementKm`:number(1) `espacementKmMax`:number(1) `espacementKmMin`:number(1) `etapeChevalJours`:number(1) `etapeDiligenceJours`:number(1) `etapePiedJours`:number(1) `facteurGrandsTroublesMax`:number(1) `facteurGrandsTroublesMin`:number(1) `facteurZoneDangereuse`:number(1) `id`:string(15) `kind`:string(15) `label`:string(15) `largeurMaxM`:number(2) `largeurMinM`:number(2) `prixSurcotePct`:number(1) `source`:object(15) `tarifBrassMax`:number(1) `tarifBrassMin`:number(1) `type`:string(15) |
| `src/data/river-criticals.json` | object | pipe à la racine | config | 1 | `id`:string(1) `label`:string(1) `replisSansExpose`:object(1) `source`:object(1) `tables`:object(1) `type`:string(1) |
| `src/data/river-navigation.json` | object | pipe à la racine | config | 1 | `capsize`:object(1) `driftNavPenalty`:number(1) `driftPctOfSpeed`:number(1) `echouage`:object(1) `id`:string(1) `label`:string(1) `navBaseDifficulty`:string(1) `outOfControl`:object(1) `rowingAgility`:object(1) `savoirVoiesFluvialesDR`:number(1) `source`:object(1) `tackDifficulty`:string(1) `temporaryRepair`:object(1) `type`:string(1) `windDirections`:array(1) `windEffect`:object(1) `windForces`:array(1) `windTickThreshold`:number(1) `windTicksPerDay`:number(1) |
| `src/data/river-perils.json` | object | pipe à la racine | config | 1 | `id`:string(1) `label`:string(1) `perils`:array(1) `type`:string(1) |
| `src/data/sea-cargo.json` | object | pipe à la racine | config | 1 | `buy`:object(1) `cargoes`:array(1) `id`:string(1) `label`:string(1) `opportunite`:object(1) `overload`:object(1) `sell`:object(1) `type`:string(1) |
| `src/data/sea-events.json` | object | pipe à la racine | config | 1 | `boardEvents`:array(1) `fastVoyage`:object(1) `id`:string(1) `label`:string(1) `manann`:object(1) `portEvents`:array(1) `type`:string(1) |
| `src/data/sea-navigation.json` | object | pipe à la racine | config | 1 | `epuisement`:object(1) `forcerLeRythme`:array(1) `id`:string(1) `label`:string(1) `longsVoyages`:object(1) `orientation`:object(1) `phares`:object(1) `poursuite`:object(1) `reparation`:object(1) `salissures`:object(1) `type`:string(1) `vitesseMax`:object(1) `workPeriodHours`:object(1) |
| `src/data/sea-perils.json` | object | pipe à la racine | config | 1 | `detroits`:array(1) `echouer`:object(1) `gestionDesPerils`:array(1) `hazards`:array(1) `hazardsWeightNote`:string(1) `id`:string(1) `label`:string(1) `tourbillonSwim`:object(1) `tourbillons`:array(1) `type`:string(1) |
| `src/data/sea-shanties.json` | array | liste | entité | 7 | `captainOps`:array(1) `crewOps`:array(6) `desc`:string(7) `id`:string(7) `label`:string(7) `note`:string(4) `source`:object(7) `type`:string(7) |
| `src/data/sea-weather.json` | object | pipe à la racine | config | 1 | `affaler`:object(1) `effetDuVent`:object(1) `effetDuVentClinfoc`:object(1) `effetDuVentGreementDelta`:object(1) `encalmine`:object(1) `id`:string(1) `label`:string(1) `precipitations`:array(1) `roseDesVents`:array(1) `seasonMod`:object(1) `table`:array(1) `temperatures`:array(1) `type`:string(1) `vents`:array(1) `visibilites`:array(1) `warmSeaMod`:number(1) |
| `src/data/semences-de-scene.json` | object | pipe à la racine | config | 1 | `ambiance`:string(1) `id`:string(1) `label`:string(1) `maison`:string(1) `metresPerTile`:number(1) `reliefDefaults`:object(1) `roofDefaults`:object(1) `terrain`:string(1) `type`:string(1) |
| `src/data/ship-construction.json` | object | pipe à la racine | config | 1 | `constructionTraits`:array(1) `id`:string(1) `label`:string(1) `manoeuvrability`:array(1) `propulsion`:object(1) `speedTraits`:array(1) `standard`:array(1) `type`:string(1) |
| `src/data/ship-criticals.json` | object | pipe à la racine | config | 1 | `die`:string(1) `id`:string(1) `label`:string(1) `replisSansExpose`:object(1) `shrapnelHit`:array(1) `source`:object(1) `tables`:object(1) `tablesDeChute`:array(1) `type`:string(1) |
| `src/data/ship-stations.json` | array | liste | entité | 5 | `desc`:string(5) `id`:string(5) `label`:string(5) `requiresTrait`:object(2) `source`:object(5) `type`:string(5) |
| `src/data/sizes.json` | object | pipe à la racine | config | 1 | `footprintSide`:object(1) `id`:string(1) `label`:string(1) `rangedMod`:object(1) `shipboardEnc`:object(1) `type`:string(1) |
| `src/data/skills.json` | array | liste | entité | 48 | `acces`:string(48) `altChar`:object(2) `characteristic`:string(48) `combatAdvantage`:object(4) `combatSubstitute`:object(2) `desc`:string(48) `hearing`:boolean(1) `id`:string(48) `label`:string(48) `movement`:boolean(5) `source`:object(48) `specs`:array(43) `specsOpen`:boolean(6) `specsSource`:string(3) `tool`:object(1) `type`:string(48) |
| `src/data/species.json` | array | liste | entité | 27 | `alsoIn`:array(1) `arcaneDomainsBonusOf`:string(2) `baseChar`:object(27) `desc`:string(26) `family`:string(27) `fate`:object(27) `gatedByRule`:string(1) `grantGroups`:array(27) `id`:string(27) `label`:string(27) `movement`:number(27) `mutationBodyMax`:number(18) `previewCareer`:object(27) `profilStandard`:object(26) `rand`:number(27) `refCareer`:string(27) `refChar`:string(27) `skills`:array(27) `source`:object(27) `talents`:array(27) `traits`:array(1) `type`:string(27) `variant`:string(21) |
| `src/data/speciesRace.json` | object | pipe à la racine | config | 1 | `default`:string(1) `id`:string(1) `label`:string(1) `rules`:array(1) `type`:string(1) |
| `src/data/spells.json` | array | liste | entité | 576 | `alsoIn`:array(46) `breathAttack`:boolean(2) `cn`:null/number(576) `curated`:boolean(438) `damage`:number(22) `desc`:string(576) `domainId`:string(256) `duration`:null/object(576) `ecole`:string(576) `effects`:object(576) `family`:string(576) `id`:string(576) `ignoreBE`:boolean(2) `ignorePA`:boolean(6) `isRitual`:boolean(17) `label`:string(576) `missile`:boolean(40) `opposed`:object(4) `range`:null/object(576) `ritual`:object(17) `source`:object(576) `subType`:null/string(576) `target`:null/object(576) `type`:string(576) `variants`:array(18) |
| `src/data/stars.json` | array | liste | entité | 23 | `apparence`:string(23) `ascendant`:string(23) `classique`:string(23) `dates`:string(23) `desc`:string(23) `dieux`:string(23) `id`:string(23) `label`:string(23) `ops`:array(23) `rand`:number(23) `signe`:string(23) `source`:object(23) `sub`:object(4) `type`:string(23) |
| `src/data/steam-breakdown.json` | array | liste | table | 6 | `compartmentDamage`:number(1) `coolMinutes`:string(1) `desc`:string(6) `durationRounds`:string(1) `engineDestroyed`:boolean(1) `failDamage`:string(1) `hullCritical`:boolean(1) `id`:string(6) `label`:string(6) `mMod`:number(2) `mSet`:number(2) `max`:number(6) `min`:number(6) `restart`:array(3) `source`:object(6) `type`:string(6) |
| `src/data/structure-criticals.json` | object | pipe à la racine | config | 1 | `die`:string(1) `entries`:array(1) `id`:string(1) `label`:string(1) `source`:object(1) `type`:string(1) |
| `src/data/structureAppearance.json` | array | liste | entité | 18 | `band`:string(5) `cap`:string(5) `detail`:object(17) `door`:object(5) `face`:string(18) `id`:string(18) `label`:string(18) `parapet`:object(4) `post`:string(18) `recess`:string(1) `rubble`:string(7) `rubbleHi`:string(7) `type`:string(18) `wallHeightM`:number(2) `window`:object(5) `wood`:object(10) |
| `src/data/structures.json` | array | liste | entité | 24 | `char`:object(24) `couvertPenalty`:string(17) `desc`:string(19) `edgeKind`:string(1) `enc`:number(10) `encLimit`:number(15) `fortified`:boolean(2) `id`:string(24) `kind`:string(24) `label`:string(24) `maison`:string(24) `occulte`:boolean(2) `source`:object(24) `taille`:string(24) `traits`:array(24) `type`:string(24) `vehicle`:boolean(8) |
| `src/data/surincantation.json` | object | pipe à la racine | config | 1 | `entries`:array(1) `id`:string(1) `label`:string(1) `source`:object(1) `type`:string(1) |
| `src/data/symptoms.json` | array | liste | entité | 18 | `capabilities`:object(6) `desc`:string(18) `effects`:array(1) `id`:string(18) `label`:string(18) `maison`:string(1) `onTick`:object(4) `passive`:array(10) `passiveBySeverity`:object(2) `source`:object(18) `type`:string(18) `visibleLocations`:array(1) `visiblePassive`:array(1) |
| `src/data/systemes.manifest.json` | array | liste | entité | 16 | `etat`:string(16) `id`:string(16) `label`:string(16) `modules`:array(16) `notes`:string(16) `ticket`:null/string(16) `type`:string(16) |
| `src/data/tables.json` | array | liste | entité | 21 | `die`:string(21) `id`:string(21) `label`:string(21) `maison`:string(1) `rows`:array(21) `source`:object(21) `type`:string(21) |
| `src/data/talents.json` | array | liste | entité | 187 | `alsoIn`:array(1) `codexOnly`:boolean(6) `combat`:object(54) `desc`:string(186) `effects`:array(4) `grantSpecGroups`:boolean(1) `grantsArcaneDomain`:boolean(1) `id`:string(187) `label`:string(187) `maison`:string(9) `max`:null/number/object(187) `passive`:array(21) `rand`:null/number(187) `size`:string(2) `source`:object(187) `specs`:array(182) `specsOpen`:boolean(8) `specsSource`:string(5) `test`:null/object(187) `type`:string(187) `variants`:array(12) |
| `src/data/tavernGames.json` | array | liste | entité | 13 | `campScore`:string(3) `characteristic`:string(6) `combined`:object(1) `dancers`:number(1) `desc`:string(13) `drBonus`:string(4) `drCap`:number(1) `id`:string(13) `label`:string(13) `mode`:string(12) `options`:array(5) `phases`:object(2) `pot`:object(1) `roundOps`:object(2) `roundShape`:string(7) `scoreThreshold`:number(1) `scoreUnit`:string(5) `sides`:array(1) `skill`:object(9) `source`:object(13) `table`:array(1) `target`:number(3) `team`:object(2) `throwerPenalty`:object(1) `tieBreak`:string(2) `type`:string(13) `volley`:object(4) |
| `src/data/teintesJeu.json` | object | record | record | 0 | — |
| `src/data/terrains.json` | array | liste | entité | 25 | `absence`:boolean(1) `ascii`:string(5) `bordDuMonde`:boolean(1) `built`:boolean(8) `detail`:object(21) `id`:string(25) `label`:string(25) `maison`:string(25) `matiere`:string(1) `opaque`:boolean(2) `overlayProp`:string(1) `priority`:number(25) `solidHeightM`:number(1) `stops`:object(25) `swatch`:string(25) `type`:string(25) `walkable`:boolean(25) |
| `src/data/traits.json` | array | liste | entité | 132 | `alsoIn`:array(4) `aura`:object(3) `capabilities`:object(51) `desc`:string(132) `effects`:array(25) `grantsManeuvers`:array(14) `id`:string(132) `indice`:object(22) `label`:string(132) `maison`:string(3) `nonTransferable`:boolean(1) `passive`:array(26) `range`:boolean(2) `source`:object(132) `specsMulti`:boolean(9) `specsOpen`:boolean(7) `specsSource`:string(18) `standard`:boolean(15) `suppressesCapabilities`:array(1) `type`:string(132) |
| `src/data/trappings.json` | array | liste | entité | 441 | `alsoIn`:array(8) `ammoRangeMod`:object(13) `availability`:null/string(441) `bladed`:boolean(26) `capabilities`:object(20) `categorie`:string(441) `consumable`:object(40) `consumableDuration`:object(19) `container`:object(10) `damage`:null/object(381) `defaultAmmo`:string(9) `derivedWeapon`:object(1) `desc`:string(279) `enc`:null/number/string(424) `formChoices`:array(1) `hands`:number(44) `id`:string(441) `improvised`:boolean(1) `indirect`:boolean(8) `label`:string(441) `loc`:null/string(381) `maison`:string(2) `minRangeBand`:string(9) `niConsumedPerDR`:number(2) `niPerGram`:number(2) `onHitEffects`:array(6) `organicProjectile`:boolean(14) `pa`:null/number(381) `packSize`:number(15) `passive`:array(15) `price`:null/object/string(441) `prosthesisTraining`:array(2) `qualities`:array(441) `range`:null/number/object(68) `reach`:null/string(381) `service`:boolean(3) `shape`:string(109) `siegeFootprint`:number(1) `siegeRig`:string(22) `sizeFor`:string(9) `soloSimple`:boolean(1) `source`:object(441) `subType`:string(441) `type`:string(441) `unarmed`:boolean(1) `weaponGroup`:string(22) |
| `src/data/traumas.json` | array | liste | entité | 29 | `amputation`:boolean(12) `cosmetic`:boolean(2) `cumul`:object(5) `desc`:string(29) `id`:string(29) `kind`:string(12) `label`:string(29) `maison`:string(2) `needsSurgery`:boolean(2) `ops`:array(17) `passiveKind`:string(2) `prosthesis`:array(7) `rig`:object(3) `severity`:string(12) `source`:object(29) `type`:string(29) |
| `src/data/vehicles.json` | array | liste | entité | 31 | `chargement`:number(11) `deck`:object(1) `desc`:string(12) `enc`:null/number(12) `hull`:object(29) `icon`:string(31) `id`:string(31) `label`:string(31) `purchase`:object(31) `ship`:object(20) `source`:object(31) `travel`:object(3) `type`:string(31) |
| `src/data/vents-tourbillonnants.json` | object | pipe à la racine | config | 1 | `entries`:array(1) `id`:string(1) `label`:string(1) `source`:object(1) `type`:string(1) |
| `src/data/voyage-stakes.json` | array | liste | entité | 42 | `id`:string(42) `kind`:string(42) `label`:string(42) `rule`:string(32) `ruleCategory`:string(7) `source`:object(42) `template`:string(42) `type`:string(42) |
| `src/data/water-exposure.json` | object | pipe à la racine | config | 1 | `desc`:string(1) `diseases`:array(1) `id`:string(1) `label`:string(1) `modifiers`:array(1) `rollModPerNegativeSL`:number(1) `source`:object(1) `test`:object(1) `type`:string(1) |
| `src/data/weaponGroups.json` | array | liste | entité | 38 | `combat`:string(18) `id`:string(38) `kind`:string(38) `label`:string(38) `material`:string(5) `qualities`:array(3) `source`:object(38) `type`:string(38) |
| `src/data/weather.json` | object | pipe à la racine | config | 1 | `conditions`:array(1) `id`:string(1) `label`:string(1) `physicalTestChars`:array(1) `physicalTestCharsSource`:object(1) `seasons`:array(1) `type`:string(1) |
| `src/scenes/arene/arene-projet.json` | object | pipe à la racine | config | 1 | `icon`:string(1) `id`:string(1) `label`:string(1) `maison`:string(1) `narratif`:object(1) `scenes`:array(1) `schema`:number(1) `type`:string(1) `versionContenu`:number(1) `worldMap`:object(1) |
| `src/scenes/barge-du-sel/barge-du-sel-projet.json` | object | pipe à la racine | config | 1 | `icon`:string(1) `id`:string(1) `label`:string(1) `maison`:string(1) `narratif`:object(1) `scenes`:array(1) `schema`:number(1) `type`:string(1) `versionContenu`:number(1) `worldMap`:object(1) |
| `src/scenes/diligence/diligence-projet.json` | object | pipe à la racine | config | 1 | `desc`:string(1) `icon`:string(1) `id`:string(1) `label`:string(1) `narratif`:object(1) `scenes`:array(1) `schema`:number(1) `source`:object(1) `type`:string(1) `versionContenu`:number(1) `worldMap`:object(1) |
| `src/scenes/loup-et-saumure/loup-et-saumure-projet.json` | object | pipe à la racine | config | 1 | `icon`:string(1) `id`:string(1) `label`:string(1) `maison`:string(1) `narratif`:object(1) `scenes`:array(1) `schema`:number(1) `type`:string(1) `versionContenu`:number(1) `worldMap`:object(1) |

### 2.2 Fréquence globale des signatures d’entrée

Signatures distinctes d’entrée de document : **636**. Les 40 plus fréquentes :

| Signature d’entrée | Entrées |
|---|---|
| `career,characteristics,id,label,labelF,level,skills,source,status,talents,trappings,type` | 297 |
| `cn,curated,desc,duration,ecole,effects,family,id,label,range,source,subType,target,type` | 176 |
| `cn,curated,desc,domainId,duration,ecole,effects,family,id,label,range,source,subType,target,type` | 157 |
| `appearance,char,folder,id,label,optionals,skills,source,spells,talents,title,traits,trappings,type` | 136 |
| `career,characteristics,id,label,level,skills,source,status,talents,trappings,type` | 135 |
| `appearance,char,folder,followsCharacterRules,id,label,optionals,skills,source,spells,talents,title,traits,trappings,type` | 123 |
| `cn,desc,duration,ecole,effects,family,id,label,range,source,subType,target,type` | 113 |
| `desc,id,label,source,type` | 112 |
| `availability,categorie,damage,enc,id,label,loc,pa,price,qualities,reach,source,subType,type` | 95 |
| `desc,id,label,max,rand,source,specs,test,type` | 83 |
| `class,desc,id,label,labelF,rand,source,type` | 72 |
| `availability,categorie,damage,desc,enc,id,label,loc,pa,price,qualities,reach,source,subType,type` | 66 |
| `id,label,type` | 60 |
| `desc,id,label,parent,prefix,source,suffix,type` | 55 |
| `concept,fichier,id,label,perimetre,type,verrou` | 51 |
| `appearance,char,desc,folder,grantGroups,id,label,optionals,skills,source,spells,talents,title,traits,trappings,type` | 44 |
| `appearance,char,desc,folder,harvest,id,label,optionals,skills,source,spells,talents,title,traits,trappings,type` | 42 |
| `default,group,hint,id,kind,label,ref,source,type` | 39 |
| `combat,desc,id,label,max,rand,source,specs,test,type` | 39 |
| `appearance,desc,id,kind,label,passive,source,type` | 38 |
| `alsoIn,cn,curated,desc,domainId,duration,ecole,effects,family,id,label,range,source,subType,target,type` | 38 |
| `blessings,desc,id,label,miracles,source,title,type` | 34 |
| `appearance,char,desc,folder,followsCharacterRules,id,label,named,optionals,skills,source,spells,talents,title,traits,trappings,type` | 33 |
| `concept,css,fichier,id,label,perimetre,type,verrou` | 33 |
| `availability,categorie,desc,enc,id,label,price,qualities,source,subType,type` | 33 |
| `flow,form,id,label,phase,rule,ruleCategory,source,template,type` | 32 |
| `id,label,solid,type,volume` | 28 |
| `appearance,char,desc,folder,id,label,optionals,skills,source,spells,talents,title,traits,trappings,type` | 27 |
| `capabilities,desc,id,label,source,type` | 27 |
| `acces,characteristic,desc,id,label,source,specs,type` | 26 |
| `id,kind,label,rule,source,template,type` | 25 |
| `appearance,char,folder,grantGroups,id,label,optionals,skills,source,spells,talents,title,traits,trappings,type` | 24 |
| `id,label,solid,type` | 24 |
| `capabilities,desc,id,label,polarite,source,subType,type` | 24 |
| `id,kind,label,source,type` | 22 |
| `form,id,kind,label,rule,ruleCategory,source,template,type` | 20 |
| `die,id,label,rows,source,type` | 20 |
| `desc,id,label,max,passive,rand,source,specs,test,type` | 20 |
| `desc,effects,id,label,source,type` | 19 |
| `apparence,ascendant,classique,dates,desc,dieux,id,label,ops,rand,signe,source,type` | 19 |

### 2.3 Divergences nominatives d’enveloppe (strate Document)

Un même RÔLE porté par des noms de clé différents selon le document — l’objet du lot L1b (#1467).
Les ENTRÉES DE RACINE doivent porter `id` et `source` (et `label` sur les familles `entité`/`table`) :
leur absence est une divergence. Un DOCUMENT EMBARQUÉ (étape de Flow, rangée de table, nœud de
dialogue) n’est sommé de rien : on n’y compte que les clés DIVERGENTES.

| Rôle | Clé | Statut de la clé | Documents | Documents (n entrées) |
|---|---|---|---|---|
| identité | `id` | cible (`string`) | 126 | actions.json(55) activities.json(63) advancementCosts.json(15) ambiance.json(1) arcane-phenomena.json(1) artillery-misfire.json(1) astrology.json(5) axes.json(9) books.json(30) breath-types.json(6) buildings.json(7) calendarIntercalary.json(6) … |
| identité | `key` | divergente | 0 | — |
| identité | `nom` | divergente | 0 | — |
| libellé | `label` | cible (`string`) | 126 | actions.json(55) activities.json(63) advancementCosts.json(15) ambiance.json(1) arcane-phenomena.json(1) artillery-misfire.json(1) astrology.json(5) axes.json(9) books.json(30) breath-types.json(6) buildings.json(7) calendarIntercalary.json(6) … |
| libellé | `nom` | divergente | 0 | — |
| sous-titre | `title` | cible | 2 | creatures.json(493) gods.json(40) |
| prose | `desc` | cible | 40 | activities.json(62) astrology.json(5) axes.json(9) books.json(18) careers.json(108) characteristics.json(19) classes.json(9) creatures.json(196) crew-roles.json(9) domains.json(14) etats.json(21) gods.json(40) … |
| prose | `text` | divergente | 0 | — |
| prose | `description` | divergente | 0 | — |
| adresse de prose | `descRef` | cible (`object`) | 2 | psychology.json(9) regles.json(1) |
| type de document | `type` | cible (`string`) | 126 | actions.json(55) activities.json(63) advancementCosts.json(15) ambiance.json(1) arcane-phenomena.json(1) artillery-misfire.json(1) astrology.json(5) axes.json(9) books.json(30) breath-types.json(6) buildings.json(7) calendarIntercalary.json(6) … |
| source | `source` | cible (`object`) | 75 | actions.json(12) activities.json(63) advancementCosts.json(15) artillery-misfire.json(1) astrology.json(5) calendarIntercalary.json(6) calendarMonths.json(12) calendarWeekdays.json(8) careerLevels.json(432) careers.json(108) characteristics.json(19) classes.json(9) … |
| maison | `maison` | cible (`string`) | 23 | actions.json(30) activities.json(9) axes.json(9) buildings.json(7) creatures.json(1) crew-roles.json(7) defauts-de-compilation.json(1) etats.json(1) naval-traits.json(3) props.json(41) reglesOptionnelles.json(33) semences-de-scene.json(1) … |
| méta libre | `_source` | divergente | 0 | — |
| méta libre | `_comment` | divergente | 0 | — |
| méta libre | `_doc` | divergente | 0 | — |
| méta libre | `__genere` | divergente | 0 | — |
| méta libre | `__lecture` | divergente | 0 | — |
| méta libre | `__livres` | divergente | 0 | — |

Groupes mesurés : **128** jeux d’ENTRÉES DE RACINE et **136** chemins de
DOCUMENTS EMBARQUÉS (**2186** objets). **42** divergences
(rôle × clé × document × chemin) au stock `STRUCTURES_ENVELOPPE` (`scripts/guards/lib/structuresStock.mjs`,
garde `src/data/structures-contrat.test.ts`) — une ligne se solde en migrant l’enveloppe, la ligne part
dans le MÊME commit :

| Rôle | Motif | Groupes |
|---|---|---|
| source | clé absente | 42 |

Documents dont AUCUNE ENTRÉE DE RACINE ne porte `source` : **42** (lot `L1d #1469`) —
`ambiance.json`(1) `arcane-phenomena.json`(1) `books.json`(30) `breath-types.json`(6) `calendarPhases.json`(7) `crew-test-types.json`(1) `damage-types.json`(4) `details.json`(1) `disponibilite.json`(1) `donnees.manifest.json`(1) `groups.json`(38) `land-cargo.json`(1) `lieux-services.json`(7) `lightLevels.json`(5) `lightTones.json`(4) `localisation.json`(1) `mass-battle.json`(1) `materials.json`(16) `merchantFamilies.json`(7) `merchants.json`(6) `names.json`(7) `naval-progression.json`(1) `pregens.json`(8) `primitives.manifest.json`(101) `progression-schemas.derived.json`(1) `qualitySubtypes.json`(3) `qualityTypes.json`(2) `raceAppearance.json`(21) `raw.manifest.json`(12) `renduMonte.json`(1) `river-perils.json`(1) `sea-cargo.json`(1) `sea-events.json`(1) `sea-navigation.json`(1) `sea-perils.json`(1) `sea-weather.json`(1) `ship-construction.json`(1) `sizes.json`(1) `speciesRace.json`(1) `structureAppearance.json`(18) `systemes.manifest.json`(16) `weather.json`(1)

Le DoD ajouté de #1465 annonçait « 13 datasets sans `source` » : la mesure en trouve
**42** — le chiffre de 13 n’a pas de porteur dans l’arbre, il ne se recopie pas.

Documents de racine ne portant AUCUNE clé `source` à quelque profondeur que ce soit : **38**
(lot `L1d #1469`) — `ambiance.json` `arene-projet.json` `axes.json` `barge-du-sel-projet.json` `books.json` `breath-types.json` `buildings.json` `calendarPhases.json` `damage-types.json` `decorPalette.json` `defauts-de-compilation.json` `details.json` `donnees.manifest.json` `groups.json` `lieux-services.json` `lightLevels.json` `lightTones.json` `loup-et-saumure-projet.json` `materials.json` `merchantFamilies.json` `merchants.json` `names.json` `pregens.json` `primitives.manifest.json` `progression-schemas.derived.json` `props.json` `qualitySubtypes.json` `qualityTypes.json` `raceAppearance.json` `raw.manifest.json` `renduMonte.json` `semences-de-scene.json` `sizes.json` `speciesRace.json` `structureAppearance.json` `systemes.manifest.json` `teintesJeu.json` `terrains.json`

Documents EMBARQUÉS mesurés, par chemin :

| Document | Chemin | Objets | Clés |
|---|---|---|---|
| `activities.json` | `outcomes.ops.skill` | 1 | `id`(1) |
| `activities.json` | `worldRolls` | 1 | `cible`(1) `id`(1) `label`(1) `ops`(1) `unless`(1) |
| `arcane-phenomena.json` | `phenomena` | 25 | `cancelsTraitId`(1) `controlFlux`(1) `critOnTens`(1) `daemonsDoubled`(1) `desc`(25) `draws`(2) `fluxTableId`(1) `id`(25) `influenceMalveillante`(3) `kind`(25) `label`(25) `niMods`(3) `overcastPerSpell`(1) `refractedWindsOnly`(1) `saturation`(10) `singleWind`(1) `source`(25) `stonePropertySlots`(1) `tableId`(2) `testMods`(20) |
| `arcane-phenomena.json` | `saturationLevels` | 5 | `corrupts`(1) `desc`(5) `effectsMax`(5) `effectsMin`(5) `id`(5) `label`(5) `order`(5) `source`(5) `testMods`(3) |
| `arcane-phenomena.json` | `tables` | 3 | `desc`(3) `die`(3) `id`(3) `label`(3) `rows`(3) `source`(3) |
| `arcane-phenomena.json` | `windSaturationEffects` | 8 | `domainId`(8) `effects`(8) `environments`(8) `id`(8) `source`(8) `surnoms`(8) `wind`(8) |
| `arene-projet.json` | `scenes` | 18 | `ambiance`(18) `ambientLight`(18) `architecture`(2) `desc`(18) `dialogues`(18) `dimensions`(18) `effectZones`(2) `encounters`(18) `entities`(18) `entryPoints`(1) `flags`(18) `id`(18) `label`(18) `layers`(18) `metresPerTile`(18) `music`(1) `reliefDefaults`(18) `rest`(14) `roofDefaults`(18) `startMessage`(18) `triggers`(18) `type`(18) `walls`(2) `weather`(3) |
| `arene-projet.json` | `scenes.architecture` | 2 | `facades`(2) `id`(2) `label`(2) `masses`(2) `storeys`(2) |
| `arene-projet.json` | `scenes.architecture.facades` | 3 | `appearance`(3) `edges`(3) `features`(3) `id`(3) `roomZoneIds`(3) `z`(3) |
| `arene-projet.json` | `scenes.architecture.facades.features` | 3 | `edge`(3) `id`(3) `kind`(3) `offset`(3) `width`(1) |
| `arene-projet.json` | `scenes.architecture.masses` | 9 | `footprint`(9) `id`(9) `levels`(9) `material`(9) `pitchDeg`(9) `profile`(9) `ridge`(4) `z`(9) |
| `arene-projet.json` | `scenes.architecture.storeys` | 9 | `id`(9) `parts`(9) `roomZoneIds`(9) `z`(9) |
| `arene-projet.json` | `scenes.architecture.storeys.parts` | 9 | `foot`(9) `id`(9) |
| `arene-projet.json` | `scenes.dialogues` | 9 | `id`(9) `nodes`(9) `start`(9) |
| `arene-projet.json` | `scenes.dialogues.nodes` | 16 | `choices`(16) `desc`(16) `id`(16) |
| `arene-projet.json` | `scenes.effectZones` | 9 | `area`(9) `id`(9) `label`(9) `presentation`(9) `z`(9) |
| `arene-projet.json` | `scenes.encounters` | 20 | `id`(20) `members`(20) `onVictory`(20) `surprise`(6) |
| `arene-projet.json` | `scenes.entities` | 442 | `anim`(10) `appearance`(23) `combat`(41) `dialogueId`(9) `facing`(16) `id`(442) `kind`(442) `label`(85) `merchant`(4) `pos`(442) `ref`(421) `statblock`(3) `usable`(29) `weapon`(6) |
| `arene-projet.json` | `scenes.entities.usable.actions` | 29 | `consume`(1) `flow`(29) `id`(29) `unique`(28) |
| `arene-projet.json` | `scenes.triggers` | 27 | `flow`(27) `id`(27) `once`(25) `rect`(27) |
| `arene-projet.json` | `worldMap` | 1 | `id`(1) `label`(1) `places`(1) `routes`(1) |
| `arene-projet.json` | `worldMap.places` | 4 | `entry`(1) `icon`(4) `id`(4) `label`(4) `pos`(4) `scene`(4) |
| `arene-projet.json` | `worldMap.routes` | 4 | `a`(4) `ambush`(4) `b`(4) `id`(4) `inns`(1) `km`(4) `modes`(4) `perilDie`(1) `perils`(3) |
| `artillery-misfire.json` | `entries` | 4 | `destroyed`(4) `id`(4) `label`(4) `location`(4) `max`(4) `min`(4) `note`(4) `perSalveIndex`(4) `strayFire`(1) |
| `barge-du-sel-projet.json` | `scenes` | 3 | `ambiance`(3) `ambientLight`(3) `desc`(3) `dialogues`(3) `dimensions`(3) `encounters`(3) `entities`(3) `entryPoints`(1) `flags`(3) `id`(3) `label`(3) `layers`(3) `metresPerTile`(3) `reliefDefaults`(3) `roofDefaults`(3) `triggers`(3) `type`(3) `weather`(1) |
| `barge-du-sel-projet.json` | `scenes.encounters` | 1 | `id`(1) `members`(1) `onVictory`(1) `surprise`(1) `victoryCondition`(1) |
| `barge-du-sel-projet.json` | `scenes.encounters.onVictory.steps.effect` | 1 | `desc`(1) `id`(1) `type`(1) |
| `barge-du-sel-projet.json` | `scenes.entities` | 13 | `appearance`(4) `crewIds`(2) `facing`(2) `id`(13) `kind`(13) `label`(10) `pos`(13) `postes`(2) `ref`(6) `statblock`(4) `upgrades`(1) `usable`(1) |
| `barge-du-sel-projet.json` | `scenes.entities.upgrades` | 1 | `id`(1) `value`(1) |
| `barge-du-sel-projet.json` | `scenes.entities.usable.actions` | 1 | `flow`(1) `id`(1) `unique`(1) |
| `barge-du-sel-projet.json` | `scenes.triggers` | 3 | `flow`(3) `id`(3) `once`(3) `rect`(3) |
| `barge-du-sel-projet.json` | `scenes.triggers.flow.steps.effect` | 1 | `desc`(1) `id`(1) `type`(1) |
| `barge-du-sel-projet.json` | `worldMap` | 1 | `id`(1) `label`(1) `places`(1) `routes`(1) |
| `barge-du-sel-projet.json` | `worldMap.places` | 2 | `icon`(2) `id`(2) `label`(2) `pos`(2) `scene`(2) `when`(1) |
| `barge-du-sel-projet.json` | `worldMap.routes` | 1 | `a`(1) `ambush`(1) `b`(1) `id`(1) `km`(1) `modes`(1) `refus`(1) `sea`(1) `seaHeading`(1) `when`(1) |
| `characteristics.json` | `options` | 2 | `desc`(2) `id`(2) `label`(2) `source`(2) |
| `creatures.json` | `optionals.grant` | 1 | `id`(1) `spec`(1) `value`(1) |
| `crew-morale.json` | `bands` | 4 | `captainCmdDR`(4) `crewTestDR`(4) `desc`(4) `desertionRoll`(2) `id`(4) `label`(4) `max`(4) `min`(4) `source`(4) |
| `crew-morale.json` | `factors` | 28 | `effect`(28) `id`(28) `label`(28) `recommendedPay`(1) `source`(28) `wageMul`(4) |
| `crew-test-types.json` | `types` | 10 | `essential`(10) `id`(10) `label`(10) `moraleOnNegativeDR`(1) `roles`(10) `rule`(10) `source`(10) `steering`(1) |
| `criticals.json` | `entries` | 160 | `amputation`(26) `desc`(160) `escalation`(24) `id`(160) `label`(160) `lethal`(8) `maison`(1) `max`(160) `min`(160) `ops`(150) `source`(160) `test`(38) `traumas`(46) |
| `decorPalette.json` | `(racine)` | 1 | `entries`(1) `id`(1) `label`(1) `type`(1) |
| `diligence-projet.json` | `scenes` | 2 | `ambiance`(2) `architecture`(1) `dialogues`(2) `dimensions`(2) `effectZones`(1) `encounters`(2) `entities`(2) `environment`(1) `flags`(2) `id`(2) `label`(2) `layers`(2) `metresPerTile`(2) `reliefDefaults`(2) `rest`(1) `restZones`(1) `roofDefaults`(2) `triggers`(2) `type`(2) `walls`(1) |
| `diligence-projet.json` | `scenes.architecture` | 1 | `facades`(1) `id`(1) `label`(1) `masses`(1) `storeys`(1) `style`(1) |
| `diligence-projet.json` | `scenes.architecture.facades` | 41 | `appearance`(41) `edges`(41) `features`(25) `id`(41) `roomZoneIds`(37) `z`(41) |
| `diligence-projet.json` | `scenes.architecture.facades.features` | 71 | `edge`(71) `id`(71) `kind`(71) `offset`(3) `width`(2) |
| `diligence-projet.json` | `scenes.architecture.storeys` | 2 | `id`(2) `parts`(2) `roomZoneIds`(2) `z`(2) |
| `diligence-projet.json` | `scenes.effectZones` | 39 | `area`(39) `id`(39) `label`(39) `presentation`(39) `tiles`(10) `z`(37) |
| `diligence-projet.json` | `scenes.entities` | 22 | `facing`(20) `id`(22) `kind`(22) `pos`(22) `ref`(20) `usable`(5) |
| `diligence-projet.json` | `worldMap` | 1 | `id`(1) `label`(1) `places`(1) `routes`(1) |
| `diligence-projet.json` | `worldMap.places` | 2 | `icon`(2) `id`(2) `label`(2) `pos`(2) `scene`(2) `when`(1) |
| `diligence-projet.json` | `worldMap.routes` | 1 | `a`(1) `b`(1) `id`(1) `inns`(1) `km`(1) `modes`(1) `refus`(1) `speed`(1) `when`(1) |
| `donnees.manifest.json` | `rubriques` | 11 | `entrees`(11) `id`(11) `label`(11) `note`(1) |
| `driving-mishap.json` | `entries` | 4 | `desc`(4) `id`(4) `label`(4) `max`(4) `min`(4) `outcome`(4) |
| `drunkenness.json` | `entries` | 5 | `desc`(5) `id`(5) `label`(5) `max`(5) `min`(5) `ops`(3) `outcome`(5) |
| `drunkenness.json` | `entries.ops.skill` | 1 | `id`(1) |
| `incidents-monture.json` | `entries` | 4 | `desc`(4) `id`(4) `label`(4) `max`(4) `min`(4) `mount`(4) |
| `land-cargo.json` | `cargoes` | 9 | `avail`(7) `echangeable`(2) `hint`(2) `id`(9) `label`(9) `price`(7) `source`(9) `tradeHub`(1) `wine`(1) |
| `loup-et-saumure-projet.json` | `scenes` | 5 | `ambiance`(5) `ambientLight`(5) `desc`(5) `dialogues`(5) `dimensions`(5) `encounters`(5) `entities`(5) `entryPoints`(5) `flags`(5) `id`(5) `label`(5) `layers`(5) `metresPerTile`(5) `reliefDefaults`(5) `rest`(2) `roofDefaults`(5) `triggers`(5) `type`(5) `weather`(4) |
| `loup-et-saumure-projet.json` | `scenes.dialogues` | 8 | `id`(8) `nodes`(8) `start`(8) |
| `loup-et-saumure-projet.json` | `scenes.dialogues.nodes` | 17 | `choices`(17) `desc`(17) `id`(17) |
| `loup-et-saumure-projet.json` | `scenes.dialogues.nodes.choices.flow.steps.effect` | 1 | `desc`(1) `id`(1) `type`(1) |
| `loup-et-saumure-projet.json` | `scenes.encounters` | 2 | `id`(2) `members`(2) `onVictory`(2) `surprise`(2) `threat`(1) `victoryCondition`(2) |
| `loup-et-saumure-projet.json` | `scenes.encounters.onVictory.steps.effect` | 1 | `desc`(1) `id`(1) `type`(1) |
| `loup-et-saumure-projet.json` | `scenes.entities` | 36 | `appearance`(19) `crewIds`(4) `dialogueId`(8) `facing`(15) `id`(36) `kind`(36) `label`(31) `merchant`(3) `pos`(36) `postes`(4) `ref`(23) `statblock`(8) `upgrades`(1) `usable`(2) `weapon`(1) |
| `loup-et-saumure-projet.json` | `scenes.entities.upgrades` | 1 | `id`(1) |
| `loup-et-saumure-projet.json` | `scenes.entities.usable.actions` | 2 | `flow`(2) `id`(2) `unique`(2) |
| `loup-et-saumure-projet.json` | `scenes.entities.usable.actions.flow.steps.effect` | 1 | `desc`(1) `id`(1) `type`(1) |
| `loup-et-saumure-projet.json` | `scenes.triggers` | 2 | `flow`(2) `id`(2) `once`(2) `rect`(2) `when`(1) |
| `loup-et-saumure-projet.json` | `scenes.triggers.flow.steps.effect` | 1 | `desc`(1) `id`(1) `type`(1) |
| `loup-et-saumure-projet.json` | `worldMap` | 1 | `id`(1) `label`(1) `places`(1) `routes`(1) |
| `loup-et-saumure-projet.json` | `worldMap.places` | 2 | `backdrop`(2) `icon`(2) `id`(2) `label`(2) `poi`(2) `port`(2) `pos`(2) `scene`(2) `services`(2) |
| `loup-et-saumure-projet.json` | `worldMap.places.poi` | 8 | `id`(8) `label`(8) `pos`(8) `serviceKind`(8) |
| `loup-et-saumure-projet.json` | `worldMap.routes` | 2 | `a`(2) `ambush`(2) `b`(2) `from`(2) `id`(2) `km`(2) `modes`(2) `sea`(2) `seaHeading`(2) |
| `maladies.json` | `dailyTest.test.test.skill` | 1 | `id`(1) |
| `mass-battle.json` | `hazards` | 10 | `desc`(10) `id`(10) `label`(10) `max`(10) `min`(10) `source`(10) |
| `mass-battle.json` | `mightModifiers` | 9 | `example`(9) `id`(9) `label`(9) `mod`(9) `source`(9) |
| `mass-battle.json` | `powerEstimate` | 5 | `ally`(5) `enemy`(5) `example`(5) `id`(5) `label`(5) `source`(5) |
| `mass-battle.json` | `structures` | 5 | `be`(5) `id`(5) `label`(5) `source`(5) `traits`(5) `wounds`(5) |
| `mass-battle.json` | `warMachines` | 10 | `availability`(10) `crew`(10) `damage`(10) `id`(10) `label`(10) `price`(10) `range`(10) `siege`(10) `source`(10) `traits`(10) |
| `miscast.json` | `entries` | 111 | `domainTable`(1) `id`(111) `label`(111) `max`(111) `min`(111) `ops`(51) `reroll`(4) `source`(111) `test`(15) |
| `montures.json` | `entries` | 8 | `creatureIds`(8) `e`(8) `encPortee`(8) `id`(8) `label`(8) `m`(8) `trot`(8) |
| `naval-progression.json` | `entries` | 5 | `desc`(5) `id`(5) `max`(5) `min`(5) `mode`(5) `source`(5) |
| `obsessions.json` | `entries` | 19 | `id`(19) `label`(19) `max`(19) `min`(19) |
| `problemes-vehicule.json` | `entries` | 4 | `desc`(4) `id`(4) `label`(4) `max`(4) `min`(4) `occupantOps`(2) `vehicleWounds`(4) |
| `props.json` | `seatSlots` | 6 | `anchor`(6) `approach`(6) `facing`(6) `id`(6) |
| `rencontres-edoc.json` | `tables.dangereuses` | 9 | `desc`(9) `id`(9) `label`(9) `max`(9) `min`(9) `stageOutcome`(1) |
| `rencontres-edoc.json` | `tables.fortuites` | 10 | `desc`(10) `id`(10) `label`(10) `max`(10) `min`(10) |
| `rencontres-edoc.json` | `tables.positives` | 7 | `desc`(7) `id`(7) `label`(7) `max`(7) `min`(7) `stageOutcome`(3) |
| `river-criticals.json` | `tables.avirons` | 1 | `crewHit`(1) `id`(1) `label`(1) `max`(1) `min`(1) `note`(1) `ops`(1) |
| `river-criticals.json` | `tables.coque` | 1 | `id`(1) `label`(1) `max`(1) `min`(1) `note`(1) `ops`(1) |
| `river-criticals.json` | `tables.gouvernail` | 1 | `crewHit`(1) `id`(1) `label`(1) `max`(1) `min`(1) `note`(1) `ops`(1) |
| `river-criticals.json` | `tables.gouvernail.crewHit.crewTarget.role` | 1 | `id`(1) |
| `river-criticals.json` | `tables.greement` | 1 | `crewHit`(1) `id`(1) `label`(1) `max`(1) `min`(1) `note`(1) `ops`(1) |
| `river-criticals.json` | `tables.superstructure` | 1 | `crewHit`(1) `id`(1) `label`(1) `max`(1) `min`(1) `note`(1) |
| `river-navigation.json` | `windDirections` | 3 | `id`(3) `label`(3) `max`(3) `min`(3) `source`(3) |
| `river-navigation.json` | `windForces` | 5 | `id`(5) `label`(5) `max`(5) `min`(5) `source`(5) |
| `river-perils.json` | `perils` | 4 | `clear`(1) `id`(4) `kind`(4) `label`(4) `obstacle`(1) `onFail`(1) `onHit`(2) `ref`(4) `source`(4) |
| `sea-cargo.json` | `cargoes` | 13 | `avail`(11) `echangeable`(2) `hint`(2) `id`(13) `label`(13) `price`(11) `source`(13) `tradeHub`(1) |
| `sea-cargo.json` | `opportunite.test.skill` | 1 | `id`(1) |
| `sea-cargo.json` | `overload.paliers` | 3 | `fromPct`(3) `id`(3) `label`(3) `mMod`(3) `manoeuvreDR`(3) |
| `sea-events.json` | `boardEvents` | 40 | `desc`(40) `id`(40) `kind`(40) `label`(40) `max`(40) `min`(40) `params`(40) `source`(40) |
| `sea-events.json` | `fastVoyage.paliers` | 5 | `cargoLostPct`(5) `crewLostPct`(5) `criticals`(5) `desc`(5) `hullLostPct`(5) `id`(5) `label`(5) `max`(5) `min`(5) `source`(5) |
| `sea-events.json` | `manann.factors` | 26 | `effect`(26) `id`(26) `label`(26) `source`(26) |
| `sea-events.json` | `portEvents` | 18 | `desc`(18) `id`(18) `kind`(18) `label`(18) `max`(18) `min`(18) `params`(18) `source`(18) |
| `sea-navigation.json` | `poursuite.escapeDistances` | 5 | `distance`(5) `id`(5) `label`(5) `source`(5) |
| `sea-perils.json` | `detroits` | 3 | `id`(3) `label`(3) `m`(3) `navDR`(3) `source`(3) |
| `sea-perils.json` | `hazards` | 4 | `desc`(4) `entangleChancePct`(1) `entanglePenalties`(1) `freeTest`(1) `ic`(4) `id`(4) `label`(4) `m`(2) `source`(4) `strandChancePct`(2) `weight`(4) |
| `sea-perils.json` | `tourbillonSwim.skill` | 1 | `id`(1) |
| `sea-perils.json` | `tourbillons` | 5 | `evasion`(5) `ic`(5) `id`(5) `label`(5) `m`(5) `manDR`(5) `source`(5) `zoneRadiusM`(5) `zoneSpiralM`(5) |
| `sea-weather.json` | `precipitations` | 4 | `desc`(3) `id`(4) `label`(4) `otherMod`(1) `skillMods`(3) `source`(4) |
| `sea-weather.json` | `temperatures` | 5 | `difficulty`(4) `exposure`(4) `id`(5) `label`(5) `litresParJour`(2) `source`(5) `testEveryHours`(4) |
| `sea-weather.json` | `vents` | 6 | `id`(6) `label`(6) `source`(6) |
| `sea-weather.json` | `visibilites` | 4 | `beyondM`(3) `drPenalty`(3) `id`(4) `label`(4) `source`(4) |
| `ship-construction.json` | `speedTraits` | 7 | `capacityPct`(7) `costPct`(7) `id`(7) `label`(7) `mMod`(7) `manDR`(7) `source`(7) |
| `ship-construction.json` | `standard` | 7 | `b`(7) `capacity`(7) `costGold`(7) `crew`(7) `e`(7) `id`(7) `lengthM`(7) `oars`(5) `sail`(7) `size`(7) `source`(7) |
| `ship-criticals.json` | `tables.avirons` | 5 | `crewHit`(2) `id`(5) `label`(5) `max`(5) `min`(5) `note`(5) `shrapnel`(4) |
| `ship-criticals.json` | `tables.cargaison` | 5 | `hullCrits`(1) `id`(5) `label`(5) `max`(5) `min`(5) `note`(5) `ops`(2) `shrapnel`(3) |
| `ship-criticals.json` | `tables.coque` | 10 | `crewHit`(4) `id`(10) `label`(10) `max`(10) `min`(10) `note`(10) `ops`(3) `shrapnel`(6) |
| `ship-criticals.json` | `tables.equipements` | 5 | `crewHit`(1) `id`(5) `label`(5) `max`(5) `min`(5) `note`(5) `ops`(1) |
| `ship-criticals.json` | `tables.greement` | 10 | `crewHit`(5) `id`(10) `label`(10) `max`(10) `min`(10) `note`(10) `shrapnel`(4) |
| `ship-criticals.json` | `tables.greement.crewHit.test.fail.effect.ops.hauteur.table` | 5 | `id`(5) |
| `ship-criticals.json` | `tablesDeChute` | 1 | `bandes`(1) `id`(1) `label`(1) |
| `skills.json` | `specs` | 254 | `alsoIn`(2) `id`(254) `label`(254) `pool`(32) `source`(49) |
| `species.json` | `traits` | 1 | `id`(1) |
| `structure-criticals.json` | `entries` | 8 | `destroyed`(1) `id`(8) `label`(8) `max`(8) `min`(8) `note`(8) `trivial`(1) `wounds`(8) |
| `surincantation.json` | `entries` | 7 | `damage`(7) `dr`(7) `duration`(7) `id`(7) `label`(7) `range`(7) `targets`(7) `zone`(7) |
| `talents.json` | `specs` | 243 | `id`(243) `label`(243) `pool`(19) `source`(30) |
| `tavernGames.json` | `sides` | 2 | `div`(2) `id`(2) `label`(2) `mult`(2) `pieces`(2) |
| `teintesJeu.json` | `(racine)` | 1 | `entries`(1) `id`(1) `label`(1) `type`(1) |
| `vehicles.json` | `travel.classes` | 6 | `brassPerKm`(6) `id`(6) `label`(6) |
| `vents-tourbillonnants.json` | `entries` | 5 | `id`(5) `label`(5) `max`(5) `min`(5) `mod`(5) |
| `water-exposure.json` | `modifiers` | 12 | `appliesTo`(12) `auto`(7) `id`(12) `label`(12) `mod`(12) `table`(12) |
| `water-exposure.json` | `test.skill` | 1 | `id`(1) |
| `weather.json` | `conditions` | 6 | `desc`(4) `id`(6) `label`(6) `lightningNervous`(1) `movementWalkOnly`(2) `physicalTestMod`(1) `powderUseless`(1) `rangedMod`(2) `rangedUseless`(1) `resistanceTest`(2) `source`(6) `visibiliteM`(4) |
| `weather.json` | `seasons` | 4 | `id`(4) `label`(4) `ranges`(4) `source`(4) |

### 2.4 Formes DÉCLARÉES jamais observées

Clé déclarée par le schéma zod d’un document mais portée par AUCUNE entrée du JSON — schéma plus
large que la donnée (un champ à retirer, ou une donnée à écrire).
Deux régimes, et ils ne se confondent pas : **par DÉFAUT** (table A) la forme n’a AUCUN lot de
peuplement — c’est du dénominateur, elle va au stock `STRUCTURES_DEFAUT` et ne fait que décroître ;
**`cible-declaree`** (table B) est un déclaré-avant-posé ASSUMÉ, avec son lot de peuplement — il ne
se STOCKE pas (un stock décroît, une cible se solde en PEUPLANT la donnée), il s’ÉMET ici.

#### A. Par défaut — sans lot de peuplement (stock `STRUCTURES_DEFAUT`)

**126** documents portent au moins une clé déclarée jamais observée, **747** clés en tout
(stock `STRUCTURES_DEFAUT`, `scripts/guards/lib/structuresStock.mjs`, garde `src/data/structures-contrat.test.ts`).

| Document | Clés | Détail |
|---|---|---|
| `actions.json` | 5 | `alsoIn` `blocked` `desc` `descRef` `labelF` |
| `activities.json` | 4 | `alsoIn` `char` `descRef` `labelF` |
| `advancementCosts.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `ambiance.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `arcane-phenomena.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `artillery-misfire.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `astrology.json` | 5 | `alsoIn` `descRef` `icon` `labelF` `maison` |
| `axes.json` | 5 | `alsoIn` `descRef` `icon` `labelF` `source` |
| `books.json` | 6 | `alsoIn` `descRef` `icon` `labelF` `maison` `source` |
| `breath-types.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `buildings.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `source` |
| `calendarIntercalary.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `calendarMonths.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `calendarPhases.json` | 6 | `alsoIn` `desc` `descRef` `labelF` `maison` `source` |
| `calendarWeekdays.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `careerLevels.json` | 5 | `alsoIn` `desc` `descRef` `icon` `maison` |
| `careers.json` | 4 | `alsoIn` `descRef` `icon` `maison` |
| `characteristics.json` | 5 | `alsoIn` `descRef` `icon` `labelF` `maison` |
| `classes.json` | 5 | `alsoIn` `descRef` `icon` `labelF` `maison` |
| `combat-stakes.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `creatures.json` | 3 | `descRef` `icon` `labelF` |
| `crew-morale.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `crew-roles.json` | 4 | `alsoIn` `descRef` `icon` `labelF` |
| `crew-test-types.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `criticals.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `damage-types.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `defauts-de-compilation.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `source` |
| `details.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `disponibilite.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `domains.json` | 4 | `descRef` `icon` `labelF` `maison` |
| `donnees.manifest.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `driving-mishap.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `drunkenness.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `encumbranceTiers.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `etats.json` | 3 | `alsoIn` `descRef` `labelF` |
| `eyes.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `flow-stakes.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `gods.json` | 5 | `alsoIn` `descRef` `icon` `labelF` `maison` |
| `grapple.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `groups.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `hairs.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `incidents-monture.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `interludeEvents.json` | 5 | `alsoIn` `descRef` `icon` `labelF` `maison` |
| `land-cargo.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `lieux-services.json` | 5 | `alsoIn` `descRef` `labelF` `maison` `source` |
| `lightLevels.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `lightTones.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `localisation.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `locations.json` | 5 | `alsoIn` `descRef` `icon` `labelF` `maison` |
| `maladies.json` | 5 | `alsoIn` `descRef` `icon` `labelF` `maison` |
| `maneuvers.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `priority` |
| `mass-battle.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `materials.json` | 8 | `alsoIn` `desc` `descRef` `fasciaThickM` `icon` `labelF` `maison` `source` |
| `merchantFamilies.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `merchants.json` | 9 | `alsoIn` `buyMarkup` `desc` `descRef` `icon` `labelF` `maison` `restockDays` `source` |
| `miscast.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `montures.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `mutationTables.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `mutations.json` | 5 | `alsoIn` `descRef` `icon` `labelF` `maison` |
| `names.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `naval-ports.json` | 5 | `alsoIn` `descRef` `icon` `labelF` `maison` |
| `naval-progression.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `naval-traits.json` | 3 | `descRef` `icon` `labelF` |
| `night-stakes.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `obsessions.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `oups.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `peripeties.json` | 5 | `alsoIn` `descRef` `icon` `labelF` `maison` |
| `pregens.json` | 9 | `age` `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` `weaponChoice` |
| `primitives.manifest.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `problemes-vehicule.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `progression-schemas.derived.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `props.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `source` |
| `psychology.json` | 5 | `alsoIn` `desc` `gating` `labelF` `maison` |
| `qualities.json` | 4 | `descRef` `icon` `labelF` `maison` |
| `qualitySubtypes.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `qualityTypes.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `raceAppearance.json` | 10 | `alsoIn` `armD` `armG` `desc` `descRef` `icon` `labelF` `maison` `scale` `source` |
| `raw.manifest.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `regles.json` | 4 | `alsoIn` `icon` `labelF` `maison` |
| `reglesOptionnelles.json` | 5 | `alsoIn` `desc` `descRef` `icon` `labelF` |
| `rencontres-edoc.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `renduMonte.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `reseau-routier.json` | 5 | `alsoIn` `descRef` `icon` `labelF` `maison` |
| `river-criticals.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `river-navigation.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `river-perils.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `sea-cargo.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `sea-events.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `sea-navigation.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `sea-perils.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `sea-shanties.json` | 5 | `alsoIn` `descRef` `icon` `labelF` `maison` |
| `sea-weather.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `semences-de-scene.json` | 7 | `alsoIn` `ambientLight` `desc` `descRef` `icon` `labelF` `source` |
| `ship-construction.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `ship-criticals.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `ship-stations.json` | 5 | `alsoIn` `descRef` `icon` `labelF` `maison` |
| `sizes.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `skills.json` | 5 | `alsoIn` `descRef` `icon` `labelF` `maison` |
| `species.json` | 4 | `descRef` `icon` `labelF` `maison` |
| `speciesRace.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `spells.json` | 4 | `descRef` `icon` `labelF` `maison` |
| `stars.json` | 5 | `alsoIn` `descRef` `icon` `labelF` `maison` |
| `steam-breakdown.json` | 5 | `alsoIn` `descRef` `icon` `labelF` `maison` |
| `structure-criticals.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `structureAppearance.json` | 9 | `alsoIn` `bayPanel` `desc` `descRef` `icon` `labelF` `maison` `relief` `source` |
| `structures.json` | 4 | `alsoIn` `descRef` `icon` `labelF` |
| `surincantation.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `symptoms.json` | 4 | `alsoIn` `descRef` `icon` `labelF` |
| `systemes.manifest.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `tables.json` | 5 | `alsoIn` `desc` `descRef` `icon` `labelF` |
| `talents.json` | 3 | `descRef` `icon` `labelF` |
| `tavernGames.json` | 6 | `alsoIn` `descRef` `fastSkill` `icon` `labelF` `maison` |
| `terrains.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `source` |
| `traits.json` | 5 | `appearance` `descRef` `icon` `labelF` `variants` |
| `trappings.json` | 4 | `descRef` `icon` `labelF` `requiresMastery` |
| `traumas.json` | 4 | `alsoIn` `descRef` `icon` `labelF` |
| `vehicles.json` | 4 | `alsoIn` `descRef` `labelF` `maison` |
| `vents-tourbillonnants.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `voyage-stakes.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `water-exposure.json` | 5 | `alsoIn` `descRef` `icon` `labelF` `maison` |
| `weaponGroups.json` | 6 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` |
| `weather.json` | 7 | `alsoIn` `desc` `descRef` `icon` `labelF` `maison` `source` |
| `arene-projet.json` | 7 | `activeAxes` `alsoIn` `auteur` `desc` `descRef` `labelF` `source` |
| `barge-du-sel-projet.json` | 7 | `activeAxes` `alsoIn` `auteur` `desc` `descRef` `labelF` `source` |
| `diligence-projet.json` | 6 | `activeAxes` `alsoIn` `auteur` `descRef` `labelF` `maison` |
| `loup-et-saumure-projet.json` | 7 | `activeAxes` `alsoIn` `auteur` `desc` `descRef` `labelF` `source` |

#### B. `cible-declaree` — déclaré-avant-posé ASSUMÉ (émission, jamais un stock)

Le CONTENU de cette table est MESURÉ (déclaré du schéma × valeurs posées dans les deux racines) ;
seuls la DATE et le LOT DE PEUPLEMENT se déclarent, une fois par famille
(`LOTS_DE_PEUPLEMENT`, `scripts/docs/lib/structures-lexique.mts`).

| Forme | Famille | Date | Lot de peuplement |
|---|---|---|---|
| `type: 'ambitionLost'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'castSpell'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'delayedEffect'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'discreditClue'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'exposureNight'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'fall'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'forceDoor'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'givePossession'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'grantFavor'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'inflictHunger'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'inflictPsychology'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'inflictThirst'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'inflictTrauma'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'moveEntity'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'openCharacterCreator'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'openPort'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'openTavernGames'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'petitePriere'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'playSfx'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'revealClue'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'sessionEnd'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'setDoor'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'setLight'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'startMassBattle'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'startPursuit'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'transitionBack'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'waterExposure'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |
| `type: 'zoneBlast'` | variante d’`Effect` | 2026-08-24 | adoption scènes (L1b #1467 et suivants) |

Même règle pour le LEXIQUE : une signature qu’il déclare et que la donnée ne porte nulle part.
Une CIBLE à `0` est une forme visée que rien n’écrit encore — elle se lit ici, jamais en silence.

| Concept | Signature du lexique | Statut | Occurrences |
|---|---|---|---|
| reference | `id` | cible | 9013 |
| reference | `id,spec` | cible | 1327 |
| reference | `choix,id` | cible | 278 |
| reference | `id,type` | cible | 0 |
| reference | `count,id,type` | cible | 0 |
| reference | `of,pick` | cible | 0 |
| reference | `pick,table` | cible | 0 |
| reference | `id,value` | cible | 5659 |
| reference | `id,spec,value` | cible | 1374 |
| reference | `choix,id,value` | cible | 59 |
| reference | `id,value` | historique | 5659 |
| reference | `id,spec,value` | historique | 1374 |
| reference | `arg,id` | historique | 545 |
| reference | `arg,id,value` | historique | 125 |
| reference | `count,id` | historique | 26 |
| reference | `count,text` | historique | 0 |
| reference | `id,times` | historique | 48 |
| reference | `id,qualityChoice` | historique | 36 |
| reference | `ref` | historique | 2 |
| reference | `wildcard` | historique | 7 |
| reference | `specOptions,wildcard` | historique | 0 |
| reference | `skillId` | historique | 0 |
| reference | `skillId,spec` | historique | 0 |
| reference | `skill,spec` | historique | 0 |
| reference | `talentId` | historique | 3 |
| reference | `trappingId` | historique | 0 |
| reference | `creatureId` | historique | 55 |
| reference | `vehicleId` | historique | 15 |
| reference | `career` | historique | 0 |
| reference | `choice` | historique | 14 |
| reference | `random` | historique | 21 |
| reference | `text` | declaree | 577 |
| reference | `id-nu` | historique | 2261 |
| refs | `ids-nus` | cible | 630 |
| monnaie | `brass,gold,silver` | cible | 465 |
| monnaie | `brass` | cible | 0 |
| monnaie | `gold` | cible | 27 |
| monnaie | `silver` | cible | 23 |
| monnaie | `brass,gold` | cible | 0 |
| monnaie | `brass,silver` | cible | 0 |
| monnaie | `gold,silver` | cible | 3 |
| prix | `automne,ete,hiver,printemps` | declaree | 17 |
| prix | `dice` | declaree | 1 |
| de | `n,sides` | cible | 121 |
| de | `n,plus,sides` | cible | 19 |
| adresse | `book,ch,parts` | cible | 10 |
| fragment | `b0,b1,sec,secOcc,sum+…` | cible | 10 |
| fragment | `col,row,sec,secOcc,sum+…` | cible | 0 |
| formule | `sum` | cible | 13 |
| formule | `sinPoints` | cible | 10 |
| formule | `minimum,of` | cible | 2 |
| source | `book,page` | cible | 3274 |
| source | `book,note,page` | cible | 1255 |
| source | `book,chapter` | historique | 0 |
| source | `book,chapter,page` | historique | 0 |
| bornes | `max,min+…` | cible | 29 |
| plage | `max,min` | cible | 84 |
| plage | `max,min+…` | cible | 1460 |
| quantite | `fixed` | cible | 47 |
| quantite | `roll` | cible | 0 |
| test | `difficulty,skill` | historique | 99 |
| test | `char,difficulty` | historique | 3 |
| test | `characteristic,difficulty` | historique | 9 |
| ouverture | `pitch,titre` | cible | 0 |
| ouverture | `pitch,titre+…` | cible | 2 |
| cloture | `titre,when` | cible | 0 |
| cloture | `titre,when+…` | cible | 2 |
| narratif | `affaires,indices,objets,presetsPnj` | cible | 2 |
| narratif | `affaires,indices,objets,presetsPnj+…` | cible | 2 |
| condition | `expr,kind` | cible | 38 |

## 3. Concepts transverses (lexique FERMÉ)

Statuts : **cible** = forme visée, rien à migrer (liste FIGÉE au stock `STRUCTURES_CIBLES`) ·
**historique** = graphie connue à éteindre par un lot L1-L5 · **declaree** = forme volontairement
conservée · **divergente** = graphie inconnue du lexique.

Lignes concept × dataset × champ × forme : **881** (cible 404 · declaree 6 · historique 131 · divergente 340). Objets JSON parcourus : **50169**, dont **32580** portent une forme
mesurée. Champs porteurs de référence MESURÉS : **91**.

Entrées de racine sans concept de valeur : **4145** sur **4232** —
un document n’est ni orphelin ni hors strate : ce compte est le seul porteur de ce qu’aucun concept ne revendique.
Dont, NOMMÉES, celles qu’un concept de valeur revendiquerait sans la clause `horsDesignation` du lexique : `activities.json` 52.

### 3.1 référence à une entité — `reference` (strate Référence)

495 ligne(s), 25048 occurrence(s).
Reconnu par : RÉSOLUTION vers l’index des ids (cible majoritaire du site), ou GRAPHIE du lexique sous un champ porteur mesuré

| Famille | Champ | Forme | Statut | Dataset | Occurrences | Résolvables | Cibles résolues | Note |
|---|---|---|---|---|---|---|---|---|
| entité | `armed` | `id-nu` | historique | `actions.json` | 3 | — | `actions.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `gate` | `id-nu` | historique | `actions.json` | 2 | — | `regles.json` `systemes.manifest.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `hote` | `id-nu` | historique | `actions.json` | 1 | — | `actions.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `mode` | `id-nu` | historique | `actions.json` | 4 | — | `actions.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `rule` | `id-nu` | historique | `actions.json` | 32 | — | `actions.json` `characteristics.json` `etats.json` `psychology.json` `qualities.json` `regles.json` … | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `cible` | `rule` | divergente | `activities.json` | 1 | — | `reglesOptionnelles.json` |  |
| entité | `factor` | `rule` | divergente | `activities.json` | 1 | — | `reglesOptionnelles.json` |  |
| entité | `mod` | `rule` | divergente | `activities.json` | 2 | — | `reglesOptionnelles.json` |  |
| entité | `ops` | `id+…` | divergente | `activities.json` | 1 | — | `etats.json` |  |
| entité | `ops` | `tableId+…` | divergente | `activities.json` | 16 | — | `tables.json` |  |
| entité | `rule` | `id-nu` | historique | `activities.json` | 1 | — | `regles.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `skills` | `id` | cible | `activities.json` | 52 | — | `activities.json` `axes.json` `creatures.json` `crew-test-types.json` `drunkenness.json` `maladies.json` … |  |
| entité | `skills` | `id+…` | divergente | `activities.json` | 1 | — | `skills.json` |  |
| entité | `skills` | `id,spec` | cible | `activities.json` | 10 | — | `axes.json` `careers.json` `obsessions.json` `skills.json` `systemes.manifest.json` `talents.json` … |  |
| entité | `skills` | `id,spec+…` | divergente | `activities.json` | 1 | — | `skills.json` |  |
| config | `cancelsTraitId` | `id-nu` | historique | `arcane-phenomena.json` | 1 | — | `traits.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `domainId` | `id-nu` | historique | `arcane-phenomena.json` | 8 | — | `breath-types.json` `damage-types.json` `domains.json` `groups.json` `land-cargo.json` `obsessions.json` … | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `fluxTableId` | `id-nu` | historique | `arcane-phenomena.json` | 1 | — | `arcane-phenomena.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `tableId` | `id-nu` | historique | `arcane-phenomena.json` | 2 | — | `arcane-phenomena.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `a` | `id-nu` | historique | `arene-projet.json` | 4 | — | `arene-projet.json` `talents.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `acts` | `act+…` | divergente | `arene-projet.json` | 1 | — | `regles.json` |  |
| config | `ambush` | `encounter,scene` | divergente | `arene-projet.json` | 4 | — | `arene-projet.json` |  |
| config | `appearance` | `id-nu` | historique | `arene-projet.json` | 2 | — | `arene-projet.json` `buildings.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `appearance` | `species` | divergente | `arene-projet.json` | 3 | — | `creatures.json` |  |
| config | `appearance` | `species,tenue` | divergente | `arene-projet.json` | 5 | — | `careers.json` `creatures.json` `obsessions.json` `skills.json` `species.json` `talents.json` |  |
| config | `appearance` | `species,tenue+…` | divergente | `arene-projet.json` | 12 | — | `careers.json` `creatures.json` `groups.json` `obsessions.json` `skills.json` `species.json` … |  |
| config | `appearance` | `tenue` | divergente | `arene-projet.json` | 1 | — | `careers.json` `talents.json` |  |
| config | `appearance` | `tenue+…` | divergente | `arene-projet.json` | 2 | — | `careers.json` `talents.json` |  |
| config | `b` | `id-nu` | historique | `arene-projet.json` | 4 | — | `arene-projet.json` `talents.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `choices` | `next+…` | divergente | `arene-projet.json` | 14 | — | `arene-projet.json` |  |
| config | `dialogueId` | `id-nu` | historique | `arene-projet.json` | 9 | — | `arene-projet.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `effect` | `dialogue,speakerId,type` | divergente | `arene-projet.json` | 1 | — | `arene-projet.json` |  |
| config | `effect` | `encounter,type` | divergente | `arene-projet.json` | 20 | — | `arene-projet.json` |  |
| config | `effect` | `entityId,type` | divergente | `arene-projet.json` | 4 | — | `arene-projet.json` `careers.json` `creatures.json` `lieux-services.json` `merchants.json` `skills.json` … |  |
| config | `effect` | `entityId,type+…` | divergente | `arene-projet.json` | 2 | — | `arene-projet.json` `careers.json` `creatures.json` `merchants.json` |  |
| config | `effect` | `scene,type` | divergente | `arene-projet.json` | 13 | — | `arene-projet.json` |  |
| config | `effect` | `scene,type+…` | divergente | `arene-projet.json` | 13 | — | `arene-projet.json` |  |
| config | `effect` | `spell,type` | divergente | `arene-projet.json` | 1 | — | `spells.json` |  |
| config | `effect` | `trappingId,type` | divergente | `arene-projet.json` | 16 | — | `spells.json` `trappings.json` `weaponGroups.json` |  |
| config | `effect` | `trappingId,type+…` | divergente | `arene-projet.json` | 2 | — | `trappings.json` |  |
| config | `material` | `id-nu` | historique | `arene-projet.json` | 9 | — | `materials.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `members` | `entityId` | divergente | `arene-projet.json` | 110 | — | `arene-projet.json` |  |
| config | `members` | `entityId+…` | divergente | `arene-projet.json` | 4 | — | `arene-projet.json` |  |
| config | `members` | `entityId,ridesEntityId` | divergente | `arene-projet.json` | 2 | — | `arene-projet.json` |  |
| config | `merchant` | `archetype` | divergente | `arene-projet.json` | 4 | — | `arene-projet.json` `careers.json` `creatures.json` `loup-et-saumure-projet.json` `merchants.json` `skills.json` … |  |
| config | `optionals` | `arg,id` | historique | `arene-projet.json` | 1 | — | `skills.json` `talents.json` `traits.json` | paramètre d’entité non déclaré (#1463 S2 A11) |
| config | `optionals` | `id` | cible | `arene-projet.json` | 7 | — | `obsessions.json` `psychology.json` `talents.json` `traits.json` |  |
| config | `optionals` | `id,value` | historique | `arene-projet.json` | 5 | — | `qualitySubtypes.json` `traits.json` | charge utile `value` à plat sur une référence dont le porteur n’est PAS un statbloc (Indice d’Atout, paramètre d’entité) — #1463 S2 |
| config | `ref` | `id-nu` | historique | `arene-projet.json` | 421 | — | `arene-projet.json` `careers.json` `creatures.json` `groups.json` `merchants.json` `montures.json` … | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `reliefDefaults` | `cliff,deck,pilier,ramp` | divergente | `arene-projet.json` | 18 | — | `materials.json` `terrains.json` |  |
| config | `roofDefaults` | `material+…` | divergente | `arene-projet.json` | 18 | — | `materials.json` |  |
| config | `scene` | `id-nu` | historique | `arene-projet.json` | 4 | — | `arene-projet.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `skill` | `id` | cible | `arene-projet.json` | 10 | — | `activities.json` `axes.json` `creatures.json` `drunkenness.json` `maladies.json` `river-navigation.json` … |  |
| config | `start` | `id-nu` | historique | `arene-projet.json` | 9 | — | `arene-projet.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `traits` | `arg,id` | historique | `arene-projet.json` | 3 | — | `qualities.json` `ship-construction.json` `traits.json` | paramètre d’entité non déclaré (#1463 S2 A11) |
| config | `traits` | `arg,id,value` | historique | `arene-projet.json` | 1 | — | `spells.json` `traits.json` |  |
| config | `traits` | `id` | cible | `arene-projet.json` | 3 | — | `spells.json` `traits.json` |  |
| config | `traits` | `id,value` | historique | `arene-projet.json` | 4 | — | `maneuvers.json` `psychology.json` `qualitySubtypes.json` `traits.json` | charge utile `value` à plat sur une référence dont le porteur n’est PAS un statbloc (Indice d’Atout, paramètre d’entité) — #1463 S2 |
| config | `walls` | `structure+…` | divergente | `arene-projet.json` | 235 | — | `mass-battle.json` `structureAppearance.json` `structures.json` |  |
| config | `weapon` | `id-nu` | historique | `arene-projet.json` | 6 | — | `trappings.json` `weaponGroups.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `skills` | `id` | cible | `axes.json` | 11 | — | `axes.json` `creatures.json` `skills.json` |  |
| entité | `skills` | `id,spec` | cible | `axes.json` | 4 | — | `axes.json` `careers.json` `skills.json` `talents.json` `weaponGroups.json` |  |
| entité | `talents` | `spec,talentId` | divergente | `axes.json` | 1 | — | `careers.json` `skills.json` `talents.json` |  |
| entité | `talents` | `talentId` | historique | `axes.json` | 3 | — | `talents.json` |  |
| config | `a` | `id-nu` | historique | `barge-du-sel-projet.json` | 1 | — | `barge-du-sel-projet.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `ambush` | `encounter,scene+…` | divergente | `barge-du-sel-projet.json` | 1 | — | `barge-du-sel-projet.json` |  |
| config | `ammo` | `kind,subType,trappingId+…` | divergente | `barge-du-sel-projet.json` | 8 | — | `merchantFamilies.json` `trappings.json` `weaponGroups.json` |  |
| config | `appearance` | `species,tenue` | divergente | `barge-du-sel-projet.json` | 4 | — | `careers.json` `species.json` |  |
| config | `b` | `id-nu` | historique | `barge-du-sel-projet.json` | 1 | — | `barge-du-sel-projet.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `crew` | `count,roleId` | divergente | `barge-du-sel-projet.json` | 1 | — | `crew-roles.json` |  |
| config | `effect` | `type,vehicleId+…` | divergente | `barge-du-sel-projet.json` | 1 | — | `vehicles.json` |  |
| config | `members` | `entityId+…` | divergente | `barge-du-sel-projet.json` | 7 | — | `barge-du-sel-projet.json` `loup-et-saumure-projet.json` `sea-events.json` |  |
| config | `postes` | `trappingId+…` | divergente | `barge-du-sel-projet.json` | 6 | — | `trappings.json` |  |
| config | `qualities` | `id` | cible | `barge-du-sel-projet.json` | 7 | — | `qualities.json` |  |
| config | `qualities` | `id,value` | historique | `barge-du-sel-projet.json` | 8 | — | `qualities.json` | charge utile `value` à plat sur une référence dont le porteur n’est PAS un statbloc (Indice d’Atout, paramètre d’entité) — #1463 S2 |
| config | `ref` | `id-nu` | historique | `barge-du-sel-projet.json` | 6 | — | `creatures.json` `loup-et-saumure-projet.json` `props.json` `skills.json` `trappings.json` `vehicles.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `reliefDefaults` | `cliff,deck,pilier,ramp` | divergente | `barge-du-sel-projet.json` | 3 | — | `materials.json` `terrains.json` |  |
| config | `roofDefaults` | `material+…` | divergente | `barge-du-sel-projet.json` | 3 | — | `materials.json` |  |
| config | `scene` | `id-nu` | historique | `barge-du-sel-projet.json` | 2 | — | `barge-du-sel-projet.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `skills` | `id,spec,value` | cible | `barge-du-sel-projet.json` | 2 | — | `skills.json` `weaponGroups.json` | idem, spécialisation DÉSIGNÉE |
| config | `skills` | `id,value` | cible | `barge-du-sel-projet.json` | 4 | — | `skills.json` | réf de Compétence de STATBLOC + son nombre imprimé (`refOuSpec('skill', {value})`) |
| config | `victoryCondition` | `targetId,type+…` | divergente | `barge-du-sel-projet.json` | 1 | — | `barge-du-sel-projet.json` `sea-events.json` |  |
| entité | `features` | `id+…` | divergente | `buildings.json` | 4 | — | `props.json` |  |
| entité | `roofMaterial` | `id-nu` | historique | `buildings.json` | 7 | — | `materials.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `career` | `id-nu` | historique | `careerLevels.json` | 432 | — | `arene-projet.json` `careers.json` `creatures.json` `crew-roles.json` `groups.json` `interludeEvents.json` … | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `choice` | `choice>id` | historique | `careerLevels.json` | 25 | — | `qualities.json` `spells.json` `trappings.json` |  |
| entité | `choice` | `choice>id,qualityChoice` | historique | `careerLevels.json` | 2 | — | `trappings.json` |  |
| entité | `choice` | `choice>id,spec` | historique | `careerLevels.json` | 2 | — | `trappings.json` |  |
| entité | `of` | `id` | cible | `careerLevels.json` | 2 | — | `talents.json` |  |
| entité | `of` | `id,spec` | cible | `careerLevels.json` | 9 | — | `activities.json` `arene-projet.json` `breath-types.json` `careers.json` `damage-types.json` `lieux-services.json` … |  |
| entité | `skills` | `choix,id` | cible | `careerLevels.json` | 171 | — | `activities.json` `axes.json` `creatures.json` `skills.json` `talents.json` | choix borné / libre (DESIGN v2 S2) |
| entité | `skills` | `id` | cible | `careerLevels.json` | 1382 | — | `activities.json` `crew-test-types.json` `drunkenness.json` `maladies.json` `river-navigation.json` `sea-cargo.json` … |  |
| entité | `skills` | `id,spec` | cible | `careerLevels.json` | 684 | — | `activities.json` `axes.json` `breath-types.json` `careers.json` `creatures.json` `crew-roles.json` … |  |
| entité | `talents` | `choix,id` | cible | `careerLevels.json` | 66 | — | `activities.json` `careers.json` `maladies.json` `psychology.json` `skills.json` `talents.json` … | choix borné / libre (DESIGN v2 S2) |
| entité | `talents` | `id` | cible | `careerLevels.json` | 1493 | — | `actions.json` `careers.json` `crew-roles.json` `groups.json` `naval-traits.json` `psychology.json` … |  |
| entité | `talents` | `id,spec` | cible | `careerLevels.json` | 165 | — | `activities.json` `axes.json` `breath-types.json` `careers.json` `creatures.json` `damage-types.json` … |  |
| entité | `trappings` | `choice` | historique | `careerLevels.json` | 14 | — | — |  |
| entité | `trappings` | `count,id` | historique | `careerLevels.json` | 23 | — | `spells.json` `trappings.json` |  |
| entité | `trappings` | `count,id,qualityChoice` | divergente | `careerLevels.json` | 1 | — | `trappings.json` |  |
| entité | `trappings` | `count,vehicleId+…` | divergente | `careerLevels.json` | 1 | — | `structures.json` `vehicles.json` |  |
| entité | `trappings` | `creatureId` | historique | `careerLevels.json` | 54 | — | `creatures.json` `montures.json` `skills.json` |  |
| entité | `trappings` | `creatureId+…` | divergente | `careerLevels.json` | 5 | — | `creatures.json` `montures.json` `skills.json` |  |
| entité | `trappings` | `id` | cible | `careerLevels.json` | 555 | — | `lightTones.json` `mass-battle.json` `props.json` `qualities.json` `skills.json` `spells.json` … |  |
| entité | `trappings` | `id,qualityChoice` | historique | `careerLevels.json` | 36 | — | `trappings.json` `weaponGroups.json` |  |
| entité | `trappings` | `id,spec` | cible | `careerLevels.json` | 32 | — | `trappings.json` |  |
| entité | `trappings` | `text` | declaree | `careerLevels.json` | 532 | — | — | dotation narrative — occurrence de référence seulement quand le texte normalisé résout vers un `label` (#1463, #624) |
| entité | `trappings` | `vehicleId` | historique | `careerLevels.json` | 15 | — | `diligence-projet.json` `props.json` `structures.json` `vehicles.json` |  |
| entité | `trappings` | `vehicleId+…` | divergente | `careerLevels.json` | 11 | — | `arene-projet.json` `props.json` `skills.json` `structures.json` `vehicles.json` |  |
| entité | `trappings` | `wildcard` | historique | `careerLevels.json` | 7 | — | `maneuvers.json` `qualitySubtypes.json` `traits.json` |  |
| entité | `class` | `id-nu` | historique | `careers.json` | 108 | — | `classes.json` `talents.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `tenue` | `id-nu` | historique | `careers.json` | 15 | — | `arene-projet.json` `careers.json` `creatures.json` `groups.json` `skills.json` `talents.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `trappings` | `count,id` | historique | `classes.json` | 2 | — | `trappings.json` |  |
| entité | `trappings` | `id` | cible | `classes.json` | 49 | — | `props.json` `trappings.json` |  |
| entité | `trappings` | `id,spec` | cible | `classes.json` | 2 | — | `trappings.json` |  |
| entité | `trappings` | `text` | declaree | `classes.json` | 3 | — | — | dotation narrative — occurrence de référence seulement quand le texte normalisé résout vers un `label` (#1463, #624) |
| entité | `entryCategory` | `id-nu` | historique | `combat-stakes.json` | 1 | — | `skills.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `kind` | `id-nu` | historique | `combat-stakes.json` | 7 | — | `combat-stakes.json` `spells.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `rule` | `id-nu` | historique | `combat-stakes.json` | 25 | — | `etats.json` `qualities.json` `regles.json` `sea-cargo.json` `skills.json` `spells.json` … | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `appearance` | `species` | divergente | `creatures.json` | 227 | — | `creatures.json` `groups.json` `montures.json` `names.json` `raceAppearance.json` `skills.json` … |  |
| entité | `appearance` | `species+…` | divergente | `creatures.json` | 52 | — | `creatures.json` `groups.json` `montures.json` `names.json` `raceAppearance.json` `skills.json` … |  |
| entité | `appearance` | `species,tenue` | divergente | `creatures.json` | 107 | — | `arene-projet.json` `careers.json` `creatures.json` `groups.json` `interludeEvents.json` `merchants.json` … |  |
| entité | `appearance` | `species,tenue+…` | divergente | `creatures.json` | 70 | — | `arene-projet.json` `careers.json` `creatures.json` `groups.json` `names.json` `raceAppearance.json` … |  |
| entité | `grant` | `char,value` | divergente | `creatures.json` | 5 | — | `characteristics.json` |  |
| entité | `monster` | `tete` | divergente | `creatures.json` | 1 | — | `creatures.json` `montures.json` `skills.json` |  |
| entité | `optionals` | `arg,id` | historique | `creatures.json` | 133 | — | `activities.json` `breath-types.json` `characteristics.json` `creatures.json` `damage-types.json` `domains.json` … | paramètre d’entité non déclaré (#1463 S2 A11) |
| entité | `optionals` | `arg,id,value` | historique | `creatures.json` | 6 | — | `breath-types.json` `damage-types.json` `maneuvers.json` `skills.json` `spells.json` `talents.json` … |  |
| entité | `optionals` | `arg,id,value+…` | divergente | `creatures.json` | 1 | — | `qualities.json` `traits.json` `trappings.json` |  |
| entité | `optionals` | `count,id,value` | divergente | `creatures.json` | 2 | — | `maneuvers.json` `traits.json` |  |
| entité | `optionals` | `id` | cible | `creatures.json` | 474 | — | `damage-types.json` `groups.json` `lightTones.json` `maneuvers.json` `mass-battle.json` `obsessions.json` … |  |
| entité | `optionals` | `id+…` | divergente | `creatures.json` | 1 | — | `talents.json` `traits.json` |  |
| entité | `optionals` | `id,value` | historique | `creatures.json` | 23 | — | `activities.json` `maneuvers.json` `mass-battle.json` `psychology.json` `qualitySubtypes.json` `spells.json` … | charge utile `value` à plat sur une référence dont le porteur n’est PAS un statbloc (Indice d’Atout, paramètre d’entité) — #1463 S2 |
| entité | `optionals` | `id,value+…` | divergente | `creatures.json` | 7 | — | `traits.json` |  |
| entité | `optionals` | `size+…` | divergente | `creatures.json` | 2 | — | `ship-construction.json` |  |
| entité | `skills` | `choix,id,value` | cible | `creatures.json` | 59 | — | `axes.json` `creatures.json` `skills.json` `talents.json` | idem, spécialisation À CHOISIR (libre ou bornée) — désignée au spawn |
| entité | `skills` | `id,spec,value` | cible | `creatures.json` | 1368 | — | `activities.json` `arene-projet.json` `axes.json` `careers.json` `creatures.json` `domains.json` … | idem, spécialisation DÉSIGNÉE |
| entité | `skills` | `id,value` | cible | `creatures.json` | 4554 | — | `activities.json` `axes.json` `creatures.json` `crew-test-types.json` `drunkenness.json` `maladies.json` … | réf de Compétence de STATBLOC + son nombre imprimé (`refOuSpec('skill', {value})`) |
| entité | `spec` | `id-nu` | historique | `creatures.json` | 1 | — | `skills.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `spells` | `id` | cible | `creatures.json` | 599 | — | `activities.json` `axes.json` `domains.json` `lightTones.json` `mass-battle.json` `mutations.json` … |  |
| entité | `talents` | `id` | cible | `creatures.json` | 1455 | — | `actions.json` `careers.json` `crew-roles.json` `groups.json` `naval-traits.json` `psychology.json` … |  |
| entité | `talents` | `id,spec` | cible | `creatures.json` | 221 | — | `activities.json` `arene-projet.json` `axes.json` `careers.json` `classes.json` `creatures.json` … |  |
| entité | `talents` | `id,times` | historique | `creatures.json` | 48 | — | `careers.json` `naval-traits.json` `spells.json` `talents.json` |  |
| entité | `traits` | `arg,id` | historique | `creatures.json` | 408 | — | `breath-types.json` `careers.json` `characteristics.json` `creatures.json` `damage-types.json` `domains.json` … | paramètre d’entité non déclaré (#1463 S2 A11) |
| entité | `traits` | `arg,id+…` | divergente | `creatures.json` | 1 | — | `maneuvers.json` `mutations.json` `qualitySubtypes.json` `traits.json` |  |
| entité | `traits` | `arg,id,value` | historique | `creatures.json` | 118 | — | `breath-types.json` `damage-types.json` `domains.json` `maneuvers.json` `merchantFamilies.json` `obsessions.json` … |  |
| entité | `traits` | `arg,id,value+…` | divergente | `creatures.json` | 43 | — | `maneuvers.json` `qualities.json` `qualitySubtypes.json` `traits.json` `trappings.json` `weaponGroups.json` |  |
| entité | `traits` | `count,id,value` | divergente | `creatures.json` | 3 | — | `maneuvers.json` `traits.json` |  |
| entité | `traits` | `id` | cible | `creatures.json` | 1559 | — | `creatures.json` `damage-types.json` `groups.json` `lightTones.json` `maneuvers.json` `names.json` … |  |
| entité | `traits` | `id,value` | historique | `creatures.json` | 914 | — | `activities.json` `maneuvers.json` `mass-battle.json` `props.json` `psychology.json` `qualitySubtypes.json` … | charge utile `value` à plat sur une référence dont le porteur n’est PAS un statbloc (Indice d’Atout, paramètre d’entité) — #1463 S2 |
| entité | `traits` | `id,value+…` | divergente | `creatures.json` | 3 | — | `maneuvers.json` `qualitySubtypes.json` `traits.json` |  |
| entité | `trappings` | `count,id` | historique | `creatures.json` | 1 | — | `trappings.json` |  |
| entité | `trappings` | `creatureId` | historique | `creatures.json` | 1 | — | `creatures.json` |  |
| entité | `trappings` | `id` | cible | `creatures.json` | 88 | — | `props.json` `qualities.json` `spells.json` `trappings.json` `weaponGroups.json` |  |
| entité | `trappings` | `text` | declaree | `creatures.json` | 42 | — | — | dotation narrative — occurrence de référence seulement quand le texte normalisé résout vers un `label` (#1463, #624) |
| entité | `skills` | `id` | cible | `crew-roles.json` | 7 | — | `crew-test-types.json` `skills.json` |  |
| entité | `skills` | `id,spec` | cible | `crew-roles.json` | 3 | — | `crew-roles.json` `skills.json` `talents.json` `weaponGroups.json` |  |
| config | `essential` | `id-nu` | historique | `crew-test-types.json` | 10 | — | `careers.json` `crew-roles.json` `river-criticals.json` `skills.json` `talents.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `rule` | `id-nu` | historique | `crew-test-types.json` | 10 | — | `regles.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `apresDelai` | `versTraumaId+…` | divergente | `criticals.json` | 2 | — | `traumas.json` |  |
| entité | `onHealGrant` | `scar+…` | divergente | `criticals.json` | 2 | — | `traumas.json` |  |
| entité | `onNextCritWhileCondition` | `whileCondition+…` | divergente | `criticals.json` | 1 | — | `etats.json` |  |
| entité | `ops` | `char+…` | divergente | `criticals.json` | 8 | — | `characteristics.json` |  |
| entité | `ops` | `disease+…` | divergente | `criticals.json` | 2 | — | `maladies.json` |  |
| entité | `ops` | `id,value+…` | divergente | `criticals.json` | 205 | — | `etats.json` `water-exposure.json` |  |
| entité | `perRound` | `versTraumaId` | divergente | `criticals.json` | 2 | — | `traumas.json` |  |
| entité | `recoveryPenalty` | `char+…` | divergente | `criticals.json` | 4 | — | `characteristics.json` |  |
| entité | `skill` | `id` | cible | `criticals.json` | 39 | — | `activities.json` `maladies.json` `skills.json` `talents.json` `water-exposure.json` |  |
| entité | `subject` | `condition+…` | divergente | `criticals.json` | 1 | — | `etats.json` |  |
| config | `cheminDeRonde` | `id-nu` | historique | `defauts-de-compilation.json` | 1 | — | `materials.json` `terrains.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `masse` | `id-nu` | historique | `defauts-de-compilation.json` | 1 | — | `terrains.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `pont` | `id-nu` | historique | `defauts-de-compilation.json` | 1 | — | `terrains.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `a` | `id-nu` | historique | `diligence-projet.json` | 1 | — | `diligence-projet.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `b` | `id-nu` | historique | `diligence-projet.json` | 1 | — | `diligence-projet.json` `locations.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `ref` | `id-nu` | historique | `diligence-projet.json` | 20 | — | `props.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `reliefDefaults` | `cliff,deck,pilier,ramp` | divergente | `diligence-projet.json` | 2 | — | `materials.json` `terrains.json` |  |
| config | `roofDefaults` | `material+…` | divergente | `diligence-projet.json` | 2 | — | `materials.json` |  |
| config | `scene` | `id-nu` | historique | `diligence-projet.json` | 2 | — | `diligence-projet.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `style` | `id-nu` | historique | `diligence-projet.json` | 1 | — | `buildings.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `walls` | `appearance,structure+…` | divergente | `diligence-projet.json` | 6 | — | `structureAppearance.json` `structures.json` |  |
| config | `walls` | `structure+…` | divergente | `diligence-projet.json` | 662 | — | `mass-battle.json` `structureAppearance.json` `structures.json` |  |
| entité | `amount` | `bonusOf` | divergente | `domains.json` | 3 | — | `characteristics.json` |  |
| entité | `castBonus` | `perCondition+…` | divergente | `domains.json` | 1 | — | `etats.json` |  |
| entité | `casterOps` | `traitId+…` | divergente | `domains.json` | 1 | — | `mass-battle.json` `psychology.json` `traits.json` |  |
| entité | `of` | `spec,value+…` | divergente | `domains.json` | 3 | — | `breath-types.json` `damage-types.json` `domains.json` `obsessions.json` `spells.json` `talents.json` |  |
| entité | `of` | `value+…` | divergente | `domains.json` | 14 | — | `groups.json` `raceAppearance.json` `skills.json` `traits.json` |  |
| entité | `ops` | `bypassArmour+…` | divergente | `domains.json` | 1 | — | `domains.json` `land-cargo.json` |  |
| entité | `ops` | `id+…` | divergente | `domains.json` | 3 | — | `etats.json` |  |
| entité | `ops` | `id,value+…` | divergente | `domains.json` | 2 | — | `etats.json` |  |
| entité | `requiresSkill` | `id,spec` | cible | `domains.json` | 2 | — | `domains.json` `skills.json` `spells.json` |  |
| entité | `skill` | `id,spec` | cible | `domains.json` | 2 | — | `skills.json` `talents.json` |  |
| entité | `subject` | `condition+…` | divergente | `domains.json` | 1 | — | `etats.json` |  |
| entité | `tables` | `arcaneMark` | divergente | `domains.json` | 8 | — | `tables.json` |  |
| config | `ops` | `cible,psychType+…` | divergente | `drunkenness.json` | 1 | — | `groups.json` `psychology.json` `talents.json` `traits.json` |  |
| entité | `ops` | `id+…` | divergente | `etats.json` | 9 | — | `activities.json` `etats.json` |  |
| entité | `ops` | `id,value+…` | divergente | `etats.json` | 5 | — | `etats.json` |  |
| entité | `passive` | `mode+…` | divergente | `etats.json` | 5 | — | `axes.json` `merchantFamilies.json` |  |
| entité | `skill` | `id` | cible | `etats.json` | 4 | — | `activities.json` `drunkenness.json` `maladies.json` `river-navigation.json` `skills.json` `talents.json` … |  |
| entité | `subject` | `condition+…` | divergente | `etats.json` | 10 | — | `etats.json` |  |
| entité | `value` | `char+…` | divergente | `etats.json` | 2 | — | `characteristics.json` |  |
| entité | `flow` | `id-nu` | historique | `flow-stakes.json` | 16 | — | `actions.json` `characteristics.json` `systemes.manifest.json` `talents.json` `traits.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `phase` | `id-nu` | historique | `flow-stakes.json` | 6 | — | `etats.json` `merchantFamilies.json` `night-stakes.json` `regles.json` `skills.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `rule` | `id-nu` | historique | `flow-stakes.json` | 33 | — | `actions.json` `characteristics.json` `etats.json` `psychology.json` `qualities.json` `regles.json` … | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `blessings` | `id` | cible | `gods.json` | 90 | — | `spells.json` |  |
| entité | `chaosSpells` | `id` | cible | `gods.json` | 17 | — | `spells.json` |  |
| entité | `miracles` | `id` | cible | `gods.json` | 96 | — | `maladies.json` `sea-events.json` `skills.json` `spells.json` |  |
| config | `amount` | `bonusOf` | divergente | `grapple.json` | 1 | — | `characteristics.json` |  |
| config | `entangle` | `id,value+…` | divergente | `grapple.json` | 1 | — | `etats.json` |  |
| config | `free` | `id,value+…` | divergente | `grapple.json` | 1 | — | `etats.json` |  |
| config | `init` | `id,value+…` | divergente | `grapple.json` | 1 | — | `etats.json` |  |
| config | `skill` | `id` | cible | `incidents-monture.json` | 2 | — | `skills.json` |  |
| entité | `backdrop` | `id-nu` | historique | `lieux-services.json` | 2 | — | `arene-projet.json` `buildings.json` `lieux-services.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `merchantArchetype` | `id-nu` | historique | `lieux-services.json` | 1 | — | `loup-et-saumure-projet.json` `merchants.json` `skills.json` `talents.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `parent` | `id-nu` | historique | `locations.json` | 46 | — | `locations.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `a` | `id-nu` | historique | `loup-et-saumure-projet.json` | 2 | — | `books.json` `loup-et-saumure-projet.json` `naval-ports.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `ambush` | `encounter,scene` | divergente | `loup-et-saumure-projet.json` | 2 | — | `loup-et-saumure-projet.json` |  |
| config | `ammo` | `kind,subType,trappingId+…` | divergente | `loup-et-saumure-projet.json` | 16 | — | `merchantFamilies.json` `trappings.json` `weaponGroups.json` |  |
| config | `appearance` | `species,tenue` | divergente | `loup-et-saumure-projet.json` | 4 | — | `careers.json` `species.json` |  |
| config | `appearance` | `species,tenue+…` | divergente | `loup-et-saumure-projet.json` | 15 | — | `careers.json` `groups.json` `skills.json` `species.json` `talents.json` |  |
| config | `b` | `id-nu` | historique | `loup-et-saumure-projet.json` | 2 | — | `loup-et-saumure-projet.json` `naval-ports.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `backdrop` | `id-nu` | historique | `loup-et-saumure-projet.json` | 2 | — | `lieux-services.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `choices` | `next+…` | divergente | `loup-et-saumure-projet.json` | 23 | — | `loup-et-saumure-projet.json` |  |
| config | `crew` | `count,roleId` | divergente | `loup-et-saumure-projet.json` | 6 | — | `careers.json` `crew-roles.json` `skills.json` `talents.json` |  |
| config | `dialogueId` | `id-nu` | historique | `loup-et-saumure-projet.json` | 8 | — | `loup-et-saumure-projet.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `effect` | `factorId,type` | divergente | `loup-et-saumure-projet.json` | 4 | — | `sea-events.json` |  |
| config | `effect` | `scene,type+…` | divergente | `loup-et-saumure-projet.json` | 1 | — | `loup-et-saumure-projet.json` |  |
| config | `effect` | `type,vehicleId+…` | divergente | `loup-et-saumure-projet.json` | 1 | — | `vehicles.json` |  |
| config | `from` | `id-nu` | historique | `loup-et-saumure-projet.json` | 2 | — | `books.json` `loup-et-saumure-projet.json` `naval-ports.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `members` | `entityId+…` | divergente | `loup-et-saumure-projet.json` | 18 | — | `barge-du-sel-projet.json` `loup-et-saumure-projet.json` `skills.json` `vehicles.json` |  |
| config | `merchant` | `archetype` | divergente | `loup-et-saumure-projet.json` | 3 | — | `arene-projet.json` `loup-et-saumure-projet.json` `merchants.json` `skills.json` `talents.json` |  |
| config | `port` | `ref` | historique | `loup-et-saumure-projet.json` | 2 | — | `books.json` `loup-et-saumure-projet.json` `naval-ports.json` | ref emboîtée {ref:{id,spec}} ou id nu sous `ref` |
| config | `postes` | `trappingId+…` | divergente | `loup-et-saumure-projet.json` | 12 | — | `trappings.json` |  |
| config | `qualities` | `id` | cible | `loup-et-saumure-projet.json` | 14 | — | `qualities.json` |  |
| config | `qualities` | `id,value` | historique | `loup-et-saumure-projet.json` | 16 | — | `qualities.json` | charge utile `value` à plat sur une référence dont le porteur n’est PAS un statbloc (Indice d’Atout, paramètre d’entité) — #1463 S2 |
| config | `ref` | `id-nu` | historique | `loup-et-saumure-projet.json` | 23 | — | `creatures.json` `groups.json` `loup-et-saumure-projet.json` `names.json` `props.json` `raceAppearance.json` … | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `reliefDefaults` | `cliff,deck,pilier,ramp` | divergente | `loup-et-saumure-projet.json` | 5 | — | `materials.json` `terrains.json` |  |
| config | `roofDefaults` | `material+…` | divergente | `loup-et-saumure-projet.json` | 5 | — | `materials.json` |  |
| config | `scene` | `id-nu` | historique | `loup-et-saumure-projet.json` | 2 | — | `loup-et-saumure-projet.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `serviceKind` | `id-nu` | historique | `loup-et-saumure-projet.json` | 8 | — | `arene-projet.json` `lieux-services.json` `skills.json` `talents.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `services` | `kind` | divergente | `loup-et-saumure-projet.json` | 6 | — | `arene-projet.json` `lieux-services.json` `skills.json` `talents.json` |  |
| config | `skill` | `id` | cible | `loup-et-saumure-projet.json` | 2 | — | `skills.json` |  |
| config | `skill` | `id,spec` | cible | `loup-et-saumure-projet.json` | 1 | — | `loup-et-saumure-projet.json` `skills.json` `talents.json` |  |
| config | `skills` | `id,spec,value` | cible | `loup-et-saumure-projet.json` | 4 | — | `skills.json` `weaponGroups.json` | idem, spécialisation DÉSIGNÉE |
| config | `skills` | `id,value` | cible | `loup-et-saumure-projet.json` | 8 | — | `skills.json` | réf de Compétence de STATBLOC + son nombre imprimé (`refOuSpec('skill', {value})`) |
| config | `start` | `id-nu` | historique | `loup-et-saumure-projet.json` | 8 | — | `loup-et-saumure-projet.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `victoryCondition` | `targetId,type+…` | divergente | `loup-et-saumure-projet.json` | 2 | — | `loup-et-saumure-projet.json` `skills.json` `vehicles.json` |  |
| config | `weapon` | `id-nu` | historique | `loup-et-saumure-projet.json` | 1 | — | `trappings.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `dailyTest` | `symptomId+…` | divergente | `maladies.json` | 1 | — | `symptoms.json` |  |
| entité | `mutation` | `into+…` | divergente | `maladies.json` | 1 | — | `maladies.json` |  |
| entité | `ops` | `disease,symptomId+…` | divergente | `maladies.json` | 1 | — | `maladies.json` `symptoms.json` |  |
| entité | `otherwise` | `disease,symptomId+…` | divergente | `maladies.json` | 1 | — | `maladies.json` `symptoms.json` |  |
| entité | `symptoms` | `spec,symptomId` | divergente | `maladies.json` | 1 | — | `symptoms.json` |  |
| entité | `symptoms` | `symptomId` | divergente | `maladies.json` | 47 | — | `maladies.json` `spells.json` `symptoms.json` |  |
| entité | `symptoms` | `symptomId+…` | divergente | `maladies.json` | 14 | — | `symptoms.json` |  |
| entité | `escapeStrength` | `charOf` | divergente | `maneuvers.json` | 2 | — | `characteristics.json` |  |
| entité | `ops` | `id+…` | divergente | `maneuvers.json` | 9 | — | `etats.json` |  |
| entité | `ops` | `id,unlessCondition+…` | divergente | `maneuvers.json` | 2 | — | `etats.json` |  |
| entité | `ops` | `id,value+…` | divergente | `maneuvers.json` | 4 | — | `etats.json` |  |
| entité | `ops` | `morphRef+…` | divergente | `maneuvers.json` | 1 | — | `creatures.json` |  |
| entité | `ops` | `traitId+…` | divergente | `maneuvers.json` | 6 | — | `maneuvers.json` `mass-battle.json` `psychology.json` `qualitySubtypes.json` `talents.json` `traits.json` |  |
| entité | `skill` | `id` | cible | `maneuvers.json` | 2 | — | `activities.json` `drunkenness.json` `maladies.json` `river-navigation.json` `skills.json` `talents.json` … |  |
| entité | `match` | `categorie` | divergente | `merchantFamilies.json` | 3 | — | `axes.json` `merchantFamilies.json` |  |
| entité | `onFail` | `id,value+…` | divergente | `miscast.json` | 11 | — | `etats.json` |  |
| entité | `onFail` | `op+…` | divergente | `miscast.json` | 4 | — | `characteristics.json` `systemes.manifest.json` `talents.json` `traits.json` |  |
| entité | `ops` | `id+…` | divergente | `miscast.json` | 3 | — | `etats.json` `water-exposure.json` |  |
| entité | `ops` | `id,unlessCondition,value+…` | divergente | `miscast.json` | 1 | — | `etats.json` `water-exposure.json` |  |
| entité | `ops` | `id,value+…` | divergente | `miscast.json` | 31 | — | `activities.json` `etats.json` `water-exposure.json` |  |
| entité | `ops` | `op+…` | divergente | `miscast.json` | 4 | — | `characteristics.json` `systemes.manifest.json` `talents.json` `traits.json` |  |
| entité | `skill` | `id` | cible | `miscast.json` | 26 | — | `activities.json` `drunkenness.json` `maladies.json` `river-navigation.json` `skills.json` `talents.json` … |  |
| entité | `eyes` | `G` | divergente | `mutations.json` | 1 | — | `ship-construction.json` |  |
| entité | `ops` | `argFrom,traitId+…` | divergente | `mutations.json` | 1 | — | `obsessions.json` `psychology.json` `talents.json` `traits.json` |  |
| entité | `ops` | `traitId+…` | divergente | `mutations.json` | 1 | — | `psychology.json` `talents.json` `traits.json` |  |
| entité | `passive` | `arg,traitId+…` | divergente | `mutations.json` | 5 | — | `breath-types.json` `damage-types.json` `domains.json` `groups.json` `maneuvers.json` `obsessions.json` … |  |
| entité | `passive` | `argFrom,traitId+…` | divergente | `mutations.json` | 2 | — | `obsessions.json` `psychology.json` `talents.json` `traits.json` |  |
| entité | `passive` | `char+…` | divergente | `mutations.json` | 56 | — | `characteristics.json` |  |
| entité | `passive` | `psychType+…` | divergente | `mutations.json` | 1 | — | `psychology.json` `talents.json` `traits.json` |  |
| entité | `passive` | `spec,talentId+…` | divergente | `mutations.json` | 5 | — | `talents.json` |  |
| entité | `passive` | `talentId+…` | divergente | `mutations.json` | 2 | — | `careers.json` `talents.json` |  |
| entité | `passive` | `traitId+…` | divergente | `mutations.json` | 35 | — | `maneuvers.json` `mass-battle.json` `psychology.json` `qualities.json` `spells.json` `talents.json` … |  |
| entité | `skill` | `id` | cible | `mutations.json` | 2 | — | `skills.json` |  |
| entité | `passive` | `testType+…` | divergente | `naval-traits.json` | 2 | — | `crew-test-types.json` |  |
| entité | `skill` | `id` | cible | `naval-traits.json` | 3 | — | `crew-test-types.json` `skills.json` |  |
| entité | `kind` | `id-nu` | historique | `night-stakes.json` | 9 | — | `night-stakes.json` `voyage-stakes.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `rule` | `id-nu` | historique | `night-stakes.json` | 15 | — | `regles.json` `skills.json` `symptoms.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `career` | `id-nu` | historique | `pregens.json` | 8 | — | `careers.json` `creatures.json` `groups.json` `skills.json` `talents.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `species` | `id-nu` | historique | `pregens.json` | 8 | — | `obsessions.json` `skills.json` `species.json` `talents.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `light` | `tone+…` | divergente | `props.json` | 6 | — | `lightTones.json` `spells.json` `trappings.json` |  |
| entité | `primitives` | `material+…` | divergente | `props.json` | 379 | — | `materials.json` |  |
| entité | `becomes` | `id-nu` | historique | `psychology.json` | 1 | — | `mass-battle.json` `psychology.json` `traits.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `failCondition` | `id-nu` | historique | `psychology.json` | 1 | — | `etats.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `ops` | `id+…` | divergente | `psychology.json` | 1 | — | `etats.json` |  |
| entité | `ops` | `type+…` | divergente | `psychology.json` | 1 | — | `psychology.json` `talents.json` `traits.json` |  |
| entité | `skill` | `id` | cible | `psychology.json` | 7 | — | `drunkenness.json` `river-navigation.json` `skills.json` |  |
| entité | `subject` | `condition+…` | divergente | `psychology.json` | 2 | — | `etats.json` `water-exposure.json` |  |
| entité | `targetCauses` | `kind+…` | divergente | `psychology.json` | 1 | — | `mass-battle.json` `psychology.json` `traits.json` |  |
| entité | `escapeStrength` | `charOf` | divergente | `qualities.json` | 1 | — | `characteristics.json` |  |
| entité | `opposed` | `attackerSkill+…` | divergente | `qualities.json` | 1 | — | `skills.json` |  |
| entité | `ops` | `disease+…` | divergente | `qualities.json` | 1 | — | `maladies.json` |  |
| entité | `ops` | `id+…` | divergente | `qualities.json` | 6 | — | `activities.json` `etats.json` |  |
| entité | `ops` | `id,unlessCondition,value+…` | divergente | `qualities.json` | 4 | — | `etats.json` |  |
| entité | `passive` | `char+…` | divergente | `qualities.json` | 1 | — | `characteristics.json` |  |
| entité | `skill` | `id` | cible | `qualities.json` | 2 | — | `activities.json` `maladies.json` `skills.json` `talents.json` `water-exposure.json` |  |
| entité | `gabarit` | `id-nu` | historique | `raceAppearance.json` | 6 | — | `creatures.json` `groups.json` `names.json` `raceAppearance.json` `sea-perils.json` `ship-construction.json` … | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `head` | `id-nu` | historique | `raceAppearance.json` | 7 | — | `creatures.json` `groups.json` `names.json` `raceAppearance.json` `species.json` `traits.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `tenue` | `id-nu` | historique | `raceAppearance.json` | 14 | — | `careers.json` `creatures.json` `groups.json` `names.json` `raceAppearance.json` `species.json` … | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `default` | `id-nu` | historique | `reglesOptionnelles.json` | 1 | — | `naval-progression.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `ops` | `id,value+…` | divergente | `river-criticals.json` | 5 | — | `etats.json` `ship-criticals.json` |  |
| config | `escalation` | `vents+…` | divergente | `sea-events.json` | 1 | — | `sea-weather.json` |  |
| config | `params` | `bribeDifficulty+…` | divergente | `sea-events.json` | 1 | — | `sea-events.json` |  |
| config | `params` | `chefRef,crewRef,ship+…` | divergente | `sea-events.json` | 1 | — | `creatures.json` `loup-et-saumure-projet.json` `skills.json` `vehicles.json` |  |
| config | `params` | `crewRef,ship+…` | divergente | `sea-events.json` | 1 | — | `creatures.json` `vehicles.json` |  |
| config | `params` | `precipitations,temperature,vents,visibilite+…` | divergente | `sea-events.json` | 1 | — | `sea-weather.json` |  |
| config | `params` | `precipitations,vents,visibilite+…` | divergente | `sea-events.json` | 1 | — | `sea-weather.json` |  |
| config | `params` | `precipitations,visibilite+…` | divergente | `sea-events.json` | 2 | — | `sea-weather.json` |  |
| config | `params` | `talent+…` | divergente | `sea-events.json` | 1 | — | `talents.json` |  |
| config | `params` | `temperature+…` | divergente | `sea-events.json` | 1 | — | `sea-weather.json` |  |
| entité | `captainOps` | `char+…` | divergente | `sea-shanties.json` | 1 | — | `characteristics.json` |  |
| entité | `crewOps` | `char+…` | divergente | `sea-shanties.json` | 1 | — | `characteristics.json` |  |
| entité | `skill` | `id` | cible | `sea-shanties.json` | 3 | — | `crew-test-types.json` `drunkenness.json` `river-navigation.json` `skills.json` |  |
| config | `spec` | `projectiles` | divergente | `sea-weather.json` | 3 | — | `weaponGroups.json` |  |
| config | `reliefDefaults` | `cliff,deck,pilier,ramp` | divergente | `semences-de-scene.json` | 1 | — | `materials.json` `terrains.json` |  |
| config | `roofDefaults` | `material+…` | divergente | `semences-de-scene.json` | 1 | — | `materials.json` |  |
| config | `terrain` | `id-nu` | historique | `semences-de-scene.json` | 1 | — | `terrains.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `constructionTraits` | `id+…` | divergente | `ship-construction.json` | 4 | — | `barge-du-sel-projet.json` `naval-traits.json` `qualities.json` `talents.json` |  |
| config | `ops` | `id,value+…` | divergente | `ship-criticals.json` | 11 | — | `etats.json` |  |
| config | `skill` | `id` | cible | `ship-criticals.json` | 12 | — | `skills.json` |  |
| entité | `requiresTrait` | `id` | cible | `ship-stations.json` | 2 | — | `naval-traits.json` `ship-stations.json` |  |
| entité | `altChar` | `gatedByRule+…` | divergente | `skills.json` | 2 | — | `reglesOptionnelles.json` |  |
| entité | `chars` | `FM,Int+…` | divergente | `skills.json` | 1 | — | `characteristics.json` |  |
| entité | `chars` | `true` | divergente | `skills.json` | 1 | — | `characteristics.json` |  |
| entité | `gatedByRule` | `id-nu` | historique | `species.json` | 1 | — | `reglesOptionnelles.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `of` | `choix,id` | cible | `species.json` | 5 | — | `skills.json` `talents.json` | choix borné / libre (DESIGN v2 S2) |
| entité | `of` | `id` | cible | `species.json` | 67 | — | `groups.json` `regles.json` `river-navigation.json` `talents.json` |  |
| entité | `of` | `id,spec` | cible | `species.json` | 6 | — | `crew-roles.json` `skills.json` `talents.json` |  |
| entité | `of` | `random` | historique | `species.json` | 2 | — | — |  |
| entité | `previewCareer` | `id` | cible | `species.json` | 27 | — | `careers.json` `creatures.json` `groups.json` `interludeEvents.json` `skills.json` `talents.json` |  |
| entité | `profilStandard` | `id` | cible | `species.json` | 26 | — | `creatures.json` `groups.json` `names.json` `raceAppearance.json` `skills.json` `species.json` … |  |
| entité | `skills` | `choix,id` | cible | `species.json` | 34 | — | `axes.json` `creatures.json` `skills.json` | choix borné / libre (DESIGN v2 S2) |
| entité | `skills` | `id` | cible | `species.json` | 171 | — | `activities.json` `crew-test-types.json` `drunkenness.json` `maladies.json` `river-navigation.json` `sea-cargo.json` … |  |
| entité | `skills` | `id,spec` | cible | `species.json` | 110 | — | `axes.json` `books.json` `creatures.json` `crew-roles.json` `domains.json` `gods.json` … |  |
| entité | `talents` | `id` | cible | `species.json` | 43 | — | `talents.json` `traits.json` |  |
| entité | `talents` | `id,spec` | cible | `species.json` | 34 | — | `activities.json` `characteristics.json` `maladies.json` `skills.json` `systemes.manifest.json` `talents.json` … |  |
| entité | `talents` | `random` | historique | `species.json` | 19 | — | — |  |
| config | `default` | `id-nu` | historique | `speciesRace.json` | 1 | — | `creatures.json` `groups.json` `names.json` `raceAppearance.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `rules` | `race+…` | divergente | `speciesRace.json` | 22 | — | `creatures.json` `groups.json` `names.json` `raceAppearance.json` `skills.json` `species.json` … |  |
| entité | `addTraits` | `id` | cible | `spells.json` | 4 | — | `damage-types.json` `lightTones.json` `psychology.json` `qualities.json` `spells.json` `talents.json` … |  |
| entité | `addTraits` | `id,value` | historique | `spells.json` | 1 | — | `mass-battle.json` `psychology.json` `traits.json` | charge utile `value` à plat sur une référence dont le porteur n’est PAS un statbloc (Indice d’Atout, paramètre d’entité) — #1463 S2 |
| entité | `cond` | `is+…` | divergente | `spells.json` | 3 | — | `gods.json` `groups.json` `skills.json` |  |
| entité | `domainId` | `id-nu` | historique | `spells.json` | 256 | — | `breath-types.json` `damage-types.json` `domains.json` `groups.json` `land-cargo.json` `obsessions.json` … | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `of` | `spec,value+…` | divergente | `spells.json` | 3 | — | `domains.json` `spells.json` `talents.json` |  |
| entité | `of` | `value+…` | divergente | `spells.json` | 5 | — | `groups.json` `skills.json` `traits.json` |  |
| entité | `onCross` | `id+…` | divergente | `spells.json` | 4 | — | `etats.json` |  |
| entité | `ops` | `arg,traitId+…` | divergente | `spells.json` | 3 | — | `groups.json` `psychology.json` `raceAppearance.json` `skills.json` `talents.json` `traits.json` |  |
| entité | `ops` | `count,ref+…` | divergente | `spells.json` | 14 | — | `creatures.json` `raceAppearance.json` `skills.json` |  |
| entité | `ops` | `count,ref,size+…` | divergente | `spells.json` | 1 | — | `creatures.json` `ship-construction.json` `skills.json` |  |
| entité | `ops` | `disease+…` | divergente | `spells.json` | 1 | — | `maladies.json` `spells.json` |  |
| entité | `ops` | `form,subType+…` | divergente | `spells.json` | 2 | — | `trappings.json` `weaponGroups.json` |  |
| entité | `ops` | `id+…` | divergente | `spells.json` | 68 | — | `etats.json` `water-exposure.json` |  |
| entité | `ops` | `id,onlyIfCondition+…` | divergente | `spells.json` | 1 | — | `etats.json` `water-exposure.json` |  |
| entité | `ops` | `id,unlessCondition+…` | divergente | `spells.json` | 1 | — | `etats.json` |  |
| entité | `ops` | `id,value+…` | divergente | `spells.json` | 25 | — | `etats.json` |  |
| entité | `ops` | `op` | divergente | `spells.json` | 1 | — | `spells.json` |  |
| entité | `ops` | `op+…` | divergente | `spells.json` | 17 | — | `actions.json` `characteristics.json` `systemes.manifest.json` `talents.json` `traits.json` |  |
| entité | `ops` | `psychType+…` | divergente | `spells.json` | 3 | — | `psychology.json` `talents.json` `traits.json` |  |
| entité | `ops` | `ref+…` | divergente | `spells.json` | 2 | — | `creatures.json` `skills.json` |  |
| entité | `ops` | `removeType+…` | divergente | `spells.json` | 1 | — | `qualityTypes.json` |  |
| entité | `ops` | `requiresWeapon+…` | divergente | `spells.json` | 1 | — | `trappings.json` |  |
| entité | `ops` | `spec,talentId+…` | divergente | `spells.json` | 6 | — | `activities.json` `breath-types.json` `damage-types.json` `maladies.json` `obsessions.json` `skills.json` … |  |
| entité | `ops` | `tableId+…` | divergente | `spells.json` | 4 | — | `tables.json` |  |
| entité | `ops` | `talentId+…` | divergente | `spells.json` | 15 | — | `talents.json` `traits.json` |  |
| entité | `ops` | `tone+…` | divergente | `spells.json` | 2 | — | `damage-types.json` `lightTones.json` `qualities.json` `traits.json` |  |
| entité | `ops` | `traitId+…` | divergente | `spells.json` | 35 | — | `activities.json` `damage-types.json` `lightTones.json` `mass-battle.json` `psychology.json` `qualities.json` … |  |
| entité | `ops` | `trappingId+…` | divergente | `spells.json` | 3 | — | `trappings.json` |  |
| entité | `perRound` | `id+…` | divergente | `spells.json` | 3 | — | `etats.json` |  |
| entité | `perRound` | `id,unlessCondition+…` | divergente | `spells.json` | 1 | — | `etats.json` |  |
| entité | `perRound` | `op+…` | divergente | `spells.json` | 2 | — | `actions.json` |  |
| entité | `skill` | `id` | cible | `spells.json` | 47 | — | `activities.json` `axes.json` `crew-test-types.json` `drunkenness.json` `maladies.json` `river-navigation.json` … |  |
| entité | `skill` | `id,spec` | cible | `spells.json` | 3 | — | `arene-projet.json` `lieux-services.json` `loup-et-saumure-projet.json` `merchants.json` `skills.json` `talents.json` |  |
| entité | `subject` | `condition+…` | divergente | `spells.json` | 1 | — | `etats.json` |  |
| entité | `when` | `rule` | divergente | `spells.json` | 18 | — | `reglesOptionnelles.json` |  |
| entité | `ascendant` | `id-nu` | historique | `stars.json` | 11 | — | `weather.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `ops` | `char+…` | divergente | `stars.json` | 42 | — | `characteristics.json` |  |
| entité | `ops` | `spec,talentId+…` | divergente | `stars.json` | 2 | — | `activities.json` `maladies.json` `obsessions.json` `skills.json` `talents.json` `traits.json` … |  |
| entité | `ops` | `talentId+…` | divergente | `stars.json` | 11 | — | `careers.json` `talents.json` |  |
| table | `skill` | `id,spec` | cible | `steam-breakdown.json` | 4 | — | `careers.json` `skills.json` `talents.json` |  |
| entité | `traits` | `id` | cible | `structures.json` | 5 | — | `traits.json` |  |
| entité | `grave` | `id+…` | divergente | `symptoms.json` | 1 | — | `etats.json` `water-exposure.json` |  |
| entité | `minutes` | `rule` | divergente | `symptoms.json` | 1 | — | `reglesOptionnelles.json` |  |
| entité | `moderee` | `char+…` | divergente | `symptoms.json` | 6 | — | `characteristics.json` |  |
| entité | `ops` | `char+…` | divergente | `symptoms.json` | 4 | — | `characteristics.json` |  |
| entité | `ops` | `disease+…` | divergente | `symptoms.json` | 1 | — | `maladies.json` |  |
| entité | `ops` | `id+…` | divergente | `symptoms.json` | 4 | — | `etats.json` `water-exposure.json` |  |
| entité | `ops` | `traitId+…` | divergente | `symptoms.json` | 3 | — | `traits.json` |  |
| entité | `passive` | `char+…` | divergente | `symptoms.json` | 23 | — | `characteristics.json` |  |
| entité | `passive` | `cible,psychType+…` | divergente | `symptoms.json` | 1 | — | `groups.json` `psychology.json` `talents.json` `traits.json` |  |
| entité | `passive` | `id+…` | divergente | `symptoms.json` | 1 | — | `etats.json` |  |
| entité | `passive` | `psychType+…` | divergente | `symptoms.json` | 1 | — | `psychology.json` `talents.json` `traits.json` |  |
| entité | `skill` | `id` | cible | `symptoms.json` | 2 | — | `activities.json` `maladies.json` `skills.json` `talents.json` `water-exposure.json` |  |
| entité | `visiblePassive` | `char+…` | divergente | `symptoms.json` | 1 | — | `characteristics.json` |  |
| entité | `of` | `rule` | divergente | `tables.json` | 1 | — | `reglesOptionnelles.json` |  |
| entité | `ops` | `arg,traitId+…` | divergente | `tables.json` | 7 | — | `maneuvers.json` `obsessions.json` `spells.json` `talents.json` `traits.json` |  |
| entité | `ops` | `char+…` | divergente | `tables.json` | 15 | — | `characteristics.json` |  |
| entité | `ops` | `cible,psychType+…` | divergente | `tables.json` | 1 | — | `groups.json` `psychology.json` `traits.json` |  |
| entité | `ops` | `disease+…` | divergente | `tables.json` | 5 | — | `maladies.json` |  |
| entité | `ops` | `id+…` | divergente | `tables.json` | 1 | — | `etats.json` |  |
| entité | `ops` | `id,value+…` | divergente | `tables.json` | 2 | — | `etats.json` |  |
| entité | `ops` | `table+…` | divergente | `tables.json` | 4 | — | `mutationTables.json` |  |
| entité | `ops` | `tableId+…` | divergente | `tables.json` | 1 | — | `tables.json` |  |
| entité | `ops` | `talentId+…` | divergente | `tables.json` | 12 | — | `talents.json` `traits.json` |  |
| entité | `ops` | `tone+…` | divergente | `tables.json` | 1 | — | `damage-types.json` `lightTones.json` `qualities.json` `traits.json` |  |
| entité | `ops` | `traitId+…` | divergente | `tables.json` | 30 | — | `damage-types.json` `lightTones.json` `maneuvers.json` `mass-battle.json` `psychology.json` `qualities.json` … |  |
| entité | `skill` | `id` | cible | `tables.json` | 14 | — | `activities.json` `axes.json` `creatures.json` `drunkenness.json` `river-navigation.json` `skills.json` |  |
| entité | `skill` | `id,spec` | cible | `tables.json` | 1 | — | `skills.json` `talents.json` |  |
| entité | `effects` | `condition+…` | divergente | `talents.json` | 1 | — | `etats.json` |  |
| entité | `gate` | `value+…` | divergente | `talents.json` | 1 | — | `psychology.json` `talents.json` `traits.json` |  |
| entité | `matches` | `exceptSpec,skill` | divergente | `talents.json` | 1 | — | `skills.json` `talents.json` |  |
| entité | `ops` | `id+…` | divergente | `talents.json` | 1 | — | `etats.json` |  |
| entité | `ops` | `id,value+…` | divergente | `talents.json` | 1 | — | `etats.json` |  |
| entité | `ops` | `type+…` | divergente | `talents.json` | 1 | — | `psychology.json` `talents.json` `traits.json` |  |
| entité | `passive` | `talentId+…` | divergente | `talents.json` | 1 | — | `psychology.json` `talents.json` `traits.json` |  |
| entité | `skill` | `choix,id` | cible | `talents.json` | 2 | — | `skills.json` `talents.json` | choix borné / libre (DESIGN v2 S2) |
| entité | `skill` | `id` | cible | `talents.json` | 100 | — | `activities.json` `axes.json` `creatures.json` `crew-test-types.json` `drunkenness.json` `maladies.json` … |  |
| entité | `skill` | `id,spec` | cible | `talents.json` | 21 | — | `axes.json` `careers.json` `creatures.json` `skills.json` `talents.json` `weaponGroups.json` |  |
| entité | `skills` | `id` | cible | `talents.json` | 7 | — | `skills.json` |  |
| entité | `skills` | `id,spec` | cible | `talents.json` | 2 | — | `axes.json` `careers.json` `creatures.json` `skills.json` `talents.json` |  |
| entité | `when` | `rule` | divergente | `talents.json` | 12 | — | `reglesOptionnelles.json` |  |
| entité | `attrition` | `id,value+…` | divergente | `tavernGames.json` | 1 | — | `etats.json` |  |
| entité | `combined` | `stopCondition+…` | divergente | `tavernGames.json` | 1 | — | `etats.json` `water-exposure.json` |  |
| entité | `skill` | `id` | cible | `tavernGames.json` | 6 | — | `skills.json` |  |
| entité | `skill` | `id,spec` | cible | `tavernGames.json` | 8 | — | `axes.json` `skills.json` `talents.json` `weaponGroups.json` |  |
| entité | `matiere` | `id-nu` | historique | `terrains.json` | 1 | — | `materials.json` `terrains.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `overlayProp` | `id-nu` | historique | `terrains.json` | 1 | — | `props.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `amount` | `bonusOf` | divergente | `traits.json` | 1 | — | `characteristics.json` |  |
| entité | `bonus` | `bonusOf` | divergente | `traits.json` | 3 | — | `characteristics.json` |  |
| entité | `capabilities` | `psychCible+…` | divergente | `traits.json` | 2 | — | `gods.json` `groups.json` `skills.json` |  |
| entité | `capabilities` | `spellDomainImmunity` | divergente | `traits.json` | 1 | — | `domains.json` `groups.json` |  |
| entité | `cond` | `is+…` | divergente | `traits.json` | 3 | — | `maneuvers.json` `traits.json` |  |
| entité | `escapeStrength` | `charOf` | divergente | `traits.json` | 4 | — | `characteristics.json` |  |
| entité | `grantsManeuvers` | `id` | cible | `traits.json` | 20 | — | `maneuvers.json` `qualitySubtypes.json` `traits.json` |  |
| entité | `markMutations` | `mentalTable,physTable+…` | divergente | `traits.json` | 1 | — | `mutationTables.json` |  |
| entité | `of` | `value+…` | divergente | `traits.json` | 2 | — | `traits.json` |  |
| entité | `ops` | `count,ref+…` | divergente | `traits.json` | 1 | — | `creatures.json` `raceAppearance.json` |  |
| entité | `ops` | `disease+…` | divergente | `traits.json` | 1 | — | `maladies.json` |  |
| entité | `ops` | `id+…` | divergente | `traits.json` | 3 | — | `etats.json` |  |
| entité | `ops` | `id,unlessCondition,value+…` | divergente | `traits.json` | 5 | — | `etats.json` |  |
| entité | `ops` | `id,value+…` | divergente | `traits.json` | 6 | — | `etats.json` `water-exposure.json` |  |
| entité | `ops` | `op+…` | divergente | `traits.json` | 2 | — | `actions.json` |  |
| entité | `ops` | `tableId+…` | divergente | `traits.json` | 1 | — | `tables.json` |  |
| entité | `ops` | `traitId+…` | divergente | `traits.json` | 2 | — | `mass-battle.json` `psychology.json` `qualitySubtypes.json` `traits.json` |  |
| entité | `passive` | `attackKind,subType+…` | divergente | `traits.json` | 1 | — | `maneuvers.json` `traits.json` `weaponGroups.json` |  |
| entité | `passive` | `char+…` | divergente | `traits.json` | 21 | — | `characteristics.json` |  |
| entité | `passive` | `mode+…` | divergente | `traits.json` | 1 | — | `axes.json` `merchantFamilies.json` |  |
| entité | `passive` | `spec,talentId+…` | divergente | `traits.json` | 4 | — | `activities.json` `gods.json` `groups.json` `maladies.json` `obsessions.json` `skills.json` … |  |
| entité | `passive` | `talentId+…` | divergente | `traits.json` | 19 | — | `careers.json` `talents.json` `traits.json` |  |
| entité | `passive` | `terrain+…` | divergente | `traits.json` | 3 | — | `obsessions.json` `terrains.json` |  |
| entité | `skill` | `id` | cible | `traits.json` | 15 | — | `activities.json` `axes.json` `creatures.json` `crew-test-types.json` `maladies.json` `sea-perils.json` … |  |
| entité | `skill` | `id,spec` | cible | `traits.json` | 3 | — | `skills.json` `talents.json` |  |
| entité | `subject` | `condition+…` | divergente | `traits.json` | 6 | — | `activities.json` `etats.json` `water-exposure.json` |  |
| entité | `value` | `bonusOf` | divergente | `traits.json` | 1 | — | `characteristics.json` |  |
| entité | `value` | `charOf` | divergente | `traits.json` | 1 | — | `characteristics.json` |  |
| entité | `cond` | `value+…` | divergente | `trappings.json` | 1 | — | `groups.json` `tavernGames.json` |  |
| entité | `defaultAmmo` | `id-nu` | historique | `trappings.json` | 9 | — | `trappings.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `derivedWeapon` | `subType,type+…` | divergente | `trappings.json` | 1 | — | `weaponGroups.json` |  |
| entité | `ops` | `char+…` | divergente | `trappings.json` | 24 | — | `characteristics.json` |  |
| entité | `ops` | `disease+…` | divergente | `trappings.json` | 3 | — | `maladies.json` |  |
| entité | `ops` | `id+…` | divergente | `trappings.json` | 7 | — | `etats.json` `water-exposure.json` |  |
| entité | `ops` | `id,value+…` | divergente | `trappings.json` | 11 | — | `etats.json` |  |
| entité | `ops` | `op+…` | divergente | `trappings.json` | 2 | — | `actions.json` |  |
| entité | `ops` | `symptomId+…` | divergente | `trappings.json` | 1 | — | `symptoms.json` |  |
| entité | `ops` | `tableId+…` | divergente | `trappings.json` | 1 | — | `tables.json` |  |
| entité | `ops` | `talentId+…` | divergente | `trappings.json` | 1 | — | `psychology.json` `talents.json` `traits.json` |  |
| entité | `ops` | `traitId+…` | divergente | `trappings.json` | 3 | — | `spells.json` `traits.json` |  |
| entité | `passive` | `tone+…` | divergente | `trappings.json` | 4 | — | `lightTones.json` `trappings.json` |  |
| entité | `qualities` | `id` | cible | `trappings.json` | 318 | — | `damage-types.json` `lightTones.json` `mass-battle.json` `naval-traits.json` `props.json` `qualities.json` … |  |
| entité | `qualities` | `id,value` | historique | `trappings.json` | 120 | — | `qualities.json` | charge utile `value` à plat sur une référence dont le porteur n’est PAS un statbloc (Indice d’Atout, paramètre d’entité) — #1463 S2 |
| entité | `shape` | `id-nu` | historique | `trappings.json` | 43 | — | `props.json` `qualities.json` `sea-perils.json` `spells.json` `traits.json` `trappings.json` … | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `siegeRig` | `id-nu` | historique | `trappings.json` | 18 | — | `mass-battle.json` `naval-traits.json` `qualities.json` `spells.json` `trappings.json` `weaponGroups.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `skill` | `id` | cible | `trappings.json` | 29 | — | `activities.json` `axes.json` `creatures.json` `crew-test-types.json` `drunkenness.json` `maladies.json` … |  |
| entité | `subType` | `id-nu` | historique | `trappings.json` | 441 | — | `axes.json` `mass-battle.json` `skills.json` `talents.json` `trappings.json` `weaponGroups.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `subject` | `condition+…` | divergente | `trappings.json` | 2 | — | `etats.json` |  |
| entité | `weaponGroup` | `id-nu` | historique | `trappings.json` | 22 | — | `axes.json` `skills.json` `talents.json` `trappings.json` `weaponGroups.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `byProsthesis` | `art,trappingId` | divergente | `traumas.json` | 1 | — | `trappings.json` |  |
| entité | `byProsthesis` | `trappingId+…` | divergente | `traumas.json` | 2 | — | `trappings.json` |  |
| entité | `escalade` | `versTraumaId+…` | divergente | `traumas.json` | 3 | — | `traumas.json` |  |
| entité | `ops` | `char+…` | divergente | `traumas.json` | 12 | — | `characteristics.json` |  |
| entité | `ops` | `sense+…` | divergente | `traumas.json` | 2 | — | `talents.json` |  |
| entité | `ops` | `sense,skill+…` | divergente | `traumas.json` | 2 | — | `talents.json` |  |
| entité | `prosthesis` | `trappingId+…` | divergente | `traumas.json` | 9 | — | `trappings.json` |  |
| entité | `rig` | `art+…` | divergente | `traumas.json` | 2 | — | `traumas.json` |  |
| entité | `skill` | `id` | cible | `traumas.json` | 13 | — | `crew-test-types.json` `skills.json` |  |
| entité | `draft` | `count,montureId` | divergente | `vehicles.json` | 1 | — | `creatures.json` `montures.json` |  |
| entité | `traits` | `id` | cible | `vehicles.json` | 18 | — | `barge-du-sel-projet.json` `mass-battle.json` `naval-traits.json` `qualities.json` `ship-stations.json` `spells.json` … |  |
| entité | `traits` | `id,value` | historique | `vehicles.json` | 2 | — | `barge-du-sel-projet.json` `naval-traits.json` `qualities.json` | charge utile `value` à plat sur une référence dont le porteur n’est PAS un statbloc (Indice d’Atout, paramètre d’entité) — #1463 S2 |
| entité | `kind` | `id-nu` | historique | `voyage-stakes.json` | 15 | — | `crew-test-types.json` `night-stakes.json` `regles.json` `sea-perils.json` `skills.json` `spells.json` … | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| entité | `rule` | `id-nu` | historique | `voyage-stakes.json` | 32 | — | `axes.json` `creatures.json` `etats.json` `regles.json` `sea-perils.json` `skills.json` | référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence |
| config | `auto` | `condition+…` | divergente | `water-exposure.json` | 4 | — | `etats.json` `water-exposure.json` |  |
| entité | `qualities` | `id` | cible | `weaponGroups.json` | 5 | — | `qualities.json` `ship-construction.json` `traits.json` |  |

### 3.2 liste de références (ids nus) — `refs` (strate Référence)

73 ligne(s), 630 occurrence(s).
Reconnu par : tableau de chaînes dont au moins un élément résout

| Famille | Champ | Forme | Statut | Dataset | Occurrences | Cibles résolues | Note |
|---|---|---|---|---|---|---|---|
| entité | `keys` | `ids-nus` | cible | `actions.json` | 27 | `actions.json` `characteristics.json` `regles.json` `talents.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `chains` | `ids-nus` | cible | `activities.json` | 4 | `actions.json` `activities.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `classes` | `ids-nus` | cible | `activities.json` | 12 | `classes.json` `talents.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `where` | `ids-nus` | cible | `activities.json` | 5 | `diligence-projet.json` `locations.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `domainIds` | `ids-nus` | cible | `arcane-phenomena.json` | 10 | `breath-types.json` `damage-types.json` `domains.json` `groups.json` `land-cargo.json` `obsessions.json` … | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `domains` | `ids-nus` | cible | `arcane-phenomena.json` | 12 | `breath-types.json` `damage-types.json` `domains.json` `groups.json` `land-cargo.json` `obsessions.json` … | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `domainsExcept` | `ids-nus` | cible | `arcane-phenomena.json` | 1 | `breath-types.json` `damage-types.json` `domains.json` `groups.json` `land-cargo.json` `obsessions.json` … | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `environments` | `ids-nus` | cible | `arcane-phenomena.json` | 4 | `arene-projet.json` `talents.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `spellIds` | `ids-nus` | cible | `arcane-phenomena.json` | 1 | `spells.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `modes` | `ids-nus` | cible | `arene-projet.json` | 1 | `diligence-projet.json` `structures.json` `vehicles.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `qualities` | `ids-nus` | cible | `arene-projet.json` | 2 | `damage-types.json` `lightTones.json` `qualities.json` `traits.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `roomZoneIds` | `ids-nus` | cible | `arene-projet.json` | 12 | `arene-projet.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `spells` | `ids-nus` | cible | `arene-projet.json` | 2 | `spells.json` `trappings.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `tiles` | `ids-nus` | cible | `arene-projet.json` | 18 | `land-cargo.json` `mass-battle.json` `materials.json` `obsessions.json` `sea-cargo.json` `structureAppearance.json` … | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `crewIds` | `ids-nus` | cible | `barge-du-sel-projet.json` | 2 | `barge-du-sel-projet.json` `loup-et-saumure-projet.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `tiles` | `ids-nus` | cible | `barge-du-sel-projet.json` | 3 | `obsessions.json` `terrains.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `grantGroups` | `ids-nus` | cible | `careers.json` | 6 | `arene-projet.json` `careers.json` `groups.json` `skills.json` `talents.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `grantGroups` | `ids-nus` | cible | `classes.json` | 1 | `groups.json` `talents.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `features` | `ids-nus` | cible | `creatures.json` | 1 | `mutations.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `grantGroups` | `ids-nus` | cible | `creatures.json` | 90 | `creatures.json` `domains.json` `gods.json` `groups.json` `raceAppearance.json` `skills.json` … | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `remove` | `ids-nus` | cible | `creatures.json` | 3 | `traits.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `roles` | `ids-nus` | cible | `crew-test-types.json` | 10 | `careers.json` `crew-roles.json` `river-criticals.json` `skills.json` `talents.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `sequels` | `ids-nus` | cible | `criticals.json` | 26 | `traumas.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `traumas` | `ids-nus` | cible | `criticals.json` | 48 | `traumas.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `whenClear` | `ids-nus` | cible | `criticals.json` | 2 | `etats.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `modes` | `ids-nus` | cible | `diligence-projet.json` | 1 | `diligence-projet.json` `structures.json` `vehicles.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `roomZoneIds` | `ids-nus` | cible | `diligence-projet.json` | 38 | `diligence-projet.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `tiles` | `ids-nus` | cible | `diligence-projet.json` | 3 | `materials.json` `terrains.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `environments` | `ids-nus` | cible | `domains.json` | 1 | `skills.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `exceptSkills` | `ids-nus` | cible | `etats.json` | 1 | `axes.json` `creatures.json` `skills.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `grantGroups` | `ids-nus` | cible | `gods.json` | 2 | `groups.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `exceptGroups` | `ids-nus` | cible | `groups.json` | 1 | `groups.json` `raceAppearance.json` `skills.json` `traits.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| table | `revenueBlockedClasses` | `ids-nus` | cible | `interludeEvents.json` | 4 | `classes.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| table | `revenueClasses` | `ids-nus` | cible | `interludeEvents.json` | 3 | `classes.json` `talents.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `biens` | `ids-nus` | cible | `land-cargo.json` | 20 | `domains.json` `land-cargo.json` `sea-cargo.json` `terrains.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `rigs` | `ids-nus` | cible | `localisation.json` | 2 | `ship-stations.json` `skills.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `crewIds` | `ids-nus` | cible | `loup-et-saumure-projet.json` | 4 | `barge-du-sel-projet.json` `loup-et-saumure-projet.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `tiles` | `ids-nus` | cible | `loup-et-saumure-projet.json` | 5 | `obsessions.json` `terrains.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `columns` | `ids-nus` | cible | `merchantFamilies.json` | 1 | `activities.json` `spells.json` `traits.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `categories` | `ids-nus` | cible | `merchants.json` | 1 | `axes.json` `merchantFamilies.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `curated` | `ids-nus` | cible | `merchants.json` | 3 | `sea-cargo.json` `trappings.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `subTypes` | `ids-nus` | cible | `merchants.json` | 5 | `weaponGroups.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `creatureIds` | `ids-nus` | cible | `montures.json` | 8 | `creatures.json` `montures.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `features` | `ids-nus` | cible | `mutations.json` | 54 | `mutations.json` `spells.json` `traits.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `production` | `ids-nus` | cible | `naval-ports.json` | 38 | `land-cargo.json` `sea-cargo.json` `systemes.manifest.json` `terrains.json` `trappings.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `livres` | `ids-nus` | cible | `progression-schemas.derived.json` | 1 | `books.json` `skills.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `titresPage` | `ids-nus` | cible | `progression-schemas.derived.json` | 2 | `careers.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `immuneToFromTarget` | `ids-nus` | cible | `psychology.json` | 1 | `mass-battle.json` `psychology.json` `traits.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `immuneWhileActive` | `ids-nus` | cible | `psychology.json` | 1 | `mass-battle.json` `psychology.json` `traits.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `beats` | `ids-nus` | cible | `qualities.json` | 2 | `qualities.json` `ship-construction.json` `traits.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `featureKeys` | `ids-nus` | cible | `raceAppearance.json` | 5 | `mutations.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `options` | `ids-nus` | cible | `reglesOptionnelles.json` | 3 | `gods.json` `groups.json` `naval-progression.json` `sea-events.json` `skills.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `stations` | `ids-nus` | cible | `river-criticals.json` | 3 | `naval-traits.json` `ship-stations.json` `spells.json` `vehicles.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `skills` | `ids-nus` | cible | `sea-events.json` | 1 | `activities.json` `maladies.json` `skills.json` `talents.json` `water-exposure.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `skills` | `ids-nus` | cible | `sea-weather.json` | 5 | `crew-test-types.json` `skills.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `stations` | `ids-nus` | cible | `ship-criticals.json` | 11 | `naval-traits.json` `ship-stations.json` `spells.json` `vehicles.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `max` | `ids-nus` | cible | `skills.json` | 1 | `characteristics.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `grantGroups` | `ids-nus` | cible | `species.json` | 27 | `creatures.json` `groups.json` `names.json` `raceAppearance.json` `skills.json` `species.json` … | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `all` | `ids-nus` | cible | `speciesRace.json` | 1 | `skills.json` `talents.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `any` | `ids-nus` | cible | `speciesRace.json` | 1 | `careers.json` `groups.json` `traits.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `prefix` | `ids-nus` | cible | `speciesRace.json` | 17 | `creatures.json` `groups.json` `names.json` `raceAppearance.json` `skills.json` `species.json` … | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `addQualities` | `ids-nus` | cible | `spells.json` | 8 | `damage-types.json` `lightTones.json` `qualities.json` `traits.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `domains` | `ids-nus` | cible | `spells.json` | 12 | `breath-types.json` `damage-types.json` `domains.json` `groups.json` `land-cargo.json` `obsessions.json` … | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `exceptGroups` | `ids-nus` | cible | `spells.json` | 2 | `groups.json` `raceAppearance.json` `skills.json` `traits.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `onlyGroups` | `ids-nus` | cible | `spells.json` | 7 | `groups.json` `raceAppearance.json` `skills.json` `talents.json` `traits.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `qualities` | `ids-nus` | cible | `spells.json` | 5 | `damage-types.json` `lightTones.json` `qualities.json` `traits.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `affectsGroups` | `ids-nus` | cible | `traits.json` | 2 | `gods.json` `groups.json` `skills.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `grantGroups` | `ids-nus` | cible | `traits.json` | 4 | `gods.json` `groups.json` `raceAppearance.json` `skills.json` `traits.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `suppressesCapabilities` | `ids-nus` | cible | `traits.json` | 1 | `traits.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `diseases` | `ids-nus` | cible | `trappings.json` | 5 | `maladies.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `exceptGroups` | `ids-nus` | cible | `trappings.json` | 1 | `groups.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| entité | `onlyGroups` | `ids-nus` | cible | `trappings.json` | 2 | `groups.json` `skills.json` `traits.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |
| config | `physicalTestChars` | `ids-nus` | cible | `weather.json` | 1 | `characteristics.json` | tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée. |

### 3.3 somme d’argent — `monnaie` (strate Valeur)

14 ligne(s), 518 occurrence(s).
Reconnu par : son noyau `gold` `silver` (≥ 1)

| Famille | Champ | Forme | Statut | Dataset | Occurrences | Cibles résolues | Note |
|---|---|---|---|---|---|---|---|
| entité | `minInvest` | `gold` | cible | `activities.json` | 1 | — |  |
| config | `cost` | `gold` | cible | `arene-projet.json` | 1 | — |  |
| config | `cost` | `silver` | cible | `arene-projet.json` | 7 | — |  |
| config | `montant` | `gold` | cible | `arene-projet.json` | 17 | — |  |
| config | `montant` | `gold,silver` | cible | `arene-projet.json` | 3 | — |  |
| config | `montant` | `silver` | cible | `arene-projet.json` | 16 | — |  |
| config | `montant` | `gold` | cible | `barge-du-sel-projet.json` | 1 | — |  |
| entité | `price` | `brass,gold,silver` | cible | `creatures.json` | 14 | — |  |
| entité | `daily` | `brass,gold,silver` | cible | `crew-roles.json` | 9 | — |  |
| entité | `weekly` | `brass,gold,silver` | cible | `crew-roles.json` | 9 | — |  |
| config | `montant` | `gold` | cible | `loup-et-saumure-projet.json` | 7 | — |  |
| config | `price` | `brass,gold,silver` | cible | `mass-battle.json` | 10 | — |  |
| entité | `price` | `brass,gold,silver` | cible | `trappings.json` | 392 | — |  |
| entité | `price` | `brass,gold,silver` | cible | `vehicles.json` | 31 | — |  |

### 3.4 prix (Money | saisonnier | dé | ND) — `prix` (strate Valeur)

3 ligne(s), 18 occurrence(s).
Reconnu par : la clé porteuse `price`

| Famille | Champ | Forme | Statut | Dataset | Occurrences | Cibles résolues | Note |
|---|---|---|---|---|---|---|---|
| config | `price` | `automne,ete,hiver,printemps` | declaree | `land-cargo.json` | 7 | — | coefficient SAISONNIER — `Price = Money \| {saison} \| {dice} \| "ND"` (DESIGN v2 S4) : ce n’est pas une bourse à éteindre |
| config | `price` | `automne,ete,hiver,printemps` | declaree | `sea-cargo.json` | 10 | — | coefficient SAISONNIER — `Price = Money \| {saison} \| {dice} \| "ND"` (DESIGN v2 S4) : ce n’est pas une bourse à éteindre |
| config | `price` | `dice` | declaree | `sea-cargo.json` | 1 | — | prix TIRÉ (DESIGN v2 S4) |

### 3.5 lancer de dés — `de` (strate Valeur)

19 ligne(s), 140 occurrence(s).
Reconnu par : son noyau `n` `sides`

| Famille | Champ | Forme | Statut | Dataset | Occurrences | Cibles résolues | Note |
|---|---|---|---|---|---|---|---|
| entité | `roll` | `n,sides` | cible | `careerLevels.json` | 5 | — |  |
| entité | `roll` | `n,sides` | cible | `classes.json` | 2 | — |  |
| entité | `dice` | `n,sides` | cible | `criticals.json` | 22 | — |  |
| entité | `dice` | `n,sides` | cible | `domains.json` | 1 | — |  |
| entité | `dice` | `n,sides` | cible | `etats.json` | 1 | — |  |
| entité | `dice` | `n,plus,sides` | cible | `maladies.json` | 12 | — |  |
| entité | `dice` | `n,sides` | cible | `maladies.json` | 25 | — |  |
| entité | `dice` | `n,sides` | cible | `maneuvers.json` | 2 | — |  |
| entité | `dice` | `n,sides` | cible | `miscast.json` | 25 | — |  |
| config | `dice` | `n,sides` | cible | `sea-cargo.json` | 1 | — |  |
| config | `dice` | `n,sides` | cible | `ship-criticals.json` | 3 | — |  |
| entité | `dice` | `n,plus,sides` | cible | `spells.json` | 1 | — |  |
| entité | `dice` | `n,sides` | cible | `spells.json` | 10 | — |  |
| entité | `dice` | `n,sides` | cible | `symptoms.json` | 4 | — |  |
| entité | `dice` | `n,plus,sides` | cible | `tables.json` | 3 | — |  |
| entité | `dice` | `n,sides` | cible | `tables.json` | 2 | — |  |
| entité | `dice` | `n,sides` | cible | `traits.json` | 3 | — |  |
| entité | `dice` | `n,plus,sides` | cible | `trappings.json` | 3 | — |  |
| entité | `dice` | `n,sides` | cible | `trappings.json` | 15 | — |  |

### 3.6 adresse d’un passage du Source (`descRef`) — `adresse` (strate Valeur)

2 ligne(s), 10 occurrence(s).
Reconnu par : son noyau `book` `ch` `parts`

| Famille | Champ | Forme | Statut | Dataset | Occurrences | Cibles résolues | Note |
|---|---|---|---|---|---|---|---|
| entité | `descRef` | `book,ch,parts` | cible | `psychology.json` | 9 | — | livre + chapitre + fragments — `descRefSchema`, épique #1388 §2.2 |
| entité | `descRef` | `book,ch,parts` | cible | `regles.json` | 1 | — | livre + chapitre + fragments — `descRefSchema`, épique #1388 §2.2 |

### 3.7 fragment d’une adresse de prose (suite de blocs, ou cellule de table) — `fragment` (strate Valeur)

2 ligne(s), 10 occurrence(s).
Reconnu par : son noyau `sec` `secOcc` `sum`

| Famille | Champ | Forme | Statut | Dataset | Occurrences | Cibles résolues | Note |
|---|---|---|---|---|---|---|---|
| entité | `parts` | `b0,b1,sec,secOcc,sum+…` | cible | `psychology.json` | 9 | — | suite contiguë `b0..b1` des blocs d’une section (`FragmentBlocs`) |
| entité | `parts` | `b0,b1,sec,secOcc,sum+…` | cible | `regles.json` | 1 | — | suite contiguë `b0..b1` des blocs d’une section (`FragmentBlocs`) |

### 3.8 formule de quantité (Formula, engine/ops.ts) — `formule` (strate Valeur)

7 ligne(s), 25 occurrence(s).
Reconnu par : son noyau `sum` `sinPoints` `minimum` (≥ 1)

| Famille | Champ | Forme | Statut | Dataset | Occurrences | Cibles résolues | Note |
|---|---|---|---|---|---|---|---|
| entité | `durationRounds` | `minimum,of` | cible | `criticals.json` | 2 | — | borne basse d’un terme — « (minimum de 1) », AA 07 l.113 / LDB 18 l.88 |
| entité | `of` | `sum` | cible | `criticals.json` | 2 | — |  |
| entité | `amount` | `sum` | cible | `etats.json` | 1 | — |  |
| entité | `amount` | `sum` | cible | `miscast.json` | 4 | — |  |
| entité | `rounds` | `sum` | cible | `miscast.json` | 3 | — |  |
| entité | `sum` | `sinPoints` | cible | `miscast.json` | 10 | — | terme « (Points de Péché) » — LDB 40 l.58/62/63/65/68/71/72/73/75/77 |
| entité | `value` | `sum` | cible | `miscast.json` | 3 | — |  |

### 3.9 référence de source (livre/folio) — `source` (strate Valeur)

119 ligne(s), 4709 occurrence(s).
Reconnu par : son noyau `book`

| Famille | Champ | Forme | Statut | Dataset | Occurrences | Cibles résolues | Note |
|---|---|---|---|---|---|---|---|
| entité | `source` | `book,note,page` | cible | `actions.json` | 9 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,page` | cible | `actions.json` | 3 | — |  |
| entité | `source` | `book,note,page` | cible | `activities.json` | 2 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,page` | cible | `activities.json` | 61 | — |  |
| table | `source` | `book,note,page` | cible | `advancementCosts.json` | 15 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| config | `source` | `book,page` | cible | `arcane-phenomena.json` | 85 | — |  |
| config | `source` | `book,page` | cible | `artillery-misfire.json` | 1 | — |  |
| entité | `source` | `book,page` | cible | `astrology.json` | 5 | — |  |
| entité | `source` | `book,note,page` | cible | `calendarIntercalary.json` | 6 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,note,page` | cible | `calendarMonths.json` | 12 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,note,page` | cible | `calendarWeekdays.json` | 8 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,page` | cible | `careerLevels.json` | 432 | — |  |
| entité | `source` | `book,note,page` | cible | `careers.json` | 12 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,page` | cible | `careers.json` | 96 | — |  |
| entité | `source` | `book,note,page` | cible | `characteristics.json` | 3 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,page` | cible | `characteristics.json` | 18 | — |  |
| entité | `source` | `book,page` | cible | `classes.json` | 9 | — |  |
| entité | `source` | `book,note,page` | cible | `combat-stakes.json` | 37 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `alsoIn` | `book,page` | cible | `creatures.json` | 3 | — |  |
| entité | `alsoIn` | `book,page+…` | divergente | `creatures.json` | 2 | — |  |
| entité | `source` | `book,note,page` | cible | `creatures.json` | 7 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,page` | cible | `creatures.json` | 486 | — |  |
| config | `source` | `book,note,page` | cible | `crew-morale.json` | 33 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,page` | cible | `crew-roles.json` | 4 | — |  |
| config | `source` | `book,note,page` | cible | `crew-test-types.json` | 10 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,note,page` | cible | `criticals.json` | 168 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| config | `source` | `book,note,page` | cible | `diligence-projet.json` | 2 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| config | `source` | `book,note,page` | cible | `disponibilite.json` | 6 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `alsoIn` | `book,page+…` | divergente | `domains.json` | 6 | — |  |
| entité | `source` | `book,page` | cible | `domains.json` | 43 | — |  |
| config | `source` | `book,note,page` | cible | `driving-mishap.json` | 1 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| config | `source` | `book,note,page` | cible | `drunkenness.json` | 1 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,note,page` | cible | `encumbranceTiers.json` | 4 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,page` | cible | `etats.json` | 21 | — |  |
| entité | `source` | `book,note,page` | cible | `eyes.json` | 10 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,note,page` | cible | `flow-stakes.json` | 34 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,page` | cible | `gods.json` | 41 | — |  |
| config | `source` | `book,note,page` | cible | `grapple.json` | 1 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,note,page` | cible | `hairs.json` | 10 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| config | `source` | `book,page` | cible | `incidents-monture.json` | 1 | — |  |
| table | `source` | `book,note,page` | cible | `interludeEvents.json` | 31 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| config | `source` | `book,note,page` | cible | `land-cargo.json` | 38 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| config | `source` | `book,page` | cible | `localisation.json` | 3 | — |  |
| entité | `source` | `book,page` | cible | `locations.json` | 55 | — |  |
| entité | `source` | `book,note,page` | cible | `maladies.json` | 13 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,page` | cible | `maladies.json` | 5 | — |  |
| entité | `source` | `book,page` | cible | `maneuvers.json` | 20 | — |  |
| config | `source` | `book,note,page` | cible | `mass-battle.json` | 39 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,note,page` | cible | `miscast.json` | 116 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| config | `source` | `book,page` | cible | `montures.json` | 1 | — |  |
| entité | `source` | `book,note,page` | cible | `mutationTables.json` | 17 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,page` | cible | `mutations.json` | 116 | — |  |
| entité | `source` | `book,page` | cible | `naval-ports.json` | 39 | — |  |
| config | `source` | `book,note,page` | cible | `naval-progression.json` | 5 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `alsoIn` | `book,page+…` | divergente | `naval-traits.json` | 1 | — |  |
| entité | `source` | `book,note,page` | cible | `naval-traits.json` | 1 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,page` | cible | `naval-traits.json` | 25 | — |  |
| entité | `source` | `book,note,page` | cible | `night-stakes.json` | 15 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| config | `source` | `book,note,page` | cible | `obsessions.json` | 1 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| table | `source` | `book,note,page` | cible | `oups.json` | 8 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,note,page` | cible | `peripeties.json` | 10 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| config | `source` | `book,page` | cible | `problemes-vehicule.json` | 1 | — |  |
| config | `schemas` | `book,page+…` | divergente | `progression-schemas.derived.json` | 111 | — |  |
| entité | `source` | `book,page` | cible | `psychology.json` | 9 | — |  |
| entité | `alsoIn` | `book,page` | cible | `qualities.json` | 1 | — |  |
| entité | `alsoIn` | `book,page+…` | divergente | `qualities.json` | 1 | — |  |
| entité | `source` | `book,note,page` | cible | `qualities.json` | 2 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,page` | cible | `qualities.json` | 57 | — |  |
| entité | `source` | `book,note,page` | cible | `regles.json` | 86 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,page` | cible | `reglesOptionnelles.json` | 54 | — |  |
| config | `source` | `book,page` | cible | `rencontres-edoc.json` | 1 | — |  |
| entité | `source` | `book,note,page` | cible | `reseau-routier.json` | 15 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| config | `source` | `book,page` | cible | `river-criticals.json` | 1 | — |  |
| config | `source` | `book,note,page` | cible | `river-navigation.json` | 14 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| config | `source` | `book,note,page` | cible | `river-perils.json` | 4 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| config | `source` | `book,note,page` | cible | `sea-cargo.json` | 17 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| config | `source` | `book,note,page` | cible | `sea-events.json` | 91 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| config | `source` | `book,note,page` | cible | `sea-navigation.json` | 47 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| config | `source` | `book,note,page` | cible | `sea-perils.json` | 17 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,page` | cible | `sea-shanties.json` | 7 | — |  |
| config | `source` | `book,note,page` | cible | `sea-weather.json` | 35 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| config | `source` | `book,note,page` | cible | `ship-construction.json` | 23 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| config | `source` | `book,page` | cible | `ship-criticals.json` | 1 | — |  |
| entité | `source` | `book,note,page` | cible | `ship-stations.json` | 5 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `alsoIn` | `book,note,page+…` | divergente | `skills.json` | 2 | — |  |
| entité | `source` | `book,note,page` | cible | `skills.json` | 51 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,page` | cible | `skills.json` | 46 | — |  |
| entité | `alsoIn` | `book,page+…` | divergente | `species.json` | 1 | — |  |
| entité | `source` | `book,note,page` | cible | `species.json` | 5 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,page` | cible | `species.json` | 22 | — |  |
| entité | `alsoIn` | `book,page+…` | divergente | `spells.json` | 46 | — |  |
| entité | `source` | `book,page` | cible | `spells.json` | 594 | — |  |
| entité | `source` | `book,page` | cible | `stars.json` | 23 | — |  |
| table | `source` | `book,note,page` | cible | `steam-breakdown.json` | 6 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| config | `source` | `book,page` | cible | `structure-criticals.json` | 1 | — |  |
| entité | `source` | `book,page` | cible | `structures.json` | 24 | — |  |
| config | `source` | `book,note,page` | cible | `surincantation.json` | 1 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,page` | cible | `symptoms.json` | 18 | — |  |
| entité | `source` | `book,note,page` | cible | `tables.json` | 2 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,page` | cible | `tables.json` | 19 | — |  |
| entité | `alsoIn` | `book,page+…` | divergente | `talents.json` | 1 | — |  |
| entité | `source` | `book,note,page` | cible | `talents.json` | 31 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,page` | cible | `talents.json` | 198 | — |  |
| entité | `source` | `book,page` | cible | `tavernGames.json` | 13 | — |  |
| entité | `alsoIn` | `book,page` | cible | `traits.json` | 3 | — |  |
| entité | `alsoIn` | `book,page+…` | divergente | `traits.json` | 1 | — |  |
| entité | `source` | `book,page` | cible | `traits.json` | 132 | — |  |
| entité | `alsoIn` | `book,page+…` | divergente | `trappings.json` | 8 | — |  |
| entité | `source` | `book,note,page` | cible | `trappings.json` | 1 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,page` | cible | `trappings.json` | 440 | — |  |
| entité | `source` | `book,note,page` | cible | `traumas.json` | 29 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,page` | cible | `vehicles.json` | 31 | — |  |
| config | `source` | `book,note,page` | cible | `vents-tourbillonnants.json` | 1 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,note,page` | cible | `voyage-stakes.json` | 42 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| config | `source` | `book,page` | cible | `water-exposure.json` | 1 | — |  |
| entité | `source` | `book,note,page` | cible | `weaponGroups.json` | 34 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| entité | `source` | `book,page` | cible | `weaponGroups.json` | 4 | — |  |
| config | `physicalTestCharsSource` | `book,note,page` | cible | `weather.json` | 1 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |
| config | `source` | `book,note,page` | cible | `weather.json` | 10 | — | note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`) |

### 3.10 bornes du domaine d’un réglage (min,max) — `bornes` (strate Valeur)

1 ligne(s), 29 occurrence(s).
Reconnu par : son noyau `min` `max`

| Famille | Champ | Forme | Statut | Dataset | Occurrences | Cibles résolues | Note |
|---|---|---|---|---|---|---|---|
| entité | `(racine)` | `max,min+…` | cible | `reglesOptionnelles.json` | 29 | — | les bornes d’un réglage vivent SUR le réglage : la charge utile (`default`, `step`, `hint`…) est inhérente |

### 3.11 plage de tirage (min,max) — `plage` (strate Valeur)

74 ligne(s), 1544 occurrence(s).
Reconnu par : son noyau `min` `max`

| Famille | Champ | Forme | Statut | Dataset | Occurrences | Cibles résolues | Note |
|---|---|---|---|---|---|---|---|
| table | `(racine)` | `max,min+…` | cible | `advancementCosts.json` | 14 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `rows` | `max,min+…` | cible | `arcane-phenomena.json` | 50 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `entries` | `max,min+…` | cible | `artillery-misfire.json` | 4 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `bands` | `max,min+…` | cible | `crew-morale.json` | 4 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| entité | `entries` | `max,min+…` | cible | `criticals.json` | 160 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `entries` | `max,min+…` | cible | `driving-mishap.json` | 4 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `entries` | `max,min+…` | cible | `drunkenness.json` | 5 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `entries` | `max,min+…` | cible | `incidents-monture.json` | 4 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| table | `(racine)` | `max,min+…` | cible | `interludeEvents.json` | 31 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `automne` | `max,min` | cible | `land-cargo.json` | 7 | — |  |
| config | `ete` | `max,min` | cible | `land-cargo.json` | 7 | — |  |
| config | `hiver` | `max,min` | cible | `land-cargo.json` | 7 | — |  |
| config | `offerByRichesse` | `max,min+…` | cible | `land-cargo.json` | 5 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `printemps` | `max,min` | cible | `land-cargo.json` | 7 | — |  |
| config | `rumours` | `max,min+…` | cible | `land-cargo.json` | 20 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `wineQuality` | `max,min+…` | cible | `land-cargo.json` | 6 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `araignee` | `max,min+…` | cible | `localisation.json` | 3 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `entries` | `max,min+…` | cible | `localisation.json` | 11 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `humanoide` | `max,min+…` | cible | `localisation.json` | 6 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `serpent` | `max,min+…` | cible | `localisation.json` | 2 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `hazards` | `max,min+…` | cible | `mass-battle.json` | 10 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| entité | `entries` | `max,min+…` | cible | `miscast.json` | 111 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| entité | `ranges` | `max,min+…` | cible | `mutationTables.json` | 486 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `entries` | `max,min+…` | cible | `naval-progression.json` | 5 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `entries` | `max,min+…` | cible | `obsessions.json` | 19 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| table | `(racine)` | `max,min+…` | cible | `oups.json` | 7 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `entries` | `max,min+…` | cible | `problemes-vehicule.json` | 4 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `dangereuses` | `max,min+…` | cible | `rencontres-edoc.json` | 9 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `fortuites` | `max,min+…` | cible | `rencontres-edoc.json` | 10 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `positives` | `max,min+…` | cible | `rencontres-edoc.json` | 7 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `avirons` | `max,min+…` | cible | `river-criticals.json` | 1 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `coque` | `max,min+…` | cible | `river-criticals.json` | 1 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `gouvernail` | `max,min+…` | cible | `river-criticals.json` | 1 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `greement` | `max,min+…` | cible | `river-criticals.json` | 1 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `superstructure` | `max,min+…` | cible | `river-criticals.json` | 1 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `windDirections` | `max,min+…` | cible | `river-navigation.json` | 3 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `windForces` | `max,min+…` | cible | `river-navigation.json` | 5 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `automne` | `max,min` | cible | `sea-cargo.json` | 11 | — |  |
| config | `ete` | `max,min` | cible | `sea-cargo.json` | 11 | — |  |
| config | `hiver` | `max,min` | cible | `sea-cargo.json` | 11 | — |  |
| config | `offerPrice` | `max,min+…` | cible | `sea-cargo.json` | 3 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `printemps` | `max,min` | cible | `sea-cargo.json` | 11 | — |  |
| config | `boardEvents` | `max,min+…` | cible | `sea-events.json` | 40 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `impressed` | `max,min+…` | cible | `sea-events.json` | 1 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `paliers` | `max,min+…` | cible | `sea-events.json` | 5 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `portEvents` | `max,min+…` | cible | `sea-events.json` | 18 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `wrathful` | `max,min+…` | cible | `sea-events.json` | 1 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `changementDeCap` | `max,min+…` | cible | `sea-navigation.json` | 5 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `drDeltas` | `max,min+…` | cible | `sea-navigation.json` | 4 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `reperes` | `max,min+…` | cible | `sea-navigation.json` | 5 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `table` | `max,min+…` | cible | `sea-navigation.json` | 5 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `voirLaLumiere` | `max,min+…` | cible | `sea-navigation.json` | 3 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `roseDesVents` | `max,min+…` | cible | `sea-weather.json` | 5 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `table` | `max,min+…` | cible | `sea-weather.json` | 10 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `lengthM` | `max,min` | cible | `ship-construction.json` | 6 | — |  |
| config | `avirons` | `max,min+…` | cible | `ship-criticals.json` | 5 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `cargaison` | `max,min+…` | cible | `ship-criticals.json` | 5 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `coque` | `max,min+…` | cible | `ship-criticals.json` | 10 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `equipements` | `max,min+…` | cible | `ship-criticals.json` | 5 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `greement` | `max,min+…` | cible | `ship-criticals.json` | 10 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| entité | `rows` | `max,min+…` | cible | `spells.json` | 13 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| entité | `sub` | `max,min` | cible | `stars.json` | 4 | — |  |
| table | `(racine)` | `max,min+…` | cible | `steam-breakdown.json` | 6 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `entries` | `max,min+…` | cible | `structure-criticals.json` | 8 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| entité | `rows` | `max,min+…` | cible | `symptoms.json` | 8 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| entité | `rows` | `max,min+…` | cible | `tables.json` | 228 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| entité | `libre` | `max,min` | cible | `tavernGames.json` | 1 | — |  |
| entité | `rows` | `max,min+…` | cible | `tavernGames.json` | 12 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| entité | `table` | `max,min+…` | cible | `tavernGames.json` | 3 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| entité | `targetRange` | `max,min` | cible | `tavernGames.json` | 1 | — |  |
| config | `entries` | `max,min+…` | cible | `vents-tourbillonnants.json` | 5 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `auto` | `max,min+…` | cible | `water-exposure.json` | 1 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `diseases` | `max,min+…` | cible | `water-exposure.json` | 7 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |
| config | `ranges` | `max,min+…` | cible | `weather.json` | 19 | — | FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage. |

### 3.12 quantité (CountSpec : fixe ou tirée) — `quantite` (strate Valeur)

3 ligne(s), 47 occurrence(s).
Reconnu par : son noyau `fixed`

| Famille | Champ | Forme | Statut | Dataset | Occurrences | Cibles résolues | Note |
|---|---|---|---|---|---|---|---|
| entité | `count` | `fixed` | cible | `careerLevels.json` | 45 | — |  |
| entité | `count` | `fixed` | cible | `classes.json` | 1 | — |  |
| entité | `count` | `fixed` | cible | `creatures.json` | 1 | — |  |

### 3.13 jet à faire (compétence/caractéristique + difficulté) — `test` (strate Valeur)

56 ligne(s), 233 occurrence(s).
Reconnu par : son noyau `difficulty`

| Famille | Champ | Forme | Statut | Dataset | Occurrences | Cibles résolues | Note |
|---|---|---|---|---|---|---|---|
| config | `controlFlux` | `difficulty+…` | divergente | `arcane-phenomena.json` | 1 | — |  |
| config | `test` | `difficulty,skill+…` | divergente | `arene-projet.json` | 9 | — |  |
| entité | `amputation` | `difficulty+…` | divergente | `criticals.json` | 26 | — |  |
| entité | `loss` | `difficulty` | divergente | `criticals.json` | 2 | — |  |
| entité | `test` | `difficulty,skill` | historique | `criticals.json` | 39 | — |  |
| entité | `test` | `difficulty,skill` | historique | `domains.json` | 2 | — |  |
| entité | `difficultyBy` | `difficulty+…` | divergente | `etats.json` | 2 | — |  |
| entité | `test` | `difficulty,skill+…` | divergente | `etats.json` | 2 | — |  |
| config | `riderTest` | `char,difficulty,skill+…` | divergente | `incidents-monture.json` | 2 | — |  |
| config | `gossip` | `difficulty+…` | divergente | `land-cargo.json` | 1 | — |  |
| config | `effect` | `difficulty,skill+…` | divergente | `loup-et-saumure-projet.json` | 1 | — |  |
| config | `test` | `difficulty,skill+…` | divergente | `loup-et-saumure-projet.json` | 2 | — |  |
| entité | `test` | `difficulty,skill` | historique | `maladies.json` | 1 | — |  |
| entité | `test` | `difficulty,skill` | historique | `maneuvers.json` | 2 | — |  |
| entité | `test` | `characteristic,difficulty+…` | divergente | `miscast.json` | 2 | — |  |
| entité | `test` | `difficulty,skill+…` | divergente | `miscast.json` | 13 | — |  |
| entité | `test` | `difficulty,skill` | historique | `psychology.json` | 7 | — |  |
| config | `test` | `characteristic,difficulty` | historique | `river-criticals.json` | 2 | — |  |
| config | `rowingAgility` | `difficulty+…` | divergente | `river-navigation.json` | 1 | — |  |
| config | `temporaryRepair` | `difficulty+…` | divergente | `river-navigation.json` | 1 | — |  |
| config | `producesGossip` | `difficulty+…` | divergente | `sea-cargo.json` | 1 | — |  |
| config | `surplusGossip` | `difficulty+…` | divergente | `sea-cargo.json` | 1 | — |  |
| config | `test` | `difficulty,skill+…` | divergente | `sea-cargo.json` | 1 | — |  |
| config | `params` | `difficulty+…` | divergente | `sea-events.json` | 3 | — |  |
| config | `epuisement` | `difficulty+…` | divergente | `sea-navigation.json` | 1 | — |  |
| config | `evasion` | `difficulty+…` | divergente | `sea-perils.json` | 5 | — |  |
| config | `freeTest` | `char,difficulty+…` | divergente | `sea-perils.json` | 1 | — |  |
| config | `tourbillonSwim` | `difficulty,skill+…` | divergente | `sea-perils.json` | 1 | — |  |
| config | `affaler` | `difficulty+…` | divergente | `sea-weather.json` | 1 | — |  |
| config | `test` | `difficulty,skill` | historique | `ship-criticals.json` | 12 | — |  |
| entité | `crossTest` | `characteristic,difficulty+…` | divergente | `spells.json` | 2 | — |  |
| entité | `test` | `characteristic,difficulty` | historique | `spells.json` | 5 | — |  |
| entité | `test` | `characteristic,difficulty+…` | divergente | `spells.json` | 3 | — |  |
| entité | `test` | `difficulty,skill` | historique | `spells.json` | 25 | — |  |
| entité | `test` | `difficulty,skill+…` | divergente | `spells.json` | 8 | — |  |
| table | `restart` | `char,difficulty+…` | divergente | `steam-breakdown.json` | 2 | — |  |
| table | `restart` | `difficulty,skill` | historique | `steam-breakdown.json` | 4 | — |  |
| entité | `test` | `characteristic,difficulty` | historique | `symptoms.json` | 1 | — |  |
| entité | `test` | `characteristic,difficulty+…` | divergente | `symptoms.json` | 1 | — |  |
| entité | `test` | `difficulty,skill` | historique | `symptoms.json` | 2 | — |  |
| entité | `test` | `characteristic,difficulty+…` | divergente | `talents.json` | 1 | — |  |
| entité | `test` | `difficulty,skill` | historique | `talents.json` | 1 | — |  |
| entité | `test` | `difficulty,skill+…` | divergente | `talents.json` | 1 | — |  |
| entité | `options` | `char,difficulty` | historique | `tavernGames.json` | 3 | — |  |
| entité | `options` | `difficulty,skill` | historique | `tavernGames.json` | 3 | — |  |
| entité | `options` | `difficulty,skill+…` | divergente | `tavernGames.json` | 1 | — |  |
| entité | `rows` | `difficulty+…` | divergente | `tavernGames.json` | 7 | — |  |
| entité | `throwerPenalty` | `difficulty+…` | divergente | `tavernGames.json` | 1 | — |  |
| entité | `test` | `characteristic,difficulty` | historique | `traits.json` | 1 | — |  |
| entité | `test` | `characteristic,difficulty+…` | divergente | `traits.json` | 1 | — |  |
| entité | `test` | `characteristic,difficulty,skill+…` | divergente | `traits.json` | 1 | — |  |
| entité | `test` | `characteristic,difficulty+…` | divergente | `trappings.json` | 2 | — |  |
| entité | `test` | `characteristic,difficulty,skill+…` | divergente | `trappings.json` | 3 | — |  |
| entité | `test` | `difficulty,skill+…` | divergente | `trappings.json` | 6 | — |  |
| config | `test` | `difficulty,skill` | historique | `water-exposure.json` | 1 | — |  |
| config | `resistanceTest` | `difficulty+…` | divergente | `weather.json` | 2 | — |  |

### 3.14 ouverture cérémonielle de chapitre — `ouverture` (strate Document)

2 ligne(s), 2 occurrence(s).
Reconnu par : son noyau `titre` `pitch`

| Famille | Champ | Forme | Statut | Dataset | Occurrences | Cibles résolues | Note |
|---|---|---|---|---|---|---|---|
| config | `ouverture` | `pitch,titre+…` | cible | `barge-du-sel-projet.json` | 1 | — | `surtitre`, `sousTitre`, `chapitre`, `ambiance` et `source` sont OPTIONNELS au schéma : ce que la projection replie en `+…` est la part facultative de la porte, pas une divergence |
| config | `ouverture` | `pitch,titre+…` | cible | `diligence-projet.json` | 1 | — | `surtitre`, `sousTitre`, `chapitre`, `ambiance` et `source` sont OPTIONNELS au schéma : ce que la projection replie en `+…` est la part facultative de la porte, pas une divergence |

### 3.15 clôture de chapitre — `cloture` (strate Document)

2 ligne(s), 2 occurrence(s).
Reconnu par : son noyau `titre` `when`

| Famille | Champ | Forme | Statut | Dataset | Occurrences | Cibles résolues | Note |
|---|---|---|---|---|---|---|---|
| config | `cloture` | `titre,when+…` | cible | `barge-du-sel-projet.json` | 1 | — | `sousTitre` est OPTIONNEL au schéma |
| config | `cloture` | `titre,when+…` | cible | `diligence-projet.json` | 1 | — | `sousTitre` est OPTIONNEL au schéma |

### 3.16 bloc narratif d’un projet de campagne — `narratif` (strate Document)

4 ligne(s), 4 occurrence(s).
Reconnu par : son noyau `affaires` `indices` `objets` `presetsPnj`

| Famille | Champ | Forme | Statut | Dataset | Occurrences | Cibles résolues | Note |
|---|---|---|---|---|---|---|---|
| config | `narratif` | `affaires,indices,objets,presetsPnj` | cible | `arene-projet.json` | 1 | — |  |
| config | `narratif` | `affaires,indices,objets,presetsPnj+…` | cible | `barge-du-sel-projet.json` | 1 | — | `ouverture` et `cloture` sont OPTIONNELLES au schéma (#717) : un projet qui pose son cadre de chapitre projette `+…` |
| config | `narratif` | `affaires,indices,objets,presetsPnj+…` | cible | `diligence-projet.json` | 1 | — | `ouverture` et `cloture` sont OPTIONNELLES au schéma (#717) : un projet qui pose son cadre de chapitre projette `+…` |
| config | `narratif` | `affaires,indices,objets,presetsPnj` | cible | `loup-et-saumure-projet.json` | 1 | — |  |

### 3.17 Condition à EXPRESSION (`kind` + `expr`) — `condition` (strate Document)

5 ligne(s), 38 occurrence(s).
Reconnu par : son noyau `expr` `kind`

| Famille | Champ | Forme | Statut | Dataset | Occurrences | Cibles résolues | Note |
|---|---|---|---|---|---|---|---|
| config | `when` | `expr,kind` | cible | `arene-projet.json` | 25 | — |  |
| config | `when` | `expr,kind` | cible | `barge-du-sel-projet.json` | 3 | — |  |
| config | `when` | `expr,kind` | cible | `diligence-projet.json` | 3 | — |  |
| config | `cond` | `expr,kind` | cible | `loup-et-saumure-projet.json` | 1 | — |  |
| config | `when` | `expr,kind` | cible | `loup-et-saumure-projet.json` | 6 | — |  |

### 3.18 Homonymes nominatifs

Une clé RÉSERVÉE à un concept qui porte ≥ 2 classes de type dans la donnée : le NOM ne dit plus le
type. Cible #1463 S2 : un nom de concept est réservé à son type. Une clé réservée encore homonyme
ne FORCE aucun concept — seul `price` nomme le concept `prix`, parce que `Price` est un type.

| Clé | Classes | Occurrences | Détail par classe |
|---|---|---|---|
| `char` | object \\| string | 863 | **object** creatures.json:493 vehicles.json:29 structures.json:24 loup-et-saumure-projet.json:8 barge-du-sel-projet.json:4 arene-projet.json:3 — **string** mutations.json:56 spells.json:42 stars.json:42 symptoms.json:34 trappings.json:24 traits.json:21 talents.json:17 tables.json:15 … |
| `price` | null \\| number \\| object \\| string | 520 | **null** trappings.json:46 — **number** land-cargo.json:6 — **object** trappings.json:392 vehicles.json:31 creatures.json:14 sea-cargo.json:11 mass-battle.json:10 land-cargo.json:7 — **string** trappings.json:3 |
| `count` | number \\| object | 92 | **number** spells.json:16 loup-et-saumure-projet.json:6 creatures.json:5 tavernGames.json:3 traits.json:2 sea-shanties.json:1 trappings.json:1 vehicles.json:1 … — **object** careerLevels.json:50 classes.json:3 creatures.json:1 spells.json:1 traits.json:1 |

### 3.19 Paramètres d’entité (`arg`) et régimes de `price`

Valeurs distinctes d’`arg` sur un objet porteur d’`id` : **187** (715 occurrences) — **185** vues en `src/data`, **2** propres aux scènes (`Ténèbres`, `chaos`). Aucun schéma ne les DÉCLARE aujourd’hui :
cette table EST le dénominateur A11 de #1466. La « nature » est devinée par MOTIF (id d’entité,
enum-libellé, taille, seuil `N+`, prose, nombre) : un candidat à examiner, jamais un verdict.

| Valeur d’`arg` | Nature (motif) | Occurrences | Datasets |
|---|---|---|---|
| `grande` | id d’entité | 87 | `creatures.json` |
| `enorme` | taille | 55 | `creatures.json` |
| `fievre-du-rongeur` | id d’entité | 53 | `creatures.json` |
| `petite` | id d’entité | 37 | `arene-projet.json` `creatures.json` |
| `peau-verte` | id d’entité | 30 | `creatures.json` |
| `Mineure` | enum-libellé | 27 | `creatures.json` |
| `Modérée` | enum-libellé | 27 | `creatures.json` |
| `monstrueuse` | id d’entité | 26 | `arene-projet.json` `creatures.json` |
| `8+` | seuil `N+` | 19 | `creatures.json` |
| `elfe` | id d’entité | 17 | `creatures.json` |
| `tresPetite` | enum-libellé | 16 | `creatures.json` |
| `moyenne` | id d’entité | 12 | `creatures.json` |
| `Majeure` | enum-libellé | 10 | `creatures.json` |
| `Griffes` | enum-libellé | 9 | `creatures.json` |
| `feu` | id d’entité | 8 | `creatures.json` |
| `Épée` | enum-libellé | 8 | `creatures.json` |
| `Serres` | enum-libellé | 7 | `creatures.json` |
| `dague` | id d’entité | 7 | `creatures.json` |
| `khorne` | id d’entité | 7 | `creatures.json` |
| `minuscule` | id d’entité | 7 | `creatures.json` |
| `poison` | id d’entité | 7 | `creatures.json` |
| `Bois` | enum-libellé | 5 | `creatures.json` |
| `Défenses` | enum-libellé | 5 | `creatures.json` |
| `tout` | id d’entité | 5 | `creatures.json` |
| `un au choix` | enum-libellé | 5 | `creatures.json` |
| `9+` | seuil `N+` | 4 | `creatures.json` |
| `Crocs` | enum-libellé | 4 | `creatures.json` |
| `sigmarite` | id d’entité | 4 | `creatures.json` |
| `verole-du-tanneur` | id d’entité | 4 | `creatures.json` |
| `Dents` | enum-libellé | 3 | `creatures.json` |
| `Peau 1` | enum-libellé | 3 | `creatures.json` |
| `massue` | id d’entité | 3 | `creatures.json` |
| `taal` | id d’entité | 3 | `creatures.json` |
| `vivant` | id d’entité | 3 | `creatures.json` |
| `BF +3` | enum-libellé | 2 | `creatures.json` |
| `Bec` | enum-libellé | 2 | `creatures.json` |
| `Bec crochu` | enum-libellé | 2 | `creatures.json` |
| `Chaos` | enum-libellé | 2 | `creatures.json` |
| `Cornes nasales` | enum-libellé | 2 | `creatures.json` |
| `Crochet` | enum-libellé | 2 | `creatures.json` |
| `Crocs gigantesques` | enum-libellé | 2 | `creatures.json` |
| `Cuir 2` | enum-libellé | 2 | `creatures.json` |
| `Dents aiguisées comme des rasoirs` | prose | 2 | `creatures.json` |
| `Flammes d’AEthyr` | enum-libellé | 2 | `creatures.json` |
| `Fouet pseudopode` | enum-libellé | 2 | `creatures.json` |
| `Griffes recourbées` | enum-libellé | 2 | `creatures.json` |
| `Gueule bardée de crocs` | prose | 2 | `creatures.json` |
| `Gueule caverneuse` | enum-libellé | 2 | `creatures.json` |
| `Hache` | enum-libellé | 2 | `creatures.json` |
| `Lame spectrale` | enum-libellé | 2 | `creatures.json` |
| `Malelame` | enum-libellé | 2 | `creatures.json` |
| `Mandibules` | enum-libellé | 2 | `creatures.json` |
| `Mâchoires tenailles` | enum-libellé | 2 | `creatures.json` |
| `Pince` | enum-libellé | 2 | `creatures.json` |
| `Plastron et heaume` | enum-libellé | 2 | `creatures.json` |
| `Tzeentch` | enum-libellé | 2 | `creatures.json` |
| `Veste de cuir` | enum-libellé | 2 | `creatures.json` |
| `arc-court` | id d’entité | 2 | `creatures.json` |
| `au choix` | enum-libellé | 2 | `creatures.json` |
| `baton-de-combat` | id d’entité | 2 | `creatures.json` |
| `coup-de-poing` | id d’entité | 2 | `creatures.json` |
| `deesse-araignee` | id d’entité | 2 | `creatures.json` |
| `hallebarde` | id d’entité | 2 | `creatures.json` |
| `modérée` | enum-libellé | 2 | `creatures.json` |
| `nain` | id d’entité | 2 | `creatures.json` |
| `pistolet` | id d’entité | 2 | `creatures.json` |
| `sorcellerie` | id d’entité | 2 | `creatures.json` |
| `ulric` | id d’entité | 2 | `creatures.json` |
| `verena` | id d’entité | 2 | `creatures.json` |
| `3 mètres` | enum-libellé | 1 | `creatures.json` |
| `6 mètres` | enum-libellé | 1 | `creatures.json` |
| `7-9` | enum-libellé | 1 | `creatures.json` |
| `Ailerons tranchants` | enum-libellé | 1 | `creatures.json` |
| `Armes rouillées ou griffes` | prose | 1 | `creatures.json` |
| `BF +4` | enum-libellé | 1 | `creatures.json` |
| `Bave gluante` | enum-libellé | 1 | `creatures.json` |
| `Bec muni de crocs` | prose | 1 | `creatures.json` |
| `Becs vicieux` | enum-libellé | 1 | `creatures.json` |
| `Bouches multiples` | enum-libellé | 1 | `creatures.json` |
| `Bâton de la Déesse-araignée` | prose | 1 | `creatures.json` |
| `Bâton en bois mort` | prose | 1 | `creatures.json` |
| `Bête intérieure` | enum-libellé | 1 | `creatures.json` |
| `Bêtes` | enum-libellé | 1 | `creatures.json` |
| `Bêtes, n’importe laquelle du Chaos, Mort ou Ombres` | prose | 1 | `creatures.json` |
| `Cauchemars` | enum-libellé | 1 | `creatures.json` |
| `Chemise de mailles` | enum-libellé | 1 | `creatures.json` |
| `Complexe` | enum-libellé | 1 | `creatures.json` |
| `Cornes en dents de scie` | prose | 1 | `creatures.json` |
| `Corrosion` | enum-libellé | 1 | `creatures.json` |
| `Crocs acérés` | enum-libellé | 1 | `creatures.json` |
| `Crocs dentelés` | enum-libellé | 1 | `creatures.json` |
| `Crocs et griffes` | enum-libellé | 1 | `creatures.json` |
| `Crocs horribles` | enum-libellé | 1 | `creatures.json` |
| `Dents et cornes` | enum-libellé | 1 | `creatures.json` |
| `Difficile` | enum-libellé | 1 | `creatures.json` |
| `Divers` | enum-libellé | 1 | `creatures.json` |
| `Enroulement écrasant` | enum-libellé | 1 | `creatures.json` |
| `Ghyran` | enum-libellé | 1 | `creatures.json` |
| `Griffes de la taille de faux` | prose | 1 | `creatures.json` |
| `Griffes incurvées` | enum-libellé | 1 | `creatures.json` |
| `Griffes recouvertes de gromril` | prose | 1 | `creatures.json` |
| `Griffes renforcées de métal` | prose | 1 | `creatures.json` |
| `Griffes semblables à des racines` | prose | 1 | `creatures.json` |
| `Grosse chope` | enum-libellé | 1 | `creatures.json` |
| `Gueule cachée` | enum-libellé | 1 | `creatures.json` |
| `Gueule pleine de crocs` | prose | 1 | `creatures.json` |
| `Heaume 2, Plates 3` | prose | 1 | `creatures.json` |
| `Hurlements` | enum-libellé | 1 | `creatures.json` |
| `Jade` | enum-libellé | 1 | `creatures.json` |
| `Lame à dents` | enum-libellé | 1 | `creatures.json` |
| `Lames rouillées` | enum-libellé | 1 | `creatures.json` |
| `Lance de fortune` | enum-libellé | 1 | `creatures.json` |
| `Légère 2` | enum-libellé | 1 | `creatures.json` |
| `Mandibules acérées` | enum-libellé | 1 | `creatures.json` |
| `Marteau de cavalier` | enum-libellé | 1 | `creatures.json` |
| `Merlin grossier` | enum-libellé | 1 | `creatures.json` |
| `Morsure de dents aiguisées` | prose | 1 | `creatures.json` |
| `Mort et Nécromancie` | enum-libellé | 1 | `creatures.json` |
| `Mort ou Nécromancie` | enum-libellé | 1 | `creatures.json` |
| `Moyen` | taille | 1 | `creatures.json` |
| `Nurgle` | enum-libellé | 1 | `creatures.json` |
| `Pattes arrières 1, Tête, Corps et Pattes avant 3` | prose | 1 | `creatures.json` |
| `Peau 2` | enum-libellé | 1 | `creatures.json` |
| `Pinces` | enum-libellé | 1 | `creatures.json` |
| `Pinces antérieures` | enum-libellé | 1 | `creatures.json` |
| `Pistolets` | enum-libellé | 1 | `creatures.json` |
| `Plume` | enum-libellé | 1 | `creatures.json` |
| `Poids super-lourd` | enum-libellé | 1 | `creatures.json` |
| `Poing à pistons` | enum-libellé | 1 | `creatures.json` |
| `Poings` | enum-libellé | 1 | `creatures.json` |
| `Poison, Difficulté Difficile (–20)` | prose | 1 | `creatures.json` |
| `Queue mortelle` | enum-libellé | 1 | `creatures.json` |
| `Sabots ardents` | enum-libellé | 1 | `creatures.json` |
| `Slaanesh` | enum-libellé | 1 | `creatures.json` |
| `Soporifique` | enum-libellé | 1 | `creatures.json` |
| `Totalement déséquilibré et 2 autres lancers` | prose | 1 | `creatures.json` |
| `Trident de Triton` | enum-libellé | 1 | `creatures.json` |
| `Ténèbres` | enum-libellé | 1 | `arene-projet.json` |
| `Venin` | enum-libellé | 1 | `creatures.json` |
| `Volée de rasoirs` | enum-libellé | 1 | `creatures.json` |
| `Vomi d’ivrogne` | enum-libellé | 1 | `creatures.json` |
| `acide ou gaz` | enum-libellé | 1 | `creatures.json` |
| `arc` | id d’entité | 1 | `creatures.json` |
| `arc-long` | id d’entité | 1 | `creatures.json` |
| `bailli, juriste` | enum-libellé | 1 | `creatures.json` |
| `belette` | id d’entité | 1 | `creatures.json` |
| `bosse-d-os` | id d’entité | 1 | `creatures.json` |
| `bouclier` | id d’entité | 1 | `creatures.json` |
| `bras-multiples` | id d’entité | 1 | `creatures.json` |
| `buveur-de-saumure` | id d’entité | 1 | `creatures.json` |
| `canon-ratling` | id d’entité | 1 | `creatures.json` |
| `chaos` | id d’entité | 1 | `arene-projet.json` |
| `cornes-asymetriques` | id d’entité | 1 | `creatures.json` |
| `corrosif` | id d’entité | 1 | `creatures.json` |
| `de Très Facile à Très Difficile` | prose | 1 | `creatures.json` |
| `demon, demonologue` | enum-libellé | 1 | `creatures.json` |
| `demonologie` | id d’entité | 1 | `creatures.json` |
| `deux au choix` | enum-libellé | 1 | `creatures.json` |
| `divers` | id d’entité | 1 | `creatures.json` |
| `elfe-noir` | id d’entité | 1 | `creatures.json` |
| `epee-batarde` | id d’entité | 1 | `creatures.json` |
| `filet` | id d’entité | 1 | `creatures.json` |
| `fouet` | id d’entité | 1 | `creatures.json` |
| `froid` | id d’entité | 1 | `creatures.json` |
| `griffes` | id d’entité | 1 | `creatures.json` |
| `lance` | id d’entité | 1 | `creatures.json` |
| `manann` | id d’entité | 1 | `creatures.json` |
| `marteau-de-guerre` | id d’entité | 1 | `creatures.json` |
| `mort` | id d’entité | 1 | `creatures.json` |
| `noble` | id d’entité | 1 | `creatures.json` |
| `noble, homme-bete` | enum-libellé | 1 | `creatures.json` |
| `peste-noire` | id d’entité | 1 | `creatures.json` |
| `pieuvre-des-tourbieres` | id d’entité | 1 | `creatures.json` |
| `predateur` | id d’entité | 1 | `creatures.json` |
| `rapiere` | id d’entité | 1 | `creatures.json` |
| `serpent` | id d’entité | 1 | `creatures.json` |
| `son propre corps` | enum-libellé | 1 | `creatures.json` |
| `teutogen` | id d’entité | 1 | `creatures.json` |
| `tileen` | id d’entité | 1 | `creatures.json` |
| `tzeentch` | id d’entité | 1 | `creatures.json` |
| `une au choix` | enum-libellé | 1 | `creatures.json` |
| `verole-cerebrale-a-taches-vertes` | id d’entité | 1 | `creatures.json` |
| `verole-urticante` | id d’entité | 1 | `creatures.json` |
| `zweihander` | id d’entité | 1 | `creatures.json` |
| `Écailles changeant de couleur` | prose | 1 | `creatures.json` |
| `Énorme épieu` | enum-libellé | 1 | `creatures.json` |
| `Épines dorsales crochues` | enum-libellé | 1 | `creatures.json` |

`Price = Money | {saison} | {dice} | "ND"` (DESIGN v2 S4) : les régimes ci-dessous sont la colonne
Prix du RAW, pas une bourse unique — un coefficient saisonnier n’est pas une monnaie à éteindre.

| Régime de `price` | Occurrences |
|---|---|
| objet {brass,gold,silver} | 447 |
| absent (null) | 46 |
| objet {automne,ete,hiver,printemps} | 17 |
| nombre | 6 |
| littéral « ND » | 3 |
| objet {dice} | 1 |

### 3.20 Dotations narratives `{text}`

Un `{text}` n’est une occurrence de référence que si son texte normalisé (casse, accents, ponctuation,
espaces) égale le `label` d’une entité d’un dataset de la CIBLE MAJORITAIRE de son site — de n’importe
quel dataset quand le site n’a pas de cible, et sans vérification du TYPE attendu (angle mort). Ces
occurrences-là portent la forme `text (résolvable)` (divergente, à migrer en `{id}`, #624) ; les autres
sont le narratif irréductible que la forme `text` DÉCLARE (#1463, #624).

| Signature de l’objet | Occurrences | Résolvables |
|---|---|---|
| `text` | 577 | — |
| `op,text` | 507 | — |
| `kind,text` | 206 | — |
| `count,text` | 26 | — |
| `kind,plus,text` | 4 | — |

### 3.21 Hors strate — signatures ORPHELINES

Objet qui ANNONCE une référence (clé `…Id`/`…Ids`/`…Ref`, clé réservée, clé d’identité) et qui ne
résout vers RIEN, sans être un document, et qui ne porte pas d’`op` (la strate Ops le porterait).
Aucune strate ne le porte : c’est ce que le détecteur ne sait pas nommer, et il se compte au lieu
de se taire. Stock `STRUCTURES_ORPHELINES` ; le LOT suit le motif — `L1a #1466` quand le NOM de la
clé annonçait une FK (`clé de référence non résolue`), `#1553` pour les autres motifs.

Ce que le motif `clé réservée` nomme : le DÉCLENCHEUR est le NOM de la clé (`CLES_RESERVEES` du
lexique), pas une valeur qui pointerait vers rien — le contenu de ces objets est légitime, et la
clé `source` à elle seule en déclenche la majorité. Ce motif-là se solde au VOCABULAIRE (#1463 S2 :
un nom de concept est réservé à son type), pas en curant un contenu ni en posant une enveloppe.

**97** signatures orphelines, **408** occurrences. Par motif : `clé de référence non résolue` 0 · `clé réservée` 95 · `identité non résolue` 2. Le lot `L1a #1466` porte donc 0 ligne(s) ici, `#1553` en porte 97.

| Dataset | Champ | Signature | Motif | Occurrences |
|---|---|---|---|---|
| `talents.json` | `matches` | `manual,skill` | clé réservée | 74 |
| `talents.json` | `matches` | `skill` | clé réservée | 34 |
| `careerLevels.json` | `trappings` | `count,text` | clé réservée | 25 |
| `domains.json` | `windModifiers` | `desc,dr,source,tests,when` | clé réservée | 19 |
| `vehicles.json` | `hull` | `bodyShape,char,propulsion,rig` | clé réservée | 18 |
| `vehicles.json` | `purchase` | `price` | clé réservée | 17 |
| `creatures.json` | `purchase` | `availability,price` | clé réservée | 14 |
| `vehicles.json` | `purchase` | `availability,price` | clé réservée | 14 |
| `arcane-phenomena.json` | `testMods` | `desc,dr,scope,source,tests` | clé réservée | 12 |
| `spells.json` | `variants` | `desc,source,when` | clé réservée | 11 |
| `vehicles.json` | `hull` | `bodyShape,char,propulsion` | clé réservée | 9 |
| `arcane-phenomena.json` | `testMods` | `desc,dr,source,tests` | clé réservée | 8 |
| `loup-et-saumure-projet.json` | `statblock` | `char,label,skills,type` | clé réservée | 8 |
| `talents.json` | `matches` | `char,manual` | clé réservée | 7 |
| `arene-projet.json` | `acts` | `act,cost` | clé réservée | 5 |
| `sea-navigation.json` | `levels` | `desc,level,mMod,manDR,navDR,repairPctOfBase,source` | clé réservée | 5 |
| `spells.json` | `variants` | `desc,effects,source,when` | clé réservée | 5 |
| `talents.json` | `variants` | `combat,desc,source,when` | clé réservée | 5 |
| `barge-du-sel-projet.json` | `statblock` | `char,label,skills,type` | clé réservée | 4 |
| `disponibilite.json` | `barterRatios` | `give,ratios,source` | clé réservée | 4 |
| `ship-construction.json` | `manoeuvrability` | `costPct,manDR,source` | clé réservée | 4 |
| `spells.json` | `opposed` | `char,kind` | clé réservée | 4 |
| `talents.json` | `matches` | `skill,when` | clé réservée | 4 |
| `arcane-phenomena.json` | `saturation` | `desc,levelsPerMonth,source` | clé réservée | 3 |
| `sea-navigation.json` | `lowMPenalty` | `dr,m,source` | clé réservée | 3 |
| `sea-perils.json` | `gestionDesPerils` | `avoid,distanceM,source,spot` | clé réservée | 3 |
| `talents.json` | `matches` | `skill,specFromInstance` | clé réservée | 3 |
| `arcane-phenomena.json` | `niMods` | `desc,divide,round,scope,source` | clé réservée | 2 |
| `arcane-phenomena.json` | `testMods` | `desc,dr,drDie,drMax,source,tests` | clé réservée | 2 |
| `arcane-phenomena.json` | `testMods` | `desc,dr,drMax,maison,scope,source,tests` | clé réservée | 2 |
| `arcane-phenomena.json` | `saturation` | `desc,levelsPerYear,source` | clé réservée | 2 |
| `arene-projet.json` | `statblock` | `char,label,traits,type` | clé réservée | 2 |
| `arene-projet.json` | `choices` | `cost,flow,icon,label` | clé réservée | 2 |
| `crew-roles.json` | `wage` | `daily,source,weekly` | clé réservée | 2 |
| `disponibilite.json` | `dispoPct` | `availability,pct,source` | clé réservée | 2 |
| `domains.json` | `windModifiers` | `cancelledBy,desc,dr,source,tests` | clé réservée | 2 |
| `domains.json` | `cancelledBy` | `circumstance,desc,requiresSkill,source,sustained,test` | clé réservée | 2 |
| `talents.json` | `variants` | `combat,desc,max,source,when` | clé réservée | 2 |
| `talents.json` | `variants` | `combat,desc,source,test,when` | clé réservée | 2 |
| `talents.json` | `variants` | `desc,source,when` | clé réservée | 2 |
| `tavernGames.json` | `phases` | `count,rounds` | clé réservée | 2 |
| `trappings.json` | `test` | `label,skill` | clé réservée | 2 |
| `vehicles.json` | `hull` | `bodyShape,char,criticalTable,locationTable,propulsion,rig` | clé réservée | 2 |
| `arcane-phenomena.json` | `saturation` | `blocksPropagation,desc,source` | clé réservée | 1 |
| `arcane-phenomena.json` | `niMods` | `delta,desc,scope,source` | clé réservée | 1 |
| `arcane-phenomena.json` | `overcastPerSpell` | `desc,dice,source` | clé réservée | 1 |
| `arcane-phenomena.json` | `testMods` | `desc,dr,drMax,maison,source,tests` | clé réservée | 1 |
| `arcane-phenomena.json` | `testMods` | `desc,dr,drMax,source,tests` | clé réservée | 1 |
| `arcane-phenomena.json` | `testMods` | `desc,dr,scope,source,tests,windRestricted` | clé réservée | 1 |
| `arcane-phenomena.json` | `saturation` | `desc,levels,source` | clé réservée | 1 |
| `arcane-phenomena.json` | `saturation` | `desc,levelsPerYear,source,whenOffLine` | clé réservée | 1 |
| `arcane-phenomena.json` | `stonePropertySlots` | `desc,max,source` | clé réservée | 1 |
| `arcane-phenomena.json` | `saturation` | `desc,preventsJonctionSaturee,source` | clé réservée | 1 |
| `arcane-phenomena.json` | `refractedWindsOnly` | `desc,source` | clé réservée | 1 |
| `arcane-phenomena.json` | `saturation` | `desc,source,viaGrandVortex` | clé réservée | 1 |
| `arene-projet.json` | `statblock` | `char,label,size,traits,type` | clé réservée | 1 |
| `arene-projet.json` | `effect` | `level,skill,type` | clé réservée | 1 |
| `classes.json` | `trappings` | `count,text` | clé réservée | 1 |
| `details.json` | `texts` | `age,ambitionLong,ambitionShort,nom,taille` | identité non résolue | 1 |
| `etats.json` | `test` | `difficultyBy,gate,label,skill` | clé réservée | 1 |
| `etats.json` | `of` | `id,kind,who` | identité non résolue | 1 |
| `etats.json` | `recover` | `skill` | clé réservée | 1 |
| `land-cargo.json` | `buy` | `availabilityMultiplier,merchantSkill,minEnc,partialSurchargePct,source,wineAlcoholResistThreshold,wineEvalDifficulty,wineEvalEasyDifficulty` | clé réservée | 1 |
| `land-cargo.json` | `sell` | `commerceBonus,dumpingPctOfBase,offerByRichesse,source,targetPerSize` | clé réservée | 1 |
| `localisation.json` | `personnage` | `shapes,source` | clé réservée | 1 |
| `qualities.json` | `test` | `characteristic,opposed,skill` | clé réservée | 1 |
| `qualities.json` | `test` | `opposed,skill` | clé réservée | 1 |
| `river-navigation.json` | `echouage` | `hullDamage,source` | clé réservée | 1 |
| `river-navigation.json` | `outOfControl` | `navPenalty,source` | clé réservée | 1 |
| `river-navigation.json` | `capsize` | `removeSailDifficulty,rightCumulativePenalty,rightDifficulty,source` | clé réservée | 1 |
| `sea-cargo.json` | `buy` | `availabilityMultiplier,bigPortSkill,merchantSkill,partialPurchaseSellerDR,source,surplusSellerDR` | clé réservée | 1 |
| `sea-cargo.json` | `sell` | `commerceBonus,dumpingPctOfBase,noProduceTargetPerSize,offerPrice,producesGossip,sellerDR,source,surplusGossip` | clé réservée | 1 |
| `sea-cargo.json` | `overload` | `hardCapPct,paliers,source` | clé réservée | 1 |
| `sea-cargo.json` | `opportunite` | `investMaxEnc,outcomes,source,test` | clé réservée | 1 |
| `sea-events.json` | `manann` | `base,factors,portEventMod,source` | clé réservée | 1 |
| `sea-events.json` | `fastVoyage` | `paliers,source` | clé réservée | 1 |
| `sea-navigation.json` | `forcerLeRythme` | `avirons,bonusM,source` | clé réservée | 1 |
| `sea-navigation.json` | `forcerLeRythme` | `avirons,bonusM,source,voile` | clé réservée | 1 |
| `sea-navigation.json` | `workPeriodHours` | `avirons,source,voile` | clé réservée | 1 |
| `sea-navigation.json` | `orientation` | `changementDeCap,driftMajorBonus,driftSide,reperes,source,testsPerDay` | clé réservée | 1 |
| `sea-navigation.json` | `reparation` | `charpentierPenalty,entretienCrewTestDR,lissageRepairSurcoutPct,portCostGoldPerWound,source,temporaire,testHours,woundsPerTest` | clé réservée | 1 |
| `sea-navigation.json` | `phares` | `clocher,perilSpotBonus,source,voirLaLumiere` | clé réservée | 1 |
| `sea-navigation.json` | `clocher` | `distanceDiviseur,orientationDR,source` | clé réservée | 1 |
| `sea-navigation.json` | `poursuite` | `distanceUnitM,drDeltas,escapeDistances,lowMPenalty,source` | clé réservée | 1 |
| `sea-navigation.json` | `salissures` | `levels,source,weeklyTest` | clé réservée | 1 |
| `sea-navigation.json` | `longsVoyages` | `millesParJourParM,progressionPctParDR,sansVoguerDeNuitDiviseur,source` | clé réservée | 1 |
| `sea-navigation.json` | `vitesseMax` | `safeBonus,source,table` | clé réservée | 1 |
| `sea-perils.json` | `echouer` | `desc,source` | clé réservée | 1 |
| `sea-weather.json` | `seasonMod` | `automne,ete,hiver,printemps,source` | clé réservée | 1 |
| `ship-construction.json` | `propulsion` | `secondaryMalus,secondaryMinM,source` | clé réservée | 1 |
| `spells.json` | `variants` | `cn,desc,source,when` | clé réservée | 1 |
| `spells.json` | `variants` | `desc,duration,source,when` | clé réservée | 1 |
| `talents.json` | `variants` | `desc,source,test,when` | clé réservée | 1 |
| `tavernGames.json` | `second` | `char` | clé réservée | 1 |
| `tavernGames.json` | `dice` | `count,faces` | clé réservée | 1 |
| `tavernGames.json` | `test` | `skill` | clé réservée | 1 |
| `trappings.json` | `test` | `label,noSupport,skill` | clé réservée | 1 |

Au-delà des orphelines, **13603** objets sur **50169** ne sont portés par AUCUNE
strate : ils n’annoncent aucune référence, ne portent aucune valeur du lexique et ne sont pas des
documents. Les GRAPHIES de référence les ont quittés (une enveloppe `{ref:{…}}` ou une dotation
`{text}` sous un champ porteur mesuré est une FORME, §3.1). Restent trois familles : les CHARGES UTILES pures
(`{x,y}` d’une tuile, bloc de caractéristiques, `{flat,plusBF}` de dégâts), les objets d’un `Flow`
ou d’une `Formula` (`{kind,steps}`, `{bonusOf}`) et les objets à `op`, dont la grammaire est mesurée en §5.
Ils ne sont pas au stock — ils se lisent ici, EN ENTIER : les
**1181** signatures hors strate, triées par occurrences décroissantes. Le diff de cette
table EST la revue de toute signature neuve ; le CLIQUET qui la garde vit dans
`src/data/structures-contrat.test.ts` (plafond sur le COMPTE, liste de référence = cette table).

<!-- HORS-STRATE:DEBUT -->
| Dataset | Champ | Signature | Occurrences |
|---|---|---|---|
| `diligence-projet.json` | `tiles` | `x,y` | 673 |
| `spells.json` | `effects` | `kind,steps` | 581 |
| `spells.json` | `effect` | `on,ops,type` | 551 |
| `creatures.json` | `char` | `B,M,agilite,capacite-de-combat,capacite-de-tir,dexterite,endurance,force,force-mentale,initiative,intelligence,sociabilite` | 488 |
| `spells.json` | `steps` | `effect,kind` | 475 |
| `arene-projet.json` | `pos` | `x,y` | 446 |
| `props.json` | `center` | `hM,xM,yM` | 379 |
| `spells.json` | `ops` | `op,text` | 378 |
| `progression-schemas.derived.json` | `1` | `characteristic,col,mark,x` | 333 |
| `diligence-projet.json` | `edges` | `side,x,y` | 305 |
| `props.json` | `size` | `hM,xM,yM` | 301 |
| `arene-projet.json` | `steps` | `effect,kind` | 278 |
| `spells.json` | `range` | `kind,unit,value` | 263 |
| `spells.json` | `value` | `bonusOf` | 258 |
| `diligence-projet.json` | `tiles` | `x,y,z` | 241 |
| `spells.json` | `range` | `kind` | 223 |
| `spells.json` | `duration` | `kind,value` | 187 |
| `spells.json` | `target` | `kind,n` | 179 |
| `spells.json` | `value` | `charOf` | 154 |
| `criticals.json` | `ops` | `amount,ignoreAP,ignoreTB,op` | 146 |
| `trappings.json` | `damage` | `flat,plusBF` | 145 |
| `spells.json` | `duration` | `kind` | 141 |
| `talents.json` | `max` | `bonusOf` | 139 |
| `spells.json` | `duration` | `kind,unit,value` | 130 |
| `talents.json` | `test` | `matches,raw` | 128 |
| `spells.json` | `target` | `kind` | 127 |
| `tables.json` | `ops` | `op,text` | 119 |
| `spells.json` | `target` | `kind,text` | 117 |
| `progression-schemas.derived.json` | `lv` | `1,2,3,4` | 111 |
| `progression-schemas.derived.json` | `2` | `characteristic,col,teinte,x` | 111 |
| `progression-schemas.derived.json` | `3` | `characteristic,col,teinte,x` | 111 |
| `progression-schemas.derived.json` | `4` | `characteristic,col,teinte,x` | 111 |
| `naval-traits.json` | `bands` | `maxLengthM,value` | 103 |
| `donnees.manifest.json` | `entrees` | `desc,files` | 97 |
| `arene-projet.json` | `flow` | `kind,steps` | 94 |
| `spells.json` | `target` | `kind,meters,span` | 83 |
| `arene-projet.json` | `effect` | `desc,type` | 82 |
| `diligence-projet.json` | `edge` | `side,x,y` | 71 |
| `spells.json` | `meters` | `bonusOf` | 67 |
| `careers.json` | `rand` | `elfe-sylvain,gnome,halfling,haut-elfe,humain,middenheim,middenland,nain,nordland,ogre` | 65 |
| `creatures.json` | `harvest` | `danger,rarity,uses` | 54 |
| `loup-et-saumure-projet.json` | `steps` | `effect,kind` | 54 |
| `spells.json` | `duration` | `kind,text` | 52 |
| `trappings.json` | `effect` | `ops,type` | 52 |
| `loup-et-saumure-projet.json` | `pos` | `x,y` | 46 |
| `props.json` | `volume` | `capIdentite,primitives` | 46 |
| `species.json` | `talents` | `of,pick` | 40 |
| `criticals.json` | `test` | `fail,kind,success,test` | 39 |
| `criticals.json` | `success` | `kind,steps` | 39 |
| `criticals.json` | `fail` | `effect,kind` | 39 |
| `criticals.json` | `effect` | `on,ops,type` | 39 |
| `diligence-projet.json` | `area` | `h,kind,w,x,y` | 39 |
| `spells.json` | `steps` | `fail,kind,success,test` | 39 |
| `spells.json` | `range` | `kind,text` | 37 |
| `arene-projet.json` | `effect` | `montant,type` | 36 |
| `spells.json` | `ops` | `op` | 33 |
| `arcane-phenomena.json` | `effects` | `label,tier` | 32 |
| `spells.json` | `ops` | `char,mod,op` | 32 |
| `spells.json` | `success` | `kind,steps` | 32 |
| `careers.json` | `rand` | `elfe-sylvain,gnome,halfling,haut-elfe,humain,middenheim,middenland,nain,nordland,norse,ogre` | 31 |
| `maneuvers.json` | `effect` | `on,ops,type` | 31 |
| `spells.json` | `fail` | `effect,kind` | 31 |
| `traits.json` | `effect` | `on,ops,type` | 31 |
| `arene-projet.json` | `usable` | `actions` | 29 |
| `traits.json` | `effects` | `flow,on,trigger` | 29 |
| `trappings.json` | `consumable` | `effect,kind` | 29 |
| `vehicles.json` | `char` | `B,endurance` | 29 |
| `arene-projet.json` | `effect` | `flag,type` | 28 |
| `arene-projet.json` | `rect` | `h,w,x,y` | 27 |
| `species.json` | `fate` | `extra,fate,resilience` | 27 |
| `species.json` | `baseChar` | `agilite,capacite-de-combat,capacite-de-tir,dexterite,endurance,force,force-mentale,initiative,intelligence,sociabilite` | 27 |
| `arene-projet.json` | `effect` | `amount,type` | 26 |
| `creatures.json` | `appearance` | `species` | 26 |
| `sea-events.json` | `effect` | `d10,flat,sign` | 26 |
| `arene-projet.json` | `choices` | `flow,icon,label,when` | 25 |
| `diligence-projet.json` | `pos` | `x,y` | 24 |
| `structures.json` | `char` | `B,BE` | 24 |
| `terrains.json` | `stops` | `0%,100%` | 24 |
| `activities.json` | `battle` | `amount,scale,side,target` | 22 |
| `maneuvers.json` | `steps` | `effect,kind` | 22 |
| `traits.json` | `indice` | `label` | 22 |
| `arene-projet.json` | `effect` | `type` | 21 |
| `arene-projet.json` | `onVictory` | `kind,steps` | 20 |
| `naval-traits.json` | `install` | `installation,weightEnc` | 20 |
| `props.json` | `foot` | `h,w` | 20 |
| `criticals.json` | `ops` | `op` | 19 |
| `loup-et-saumure-projet.json` | `flow` | `kind,steps` | 19 |
| `arene-projet.json` | `dimensions` | `h,w` | 18 |
| `arene-projet.json` | `flags` | `` | 18 |
| `etats.json` | `effect` | `on,ops,type` | 18 |
| `maladies.json` | `incubation` | `dice,unit` | 18 |
| `maladies.json` | `duration` | `dice,unit` | 18 |
| `spells.json` | `times` | `factor,of` | 18 |
| `raceAppearance.json` | `palette` | `cheveux,cheveuxH,cheveuxO,peau,peauH,peauO` | 17 |
| `spells.json` | `steps` | `cond,kind,then` | 17 |
| `spells.json` | `ops` | `bonus,op,skill` | 17 |
| `vehicles.json` | `sail` | `crew,m` | 17 |
| `maneuvers.json` | `effects` | `flow,on,trigger` | 16 |
| `spells.json` | `meters` | `charOf` | 16 |
| `barge-du-sel-projet.json` | `pos` | `x,y` | 15 |
| `tables.json` | `ops` | `bonus,op,skill` | 15 |
| `barge-du-sel-projet.json` | `steps` | `effect,kind` | 14 |
| `naval-traits.json` | `installation` | `bands` | 14 |
| `naval-traits.json` | `weightEnc` | `bands` | 14 |
| `spells.json` | `fail` | `kind,steps` | 14 |
| `spells.json` | `success` | `effect,kind` | 14 |
| `arene-projet.json` | `rest` | `` | 13 |
| `arene-projet.json` | `choices` | `flow,label` | 13 |
| `arene-projet.json` | `combat` | `hiddenUntilCombat` | 13 |
| `etats.json` | `effects` | `flow,on,trigger` | 13 |
| `sea-events.json` | `params` | `` | 13 |
| `spells.json` | `then` | `effect,kind` | 13 |
| `spells.json` | `perSL` | `amount,every` | 13 |
| `spells.json` | `ops` | `amount,ignoreAP,ignoreTB,op` | 13 |
| `spells.json` | `value` | `times` | 13 |
| `terrains.json` | `detail` | `seedScope,speckle,tintVar` | 13 |
| `terrains.json` | `speckle` | `colors,perM2,rM` | 13 |
| `vehicles.json` | `oars` | `crew,m` | 13 |
| `activities.json` | `outcomes` | `battle,on` | 12 |
| `arene-projet.json` | `combat` | `randomChars` | 12 |
| `careers.json` | `rand` | `` | 12 |
| `mutations.json` | `appearance` | `features` | 12 |
| `naval-traits.json` | `bands` | `maison,maxLengthM,value` | 12 |
| `ship-criticals.json` | `crewHit` | `crewTarget,test` | 12 |
| `ship-criticals.json` | `test` | `fail,kind,success,test` | 12 |
| `ship-criticals.json` | `success` | `kind,steps` | 12 |
| `ship-criticals.json` | `fail` | `effect,kind` | 12 |
| `ship-criticals.json` | `effect` | `on,ops,type` | 12 |
| `spells.json` | `ops` | `amount,op` | 12 |
| `traits.json` | `passive` | `bonus,op,skill` | 12 |
| `traits.json` | `flow` | `effect,kind` | 12 |
| `arene-projet.json` | `combat` | `optionals` | 11 |
| `criticals.json` | `escalation` | `bleedOnReinjury` | 11 |
| `criticals.json` | `bleedOnReinjury` | `amount,label` | 11 |
| `loup-et-saumure-projet.json` | `effect` | `type` | 11 |
| `qualities.json` | `effect` | `on,ops,type` | 11 |
| `sea-cargo.json` | `avail` | `automne,ete,hiver,printemps` | 11 |
| `spells.json` | `valuePerSL` | `amount,every` | 11 |
| `spells.json` | `amount` | `bonusOf` | 11 |
| `spells.json` | `of` | `charOf` | 11 |
| `structureAppearance.json` | `courses` | `edgeWobble,hM,joint,jointW,paletteVar` | 11 |
| `traits.json` | `flow` | `cond,kind,then` | 11 |
| `trappings.json` | `range` | `bf` | 11 |
| `trappings.json` | `fail` | `effect,kind` | 11 |
| `trappings.json` | `onHitEffects` | `flow,on,trigger` | 11 |
| `eyes.json` | `color` | `elfe-sylvain,gnome,halfling,haut-elfe,humain,nain,ogre` | 10 |
| `hairs.json` | `color` | `elfe-sylvain,gnome,halfling,haut-elfe,humain,nain,ogre` | 10 |
| `loup-et-saumure-projet.json` | `effect` | `flag,type` | 10 |
| `spells.json` | `duration` | `kind,plus,value` | 10 |
| `structureAppearance.json` | `wood` | `cap,frame,inset,rubble,rubbleHi,skirt` | 10 |
| `talents.json` | `passive` | `char,mod,op` | 10 |
| `traits.json` | `then` | `effect,kind` | 10 |
| `trappings.json` | `container` | `capacity` | 10 |
| `trappings.json` | `success` | `kind,steps` | 10 |
| `trappings.json` | `ops` | `op,text` | 10 |
| `vehicles.json` | `ship` | `capacity,crew,footprint,lengthM,manoeuvre,oars,sail,traits` | 10 |
| `arene-projet.json` | `flow` | `fail,kind,success,test` | 9 |
| `arene-projet.json` | `stake` | `authored` | 9 |
| `arene-projet.json` | `success` | `kind,steps` | 9 |
| `arene-projet.json` | `fail` | `kind,steps` | 9 |
| `arene-projet.json` | `walls` | `door,side,x,y` | 9 |
| `arene-projet.json` | `foot` | `h,w,x,y` | 9 |
| `arene-projet.json` | `footprint` | `h,w,x,y` | 9 |
| `arene-projet.json` | `area` | `h,kind,w,x,y` | 9 |
| `criticals.json` | `durationRounds` | `dice` | 9 |
| `maneuvers.json` | `flow` | `kind,steps` | 9 |
| `maneuvers.json` | `ops` | `amount,ignoreAP,ignoreTB,op` | 9 |
| `mutations.json` | `colors` | `peau` | 9 |
| `qualities.json` | `effects` | `flow,on,trigger` | 9 |
| `spells.json` | `target` | `affects,kind,meters,span` | 9 |
| `spells.json` | `amount` | `dice` | 9 |
| `spells.json` | `affects` | `is,kind,who` | 9 |
| `structureAppearance.json` | `detail` | `courses,seedScope` | 9 |
| `trappings.json` | `flow` | `cond,kind,then` | 9 |
| `activities.json` | `outcomes` | `note,on` | 8 |
| `etats.json` | `flow` | `effect,kind` | 8 |
| `loup-et-saumure-projet.json` | `char` | `B,M,agilite,capacite-de-combat,capacite-de-tir,dexterite,endurance,force,force-mentale,intelligence,sociabilite` | 8 |
| `maneuvers.json` | `ops` | `char,mod,op` | 8 |
| `miscast.json` | `ops` | `amount,ignoreAP,ignoreTB,op` | 8 |
| `qualities.json` | `passive` | `drMod,op,phase` | 8 |
| `spells.json` | `cond` | `kind,op,value` | 8 |
| `talents.json` | `combat` | `reverseFailed` | 8 |
| `trappings.json` | `consumableDuration` | `hours` | 8 |
| `traumas.json` | `ops` | `mod,op,skill` | 8 |
| `activities.json` | `blocked` | `raison,ticket` | 7 |
| `arene-projet.json` | `choices` | `flow,icon,label` | 7 |
| `crew-roles.json` | `wage` | `daily,maison,weekly` | 7 |
| `domains.json` | `effects` | `flow,on,trigger` | 7 |
| `domains.json` | `flow` | `cond,kind,then` | 7 |
| `domains.json` | `cond` | `kind,of` | 7 |
| `domains.json` | `then` | `effect,kind` | 7 |
| `domains.json` | `effect` | `on,ops,type` | 7 |
| `etats.json` | `of` | `kind,op,subject,value` | 7 |
| `land-cargo.json` | `avail` | `automne,ete,hiver,printemps` | 7 |
| `loup-et-saumure-projet.json` | `effect` | `montant,type` | 7 |
| `loup-et-saumure-projet.json` | `choices` | `flow,label` | 7 |
| `mutations.json` | `passive` | `mod,op` | 7 |
| `mutations.json` | `passive` | `amount,loc,op` | 7 |
| `ship-construction.json` | `sail` | `crew,m` | 7 |
| `spells.json` | `escapeStrength` | `charOf` | 7 |
| `spells.json` | `ops` | `op,perRound,radiusMeters,shape` | 7 |
| `spells.json` | `radiusMeters` | `bonusOf` | 7 |
| `spells.json` | `yes` | `effect,kind` | 7 |
| `spells.json` | `of` | `bonusOf` | 7 |
| `traits.json` | `capabilities` | `psychType` | 7 |
| `trappings.json` | `ammoRangeMod` | `mult` | 7 |
| `trappings.json` | `consumable` | `fail,kind,success,test` | 7 |
| `trappings.json` | `passive` | `mod,op,skill` | 7 |
| `trappings.json` | `consumableDuration` | `minutes` | 7 |
| `trappings.json` | `then` | `effect,kind` | 7 |
| `trappings.json` | `hours` | `dice` | 7 |
| `trappings.json` | `cond` | `kind,op,value` | 7 |
| `traumas.json` | `ops` | `den,num,op` | 7 |
| `vehicles.json` | `ship` | `capacity,crew,footprint,lengthM,manoeuvre,sail,traits` | 7 |
| `criticals.json` | `times` | `factor,of` | 6 |
| `criticals.json` | `ops` | `durationRounds,hands,op` | 6 |
| `domains.json` | `of` | `kind,of` | 6 |
| `donnees.manifest.json` | `entrees` | `desc,file` | 6 |
| `etats.json` | `steps` | `cond,kind,then` | 6 |
| `etats.json` | `then` | `effect,kind` | 6 |
| `loup-et-saumure-projet.json` | `effect` | `desc,type` | 6 |
| `loup-et-saumure-projet.json` | `damage` | `flat,plusBF` | 6 |
| `maneuvers.json` | `amount` | `indiceOf` | 6 |
| `maneuvers.json` | `range` | `bonusOf,plus` | 6 |
| `maneuvers.json` | `blast` | `bonusOf` | 6 |
| `miscast.json` | `sum` | `dice` | 6 |
| `mutations.json` | `appearance` | `colors` | 6 |
| `naval-ports.json` | `demande` | `armes` | 6 |
| `naval-traits.json` | `installation` | `bands,per` | 6 |
| `props.json` | `anchor` | `hM,xM,yM` | 6 |
| `props.json` | `approach` | `x,y` | 6 |
| `qualities.json` | `flow` | `kind,steps` | 6 |
| `qualities.json` | `steps` | `effect,kind` | 6 |
| `raceAppearance.json` | `pose` | `cou,epauleD,epauleG,tete,torse` | 6 |
| `spells.json` | `ops` | `meters,op` | 6 |
| `spells.json` | `onHitEffects` | `flow,on,trigger` | 6 |
| `spells.json` | `no` | `effect,kind` | 6 |
| `structureAppearance.json` | `courses` | `blockWM,edgeWobble,hM,joint,jointW,paletteVar,stagger` | 6 |
| `tables.json` | `ops` | `amount,ignoreAP,ignoreTB,op` | 6 |
| `talents.json` | `reverseFailed` | `skills` | 6 |
| `terrains.json` | `detail` | `courses,seedScope` | 6 |
| `traits.json` | `of` | `kind,op,subject,value` | 6 |
| `trappings.json` | `ammoRangeMod` | `add` | 6 |
| `activities.json` | `outcomes` | `note,on,ops` | 5 |
| `activities.json` | `battle` | `amount,scale,target` | 5 |
| `activities.json` | `outcomes` | `battle,on,when` | 5 |
| `activities.json` | `outcomes` | `maxSL,minSL,note,on,ops` | 5 |
| `ambiance.json` | `layers` | `alpha,hM` | 5 |
| `arene-projet.json` | `effect` | `disease,type` | 5 |
| `careerLevels.json` | `count` | `roll` | 5 |
| `creatures.json` | `char` | `` | 5 |
| `diligence-projet.json` | `usable` | `assise` | 5 |
| `loup-et-saumure-projet.json` | `dimensions` | `h,w` | 5 |
| `loup-et-saumure-projet.json` | `effect` | `desc,title,type` | 5 |
| `loup-et-saumure-projet.json` | `flags` | `` | 5 |
| `maneuvers.json` | `flow` | `effect,kind` | 5 |
| `miscast.json` | `rounds` | `dice` | 5 |
| `miscast.json` | `ops` | `blocked,op,rounds,skill` | 5 |
| `naval-ports.json` | `surplus` | `poisson-sale` | 5 |
| `naval-ports.json` | `surplus` | `produits-de-luxe` | 5 |
| `naval-ports.json` | `demande` | `armes,cereales` | 5 |
| `naval-traits.json` | `weightEnc` | `bands,per` | 5 |
| `psychology.json` | `attackDR` | `amount,vs` | 5 |
| `ship-construction.json` | `oars` | `crew,m` | 5 |
| `ship-criticals.json` | `ops` | `hauteur,op` | 5 |
| `ship-criticals.json` | `hauteur` | `table` | 5 |
| `spells.json` | `countPerSL` | `amount,every` | 5 |
| `spells.json` | `target` | `excludesCaster,kind,meters,span` | 5 |
| `spells.json` | `ops` | `amount,ignoreAP,ignoreTB,op,perSL` | 5 |
| `spells.json` | `steps` | `kind,no,prompt,yes` | 5 |
| `spells.json` | `ops` | `level,op` | 5 |
| `spells.json` | `ritual` | `components,conditions,consequences,domains,sacrifices,type,xp` | 5 |
| `structureAppearance.json` | `window` | `frame,glass,lit,mullion` | 5 |
| `structureAppearance.json` | `detail` | `courses,seedScope,timber` | 5 |
| `tables.json` | `amount` | `dice` | 5 |
| `talents.json` | `passive` | `op,skill` | 5 |
| `talents.json` | `combat` | `castingKind` | 5 |
| `traits.json` | `steps` | `effect,kind` | 5 |
| `traits.json` | `ops` | `amount,ignoreAP,ignoreTB,op` | 5 |
| `trappings.json` | `capabilities` | `isGrimoire` | 5 |
| `trappings.json` | `minutes` | `dice` | 5 |
| `trappings.json` | `passive` | `bonus,op,skill` | 5 |
| `activities.json` | `outcomes` | `battle,maxSL,on` | 4 |
| `barge-du-sel-projet.json` | `flow` | `kind,steps` | 4 |
| `barge-du-sel-projet.json` | `effect` | `desc,type` | 4 |
| `barge-du-sel-projet.json` | `char` | `B,M,agilite,capacite-de-combat,capacite-de-tir,dexterite,endurance,force,force-mentale,intelligence,sociabilite` | 4 |
| `careerLevels.json` | `talents` | `of,pick` | 4 |
| `criticals.json` | `durationHours` | `times` | 4 |
| `criticals.json` | `of` | `dice` | 4 |
| `criticals.json` | `unites` | `dice` | 4 |
| `criticals.json` | `escalation` | `medicalAidGate` | 4 |
| `criticals.json` | `medicalAidGate` | `disable,label,recoveryPenalty,restoreDR` | 4 |
| `disponibilite.json` | `ratios` | `Commune,Exotique,Limitée,Rare` | 4 |
| `disponibilite.json` | `Commune` | `get,give` | 4 |
| `disponibilite.json` | `Limitée` | `get,give` | 4 |
| `disponibilite.json` | `Rare` | `get,give` | 4 |
| `disponibilite.json` | `Exotique` | `get,give` | 4 |
| `etats.json` | `steps` | `effect,kind` | 4 |
| `loup-et-saumure-projet.json` | `ammoRangeMod` | `mult` | 4 |
| `miscast.json` | `amount` | `dice` | 4 |
| `props.json` | `light` | `radiusM` | 4 |
| `river-criticals.json` | `ops` | `amount,ignoreAP,ignoreTB,op` | 4 |
| `river-navigation.json` | `arriere` | `pct` | 4 |
| `sea-weather.json` | `arriere` | `pctOther,pctSail` | 4 |
| `sea-weather.json` | `arriere` | `pctSail` | 4 |
| `skills.json` | `combatAdvantage` | `cap` | 4 |
| `spells.json` | `ops` | `meters,op,perSL` | 4 |
| `spells.json` | `perSL` | `every,metersFormula` | 4 |
| `spells.json` | `flow` | `effect,kind` | 4 |
| `spells.json` | `duration` | `kind,plus,text` | 4 |
| `spells.json` | `meters` | `times` | 4 |
| `spells.json` | `then` | `fail,kind,success,test` | 4 |
| `structureAppearance.json` | `door` | `handle,jamb,jambCap,leaf,lintelPx,openingFrac,plank` | 4 |
| `structureAppearance.json` | `parapet` | `arasePx,bandThickPx,bands,heightLevelFrac,merlonCount,merlonHeightPx,merlonStep,parapetBandFrac` | 4 |
| `symptoms.json` | `success` | `kind,steps` | 4 |
| `symptoms.json` | `fail` | `effect,kind` | 4 |
| `symptoms.json` | `amount` | `dice` | 4 |
| `talents.json` | `effect` | `on,ops,type` | 4 |
| `talents.json` | `when` | `kind` | 4 |
| `terrains.json` | `courses` | `blockWM,edgeWobble,hM,joint,jointW,paletteVar,stagger` | 4 |
| `traits.json` | `capabilities` | `naturalWeapon` | 4 |
| `traits.json` | `cond` | `kind,of` | 4 |
| `traits.json` | `cond` | `kind,op,value` | 4 |
| `traits.json` | `of` | `kind,of` | 4 |
| `traits.json` | `thresholds` | `atLeast,ops` | 4 |
| `trappings.json` | `ops` | `op` | 4 |
| `trappings.json` | `success` | `effect,kind` | 4 |
| `trappings.json` | `then` | `fail,kind,success,test` | 4 |
| `trappings.json` | `consumableDuration` | `days` | 4 |
| `traumas.json` | `parPalier` | `ops,taille` | 4 |
| `activities.json` | `ops` | `amount,op` | 3 |
| `activities.json` | `outcomes` | `maxSL,note,on,ops` | 3 |
| `activities.json` | `outcomes` | `note,on,resolver` | 3 |
| `activities.json` | `outcomes` | `maxSL,minSL,note,on,payoutPct` | 3 |
| `activities.json` | `outcomes` | `battle,minSL,on` | 3 |
| `ambiance.json` | `precip` | `ceilingM,color,density,fallMs,lengthM,opacity,widthM,windMs` | 3 |
| `ambiance.json` | `windMs` | `x,z` | 3 |
| `arene-projet.json` | `effect` | `desc,title,type` | 3 |
| `arene-projet.json` | `edges` | `side,x,y` | 3 |
| `arene-projet.json` | `edge` | `side,x,y` | 3 |
| `arene-projet.json` | `perils` | `chancePct,effects,label` | 3 |
| `arene-projet.json` | `effects` | `desc,type` | 3 |
| `barge-du-sel-projet.json` | `dimensions` | `h,w` | 3 |
| `barge-du-sel-projet.json` | `rect` | `h,w,x,y` | 3 |
| `barge-du-sel-projet.json` | `effect` | `flag,type` | 3 |
| `barge-du-sel-projet.json` | `flags` | `` | 3 |
| `barge-du-sel-projet.json` | `damage` | `flat,plusBF` | 3 |
| `domains.json` | `of` | `is,kind,who` | 3 |
| `etats.json` | `cond` | `kind,op,subject,value` | 3 |
| `etats.json` | `flow` | `fail,kind,success,test` | 3 |
| `etats.json` | `success` | `kind,steps` | 3 |
| `etats.json` | `valuePerSL` | `amount,every` | 3 |
| `etats.json` | `fail` | `kind,steps` | 3 |
| `etats.json` | `passive` | `amount,op` | 3 |
| `etats.json` | `amount` | `stacks` | 3 |
| `etats.json` | `cond` | `kind,of` | 3 |
| `loup-et-saumure-projet.json` | `effect` | `amount,type` | 3 |
| `loup-et-saumure-projet.json` | `entryPoints` | `arrivee` | 3 |
| `loup-et-saumure-projet.json` | `arrivee` | `x,y` | 3 |
| `materials.json` | `detail` | `courses,seedScope` | 3 |
| `miscast.json` | `ops` | `mod,op,rounds,skill` | 3 |
| `miscast.json` | `durationRounds` | `dice` | 3 |
| `naval-ports.json` | `surplus` | `pieces-detachees-de-navire` | 3 |
| `naval-traits.json` | `passive` | `bonus,op,skill` | 3 |
| `qualities.json` | `capabilities` | `withheldOnRestraint` | 3 |
| `qualities.json` | `capabilities` | `magic` | 3 |
| `raceAppearance.json` | `gabaritOverride` | `legs,sl,st` | 3 |
| `raceAppearance.json` | `pose` | `cou,tete,torse` | 3 |
| `river-navigation.json` | `contraire` | `pct` | 3 |
| `sea-events.json` | `params` | `days` | 3 |
| `sea-weather.json` | `face` | `pctOther,pctSail` | 3 |
| `sea-weather.json` | `lateral` | `affaler` | 3 |
| `sea-weather.json` | `face` | `affaler` | 3 |
| `sea-weather.json` | `face` | `pctSail` | 3 |
| `ship-criticals.json` | `bandes` | `hauteurs,tailles` | 3 |
| `ship-criticals.json` | `hauteurs` | `greement,nid-de-pie` | 3 |
| `ship-criticals.json` | `greement` | `dice` | 3 |
| `spells.json` | `skin` | `accent,cuir,metal` | 3 |
| `spells.json` | `cond` | `kind,of` | 3 |
| `spells.json` | `perRound` | `amount,ignoreAP,ignoreTB,op` | 3 |
| `spells.json` | `of` | `is,kind,who` | 3 |
| `spells.json` | `ops` | `amount,op,perSL,resource,temporary` | 3 |
| `spells.json` | `ops` | `afterDuration,op,ops` | 3 |
| `spells.json` | `ops` | `den,num,op` | 3 |
| `spells.json` | `radiusMeters` | `charOf` | 3 |
| `spells.json` | `cond` | `is,kind,who` | 3 |
| `spells.json` | `ops` | `die,op,rows` | 3 |
| `spells.json` | `test` | `characteristic,opposed` | 3 |
| `spells.json` | `opposed` | `attacker` | 3 |
| `spells.json` | `ops` | `mod,op` | 3 |
| `structureAppearance.json` | `timber` | `braces,color,postEveryM,wM` | 3 |
| `structureAppearance.json` | `detail` | `courses,seedScope,speckle` | 3 |
| `structureAppearance.json` | `speckle` | `colors,perM2,rM,vBias` | 3 |
| `symptoms.json` | `effects` | `flow,on,trigger` | 3 |
| `symptoms.json` | `effect` | `ops,type` | 3 |
| `symptoms.json` | `test` | `fail,kind,success,test` | 3 |
| `symptoms.json` | `effect` | `on,ops,type` | 3 |
| `talents.json` | `passive` | `attr,mod,op` | 3 |
| `talents.json` | `success` | `effect,kind` | 3 |
| `talents.json` | `fail` | `kind,steps` | 3 |
| `traits.json` | `success` | `kind,steps` | 3 |
| `traits.json` | `fail` | `effect,kind` | 3 |
| `traits.json` | `flow` | `kind,steps` | 3 |
| `traits.json` | `naturalWeapon` | `` | 3 |
| `traits.json` | `passive` | `keyword,op` | 3 |
| `traits.json` | `passive` | `mod,op,skill` | 3 |
| `trappings.json` | `capabilities` | `isRations` | 3 |
| `trappings.json` | `fail` | `kind,steps` | 3 |
| `trappings.json` | `ops` | `amount,ignoreAP,ignoreTB,op` | 3 |
| `trappings.json` | `effect` | `on,ops,type` | 3 |
| `trappings.json` | `times` | `factor,of` | 3 |
| `trappings.json` | `prosthesisTraining` | `label,px,reduces` | 3 |
| `traumas.json` | `ops` | `bonus,op,skill` | 3 |
| `vehicles.json` | `ship` | `capacity,crew,footprint,lengthM,manoeuvre,oars,traits` | 3 |
| `vehicles.json` | `postes` | `pos,side` | 3 |
| `vehicles.json` | `pos` | `x,y` | 3 |
| `activities.json` | `outcomes` | `minSL,note,on,ops` | 2 |
| `activities.json` | `outcomes` | `minSL,note,on,payoutPct` | 2 |
| `activities.json` | `outcomes` | `maxSL,note,on` | 2 |
| `activities.json` | `ops` | `montant,op` | 2 |
| `activities.json` | `montant` | `brass` | 2 |
| `activities.json` | `times` | `factor,of` | 2 |
| `activities.json` | `outcomes` | `maxSL,on,ops` | 2 |
| `ambiance.json` | `warm` | `alpha,color,cx,cy,r` | 2 |
| `ambiance.json` | `vignette` | `alpha,color,cx,cy,innerOff,r` | 2 |
| `ambiance.json` | `brume` | `color,layers,povTightenK` | 2 |
| `arcane-phenomena.json` | `scope` | `dominantWinds` | 2 |
| `arcane-phenomena.json` | `drDie` | `divide,faces,perRound` | 2 |
| `arene-projet.json` | `char` | `B,M,agilite,capacite-de-combat,endurance,force` | 2 |
| `arene-projet.json` | `effect` | `phase,type` | 2 |
| `arene-projet.json` | `combat` | `hiddenUntilCombat,randomChars` | 2 |
| `barge-du-sel-projet.json` | `effect` | `type` | 2 |
| `barge-du-sel-projet.json` | `ammoRangeMod` | `mult` | 2 |
| `classes.json` | `count` | `roll` | 2 |
| `criticals.json` | `escalation` | `onHealGrant` | 2 |
| `criticals.json` | `escalation` | `onRepeat` | 2 |
| `criticals.json` | `sum` | `dice` | 2 |
| `criticals.json` | `sum` | `times` | 2 |
| `criticals.json` | `of` | `bonusOf` | 2 |
| `criticals.json` | `disable` | `hands,op` | 2 |
| `criticals.json` | `escalation` | `perRound` | 2 |
| `criticals.json` | `disable` | `den,num,op` | 2 |
| `criticals.json` | `recoveryPenalty` | `den,num,op` | 2 |
| `criticals.json` | `loss` | `perDR` | 2 |
| `criticals.json` | `escalation` | `apresDelai` | 2 |
| `criticals.json` | `jours` | `dice` | 2 |
| `details.json` | `bySpecies` | `` | 2 |
| `diligence-projet.json` | `dimensions` | `h,w` | 2 |
| `diligence-projet.json` | `flags` | `` | 2 |
| `disponibilite.json` | `pct` | `cite,village,ville` | 2 |
| `domains.json` | `ops` | `amount,ignoreAP,ignoreTB,op` | 2 |
| `domains.json` | `missile` | `bypass` | 2 |
| `etats.json` | `passive` | `amount,movementOnly,op` | 2 |
| `etats.json` | `gating` | `movement` | 2 |
| `etats.json` | `cond` | `kind` | 2 |
| `etats.json` | `of` | `kind,of` | 2 |
| `etats.json` | `ops` | `amount,ignoreAP,ignoreTB,op` | 2 |
| `etats.json` | `gating` | `action,cannotDefend,movement` | 2 |
| `hairs.json` | `randByRace` | `gnome` | 2 |
| `interludeEvents.json` | `fx` | `moneyPct` | 2 |
| `interludeEvents.json` | `fx` | `loseActivity` | 2 |
| `lightTones.json` | `flicker` | `amplitude,hz` | 2 |
| `loup-et-saumure-projet.json` | `usable` | `actions` | 2 |
| `loup-et-saumure-projet.json` | `flow` | `fail,kind,success,test` | 2 |
| `loup-et-saumure-projet.json` | `stake` | `authored` | 2 |
| `loup-et-saumure-projet.json` | `success` | `kind,steps` | 2 |
| `loup-et-saumure-projet.json` | `fail` | `kind,steps` | 2 |
| `loup-et-saumure-projet.json` | `rect` | `h,w,x,y` | 2 |
| `loup-et-saumure-projet.json` | `rest` | `auberge` | 2 |
| `loup-et-saumure-projet.json` | `entryPoints` | `retour` | 2 |
| `loup-et-saumure-projet.json` | `retour` | `x,y` | 2 |
| `loup-et-saumure-projet.json` | `onVictory` | `kind,steps` | 2 |
| `maneuvers.json` | `then` | `effect,kind` | 2 |
| `maneuvers.json` | `range` | `bonusOf` | 2 |
| `maneuvers.json` | `amount` | `dice` | 2 |
| `maneuvers.json` | `cond` | `kind,op,value` | 2 |
| `maneuvers.json` | `valuePerSL` | `amount,every` | 2 |
| `maneuvers.json` | `ops` | `material,op` | 2 |
| `maneuvers.json` | `steps` | `fail,kind,success,test` | 2 |
| `maneuvers.json` | `success` | `kind,steps` | 2 |
| `maneuvers.json` | `fail` | `effect,kind` | 2 |
| `maneuvers.json` | `ops` | `op,what` | 2 |
| `materials.json` | `courses` | `blockWM,hM,joint,jointW,paletteVar,stagger` | 2 |
| `materials.json` | `courses` | `edgeWobble,hM,joint,jointW` | 2 |
| `miscast.json` | `escapeStrength` | `times` | 2 |
| `miscast.json` | `times` | `factor,of` | 2 |
| `miscast.json` | `of` | `dice` | 2 |
| `miscast.json` | `ops` | `hours,mod,op,skill` | 2 |
| `miscast.json` | `hours` | `dice` | 2 |
| `miscast.json` | `ops` | `blocked,minutes,op,skill` | 2 |
| `miscast.json` | `minutes` | `dice` | 2 |
| `miscast.json` | `ops` | `op` | 2 |
| `mutations.json` | `passive` | `amount,op` | 2 |
| `mutations.json` | `passive` | `mod,op,skill` | 2 |
| `mutations.json` | `passive` | `amount,noDeviation,op` | 2 |
| `mutations.json` | `passive` | `bare,damage,label,op,plusBF,qualities` | 2 |
| `naval-ports.json` | `surplus` | `sel` | 2 |
| `naval-ports.json` | `demande` | `armes,pieces-detachees-de-navire` | 2 |
| `naval-ports.json` | `surplus` | `metaux` | 2 |
| `naval-ports.json` | `demande` | `cereales` | 2 |
| `naval-traits.json` | `passive` | `amount,loc,op` | 2 |
| `naval-traits.json` | `passive` | `mod,op` | 2 |
| `psychology.json` | `of` | `kind,op,subject,value` | 2 |
| `qualities.json` | `flow` | `cond,kind,then` | 2 |
| `qualities.json` | `success` | `kind,steps` | 2 |
| `qualities.json` | `fail` | `effect,kind` | 2 |
| `qualities.json` | `passive` | `mode,op` | 2 |
| `qualities.json` | `capabilities` | `encDelta` | 2 |
| `raceAppearance.json` | `gabaritOverride` | `legs,sl` | 2 |
| `raceAppearance.json` | `paletteF` | `cheveux,cheveuxH,cheveuxO,peau,peauH,peauO` | 2 |
| `raceAppearance.json` | `colors` | `cuir,vet1,vet2` | 2 |
| `raceAppearance.json` | `colors` | `cuir,metal,vet1,vet2` | 2 |
| `raceAppearance.json` | `paletteF` | `cheveux,cheveuxH,cheveuxO,peau,peauO` | 2 |
| `river-criticals.json` | `crewHit` | `crewTarget,test` | 2 |
| `river-criticals.json` | `test` | `fail,kind,success,test` | 2 |
| `river-criticals.json` | `success` | `kind,steps` | 2 |
| `river-criticals.json` | `fail` | `effect,kind` | 2 |
| `river-criticals.json` | `effect` | `on,ops,type` | 2 |
| `river-criticals.json` | `crewHit` | `crewTarget,ops` | 2 |
| `river-navigation.json` | `cote` | `pct,tack` | 2 |
| `sea-cargo.json` | `outcomes` | `on,pct` | 2 |
| `sea-events.json` | `params` | `creatures,roll` | 2 |
| `sea-events.json` | `params` | `moraleD10` | 2 |
| `sea-events.json` | `params` | `manannD10,moraleD10,prayerDifficulty` | 2 |
| `sea-events.json` | `params` | `cargoEnc` | 2 |
| `sea-shanties.json` | `crewOps` | `bonus,op,skill` | 2 |
| `sea-weather.json` | `calme-plat` | `arriere,face,lateral` | 2 |
| `sea-weather.json` | `arriere` | `encalmine` | 2 |
| `sea-weather.json` | `lateral` | `encalmine` | 2 |
| `sea-weather.json` | `face` | `encalmine` | 2 |
| `sea-weather.json` | `legere-brise` | `arriere,face,lateral` | 2 |
| `sea-weather.json` | `brise-fraiche` | `arriere,face,lateral` | 2 |
| `sea-weather.json` | `lateral` | `pctOther,pctSail,virement` | 2 |
| `sea-weather.json` | `vent-modere` | `arriere,face,lateral` | 2 |
| `sea-weather.json` | `vent-violent` | `arriere,face,lateral` | 2 |
| `sea-weather.json` | `violente-tempete` | `arriere,face,lateral` | 2 |
| `sea-weather.json` | `arriere` | `affaler` | 2 |
| `sea-weather.json` | `lateral` | `pctSail,virement` | 2 |
| `skills.json` | `combatSubstitute` | `gate,role` | 2 |
| `spells.json` | `durationRounds` | `bonusOf` | 2 |
| `spells.json` | `damage` | `bonusOf` | 2 |
| `spells.json` | `indicePerSL` | `amount,every` | 2 |
| `spells.json` | `metersFormula` | `bonusOf` | 2 |
| `spells.json` | `ops` | `damage,label,op` | 2 |
| `spells.json` | `of` | `kind,op,subject,value` | 2 |
| `spells.json` | `subject` | `field,who` | 2 |
| `spells.json` | `affects` | `kind,of` | 2 |
| `spells.json` | `rounds` | `bonusOf` | 2 |
| `spells.json` | `lengthPerSL` | `every,metersFormula` | 2 |
| `spells.json` | `damageBonus` | `bonusOf` | 2 |
| `spells.json` | `ops` | `den,num,op,round` | 2 |
| `spells.json` | `ops` | `crossTest,onCross,op,radiusMeters,shape` | 2 |
| `spells.json` | `gate` | `kind,of` | 2 |
| `spells.json` | `ops` | `op,ops` | 2 |
| `spells.json` | `ops` | `count,countPerSL,op` | 2 |
| `spells.json` | `flow` | `fail,kind,success,test` | 2 |
| `spells.json` | `steps` | `kind,prompt,yes` | 2 |
| `spells.json` | `ops` | `char,durationHours,mod,op` | 2 |
| `spells.json` | `durationHours` | `bonusOf` | 2 |
| `spells.json` | `ops` | `op,what` | 2 |
| `spells.json` | `then` | `kind,steps` | 2 |
| `spells.json` | `ops` | `amount,char,op` | 2 |
| `structureAppearance.json` | `timber` | `color,postEveryM,wM` | 2 |
| `symptoms.json` | `passive` | `amount,op` | 2 |
| `symptoms.json` | `flow` | `cond,kind,then` | 2 |
| `symptoms.json` | `cond` | `kind,op,value` | 2 |
| `symptoms.json` | `then` | `effect,kind` | 2 |
| `symptoms.json` | `ops` | `op` | 2 |
| `talents.json` | `combat` | `reloadDR` | 2 |
| `talents.json` | `combat` | `reloadAssessAdvantage,reloadDR` | 2 |
| `talents.json` | `effects` | `flow,on,trigger` | 2 |
| `talents.json` | `combat` | `chargeDamageBonus` | 2 |
| `talents.json` | `flow` | `fail,kind,success,test` | 2 |
| `talents.json` | `reverseFailed` | `capDR,skills` | 2 |
| `tavernGames.json` | `winner` | `amount,op` | 2 |
| `tavernGames.json` | `ops` | `op` | 2 |
| `tavernGames.json` | `team` | `size` | 2 |
| `terrains.json` | `courses` | `blockWM,hM,joint,jointW,paletteVar,stagger` | 2 |
| `traits.json` | `flow` | `fail,kind,success,test` | 2 |
| `traits.json` | `ops` | `op` | 2 |
| `traits.json` | `passive` | `mod,op` | 2 |
| `traits.json` | `capabilities` | `mutationAtSpawn` | 2 |
| `traits.json` | `capabilities` | `territorial` | 2 |
| `traits.json` | `capabilities` | `psychIndice,psychType` | 2 |
| `traits.json` | `capabilities` | `darkSightTiles,seesInDark` | 2 |
| `traits.json` | `then` | `kind,steps` | 2 |
| `traits.json` | `cond` | `kind,op,subject,value` | 2 |
| `traits.json` | `subject` | `field,who` | 2 |
| `traits.json` | `of` | `is,kind` | 2 |
| `traits.json` | `passive` | `amount,op` | 2 |
| `traits.json` | `ops` | `op,sides,thresholds` | 2 |
| `traits.json` | `ops` | `count,op` | 2 |
| `traits.json` | `ops` | `den,num,op` | 2 |
| `traits.json` | `passive` | `blocked,op,skill` | 2 |
| `trappings.json` | `damage` | `literal` | 2 |
| `trappings.json` | `damage` | `bare,flat,plusBF` | 2 |
| `trappings.json` | `capabilities` | `waterContainer` | 2 |
| `trappings.json` | `capabilities` | `weatherProtection` | 2 |
| `trappings.json` | `consumable` | `kind,steps` | 2 |
| `trappings.json` | `steps` | `effect,kind` | 2 |
| `trappings.json` | `ops` | `afterDuration,op,ops` | 2 |
| `trappings.json` | `steps` | `fail,kind,success,test` | 2 |
| `trappings.json` | `ops` | `mod,op` | 2 |
| `trappings.json` | `ops` | `mod,op,skill` | 2 |
| `trappings.json` | `durationHours` | `dice` | 2 |
| `trappings.json` | `ops` | `onHitEffects,op` | 2 |
| `trappings.json` | `cond` | `kind,of` | 2 |
| `trappings.json` | `of` | `kind,op,value` | 2 |
| `trappings.json` | `of` | `kind,of` | 2 |
| `trappings.json` | `of` | `kind,op,subject,value` | 2 |
| `trappings.json` | `ops` | `level,op,skill` | 2 |
| `trappings.json` | `minutes` | `times` | 2 |
| `trappings.json` | `of` | `dice` | 2 |
| `trappings.json` | `prosthesisTraining` | `grants,label,px` | 2 |
| `trappings.json` | `flow` | `effect,kind` | 2 |
| `trappings.json` | `on` | `near,radiusMeters` | 2 |
| `traumas.json` | `cumul` | `parPalier,portee` | 2 |
| `traumas.json` | `cumul` | `escalade,parPalier,portee` | 2 |
| `water-exposure.json` | `auto` | `kind,op,value` | 2 |
| `activities.json` | `weatherMod` | `beau,blizzard,neige,pluie,pluie-diluvienne,sec` | 1 |
| `activities.json` | `weatherMod` | `sec` | 1 |
| `activities.json` | `extended` | `drPerStage` | 1 |
| `activities.json` | `onSuccess` | `op` | 1 |
| `activities.json` | `outcomes` | `minSL,note,resolver` | 1 |
| `activities.json` | `outcomes` | `maxSL,note,on,resolver` | 1 |
| `activities.json` | `outcomes` | `minSL,note,on` | 1 |
| `activities.json` | `ops` | `level,op,skill` | 1 |
| `activities.json` | `outcomes` | `maxSL,note,on,payoutPct` | 1 |
| `activities.json` | `difficultyFrom` | `gap,roundTo` | 1 |
| `activities.json` | `hold` | `breakpoint,enemyBonusPerHold,maxRounds` | 1 |
| `activities.json` | `threat` | `penalty` | 1 |
| `activities.json` | `ops` | `op` | 1 |
| `activities.json` | `testMods` | `label,mod` | 1 |
| `activities.json` | `testMods` | `label,mod,when` | 1 |
| `activities.json` | `when` | `kind,who` | 1 |
| `activities.json` | `outcomes` | `minSL,on,ops` | 1 |
| `activities.json` | `brass` | `times` | 1 |
| `activities.json` | `of` | `times` | 1 |
| `activities.json` | `of` | `bonusOf` | 1 |
| `activities.json` | `factor` | `sl` | 1 |
| `activities.json` | `unless` | `kind,of` | 1 |
| `activities.json` | `of` | `atLeast,kind,who` | 1 |
| `ambiance.json` | `fogTint` | `explored,unknown,visible` | 1 |
| `ambiance.json` | `faceShade` | `bas,haut,verticales` | 1 |
| `ambiance.json` | `entreeEnScene` | `plafondMs,rayonM` | 1 |
| `ambiance.json` | `iso` | `dayVignetteFloor,edgeDepth,lowerFloorDim,nightVeil,nightVeilMax,stageBg,vignette,warm,weather` | 1 |
| `ambiance.json` | `lowerFloorDim` | `saturate,slope` | 1 |
| `ambiance.json` | `edgeDepth` | `alpha,bottomFrac,color,topFrac` | 1 |
| `ambiance.json` | `weather` | `brouillard,neige,pluie,tempete` | 1 |
| `ambiance.json` | `pluie` | `alpha,density,particles,pcolor,precip,tint` | 1 |
| `ambiance.json` | `brouillard` | `alpha,brume,tint` | 1 |
| `ambiance.json` | `neige` | `alpha,density,particles,pcolor,precip,tint` | 1 |
| `ambiance.json` | `tempete` | `alpha,brume,density,particles,pcolor,precip,tint` | 1 |
| `ambiance.json` | `pov` | `ambientUnseen,depth,floorOcclusion,fogIndoor,fogOutdoor,fogOutdoorSurface,skyTop,vignette,warm` | 1 |
| `ambiance.json` | `depth` | `indoor,lod,outdoor` | 1 |
| `ambiance.json` | `outdoor` | `farTiles,fogGamma,fogStartT` | 1 |
| `ambiance.json` | `indoor` | `farTiles,fogGamma,fogStartT` | 1 |
| `ambiance.json` | `lod` | `blocksT,fadeT,meshFadeT,meshJointWM,meshShade,meshStartT,minJointSpacingPx` | 1 |
| `arcane-phenomena.json` | `scope` | `nonDominantWinds` | 1 |
| `arcane-phenomena.json` | `scope` | `chaosMagic` | 1 |
| `arene-projet.json` | `effect` | `type,weeks` | 1 |
| `arene-projet.json` | `effect` | `lodging,type` | 1 |
| `arene-projet.json` | `music` | `ambient` | 1 |
| `arene-projet.json` | `rest` | `auberge` | 1 |
| `arene-projet.json` | `entryPoints` | `entree,porte-arene,route` | 1 |
| `arene-projet.json` | `porte-arene` | `x,y` | 1 |
| `arene-projet.json` | `route` | `x,y` | 1 |
| `arene-projet.json` | `entree` | `x,y` | 1 |
| `arene-projet.json` | `char` | `B,M,agilite,capacite-de-combat,capacite-de-tir,dexterite,endurance,force,force-mentale,initiative,intelligence,sociabilite` | 1 |
| `arene-projet.json` | `combat` | `hiddenUntilCombat,optionals` | 1 |
| `barge-du-sel-projet.json` | `usable` | `actions` | 1 |
| `barge-du-sel-projet.json` | `onVictory` | `kind,steps` | 1 |
| `barge-du-sel-projet.json` | `effect` | `amount,type` | 1 |
| `barge-du-sel-projet.json` | `effect` | `montant,type` | 1 |
| `barge-du-sel-projet.json` | `entryPoints` | `arrivee` | 1 |
| `barge-du-sel-projet.json` | `arrivee` | `x,y` | 1 |
| `careerLevels.json` | `skills` | `of,pick` | 1 |
| `creatures.json` | `optionals` | `label,note` | 1 |
| `creatures.json` | `appearance` | `species,tenue` | 1 |
| `creatures.json` | `appearance` | `armurePortee,species` | 1 |
| `creatures.json` | `appearance` | `colors,species` | 1 |
| `creatures.json` | `colors` | `corps` | 1 |
| `creatures.json` | `parts` | `cheveux` | 1 |
| `criticals.json` | `lockedUntil` | `kind,op,subject,value` | 1 |
| `criticals.json` | `value` | `dice` | 1 |
| `criticals.json` | `escalation` | `onNextCritWhileCondition` | 1 |
| `criticals.json` | `ops` | `den,durationRounds,num,op` | 1 |
| `decorPalette.json` | `entries` | `arcaneFonce,arcaneFonce2,arcaneFonce3,arcaneFonce4,arcaneMoyen,arcaneSombre,arcaneSombre2,azurClair,azurFonce,azurFonce2,azurFonce3,azurFonce4,azurMoyen,azurMoyen2,azurSombre,azurTresClair,azurTresClair2,azurTresClair3,azurTresClair4,azurTresClair5,azurTresClair6,blanc,boisClair,boisClair10,boisClair11,boisClair12,boisClair2,boisClair3,boisClair4,boisClair5,boisClair6,boisClair7,boisClair8,boisClair9,boisFonce,boisFonce10,boisFonce11,boisFonce12,boisFonce13,boisFonce14,boisFonce15,boisFonce16,boisFonce17,boisFonce18,boisFonce19,boisFonce2,boisFonce20,boisFonce21,boisFonce22,boisFonce23,boisFonce24,boisFonce25,boisFonce26,boisFonce27,boisFonce28,boisFonce29,boisFonce3,boisFonce30,boisFonce31,boisFonce32,boisFonce33,boisFonce34,boisFonce35,boisFonce36,boisFonce37,boisFonce38,boisFonce39,boisFonce4,boisFonce40,boisFonce41,boisFonce42,boisFonce43,boisFonce44,boisFonce45,boisFonce46,boisFonce47,boisFonce48,boisFonce49,boisFonce5,boisFonce50,boisFonce51,boisFonce52,boisFonce6,boisFonce7,boisFonce8,boisFonce9,boisMoyen,boisMoyen10,boisMoyen11,boisMoyen12,boisMoyen13,boisMoyen14,boisMoyen15,boisMoyen16,boisMoyen17,boisMoyen18,boisMoyen19,boisMoyen2,boisMoyen20,boisMoyen21,boisMoyen22,boisMoyen23,boisMoyen24,boisMoyen25,boisMoyen3,boisMoyen4,boisMoyen5,boisMoyen6,boisMoyen7,boisMoyen8,boisMoyen9,boisSombre,boisSombre10,boisSombre11,boisSombre12,boisSombre13,boisSombre14,boisSombre15,boisSombre16,boisSombre17,boisSombre18,boisSombre19,boisSombre2,boisSombre20,boisSombre21,boisSombre22,boisSombre23,boisSombre24,boisSombre25,boisSombre3,boisSombre4,boisSombre5,boisSombre6,boisSombre7,boisSombre8,boisSombre9,boisTresClair,boisTresClair2,boisTresClair3,boisTresClair4,boisTresClair5,boisTresClair6,boisTresSombre,boisTresSombre2,boisTresSombre3,boisTresSombre4,feuillageClair,feuillageClair2,feuillageFonce,feuillageFonce10,feuillageFonce11,feuillageFonce12,feuillageFonce13,feuillageFonce14,feuillageFonce15,feuillageFonce16,feuillageFonce17,feuillageFonce18,feuillageFonce19,feuillageFonce2,feuillageFonce20,feuillageFonce21,feuillageFonce22,feuillageFonce23,feuillageFonce24,feuillageFonce3,feuillageFonce4,feuillageFonce5,feuillageFonce6,feuillageFonce7,feuillageFonce8,feuillageFonce9,feuillageMoyen,feuillageMoyen2,feuillageMoyen3,feuillageMoyen4,feuillageMoyen5,feuillageMoyen6,feuillageMoyen7,feuillageMoyen8,feuillageMoyen9,feuillageSombre,feuillageSombre10,feuillageSombre11,feuillageSombre12,feuillageSombre2,feuillageSombre3,feuillageSombre4,feuillageSombre5,feuillageSombre6,feuillageSombre7,feuillageSombre8,feuillageSombre9,feuillageTresClair,ombre,ombre10,ombre2,ombre3,ombre4,ombre5,ombre6,ombre7,ombre8,ombre9,orClair,orClair10,orClair11,orClair12,orClair13,orClair14,orClair15,orClair2,orClair3,orClair4,orClair5,orClair6,orClair7,orClair8,orClair9,orFonce,orFonce10,orFonce11,orFonce2,orFonce3,orFonce4,orFonce5,orFonce6,orFonce7,orFonce8,orFonce9,orMoyen,orMoyen10,orMoyen11,orMoyen12,orMoyen13,orMoyen2,orMoyen3,orMoyen4,orMoyen5,orMoyen6,orMoyen7,orMoyen8,orMoyen9,orSombre,orSombre2,orSombre3,orSombre4,orTresClair,orTresClair10,orTresClair11,orTresClair12,orTresClair13,orTresClair14,orTresClair15,orTresClair16,orTresClair17,orTresClair18,orTresClair19,orTresClair2,orTresClair20,orTresClair21,orTresClair3,orTresClair4,orTresClair5,orTresClair6,orTresClair7,orTresClair8,orTresClair9,osClair,osClair2,osClair3,osClair4,osClair5,osClair6,osClair7,osClair8,osMoyen,osMoyen2,osMoyen3,osMoyen4,osMoyen5,osMoyen6,osMoyen7,osMoyen8,osTresClair,osTresClair10,osTresClair2,osTresClair3,osTresClair4,osTresClair5,osTresClair6,osTresClair7,osTresClair8,osTresClair9,patineTresClair,patineTresClair2,pierreClair,pierreFonce,pierreFonce2,pierreFonce3,pierreFonce4,pierreFonce5,pierreFonce6,pierreFonce7,pierreMoyen,pierreMoyen2,pierreSombre,pierreSombre10,pierreSombre11,pierreSombre12,pierreSombre2,pierreSombre3,pierreSombre4,pierreSombre5,pierreSombre6,pierreSombre7,pierreSombre8,pierreSombre9,pierreTresClair,pierreTresClair2,pierreTresClair3,pierreTresSombre,pierreTresSombre2,pierreTresSombre3,pierreTresSombre4,pierreTresSombre5,pourpreFonce,pourpreFonce2,pourpreFonce3,pourpreFonce4,pourpreMoyen,pourpreSombre,pourpreTresClair,pourpreTresSombre,sangClair,sangFonce,sangFonce10,sangFonce11,sangFonce12,sangFonce13,sangFonce14,sangFonce15,sangFonce16,sangFonce17,sangFonce18,sangFonce19,sangFonce2,sangFonce20,sangFonce21,sangFonce22,sangFonce23,sangFonce24,sangFonce3,sangFonce4,sangFonce5,sangFonce6,sangFonce7,sangFonce8,sangFonce9,sangMoyen,sangMoyen2,sangMoyen3,sangMoyen4,sangMoyen5,sangMoyen6,sangSombre,sangSombre10,sangSombre11,sangSombre12,sangSombre13,sangSombre14,sangSombre15,sangSombre2,sangSombre3,sangSombre4,sangSombre5,sangSombre6,sangSombre7,sangSombre8,sangSombre9,sangTresSombre,sangTresSombre2,sangTresSombre3,terreFonce,terreFonce10,terreFonce11,terreFonce12,terreFonce13,terreFonce14,terreFonce15,terreFonce16,terreFonce17,terreFonce18,terreFonce2,terreFonce3,terreFonce4,terreFonce5,terreFonce6,terreFonce7,terreFonce8,terreFonce9,terreMoyen,terreMoyen2,terreMoyen3,terreMoyen4,terreMoyen5,terreMoyen6,terreMoyen7,terreMoyen8,terreSombre,terreSombre10,terreSombre11,terreSombre12,terreSombre13,terreSombre14,terreSombre15,terreSombre16,terreSombre2,terreSombre3,terreSombre4,terreSombre5,terreSombre6,terreSombre7,terreSombre8,terreSombre9,terreTresSombre,terreTresSombre2,terreTresSombre3,terreTresSombre4,villageoisBouche,villageoisCheveux,villageoisEtoffe,villageoisEtoffeClaire,villageoisPeau,villageoisPupille` | 1 |
| `details.json` | `ageBase` | `elfe-sylvain,gnome,halfling,haut-elfe,humain,nain,ogre` | 1 |
| `details.json` | `ageRoll` | `elfe-sylvain,gnome,halfling,haut-elfe,humain,nain,ogre` | 1 |
| `details.json` | `heightBase` | `elfe-sylvain,gnome,halfling,haut-elfe,humain,nain,ogre` | 1 |
| `details.json` | `heightRoll` | `elfe-sylvain,gnome,halfling,haut-elfe,humain,nain,ogre` | 1 |
| `details.json` | `nom` | `all,bySpecies` | 1 |
| `details.json` | `bySpecies` | `elfe-sylvain,gnome,halfling,haut-elfe,humain,nain,ogre` | 1 |
| `details.json` | `age` | `all,bySpecies` | 1 |
| `details.json` | `bySpecies` | `gnome,halfling,haut-elfe,humain,nain,ogre` | 1 |
| `details.json` | `taille` | `all,bySpecies` | 1 |
| `details.json` | `bySpecies` | `gnome,ogre` | 1 |
| `details.json` | `ambitionShort` | `all,bySpecies` | 1 |
| `details.json` | `ambitionLong` | `all,bySpecies` | 1 |
| `diligence-projet.json` | `speed` | `diligence` | 1 |
| `diligence-projet.json` | `rest` | `auberge,camp` | 1 |
| `domains.json` | `seaModifier` | `focalisationDR` | 1 |
| `domains.json` | `of` | `kind,op,subject,value` | 1 |
| `domains.json` | `seaModifier` | `focalisationDrDoubled,focusCritMiscastMajeure` | 1 |
| `domains.json` | `on` | `near,radiusMeters` | 1 |
| `domains.json` | `seaModifier` | `incantationCalmDR,incantationStormDR` | 1 |
| `domains.json` | `missile` | `bonusFromBypass,bypass` | 1 |
| `domains.json` | `durationRounds` | `dice` | 1 |
| `domains.json` | `seaModifier` | `critFumbleOnTens` | 1 |
| `donnees.manifest.json` | `homonymes` | `cas,intro` | 1 |
| `donnees.manifest.json` | `cas` | `entrees,lecon,mot` | 1 |
| `drunkenness.json` | `ops` | `mod,op,skill` | 1 |
| `drunkenness.json` | `ops` | `op` | 1 |
| `etats.json` | `passive` | `amount,hearingOnly,op` | 1 |
| `etats.json` | `lockedUntil` | `kind,op,subject,value` | 1 |
| `etats.json` | `subject` | `field,who` | 1 |
| `etats.json` | `passive` | `amount,combatOnly,op` | 1 |
| `etats.json` | `flow` | `cond,kind,then` | 1 |
| `etats.json` | `then` | `kind,steps` | 1 |
| `etats.json` | `gate` | `kind,of` | 1 |
| `etats.json` | `of` | `kind` | 1 |
| `etats.json` | `cond` | `kind,op,value` | 1 |
| `etats.json` | `recover` | `characteristic,opposedBy` | 1 |
| `etats.json` | `ops` | `amount,apFrom,ignoreAP,ignoreTB,min,op` | 1 |
| `etats.json` | `sum` | `dice` | 1 |
| `etats.json` | `sum` | `stacks` | 1 |
| `etats.json` | `gating` | `action,movement` | 1 |
| `etats.json` | `ops` | `amount,ignoreAP,ignoreTB,min,op` | 1 |
| `etats.json` | `value` | `stacks` | 1 |
| `etats.json` | `flow` | `kind,steps` | 1 |
| `gods.json` | `sinLocks` | `beni,invocation` | 1 |
| `grapple.json` | `win` | `damage,entangle,free` | 1 |
| `grapple.json` | `damage` | `amount,ignoreAP,ignoreTB,op,perSL` | 1 |
| `grapple.json` | `perSL` | `amount,every` | 1 |
| `grapple.json` | `valuePerSL` | `amount,every` | 1 |
| `incidents-monture.json` | `mount` | `endCondition,riderTest,ridingPenalty` | 1 |
| `incidents-monture.json` | `mount` | `endCondition,forcedAllure,riderTest` | 1 |
| `incidents-monture.json` | `mount` | `preventsMount` | 1 |
| `incidents-monture.json` | `mount` | `notHealedByCare,outcome,preventsMount` | 1 |
| `interludeEvents.json` | `fx` | `bankPct,revenuePct` | 1 |
| `interludeEvents.json` | `fx` | `fortuneMaxDelta` | 1 |
| `interludeEvents.json` | `fx` | `revenueBlockedClasses` | 1 |
| `interludeEvents.json` | `fx` | `stashRaided` | 1 |
| `land-cargo.json` | `merchantSkill` | `d10,plus` | 1 |
| `localisation.json` | `shapes` | `araignee,humanoide,serpent` | 1 |
| `loup-et-saumure-projet.json` | `flow` | `cond,else,kind,then` | 1 |
| `loup-et-saumure-projet.json` | `then` | `kind,steps` | 1 |
| `loup-et-saumure-projet.json` | `else` | `kind,steps` | 1 |
| `loup-et-saumure-projet.json` | `choices` | `flow,label,when` | 1 |
| `loup-et-saumure-projet.json` | `effect` | `saboteurDR,type` | 1 |
| `loup-et-saumure-projet.json` | `threat` | `camp,tier` | 1 |
| `maladies.json` | `infectionPassive` | `amount,op` | 1 |
| `maladies.json` | `test` | `fail,kind,success,test` | 1 |
| `maladies.json` | `success` | `kind,steps` | 1 |
| `maladies.json` | `fail` | `effect,kind` | 1 |
| `maladies.json` | `effect` | `on,ops,type` | 1 |
| `maladies.json` | `reExposition` | `prolonge` | 1 |
| `maladies.json` | `prolonge` | `dice,unit` | 1 |
| `maneuvers.json` | `flow` | `cond,kind,then` | 1 |
| `maneuvers.json` | `cond` | `kind,op,subject,value` | 1 |
| `maneuvers.json` | `subject` | `field,who` | 1 |
| `maneuvers.json` | `value` | `field,who` | 1 |
| `maneuvers.json` | `ops` | `amount,ignoreAP,ignoreTB,op,perSL` | 1 |
| `maneuvers.json` | `perSL` | `amount,every` | 1 |
| `maneuvers.json` | `flow` | `cond,else,kind,then` | 1 |
| `maneuvers.json` | `then` | `kind,steps` | 1 |
| `maneuvers.json` | `ops` | `id,op` | 1 |
| `maneuvers.json` | `ops` | `op` | 1 |
| `maneuvers.json` | `else` | `cond,kind,then` | 1 |
| `maneuvers.json` | `blast` | `plus` | 1 |
| `maneuvers.json` | `amount` | `bonusOf` | 1 |
| `maneuvers.json` | `ops` | `mod,op` | 1 |
| `maneuvers.json` | `ops` | `op,tag` | 1 |
| `materials.json` | `detail` | `courses,seedScope,tufts` | 1 |
| `materials.json` | `tufts` | `colors,hM,perM2` | 1 |
| `materials.json` | `detail` | `courses,seedScope,speckle` | 1 |
| `materials.json` | `speckle` | `colors,perM2,rM` | 1 |
| `materials.json` | `courses` | `blockWM,edgeWobble,hM,joint,jointW,paletteVar,stagger` | 1 |
| `merchantFamilies.json` | `match` | `categorie` | 1 |
| `merchantFamilies.json` | `match` | `shield` | 1 |
| `merchantFamilies.json` | `match` | `unit` | 1 |
| `merchantFamilies.json` | `match` | `` | 1 |
| `miscast.json` | `value` | `dice` | 1 |
| `miscast.json` | `ops` | `days,maxZeroDR,op,skill` | 1 |
| `miscast.json` | `onFailHard` | `dr,ops` | 1 |
| `mutations.json` | `appearance` | `eyes` | 1 |
| `mutations.json` | `effects` | `flow,on,trigger` | 1 |
| `mutations.json` | `flow` | `effect,kind` | 1 |
| `mutations.json` | `effect` | `on,ops,type` | 1 |
| `names.json` | `lastNameSuffixes` | `F,M` | 1 |
| `naval-ports.json` | `demande` | `armes,produits-de-luxe` | 1 |
| `naval-ports.json` | `demande` | `armes,bois,metaux,produits-de-luxe` | 1 |
| `naval-ports.json` | `demande` | `produits-de-luxe` | 1 |
| `naval-ports.json` | `demande` | `armes,bois,metaux,pieces-detachees-de-navire` | 1 |
| `naval-ports.json` | `demande` | `laine` | 1 |
| `naval-ports.json` | `demande` | `cereales,produits-de-luxe` | 1 |
| `naval-ports.json` | `demande` | `armes,metaux` | 1 |
| `naval-ports.json` | `demande` | `bois,vin` | 1 |
| `naval-ports.json` | `demande` | `armes,cereales,metaux` | 1 |
| `naval-ports.json` | `surplus` | `cereales` | 1 |
| `naval-ports.json` | `demande` | `armes,bois` | 1 |
| `naval-ports.json` | `demande` | `armes,cereales,pieces-detachees-de-navire` | 1 |
| `naval-ports.json` | `surplus` | `laine` | 1 |
| `naval-ports.json` | `demande` | `sel` | 1 |
| `naval-ports.json` | `demande` | `huile` | 1 |
| `naval-ports.json` | `surplus` | `vin` | 1 |
| `naval-ports.json` | `demande` | `cereales,laine` | 1 |
| `naval-ports.json` | `demande` | `bois` | 1 |
| `naval-ports.json` | `demande` | `bois,cereales` | 1 |
| `naval-ports.json` | `demande` | `cereales,huile` | 1 |
| `naval-traits.json` | `ram` | `ap,ic` | 1 |
| `naval-traits.json` | `install` | `installation` | 1 |
| `naval-traits.json` | `passive` | `den,num,op` | 1 |
| `problemes-vehicule.json` | `occupantOps` | `amount,ignoreAP,ignoreTB,op` | 1 |
| `problemes-vehicule.json` | `occupantOps` | `amount,ignoreAP,ignoreTB,min,op` | 1 |
| `problemes-vehicule.json` | `amount` | `dice` | 1 |
| `psychology.json` | `passive` | `amount,op` | 1 |
| `psychology.json` | `passive` | `op,weapon,when` | 1 |
| `psychology.json` | `effects` | `flow,on,trigger` | 1 |
| `psychology.json` | `flow` | `cond,kind,then` | 1 |
| `psychology.json` | `cond` | `kind,of` | 1 |
| `psychology.json` | `of` | `kind,of` | 1 |
| `psychology.json` | `of` | `kind` | 1 |
| `psychology.json` | `then` | `effect,kind` | 1 |
| `psychology.json` | `effect` | `on,ops,type` | 1 |
| `psychology.json` | `failAmount` | `base,perDegreeOfFailure` | 1 |
| `qualities.json` | `capabilities` | `firearm` | 1 |
| `qualities.json` | `capabilities` | `magazine` | 1 |
| `qualities.json` | `cond` | `is,kind` | 1 |
| `qualities.json` | `then` | `fail,kind,success,test` | 1 |
| `qualities.json` | `opposed` | `attacker` | 1 |
| `qualities.json` | `capabilities` | `siege` | 1 |
| `qualities.json` | `capabilities` | `ram` | 1 |
| `qualities.json` | `passive` | `equals,mod,op` | 1 |
| `qualities.json` | `effects` | `attackType,flow,on,trigger` | 1 |
| `qualities.json` | `flow` | `effect,kind` | 1 |
| `qualities.json` | `capabilities` | `explosion,firearm` | 1 |
| `qualities.json` | `capabilities` | `unbreakable` | 1 |
| `qualities.json` | `passive` | `op,plusUnits` | 1 |
| `qualities.json` | `passive` | `amount,bypass,op` | 1 |
| `qualities.json` | `capabilities` | `pushback` | 1 |
| `qualities.json` | `capabilities` | `bladeTrap` | 1 |
| `qualities.json` | `capabilities` | `canFireWhileEngaged` | 1 |
| `qualities.json` | `passive` | `flatMod,op,phase` | 1 |
| `qualities.json` | `capabilities` | `parryAP` | 1 |
| `qualities.json` | `capabilities` | `fastStrike` | 1 |
| `qualities.json` | `flow` | `advantageCost,icon,kind,prompt,yes` | 1 |
| `qualities.json` | `yes` | `fail,kind,success,test` | 1 |
| `qualities.json` | `indice` | `label,unite` | 1 |
| `qualities.json` | `steps` | `advantageCost,icon,kind,prompt,yes` | 1 |
| `qualities.json` | `yes` | `effect,kind` | 1 |
| `qualities.json` | `capabilities` | `areaFire` | 1 |
| `qualities.json` | `capabilities` | `salvo` | 1 |
| `qualities.json` | `capabilities` | `damagesArmour` | 1 |
| `qualities.json` | `capabilities` | `crewedTeam` | 1 |
| `qualities.json` | `capabilities` | `fumbleOn9` | 1 |
| `qualities.json` | `passive` | `chargeGated,op` | 1 |
| `qualities.json` | `passive` | `negateAtouts,op` | 1 |
| `qualities.json` | `capabilities` | `layerable` | 1 |
| `qualities.json` | `capabilities` | `critImmuneOdd` | 1 |
| `qualities.json` | `capabilities` | `apIgnoredOnEven` | 1 |
| `qualities.json` | `capabilities` | `apIgnoredOnImpaleCrit` | 1 |
| `qualities.json` | `indice` | `label` | 1 |
| `qualities.json` | `cond` | `kind,op,value` | 1 |
| `qualities.json` | `then` | `effect,kind` | 1 |
| `qualities.json` | `capabilities` | `fumbleDigits` | 1 |
| `raceAppearance.json` | `gabaritOverride` | `sl,st` | 1 |
| `raceAppearance.json` | `palette` | `cheveux,cheveuxH,peau,peauH,peauO` | 1 |
| `raceAppearance.json` | `palette` | `cheveux,cheveuxH,cheveuxO,peau` | 1 |
| `raceAppearance.json` | `palette` | `cheveux,cheveuxO,peau,peauO` | 1 |
| `raceAppearance.json` | `paletteF` | `cheveux,cheveuxH,peau,peauO` | 1 |
| `raceAppearance.json` | `tirageIndividuel` | `cheveux,peau` | 1 |
| `raceAppearance.json` | `parts` | `cheveux,visage` | 1 |
| `raceAppearance.json` | `eyes` | `D,G` | 1 |
| `reglesOptionnelles.json` | `action` | `icon,label,run,when` | 1 |
| `rencontres-edoc.json` | `tables` | `dangereuses,fortuites,positives` | 1 |
| `river-criticals.json` | `replisSansExpose` | `cible,maison` | 1 |
| `river-criticals.json` | `tables` | `avirons,coque,gouvernail,greement,superstructure` | 1 |
| `river-criticals.json` | `crewTarget` | `role` | 1 |
| `river-navigation.json` | `windEffect` | `calme,fort,leger,modere,tres-fort` | 1 |
| `river-navigation.json` | `calme` | `arriere,contraire,cote` | 1 |
| `river-navigation.json` | `arriere` | `drift` | 1 |
| `river-navigation.json` | `cote` | `drift` | 1 |
| `river-navigation.json` | `contraire` | `drift` | 1 |
| `river-navigation.json` | `leger` | `arriere,contraire,cote` | 1 |
| `river-navigation.json` | `cote` | `pct` | 1 |
| `river-navigation.json` | `modere` | `arriere,contraire,cote` | 1 |
| `river-navigation.json` | `fort` | `arriere,contraire,cote` | 1 |
| `river-navigation.json` | `tres-fort` | `arriere,contraire,cote` | 1 |
| `river-navigation.json` | `cote` | `capsizeRisk` | 1 |
| `river-navigation.json` | `contraire` | `pct,riggingRisk` | 1 |
| `river-perils.json` | `onFail` | `damagePerHit,hullHits` | 1 |
| `river-perils.json` | `obstacle` | `endurance,enduranceMult,ramDamage,wounds` | 1 |
| `river-perils.json` | `clear` | `encPerHour,encPerObject,objects` | 1 |
| `river-perils.json` | `onHit` | `echouageChancePct,holeChancePct,hullDamage` | 1 |
| `river-perils.json` | `onHit` | `echouageChancePct,hullDamage` | 1 |
| `sea-cargo.json` | `merchantSkill` | `d10,plus` | 1 |
| `sea-cargo.json` | `bigPortSkill` | `d10,plus` | 1 |
| `sea-cargo.json` | `offerPrice` | `max,min,pct` | 1 |
| `sea-cargo.json` | `sellerDR` | `demand,noProduce,produces,surplus` | 1 |
| `sea-cargo.json` | `outcomes` | `minMissing,on,pct` | 1 |
| `sea-cargo.json` | `outcomes` | `minExtraDR,on,pct` | 1 |
| `sea-events.json` | `params` | `impressed,victoryRoll,wrathful` | 1 |
| `sea-events.json` | `params` | `critLocation,crits` | 1 |
| `sea-events.json` | `params` | `allegianceRoll,initiatesRoll` | 1 |
| `sea-events.json` | `params` | `spoilPct` | 1 |
| `sea-events.json` | `params` | `mMod,manDR` | 1 |
| `sea-events.json` | `params` | `detourDays,detourMMod,moraleD10` | 1 |
| `sea-events.json` | `params` | `biscuitDays,cargoCrates,co,resistDifficulty,waterBarrels` | 1 |
| `sea-events.json` | `params` | `wounds` | 1 |
| `sea-events.json` | `params` | `contents,roll` | 1 |
| `sea-events.json` | `params` | `mMod` | 1 |
| `sea-events.json` | `params` | `failExtraLostCrew,gossipDifficulty,lostCrew,ransomCO,stealthDifficulty` | 1 |
| `sea-events.json` | `params` | `blessingCO,blessingSilverPerSize,manannD10` | 1 |
| `sea-events.json` | `params` | `maxSize,moraleD10` | 1 |
| `sea-events.json` | `params` | `lostEnc` | 1 |
| `sea-events.json` | `params` | `daysPerJob,metier` | 1 |
| `sea-events.json` | `metier` | `charpentier,constructeur-de-navires,tailleur` | 1 |
| `sea-events.json` | `params` | `discountPct,maxEnc` | 1 |
| `sea-events.json` | `params` | `contents,discoverDays,perceptionDifficulty,roll` | 1 |
| `sea-events.json` | `params` | `days,demandBonus,gossipDifficulty` | 1 |
| `sea-events.json` | `params` | `manannD10` | 1 |
| `sea-events.json` | `params` | `rewardCO` | 1 |
| `sea-events.json` | `params` | `rationPriceBronze` | 1 |
| `sea-navigation.json` | `driftSide` | `tribordMax` | 1 |
| `sea-navigation.json` | `temporaire` | `difficultyMax,difficultyMin,failDamage,hoursPerRepair,woundsPerRepair` | 1 |
| `sea-perils.json` | `entanglePenalties` | `mMod,manDR,maxSize` | 1 |
| `sea-perils.json` | `entanglePenalties` | `mMod,manDR,maxSize,minSize` | 1 |
| `sea-shanties.json` | `crewOps` | `mod,op` | 1 |
| `sea-shanties.json` | `crewOps` | `mod,op,skill` | 1 |
| `sea-shanties.json` | `crewOps` | `count,op` | 1 |
| `sea-weather.json` | `effetDuVent` | `brise-fraiche,calme-plat,legere-brise,vent-modere,vent-violent,violente-tempete` | 1 |
| `sea-weather.json` | `lateral` | `pctOther,pctSail` | 1 |
| `sea-weather.json` | `lateral` | `affaler,pctOther` | 1 |
| `sea-weather.json` | `face` | `affaler,pctOther` | 1 |
| `sea-weather.json` | `effetDuVentClinfoc` | `brise-fraiche,calme-plat,legere-brise,vent-modere,vent-violent,violente-tempete` | 1 |
| `sea-weather.json` | `lateral` | `pctSail` | 1 |
| `sea-weather.json` | `effetDuVentGreementDelta` | `arriere,face,lateral` | 1 |
| `sea-weather.json` | `encalmine` | `currentM,towM,towManDR` | 1 |
| `ship-construction.json` | `lengthM` | `max,min` | 1 |
| `ship-criticals.json` | `shrapnelHit` | `amount,ignoreAP,ignoreTB,op` | 1 |
| `ship-criticals.json` | `replisSansExpose` | `cible` | 1 |
| `ship-criticals.json` | `tables` | `avirons,cargaison,coque,equipements,greement` | 1 |
| `ship-criticals.json` | `crewTarget` | `poste` | 1 |
| `ship-criticals.json` | `ops` | `amount,ignoreAP,ignoreTB,op` | 1 |
| `ship-criticals.json` | `ops` | `op` | 1 |
| `sizes.json` | `rangedMod` | `enorme,grande,minuscule,monstrueuse,moyenne,petite,tresPetite` | 1 |
| `sizes.json` | `shipboardEnc` | `enorme,grande,minuscule,monstrueuse,moyenne,petite,tresPetite` | 1 |
| `sizes.json` | `footprintSide` | `enorme,grande,minuscule,monstrueuse,moyenne,petite,tresPetite` | 1 |
| `skills.json` | `tool` | `capability,withoutMod` | 1 |
| `spells.json` | `ops` | `days,oncePerDisease,op` | 1 |
| `spells.json` | `ops` | `material,op` | 1 |
| `spells.json` | `ops` | `hopMeters,maxBounces,op` | 1 |
| `spells.json` | `maxBounces` | `bonusOf` | 1 |
| `spells.json` | `hopMeters` | `bonusOf` | 1 |
| `spells.json` | `indice` | `charOf` | 1 |
| `spells.json` | `of` | `kind,of` | 1 |
| `spells.json` | `ops` | `amount,op,resource,temporary` | 1 |
| `spells.json` | `ops` | `mod,op,rounds` | 1 |
| `spells.json` | `ops` | `lengthMeters,lengthPerSL,onCross,op,shape` | 1 |
| `spells.json` | `lengthMeters` | `bonusOf` | 1 |
| `spells.json` | `onCross` | `amount,ignoreAP,ignoreTB,op` | 1 |
| `spells.json` | `ops` | `barrier,gate,noCorruption,op,perRound,shape` | 1 |
| `spells.json` | `ops` | `blocked,op,rounds` | 1 |
| `spells.json` | `metersFormula` | `charOf` | 1 |
| `spells.json` | `count` | `bonusOf` | 1 |
| `spells.json` | `cond` | `is,kind` | 1 |
| `spells.json` | `ops` | `amount,op,perSL,resource` | 1 |
| `spells.json` | `ops` | `op,perSL,radius` | 1 |
| `spells.json` | `radius` | `bonusOf` | 1 |
| `spells.json` | `perSL` | `every,radiusFormula` | 1 |
| `spells.json` | `radiusFormula` | `bonusOf` | 1 |
| `spells.json` | `target` | `kind,lengthMeters,widthMeters` | 1 |
| `spells.json` | `target` | `affects,kind,maison,meters,span` | 1 |
| `spells.json` | `ops` | `blocksLoS,lengthMeters,lengthPerSL,op,shape` | 1 |
| `spells.json` | `fail` | `kind,no,prompt,yes` | 1 |
| `spells.json` | `ops` | `easeSteps,op` | 1 |
| `spells.json` | `factor` | `dice` | 1 |
| `spells.json` | `passive` | `drMod,op,phase` | 1 |
| `spells.json` | `ops` | `amount,atHitLocation,op` | 1 |
| `spells.json` | `value` | `dice` | 1 |
| `spells.json` | `test` | `characteristic,label` | 1 |
| `spells.json` | `yes` | `fail,kind,success,test` | 1 |
| `spells.json` | `yes` | `kind,no,prompt,yes` | 1 |
| `spells.json` | `no` | `kind,no,prompt,yes` | 1 |
| `spells.json` | `test` | `characteristic` | 1 |
| `spells.json` | `ops` | `char,op` | 1 |
| `spells.json` | `ops` | `amount,bypassArmour,ignoreAP,ignoreTB,op` | 1 |
| `spells.json` | `yes` | `cond,kind,then` | 1 |
| `spells.json` | `no` | `kind,steps` | 1 |
| `spells.json` | `cond` | `kind,op,subject,value` | 1 |
| `spells.json` | `ops` | `narration,op` | 1 |
| `spells.json` | `perRound` | `amount,ignoreAP,ignoreTB,op,perSL` | 1 |
| `spells.json` | `target` | `affects,excludesCaster,kind,meters,span` | 1 |
| `spells.json` | `steps` | `cond,else,kind,then` | 1 |
| `spells.json` | `amount` | `times` | 1 |
| `spells.json` | `else` | `effect,kind` | 1 |
| `spells.json` | `ops` | `op,radiusMeters,shape` | 1 |
| `spells.json` | `ops` | `char,durationRounds,mod,op` | 1 |
| `spells.json` | `ritual` | `components,conditions,consequences,domains,reduced,sacrifices,type,xp` | 1 |
| `structureAppearance.json` | `door` | `herse,lintelPx,openingFrac` | 1 |
| `structureAppearance.json` | `herse` | `bars,topFrac,traverseColor,traverseFracs` | 1 |
| `symptoms.json` | `passiveBySeverity` | `grave` | 1 |
| `symptoms.json` | `resolveWindow` | `minutes,scale` | 1 |
| `symptoms.json` | `passiveBySeverity` | `moderee` | 1 |
| `symptoms.json` | `flow` | `fail,kind,success,test` | 1 |
| `symptoms.json` | `gate` | `kind,op,value` | 1 |
| `symptoms.json` | `capabilities` | `amputation,blocksHealing` | 1 |
| `symptoms.json` | `onTick` | `test` | 1 |
| `symptoms.json` | `capabilities` | `blocksHealing` | 1 |
| `symptoms.json` | `onTick` | `difficultyBySeverity,test` | 1 |
| `symptoms.json` | `difficultyBySeverity` | `grave,moderee` | 1 |
| `symptoms.json` | `capabilities` | `endTest` | 1 |
| `symptoms.json` | `capabilities` | `nausea` | 1 |
| `symptoms.json` | `capabilities` | `contagious` | 1 |
| `symptoms.json` | `onTick` | `afterDays,test` | 1 |
| `symptoms.json` | `ops` | `addNegativeSL,die,op,rows` | 1 |
| `symptoms.json` | `capabilities` | `persistentActive` | 1 |
| `symptoms.json` | `onTick` | `afterDays,once,ops` | 1 |
| `symptoms.json` | `ops` | `amount,ignoreAP,ignoreTB,op` | 1 |
| `tables.json` | `ops` | `montant,op` | 1 |
| `tables.json` | `montant` | `brass` | 1 |
| `tables.json` | `brass` | `times` | 1 |
| `tables.json` | `times` | `factor,of` | 1 |
| `tables.json` | `ops` | `mod,op` | 1 |
| `talents.json` | `combat` | `offHandPenalty` | 1 |
| `talents.json` | `offHandPenalty` | `perLevel,zeroAt` | 1 |
| `talents.json` | `combat` | `corruptionThreshold` | 1 |
| `talents.json` | `flow` | `effect,kind` | 1 |
| `talents.json` | `ops` | `advantageOrMovement,op,weapon,when` | 1 |
| `talents.json` | `combat` | `battement` | 1 |
| `talents.json` | `combat` | `fearSizeAsMount` | 1 |
| `talents.json` | `combat` | `surgery` | 1 |
| `talents.json` | `combat` | `braveheart` | 1 |
| `talents.json` | `combat` | `brawlDamageBonus` | 1 |
| `talents.json` | `combat` | `initiativeBonus` | 1 |
| `talents.json` | `effects` | `flow,on,optional,trigger` | 1 |
| `talents.json` | `combat` | `commandTeam` | 1 |
| `talents.json` | `combat` | `encumbranceBonus` | 1 |
| `talents.json` | `combat` | `transferWeight` | 1 |
| `talents.json` | `combat` | `meleeDamageBonus` | 1 |
| `talents.json` | `combat` | `castNoMiscastOnDouble` | 1 |
| `talents.json` | `combat` | `distraire` | 1 |
| `talents.json` | `mod` | `bonusOf` | 1 |
| `talents.json` | `combat` | `causesFear` | 1 |
| `talents.json` | `combat` | `bleedIgnore` | 1 |
| `talents.json` | `combat` | `ignoreCalledShotHead` | 1 |
| `talents.json` | `combat` | `critExtraWounds` | 1 |
| `talents.json` | `combat` | `critExtraWounds,critRollTwice` | 1 |
| `talents.json` | `flow` | `icon,kind,no,prompt,yes` | 1 |
| `talents.json` | `yes` | `fail,kind,success,test` | 1 |
| `talents.json` | `ops` | `op,perChargerOncePerRound,weapon,when` | 1 |
| `talents.json` | `no` | `kind,steps` | 1 |
| `talents.json` | `combat` | `fleeBonus` | 1 |
| `talents.json` | `combat` | `fleeBonus,pursuitTargetBonus` | 1 |
| `talents.json` | `combat` | `focusNoMiscastOnDouble` | 1 |
| `talents.json` | `combat` | `disengageWithLessAdvantage,keepAdvantageOnDisengage` | 1 |
| `talents.json` | `combat` | `disengageWithLessAdvantage,keepAdvantageOnDisengage,retreatCost` | 1 |
| `talents.json` | `valuePerSL` | `amount,every` | 1 |
| `talents.json` | `combat` | `outnumberCount` | 1 |
| `talents.json` | `combat` | `attackModes` | 1 |
| `talents.json` | `combat` | `bargainBonus` | 1 |
| `talents.json` | `combat` | `shieldAdvantage` | 1 |
| `talents.json` | `combat` | `advantageDefenseReaction,shieldAdvantage` | 1 |
| `talents.json` | `advantageDefenseReaction` | `avantage` | 1 |
| `talents.json` | `combat` | `stealAdvantage` | 1 |
| `talents.json` | `combat` | `stealAdvantage,stealOne` | 1 |
| `talents.json` | `passive` | `amount,op` | 1 |
| `talents.json` | `combat` | `counterOnDefenseWin,counterRequiresFastParry` | 1 |
| `talents.json` | `combat` | `damageReduction` | 1 |
| `talents.json` | `combat` | `fearImmune` | 1 |
| `talents.json` | `combat` | `runBonus` | 1 |
| `talents.json` | `combat` | `ignoreSizeRangedMods` | 1 |
| `talents.json` | `combat` | `sniper` | 1 |
| `talents.json` | `combat` | `ignoreCalledShotRanged` | 1 |
| `talents.json` | `combat` | `rangedDamageBonus` | 1 |
| `talents.json` | `combat` | `strikeFirstRanged` | 1 |
| `talents.json` | `combat` | `rangedAPIgnore` | 1 |
| `talents.json` | `combat` | `slayer` | 1 |
| `talents.json` | `passive` | `mod,op` | 1 |
| `talents.json` | `combat` | `surpriseSave` | 1 |
| `talents.json` | `combat` | `seaShanty` | 1 |
| `tavernGames.json` | `pot` | `dice,manchesPerPlayer,roundsPerManche,rows,targetRange` | 1 |
| `tavernGames.json` | `roundOps` | `attrition,attritionEvery,winner` | 1 |
| `tavernGames.json` | `attritionEvery` | `charBonus` | 1 |
| `tavernGames.json` | `volley` | `critique,gain,manches,pick,reserve,rows,throws` | 1 |
| `tavernGames.json` | `volley` | `gain,manches,throws` | 1 |
| `tavernGames.json` | `volley` | `critique,depassement,exact,gain,libre,maladresse,manchesBorne,ordre,throws` | 1 |
| `tavernGames.json` | `lines` | `balayage,echec,manque,reussite` | 1 |
| `tavernGames.json` | `roundOps` | `winner` | 1 |
| `tavernGames.json` | `volley` | `critique,gain,manches,pick,rows,throws` | 1 |
| `teintesJeu.json` | `entries` | `anneau-actif,anneau-ennemi,bande-bonus,bande-malus,bande-neutre,editeur-calage-aplat,editeur-calage-aretes,equipe-allie,equipe-ennemi,equipe-neutre,identite-heros-1,identite-heros-2,identite-heros-3,identite-heros-4,or-contour,or-halo,or-surbrillance,signal-allie,signal-cible,signal-engagement,signal-ennemi,signal-foule,signal-invalide,signal-menace,zone-course,zone-feu,zone-fumee,zone-intention,zone-marche` | 1 |
| `terrains.json` | `detail` | `seedScope,tintVar` | 1 |
| `terrains.json` | `detail` | `seedScope,tintVar,tufts` | 1 |
| `terrains.json` | `tufts` | `colors,hM,perM2` | 1 |
| `terrains.json` | `stops` | `0%,100%,45%` | 1 |
| `traits.json` | `naturalWeapon` | `ranged` | 1 |
| `traits.json` | `capabilities` | `coldBlooded` | 1 |
| `traits.json` | `capabilities` | `psychImmuneIfAhead` | 1 |
| `traits.json` | `capabilities` | `bestial` | 1 |
| `traits.json` | `capabilities` | `leap` | 1 |
| `traits.json` | `capabilities` | `counterOnDefenseWin` | 1 |
| `traits.json` | `capabilities` | `bonusWoundsBE` | 1 |
| `traits.json` | `passive` | `mode,op,unlessKeyword` | 1 |
| `traits.json` | `capabilities` | `mindless,woundsUseForce` | 1 |
| `traits.json` | `capabilities` | `stride` | 1 |
| `traits.json` | `capabilities` | `frenzyCapable` | 1 |
| `traits.json` | `capabilities` | `autoClimb,climbFullSpeed` | 1 |
| `traits.json` | `capabilities` | `damageImmunity` | 1 |
| `traits.json` | `capabilities` | `psychImmune` | 1 |
| `traits.json` | `capabilities` | `painless` | 1 |
| `traits.json` | `capabilities` | `unstable` | 1 |
| `traits.json` | `amount` | `engagedAdvantageGap` | 1 |
| `traits.json` | `steps` | `cond,kind,then` | 1 |
| `traits.json` | `ops` | `narration,op` | 1 |
| `traits.json` | `capabilities` | `spellcaster` | 1 |
| `traits.json` | `ops` | `disease,op` | 1 |
| `traits.json` | `capabilities` | `skittishMount` | 1 |
| `traits.json` | `capabilities` | `swarm` | 1 |
| `traits.json` | `aura` | `affects,passive,rangeChar` | 1 |
| `traits.json` | `capabilities` | `wardSave` | 1 |
| `traits.json` | `capabilities` | `rage` | 1 |
| `traits.json` | `flow` | `cond,else,kind,then` | 1 |
| `traits.json` | `amount` | `rolled` | 1 |
| `traits.json` | `else` | `effect,kind` | 1 |
| `traits.json` | `ops` | `amount,ignoreAP,ignoreTB,min,op` | 1 |
| `traits.json` | `amount` | `dice` | 1 |
| `traits.json` | `capabilities` | `freeTrample` | 1 |
| `traits.json` | `capabilities` | `stupid` | 1 |
| `traits.json` | `of` | `kind,op,value` | 1 |
| `traits.json` | `then` | `fail,kind,success,test` | 1 |
| `traits.json` | `capabilities` | `fly` | 1 |
| `traits.json` | `on` | `max,pick,sizeAtMost` | 1 |
| `traits.json` | `amount` | `woundsDealt` | 1 |
| `traits.json` | `ops` | `difficultyShift,disease,incubation,op` | 1 |
| `traits.json` | `count` | `dice` | 1 |
| `traits.json` | `ops` | `amount,feedOpposingPool,op` | 1 |
| `traits.json` | `ops` | `cancelFlag,delayDays,op,ref` | 1 |
| `traits.json` | `delayDays` | `dice` | 1 |
| `traits.json` | `capabilities` | `structResistant` | 1 |
| `traits.json` | `capabilities` | `structImpenetrable` | 1 |
| `traits.json` | `on` | `near,radiusMeters` | 1 |
| `traits.json` | `valuePerSL` | `amount,every,onFailure` | 1 |
| `traits.json` | `capabilities` | `noRun` | 1 |
| `traits.json` | `capabilities` | `wakelessBite` | 1 |
| `traits.json` | `capabilities` | `consumptionFactor,encumbranceFactor` | 1 |
| `trappings.json` | `capabilities` | `lockpicks` | 1 |
| `trappings.json` | `ops` | `attr,mod,op` | 1 |
| `trappings.json` | `amount` | `dice` | 1 |
| `trappings.json` | `ops` | `afterHours,forHours,op,ops` | 1 |
| `trappings.json` | `consumable` | `cond,else,kind,then` | 1 |
| `trappings.json` | `else` | `fail,kind,success,test` | 1 |
| `trappings.json` | `ops` | `den,num,op` | 1 |
| `trappings.json` | `ops` | `afterMinutes,op,ops` | 1 |
| `trappings.json` | `consumable` | `cond,kind,then` | 1 |
| `trappings.json` | `cond` | `kind,op,subject,value` | 1 |
| `trappings.json` | `subject` | `field,who` | 1 |
| `trappings.json` | `amount` | `bonusOf` | 1 |
| `trappings.json` | `daysPerSL` | `amount,every` | 1 |
| `trappings.json` | `prosthesisTraining` | `grants,label,px,reduces` | 1 |
| `trappings.json` | `capabilities` | `isShelter` | 1 |
| `trappings.json` | `capabilities` | `preventForcedDrop` | 1 |
| `trappings.json` | `capabilities` | `disarmImmune` | 1 |
| `trappings.json` | `capabilities` | `ropeMode` | 1 |
| `trappings.json` | `capabilities` | `isRations,scurvyGuard` | 1 |
| `trappings.json` | `capabilities` | `sealskin` | 1 |
| `trappings.json` | `capabilities` | `shipParts` | 1 |
| `trappings.json` | `valuePerSL` | `amount,every` | 1 |
| `trappings.json` | `amount` | `times` | 1 |
| `trappings.json` | `of` | `bonusOf` | 1 |
| `trappings.json` | `ops` | `count,op` | 1 |
| `trappings.json` | `ops` | `bonus,op,skill` | 1 |
| `trappings.json` | `ops` | `amount,op,resource` | 1 |
| `traumas.json` | `rig` | `bone,byProsthesis,hidesBone,lateral,replace` | 1 |
| `traumas.json` | `cumul` | `escalade,portee` | 1 |
| `traumas.json` | `ops` | `hands,op` | 1 |
| `vehicles.json` | `travel` | `classes,draft,movement` | 1 |
| `vehicles.json` | `travel` | `classes,medium,movement` | 1 |
| `vehicles.json` | `travel` | `classes,movement` | 1 |
| `vehicles.json` | `deck` | `ascii,postes` | 1 |

<!-- HORS-STRATE:FIN -->

## 4. Redéclarations locales dans `src/data/schemas/defs/*.ts`

Littéraux d’objet zod lus : **472** ; **46** recoupent le lexique
ou un littéral de `src/data/schemas/grammaire/`. « Schéma commun candidat » = même signature EXACTE
qu’un littéral de la grammaire (candidat à examiner, cf. angles morts).

### 4.1 Empreinte par concept, critère SUPERSET (indépendant du classement ordonné)

Un littéral qui porte le noyau d’un concept, même s’il a été classé sous un autre concept en §4.2 :
ce compte lève l’angle mort du classement ordonné.
Le DoD de #1463 annonçait « 5 defs redéclarent la monnaie » : la mesure en trouve **0** littéraux
dans **0** defs ().
Le chiffre du DoD n’a pas ce porteur dans l’arbre : il ne se recopie pas.
Critère : ≥ **1** clé(s) du noyau `gold,silver`. Sites : —.
Dont **0** littéral(aux) PARTIEL(s) du noyau — — : une mesure qui exigerait le noyau COMPLET `gold,silver` en compterait **0**, pas 0. Le compte du DoD se lit avec le critère.

| Concept | Noyau | Littéraux | Defs | Liste des defs |
|---|---|---|---|---|
| monnaie | `gold,silver` | 0 | 0 | — |
| de | `n,sides` | 0 | 0 | — |
| adresse | `book,ch,parts` | 0 | 0 | — |
| fragment | `sec,secOcc,sum` | 0 | 0 | — |
| formule | `sum,sinPoints,minimum` | 1 | 1 | `miscast.ts` |
| source | `book` | 0 | 0 | — |
| bornes | `min,max` | 2 | 2 | `oups.ts` `tavernGames.ts` |
| plage | `min,max` | 2 | 2 | `oups.ts` `tavernGames.ts` |
| quantite | `fixed` | 0 | 0 | — |
| test | `difficulty` | 26 | 17 | `activities.ts` `arcane-phenomena.ts` `criticals.ts` `etats.ts` `land-cargo.ts` `maladies.ts` `miscast.ts` `psychology.ts` `river-navigation.ts` `sea-cargo.ts` `sea-navigation.ts` `sea-perils.ts` `sea-weather.ts` `steam-breakdown.ts` `tavernGames.ts` `water-exposure.ts` `weather.ts` |
| ouverture | `titre,pitch` | 0 | 0 | — |
| cloture | `titre,when` | 0 | 0 | — |
| narratif | `affaires,indices,objets,presetsPnj` | 0 | 0 | — |
| condition | `expr,kind` | 0 | 0 | — |

Le DoD de #1463 annonçait « 5 `{id,spec}` » : la mesure en trouve **0** littéral(aux) —
. Les autres n’ont pas de
porteur dans l’arbre, le chiffre ne se recopie pas.

### 4.2 Littéral par littéral

| Def | Ligne | Champ | Concept | Statut | Empreinte | Schéma commun candidat |
|---|---|---|---|---|---|---|
| `activities.ts` | 127 | — | test | divergente | `char,difficulty+…` | — |
| `arcane-phenomena.ts` | 177 | `controlFlux` | test | divergente | `difficulty+…` | — |
| `criticals.ts` | 92 | — | test | divergente | `difficulty+…` | — |
| `criticals.ts` | 102 | `loss` | test | divergente | `difficulty+…` | — |
| `etats.ts` | 25 | — | test | divergente | `characteristic,difficulty,skill+…` | — |
| `land-cargo.ts` | 107 | `gossip` | test | divergente | `difficulty+…` | — |
| `miscast.ts` | 34 | — | — | hors lexique | `bonusOf` | `formulaSchema` |
| `miscast.ts` | 35 | — | — | hors lexique | `charOf` | `formulaSchema` |
| `miscast.ts` | 36 | — | — | hors lexique | `dice` | `prixTireSchema` |
| `miscast.ts` | 37 | — | — | hors lexique | `rolled` | `formulaSchema` |
| `miscast.ts` | 38 | — | — | hors lexique | `indiceOf` | `formulaSchema` |
| `miscast.ts` | 39 | — | — | hors lexique | `stacks` | `formulaSchema` |
| `miscast.ts` | 40 | — | — | hors lexique | `engagedAdvantageGap` | `formulaSchema` |
| `miscast.ts` | 41 | — | — | hors lexique | `woundsDealt` | `formulaSchema` |
| `miscast.ts` | 42 | — | formule | cible | `sum` | `formulaSchema` |
| `miscast.ts` | 43 | — | — | hors lexique | `times` | `formulaSchema` |
| `miscast.ts` | 43 | `times` | — | hors lexique | `factor,of` | `formulaSchema` |
| `miscast.ts` | 82 | — | test | divergente | `characteristic,difficulty,skill+…` | — |
| `oups.ts` | 41 | — | plage | cible | `max,min+…` | — |
| `psychology.ts` | 54 | `test` | test | historique | `difficulty,skill` | — |
| `raceAppearance.ts` | 34 | `parts` | — | hors lexique | `cheveux,visage` | `entityAppearanceSchema` |
| `raceAppearance.ts` | 36 | `eyes` | — | hors lexique | `D,G` | `entityAppearanceSchema` |
| `river-navigation.ts` | 39 | `rowingAgility` | test | divergente | `difficulty+…` | — |
| `river-navigation.ts` | 54 | `temporaryRepair` | test | divergente | `difficulty+…` | — |
| `sea-cargo.ts` | 97 | `producesGossip` | test | divergente | `difficulty+…` | — |
| `sea-cargo.ts` | 98 | `surplusGossip` | test | divergente | `difficulty+…` | — |
| `sea-cargo.ts` | 112 | `test` | test | divergente | `difficulty,skill+…` | — |
| `sea-navigation.ts` | 19 | `epuisement` | test | divergente | `difficulty+…` | — |
| `sea-perils.ts` | 32 | `freeTest` | test | divergente | `char,difficulty,skill+…` | — |
| `sea-perils.ts` | 57 | `evasion` | test | divergente | `difficulty+…` | — |
| `sea-perils.ts` | 68 | `tourbillonSwim` | test | divergente | `difficulty,skill+…` | — |
| `sea-weather.ts` | 108 | `affaler` | test | divergente | `difficulty+…` | — |
| `spells.ts` | 29 | — | — | hors lexique | `kind` | `conditionSchema` |
| `spells.ts` | 30 | — | — | hors lexique | `kind` | `conditionSchema` |
| `spells.ts` | 38 | — | — | hors lexique | `kind` | `conditionSchema` |
| `spells.ts` | 47 | — | — | hors lexique | `kind` | `conditionSchema` |
| `spells.ts` | 50 | — | — | hors lexique | `kind` | `conditionSchema` |
| `steam-breakdown.ts` | 28 | `restart` | test | divergente | `char,difficulty,skill+…` | — |
| `talents.ts` | 74 | `max` | — | hors lexique | `bonusOf` | `formulaSchema` |
| `tavernGames.ts` | 76 | `options` | test | divergente | `char,difficulty,skill+…` | — |
| `tavernGames.ts` | 103 | `rows` | plage | cible | `max,min+…` | — |
| `tavernGames.ts` | 140 | `throwerPenalty` | test | divergente | `difficulty+…` | — |
| `water-exposure.ts` | 23 | — | — | hors lexique | `kind,op,value` | `conditionSchema` |
| `water-exposure.ts` | 24 | — | — | hors lexique | `kind,op,value` | `conditionSchema` |
| `water-exposure.ts` | 34 | `test` | test | historique | `difficulty,skill` | — |
| `weather.ts` | 76 | `resistanceTest` | test | divergente | `difficulty+…` | — |

## 5. Ops en donnée (strate Ops)

`gameOpSchema` est un `looseObject` (`src/data/schemas/grammaire/mecanique.ts`) : seul `op` est contraint.
Mesure : **2280** objets portent un `op` = **2221** ops de jeu + **59**
Conditions dont l’`op` est un COMPARATEUR (`kind` reconnu par `conditionSchema`, kinds lus par AST).
**253** Conditions au total, dont **194** sans `op` :
celles-là n’ont jamais été comptées en op — le retrait des Conditions du compte d’ops vaut
2280 → 2221, jamais 2280 → 2027.
Noms d’op distincts : **106**, signatures distinctes : **238**.

| `kind` de Condition | Avec `op` | Sans `op` |
|---|---|---|
| `flag` | — | 84 |
| `compare` | 30 | — |
| `has` | — | 29 |
| `slThreshold` | 20 | — |
| `all` | — | 18 |
| `relation` | — | 18 |
| `not` | — | 16 |
| `any` | — | 8 |
| `woundsDealt` | 6 | — |
| `casterChaosDomain` | — | 4 |
| `engaged` | — | 4 |
| `attackKind` | — | 3 |
| `hiddenFromFoes` | — | 2 |
| `startleCause` | — | 2 |
| `capability` | — | 1 |
| `crewTest` | — | 1 |
| `engagedAdvantageGap` | 1 | — |
| `engagedAdvantageLead` | 1 | — |
| `foeInLoS` | — | 1 |
| `location` | — | 1 |
| `nearestFoe` | 1 | — |
| `status` | — | 1 |
| `visiblePassive` | — | 1 |

Restent **2** occurrence(s) dont le nom d’op n’est pas alphabétique (un COMPARATEUR) sous un
`kind` étranger à `conditionSchema` : elles sont encore comptées en op ci-dessous, mesurées ici.

| Op | `kind` porté | Dataset | Occurrences |
|---|---|---|---|
| `<=` | `woundsRemaining` | `water-exposure.json` | 1 |
| `>=` | `woundsLost` | `water-exposure.json` | 1 |

Une ligne par (op, signature, dataset) — stock `STRUCTURES_OPS`, lot `L1c #1468` : la cible est une
union discriminée générée d’`OP_DEFS`, à refs EMBOÎTÉES (`skill: {id, spec}`).

| Op | Signature | Dataset | Occurrences | Clés de ref à plat |
|---|---|---|---|---|
| `<=` | `kind,op,value` | `water-exposure.json` | 1 | — |
| `>=` | `kind,op,value` | `water-exposure.json` | 1 | — |
| `actGate` | `char,op` | `spells.json` | 1 | — |
| `actGate` | `char,op` | `trappings.json` | 1 | — |
| `aggravateSymptom` | `disease,op,otherwise,severity,symptomId` | `maladies.json` | 1 | — |
| `ap` | `amount,op` | `spells.json` | 8 | — |
| `ap` | `amount,loc,op` | `mutations.json` | 7 | — |
| `ap` | `amount,loc,op` | `naval-traits.json` | 2 | — |
| `ap` | `amount,noDeviation,op` | `mutations.json` | 2 | — |
| `ap` | `amount,op` | `mutations.json` | 2 | — |
| `ap` | `amount,atHitLocation,op` | `spells.json` | 1 | — |
| `armourPierce` | `amount,bypass,op` | `qualities.json` | 1 | — |
| `arrowWard` | `op` | `spells.json` | 1 | — |
| `attackKeyword` | `keyword,op` | `traits.json` | 3 | — |
| `attackWardFM` | `op` | `spells.json` | 1 | — |
| `attrMod` | `attr,mod,op` | `talents.json` | 3 | — |
| `attrMod` | `attr,mod,op` | `trappings.json` | 1 | — |
| `augmentWeapon` | `addQualities,onHitEffects,op` | `spells.json` | 2 | — |
| `augmentWeapon` | `onHitEffects,op` | `trappings.json` | 2 | — |
| `augmentWeapon` | `addQualities,bypass,onHitEffects,op,requiresWeapon` | `spells.json` | 1 | — |
| `augmentWeapon` | `addQualities,damageBonus,onHitEffects,op` | `spells.json` | 1 | — |
| `augmentWeapon` | `addQualities,damageBonus,op` | `spells.json` | 1 | — |
| `augmentWeapon` | `addQualities,onHitEffects,op,requiresWeapon` | `spells.json` | 1 | — |
| `augmentWeapon` | `addQualities,op` | `spells.json` | 1 | — |
| `augmentWeapon` | `addQualities,op,requiresWeapon` | `spells.json` | 1 | — |
| `augmentWeapon` | `op,passive,removeType` | `spells.json` | 1 | — |
| `banish` | `narration,onlyGroups,op` | `spells.json` | 1 | — |
| `banish` | `narration,op` | `spells.json` | 1 | — |
| `banish` | `narration,op` | `traits.json` | 1 | — |
| `banish` | `op` | `spells.json` | 1 | — |
| `banish` | `op` | `traits.json` | 1 | — |
| `between` | `kind,max,min,op` | `water-exposure.json` | 1 | — |
| `castPenalty` | `blocked,op,rounds,skill` | `miscast.json` | 5 | `skill` |
| `castPenalty` | `mod,op,rounds,skill` | `miscast.json` | 3 | `skill` |
| `castPenalty` | `blocked,minutes,op,skill` | `miscast.json` | 2 | `skill` |
| `castPenalty` | `blocked,op,skill` | `traits.json` | 2 | `skill` |
| `castPenalty` | `hours,mod,op,skill` | `miscast.json` | 2 | `skill` |
| `castPenalty` | `blocked,op,rounds` | `spells.json` | 1 | — |
| `castPenalty` | `days,maxZeroDR,op,skill` | `miscast.json` | 1 | `skill` |
| `castPenalty` | `mod,op,rounds` | `spells.json` | 1 | — |
| `castWard` | `op,perSL,radius` | `spells.json` | 1 | — |
| `chain` | `hopMeters,maxBounces,op` | `spells.json` | 1 | — |
| `charDRBonus` | `bonus,char,op` | `tables.json` | 8 | — |
| `charDRBonus` | `bonus,char,op` | `trappings.json` | 8 | — |
| `charDRBonus` | `bonus,char,op` | `sea-shanties.json` | 1 | — |
| `charDamage` | `amount,char,op` | `symptoms.json` | 4 | — |
| `charDamage` | `amount,char,op` | `spells.json` | 2 | — |
| `charMod` | `char,mod,op` | `mutations.json` | 55 | — |
| `charMod` | `char,mod,op` | `stars.json` | 42 | — |
| `charMod` | `char,mod,op` | `spells.json` | 32 | — |
| `charMod` | `char,mod,op` | `symptoms.json` | 30 | — |
| `charMod` | `char,mod,op` | `traits.json` | 21 | — |
| `charMod` | `char,mod,op` | `traumas.json` | 12 | — |
| `charMod` | `char,mod,op` | `talents.json` | 10 | — |
| `charMod` | `char,mod,op` | `trappings.json` | 9 | — |
| `charMod` | `char,mod,op` | `maneuvers.json` | 8 | — |
| `charMod` | `char,mod,op` | `tables.json` | 7 | — |
| `charMod` | `char,durationRounds,mod,op` | `criticals.json` | 6 | — |
| `charMod` | `char,durationHours,mod,op` | `criticals.json` | 2 | — |
| `charMod` | `char,durationHours,mod,op` | `spells.json` | 2 | — |
| `charMod` | `char,durationHours,mod,op` | `trappings.json` | 1 | — |
| `charMod` | `char,durationRounds,mod,op` | `spells.json` | 1 | — |
| `condition` | `id,op,value` | `criticals.json` | 190 | — |
| `condition` | `id,op` | `spells.json` | 58 | — |
| `condition` | `id,op,value` | `miscast.json` | 40 | — |
| `condition` | `id,op,unlockBy,value` | `criticals.json` | 12 | — |
| `condition` | `id,op,value` | `ship-criticals.json` | 11 | — |
| `condition` | `carried,id,op` | `spells.json` | 9 | — |
| `condition` | `id,op` | `maneuvers.json` | 8 | — |
| `condition` | `id,op,value` | `spells.json` | 8 | — |
| `condition` | `id,op,value` | `trappings.json` | 7 | — |
| `condition` | `id,op` | `etats.json` | 6 | — |
| `condition` | `id,op` | `qualities.json` | 6 | — |
| `condition` | `id,op,value` | `river-criticals.json` | 5 | — |
| `condition` | `id,op,value,valuePerSL` | `spells.json` | 5 | — |
| `condition` | `id,op` | `symptoms.json` | 4 | — |
| `condition` | `escapeStrength,grapple,id,op,unlessCondition,value` | `traits.json` | 3 | — |
| `condition` | `escapeStrength,id,op` | `spells.json` | 3 | — |
| `condition` | `escapeStrength,id,op,value,valuePerSL` | `spells.json` | 3 | — |
| `condition` | `id,op` | `domains.json` | 3 | — |
| `condition` | `id,op` | `traits.json` | 3 | — |
| `condition` | `id,op,value` | `maneuvers.json` | 3 | — |
| `condition` | `id,op,value` | `traits.json` | 3 | — |
| `condition` | `durationHours,id,op` | `trappings.json` | 2 | — |
| `condition` | `durationHours,id,op,value` | `criticals.json` | 2 | — |
| `condition` | `durationRounds,id,op` | `miscast.json` | 2 | — |
| `condition` | `escapeStrength,id,op,unlessCondition,value` | `qualities.json` | 2 | — |
| `condition` | `escapeStrength,id,op,value` | `miscast.json` | 2 | — |
| `condition` | `escapeStrength,id,op,valuePerSL` | `spells.json` | 2 | — |
| `condition` | `id,op,resolveWindow` | `symptoms.json` | 2 | — |
| `condition` | `id,op,unlessCondition` | `spells.json` | 2 | — |
| `condition` | `id,op,value` | `tables.json` | 2 | — |
| `condition` | `durationRounds,id,onlyIfCondition,op` | `spells.json` | 1 | — |
| `condition` | `durationRounds,id,op,perRound,unlessCondition,value` | `miscast.json` | 1 | — |
| `condition` | `entangleOnFail,escapeThreshold,id,op,struggleDamage,unlessCondition,value` | `qualities.json` | 1 | — |
| `condition` | `entangleOnFail,escapeThreshold,id,op,unlessCondition,value` | `qualities.json` | 1 | — |
| `condition` | `escapeStrength,grapple,id,op` | `maneuvers.json` | 1 | — |
| `condition` | `escapeStrength,grapple,id,op,unlessCondition` | `maneuvers.json` | 1 | — |
| `condition` | `escapeStrength,id,op,unlessCondition,value` | `traits.json` | 1 | — |
| `condition` | `escapeStrength,id,op,value` | `spells.json` | 1 | — |
| `condition` | `grapple,id,op,value` | `grapple.json` | 1 | — |
| `condition` | `grapple,id,op,value` | `traits.json` | 1 | — |
| `condition` | `id,lockedUntil,op,value` | `criticals.json` | 1 | — |
| `condition` | `id,onlyGroups,op` | `spells.json` | 1 | — |
| `condition` | `id,onlyGroups,op,value` | `spells.json` | 1 | — |
| `condition` | `id,onlyGroups,op,value` | `trappings.json` | 1 | — |
| `condition` | `id,op` | `activities.json` | 1 | — |
| `condition` | `id,op` | `miscast.json` | 1 | — |
| `condition` | `id,op` | `psychology.json` | 1 | — |
| `condition` | `id,op` | `tables.json` | 1 | — |
| `condition` | `id,op` | `talents.json` | 1 | — |
| `condition` | `id,op,perRound` | `spells.json` | 1 | — |
| `condition` | `id,op,unlessCondition` | `maneuvers.json` | 1 | — |
| `condition` | `id,op,unlessCondition,value` | `traits.json` | 1 | — |
| `condition` | `id,op,value` | `etats.json` | 1 | — |
| `condition` | `id,op,value` | `grapple.json` | 1 | — |
| `condition` | `id,op,value` | `tavernGames.json` | 1 | — |
| `condition` | `id,op,value,valuePerSL` | `maneuvers.json` | 1 | — |
| `condition` | `id,op,value,valuePerSL` | `traits.json` | 1 | — |
| `condition` | `id,op,value,valuePerSL` | `trappings.json` | 1 | — |
| `condition` | `id,op,valuePerSL` | `maneuvers.json` | 1 | — |
| `contractDisease` | `disease,op` | `tables.json` | 5 | — |
| `contractDisease` | `disease,op` | `criticals.json` | 2 | — |
| `contractDisease` | `disease,op` | `spells.json` | 1 | — |
| `contractDisease` | `disease,op` | `symptoms.json` | 1 | — |
| `contractDisease` | `disease,op` | `trappings.json` | 1 | — |
| `corruption` | `amount,op` | `miscast.json` | 8 | — |
| `corruption` | `amount,op` | `spells.json` | 6 | — |
| `corruption` | `amount,op,perSL` | `spells.json` | 1 | — |
| `corruptionExposure` | `level,op` | `spells.json` | 5 | — |
| `corruptionExposure` | `level,op,skill` | `trappings.json` | 2 | `skill` |
| `corruptionExposure` | `easeSteps,op` | `spells.json` | 1 | — |
| `corruptionExposure` | `level,op,skill` | `activities.json` | 1 | `skill` |
| `crewTestMod` | `mod,op` | `sea-shanties.json` | 1 | — |
| `critOnRoll` | `equals,mod,op` | `qualities.json` | 1 | — |
| `critTwice` | `op` | `spells.json` | 1 | — |
| `cureCriticalWound` | `count,op` | `traits.json` | 2 | — |
| `cureCriticalWound` | `count,countPerSL,op` | `spells.json` | 1 | — |
| `cureDisease` | `count,countPerSL,op` | `spells.json` | 1 | — |
| `cureDisease` | `count,op` | `trappings.json` | 1 | — |
| `damageArmour` | `material,op` | `maneuvers.json` | 2 | — |
| `damageArmour` | `material,op` | `spells.json` | 1 | — |
| `delayed` | `afterDuration,op,ops` | `spells.json` | 3 | — |
| `delayed` | `afterDuration,op,ops` | `trappings.json` | 2 | — |
| `delayed` | `afterHours,forHours,op,ops` | `trappings.json` | 1 | — |
| `delayed` | `afterMinutes,op,ops` | `trappings.json` | 1 | — |
| `disarm` | `op` | `criticals.json` | 17 | — |
| `diseaseTestMod` | `amount,diseases,op` | `trappings.json` | 5 | — |
| `diseaseTestMod` | `amount,op` | `maladies.json` | 1 | — |
| `domeWard` | `indice,op,traitId` | `spells.json` | 1 | `traitId` |
| `endPsych` | `op,type` | `psychology.json` | 1 | — |
| `endPsych` | `op,type` | `talents.json` | 1 | — |
| `endTransform` | `op,tag` | `maneuvers.json` | 1 | — |
| `exposeDisease` | `disease,op` | `traits.json` | 2 | — |
| `exposeDisease` | `difficultyShift,disease,incubation,op` | `traits.json` | 1 | — |
| `exposeDisease` | `disease,op` | `qualities.json` | 1 | — |
| `fall` | `hauteur,op` | `ship-criticals.json` | 5 | — |
| `freeReroll` | `op` | `spells.json` | 3 | — |
| `gainAdvantage` | `amount,op` | `tavernGames.json` | 2 | — |
| `gainAdvantage` | `amount,feedOpposingPool,op` | `traits.json` | 1 | — |
| `gainResource` | `amount,op,perSL,resource,temporary` | `spells.json` | 3 | — |
| `gainResource` | `amount,op,perSL,resource` | `spells.json` | 1 | — |
| `gainResource` | `amount,op,resource` | `trappings.json` | 1 | — |
| `gainResource` | `amount,op,resource,temporary` | `spells.json` | 1 | — |
| `giveTrapping` | `op,trappingId` | `spells.json` | 2 | `trappingId` |
| `giveTrapping` | `op,perSL,trappingId` | `spells.json` | 1 | `trappingId` |
| `grantCareerSkill` | `op,skill` | `talents.json` | 5 | `skill` |
| `grantCareerTalent` | `op,talentId` | `traits.json` | 18 | `talentId` |
| `grantCareerTalent` | `op,spec,talentId` | `traits.json` | 2 | `talentId` `spec` |
| `grantCareerTalent` | `op,talentId` | `talents.json` | 1 | `talentId` |
| `grantFreeAttack` | `advantageOrMovement,op,weapon,when` | `talents.json` | 1 | — |
| `grantFreeAttack` | `op,perChargerOncePerRound,weapon,when` | `talents.json` | 1 | — |
| `grantFreeAttack` | `op,weapon,when` | `psychology.json` | 1 | — |
| `grantNaturalWeapon` | `bare,damage,label,op,plusBF,qualities` | `mutations.json` | 2 | — |
| `grantNaturalWeapon` | `damage,label,op` | `spells.json` | 2 | — |
| `grantNaturalWeapon` | `damage,label,op,qualities` | `spells.json` | 2 | — |
| `grantNaturalWeapon` | `attackKind,bare,damage,label,op,plusBF,subType,uid` | `traits.json` | 1 | — |
| `grantPsychTrait` | `op,psychType` | `spells.json` | 3 | — |
| `grantPsychTrait` | `cible,op,psychType` | `drunkenness.json` | 1 | — |
| `grantPsychTrait` | `cible,op,psychType` | `symptoms.json` | 1 | — |
| `grantPsychTrait` | `cible,op,psychType` | `tables.json` | 1 | — |
| `grantPsychTrait` | `op,psychType` | `mutations.json` | 1 | — |
| `grantPsychTrait` | `op,psychType` | `symptoms.json` | 1 | — |
| `grantReverseToken` | `op` | `activities.json` | 1 | — |
| `grantSymptom` | `disease,op,symptomId` | `maladies.json` | 1 | — |
| `grantTalent` | `op,talentId` | `spells.json` | 15 | `talentId` |
| `grantTalent` | `op,talentId` | `tables.json` | 12 | `talentId` |
| `grantTalent` | `op,talentId` | `stars.json` | 11 | `talentId` |
| `grantTalent` | `op,spec,talentId` | `spells.json` | 6 | `talentId` `spec` |
| `grantTalent` | `op,spec,talentId` | `mutations.json` | 5 | `talentId` `spec` |
| `grantTalent` | `op,spec,talentId` | `stars.json` | 2 | `talentId` `spec` |
| `grantTalent` | `op,spec,talentId` | `traits.json` | 2 | `talentId` `spec` |
| `grantTalent` | `op,talentId` | `mutations.json` | 2 | `talentId` |
| `grantTalent` | `op,talentId` | `traits.json` | 1 | `talentId` |
| `grantTalent` | `op,talentId` | `trappings.json` | 1 | `talentId` |
| `grantTrait` | `op,traitId` | `mutations.json` | 19 | `traitId` |
| `grantTrait` | `indice,op,traitId` | `mutations.json` | 16 | `traitId` |
| `grantTrait` | `op,traitId` | `spells.json` | 16 | `traitId` |
| `grantTrait` | `op,traitId` | `tables.json` | 16 | `traitId` |
| `grantTrait` | `indice,op,traitId` | `spells.json` | 14 | `traitId` |
| `grantTrait` | `indice,op,traitId` | `tables.json` | 14 | `traitId` |
| `grantTrait` | `arg,op,traitId` | `mutations.json` | 4 | `traitId` |
| `grantTrait` | `arg,op,traitId` | `tables.json` | 4 | `traitId` |
| `grantTrait` | `indice,op,traitId` | `maneuvers.json` | 4 | `traitId` |
| `grantTrait` | `arg,indice,op,traitId` | `tables.json` | 3 | `traitId` |
| `grantTrait` | `arg,op,traitId` | `spells.json` | 3 | `traitId` |
| `grantTrait` | `argFrom,op,traitId` | `mutations.json` | 3 | `traitId` |
| `grantTrait` | `op,traitId` | `symptoms.json` | 3 | `traitId` |
| `grantTrait` | `indice,indicePerSL,op,traitId` | `spells.json` | 2 | `traitId` |
| `grantTrait` | `indice,op,traitId` | `traits.json` | 2 | `traitId` |
| `grantTrait` | `op,traitId` | `maneuvers.json` | 2 | `traitId` |
| `grantTrait` | `op,traitId` | `trappings.json` | 2 | `traitId` |
| `grantTrait` | `arg,indice,op,traitId` | `mutations.json` | 1 | `traitId` |
| `grantTrait` | `durationHours,op,traitId` | `spells.json` | 1 | `traitId` |
| `grantTrait` | `durationRounds,indice,op,traitId` | `domains.json` | 1 | `traitId` |
| `grantTrait` | `indice,op,traitId` | `trappings.json` | 1 | `traitId` |
| `grantTrait` | `onlyGroups,op,traitId` | `spells.json` | 1 | `traitId` |
| `grantWeapon` | `chooseForm,damage,label,op,qualities,skin` | `spells.json` | 1 | — |
| `grantWeapon` | `damage,damagePlus,form,hands,label,op,qualities,reach,skin,subType` | `spells.json` | 1 | — |
| `grantWeapon` | `damage,form,hands,label,onHitEffects,op,qualities,reach,skin,subType` | `spells.json` | 1 | — |
| `handGate` | `op` | `criticals.json` | 2 | — |
| `heal` | `amount,op` | `spells.json` | 11 | — |
| `heal` | `amount,op` | `traits.json` | 2 | — |
| `heal` | `amount,op` | `trappings.json` | 2 | — |
| `heal` | `amount,op,perSL` | `spells.json` | 1 | — |
| `healCaster` | `amount,op` | `spells.json` | 1 | — |
| `ignoreAnimosity` | `op` | `drunkenness.json` | 1 | — |
| `ignoreStatePenalties` | `op` | `spells.json` | 2 | — |
| `ignoreStatePenalties` | `count,op` | `sea-shanties.json` | 1 | — |
| `incomingAdvantage` | `amount,mode,op` | `etats.json` | 1 | — |
| `incomingAttackMod` | `amount,mode,op` | `etats.json` | 3 | — |
| `incomingAttackMod` | `amount,flankRear,mode,op` | `etats.json` | 1 | — |
| `incomingAttackMod` | `amount,mode,op` | `traits.json` | 1 | — |
| `incomingSpellDRMod` | `amount,op` | `talents.json` | 1 | — |
| `incomingSpellDRMod` | `amount,op` | `traits.json` | 1 | — |
| `intoxicate` | `op` | `tavernGames.json` | 2 | — |
| `intoxicate` | `op` | `trappings.json` | 2 | — |
| `kill` | `op` | `symptoms.json` | 2 | — |
| `kill` | `op` | `spells.json` | 1 | — |
| `lifeSteal` | `den,num,op` | `traits.json` | 2 | — |
| `lifeSteal` | `den,num,op,round` | `spells.json` | 2 | — |
| `light` | `op,radiusM,tone` | `trappings.json` | 4 | — |
| `light` | `op,radiusM,tone` | `spells.json` | 2 | — |
| `light` | `op,radiusM,tone` | `tables.json` | 1 | — |
| `loseTurn` | `op,what` | `maneuvers.json` | 2 | — |
| `loseTurn` | `op,what` | `spells.json` | 2 | — |
| `loseTurn` | `op` | `spells.json` | 1 | — |
| `loseTurn` | `op` | `traits.json` | 1 | — |
| `martyr` | `op` | `spells.json` | 1 | — |
| `maxWeaponHands` | `durationRounds,hands,op` | `criticals.json` | 6 | — |
| `maxWeaponHands` | `hands,op` | `criticals.json` | 2 | — |
| `maxWeaponHands` | `hands,op` | `traumas.json` | 1 | — |
| `mitigateIncoming` | `mode,op,unlessKeyword` | `traits.json` | 1 | — |
| `money` | `montant,op` | `activities.json` | 2 | — |
| `money` | `montant,op` | `tables.json` | 1 | — |
| `moveMod` | `mod,op` | `mutations.json` | 7 | — |
| `moveMod` | `mod,op` | `spells.json` | 3 | — |
| `moveMod` | `mod,op` | `naval-traits.json` | 2 | — |
| `moveMod` | `mod,op` | `traits.json` | 2 | — |
| `moveMod` | `mod,op` | `trappings.json` | 2 | — |
| `moveMod` | `mod,op` | `maneuvers.json` | 1 | — |
| `moveMod` | `mod,op` | `tables.json` | 1 | — |
| `moveMod` | `mod,op` | `talents.json` | 1 | — |
| `moveScale` | `den,num,op` | `traumas.json` | 7 | — |
| `moveScale` | `den,num,op` | `criticals.json` | 4 | — |
| `moveScale` | `den,num,op` | `spells.json` | 3 | — |
| `moveScale` | `den,durationRounds,num,op` | `criticals.json` | 1 | — |
| `moveScale` | `den,num,op` | `naval-traits.json` | 1 | — |
| `moveScale` | `den,num,op` | `trappings.json` | 1 | — |
| `narrative` | `op,text` | `spells.json` | 378 | — |
| `narrative` | `op,text` | `tables.json` | 119 | — |
| `narrative` | `op,text` | `trappings.json` | 10 | — |
| `noBreath` | `op` | `spells.json` | 5 | — |
| `noHunger` | `op` | `spells.json` | 1 | — |
| `offTerrainMod` | `mSet,op,suffocates,terrain,testDR` | `traits.json` | 1 | — |
| `offTerrainMod` | `mSet,op,terrain` | `traits.json` | 1 | — |
| `offTerrainMod` | `op,terrain` | `traits.json` | 1 | — |
| `perRound` | `op,ops` | `spells.json` | 2 | — |
| `polymorph` | `op,ref` | `spells.json` | 2 | — |
| `preventInfection` | `op` | `trappings.json` | 2 | — |
| `preventInfection` | `op` | `spells.json` | 1 | — |
| `push` | `meters,op` | `spells.json` | 4 | — |
| `reduceDiseaseDays` | `days,daysPerSL,disease,op` | `trappings.json` | 1 | — |
| `reduceDiseaseDays` | `days,oncePerDisease,op` | `spells.json` | 1 | — |
| `reduceDiseaseDays` | `dice,disease,op` | `trappings.json` | 1 | — |
| `reduceToZero` | `op` | `miscast.json` | 2 | — |
| `reduceToZero` | `op` | `maneuvers.json` | 1 | — |
| `removeCondition` | `id,op,value` | `spells.json` | 6 | — |
| `removeCondition` | `all,id,op` | `trappings.json` | 5 | — |
| `removeCondition` | `id,op` | `etats.json` | 3 | — |
| `removeCondition` | `id,op,value,valuePerSL` | `etats.json` | 3 | — |
| `removeCondition` | `id,op,value` | `domains.json` | 2 | — |
| `removeCondition` | `id,op,value` | `trappings.json` | 2 | — |
| `removeCondition` | `op` | `spells.json` | 2 | — |
| `removeCondition` | `all,id,op` | `spells.json` | 1 | — |
| `removeCondition` | `id,op,value` | `etats.json` | 1 | — |
| `removeCondition` | `id,op,value` | `traits.json` | 1 | — |
| `removeCondition` | `id,op,value,valuePerSL` | `grapple.json` | 1 | — |
| `removeCondition` | `id,op,value,valuePerSL` | `spells.json` | 1 | — |
| `removeCondition` | `id,op,value,valuePerSL` | `talents.json` | 1 | — |
| `removePsychTrait` | `op` | `activities.json` | 1 | — |
| `removeShipPoste` | `op` | `ship-criticals.json` | 1 | — |
| `removeTrait` | `op,traitId` | `mutations.json` | 1 | `traitId` |
| `rollMutation` | `op,table` | `tables.json` | 4 | — |
| `rollTable` | `op,tableId` | `activities.json` | 13 | `tableId` |
| `rollTable` | `extraRollsPerStep,op,tableId` | `spells.json` | 4 | `tableId` |
| `rollTable` | `die,op,rows` | `spells.json` | 3 | — |
| `rollTable` | `addNegativeSL,op,tableId` | `activities.json` | 2 | `tableId` |
| `rollTable` | `addNegativeSL,die,op,rows` | `symptoms.json` | 1 | — |
| `rollTable` | `addNegativeSL,mod,op,tableId` | `activities.json` | 1 | `tableId` |
| `rollTable` | `die,op,tableId` | `trappings.json` | 1 | `tableId` |
| `rollTable` | `op,tableId` | `tables.json` | 1 | `tableId` |
| `rollTable` | `op,tableId` | `traits.json` | 1 | `tableId` |
| `rollThreshold` | `op,sides,thresholds` | `traits.json` | 2 | — |
| `sbBonus` | `amount,op` | `psychology.json` | 1 | — |
| `scheduleRespawn` | `cancelFlag,delayDays,op,ref` | `traits.json` | 1 | — |
| `senseLoss` | `op,sense` | `traumas.json` | 2 | — |
| `sinMod` | `amount,op` | `activities.json` | 2 | — |
| `skillDRBonus` | `bonus,op,skill` | `spells.json` | 17 | `skill` |
| `skillDRBonus` | `bonus,op,skill` | `tables.json` | 15 | `skill` |
| `skillDRBonus` | `bonus,op,skill` | `traits.json` | 12 | `skill` |
| `skillDRBonus` | `bonus,op,skill` | `trappings.json` | 6 | `skill` |
| `skillDRBonus` | `bonus,op,skill` | `naval-traits.json` | 3 | `skill` |
| `skillDRBonus` | `bonus,op,skill` | `traumas.json` | 3 | `skill` |
| `skillDRBonus` | `bonus,op,skill` | `sea-shanties.json` | 2 | `skill` |
| `skillDRBonus` | `bonus,op,testType` | `naval-traits.json` | 2 | — |
| `skillMod` | `mod,op,skill` | `trappings.json` | 9 | `skill` |
| `skillMod` | `mod,op,skill` | `traumas.json` | 8 | `skill` |
| `skillMod` | `mod,op,skill` | `traits.json` | 3 | `skill` |
| `skillMod` | `mod,op,sense,skill` | `traumas.json` | 2 | `skill` |
| `skillMod` | `mod,op,skill` | `mutations.json` | 2 | `skill` |
| `skillMod` | `mod,op,skill` | `drunkenness.json` | 1 | `skill` |
| `skillMod` | `mod,op,skill` | `sea-shanties.json` | 1 | `skill` |
| `statusMod` | `amount,op` | `activities.json` | 1 | — |
| `suffocate` | `op` | `spells.json` | 8 | — |
| `summon` | `allyOfCaster,count,op,ref` | `spells.json` | 8 | — |
| `summon` | `addTraits,allyOfCaster,count,op,ref` | `spells.json` | 2 | — |
| `summon` | `allyOfCaster,count,countPerSL,despawnIfCasterDown,op,ref` | `spells.json` | 2 | — |
| `summon` | `addTraits,allyOfCaster,count,op,ref,size` | `spells.json` | 1 | — |
| `summon` | `allyOfCaster,count,despawnIfCasterDown,op,ref` | `spells.json` | 1 | — |
| `summon` | `count,countPerSL,op,ref` | `spells.json` | 1 | — |
| `summon` | `count,op,ref` | `traits.json` | 1 | — |
| `suppressPsych` | `op` | `spells.json` | 2 | — |
| `suppressSymptom` | `op,symptomId` | `trappings.json` | 1 | — |
| `teleport` | `meters,op,perSL` | `spells.json` | 4 | — |
| `teleport` | `meters,op` | `spells.json` | 2 | — |
| `testMod` | `amount,char,op` | `trappings.json` | 5 | — |
| `testMod` | `amount,op` | `etats.json` | 3 | — |
| `testMod` | `amount,op` | `spells.json` | 3 | — |
| `testMod` | `amount,char,movementOnly,op` | `criticals.json` | 2 | — |
| `testMod` | `amount,char,op` | `criticals.json` | 2 | — |
| `testMod` | `amount,movementOnly,op` | `etats.json` | 2 | — |
| `testMod` | `amount,op` | `symptoms.json` | 2 | — |
| `testMod` | `amount,char,op` | `mutations.json` | 1 | — |
| `testMod` | `amount,char,op` | `qualities.json` | 1 | — |
| `testMod` | `amount,char,op` | `sea-shanties.json` | 1 | — |
| `testMod` | `amount,combatOnly,op` | `etats.json` | 1 | — |
| `testMod` | `amount,exceptSkills,op` | `etats.json` | 1 | — |
| `testMod` | `amount,hearingOnly,op` | `etats.json` | 1 | — |
| `testMod` | `amount,op` | `traits.json` | 1 | — |
| `transform` | `morphRef,op,ops,tag` | `maneuvers.json` | 1 | — |
| `weaponDamageMod` | `mode,op` | `qualities.json` | 2 | — |
| `weaponDamageMod` | `chargeGated,op` | `qualities.json` | 1 | — |
| `weaponDamageMod` | `negateAtouts,op` | `qualities.json` | 1 | — |
| `weaponDamageMod` | `op,plusUnits` | `qualities.json` | 1 | — |
| `weaponRollMod` | `drMod,op,phase` | `qualities.json` | 8 | — |
| `weaponRollMod` | `drMod,op,phase` | `spells.json` | 1 | — |
| `weaponRollMod` | `flatMod,op,phase` | `qualities.json` | 1 | — |
| `weatherWard` | `op` | `spells.json` | 3 | — |
| `wounds` | `amount,ignoreAP,ignoreTB,op` | `criticals.json` | 146 | — |
| `wounds` | `amount,ignoreAP,ignoreTB,op` | `spells.json` | 17 | — |
| `wounds` | `amount,ignoreAP,ignoreTB,op` | `maneuvers.json` | 9 | — |
| `wounds` | `amount,ignoreAP,ignoreTB,op` | `miscast.json` | 8 | — |
| `wounds` | `amount,ignoreAP,ignoreTB,op` | `tables.json` | 6 | — |
| `wounds` | `amount,ignoreAP,ignoreTB,op,perSL` | `spells.json` | 6 | — |
| `wounds` | `amount,ignoreAP,ignoreTB,op` | `traits.json` | 5 | — |
| `wounds` | `amount,ignoreAP,ignoreTB,op` | `river-criticals.json` | 4 | — |
| `wounds` | `amount,ignoreAP,ignoreTB,op` | `trappings.json` | 3 | — |
| `wounds` | `amount,ignoreAP,ignoreTB,onlyGroups,op` | `spells.json` | 2 | — |
| `wounds` | `amount,ignoreAP,ignoreTB,op` | `domains.json` | 2 | — |
| `wounds` | `amount,ignoreAP,ignoreTB,op` | `etats.json` | 2 | — |
| `wounds` | `amount,ignoreAP,ignoreTB,op` | `ship-criticals.json` | 2 | — |
| `wounds` | `amount,apFrom,ignoreAP,ignoreTB,min,op` | `etats.json` | 1 | — |
| `wounds` | `amount,bypassArmour,ignoreAP,ignoreTB,op` | `domains.json` | 1 | — |
| `wounds` | `amount,bypassArmour,ignoreAP,ignoreTB,op` | `spells.json` | 1 | — |
| `wounds` | `amount,ignoreAP,ignoreTB,min,op` | `etats.json` | 1 | — |
| `wounds` | `amount,ignoreAP,ignoreTB,min,op` | `problemes-vehicule.json` | 1 | — |
| `wounds` | `amount,ignoreAP,ignoreTB,min,op` | `traits.json` | 1 | — |
| `wounds` | `amount,ignoreAP,ignoreTB,op` | `problemes-vehicule.json` | 1 | — |
| `wounds` | `amount,ignoreAP,ignoreTB,op` | `symptoms.json` | 1 | — |
| `wounds` | `amount,ignoreAP,ignoreTB,op,perSL` | `grapple.json` | 1 | — |
| `wounds` | `amount,ignoreAP,ignoreTB,op,perSL` | `maneuvers.json` | 1 | — |
| `zone` | `op,perRound,radiusMeters,shape` | `spells.json` | 7 | — |
| `zone` | `crossTest,onCross,op,radiusMeters,shape` | `spells.json` | 2 | — |
| `zone` | `barrier,gate,noCorruption,op,perRound,shape` | `spells.json` | 1 | — |
| `zone` | `blocksLoS,lengthMeters,lengthPerSL,op,shape` | `spells.json` | 1 | — |
| `zone` | `lengthMeters,lengthPerSL,onCross,op,shape` | `spells.json` | 1 | — |
| `zone` | `op,radiusMeters,shape` | `spells.json` | 1 | — |

## 6. Slots DÉCLARÉS × réfs OBSERVÉES (registre des slots)

Le côté DÉCLARÉ des références : un slot par référence RÉELLE, à son path exact, lu PAR MARCHE des
schémas des deux racines (`slotsDe`, `src/data/schemas/grammaire/slots.ts`). Son enforcement vit
dans `src/data/slots-contrat.test.ts`.

Ce volet est le REMPLAÇANT committé du « test FK générique » re-scopé au commentaire #1466 du 2026-08-23 : « le registre des SLOTS pour `docs/structures-donnees.md` (déclaré × observé) ».

Slots déclarés : **3449** — espèce `id` **459**, espèce `acteur` **2990**.

### 6.1 Slots RÉSOLUBLES (espèce `id`, type du registre `_ids.generated`)

Pour chacun, les valeurs POSÉES à ce path dans le document, et leur résolution contre le registre
des ids. Une valeur non résolue est un rouge NOMINATIF de la garde, jamais une ligne de stock.

| Dataset | Path déclaré | Champ projeté | Type | Cardinalité | Valeurs posées | Résolues |
|---|---|---|---|---|---|---|
| `activities.json` | `[].skills[].id` | `id` | `skill` | liste | 64 | 64 / 64 |
| `activities.json` | `[].testMods[].mod\|10.rule` | `rule` | `regleOptionnelle` | liste | 2 | 2 / 2 |
| `activities.json` | `[].worldRolls[].cible\|10.rule` | `rule` | `regleOptionnelle` | liste | 1 | 1 / 1 |
| `axes.json` | `[].skills[].id` | `id` | `skill` | liste | 15 | 15 / 15 |
| `buildings.json` | `[].roofMaterial` | `roofMaterial` | `material` | liste | 7 | 7 / 7 |
| `buildings.json` | `[].features[].id` | `id` | `prop` | liste | 4 | 4 / 4 |
| `careerLevels.json` | `[].skills[]\|0.id` | `id` | `skill` | liste | 2237 | 2237 / 2237 |
| `careerLevels.json` | `[].skills[]\|1\|0.of[]\|0.id` | `id` | `skill` | liste | 2 | 2 / 2 |
| `careerLevels.json` | `[].skills[]\|1\|0.of[]\|1.id` | `id` | `skill` | liste | 2 | 2 / 2 |
| `careerLevels.json` | `[].skills[]\|1\|1.table.id` | `id` | `table` | liste | 0 | 0 / 0 |
| `careerLevels.json` | `[].talents[]\|0.id` | `id` | `talent` | liste | 1724 | 1724 / 1724 |
| `careerLevels.json` | `[].talents[]\|1\|0.of[]\|0.id` | `id` | `talent` | liste | 9 | 9 / 9 |
| `careerLevels.json` | `[].talents[]\|1\|0.of[]\|1.id` | `id` | `talent` | liste | 9 | 9 / 9 |
| `careerLevels.json` | `[].talents[]\|1\|1.table.id` | `id` | `table` | liste | 0 | 0 / 0 |
| `creatures.json` | `[].optionals[]\|2.grant[]\|1.id` | `id` | `skill` | liste | 1 | 1 / 1 |
| `creatures.json` | `[].skills[].id` | `id` | `skill` | liste | 5981 | 5981 / 5981 |
| `crew-roles.json` | `[].skills[].id` | `id` | `skill` | liste | 10 | 10 / 10 |
| `criticals.json` | `[].entries[].test.test.skill.id` | `id` | `skill` | liste | 38 | 38 / 38 |
| `criticals.json` | `[].entries[].test.success\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `criticals.json` | `[].entries[].test.fail\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `criticals.json` | `[].entries[].amputation.unites\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `criticals.json` | `[].entries[].escalation.apresDelai.jours\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `criticals.json` | `[].entries[].escalation.onNextCritWhileCondition.test.test.skill.id` | `id` | `skill` | liste | 1 | 1 / 1 |
| `criticals.json` | `[].entries[].escalation.onNextCritWhileCondition.test.success\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `criticals.json` | `[].entries[].escalation.onNextCritWhileCondition.test.fail\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `defauts-de-compilation.json` | `cheminDeRonde` | `cheminDeRonde` | `terrain` | un | 1 | 1 / 1 |
| `defauts-de-compilation.json` | `masse` | `masse` | `terrain` | un | 1 | 1 / 1 |
| `defauts-de-compilation.json` | `pont` | `pont` | `terrain` | un | 1 | 1 / 1 |
| `domains.json` | `[].effects[].flow\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `domains.json` | `[].windModifiers[].cancelledBy.requiresSkill.id` | `id` | `skill` | liste | 2 | 2 / 2 |
| `domains.json` | `[].windModifiers[].cancelledBy.test.skill.id` | `id` | `skill` | liste | 2 | 2 / 2 |
| `etats.json` | `[].effects[].flow\|3.test.skill.id` | `id` | `skill` | liste | 3 | 3 / 3 |
| `etats.json` | `[].recover.skill.id` | `id` | `skill` | liste | 1 | 1 / 1 |
| `incidents-monture.json` | `entries[].mount.riderTest.skill.id` | `id` | `skill` | liste | 2 | 2 / 2 |
| `maladies.json` | `[].dailyTest.test.test.skill.id` | `id` | `skill` | liste | 1 | 1 / 1 |
| `maladies.json` | `[].dailyTest.test.success\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `maladies.json` | `[].dailyTest.test.fail\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `maladies.json` | `[].mutation.into` | `into` | `maladie` | liste | 1 | 1 / 1 |
| `maneuvers.json` | `[].effects[].flow\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `merchants.json` | `[].curated[]` | `curated` | `trapping` | liste | 19 | 19 / 19 |
| `miscast.json` | `[].entries[].ops[].value\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].ops[].value\|2.sum[]\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].ops[].durationRounds\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].ops[].durationRounds\|2.sum[]\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].ops[].unlessCondition` | `unlessCondition` | `etat` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].ops[].amount\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].ops[].amount\|2.sum[]\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].ops[].skill.id` | `id` | `skill` | liste | 13 | 13 / 13 |
| `miscast.json` | `[].entries[].ops[].rounds\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].ops[].rounds\|2.sum[]\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].ops[].hours\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].ops[].hours\|2.sum[]\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].ops[].minutes\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].ops[].minutes\|2.sum[]\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].ops[].days\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].ops[].days\|2.sum[]\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.skill.id` | `id` | `skill` | liste | 13 | 13 / 13 |
| `miscast.json` | `[].entries[].test.onFail[].value\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFail[].value\|2.sum[]\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFail[].durationRounds\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFail[].durationRounds\|2.sum[]\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFail[].unlessCondition` | `unlessCondition` | `etat` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFail[].amount\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFail[].amount\|2.sum[]\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFail[].skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFail[].rounds\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFail[].rounds\|2.sum[]\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFail[].hours\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFail[].hours\|2.sum[]\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFail[].minutes\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFail[].minutes\|2.sum[]\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFail[].days\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFail[].days\|2.sum[]\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFailHard.ops[].value\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFailHard.ops[].value\|2.sum[]\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFailHard.ops[].durationRounds\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFailHard.ops[].durationRounds\|2.sum[]\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFailHard.ops[].unlessCondition` | `unlessCondition` | `etat` | liste | 1 | 1 / 1 |
| `miscast.json` | `[].entries[].test.onFailHard.ops[].amount\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFailHard.ops[].amount\|2.sum[]\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFailHard.ops[].skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFailHard.ops[].rounds\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFailHard.ops[].rounds\|2.sum[]\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFailHard.ops[].hours\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFailHard.ops[].hours\|2.sum[]\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFailHard.ops[].minutes\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFailHard.ops[].minutes\|2.sum[]\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFailHard.ops[].days\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `miscast.json` | `[].entries[].test.onFailHard.ops[].days\|2.sum[]\|0\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `mutations.json` | `[].effects[].flow\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `problemes-vehicule.json` | `entries[].mount.riderTest.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `props.json` | `[].volume.primitives[]\|0.material` | `material` | `material` | liste | 379 | 379 / 379 |
| `props.json` | `[].volume.primitives[]\|1.material` | `material` | `material` | liste | 379 | 379 / 379 |
| `props.json` | `[].volume.primitives[]\|2.material` | `material` | `material` | liste | 379 | 379 / 379 |
| `psychology.json` | `[].effects[].flow\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `psychology.json` | `[].test.skill.id` | `id` | `skill` | liste | 7 | 7 / 7 |
| `qualities.json` | `[].effects[].flow\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `rencontres-edoc.json` | `tables.positives[].mount.riderTest.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `rencontres-edoc.json` | `tables.fortuites[].mount.riderTest.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `rencontres-edoc.json` | `tables.dangereuses[].mount.riderTest.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `river-criticals.json` | `tables.greement[].crewHit.crewTarget\|1.stations[]` | `stations` | `shipStation` | liste | 1 | 1 / 1 |
| `river-criticals.json` | `tables.greement[].crewHit.crewTarget\|2.role.id` | `id` | `crewRole` | liste | 0 | 0 / 0 |
| `river-criticals.json` | `tables.greement[].crewHit.test.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `river-criticals.json` | `tables.greement[].crewHit.test.success\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `river-criticals.json` | `tables.greement[].crewHit.test.fail\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `river-criticals.json` | `tables.avirons[].crewHit.crewTarget\|1.stations[]` | `stations` | `shipStation` | liste | 1 | 1 / 1 |
| `river-criticals.json` | `tables.avirons[].crewHit.crewTarget\|2.role.id` | `id` | `crewRole` | liste | 0 | 0 / 0 |
| `river-criticals.json` | `tables.avirons[].crewHit.test.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `river-criticals.json` | `tables.avirons[].crewHit.test.success\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `river-criticals.json` | `tables.avirons[].crewHit.test.fail\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `river-criticals.json` | `tables.gouvernail[].crewHit.crewTarget\|1.stations[]` | `stations` | `shipStation` | liste | 0 | 0 / 0 |
| `river-criticals.json` | `tables.gouvernail[].crewHit.crewTarget\|2.role.id` | `id` | `crewRole` | liste | 1 | 1 / 1 |
| `river-criticals.json` | `tables.gouvernail[].crewHit.test.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `river-criticals.json` | `tables.gouvernail[].crewHit.test.success\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `river-criticals.json` | `tables.gouvernail[].crewHit.test.fail\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `river-criticals.json` | `tables.coque[].crewHit.crewTarget\|1.stations[]` | `stations` | `shipStation` | liste | 0 | 0 / 0 |
| `river-criticals.json` | `tables.coque[].crewHit.crewTarget\|2.role.id` | `id` | `crewRole` | liste | 0 | 0 / 0 |
| `river-criticals.json` | `tables.coque[].crewHit.test.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `river-criticals.json` | `tables.coque[].crewHit.test.success\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `river-criticals.json` | `tables.coque[].crewHit.test.fail\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `river-criticals.json` | `tables.superstructure[].crewHit.crewTarget\|1.stations[]` | `stations` | `shipStation` | liste | 1 | 1 / 1 |
| `river-criticals.json` | `tables.superstructure[].crewHit.crewTarget\|2.role.id` | `id` | `crewRole` | liste | 0 | 0 / 0 |
| `river-criticals.json` | `tables.superstructure[].crewHit.test.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `river-criticals.json` | `tables.superstructure[].crewHit.test.success\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `river-criticals.json` | `tables.superstructure[].crewHit.test.fail\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `sea-cargo.json` | `opportunite.test.skill.id` | `id` | `skill` | un | 1 | 1 / 1 |
| `sea-perils.json` | `hazards[].freeTest.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `sea-perils.json` | `tourbillonSwim.skill.id` | `id` | `skill` | un | 1 | 1 / 1 |
| `semences-de-scene.json` | `ambientLight` | `ambientLight` | `lightLevel` | un | 0 | 0 / 0 |
| `semences-de-scene.json` | `terrain` | `terrain` | `terrain` | un | 1 | 1 / 1 |
| `semences-de-scene.json` | `reliefDefaults.cliff` | `cliff` | `material` | un | 1 | 1 / 1 |
| `semences-de-scene.json` | `reliefDefaults.ramp` | `ramp` | `material` | un | 1 | 1 / 1 |
| `semences-de-scene.json` | `reliefDefaults.deck` | `deck` | `material` | un | 1 | 1 / 1 |
| `semences-de-scene.json` | `reliefDefaults.pilier` | `pilier` | `material` | un | 1 | 1 / 1 |
| `semences-de-scene.json` | `roofDefaults.material` | `material` | `material` | un | 1 | 1 / 1 |
| `ship-criticals.json` | `tablesDeChute[].bandes[].hauteurs{}\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `ship-criticals.json` | `tables.cargaison[].crewHit.crewTarget\|1.stations[]` | `stations` | `shipStation` | liste | 0 | 0 / 0 |
| `ship-criticals.json` | `tables.cargaison[].crewHit.crewTarget\|2.role.id` | `id` | `crewRole` | liste | 0 | 0 / 0 |
| `ship-criticals.json` | `tables.cargaison[].crewHit.test.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `ship-criticals.json` | `tables.cargaison[].crewHit.test.success\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `ship-criticals.json` | `tables.cargaison[].crewHit.test.fail\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `ship-criticals.json` | `tables.greement[].crewHit.crewTarget\|1.stations[]` | `stations` | `shipStation` | liste | 10 | 10 / 10 |
| `ship-criticals.json` | `tables.greement[].crewHit.crewTarget\|2.role.id` | `id` | `crewRole` | liste | 0 | 0 / 0 |
| `ship-criticals.json` | `tables.greement[].crewHit.test.test.skill.id` | `id` | `skill` | liste | 5 | 5 / 5 |
| `ship-criticals.json` | `tables.greement[].crewHit.test.success\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `ship-criticals.json` | `tables.greement[].crewHit.test.fail\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `ship-criticals.json` | `tables.coque[].crewHit.crewTarget\|1.stations[]` | `stations` | `shipStation` | liste | 4 | 4 / 4 |
| `ship-criticals.json` | `tables.coque[].crewHit.crewTarget\|2.role.id` | `id` | `crewRole` | liste | 0 | 0 / 0 |
| `ship-criticals.json` | `tables.coque[].crewHit.test.test.skill.id` | `id` | `skill` | liste | 4 | 4 / 4 |
| `ship-criticals.json` | `tables.coque[].crewHit.test.success\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `ship-criticals.json` | `tables.coque[].crewHit.test.fail\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `ship-criticals.json` | `tables.avirons[].crewHit.crewTarget\|1.stations[]` | `stations` | `shipStation` | liste | 2 | 2 / 2 |
| `ship-criticals.json` | `tables.avirons[].crewHit.crewTarget\|2.role.id` | `id` | `crewRole` | liste | 0 | 0 / 0 |
| `ship-criticals.json` | `tables.avirons[].crewHit.test.test.skill.id` | `id` | `skill` | liste | 2 | 2 / 2 |
| `ship-criticals.json` | `tables.avirons[].crewHit.test.success\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `ship-criticals.json` | `tables.avirons[].crewHit.test.fail\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `ship-criticals.json` | `tables.equipements[].crewHit.crewTarget\|1.stations[]` | `stations` | `shipStation` | liste | 0 | 0 / 0 |
| `ship-criticals.json` | `tables.equipements[].crewHit.crewTarget\|2.role.id` | `id` | `crewRole` | liste | 0 | 0 / 0 |
| `ship-criticals.json` | `tables.equipements[].crewHit.test.test.skill.id` | `id` | `skill` | liste | 1 | 1 / 1 |
| `ship-criticals.json` | `tables.equipements[].crewHit.test.success\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `ship-criticals.json` | `tables.equipements[].crewHit.test.fail\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `ship-stations.json` | `[].requiresTrait.id` | `id` | `navalTrait` | liste | 2 | 2 / 2 |
| `species.json` | `[].skills[]\|0.id` | `id` | `skill` | liste | 315 | 315 / 315 |
| `species.json` | `[].skills[]\|1\|0.of[]\|0.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `species.json` | `[].skills[]\|1\|0.of[]\|1.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `species.json` | `[].skills[]\|1\|1.table.id` | `id` | `table` | liste | 0 | 0 / 0 |
| `species.json` | `[].talents[]\|0.id` | `id` | `talent` | liste | 77 | 77 / 77 |
| `species.json` | `[].talents[]\|1\|0.of[]\|0.id` | `id` | `talent` | liste | 78 | 78 / 78 |
| `species.json` | `[].talents[]\|1\|0.of[]\|1.id` | `id` | `talent` | liste | 78 | 78 / 78 |
| `species.json` | `[].talents[]\|1\|1.table.id` | `id` | `table` | liste | 0 | 0 / 0 |
| `species.json` | `[].profilStandard.id` | `id` | `creature` | liste | 26 | 26 / 26 |
| `species.json` | `[].previewCareer.id` | `id` | `career` | liste | 27 | 27 / 27 |
| `spells.json` | `[].range\|2.value\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `spells.json` | `[].target\|1.n\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `spells.json` | `[].target\|2.meters\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `spells.json` | `[].target\|3.lengthMeters\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `spells.json` | `[].target\|3.widthMeters\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `spells.json` | `[].duration\|1.value\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `spells.json` | `[].duration\|2.value\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `spells.json` | `[].opposed.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `spells.json` | `[].effects\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `spells.json` | `[].variants[].duration\|1.value\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `spells.json` | `[].variants[].duration\|2.value\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `spells.json` | `[].variants[].effects\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `steam-breakdown.json` | `[].restart[].skill.id` | `id` | `skill` | liste | 4 | 4 / 4 |
| `structures.json` | `[].traits[].id` | `id` | `trait` | liste | 5 | 5 / 5 |
| `symptoms.json` | `[].effects[].flow\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `symptoms.json` | `[].onTick.test.test.skill.id` | `id` | `skill` | liste | 2 | 2 / 2 |
| `symptoms.json` | `[].onTick.test.success\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `symptoms.json` | `[].onTick.test.fail\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `talents.json` | `[].test.matches[].skill.id` | `id` | `skill` | liste | 112 | 112 / 112 |
| `talents.json` | `[].effects[].flow\|3.test.skill.id` | `id` | `skill` | liste | 2 | 2 / 2 |
| `talents.json` | `[].combat.reverseFailed.skills[].id` | `id` | `skill` | liste | 9 | 9 / 9 |
| `talents.json` | `[].variants[].test.matches[].skill.id` | `id` | `skill` | liste | 4 | 4 / 4 |
| `talents.json` | `[].variants[].combat.reverseFailed.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `tavernGames.json` | `[].skill.id` | `id` | `skill` | liste | 9 | 9 / 9 |
| `tavernGames.json` | `[].fastSkill.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `tavernGames.json` | `[].options[].skill.id` | `id` | `skill` | liste | 4 | 4 / 4 |
| `tavernGames.json` | `[].combined.second.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `tavernGames.json` | `[].throwerPenalty.test.skill.id` | `id` | `skill` | liste | 1 | 1 / 1 |
| `terrains.json` | `[].overlayProp` | `overlayProp` | `prop` | liste | 1 | 1 / 1 |
| `terrains.json` | `[].matiere` | `matiere` | `material` | liste | 1 | 1 / 1 |
| `traits.json` | `[].effects[].flow\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `trappings.json` | `[].onHitEffects[].flow\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `trappings.json` | `[].consumable\|3.test.skill.id` | `id` | `skill` | liste | 6 | 6 / 6 |
| `trappings.json` | `[].consumableDuration.minutes\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `trappings.json` | `[].consumableDuration.hours\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `trappings.json` | `[].consumableDuration.days\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `traumas.json` | `[].cumul.unite\|10.rule` | `rule` | `regleOptionnelle` | liste | 0 | 0 / 0 |
| `vehicles.json` | `[].ship.traits[].id` | `id` | `navalTrait` | liste | 20 | 20 / 20 |
| `water-exposure.json` | `test.skill.id` | `id` | `skill` | un | 1 | 1 / 1 |
| `arene-projet.json` | `scenes[].effectZones[].crossTest.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].reliefDefaults.cliff` | `cliff` | `material` | liste | 18 | 18 / 18 |
| `arene-projet.json` | `scenes[].reliefDefaults.ramp` | `ramp` | `material` | liste | 18 | 18 / 18 |
| `arene-projet.json` | `scenes[].reliefDefaults.deck` | `deck` | `material` | liste | 18 | 18 / 18 |
| `arene-projet.json` | `scenes[].reliefDefaults.pilier` | `pilier` | `material` | liste | 18 | 18 / 18 |
| `arene-projet.json` | `scenes[].roofDefaults.material` | `material` | `material` | liste | 18 | 18 / 18 |
| `arene-projet.json` | `scenes[].layers[].tiles[]` | `tiles` | `terrain` | liste | 13940 | 13940 / 13940 |
| `arene-projet.json` | `scenes[].entities[].statblock.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|4.ref\|0\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|4.ref\|0\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|4.ref\|1.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|16.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|51.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|51.foes[].ref\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|51.foes[].ref\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|54.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].entities[].usable.actions[].flow\|3.test.skill.id` | `id` | `skill` | liste | 4 | 4 / 4 |
| `arene-projet.json` | `scenes[].entities[].combat.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].architecture[].style` | `style` | `building` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].architecture[].masses[].material` | `material` | `material` | liste | 9 | 9 / 9 |
| `arene-projet.json` | `scenes[].architecture[].roofDefaults.material` | `material` | `material` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|4.ref\|0\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|4.ref\|0\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|4.ref\|1.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|16.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|51.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|51.foes[].ref\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|51.foes[].ref\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|54.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|3.test.skill.id` | `id` | `skill` | liste | 3 | 3 / 3 |
| `arene-projet.json` | `scenes[].triggers[].flow\|1.effect\|4.ref\|0\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].triggers[].flow\|1.effect\|4.ref\|0\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].triggers[].flow\|1.effect\|4.ref\|1.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].triggers[].flow\|1.effect\|16.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].triggers[].flow\|1.effect\|51.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].triggers[].flow\|1.effect\|51.foes[].ref\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].triggers[].flow\|1.effect\|51.foes[].ref\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].triggers[].flow\|1.effect\|54.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].triggers[].flow\|3.test.skill.id` | `id` | `skill` | liste | 2 | 2 / 2 |
| `arene-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|4.ref\|0\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|4.ref\|0\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|4.ref\|1.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|16.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|51.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|51.foes[].ref\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|51.foes[].ref\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|54.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `scenes[].encounters[].onVictory\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `worldMap.places[].port.ref` | `ref` | `navalPort` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `worldMap.routes[].perils[].effects[]\|4.ref\|0\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `worldMap.routes[].perils[].effects[]\|4.ref\|0\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `worldMap.routes[].perils[].effects[]\|4.ref\|1.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `worldMap.routes[].perils[].effects[]\|16.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `worldMap.routes[].perils[].effects[]\|19.flow\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `worldMap.routes[].perils[].effects[]\|46.reward\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `worldMap.routes[].perils[].effects[]\|51.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `worldMap.routes[].perils[].effects[]\|51.foes[].ref\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `worldMap.routes[].perils[].effects[]\|51.foes[].ref\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `worldMap.routes[].perils[].effects[]\|54.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `narratif.presetsPnj[].base` | `base` | `creature` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `narratif.presetsPnj[].profil.optionals[]\|2.grant[]\|1.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `arene-projet.json` | `narratif.presetsPnj[].profil.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].effectZones[].crossTest.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].reliefDefaults.cliff` | `cliff` | `material` | liste | 3 | 3 / 3 |
| `barge-du-sel-projet.json` | `scenes[].reliefDefaults.ramp` | `ramp` | `material` | liste | 3 | 3 / 3 |
| `barge-du-sel-projet.json` | `scenes[].reliefDefaults.deck` | `deck` | `material` | liste | 3 | 3 / 3 |
| `barge-du-sel-projet.json` | `scenes[].reliefDefaults.pilier` | `pilier` | `material` | liste | 3 | 3 / 3 |
| `barge-du-sel-projet.json` | `scenes[].roofDefaults.material` | `material` | `material` | liste | 3 | 3 / 3 |
| `barge-du-sel-projet.json` | `scenes[].layers[].tiles[]` | `tiles` | `terrain` | liste | 504 | 504 / 504 |
| `barge-du-sel-projet.json` | `scenes[].entities[].statblock.skills[].id` | `id` | `skill` | liste | 6 | 6 / 6 |
| `barge-du-sel-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|4.ref\|0\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|4.ref\|0\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|4.ref\|1.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|16.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|51.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|51.foes[].ref\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|51.foes[].ref\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|54.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].entities[].usable.actions[].flow\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].entities[].combat.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].architecture[].style` | `style` | `building` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].architecture[].masses[].material` | `material` | `material` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].architecture[].roofDefaults.material` | `material` | `material` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|4.ref\|0\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|4.ref\|0\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|4.ref\|1.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|16.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|51.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|51.foes[].ref\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|51.foes[].ref\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|54.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].triggers[].flow\|1.effect\|4.ref\|0\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].triggers[].flow\|1.effect\|4.ref\|0\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].triggers[].flow\|1.effect\|4.ref\|1.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].triggers[].flow\|1.effect\|16.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].triggers[].flow\|1.effect\|51.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].triggers[].flow\|1.effect\|51.foes[].ref\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].triggers[].flow\|1.effect\|51.foes[].ref\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].triggers[].flow\|1.effect\|54.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].triggers[].flow\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|4.ref\|0\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|4.ref\|0\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|4.ref\|1.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|16.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|51.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|51.foes[].ref\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|51.foes[].ref\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|54.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `scenes[].encounters[].onVictory\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `worldMap.places[].port.ref` | `ref` | `navalPort` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `worldMap.routes[].perils[].effects[]\|4.ref\|0\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `worldMap.routes[].perils[].effects[]\|4.ref\|0\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `worldMap.routes[].perils[].effects[]\|4.ref\|1.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `worldMap.routes[].perils[].effects[]\|16.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `worldMap.routes[].perils[].effects[]\|19.flow\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `worldMap.routes[].perils[].effects[]\|46.reward\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `worldMap.routes[].perils[].effects[]\|51.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `worldMap.routes[].perils[].effects[]\|51.foes[].ref\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `worldMap.routes[].perils[].effects[]\|51.foes[].ref\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `worldMap.routes[].perils[].effects[]\|54.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `narratif.presetsPnj[].base` | `base` | `creature` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `narratif.presetsPnj[].profil.optionals[]\|2.grant[]\|1.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `barge-du-sel-projet.json` | `narratif.presetsPnj[].profil.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].effectZones[].crossTest.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].reliefDefaults.cliff` | `cliff` | `material` | liste | 2 | 2 / 2 |
| `diligence-projet.json` | `scenes[].reliefDefaults.ramp` | `ramp` | `material` | liste | 2 | 2 / 2 |
| `diligence-projet.json` | `scenes[].reliefDefaults.deck` | `deck` | `material` | liste | 2 | 2 / 2 |
| `diligence-projet.json` | `scenes[].reliefDefaults.pilier` | `pilier` | `material` | liste | 2 | 2 / 2 |
| `diligence-projet.json` | `scenes[].roofDefaults.material` | `material` | `material` | liste | 2 | 2 / 2 |
| `diligence-projet.json` | `scenes[].layers[].tiles[]` | `tiles` | `terrain` | liste | 2624 | 2624 / 2624 |
| `diligence-projet.json` | `scenes[].entities[].statblock.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|4.ref\|0\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|4.ref\|0\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|4.ref\|1.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|16.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|51.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|51.foes[].ref\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|51.foes[].ref\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|54.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].entities[].usable.actions[].flow\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].entities[].combat.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].architecture[].style` | `style` | `building` | liste | 1 | 1 / 1 |
| `diligence-projet.json` | `scenes[].architecture[].masses[].material` | `material` | `material` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].architecture[].roofDefaults.material` | `material` | `material` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|4.ref\|0\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|4.ref\|0\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|4.ref\|1.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|16.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|51.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|51.foes[].ref\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|51.foes[].ref\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|54.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].triggers[].flow\|1.effect\|4.ref\|0\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].triggers[].flow\|1.effect\|4.ref\|0\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].triggers[].flow\|1.effect\|4.ref\|1.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].triggers[].flow\|1.effect\|16.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].triggers[].flow\|1.effect\|51.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].triggers[].flow\|1.effect\|51.foes[].ref\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].triggers[].flow\|1.effect\|51.foes[].ref\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].triggers[].flow\|1.effect\|54.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].triggers[].flow\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|4.ref\|0\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|4.ref\|0\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|4.ref\|1.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|16.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|51.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|51.foes[].ref\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|51.foes[].ref\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|54.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `scenes[].encounters[].onVictory\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `worldMap.places[].port.ref` | `ref` | `navalPort` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `worldMap.routes[].perils[].effects[]\|4.ref\|0\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `worldMap.routes[].perils[].effects[]\|4.ref\|0\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `worldMap.routes[].perils[].effects[]\|4.ref\|1.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `worldMap.routes[].perils[].effects[]\|16.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `worldMap.routes[].perils[].effects[]\|19.flow\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `worldMap.routes[].perils[].effects[]\|46.reward\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `worldMap.routes[].perils[].effects[]\|51.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `worldMap.routes[].perils[].effects[]\|51.foes[].ref\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `worldMap.routes[].perils[].effects[]\|51.foes[].ref\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `worldMap.routes[].perils[].effects[]\|54.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `narratif.presetsPnj[].base` | `base` | `creature` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `narratif.presetsPnj[].profil.optionals[]\|2.grant[]\|1.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `diligence-projet.json` | `narratif.presetsPnj[].profil.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].effectZones[].crossTest.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].reliefDefaults.cliff` | `cliff` | `material` | liste | 5 | 5 / 5 |
| `loup-et-saumure-projet.json` | `scenes[].reliefDefaults.ramp` | `ramp` | `material` | liste | 5 | 5 / 5 |
| `loup-et-saumure-projet.json` | `scenes[].reliefDefaults.deck` | `deck` | `material` | liste | 5 | 5 / 5 |
| `loup-et-saumure-projet.json` | `scenes[].reliefDefaults.pilier` | `pilier` | `material` | liste | 5 | 5 / 5 |
| `loup-et-saumure-projet.json` | `scenes[].roofDefaults.material` | `material` | `material` | liste | 5 | 5 / 5 |
| `loup-et-saumure-projet.json` | `scenes[].layers[].tiles[]` | `tiles` | `terrain` | liste | 1086 | 1086 / 1086 |
| `loup-et-saumure-projet.json` | `scenes[].entities[].statblock.skills[].id` | `id` | `skill` | liste | 12 | 12 / 12 |
| `loup-et-saumure-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|4.ref\|0\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|4.ref\|0\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|4.ref\|1.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|16.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|51.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|51.foes[].ref\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|51.foes[].ref\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].entities[].usable.actions[].flow\|1.effect\|54.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].entities[].usable.actions[].flow\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].entities[].combat.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].architecture[].style` | `style` | `building` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].architecture[].masses[].material` | `material` | `material` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].architecture[].roofDefaults.material` | `material` | `material` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|4.ref\|0\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|4.ref\|0\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|4.ref\|1.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|16.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|51.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|51.foes[].ref\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|51.foes[].ref\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|1.effect\|54.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].dialogues[].nodes[].choices[].flow\|3.test.skill.id` | `id` | `skill` | liste | 2 | 2 / 2 |
| `loup-et-saumure-projet.json` | `scenes[].triggers[].flow\|1.effect\|4.ref\|0\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].triggers[].flow\|1.effect\|4.ref\|0\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].triggers[].flow\|1.effect\|4.ref\|1.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].triggers[].flow\|1.effect\|16.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].triggers[].flow\|1.effect\|51.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].triggers[].flow\|1.effect\|51.foes[].ref\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].triggers[].flow\|1.effect\|51.foes[].ref\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].triggers[].flow\|1.effect\|54.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].triggers[].flow\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|4.ref\|0\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|4.ref\|0\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|4.ref\|1.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|16.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|51.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|51.foes[].ref\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|51.foes[].ref\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].encounters[].onVictory\|1.effect\|54.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `scenes[].encounters[].onVictory\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `worldMap.places[].port.ref` | `ref` | `navalPort` | liste | 2 | 2 / 2 |
| `loup-et-saumure-projet.json` | `worldMap.routes[].perils[].effects[]\|4.ref\|0\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `worldMap.routes[].perils[].effects[]\|4.ref\|0\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `worldMap.routes[].perils[].effects[]\|4.ref\|1.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `worldMap.routes[].perils[].effects[]\|16.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `worldMap.routes[].perils[].effects[]\|19.flow\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `worldMap.routes[].perils[].effects[]\|46.reward\|3.test.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `worldMap.routes[].perils[].effects[]\|51.skill.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `worldMap.routes[].perils[].effects[]\|51.foes[].ref\|0.creatureId` | `creatureId` | `creature` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `worldMap.routes[].perils[].effects[]\|51.foes[].ref\|1.custom.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `worldMap.routes[].perils[].effects[]\|54.vehicleId` | `vehicleId` | `vehicle` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `narratif.presetsPnj[].base` | `base` | `creature` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `narratif.presetsPnj[].profil.optionals[]\|2.grant[]\|1.id` | `id` | `skill` | liste | 0 | 0 / 0 |
| `loup-et-saumure-projet.json` | `narratif.presetsPnj[].profil.skills[].id` | `id` | `skill` | liste | 0 | 0 / 0 |

Champs porteurs de réfs OBSERVÉES que le déclaré ATTEINT : **21** — `activities.json | rule` `arene-projet.json | material` `arene-projet.json | ref` `arene-projet.json | tiles` `barge-du-sel-projet.json | ref` `barge-du-sel-projet.json | tiles` `buildings.json | roofMaterial` `defauts-de-compilation.json | cheminDeRonde` `defauts-de-compilation.json | masse` `defauts-de-compilation.json | pont` `diligence-projet.json | ref` `diligence-projet.json | style` `diligence-projet.json | tiles` `loup-et-saumure-projet.json | ref` `loup-et-saumure-projet.json | tiles` `merchants.json | curated` `river-criticals.json | stations` `semences-de-scene.json | terrain` `ship-criticals.json | stations` `terrains.json | matiere` `terrains.json | overlayProp`. Une jointure VIDE rendrait ce volet muet :
la garde l’exige NON VIDE.

### 6.2 Couverture — réfs observées qu’AUCUN slot ne déclare

La dette d’ADOPTION du registre : un `(dataset, champ)` porteur de références mesurées (strate
`Référence`) que le déclaré n’atteint par aucun slot. Stock `SLOTS_SANS_DECLARATION`
(`scripts/guards/lib/slotsStock.mjs`, garde `src/data/slots-contrat.test.ts`) — il se solde concept
par concept en L2/L3 (#1473), et ne fait que DÉCROÎTRE.

**345** couples (dataset, champ) sans slot déclaré.

| Dataset | Champ | Occurrences observées |
|---|---|---|
| `actions.json` | `armed` | 3 |
| `actions.json` | `gate` | 2 |
| `actions.json` | `hote` | 1 |
| `actions.json` | `keys` | 27 |
| `actions.json` | `mode` | 4 |
| `actions.json` | `rule` | 32 |
| `activities.json` | `chains` | 4 |
| `activities.json` | `cible` | 1 |
| `activities.json` | `classes` | 12 |
| `activities.json` | `factor` | 1 |
| `activities.json` | `mod` | 2 |
| `activities.json` | `ops` | 17 |
| `activities.json` | `skills` | 64 |
| `activities.json` | `where` | 5 |
| `arcane-phenomena.json` | `cancelsTraitId` | 1 |
| `arcane-phenomena.json` | `domainId` | 8 |
| `arcane-phenomena.json` | `domainIds` | 10 |
| `arcane-phenomena.json` | `domains` | 12 |
| `arcane-phenomena.json` | `domainsExcept` | 1 |
| `arcane-phenomena.json` | `environments` | 4 |
| `arcane-phenomena.json` | `fluxTableId` | 1 |
| `arcane-phenomena.json` | `spellIds` | 1 |
| `arcane-phenomena.json` | `tableId` | 2 |
| `arene-projet.json` | `a` | 4 |
| `arene-projet.json` | `acts` | 1 |
| `arene-projet.json` | `ambush` | 4 |
| `arene-projet.json` | `appearance` | 25 |
| `arene-projet.json` | `b` | 4 |
| `arene-projet.json` | `choices` | 14 |
| `arene-projet.json` | `dialogueId` | 9 |
| `arene-projet.json` | `effect` | 72 |
| `arene-projet.json` | `members` | 116 |
| `arene-projet.json` | `merchant` | 4 |
| `arene-projet.json` | `modes` | 1 |
| `arene-projet.json` | `optionals` | 13 |
| `arene-projet.json` | `qualities` | 2 |
| `arene-projet.json` | `reliefDefaults` | 18 |
| `arene-projet.json` | `roofDefaults` | 18 |
| `arene-projet.json` | `roomZoneIds` | 12 |
| `arene-projet.json` | `scene` | 4 |
| `arene-projet.json` | `skill` | 10 |
| `arene-projet.json` | `spells` | 2 |
| `arene-projet.json` | `start` | 9 |
| `arene-projet.json` | `traits` | 11 |
| `arene-projet.json` | `walls` | 235 |
| `arene-projet.json` | `weapon` | 6 |
| `axes.json` | `skills` | 15 |
| `axes.json` | `talents` | 4 |
| `barge-du-sel-projet.json` | `a` | 1 |
| `barge-du-sel-projet.json` | `ambush` | 1 |
| `barge-du-sel-projet.json` | `ammo` | 8 |
| `barge-du-sel-projet.json` | `appearance` | 4 |
| `barge-du-sel-projet.json` | `b` | 1 |
| `barge-du-sel-projet.json` | `crew` | 1 |
| `barge-du-sel-projet.json` | `crewIds` | 2 |
| `barge-du-sel-projet.json` | `effect` | 1 |
| `barge-du-sel-projet.json` | `members` | 7 |
| `barge-du-sel-projet.json` | `postes` | 6 |
| `barge-du-sel-projet.json` | `qualities` | 15 |
| `barge-du-sel-projet.json` | `reliefDefaults` | 3 |
| `barge-du-sel-projet.json` | `roofDefaults` | 3 |
| `barge-du-sel-projet.json` | `scene` | 2 |
| `barge-du-sel-projet.json` | `skills` | 6 |
| `barge-du-sel-projet.json` | `victoryCondition` | 1 |
| `buildings.json` | `features` | 4 |
| `careerLevels.json` | `career` | 432 |
| `careerLevels.json` | `choice` | 29 |
| `careerLevels.json` | `of` | 11 |
| `careerLevels.json` | `skills` | 2237 |
| `careerLevels.json` | `talents` | 1724 |
| `careerLevels.json` | `trappings` | 1286 |
| `careers.json` | `class` | 108 |
| `careers.json` | `grantGroups` | 6 |
| `careers.json` | `tenue` | 15 |
| `classes.json` | `grantGroups` | 1 |
| `classes.json` | `trappings` | 56 |
| `combat-stakes.json` | `entryCategory` | 1 |
| `combat-stakes.json` | `kind` | 7 |
| `combat-stakes.json` | `rule` | 25 |
| `creatures.json` | `appearance` | 456 |
| `creatures.json` | `features` | 1 |
| `creatures.json` | `grant` | 5 |
| `creatures.json` | `grantGroups` | 90 |
| `creatures.json` | `monster` | 1 |
| `creatures.json` | `optionals` | 649 |
| `creatures.json` | `remove` | 3 |
| `creatures.json` | `skills` | 5981 |
| `creatures.json` | `spec` | 1 |
| `creatures.json` | `spells` | 599 |
| `creatures.json` | `talents` | 1724 |
| `creatures.json` | `traits` | 3049 |
| `creatures.json` | `trappings` | 132 |
| `crew-roles.json` | `skills` | 10 |
| `crew-test-types.json` | `essential` | 10 |
| `crew-test-types.json` | `roles` | 10 |
| `crew-test-types.json` | `rule` | 10 |
| `criticals.json` | `apresDelai` | 2 |
| `criticals.json` | `onHealGrant` | 2 |
| `criticals.json` | `onNextCritWhileCondition` | 1 |
| `criticals.json` | `ops` | 215 |
| `criticals.json` | `perRound` | 2 |
| `criticals.json` | `recoveryPenalty` | 4 |
| `criticals.json` | `sequels` | 26 |
| `criticals.json` | `skill` | 39 |
| `criticals.json` | `subject` | 1 |
| `criticals.json` | `traumas` | 48 |
| `criticals.json` | `whenClear` | 2 |
| `diligence-projet.json` | `a` | 1 |
| `diligence-projet.json` | `b` | 1 |
| `diligence-projet.json` | `modes` | 1 |
| `diligence-projet.json` | `reliefDefaults` | 2 |
| `diligence-projet.json` | `roofDefaults` | 2 |
| `diligence-projet.json` | `roomZoneIds` | 38 |
| `diligence-projet.json` | `scene` | 2 |
| `diligence-projet.json` | `walls` | 668 |
| `domains.json` | `amount` | 3 |
| `domains.json` | `castBonus` | 1 |
| `domains.json` | `casterOps` | 1 |
| `domains.json` | `environments` | 1 |
| `domains.json` | `of` | 17 |
| `domains.json` | `ops` | 6 |
| `domains.json` | `requiresSkill` | 2 |
| `domains.json` | `skill` | 2 |
| `domains.json` | `subject` | 1 |
| `domains.json` | `tables` | 8 |
| `drunkenness.json` | `ops` | 1 |
| `etats.json` | `exceptSkills` | 1 |
| `etats.json` | `ops` | 14 |
| `etats.json` | `passive` | 5 |
| `etats.json` | `skill` | 4 |
| `etats.json` | `subject` | 10 |
| `etats.json` | `value` | 2 |
| `flow-stakes.json` | `flow` | 16 |
| `flow-stakes.json` | `phase` | 6 |
| `flow-stakes.json` | `rule` | 33 |
| `gods.json` | `blessings` | 90 |
| `gods.json` | `chaosSpells` | 17 |
| `gods.json` | `grantGroups` | 2 |
| `gods.json` | `miracles` | 96 |
| `grapple.json` | `amount` | 1 |
| `grapple.json` | `entangle` | 1 |
| `grapple.json` | `free` | 1 |
| `grapple.json` | `init` | 1 |
| `groups.json` | `exceptGroups` | 1 |
| `incidents-monture.json` | `skill` | 2 |
| `interludeEvents.json` | `revenueBlockedClasses` | 4 |
| `interludeEvents.json` | `revenueClasses` | 3 |
| `land-cargo.json` | `biens` | 20 |
| `lieux-services.json` | `backdrop` | 2 |
| `lieux-services.json` | `merchantArchetype` | 1 |
| `localisation.json` | `rigs` | 2 |
| `locations.json` | `parent` | 46 |
| `loup-et-saumure-projet.json` | `a` | 2 |
| `loup-et-saumure-projet.json` | `ambush` | 2 |
| `loup-et-saumure-projet.json` | `ammo` | 16 |
| `loup-et-saumure-projet.json` | `appearance` | 19 |
| `loup-et-saumure-projet.json` | `b` | 2 |
| `loup-et-saumure-projet.json` | `backdrop` | 2 |
| `loup-et-saumure-projet.json` | `choices` | 23 |
| `loup-et-saumure-projet.json` | `crew` | 6 |
| `loup-et-saumure-projet.json` | `crewIds` | 4 |
| `loup-et-saumure-projet.json` | `dialogueId` | 8 |
| `loup-et-saumure-projet.json` | `effect` | 6 |
| `loup-et-saumure-projet.json` | `from` | 2 |
| `loup-et-saumure-projet.json` | `members` | 18 |
| `loup-et-saumure-projet.json` | `merchant` | 3 |
| `loup-et-saumure-projet.json` | `port` | 2 |
| `loup-et-saumure-projet.json` | `postes` | 12 |
| `loup-et-saumure-projet.json` | `qualities` | 30 |
| `loup-et-saumure-projet.json` | `reliefDefaults` | 5 |
| `loup-et-saumure-projet.json` | `roofDefaults` | 5 |
| `loup-et-saumure-projet.json` | `scene` | 2 |
| `loup-et-saumure-projet.json` | `serviceKind` | 8 |
| `loup-et-saumure-projet.json` | `services` | 6 |
| `loup-et-saumure-projet.json` | `skill` | 3 |
| `loup-et-saumure-projet.json` | `skills` | 12 |
| `loup-et-saumure-projet.json` | `start` | 8 |
| `loup-et-saumure-projet.json` | `victoryCondition` | 2 |
| `loup-et-saumure-projet.json` | `weapon` | 1 |
| `maladies.json` | `dailyTest` | 1 |
| `maladies.json` | `mutation` | 1 |
| `maladies.json` | `ops` | 1 |
| `maladies.json` | `otherwise` | 1 |
| `maladies.json` | `symptoms` | 62 |
| `maneuvers.json` | `escapeStrength` | 2 |
| `maneuvers.json` | `ops` | 22 |
| `maneuvers.json` | `skill` | 2 |
| `merchantFamilies.json` | `columns` | 1 |
| `merchantFamilies.json` | `match` | 3 |
| `merchants.json` | `categories` | 1 |
| `merchants.json` | `subTypes` | 5 |
| `miscast.json` | `onFail` | 15 |
| `miscast.json` | `ops` | 39 |
| `miscast.json` | `skill` | 26 |
| `montures.json` | `creatureIds` | 8 |
| `mutations.json` | `eyes` | 1 |
| `mutations.json` | `features` | 54 |
| `mutations.json` | `ops` | 2 |
| `mutations.json` | `passive` | 106 |
| `mutations.json` | `skill` | 2 |
| `naval-ports.json` | `production` | 38 |
| `naval-traits.json` | `passive` | 2 |
| `naval-traits.json` | `skill` | 3 |
| `night-stakes.json` | `kind` | 9 |
| `night-stakes.json` | `rule` | 15 |
| `pregens.json` | `career` | 8 |
| `pregens.json` | `species` | 8 |
| `progression-schemas.derived.json` | `livres` | 1 |
| `progression-schemas.derived.json` | `titresPage` | 2 |
| `props.json` | `light` | 6 |
| `props.json` | `primitives` | 379 |
| `psychology.json` | `becomes` | 1 |
| `psychology.json` | `failCondition` | 1 |
| `psychology.json` | `immuneToFromTarget` | 1 |
| `psychology.json` | `immuneWhileActive` | 1 |
| `psychology.json` | `ops` | 2 |
| `psychology.json` | `skill` | 7 |
| `psychology.json` | `subject` | 2 |
| `psychology.json` | `targetCauses` | 1 |
| `qualities.json` | `beats` | 2 |
| `qualities.json` | `escapeStrength` | 1 |
| `qualities.json` | `opposed` | 1 |
| `qualities.json` | `ops` | 11 |
| `qualities.json` | `passive` | 1 |
| `qualities.json` | `skill` | 2 |
| `raceAppearance.json` | `featureKeys` | 5 |
| `raceAppearance.json` | `gabarit` | 6 |
| `raceAppearance.json` | `head` | 7 |
| `raceAppearance.json` | `tenue` | 14 |
| `reglesOptionnelles.json` | `default` | 1 |
| `reglesOptionnelles.json` | `options` | 3 |
| `river-criticals.json` | `ops` | 5 |
| `sea-events.json` | `escalation` | 1 |
| `sea-events.json` | `params` | 9 |
| `sea-events.json` | `skills` | 1 |
| `sea-shanties.json` | `captainOps` | 1 |
| `sea-shanties.json` | `crewOps` | 1 |
| `sea-shanties.json` | `skill` | 3 |
| `sea-weather.json` | `skills` | 5 |
| `sea-weather.json` | `spec` | 3 |
| `semences-de-scene.json` | `reliefDefaults` | 1 |
| `semences-de-scene.json` | `roofDefaults` | 1 |
| `ship-construction.json` | `constructionTraits` | 4 |
| `ship-criticals.json` | `ops` | 11 |
| `ship-criticals.json` | `skill` | 12 |
| `ship-stations.json` | `requiresTrait` | 2 |
| `skills.json` | `altChar` | 2 |
| `skills.json` | `chars` | 2 |
| `skills.json` | `max` | 1 |
| `species.json` | `gatedByRule` | 1 |
| `species.json` | `grantGroups` | 27 |
| `species.json` | `of` | 80 |
| `species.json` | `previewCareer` | 27 |
| `species.json` | `profilStandard` | 26 |
| `species.json` | `skills` | 315 |
| `species.json` | `talents` | 96 |
| `speciesRace.json` | `all` | 1 |
| `speciesRace.json` | `any` | 1 |
| `speciesRace.json` | `default` | 1 |
| `speciesRace.json` | `prefix` | 17 |
| `speciesRace.json` | `rules` | 22 |
| `spells.json` | `addQualities` | 8 |
| `spells.json` | `addTraits` | 5 |
| `spells.json` | `cond` | 3 |
| `spells.json` | `domainId` | 256 |
| `spells.json` | `domains` | 12 |
| `spells.json` | `exceptGroups` | 2 |
| `spells.json` | `of` | 8 |
| `spells.json` | `onCross` | 4 |
| `spells.json` | `onlyGroups` | 7 |
| `spells.json` | `ops` | 206 |
| `spells.json` | `perRound` | 6 |
| `spells.json` | `qualities` | 5 |
| `spells.json` | `skill` | 50 |
| `spells.json` | `subject` | 1 |
| `spells.json` | `when` | 18 |
| `stars.json` | `ascendant` | 11 |
| `stars.json` | `ops` | 55 |
| `steam-breakdown.json` | `skill` | 4 |
| `structures.json` | `traits` | 5 |
| `symptoms.json` | `grave` | 1 |
| `symptoms.json` | `minutes` | 1 |
| `symptoms.json` | `moderee` | 6 |
| `symptoms.json` | `ops` | 12 |
| `symptoms.json` | `passive` | 26 |
| `symptoms.json` | `skill` | 2 |
| `symptoms.json` | `visiblePassive` | 1 |
| `tables.json` | `of` | 1 |
| `tables.json` | `ops` | 79 |
| `tables.json` | `skill` | 15 |
| `talents.json` | `effects` | 1 |
| `talents.json` | `gate` | 1 |
| `talents.json` | `matches` | 1 |
| `talents.json` | `ops` | 3 |
| `talents.json` | `passive` | 1 |
| `talents.json` | `skill` | 123 |
| `talents.json` | `skills` | 9 |
| `talents.json` | `when` | 12 |
| `tavernGames.json` | `attrition` | 1 |
| `tavernGames.json` | `combined` | 1 |
| `tavernGames.json` | `skill` | 14 |
| `traits.json` | `affectsGroups` | 2 |
| `traits.json` | `amount` | 1 |
| `traits.json` | `bonus` | 3 |
| `traits.json` | `capabilities` | 3 |
| `traits.json` | `cond` | 3 |
| `traits.json` | `escapeStrength` | 4 |
| `traits.json` | `grantGroups` | 4 |
| `traits.json` | `grantsManeuvers` | 20 |
| `traits.json` | `markMutations` | 1 |
| `traits.json` | `of` | 2 |
| `traits.json` | `ops` | 21 |
| `traits.json` | `passive` | 49 |
| `traits.json` | `skill` | 18 |
| `traits.json` | `subject` | 6 |
| `traits.json` | `suppressesCapabilities` | 1 |
| `traits.json` | `value` | 2 |
| `trappings.json` | `cond` | 1 |
| `trappings.json` | `defaultAmmo` | 9 |
| `trappings.json` | `derivedWeapon` | 1 |
| `trappings.json` | `diseases` | 5 |
| `trappings.json` | `exceptGroups` | 1 |
| `trappings.json` | `onlyGroups` | 2 |
| `trappings.json` | `ops` | 53 |
| `trappings.json` | `passive` | 4 |
| `trappings.json` | `qualities` | 438 |
| `trappings.json` | `shape` | 43 |
| `trappings.json` | `siegeRig` | 18 |
| `trappings.json` | `skill` | 29 |
| `trappings.json` | `subType` | 441 |
| `trappings.json` | `subject` | 2 |
| `trappings.json` | `weaponGroup` | 22 |
| `traumas.json` | `byProsthesis` | 3 |
| `traumas.json` | `escalade` | 3 |
| `traumas.json` | `ops` | 16 |
| `traumas.json` | `prosthesis` | 9 |
| `traumas.json` | `rig` | 2 |
| `traumas.json` | `skill` | 13 |
| `vehicles.json` | `draft` | 1 |
| `vehicles.json` | `traits` | 20 |
| `voyage-stakes.json` | `kind` | 15 |
| `voyage-stakes.json` | `rule` | 32 |
| `water-exposure.json` | `auto` | 4 |
| `weaponGroups.json` | `qualities` | 5 |
| `weather.json` | `physicalTestChars` | 1 |

### 6.3 Angles morts DÉCLARÉS de ce volet

Source UNIQUE `ANGLES_MORTS_SLOTS` (`scripts/docs/lib/structures-lexique.mts`) — l’espèce `acteur`
pèse **2990** slots sur 3449.

- L’espèce `acteur` (`actorRefSchema`) est HORS résolution : elle désigne l’acteur d’une mécanique par un ENUM, pas l’id d’une entité d’un dataset — ce n’est pas une FK.
- Un slot dont le `type` n’est pas un type du registre `_ids.generated` (entité INTERNE à une scène : pion, nœud de dialogue) n’est pas résoluble ici — l’index qui les porte est celui du scan (documents EMBARQUÉS), pas le registre généré. Ces slots sont au stock `SLOTS_INTERNES`, listés et jamais résolus ; l’unification passe par `typedRef` en L2 (#1473).
- La PROJECTION path → champ retient le DERNIER segment-clé : deux paths distincts qui finissent sur la même clé se joignent au même champ observé, et la couverture y est SUR-estimée — jusqu’à couvrir un champ ENTIER qu’aucun slot ne déclare. Mesuré le 2026-09-22 : la déclaration de `worldMap.places[].port.ref` (`idDe('navalPort')`) se joint aux `ref` des entités de scène des 4 paquets `*-projet.json` (444 occurrences : 314 `prop`, 130 `personnage`), qui ne portent AUCUN slot déclaré à leur path — le `ref` d’un décor est résolu par le `superRefine` par `kind` de `sceneEntitySchema` (`idDe('prop')`, #877), celui d’un personnage par aucun schéma (`defs-scenes/scene.ts`).
- Symétrique et INVERSE : une référence ENVELOPPÉE (`{id}` posé par `ref(type)`) projette sur la clé `id`, jamais sur le champ PORTEUR que le scan observe — mesuré 2026-09-01, `species.json › [].previewCareer.id` → `id`, `structures.json › [].traits[].id` → `id`, `vehicles.json › [].ship.traits[].id` → `id`. La couverture est donc SOUS-estimée sur toute référence à enveloppe, et la ligne de `SLOTS_SANS_DECLARATION` du champ porteur NE SE SOLDE PAS par l’adoption de la fabrique : elle survit à la migration qui la rendait caduque.
- `valeursAuPath` traverse une branche d’union (`|N`) sans la discriminer : la donnée ne porte pas la branche qui la parse, chaque branche lit donc les valeurs de toutes — mesuré le 2026-09-22 sur `props.json › [].volume.primitives[]|0..2.material`, 297 valeurs à chacune des trois branches : la résolution y est comptée une fois par branche.

<!-- sources-empreinte: 5cbfb0b0297298a91e638ee40146cfa7ae8ad3d2 (387 fichiers, 10 dossiers) corps: 647a32591ccc3ebdb3bdcb1dd9c99116efdb2d2f -->
