# Rendu — coupe au mot, une fonction, sa garde (#1806, R-M2), 2026-09-28

Worktree /home/user/game/.wt-1806-L1 (HEAD 395e1d4c4, train précédent non commité conservé).

## Fichiers
Neufs : src/lib/coupeAuMot.ts, src/lib/coupeAuMot.test.ts, scripts/guards/lib/coupeAuCaractere.mjs (+ .d.mts), src/coupe-au-caractere-guard.test.ts
Modifiés (mon lot) : src/ui/compendium/CodexRef.tsx (truncate supprimé → import coupeAuMot, export BORNE_DU_CORPS = 400), CodexRef.test.tsx (tests unitaires déplacés ; reste le test sur données réelles), CombatConsole.test.tsx:175 (verbatimAttendu recopiait l'ANCIENNE coupe au caractère → coupeAuMot(mdToText(desc), BORNE_DU_CORPS)), editor/EffectList.tsx (cut supprimé → coupeAuMot(e.desc, 46) ×2), editor/GameOpEditor.tsx:736 (narrative → coupeAuMot(o.text, 40)), editor/DialogueDetail.tsx:72,132 (coupeAuMot 24 / 38), creator/CharacterCreator.tsx:209 (blurb → coupeAuMot(mdToText(md), max), défaut 160 mort retiré), 4 tests de diagnostic (night-stake-form ×4, night-stakes-rules, trous-de-validation, bundled-projects), primitives.manifest.json (+ entrée coupeAuMot, codex-ref cite coupeAuMot) ; docs générés par docs:build.
Seuils : n = ancien seuil « rendu entier si ≤ n » de chaque site.

## Diff stat
 docs/.sources-lues.json                            |  12 ++
 docs/ajouter-une-icone.md                          |   2 +-
 docs/codex-relations.md                            |   2 +-
 docs/consommateurs-de-champs.md                    |   2 +-
 docs/donnees.md                                    |   4 +-
 docs/orphelines-donnees.md                         |   2 +-
 docs/primitives.md                                 |  11 +-
 docs/raw/reconciliation.md                         |   2 +-
 docs/registre-jets.md                              |   2 +-
 docs/reprise-apres-pause.md                        |   4 +-
 docs/sorts-implementation.md                       |   2 +-
 docs/structures-donnees.md                         |  20 +--
 docs/systemes.md                                   |   3 +-
 docs/usages-jets.md                                |   2 +-
 docs/vocabulaire-mecanique.md                      |   2 +-
 src/data/night-stake-form.test.ts                  |   9 +-
 src/data/night-stakes-rules.test.ts                |   3 +-
 src/data/primitives.manifest.json                  |  17 ++-
 src/data/schemas/_ids.generated.ts                 |   2 +-
 .../defs-scenes/trous-de-validation.test.ts        |   3 +-
 src/scenes/bundled-projects.test.ts                |   3 +-
 src/ui/BoiteAncree.test.tsx                        |  25 +++-
 src/ui/BoiteAncree.tsx                             |  12 +-
 src/ui/CombatConsole.test.tsx                      |   5 +-
 src/ui/Infobulle.test.tsx                          |  38 ++++-
 src/ui/Infobulle.tsx                               | 159 ++++++++++++---------
 src/ui/compendium/CodexRef.test.tsx                |  20 ++-
 src/ui/compendium/CodexRef.tsx                     |   8 +-
 src/ui/creator/CharacterCreator.tsx                |   7 +-
 src/ui/editor/AddMenu.test.tsx                     |  14 +-
 src/ui/editor/DialogueDetail.tsx                   |   5 +-
 src/ui/editor/EffectList.tsx                       |   7 +-
 src/ui/editor/GameOpEditor.tsx                     |   3 +-
 33 files changed, 268 insertions(+), 144 deletions(-)

## Contre-grep avant (garde AST lancée sur git show HEAD:<fichier>) — 14 sites
Production : CharacterCreator.tsx:211, EffectList.tsx:140, GameOpEditor.tsx:735, DialogueDetail.tsx:71, DialogueDetail.tsx:131, CodexRef.tsx:16 (ancien truncate à HEAD)
Tests : CombatConsole.test.tsx:177, night-stake-form.test.ts:50/95/125/157, night-stakes-rules.test.ts:101, trous-de-validation.test.ts:118, bundled-projects.test.ts:446
(DialogueDetail ×2 et CombatConsole.test ne figuraient pas au brief.)
## Contre-grep après
Garde sur src/ (tests compris) : [] . grep texte résiduel : rotation-repose.test.tsx:405 = slice de TABLEAU puis .join (pas une coupe de texte, non vu par la garde, témoin couvert).
Hors périmètre (scripts/, .mjs, ne peut importer coupeAuMot .ts) : 8 sites — scripts/docs/lib/empreinte-sources.mjs:300, scripts/guards/lib/gitPorte.mjs:88, scripts/guards/lib/sujetDeCommit.mjs:40, scripts/hooks/solde-ticket-guard.mjs:915, scripts/ops/etapesDuTrain.mjs:187, scripts/source/derive-decoupes.mjs:128, scripts/source/prose-source-plugin.mjs:80, scripts/ui/audit-i18n.mjs:204.

## Mutations
Garde : EffectList.tsx `coupeAuMot(e.desc, 46)` → `` `${e.desc.slice(0, 45)}…` `` : avant 30713a8a47a7b3c920b3a9c5f55947303999a1b9, muté 3322f49b7f537501c02c9936f5a3c9cd0fd97d50 → rc=1, « expected [ 'src/ui/editor/EffectList.tsx:161' ] to deeply equal [] » ; remis à la main → 30713a8a…, cmp identique, rc=0 (2/2).
coupeAuMot : boucle de recul → `while (false)` : avant 6135ade6835447f991fc8e080cdbd931078a2c6e, muté 4605b02667bf3085b827dc272a8a433d7c95d436 → rc=1, 4 failed | 10 passed ; remis → 6135ade6…, cmp identique, rc=0 (14/14).

## Portes
typecheck:fast rc=0, 0 erreur.
vitest --no-cache (coupeAuMot, garde, CodexRef, CombatConsole, night-stake-form, night-stakes-rules, trous-de-validation, bundled-projects, comment-poison-guard, ui-ratchets, primitive-owners-guard) rc=0, 11 fichiers, 379 tests.
eslint sur les 16 fichiers : rc=0.
docs:build rc=0 ; docs:check rc=0.
Écart constaté hors lot : EffectList.test.tsx, GameOpEditor.seeds.test.tsx, GameOpEditor.test.tsx : 13 échecs (menu d'ajout vide : « bouton … absent de la palette », rangee undefined) — IDENTIQUES avec mes 3 éditions éditeur remises à l'état HEAD (rc=1, 13 failed | 32 passed) : dus au train précédent non commité (BoiteAncree/Infobulle/placerAncre) ou préexistants.

## Processus
Aucun en arrière-plan. Tous les runners au premier plan sous timeout, terminés.
Arbre principal : git status --short vide, aucune fuite.
