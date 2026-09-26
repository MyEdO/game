## Design — concept « valeur par membre d'un vocabulaire fermé » (strate Valeur), #1463, 2026-09-24, v1

Demande d'origine : fil des sorts (#1897), session du 2026-09-24 10:33 : « quelle est la forme CIBLE d'une valeur par
membre d'un vocabulaire fermé ? » ; son micro-train h3a-bis a sorti la migration des prénoms de son lot en attendant cette
forme (`prenoms | F,M` sortait de strate, le stock a refusé la croissance).

## Invariant

1. En-tête du stock hors strate, `scripts/guards/lib/horsStrateStock.mjs:1-22` (verbatim) : « chacune de ces signatures
   est une structure que le lexique fermé (`scripts/docs/lib/structures-lexique.mts`) ne classe dans AUCUNE strate —
   l'objet est vu, compté, et personne ne le reconnaît. Elle se solde en posant la structure à la forme CIBLE de son
   concept, jamais en l'« alignant » sur une voisine ni en élargissant le lexique pour la couvrir. » Question à laquelle il
   répond : comment une forme sort-elle du stock ? Réponse : par un CONCEPT dont elle prend la forme cible.
2. `src/data/schemas/grammaire/valeurs.ts:55-57` (verbatim) : « Un enum = une const nommée : un jumeau redéclaré en
   `z.enum` rendrait un `select` ANONYME que rien ne suivrait, le stock de `valeurs-de-champ.test.ts` se tenant par
   VOCABULAIRE. » Question : combien de déclarations pour un vocabulaire ? Réponse : une.
3. Credo, `.claude/credo.md`, puce « Règles GÉNÉRALES, jamais spécifiques » (verbatim) : « Corriger la classe entière du
   problème, pas le cas rencontré. Une garde de synchronisation est un smell : une seule source de vérité. » Question à
   laquelle il répond : quand deux déclarations doivent rester égales (un ensemble d'ids de dataset et un enum, une clé
   d'objet écrite et un vocabulaire), faut-il une garde qui les compare ? Réponse : non, il faut qu'il n'en reste qu'une.
   C'est la question que D2 et D7 posent à `raceKeySchema` et à `affinerDataset` de `names.ts`.

## Cas canonique déjà couvert

- La MARQUE DE NŒUD lue par co-descente : `marquerCollection` pose une marque sur le nœud de schéma
  (`src/data/schemas/grammaire/collection-cle.ts:60`, `WeakMap` `COLLECTIONS`), `collectionsDuDocument` (`:249`) la
  retrouve dans une donnée par co-descente sans parse, et le scan, la phase 2 de `gen` et l'éditeur lisent ce résultat.
  C'est le patron : un fait de STRUCTURE se déclare une fois au nœud et se lit par co-descente, jamais par la signature
  des clés observées.
- L'exhaustivité au parse : `z.record(enum, T)` itère sur les membres du vocabulaire (zod 4.4.3,
  `node_modules/zod/v4/core/schemas.js:1421-1481`) ; `z.partialRecord` clone la clé et efface `_zod.values`
  (`node_modules/zod/v4/classic/schemas.js:906-916`). `species.baseChar: z.record(charKeySchema, z.number())`
  (`src/data/schemas/defs/species.ts:34`) est déjà exhaustif au parse.

Le cas neuf en est une INSTANCE : « cette carte a pour clés les membres de CE vocabulaire » est un fait de structure du
nœud, comme « ce record est une collection à clé ». Il se déclare au nœud, par une primitive, et se lit par co-descente.

## Constat (mesures du lecteur, 2026-09-24, `f878503a2`, à attaquer)

- Aucun concept du lexique ne nomme cette forme (`structures-lexique.mts`, `CONCEPTS`, strates l.62).
- Formes relevées dans `SCHEMA_DEFS` (racine `src/data` seule ; `SCHEMA_DEFS_SCENES` non sondé), toutes au stock hors
  strate :
  - exhaustives `z.record(enum, T)` : `species.baseChar` (10 Caractéristiques), `sea-weather.effetDuVent` (6 forces ×
    3 aspects, imbriqué), `sea-weather.effetDuVentGreementDelta`, `river-navigation.windEffect` (valeur interne ; sa
    clé externe est un `z.string()` qui porte les forces de vent), `teintesJeu.entries` (29 teintes) ;
  - partielles `z.partialRecord(enum, T)` : `details.ageBase/ageRoll/heightBase/heightRoll`, `eyes.color`,
    `hairs.color/randByRace` (7 races), `raceAppearance.tirageIndividuel` (9 emplacements), `careers.rand`
    (`refCareerIdSchema`, `number().nullable()`) ;
  - clés ÉCRITES en objet : `names.lastNameSuffixes: z.strictObject({M, F})` (`defs/names.ts`), l'objet des 9
    emplacements de couleur tous optionnels (`grammaire/valeurs.ts:670-684`) ;
  - un champ par membre, nommé par préfixe ou suffixe : `maleFirstNames`/`femaleFirstNames` (`defs/names.ts`),
    `palette`/`paletteF` (`defs/raceAppearance.ts:21-22`, lecteur `src/gameIso/rig/races/index.ts:39`), `label`/`labelF`
    (enveloppe, `grammaire/document.ts:28`, lecteurs `src/data/index.ts:875-892`, `:3092-3097`) ;
  - au niveau du DATASET : `names.json` est une liste de 7 documents dont les ids doivent être EXACTEMENT
    `raceKeySchema.options`, tenu par un `affinerDataset` écrit à la main (`defs/names.ts:55-67`).
- Vocabulaires : `charKeySchema` (`grammaire/valeurs.ts:503`, doublé localement `defs/tavernGames.ts:20`) ;
  `sexeSchema = enumNomme({ M: 'Masculin', F: 'Féminin' })` existe sur `chantier/1897-doublons-fan` (`42eeb9306`,
  `grammaire/valeurs.ts:651`), pas sur les branches de #1473 ; `{M,F}` y est écrit en clair à trois sites
  (`defs/pregens.ts:41`, `defs/raceAppearance.ts:32`, `grammaire/valeurs.ts:687`). `raceKeySchema` (`valeurs.ts:602`)
  est un `z.enum` écrit à la main des 7 races jouables.
- Éditeur : `src/ui/compendium/editFields.ts:26-53` (`kindOf`) devine le widget à la FORME DE LA VALEUR ; `recordNumber`
  (`CodexEdit.tsx:1823`) rend une ligne par clé DÉJÀ présente, sans compléter le vocabulaire ; `recordText` (`:1838`)
  ouvre les clés à la saisie libre ; `{M:[],F:[]}` tombe en sous-formulaire générique.

## Design

**D1 — Une primitive de grammaire, une marque.** `parMembre(vocabulaire, valeur, options?)` dans la grammaire des
valeurs rend le nœud zod et le MARQUE (même mécanisme que `marquerCollection` : une marque au nœud, lue par
co-descente, recopiée par un clone). Sans option, le nœud est `z.record(vocabulaire, valeur)`, exhaustif au parse. Une
option déclare le SENS de l'absence d'un membre, et elle est obligatoire dès qu'un membre peut manquer :
- `absent: 'sans-valeur'` : le membre n'a pas de valeur (la table du livre ne le chiffre pas) ;
- `repli: <membre>` : un membre absent prend la valeur du membre nommé, qui devient obligatoire.
Aucune autre forme d'absence : une valeur `null` ET une clé absente pour dire la même chose, c'est deux graphies.

**D2 — Le vocabulaire est UNE déclaration.** Le premier argument est une const de vocabulaire (`enumNomme` ou `z.enum`
nommé exporté), jamais un `z.enum([...])` littéral au site (garde : un `parMembre` dont le vocabulaire n'est pas une
const exportée de la grammaire est refusé à la construction ou par un test de structure, à établir en sortie).
`sexeSchema` et `charKeySchema` sont les vocabulaires uniques de leur domaine ; le doublon de `tavernGames.ts:20` meurt.

**D3 — Une seule lecture.** Un lecteur unique `valeurDuMembre(noeudOuMarque, carte, membre)` applique le sens déclaré
(repli ou absence). `racePalette` (`races/index.ts:39`), `generateName` (`engine/names.ts:33-43`) et tout lecteur qui
recode `sex === 'F' && x.F ? … : …` passent par lui.

**D4 — Le scan classe par la marque, pas par la signature.** Le lexique gagne le concept `par-membre` (strate Valeur).
Son attribut déclaré sur l'entrée du registre (#842) dit qu'il se reconnaît à la marque de nœud ; `structures-scan.mts`
reçoit, comme pour les documents embarqués (`:591-600`), l'ensemble des objets de donnée situés à un nœud marqué
(co-descente) et les classe avant tout concept à signature. Aucune signature de vocabulaire n'est recopiée dans le
lexique. Les lignes du stock hors strate de ces formes sortent par la régénération décroissante.

**D5 — L'éditeur lit la marque.** Un nœud `parMembre` se rend par UNE primitive d'éditeur : une rangée par membre du
vocabulaire, libellée par le vocabulaire (`meta.valeurs` d'`enumNomme`, ou le libellé canonique du domaine pour les
Caractéristiques), aucun ajout ni retrait de clé ; un membre absent avec `repli` montre la valeur repliée en attente ;
avec `sans-valeur`, sa rangée est vide et effaçable. `kindOf` cesse de deviner ces nœuds à la forme de la valeur.

**D6 — Migration des formes relevées.**
- `names` : `firstNames: parMembre(sexeSchema, z.array(z.string()))` remplace `maleFirstNames`/`femaleFirstNames` ;
  `lastNameSuffixes: parMembre(sexeSchema, z.array(z.string())).optional()` (nom de champ : aligné sur ses voisins
  `lastNames`/`lastNameSuffixes` du même document ; à contester en sortie si le lexique en décide autrement).
- `raceAppearance.palette`/`paletteF` : `palette: parMembre(sexeSchema, <palette>, { repli: 'M' })`, sous réserve de
  la question Q4 (fil palette des rigs).
- `details.*`, `eyes.color`, `hairs.*`, `raceAppearance.tirageIndividuel`, `careers.rand` : `parMembre` avec le sens
  d'absence que le livre établit (Q3).
- Les formes exhaustives (`species.baseChar`, `sea-weather.*`, `teintesJeu.entries`) passent de `z.record` à
  `parMembre` sans changer de donnée ; la clé externe `z.string()` de `river-navigation.windEffect` prend son
  vocabulaire (Q5).
- L'objet à 9 emplacements optionnels (`valeurs.ts:670-684`) et `lastNameSuffixes` quittent les clés écrites.

**D7 — Le niveau dataset est la même chose.** Une collection à clé dont l'ensemble des ids doit être exactement un
vocabulaire (`names.json`) se déclare à sa marque de collection (`marquerCollection(…, { vocabulaire })`), et
l'`affinerDataset` écrit à la main de `names.ts:55-67` meurt dans le même geste.

## Questions (réponse citée en sortie, jamais présumée)

- **Q1 — `raceKeySchema` est-il une copie ?** Sonde : les ids de `species.json` des races jouables contre
  `raceKeySchema.options`, et qui d'autre déclare ou vérifie cet ensemble. Si c'est une copie d'un espace d'ids, un
  `parMembre` sur les races doit-il prendre l'espace (`idDe`) pour vocabulaire, avec une exhaustivité vérifiée au
  chargement, plutôt que cimenter la copie ? Dire ce que cela coûte à D1 (un vocabulaire connu à la compilation contre
  un vocabulaire connu au chargement) et trancher.
- **Q2 — `label`/`labelF`.** `label` est la clé de résolution du document (couture label→id, `src/data/index.ts`, fiche
  `user-doctrine-ids-stables-labels-affichage`) et `labelF` sa variante d'affichage, posée par l'enveloppe unique de
  `document()`. Défaut proposé : hors du concept, parce que l'enveloppe est déclarée une fois et n'est pas au stock hors
  strate ; attaquer ce défaut au nom de la règle générale (un champ par membre nommé par suffixe est la forme que D6
  migre ailleurs).
- **Q3 — sens de l'absence, au `Source/`.** Pour chaque forme partielle relevée, le livre dit-il qu'un membre n'a pas de
  valeur, ou la donnée est-elle simplement incomplète (dette de donnée, pas sens d'absence) ? `careers.rand` porte
  `null` ET l'absence : laquelle dit quoi ? Citations verbatim, réf nue.
- **Q4 — palettes.** `palette`/`paletteF` ont des clés `z.string()` (`cheveux`, `cheveuxH`, `cheveuxO`, `peau`, …) qui
  forment un vocabulaire non déclaré (emplacement × nuance) ; ce domaine appartient au fil palette des rigs (#1903).
  Dire ce que D6 y fait sans empiéter, et ce qui part au fil #1903.
- **Q5 — vent.** `river-navigation` (`arriere, cote, contraire`) et `sea-weather` (`arriere, lateral, face`) : deux
  vocabulaires d'un même concept, ou deux tables de livres différents qui nomment différemment ? Citer les deux
  passages au `Source/` ; un seul vocabulaire si le concept est le même, deux sinon.
- **Q6 — coiffures.** Le sexe écrit trois fois par coiffure (`src/gameIso/rig/parts/hairstyles/types.ts:24`, nom de
  fichier, id, champ `sex`) n'est pas mesuré par le scan (hors des deux racines). Est-ce la même classe ? Où se solde-t-il
  (ce design, un ticket rattaché au fil #1903) ?
- **Q7 — une seule mécanique de marque.** `COLLECTIONS` (`collection-cle.ts:60`), `FEUILLES_D_ID` (`ref.ts:200`) et la
  marque neuve de D1 sont trois `WeakMap` de marques de nœud ; le design du marqueur de spécialisation (même chantier,
  en cours d'écriture) en ajoute une quatrième. Une seule co-descente les lit-elle toutes, ou chacune a-t-elle la
  sienne ? Proposer la forme qui fait coûter une ligne à la marque N+1.

## Critère N+1

Un vocabulaire neuf coûte une const ; une carte neuve par membre coûte un appel `parMembre` : ni ligne de lexique, ni
garde de synchronisation, ni widget d'éditeur, ni lecteur qui recode le repli.

## Périmètre et séquence

Atterrit sur `chantier/1473-r2` APRÈS le train C4a (qui touche `collection-cle.ts`, `gen-espaces`, `ref.ts`), dans le
même ordre que le design du marqueur. `sexeSchema` arrive par `chantier/1897-doublons-fan` : la première branche publiée
impose sa base ; ce design ne redéclare pas `sexeSchema`. Les trois sites binaires en dur signalés par le fil des sorts
(`CharacterCreator.tsx:2255`, `enemyProfile.ts:172`, `scenes/test-scenarios/magie.ts:113`) restent au fil des sorts.

## Lexique

Naissent : « vocabulaire fermé » (la const unique d'un ensemble de membres), « valeur par membre » (le concept),
« sens de l'absence » (`sans-valeur`, `repli`). Ils entrent au lexique des structures dans le commit qui pose D1.
