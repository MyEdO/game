---
name: feedback-codeur-tests-du-perimetre-gates-une-fois-au-train
description: "Un codeur ne joue que les tests de SON périmètre ; les gates (lint, knip, docs:check, suites entières) se jouent UNE fois, au train de publication — jamais dans le brief du codeur"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fcb6a280-87dc-4980-95ca-97561d13d0f6
  modified: 2026-09-15T19:02:00.276Z
---

**Verbatim utilisateur (2026-09-15)** : « C'est absurde ... on a dépêché un agent pour créer un fichier (+ son test, + le lien pour l'appeler) et ça va nous prendre 25 min ? » — dit sur #1768 (`scripts/ops/board.mjs`), où le codeur a mesuré ~12 min de code + test verts (24/24) puis ~13 min de gates imposées par MON brief (lint ~2 min, knip ~4 min, docs:check ~5 min, `test:ops` 220 tests), que `npm run ops:publier` rejoue de toute façon à la publication.

**Why :** les gates sont jouées UNE fois par le train de publication (`ops:publier` : gates → ff → push, justificatif keyé sur la tête). Les faire jouer AUSSI par le codeur double le coût sans ajouter une preuve : le train refuserait le même rouge. C'est l'« empilement de gates » du mandat #1757 (2026-09-14), reproduit par un brief.

**How to apply :** dans un brief de codeur, la section « Gates à jouer » ne contient que (a) le test du fichier livré (`node --test <son test>` / `npx vitest run <ses fichiers>`), (b) l'exécution réelle de l'outil livré en lecture seule (`-- --liste`), (c) `npm run typecheck:fast` si du `.ts` bouge. Lint, knip (`deps:unused`), `docs:check`, suites entières, `docs:build` : au train de publication, une fois, par l'orchestrateur. Si une gate du train rougit, le correctif est un train COURT, pas une gate de plus dans le brief suivant. Voir aussi [[user-doctrine-chantier-outille-sans-reinventer]] et #1738 (coût des gates).
