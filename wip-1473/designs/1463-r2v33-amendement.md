# #1463 · concept RÉFÉRENCE — amendement v3.3 du lot R2 (2026-09-24) : E7 et E9 après le rendu partiel de C3

Base : brief R2 v3.2 (`/mnt/project-files/dettes/1463-r2v3-brief.md`, #1473 issuecomment-5807651639). Seuls E7 et
E9 changent ; l'Invariant, le Cas canonique, E1-E6, E8, E10 et E11 restent ceux de la v3.2.

## Ce qui a été livré (C3a) et pourquoi C3 s'est arrêté

C3a (non committé à cette date, juge de diff en cours) livre E8, NB4 du juge de C2 et la part d'E7 qui ne dépend
de rien d'autre : `RACINES_VIVANTES` (glob eager, `src/data/overrides.ts:312`), `collectionALaCle`
(`grammaire/collection-cle.ts:187`), mort de `NESTED_ARRAY_ROOT`, `OBJECT_FILE`, `idsSurLaRacine`. Sonde du codeur
(`scratchpad/r2c3/sonde-racines.out`) : les 134 bindings d'`ARRAYS` et `OBJECTS` sont atteints PAR IDENTITÉ depuis la
racine de leur fichier.

Le codeur s'est arrêté sur trois contradictions, vérifiées par un lecteur indépendant :

1. **Typage par clé.** E7 tire le type d'élément d'une carte type-only (`z.output` du def). Or `document()` efface son
   type : `DocumentHandle<T extends string>` n'a qu'un paramètre, et `schema`, `entree`, `entreePartielle` sont
   `z.ZodType<unknown>` (`grammaire/document.ts:235`, `:242`, `:251`, `:512`). Sonde type-only sur `talents`,
   `skills`, `sea-events` (`manann.factors`), `criticals`, `sizes#rangedMod` : `z.output` vaut `unknown` pour les 5.
   124 defs de `defs/` et 3 de `defs-scenes/` appellent `document()`. Les 95 types d'`src/data/index.ts` sont écrits à
   la main (`grep -c 'z.infer\|z.output' src/data/index.ts` = 0).
2. **Vocabulaire des gardes.** `scripts/guards/lib/bindingsVifs.mjs:37` lit le littéral `const ARRAYS = {` au texte
   (`corpsDuLitteral`, qui lève s'il est absent) ; `clesDuSeam` et `bindingsVifs` (`:97-107`) en tirent le
   vocabulaire de `src/data/index-vif-guard.test.ts` et `src/data/seam-ecriture-guard.test.ts` (#1692).
3. **Le scan contre la mesure.** `mesureDuParse` LÈVE si le parse normal échoue (`grammaire/ref.ts:407-417`). Le scan
   des structures ne l'appelle pas aujourd'hui : il traverse le JSON lui-même (`structures-scan.mts:449-490`, passe 1 ;
   `:590-602`, passe 3), et trois tests de `src/data/structures-contrat.test.ts` lui font scanner une COPIE modifiée
   (`:1695-1737`, `:1741-1780`) ou un fichier SANS def (`:1790-1815`, famille injectée à la main). Une passe 1 qui
   lirait `IDS_PAR_ESPACE` lirait l'index de l'arbre réel sur ces copies.

## E7 v3.3 — le seam d'édition sans table écrite à la main

**Question à laquelle E7 répond** : qui déclare qu'une collection d'un document est éditable, et où l'éditeur la
trouve-t-il ? Réponse de la v3.2, inchangée : le def (racine du document, catégories `niche`), et la navigation depuis
`RACINES_VIVANTES`.

1. **Exécution.** `datasetArray(clé)`, `datasetObject(clé)`, `setDataset`, `setObjectDataset` et la remise à zéro
   naviguent `RACINES_VIVANTES` par `collectionALaCle`. `ARRAYS`, `OBJECTS`, `DATASET_KEYS`, `OBJECT_DATASET_KEYS`
   meurent.
2. **Clés.** `DatasetKey` est l'union émise par la phase 1 (racines éditables et catégories `niche`, clé relative au
   document après `#`) ; `ObjectDatasetKey` s'y fond ; `CleDeDataset` (`src/data/versionDataset.ts:15-18`) se réduit
   à `DatasetKey`. La garde (e) d'`exposition-contrats.test.ts:137-151` meurt avec ce qu'elle synchronisait.
3. **Type.** Le seam est GÉNÉRIQUE : il rend l'élément sous le type générique que ses appelants génériques lisent déjà
   (`CodexEdit.tsx`, `RefField.tsx:103,182`, qui castent aujourd'hui `datasetArray(ds) as Record<string, unknown>[]`).
   Un appelant qui dépend du type d'élément (`src/ui/compendium/registry.ts`, 53 appels à clé littérale ;
   `src/ui/EtatPanel.tsx:243`) lit le binding TYPÉ qui déclare la collection (export d'`index.ts` ou du module
   propriétaire), qui est la MÊME instance (sonde C3a). Motif :
   - la carte `z.output` de la v3.2 exige un `document()` générique en sortie (127 defs) ;
   - le type qu'elle donnerait serait une SECONDE source de type à côté des 95 interfaces écrites à la main
     d'`index.ts`, lues par tout le reste du code ; le typage des données par leur schéma est un lot à part entière,
     qui remplacerait ces interfaces, pas un effet de bord du seam d'édition ;
   - aucun type ne se perd : le type d'un appelant typé vient de là où la collection est déclarée typée.
   L'orchestrateur ouvre le ticket du lot « types des données dérivés des schémas » (gabarit #101), avec les écarts
   déjà relevés (ex. `source` du schéma `manannFactor`, `defs/sea-events.ts:60-66`, absent de `ManannFactor`,
   `src/engine/seaVoyage.ts:34`) et la mesure de la question 6 de la v3.2.
4. **Vocabulaire des gardes.** Le vocabulaire de `bindingsVifs.mjs` se DÉRIVE de là où les bindings vifs se
   déclarent, jamais d'une table de clés du seam, sur le patron d'`accesseursVifs` (`bindingsVifs.mjs:159-171`,
   « Vocabulaire DÉRIVÉ, jamais recopié »). `clesDuSeam` (`:97`, « doit être exactement `DATASET_KEYS` ») meurt : c'est
   une garde de synchronisation. Question en sortie : dérivation textuelle (exports initialisés depuis un import JSON
   de `src/data`, à travers `as`, parenthèses, alias `const` et enveloppes d'identité comme `adressee(…)`,
   `index.ts:2990`) ou par identité à l'exécution sous Vitest ; le choix se prouve par l'ÉGALITÉ avec le vocabulaire
   lu à `d870e34f3` (écarts nommés).

Critère de sortie : celui du brief de C3 (`NESTED_ARRAY_ROOT|OBJECT_FILE|OBJECT_DATASET_KEYS|ObjectDatasetKey` = 0 ;
`ARRAYS` et `OBJECTS` morts ; garde (e) morte), plus `git grep -n "const ARRAYS = {" -- scripts src` = 0.

## E9 v3.3 — l'index des ids du scan, mesuré sur le corpus SCANNÉ

**Question à laquelle E9 répond** : d'où le scan tient-il qu'une valeur est un id ? Des collections que le schéma
déclare (marques), jamais d'une heuristique.

1. **L'index se mesure sur le document scanné**, pas sur `IDS_PAR_ESPACE` : le scan observe des copies (tests
   ci-dessus), et l'index généré est celui de l'arbre réel. Pour chaque document de `src/data`, l'index des ids est
   l'ensemble des collections MARQUÉES, avec ou sans `espace`, mesurées par `collectionsDuParse` sur la donnée
   scannée. Les passes 1 et 3 fusionnent pour `src/data` ; le régime et les entrées de racine se lisent à la famille
   du def (`defsDeDocument`), pas à la forme du JSON.
2. **La mesure devient tolérante au choix de l'appelant.** `mesureDuParse` garde son défaut qui LÈVE (`npm run gen`,
   validation) et prend un mode où les issues qui ne sont pas des repères sont RENDUES avec la mesure au lieu de lever.
   Le scan l'emploie, et rapporte ces issues comme des dérives. Fondement mesuré : sur zod `^4.4.3`
   (`package.json`), une clé inconnue d'un objet strict n'interrompt pas la traversée, et le `superRefine` d'un enfant
   s'exécute (sonde du lecteur, `scratchpad/lecteur-c3b/`). Question en sortie : une collection DANS la partie
   invalide est-elle encore mesurée ? Sonde sur les trois copies des tests.
3. **Le fichier sans def.** Tout JSON de `src/data` a un def (`src/data/schema-contract.test.ts:44-51`, `PENDING` vide).
   Le test `:1790-1815` se réécrit sur un document `record` réel (copie modifiée), en gardant son intention : les clés
   d'`entries` entrent à l'index, l'enveloppe n'y entre pas.
4. **`src/scenes`.** L'heuristique de la passe 3 reste pour les documents de `src/scenes` jusqu'au lot « références
   scopées », qui la tue ; elle s'inscrit au REGISTRE DES FOSSILES de #1463 avec ce lot de mort, et son code ne
   s'applique plus qu'à `src/scenes`.
5. **Preuve.** Index avant/après sur l'arbre réel, par dataset : ids gagnés, ids perdus, sites de référence gagnés ou
   perdus (passes 2 et 4), chaque écart expliqué. `docs/structures-donnees.md` régénéré dans le commit.

## Commits

- **C3a** : le rendu partiel, après son juge de diff.
- **C3b** : E7 v3.3.
- **C3c** : E9 v3.3.
- **C4** : E10, inchangé, après la fusion du train 2a1 dans `chantier/1473-r2`.

## Design jugé :

À rendre par un juge de design sur cet amendement, avant le codeur de C3b.

---
_Generated by [Claude Code](https://claude.ai/code)_
