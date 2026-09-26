# Rendu R2 C4a, corrections (#1473, #1463), 2026-09-24. Rendu COURT : arrêté sur ordre (quota à 98 %)
Arbre : /home/claude/game/.wt-1473-r2c3, HEAD 61fef43d7, rien de committé. Porte d'entrée : Invariant, Cas canonique et Design jugé (run wf_bef45076-289) sont présents dans le design v4.1.

## Fichiers que J'AI modifiés (par rapport au diff C4a trouvé)
- `scripts/gen-espaces.mts` (K1) : la phase 2 émet `src/data/schemas/_racines-vivantes.generated.ts`. Les documents émis sont l'image de `DATASET_FICHIER_DERIVE` (`indexDesIds` rend `racines`), triés par `parUnitesDeCode`. Chaque chemin d'import vient de `join(def.root, def.file)` puis de `relative(dirname(SORTIE_RACINES), …)` (fonction `specificateur`), sans `'..'` écrit en dur (N6). La ligne de log compte les documents. N3 : `idsDeLEspace(cle, lire)` avec `lire = (c) => lectureDeLEspace(c, acces)`.
- `scripts/gen-registry.mjs` (K1) : `MODULE_DES_RACINES` et `genRacinesVivantes` sont supprimés, et `genAll` = `REGISTRIES.map(genOne)`. En-tête mis à jour. Diff contre HEAD : 2 lignes d'en-tête seulement.
- `src/data/schemas/_racines-vivantes.generated.ts` (régénéré) : 105 imports au lieu de 124. Il manque exactement les 19 du juge (actions, ambiance, decorPalette, donnees.manifest, lieux-services, localisation, merchantFamilies, merchants, primitives.manifest, progression-schemas.derived, raw.manifest, regles, renduMonte, reseau-routier, speciesRace, structureAppearance, systemes.manifest, tables, teintesJeu). sha256 avant 7a06a2b6…, après a48af067….
- `src/data/schemas/grammaire/collection-cle.ts` :
  - N1 : nouveau corps privé `parcourirLaSuite` → `{ atteinte, points }` (premier point retenu). `atteindre` est EXPORTÉ, au régime de lecture : il rend le premier point et ne lève pas quand plusieurs points ont la suite. `collectionALaCle` lève sur `points > 1` et sur l'absence. Le pas `[]` lève encore dans le corps, avec le message « Suite « x » porte un pas « [] »… ».
  - N3 : `idsDeLEspace<Ids>(cle, lire)` est le SEUL suivi de l'univers, générique sur la forme des ids.
  - En-tête mis à jour.
- `src/data/overrides.ts` :
  - `collectionDuDataset` passe par `atteindre(...)?.valeur` (N1).
  - Nouvelle `lectureVivante(cle)`, mémorisée par `memoParVersion` des clés du fichier. Elle rend `undefined` sans mémo quand le fichier n'a pas de clé de dataset : le `?? []` est mort (K1.2).
  - `idsVivantsDeLEspace = (cle) => idsDeLEspace(cle, lectureVivante)` : la récursion recopiée est morte (N3).
  - Doc de `accesVivant` et du régime vivant mis à jour.
- `src/data/racines-vivantes.test.ts` (non suivi, garde D5 réécrite) : « vivant = généré sur l'image, `undefined` ailleurs ». Elle compte les clés `image > 300` et `horsImage > 0`, et nomme chaque faute.

## Portes jouées
- `npm run gen` ×2 : exit 0 / exit 0. Le second passage est « [inchangé] ». `IDS_PAR_ESPACE ← 7085 ids / 358 espaces, CLES_DE_DATASET ← 134 clés, RACINES_VIVANTES ← 105 documents`. `_ids.generated.ts` reste IDENTIQUE (sha256 012ea1ad… avant = après) après la refonte N3. `_cles-de-dataset` identique (09b7645e…).
- `npx vitest run src/data/racines-vivantes.test.ts` : exit 0, 4/4.
- Mutation D5, fichier muté `src/data/overrides.ts`, blob avant cf3f66686c5b7208569278176b8bb726534f80d1 :
  - (a) `if (!cles) return { ids: new Set<string>() };` → blob 103beaa5…, exit=1, rouge « actions.json : hors de l'image, vivant », « decorPalette.json : … ». Remis, blob cf3f6668… (cmp IDENTIQUE).
  - (b) `new Set(lecture.ids.slice(1))` → blob 3fa9f9a7…, exit=1, 143 fautes « vivant ≠ généré », 1 failed | 3 passed. Remis, blob cf3f6668… (cmp IDENTIQUE).
  - Revert au vert : exit 0, 4/4.
- `npm run typecheck:fast` : exit=0, « typecheck:fast — 0 erreur(s) ».
- NON rejoués après N1 (arrêt) : `co-descente.test.ts`, `ids-vivants-regime.test.ts`, `espaces-contrat.test.ts`, `pastille-entite`, `CombatConsole`.

## K1-K3, état
- K1.1 : FAIT.
- K1.2 : FAIT, preuve par mutation ci-dessus.
- K1.3 (mesure du bundle) : NON FAIT.
- K1.4 (lexique « racine vivante », `scripts/docs/lib/structures-lexique.mts:187`, et `scripts/docs/build-donnees.mjs:413`, qui attribue encore le module à la phase 1) : NON FAIT. Les deux textes sont FAUX maintenant : phase 1 au lieu de phase 2, « un import par `file` des defs » au lieu de l'image de `DATASET_FICHIER_DERIVE`.
- K2 : NON FAIT, analyse seulement.
  - `actions.json` n'a AUCUNE clé de dataset. Le seam n'a donc pas d'écrivain pour `ACTIONS` : écart avec le brief, qui ne se code pas sans une décision d'`exposition`.
  - Après K1, `actions.json` est hors de l'image. Le régime vivant ne le lit plus et ne le mémorise plus. Le « mensonge au mémo » disparaît, pas l'écriture directe.
  - `seam-ecriture-guard.test.ts` ne la voit pas : son vocabulaire est `bindingsVifs()`, tiré du littéral `ARRAYS` d'`overrides.ts`, donc des seuls datasets. `ACTIONS` n'y est pas.
  - Sonde de classe : non écrite.
- K3 :
  - N1 : code FAIT (`atteindre` / `collectionALaCle`). Test neuf et preuve par mutation NON FAITS. Sonde du juge `sonde-doublon.mts` non rejouée. Attendu par construction : `lireLEspace('skills.json#[art].specs')` rend les specs du PREMIER `art`, sans levée.
  - N3 : FAIT (collection-cle.ts, `idsDeLEspace` générique ; overrides.ts, `idsVivantsDeLEspace`).
  - N5 : NON FAIT.
  - N7 : NON FAIT (non instruit).
  - N6 : fait avec K1 (racine lue au def).

## Écarts
- `co-descente.test.ts:131-137` cherche `/« lots\[\]\.items » porte un pas « \[\] »/`, et le message devient « Suite « lots[].items » porte un pas… », qui garde la sous-chaîne. Non rejoué.
- `scratch-sonde-q1.mts` et `scratch-sonde-q1b.mts` (non suivis, à la racine du worktree) étaient présents au début et sont ABSENTS à la fin. Ce n'est pas moi : ni suppression ni écriture de ma part sur eux.

## git status --short final (worktree)
48 ` M` (liste identique à celle du diff C4a) + `?? src/data/racines-vivantes.test.ts`, `?? src/data/schemas/_cles-de-dataset.generated.ts`, `?? src/data/schemas/_racines-vivantes.generated.ts`.
Arbre principal `/home/claude/game` : `git status --short` vide, aucune fuite.

## ps
`ps -eo pid,args | grep -E "vitest|tsc|tsx|esbuild"` : vide. Aucun processus laissé.
