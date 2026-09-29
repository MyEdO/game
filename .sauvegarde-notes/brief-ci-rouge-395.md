# Brief du codeur : CI rouge de 395e1d4c4 (R-M2 lot A), cause racine de chaque échec (#1806), 2026-09-28

## Worktree et interdits
- `/home/user/game/.wt-1806-L1`, branche `wt/1806-L1`, HEAD `395e1d4c4`. Le worktree porte DÉJÀ, non commités, le train 2 (placement bord droit, délégation unique de `Infobulle`) et la coupe au mot mutualisée (`src/lib/coupeAuMot.ts` + garde) : garde-les, corrige par-dessus.
- Interdits : tout `git checkout/restore/reset/stash/add/commit/apply`, écriture dans `node_modules`. Chemins absolus, rien hors du worktree (l'arbre principal `/home/user/game` doit rester propre). Processus bornés, listés au rendu. Budget : **1 h 30**.

## Les échecs (reproduits par l'orchestrateur sur l'arbre principal à 395e1d4c4, sans le train 2)
`npx vitest run` : « Test Files 7 failed | 1811 passed (1818) ; Tests 17 failed | 25385 passed ». `npm run test:hooks` : 1 échec. Sorties brutes : `/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/vitest-395.txt`, `hooks-395.txt`.
1. `scripts/hooks/new-src-file-guard.test.mjs:97` « DISJONCTION (#1806 L3) : aucun `fichier` du manifeste des primitives n'est inscrit au registre des écrans » → `src/ui/compendium/CodexRef.tsx` est au manifeste (primitive `codex-ref`, née au lot A) ET au registre des écrans.
2. `src/ui/raccourcis-registre.test.ts:65` : « `src/ui/Infobulle.tsx` : écouteur clavier global hors du registre — pose le raccourci dans `state/keybindings.ts` […] ou déclare la couche dans l'en-tête du fichier par « @clavier-hors-registre <raison> » ».
3. `src/ui/choix-retenu-guard.test.ts:291` : `src/ui/gallery/registry.tsx:894` (spécimen de galerie ajouté par le lot A) « écrit son propre état » de divulgation au lieu du chevron canonique.
4. Menu d'ajout vide : `EffectList.test.tsx` (9), `GameOpEditor.seeds.test.tsx` (7), `GameOpEditor.test.tsx` (1), `FlowEditor.test.tsx` (1 : `renderToStaticMarkup` rend `<details class="eff-add"><summary …>+ Bloc</summary></details>` SANS les entrées), `WorldMapEditor.test.tsx:307` (1, élément introuvable). Plus des résidus DOM (#1619, `src/test-setup.ts:395`) dans les mêmes fichiers.

## Invariant et doctrine
- Credo, verbatim : « Un test qui verrouille un comportement faux se réécrit depuis le RAW » ; « jamais travestis pour passer ». Donc pour CHAQUE échec, établis d'abord (sortie de sonde ou `fichier:ligne` cités) si c'est le CODE du lot qui régresse (le joueur perd quelque chose) ou le TEST qui verrouillait un détail d'implémentation que le lot a légitimement changé. Hypothèse à RÉFUTER pour le point 4 : avant le lot, `AddMenu` rendait ses entrées dans un `<details>` natif, présentes au DOM même fermé ; `BoiteAncree` ne rend la boîte (portail) qu'ouverte et placée, donc les entrées manquent au rendu statique et aux tests qui ne les ouvrent pas, et le portail sur `document.body` laisse un nœud (résidu #1619). Vérifie : lecture de `git show c160fc3c3:src/ui/editor/AddMenu.tsx` contre l'actuel ; recette en joueur rapportée le 2026-09-28 : « AddMenu (« + Bloc », FlowEditor d'un trigger) : OK. Collé à son bouton, aucun débordement ».
- Si le code du lot est juste (menu fermé = pas de boîte, comme toute surface ancrée), les tests ouvrent le menu par le geste joueur (clic sur le `summary`/bouton) et démontent ce qu'ils montent ; si le rendu statique d'entrées fermées portait un sens (accessibilité, recherche), c'est le code qui se corrige. Tranche avec la preuve.
- Point 1 : un composant est une primitive OU un écran (la garde le dit) ; `CodexRef` est devenu une primitive au lot A → il quitte le registre des écrans (trouve ce registre : `git grep -n "CodexRef" -- scripts src | grep -i ecran`), et tout ce que ce registre imposait (captures, recette) se reporte sur ce que la primitive exige.
- Point 2 : la délégation de la couche écoute `keydown` au document (Échap, ↓). Soit l'Échap/↓ de la couche passe par le registre des raccourcis (`state/keybindings.ts`, joué par `useGameKeyboard`), soit la couche est « hors registre par nature » : lis l'en-tête des autres couches déclarées `@clavier-hors-registre` (`git grep -n "@clavier-hors-registre" -- src`) et tranche avec citation ; une déclaration sans raison vraie est un mensonge.
- Point 3 : le spécimen reprend le chevron canonique (lis la garde pour savoir ce qu'elle attend).
- Tout test réécrit : mutation (le code fautif réintroduit rougit le test).

## Portes (sortie BRUTE, code sans pipe) — la suite ENTIÈRE, c'est l'objet du lot
- `npm run typecheck:fast`.
- `npx vitest run` EN ENTIER dans le worktree (≈ 8 min, `timeout 1500`), résumé « Test Files … / Tests … » collé : 0 échec exigé.
- `npm run test:hooks` en entier : 0 échec.
- eslint sur tes fichiers ; `npm run docs:build` puis `npm run docs:check` si un doc généré bouge.

## Livrable
`/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/rendu-ci-rouge-395.md` : par échec, cause établie (code ou test) avec preuve, correction, mutation ; les sorties des portes ; processus. Résumé factuel dans ta réponse.
