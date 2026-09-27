// LEXIQUE FERMÉ des concepts de structure de la donnée — source UNIQUE consommée par
// `scripts/docs/build-structures.mts` (doc `docs/structures-donnees.md`) ET par la garde
// `src/data/structures-contrat.test.ts` via `scripts/docs/lib/structures-scan.mts`.
//
// LA RÉFÉRENCE EST ANCRÉE SUR L'INDEX DES IDS (#1465 passe 4). Une occurrence de référence n'est
// pas devinée d'un vocabulaire de clés : c'est une paire (objet, clé) dont la valeur RÉSOUT vers
// un document indexé. Le CHAMP PORTEUR (`skills`, `ops`, `members`, `requiresSkill`…) est donc
// MESURÉ — le lexique ne le déclare plus, et aucun seuil ne le décide.
// Le lexique ne garde que ce qu'un lexique peut dire :
//   la GRAPHIE d'une référence (`{id}`, `{id,spec}`, `{ref}`, `{skillId}`…) et son statut ;
//   les concepts de VALEUR, reconnus à leur NOYAU de clés (jamais à un champ porteur) ;
//   les rôles d'ENVELOPPE d'un document.
// Statuts : `cible` = forme visée · `historique` = graphie connue à éteindre · `declaree` = forme
// volontairement conservée · absente du lexique = `divergente`.
//
// Les signatures de statut `cible` sont FIGÉES AU STOCK (`STRUCTURES_CIBLES` de
// `scripts/guards/lib/structuresStock.mjs`, égalité stricte testée) : faire passer une graphie en
// `cible` exige de toucher le stock — un mot du lexique ne solde plus des centaines d'occurrences.

import { basename } from 'node:path';
import { listerProjetsLivres } from '../../guards/lib/projetsLivres.mjs';

/** Signature canonique d'un objet : ses clés triées, jointes par des virgules. */
export const signature = (cles: readonly string[]): string => [...cles].sort().join(',');

export type StatutSignature = 'cible' | 'historique' | 'declaree';

/**
 * SITE d'une entrée de lexique — `(datasets × champs)`. Sans site, l'entrée vaut PARTOUT ; avec, elle
 * ne vaut qu'à ce site et une entrée SANS site sert de repli pour tous les autres. Le statut d'une
 * même graphie peut donc différer d'un porteur à l'autre — ce qui est le cas dès que la charge utile
 * appartient au porteur : `{id, value}` est la CIBLE d'une réf de Compétence de statbloc (la valeur
 * IMPRIMÉE y est un champ de la référence) et reste HISTORIQUE partout ailleurs (un `value` de
 * `trappings › qualities` est un Indice d'Atout, un `value` de `creatures › traits` un paramètre
 * d'entité — concepts lotés L3).
 *
 * Le DATASET seul ne suffit pas et c'est mesuré : `creatures.json` porte `{id,value}` sur `skills`
 * (cible) ET sur `traits`/`optionals` (historique). Le champ entre donc dans la clé. `datasets`
 * absent = le champ, dans TOUT dataset : un champ d'ENVELOPPE (`alsoIn`, `grammaire/document.ts`)
 * est le même nœud partout où la fabrique `document()` le pose.
 */
export type SiteDeSignature = { readonly datasets?: readonly string[]; readonly champs: readonly string[] };
export type SignatureLexique = { sig: string; statut: StatutSignature; note?: string; site?: SiteDeSignature };

/** Les documents qui portent un STATBLOC à valeurs de Test imprimées : le bestiaire et les statblocs
 *  EMBARQUÉS des projets de scène (`CustomStatblock`). MÊME schéma des deux côtés
 *  (`defs/creatures.ts` et `defs-scenes/communs.ts` composent tous deux `refOuSpec('skill', {value})`). */
export const SITE_STATBLOC: SiteDeSignature = {
  datasets: ['creatures.json', ...listerProjetsLivres().map((rel) => basename(rel))],
  champs: ['skills'],
};

/** L'emplacement SECONDAIRE d'une entrée (`alsoIn`, `secondarySourceRefSchema` de
 *  `grammaire/valeurs.ts`) : la référence de source plus sa preuve `quote`, dans tout document. */
export const SITE_EMPLACEMENT_SECONDAIRE: SiteDeSignature = { champs: ['alsoIn'] };

/**
 * Strate de la grammaire (#1463, design 2026-08-23) à laquelle une forme appartient.
 * QUATRE strates : la strate `Instance` du design v2 (SkillInstance, ItemInstance, snapshot de
 * sauvegarde) est HORS PÉRIMÈTRE PAR CONSTRUCTION — les deux racines mesurées ne portent que des
 * documents AUTHORÉS ; son dénominateur se mesurera sur le runtime et un snapshot de test
 * (#1463, commentaire « Arbitrages de design L0 (2026-08-23, orchestrateur — suite à la contre-passe
 * du commit 3a6017ebb) », point 1).
 */
export type Strate = 'Référence' | 'Valeur' | 'Ops' | 'Document';

/** Le dataset dont les références sont lotées L2 (les refs de Compétence) — #1463 design v2. */
export const CIBLE_COMPETENCE = 'skills.json';

/**
 * LOT d'extinction d'une ligne de stock : il se DÉDUIT du CONCEPT, il ne s'assigne pas à la main.
 * Un concept vit dans UN SEUL lot sur TOUS ses porteurs (#1463, commentaire « Arbitrages de design L0
 * (2026-08-23, orchestrateur — suite à la contre-passe du commit 3a6017ebb) », point 2) : `source` → L1d ; une référence → L2 quand sa cible est la Compétence,
 * L3 sinon ; toute autre valeur du lexique → L4 ; une structure hors lexique → L1a.
 */
export const lotDeForme = (concept: string, signature: string, cibles: readonly string[] = []): string =>
  concept === 'source'
    ? 'L1d #1469'
    : concept === 'reference' || concept === 'refs'
      ? cibles.includes(CIBLE_COMPETENCE) || /skill/i.test(signature)
        ? 'L2 #1463'
        : 'L3 #1463'
      : concept
        ? 'L4 #1463'
        : 'L1a #1466';

/** Lot d'extinction de chaque clé RÉSERVÉE : celui du concept qui POSSÈDE le nom (#1463 S2). */
export const LOT_CLE_RESERVEE: Readonly<Record<string, string>> = {
  skill: 'L2 #1463',
  talent: 'L3 #1463',
  char: 'L4 #1463',
  price: 'L4 #1463',
  cost: 'L4 #1463',
  count: 'L4 #1463',
  source: 'L1d #1469',
};

/** Les 9 lots d'extinction du chantier — un `lot` de stock hors de cette liste est une dérive.
 *  `L2 #1548` porte les graphies de RÉFÉRENCE du lot L2 (« une graphie par concept référencé ») ;
 *  `#1553` porte la CURATION des orphelines (contenu qui ne résout vers rien), qui n'est pas une
 *  forme d'enveloppe. */
export const LOTS_CONNUS = ['L1a #1466', 'L1b #1467', 'L1c #1468', 'L1d #1469', 'L2 #1463', 'L2 #1548', 'L3 #1463', 'L4 #1463', '#1553'] as const;

/**
 * ANGLES MORTS de la mesure — SOURCE UNIQUE, consommée par la garde
 * (`src/data/structures-contrat.test.ts`, `GARDE.angleMort`), par le générateur
 * (`docs/structures-donnees.md`, § « Périmètre mesuré et angles morts ») et par l'en-tête de
 * `scripts/guards/lib/structuresStock.mjs` (la garde vérifie que l'en-tête les porte TOUS).
 */
export const ANGLES_MORTS: readonly string[] = [
  'La référence est ANCRÉE SUR L’INDEX DES IDS, scopé par DATASET : une occurrence de référence est une paire (objet, clé) dont la valeur RÉSOUT vers un document indexé d’une CIBLE MAJORITAIRE de son site. Le CHAMP PORTEUR (`skills`, `ops`, `members`…) est MESURÉ, jamais déclaré.',
  'La RÉSOLUTION est PAR SITE `(dataset, champ, clé)` : cible(s) MAJORITAIRE(S) = les datasets qui couvrent ≥ 50 % des valeurs résolvantes du site. Une valeur qui ne résout QUE vers une cible non majoritaire est comptée AMBIGUË (§1bis, imprimée avec son site et son dataset parasite) et n’ouvre PAS de référence.',
  'Les COLLISIONS d’ids restent un angle mort du PILOTAGE, pas de la résolution : la colonne « cibles » d’une forme liste tous les datasets atteignables par les valeurs de la ligne.',
  'LOT, MOTIF et DATE d’une forme sont du PILOTAGE : la sonde ne les mesure pas — la forme OBSERVÉE les reprend du stock par son SITE (concept, dataset, champ, signature), si bien que la véracité d’un `motif` est une décision de REVUE qu’aucune garde ne contrôle.',
  'La RÉSOLVABILITÉ d’un `{text}` se mesure sur le LIBELLÉ NORMALISÉ (casse, accents, ponctuation, espaces) d’une entité d’un dataset de la CIBLE MAJORITAIRE de son site — de n’importe quel dataset quand le site n’a pas de cible ; elle ne vérifie AUCUN type d’entité attendu, et un `label` qui est aussi un id peut la faire mordre sur un homonyme : la forme `text (résolvable)` est un candidat à migrer en `{id}`, pas un verdict.',
  'Le partage d’un SITE tranche entre référence cassée et document embarqué, mais les TELLS de document passent avant le ratio (`label` + `source`, ou `label` + ≥ 2 clés de charge utile) et l’égalité tranche pour le DOCUMENT ; un site à UNE seule valeur est un document, sauf si la clé est `…Id`/`…Ids`/`…Ref`.',
  'L’ORDRE DES PASSES est un angle mort déclaré : l’index est complété par les documents EMBARQUÉS (passe 3) AVANT que la résolution ne soit mesurée (passe 4) — un site comme `arene-projet.json › members {entityId}` ne résout que grâce à cet ordre.',
  'Une clé dont la valeur est un LITTÉRAL D’ENUM du schéma zod du document n’ouvre jamais de référence (discriminants `kind`/`type`/`class`/`op`…). Depuis #1466 L1a les DEUX racines sont au registre (`SCHEMA_DEFS` + `SCHEMA_DEFS_SCENES`, joints par BASENAME) : les discriminants des scènes sont fermés comme les autres. La fermeture reste bornée à ce que l’introspection atteint — un littéral sous une enveloppe qu’`enfantsDe` ne traverse pas y échappe.',
  'Une clé de RÉFÉRENCE SCOPÉE (`CLES_REFERENCE_SCOPEE`) n’ouvre jamais de référence vers l’index des ids : sa valeur nomme une identité d’un espace CLOS tenu par un document, que le scan n’indexe pas. Unique entrée : `entry` (lieu de carte, embuscade de route, effet `transition`), dont la cible est une CLÉ de `scenes[].entryPoints` — le scan n’indexant que des VALEURS porteuses d’identité, toute résolution de `entry` contre l’index serait une HOMONYMIE par construction (mesuré 2026-09-06 : `arene-projet.json › entry: "route"` classé référence vers `terrains.json`).',
  'Les clés de PROSE `label`/`nom`/`desc`/`title` n’ouvrent jamais de référence ; `text` sous un champ de dotation est l’exception unique (résolution NARRATIVE #624). Le porteur ADRESSÉ de la prose (`descRef`, #1389) suit la même règle, `descRef>book` compris : `book` désigne un LIVRE, pas un document indexé — une adresse de prose n’ouvre aucune référence.',
  'La strate `Instance` du design v2 (SkillInstance, ItemInstance, saves) est DÉCLARÉE HORS PÉRIMÈTRE, pas absente : elle existe en SNAPSHOTS nommés dans la racine `src/scenes` — `barge-du-sel-projet.json` et `loup-et-saumure-projet.json` sous `scenes[].entities[].postes[].ammo[]` (des `ItemInstance` recopiées par `src/engine/items.ts`). Ces chemins ne sont pas mesurés ; `saves` a en outre sa propre politique de version (`src/state/saves.ts`).',
  'Les ABSENCES d’enveloppe ne se comptent que sur les ENTRÉES DE RACINE (`id` et `source` partout, `label` sur les familles `entité`/`table`) : un document EMBARQUÉ n’est jamais sommé de porter un `id`.',
  'Le RÉGIME D’ENTRÉES vient de la famille DÉCLARÉE par le schéma zod (`liste` → les éléments, `record` → les valeurs, `config` → le document EST son entrée) ; un document qu’aucune def ne déclare serait classé par sa racine JSON — depuis #1466 L1a il n’y en a plus aucun, les projets livrés de `src/scenes` sont déclarés `config`. La FAMILLE mesurée (`entité`/`table`/`config`/`record`) se déduit du régime : `record` et `config` RECOPIENT la déclaration (régime `valeurs` / `racine`), seule la partition `entité` ⊕ `table` est observée (part des entrées à bornes numériques). Depuis #1467 L1b V-FLIP-RECORD, le régime `valeurs` descend dans `entries` quand le record porte son enveloppe.',
  'Une valeur mesurée hors de sa forme propre est enregistrée sous sa PROJECTION sur le vocabulaire du concept, suffixée `+…` ; de même pour une référence (clés de graphie + clés qui résolvent, charge utile repliée).',
  'La candidature `plage` est STRUCTURELLE et non plus positionnelle : tout objet portant `min` ET `max` NUMÉRIQUES est candidat, élément d’un TABLEAU comme porté par un CHAMP (#1659, 2026-09-01 — les 5 `{min,max}` hors tableau des 2 racines entrent dans la mesure : `sea-events › params.impressed`, `› params.wrathful`, `tavernGames › pot.targetRange`, `› volley.libre`, `water-exposure › modifiers[].auto`). Ce qui reste hors candidature est le TYPE : une borne non numérique (`null` d’une bande ouverte comprise) n’ouvre pas la plage. `bornes` reste borné au tableau — aucun `{min,max}` hors tableau ne porte `default`/`step`.',
  'Une paire de bornes encodée en TUPLE `[min,max]` n’est mesurée par AUCUN concept : la mesure ne classe que des OBJETS, un tableau de deux nombres reste une valeur nue. 36 tuples à l’arbre sur 10 sites (2 racines, 2026-09-06 après l’entrée du dataset des terrains #1690 ; 7 sites au 2026-09-05 après la fusion des matières #1686 lot 2, 8 sites au 2026-09-01 après #1659 L-1659-3, 99 sur 18 à l’ouverture de la vague), et AUCUN n’est une plage — tous sont exclus nommément : 34 paramètres de recette de rendu (`detail.courses.blockWM` 15, `detail.speckle.rM` 17, `detail.tufts.hM` 2, sous `structureAppearance.json`/`materials.json`/`terrains.json`), `qualities.json › [].capabilities.fumbleDigits` (un ENSEMBLE de chiffres) et `structureAppearance.json › [].door.herse.traverseFracs` (des positions fractionnaires). SORTIES du stock parce que devenues des fourchettes `{min,max}` mesurées par le concept `plage` : les 72 disponibilités saisonnières (`sea-cargo.json › cargoes[].avail` 44, `land-cargo.json › cargoes[].avail` 28, L-1659-2), les 7 `ship-construction.json › standard[].lengthM` et les 4 `stars.json › [].sub` (L-1659-3). L’inventaire de ces 36 vit dans `src/data/plage-bornes-contrat.test.ts` (volet F) : il n’a plus à décroître, il a à ne pas repousser.',
  'Un concept exprimé en SCALAIRE hors liste (`species: "humain"`) est mesuré sous la forme `id-nu`, sans signature d’objet.',
  '`kind` est polysémique et n’est pas dédoublonné (Condition, Flow, événement de mer, pion de scène).',
  'Le classement est ORDONNÉ : une VALEUR (reconnue à son noyau) passe avant une RÉFÉRENCE ; un objet qui recoupe deux concepts n’est compté qu’une fois.',
  'Deux comparateurs de `water-exposure.json` (`<=`/`>=` sous `woundsRemaining`/`woundsLost`) échappent à `conditionSchema` et restent comptés en op.',
  'Le scan AST est borné aux littéraux `z.object`/`z.strictObject`/`z.looseObject` des `src/data/schemas/defs/*.ts` : il ne voit ni les clés ajoutées par `.extend(...)`, ni un schéma composé par une fabrique, ni les defs hors de ce dossier. Le « schéma commun candidat » est apparié par SIGNATURE EXACTE.',
  '`schemasCommuns` ne garde qu’UN nom par SIGNATURE (le premier vu, racines avant niches) : deux nœuds de grammaire de même signature se masquent l’un l’autre, et l’arrivée du second RENOMME le « commun » recommandé d’une ligne de redéclaration sans qu’aucun porteur n’ait bougé — mesuré 2026-09-01, `miscast.ts | dice` est passé de `formulaSchema` à `prixTireSchema` (#1463 L-gram-3) à donnée, def et signature INCHANGÉS.',
  'Les portes MOTEUR (`src/engine`, `src/state`) et les JSON hors documents (outillage, `public/qc/*`, baselines de gardes) ne sont pas mesurés : ce contrat parle de la DONNÉE authorée et de ses schémas.',
  'Le concept `test` CÈDE tout objet qui DÉSIGNE une entité (clause `horsDesignation` : clé de `CLES_IDENTITE`, ou clé en `RX_CLE_REFERENCE`) et passe APRÈS `plage` : 12 objets porteurs de `difficulty` restent classés `test` sans en être un — `tavernGames.json › volley.rows` 7 (rangées sans bornes authorées), `sea-events.json › params` 3 (le sujet du jet y vit sous `testType`) et `etats.json › difficultyBy` 2. Ce qui leur manque n’est pas TOUT discriminant structurel (`difficultyBy` porte `{cond, difficulty}`, et `cond` en est un) : c’est une clé de DÉSIGNATION, la seule que ce concept cède.',
  'Le scan AST des redéclarations ne lit QUE `src/data/schemas/defs/` : les 148 littéraux zod de `src/data/schemas/defs-scenes/` (`effets.ts` 71, `scene.ts` 53, `worldmap.ts` 15, `narratif.ts` 7, `communs.ts` 2) en sont HORS PÉRIMÈTRE — un seul d’entre eux serait classé par le lexique s’il y entrait (`scene.ts:438` `wallClimbSchema`, concept `test` par le noyau `difficulty`). L’autre cas mesuré du concept `test`, `extendedTestSchema`, vit en grammaire (`src/data/schemas/grammaire/mecanique.ts`), hors périmètre elle aussi (#1657).',
  'Le lexique FERMÉ est le PLAFOND de détection des redéclarations : un littéral dont le concept n’est pas au lexique n’est compté que s’il a un schéma commun de MÊME signature exacte — deux defs divergents sur un champ d’un concept absent restent invisibles aux occurrences, et seul le compte GLOBAL des littéraux (`totalLitteraux`, 482 après ce lot, 487 à `9739ee1f4`) bouge.',
];

/**
 * MANDAT du volet SLOTS — SOURCE UNIQUE de la phrase, jamais recopiée : le doc l'ÉMET (§6), la garde
 * `src/data/slots-contrat.test.ts` l'assère, les autres sites y RENVOIENT.
 */
export const MANDAT_SLOTS =
  'Ce volet est le REMPLAÇANT committé du « test FK générique » re-scopé au commentaire #1466 du 2026-08-23 : « le registre des SLOTS pour `docs/structures-donnees.md` (déclaré × observé) ».';

/**
 * ANGLES MORTS du volet SLOTS — SOURCE UNIQUE, même patron que `ANGLES_MORTS` : le doc les émet, la
 * garde les référence, les autres sites y RENVOIENT.
 */
export const ANGLES_MORTS_SLOTS: readonly string[] = [
  'Une occurrence dont AUCUNE case ne porte de chaîne n’est jamais ATTEINTE, quel que soit le schéma : aucune n’est un slot, et son couple reste au stock `SLOTS_SANS_DECLARATION`. Mesuré le 2026-09-23 : 14 `{choice:[…]}` de `careerLevels.json | trappings` (les feuilles comptent sous `careerLevels.json | choice`), 19 `{random:N}` de `species.json | talents`, 2 `{random:N}` de `species.json | of`, et 1 occurrence de `creatures.json | spec` dont la seule case est une clé de `CLES_DE_SPECIALISATION`. Stock nominatif `SLOTS_INATTEIGNABLES`, qui ne fait que décroître.',
  'Une référence portée par une CLÉ de record (`z.record(idDe(…), …)`) est un slot `{}` du §6.1, jamais une case du scan, qui n’observe que des valeurs : mesuré le 2026-09-23, 6 slots `ship-criticals.json › tablesDeChute[].bandes[].hauteurs{}` (`shipStation`), sans couple touché.',
];

/**
 * TERMES de la COLLECTION À CLÉ (#1463) — SOURCE UNIQUE : le doc les émet (§1ter), le code y renvoie.
 */
export const TERMES_COLLECTION_A_CLE: readonly (readonly [terme: string, definition: string])[] = [
  [
    'collection à clé',
    'collection dont chaque élément a une IDENTITÉ déclarée au nœud du schéma qui la porte (`marquerCollection`, `src/data/schemas/grammaire/collection-cle.ts`) : une LISTE, dont la clé se lit dans chaque élément (`listeCle`), ou un RECORD, dont les ids sont les noms de propriété.',
  ],
  [
    'espace de noms',
    'les ids d’une collection à clé dont la marque porte `espace`, éventuellement filtrée : la racine d’un document `entite`/`record` (`document()`), les `specs` d’une Compétence ou d’un Talent, `sizes.json#rangedMod`. Les paramètres `discriminant` et `marqueurs` de `espace` (`EspaceDeNoms`) y ajoutent les espaces FILTRÉS. Une collection dont la clé d’élément est une feuille `idDe` (une liste de RÉFÉRENCES) n’en ouvre jamais.',
  ],
  [
    'clé de collection',
    'le nom d’une collection à clé : `fichier` pour une racine, `fichier#<suite nichée>` pour une collection nichée (`cleNichee`, `src/data/schemas/grammaire/cle-d-espace.ts` ; `criticals.json#[criticals-ldb-tete].entries`, `skills.json#[art].specs`), relevée par la co-descente (`collectionsDuDocument`, `src/data/schemas/grammaire/collection-cle.ts`).',
  ],
  [
    'co-descente',
    'la descente ENSEMBLE d’une donnée et de son schéma (`coDescendre`, `src/data/schemas/grammaire/descente.ts`) : chaque point de la donnée reçoit ses nœuds de schéma `ouverts` — enveloppes, côtés d’intersection, branches d’union (d’une union discriminée, celles qu’admet le discriminant de la donnée, toutes sans valeur lisible) — et un pas de donnée passe par `pasDeDonnee`. Elle ne valide pas : un arbre invalide garde ses collections. Seule lecture des collections à clé d’un document (`collectionsDuDocument`, `collectionALaCle`) et du lieu d’une faute (`lieuDe`, `src/data/schemas/validate.ts`). Faux ami : l’option `descendre` de `scripts/guards/lib/lister.mjs`.',
  ],
  [
    'suite nichée',
    'le chemin d’une collection à clé depuis la racine de son document, ce qui suit `#` dans sa clé de collection (`[art].specs`, `rangedMod`, `[criticals-ldb-tete].entries`) : premier pas sans point, `.champ` ensuite, `[clé]` pour un élément d’une liste marquée lu par sa marque, `[]` pour un élément d’une liste non marquée ; la suite vide désigne la racine. Seul écrivain : `suiteAvecPas` (`src/data/schemas/grammaire/cle-d-espace.ts`). La décision d’une visite de descente, elle, est une `DecisionDeVisite`.',
  ],
  [
    'clé d’espace',
    'le nom d’un espace de noms (`src/data/schemas/grammaire/cle-d-espace.ts`) : la clé de collection d’une collection à clé dont la marque porte `espace` (`skills.json`, `skills.json#[art].specs`), suffixée d’un FILTRE — `?champ=valeur` pour le paramètre `discriminant` (`materials.json?domain=prop`), `?champ` pour un des `marqueurs` (`props.json?volume`). Un pas `[clé]`, une valeur ou un marqueur ne porte jamais `[`, `]`, `#`, `?` ni `=` (`src/data/schemas/espaces-contrat.test.ts`).',
  ],
  [
    '`IDS_PAR_ESPACE`',
    'l’INDEX DES IDS généré (`src/data/schemas/_ids.generated.ts`, `scripts/gen-espaces.mts`, phase 2 de `npm run gen`) : clé d’espace → ids, dans l’ORDRE DE LA DONNÉE, par `idsDeLEspace` (`src/data/schemas/grammaire/collection-cle.ts`) sur le JSON disque co-descendu, sans parse — un espace neuf et son premier désignateur entrent dans le même commit. Une entrée à `specsSource` y a pour espace de ses `specs` l’univers de sa source (`grammaire/sourcesDeSpecs.ts`).',
  ],
  [
    'racine vivante',
    'la racine d’un document de `src/data` qui porte une clé de dataset, en mémoire : le module JSON singleton que le seam mute EN PLACE ; `RACINES_VIVANTES` (`src/data/schemas/_racines-vivantes.generated.ts`, phase 2 de `npm run gen`) la donne par fichier, un import statique par document de l’image de `DATASET_FICHIER_DERIVE`. Ce que le save sérialise, et ce que le régime vivant navigue le long d’une clé d’espace.',
  ],
  [
    'régime vivant',
    'le second régime de lecture des ids (`src/data/schemas/grammaire/idsVivants.ts`) : les ids d’un espace calculés sur les racines vivantes par le calcul de la phase 2 (`idsDeLEspace`), posé par la couche donnée (`src/data/overrides.ts`) et daté par la version des clés de dataset du fichier (`memoParVersion`) — une entité créée ou renommée à l’atelier est référençable avant tout `npm run gen`. Sans régime posé (scripts, gardes), ou pour un espace d’un fichier hors des racines vivantes, l’INDEX DES IDS généré fait foi.',
  ],
  [
    'clé de dataset',
    'le nom d’une collection que le seam de `src/data/overrides.ts` mute EN PLACE : `CLES_DE_DATASET` / `CleDeDataset` (`src/data/schemas/_cles-de-dataset.generated.ts`, phase 2 de `npm run gen`), le domaine de `DATASET_FICHIER_DERIVE` (`src/data/schemas/exposition-derivee.ts`). `collectionDuDataset` l’atteint sur la racine vivante de son fichier : liste de racine (route `dataset`, `none` + `dataset`), collection au bout de la suite de `niche.categories`, ou la racine elle-même (route `object`).',
  ],
  [
    '`espaceDe`',
    'la clé d’espace qui fait autorité sur les ids d’un type d’entité (`TYPES[type].espace`, `src/data/schemas/grammaire/ref.ts`).',
  ],
];

/**
 * DÉCLARÉ-AVANT-POSÉ ASSUMÉ (`cible-declaree`) — une famille de formes que le schéma déclare et que
 * la donnée ne porte pas ENCORE, avec le LOT qui la peuplera. Ce n'est PAS un stock : un stock ne
 * fait que décroître, une cible déclarée se solde en PEUPLANT la donnée (elle quitte alors la mesure
 * d'elle-même). Le doc l'ÉMET (§2.4 table B) ; le contenu de la table est MESURÉ, seuls la date et
 * le lot de peuplement se déclarent ici.
 */
export type LotDePeuplement = { readonly lot: string; readonly date: string };
export const LOTS_DE_PEUPLEMENT: Readonly<Record<string, LotDePeuplement>> = {
  // Les 57 variantes d'`Effect` sont passées en zod au commit ee98da334 (#1466 L1a T3-b) ; celles
  // qu'aucune scène ne pose encore sont écrites du DÉCLARÉ seul, en attente d'adoption.
  'variante d’`Effect`': { lot: 'adoption scènes (L1b #1467 et suivants)', date: '2026-08-24' },
};

export type Concept = {
  id: string;
  label: string;
  strate: Strate;
  signatures: readonly SignatureLexique[];
  /**
   * Le concept est ANCRÉ SUR L'INDEX DES IDS : ses instances sont les objets dont au moins une
   * valeur résout vers un document indexé. Porte aussi la colonne « résolvables » du doc — un
   * ATTRIBUT DÉCLARÉ sur l'entrée, jamais un test d'identité au call-site (#842).
   */
  resolvables?: boolean;
  /** Concept exprimé en TABLEAU de chaînes (liste d'ids nus) : pas de signature d'objet. */
  listeIdsNus?: boolean;
  /** Le concept est nommé par la CLÉ qui le porte — déclaré, jamais mesuré à un seuil. */
  champs?: readonly string[];
  /** Clés dont la présence (au moins `noyauMin`) classe un objet dans le concept. */
  noyau?: readonly string[];
  noyauMin?: number;
  /**
   * Clés dont la CO-PRÉSENCE (au moins une) est EXIGÉE en plus du noyau. Discrimine deux concepts
   * qui partagent le même noyau : le plus contraint se déclare AVANT, et l'objet qui ne porte
   * aucune de ces clés retombe sur le suivant. Attribut DÉCLARÉ sur l'entrée du registre (#842),
   * jamais un test d'identité au call-site.
   */
  coPresence?: readonly string[];
  /** Le concept n'est candidat que si le SITE d'appel l'a mesuré (cf. `contexte.candidats`). */
  exigeCandidatureStructurelle?: boolean;
  /**
   * La candidature structurelle est mesurée AUSSI hors élément de tableau : un objet porté par un
   * CHAMP est candidat au même titre qu'un élément de tableau, dès qu'il porte tout le noyau au bon
   * type. Attribut DÉCLARÉ sur l'entrée du registre (#842), jamais un test d'identité au call-site —
   * `structures-scan.mts` le lit, il ne nomme aucun concept.
   */
  candidatureHorsTableau?: boolean;
  /**
   * Le concept CÈDE tout objet qui DÉSIGNE une entité — clé d'IDENTITÉ (`CLES_IDENTITE`) ou clé
   * dont le NOM annonce une référence (`RX_CLE_REFERENCE`). Symétrique de `coPresence` : là une clé
   * est EXIGÉE, ici une clé DISQUALIFIE. Attribut DÉCLARÉ sur l'entrée du registre (#842), jamais un
   * test d'identité au call-site.
   */
  horsDesignation?: boolean;
  /**
   * Graphies ENVELOPPANTES dont CE concept mesure la réconciliation nue/enveloppée dans le doc
   * (#842 : le comportement se déclare sur l'entrée du registre, jamais à un test d'identité au
   * call-site) — seul le concept qui POSSÈDE des graphies enveloppantes porte ce champ.
   */
  graphiesEnveloppantes?: readonly string[];
};

/**
 * Graphies ENVELOPPANTES : une clé de graphie sous laquelle pend un OBJET (ou un tableau d'objets)
 * plutôt qu'un id nu. L'intérieur porte le CHEMIN de graphie dans sa signature (`ref>id`,
 * `wildcard>id`, `choice>id`) et HÉRITE du statut de l'enveloppe : `{ref:{id}}` se lit
 * `ref>id / historique`, jamais `id / cible` (#1463, commentaire « Arbitrages de design L0
 * (2026-08-23, orchestrateur — suite à la contre-passe du commit 3a6017ebb) », point 4).
 */
export const GRAPHIES_ENVELOPPANTES = ['ref', 'wildcard', 'choice', 'random'] as const;

/** Concepts, du plus discriminant au plus général (le premier qui matche gagne). */
export const CONCEPTS: readonly Concept[] = [
  {
    id: 'reference',
    label: 'référence à une entité',
    strate: 'Référence',
    resolvables: true,
    graphiesEnveloppantes: GRAPHIES_ENVELOPPANTES,
    signatures: [
      { sig: 'id', statut: 'cible' },
      { sig: 'id,spec', statut: 'cible' },
      { sig: 'choix,id', statut: 'cible', note: 'choix borné / libre (DESIGN v2 S2)' },
      { sig: 'id,type', statut: 'cible', note: 'référence de dotation polymorphe' },
      { sig: 'count,id,type', statut: 'cible' },
      { sig: 'of,pick', statut: 'cible', note: 'tirage parmi un ensemble borné' },
      { sig: 'pick,table', statut: 'cible', note: 'tirage sur une table nommée' },
      // Les trois lignes SITE-QUALIFIÉES ci-dessous passent AVANT leurs homonymes sans site : au
      // statbloc, la valeur IMPRIMÉE est un champ de la référence — `#1463` (« Faits tranchés au
      // Source ») : « `value` = le seul nom du NOMBRE IMPRIMÉ au statbloc », et sa clause de
      // composition « `value` requis sur un statbloc ». `advances` est le nom du RANG ACHETÉ en PX
      // (Augmentation, `LDB 07`, `docs/raw/4e/avancement.md:27`), qui vit sur l'INSTANCE, pas ici.
      // RÉSERVE OUVERTE, dite et non tranchée (commit de préservation `772a217cc`, verbatim
      // utilisateur) : « la forme {id, spec|choix, value} n'est PAS le schéma final — #1463 tranche un
      // noyau générique de référence + compositions fermées ; `value`/`times`/avances = un seul rang
      // acheté en PX, à nommer au RAW ». Ce qui est CIBLE ici est la COMPOSITION (charge utile portée
      // par la référence) ; le NOM du champ reste un point ouvert de L5.
      { sig: 'id,value', statut: 'cible', site: SITE_STATBLOC, note: 'réf de Compétence de STATBLOC + son nombre imprimé (`refOuSpec(\'skill\', {value})`)' },
      { sig: 'id,spec,value', statut: 'cible', site: SITE_STATBLOC, note: 'idem, spécialisation DÉSIGNÉE' },
      { sig: 'choix,id,value', statut: 'cible', site: SITE_STATBLOC, note: 'idem, spécialisation À CHOISIR (libre ou bornée) — désignée au spawn' },
      { sig: 'id,value', statut: 'historique', note: 'charge utile `value` à plat sur une référence dont le porteur n’est PAS un statbloc (Indice d’Atout, paramètre d’entité) — #1463 S2' },
      { sig: 'id,spec,value', statut: 'historique', note: '#1463 « Cible précisée » l’énumère parmi les 5 graphies historiques, son 1er paragraphe la dit champ optionnel de la MÊME structure — L0 retient l’énumération hors statbloc (une ligne de stock se retire, elle ne se devine pas)' },
      { sig: 'arg,id', statut: 'historique', note: 'paramètre d’entité non déclaré (#1463 S2 A11)' },
      { sig: 'arg,id,value', statut: 'historique' },
      { sig: 'count,id', statut: 'historique' },
      { sig: 'count,text', statut: 'historique' },
      { sig: 'id,times', statut: 'historique' },
      { sig: 'id,qualityChoice', statut: 'historique' },
      { sig: 'ref', statut: 'historique', note: 'ref emboîtée {ref:{id,spec}} ou id nu sous `ref`' },
      { sig: 'wildcard', statut: 'historique' },
      { sig: 'specOptions,wildcard', statut: 'historique' },
      { sig: 'skillId', statut: 'historique' },
      { sig: 'skillId,spec', statut: 'historique' },
      { sig: 'skill,spec', statut: 'historique' },
      { sig: 'talentId', statut: 'historique' },
      { sig: 'trappingId', statut: 'historique' },
      { sig: 'creatureId', statut: 'historique' },
      { sig: 'vehicleId', statut: 'historique' },
      { sig: 'career', statut: 'historique' },
      { sig: 'choice', statut: 'historique' },
      { sig: 'random', statut: 'historique' },
      { sig: 'text', statut: 'declaree', note: 'dotation narrative — occurrence de référence seulement quand le texte normalisé résout vers un `label` (#1463, #624)' },
      { sig: 'id-nu', statut: 'historique', note: 'référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence' },
    ],
  },
  {
    id: 'refs',
    label: 'liste de références (ids nus)',
    strate: 'Référence',
    listeIdsNus: true,
    signatures: [
      {
        sig: 'ids-nus',
        statut: 'cible',
        note: 'tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée.',
      },
    ],
  },
  {
    id: 'monnaie',
    label: 'somme d’argent',
    strate: 'Valeur',
    signatures: [
      { sig: 'brass,gold,silver', statut: 'cible' },
      // Les 6 sous-signatures NON VIDES d'un montant PARTIEL : `moneyPartialSchema`
      // (`src/data/schemas/grammaire/valeurs.ts:300`) déclare les 3 dénominations OPTIONNELLES, et
      // `toMoney` (`src/engine/money.ts:45`) complète à 0 celles qui manquent — un coût authoré
      // n'écrit que ce qu'il chiffre. Ce sont des formes CIBLES, pas des graphies à éteindre.
      { sig: 'brass', statut: 'cible' },
      { sig: 'gold', statut: 'cible' },
      { sig: 'silver', statut: 'cible' },
      { sig: 'brass,gold', statut: 'cible' },
      { sig: 'brass,silver', statut: 'cible' },
      { sig: 'gold,silver', statut: 'cible' },
    ],
    noyau: ['gold', 'silver'],
    noyauMin: 1,
  },
  {
    id: 'prix',
    label: 'prix (Money | saisonnier | dé | ND)',
    strate: 'Valeur',
    champs: ['price'],
    signatures: [
      { sig: 'automne,ete,hiver,printemps', statut: 'declaree', note: 'coefficient SAISONNIER — `Price = Money | {saison} | {dice} | "ND"` (DESIGN v2 S4) : ce n’est pas une bourse à éteindre' },
      { sig: 'dice', statut: 'declaree', note: 'prix TIRÉ (DESIGN v2 S4)' },
    ],
  },
  {
    id: 'de',
    label: 'lancer de dés',
    strate: 'Valeur',
    signatures: [
      { sig: 'n,sides', statut: 'cible' },
      { sig: 'n,plus,sides', statut: 'cible' },
    ],
    noyau: ['n', 'sides'],
  },
  // Les deux formes de l'ADRESSE de prose (#1389) passent AVANT `formule` et `source`, et l'ordre
  // décide : un fragment porte `sum` (l'empreinte du passage résolu, `sumOf` de
  // `src/data/source/decoupe.ts`) que le concept `formule` réclamerait, et l'adresse porte `book`
  // que le concept `source` réclamerait. Ni l'une ni l'autre n'est une divergence : c'est la forme
  // que le parseur PRODUIT et que `descRefSchema` (`grammaire/valeurs.ts`) refuse autrement.
  // Les deux noyaux sont EXHAUSTIFS (aucun `noyauMin`), donc rien d'autre ne s'y range : `book`,
  // `ch` et `parts` ne coexistent que sur une adresse, et `secOcc` ne vit que sur un fragment.
  {
    id: 'adresse',
    label: 'adresse d’un passage du Source (`descRef`)',
    strate: 'Valeur',
    signatures: [
      { sig: 'book,ch,parts', statut: 'cible', note: 'livre + chapitre + fragments — `descRefSchema`, épique #1388 §2.2' },
    ],
    noyau: ['book', 'ch', 'parts'],
  },
  {
    id: 'fragment',
    label: 'fragment d’une adresse de prose (suite de blocs, ou cellule de table)',
    strate: 'Valeur',
    signatures: [
      // Le discriminant `kind` reste HORS du vocabulaire du concept (c'est lui, le `+…`) : `CLES_DE_VALEUR`
      // en dérive, et l'y verser retirerait `kind` de la charge utile des TELLS de document — 44 pions de
      // scène `{id, kind, label, pos, ref}` changeraient de tell (mesure de la sonde C, #1633).
      { sig: 'b0,b1,sec,secOcc,sum+…', statut: 'cible', note: 'suite contiguë `b0..b1` des blocs d’une section (`FragmentBlocs`)' },
      { sig: 'col,row,sec,secOcc,sum+…', statut: 'cible', note: 'case d’une table adressée par CLÉ de ligne × en-tête de colonne (`FragmentCellule`)' },
    ],
    noyau: ['sec', 'secOcc', 'sum'],
  },
  // Le noyau est BORNÉ à `sum`/`sinPoints` — les deux clés qui, MESURÉES sur les 2 racines, ne
  // nomment QUE la composition d'une `Formula`. `dice` et `times` en sont EXCLUS : `dice` est aussi
  // la clé d'un `DiseaseTime` (`{dice, unit}`, 37 occurrences de `maladies.json`), d'un pot de jeu de
  // taverne et d'un `overcastPerSpell` ; `times` est le COMPTE d'une réf de Talent de créature
  // (48 occurrences). Les inclure ferait changer de propriétaire 7 formes étrangères (mesuré) — un
  // concept se reconnaît à ce qui le nomme SEUL. Les objets `{dice}`/`{times}` d'une formule restent
  // donc hors strate, comme avant ce lot.
  {
    id: 'formule',
    label: 'formule de quantité (Formula, engine/ops.ts)',
    strate: 'Valeur',
    signatures: [
      { sig: 'sum', statut: 'cible' },
      { sig: 'sinPoints', statut: 'cible', note: 'terme « (Points de Péché) » — LDB 40 l.58/62/63/65/68/71/72/73/75/77' },
      { sig: 'minimum,of', statut: 'cible', note: 'borne basse d’un terme — « (minimum de 1) », AA 07 l.113 / LDB 18 l.88' },
    ],
    noyau: ['sum', 'sinPoints', 'minimum'],
    noyauMin: 1,
  },
  {
    id: 'source',
    label: 'référence de source (livre/folio)',
    strate: 'Valeur',
    signatures: [
      { sig: 'book,page', statut: 'cible' },
      { sig: 'book,note,page', statut: 'cible', note: 'note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`)' },
      { sig: 'book,page,quote', statut: 'cible', site: SITE_EMPLACEMENT_SECONDAIRE, note: 'emplacement secondaire + sa preuve verbatim (`secondarySourceRefSchema`)' },
      { sig: 'book,note,page,quote', statut: 'cible', site: SITE_EMPLACEMENT_SECONDAIRE, note: 'idem, avec la précision `note`' },
      { sig: 'book,chapter', statut: 'historique', note: 'folio obligatoire (#1463, 2026-08-23)' },
      { sig: 'book,chapter,page', statut: 'historique' },
    ],
    noyau: ['book'],
  },
  {
    // AVANT `plage`, et l'ordre décide : même noyau `min,max`, mais ce ne sont pas des bornes de
    // TIRAGE — ce sont les bornes du DOMAINE d'un réglage (`kind: 'param'`, avec sa valeur par
    // défaut et son pas), lues par l'éditeur de règles optionnelles (`CodexEdit`, `StructFields`
    // `RuleShape`). Aucun d100 ne les traverse : `findTableEntry` n'a rien à y faire.
    // Non-recouvrement MESURÉ sur `src/data/*.json` (2026-08-31) : 23 objets portent `min,max` avec
    // `default`/`step` — tous dans `reglesOptionnelles.json` —, 1413 portent `min,max` sans ; l'
    // intersection est VIDE. `kind` seul ne discrimine pas (88 objets, `oups.json` et
    // `sea-events.json` le portent aussi) : la co-présence retenue est `default`/`step`.
    id: 'bornes',
    label: 'bornes du domaine d’un réglage (min,max)',
    strate: 'Valeur',
    // `max,min` NU n'est pas déclaré : la co-présence EXIGE `default`/`step`, donc un objet `bornes`
    // porte toujours au moins une clé de plus que son noyau — sa projection est toujours `+…`.
    signatures: [
      { sig: 'max,min+…', statut: 'cible', note: 'les bornes d’un réglage vivent SUR le réglage : la charge utile (`default`, `step`, `hint`…) est inhérente' },
    ],
    noyau: ['min', 'max'],
    coPresence: ['default', 'step'],
    exigeCandidatureStructurelle: true,
  },
  {
    id: 'plage',
    label: 'plage de tirage (min,max)',
    strate: 'Valeur',
    signatures: [
      { sig: 'max,min', statut: 'cible' },
      {
        sig: 'max,min+…',
        statut: 'cible',
        note: 'FOURCHETTE d’une rangée de table : la charge utile est INHÉRENTE — cible = fourchette PLATE {min,max} + findTableEntry (src/engine/tables.ts). #1463 S1 amendé 2026-08-31, motif au pilotage.',
      },
    ],
    noyau: ['min', 'max'],
    exigeCandidatureStructurelle: true,
    // Une fourchette portée par un CHAMP est la MÊME fourchette que celle d'un élément de tableau : le
    // porteur ne change pas la forme (#1659, 2026-09-01). Non-recouvrement MESURÉ sur les 2 racines :
    // 5 objets portent `min,max` numériques hors tableau (`sea-events › params.impressed` et
    // `› params.wrathful`, `tavernGames › pot.targetRange` et `› volley.libre`,
    // `water-exposure › modifiers[].auto`) et AUCUN d'eux ne porte `default`/`step` — la co-présence de
    // `bornes`, qui reste bornée au tableau, ne perd donc rien à cet élargissement.
    candidatureHorsTableau: true,
  },
  {
    id: 'quantite',
    label: 'quantité (CountSpec : fixe ou tirée)',
    strate: 'Valeur',
    signatures: [
      { sig: 'fixed', statut: 'cible' },
      { sig: 'roll', statut: 'cible' },
    ],
    noyau: ['fixed'],
  },
  // DERNIER concept de la strate, et le RANG décide (patron `bornes` avant `plage`) : `difficulty`
  // est une VALEUR de Difficulté (`difficultySchema`, `src/data/schemas/grammaire/valeurs.ts`) qu'un
  // porteur pose À CÔTÉ d'autre chose aussi souvent qu'un jet la porte. Deux discriminants :
  //   (1) le RANG, après `plage` : une rangée de table à bornes NUMÉRIQUES reste une rangée, même
  //       quand elle porte la Difficulté de sa ligne ;
  //   (2) `horsDesignation` : un objet qui DÉSIGNE une entité (clé de `CLES_IDENTITE`, ou clé en
  //       `RX_CLE_REFERENCE`) EST cette entité ou sa référence — jamais le jet.
  // Non-recouvrement MESURÉ sur les 2 racines (2026-09-01, 302 objets porteurs de `difficulty`) :
  // 15 sont des rangées à bornes numériques (`tavernGames › volley.rows` 7, `sea-navigation › table`
  // 5 et `› voirLaLumiere` 3), 57 portent une clé d'IDENTITÉ (les 51 entrées de racine
  // d'`activities.json`, ses 2 réfs de Compétence sous `skills`, les 4 températures de
  // `sea-weather.json`), 9 une clé de RÉFÉRENCE (`maladies › symptoms` 8, `› dailyTest` 1) ; les
  // trois intersections sont VIDES, et 221 objets ne portent AUCUNE des trois — ce sont les jets.
  // COLLATÉRAL nommé : `maladies › dailyTest` (1, EDOC 08 l.104) est un jet qui porte l'id du
  // symptôme infligé ; la désignation gagne et il est compté RÉFÉRENCE.
  // ANGLE MORT du discriminant, nommé : 12 des 221 ne sont pas le jet mais son PORTEUR, qui étale la
  // Difficulté à côté — `tavernGames › volley.rows` 7 (rangées sans bornes authorées : la candidature
  // `plage` est STRUCTURELLE, angle mort déjà déclaré), `sea-events › params` 3 (le sujet du jet y
  // vit sous `testType`) et `etats › difficultyBy` 2. Ce qui manque à ces 12 n'est pas TOUT
  // discriminant structurel — `etats › difficultyBy` porte `{cond, difficulty}`, et `cond` EN EST un
  // (c'est le sous-schéma `flowTestSchema.difficultyBy`, une table Condition → Difficulté) — c'est une
  // clé de DÉSIGNATION, la seule que ce concept cède. Ils restent divergents au stock, sous le concept
  // qui les fera migrer.
  // Aucun concept ne revendique les 3 jeux à manches de `tavernGames.json` — `boules`
  // (`drCap`, `volley`), `torchon` (`table`, `throwerPenalty`), `pierres` (`target`, `phases`) : ce sont
  // trois RÈGLES, pas une forme. Un noyau qui les réunirait (leurs 10 clés, deux suffisant à classer)
  // ne nommerait aucune structure partagée et n'aurait aucune signature à viser ; ces 3 entrées de
  // racine sont des DOCUMENTS, que le compte nominatif de la synthèse (§1 du doc) porte.
  {
    id: 'test',
    label: 'jet à faire (compétence/caractéristique + difficulté)',
    strate: 'Valeur',
    signatures: [
      { sig: 'difficulty,skill', statut: 'historique' },
      { sig: 'char,difficulty', statut: 'historique' },
      { sig: 'characteristic,difficulty', statut: 'historique' },
    ],
    noyau: ['difficulty'],
    horsDesignation: true,
  },
  // ---------------------------------------------------------------------------------------------
  // Strate DOCUMENT (#1633) — les ENVELOPPES nommées de la grammaire de campagne. La strate existait
  // au type sans qu'aucun concept l'emploie : ces quatre entrées la peuplent, et le socle ne bouge
  // pas d'une ligne pour ça (`CONCEPTS_CLASSABLES` filtre la résolution, pas la strate).
  //
  // Un concept d'enveloppe se reconnaît à son NOYAU de clés REQUISES, JAMAIS au NOM du champ qui le
  // porte. Mesuré : `classerValeur('rule', ['rule'], { champ: 'price' })` rend `prix / divergente`
  // — un concept champ-keyé revendique TOUTE forme posée sous son nom, quelle qu'en soit la forme.
  // Un concept `condition` keyé sur `when` volerait donc `talents.json › when {rule}` au concept
  // `reference` : c'est le débordement global silencieux que le DoD interdit.
  //
  // AUCUN de ces quatre ne porte de `site` : le noyau suffit, et son non-débordement est MESURÉ sur
  // les deux racines (garde `structures-contrat.test.ts`, sonde « noyaux d'enveloppe »). Un scope
  // posé sans nécessité mentirait au 5ᵉ projet.
  {
    id: 'ouverture',
    label: 'ouverture cérémonielle de chapitre',
    strate: 'Document',
    // Porte : `ouvertureSchema` (`src/data/schemas/defs-scenes/narratif.ts`), composée par
    // `formeNarratif` sous la clé OPTIONNELLE `ouverture`.
    signatures: [
      { sig: 'pitch,titre', statut: 'cible' },
      { sig: 'pitch,titre+…', statut: 'cible', note: '`surtitre`, `sousTitre`, `chapitre`, `ambiance` et `source` sont OPTIONNELS au schéma : ce que la projection replie en `+…` est la part facultative de la porte, pas une divergence' },
    ],
    noyau: ['titre', 'pitch'],
  },
  {
    id: 'cloture',
    label: 'clôture de chapitre',
    strate: 'Document',
    // Porte : `clotureSchema` (`src/data/schemas/defs-scenes/narratif.ts`), clé OPTIONNELLE `cloture`.
    signatures: [
      { sig: 'titre,when', statut: 'cible' },
      { sig: 'titre,when+…', statut: 'cible', note: '`sousTitre` est OPTIONNEL au schéma' },
    ],
    noyau: ['titre', 'when'],
  },
  {
    id: 'narratif',
    label: 'bloc narratif d’un projet de campagne',
    strate: 'Document',
    // Porte : `formeNarratif` (`src/data/schemas/defs-scenes/narratif.ts`), dont `narratifSchema`
    // n'est que la variante SÉMANTIQUE (`superRefine`) — la FORME est celle-là.
    signatures: [
      { sig: 'affaires,indices,objets,presetsPnj', statut: 'cible' },
      { sig: 'affaires,indices,objets,presetsPnj+…', statut: 'cible', note: '`ouverture` et `cloture` sont OPTIONNELLES au schéma (#717) : un projet qui pose son cadre de chapitre projette `+…`' },
    ],
    noyau: ['affaires', 'indices', 'objets', 'presetsPnj'],
  },
  {
    id: 'condition',
    label: 'Condition à EXPRESSION (`kind` + `expr`)',
    strate: 'Document',
    // Porte : `conditionSchema` (`src/data/schemas/grammaire/mecanique.ts`), union discriminée sur
    // `kind` ; `expr` n'est requis que par la variante `flag`, seule variante que ce noyau capte.
    //
    // RÉSIDU NOMMÉ, et il est plus large que la variante `flag` : toutes les autres variantes de
    // `Condition` n'ont que le discriminant `kind` en commun (`talents.json › when {kind}` ×4,
    // `{kind,of}`, `{kind,op,value}`, `{is,kind,who}`, `{kind,op,subject,value}`…) et RESTENT hors
    // strate. Un noyau réduit à `kind` capterait tout le dépôt : `kind` est POLYSÉMIQUE (Condition,
    // Flow, événement de mer, pion de scène — angle mort déclaré ci-dessus), et ce qui les
    // distinguerait est la VALEUR du discriminant, que le lexique ne lit pas.
    signatures: [{ sig: 'expr,kind', statut: 'cible' }],
    noyau: ['expr', 'kind'],
  },
];

/** Le concept ANCRÉ sur l'index des ids (attribut déclaré, jamais un test d'identité au call-site). */
export const CONCEPT_REFERENCE = CONCEPTS.find((c) => c.resolvables)!;

/**
 * GRAPHIE d'une référence : toutes les clés que les signatures de référence du lexique nomment.
 * Elle ne sert qu'à PROJETER la signature d'un objet porteur (garder les clés de graphie, replier
 * la charge utile en `+…`) — jamais à décider qu'un objet est une référence : c'est la RÉSOLUTION
 * vers l'index des ids qui le décide. Ajouter un mot ici ne peut donc pas fabriquer une référence.
 */
export const GRAPHIE_REFERENCE: ReadonlySet<string> = new Set(
  CONCEPT_REFERENCE.signatures.flatMap((s) => s.sig.split(',')).filter((k) => !k.includes('-')),
);

/**
 * Clés de SPÉCIALISATION d'une référence (`RefASpecialisation`, `src/data/schemas/grammaire/ref.ts:215`) :
 * membres de `GRAPHIE_REFERENCE` qui QUALIFIENT la référence posée à `id` sans en porter une. Le scan
 * ne les inscrit jamais comme CASE d'une occurrence (`inscrireReference`, #1473) : une valeur qui y
 * résout vers l'index par homonymie ne rend pas l'occurrence inatteignable.
 */
export const CLES_DE_SPECIALISATION: ReadonlySet<string> = new Set(['spec', 'choix']);

/**
 * Clés de PROSE : leur valeur est un texte d'affichage, jamais une référence — même quand le texte
 * égale par homonymie l'id ou le libellé d'une entité. Exception unique : `text` sous un champ de
 * dotation, dont la résolution NARRATIVE est déclarée (#624).
 */
export const CLES_PROSE_SANS_REFERENCE = ['label', 'nom', 'desc', 'title'] as const;

/**
 * RÉFÉRENCES SCOPÉES — clés dont la valeur désigne une identité d'un espace de noms CLOS, tenu par un
 * document, jamais un document de l'INDEX DES IDS. La valeur donne l'espace visé.
 *
 * `entry` (`defs-scenes/worldmap.ts` : `mapPlaceSchema`, `mapRouteSchema › ambush` ;
 * `defs-scenes/effets.ts` : `transitionSchema`) nomme un point d'arrivée de la scène visée par le
 * `scene` qui l'accompagne — et un point d'arrivée est une CLÉ de `scenes[].entryPoints`
 * (`defs-scenes/scene.ts`), un record : le scan n'indexe que des VALEURS porteuses d'identité, si
 * bien qu'aucun nom de point d'arrivée n'entre jamais à l'index (même constat que
 * `scripts/guards/lib/entityConsumers.mjs` : « `entryPoints` … est un RECORD dont les identités sont
 * les CLÉS, que le scan par VALEURS ne collecte jamais »). Toute résolution de `entry` contre l'index
 * est donc une HOMONYMIE PAR CONSTRUCTION — mesurée le 2026-09-06 : `arene-projet.json › entry:
 * "route"` classé référence vers `terrains.json` à l'entrée du dataset des sols (#1690), le seul
 * remède eût été de renommer un point d'arrivée d'auteur pour contenter la MESURE.
 */
export const CLES_REFERENCE_SCOPEE: Readonly<Record<string, string>> = { entry: 'entryPoints' };

/** Clés d'IDENTITÉ d'un document (la cible `id`, ses graphies divergentes). */
export const CLES_IDENTITE = ['id', 'key', 'nom'] as const;

/** Clé dont le NOM annonce une référence : elle DOIT résoudre, sinon c'est une FK morte (L1a). */
export const RX_CLE_REFERENCE = /(Id|Ids|Ref)$/;

/**
 * Clés dont le NOM est réservé à un concept (DESIGN v2 S2 « homonymes ») : si la même clé porte
 * ≥ 2 classes de type dans la donnée, c'est un homonyme nominatif — il entre au stock.
 */
export const CLES_RESERVEES = ['skill', 'char', 'talent', 'price', 'cost', 'count', 'source'] as const;

export type RoleEnveloppe = {
  cible: string | null;
  divergentes: readonly string[];
  typeAttendu?: string;
  /** L'absence de la cible sur une ENTRÉE DE RACINE est elle-même une divergence. */
  requise?: boolean;
  /** Requise sur les seules familles de document citées (`entité`, `table`). */
  requiseSurFamilles?: readonly string[];
  /**
   * Clé qui SATISFAIT le rôle à la place de la cible : le rôle est alors une ALTERNATIVE, et
   * l'absence de la cible n'est une divergence que si cette clé manque aussi. Cale le lexique sur
   * la grammaire (`src/data/schemas/grammaire/document.ts:402-413` : `source` OU `maison`).
   */
  alternative?: string;
  /**
   * La cible se porte sur TOUTES les entrées du groupe, PORTÉE EMBARQUÉE COMPRISE : un groupe qui
   * ne la porte que sur une partie des siennes est une divergence (motif `cible partielle`, détail
   * `portées/entrées`). C'est ce qui rend un rôle mesurable HORS des entrées de racine — `requise`
   * ne regarde que l'absence TOTALE sur une entrée de racine, et un document EMBARQUÉ n'est sommé
   * de rien.
   */
  entiere?: boolean;
};

/**
 * Rôles d'ENVELOPPE d'un document (§2 du doc) : pour chaque rôle, la clé CIBLE (`null` = le rôle
 * n'a pas de forme cible : toute clé qui le porte est une divergence), les clés DIVERGENTES qui le
 * portent sous un autre nom, la classe de type ATTENDUE de la cible, et si l'absence de la cible
 * est elle-même une divergence.
 *
 * Les ABSENCES ne se comptent que sur les ENTRÉES DE RACINE : un document EMBARQUÉ (étape de Flow,
 * rangée de table, modificateur de vent) n'est jamais sommé de porter un `id` ni une `source` — on
 * n'y compte que les clés DIVERGENTES.
 */
export const ROLES_ENVELOPPE: Record<string, RoleEnveloppe> = {
  identité: { cible: 'id', divergentes: ['key', 'nom'], typeAttendu: 'string', requise: true },
  libellé: { cible: 'label', divergentes: ['nom'], typeAttendu: 'string', requiseSurFamilles: ['entité', 'table'] },
  // `title` est un SECOND champ d'affichage, qui COEXISTE avec le libellé (#1467 L1b V-P7) — d'où son
  // rôle propre. Mesuré : `creatures.json` (490 entrées) et `gods.json` (40) portent `label` ET
  // `title`, et les deux sont RENDUS — `title` est le sous-titre de la fiche du Codex (`registry.ts`,
  // specs `gods` et `creatures` : `sub: c.title`), `label` en est le nom. Les confondre en un seul rôle
  // détruirait un des deux affichages à la migration.
  // Pas de `typeAttendu` : `title` admet `null` — 437 des 490 entrées de `creatures.json` le portent
  // ainsi (`z.string().nullable()`), l'absence de sous-titre étant un ÉTAT MODÉLISÉ du dataset. Le
  // devenir de ces 437 nuls et des 53 valeurs réelles se tranche en #1541, pas dans le détecteur.
  'sous-titre': { cible: 'title', divergentes: [] },
  // `effect`, `rules` et `hint` ont été RETIRÉS des divergentes (#1467 L1b V-P2) : le détecteur
  // classait par NOM de clé, pas par TYPE, et ces trois-là ne portent pas de prose.
  //   `crew-morale.json › factors[].effect` = expression de dés lue par `rollExpr`
  //     (`src/data/schemas/defs/crew-morale.ts:22-23`) ;
  //   `sea-events.json › manann.factors[].effect` = objet `{sign, flat, d10}`
  //     (`src/data/schemas/defs/sea-events.ts:19-23`) ;
  //   `hint` = qualificatif d'affichage d'un marqueur de cargaison
  //     (`src/data/schemas/defs/land-cargo.ts:37-38`) et aide de saisie d'une règle optionnelle
  //     (`src/data/schemas/defs/reglesOptionnelles.ts:42`) ;
  //   `speciesRace.json › rules` = tableau de règles (`src/data/schemas/defs/speciesRace.ts:23`).
  // Les `effect` qui ÉTAIENT des issues ou une clé de registre ont, eux, été migrés (`outcome`,
  // `potEffectId`, `ops`) plutôt que retirés de la mesure.
  prose: { cible: 'desc', divergentes: ['text', 'description'] },
  // Le SECOND porteur de la prose (#1389) : l'entrée ADRESSE le passage du livre au lieu de le
  // recopier. Rôle PROPRE et non une divergence de `prose` : les deux clés sont exclusives par
  // construction (verrou V1, `src/data/schemas/grammaire/prose.ts`) et ne portent pas la même chose
  // — l'une le TEXTE, l'autre son ADRESSE. Aucune donnée ne la porte au commit qui la déclare : la
  // ligne naît pour que la première entrée adressée soit MESURÉE, pas découverte.
  'adresse de prose': { cible: 'descRef', divergentes: [], typeAttendu: 'object' },
  // Un document S'ANNONCE : `type` est posé par la fabrique sur tout document (`CLES_ENVELOPPE`,
  // `src/data/schemas/grammaire/document.ts:24`), et les documents EMBARQUÉS qui le portent le
  // portent sur TOUTES leurs entrées (`scene.ts:14-20` l'exige des 28 scènes, `communs.ts:45-46`
  // du statbloc) — d'où `entiere`, qui met les portées embarquées au dénominateur.
  'type de document': { cible: 'type', divergentes: [], typeAttendu: 'string', requise: true, entiere: true },
  source: { cible: 'source', divergentes: [], typeAttendu: 'object', requise: true, alternative: 'maison' },
  maison: { cible: 'maison', divergentes: [], typeAttendu: 'string' },
  'méta libre': { cible: null, divergentes: ['_source', '_comment', '_doc', '__genere', '__lecture', '__livres'] },
};

/** Toutes les clés recensées d'un rôle, cible comprise (l'ordre du doc : cible d'abord). */
export const clesDuRole = (role: RoleEnveloppe): string[] => [...(role.cible ? [role.cible] : []), ...role.divergentes];

/**
 * Vocabulaire propre des concepts de la strate VALEUR : toutes les clés que leurs signatures et
 * noyaux nomment. Le filtre est sur la STRATE, jamais sur `!resolvables && !listeIdsNus` : cette
 * dérivation-là est celle des concepts CLASSABLES (`CONCEPTS_CLASSABLES`, `structures-scan.mts`), et
 * les deux ont divergé quand la strate `Document` s'est peuplée (#1633). Ce qui les sépare est
 * mesuré : `tellsDeDocument` (`structures-scan.mts`) compte les clés de CHARGE UTILE hors de ce
 * vocabulaire — y verser les noyaux d'ENVELOPPE (`affaires`, `objets`, `titre`, `kind`…) change le
 * TELL de 44 objets (mesuré 2026-09-01 sur les deux racines : les PIONS de scène
 * `{id, kind, label, pos, ref}`, dont `kind` cesserait de compter comme charge utile).
 * Garde : `src/data/structures-contrat.test.ts`, sonde C.
 */
export const CLES_DE_VALEUR: ReadonlySet<string> = new Set(
  CONCEPTS.filter((c) => c.strate === 'Valeur').flatMap((c) => [
    ...c.signatures.flatMap((s) => s.sig.split(',')),
    ...(c.noyau ?? []),
  ]),
);
