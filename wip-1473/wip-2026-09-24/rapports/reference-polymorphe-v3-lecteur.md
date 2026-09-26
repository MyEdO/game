# Lecteur — grounding v3 « référence polymorphe » (#1463/#1473), 2026-09-24

Arbres lus : `.wt-1473-r2v2-lecture` (61fef43d7, jugé) et `.wt-1473-r2c3` (chantier/1473-r2, même tête + diff
NON committé de C4a). Toutes les lignes citées ci-dessous sont vérifiées à `git grep`/lecture directe/sonde
`npx tsx`, sur ces deux arbres. Budget 45 min : voir « Non couvert » en fin de document.

## Q1 — Les 25 defs `niche`, leurs catégories, comptes, unicité des ids

25 fichiers de defs déclarent `edit: { niche: {...} }` (`git grep -c "niche:" src/data/schemas/defs/*.ts`
→ 25 fichiers, 1 occurrence chacun) : `artillery-misfire.ts, crew-morale.ts, crew-test-types.ts,
criticals.ts, driving-mishap.ts, drunkenness.ts, incidents-monture.ts, land-cargo.ts, mass-battle.ts,
miscast.ts, montures.ts, naval-progression.ts, obsessions.ts, problemes-vehicule.ts, rencontres-edoc.ts,
river-criticals.ts, river-perils.ts, sea-cargo.ts, sea-events.ts, ship-construction.ts, ship-criticals.ts,
structure-criticals.ts, surincantation.ts, vents-tourbillonnants.ts, weather.ts`. Confirme le chiffre 25 du
verdict.

Sur `.wt-1473-r2c3` (où `niche.categories` est déjà `Record<catégorie, suite>` — array→Record dans le diff
NON committé, cf. `git diff src/data/schemas/exposition-derivee.ts` : `for (const [cat, suite] of
Object.entries(expo.edit.niche.categories))`), ces 25 defs déclarent **53 catégories** au total (une seule
catégorie pour la plupart, jusqu'à 8 pour `criticals.ts`). Sonde `npx tsx` sur
`collectionDuDataset(cat)` (`src/data/overrides.ts:337`), pour chacune des 53 :

```
artilleryMisfire        fichier=artillery-misfire.json  suite=entries                          n=4   idsUniques=4/4
crewMoraleFactors       fichier=crew-morale.json        suite=factors                          n=28  idsUniques=28/28
crewMoraleBands         fichier=crew-morale.json        suite=bands                            n=4   idsUniques=4/4
crewTestTypes           fichier=crew-test-types.json    suite=types                            n=10  idsUniques=10/10
criticalsTete/Bras/Corps/Jambe     fichier=criticals.json  suite=[criticals-ldb-*].entries      n=20 chacune  idsUniques=20/20
aaCriticalsTete/Bras/Corps/Jambe   fichier=criticals.json  suite=[criticals-aa-*].entries       n=20 chacune  idsUniques=20/20
drivingMishap           fichier=driving-mishap.json     suite=entries                          n=4   idsUniques=4/4
drunkenness             fichier=drunkenness.json        suite=entries                          n=5   idsUniques=5/5
incidentsMonture        fichier=incidents-monture.json  suite=entries                          n=4   idsUniques=4/4
landCargo               fichier=land-cargo.json         suite=cargoes                          n=9   idsUniques=9/9
massBattlePowerEstimate/MightModifiers/WarMachines/Structures/Hazards  fichier=mass-battle.json  suites=powerEstimate/mightModifiers/warMachines/structures/hazards  n=5/9/10/5/10  idsUniques OK
miscastMinor            fichier=miscast.json  suite=[miscast-mineure].entries   n=20  idsUniques=20/20
miscastMajor            fichier=miscast.json  suite=[miscast-majeure].entries  n=20  idsUniques=20/20
miscastWrath            fichier=miscast.json  suite=[miscast-colere].entries   n=31  idsUniques=31/31
montures                fichier=montures.json  suite=entries                  n=8   idsUniques=8/8
navalProgression        fichier=naval-progression.json  suite=entries         n=5   idsUniques=5/5
obsessions              fichier=obsessions.json  suite=entries                n=19  idsUniques=19/19
problemesVehicule       fichier=problemes-vehicule.json  suite=entries        n=4   idsUniques=4/4
rencontresPositives/Fortuites/Dangereuses  fichier=rencontres-edoc.json  suites=tables.positives/fortuites/dangereuses  n=7/10/9  idsUniques OK
riverCriticalsGreement/Avirons/Gouvernail/Coque/Superstructure  fichier=river-criticals.json  suites=tables.*  n=1 chacune  idsUniques=1/1
riverPerils             fichier=river-perils.json  suite=perils               n=4   idsUniques=4/4
seaCargo                fichier=sea-cargo.json  suite=cargoes                 n=13  idsUniques=13/13
seaManannFactors/BoardEvents/PortEvents  fichier=sea-events.json  suites=manann.factors/boardEvents/portEvents  n=26/40/18  idsUniques OK
shipHullSizes/SpeedTraits/ConstructionTraits  fichier=ship-construction.json  suites=standard/speedTraits/constructionTraits  n=7/7/4  idsUniques OK
shipCriticalsCargaison/Greement/Coque/Avirons/Equipements  fichier=ship-criticals.json  suites=tables.*  n=5/10/10/5/5  idsUniques OK
structureCriticals      fichier=structure-criticals.json  suite=entries       n=8   idsUniques=8/8
surincantation          fichier=surincantation.json  suite=entries            n=7   idsUniques=7/7
ventsTourbillonnants    fichier=vents-tourbillonnants.json  suite=entries     n=5   idsUniques=5/5
weather                 fichier=weather.json  suite=seasons                  n=4   idsUniques=4/4
weatherConditions       fichier=weather.json  suite=conditions               n=6   idsUniques=6/6
```

**Toutes les 53 catégories résolvent sans erreur** (`err=` vide sur chaque ligne) via `DATASET_FICHIER_DERIVE`
+ `DATASET_SUITE_DERIVE` + `collectionALaCle` (`src/data/schemas/exposition-derivee.ts`,
`src/data/overrides.ts:337-342`) : dans CET arbre C4a, la carte `niche.categories` fournit déjà un chemin
mécanique fichier→collection pour les 25 defs. **Chaque catégorie a des ids UNIQUES en son sein** (colonne
`idsUniques` = n/n partout).

**Unicité DANS LE FICHIER (inter-catégories)** : sonde inter-catégories groupée par `DATASET_FICHIER_DERIVE[cat]`
— **aucune collision** d'id entre catégories d'un même fichier (0 collision trouvée sur les 53 catégories).

**Unicité DANS TOUT `src/data` (inter-fichiers, ids niche seulement)** : **6 collisions mesurées** —
```
produits-de-luxe  [ 'landCargo', 'seaCargo' ]
bois              [ 'landCargo', 'seaCargo' ]
vin               [ 'landCargo', 'seaCargo' ]
laine             [ 'landCargo', 'seaCargo' ]
commerce          [ 'landCargo', 'seaCargo' ]
tempete           [ 'massBattleHazards', 'seaPortEvents' ]
```
Un même id (`tempete`, `bois`…) est donc porté par DEUX catégories `niche` distinctes, dans DEUX fichiers
différents. Non couvert : collisions avec les ids des catégories NON-`niche` (`skills.json` etc.) — sonde non
lancée faute de temps.

**Ids écrits en donnée, jamais calculés au chargement.** Vérifié sur `criticals.json` (`"id":
"blessure-spectaculaire"` en dur dans chaque rangée, `src/data/criticals.json`) et `miscast.json` (idem, +
`"codexCategory": "miscastMinor"` littéral au niveau du DOCUMENT-table `miscast-mineure`,
`src/data/miscast.json`). Aucun calcul d'id observé à la lecture des 25 schémas de defs (les schémas
`z.strictObject({ id: z.string(), ... })` valident un id PORTÉ par la donnée, jamais dérivé).

## Q2 — Qui désigne une ligne, et comment

- **`STAKE_ENTRY_POOLS`** (`src/data/index.ts:440-480`) : `Record<catégorie, (id)=>boolean>` — un prédicat
  d'appartenance par catégorie (25 catégories `niche` + `mutations`, `interludeEvents`, `tavernGames`,
  `talents`, `traits`… non-`niche`). Consommé par `entryCategoryOf`/`entryRule` (`index.ts:544-563`) : « la
  clé (id de ligne) figure-t-elle dans la catégorie » — jamais une résolution vers une fiche, une simple
  garde d'existence avant de VERSER l'enjeu à la ligne.
- **`STAKE_ENTRY_CATALOG`** (`index.ts:519-530`) : table des PORTES catégorie-par-`kind` (déclarative pour
  `diseaseTick`/… + dérivée de `flowStakesJson`/`combatStakesJson` filtrés sur `entryCategory`). Lu par
  `entryCategoryOf` (`index.ts:544-550`) — porte (a) déclarative, priment sur (b) dynamique bornée
  (`key.entryCategory` validé contre `STAKE_ENTRY_POOLS`), elle-même sur (c) `entryFromSource` (la
  catégorie ne se connaît qu'au runtime, tirée de `CATEGORY_BY_SOURCE_KIND`).
- **`EffectSourceKind`** (`src/engine/types.ts:676-683`) : vocabulaire fermé des NATURES de source d'un
  effet, incluant `miscastMinor|Major|Wrath` — porte un `kind` (pas un id de ligne).
  **`CATEGORY_BY_SOURCE_KIND`** (`types.ts:687-693`) : `Record<EffectSourceKind, string>` — pour
  `miscastMinor` la valeur est le littéral `'miscastMinor'` (IDENTITÉ, pas une dérivation). Lu par
  **`effectRef`** (`types.ts:737-740`) : `{ category: CATEGORY_BY_SOURCE_KIND[e.source.kind], id:
  e.source.id }` → rend un `CodexTarget` que le lecteur (UI, `ModLine.ref`) transforme en chip cliquable
  ouvrant la page Codex.
- **`TableStepDef.entryCategory`** (`src/state/cascade.ts:233-239`) : champ optionnel d'une table de tirage
  déclarant la catégorie Codex de SES lignes (« un même `kind` d'étape tire sur N tables : une Blessure
  critique se joue sur celle de SA Localisation »). Lu pour faire DESCENDRE l'enjeu à la ligne jouée après
  tirage (`stakeAtTableRow`).
- **`CRIT_TABLE_CATEGORIES`** (`src/state/combatFlow.ts:1640`) : `Record<CritTableKey, string>` (littéral,
  table→catégorie codée en dur : `{ tete: 'criticalsTete', … }`).
- **`critEntryCodexCategory`** (`src/engine/critical.ts:153-155`) : fonction PURE `(table, jeu) =>
  '${jeu==='aa'?'aaCriticals':'criticals'}${Seg}'` — reconstruit le nom de catégorie par concaténation de
  chaînes, branche ternaire sur `jeu`.
- **`shipCritEntryCodexCategory`** (`src/engine/shipCritical.ts:52-53`) : même patron, `SHIP_CRIT_CODEX_SEGMENT`
  (`shipCritical.ts:48-51`) + `setId === RIVER_CRIT_SET.id ? 'riverCriticals' : 'shipCriticals'`. Son
  lecteur, `enjeuDuCoup` (`shipCritical.ts:59-61`), verse `{entryId, entryCategory}` à `combatStakeRef`
  (porte (b) dynamique de `entryCategoryOf`).
- **`MISCAST_ROW_CATEGORY`** (`src/engine/miscast.ts:395-398`) : `Record<MiscastSeverity, string>` littéral
  (`mineure→miscastMinor`…), porte (b) déclarée.
- **`MiscastTableDef.codexCategory`** (champ de donnée, `src/data/miscast.json` : `"codexCategory":
  "miscastMinor"` au niveau document) : relu par `miscastRowSource`/`estSourceKind`
  (`src/engine/miscast.ts:355-363`, non vérifié ligne exacte — cité au verdict, à recontrôler) et par
  `src/gameIso/effectIcons.ts:214`.
- Littéraux de catégorie hors de ces tables (verdict, non revérifiés par moi faute de temps) :
  `combatFlow.ts:1890,4227` (`'structureCriticals'`), `corruptionFlow.ts:163,188` (`'mutationTables'`,
  `'mutations'`), `interludeFlow.ts:141` (`'interludeEvents'`), `turnHooks.ts:111`.

Ce que chaque lecteur en fait, résumé : `STAKE_ENTRY_POOLS`/`STAKE_ENTRY_CATALOG` → RÉSOUT si une ligne
existe et verse l'enjeu à sa catégorie (`src/data/index.ts`, consommé par `src/state`) ; `effectRef` →
construit un `CodexTarget` pour AFFICHER une chip/pastille cliquable (`src/gameIso/effectIcons.ts`,
`src/ui`) ; `critEntryCodexCategory`/`shipCritEntryCodexCategory`/`MISCAST_ROW_CATEGORY` → PRODUISENT le nom
de catégorie consommé en amont par les deux précédents.

## Q3 — Les sous-espaces (`idDe(type, valeur)`, `cleDeSousListe`) ; la grammaire des clés d'espace

Seul le type `material` emploie une sous-liste discriminée (`git grep "idDe('material'," src` — 8 sites :
`defs/terrains.ts:65` (`'relief'`), `defs/props.ts:34,39,41` (`'prop'`), `defs/buildings.ts:34` (`'roof'`),
`defs-scenes/scene.ts:266,275` (`'roof'`, `'relief'`)). `prop` s'emploie aussi SANS sous-liste
(`idDe('prop')`, `terrains.ts:63`, `defs-scenes/scene.ts:165` — type d'entité DÉCOR, homonyme lexical de la
sous-liste `material→'prop'`, à ne pas confondre).

`cleDeSousListe(type, valeur, site)` (`src/data/schemas/grammaire/ref.ts:105-115`) : résout la clé d'espace
`<espace>?<champ>=<valeur>` en lisant le CHAMP DISCRIMINANT unique déclaré au def (`espace.discriminant`,
`src/data/schemas/defs/materials.ts:150` : `espace: { discriminant: 'domain', chargeParDiscriminant }`) —
lève si le def a 0 ou 2+ champs discriminants (`ref.ts:126-128`).

**Coût d'une sous-liste de plus** : ZÉRO ligne de code une fois le `discriminant` posé au def — une valeur
de plus du champ `domain` dans `materials.json` (donnée) ouvre l'espace `materials.json?domain=<valeur>`
automatiquement (la phase 2 `gen-espaces.mts` le mesure). Le coût de CODE est celui, unique, du paramètre
`espace.discriminant` sur LE def porteur (`materials.ts:150`) — pas par sous-liste.

**La grammaire des clés d'espace sait-elle désigner « toutes les lignes de toutes les tables d'un fichier » ?
NON, prouvé.** `cle-d-espace.ts:1-11` : une clé est `fichier` (racine) ou `fichier#<suite>`
(`suiteAvecPas`/`pasDeLaSuite`, un pas = `.champ`, `[cle]` d'UN élément nommé, ou `[]` = « rang », un point
SOUS une liste NON marquée). Aucune forme n'exprime une UNION à travers plusieurs `[cle]` frères (ex. tous les
`entries` des 8 documents de `criticals.json` réunis) : chaque table (`criticalsTete`, `aaCriticalsBras`…)
a SA propre clé `[<id-du-document>].entries`, une par table (8 pour `criticals.json`, cf. Q1).

**`collectionALaCle` REFUSE `[]` explicitement**, prouvé par sonde directe :
`collectionALaCle(criticalsSchema, criticalsData, '[].entries')` →
`LÈVE: collectionALaCle : « [].entries » porte un pas « [] », qui ne désigne pas UN point.`
(source du refus : `src/data/schemas/grammaire/collection-cle.ts:290`, fonction `atteindre`, garde
`if (pasDeLaSuite(suite).some((pas) => 'rang' in pas)) leve(...)`). Le pas manquant serait donc une forme de
QUANTIFICATEUR (« pour chaque `[cle]` de ce niveau, prends `.entries` ») que la grammaire actuelle n'a pas :
elle n'adresse qu'UN point de donnée par clé (`atteindre`, doc `collectionALaCle.ts:280-283` : « LÈVE …
plusieurs points de la donnée ont cette suite »).

## Q4 — La page d'une entité (arbre C4a)

Le Codex ouvre une page via un couple `{category, id}` (`CodexTarget`, cf. `effectRef` en Q2) — la
catégorie est TOUJOURS fournie explicitement par le producteur (jamais dérivée depuis l'id seul) : ni
`effectRef`, ni `entryCategoryOf`, ni les 42 sites UI cités plus bas ne partent d'un id nu pour deviner sa
catégorie.

**La carte `niche.categories` (C4a) permet-elle de dériver « la catégorie dont la collection contient CET
id » ?** Non testé en sens inverse (id→catégorie) : `CATEGORY_DATASET_DERIVE`/`DATASET_SUITE_DERIVE` vont
catégorie→collection, jamais collection→catégorie-par-id. Un tel dérivé devrait itérer les 53
`collectionDuDataset(cat)` et chercher l'id — coûteux, et **ambigu** : voir collisions Q1 (`tempete` dans
`massBattleHazards` ET `seaPortEvents`), donc une dérivation naïve id→catégorie serait FAUSSE (2
candidates) pour au moins 6 ids niche mesurés. **Un même id PEUT donc être dans deux catégories, prouvé.**

**Les 42 catégories écrites à la main** (verdict, bloquant 11), recomptées : `grep -c "t: 'ref', category"
src/ui/compendium/opRows.ts` = 28, `registry.ts` = 12, `describe.ts` = 2 → **42 confirmé**. Sites : chaque
occurrence pose `{ t: 'ref', category: '<littéral>', id: <champ> }` à partir d'un TYPE DE CHAMP connu
statiquement (ex. `opRows.ts:95` `category: 'psychologies'` déduit du fait que le champ lu est
`o.psychType`). `src/ui/PossessionsRegistry.tsx:87` `codexRefOf` écrit `'creatures'`/`'vehicles'` en dur
selon la présence de `creatureId`/`vehicleId`. Non départagé faute de temps : lesquelles des 42 sont
dérivables mécaniquement de `TYPES`/`CATEGORY_DATASET_DERIVE` vs. lesquelles portent une catégorie `niche`
(donc hors de `TYPES`, cf. Q1) et resteraient un cas à part quel que soit le design.

## Q5 — La couche : modules `src/engine` producteurs d'une catégorie Codex

Producteurs identifiés en Q2 côté `src/engine` : `critical.ts` (`critEntryCodexCategory`),
`shipCritical.ts` (`shipCritEntryCodexCategory`), `miscast.ts` (`MISCAST_ROW_CATEGORY`), `types.ts`
(`CATEGORY_BY_SOURCE_KIND`, `effectRef`).

**Consommateurs de `effectRef`/`CATEGORY_BY_SOURCE_KIND`** (moteur = `src/engine`) : la table sert DEUX
lecteurs déclarés au commentaire (`types.ts:686-688`) — `chipCodex` (`src/gameIso/effectIcons.ts`, AFFICHAGE)
et « la descente de l'ENJEU d'un jet à l'entité qui l'exige » côté `src/state` (#1117). Le moteur lui-même
(collecteurs `conditions.ts`, `trauma.ts` cités au verdict) consomme `effectRef` pour construire un
`ModLine.ref: CodexTarget`, PAS pour ouvrir une page — la page est ouverte plus tard, côté `src/ui`
(`RollLine.tsx`, cité en commentaire `types.ts:713`). **Le moteur a donc besoin de la RÉFÉRENCE
(`{category,id}`), jamais de la page elle-même** — confirmé par le commentaire de `ModLine.ref`
(`types.ts:711-713` : « L'affichage en fait une chip liée au Codex … ; le moteur ne la lit jamais »).

**Table GÉNÉRÉE pure, sans import, patron `IDS_PAR_ESPACE`, lue par le moteur** : non trouvée pour « catégorie
Codex d'un `EffectSourceKind` » — `CATEGORY_BY_SOURCE_KIND` est un `Record` MANUSCRIT dans `types.ts`, pas
un fichier `_xxx.generated.ts`. Recherche `git grep -n "generated" src/engine` : non lancée faute de temps
(non couvert) ; `IDS_PAR_ESPACE` lui-même (`src/data/schemas/_ids.generated.ts`) est importé par
`grammaire/ref.ts`, PAS par `src/engine`.

## Q6 — Les termes

**« foyer »** : `git grep -rn -i "\bfoyer" src scripts` (hors `.generated.`) → 248 occurrences non-test.
Sens distingués, mesurés :
  1. **« foyer de règle »** (dominant) — l'entité qui PORTE une règle/un effet, ex. `src/data/index.ts:219`
     (« FOYER de la règle derrière l'étape : l'id de l'ENTITÉ qui la porte »), `:222,236,239,246,276,395,432,438,449`
     ; `src/ui/StakeNote.tsx:25`, `src/ui/CombatConsole.tsx:873,1137` (non revérifiées ligne à ligne, comptage
     brut `-i "foyer de règle\|le FOYER"` = 37 occurrences).
  2. **« foyer de lampe »** — la primitive volumique d'où part la lumière d'un décor : `foyerDe`
     (`src/state/vision.ts:228`, fonction), doc en tête `src/data/props.types.ts:12` (« le FOYER d'une
     lampe … → `foyerDe` »), `:122-125,575-584`.
  3. **`reference.ts:60-61`** — `regleOptionnelle: { espace: 'reglesOptionnelles.json', … }`
     (`src/data/schemas/grammaire/ref.ts:59-61`) : le mot « règle » y est un TYPE d'entité (Règle
     optionnelle), sens encore distinct des deux précédents (verdict le compte comme 2 sens connus ; j'en
     confirme 2 DE PLUS, non comptés par le brief : « foyer de règle » et « foyer de lampe »).

**Le terme de formule `{rule}`** : distinct de « foyer ». Se lit dans `Formula` (grammaire des valeurs) —
`src/data/schemas/grammaire/valeurs.ts:713-716` (feuille `refRegleOptionnelle = idDe('regleOptionnelle')`,
instanciée une fois). Désigne la VALEUR NUMÉRIQUE d'une règle optionnelle maison substituable dans une
formule (ex. une fenêtre de temps non chiffrée par le RAW). Sites de lecture : `src/engine/ops.ts:53,182,221`
(commentaire : « `{rule}` la valeur de la règle »), `src/engine/policy.ts` (import `rule`, module feuille du
registre des règles optionnelles), `src/engine/activities.ts:264,342`, `src/data/schemas/defs/activities.ts:139`,
`src/state/activityWorldRolls.ts:7,41`, `src/ui/editor/GameOpEditor.tsx:239,394`,
`src/ui/compendium/StructFields.tsx:877` (`RuleValueField`).

**Candidats de nom pour le RÔLE « entité dont un enjeu/effet applique la règle »**, avec sonde de collision
(aucun n'est une clé de `TYPES` — liste complète Q3/vérifiée : `skill, talent, trait, trapping, spell,
creature, vehicle, structure, career, species, navalTrait, navalPort, shipStation, crewRole, table, etat,
maladie, symptome, material, regleOptionnelle, terrain, lightLevel, prop, building, axe` — ni un `id` du
lexique `CONCEPTS`, `scripts/docs/lib/structures-lexique.mts:275-437` parcouru) :
  - **`porteur`** — `git grep -rn -i "\bporteur\b" src scripts` (hors `.generated.`) → **2685 occurrences**.
    Terme déjà massivement en usage INFORMEL dans les commentaires (« l'entité qui la PORTE », « le porteur
    ADRESSÉ de la prose »…) sans être un `id` de concept du lexique — collision de SENS forte, pas de collision
    de TYPE.
  - **`titulaire`** — 15 occurrences (`grep -rn -i "\btitulaire\b"`), non recensées ligne à ligne (non
    couvert). Collision faible.
  - **`détenteur`** — 17 occurrences. Collision faible, non recensées ligne à ligne (non couvert).
  - **`émetteur`/`emetteur`** — 0 occurrence. Aucune collision mesurée.
  - **`hôte`** — 1111 occurrences (très chargé — vérifié en vrac, sens dominant NON examiné faute de temps ;
    risque de collision élevé mais NON QUALIFIÉ, à revérifier avant tout choix).
  - **`origine`** — 531 occurrences, sens dominant non examiné (non couvert).

## Non couvert (périmètre non atteint dans les 45 min)

- Q1 : collisions d'id niche vs. catégories NON-niche (skills.json, etc.) sur tout `src/data`.
- Q2 : lignes exactes de `miscastRowSource`/`estSourceKind` (`miscast.ts:355-363` cité au verdict, non
  rouvert) ; les littéraux `combatFlow.ts:1890/4227`, `corruptionFlow.ts:163/188`, `interludeFlow.ts:141`,
  `turnHooks.ts:111` (repris du verdict, non revérifiés par moi).
- Q4 : départage des 42 catégories UI (dérivables vs. non) un par un ; les 13 lecteurs de `CodexTarget`
  (dont `effectIcons.ts`, cité par le verdict comme omis d'un compte antérieur) non relus intégralement.
- Q5 : recherche exhaustive `src/engine/*.generated.ts` / patron `IDS_PAR_ESPACE` côté moteur (partielle :
  confirmé que `IDS_PAR_ESPACE` n'est PAS importé par `src/engine`, mais pas cherché d'équivalent generated
  propre au moteur).
- Q6 : `titulaire`/`détenteur`/`hôte`/`origine`, occurrences non triées par sens ; aucun autre candidat
  (`porte-parole`, `mandant`…) sondé faute de temps.
- Le contenu intégral du verdict (bloquants StakeKey/catalogStakeSchema, cycle d'import P3, homonymes
  `regle`) n'a été REVÉRIFIÉ QUE partiellement (Q2 producteurs + Q4 42 catégories UI) ; le reste est repris
  tel quel depuis `verdict.json`, sourcé par les sondes du juge, non rejoué par moi.
