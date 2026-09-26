## Brief du codeur — R2 commit C4a sur le design v4.1 : LIRE une clé de dataset et un espace depuis les racines vivantes (#1473, #1463), 2026-09-24

**Design.** `/mnt/project-files/dettes/1463-r2v41-brief.md`, posté verbatim à #1473 issuecomment-5810909795. Lis-le EN
ENTIER avant tout code. Ses sections `## Invariant` (verbatims, sources, questions), `## Cas canonique déjà couvert` et
`## Design jugé :` (workflow `juge-design-socle`, run `wf_bef45076-289`, FRAGILE, 15 bloquants intégrés) sont les trois
sections qu'exige `.claude/agents/codeur.md`. Les lignes citées par le design sont celles de `d870e34f3` : C3 a bougé
`ref.ts`, `collection-cle.ts`, `cle-d-espace.ts`, `descente.ts`, `validate.ts`, `gen-espaces.mts` ; relocalise chaque
ancre avant de t'y fier.

**Worktree.** `/home/claude/game/.wt-1473-r2c3`, branche `chantier/1473-r2`, tête `f878503a2` (C3 : D1, D2, D3, D10a
pour « co-descente » et « suite nichée », D10b), arbre PROPRE, `node_modules` installés. Personne d'autre n'y écrit
pendant ta mission. Le patch C3a (`/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/r2c3/c3a.patch`)
ne s'applique pas ; tu y lis seulement ce que D12 nomme.

**Découpe de C4.** Le design range D4 à D8 dans un commit C4. L'orchestrateur le coupe en deux trains, pour qu'aucune
échéance ne laisse un seam d'écriture à moitié migré :
- **C4a (ta mission) : la LECTURE.** D4 entier ; D5 entier ; D8 entier ; D12 entier ; de D6, les clés et la navigation
  seules : `CLES_DE_DATASET` et `CleDeDataset` émis par la phase 2 dans un module généré dédié, domaine de 134 clés,
  `collectionDuDataset(clé)` et ses trois cas.
- **C4b (train suivant) : l'ÉCRITURE.** De D6, l'écrivain unique `setDataset(cible, next)`, les appelants de
  `CodexEdit.tsx`, la mort de `mode: 'record'`, les types des bindings (traumas, miscast), toutes les morts de la puce
  « Meurent » de D6, et le renommage `DatasetKey`/`ObjectDatasetKey`/`DATASET_KEYS` → `CleDeDataset`/`CLES_DE_DATASET` ;
  puis D7.
Entre C4a et C4b, `CleDeDataset` généré et `DatasetKey`/`ObjectDatasetKey` coexistent : c'est la transition nommée de
cette découpe, et C4b la tue. Si un lecteur que C4a fait mourir (`NESTED_ARRAY_ROOT`, `OBJECT_FILE`, `idsSurLaRacine`,
`specsDesSources`, `specsVivantesDe`, `memoSpecs`, `SourceDIdsVivants`) ne peut migrer qu'avec l'écrivain de C4b,
ARRÊTE-toi sur ce point et rends-le avec `fichier:ligne`, sans variante.

**Reportés de C3, à solder ici.** Le message de `f878503a2` dit : « `collectionALaCle`, `pasDeLaSuite` et `chemin` n'ont
de lecteur de production qu'à C4 ; `build-structures` mesure 1260 ms contre 717 ms, à revoir avec C4 ». Chacun de ces
trois symboles a un lecteur de production à la fin de C4a, ou meurt ; dis lequel. Mesure `build-structures` avant et
après C4a, profil à l'appui, et nomme la cause de l'écart.

**Interdits.** Tout `git checkout/restore/reset/stash/add/commit/clean`. Aucune écriture hors du worktree, sauf tes
sorties sous `/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/r2c4a/`. Ni `docs:build`,
ni `docs:check`, ni suite complète, ni typecheck complet. Portes permises : `npm run typecheck:fast`,
`npx vitest run <fichiers>`, `npm run gen`, `node --test <fichiers>`. Tout processus lancé est tué avant ton rendu.
Aucune suppression récursive ni à joker.

**Budget d'horloge : 2 heures, un livrable : le diff de C4a et le rendu ci-dessous.** À l'échéance, rends ce qui est
fait et NOMME le reste.

## Preuves exigées (sortie BRUTE collée, jamais un résumé)

1. D4 : la garde d'identité. Pour chaque clé de `CLES_DE_DATASET`, le binding exporté par la couche donnée est la MÊME
   instance (`===`) que `collectionDuDataset(clé)`. Compte des clés couvertes, par cas (route `dataset` ou
   `none`+`dataset`, route de niche, route `object`). Mutation : un binding remplacé par une copie, rouge ; remis, vert ;
   `sha256sum` du fichier muté avant et après, identiques.
2. D5 : la garde d'égalité. Pour chaque clé d'`IDS_PAR_ESPACE`, `idsDeLEspace` sur les racines vivantes rend la même
   liste, dans le même ordre, que l'index généré. Mutation comme en 1.
3. D5 : l'écart d'ordre de `_ids.generated.ts`. `sha256sum` avant et après `npm run gen` ; pour chaque clé dont la liste
   change, preuve que l'ENSEMBLE est égal (sonde). Liste de tout lecteur d'`IDS_PAR_ESPACE` ou de `lireLEspace` qui
   supposait un tri, `fichier:ligne`, et ce que tu en as fait.
4. D8 : la garde des suites de niche. Chaque suite de `niche.categories` mène à une collection marquée par
   `collectionALaCle` sur la racine disque. Mutation comme en 1.
5. D12 : `DATASET_FICHIER_DERIVE` a 134 clés (sonde, compte avant et après).
6. Par nom, `git grep -nw` sur `src scripts ':!scripts/migrations'` = 0 pour les morts de C4a : `NESTED_ARRAY_ROOT`,
   `OBJECT_FILE`, `idsSurLaRacine`, `specsVivantesDe`, `memoSpecs`, `specsDesSources`, `SourceDIdsVivants`.
7. `npm run typecheck:fast` ; `npx vitest run` sur les fichiers de test touchés et sur `espaces-contrat.test.ts`,
   `ids-vivants-regime.test.ts`, `exposition-contrats.test.ts`, `collection-cle.test.ts`, `co-descente.test.ts`,
   `pool-specs.test.ts`, `grammaire.test.ts`, `index-vif-guard.test.ts`, `seam-ecriture-guard.test.ts`,
   `src/comment-poison-guard.test.ts` ; `npm run gen` puis `git status --short`.

## Questions (réponse en sortie, citation ou sonde à l'appui)

- Question 2 du design : coût de `RACINES_VIVANTES` au bundle, fichiers de `SCHEMA_DEFS[].file` que l'app n'importait
  pas, et taille ajoutée (méthode de mesure dite).
- `idsDeCollection` déplacé dans `cle-d-espace.ts` (D12) : le graphe d'imports le permet-il sans cycle ? Sonde.
- `specPoolOf` garde sa lecture du `pool` par `lireLEspace` (D5) : cite la ligne qui la porte après C4a.
- Tout écart entre le design et le code rencontré : `fichier:ligne`, et ce que tu as fait. Si un point du design est
  faux, ARRÊTE-toi sur ce point et rends-le, n'invente pas de variante.

## Rendu (données brutes)

- `git diff --stat` et `git status --short`, les sorties des preuves 1 à 7, les réponses aux questions.
- Les entrées de lexique créées ou modifiées, verbatim. D10a : « racine vivante », « régime vivant » et « clé de
  dataset » naissent en C4a, et leurs synonymes migrent dans le même commit (« régime vif », « source vive », avec leurs
  sites de D10a) ; « binding vivant » et « seam d'écriture » naissent en C4b avec D7, qui migre `index-vif-guard.test.ts`,
  « binding vif » et « seam d'édition ».
- Ce qui n'est pas fait, nommé.
- Un `ps` final sans processus laissé par toi.

---
_Generated by [Claude Code](https://claude.ai/code)_
