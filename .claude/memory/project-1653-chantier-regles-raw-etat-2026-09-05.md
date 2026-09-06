---
name: project-1653-chantier-regles-raw-etat-2026-09-05
description: "Chantier « règles RAW absentes/fausses » (arbitrage user 2026-09-04 22:40 : #1653 → #1661 → #1599 → #1612 → #1688, session game-bc, worktree .wt-raw) — train A de #1653 POUSSÉ (main 4ac4daab6, 2026-09-05 04:53) ; ticket OUVERT ; séquence : LDB 16 l.119 (réveil d'Inconscient) → train B (suppression de Talent) → arbitrages user → train C (skillMod à durée, gods.skills) → reste 76-80/41-45"
metadata: 
  node_type: memory
  type: project
  originSessionId: e72180bd-85a9-4fe1-915b-20e4f3d7932a
  modified: 2026-09-05T02:54:45.941Z
---

**Arbitrage user (AskUserQuestion 2026-09-04 22:40)** : option « Règles RAW absentes/fausses (Recommandé) » — ordre #1653 → #1661 → #1599 → #1612 → #1688, un train à la fois, worktree `.wt-raw` (branche `chantier/regles-raw`), gates complètes avant push. Interdits : #1463 (session game-eb), #1679 (session audit-drift), #1680/art, naval (#1634/#1595 frottent B3-2b).

**#1653 train A POUSSÉ** (b05b16170..4ac4daab6, 5 commits, 22 gates, recette navigateur, pilotage = issuecomment-5548870280 ; re-mesure initiale = issuecomment-5546499423). Livré : rangée 81-87 « Purifier la chair » (LDB 40 l.75) composée avec LDB 16 l.117 = Inconscient + CAUSE RÉCURRENTE gatée (`perRound` + `unlessCondition === id` + `durationRounds` intrinsèque sur l'effet récurrent général), rejeu MARQUÉ (`OpsCtx.rejeuRecurrent`), prédicat `estCausePersistante` unique pour 3 lecteurs Codex, `EffectSource` kinds miscast (lus dans `codexCategory`), voie « tic seul » hors combat, D1 `days` formulaire, `TYPES.etat`, Atlas ré-ancré (12 réfs), 31 notes `source` par rangée, dette au `raw.manifest.json`. Deux réfs du ticket corrigées : 106-110 = l.80, 116-120 = l.82.

**Deux formes RÉFUTÉES par les juges** (à ne pas re-proposer) : `durationRounds` sur l'instance (expire seul + collision `isMagicallyAsleep`/`wake-sleeper`) ; verrou de retrait `lockedRounds` (la Détermination brûlait un point sans effet, gel hors combat via `needsUpkeep`) — le livre distingue « ne peut être retiré » (16-20, 101-105) de « dure un minimum de » (81-87).

**Séquence restante (ticket OUVERT, fan-out ≤ 1 : zéro ticket de reste)** :
1. Train « LDB 16 l.119 » : « Lorsque vous vous débarrassez de l'État Inconscient, vous gagnez les États À Terre et Exténué. » — implémenté nulle part ; `removeCondition` (`conditions.ts:~192`) est la porte unique ; le vocabulaire n'a AUCUN trigger de PERTE d'État (`onGainCondition` existe, `flowCore.ts:~524-534`) → extension data-driven (trigger de perte sur `etats.json`), design à faire juger.
2. Train B : suppression TEMPORAIRE de Talent (106-110 l.80, 116-120 l.82) — `removeTrait` ne convient pas (natif acheté en PX doit revenir), `effectiveTalents` n'est PAS le lecteur unique (`featuresOf` dispatch.ts, `combatEffects.ts:940`, `flowCore.ts:343`, `windsOfMagic.ts:53`…), fin de durée pluggable (jours ici ; 136-140 = 2 Pénitences ; 146-150 permanent, hors ticket).
3. Arbitrages user GROUPÉS avant C : convention `maison` PAR CHAMP (n'existe qu'à l'enveloppe, `grammaire/document.ts:25,284`) ; forme du choix « une Compétence » (56-60 : choix joueur vs règle maison).
4. Train C : `skillMod` à durée canonique + `durationDays` mutualisé (3 copies `ops.ts`), `gods.skills` maison éditable (41 dieux sans champ), 26-30 l.61 / 56-60 l.70. `castPenalty` = magie seule (`magic.ts:117-118`), ne pas l'élargir.
5. Reste : 76-80 l.74 (action contrainte : alphabet `gatingSchema` fermé, `actGate` conditionne sans remplacer) ; 41-45 l.64 (`applyMiscast` `combatFlow.ts:4070` ne reçoit aucune cible ; échec automatique par cible × divinité sans porteur).

**Inventaire hors lot** (au commentaire du ticket) : libellé « Effet » en dur (`applyTriggeredTestBranch`) ; dialecte miscast avale `perRound`+`minutes` ; 5 « MIGRÉ en données » `conditions.ts:531-547` + 14 tombales « plus de `X` » listées ; angles morts des gardes `effect-rule-anchor` (`*Ctx` local) et `field-consumers` (1 site sur 5) ; recette : `fastForward` bloqué par une `pendingDefense` d'IA, pas de helper `__wfrp.miscast`, onglet « État » occulté en combat.

**Leçon de méthode** : mon juge de DESIGN a accepté le verrou parce que mon brief citait l.117 pour « pas de durée native » sans coller la phrase suivante (« vous gagnez un nouvel État Inconscient à la fin du Round ») — le juge de DIFF l'a lu en entier. Le remède fut de remonter d'un niveau (réutiliser l'effet récurrent général) plutôt que rustiner le verrou. Voir [[feedback-citation-prouve-ce-quelle-repond]].

Lié : [[env-garde-memoire-harnais-gates-serie-detachees]], [[user-arbitrage-de-de-monde-affiche-comme-un-critique]] (magnitude tirée après Test : re-statuer sous #1508).
