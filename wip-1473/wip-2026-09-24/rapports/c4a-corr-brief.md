## Brief du codeur — R2 C4a, corrections après le juge de diff (#1473, #1463), 2026-09-24

**Contexte.** Arbre `/home/claude/game/.wt-1473-r2c3` (branche `chantier/1473-r2`, HEAD `61fef43d7`) : le diff de C4a
est dans l'arbre de travail, rien de committé. Tu PROLONGES ce diff. Le juge de diff rend FRAGILE :
`/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/juge-c4a/verdict.md` (lis-le EN ENTIER,
ses sondes sont dans le même dossier ; rejoue-les, ne les crois pas). Le design reste
`/mnt/project-files/dettes/1463-r2v41-brief.md` (v4.1) et la découpe C4a / C4b du brief
`/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/r2c4/brief-c4a.md`. Ton rendu de C4a :
`…/scratchpad/r2c4/rendu.md`.

Le bloquant B1 du juge (les lecteurs de spécialisations) n'est PAS dans ces corrections : il part dans un train à lui.
N'y touche pas, sauf si une correction ci-dessous l'exige ; alors dis-le.

## K1 — les racines vivantes sont celles qu'une écriture peut changer (bloquant B2)

`RACINES_VIVANTES` importe les 124 fichiers des defs ; 19 n'ont aucune clé de dataset, dont `donnees.manifest` et
`progression-schemas.derived` que rien ne lit, et cinq entrent au bundle de jeu (environ 27 Ko gzip, sonde du juge
`sonde-fichiers.mts`). Aucune écriture ne peut changer un fichier sans clé : `setDataset`, `setObjectDataset` et
`resetData` passent tous par `bumperDataset` (`src/data/overrides.ts:308`, `:417`, `:425`).
1. `RACINES_VIVANTES` devient l'IMAGE de `DATASET_FICHIER_DERIVE` : la phase 2 (`scripts/gen-espaces.mts`) l'émet, sur
   le même domaine que `CLES_DE_DATASET`, et `genRacinesVivantes` quitte la phase 1 (`scripts/gen-registry.mjs`). Aucune
   liste d'exclusion. Le générateur lit la racine qu'on lui donne (pas de `'..'` écrit en dur, N6) et trie par
   `parUnitesDeCode`.
2. Hors de l'image, `accesVivant` rend `undefined` et l'index généré fait foi. La garde D5 dit : « vivant = généré sur
   l'image, `undefined` ailleurs ». Preuve par mutation.
3. Mesure le bundle après, même méthode que ton rendu de C4a (esbuild + `git grep`), et colle-la.
4. Le lexique « racine vivante » (N4) dit ce qui est vrai après K1.

## K2 — une écriture de test passe par le seam

`ACTIONS.push` mute `actions.json` sans passer par le seam : `src/gameIso/stage/pastille-entite.test.tsx:529`,
`src/ui/CombatConsole.test.tsx:3371`, `:3412`, `:3509`, `:3561` (juge, bloquant B2). Le régime vivant mémorise par
version : une écriture hors seam lui ment. Cherche toute la classe (écritures directes sur un binding de la couche
donnée, dans `src/**/*.test.ts*`, par une sonde que tu colles), et fais-les passer par l'écrivain du seam, remise
comprise. Si une garde existante (`src/data/seam-ecriture-guard.test.ts`) devait voir cette classe, dis pourquoi elle ne
la voit pas ; étends-la si c'est son objet, preuve par mutation.

## K3 — non bloquants du juge dans le périmètre

- **N1** : lire un espace ne lève pas sur un arbre invalide (D6 : « la co-descente ne valide pas »). `lectureDeLEspace`
  et `collectionDuDataset` ne lèvent pas sur deux éléments de même clé ; `collectionALaCle` garde sa levée. Dis ce que
  rend la lecture dans ce cas, et prouve-le par un test (sonde du juge `sonde-doublon.mts`).
- **N3** : la récursion vers l'univers d'une `specsSource` est écrite deux fois (`collection-cle.ts:376`,
  `overrides.ts:360-371`). UNE fonction la porte ; l'autre site la consomme.
- **N5** : « vif » pour le régime vivant. Fichiers touchés : `src/data/versionDataset.ts:53`, `:80`, `:102`,
  `src/data/index.ts:2787`. Ailleurs : `src/data/schemas/grammaire/livres-extraits.ts:14`,
  `src/state/terrain/index.ts:24`, `:84`, `:109`. Pour chacun, dis si c'est le même concept que « régime vivant » ou
  « racine vivante » ; si oui, migre-le ; si non, dis lequel.
- **N7** : la phase 2 ne dédoublonne plus (`HEAD:scripts/gen-espaces.mts:95`). Dis ce qui refuse aujourd'hui deux
  éléments de même clé dans une collection marquée (validation, `fichier:ligne`) ; si rien ne le refuse, dis-le, sans le
  coder.

## Contraintes

- Chemin ABSOLU : `/home/claude/game/.wt-1473-r2c3`. Interdits : tout `git checkout/restore/reset/stash/add/commit/clean`,
  toute suppression récursive ou à joker, toute écriture hors de ce worktree et de ton dossier de rendu.
- Portes : `npm run typecheck:fast`, `npx vitest run <fichiers du périmètre>` (liste collée), `npm run gen`,
  `node --test <fichiers>`. PAS de typecheck complet, de suite complète, ni de `docs:build`/`docs:check` : ils sont à
  moi.
- Preuve par mutation pour chaque garde ou test neuf ou réécrit : fichier muté, empreinte avant et après, rouge
  constaté, remise identique.
- La zone touchée sort aux normes : un concept, un terme ; commentaires à réf nue ; morts purgés.
- Budget : 1 heure d'horloge, un livrable :
  `/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/r2c4-corr/rendu.md`, données brutes
  (sorties des portes collées, `fichier:ligne` de chaque changement, `git status --short` final). À l'échéance, rends ce
  qui est fait et NOMME le reste. Aucun processus laissé derrière toi, `ps` collé.

---
_Generated by [Claude Code](https://claude.ai/code)_
