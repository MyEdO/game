// STOCK NOMINATIF DATÉ des structures de donnée à ÉTEINDRE — le DÉNOMINATEUR du chantier #1463.
// Consommé par `src/data/structures-contrat.test.ts`, mesuré par `scripts/docs/lib/structures-scan.mts`,
// rendu lisible par `docs/structures-donnees.md` (`npm run docs:structures`).
// Patron whitelist-en-lib du dépôt (`tableConsumerStock.mjs`, `paletteLiteralStock.mjs`).
//
// PÉRIMÈTRE MESURÉ — deux racines de documents : `src/data/*.json` et les `*-projet.json` de
// `src/scenes`, TOUTES DEUX au registre zod depuis #1466 L1a (le compte se lit au doc §1). LA RÉFÉRENCE EST ANCRÉE SUR L'INDEX DES IDS, SCOPÉ PAR
// DATASET : une occurrence de référence est une paire (objet, clé) dont la valeur RÉSOUT vers un
// document indexé ; le CHAMP PORTEUR est MESURÉ (la clé du parent), jamais déclaré, et la
// résolution se mesure PAR SITE `(dataset, champ, clé)` — cibles majoritaires, valeurs ambiguës
// comptées à part. Une forme est keyée par (CONCEPT, DATASET, CHAMP, SIGNATURE), la signature étant
// PROJETÉE (clés de graphie + clés qui résolvent, charge utile repliée en `+…`) et PRÉFIXÉE du
// CHEMIN de graphie sous une enveloppe (`ref>id`, `wildcard>id`). Le lexique fermé (graphies,
// concepts de valeur, rôles d'enveloppe, lots connus, angles morts) vit dans
// `scripts/docs/lib/structures-lexique.mts`.
// Le RÉGIME D'ENTRÉES d'un document (donc à qui appartiennent ses « clés de premier niveau ») vient
// de la famille DÉCLARÉE par son schéma zod : `liste` → les éléments du tableau racine ; `record` →
// les valeurs de l'objet racine ; `config` → le document EST son entrée. La FAMILLE de document
// (`entité`/`table`/`config`/`record`) est, elle, mesurée.
//
// ANGLES MORTS — SOURCE UNIQUE `ANGLES_MORTS` (`scripts/docs/lib/structures-lexique.mts`), rendus
// aussi en tête de `docs/structures-donnees.md` ; la garde compare les trois :
//   - La référence est ANCRÉE SUR L’INDEX DES IDS, scopé par DATASET : une occurrence de référence est une paire (objet, clé) dont la valeur RÉSOUT vers un document indexé d’une CIBLE MAJORITAIRE de son site. Le CHAMP PORTEUR (`skills`, `ops`, `members`…) est MESURÉ, jamais déclaré.
//   - La RÉSOLUTION est PAR SITE `(dataset, champ, clé)` : cible(s) MAJORITAIRE(S) = les datasets qui couvrent ≥ 50 % des valeurs résolvantes du site. Une valeur qui ne résout QUE vers une cible non majoritaire est comptée AMBIGUË (§1bis, imprimée avec son site et son dataset parasite) et n’ouvre PAS de référence.
//   - Les COLLISIONS d’ids restent un angle mort du PILOTAGE, pas de la résolution : la colonne « cibles » d’une forme liste tous les datasets atteignables par les valeurs de la ligne.
//   - LOT, MOTIF et DATE d’une forme sont du PILOTAGE : la sonde ne les mesure pas — la forme OBSERVÉE les reprend du stock par son SITE (concept, dataset, champ, signature), si bien que la véracité d’un `motif` est une décision de REVUE qu’aucune garde ne contrôle.
//   - La RÉSOLVABILITÉ d’un `{text}` se mesure sur le LIBELLÉ NORMALISÉ (casse, accents, ponctuation, espaces) d’une entité d’un dataset de la CIBLE MAJORITAIRE de son site — de n’importe quel dataset quand le site n’a pas de cible ; elle ne vérifie AUCUN type d’entité attendu, et un `label` qui est aussi un id peut la faire mordre sur un homonyme : la forme `text (résolvable)` est un candidat à migrer en `{id}`, pas un verdict.
//   - Le partage d’un SITE tranche entre référence cassée et document embarqué, mais les TELLS de document passent avant le ratio (`label` + `source`, ou `label` + ≥ 2 clés de charge utile) et l’égalité tranche pour le DOCUMENT ; un site à UNE seule valeur est un document, sauf si la clé est `…Id`/`…Ids`/`…Ref`.
//   - L’ORDRE DES PASSES est un angle mort déclaré : l’index est complété par les documents EMBARQUÉS (passe 3) AVANT que la résolution ne soit mesurée (passe 4) — un site comme `arene-projet.json › members {entityId}` ne résout que grâce à cet ordre.
//   - Une clé dont la valeur est un LITTÉRAL D’ENUM du schéma zod du document n’ouvre jamais de référence (discriminants `kind`/`type`/`class`/`op`…). Depuis #1466 L1a les DEUX racines sont au registre (`SCHEMA_DEFS` + `SCHEMA_DEFS_SCENES`, joints par BASENAME) : les discriminants des scènes sont fermés comme les autres. La fermeture reste bornée à ce que l’introspection atteint — un littéral sous une enveloppe qu’`enfantsDe` ne traverse pas y échappe.
//   - Une clé de RÉFÉRENCE SCOPÉE (`CLES_REFERENCE_SCOPEE`) n’ouvre jamais de référence vers l’index des ids : sa valeur nomme une identité d’un espace CLOS tenu par un document, que le scan n’indexe pas. Unique entrée : `entry` (lieu de carte, embuscade de route, effet `transition`), dont la cible est une CLÉ de `scenes[].entryPoints` — le scan n’indexant que des VALEURS porteuses d’identité, toute résolution de `entry` contre l’index serait une HOMONYMIE par construction (mesuré 2026-09-06 : `arene-projet.json › entry: "route"` classé référence vers `terrains.json`).
//   - Les clés de PROSE `label`/`nom`/`desc`/`title` n’ouvrent jamais de référence ; `text` sous un champ de dotation est l’exception unique (résolution NARRATIVE #624). Le porteur ADRESSÉ de la prose (`descRef`, #1389) suit la même règle, `descRef>book` compris : `book` désigne un LIVRE, pas un document indexé — une adresse de prose n’ouvre aucune référence.
//   - La strate `Instance` du design v2 (SkillInstance, ItemInstance, saves) est DÉCLARÉE HORS PÉRIMÈTRE, pas absente : elle existe en SNAPSHOTS nommés dans la racine `src/scenes` — `barge-du-sel-projet.json` et `loup-et-saumure-projet.json` sous `scenes[].entities[].postes[].ammo[]` (des `ItemInstance` recopiées par `src/engine/items.ts`). Ces chemins ne sont pas mesurés ; `saves` a en outre sa propre politique de version (`src/state/saves.ts`).
//   - Les ABSENCES d’enveloppe ne se comptent que sur les ENTRÉES DE RACINE (`id` et `source` partout, `label` sur les familles `entité`/`table`) : un document EMBARQUÉ n’est jamais sommé de porter un `id`.
//   - Le RÉGIME D’ENTRÉES vient de la famille DÉCLARÉE par le schéma zod (`liste` → les éléments, `record` → les valeurs, `config` → le document EST son entrée) ; un document qu’aucune def ne déclare serait classé par sa racine JSON — depuis #1466 L1a il n’y en a plus aucun, les quatre projets de `src/scenes` sont déclarés `config`. La FAMILLE mesurée (`entité`/`table`/`config`/`record`) se déduit du régime : `record` et `config` RECOPIENT la déclaration (régime `valeurs` / `racine`), seule la partition `entité` ⊕ `table` est observée (part des entrées à bornes numériques). Depuis #1467 L1b V-FLIP-RECORD, le régime `valeurs` descend dans `entries` quand le record porte son enveloppe.
//   - Une valeur mesurée hors de sa forme propre est enregistrée sous sa PROJECTION sur le vocabulaire du concept, suffixée `+…` ; de même pour une référence (clés de graphie + clés qui résolvent, charge utile repliée).
//   - La candidature `plage` est STRUCTURELLE et non plus positionnelle : tout objet portant `min` ET `max` NUMÉRIQUES est candidat, élément d’un TABLEAU comme porté par un CHAMP (#1659, 2026-09-01 — les 5 `{min,max}` hors tableau des 2 racines entrent dans la mesure : `sea-events › params.impressed`, `› params.wrathful`, `tavernGames › pot.targetRange`, `› volley.libre`, `water-exposure › modifiers[].auto`). Ce qui reste hors candidature est le TYPE : une borne non numérique (`null` d’une bande ouverte comprise) n’ouvre pas la plage. `bornes` reste borné au tableau — aucun `{min,max}` hors tableau ne porte `default`/`step`.
//   - Une paire de bornes encodée en TUPLE `[min,max]` n’est mesurée par AUCUN concept : la mesure ne classe que des OBJETS, un tableau de deux nombres reste une valeur nue. 36 tuples à l’arbre sur 10 sites (2 racines, 2026-09-06 après l’entrée du dataset des terrains #1690 ; 7 sites au 2026-09-05 après la fusion des matières #1686 lot 2, 8 sites au 2026-09-01 après #1659 L-1659-3, 99 sur 18 à l’ouverture de la vague), et AUCUN n’est une plage — tous sont exclus nommément : 34 paramètres de recette de rendu (`detail.courses.blockWM` 15, `detail.speckle.rM` 17, `detail.tufts.hM` 2, sous `structureAppearance.json`/`materials.json`/`terrains.json`), `qualities.json › [].capabilities.fumbleDigits` (un ENSEMBLE de chiffres) et `structureAppearance.json › [].door.herse.traverseFracs` (des positions fractionnaires). SORTIES du stock parce que devenues des fourchettes `{min,max}` mesurées par le concept `plage` : les 72 disponibilités saisonnières (`sea-cargo.json › cargoes[].avail` 44, `land-cargo.json › cargoes[].avail` 28, L-1659-2), les 7 `ship-construction.json › standard[].lengthM` et les 4 `stars.json › [].sub` (L-1659-3). L’inventaire de ces 36 vit dans `src/data/plage-bornes-contrat.test.ts` (volet F) : il n’a plus à décroître, il a à ne pas repousser.
//   - Un concept exprimé en SCALAIRE hors liste (`species: "humain"`) est mesuré sous la forme `id-nu`, sans signature d’objet.
//   - `kind` est polysémique et n’est pas dédoublonné (Condition, Flow, événement de mer, pion de scène).
//   - Le classement est ORDONNÉ : une VALEUR (reconnue à son noyau) passe avant une RÉFÉRENCE ; un objet qui recoupe deux concepts n’est compté qu’une fois.
//   - Deux comparateurs de `water-exposure.json` (`<=`/`>=` sous `woundsRemaining`/`woundsLost`) échappent à `conditionSchema` et restent comptés en op.
//   - Le scan AST est borné aux littéraux `z.object`/`z.strictObject`/`z.looseObject` des `src/data/schemas/defs/*.ts` : il ne voit ni les clés ajoutées par `.extend(...)`, ni un schéma composé par une fabrique, ni les defs hors de ce dossier. Le « schéma commun candidat » est apparié par SIGNATURE EXACTE.
//   - `schemasCommuns` ne garde qu’UN nom par SIGNATURE (le premier vu, racines avant niches) : deux nœuds de grammaire de même signature se masquent l’un l’autre, et l’arrivée du second RENOMME le « commun » recommandé d’une ligne de redéclaration sans qu’aucun porteur n’ait bougé — mesuré 2026-09-01, `miscast.ts | dice` est passé de `formulaSchema` à `prixTireSchema` (#1463 L-gram-3) à donnée, def et signature INCHANGÉS.
//   - Les portes MOTEUR (`src/engine`, `src/state`) et les JSON hors documents (outillage, `public/qc/*`, baselines de gardes) ne sont pas mesurés : ce contrat parle de la DONNÉE authorée et de ses schémas.
//   - Les CACHES de parse AST (`CACHE_SOURCE`, `CACHE_LITTERAUX`) sont module-level et ne sont jamais invalidés : en mode watch, une édition d’un `defs/*.ts` n’est pas re-mesurée sans redémarrage.
//   - Le concept `test` CÈDE tout objet qui DÉSIGNE une entité (clause `horsDesignation` : clé de `CLES_IDENTITE`, ou clé en `RX_CLE_REFERENCE`) et passe APRÈS `plage` : 12 objets porteurs de `difficulty` restent classés `test` sans en être un — `tavernGames.json › volley.rows` 7 (rangées sans bornes authorées), `sea-events.json › params` 3 (le sujet du jet y vit sous `testType`) et `etats.json › difficultyBy` 2. Ce qui leur manque n’est pas TOUT discriminant structurel (`difficultyBy` porte `{cond, difficulty}`, et `cond` en est un) : c’est une clé de DÉSIGNATION, la seule que ce concept cède.
//   - Le scan AST des redéclarations ne lit QUE `src/data/schemas/defs/` : les 148 littéraux zod de `src/data/schemas/defs-scenes/` (`effets.ts` 71, `scene.ts` 53, `worldmap.ts` 15, `narratif.ts` 7, `communs.ts` 2) en sont HORS PÉRIMÈTRE — un seul d’entre eux serait classé par le lexique s’il y entrait (`scene.ts:438` `wallClimbSchema`, concept `test` par le noyau `difficulty`). L’autre cas mesuré du concept `test`, `extendedTestSchema`, vit en grammaire (`src/data/schemas/grammaire/mecanique.ts`), hors périmètre elle aussi (#1657).
//   - Le lexique FERMÉ est le PLAFOND de détection des redéclarations : un littéral dont le concept n’est pas au lexique n’est compté que s’il a un schéma commun de MÊME signature exacte — deux defs divergents sur un champ d’un concept absent restent invisibles aux occurrences, et seul le compte GLOBAL des littéraux (`totalLitteraux`, 482 après ce lot, 487 à `9739ee1f4`) bouge.
//
// COMMENT UNE LIGNE SE SOLDE — jamais en la retirant seule :
//   1. on MIGRE la donnée (ou le schéma) vers la forme cible du lexique, dans le LOT porté par la
//      ligne (champ `lot`, obligatoire, testé contre `LOTS_CONNUS`) ;
//   2. la sonde ne l'observe plus, la garde rougit sur « ligne périmée » ;
//   3. on retire la ligne dans le MÊME commit que la migration.
// Le contrat est BIDIRECTIONNEL : une forme observée absente d'ici = rouge (dérive neuve) ; une
// ligne d'ici plus observée = rouge (ligne périmée) ; un compte d'occurrences, un LOT, un MOTIF ou
// une DATE qui bougent = rouge (ils entrent dans la clé comparée). Ce stock ne fait que DÉCROÎTRE.
//
// LOT, MOTIF, DATE sont du PILOTAGE : ils se DÉCIDENT en revue, la sonde ne les mesure pas — la
// forme observée les reprend d'ici par son SITE (concept, dataset, champ, signature). Le lot d'une
// ligne se DÉDUIT par défaut du concept (`lotDeForme`), et cette déduction lit la colonne `cibles`,
// qui liste TOUS les datasets atteignables, COLLISIONS d'ids comprises (angle mort déclaré
// ci-dessus) : une ligne dont le CONCEPT RÉEL n'est pas celui que la déduction lui prête se
// re-lotit, et porte alors un `motif` qui NOMME ce concept. Le champ est exigé à la divergence et
// interdit hors divergence (`src/data/structures-contrat.test.ts`, test « un LOT qui DIVERGE »).

/** Signatures de statut `cible` du lexique, FIGÉES ici : l'égalité stricte avec
 *  `CONCEPTS` est testée. Faire passer une graphie en `cible` (donc hors du dénominateur)
 *  exige de toucher CE fichier — un mot du lexique ne solde plus des centaines d'occurrences. */
export const STRUCTURES_CIBLES = [
  { concept: "reference", signature: "id", date: "2026-08-23" },
  { concept: "reference", signature: "id,spec", date: "2026-08-23" },
  { concept: "reference", signature: "choix,id", date: "2026-08-23" },
  { concept: "reference", signature: "id,type", date: "2026-08-23" },
  { concept: "reference", signature: "count,id,type", date: "2026-08-23" },
  { concept: "reference", signature: "of,pick", date: "2026-08-23" },
  { concept: "reference", signature: "pick,table", date: "2026-08-23" },
  // RECLASSEMENT AU SITE (L2 #1548, commit 4bis) — trois graphies passent CIBLE au SEUL site du
  // STATBLOC (`SITE_STATBLOC` du lexique : bestiaire + statblocs embarqués des projets de scène,
  // champ `skills`). Elles restent HISTORIQUES partout ailleurs, et le stock des formes le montre :
  // `creatures.json › traits {id,value}` (914) et `trappings.json › qualities {id,value}` y sont
  // toujours, lot L3. Ce que le site tranche, c'est que la valeur IMPRIMÉE est un champ de la
  // référence de Compétence (#1463, « Faits tranchés au Source » : « `value` = le seul nom du NOMBRE
  // IMPRIMÉ au statbloc » ; clause de composition : « `value` requis sur un statbloc »). AUCUNE
  // donnée n'est réécrite par ce reclassement — les 6 lignes qu'il sort du dénominateur sont les
  // mêmes objets, mesurés à la forme cible.
  { concept: "reference", signature: "id,value", date: "2026-08-31" },
  { concept: "reference", signature: "id,spec,value", date: "2026-08-31" },
  // Le régime `choix` du MÊME nœud (53 emplacements libres + 6 bornés, migrés au commit 4bis).
  { concept: "reference", signature: "choix,id,value", date: "2026-08-31" },
  // DESIGN v2 S2 (#1463, commentaire du 2026-08-23) : « `refs(type)` = liste d'ids nus brandée
  // (75 champs `string[]`) ». La liste d'ids nus EST la forme visée — ce qui reste à faire est le
  // TYPAGE du champ, pas une réécriture de la donnée : elle sort du dénominateur des formes.
  { concept: "refs", signature: "ids-nus", date: "2026-08-30" },
  { concept: "monnaie", signature: "brass,gold,silver", date: "2026-08-23" },
  // #1463 L-monnaie-3 (2026-09-01) — les 6 sous-signatures NON VIDES d'un montant PARTIEL sortent du
  // dénominateur. PREUVE : `moneyPartialSchema` (`src/data/schemas/grammaire/valeurs.ts:300`) déclare
  // les 3 dénominations OPTIONNELLES, et `toMoney` (`src/engine/money.ts:45`) complète à 0 celles qui
  // manquent : un coût authoré qui n'écrit que ce qu'il chiffre EST à la forme cible. Les variantes
  // `+…` n'y sont PAS : un montant qui cohabite avec d'autres clés sur le MÊME objet est un étalement,
  // et l'étalement se migre (les 44 `giveMoney` du même lot), il ne se blanchit pas.
  { concept: "monnaie", signature: "brass", date: "2026-09-01" },
  { concept: "monnaie", signature: "gold", date: "2026-09-01" },
  { concept: "monnaie", signature: "silver", date: "2026-09-01" },
  { concept: "monnaie", signature: "brass,gold", date: "2026-09-01" },
  { concept: "monnaie", signature: "brass,silver", date: "2026-09-01" },
  { concept: "monnaie", signature: "gold,silver", date: "2026-09-01" },
  // #1389 (épique #1388, 2026-09-07) — l'ADRESSE de prose et son FRAGMENT naissent CIBLES : ce sont
  // les formes que le parseur `src/data/source/decoupe.ts` PRODUIT et que `descRefSchema`
  // (`grammaire/valeurs.ts`) est seul à accepter — il n'y a rien à migrer vers une autre graphie.
  // Sans ces trois lignes, `book` les ferait classer `source` et `sum` `formule`, par MISCLASSEMENT.
  { concept: "adresse", signature: "book,ch,parts", date: "2026-09-07" },
  { concept: "fragment", signature: "b0,b1,sec,secOcc,sum+…", date: "2026-09-07" },
  { concept: "fragment", signature: "col,row,sec,secOcc,sum+…", date: "2026-09-07" },
  { concept: "de", signature: "n,sides", date: "2026-08-23" },
  { concept: "de", signature: "n,plus,sides", date: "2026-08-23" },
  // #1463 L-de-1 : la COMPOSITION d'une `Formula` (`formulaSchema`, `grammaire/valeurs.ts`) et le
  // terme de Péché qui s'y ajoute (`sinPointsSchema`) — LDB 40 l.58/62/63/65/68/71/72/73/75/77.
  { concept: "formule", signature: "sum", date: "2026-09-01" },
  { concept: "formule", signature: "sinPoints", date: "2026-09-01" },
  { concept: "source", signature: "book,page", date: "2026-08-23" },
  { concept: "source", signature: "book,note,page", date: "2026-08-23" },
  { concept: "plage", signature: "max,min", date: "2026-08-23" },
  // #1463 L4 P2 (2026-08-31) — la FOURCHETTE d'une rangée de table sort du dénominateur. Ce n'est pas
  // un mot du lexique qui la sort : la cible est TRANCHÉE (forme PLATE `{min, max}` + `findTableEntry`,
  // `src/engine/tables.ts`), et la charge utile d'une rangée (102 charges distinctes mesurées) est
  // INHÉRENTE — c'est ce que le suffixe `+…` de la projection nomme. Rien à migrer sur les 1413 objets
  // déjà à cette forme ; ce qui restait à faire l'a été, et se voit en donnée : les 34 rangées que
  // `weather.json` et `advancementCosts.json` encodaient par la BORNE HAUTE SEULE portent leurs deux
  // bornes, et leurs deux lookups ordre-dépendants sont passés à `findTableEntry`.
  { concept: "plage", signature: "max,min+…", date: "2026-08-31" },
  // Les bornes du DOMAINE d'un réglage (`reglesOptionnelles.json`, 23 objets, co-présence
  // `default`/`step`) : même noyau, autre concept — aucun d100 ne les traverse. Elles étaient comptées
  // `plage divergente` par MISCLASSEMENT ; le concept `bornes` du lexique les nomme, à leur forme.
  { concept: "bornes", signature: "max,min+…", date: "2026-08-31" },
  { concept: "quantite", signature: "fixed", date: "2026-08-23" },
  { concept: "quantite", signature: "roll", date: "2026-08-23" },
  // STRATE DOCUMENT (#1633, 2026-09-01) — les enveloppes nommées de la grammaire de campagne entrent
  // ici, PORTE par PORTE. Ce ne sont pas des formes à migrer : chaque signature est la PROJECTION du
  // noyau REQUIS de sa porte zod, et le suffixe `+…` y nomme les clés OPTIONNELLES que le schéma
  // déclare (les DEUX projections sont donc cibles, la donnée n'en posant aujourd'hui qu'une par
  // porte). Elles quittent le dénominateur HORS STRATE (12 lignes, cf. `PLAFOND_HORS_STRATE`), et la
  // ligne `diligence-projet.json › ouverture` quitte en outre `STRUCTURES_ORPHELINES` : la
  // projection réunit les deux buckets qu'un optionnel peuplé (`source`) séparait.
  // Portes : `ouvertureSchema` / `clotureSchema` / `formeNarratif`
  // (`src/data/schemas/defs-scenes/narratif.ts`) et `conditionSchema`
  // (`src/data/schemas/grammaire/mecanique.ts`, variante `flag`).
  { concept: "ouverture", signature: "pitch,titre", date: "2026-09-01" },
  { concept: "ouverture", signature: "pitch,titre+…", date: "2026-09-01" },
  { concept: "cloture", signature: "titre,when", date: "2026-09-01" },
  { concept: "cloture", signature: "titre,when+…", date: "2026-09-01" },
  { concept: "narratif", signature: "affaires,indices,objets,presetsPnj", date: "2026-09-01" },
  { concept: "narratif", signature: "affaires,indices,objets,presetsPnj+…", date: "2026-09-01" },
  { concept: "condition", signature: "expr,kind", date: "2026-09-01" },
];

/** Une forme de donnée encore observée, à éteindre : `historique` (graphie reconnue au lexique) ou
 *  `divergente` (graphie inconnue). `champ` = la clé PORTEUSE mesurée (`(racine)` = l'objet racine
 *  du document), `strate` = la strate de la grammaire (#1463), `lot` = qui l'éteint. */
export const STRUCTURES_FORMES = [
  { concept: "reference", dataset: "actions.json", champ: "armed", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "actions.json", champ: "gate", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "actions.json", champ: "hote", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "actions.json", champ: "mode", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "actions.json", champ: "rule", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 32, lot: "L3 #1463", date: "2026-08-30", motif: "référence de RÈGLE" },
  { concept: "reference", dataset: "activities.json", champ: "ops", signature: "id+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "activities.json", champ: "ops", signature: "tableId+…", statut: "divergente", strate: "Référence", occurrences: 16, lot: "L3 #1463", date: "2026-08-23" },
  // #1612 (2026-09-06) — les trois porteurs du terme `{rule}` d'une `Formula` posés par Mendier :
  // `testMods[].mod` (2), le `factor` de la formule de gain, et la `cible` de son dé de monde. Même
  // forme, même solde que tout autre `{rule}` (`formulaSchema`, `grammaire/valeurs.ts`).
  // #1612 (2026-09-06) — l'op `condition` de la table MAISON `mendier-ennuis` (LDB 09 l.97) : elle
  // désigne l'État posé par la rangée « autres mendiants », même forme que toute autre op `condition`
  // en donnée.
  { concept: "reference", dataset: "tables.json", champ: "ops", signature: "id+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "activities.json", champ: "cible", signature: "rule", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "activities.json", champ: "factor", signature: "rule", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "activities.json", champ: "mod", signature: "rule", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  // #1612 (2026-09-06) — 4ᵉ porteur du même terme `{rule}` : le `times.of` de l'amende des gardes
  // (`mendier-ennuis`), dont le montant vit en règle optionnelle. Même forme, même solde que ses sœurs.
  { concept: "reference", dataset: "tables.json", champ: "of", signature: "rule", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  // Les 2 voies de Compétence d’une Activité qui portent leur Difficulté PROPRE (`skillRefSchema`,
  // `defs/activities.ts:19`) : une RÉFÉRENCE à charge utile, mesurée comme telle depuis que le
  // concept `test` cède les objets qui DÉSIGNENT (#1657 geste A).
  { concept: "reference", dataset: "activities.json", champ: "skills", signature: "id+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L2 #1463", date: "2026-09-01" },
  { concept: "reference", dataset: "activities.json", champ: "skills", signature: "id,spec+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L2 #1463", date: "2026-09-01" },
  // `augure` → `tableau-augure` (`regles.json`) : la RÈGLE que l’Activité applique. Mesurée depuis que
  // l’entrée n’est plus classée `test` — un objet DÉJÀ classé n’ouvre pas la résolution scalaire.
  { concept: "reference", dataset: "activities.json", champ: "rule", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-09-01" },
  { concept: "reference", dataset: "arcane-phenomena.json", champ: "cancelsTraitId", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arcane-phenomena.json", champ: "domainId", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 8, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arcane-phenomena.json", champ: "fluxTableId", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arcane-phenomena.json", champ: "tableId", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "a", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "acts", signature: "act+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "ambush", signature: "encounter,scene", statut: "divergente", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "appearance", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "appearance", signature: "species", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-09-01" },
  { concept: "reference", dataset: "arene-projet.json", champ: "appearance", signature: "species,tenue", statut: "divergente", strate: "Référence", occurrences: 5, lot: "L3 #1463", date: "2026-08-30", motif: "apparence : ESPÈCE et TENUE" },
  { concept: "reference", dataset: "arene-projet.json", champ: "appearance", signature: "species,tenue+…", statut: "divergente", strate: "Référence", occurrences: 12, lot: "L3 #1463", date: "2026-08-30", motif: "apparence : ESPÈCE et TENUE" },
  { concept: "reference", dataset: "arene-projet.json", champ: "appearance", signature: "tenue", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "appearance", signature: "tenue+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "b", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "choices", signature: "next+…", statut: "divergente", strate: "Référence", occurrences: 14, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "dialogueId", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 9, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "effect", signature: "dialogue,speakerId,type", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "effect", signature: "encounter,type", statut: "divergente", strate: "Référence", occurrences: 20, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "effect", signature: "entityId,type", statut: "divergente", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-30", motif: "référence d’ENTITÉ de scène" },
  { concept: "reference", dataset: "arene-projet.json", champ: "effect", signature: "entityId,type+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "effect", signature: "scene,type", statut: "divergente", strate: "Référence", occurrences: 13, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "effect", signature: "scene,type+…", statut: "divergente", strate: "Référence", occurrences: 13, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "effect", signature: "spell,type", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "effect", signature: "trappingId,type", statut: "divergente", strate: "Référence", occurrences: 16, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "effect", signature: "trappingId,type+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "material", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 9, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "members", signature: "entityId", statut: "divergente", strate: "Référence", occurrences: 110, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "members", signature: "entityId,ridesEntityId", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "members", signature: "entityId+…", statut: "divergente", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "merchant", signature: "archetype", statut: "divergente", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-30", motif: "référence d’ARCHÉTYPE de marchand" },
  { concept: "reference", dataset: "arene-projet.json", champ: "optionals", signature: "arg,id", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-30", motif: "paramètre d’ENTITÉ (trait, talent)" },
  { concept: "reference", dataset: "arene-projet.json", champ: "optionals", signature: "id,value", statut: "historique", strate: "Référence", occurrences: 5, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "ref", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 406, lot: "L3 #1463", date: "2026-08-30", motif: "référence de PION de scène" }, // 293→406 : +113 OCCURRENCES — 24 ids de décor sont posés dans cette scène, 23 n'y résolvaient rien faute d'entrée `props.json` (#1680 ligne 14) ; `toile` ×4 résolvait déjà, par le Trait homonyme
  // #1691 : `<scène> › reliefDefaults` — la matière de chaque PARTIE de relief que le builder de sols
  // émet (`cliff`/`ramp`/`deck`/`pilier`). Quatre ids NUS sous une enveloppe par PARTIE, forme CIBLE de la
  // grammaire (`idDe('material', 'relief')` les refine au parse) ; la mesure classe l'enveloppe d'ids nus
  // en référence divergente, la ligne entre donc au dénominateur du lot L3 comme les autres.
  { concept: "reference", dataset: "arene-projet.json", champ: "reliefDefaults", signature: "cliff,deck,pilier,ramp", statut: "divergente", strate: "Référence", occurrences: 18, lot: "L3 #1463", date: "2026-08-23" },
  // #1715 : `<scène> › roofDefaults` — la couverture, la pente de RÉFÉRENCE et la borne de comble que
  // la dérivation des toitures lit (`toitureEffective`, `state/sceneEdit.ts`). MÊME forme et MÊME
  // solde que `reliefDefaults` ci-dessus : un record de champs NOMMÉS dont un seul (`material`) porte
  // une référence, vu par le scan comme UN nœud de référence à graphie divergente. La ligne meurt
  // avec le dériveur d'un niveau.
  { concept: "reference", dataset: "arene-projet.json", champ: "roofDefaults", signature: "material+…", statut: "divergente", strate: "Référence", occurrences: 18, lot: "L3 #1463", date: "2026-09-09" },
  { concept: "reference", dataset: "arene-projet.json", champ: "scene", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "start", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 9, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "traits", signature: "arg,id", statut: "historique", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "traits", signature: "arg,id,value", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "traits", signature: "id,value", statut: "historique", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "walls", signature: "structure+…", statut: "divergente", strate: "Référence", occurrences: 235, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "arene-projet.json", champ: "weapon", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 6, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "axes.json", champ: "talents", signature: "spec,talentId", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-30", motif: "référence de TALENT" },
  { concept: "reference", dataset: "axes.json", champ: "talents", signature: "talentId", statut: "historique", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "barge-du-sel-projet.json", champ: "a", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "barge-du-sel-projet.json", champ: "ambush", signature: "encounter,scene+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "barge-du-sel-projet.json", champ: "ammo", signature: "kind,subType,trappingId+…", statut: "divergente", strate: "Référence", occurrences: 8, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "barge-du-sel-projet.json", champ: "appearance", signature: "species,tenue", statut: "divergente", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-09-01" },
  { concept: "reference", dataset: "barge-du-sel-projet.json", champ: "b", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "barge-du-sel-projet.json", champ: "crew", signature: "count,roleId", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "barge-du-sel-projet.json", champ: "effect", signature: "type,vehicleId+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "barge-du-sel-projet.json", champ: "members", signature: "entityId+…", statut: "divergente", strate: "Référence", occurrences: 7, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "barge-du-sel-projet.json", champ: "postes", signature: "trappingId+…", statut: "divergente", strate: "Référence", occurrences: 6, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "barge-du-sel-projet.json", champ: "qualities", signature: "id,value", statut: "historique", strate: "Référence", occurrences: 8, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "barge-du-sel-projet.json", champ: "ref", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 5, lot: "L3 #1463", date: "2026-08-30", motif: "référence de PION de scène" },
  { concept: "reference", dataset: "barge-du-sel-projet.json", champ: "reliefDefaults", signature: "cliff,deck,pilier,ramp", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "barge-du-sel-projet.json", champ: "roofDefaults", signature: "material+…", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-09-09" },
  { concept: "reference", dataset: "barge-du-sel-projet.json", champ: "scene", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "barge-du-sel-projet.json", champ: "victoryCondition", signature: "targetId,type+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  // #1715 : les 7 bâtiments du catalogue TS deviennent la DONNÉE `buildings.json`. Aucune référence
  // n'est authorée de neuf — les deux champs portaient déjà ces valeurs en TS ; ils entrent au
  // dénominateur en devenant de la donnée MESURÉE. Les deux GRAPHIES sont celles que L3 éteint
  // partout : l'id NU d'une couverture, la référence ENVELOPPÉE `{id}` + charge (`anchor`) d'un ornement.
  { concept: "reference", dataset: "buildings.json", champ: "features", signature: "id+…", statut: "divergente", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-09-09" },
  { concept: "reference", dataset: "buildings.json", champ: "roofMaterial", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 7, lot: "L3 #1463", date: "2026-09-09" },
  { concept: "reference", dataset: "careerLevels.json", champ: "career", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 432, lot: "L3 #1463", date: "2026-08-30", motif: "référence de CARRIÈRE" },
  { concept: "reference", dataset: "careerLevels.json", champ: "choice", signature: "choice>id", statut: "historique", strate: "Référence", occurrences: 25, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "careerLevels.json", champ: "choice", signature: "choice>id,qualityChoice", statut: "historique", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  // Ligne SŒUR des deux ci-dessus, née du MÊME objet migré (#1463 L-ref-1) : `alchimiste-4` ›
  // « Atelier (Ingénierie ou Magie) » cesse d'écrire son choix en toutes lettres et devient l'emplacement
  // `{choice:[{id,spec},{id,spec}]}`. Le CONTENU d'une graphie enveloppante hérite du statut de son
  // enveloppe (`choice>id`, historique) : une branche `{id, spec}` est une CIBLE, c'est le `choice`
  // qui reste à éteindre — avec les 25 de la ligne précédente, au même lot.
  { concept: "reference", dataset: "careerLevels.json", champ: "choice", signature: "choice>id,spec", statut: "historique", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-09-01" },
  // 13 → 14 et 16 → 23 (#1463 L-ref-1) : AUCUNE structure neuve — les MÊMES objets changent de
  // classement. « Atelier (Ingénierie ou Magie) » devient l'emplacement `choice` qu'il décrivait en
  // toutes lettres, et les 7 dotations comptées qui NOMMAIENT une possession (« Carreaux » ×6,
  // « Chiffon ») rejoignent `count,id`. Les deux lignes `text (résolvable)` qu'ils quittent, elles,
  // MEURENT — et avec celle du bestiaire (L-ref-1bis, `long-drong-silver` › « cache-œil »), la
  // signature `text (résolvable)` n'a plus AUCUN porteur au stock : le concept `reference` sort
  // entièrement de la famille `{text}`.
  { concept: "reference", dataset: "careerLevels.json", champ: "trappings", signature: "choice", statut: "historique", strate: "Référence", occurrences: 14, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "careerLevels.json", champ: "trappings", signature: "count,id", statut: "historique", strate: "Référence", occurrences: 23, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "careerLevels.json", champ: "trappings", signature: "count,id,qualityChoice", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "careerLevels.json", champ: "trappings", signature: "count,vehicleId+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "careerLevels.json", champ: "trappings", signature: "creatureId", statut: "historique", strate: "Référence", occurrences: 54, lot: "L3 #1463", date: "2026-08-30", motif: "dotation : référence de CRÉATURE" },
  { concept: "reference", dataset: "careerLevels.json", champ: "trappings", signature: "creatureId+…", statut: "divergente", strate: "Référence", occurrences: 5, lot: "L3 #1463", date: "2026-08-30", motif: "dotation : référence de CRÉATURE" },
  { concept: "reference", dataset: "careerLevels.json", champ: "trappings", signature: "id,qualityChoice", statut: "historique", strate: "Référence", occurrences: 36, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "careerLevels.json", champ: "trappings", signature: "vehicleId", statut: "historique", strate: "Référence", occurrences: 15, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "careerLevels.json", champ: "trappings", signature: "vehicleId+…", statut: "divergente", strate: "Référence", occurrences: 11, lot: "L3 #1463", date: "2026-08-30", motif: "dotation : référence de VÉHICULE" },
  { concept: "reference", dataset: "careerLevels.json", champ: "trappings", signature: "wildcard", statut: "historique", strate: "Référence", occurrences: 7, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "careers.json", champ: "class", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 108, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "careers.json", champ: "tenue", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 15, lot: "L3 #1463", date: "2026-08-30", motif: "référence de TENUE" },
  { concept: "reference", dataset: "classes.json", champ: "trappings", signature: "count,id", statut: "historique", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "combat-stakes.json", champ: "entryCategory", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-30", motif: "CATÉGORIE d’entrée de codex" },
  { concept: "reference", dataset: "combat-stakes.json", champ: "kind", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 7, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "combat-stakes.json", champ: "rule", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 25, lot: "L3 #1463", date: "2026-08-30", motif: "référence de RÈGLE" }, // 23 → 24 (#1657 B3-1) : l'enjeu `critRowTest` de la rangée de Critique nomme son foyer ; 24 → 25 (#1657 B3-2) : l'enjeu `shipCrewHit` du coup à l'équipage nomme le sien (`critiques-de-bateau`, MSRC 07 l.74)
  { concept: "reference", dataset: "creatures.json", champ: "appearance", signature: "species", statut: "divergente", strate: "Référence", occurrences: 227, lot: "L3 #1463", date: "2026-08-30", motif: "apparence : ESPÈCE" }, // +1 : Chien de trait, EDOC 07 folio 22, #673
  { concept: "reference", dataset: "creatures.json", champ: "appearance", signature: "species,tenue", statut: "divergente", strate: "Référence", occurrences: 107, lot: "L3 #1463", date: "2026-08-30", motif: "apparence : ESPÈCE et TENUE" },
  { concept: "reference", dataset: "creatures.json", champ: "appearance", signature: "species,tenue+…", statut: "divergente", strate: "Référence", occurrences: 70, lot: "L3 #1463", date: "2026-08-30", motif: "apparence : ESPÈCE et TENUE" },
  { concept: "reference", dataset: "creatures.json", champ: "appearance", signature: "species+…", statut: "divergente", strate: "Référence", occurrences: 52, lot: "L3 #1463", date: "2026-08-30", motif: "apparence : ESPÈCE" },
  { concept: "reference", dataset: "creatures.json", champ: "grant", signature: "char,value", statut: "divergente", strate: "Référence", occurrences: 5, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "creatures.json", champ: "spec", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 1, lot: "L2 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "creatures.json", champ: "monster", signature: "tete", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-30", motif: "apparence de MONSTRE par localisation" },
  { concept: "reference", dataset: "creatures.json", champ: "optionals", signature: "arg,id", statut: "historique", strate: "Référence", occurrences: 133, lot: "L3 #1463", date: "2026-08-30", motif: "paramètre d’ENTITÉ (trait, talent)" },
  { concept: "reference", dataset: "creatures.json", champ: "optionals", signature: "arg,id,value", statut: "historique", strate: "Référence", occurrences: 6, lot: "L3 #1463", date: "2026-08-30", motif: "paramètre d’ENTITÉ (trait, talent)" },
  { concept: "reference", dataset: "creatures.json", champ: "optionals", signature: "arg,id,value+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "creatures.json", champ: "optionals", signature: "count,id,value", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "creatures.json", champ: "optionals", signature: "id,value", statut: "historique", strate: "Référence", occurrences: 23, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "creatures.json", champ: "optionals", signature: "id,value+…", statut: "divergente", strate: "Référence", occurrences: 7, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "creatures.json", champ: "optionals", signature: "id+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "creatures.json", champ: "optionals", signature: "size+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "creatures.json", champ: "talents", signature: "id,times", statut: "historique", strate: "Référence", occurrences: 48, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "creatures.json", champ: "traits", signature: "arg,id", statut: "historique", strate: "Référence", occurrences: 408, lot: "L3 #1463", date: "2026-08-30", motif: "référence de TRAIT paramétré" },
  { concept: "reference", dataset: "creatures.json", champ: "traits", signature: "arg,id,value", statut: "historique", strate: "Référence", occurrences: 118, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "creatures.json", champ: "traits", signature: "arg,id,value+…", statut: "divergente", strate: "Référence", occurrences: 43, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "creatures.json", champ: "traits", signature: "arg,id+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "creatures.json", champ: "traits", signature: "count,id,value", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "creatures.json", champ: "traits", signature: "id,value", statut: "historique", strate: "Référence", occurrences: 914, lot: "L3 #1463", date: "2026-08-23" }, // +1 : Chien de trait (Arme +5), EDOC 07 folio 22, #673
  { concept: "reference", dataset: "creatures.json", champ: "traits", signature: "id,value+…", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "creatures.json", champ: "trappings", signature: "count,id", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "creatures.json", champ: "trappings", signature: "creatureId", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "crew-test-types.json", champ: "essential", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 10, lot: "L3 #1463", date: "2026-08-30", motif: "référence de RÔLE d’équipage" },
  { concept: "reference", dataset: "crew-test-types.json", champ: "rule", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 10, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "criticals.json", champ: "apresDelai", signature: "versTraumaId+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "criticals.json", champ: "onHealGrant", signature: "scar+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "criticals.json", champ: "onNextCritWhileCondition", signature: "whileCondition+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "criticals.json", champ: "ops", signature: "char+…", statut: "divergente", strate: "Référence", occurrences: 8, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "criticals.json", champ: "ops", signature: "disease+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "criticals.json", champ: "ops", signature: "id,value+…", statut: "divergente", strate: "Référence", occurrences: 205, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "criticals.json", champ: "perRound", signature: "versTraumaId", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "criticals.json", champ: "recoveryPenalty", signature: "char+…", statut: "divergente", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "criticals.json", champ: "subject", signature: "condition+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "diligence-projet.json", champ: "a", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-31" },
  { concept: "reference", dataset: "diligence-projet.json", champ: "b", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-31" },
  { concept: "reference", dataset: "diligence-projet.json", champ: "ref", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 20, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "diligence-projet.json", champ: "reliefDefaults", signature: "cliff,deck,pilier,ramp", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "diligence-projet.json", champ: "roofDefaults", signature: "material+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-09-09" },
  { concept: "reference", dataset: "diligence-projet.json", champ: "scene", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-31" },
  // #1715 : le TYPE de bâtiment d'un corps architectural (`ArchitectureBody.style`) résout désormais
  // contre `buildings.json` (`idDe('building')`, `defs-scenes/scene.ts`) — la même valeur `maison`
  // qu'avant, mesurée comme la référence qu'elle est. La ligne sœur `arene-projet.json | style` (2) est
  // MORTE au même geste : ses deux corps COMPOSITES (le Bourg, Felsbach) ne portent aucun type de
  // bâtiment, le champ y est absent.
  { concept: "reference", dataset: "diligence-projet.json", champ: "style", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-09-09" },
  { concept: "reference", dataset: "diligence-projet.json", champ: "walls", signature: "appearance,structure+…", statut: "divergente", strate: "Référence", occurrences: 6, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "diligence-projet.json", champ: "walls", signature: "structure+…", statut: "divergente", strate: "Référence", occurrences: 662, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "domains.json", champ: "amount", signature: "bonusOf", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "domains.json", champ: "castBonus", signature: "perCondition+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "domains.json", champ: "casterOps", signature: "traitId+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "domains.json", champ: "of", signature: "spec,value+…", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "domains.json", champ: "of", signature: "value+…", statut: "divergente", strate: "Référence", occurrences: 14, lot: "L3 #1463", date: "2026-08-30", motif: "référence de GROUPE sous tirage borné `of`" },
  { concept: "reference", dataset: "domains.json", champ: "ops", signature: "bypassArmour+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "domains.json", champ: "ops", signature: "id,value+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "domains.json", champ: "ops", signature: "id+…", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "domains.json", champ: "subject", signature: "condition+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "domains.json", champ: "tables", signature: "arcaneMark", statut: "divergente", strate: "Référence", occurrences: 8, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "drunkenness.json", champ: "ops", signature: "cible,psychType+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "etats.json", champ: "ops", signature: "id,value+…", statut: "divergente", strate: "Référence", occurrences: 5, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "etats.json", champ: "ops", signature: "id+…", statut: "divergente", strate: "Référence", occurrences: 9, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "etats.json", champ: "passive", signature: "mode+…", statut: "divergente", strate: "Référence", occurrences: 5, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "etats.json", champ: "subject", signature: "condition+…", statut: "divergente", strate: "Référence", occurrences: 10, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "etats.json", champ: "value", signature: "char+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "flow-stakes.json", champ: "flow", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 16, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "flow-stakes.json", champ: "phase", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 6, lot: "L3 #1463", date: "2026-08-30", motif: "référence de PHASE de flux" },
  { concept: "reference", dataset: "flow-stakes.json", champ: "rule", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 33, lot: "L3 #1463", date: "2026-08-30", motif: "référence de RÈGLE" },
  { concept: "reference", dataset: "grapple.json", champ: "amount", signature: "bonusOf", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "grapple.json", champ: "entangle", signature: "id,value+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "grapple.json", champ: "free", signature: "id,value+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "grapple.json", champ: "init", signature: "id,value+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "lieux-services.json", champ: "backdrop", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "lieux-services.json", champ: "merchantArchetype", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-30", motif: "référence d’ARCHÉTYPE de marchand" },
  { concept: "reference", dataset: "locations.json", champ: "parent", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 46, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "a", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "ambush", signature: "encounter,scene", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "ammo", signature: "kind,subType,trappingId+…", statut: "divergente", strate: "Référence", occurrences: 16, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "appearance", signature: "species,tenue", statut: "divergente", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-09-01" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "appearance", signature: "species,tenue+…", statut: "divergente", strate: "Référence", occurrences: 15, lot: "L3 #1463", date: "2026-09-01", motif: "apparence : ESPÈCE et TENUE" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "b", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "backdrop", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "choices", signature: "next+…", statut: "divergente", strate: "Référence", occurrences: 23, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "crew", signature: "count,roleId", statut: "divergente", strate: "Référence", occurrences: 6, lot: "L3 #1463", date: "2026-08-30", motif: "référence de RÔLE d’équipage" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "dialogueId", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 8, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "effect", signature: "factorId,type", statut: "divergente", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "effect", signature: "scene,type+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "effect", signature: "type,vehicleId+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "from", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "members", signature: "entityId+…", statut: "divergente", strate: "Référence", occurrences: 18, lot: "L3 #1463", date: "2026-08-30", motif: "référence d’ENTITÉ de scène" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "merchant", signature: "archetype", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-30", motif: "référence d’ARCHÉTYPE de marchand" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "port", signature: "ref", statut: "historique", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "postes", signature: "trappingId+…", statut: "divergente", strate: "Référence", occurrences: 12, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "qualities", signature: "id,value", statut: "historique", strate: "Référence", occurrences: 16, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "ref", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 10, lot: "L3 #1463", date: "2026-08-30", motif: "référence de PION de scène" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "reliefDefaults", signature: "cliff,deck,pilier,ramp", statut: "divergente", strate: "Référence", occurrences: 5, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "roofDefaults", signature: "material+…", statut: "divergente", strate: "Référence", occurrences: 5, lot: "L3 #1463", date: "2026-09-09" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "scene", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "serviceKind", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 8, lot: "L3 #1463", date: "2026-08-30", motif: "référence de SERVICE de lieu" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "services", signature: "kind", statut: "divergente", strate: "Référence", occurrences: 6, lot: "L3 #1463", date: "2026-08-30", motif: "référence de SERVICE de lieu" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "start", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 8, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "victoryCondition", signature: "targetId,type+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-30", motif: "référence de CIBLE de condition de victoire" },
  { concept: "reference", dataset: "loup-et-saumure-projet.json", champ: "weapon", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "maladies.json", champ: "dailyTest", signature: "symptomId+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L4 #1463", date: "2026-09-01", motif: "JET (EDOC 08 l.104) compté en référence parce qu’il DÉSIGNE le symptôme qu’il inflige — l’enveloppe `épreuve {test, onFail}` de #1657 geste B le reprend ; le lot des références ne l’éteindrait jamais" },
  { concept: "reference", dataset: "maladies.json", champ: "mutation", signature: "into+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" }, // mue Rhume → Pneumonie, EDOC 08 l.122 (#674)
  { concept: "reference", dataset: "maladies.json", champ: "ops", signature: "disease,symptomId+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" }, // cycle quotidien de la Pneumonie, EDOC 08 l.104-108 (#674) — champ `onFail` → `ops` : la conséquence vit sous la feuille `EffectOp` du nœud `test` (#1657 B2b)
  { concept: "reference", dataset: "maladies.json", champ: "otherwise", signature: "disease,symptomId+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" }, // échelon Toxine du même cycle, EDOC 08 l.106-108 (#674)
  { concept: "reference", dataset: "maladies.json", champ: "symptoms", signature: "spec,symptomId", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "maladies.json", champ: "symptoms", signature: "symptomId", statut: "divergente", strate: "Référence", occurrences: 47, lot: "L3 #1463", date: "2026-08-23" }, // +5 : Pneumonie (3) + Rhume commun (2), EDOC 08 folio 33 (#674)
  // 13 → 14 (#1657 B2b) : la 8ᵉ réf de symptôme à Difficulté PROPRE avait sa ligne à elle, sa valeur
  // `difficile` RÉSOLVANT vers un id de `sea-events.json`. En adoptant `noeudTest(flowSchema)`, le
  // document déclare désormais `difficulty` par `difficultySchema` (`z.enum`, `grammaire/valeurs.ts`)
  // au lieu du `z.string()` de son `dailyTest` propre — et une clé dont la valeur est un LITTÉRAL
  // D'ENUM du schéma n'ouvre jamais de référence : l'homonyme meurt, la projection replie en `+…`.
  { concept: "reference", dataset: "maladies.json", champ: "symptoms", signature: "symptomId+…", statut: "divergente", strate: "Référence", occurrences: 14, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "maneuvers.json", champ: "escapeStrength", signature: "charOf", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "maneuvers.json", champ: "ops", signature: "id,unlessCondition+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "maneuvers.json", champ: "ops", signature: "id,value+…", statut: "divergente", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "maneuvers.json", champ: "ops", signature: "id+…", statut: "divergente", strate: "Référence", occurrences: 9, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "maneuvers.json", champ: "ops", signature: "morphRef+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "maneuvers.json", champ: "ops", signature: "traitId+…", statut: "divergente", strate: "Référence", occurrences: 6, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "merchantFamilies.json", champ: "match", signature: "categorie", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "miscast.json", champ: "onFail", signature: "id,value+…", statut: "divergente", strate: "Référence", occurrences: 11, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "miscast.json", champ: "onFail", signature: "op+…", statut: "divergente", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "miscast.json", champ: "ops", signature: "id,value+…", statut: "divergente", strate: "Référence", occurrences: 31, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "miscast.json", champ: "ops", signature: "id,unlessCondition,value+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" }, // NEUF (#1653 train A) : « Purifier la chair » (LDB 40 l.75) gate sa cause récurrente sur l'État qu'elle pose (LDB 16 l.117)
  { concept: "reference", dataset: "miscast.json", champ: "ops", signature: "id+…", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "miscast.json", champ: "ops", signature: "op+…", statut: "divergente", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "mutations.json", champ: "eyes", signature: "G", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "mutations.json", champ: "passive", signature: "arg,traitId+…", statut: "divergente", strate: "Référence", occurrences: 5, lot: "L3 #1463", date: "2026-08-30", motif: "référence de TRAIT paramétré" },
  { concept: "reference", dataset: "mutations.json", champ: "passive", signature: "char+…", statut: "divergente", strate: "Référence", occurrences: 56, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "mutations.json", champ: "passive", signature: "psychType+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "mutations.json", champ: "passive", signature: "spec,talentId+…", statut: "divergente", strate: "Référence", occurrences: 5, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "mutations.json", champ: "passive", signature: "talentId+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  // #862 : re-ciblage quotidien de Haine sporadique — les DEUX graphies de référence de Trait que
  // `passive` porte déjà, vues cette fois sous une op authorée (`[removeTrait, grantTrait]`).
  { concept: "reference", dataset: "mutations.json", champ: "ops", signature: "argFrom,traitId+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-31" },
  { concept: "reference", dataset: "mutations.json", champ: "ops", signature: "traitId+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-31" },
  { concept: "reference", dataset: "mutations.json", champ: "passive", signature: "argFrom,traitId+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "mutations.json", champ: "passive", signature: "traitId+…", statut: "divergente", strate: "Référence", occurrences: 35, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "naval-traits.json", champ: "passive", signature: "testType+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "night-stakes.json", champ: "kind", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 9, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "night-stakes.json", champ: "rule", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 15, lot: "L3 #1463", date: "2026-08-30", motif: "référence de RÈGLE" },
  { concept: "reference", dataset: "pregens.json", champ: "career", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 8, lot: "L3 #1463", date: "2026-08-30", motif: "référence de CARRIÈRE" },
  { concept: "reference", dataset: "pregens.json", champ: "species", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 8, lot: "L3 #1463", date: "2026-08-30", motif: "référence d’ESPÈCE" },
  { concept: "reference", dataset: "props.json", champ: "light", signature: "tone+…", statut: "divergente", strate: "Référence", occurrences: 6, lot: "L3 #1463", date: "2026-08-23" }, // 3→6 : +3 OCCURRENCES — les trois luminaires allumés par #1680 ligne 5 (`applique-murale`, `lustre-opera`, `lanterne-de-poupe`) portent un `light.tone`, de la MÊME forme que les trois déjà comptés
  { concept: "reference", dataset: "props.json", champ: "primitives", signature: "material+…", statut: "divergente", strate: "Référence", occurrences: 172, lot: "L3 #1463", date: "2026-08-23" }, // 89 → 172 : les 11 recettes du LOT A #1644
  { concept: "reference", dataset: "psychology.json", champ: "becomes", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "psychology.json", champ: "failCondition", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "psychology.json", champ: "ops", signature: "id+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "psychology.json", champ: "ops", signature: "type+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "psychology.json", champ: "subject", signature: "condition+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "psychology.json", champ: "targetCauses", signature: "kind+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "qualities.json", champ: "escapeStrength", signature: "charOf", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "qualities.json", champ: "opposed", signature: "attackerSkill+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L2 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "qualities.json", champ: "passive", signature: "char+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "qualities.json", champ: "ops", signature: "disease+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "qualities.json", champ: "ops", signature: "id,unlessCondition,value+…", statut: "divergente", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-23" },
  // #1661 : 5 → 6 — la branche `yes` du choix de Taillade pose le 2ᵉ État Hémorragique (`AA 08 l.87`,
  // « 1 État Hémorragique supplémentaire »). MÊME graphie que l'État automatique déjà compté, une
  // déclaration de plus — pas une forme neuve.
  { concept: "reference", dataset: "qualities.json", champ: "ops", signature: "id+…", statut: "divergente", strate: "Référence", occurrences: 6, lot: "L3 #1463", date: "2026-09-05" },
  { concept: "reference", dataset: "raceAppearance.json", champ: "gabarit", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 6, lot: "L3 #1463", date: "2026-08-30", motif: "référence de GABARIT de rig" },
  { concept: "reference", dataset: "raceAppearance.json", champ: "head", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 7, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "raceAppearance.json", champ: "tenue", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 14, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "reglesOptionnelles.json", champ: "default", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "river-criticals.json", champ: "ops", signature: "id,value+…", statut: "divergente", strate: "Référence", occurrences: 5, lot: "L3 #1463", date: "2026-08-23" }, // 4 → 5 (#1657 B2c) : l'État *Empêtré* du gréement (MSRC 07 l.78) quitte `crewTest.onFail` pour la feuille `EffectOp` de la branche d'échec du nœud
  { concept: "reference", dataset: "sea-events.json", champ: "escalation", signature: "vents+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "sea-events.json", champ: "params", signature: "bribeDifficulty+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "sea-events.json", champ: "params", signature: "chefRef,crewRef,ship+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-30", motif: "paramètres d’ÉVÉNEMENT (créature, véhicule)" },
  { concept: "reference", dataset: "sea-events.json", champ: "params", signature: "crewRef,ship+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "sea-events.json", champ: "params", signature: "precipitations,temperature,vents,visibilite+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "sea-events.json", champ: "params", signature: "precipitations,vents,visibilite+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "sea-events.json", champ: "params", signature: "precipitations,visibilite+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "sea-events.json", champ: "params", signature: "talent+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "sea-events.json", champ: "params", signature: "temperature+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "sea-shanties.json", champ: "captainOps", signature: "char+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "sea-shanties.json", champ: "crewOps", signature: "char+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "sea-weather.json", champ: "spec", signature: "projectiles", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "ship-construction.json", champ: "constructionTraits", signature: "id+…", statut: "divergente", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "ship-criticals.json", champ: "ops", signature: "id,value+…", statut: "divergente", strate: "Référence", occurrences: 11, lot: "L3 #1463", date: "2026-08-23" }, // 5 → 11 (#1657 B3-2b-a) : 6 rangées MDG dont le Test ne vivait qu'en prose `note` gagnent leur `crewHit` (MDG 13 l.730/734/736/738/751/756, échec = État À Terre)
  { concept: "reference", dataset: "skills.json", champ: "altChar", signature: "gatedByRule+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "skills.json", champ: "chars", signature: "FM,Int+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "skills.json", champ: "chars", signature: "true", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "species.json", champ: "gatedByRule", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "species.json", champ: "talents", signature: "random", statut: "historique", strate: "Référence", occurrences: 19, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "species.json", champ: "of", signature: "random", statut: "historique", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-31" },
  { concept: "reference", dataset: "speciesRace.json", champ: "default", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "speciesRace.json", champ: "rules", signature: "race+…", statut: "divergente", strate: "Référence", occurrences: 22, lot: "L3 #1463", date: "2026-08-30", motif: "référence de RACE" },
  { concept: "reference", dataset: "spells.json", champ: "addTraits", signature: "id,value", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "spells.json", champ: "cond", signature: "is+…", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-30", motif: "CONDITION de sort" },
  { concept: "reference", dataset: "spells.json", champ: "domainId", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 256, lot: "L3 #1463", date: "2026-08-30", motif: "référence de DOMAINE de magie" },
  { concept: "reference", dataset: "spells.json", champ: "of", signature: "spec,value+…", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "spells.json", champ: "of", signature: "value+…", statut: "divergente", strate: "Référence", occurrences: 5, lot: "L3 #1463", date: "2026-08-30", motif: "référence de GROUPE sous tirage borné `of`" },
  { concept: "reference", dataset: "spells.json", champ: "onCross", signature: "id+…", statut: "divergente", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "spells.json", champ: "ops", signature: "arg,traitId+…", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-30", motif: "référence de TRAIT paramétré" },
  { concept: "reference", dataset: "spells.json", champ: "ops", signature: "count,ref,size+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-30", motif: "référence de CRÉATURE invoquée" },
  { concept: "reference", dataset: "spells.json", champ: "ops", signature: "count,ref+…", statut: "divergente", strate: "Référence", occurrences: 14, lot: "L3 #1463", date: "2026-08-30", motif: "référence de CRÉATURE invoquée" },
  { concept: "reference", dataset: "spells.json", champ: "ops", signature: "disease+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "spells.json", champ: "ops", signature: "form,subType+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "spells.json", champ: "ops", signature: "id,onlyIfCondition+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "spells.json", champ: "ops", signature: "id,unlessCondition+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "spells.json", champ: "ops", signature: "id,value+…", statut: "divergente", strate: "Référence", occurrences: 25, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "spells.json", champ: "ops", signature: "id+…", statut: "divergente", strate: "Référence", occurrences: 68, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "spells.json", champ: "ops", signature: "op", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "spells.json", champ: "ops", signature: "op+…", statut: "divergente", strate: "Référence", occurrences: 17, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "spells.json", champ: "ops", signature: "psychType+…", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "spells.json", champ: "ops", signature: "ref+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-30", motif: "référence de CRÉATURE invoquée" },
  { concept: "reference", dataset: "spells.json", champ: "ops", signature: "removeType+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "spells.json", champ: "ops", signature: "requiresWeapon+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "spells.json", champ: "ops", signature: "spec,talentId+…", statut: "divergente", strate: "Référence", occurrences: 6, lot: "L3 #1463", date: "2026-08-30", motif: "référence de TALENT" },
  { concept: "reference", dataset: "spells.json", champ: "ops", signature: "tableId+…", statut: "divergente", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "spells.json", champ: "ops", signature: "talentId+…", statut: "divergente", strate: "Référence", occurrences: 15, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "spells.json", champ: "ops", signature: "tone+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  // 34 -> 35 (#1508 T3, 2026-09-07) : l'op `domeWard` du sort Dôme NOMME désormais le Trait qu'elle
  // octroie (`traitId`, `LDB 47 l.410`) au lieu de le taire ; même graphie, une occurrence de plus.
  { concept: "reference", dataset: "spells.json", champ: "ops", signature: "traitId+…", statut: "divergente", strate: "Référence", occurrences: 35, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "spells.json", champ: "ops", signature: "trappingId+…", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "spells.json", champ: "perRound", signature: "id,unlessCondition+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "spells.json", champ: "perRound", signature: "id+…", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "spells.json", champ: "perRound", signature: "op+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "spells.json", champ: "subject", signature: "condition+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "spells.json", champ: "when", signature: "rule", statut: "divergente", strate: "Référence", occurrences: 18, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "stars.json", champ: "ascendant", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 11, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "stars.json", champ: "ops", signature: "char+…", statut: "divergente", strate: "Référence", occurrences: 42, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "stars.json", champ: "ops", signature: "spec,talentId+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-30", motif: "référence de TALENT" },
  { concept: "reference", dataset: "stars.json", champ: "ops", signature: "talentId+…", statut: "divergente", strate: "Référence", occurrences: 11, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "symptoms.json", champ: "ops", signature: "disease+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" }, // la conséquence du cycle vit sous la feuille `EffectOp` du nœud `test` (#1657 B2b)
  { concept: "reference", dataset: "symptoms.json", champ: "ops", signature: "char+…", statut: "divergente", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "symptoms.json", champ: "passive", signature: "char+…", statut: "divergente", strate: "Référence", occurrences: 23, lot: "L3 #1463", date: "2026-08-23" },
  // #1599 : `severePassive` (6, « char+… ») est mort — les passifs s'indexent PAR PALIER
  // (`passiveBySeverity`), et le scan nomme le champ PORTEUR : `moderee` (Convulsions −20, LDB 20
  // l.157) et `grave` (Fièvre : le seul État *Inconscient*, LDB 20 l.170). Aucune ligne « char+… »
  // sous `grave` : le palier S'AJOUTE à `passive`, il ne recopie pas ses −10.
  { concept: "reference", dataset: "symptoms.json", champ: "moderee", signature: "char+…", statut: "divergente", strate: "Référence", occurrences: 6, lot: "L3 #1463", date: "2026-09-05" },
  { concept: "reference", dataset: "symptoms.json", champ: "grave", signature: "id+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-09-05" },
  // #1599 : l'État *Exténué* du Malaise (LDB 20 l.188) s'écrit en op `condition` du canal passif.
  { concept: "reference", dataset: "symptoms.json", champ: "passive", signature: "id+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-09-05" },
  { concept: "reference", dataset: "symptoms.json", champ: "visiblePassive", signature: "char+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  // #1599, 2026-09-06 : la fenêtre de Détermination (`resolveWindow.minutes`) lit une règle optionnelle
  // par le terme `{rule}` d'une `Formula` — MÊME graphie que le gate `variants[].when` de
  // `spells.json`/`talents.json` ci-dessus, donc même statut : elle se soldera avec eux.
  { concept: "reference", dataset: "symptoms.json", champ: "minutes", signature: "rule", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-09-06" },
  // 3 → 4 (#1657 B2b) : l'État *Sonné* de l'éclatement du Vers du Reik (MSRC 16 l.142) quitte `onFail`
  // — nom menteur pour un effet CERTAIN — et rejoint les ops sous `ops`.
  { concept: "reference", dataset: "symptoms.json", champ: "ops", signature: "id+…", statut: "divergente", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "symptoms.json", champ: "ops", signature: "traitId+…", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "symptoms.json", champ: "passive", signature: "cible,psychType+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "symptoms.json", champ: "passive", signature: "psychType+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "tables.json", champ: "ops", signature: "arg,traitId+…", statut: "divergente", strate: "Référence", occurrences: 7, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "tables.json", champ: "ops", signature: "char+…", statut: "divergente", strate: "Référence", occurrences: 15, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "tables.json", champ: "ops", signature: "cible,psychType+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "tables.json", champ: "ops", signature: "disease+…", statut: "divergente", strate: "Référence", occurrences: 5, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "tables.json", champ: "ops", signature: "id,value+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "tables.json", champ: "ops", signature: "table+…", statut: "divergente", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "tables.json", champ: "ops", signature: "tableId+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "tables.json", champ: "ops", signature: "talentId+…", statut: "divergente", strate: "Référence", occurrences: 12, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "tables.json", champ: "ops", signature: "tone+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "tables.json", champ: "ops", signature: "traitId+…", statut: "divergente", strate: "Référence", occurrences: 30, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "talents.json", champ: "effects", signature: "condition+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "talents.json", champ: "gate", signature: "value+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "talents.json", champ: "matches", signature: "exceptSpec,skill", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L2 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "talents.json", champ: "ops", signature: "id,value+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "talents.json", champ: "ops", signature: "id+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "talents.json", champ: "ops", signature: "type+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "talents.json", champ: "passive", signature: "talentId+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "talents.json", champ: "when", signature: "rule", statut: "divergente", strate: "Référence", occurrences: 12, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "tavernGames.json", champ: "attrition", signature: "id,value+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "tavernGames.json", champ: "combined", signature: "stopCondition+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traits.json", champ: "amount", signature: "bonusOf", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traits.json", champ: "bonus", signature: "bonusOf", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traits.json", champ: "capabilities", signature: "psychCible+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", motif: "cible d’une ANIMOSITÉ (Groupe du Chaos), jamais une Compétence — la déduction lit `skills.json` par COLLISION d’ids depuis que `savoir` catalogue `nurgle`/`slaanesh` (angle mort déclaré)", date: "2026-08-23" },
  { concept: "reference", dataset: "traits.json", champ: "capabilities", signature: "spellDomainImmunity", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traits.json", champ: "cond", signature: "is+…", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traits.json", champ: "escapeStrength", signature: "charOf", statut: "divergente", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traits.json", champ: "markMutations", signature: "mentalTable,physTable+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traits.json", champ: "of", signature: "value+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traits.json", champ: "ops", signature: "count,ref+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traits.json", champ: "ops", signature: "disease+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traits.json", champ: "ops", signature: "id,unlessCondition,value+…", statut: "divergente", strate: "Référence", occurrences: 5, lot: "L3 #1463", date: "2026-08-23" },
  // +1 (#862) : l'État Exténué du réveil du Désespoir (`onWake`, VDM 09 l.280) — même graphie que ses voisines.
  { concept: "reference", dataset: "traits.json", champ: "ops", signature: "id,value+…", statut: "divergente", strate: "Référence", occurrences: 6, lot: "L3 #1463", date: "2026-08-31" },
  { concept: "reference", dataset: "traits.json", champ: "ops", signature: "id+…", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traits.json", champ: "ops", signature: "op+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traits.json", champ: "ops", signature: "tableId+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traits.json", champ: "ops", signature: "traitId+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traits.json", champ: "passive", signature: "char+…", statut: "divergente", strate: "Référence", occurrences: 21, lot: "L3 #1463", date: "2026-08-23" }, // +1 : Trait Entêté (char force-mentale), EDOC 07 folio 22 (#673)
  { concept: "reference", dataset: "traits.json", champ: "passive", signature: "attackKind,subType+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traits.json", champ: "passive", signature: "mode+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traits.json", champ: "passive", signature: "spec,talentId+…", statut: "divergente", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-30", motif: "référence de TALENT" },
  { concept: "reference", dataset: "traits.json", champ: "passive", signature: "talentId+…", statut: "divergente", strate: "Référence", occurrences: 19, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traits.json", champ: "passive", signature: "terrain+…", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traits.json", champ: "subject", signature: "condition+…", statut: "divergente", strate: "Référence", occurrences: 6, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traits.json", champ: "value", signature: "bonusOf", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traits.json", champ: "value", signature: "charOf", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  // #1690 : `terrains.json › overlayProp` — le décor répété sur chaque tuile d'un terrain. Id NU, forme
  // CIBLE de la grammaire (`idDe('prop')` le refine au parse) ; la mesure classe tout id nu en
  // « historique », la ligne entre donc au dénominateur du lot L3 comme les autres réfs nues.
  { concept: "reference", dataset: "terrains.json", champ: "overlayProp", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  // #1691 : `terrains.json › matiere` — la matière des flancs d'un terrain à BLOC PLEIN. Id NU, forme
  // CIBLE de la grammaire (`idDe('material', 'relief')` le refine au parse) ; même sort que `overlayProp`.
  { concept: "reference", dataset: "terrains.json", champ: "matiere", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "trappings.json", champ: "cond", signature: "value+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "trappings.json", champ: "defaultAmmo", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 9, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "trappings.json", champ: "derivedWeapon", signature: "subType,type+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "trappings.json", champ: "ops", signature: "char+…", statut: "divergente", strate: "Référence", occurrences: 24, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "trappings.json", champ: "ops", signature: "disease+…", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "trappings.json", champ: "ops", signature: "id,value+…", statut: "divergente", strate: "Référence", occurrences: 11, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "trappings.json", champ: "ops", signature: "id+…", statut: "divergente", strate: "Référence", occurrences: 7, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "trappings.json", champ: "ops", signature: "op+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "trappings.json", champ: "ops", signature: "symptomId+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "trappings.json", champ: "ops", signature: "tableId+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "trappings.json", champ: "ops", signature: "talentId+…", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "trappings.json", champ: "ops", signature: "traitId+…", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "trappings.json", champ: "passive", signature: "tone+…", statut: "divergente", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-23" },
  // #1661 : 115 → 120 — les CINQ armes de Taillade (`AA 08 l.136/210/304/364/375`) quittent la spec
  // d'affichage `{id,spec:"1A"}` pour l'Indice `{id,value}` que le moteur LIT (coût en Avantages du 2ᵉ
  // État Hémorragique). Elles rejoignent la forme déjà majoritaire ici : le stock ne croît que du
  // côté où les autres Indices vivent déjà, et la graphie `id,spec` disparaît de ce champ.
  { concept: "reference", dataset: "trappings.json", champ: "qualities", signature: "id,value", statut: "historique", strate: "Référence", occurrences: 120, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "trappings.json", champ: "shape", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 43, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "trappings.json", champ: "siegeRig", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 18, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "trappings.json", champ: "subject", signature: "condition+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "trappings.json", champ: "subType", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 441, lot: "L3 #1463", date: "2026-08-30", motif: "SOUS-TYPE d’objet" },
  { concept: "reference", dataset: "trappings.json", champ: "weaponGroup", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 22, lot: "L3 #1463", date: "2026-08-30", motif: "référence de GROUPE d’armes" },
  { concept: "reference", dataset: "traumas.json", champ: "byProsthesis", signature: "art,trappingId", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traumas.json", champ: "byProsthesis", signature: "trappingId+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traumas.json", champ: "escalade", signature: "versTraumaId+…", statut: "divergente", strate: "Référence", occurrences: 3, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traumas.json", champ: "ops", signature: "char+…", statut: "divergente", strate: "Référence", occurrences: 12, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traumas.json", champ: "ops", signature: "sense,skill+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L2 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traumas.json", champ: "ops", signature: "sense+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traumas.json", champ: "prosthesis", signature: "trappingId+…", statut: "divergente", strate: "Référence", occurrences: 9, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "traumas.json", champ: "rig", signature: "art+…", statut: "divergente", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "vehicles.json", champ: "draft", signature: "count,montureId", statut: "divergente", strate: "Référence", occurrences: 1, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "vehicles.json", champ: "traits", signature: "id,value", statut: "historique", strate: "Référence", occurrences: 2, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "reference", dataset: "voyage-stakes.json", champ: "kind", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 15, lot: "L3 #1463", date: "2026-08-30", motif: "GENRE d’enjeu de voyage" },
  { concept: "reference", dataset: "voyage-stakes.json", champ: "rule", signature: "id-nu", statut: "historique", strate: "Référence", occurrences: 32, lot: "L3 #1463", date: "2026-08-30", motif: "référence de RÈGLE" },
  { concept: "reference", dataset: "water-exposure.json", champ: "auto", signature: "condition+…", statut: "divergente", strate: "Référence", occurrences: 4, lot: "L3 #1463", date: "2026-08-23" },
  { concept: "source", dataset: "creatures.json", champ: "alsoIn", signature: "book,page+…", statut: "divergente", strate: "Valeur", occurrences: 2, lot: "L1d #1469", date: "2026-08-23" }, // +2 : alsoIn posés par e89a836d3 (C1 #1457, folios ZI) sans leur ligne de stock — sillage relevé 2026-09-01
  { concept: "source", dataset: "domains.json", champ: "alsoIn", signature: "book,page+…", statut: "divergente", strate: "Valeur", occurrences: 6, lot: "L1d #1469", date: "2026-08-23" },
  { concept: "source", dataset: "naval-traits.json", champ: "alsoIn", signature: "book,page+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L1d #1469", date: "2026-08-23" },
  { concept: "source", dataset: "progression-schemas.derived.json", champ: "schemas", signature: "book,page+…", statut: "divergente", strate: "Valeur", occurrences: 111, lot: "L1d #1469", date: "2026-09-01" }, // le folio inventait son nom : la bande dit `page` comme toute réf de source (#1463 L-gram-4)
  { concept: "source", dataset: "qualities.json", champ: "alsoIn", signature: "book,page+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L1d #1469", date: "2026-08-23" },
  { concept: "source", dataset: "skills.json", champ: "alsoIn", signature: "book,note,page+…", statut: "divergente", strate: "Valeur", occurrences: 2, lot: "L1d #1469", date: "2026-08-23" },
  { concept: "source", dataset: "species.json", champ: "alsoIn", signature: "book,page+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L1d #1469", date: "2026-08-23" }, // +1 : idem e89a836d3 (species norses)
  { concept: "source", dataset: "spells.json", champ: "alsoIn", signature: "book,page+…", statut: "divergente", strate: "Valeur", occurrences: 46, lot: "L1d #1469", date: "2026-08-23" },
  { concept: "source", dataset: "talents.json", champ: "alsoIn", signature: "book,page+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L1d #1469", date: "2026-08-23" },
  { concept: "source", dataset: "traits.json", champ: "alsoIn", signature: "book,page+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L1d #1469", date: "2026-08-23" },
  { concept: "source", dataset: "trappings.json", champ: "alsoIn", signature: "book,page+…", statut: "divergente", strate: "Valeur", occurrences: 8, lot: "L1d #1469", date: "2026-08-23" },
  { concept: "test", dataset: "arcane-phenomena.json", champ: "controlFlux", signature: "difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "arene-projet.json", champ: "test", signature: "difficulty,skill+…", statut: "divergente", strate: "Valeur", occurrences: 9, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "criticals.json", champ: "amputation", signature: "difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 26, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "criticals.json", champ: "loss", signature: "difficulty", statut: "divergente", strate: "Valeur", occurrences: 2, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "criticals.json", champ: "test", signature: "difficulty,skill", statut: "historique", strate: "Valeur", occurrences: 39, lot: "L4 #1463", date: "2026-08-23" }, // 1 → 39, et la forme `difficulty` SEULE (38) MEURT (#1657 B3-1) : un nœud qui ne nommait pas sa Compétence laissait le moteur la recalculer à la main — les 38 rangées adoptent celle que leur `desc` verbatim exige
  { concept: "test", dataset: "etats.json", champ: "difficultyBy", signature: "difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 2, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "etats.json", champ: "test", signature: "difficulty,skill+…", statut: "divergente", strate: "Valeur", occurrences: 2, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "incidents-monture.json", champ: "riderTest", signature: "char,difficulty,skill+…", statut: "divergente", strate: "Valeur", occurrences: 2, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "land-cargo.json", champ: "gossip", signature: "difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "loup-et-saumure-projet.json", champ: "effect", signature: "difficulty,skill+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "loup-et-saumure-projet.json", champ: "test", signature: "difficulty,skill+…", statut: "divergente", strate: "Valeur", occurrences: 2, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "maladies.json", champ: "test", signature: "difficulty,skill", statut: "historique", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-09-03" }, // la forme `difficulty` SEULE meurt (#1657 B3-3) : le Test quotidien de la Pneumonie NOMME sa Compétence (« Test de Résistance Intermédiaire (+0) », EDOC 08 l.104) — même graphie que `criticals.json`/`spells.json`, la porte n'a plus à recalculer la valeur à la main (#1685)
  { concept: "test", dataset: "maneuvers.json", champ: "test", signature: "difficulty,skill", statut: "historique", strate: "Valeur", occurrences: 2, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "miscast.json", champ: "test", signature: "characteristic,difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 2, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "miscast.json", champ: "test", signature: "difficulty,skill+…", statut: "divergente", strate: "Valeur", occurrences: 13, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "psychology.json", champ: "test", signature: "difficulty,skill", statut: "historique", strate: "Valeur", occurrences: 7, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "river-criticals.json", champ: "test", signature: "characteristic,difficulty", statut: "historique", strate: "Valeur", occurrences: 2, lot: "L4 #1463", date: "2026-08-23" }, // le coup à l'équipage (MSRC 07 l.78/l.94) quitte la graphie propriétaire `crewTest {char, difficulty, onFail}` pour le nœud `test` du Flow (#1657 B2c) — `char` → `characteristic`, la clé de `flowTestSchema`
  { concept: "test", dataset: "river-navigation.json", champ: "rowingAgility", signature: "difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "river-navigation.json", champ: "temporaryRepair", signature: "difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "sea-cargo.json", champ: "producesGossip", signature: "difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "sea-cargo.json", champ: "surplusGossip", signature: "difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "sea-cargo.json", champ: "test", signature: "difficulty,skill+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "sea-events.json", champ: "params", signature: "difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 3, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "sea-navigation.json", champ: "epuisement", signature: "difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "sea-perils.json", champ: "evasion", signature: "difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 5, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "sea-perils.json", champ: "freeTest", signature: "char,difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "sea-perils.json", champ: "tourbillonSwim", signature: "difficulty,skill+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "sea-weather.json", champ: "affaler", signature: "difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "ship-criticals.json", champ: "test", signature: "difficulty,skill", statut: "historique", strate: "Valeur", occurrences: 12, lot: "L4 #1463", date: "2026-08-23" }, // « Canon détaché » (MDG 13 l.763) : même passage au nœud `test` du Flow (#1657 B2c). 1 → 7 (#1657 B3-2b-a) : les 6 nœuds MDG neufs testent l'Athlétisme de leur `note` verbatim. 7 → 12 (#1657 B3-2b-c) : les 5 rangées du GRÉEMENT (MDG 13 l.711/714/715/717/718) testent le leur
  { concept: "test", dataset: "spells.json", champ: "crossTest", signature: "characteristic,difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 2, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "spells.json", champ: "test", signature: "characteristic,difficulty", statut: "historique", strate: "Valeur", occurrences: 5, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "spells.json", champ: "test", signature: "characteristic,difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 3, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "spells.json", champ: "test", signature: "difficulty,skill", statut: "historique", strate: "Valeur", occurrences: 25, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "spells.json", champ: "test", signature: "difficulty,skill+…", statut: "divergente", strate: "Valeur", occurrences: 8, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "steam-breakdown.json", champ: "restart", signature: "difficulty,skill", statut: "historique", strate: "Valeur", occurrences: 4, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "steam-breakdown.json", champ: "restart", signature: "char,difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 2, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "symptoms.json", champ: "test", signature: "characteristic,difficulty", statut: "historique", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-09-03" }, // le ver de carie NOMME sa caractéristique (« Test d'Endurance Accessible (+20) », MSRC 16 l.90) — #1657 B3-3
  { concept: "test", dataset: "symptoms.json", champ: "test", signature: "characteristic,difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  // Les 3 cycles à jet quittent la graphie propriétaire `onTick {difficulty, onFail}` pour le nœud
  // `test` du Flow (#1657 B2b) : le champ mesuré devient `test`, la signature l'exacte `difficulty`
  // du `flowTestSchema` — la MÊME que `criticals.json | test` depuis B2a.
  { concept: "test", dataset: "symptoms.json", champ: "test", signature: "difficulty,skill", statut: "historique", strate: "Valeur", occurrences: 2, lot: "L4 #1463", date: "2026-09-03" }, // Blessé et Toxine NOMMENT leur Compétence (« Test de Résistance », LDB 20 l.145/l.212) — #1657 B3-3 ; la forme `difficulty` SEULE (3) meurt, répartie en 2 + 1 (ver de carie, caractéristique)
  { concept: "test", dataset: "talents.json", champ: "test", signature: "characteristic,difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "talents.json", champ: "test", signature: "difficulty,skill", statut: "historique", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "talents.json", champ: "test", signature: "difficulty,skill+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "tavernGames.json", champ: "options", signature: "char,difficulty", statut: "historique", strate: "Valeur", occurrences: 3, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "tavernGames.json", champ: "options", signature: "difficulty,skill", statut: "historique", strate: "Valeur", occurrences: 3, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "tavernGames.json", champ: "options", signature: "difficulty,skill+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "tavernGames.json", champ: "rows", signature: "difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 7, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "tavernGames.json", champ: "throwerPenalty", signature: "difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "traits.json", champ: "test", signature: "characteristic,difficulty", statut: "historique", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "traits.json", champ: "test", signature: "characteristic,difficulty,skill+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "traits.json", champ: "test", signature: "characteristic,difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "trappings.json", champ: "test", signature: "characteristic,difficulty,skill+…", statut: "divergente", strate: "Valeur", occurrences: 3, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "trappings.json", champ: "test", signature: "characteristic,difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 2, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "trappings.json", champ: "test", signature: "difficulty,skill+…", statut: "divergente", strate: "Valeur", occurrences: 6, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "water-exposure.json", champ: "test", signature: "difficulty,skill", statut: "historique", strate: "Valeur", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "weather.json", champ: "resistanceTest", signature: "difficulty+…", statut: "divergente", strate: "Valeur", occurrences: 2, lot: "L4 #1463", date: "2026-08-23" },
  { concept: "test", dataset: "domains.json", champ: "test", signature: "difficulty,skill", statut: "historique", strate: "Valeur", occurrences: 2, lot: "L4 #1463", date: "2026-08-23" },
];

/** Clé RÉSERVÉE à un concept portant ≥ 2 classes de type dans la donnée (#1463 S2) : le nom ne dit
 *  plus le type. Se solde en RENOMMANT les emplois qui ne sont pas le concept (`advancementCosts`
 *  → `coutCarac`/`coutCompetence`, `wineQuality.price` → `facteur`). */
/** Clés DÉCLARÉES par un schéma zod et portées par AUCUNE entrée du JSON, SANS lot de
 *  peuplement : le schéma est plus large que la donnée (un champ à retirer, ou une donnée à
 *  écrire). Le régime OPPOSÉ — déclaré-avant-posé ASSUMÉ, avec son lot de peuplement — s'appelle
 *  `cible-declaree` et ne se stocke PAS : il s'ÉMET (`docs/structures-donnees.md` §2.4 table B,
 *  `LOTS_DE_PEUPLEMENT`), parce qu'un stock DÉCROÎT là où une cible se solde en PEUPLANT. */
export const STRUCTURES_DEFAUT = [
  { dataset: "actions.json", cle: "blocked", date: "2026-08-26" },
  { dataset: "activities.json", cle: "char", date: "2026-08-26" },
  { dataset: "maneuvers.json", cle: "priority", date: "2026-08-26" },
  { dataset: "merchants.json", cle: "buyMarkup", date: "2026-08-26" },
  { dataset: "merchants.json", cle: "restockDays", date: "2026-08-26" },
  { dataset: "pregens.json", cle: "age", date: "2026-08-26" },
  { dataset: "pregens.json", cle: "weaponChoice", date: "2026-08-26" },
  { dataset: "psychology.json", cle: "gating", date: "2026-08-26" },
  { dataset: "raceAppearance.json", cle: "armD", date: "2026-08-26" },
  { dataset: "raceAppearance.json", cle: "armG", date: "2026-08-26" },
  { dataset: "raceAppearance.json", cle: "scale", date: "2026-08-26" },
  { dataset: "materials.json", cle: "fasciaThickM", date: "2026-08-26" },
  { dataset: "structureAppearance.json", cle: "bayPanel", date: "2026-08-26" },
  { dataset: "structureAppearance.json", cle: "relief", date: "2026-08-26" },
  { dataset: "tavernGames.json", cle: "fastSkill", date: "2026-08-26" },
  { dataset: "traits.json", cle: "appearance", date: "2026-08-26" },
  // `variants` reste une DÉCLARATION du def, pas une clé posée d'office : la fabrique ne l'ajoute
  // qu'aux documents qui la DEMANDENT (`options.variantes`). Mesuré au 2026-08-28 : 3 defs
  // l'activent — `spells` (18 entrées porteuses), `talents` (12), `traits` (0/131). La dette de
  // `traits.json` est donc INCHANGÉE par l'adoption de `document()` : son schéma reste plus large
  // que sa donnée, et la ligne se solde en retirant l'option ou en écrivant une variante.
  { dataset: "traits.json", cle: "variants", date: "2026-08-26" },
  { dataset: "trappings.json", cle: "requiresMastery", date: "2026-08-26" },
  // `activeAxes` : liste d'axes actifs déclarée par le schéma de projet et portée par 0 des 4 projets
  // committés. `auteur` : champ d'identité de campagne (#766), optionnel, qu'AUCUN des 4 ne porte non
  // plus (ils sont tous de première main). Même nature pour les 8 lignes — le schéma est plus large
  // que sa donnée — et même solde : retirer le champ, ou l'écrire.
  { dataset: "arene-projet.json", cle: "activeAxes", date: "2026-08-26" },
  { dataset: "barge-du-sel-projet.json", cle: "activeAxes", date: "2026-08-26" },
  { dataset: "diligence-projet.json", cle: "activeAxes", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", cle: "activeAxes", date: "2026-08-26" },
  { dataset: "arene-projet.json", cle: "auteur", date: "2026-08-28" },
  { dataset: "barge-du-sel-projet.json", cle: "auteur", date: "2026-08-28" },
  { dataset: "diligence-projet.json", cle: "auteur", date: "2026-08-28" },
  { dataset: "loup-et-saumure-projet.json", cle: "auteur", date: "2026-08-28" },
];

/** Nom du lexique porté par PLUSIEURS classes de valeur à la fois (#1463 S2 : un nom de concept est
 *  réservé à son type) : une ligne disparaît quand le nom ne porte plus qu'UNE classe.
 *  `cost` est sorti au L-monnaie-4 (2026-09-01) : les 55 coûts du Tour (`actions.json` → `coutAction`),
 *  les 21 barèmes d'installation navale (→ `installation`), les 6 paliers de prothèse (→ `px`, LDB 73
 *  l.19/23), le coût d'Avantage d'une réaction de défense (→ `avantage`) et les deux coûts d'Avantage du
 *  Flow (→ `advantageCost` / `advantageOrMovement`, le vocabulaire de `ManeuverDef.advantageCost`) ont
 *  rendu le nom ; il ne reste que les 8 vrais montants de scène, donc une seule classe.
 *  `price` NE PEUT PAS sortir par le même geste, et sa ligne se tient ICI plutôt que dans un rendu
 *  (refus MOTIVÉ, #1463 L-monnaie-4) : `null` (×46) et la marque `'ND'` (×3) SONT la colonne Prix telle
 *  que le livre l'imprime, admises à la source unique de conversion (`priceToMoney`, `src/engine/money.ts`) ;
 *  les curer serait inventer un montant. La seule classe encore réductible est `number` (×6,
 *  `land-cargo.json wineQuality[].price`), qui n'est pas un prix mais un FACTEUR — son solde est déjà
 *  prescrit hors de cette vague. La ligne se RÉÉCRIT donc au fil des lots, elle ne se retire pas. */
export const STRUCTURES_HOMONYMES = [
  { cle: "char", classes: ["object","string"], occurrences: 863, lot: "L4 #1463", date: "2026-08-23" }, // +3 : profils vides Mouton + Cochon (object) + Trait Entêté (string), EDOC 07 folios 22 et 24 (#673) ; +1 : Chien de trait, EDOC 07 folio 22, #673 ; −2 (#1657 B2c) : les 2 `crewTest.char` de `river-criticals.json` adoptent `characteristic`, la clé de `flowTestSchema` (le fichier en sort avec ZERO `char` — pas d'état mixte, #1658)
  { cle: "price", classes: ["null","number","object","string"], occurrences: 520, lot: "L4 #1463", date: "2026-08-23" }, // +1 : Anneau d'Opsianon, EDO 11 folio 148 (#672) ; +3 : achat Chien + Mouton + Cochon, EDOC 07 folio 24 (#673) ; +1 : Chien de trait, EDOC 07 folio 22, #673
  { cle: "count", classes: ["number","object"], occurrences: 92, lot: "L4 #1463", date: "2026-08-23" },
];

/** Littéral d'objet zod d'un `defs/*.ts` qui REDÉCLARE localement un concept du lexique (ou la
 *  signature exacte d'un littéral de la grammaire, `src/data/schemas/grammaire/`). Keyé par `def | champ | concept | signature` :
 *  sans le CHAMP, 13 lignes agrégeaient 2 à 4 champs distincts. Pas de numéro de ligne ici : une
 *  ligne bouge à chaque édition du def et ferait rougir la garde sans qu'aucune structure n'ait
 *  changé — le `fichier:ligne` vit dans `docs/structures-donnees.md` §4, régénéré à chaque build.
 *  `oups.ts | plage` NE PEUT PAS sortir par le geste des autres bandes, et sa ligne se tient ICI
 *  plutôt que dans un rendu (refus MOTIVÉ, patron `price` ci-dessus, #1463 L-gram-1) : le dataset
 *  porte les 7 bandes d100 du Tableau des Oups ! ET l'Incident de Tir, section DISTINCTE du livre
 *  (`LDB 14 l.21-30` / `l.32-34`), qui n'a AUCUNE borne. Ses deux bornes sont donc OPTIONNELLES,
 *  disjointes par un refine ⟺ — composer `plageSchema` (bornes REQUISES) rendrait la donnée
 *  invalide, et `bornesSchema` dirait un RÉGLAGE là où le lexique a séparé `plage` et `bornes`. La
 *  ligne sort quand `misfire` sort du dataset : c'est la question #1544 (découpage produit), pas une
 *  adoption de forme. */
export const STRUCTURES_REDECLARATIONS = [
  { def: "activities.ts", champ: "", concept: "test", signature: "char,difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "arcane-phenomena.ts", champ: "controlFlux", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "criticals.ts", champ: "", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "criticals.ts", champ: "loss", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "etats.ts", champ: "", concept: "test", signature: "characteristic,difficulty,skill+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "land-cargo.ts", champ: "gossip", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "miscast.ts", champ: "", concept: "", signature: "bonusOf", statut: "hors lexique", commun: "formulaSchema", occurrences: 1, lot: "L1a #1466", date: "2026-08-23" },
  { def: "miscast.ts", champ: "", concept: "", signature: "charOf", statut: "hors lexique", commun: "formulaSchema", occurrences: 1, lot: "L1a #1466", date: "2026-08-23" },
  { def: "miscast.ts", champ: "", concept: "", signature: "dice", statut: "hors lexique", commun: "prixTireSchema", occurrences: 1, lot: "L1a #1466", date: "2026-08-23" }, // `commun` recalé au 2026-09-01 (#1463 L-gram-3) : le littéral `{dice}` de la grammaire que le scan nomme est désormais `prixTireSchema` — MÊME signature, même ligne, aucun déplacement de porteur
  { def: "miscast.ts", champ: "", concept: "", signature: "engagedAdvantageGap", statut: "hors lexique", commun: "formulaSchema", occurrences: 1, lot: "L1a #1466", date: "2026-08-23" },
  { def: "miscast.ts", champ: "", concept: "", signature: "indiceOf", statut: "hors lexique", commun: "formulaSchema", occurrences: 1, lot: "L1a #1466", date: "2026-08-23" },
  { def: "miscast.ts", champ: "", concept: "", signature: "rolled", statut: "hors lexique", commun: "formulaSchema", occurrences: 1, lot: "L1a #1466", date: "2026-08-23" },
  { def: "miscast.ts", champ: "", concept: "", signature: "stacks", statut: "hors lexique", commun: "formulaSchema", occurrences: 1, lot: "L1a #1466", date: "2026-08-23" },
  { def: "miscast.ts", champ: "", concept: "formule", signature: "sum", statut: "cible", commun: "formulaSchema", occurrences: 1, lot: "L1a #1466", date: "2026-09-01" },
  { def: "miscast.ts", champ: "", concept: "", signature: "times", statut: "hors lexique", commun: "formulaSchema", occurrences: 1, lot: "L1a #1466", date: "2026-08-23" },
  { def: "miscast.ts", champ: "", concept: "", signature: "woundsDealt", statut: "hors lexique", commun: "formulaSchema", occurrences: 1, lot: "L1a #1466", date: "2026-08-23" },
  { def: "miscast.ts", champ: "", concept: "test", signature: "characteristic,difficulty,skill+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "miscast.ts", champ: "times", concept: "", signature: "factor,of", statut: "hors lexique", commun: "formulaSchema", occurrences: 1, lot: "L1a #1466", date: "2026-08-23" },
  { def: "oups.ts", champ: "", concept: "plage", signature: "max,min+…", statut: "cible", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "psychology.ts", champ: "test", concept: "test", signature: "difficulty,skill", statut: "historique", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "raceAppearance.ts", champ: "eyes", concept: "", signature: "D,G", statut: "hors lexique", commun: "entityAppearanceSchema", occurrences: 1, lot: "L1a #1466", date: "2026-08-23" },
  { def: "raceAppearance.ts", champ: "parts", concept: "", signature: "cheveux,visage", statut: "hors lexique", commun: "entityAppearanceSchema", occurrences: 1, lot: "L1a #1466", date: "2026-08-23" },
  { def: "river-navigation.ts", champ: "rowingAgility", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "river-navigation.ts", champ: "temporaryRepair", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "sea-cargo.ts", champ: "producesGossip", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "sea-cargo.ts", champ: "surplusGossip", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "sea-cargo.ts", champ: "test", concept: "test", signature: "difficulty,skill+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "sea-navigation.ts", champ: "epuisement", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "sea-perils.ts", champ: "evasion", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "sea-perils.ts", champ: "freeTest", concept: "test", signature: "char,difficulty,skill+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "sea-perils.ts", champ: "tourbillonSwim", concept: "test", signature: "difficulty,skill+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "sea-weather.ts", champ: "affaler", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "spells.ts", champ: "", concept: "", signature: "kind", statut: "hors lexique", commun: "conditionSchema", occurrences: 5, lot: "L1a #1466", date: "2026-08-23" },
  { def: "steam-breakdown.ts", champ: "restart", concept: "test", signature: "char,difficulty,skill+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "talents.ts", champ: "max", concept: "", signature: "bonusOf", statut: "hors lexique", commun: "formulaSchema", occurrences: 1, lot: "L1a #1466", date: "2026-08-23" },
  { def: "tavernGames.ts", champ: "options", concept: "test", signature: "char,difficulty,skill+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "tavernGames.ts", champ: "rows", concept: "plage", signature: "max,min+…", statut: "cible", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-09-01" },
  { def: "tavernGames.ts", champ: "throwerPenalty", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "water-exposure.ts", champ: "", concept: "", signature: "kind,op,value", statut: "hors lexique", commun: "conditionSchema", occurrences: 2, lot: "L1a #1466", date: "2026-08-23" },
  { def: "water-exposure.ts", champ: "test", concept: "test", signature: "difficulty,skill", statut: "historique", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "weather.ts", champ: "resistanceTest", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
];

/** Une divergence d'ENVELOPPE de document encore observée (strate Document). Quatre motifs :
 *  `clé divergente` (le rôle est porté sous un autre nom que sa cible), `type divergent` (la clé
 *  cible est là, sa classe de type ne l'est pas), `clé absente` (une ENTRÉE DE RACINE ne porte
 *  nulle part la clé cible d'un rôle requis — `id`, `type` et `source` partout, `label` sur les
 *  familles `entité`/`table` — ni l'alternative que le rôle déclare : `maison` pour `source`),
 *  `cible partielle` (un rôle `entiere` porté par une PARTIE des entrées du groupe, portée
 *  EMBARQUÉE comprise). Hors rôle `entiere`, un document EMBARQUÉ n'est jamais sommé de porter un
 *  `id` : on n'y compte que les clés DIVERGENTES. `chemin` = `(entrées)` pour les entrées du
 *  document, le chemin du document embarqué sinon. Rôles, cibles, alternatives et graphies
 *  divergentes sont au lexique (`ROLES_ENVELOPPE`). */
export const STRUCTURES_ENVELOPPE = [
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "ambiance.json", chemin: "(entrées)", entrees: 1, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "arcane-phenomena.json", chemin: "(entrées)", entrees: 1, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "books.json", chemin: "(entrées)", entrees: 29, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "breath-types.json", chemin: "(entrées)", entrees: 6, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "calendarPhases.json", chemin: "(entrées)", entrees: 7, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "crew-test-types.json", chemin: "(entrées)", entrees: 1, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "damage-types.json", chemin: "(entrées)", entrees: 4, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "details.json", chemin: "(entrées)", entrees: 1, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "disponibilite.json", chemin: "(entrées)", entrees: 1, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "donnees.manifest.json", chemin: "(entrées)", entrees: 1, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "groups.json", chemin: "(entrées)", entrees: 38, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "land-cargo.json", chemin: "(entrées)", entrees: 1, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "lieux-services.json", chemin: "(entrées)", entrees: 7, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "lightLevels.json", chemin: "(entrées)", entrees: 5, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "lightTones.json", chemin: "(entrées)", entrees: 4, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "localisation.json", chemin: "(entrées)", entrees: 1, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "mass-battle.json", chemin: "(entrées)", entrees: 1, lot: "L1d #1469", date: "2026-08-23" },
  // #1443 : `materials.json`, dataset app-owned de rendu. Même classe que `lightTones.json`
  // ci-dessus (aucune page de livre ne décrit une couleur de matière) : le lot L1d tranche la forme
  // de `source` d'un document maison pour les deux à la fois. TROIS lignes → UNE (#1686 lot 2, les
  // catalogues `prop`/`roof`/`relief` fusionnent) ; 8 + 4 + 4 = 16 entrées, inchangées. Deltas des
  // trois lignes d'origine, repris ici : +1 : albatre, matière de l'urne (#1644) [prop] ;
  // −2 : riser, sol-inconnu — 0 consommateur, purgés (#1540) [relief].
  // 16 → 15 (#1715) : −1 : plafond — 0 émetteur mesuré (le dessous d'un surplomb est une dalle
  // `deck`), purgé [relief].
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "materials.json", chemin: "(entrées)", entrees: 15, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "merchantFamilies.json", chemin: "(entrées)", entrees: 7, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "merchants.json", chemin: "(entrées)", entrees: 6, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "names.json", chemin: "(entrées)", entrees: 7, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "naval-progression.json", chemin: "(entrées)", entrees: 1, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "pregens.json", chemin: "(entrées)", entrees: 8, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "primitives.manifest.json", chemin: "(entrées)", entrees: 62, lot: "L1d #1469", date: "2026-08-23" }, // 30 → 62 (#1728) : les entrées de la table CLAUDE.md sont portées au manifeste, de la MÊME forme que les 30 autres — primitives EXISTANTES, aucune donnée neuve (manifeste d'outillage maison, aucune page de livre ne le décrit)
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "progression-schemas.derived.json", chemin: "(entrées)", entrees: 1, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "qualitySubtypes.json", chemin: "(entrées)", entrees: 3, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "qualityTypes.json", chemin: "(entrées)", entrees: 2, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "raceAppearance.json", chemin: "(entrées)", entrees: 21, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "raw.manifest.json", chemin: "(entrées)", entrees: 11, lot: "L1d #1469", date: "2026-08-23" }, // +1 : dette « Option Attraper Froid » (mue pneumonie), EDOC 09 (#674) ; +1 : dette de la Colère des dieux, LDB 40 (#1653) ; +1 : dette du sabre, AA 08 l.190 (#1661)
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "renduMonte.json", chemin: "(entrées)", entrees: 1, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "river-perils.json", chemin: "(entrées)", entrees: 1, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "sea-cargo.json", chemin: "(entrées)", entrees: 1, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "sea-events.json", chemin: "(entrées)", entrees: 1, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "sea-navigation.json", chemin: "(entrées)", entrees: 1, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "sea-perils.json", chemin: "(entrées)", entrees: 1, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "sea-weather.json", chemin: "(entrées)", entrees: 1, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "ship-construction.json", chemin: "(entrées)", entrees: 1, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "sizes.json", chemin: "(entrées)", entrees: 1, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "speciesRace.json", chemin: "(entrées)", entrees: 1, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "structureAppearance.json", chemin: "(entrées)", entrees: 18, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "systemes.manifest.json", chemin: "(entrées)", entrees: 16, lot: "L1d #1469", date: "2026-08-23" },
  { role: "source", cle: "source", motif: "clé absente", detail: "", document: "weather.json", chemin: "(entrées)", entrees: 1, lot: "L1d #1469", date: "2026-08-23" },
];

/** Objet qui ANNONCE une référence (clé `…Id`/`…Ids`/`…Ref`, clé réservée, clé d'identité) et qui
 *  ne résout vers RIEN, sans être un document ni une op : HORS STRATE. `L1a #1466` quand le NOM de
 *  la clé annonçait une FK (`clé de référence non résolue`) — branche VIDE à ce jour, 0 ligne —,
 *  `#1553` sinon. CE QUE LE MOTIF DIT, ligne à ligne (mesuré 2026-09-01, #1633) : `clé réservée`
 *  95 lignes / 406 occurrences, `identité non résolue` 2 / 2. Ces comptes sont DÉRIVÉS des lignes
 *  ci-dessous — la garde `src/data/plage-bornes-contrat.test.ts` (sonde D) les recalcule et exige
 *  que cet en-tête les CITE, elle ne les compare plus à un littéral recopié. Le motif `clé
 *  réservée` ne décrit PAS une valeur qui pointerait vers rien — le déclencheur est le NOM
 *  (`CLES_RESERVEES` du lexique : skill, char, talent, price, cost, count, source), et le contenu
 *  est légitime : `source` à lui seul déclenche 64 des 95 lignes (145 occurrences), qui portent de
 *  vraies références de livre. Il se solde donc au VOCABULAIRE (#1463 S2 : un nom de concept est
 *  réservé à son type), jamais en curant un contenu. Les 97 lignes de ce volet ne sont pas du
 *  ressort de `L1b #1467`, dont le dénominateur (205) les comptait ; elles portent leur lot ligne
 *  à ligne. */
export const STRUCTURES_ORPHELINES = [
  { dataset: "arcane-phenomena.json", champ: "niMods", signature: "delta,desc,scope,source", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "arcane-phenomena.json", champ: "niMods", signature: "desc,divide,round,scope,source", motif: "clé réservée", occurrences: 2, lot: "#1553", date: "2026-08-23" },
  { dataset: "arcane-phenomena.json", champ: "overcastPerSpell", signature: "desc,dice,source", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "arcane-phenomena.json", champ: "refractedWindsOnly", signature: "desc,source", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "arcane-phenomena.json", champ: "saturation", signature: "blocksPropagation,desc,source", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "arcane-phenomena.json", champ: "saturation", signature: "desc,levels,source", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "arcane-phenomena.json", champ: "saturation", signature: "desc,levelsPerMonth,source", motif: "clé réservée", occurrences: 3, lot: "#1553", date: "2026-08-23" },
  { dataset: "arcane-phenomena.json", champ: "saturation", signature: "desc,levelsPerYear,source", motif: "clé réservée", occurrences: 2, lot: "#1553", date: "2026-08-23" },
  { dataset: "arcane-phenomena.json", champ: "saturation", signature: "desc,levelsPerYear,source,whenOffLine", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "arcane-phenomena.json", champ: "saturation", signature: "desc,preventsJonctionSaturee,source", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "arcane-phenomena.json", champ: "saturation", signature: "desc,source,viaGrandVortex", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "arcane-phenomena.json", champ: "stonePropertySlots", signature: "desc,max,source", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "arcane-phenomena.json", champ: "testMods", signature: "desc,dr,drDie,drMax,source,tests", motif: "clé réservée", occurrences: 2, lot: "#1553", date: "2026-08-23" },
  { dataset: "arcane-phenomena.json", champ: "testMods", signature: "desc,dr,drMax,maison,scope,source,tests", motif: "clé réservée", occurrences: 2, lot: "#1553", date: "2026-08-23" },
  { dataset: "arcane-phenomena.json", champ: "testMods", signature: "desc,dr,drMax,maison,source,tests", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "arcane-phenomena.json", champ: "testMods", signature: "desc,dr,drMax,source,tests", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "arcane-phenomena.json", champ: "testMods", signature: "desc,dr,scope,source,tests", motif: "clé réservée", occurrences: 12, lot: "#1553", date: "2026-08-23" },
  { dataset: "arcane-phenomena.json", champ: "testMods", signature: "desc,dr,scope,source,tests,windRestricted", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "arcane-phenomena.json", champ: "testMods", signature: "desc,dr,source,tests", motif: "clé réservée", occurrences: 8, lot: "#1553", date: "2026-08-23" },
  { dataset: "arene-projet.json", champ: "acts", signature: "act,cost", motif: "clé réservée", occurrences: 5, lot: "#1553", date: "2026-08-23" },
  { dataset: "arene-projet.json", champ: "choices", signature: "cost,flow,icon,label", motif: "clé réservée", occurrences: 2, lot: "#1553", date: "2026-08-23" },
  { dataset: "arene-projet.json", champ: "statblock", signature: "char,label,size,traits,type", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "arene-projet.json", champ: "statblock", signature: "char,label,traits,type", motif: "clé réservée", occurrences: 2, lot: "#1553", date: "2026-08-23" },
  { dataset: "barge-du-sel-projet.json", champ: "statblock", signature: "char,label,skills,type", motif: "clé réservée", occurrences: 4, lot: "#1553", date: "2026-08-23" },
  // 28 → 25 (#1463 L-ref-1) : « Chiffon » et les 6 « Carreaux » sont partis en `{id, count}` ; les 4
  // dotations comptées que la mesure classait `count,text (résolvable)` (ligne morte du stock des
  // FORMES) entrent ici — le `count,text` qui reste est du narratif compté, `noble-2 › {count:{fixed:4},
  // text:"Employé de maison"}`.
  { dataset: "careerLevels.json", champ: "trappings", signature: "count,text", motif: "clé réservée", occurrences: 25, lot: "#1553", date: "2026-08-23" },
  { dataset: "classes.json", champ: "trappings", signature: "count,text", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "creatures.json", champ: "purchase", signature: "availability,price", motif: "clé réservée", occurrences: 14, lot: "#1553", date: "2026-08-23" }, // +3 : achat Chien + Mouton + Cochon, EDOC 07 folio 24 (#673) ; +1 : Chien de trait, EDOC 07 folio 22, #673
  { dataset: "crew-roles.json", champ: "wage", signature: "daily,source,weekly", motif: "clé réservée", occurrences: 2, lot: "#1553", date: "2026-08-23" },
  { dataset: "details.json", champ: "texts", signature: "age,ambitionLong,ambitionShort,nom,taille", motif: "identité non résolue", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "disponibilite.json", champ: "barterRatios", signature: "give,ratios,source", motif: "clé réservée", occurrences: 4, lot: "#1553", date: "2026-08-23" },
  { dataset: "disponibilite.json", champ: "dispoPct", signature: "availability,pct,source", motif: "clé réservée", occurrences: 2, lot: "#1553", date: "2026-08-23" },
  { dataset: "domains.json", champ: "cancelledBy", signature: "circumstance,desc,requiresSkill,source,sustained,test", motif: "clé réservée", occurrences: 2, lot: "#1553", date: "2026-08-23" },
  { dataset: "domains.json", champ: "windModifiers", signature: "cancelledBy,desc,dr,source,tests", motif: "clé réservée", occurrences: 2, lot: "#1553", date: "2026-08-23" },
  // 17 → 19 (#1715, 2026-09-09) : AUCUNE donnée neuve. Les circonstances de `when` sont désormais un
  // vocabulaire FERMÉ (`domainCircumstanceSchema`, `defs/domains.ts`) — elles n'ouvrent plus de
  // référence, et les 2 rangs qui résolvaient par HOMONYMIE (`tour`, `middenheim`) rejoignent leurs 17
  // sœurs sous la signature commune.
  { dataset: "domains.json", champ: "windModifiers", signature: "desc,dr,source,tests,when", motif: "clé réservée", occurrences: 19, lot: "#1553", date: "2026-08-23" },
  { dataset: "etats.json", champ: "of", signature: "id,kind,who", motif: "identité non résolue", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "land-cargo.json", champ: "buy", signature: "availabilityMultiplier,merchantSkill,minEnc,partialSurchargePct,source,wineAlcoholResistThreshold,wineEvalDifficulty,wineEvalEasyDifficulty", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "land-cargo.json", champ: "sell", signature: "commerceBonus,dumpingPctOfBase,offerByRichesse,source,targetPerSize", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "localisation.json", champ: "personnage", signature: "shapes,source", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "loup-et-saumure-projet.json", champ: "statblock", signature: "char,label,skills,type", motif: "clé réservée", occurrences: 8, lot: "#1553", date: "2026-08-23" },
  { dataset: "river-navigation.json", champ: "capsize", signature: "removeSailDifficulty,rightCumulativePenalty,rightDifficulty,source", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "river-navigation.json", champ: "echouage", signature: "hullDamage,source", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "river-navigation.json", champ: "outOfControl", signature: "navPenalty,source", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "sea-cargo.json", champ: "buy", signature: "availabilityMultiplier,bigPortSkill,merchantSkill,partialPurchaseSellerDR,source,surplusSellerDR", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "sea-cargo.json", champ: "opportunite", signature: "investMaxEnc,outcomes,source,test", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "sea-cargo.json", champ: "overload", signature: "hardCapPct,paliers,source", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "sea-cargo.json", champ: "sell", signature: "commerceBonus,dumpingPctOfBase,noProduceTargetPerSize,offerPrice,producesGossip,sellerDR,source,surplusGossip", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "sea-events.json", champ: "fastVoyage", signature: "paliers,source", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "sea-events.json", champ: "manann", signature: "base,factors,portEventMod,source", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "sea-navigation.json", champ: "clocher", signature: "distanceDiviseur,orientationDR,source", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "sea-navigation.json", champ: "forcerLeRythme", signature: "avirons,bonusM,source", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "sea-navigation.json", champ: "forcerLeRythme", signature: "avirons,bonusM,source,voile", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "sea-navigation.json", champ: "levels", signature: "desc,level,mMod,manDR,navDR,repairPctOfBase,source", motif: "clé réservée", occurrences: 5, lot: "#1553", date: "2026-08-23" },
  { dataset: "sea-navigation.json", champ: "longsVoyages", signature: "millesParJourParM,progressionPctParDR,sansVoguerDeNuitDiviseur,source", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "sea-navigation.json", champ: "lowMPenalty", signature: "dr,m,source", motif: "clé réservée", occurrences: 3, lot: "#1553", date: "2026-08-23" },
  { dataset: "sea-navigation.json", champ: "orientation", signature: "changementDeCap,driftMajorBonus,driftSide,reperes,source,testsPerDay", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "sea-navigation.json", champ: "phares", signature: "clocher,perilSpotBonus,source,voirLaLumiere", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "sea-navigation.json", champ: "poursuite", signature: "distanceUnitM,drDeltas,escapeDistances,lowMPenalty,source", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "sea-navigation.json", champ: "reparation", signature: "charpentierPenalty,entretienCrewTestDR,lissageRepairSurcoutPct,portCostGoldPerWound,source,temporaire,testHours,woundsPerTest", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "sea-navigation.json", champ: "salissures", signature: "levels,source,weeklyTest", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "sea-navigation.json", champ: "vitesseMax", signature: "safeBonus,source,table", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "sea-navigation.json", champ: "workPeriodHours", signature: "avirons,source,voile", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "sea-perils.json", champ: "echouer", signature: "desc,source", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "sea-perils.json", champ: "gestionDesPerils", signature: "avoid,distanceM,source,spot", motif: "clé réservée", occurrences: 3, lot: "#1553", date: "2026-08-23" },
  { dataset: "sea-weather.json", champ: "seasonMod", signature: "automne,ete,hiver,printemps,source", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "ship-construction.json", champ: "manoeuvrability", signature: "costPct,manDR,source", motif: "clé réservée", occurrences: 4, lot: "#1553", date: "2026-08-23" },
  { dataset: "ship-construction.json", champ: "propulsion", signature: "secondaryMalus,secondaryMinM,source", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "spells.json", champ: "opposed", signature: "char,kind", motif: "clé réservée", occurrences: 4, lot: "#1553", date: "2026-08-23" },
  { dataset: "spells.json", champ: "variants", signature: "cn,desc,source,when", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "spells.json", champ: "variants", signature: "desc,duration,source,when", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "spells.json", champ: "variants", signature: "desc,effects,source,when", motif: "clé réservée", occurrences: 5, lot: "#1553", date: "2026-08-23" },
  { dataset: "spells.json", champ: "variants", signature: "desc,source,when", motif: "clé réservée", occurrences: 11, lot: "#1553", date: "2026-08-23" },
  { dataset: "talents.json", champ: "matches", signature: "char,manual", motif: "clé réservée", occurrences: 7, lot: "#1553", date: "2026-08-23" },
  { dataset: "talents.json", champ: "variants", signature: "combat,desc,max,source,when", motif: "clé réservée", occurrences: 2, lot: "#1553", date: "2026-08-23" },
  { dataset: "talents.json", champ: "variants", signature: "combat,desc,source,test,when", motif: "clé réservée", occurrences: 2, lot: "#1553", date: "2026-08-23" },
  { dataset: "talents.json", champ: "variants", signature: "combat,desc,source,when", motif: "clé réservée", occurrences: 5, lot: "#1553", date: "2026-08-23" },
  { dataset: "talents.json", champ: "variants", signature: "desc,source,test,when", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "talents.json", champ: "variants", signature: "desc,source,when", motif: "clé réservée", occurrences: 2, lot: "#1553", date: "2026-08-23" },
  { dataset: "tavernGames.json", champ: "dice", signature: "count,faces", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "tavernGames.json", champ: "phases", signature: "count,rounds", motif: "clé réservée", occurrences: 2, lot: "#1553", date: "2026-08-23" },
  { dataset: "tavernGames.json", champ: "second", signature: "char", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "vehicles.json", champ: "hull", signature: "bodyShape,char,criticalTable,locationTable,propulsion,rig", motif: "clé réservée", occurrences: 2, lot: "#1553", date: "2026-08-23" },
  { dataset: "vehicles.json", champ: "hull", signature: "bodyShape,char,propulsion", motif: "clé réservée", occurrences: 9, lot: "#1553", date: "2026-08-23" },
  { dataset: "vehicles.json", champ: "hull", signature: "bodyShape,char,propulsion,rig", motif: "clé réservée", occurrences: 18, lot: "#1553", date: "2026-08-23" },
  { dataset: "vehicles.json", champ: "purchase", signature: "availability,price", motif: "clé réservée", occurrences: 14, lot: "#1553", date: "2026-08-23" },
  { dataset: "vehicles.json", champ: "purchase", signature: "price", motif: "clé réservée", occurrences: 17, lot: "#1553", date: "2026-08-23" },
  { dataset: "talents.json", champ: "matches", signature: "manual,skill", motif: "clé réservée", occurrences: 74, lot: "#1553", date: "2026-08-23" },
  { dataset: "talents.json", champ: "matches", signature: "skill", motif: "clé réservée", occurrences: 34, lot: "#1553", date: "2026-08-23" },
  { dataset: "talents.json", champ: "matches", signature: "skill,when", motif: "clé réservée", occurrences: 4, lot: "#1553", date: "2026-08-23" },
  { dataset: "talents.json", champ: "matches", signature: "skill,specFromInstance", motif: "clé réservée", occurrences: 3, lot: "#1553", date: "2026-08-23" },
  { dataset: "trappings.json", champ: "test", signature: "label,skill", motif: "clé réservée", occurrences: 2, lot: "#1553", date: "2026-08-23" },
  { dataset: "arene-projet.json", champ: "effect", signature: "level,skill,type", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "etats.json", champ: "test", signature: "difficultyBy,gate,label,skill", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "etats.json", champ: "recover", signature: "skill", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "qualities.json", champ: "test", signature: "characteristic,opposed,skill", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "qualities.json", champ: "test", signature: "opposed,skill", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "tavernGames.json", champ: "test", signature: "skill", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
  { dataset: "trappings.json", champ: "test", signature: "label,noSupport,skill", motif: "clé réservée", occurrences: 1, lot: "#1553", date: "2026-08-23" },
];

/** Une signature d'op encore écrite à plat, par dataset (`gameOpSchema` = `looseObject({op})`,
 *  rien n'est validé). Cible L1c : une union discriminée générée d'`OP_DEFS`, refs EMBOÎTÉES
 *  (`skill: {id, spec}`) — une ref à plat dans une op est une divergence, pas une graphie. */
export const STRUCTURES_OPS = [
  { op: "<=", signature: "kind,op,value", dataset: "water-exposure.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: ">=", signature: "kind,op,value", dataset: "water-exposure.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "actGate", signature: "char,op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "actGate", signature: "char,op", dataset: "trappings.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "ap", signature: "amount,op", dataset: "spells.json", occurrences: 8, lot: "L1c #1468", date: "2026-08-23" },
  { op: "ap", signature: "amount,loc,op", dataset: "mutations.json", occurrences: 7, lot: "L1c #1468", date: "2026-08-23" },
  { op: "ap", signature: "amount,loc,op", dataset: "naval-traits.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "ap", signature: "amount,noDeviation,op", dataset: "mutations.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "ap", signature: "amount,op", dataset: "mutations.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "ap", signature: "amount,atHitLocation,op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "armourPierce", signature: "amount,bypass,op", dataset: "qualities.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  // signature `op,radius` -> `op` (#1508 T3, 2026-09-07) : le Bouclier anti-flèches cesse de re-déclarer
  // sa zone. Elle est écrite par la ligne « Cible » de son sort (`LDB 47 l.356`, ZdE en DIAMÈTRE — l.28)
  // et l'op la LIT (`OpsCtx.sourceSpell.zde`) ; le `radius = BFM` qu'elle portait valait DEUX fois la zone.
  { op: "arrowWard", signature: "op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "attackKeyword", signature: "keyword,op", dataset: "traits.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "attackWardFM", signature: "op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "attrMod", signature: "attr,mod,op", dataset: "talents.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "attrMod", signature: "attr,mod,op", dataset: "trappings.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "augmentWeapon", signature: "addQualities,onHitEffects,op", dataset: "spells.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "augmentWeapon", signature: "onHitEffects,op", dataset: "trappings.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "augmentWeapon", signature: "addQualities,bypass,onHitEffects,op,requiresWeapon", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "augmentWeapon", signature: "addQualities,damageBonus,onHitEffects,op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "augmentWeapon", signature: "addQualities,damageBonus,op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "augmentWeapon", signature: "addQualities,onHitEffects,op,requiresWeapon", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "augmentWeapon", signature: "addQualities,op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "augmentWeapon", signature: "addQualities,op,requiresWeapon", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "augmentWeapon", signature: "op,passive,removeType", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "banish", signature: "narration,onlyGroups,op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "banish", signature: "narration,op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "banish", signature: "narration,op", dataset: "traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "banish", signature: "op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "banish", signature: "op", dataset: "traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "between", signature: "kind,max,min,op", dataset: "water-exposure.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "castPenalty", signature: "blocked,op,rounds,skill", dataset: "miscast.json", occurrences: 5, lot: "L1c #1468", date: "2026-08-23" },
  { op: "castPenalty", signature: "mod,op,rounds,skill", dataset: "miscast.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "castPenalty", signature: "blocked,minutes,op,skill", dataset: "miscast.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "castPenalty", signature: "blocked,op,skill", dataset: "traits.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "castPenalty", signature: "hours,mod,op,skill", dataset: "miscast.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "castPenalty", signature: "days,maxZeroDR,op,skill", dataset: "miscast.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "castWard", signature: "op,perSL,radius", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "chain", signature: "hopMeters,maxBounces,op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "charDamage", signature: "amount,char,op", dataset: "symptoms.json", occurrences: 4, lot: "L1c #1468", date: "2026-08-23" },
  { op: "charDamage", signature: "amount,char,op", dataset: "spells.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "charDRBonus", signature: "bonus,char,op", dataset: "tables.json", occurrences: 8, lot: "L1c #1468", date: "2026-08-23" },
  { op: "charDRBonus", signature: "bonus,char,op", dataset: "trappings.json", occurrences: 8, lot: "L1c #1468", date: "2026-08-23" },
  { op: "charDRBonus", signature: "bonus,char,op", dataset: "sea-shanties.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "charMod", signature: "char,mod,op", dataset: "mutations.json", occurrences: 55, lot: "L1c #1468", date: "2026-08-23" },
  { op: "charMod", signature: "char,mod,op", dataset: "stars.json", occurrences: 42, lot: "L1c #1468", date: "2026-08-23" },
  { op: "charMod", signature: "char,mod,op", dataset: "spells.json", occurrences: 32, lot: "L1c #1468", date: "2026-08-23" },
  { op: "charMod", signature: "char,mod,op", dataset: "symptoms.json", occurrences: 30, lot: "L1c #1468", date: "2026-08-23" }, // INCHANGÉ par #1599 : le palier S'AJOUTE à `passive` au lieu de le remplacer (LDB 20 l.157/l.170), donc aucune liste ne se recopie — la migration ne fait que déplacer les 6 op(s) de `severePassive` vers `passiveBySeverity.moderee`
  { op: "charMod", signature: "char,mod,op", dataset: "traits.json", occurrences: 21, lot: "L1c #1468", date: "2026-08-23" }, // +1 : Trait Entêté (+20 FM), EDOC 07 folio 22 (#673)
  { op: "charMod", signature: "char,mod,op", dataset: "traumas.json", occurrences: 12, lot: "L1c #1468", date: "2026-08-23" },
  { op: "charMod", signature: "char,mod,op", dataset: "talents.json", occurrences: 10, lot: "L1c #1468", date: "2026-08-23" },
  { op: "charMod", signature: "char,mod,op", dataset: "trappings.json", occurrences: 9, lot: "L1c #1468", date: "2026-08-23" },
  { op: "charMod", signature: "char,mod,op", dataset: "maneuvers.json", occurrences: 8, lot: "L1c #1468", date: "2026-08-23" },
  { op: "charMod", signature: "char,mod,op", dataset: "tables.json", occurrences: 7, lot: "L1c #1468", date: "2026-08-23" },
  { op: "charMod", signature: "char,durationRounds,mod,op", dataset: "criticals.json", occurrences: 6, lot: "L1c #1468", date: "2026-08-23" },
  { op: "charMod", signature: "char,durationHours,mod,op", dataset: "spells.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "charMod", signature: "char,durationHours,mod,op", dataset: "criticals.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "charMod", signature: "char,durationHours,mod,op", dataset: "trappings.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "charMod", signature: "char,durationRounds,mod,op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op,value", dataset: "criticals.json", occurrences: 190, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op", dataset: "spells.json", occurrences: 58, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op,value", dataset: "miscast.json", occurrences: 40, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "durationRounds,id,op", dataset: "spells.json", occurrences: 9, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op", dataset: "maneuvers.json", occurrences: 8, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op,value", dataset: "spells.json", occurrences: 8, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op,value", dataset: "trappings.json", occurrences: 7, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op", dataset: "etats.json", occurrences: 6, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op,unlockBy,value", dataset: "criticals.json", occurrences: 12, lot: "L1c #1468", date: "2026-08-23" },
  // #1661 : 5 → 6 — le 2ᵉ État Hémorragique de Taillade (`AA 08 l.87`), même op que le 1ᵉʳ.
  { op: "condition", signature: "id,op", dataset: "qualities.json", occurrences: 6, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op,value", dataset: "river-criticals.json", occurrences: 5, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op,value", dataset: "ship-criticals.json", occurrences: 11, lot: "L1c #1468", date: "2026-08-23" }, // 5 → 11 (#1657 B3-2b-a) : 6 rangées MDG dont le Test ne vivait qu'en prose `note` gagnent leur `crewHit` (MDG 13 l.730/734/736/738/751/756, échec = État À Terre)
  { op: "condition", signature: "id,op,value,valuePerSL", dataset: "spells.json", occurrences: 5, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op", dataset: "symptoms.json", occurrences: 4, lot: "L1c #1468", date: "2026-08-23" }, // 4 → 6 (#1599, États portés par un canal passif) puis 6 → 4 : les DEUX États portés déclarent leur fenêtre de Détermination et changent donc de signature (ligne suivante)
  // #1599, 2026-09-06 : ce qu'un Point de Détermination fait sur l'État qu'une op PASSIVE porte est dit
  // par l'op elle-même (`resolveWindow`) — fenêtre d'horloge pour la Fièvre (Grave) `LDB 20 l.170`,
  // refus (`'none'`) pour le Malaise `LDB 20 l.188`. Les deux drapeaux de symptôme qui le disaient
  // (`determinationSuspends`/`lockedUntilCured`) sont MORTS avec ce lot.
  { op: "condition", signature: "id,op,resolveWindow", dataset: "symptoms.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "escapeStrength,grapple,id,op,unlessCondition,value", dataset: "traits.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "escapeStrength,id,op", dataset: "spells.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "escapeStrength,id,op,value,valuePerSL", dataset: "spells.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op", dataset: "domains.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op", dataset: "traits.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op,value", dataset: "maneuvers.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "durationHours,id,op", dataset: "trappings.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "durationRounds,id,op", dataset: "miscast.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "durationRounds,id,op,perRound,unlessCondition,value", dataset: "miscast.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" }, // NEUF (#1653 train A) : la cause récurrente de « Purifier la chair », 1d10 Rounds (LDB 40 l.75, LDB 16 l.117)
  { op: "condition", signature: "escapeStrength,id,op,unlessCondition,value", dataset: "qualities.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "escapeStrength,id,op,value", dataset: "miscast.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "escapeStrength,id,op,valuePerSL", dataset: "spells.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op,unlessCondition", dataset: "spells.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op,value", dataset: "tables.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op,value", dataset: "traits.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" }, // +1 (#862) : Exténué au réveil (Désespoir)
  { op: "condition", signature: "durationHours,id,op,value", dataset: "criticals.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "durationRounds,id,onlyIfCondition,op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "entangleOnFail,escapeThreshold,id,op,struggleDamage,unlessCondition,value", dataset: "qualities.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "entangleOnFail,escapeThreshold,id,op,unlessCondition,value", dataset: "qualities.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "escapeStrength,grapple,id,op", dataset: "maneuvers.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "escapeStrength,grapple,id,op,unlessCondition", dataset: "maneuvers.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "escapeStrength,id,op,unlessCondition,value", dataset: "traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "escapeStrength,id,op,value", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "grapple,id,op,value", dataset: "grapple.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "grapple,id,op,value", dataset: "traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,lockedUntil,op,value", dataset: "criticals.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,onlyGroups,op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,onlyGroups,op,value", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,onlyGroups,op,value", dataset: "trappings.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op", dataset: "activities.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  // #1612 (2026-09-06) — Mendier (LDB 09 l.97/l.99) : l'op `money` (bourse personnelle) de ses deux
  // bandes de réussite ET de l'amende des gardes de sa table MAISON, le `statusMod` de son dé de monde,
  // et l'État de la rangée « autres mendiants ». Toutes à la forme déclarée du moteur. `money` porte
  // sa charge sous `montant`, comme `giveMoney` depuis L-monnaie-3 : c'est la garde
  // `monnaie-forme-unique` (sonde A) qui l'exige, une action ne l'étale pas à plat.
  { op: "condition", signature: "id,op", dataset: "tables.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "money", signature: "montant,op", dataset: "activities.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  // L'amende des gardes locaux (rangée 1-3 de `mendier-ennuis`) : même op, même graphie, autre dataset.
  { op: "money", signature: "montant,op", dataset: "tables.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "statusMod", signature: "amount,op", dataset: "activities.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op", dataset: "miscast.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op", dataset: "psychology.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op", dataset: "talents.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op,perRound", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op,unlessCondition", dataset: "maneuvers.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op,unlessCondition,value", dataset: "traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op,value", dataset: "etats.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op,value", dataset: "grapple.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op,value", dataset: "tavernGames.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op,value,valuePerSL", dataset: "maneuvers.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op,value,valuePerSL", dataset: "traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op,value,valuePerSL", dataset: "trappings.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "condition", signature: "id,op,valuePerSL", dataset: "maneuvers.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "contractDisease", signature: "disease,op", dataset: "tables.json", occurrences: 5, lot: "L1c #1468", date: "2026-08-23" },
  { op: "contractDisease", signature: "disease,op", dataset: "criticals.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "contractDisease", signature: "disease,op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "contractDisease", signature: "disease,op", dataset: "symptoms.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "contractDisease", signature: "disease,op", dataset: "trappings.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "corruption", signature: "amount,op", dataset: "miscast.json", occurrences: 8, lot: "L1c #1468", date: "2026-08-23" },
  { op: "corruption", signature: "amount,op", dataset: "spells.json", occurrences: 6, lot: "L1c #1468", date: "2026-08-23" },
  { op: "corruption", signature: "amount,op,perSL", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "corruptionExposure", signature: "level,op", dataset: "spells.json", occurrences: 5, lot: "L1c #1468", date: "2026-08-23" },
  { op: "corruptionExposure", signature: "level,op,skill", dataset: "trappings.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "corruptionExposure", signature: "easeSteps,op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "corruptionExposure", signature: "level,op,skill", dataset: "activities.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "crewTestMod", signature: "mod,op", dataset: "sea-shanties.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "critOnRoll", signature: "equals,mod,op", dataset: "qualities.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "critTwice", signature: "op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "cureCriticalWound", signature: "count,op", dataset: "traits.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "cureCriticalWound", signature: "count,countPerSL,op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "cureDisease", signature: "count,countPerSL,op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "cureDisease", signature: "count,op", dataset: "trappings.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "damageArmour", signature: "material,op", dataset: "maneuvers.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "damageArmour", signature: "material,op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "delayed", signature: "afterDuration,op,ops", dataset: "spells.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "delayed", signature: "afterDuration,op,ops", dataset: "trappings.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "delayed", signature: "afterHours,forHours,op,ops", dataset: "trappings.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "delayed", signature: "afterMinutes,op,ops", dataset: "trappings.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "disarm", signature: "op", dataset: "criticals.json", occurrences: 17, lot: "L1c #1468", date: "2026-08-23" },
  { op: "diseaseTestMod", signature: "amount,diseases,op", dataset: "trappings.json", occurrences: 5, lot: "L1c #1468", date: "2026-08-23" },
  { op: "aggravateSymptom", signature: "disease,op,otherwise,severity,symptomId", dataset: "maladies.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" }, // EDOC 08 l.104-108 (#674)
  { op: "diseaseTestMod", signature: "amount,op", dataset: "maladies.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantSymptom", signature: "disease,op,symptomId", dataset: "maladies.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" }, // EDOC 08 l.106-108 (#674)
  // signature `op,radius` -> `indice,op,traitId` (#1508 T3, 2026-09-07) : l'op est TYPÉE
  // (`OP_DEFS.domeWard`) et porte le Trait qu'elle octroie ; elle a quitté `OPS_NON_TYPEES`. Sa ZONE
  // DISPARAÎT du payload : elle est déjà écrite par la ligne « Cible » du sort (ZdE, LDB 47 l.28) et
  // l'op la LIT (`OpsCtx.sourceSpell.zde`) — une zone, une déclaration.
  { op: "domeWard", signature: "indice,op,traitId", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "endPsych", signature: "op,type", dataset: "psychology.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "endPsych", signature: "op,type", dataset: "talents.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "endTransform", signature: "op,tag", dataset: "maneuvers.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "exposeDisease", signature: "disease,op", dataset: "traits.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "exposeDisease", signature: "difficultyShift,disease,incubation,op", dataset: "traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "exposeDisease", signature: "disease,op", dataset: "qualities.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "fall", signature: "hauteur,op", dataset: "ship-criticals.json", occurrences: 5, lot: "L1c #1468", date: "2026-08-23" }, // NEUF (#1657 B3-2b-c) : les 5 rangées du gréement font TOMBER (MDG 13 l.678-688) ; la hauteur est une réf `{id}` de table, jamais un nombre authoré
  { op: "freeReroll", signature: "op", dataset: "spells.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "gainAdvantage", signature: "amount,op", dataset: "tavernGames.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "gainAdvantage", signature: "amount,feedOpposingPool,op", dataset: "traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "gainResource", signature: "amount,op,perSL,resource,temporary", dataset: "spells.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "gainResource", signature: "amount,op,perSL,resource", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "gainResource", signature: "amount,op,resource", dataset: "trappings.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "gainResource", signature: "amount,op,resource,temporary", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "giveTrapping", signature: "op,trappingId", dataset: "spells.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "giveTrapping", signature: "op,perSL,trappingId", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantCareerSkill", signature: "op,skill", dataset: "talents.json", occurrences: 5, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantCareerTalent", signature: "op,talentId", dataset: "traits.json", occurrences: 18, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantCareerTalent", signature: "op,spec,talentId", dataset: "traits.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantCareerTalent", signature: "op,talentId", dataset: "talents.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantFreeAttack", signature: "advantageOrMovement,op,weapon,when", dataset: "talents.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantFreeAttack", signature: "op,perChargerOncePerRound,weapon,when", dataset: "talents.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantFreeAttack", signature: "op,weapon,when", dataset: "psychology.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantNaturalWeapon", signature: "bare,damage,label,op,plusBF,qualities", dataset: "mutations.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantNaturalWeapon", signature: "damage,label,op", dataset: "spells.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantNaturalWeapon", signature: "damage,label,op,qualities", dataset: "spells.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantNaturalWeapon", signature: "attackKind,bare,damage,label,op,plusBF,subType,uid", dataset: "traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantPsychTrait", signature: "op,psychType", dataset: "spells.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantPsychTrait", signature: "cible,op,psychType", dataset: "drunkenness.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantPsychTrait", signature: "cible,op,psychType", dataset: "symptoms.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantPsychTrait", signature: "cible,op,psychType", dataset: "tables.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantPsychTrait", signature: "op,psychType", dataset: "mutations.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantPsychTrait", signature: "op,psychType", dataset: "symptoms.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantReverseToken", signature: "op", dataset: "activities.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTalent", signature: "op,talentId", dataset: "spells.json", occurrences: 15, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTalent", signature: "op,talentId", dataset: "tables.json", occurrences: 12, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTalent", signature: "op,talentId", dataset: "stars.json", occurrences: 11, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTalent", signature: "op,spec,talentId", dataset: "spells.json", occurrences: 6, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTalent", signature: "op,spec,talentId", dataset: "mutations.json", occurrences: 5, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTalent", signature: "op,spec,talentId", dataset: "stars.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTalent", signature: "op,spec,talentId", dataset: "traits.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTalent", signature: "op,talentId", dataset: "mutations.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTalent", signature: "op,talentId", dataset: "traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTalent", signature: "op,talentId", dataset: "trappings.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTrait", signature: "op,traitId", dataset: "mutations.json", occurrences: 19, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTrait", signature: "op,traitId", dataset: "spells.json", occurrences: 16, lot: "L1c #1468", date: "2026-08-23" }, // −1 (#862) : le Désespoir accordé porte désormais sa durée (ligne suivante)
  { op: "grantTrait", signature: "durationHours,op,traitId", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTrait", signature: "indice,op,traitId", dataset: "mutations.json", occurrences: 16, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTrait", signature: "op,traitId", dataset: "tables.json", occurrences: 16, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTrait", signature: "indice,op,traitId", dataset: "spells.json", occurrences: 14, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTrait", signature: "indice,op,traitId", dataset: "tables.json", occurrences: 14, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTrait", signature: "arg,op,traitId", dataset: "mutations.json", occurrences: 4, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTrait", signature: "arg,op,traitId", dataset: "tables.json", occurrences: 4, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTrait", signature: "indice,op,traitId", dataset: "maneuvers.json", occurrences: 4, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTrait", signature: "arg,indice,op,traitId", dataset: "tables.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTrait", signature: "arg,op,traitId", dataset: "spells.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTrait", signature: "op,traitId", dataset: "symptoms.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTrait", signature: "argFrom,op,traitId", dataset: "mutations.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" }, // +1 (#862) : re-ciblage `onDayStart`
  { op: "removeTrait", signature: "op,traitId", dataset: "mutations.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTrait", signature: "indice,indicePerSL,op,traitId", dataset: "spells.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTrait", signature: "indice,op,traitId", dataset: "traits.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTrait", signature: "op,traitId", dataset: "maneuvers.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTrait", signature: "op,traitId", dataset: "trappings.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTrait", signature: "arg,indice,op,traitId", dataset: "mutations.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTrait", signature: "durationRounds,indice,op,traitId", dataset: "domains.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTrait", signature: "indice,op,traitId", dataset: "trappings.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantTrait", signature: "onlyGroups,op,traitId", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantWeapon", signature: "chooseForm,damage,label,op,qualities,skin", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantWeapon", signature: "damage,damagePlus,form,hands,label,op,qualities,reach,skin,subType", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "grantWeapon", signature: "damage,form,hands,label,onHitEffects,op,qualities,reach,skin,subType", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "handGate", signature: "op", dataset: "criticals.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "heal", signature: "amount,op", dataset: "spells.json", occurrences: 11, lot: "L1c #1468", date: "2026-08-23" },
  { op: "heal", signature: "amount,op", dataset: "traits.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "heal", signature: "amount,op", dataset: "trappings.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "heal", signature: "amount,op,perSL", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "healCaster", signature: "amount,op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "ignoreAnimosity", signature: "op", dataset: "drunkenness.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "ignoreStatePenalties", signature: "op", dataset: "spells.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "ignoreStatePenalties", signature: "count,op", dataset: "sea-shanties.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "incomingAdvantage", signature: "amount,mode,op", dataset: "etats.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "incomingAttackMod", signature: "amount,mode,op", dataset: "etats.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "incomingAttackMod", signature: "amount,flankRear,mode,op", dataset: "etats.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "incomingAttackMod", signature: "amount,mode,op", dataset: "traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "incomingSpellDRMod", signature: "amount,op", dataset: "talents.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "incomingSpellDRMod", signature: "amount,op", dataset: "traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "intoxicate", signature: "op", dataset: "tavernGames.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "intoxicate", signature: "op", dataset: "trappings.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "kill", signature: "op", dataset: "symptoms.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "kill", signature: "op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "lifeSteal", signature: "den,num,op", dataset: "traits.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "lifeSteal", signature: "den,num,op,round", dataset: "spells.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "light", signature: "op,radiusM,tone", dataset: "trappings.json", occurrences: 4, lot: "L1c #1468", date: "2026-08-23" },
  { op: "light", signature: "op,radiusM,tone", dataset: "spells.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "light", signature: "op,radiusM,tone", dataset: "tables.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "loseTurn", signature: "op,what", dataset: "maneuvers.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "loseTurn", signature: "op,what", dataset: "spells.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "loseTurn", signature: "op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "loseTurn", signature: "op", dataset: "traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "martyr", signature: "op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "maxWeaponHands", signature: "durationRounds,hands,op", dataset: "criticals.json", occurrences: 6, lot: "L1c #1468", date: "2026-08-23" },
  { op: "maxWeaponHands", signature: "hands,op", dataset: "criticals.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "maxWeaponHands", signature: "hands,op", dataset: "traumas.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "mitigateIncoming", signature: "mode,op,unlessKeyword", dataset: "traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "moveMod", signature: "mod,op", dataset: "mutations.json", occurrences: 7, lot: "L1c #1468", date: "2026-08-23" },
  { op: "moveMod", signature: "mod,op", dataset: "spells.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "moveMod", signature: "mod,op", dataset: "naval-traits.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "moveMod", signature: "mod,op", dataset: "traits.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "moveMod", signature: "mod,op", dataset: "trappings.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "moveMod", signature: "mod,op", dataset: "maneuvers.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "moveMod", signature: "mod,op", dataset: "tables.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "moveMod", signature: "mod,op", dataset: "talents.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "moveScale", signature: "den,num,op", dataset: "traumas.json", occurrences: 7, lot: "L1c #1468", date: "2026-08-23" },
  { op: "moveScale", signature: "den,num,op", dataset: "spells.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "moveScale", signature: "den,num,op", dataset: "criticals.json", occurrences: 4, lot: "L1c #1468", date: "2026-08-23" },
  { op: "moveScale", signature: "den,durationRounds,num,op", dataset: "criticals.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "moveScale", signature: "den,num,op", dataset: "naval-traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "moveScale", signature: "den,num,op", dataset: "trappings.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "narrative", signature: "op,text", dataset: "spells.json", occurrences: 378, lot: "L1c #1468", date: "2026-08-23" },
  { op: "narrative", signature: "op,text", dataset: "tables.json", occurrences: 119, lot: "L1c #1468", date: "2026-08-23" },
  { op: "narrative", signature: "op,text", dataset: "trappings.json", occurrences: 10, lot: "L1c #1468", date: "2026-08-23" },
  { op: "noBreath", signature: "op", dataset: "spells.json", occurrences: 5, lot: "L1c #1468", date: "2026-08-23" },
  { op: "noHunger", signature: "op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "offTerrainMod", signature: "mSet,op,suffocates,terrain,testDR", dataset: "traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "offTerrainMod", signature: "mSet,op,terrain", dataset: "traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "offTerrainMod", signature: "op,terrain", dataset: "traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "perRound", signature: "op,ops", dataset: "spells.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "polymorph", signature: "op,ref", dataset: "spells.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "preventInfection", signature: "op", dataset: "trappings.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "preventInfection", signature: "op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "push", signature: "meters,op", dataset: "spells.json", occurrences: 4, lot: "L1c #1468", date: "2026-08-23" },
  { op: "reduceDiseaseDays", signature: "days,daysPerSL,disease,op", dataset: "trappings.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "reduceDiseaseDays", signature: "days,oncePerDisease,op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "reduceDiseaseDays", signature: "dice,disease,op", dataset: "trappings.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "reduceToZero", signature: "op", dataset: "miscast.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "reduceToZero", signature: "op", dataset: "maneuvers.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "removeCondition", signature: "id,op,value", dataset: "spells.json", occurrences: 6, lot: "L1c #1468", date: "2026-08-23" },
  { op: "removeCondition", signature: "all,id,op", dataset: "trappings.json", occurrences: 5, lot: "L1c #1468", date: "2026-08-23" },
  { op: "removeCondition", signature: "id,op", dataset: "etats.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "removeCondition", signature: "id,op,value,valuePerSL", dataset: "etats.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "removeCondition", signature: "id,op,value", dataset: "domains.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "removeCondition", signature: "id,op,value", dataset: "trappings.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "removeCondition", signature: "op", dataset: "spells.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "removeCondition", signature: "all,id,op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "removeCondition", signature: "id,op,value", dataset: "etats.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "removeCondition", signature: "id,op,value", dataset: "traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "removeCondition", signature: "id,op,value,valuePerSL", dataset: "grapple.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "removeCondition", signature: "id,op,value,valuePerSL", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "removeCondition", signature: "id,op,value,valuePerSL", dataset: "talents.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "removePsychTrait", signature: "op", dataset: "activities.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "removeShipPoste", signature: "op", dataset: "ship-criticals.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "rollMutation", signature: "op,table", dataset: "tables.json", occurrences: 4, lot: "L1c #1468", date: "2026-08-23" },
  { op: "rollTable", signature: "op,tableId", dataset: "activities.json", occurrences: 13, lot: "L1c #1468", date: "2026-08-23" },
  { op: "rollTable", signature: "extraRollsPerStep,op,tableId", dataset: "spells.json", occurrences: 4, lot: "L1c #1468", date: "2026-08-23" },
  { op: "rollTable", signature: "die,op,rows", dataset: "spells.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "rollTable", signature: "addNegativeSL,op,tableId", dataset: "activities.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "rollTable", signature: "addNegativeSL,die,op,rows", dataset: "symptoms.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "rollTable", signature: "addNegativeSL,mod,op,tableId", dataset: "activities.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "rollTable", signature: "die,op,tableId", dataset: "trappings.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "rollTable", signature: "op,tableId", dataset: "tables.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "rollTable", signature: "op,tableId", dataset: "traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "rollThreshold", signature: "op,sides,thresholds", dataset: "traits.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "sbBonus", signature: "amount,op", dataset: "psychology.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "scheduleRespawn", signature: "cancelFlag,delayDays,op,ref", dataset: "traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "senseLoss", signature: "op,sense", dataset: "traumas.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "sinMod", signature: "amount,op", dataset: "activities.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "skillDRBonus", signature: "bonus,op,skill", dataset: "spells.json", occurrences: 17, lot: "L1c #1468", date: "2026-08-23" },
  { op: "skillDRBonus", signature: "bonus,op,skill", dataset: "tables.json", occurrences: 15, lot: "L1c #1468", date: "2026-08-23" },
  { op: "skillDRBonus", signature: "bonus,op,skill", dataset: "traits.json", occurrences: 12, lot: "L1c #1468", date: "2026-08-23" },
  { op: "skillDRBonus", signature: "bonus,op,skill", dataset: "trappings.json", occurrences: 6, lot: "L1c #1468", date: "2026-08-23" },
  { op: "skillDRBonus", signature: "bonus,op,skill", dataset: "naval-traits.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "skillDRBonus", signature: "bonus,op,skill", dataset: "traumas.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "skillDRBonus", signature: "bonus,op,skill", dataset: "sea-shanties.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "skillDRBonus", signature: "bonus,op,testType", dataset: "naval-traits.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "skillMod", signature: "mod,op,skill", dataset: "trappings.json", occurrences: 9, lot: "L1c #1468", date: "2026-08-23" },
  { op: "skillMod", signature: "mod,op,skill", dataset: "traumas.json", occurrences: 8, lot: "L1c #1468", date: "2026-08-23" },
  { op: "skillMod", signature: "mod,op,skill", dataset: "traits.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "skillMod", signature: "mod,op,sense,skill", dataset: "traumas.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "skillMod", signature: "mod,op,skill", dataset: "mutations.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "skillMod", signature: "mod,op,skill", dataset: "drunkenness.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "skillMod", signature: "mod,op,skill", dataset: "sea-shanties.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "suffocate", signature: "op", dataset: "spells.json", occurrences: 8, lot: "L1c #1468", date: "2026-08-23" },
  { op: "summon", signature: "allyOfCaster,count,op,ref", dataset: "spells.json", occurrences: 8, lot: "L1c #1468", date: "2026-08-23" },
  { op: "summon", signature: "addTraits,allyOfCaster,count,op,ref", dataset: "spells.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "summon", signature: "allyOfCaster,count,countPerSL,despawnIfCasterDown,op,ref", dataset: "spells.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "summon", signature: "addTraits,allyOfCaster,count,op,ref,size", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "summon", signature: "allyOfCaster,count,despawnIfCasterDown,op,ref", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "summon", signature: "count,countPerSL,op,ref", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "summon", signature: "count,op,ref", dataset: "traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "suppressPsych", signature: "op", dataset: "spells.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "suppressSymptom", signature: "op,symptomId", dataset: "trappings.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "teleport", signature: "meters,op,perSL", dataset: "spells.json", occurrences: 4, lot: "L1c #1468", date: "2026-08-23" },
  { op: "teleport", signature: "meters,op", dataset: "spells.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "testMod", signature: "amount,char,op", dataset: "trappings.json", occurrences: 5, lot: "L1c #1468", date: "2026-08-23" },
  { op: "testMod", signature: "amount,op", dataset: "etats.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "testMod", signature: "amount,op", dataset: "spells.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "testMod", signature: "amount,movementOnly,op", dataset: "etats.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "testMod", signature: "amount,op", dataset: "symptoms.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "testMod", signature: "amount,char,movementOnly,op", dataset: "criticals.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "testMod", signature: "amount,char,op", dataset: "criticals.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "testMod", signature: "amount,char,op", dataset: "mutations.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "testMod", signature: "amount,char,op", dataset: "qualities.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "testMod", signature: "amount,char,op", dataset: "sea-shanties.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "testMod", signature: "amount,combatOnly,op", dataset: "etats.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "testMod", signature: "amount,exceptSkills,op", dataset: "etats.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "testMod", signature: "amount,hearingOnly,op", dataset: "etats.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "testMod", signature: "amount,op", dataset: "traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "transform", signature: "morphRef,op,ops,tag", dataset: "maneuvers.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "weaponDamageMod", signature: "mode,op", dataset: "qualities.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "weaponDamageMod", signature: "chargeGated,op", dataset: "qualities.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "weaponDamageMod", signature: "negateAtouts,op", dataset: "qualities.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "weaponDamageMod", signature: "op,plusUnits", dataset: "qualities.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "weaponRollMod", signature: "drMod,op,phase", dataset: "qualities.json", occurrences: 8, lot: "L1c #1468", date: "2026-08-23" },
  { op: "weaponRollMod", signature: "drMod,op,phase", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "weaponRollMod", signature: "flatMod,op,phase", dataset: "qualities.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "weatherWard", signature: "op", dataset: "spells.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "wounds", signature: "amount,ignoreAP,ignoreTB,op", dataset: "criticals.json", occurrences: 146, lot: "L1c #1468", date: "2026-08-23" },
  { op: "wounds", signature: "amount,ignoreAP,ignoreTB,op", dataset: "spells.json", occurrences: 17, lot: "L1c #1468", date: "2026-08-23" },
  { op: "wounds", signature: "amount,ignoreAP,ignoreTB,op", dataset: "maneuvers.json", occurrences: 9, lot: "L1c #1468", date: "2026-08-23" },
  { op: "wounds", signature: "amount,ignoreAP,ignoreTB,op", dataset: "miscast.json", occurrences: 8, lot: "L1c #1468", date: "2026-08-23" },
  { op: "wounds", signature: "amount,ignoreAP,ignoreTB,op,perSL", dataset: "spells.json", occurrences: 6, lot: "L1c #1468", date: "2026-08-23" },
  // 5 → 6 (#1612) : la rangée « autres mendiants » de `mendier-ennuis` DÉCLARE ses deux mitigations
  // (`wounds-mitigation-declaree.test.ts` les exige explicites) et rejoint la signature COMMUNE.
  { op: "wounds", signature: "amount,ignoreAP,ignoreTB,op", dataset: "tables.json", occurrences: 6, lot: "L1c #1468", date: "2026-08-23" },
  { op: "wounds", signature: "amount,ignoreAP,ignoreTB,op", dataset: "traits.json", occurrences: 5, lot: "L1c #1468", date: "2026-08-23" },
  { op: "wounds", signature: "amount,ignoreAP,ignoreTB,op", dataset: "river-criticals.json", occurrences: 4, lot: "L1c #1468", date: "2026-08-23" },
  { op: "wounds", signature: "amount,ignoreAP,ignoreTB,op", dataset: "trappings.json", occurrences: 3, lot: "L1c #1468", date: "2026-08-23" },
  { op: "wounds", signature: "amount,ignoreAP,ignoreTB,onlyGroups,op", dataset: "spells.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "wounds", signature: "amount,ignoreAP,ignoreTB,op", dataset: "domains.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "wounds", signature: "amount,ignoreAP,ignoreTB,op", dataset: "etats.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "wounds", signature: "amount,ignoreAP,ignoreTB,op", dataset: "ship-criticals.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "wounds", signature: "amount,apFrom,ignoreAP,ignoreTB,min,op", dataset: "etats.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "wounds", signature: "amount,bypassArmour,ignoreAP,ignoreTB,op", dataset: "domains.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "wounds", signature: "amount,bypassArmour,ignoreAP,ignoreTB,op", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "wounds", signature: "amount,ignoreAP,ignoreTB,min,op", dataset: "etats.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "wounds", signature: "amount,ignoreAP,ignoreTB,min,op", dataset: "problemes-vehicule.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "wounds", signature: "amount,ignoreAP,ignoreTB,min,op", dataset: "traits.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "wounds", signature: "amount,ignoreAP,ignoreTB,op", dataset: "problemes-vehicule.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "wounds", signature: "amount,ignoreAP,ignoreTB,op", dataset: "symptoms.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "wounds", signature: "amount,ignoreAP,ignoreTB,op,perSL", dataset: "grapple.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "wounds", signature: "amount,ignoreAP,ignoreTB,op,perSL", dataset: "maneuvers.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "zone", signature: "op,perRound,radiusMeters,shape", dataset: "spells.json", occurrences: 7, lot: "L1c #1468", date: "2026-08-23" },
  { op: "zone", signature: "crossTest,onCross,op,radiusMeters,shape", dataset: "spells.json", occurrences: 2, lot: "L1c #1468", date: "2026-08-23" },
  { op: "zone", signature: "barrier,gate,noCorruption,op,perRound,shape", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "zone", signature: "blocksLoS,lengthMeters,lengthPerSL,op,shape", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "zone", signature: "lengthMeters,lengthPerSL,onCross,op,shape", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "zone", signature: "op,radiusMeters,shape", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "castPenalty", signature: "blocked,op,rounds", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
  { op: "castPenalty", signature: "mod,op,rounds", dataset: "spells.json", occurrences: 1, lot: "L1c #1468", date: "2026-08-23" },
];
