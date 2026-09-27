# Revue de palier — fenêtre 0be32dfdb..faaf4139c — 2026-09-27

verdict: PARTIEL

Synthèse du cumul : la fenêtre compte 103 commits (90 hors fusions, 13 fusions), dont 85 de substance. Elle entre sur `main` par 12 têtes qui ont chacune leur course CI « completed/success », sans aucun rouge. La porte des stocks rend `refus: []` sur les 90 commits. Elle porte l'atterrissage de deux trains de fusion : #1897 (`5795d1b73`) et #1473 R2 (`faaf4139c`). Tous deux ont été publiés par `ops:publier` sur le chemin « tronc déjà contenu » du correctif #1998 (`a214fb549`). Les deux correctifs d'outillage tiennent sous leurs tests rejoués : `publier.test.mjs` passe à 81/81, et `lintStage.test.mjs` à 11/11. Les griefs Q et R de la revue précédente sont soldés (`853fc12a0`), ainsi que le cardinal 2280/194 du grief A (`ab077ed7e`). Trois griefs empêchent CONFIRMÉ :
- H récidive : trois commits de substance sortent sans `JUGE:`, et la porte reste aveugle à `scripts/`.
- I récidive : `349c3f0a2` empile un nouveau journal d'occurrences dans `structuresStock.mjs`.
- T, neuf : `7c88af4db` est une fusion BRUTE (message git par défaut, aucun ticket, aucune annotation). Elle est entrée sur `main` sans qu'aucune porte ne la voie.

## Épinglage
- Worktree `.wt-1473-r2` : `git log --oneline -1` → `faaf4139c merge: refs #1473 — main (8a7ffb774), fiches de mémoire des sessions`. `git rev-parse HEAD` = `faaf4139cf45cd3b…`.
- Après `git fetch origin`, `git rev-parse origin/main` = `faaf4139cf45cd3b…`, identique à HEAD. `git status --short` du worktree est vide (0 entrée).
- `origin/main` a BOUGÉ pendant la mesure (une session voisine a fetché) : il est à `df381cb81`, 4 commits au-delà. `merge-base --is-ancestor faaf4139c origin/main` → 0. La fenêtre reste `0be32dfdb..faaf4139c`, la tête PUBLIÉE ; elle n'a pas été déplacée.
- `merge-base --is-ancestor 0be32dfdb origin/main` → 0. `git rev-list --count 0be32dfdb..faaf4139c` → 103, dont 13 `--merges` et 90 `--no-merges`.
- Git : `git version 2.51.0.windows.2`.

## Contrôle positif
- `git show origin/main:scripts/ops/publier.mjs | grep -c "export function decisionDeRebase"` → 1 (#1998).
- `git show origin/main:scripts/guards/lib/lintStage.mjs | grep -c "export function lotsDeLigne"` → 1 (`82bf1cf3d`).
- `git cat-file -e faaf4139c:.claude/soldes/1509.md` et `…/1973.md` → 0, les deux soldes existent.
- `SAVE_VERSION = 58` (`src/state/saves.ts:175`), contre 53 à la base. La chaîne des migrations est contiguë : 53→54 #1874 (`:148`), 54→55 #1869 (`:152`), 55→56 #1897 (`:158`), 56→57 #1924 (`:163`), 57→58 #1473 (`:167`). `SCHEMA_PROJET = 17` (`src/data/schemas/defs-scenes/projet.ts:31`).
- Faits de palier : `chainage: vérifié`, et la revue précédente est lue dans HEAD (`revuePrecedente.disponible: true`).

## L1 — CI sur `main`
- 12 têtes publiées portent une course « CI » `completed/success` (faits `coursesCi`, provenance `gh`) : `faaf4139c`, `8a7ffb774`, `5795d1b73`, `1d03ce796`, `a214fb549`, `7d586fe00`, `ed846ca41`, `4f54b052c`, `e4d782c36`, `7999592dc`, `9dc6e7d32`, `2aa56f1b3`.
- Aucun rouge sur `main`. Les rouges cités dans les messages sont des courses de BRANCHE : « CI rouge de C3 » (`61fef43d7`), « CI rouge de d5f346c7c » (`8578410b1`), « trois rouges de la branche » (`be0385836`).
- Journaux de publication réels :
  - `.wt-1897-doublons-fan/node_modules/.cache/publication/chantier_1897-doublons-fan.log` : « rebase — vert (0.2 s) : tronc déjà contenu — base 1d03ce796 → tête 5795d1b73 », puis « ci — vert (619.5 s) : course 36308835338 verte », puis « PUBLICATION: vert 5795d1b73… » ;
  - `.wt-1473-r2/…/chantier_1473-r2.log` : « rebase — vert (0.2 s) : tronc déjà contenu — base 8a7ffb774 → tête faaf4139c », puis « course 36315303945 verte », puis « PUBLICATION: vert faaf4139c… ».
- Conséquence de forme, non retenue comme grief : un train qui fusionne `main` en lui-même, puis entre en fast-forward, fait de SA ligne la ligne `--first-parent` de `main`. `git log --first-parent 0be32dfdb..faaf4139c` ne montre plus que les commits de R2. Seules deux sondes datées d'audit lisent `--first-parent` (`scripts/ops/sondes/audit-2026-09-01/`), et aucun outil vivant.

## L2 — Annotations
- `JUGE:` et `REFUTATION:` : 82 des 85 commits de substance portent les deux (comptés sur les corps des faits de palier).
  - Deux commits de substance n'ont ni l'un ni l'autre :
    - `8a7ffb774` touche `scripts/guards/budget-contexte.mjs` (plafond 26951 → 26707) ;
    - `7c88af4db` est une fusion brute, qui diffère de 535 fichiers de son premier parent (grief T).
  - Un commit porte `REFUTATION:` sans `JUGE:` : `82bf1cf3d`, qui ne touche que `scripts/`. Voir H.
- `JUGE-VISION:` : 38 des 43 commits de substance qui touchent `src/ui` ou `src/gameIso` hors tests le portent.
  - `9e058cf41` et `349c3f0a2` n'ont pas l'étiquette, mais leur prose porte le jugement : « Recette joueur : pose d'une murale 2×1 à l'éditeur … console à 0 erreur », et « Jugement visuel de l'orchestrateur, passe par passe ». Les captures sont nommées. Écart de FORME seulement.
  - `f9b5cee5d` (`humanize.ts`, 4 lignes) et `6b19a74ee` (`editFields.ts`, 2 lignes) ne changent aucun rendu.
  - `7c88af4db` : aucun jugement (grief T).
- `Claude-Session` : 76 commits sur 103, contre 8/35 au palier précédent (grief D).
- `CLIQUET:` : 68 lignes. Porte de plage : `refus: []`, `notes: []` sur 90 commits. Aucune croissance nette n'échappe à la porte. L'écart de `349c3f0a2` entre `CLIQUET:` et le lecteur est instruit par la revue parallèle (commentaire sur #1889, 2026-09-27T13:29) et n'est pas re-mesuré ici.
- Deux correctifs d'outillage jugés à part :
  - `a214fb549` (#1998) : `JUGE:` et `REFUTATION:` présents, 5 mutations annoncées. Juge de clôture : voir la réfutation de #1998, CONFIRMÉ.
  - `82bf1cf3d` (lint du pre-commit) : `node --test scripts/guards/lib/lintStage.test.mjs` → exit 0, 11/11.
    - La prémisse tient : `lancerLint` part par `execFileSync(process.execPath, …)` (`lintStage.mjs:153`) ; `scripts/lancer-local.mjs` joue le JS du champ `bin` en `shell: false`, sans `.cmd`, donc la limite qui s'applique est bien 32 767 et pas 8 191 ; `BUDGET_DE_LIGNE = 16000` (`:29`).
    - Réserve de forme : le message dit « la fusion 3fa4acb8e a passé le pre-commit avec ce découpage ». Or `3fa4acb8e` est le PARENT de `82bf1cf3d` : la fusion est passée sur un correctif non commité. Aucun défaut de code.

## L3 — Fermetures
- **#1509** : fermée par `github-actions[bot]` le 2026-09-26T18:53, avec `.claude/soldes/1509.md` à `faaf4139c`. Les restes sont au format « corrigé par <fichier>:<ligne> » ou « RAS : … ». La section `## Réfutation` porte `verdict: PARTIEL` (`1509.md:51`) : « Bloquants (tous deux corrigés au solde 6, dans ce commit) ». Voir U.
- **#1973** : fermée par le bot le 2026-09-26T15:21, avec son solde commité dans `2aa56f1b3`.
- Fermetures hors commit : « aucune fermeture non citée » (faits `fermeturesHorsCommit`).
- **#1998** : OPEN à la mesure. `a214fb549` est `refs #1998` : la clôture reste à faire, et sa réfutation est rendue à part (CONFIRMÉ).
- `auditStock` : 5 entrées JAUNE au stock (vite, vitest, miniflare, undici, ws), toutes routées vers #1726, « aucun écart au stock daté ».

## L4 — Griefs hérités

| Grief | État | Mesure |
|---|---|---|
| A — cardinaux | SOLDÉ (`ab077ed7e`) | `toBe(2280)` et `toBe(194)` n'existent plus dans `src/data/structures-contrat.test.ts`. L'égalité se fait sur `objetsAOp`, compté par une marche brute indépendante (`:1680-1692`, prémisse `toBeGreaterThan(0)` à `:1688`). #1889 reste OPEN (il porte aussi le grief I). |
| B — Source/ hors substance | TENU, latent | `revuePalier.mjs:168` `DOSSIERS_DE_SUBSTANCE = ['src', 'scripts']`, inchangé. Un seul commit touche `Source/` (`c3ea342f3`), et il touche aussi 6 fichiers `src`/`scripts`. Les 13 commits qui touchent `docs/raw` sans `src`/`scripts` sont des « docs dérivés » générés. 0 réécriture n'échappe à la substance. #1890 OPEN. |
| C — stock CSS | NEUTRE | 6 `.css` touchés, dont 3 neufs (`iso-stage.css`, `pastille-entite.css`, `plaque-nom.css`), nés de la scission d'`anim.css` par #1509 (`9e058cf41`, `ea359dff2`). Les sélecteurs sont déplacés, pas créés ; ce n'est pas re-mesuré classe par classe. |
| 3 — jetons à espace | TENU | `git log 0be32dfdb..faaf4139c -- scripts/guards/lib/stocksNominatifs.mjs` est vide. #1840 OPEN. |
| 5 — `combatManeuvers.ts:440` | TENU, 6ᵉ palier | `const dur = Math.max(1, bonus(effectiveChar(attacker, 'endurance')));` est intact. #1817 OPEN. |
| 6 — réserves d'outillage | TENU | `revuePalier.mjs:118` porte `--diff-filter=A`. `git grep -c run_attempt faaf4139c -- scripts/ops/` → exit 1. |
| D — `Claude-Session` | TENU, en progrès | 8/35 → 76/103. #1750 OPEN. |
| G — dépendances | SOLDÉ dans la fenêtre | Les tickets neufs portent leur sens : #1998 = 1 ligne (« Débloque la publication de #1897 … »), #1983 = 1. Ce qui restait sur #1880 et #1891 n'est pas re-mesuré. |
| H — deux définitions de la substance | TENU et RÉCIDIVE | `solde-ticket-guard.mjs:1775` `touchesSrc: fichiers.some((f) => /^src\//.test(f))`, inchangé. Le seul diff du fichier dans la fenêtre est `estFichierVitest`. Récidive : `8a7ffb774` (garde `budget-contexte.mjs`, ni `JUGE:` ni `REFUTATION:`) et `82bf1cf3d` (garde de lint du pre-commit, sans `JUGE:`). |
| I — journal d'occurrences en commentaire | TENU et RÉCIDIVE | `349c3f0a2` (trouvé par `git log -S` sur « 297 → 379 ») ajoute « 297 → 379 (#1343 lot C, 2026-09-26) » à la chronique de `structuresStock.mjs:444`. Les journaux de `:231` et `:395` restent. Routé par la revue parallèle (commentaire #1889, 2026-09-27T13:29). |
| J — deux maisons | SOLDÉ ; réserve TENUE | `src/ui/compendium/DescRefField.tsx:157` `useMemo(() => books.filter((b) => estExtrait(b.id)), [])` est intact. |
| K — forme de `6c764b041` | NEUTRE | Historique publié. |
| L — `pdfHorsCouture` lexicale | TENU, routé | `pdfHorsCouture.mjs:16` `String.fromCharCode(112, 100, 102)`. |
| M — prémisse de l'arbitrage #1973 | ROUTÉ, prémisse toujours fausse | Commentaire posé sur #1973 le 2026-09-26T16:57 (« Grief M de la revue de palier … »). À la mesure du jour, `git -C …/Foundry/Game status --short` → 13 entrées, toutes STAGÉES (colonne d'index `M`) : `.claude/memory/*.md` ×10, `docs/doctrines.md`, `scripts/guards/memoire-forme.mjs` et son test. Aucune réponse de l'utilisateur n'est mesurée. |
| N — solde #1973 | SOLDÉ | Dit au palier précédent. |
| Q — commentaire prédictif | SOLDÉ (`853fc12a0`) | La JSDoc de `MondeDuMeneur` (`src/state/combatants.ts:111-115`) dit ce que le type EST ; « deviendra ÉLU » a disparu du fichier. |
| R — banc au héros incomplet | SOLDÉ (`853fc12a0`) | `npx vitest run src/state/meneur-unique.test.ts` → exit 0, 23/23, 0 ligne `bodyPlan`. La classe est routée vers #1983 (bloqué par #1570). |
| S — #1929 absorbé, OPEN | TENU | #1929 est OPEN, sans solde à `faaf4139c`. Commentaire de la revue parallèle le 2026-09-27T13:33 : la citation NADJ 16 manque au ticket. |

## L5 — Substance et prémisses
- **Trains de fusion #1897 (`5795d1b73`) et #1473 (`3fa4acb8e`, `2162de825`, `faaf4139c`)** :
  - `SAVE_VERSION` a été renumérotée à chaque fusion : 57 (#1897), puis 57 (R2 sur le tronc #1897), puis 58. Le prédécesseur publié sur `main` à chaque étape garde son numéro : #1869 garde 54→55, publié avant les trains. La chaîne finale est contiguë et unique (Contrôle positif). Aucune version déjà publiée n'est renumérotée.
  - Les résolutions annoncent une suite complète sur l'arbre fusionné (`5795d1b73` : 1773 fichiers et 24 815 tests ; `2162de825` : node 1582/1583 et jsdom vert). Ce n'est pas rejoué ici (machine partagée).
  - Les `JUGE:` de `5795d1b73` et `3fa4acb8e` renvoient à un verdict « dans le scratch de session (integ-1897) » et « (integ-1473) ». Hors du message, rien ne le porte (grief V).
- **#1998 (`a214fb549`)** : voir la réfutation de clôture, CONFIRMÉ. Le chemin « contenu » est joué deux fois en réel (L1). Les chemins « fusions » et « relance » ne sont prouvés qu'en dépôt jetable (`publier.test.mjs`, 81/81).
- **`82bf1cf3d`** : voir L2.
- **`7c88af4db`** :
  - parents `06bdb39cb` et `56a12f699`, ni l'un ni l'autre ancêtre de l'autre ;
  - `git diff-tree --cc --name-only` est vide, donc aucune résolution « maléfique » ;
  - auteur `Claude <noreply@anthropic.com>`, +0000 (session cloud) ;
  - sonde de la porte du sujet (`scripts/guards/lib/sujetDeCommit.mjs`) : `refusDeSujet` rend `null` sur le sujet « Merge commit '56a12f699' into chantier/1897-doublons-fan », et `null` aussi sur « fix: sans ticket ». La porte `commit-msg` n'exige aucun `#N` (grief T).

## Ce qui empêche CONFIRMÉ

**H — Récidive : trois commits d'outillage de garde sans `JUGE:` (`8a7ffb774`, `82bf1cf3d`), dont un sans `REFUTATION:` non plus.** La porte reste aveugle à `scripts/` (`solde-ticket-guard.mjs:1775`).
→ Correction exacte : `touchesSrc` dérive de `estCheminDeSubstance` (`revuePalier.mjs:172`). Commentaire sur #1890. **MOYEN.**

**I — Récidive : chronique « 297 → 379 (#1343 lot C, 2026-09-26) » empilée par `349c3f0a2`** (`structuresStock.mjs:444`), et journaux intacts à `:231` et `:395`.
→ Correction exacte : retirer les chroniques « a → b » (git porte l'historique) ; les occurrences se comptent à la porte (#1889 / #1463). Déjà routé sur #1889 par la revue parallèle. **MOYEN.**

**T — Fusion brute sans ticket ni jugement sur `main` (`7c88af4db`, « Merge commit '56a12f699' into chantier/1897-doublons-fan »).** Elle touche `src/` et diffère de 535 fichiers de son premier parent, avec 0 `#N`, 0 `JUGE:` et 0 `REFUTATION:`. La porte du sujet la laisse passer (sonde ci-dessus), et la porte `JUGE:` ne la voit pas.
→ Correction exacte : `refusDeSujet` (`scripts/guards/lib/sujetDeCommit.mjs`) refuse un sujet sans `#N`, fusions comprises. Le train de fusion refuse à la publication un commit sans ticket de sa plage : `numerosDeLaPlage` existe déjà dans `publier.mjs`. Issue à ouvrir sous #1750. **MOYEN.**

**U — #1509 fermé sur un verdict de réfutation PARTIEL**, dont les bloquants sont « corrigés au solde 6, dans ce commit » (`1509.md:51-62`), sans nouvelle passe de réfutation sur ces corrections.
→ Correction exacte : la clôture exige un verdict CONFIRMÉ, ou une passe de réfutation sur le commit correctif. Commentaire sur #1509 qui nomme les deux bloquants à re-sonder (manifeste `primitives.manifest.json:874`, tombales `SansWebgl.tsx:7` et `stage-sun-wiring.test.tsx:329`). **MINEUR.**

**V — Verdicts de juge hors histoire** : les `JUGE:` de `5795d1b73` et `3fa4acb8e` renvoient au scratch de session (integ-1897, integ-1473), qui est éphémère.
→ Correction exacte : le `JUGE:` porte le verdict et sa mesure dans le message, ou pointe un fichier committé. **MINEUR.**

**W — Deux revues de palier ont la même base `0be32dfdb`.** La revue parallèle a pour fenêtre `0be32dfdb..50610a9bb`, et `50610a9bb` n'est que sur `origin/chantier/1801` : `merge-base --is-ancestor` → 1 dans les deux sens avec `faaf4139c`. Ses griefs S et I sont déjà posés sur #1929 et #1889. La seconde des deux archivée sur `main` violera l'enchaînement des fenêtres (`problemesDeRevueNeuve`, `solde-ticket-guard.mjs:1128`).
→ Correction exacte : l'orchestrateur n'archive qu'UNE revue de base `0be32dfdb` ; l'autre se ré-écrit sur la fenêtre suivante. **MINEUR, coordination.**

**M — Routé, non tranché.** L'arbre principal porte 13 entrées STAGÉES d'une autre session, dont `scripts/guards/memoire-forme.mjs`. Le commentaire est posé sur #1973 ; il reste à soumettre à l'utilisateur. **MOYEN, inchangé.**

**S — #1929 : TENU.** La revue parallèle a posé le constat au ticket. **MINEUR.**

## Non couvert
- Suite complète, typecheck complet et `npm run gates` ne sont pas rejoués (machine partagée). Seuls ces périmètres l'ont été : `publier.test.mjs` 81/81, `lintStage.test.mjs` 11/11 et `meneur-unique.test.ts` 23/23.
- Les résolutions de conflit des quatre fusions de main dans #1897 et des trois fusions de R2 ne sont pas relues fichier par fichier. Seuls ont été vérifiés la chaîne `SAVE_VERSION` et `diff-tree --cc` de `7c88af4db`.
- Aucune capture ouverte : les 38 `JUGE-VISION:`, ainsi que les recettes de `9e058cf41` et `349c3f0a2`, ne sont pas vérifiées visuellement. Le « BON » n'est pas prononcé.
- `CLIQUET:` : les 68 lignes ne sont pas rejouées une à une au lecteur. La porte de plage (`refus: []`) et l'instruction parallèle de `349c3f0a2` en tiennent lieu.
- Mutations annoncées (`a214fb549`, `82bf1cf3d`, `ea359dff2`) : non rejouées. C'est le rôle du codeur ; seuls les tests ont été rejoués.
- RAW : aucune citation relue au `Source/` dans cette fenêtre.
- CSS : les 3 feuilles neuves de #1509 ne sont pas re-mesurées classe par classe (grief C).
