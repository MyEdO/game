# Juge du diff C4a (#1473, #1463), 2026-09-24
Arbre : /home/claude/game/.wt-1473-r2c3, HEAD 61fef43d7, diff non committé (48 suivis + 3 non suivis), `git status --short` = 51 lignes avant et après le juge.
Contrôle positif : sha256 overrides.ts 39ca5ab3… (blob da983b9d2), weather.ts b250303c… (blob 334ae4c3a), _ids.generated.ts 012ea1ad… = empreintes « après » du rendu du codeur. HEAD:_ids.generated.ts = b0666b18… (« avant »).

## Verdict : FRAGILE
Le diff applique D4, D5 (hors specResolves/specCatalogOf), D8, D12 et la part lecture de D6. Les gardes mordent et se rejouent au vert. Deux bloquants portent sur des PRÉMISSES : celle de D4, et la décision de l'orchestrateur sur specCatalogOf.

## Bloquants

### B1. La décision specResolves/specCatalogOf ne tient que si l'index généré porte la source
Constat : la décision veut que « la lecture d'une clé de specs à specsSource porte la déclaration de la source ». Or cette lecture n'existe qu'au régime vivant. Au régime figé (scripts, gardes, index.ts chargé sans overrides.ts), `lireLEspace` = `idsVivants ?? fige` (ref.ts:95-96), et l'index APLATIT l'espace en ids de l'univers. La déclaration y est perdue, et le pool ne se retrouve plus à partir de (type, id).
Preuve : sonde `juge-c4a/sonde-catalogue.mts`, exit 0 :
```
{ sourceEntrees: 26, catalogueDiffereEspace: 8, resolvesDiffereEspace: 0, nonSourceCatalogueDiffere: 0, nonSourceResolvesDiffere: 0 }
skills.json#[focalisation].specs source=winds catalogue=9 espace=20 vivant=20
talents.json#[beni].specs source=cultBlessings catalogue=15 espace=41 vivant=41
talents.json#[invocation].specs source=cultMiracles catalogue=15 espace=41 vivant=41
talents.json#[magie-des-arcanes].specs source=arcaneDomains catalogue=18 espace=20 vivant=20
talents.json#[magie-du-chaos].specs source=cultChaos catalogue=3 espace=41 vivant=41
traits.json#[beni].specs … 15/41 ; traits.json#[lanceur-de-sorts].specs … 18/20 ; traits.json#[miracles].specs … 15/41
```
- specResolves : la moitié de la décision TIENT. L'espace égale la validité sur les 26 entrées à source et sur toutes les entrées sans source, à 0 écart. ref.ts:155 `catalogueSpecs(type,id)` et ref.ts:427 (`refusDeSpec` → 'horsCatalogue') calculent DÉJÀ cette validité par (type, id). specResolves (index.ts:3520) est donc un second lecteur du même ensemble : il doit se fondre dans celui de ref.ts.
- specCatalogOf : 8 entrées sur 26 ont un catalogue (pool) différent de l'espace. Au régime figé, IDS_PAR_ESPACE['skills.json#[focalisation].specs'] porte 20 ids et non 9.
- « la règle n'est plus écrite qu'une fois » est FAUX tel que formulé. specPoolOf (index.ts:3503-3506) garde `def.specsSource ? … : specs.filter(pool !== false)`. La branche sans source ne peut pas devenir un espace, parce qu'aucun marqueur ne se nie (cle-d-espace.ts, `porteLeChampMarqueur`). specLabel (index.ts:3528) branche aussi sur `def.specsSource`.
Correction proposée : que l'index généré garde l'INDIRECTION au lieu de l'aplatir. LectureDEspace devient `{ ids } | { source: SpecsSource }` (collection-cle.ts:335, au lieu de `{ univers }`), émise telle quelle par la phase 2 (valeur d'index ou table générée sœur). Les deux régimes lisent alors la même forme. Ensuite :
- specResolves(type, id, s) = lecture de l'univers ;
- specCatalogOf(type, id) = lecture de `pool ?? univers` ;
- specPoolOf(type, id) lit la source depuis la LECTURE, jamais depuis `def.specsSource`, et ne garde que le filtre `pool !== false` du cas inline ;
- la règle « specsSource → univers » ne vit plus que dans lectureDeLEspace.
Sans cette indirection, specCatalogOf(type, id) doit relire `def.specsSource` dans la donnée, et la règle reste écrite deux fois.

### B2. RACINES_VIVANTES sur tout SCHEMA_DEFS : 19 fichiers sans clé de dataset, 6 sans aucun lecteur, 5 dans le bundle joueur
Constat : D4 prescrit « une ligne par fichier de SCHEMA_DEFS[].file ». Or seul un fichier porteur d'une clé de dataset peut changer en mémoire (seuls écrivains : setDataset / setObjectDataset / resetData, tous derrière bumperDataset, overrides.ts:308/417/425 ; aucun autre écrivain, grep ci-dessous). Un seul lecteur consulte la racine d'un fichier sans clé : le régime vivant. Il y reproduit l'index généré et le mémorise pour toujours (`CLES_DU_FICHIER.get(f) ?? []` → memoParVersion([]), overrides.ts:363).
Preuve : sonde `juge-c4a/sonde-fichiers.mts`, exit 0 :
```
{ fichiers: 124, avecCle: 105, sansCle: 19 }
sans cle, avec espace: 13
[["actions.json",1],["ambiance.json",0],["decorPalette.json",1],["donnees.manifest.json",0],["lieux-services.json",1],["localisation.json",0],["merchantFamilies.json",1],["merchants.json",1],["primitives.manifest.json",1],["progression-schemas.derived.json",0],["raw.manifest.json",1],["regles.json",1],["renduMonte.json",0],["reseau-routier.json",1],["speciesRace.json",0],["structureAppearance.json",1],["systemes.manifest.json",1],["tables.json",1],["teintesJeu.json",1]]
```
- Les 5 fichiers qui entrent au bundle font tous partie des 19. Aucun import applicatif hors tests et générés (git grep à vide pour les 5). overrides.ts est importé par src/ui/EtatPanel.tsx, donc hors du seul Compendium.
- Taille gzip -9 du JSON compact : donnees.manifest 7493 o, primitives.manifest 11839, progression-schemas.derived 5032, raw.manifest 925, systemes.manifest 1780. Total ≈ 27 Ko ; le codeur mesure 26 622 o avec esbuild.
- donnees.manifest et progression-schemas.derived n'ont NI clé de dataset NI espace : AUCUN lecteur ne consulte leur racine, et elles coûtent 12,5 Ko gzip au joueur.
- Effet de bord : pour les 13 fichiers sans clé mais avec un espace, le mémo n'est JAMAIS invalidé. `ACTIONS.push` dans des tests (src/gameIso/stage/pastille-entite.test.tsx:529, src/ui/CombatConsole.test.tsx:3371, 3412, 3509, 3561) mute actions.json sans bump. Avant C4a, cet espace se lisait au généré. Les tests passent aujourd'hui (20 + 150 verts, rejoués), mais le mémo capture l'état de la PREMIÈRE lecture.
Règle DÉRIVÉE proposée (aucune liste d'exclusion) : RACINES_VIVANTES = l'IMAGE de DATASET_FICHIER_DERIVE, soit 105 fichiers. La phase 2 l'émet, puisqu'elle émet déjà CLES_DE_DATASET à partir du même domaine ; la phase 1 textuelle ne lit pas `exposition`, comme le rappelle D6. Un fichier hors de cette image ne se mute pas par le seam : `accesVivant` y rend undefined et l'index généré fait foi. La garde D5 se lit alors « vivant = généré sur l'image, undefined ailleurs ». Les 5 fichiers sortent du bundle, et le mémo à clés vides disparaît.

## Non bloquants

N1. lectureDeLEspace et collectionDuDataset LÈVENT sur un arbre dont deux éléments portent la même clé. Cela contredit D6 (« la pose transactionnelle navigue un arbre invalide ») et le commentaire d'overrides.ts:336. À HEAD, `specsVivantesDe` passait par `.find` et ne levait pas. Sonde `juge-c4a/sonde-doublon.mts`, exit 0 :
```
avant 13
LEVE collectionALaCle : « [art].specs » désigne 2 points de la donnée.     (lireLEspace('skills.json#[art].specs'))
LEVE collectionALaCle : « [art].specs » désigne 2 points de la donnée.     (refusDeSpec('skill','art','calligraphie'))
pendant 48
apres 13
```
Chemin joueur : validateEntry refuse l'id en double d'une liste de racine AVANT la pose (CodexEdit.tsx:185 « déjà pris »), donc ce n'est pas atteignable par cette voie. Le reste des collections nichées n'est pas instruit. Correction : au régime de lecture, `atteindre` ne lève pas pour « plusieurs points ». Il rend le premier ou `undefined`, et collectionALaCle garde la levée pour les gardes.

N2. Le rendu (« Reportés de C3 ») écrit que `collectionALaCle` a pour lecteur de production `collectionDuDataset` (overrides.ts:337). Or collectionDuDataset n'a AUCUN appelant de production en C4a. Son seul lecteur est src/data/racines-vivantes.test.ts, non suivi. C'est le corps privé `atteindre` (collection-cle.ts:296) qui est lu en production, par lectureDeLEspace. L'export `collectionALaCle` n'est lu que par collectionDuDataset et par les tests. La bonne réponse est « lecteur de production à C4b ». knip-exports-ratchet : exit 0, « aucun nouveau ».

N3. Le suivi de l'univers est écrit deux fois : `idsDeLEspace` (collection-cle.ts:376, recursion sur `lecture.univers`) et `idsVivantsDeLEspace` (overrides.ts:360-371, même récursion, pour le mémo). D5 dit « UNE fonction ». Le mémo peut envelopper `acces` ou la lecture sans recopier la récursion.

N4. Lexique « racine vivante » (structures-lexique.mts, entrée neuve) : « le module JSON singleton que la façade et le moteur importent, et que le seam mute EN PLACE ». C'est faux pour 19 des 124 fichiers (aucune clé : le seam ne les mute pas), dont 5 que ni la façade ni le moteur n'importent. B2 corrigé rend l'entrée vraie.

N5. Résidus de « vif » dans un fichier TOUCHÉ : src/data/versionDataset.ts:53 (« index vif »), :80 (« INDEX VIF par un CHAMP »), :102 (« INDEX VIF par `id` »). Hors fichiers touchés : src/data/schemas/grammaire/livres-extraits.ts:14 (« registre vif »), src/data/index.ts:2787 (« vif par construction »), src/state/terrain/index.ts:24/84/109 (`indexVif`, `horsGrilleVif`, `electifsVifs`). D10a dit « UN adjectif, vivant ». Le codeur les laisse, et la découpe ne les assigne pas à C4b : il faut les nommer à C4b/D7 ou les migrer. `sea-voyage-flow.test.ts:142` « source vive » désigne la jauge de coque d'un écran, un autre concept : le laisser est juste.

N6. `genRacinesVivantes` (scripts/gen-registry.mjs, `MODULE_DES_RACINES.importDir: '..'`) suppose root = src/data sans lire `root`. C'est vrai aujourd'hui : sonde `sonde-root.mts` → `[ [ 'src/data', 124 ] ]`. Un def à autre racine produirait un import faux. Le tri y est `.sort()`, et `parUnitesDeCode` partout ailleurs.

N7. La phase 2 a perdu la déduplication (`[...new Set(ids)]`, HEAD:scripts/gen-espaces.mts:95). Un doublon entrerait dans l'index, et la garde D5 le dénoncerait (Set vivant contre tableau généré). L'unicité est tenue au parse par listeCle. À savoir, sans plus.

N8. Le brief du juge cite `src/data/schemas/grammaire/refFormatLivre.ts:20-21`. Le fichier est `src/ui/editor/refFormatLivre.ts:20-21`.

N9. `datasetSerializeRoot` et `datasetObjectSerializeRoot` (overrides.ts:386-395) ont le même corps. Les laisser à C4b est acceptable. Ce doublon est une conséquence directe de la mort de NESTED_ARRAY_ROOT : il n'a rien d'une dette neuve.

## Lentilles, réponses

1. Conformité. Preuve 6 rejouée : `git grep -nw 'NESTED_ARRAY_ROOT\|OBJECT_FILE\|idsSurLaRacine\|specsVivantesDe\|memoSpecs\|specsDesSources\|SourceDIdsVivants' -- src scripts ':!scripts/migrations'` → exit=1, 0 ligne. Même résultat, 0 ligne, pour massBattleData, RACINE_DE_SOURCE, fichierDe, FichierDe, DatasetDeSource et poserSourceDIdsVivants. Aucune occurrence dans docs/ ni .claude/.
- D4 : 124 imports, tous `.json` (grep → 0 non-json). Aucun glob.
- D5 : l'exclusion `lue.niche` est morte. catalogueSpecs = `lireLEspace(cleDesSpecs(...))` (ref.ts:155). La version est memoParVersion des clés du fichier.
- D8 : carte exigée (document.ts:340-344), criticals dérivée de CATEGORIES.
- D12 : 134 clés (garde `racines-vivantes.test.ts`, 68/54/12).
- Écart : specResolves/specCatalogOf (voir B1).

2. Voir B1. La décision TIENT pour specResolves. Pour specCatalogOf elle est FRAGILE : elle exige que l'index généré garde l'indirection vers la source.

3. Ordre. Le tri de la phase 2 est une hygiène de générateur héritée, jamais un besoin de lecteur. Traçage par `git log -S'[...new Set(ids)].sort'` :
- `155c4fda3` (2026-07-03), union de types `idUnion` triée ;
- `fae8ea80c` (2026-09-23), `idsParMarqueur` trié ;
- `d870e34f3` (C2), reconduit dans `poser`.
Contre-grep par une autre méthode : tous les importeurs de `_ids.generated`, IDS_PAR_ESPACE, lireLEspace et idsVivants dans src, scripts et docs. Liste : parse-de-mesure.test.ts:21-24 ([0], n'importe quel id), refs-migrated.test.ts:1272 ([0]), buildings-catalogue.test.ts:33-34/90 (includes/find), pool-specs.test.ts:56 (trie lui-même), valeurs-de-champ.test.ts:23 (Set), espaces-contrat.test.ts:88 (regex de graphie, insensible à l'ordre), scripts/migrations/2026-09-01-1463-*.mjs (lecture textuelle, datées), index.ts:3492/3494 (SPEC_SOURCES, qui lisait déjà l'ordre de la donnée). Aucun lecteur dans src/ui. docs/.sources-lues.json cite le fichier (empreinte → docs:build au commit, connu). Aucun lecteur ne dépend de l'ordre trié. Effet résiduel : `_ids.generated.ts` bouge désormais quand une donnée est réordonnée.

4. Régime vivant.
- Écrivains des racines : overrides.ts:308 (setDataset), :417 (setObjectDataset), :425/427 (resetData), tous bumpés. CodexEdit.tsx:418/434/608/609 passent par eux. Aucun écrivain coop ni de campagne (`git grep` de bumperDataset et setDataset hors tests).
- Fichiers porteurs d'espace sans clé : 13 (B2). Ils sont mémorisés pour toujours, et mutés en test par `ACTIONS.push`.
- L'univers suit sa version : oui. Récursion sur la lecture `{univers}` au mémo de son propre fichier (overrides.ts:360-371). Test « un domaine créé est admis aussitôt » (ids-vivants-regime.test.ts:76-80) : vert.
- Changement visible : les espaces NICHÉS et OBJETS se lisent désormais vivants (ex. `sizes.json#rangedMod`, test :83-91). Une entité créée ou renommée au Compendium dans une collection nichée est admise ou refusée sans `npm run gen`, alors qu'avant elle se jugeait au généré. Aucun message ne liste d'ids (refMorte, ref.ts:180). SPEC_SOURCES.pool/resolves lisaient TOUJOURS le binding vivant. Ils lisent maintenant l'index généré quand overrides.ts n'est pas chargé : égal au disque, sans écart mesuré.

5. Bundle : voir B2. Règle dérivée : l'image de DATASET_FICHIER_DERIVE, émise par la phase 2.

6. Gardes.
- Les mutations du codeur sont valides : empreintes avant = après = arbre actuel (voir l'en-tête).
- D4 couvre les 134 clés, par identité.
- D5 compare Set et tableau via JSON, et n'est pas vacante : `vivant &&`, un undefined fait faute.
- D8 exige marque ET valeur présente. D4 attrape une suite qui mène à une AUTRE collection existante.
- Limite de classe : D5 prouve l'égalité des racines, pas la justesse de lectureDeLEspace commune aux deux (voulu par D5).
Rejeu : `npx vitest run` sur racines-vivantes, ids-vivants-regime, espaces-contrat, exposition-contrats, co-descente, grammaire, collection-cle, pool-specs, comment-poison-guard, pastille-entite, CombatConsole → `Test Files 11 passed (11) / Tests 434 passed (434)`, exit=0 (redirection + $?, `juge-c4a/vitest1.txt`). `node scripts/ops/knip-exports-ratchet.mjs` → « exports morts : 11 (gelés, 6 fichiers) — aucun nouveau », exit=0.

7. Normes. comment-poison-guard : 75 verts. Termes : un concept = un terme, sauf N5. Morts adjacents vérifiés (liste en 1). `datasetSerializeRoot`/`datasetObjectSerializeRoot` : voir N9.

## Non jugé
- Typecheck (interdit au juge). Le rendu dit typecheck:fast exit 0, non rejoué.
- Suite complète et gates (lint, docs:check) : interdits.
- La mesure build-structures du codeur (profil) n'a pas été rejouée.
- La preuve 3 (sha avant/après gen) n'a pas été rejouée par `npm run gen` (interdit). Seules les empreintes ont été contrôlées.
- N1 sur les collections nichées : accessibilité joueur non instruite.

## ps final
Aucun processus du juge. Restent : pid 28915-28923 (typecheck-fast de /home/claude/game/.wt-1473-t2) et pid 30448-30465 (sonde d'un autre juge, scratchpad/juge-reference-polymorphe, .wt-1473-r2v2-lecture). Aucun des deux n'est à moi.
