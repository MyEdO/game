# #1463 · concept RÉFÉRENCE — design v4 du lot R2 (2026-09-24) : une CO-DESCENTE schéma + donnée, seule lecture des collections à clé

Rattachement : #1473 « [#1463 solde] Refs validées AU PARSE contre le registre d'ids généré (livré par #1466 ref(type) +
#1468 OP_DEFS) — ce ticket solde les 12 gardes FK nominatives concept par concept (L2/L3) et gameOpRefFk.mjs ». Base :
brief v3.2 (`/mnt/project-files/dettes/1463-r2v3-brief.md`, #1473 issuecomment-5807651639). E1-E6 (C1 `b32eb1bc3`, C2
`d870e34f3`, CI verte) et E10 restent ceux de la v3.2 ; la v4 remplace E4 (mesure au parse en mode `espaces`), E7, E8
et E9.

**Historique.** C3 (E7-E9 de la v3.2) s'est arrêté sur trois contradictions ; l'amendement v3.3
(`/mnt/project-files/dettes/1463-r2v33-amendement.md`) a été RÉFUTÉ (six bloquants,
`/mnt/project-files/dettes/1463-r2v33-juge.md`), et le rendu partiel C3a aussi (juge de diff, cinq bloquants :
glob hors Vite, régime vivant et index divergents sur 26 des 358 espaces, ordre des pools, identité non gardée,
preuves par mutation périmées). Les deux réfutations portent sur la même classe : COMMENT une donnée (disque, vivante,
scannée, en cours d'édition) retrouve ses collections le long de son schéma. La v4 remonte d'un niveau : cette
navigation existe quatre fois ; il en faut une.

**Base.** `chantier/1473-r2`, tête `d870e34f3`. Le diff C3a n'est pas committé ; il est conservé en patch
(`/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/r2c3/c3a.patch`) et ses éléments
réutilisables sont nommés en D12. Les lignes citées sont celles de `d870e34f3` sauf mention « C3a » : dans l'arbre de
travail `.wt-1473-r2`, les 16 fichiers du diff C3a (`git diff --stat`) sont modifiés, et leurs lignes citées se
lisent par `git show d870e34f3:<chemin>`.

Consigne de l'utilisateur, 2026-09-23 : « Fais les choses bien, le but n'est pas que vider la dette a 0, mais aussi
régler les mauvaises décisions découvert en chemin fait par un model des anciennes générations pour une structure plus
adapté ».

## Invariant

1. « Une garde de synchronisation est un smell : une seule source de vérité. » (`.claude/credo.md`, puce « Règles
   GÉNÉRALES »). Question : combien de mécanismes retrouvent « les collections à clé d'un document, leur clé et leur
   valeur » ? Aujourd'hui QUATRE, qui ne traversent pas les mêmes nœuds :
   - le parse de mesure en mode `espaces` (`grammaire/ref.ts:407-428`, `marquerCollectionAtteinte` `:303-306`,
     `scripts/docs/lib/slots-registre.mts:139-155` `collectionsDuDocument`, `pathNormalise` `:66-83`), lu par la
     phase 2 (`scripts/gen-espaces.mts`) ;
   - `lieuDe` (`src/data/schemas/validate.ts:63-84`), co-descente écrite à la main sur `ouverts` et
     `enfantsParSegment` (`:44-61`), qui traverse `''` et `|N` mais pas `&N`, et admet `.clé`/`{}` mais pas `.*` ;
   - `collectionALaCle` (C3a, `collection-cle.ts`), co-descente sur `aTraversLesEnveloppes` et `parSegment`, qui
     traverse `''`, `|N` et `&N` et admet `.*` ;
   - les tables d'édition écrites à la main (`ARRAYS`, `OBJECTS`, `NESTED_ARRAY_ROOT`, `src/data/overrides.ts`) et
     l'heuristique de la passe 3 du scan (`scripts/docs/lib/structures-scan.mts:590-602`, sur la marche maison `:420`).
2. `src/data/schemas/grammaire/descente.ts:1-3` : « DESCENTE d'un schéma zod 4.4.3 composé — la seule lecture de la
   forme d'un nœud (`defDe`), de ses enfants (`enfantsDe`) et du parcours de son arbre (`descendre`). » Question : où
   se lisent les enfants d'un nœud, et à travers quelles enveloppes un pas de donnée passe-t-il ? En un seul endroit.
   Contre-exemples : les deux jeux de traversée divergents de l'Invariant 1 ; `scripts/guards/lib/fieldConsumerTargets.mjs:57,60`
   et `src/data/schemas/grammaire/document.ts:326` lisent `_zod.def` sans `defDe`.
3. `src/data/schemas/grammaire/collection-cle.ts:1-3` : « COLLECTION À CLÉ (#1897, #1463) — une collection dont chaque
   élément a une IDENTITÉ, DÉCLARÉE au nœud qui la porte, jamais devinée. » Question : qui dit qu'une valeur est un id ?
   La marque, lue au nœud. Contre-exemple : la passe 3 du scan, qui devine.
4. `src/data/schemas/grammaire/ref.ts:402-404` : « La donnée doit être VALIDE au parse normal, et c'est ce parse,
   exécuté HORS de la fenêtre de mesure, qui en juge » ; `:414-417`, un échec du parse normal LÈVE. Question : une
   mesure portée par le parse voit-elle les collections d'un arbre invalide ? Non (sonde du juge v3.3,
   `scratchpad/juge-v33/sonde-zod-abort.mjs` : zod 4.4.3 saute le `superRefine` d'une collection dont un élément porte
   une issue non continuable). Or deux lecteurs rencontrent des arbres invalides PAR CONSTRUCTION :
   `src/ui/compendium/CodexEdit.tsx:596-598` (« la pose est donc TRANSACTIONNELLE (#1530) — au refus, l'état d'avant
   est REPRIS »), qui pose l'entrée (`:601`) avant `validateDataset` (`:606`) ; et le scan, qui observe des copies
   modifiées (`src/data/structures-contrat.test.ts:1695-1780`).
5. `src/data/schemas/grammaire/idsVivants.ts:9-11` : « `_registry.generated.ts` importe les defs, qui appellent `idDe`
   à l'initialisation — lire le registre depuis `ref.ts` fermerait le cycle ». Question : qui peut importer les defs
   et les racines ? La couche donnée (`overrides.ts`), qui POSE la source du régime vivant ; `idsVivants.ts` reste une
   feuille.

## Cas canonique déjà couvert

- `enfantsDe` (`descente.ts:62-90`) : les enfants d'un nœud et le SEGMENT de chacun (`.clé`, `.*`, `[]`, `{clé}`,
  `{}`, `|N`, `&N`, `[N]`, `[...]`, `''`). `descendre` (`:98-116`) : le parcours d'un arbre de SCHÉMA seul.
- `lieuDe` (`validate.ts:63-84`) : la première co-descente schéma + donnée, le long d'un chemin d'issue ; elle lit la
  marque d'une liste (`collectionDe`) pour nommer un élément par sa clé.
- `collectionDe`, `marqueDeListe`, `marqueDeRecord` (`collection-cle.ts:69-80`, `:173`) : la marque et la lecture de
  la clé d'un élément brut. `idsDeCollection` (`collection-cle.ts:83-87` ; C3a le déplace dans
  `grammaire/cle-d-espace.ts`, où il devient le seul lecteur des ids d'une collection, point NB4 tenu par le juge de
  C3a).
- `memoParVersion` (`src/data/versionDataset.ts:60-79`) : le mémo par version d'une ou plusieurs clés de dataset.

Le nouveau cas est une INSTANCE du premier : la co-descente est `enfantsDe` appliqué ensemble au nœud de schéma et au
nœud de donnée, ce que `lieuDe` fait déjà pour un chemin ; la v4 en fait LA primitive et y range les quatre lecteurs.

## Constat (mesures du 2026-09-24)

- **Unions** (lecteur v4, sonde `scratchpad/lecteur-v4/scan-a1.mts` sur les 122 racines de `SCHEMA_DEFS` et les 4 de
  `SCHEMA_DEFS_SCENES`) : 2 collections marquées sous une union, toutes deux dans les scènes, toutes deux sous des
  `z.discriminatedUnion` : `.scenes[].entities[]|0.usable.actions` (`defs-scenes/scene.ts:133`, sous
  `sceneEntitySchema`, `:162-190`, discriminant `kind`) et `.scenes[].triggers[].flow|1.effect|51.foes`
  (`defs-scenes/effets.ts:532`, sous `sceneFlowSchema` `:694-711` et `effectSchema` `:626-679`, discriminants `kind`
  et `type`, `lazy`). Aucune sous une union simple. zod 4.4.3 choisit la branche d'une union discriminée par
  `def.discriminator` et retombe sur l'essai des branches quand la valeur manque
  (`node_modules/zod/v4/core/schemas.js:1171-1187`).
- **Clés de dataset persistées** : aucune (lecteur v4, B). `SaveGame` (`src/state/saves.ts:149-155`) n'en porte pas ;
  les clés sont des littéraux de configuration d'UI (`RefField.tsx`, `CodexEdit.tsx:82-86`).
- **Forme vivante** : `materialiser` (`scripts/source/resoudre.mjs:68-94`) injecte `desc` au chargement de tout nœud à
  `descRef` (plugin `scripts/source/prose-source-plugin.mjs:152`) ; `versDisque` (`grammaire/prose.ts:137-151`) l'en
  retire, appelé par `datasetSerializeRoot` (`overrides.ts:368`) et `datasetObjectSerializeRoot` (`:376`). `desc` est
  déclaré optionnel au schéma (`prose.ts:34-37`).
- **Écrivains du seam** : 4 appelants de production, tous dans `CodexEdit.tsx` (`:418`, `:434`, `:608`, `:609`), à clé
  DYNAMIQUE ; ~118 appels dans des tests. Lecteurs à clé littérale : `src/ui/compendium/registry.ts` (53),
  `src/ui/EtatPanel.tsx:243`.
- **Types des 20 clés que le juge v3.3 disait sans export typé** (lecteur v4b) : 17 ont un type exporté (`CritEntry`
  `src/data/criticals.ts:25` pour les 8 critiques ; `TravelTableEntry` `src/engine/travelTables.ts:40` pour les 3
  rencontres ; `MishapEntry` `src/engine/drivingMishap.ts:22` ; `DrunkEntry` `src/engine/drunkenness.ts:53` ;
  `MiscastRowEntry` `overrides.ts:86` ; `TraumaFicheEntry` `overrides.ts:107`) ; 3 liaisons n'appliquent pas le type
  qui existe ailleurs (`advancementCosts` ← `AdvanceCostBand` `src/engine/advancement.ts:34` ; `encumbranceTiers` ←
  `src/engine/encumbrance.ts:26-43` ; `surincantation` ← `SurincantationData` `defs/surincantation.ts:46`, seul type
  inféré du schéma). Doubles sources : traumas (`TraumaFicheEntry` contre `TraumaFiche`, `src/engine/trauma.ts:90-101`,
  qui porte en plus `type` et `cumul` ; le commentaire `overrides.ts:103-105` dit `TraumaFiche` « module-privé », il
  est exporté) ; miscast à trois types (`MiscastRowEntry`, `JsonRow` non exporté `src/engine/miscast.ts:148-157` avec
  `entries` récursif, `MiscastTableRow` `:308-313` sous-ensemble).
- **Datasets-objets** : chacun est la racine de son fichier par construction (`exposition-derivee.ts:110-119`, garde
  `keys.length !== 1`) ; la route se lit à `OBJECT_CATEGORY_DERIVE` (`:151`, `mode`).
- **Coût** de la mesure au parse : 687 ms pour les 124 defs en Node (juge v3.3, N9).
- **Autres lecteurs de schéma** (lecteur v4b, E1) : `zod-introspect.mts` et `build-structures.mts` lisent le schéma
  SEUL par `enfantsDe`/`descendre` (hors sujet) ; la marche du scan (`structures-scan.mts:420`) lit la donnée SEULE
  (côté OBSERVÉ, hors sujet, sauf son index des ids) ; `scripts/migrations/lib/` et `scripts/guards/lib/lister.mjs` ne
  lisent aucun schéma. `validate.ts` porte la co-descente `lieuDe` et un parcours schéma seul (`noeudObjet`, `:155-162`,
  sur `descendre`).

## Design proposé

- **D1. La co-descente, une primitive.** Dans `grammaire/descente.ts`, à côté d'`enfantsDe` :
  - `ouverts(noeuds, valeur?)` : la fermeture d'un ensemble de nœuds par leurs enfants TRANSPARENTS pour un même pas
    de donnée : `''` (optionnel, nullable, défaut, lecture seule, `lazy`, côtés d'un `pipe`), `&0`/`&1` (les deux
    côtés d'une intersection s'appliquent à la même valeur), `|N` (branches d'union). Une union DISCRIMINÉE ne garde
    que la ou les branches dont la valeur du discriminant (`_zod.propValues[def.discriminator]`) contient celle de la
    donnée ; sans valeur lisible, toutes (même repli que zod, `schemas.js:1175-1187`). Une union simple garde toutes
    ses branches. Sans `valeur`, la fermeture est celle du schéma seul (usage de construction, `noeudsDeCle`).
  - `pasDeDonnee(noeuds, cle)` : les nœuds d'un enfant de donnée. Une clé de propriété `k` passe par `.k`, `{}`
    (valeur de record) ou `.*` (clé hors `shape`) ; un rang `i` passe par `[]`, `[i]` ou `[...]`.
  - `coDescendre(schema, donnee, visite)` : parcours de la DONNÉE, qui présente à chaque nœud de donnée ses nœuds de
    schéma (`ouverts`), sa valeur et son chemin de donnée (`(string | number)[]`) ; `visite` peut élaguer. Elle ne
    VALIDE PAS : une clé que le schéma ignore donne un ensemble vide et la descente s'y arrête. Elle termine parce que
    la donnée est finie (un `lazy` récursif ne boucle pas).
  - Leurs lecteurs : `lieuDe` (`validate.ts`, ses `ouverts`/`enfantsParSegment` meurent), `noeudsDeCle`
    (`collection-cle.ts`, son `parSegment` meurt), D2. `fieldConsumerTargets.mjs:44-61` (`fieldsOf`) et
    `document.ts:326` lisent par `defDe`/`enfantsDe` (Invariant 2).
- **D2. Les collections d'un document.** Dans `collection-cle.ts` :
  - `collectionsDuDocument(schema, donnee)` : `coDescendre` + `collectionDe` sur les nœuds ouverts de chaque point de
    donnée. Rend, pour chaque collection marquée présente : sa SUITE (la clé relative au document, graphie de
    `grammaire/cle-d-espace.ts` : `.champ` pour une propriété, `[clé]` pour un élément d'une liste marquée lue par sa
    marque, `[]` pour un élément d'une liste non marquée), sa marque, sa valeur, ses ids (`idsDeCollection`). Un
    espace de noms (marque `espace`) sous un pas `[]` LÈVE en nommant la liste (règle de C2, `slots-registre.mts:145-151`) ;
    deux marques DIFFÉRENTES sur les nœuds d'un même point de donnée LÈVENT (ambiguïté).
  - `collectionALaCle(schema, racine, suite)` : la même descente GUIDÉE par une suite (elle ne suit que ses pas), mêmes
    primitives ; LÈVE si la suite ne mène à aucune collection marquée ; une collection absente de la donnée rend
    `valeur: undefined`.
  - Garde : un test de contrat parcourt les racines de `SCHEMA_DEFS` et `SCHEMA_DEFS_SCENES` (`descendre`) et refuse
    toute collection marquée dont le chemin de schéma traverse une union SIMPLE (promotion de `scan-a1.mts`) : la
    branche d'une union simple n'est pas désignée par la donnée.
- **D3. Phase 2 sur la co-descente.** `scripts/gen-espaces.mts` lit `collectionsDuDocument` sur le JSON disque de chaque
  document de `SCHEMA_DEFS`, sans parse. Un espace neuf et son premier désignateur entrent donc dans le même commit par
  construction : la table n'a plus à être INERTE. Meurent : le mode `espaces` de `mesureDuParse` (`ModeDeMesure`,
  `ref.ts:216-220`), `marquerCollectionAtteinte` et `REPERE_COLLECTION` (`:212-213`, `:299-306`), `marqueDuRepere`
  (`:328`), la branche collection du recueil, `collectionsDuParse` et `collectionsDuDocument` de
  `slots-registre.mts` (`:139-160`), le mode `espaces` de `pathNormalise` (`ModeDePath`, `cleDePath`, `listes`),
  `tableInerte` et ses lecteurs (`ref.ts:81-91`, `:149`, `:165`, `:182`, `:194`, `:482`). `marquerCollection` ne pose
  plus que l'UNICITÉ. `TABLE_VIDE` et `indexChargeable` (`gen-espaces.mts:29-34`) restent : un index en conflit doit
  encore s'importer. La mesure au parse ne sert plus que les slots (R1). Preuve : `_ids.generated.ts` identique octet
  pour octet avant et après.
- **D4. Racines vivantes générées.** La phase 1 (`scripts/gen-registry.mjs`) émet un module d'imports STATIQUES, une
  ligne par fichier de `SCHEMA_DEFS[].file`, qui exporte `RACINES_VIVANTES : fichier → racine` (correction (a) de la
  v3.3, tenue par le juge, N8). Aucun `import.meta.glob` (bloquant B1 du juge de C3a :
  `scripts/docs/lib/dump-epigraphes.mts` tourne sous `tsx`, hors Vite) ; aucune liste d'exclusion
  (`!*.manifest.json`, non bloquant du juge de C3a) : le domaine est `SCHEMA_DEFS[].file`. Le module n'importe que du
  JSON (aucun cycle, Invariant 5). Garde : pour chaque clé de dataset, le binding exporté par la couche donnée est la
  MÊME instance (`===`) que la collection atteinte depuis sa racine (bloquant B4 du juge de C3a).
- **D5. Régime vivant.** `overrides.ts` pose la source : les ids d'une clé d'espace sont ceux de la collection atteinte
  par `collectionALaCle` sur `RACINES_VIVANTES`, filtrés, espaces nichés COMPRIS (l'exclusion `lue.niche !== undefined`,
  `idsVivants.ts:52`, meurt). Une seule fonction calcule les ids d'un espace, filtre, univers de `specsSource` et
  ORDRE compris, et la phase 2 et le régime vivant l'appellent toutes deux (aujourd'hui la phase 2 trie par
  `parUnitesDeCode`, `gen-espaces.mts:95`, et le régime vivant rend l'ordre de la donnée : bloquant B3 du juge de C3a,
  `SPEC_SOURCES.pool()` lu par `src/engine/character.ts:156`, `free[0]`). La version d'un espace est
  `memoParVersion` des clés de dataset de son fichier ; `SourceDIdsVivants.version` et le mémo local meurent. Garde
  (promotion de la sonde 1 du juge de C3a) : pour CHAQUE clé de `IDS_PAR_ESPACE`, le régime vivant sur des racines
  inchangées rend la même liste, dans le même ordre, que l'index généré (C3a divergeait sur 26 clés : 8 `#[id].specs`
  à `specsSource`, 18 `traits.json#[…].specs`).
- **D6. Seam d'édition.**
  - Clés : `DatasetKey` est le type que la phase 1 émet depuis le domaine de `DATASET_FICHIER_DERIVE` (134 clés ;
    bloquant B2 du juge v3.3) ; `ObjectDatasetKey` s'y fond ; une clé à route `object` désigne la RACINE de son fichier,
    et `splice` contre `mergeInPlace` se lit à `OBJECT_CATEGORY_DERIVE[clé].mode` (bloquant B1 du juge v3.3) ;
    `CleDeDataset` (`versionDataset.ts:15-18`) se réduit à `DatasetKey`.
  - Navigation : `collectionDuDataset(clé)` = fichier (`DATASET_FICHIER_DERIVE`) → racine (`RACINES_VIVANTES`) →
    suite (D8) → `collectionALaCle`. La co-descente ne valide pas : la pose transactionnelle de
    `CodexEdit.tsx:596-611` navigue un arbre invalide (Invariant 4).
  - Types (bloquant B3 du juge v3.3) : les écrivains sont keyés par la COLLECTION, typée par son binding :
    `setDataset<T>(collection: T[], next: readonly T[])`, `setObjectDataset<T extends object>(racine: T, next: T)`. La
    clé de version se lit par IDENTITÉ (carte collection → `DatasetKey` construite par `collectionDuDataset` sur les
    134 clés, mémoïsée par version) ; une collection qui n'est pas vive LÈVE. Les 4 appelants dynamiques de
    `CodexEdit.tsx` résolvent `collectionDuDataset(clé)` puis appellent le même seam. `datasetArray(clé): unknown[]`
    ne sert que les clés DYNAMIQUES (`CodexEdit.tsx`, `RefField.tsx`, `GameOpEditor.tsx`) ; un lecteur à clé
    littérale (`registry.ts`, `EtatPanel.tsx:243`) lit le binding typé. Chaque collection du seam a un binding typé
    EXPORTÉ par son module propriétaire (les 17 types existants ; les 3 liaisons non typées prennent le type qui
    existe) ; les doubles sources de type meurent dans le même commit (traumas : un type ; miscast : un type, les deux
    autres en dérivent ou meurent), et le commentaire faux `overrides.ts:103-105` avec elles. Le typage des données
    par leurs schémas (`z.output`) reste hors de ce lot (`document()` efface son type, amendement v3.3 point 1).
  - Meurent : `ARRAYS`, `OBJECTS`, `DATASET_KEYS`, `OBJECT_DATASET_KEYS`, `NESTED_ARRAY_ROOT`, `OBJECT_FILE`,
    `idsSurLaRacine`, la signature `datasetArray<K>(key): (typeof ARRAYS)[K]`, la garde (e) de
    `exposition-contrats.test.ts:137-151`.
- **D7. Vocabulaire des gardes par identité** (bloquant B5 du juge v3.3). `src/data/index-vif-guard.test.ts` et
  `src/data/seam-ecriture-guard.test.ts` tirent le vocabulaire « nom de binding → clé de dataset » à l'EXÉCUTION, sous
  Vitest : les exports des modules qui importent un JSON de `src/data` (ce que `nomsVifsDuFichier` lit déjà au texte),
  retenus quand leur valeur est `===` une collection vive (carte de D6). `corpsDuLitteral`, `entreesDuSeam`,
  `clesDuSeam` et `bindingsVifs` (`scripts/guards/lib/bindingsVifs.mjs:33-107`) meurent ; les lecteurs de texte qui
  restent reçoivent le vocabulaire en paramètre. Preuve : le vocabulaire neuf égale celui lu à `d870e34f3`, écarts
  nommés et expliqués.
- **D8. `niche.categories`** : une carte catégorie Codex → suite relative au document (graphie de
  `cle-d-espace.ts`), EXIGÉE par les 54 clés nichées (N1 du juge v3.3) ; `defs/criticals.ts` la dérive de sa
  constante `CATEGORIES`. Garde : chaque suite mène à une collection marquée par `collectionALaCle` sur la racine
  disque.
- **D9. Scan** (E9 de la v3.2). Pour les documents qui ont un def, les passes 1 et 3 de `structures-scan.mts` tirent
  `racineEntrees` (`:456`, `:490`) et `documentsEmbarques` (`:591-599`) de `collectionsDuDocument` sur le document
  SCANNÉ, copies modifiées et arbres invalides compris (Invariant 4) ; collections avec ou sans `espace`. La
  partition observée `p.famille` (`:487`) reste (N4 du juge v3.3). La marche de la donnée (`:420`) reste le côté
  OBSERVÉ. Le test `structures-contrat.test.ts:1790-1815` (fichier sans def, famille injectée) se réécrit sur un
  document `record` réel (copie modifiée), même intention. Documents de `src/scenes` : la co-descente les couvre
  (`SCHEMA_DEFS_SCENES`) ; si elle couvre tous les documents embarqués que l'heuristique trouve sur `src/scenes`,
  l'heuristique meurt dans ce lot ; sinon elle ne s'applique plus qu'aux chemins non couverts, NOMMÉS, et s'inscrit au
  registre des fossiles de #1463 avec le lot « références scopées ». Preuve : index avant/après par dataset (ids
  gagnés, perdus, sites de référence gagnés ou perdus en passes 2 et 4), chaque écart expliqué.
- **D10. Termes.** Au lexique (`scripts/docs/lib/structures-lexique.mts`) et à `docs/structures-donnees.md`, dans le
  commit qui les crée : « co-descente » (contre-grep `git grep -nE "coDescen|co-descente|codescente" d870e34f3 -- src
  scripts docs` → 0), « racine vivante », « régime vivant », « seam d'édition », « binding vif », « clé de dataset »
  (N7 du juge v3.3). Faux ami à ne pas confondre : l'option `descendre` de `scripts/guards/lib/lister.mjs:79-96`.
- **D11. Ce qui meurt, ce qui survit.** Meurent en plus de D3, D6 et D7 : `aTraversLesEnveloppes` et `parSegment` de
  C3a, `ouverts` et `enfantsParSegment` de `validate.ts`, l'heuristique des documents embarqués hors `src/scenes`
  (et sur `src/scenes` selon D9). Survivent : `enfantsDe`, `descendre`, `marquerCollection` (unicité), `listeCle`,
  `collectionDe`, `idsDeCollection`, `mesureDuParse` en mode slots, `TABLE_VIDE`, `memoParVersion`,
  `niche.categories` (carte), `lieuDe` (sur D1).
- **D12. Ce que C3a apporte.** Repris de `c3a.patch` : `idsDeCollection` déplacé dans `cle-d-espace.ts` (NB4), la mort
  de `NESTED_ARRAY_ROOT`, `OBJECT_FILE` et `idsSurLaRacine`, l'entrée `RACINES_VIVANTES` du lexique. Réécrits :
  `collectionALaCle` sur D1, les racines sur D4. Abandonnés : le glob, les exclusions de fichiers.

**Commits.**
- C3 : D1, D2, D3, D10 pour ses termes ; `lieuDe` et `noeudsDeCle` sur D1. Preuve : `_ids.generated.ts` identique ;
  les tests de `validate.ts` verts, et tout message de faute changé par la traversée de `&N` nommé.
- C4 : D4 à D8. Preuves : gardes d'identité (D4), d'égalité vivant = généré (D5), de vocabulaire (D7), des suites de
  niche (D8).
- C5 : D9.
- C6 : E10 de la v3.2, après la fusion du train 2a1 (`chantier/1473-t2`) dans `chantier/1473-r2`.

Critère de sortie mécanique :
`git grep -nwE 'NESTED_ARRAY_ROOT|OBJECT_FILE|OBJECT_DATASET_KEYS|ObjectDatasetKey|tableInerte|marquerCollectionAtteinte|REPERE_COLLECTION|collectionsDuParse|ModeDeMesure' -- src scripts ':!scripts/migrations'`
= 0 ; `git grep -n "const ARRAYS = {\|const OBJECTS = {" -- src scripts` = 0 ; `git grep -nE "_zod\??\.def" -- src scripts
':!src/data/schemas/grammaire/descente.ts' ':!*.test.*'` ne rend que des lectures dans un rappel de `descendre` ou
`coDescendre`, listées.

## Questions restantes (réponse en sortie, citation ou sonde à l'appui)

1. Une collection marquée est-elle atteinte sous le `out` d'un `pipe` dont l'entrée est transformée (la donnée brute
   n'y a pas encore la forme de `out`) ? Sonde sur les racines des deux registres ; règle si oui.
2. Coût de `RACINES_VIVANTES` au bundle : chaque fichier de `SCHEMA_DEFS[].file` est-il déjà importé par l'app ?
   Liste de ceux qui ne le sont pas, et taille ajoutée.
3. Ordre : quel est l'ordre de `SPEC_SOURCES.pool()` à `main` pour les 16 sources, et l'ordre unique de D5
   le garde-t-il ? Écarts nommés, effet sur `character.ts:156`.
4. Coût de la phase 2 sur la co-descente, contre 687 ms au parse.
5. Les lecteurs de `_zod.def` rendus par le grep du lecteur v4b (`champs-declares-parite.test.ts:85`,
   `effet-discriminants.test.ts:159`, `collection-cle.test.ts:79-89`, `condition-discriminants.test.ts:56`,
   `meta.ts:39`, `HouseRulesModal.tsx:131`, `skills-char-override.test.ts:52`) : pour chacun, lecture d'ENFANTS (sous
   l'Invariant 2) ou lecture d'une propriété de nœud (valeurs d'une énumération, `checks`), en une ligne.

## Périmètre

- Socle : `grammaire/descente.ts`, `grammaire/collection-cle.ts`, `grammaire/cle-d-espace.ts`, `grammaire/ref.ts`,
  `grammaire/idsVivants.ts`, `grammaire/document.ts`, `grammaire/sourcesDeSpecs.ts`, `schemas/validate.ts`,
  `schemas/exposition-derivee.ts`, `scripts/gen-registry.mjs` (+ `.d.mts`), `scripts/gen-espaces.mts`, les modules
  générés (`npm run gen`), `scripts/docs/lib/slots-registre.mts`, `scripts/docs/lib/structures-scan.mts`,
  `scripts/docs/lib/structures-lexique.mts`, `scripts/guards/lib/bindingsVifs.mjs`,
  `scripts/guards/lib/fieldConsumerTargets.mjs`, `src/data/overrides.ts`, `src/data/index.ts`,
  `src/data/versionDataset.ts`, `src/data/criticals.ts`, les modules propriétaires des bindings (D6),
  `src/engine/trauma.ts`, `src/engine/miscast.ts`, `src/ui/compendium/CodexEdit.tsx`, `src/ui/compendium/registry.ts`,
  `src/ui/compendium/RefField.tsx`, `src/ui/editor/GameOpEditor.tsx`, `src/ui/EtatPanel.tsx`, `defs/criticals.ts` et
  les defs à `niche`, leurs tests (dont `index-vif-guard.test.ts`, `seam-ecriture-guard.test.ts`,
  `ids-vivants-regime.test.ts`, `espaces-contrat.test.ts`, `exposition-contrats.test.ts`, `structures-contrat.test.ts`,
  `grammaire.test.ts`, `collection-cle.test.ts`, `parse-de-mesure.test.ts`) et les ~118 appels de test du seam.
- Docs générés (`npm run docs:build`) à chaque commit.
- Hors périmètre : `defs/sea-events.ts` (#1939) ; les unions littérales de #1932 ; les documents de campagne (lot
  « références scopées ») sauf D9 ; les migrations datées ; le typage des données par leurs schémas.

---
_Generated by [Claude Code](https://claude.ai/code)_
