# Rendu : corrections R-M2 lot A (D1 à D3), plus la mesure de délégation, 2026-09-28

Arbre `/home/user/game`, branche `chantier/1806`, HEAD `d3b9fdf6f`. Index NON touché : `git diff --cached --name-only | wc -l` = 47 avant et après. Toutes les retouches sont dans l'arbre de travail.

## D1 : BoiteAncree
- `src/ui/BoiteAncree.tsx:37-38` :
  ```ts
  const NOMMES = ['left', 'top', 'bottom', 'maxHeight', 'width'] as const satisfies readonly (keyof PlacementAncre)[];
  const CHAMPS: Exclude<keyof PlacementAncre, (typeof NOMMES)[number]> extends never ? typeof NOMMES : never = NOMMES;
  ```
  `VARIABLES` a disparu. `placementsEgaux` (:60) lit `CHAMPS`. Le littéral `style=` reste la seule écriture des noms `--ancre-*` et n'a pas bougé.
- ÉCART avec la forme verbatim du juge : `const _c: _Complet = true;` fait échouer `typecheck:fast` avec `TS6133: '_c' is declared but its value is never read` (tsconfig `noUnusedLocals: true` ; le `varsIgnorePattern '^_'` d'eslint ne couvre pas tsc). Le dépôt n'a aucun idiome d'exhaustivité par `extends never` : `git grep "extends never" -- src` ne renvoie que deux usages sans rapport (psych-acquisition.test.ts:29, soutien-visible.test.ts:126). J'ai donc retenu une forme où le contrôle est CONSOMMÉ : la liste typée `never` quand un champ manque est celle que lit l'égalité.
- En-tête :18-22 : `CHAMPS` est complet par le type ; le littéral est la seule écriture des noms ; sa complétude n'est pas prouvée par le type, car (xxii) interdit la forme qui le permettrait ; le test vérifie les cinq variables qu'il nomme.
- Manifeste `boite-ancree` : `concept` et `verrou` sont réécrits dans ce sens. `docs/primitives.md` est régénéré (`npm run docs:primitives`, exit=0, 151 primitives).
- Mutation, preuve de l'exhaustivité :
  - Avant : `c6c757b75f85bddc8a9a4b54e80ba2c3174e83b3`.
  - Mutation 1, `zIndex: number;` ajouté à `PlacementAncre` (empreinte `42cf8549…`) : exit=2, `BoiteAncree.tsx(39,7): TS2322 Type 'readonly [...]' is not assignable to type 'never'`, plus TS2741 sur `placerAncre`.
  - Mutation 2, `zIndex?: number;` (empreinte `a9394617…`). Elle isole le contrôle, puisque `placerAncre` ne rougit plus : exit=2, TS2322 à (39,7) et TS2339 `'every' does not exist on type 'never'` à (61,36).
  - Restauration par copie : `c6c757b75f85bddc8a9a4b54e80ba2c3174e83b3`, identique. typecheck:fast exit=0.
- Garde (xxii) : la forme du littéral `style=` n'a pas bougé. `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/cssCouchesAudit.ts --check` → « Stock à jour », exit=0.

## D2 : « popover » devient « infobulle »
Le contre-grep `git grep -n -i popover -- <44 fichiers src du lot>` passe de 113 lignes (`c-grep-avant.txt`) à 6 lignes (`c-grep-apres.txt`). Les 6 restantes relèvent d'un AUTRE concept :
- `LayerNature` de dismissStack :
  - `primitives.manifest.json:89` (« nature `modale`/`popover` ») ;
  - `stageWalk.test.ts:317` (titre du cas sur la nature) et `:321` ;
  - `Infobulle.tsx:198`.
- Déroulant de `MediaSelect` : `primitives.manifest.json:368` et `styles.css:45`.

ÉTENDU au-delà des lignes citées par le juge : toutes les occurrences qui désignent l'infobulle dans les fichiers du lot (« un concept, un terme »).
- Fichiers : `ResilienceButton.test.tsx`, `RollLine-codex-chips.test.tsx`, `jetProps/useAttackJetProps.conformance.test.tsx`, `wrap-keyboard-vs-cursor.test.tsx`, `state/resoudreEchap.ts:7`, ainsi que toutes les lignes de `CombatConsole.test.tsx` et de `CodexRef.hooks.test.tsx`.
- Identifiants renommés : `popovers` → `infobulles` (CombatConsole.test.tsx), `sommetEstLePopover` → `sommetEstLInfobulle` (CodexRef.hooks.test.tsx), `popover(v)` → `infobulle(v)` (useAttackJetProps.conformance.test.tsx).
- L'accord grammatical est fait (féminin).
- Aucun comportement ne change : seuls des commentaires, des messages d'assertion, des titres de cas et des noms locaux bougent.

## D3 : CodexRef
`src/ui/compendium/CodexRef.tsx:89-90` : « Rendu en `aria-label` SEUL. Le `title` de la porte ↓ (:178) est une 2ᵉ boîte native, purgée au lot B, design R-M2 v4. » Le nombre de lignes n'a pas changé : :178 est toujours la ligne du `title`. `comment-poison-guard` est vert.

## Docs générés
`npm run docs:build` exit=0. Les 24 mêmes docs sont modifiés, avec leurs empreintes remises à jour. Aucun doc neuf.

## Portes
| Commande | Résultat |
|---|---|
| `npm run typecheck:fast` | exit=0, 0 erreur |
| `npx vitest run --no-cache` sur 19 fichiers (`c-perimetre.txt`) | exit=0, 19 fichiers, 436 tests verts |
| `npx eslint` sur les 15 fichiers .ts/.tsx touchés | exit=0, aucune sortie |
| Stock cssCouches `--check` | exit=0 |

Les 19 fichiers du vitest : les touchés, plus BoiteAncree, comment-poison-guard, ui-ratchets, primitive-owners-guard, keybindings, Infobulle, maison-sans-source, gallery-exhaustive et css-modules-guard.

Stylelint n'a pas été joué sur `components.css` : seul un commentaire y change.

## Mesure (jsdom, test jetable hors dépôt : `scratchpad/mesure/`, config `vitest.mesure.config.mts`)
Sortie brute : `scratchpad/mesure/sortie.txt`, exit=0.

| Cas | Écouteurs document nets | `[data-infobulle]` |
|---|---|---|
| CodexRef N=0 | 0 | 0 |
| CodexRef N=1 | 7 | 1 |
| CodexRef N=10 | 70 | 10 |
| CodexRef N=50 | 350 | 50 |

- Chaque instance pose 7 écouteurs, un par type : mouseover, mouseout, focusin, focusout, click, keydown (capture) et mousedown. Chiffres identiques en `wrap` et hors `wrap`.
- Rendu de `CombatConsole` (fixture `monter` de CombatConsole.test.tsx, héros soldat) : `[data-infobulle]` = 8 et `.codex-ref` = 8, soit 56 écouteurs document au montage. Même chiffre avec 1 adversaire.
- Coût d'un `mouseover` hors act, moyenne sur 200 : 0,1 à 0,4 ms en jsdom (N=50 : 0,29 à 0,42 ms ; console : 0,24 à 0,31 ms). Ce n'est pas un chiffre navigateur.
- Le code n'a pas été changé.

## Processus
- Tous au premier plan et terminés : typecheck:fast ×6, vitest ×2, eslint, regenStock, docs:build et docs:primitives.
- Aucun processus en arrière-plan. Aucun serveur ni navigateur lancé ; ceux du recetteur n'ont pas été touchés.
- Fichiers jetables hors dépôt : `scratchpad/mesure/*`, `scratchpad/d2.py`, `scratchpad/BoiteAncree.orig`.
