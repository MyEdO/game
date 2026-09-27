# Revue de palier — fenêtre a5f75c61f..0be32dfdb — 2026-09-26

verdict: PARTIEL

Synthèse du cumul : la fenêtre compte 54 commits, dont 35 de substance, publiés en 22 pushes sur `main`. Les 22 courses CI sont vertes au premier essai, et la porte des stocks ne refuse rien sur la plage. Le lot #1362/#1849 L1a (un meneur, cap au groupe) et la chaîne CRB #1739/#1393 (légendes, renvois) tiennent sous leurs tests rejoués (69/69 et 94/94, plus 8/8). Trois griefs empêchent CONFIRMÉ :
- H récidive : #1973 réécrit les consignes des agents et cinq hooks sans aucun `JUGE:` ni `REFUTATION:`.
- I récidive : journal de recalage d'occurrences dans `structuresStock.mjs`.
- M, neuf : la prémisse de l'arbitrage de #1973 (« personne ne touche a l'arbre principal ») est fausse à la mesure du jour. L'arbre principal porte 35 entrées de travail non commité, que plus aucune confirmation ne protège.

## Épinglage
- Worktree `.wt-1973` : `git log --oneline -1` → `0be32dfdb chore(docs): refs #1362 refs #1849 — docs dérivés`. `git rev-parse origin/main` = `0be32dfdb00d81cd…`. `git diff --quiet origin/main HEAD` → 0.
- `merge-base --is-ancestor a5f75c61f origin/main` → 0 ; `origin/main HEAD` → 0.
- `git status --short` du worktree : une seule entrée, `A .claude/soldes/1973.md`, la pièce à venir.
- Arbre principal `…/Foundry/Game` : `main@0be32dfdb`, 35 entrées non commitées (voir M).

## Contrôle positif
- Présents dans `origin/main` (`git cat-file -e` → 0 pour chacun) :
  - `src/state/hero-debout-guard.test.ts`, `scripts/guards/lib/heroDebout.mjs`, `src/gameIso/stage/cap-groupe-monte.test.tsx` ;
  - `scripts/hooks/commande-piege-guard.mjs` ;
  - `scripts/raw/renvois-stock.json`, `src/data/source/renvoi.ts` ;
  - `scripts/docs/lib/chemin-mesure.mjs`.
- Retrait vérifié : `git cat-file -e origin/main:scripts/hooks/git-destructive-guard.mjs` → 128, fichier absent.
- `SAVE_VERSION = 53` (`src/state/saves.ts:148`) : 51 → 52 (`6650cd6a5`), puis → 53 (`56dd6574d`).
- La fenêtre compte 54 commits, dont 35 de substance ; le chaînage est « vérifié » (faits de palier).

## L1 — CI sur `main`
- 22 pushes (`gh run list --branch main --workflow CI`, filtré sur la fenêtre). Chacun a sa course « CI », `event push`, `completed success`, `attempt 1`.
- Du plus récent au plus ancien : `0be32dfdb` (36245617666), `69d497a12`, `54a60d4f8`, `f4b01419d`, `c0161e81c`, `0a009ac66`, `cfbe14bae`, `f3bb4cbd7`, `8f0aa0362`, `835bdda51`, `9af7062b0`, `c399d309e`, `bb0a36893`, `1fe270153`, `bec09219c`, `44a201dca`, `8ac3c1dbf`, `991809508`, `b027d548d`, `e1d0fde9a`, `ae8fe0588`, `3cccc4f62` (35860868423).
- Aucun rouge sur `main`. Les rouges cités par les messages sont des courses de branche : 36240883891, 36241745540, 36166028538, 36156997649, 35980282806.

## L2 — Annotations
- `JUGE:` et `REFUTATION:` : 23/35.
  - 3 commits de substance n'ont ni l'un ni l'autre : `54a60d4f8`, `f4b01419d` (tous deux #1973) et `a08d362b2` (1 fichier `src/`, sous `SUBSTANTIVE_MIN_LINES`).
  - 9 ont `REFUTATION:` sans `JUGE:` : `a0d9dc318`, `0a009ac66`, `9af7062b0`, `c399d309e`, `af2a08ab1`, `74600e7d7`, `8ac3c1dbf`, `d0dc052dc`, `b027d548d`. Aucun ne touche `src/`, et la porte l'exige seulement de `src/` (`evaluateJuge`, `solde-ticket-guard.mjs:1446`, `touchesSrc` à `:1774`). Voir H.
- `JUGE-VISION:` : 10/10 sur les commits qui touchent `src/ui` ou `src/gameIso` hors tests : `56dd6574d`, `8e6f8aed4`, `6650cd6a5`, `f5cbce597`, `f4c25b053`, `6d233220d`, `1de2d048c`, `1a2eeb5d9`, `7e2e64398`, `342beec47`.
- `Claude-Session` : 8/35 (`69d497a12`, `b1b3a61b7`, `7b13241b8`, `a08d362b2`, `f5cbce597`, `f4c25b053`, `1a2eeb5d9`, `7e2e64398`), contre 0/9 au palier précédent.
- `CLIQUET:` : 34 lignes rejouées au lecteur de la porte (`cliquetsDuMessage`, `entreesDeStock`).
  - 25 sont EXACTES, dont `ecrivainsAtteints.test.mjs` 141→154 en 9 pas, `renvois-stock.json` 0→23, `source-format-stock.json` 78→997 et `horsStrateStock.mjs` 1178→1181.
  - 8 sont en ÉCART au lecteur :
    - `ddc7da429` `structuresStock.mjs` +26 : le lecteur voit 1076→1076. Les 26 sont des OCCURRENCES (grief I).
    - `ddc7da429` `slots-contrat.test.ts` +1, `cd1484294` `check-source-format.test.mjs` +919 et `1de2d048c` `grammaire-guard.test.ts` +1 : le lecteur voit 0 de net partout. Pour les deux premiers, le message nomme une constante de plafond (`DETTE_ADOPTION_MAX` 348→349, `PLAFOND` 78→997) ; la ligne de `1de2d048c` n'a pas été relue.
    - `8e6f8aed4` `source-tables-stock.json` +6 (net −35) et `b1b3a61b7` `renvois-stock.json` +1 (net −2) : ajouts BRUTS sous une baisse nette.
    - `f4b01419d` `exception-add-guard.test.mjs` +1 et `chemin-mesure.test.mjs` +1 : net 0 au lecteur.
  - 1 ligne n'est pas retenue par le lecteur : `f5cbce597`, « `horsStrateStock.mjs ±0` », forme hors grammaire `+N`.
  - Porte de plage : `refus: []` sur les 54 commits. Aucune croissance nette n'est non couverte.

## L3 — Fermetures
- **#877** : fermée par `github-actions[bot]` le 2026-09-23T22:58, avec `.claude/soldes/877.md` dans l'index de `10e7dfa10`. Restes : 2 `RAS` soldés par #1882, 1 routé → #1343 (OPEN), 1 routé → #1884 (OPEN).
- **#1894** : fermée par `github-actions[bot]` le 2026-09-23T12:41, avec son solde dans l'index de `3cccc4f62`. Restes : 4 « corrigé dans ce commit », 1 `RAS`.
  - Trois jours plus tard, `f4b01419d` retire la règle de suppression de #1894 dans `juge.md`, `codeur.md`, `.codex/agents/*.toml` et le skill `orchestrer-des-agents`, sur un arbitrage utilisateur daté et verbatim. Le volet « le juge ne mute jamais » survit.
- Fermetures hors commit : aucune (« aucune fermeture non citée dans la fenêtre »).
- **#1973, pièce à venir** (`.claude/soldes/1973.md`, stagé) :
  - Les deux courses de branche citées sont vérifiées : 36237732295 → `chantier/1973`, `f4b01419d`, success ; 36242170730 → `54a60d4f8`, success.
  - Le reste « `git grep -nE "add (-f|--force)"` → 0 » tient : l'unique occurrence est le solde lui-même, qui est dans l'index.
  - Deux restes disaient « corrigé dans ce commit » alors que la correction est dans `f4b01419d`, publiée (grief N) : réécrits en « corrigé par f4b01419d <fichier>:<ligne> » avant le commit du solde.
- Tickets absorbés : #1929 est dit « absorbé » par `6650cd6a5`, publié le 2026-09-25. Il reste OPEN avec un seul commentaire, de publication, sans solde. #1906 est OPEN avec une justification écrite (commentaire du 2026-09-26T09:21).

## L4 — Griefs hérités

| Grief | État | Mesure |
|---|---|---|
| A — cardinaux | TENU | `src/data/structures-contrat.test.ts:1699` `toBe(2280)` et `:1711` `toBe(194)` : `git diff a5f75c61f origin/main` sur le fichier est vide. #1889 OPEN. |
| B — Source/ hors substance | TENU, latent | `scripts/guards/lib/revuePalier.mjs:168` `DOSSIERS_DE_SUBSTANCE = ['src', 'scripts']`. #1890 OPEN. Dans la fenêtre, 8 commits touchent `Source/`, et tous touchent aussi `src/` ou `scripts/` : 0 n'échappe. |
| C — stock CSS | NEUTRE | 4 `.css` touchés (`layout.css`, `codex-edit.css`, `styles.css`, `tavern.css`), 0 classe neuve. La primitive `Split` est corrigée en place (`minmax(0, 1fr)`), `.de-reflrow > *` étend un sélecteur existant. |
| 3 — jetons à espace | TENU | `stocksNominatifs.mjs` n'est touché par aucun commit de la fenêtre (`git log a5f75c61f..origin/main -- scripts/guards/lib/stocksNominatifs.mjs` vide). #1840 OPEN. |
| 5 — `src/state/combatManeuvers.ts:440` | TENU, 5ᵉ palier | `const dur = Math.max(1, bonus(effectiveChar(attacker, 'endurance')));` est intact. `7e2e64398` touche le fichier sans cette ligne. #1817 OPEN. |
| 6 — réserves d'outillage | TENU | `revuePalier.mjs:118` porte `--diff-filter=A` ; `git grep run_attempt origin/main -- scripts/ops/` → exit 1. |
| D — `Claude-Session` | TENU, en progrès | 0/9 → 8/35. #1750 OPEN. |
| G — dépendances | RÉCIDIVE | `grep -ciE "bloqué par\|débloque\|prérequis"` sur le corps : #1880 = 0, #1891 = 0 ; #1973, neuf, = 0 alors qu'il défait #1894. En regard : #1966 = 1, #1970 = 3, #1971 = 1, #1879 = 1. |
| H — deux définitions de la substance | TENU et RÉCIDIVE | `solde-ticket-guard.mjs:1774` `touchesSrc: fichiers.some((f) => /^src\//.test(f))`, inchangé. Routé par un commentaire sur #1890 (2026-09-23T12:22). Récidive : `f4b01419d` (42 fichiers, dont `.claude/agents/juge.md`, `codeur.md`, `.codex/agents/*.toml` et 2 SKILL.md) et `54a60d4f8` (9 hooks), 0 `JUGE:` et 0 `REFUTATION:`. |
| I — dette divergente par occurrences, journal en commentaire | TENU et RÉCIDIVE | Routé par un commentaire sur #1889 (2026-09-23T12:22). Récidive `ddc7da429` : `structuresStock.mjs`, ligne `arene-projet.json \| ref` 406→421, commentaire « // 406→421 : +15 OCCURRENCES — … ; 293→406 : +113 OCCURRENCES — … » (journal empilé). Ligne `loup-et-saumure-projet.json` : « 12→23 : +11 ». Au lecteur : 1076→1076. |
| J — deux maisons, une définition | SOLDÉ (`ae8fe0588`) | Définition unique `estLivreExtrait` (`src/data/source/livre-extrait.ts:15`), importée par `scripts/raw/_lib.mjs:31` et par `livres-extraits.ts`. Réserve non tranchée : `DescRefField.tsx:157` `useMemo(() => books.filter((b) => estExtrait(b.id)), [])`, sans dépendance. |
| K — forme de `6c764b041` | K3 SOLDÉ ; K1, K2 NEUTRE | `marker-split.mjs:24-31` lit le PDF par `pdfRequisDe(idLivre)` : plus de surcharge `--pdf`. K1 (citation mutilée) et K2 (captures absentes) sont de l'historique publié. |
| L — `pdfHorsCouture` lexicale | TENU, routé | `scripts/guards/lib/pdfHorsCouture.mjs:16` `export const EXT = String.fromCharCode(112, 100, 102)`. Commentaires sur #1739 le 2026-09-23 (12:30 et 13:11). |

## L5 — Substance et prémisses

- **#1362/#1849 L1a (`56dd6574d`, `fd23f328e`)** : la prémisse tient.
  - `npx vitest run src/state/meneur-unique.test.ts src/state/hero-debout-guard.test.ts src/state/combatants.test.ts src/gameIso/stage/cap-groupe-monte.test.tsx` → exit 0, 4 fichiers, 69/69.
  - `partyLeaderOf` est privé (`src/state/combatants.ts:95`) ; `git grep "partyLeaderOf\|setFacing\b" -- src` hors tests ne trouve que `combatants.ts:95,106,121`.
  - La citation de `slowestMovement` (`src/engine/movement.ts:13`, « LDB 51 l.193 ») tient : le fichier LDB `51 - Magie du Chaos.md` l.194 porte « si le Déplacement le plus lent d'un groupe est de 3, il voyagerait approximativement à 3 kilomètres par heure ».
  - Deux résidus :
    - `combatants.ts:111-116` (introduit par `56dd6574d`) prédit l'état futur : « Quand le meneur deviendra ÉLU, c'est ce type qui s'élargira : … devront lui donner le champ neuf » (grief Q).
    - Le test `meneur-unique.test.ts` « CHANGEMENT DE MENEUR » émet sur stderr `[bodyPlan] « B » : aucune espèce résolue … — donnée à corriger.` C'est un banc au héros incomplet, la classe même que `fd23f328e` corrige ailleurs (grief R).
- **#1739/#1393, légendes et renvois (`8e6f8aed4`, `b1b3a61b7`, `bb9571720`, `f3bb4cbd7`, `cd1484294`, `0a009ac66`, `69d497a12`)** : la prémisse tient sur le `.md`.
  - `npx vitest run src/data/source/decoupe.test.ts src/data/source/renvoi.test.ts` → exit 0, 94/94.
  - `node --test scripts/raw/check-renvois.test.mjs` → exit 0, 8/8.
  - `node scripts/raw/check-renvois.mjs` → exit 0, « renvois non résolus : 21 — ambigu 21, introuvable 0 (CRB) », conforme au « 23 → 21 » de `b1b3a61b7`.
  - Le CRB porte `**SPECIES TABLE**` (006:9) et `**HIT LOCATIONS**` (036:23) ; `grep -cE "^#+ .*TABLE"` → 0 fichier.
  - Le PDF n'a pas été rouvert.
- **#1769 (`7b13241b8`)** : `node --test scripts/docs/lib/*.test.mjs` → exit 0, 38/38. Le message annonçait 36 ; l'écart n'est pas instruit (`chemin-mesure.test.mjs` porte aussi des tests de #1973, `f4b01419d`). La première cause (24 chemins hors racine) reste nommée sur #1769 OPEN.
- **#1973 (`f4b01419d`, `54a60d4f8`)** :
  - Mécanique : `node --test` sur `commande-piege`, `data-edit`, `enterine`, `exception-add`, `memoire-tombale`, `poison-postcheck`, `solde-ticket-guard` et `settings-guard-canaux` → exit 0, 322/322.
  - Orphelin de `git-destructive-guard` : il reste 3 fichiers. Deux soldes historiques (1751, 1894) et un plan daté, `docs/superpowers/plans/2026-07-23-compatibilite-claude-codex.md:505`.
  - Prémisse RÉFUTÉE à la mesure (grief M). L'arbitrage cité (2026-09-26) dit « personne ne touche a l'arbre principal ». Or :
    - `git -C …/Foundry/Game status --short` → 35 entrées : 9 fichiers modifiés (`.claude/memory/*.md` ×7, `.claude/settings.json`, `.codex/hooks.json`), 24 fiches mémoire non suivies, et 2 dossiers non suivis (`rogue trader/`, `tmp/`). Les fiches mémoire y arrivent par la mémoire automatique des sessions, qui écrit dans `.claude/memory` de l'arbre principal ;
    - le corps de #1973 mesure lui-même « 3 dans l'arbre principal » parmi les suppressions, et « 10 `checkout --`, 4 `restore` » ;
    - le solde écrit : « Mesuré dans l'arbre principal avancé à `0be32dfdb` : un `git restore` y passe sans confirmation ».
- **#1882, #1903, #1898** : non rejoués au-delà de l'état des tickets. #1929 est absorbé mais OPEN (grief S). #1891 est peut-être soldé par `8e6f8aed4` (la rangée du fragment, `DescRefField.tsx:464`, est une `.de-reflrow`), mais le ticket n'est ni cité ni re-mesuré (INCERTAIN).

## Ce qui empêche CONFIRMÉ

**M — La prémisse de l'arbitrage de #1973 est fausse à la mesure du jour.** L'arbre principal porte 35 entrées non commitées : mémoire, `settings.json` et `.codex/hooks.json` d'autres sessions. Les `ask` retirés par `f4b01419d` (`checkout --`, `restore`, `reset --hard`, `clean`, suppressions à joker) étaient la seule confirmation devant leur perte.
→ Correction exacte : poser sur #1973 la mesure (`git -C <principal> status --short` → 35, avec le détail) et la citation de l'arbitrage, puis soumettre à l'utilisateur. C'est un arbitrage d'ingénierie, donc révisable ; le juge ne le renverse pas. **MOYEN.**

**H — Récidive : consignes d'agents et hooks réécrits sans `JUGE:` ni `REFUTATION:` (`f4b01419d`, `54a60d4f8`).** Les « quatre juges » n'existent qu'au solde. La porte reste aveugle à `scripts/` et `.claude/agents/` (`solde-ticket-guard.mjs:1774`).
→ Correction exacte : `touchesSrc` dérive de `estCheminDeSubstance`, déjà importé en `:74`. Le périmètre des consignes d'agents (`.claude/agents`, `.codex/agents`, `.claude/skills`) est à joindre au même critère : commentaire sur #1890. **MOYEN.**

**I — Récidive : dette par occurrences et journal empilé en commentaire (`ddc7da429`, `structuresStock.mjs`, lignes `arene-projet.json` et `loup-et-saumure-projet.json`).** Le `+26` est invisible au lecteur (1076→1076).
→ Correction exacte : retirer les journaux « a→b : +N OCCURRENCES » (git porte l'historique), et compter les occurrences à la porte (#1889 / #1463). Commentaire sur #1889. **MOYEN.**

**N — Solde #1973 inexact.** Deux restes disaient « corrigé dans ce commit », alors que le commit du solde ne corrige rien.
→ Corrigé avant le commit : « corrigé par f4b01419d scripts/hooks/solde-ticket-guard.mjs:2132 » et « :2130 ». **MINEUR, SOLDÉ.**

**G — Dépendances : récidive.** #1880, #1891 et #1973 ont 0 ligne de dépendance.
→ Correction exacte : ajouter à #1973 « Défait #1894 (règle de suppression) », et poser le sens sur #1880 et #1891. **MINEUR.**

**Q — Commentaire prédictif** (`src/state/combatants.ts:111-116`, « Quand le meneur deviendra ÉLU… »).
→ Correction exacte : ramener le commentaire à ce que le type EST, et porter l'élargissement futur au ticket #1362. **MINEUR.**

**R — Banc au héros incomplet** (`meneur-unique.test.ts`, stderr `[bodyPlan] « B » : aucune espèce résolue`).
→ Correction exacte : donner au banc l'espèce de ses voisins, comme `fd23f328e`. **MINEUR.**

**S — #1929 absorbé et publié (`6650cd6a5`), mais OPEN sans solde.**
→ Correction exacte : un commit `corrige #1929` avec son solde, ou un commentaire qui dit ce qui reste. **MINEUR.**

## Non couvert
- Suite complète, typecheck complet et `npm run gates` non rejoués (machine partagée). Seuls ces périmètres l'ont été : 69 + 94 + 8 + 38 + 322 tests.
- Mutations annoncées (L1a, #1973, #1739) non rejouées.
- Aucune capture ouverte : les 10 `JUGE-VISION:` ne sont pas vérifiées visuellement, et le « BON » n'est pas prononcé.
- PDF du CRB non rouvert (légendes, 5 renvois `table`). RAW : seule la citation LDB 51 l.193 est relue.
- Chantiers #1882 T2d, #1903 (socles rig) et #1898 : non sondés au-delà de l'état des tickets.
- #1891 : INCERTAIN. Une recette à 360 px de la rangée du fragment (`DescRefField.tsx:464`) trancherait.
- Grief 3 : le compte « 24 littéraux / 21 lus » n'est pas re-mesuré ; seule l'absence de changement du lecteur est prouvée.
