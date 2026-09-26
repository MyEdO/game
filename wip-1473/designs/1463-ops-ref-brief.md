# #1463 · concept RÉFÉRENCE — brief du lot « ops à référence typées », v1 (2026-09-24)

Rattachement : #1473 « [#1463 solde] Refs validées AU PARSE contre le registre d'ids généré (livré par #1466
ref(type) + #1468 OP_DEFS) — ce ticket solde les 12 gardes FK nominatives concept par concept (L2/L3) et
gameOpRefFk.mjs ». Voisin : #1468 « [#1463 L1c] OPS par construction : OP_DEFS (102 ops → payloads composés, refs
EMBOÎTÉES) dérive gameOpSchema, applyOps, GameOpEditor et docs/vocabulaire-mecanique — fin du looseObject qui
accepte n'importe quelle op ». Train voisin en cours : #1897 « Sorts du livre fan : 47 doublons d'entrées
officielles deviennent UNE entité à plusieurs emplacements (lot 1 de #838) », qui réécrit
`scripts/gen-registry.mjs` et `src/data/schemas/grammaire/ref.ts` (aucun codeur de ce lot n'y touche).

Worktree : `/home/claude/game/.wt-1473-r1`, branche `chantier/1473-r1`, tête `9cf3308af` (CI verte). Grounding :
rendu de lecteur du 2026-09-24 (classement A/B/C des 49 cibles `{registry}` de `GAMEOP_FIELD_TARGETS`), recoupé par
l'orchestrateur : `removeCondition` EST dans `OPS_NON_TYPEES` (`mecanique.ts:156`, le lecteur l'avait dit absent) ;
sonde d'occurrences de l'orchestrateur sur `src/data` + `src/scenes` (ops visées, clés observées, `'$arg'`
uniquement sur `exposeDisease` ×2 dans `traits.json`, `'petrifie'` absent de tout `removeCondition`).

Consigne de l'utilisateur, 2026-09-23 : « Fais les choses bien, le but n'est pas que vider la dette a 0, mais
aussi régler les mauvaises décisions découvert en chemin fait par un model des anciennes générations pour une
structure plus adapté ».

## Invariant

1. Verbatim (brief R1 v1.1 de #1473, https://github.com/cgauche/game/issues/1473#issuecomment-5801354411) :
   « **Toute vérification d'un id contre le registre, sous `src/data/schemas`, passe par `idDe`.** »
   Question à laquelle il répondait : où une référence à une entité se déclare-t-elle ? Sur une feuille `idDe`.
   Portée ici : les champs d'op dont le type existe dans `TYPES` (`src/data/schemas/grammaire/ref.ts:46-78`)
   sont aujourd'hui vérifiés HORS schéma, par le scan de `scripts/guards/lib/gameOpRefFk.mjs`.
2. Verbatim (`.claude/credo.md`) : « Une garde de synchronisation est un smell : une seule source de vérité. »
   Question : qui déclare la cible d'un champ-référence d'op ? Aujourd'hui DEUX sources pour 9 champs déjà typés
   par `idDe` dans `OP_DEFS` (`removeTrait.traitId`, `domeWard.traitId`, `aggravateSymptom.disease|symptomId`,
   `attenuateSymptom.disease|symptomId`, `grantSymptom.disease|symptomId`, `offTerrainMod.terrain`) : leur
   feuille `idDe` ET leur entrée `{ registry }` de `GAMEOP_FIELD_TARGETS` (`gameOpRefFk.mjs:76-165`).
3. Verbatim (`src/data/schemas/grammaire/mecanique.ts:144`, JSDoc d'`OPS_NON_TYPEES`) : « Une entrée ne se retire
   que par le commit qui TYPE l'op dans `OP_DEFS`. »
   Question : quand une op quitte-t-elle le repli loose ? Quand son payload strict entre dans `OP_DEFS`.
4. Verbatim (`scripts/guards/lib/gameOpRefFk.mjs:10-11`) : « La table est donc tenue par le type, jamais par la
   mémoire de l'auteur. »
   Question : qui fixe le PÉRIMÈTRE de la garde ? Le TypeChecker, sur l'union `GameOp` (`gameOpStringFields`).
   Portée ici : le périmètre doit AUSSI se déduire d'`OP_DEFS`, sans liste tenue à la main.
5. Verbatim (`.claude/skills/orchestrer-des-agents/SKILL.md`, § Brief) : « Un lot qui touche un CHAMP embarque
   TOUTES les conventions de ce champ. »
   Question : jusqu'où va un lot qui touche un champ ? Jusqu'à toutes ses conventions : la graphie d'une
   référence de Compétence est `{ id, spec? }` (`refOuSpec('skill')`, R1) ; celle d'un Talent dans la donnée est
   `{ id, spec? }` (`avancement('talent')`, `src/data/schemas/defs/careerLevels.ts:31`, `species.ts:38` ;
   `talentRefSchema`, `grammaire/reference.ts:39`), alors que `grantTalent`/`grantCareerTalent` écrivent
   `{ talentId, spec? }` (`src/engine/ops.ts:610`, `:619`).

## Cas canonique déjà couvert

- **Op typée à feuille `idDe`** : `removeTrait` (`mecanique.ts:89`, `traitId: idDe('trait')`), `domeWard`
  (`:93`), `offTerrainMod` (`:100-106`).
- **Op à payload récursif** : `aggravateSymptom.otherwise: z.array(z.lazy(() => gameOpSchema))` (`mecanique.ts:46`).
- **Gabarit d'instance accepté AU PARSE** : `advantageCost: z.union([z.number(), z.literal(INDICE_TEMPLATE)])`
  (`mecanique.ts:594`, `INDICE_TEMPLATE` exporté par `src/engine/flowCore.ts:510`).
- **Migration de graphie d'une référence d'op** : R1/R1-bis, `grantCareerSkill: { skill: refOuSpec('skill') }`
  (`mecanique.ts:134`) ; pools de spécialisation de Talent déjà validés par `specRef('talent')`
  (`src/data/schemas/grammaire/pool-specs.test.ts:105-112`).
- **Descente d'un schéma** : `descendre` (`src/data/schemas/grammaire/descente.ts:106`) et `estFeuilleDId`
  (`ref.ts:149`), primitives uniques de lecture de la forme d'un schéma et de reconnaissance d'une feuille d'id.
- **Périmètre dérivé** : `auditFieldCoverage` (`gameOpRefFk.mjs:240`), consommé par
  `src/data/refs-migrated.test.ts:1236-1240` (`unclassified`, `stale`).

Le nouveau cas en serait une INSTANCE : chaque op typée est une entrée `OP_DEFS` de plus, composée des feuilles et
des schémas déjà existants ; la garde gagne une catégorie de confrontation (`doublon`) à côté d'`unclassified` et
`stale`, calculée par les deux primitives de descente. À juger : instance, ou variante à branche ?

## Design proposé (à attaquer)

- **D1. `OP_DEFS` seule source de la cible d'un champ typé.** Le consommateur TS (`refs-migrated.test.ts`) calcule
  l'ensemble `typesAuParse` des `op.champ` dont le sous-arbre dans `OP_DEFS[op]` porte une feuille `idDe`
  (`descendre` + `estFeuilleDId`) et le passe à `auditFieldCoverage(root, { typesAuParse })`. Un champ dérivé de
  `GameOp` qui y figure sort du périmètre du scan (le parse le refuse déjà) ; une entrée de
  `GAMEOP_FIELD_TARGETS` sur un tel champ sort en `doublon` et fait échouer le test. Effet immédiat : les 9
  entrées du point 2 de l'Invariant meurent.
- **D1-bis. Preuve de couverture.** Retirer un champ du scan n'est sûr que si CHAQUE nœud d'op que le scan visite
  dans la donnée committée est parsé par `gameOpSchema`. Proposition : le codeur le PROUVE par le parse de mesure
  (`reperesDuParse`, `ref.ts:248`) — pour chaque occurrence committée d'un champ de `typesAuParse`, un repère au
  même path de donnée — et la sonde est promue en test committé.
- **D2. Ops typées dans ce train** (tous leurs champs-références ont un type dans `TYPES`, graphie inchangée
  sauf mention) : `removeCondition` (`id` → `idDe('etat')`), `exposeDisease` (`disease` →
  `idDe('maladie')` OU gabarit `'$arg'`, exporté par le moteur comme `INDICE_TEMPLATE` et lu par
  `withArg`, `src/state/triggeredEffects.ts:52-66`, au lieu du littéral nu), `contractDisease`,
  `reduceDiseaseDays` (`dice` en `diceSpecSchema`), `diseaseTestMod` (`diseases` → `refs('maladie')`),
  `suppressSymptom`, `giveTrapping`, `polymorph`, `scheduleRespawn` (`ref` → `idDe('creature')` OU le mot
  réservé `'self'`, `ops.ts:897`), `transform` (`ops` récursif), `rollTable` (deux membres stricts : `tableId`
  → `idDe('table')`, ou `rows[].ops` récursif ; le registre `effectTables` de la garde vise `tables.json`, le
  dataset de `TYPES.table`), `summon` (`addTraits` → `traitInstanceSchema`, `grammaire/reference.ts:17`),
  `testMod` (`exceptSkills` → liste de `refOuSpec('skill')`, graphie canonique de la référence de Compétence,
  migration de l'unique occurrence).
  Mise aux normes embarquée : ce qui ne sert plus meurt dans le même commit (résolveur `effectTables`, clé `self`
  du format fermé et `TOLERATED.selfRef`, `TOLERATED.templates` si plus aucun champ du scan ne porte de gabarit),
  et la référence périmée `src/engine/ops.ts:741` de `gameOpRefFk.mjs:52` (le mot réservé est à `:897`).
- **D3. Graphie du Talent, second train** : `grantTalent`/`grantCareerTalent` passent de `{ talentId, spec? }` à
  `{ talent: refOuSpec('talent') }` (migration de 78 occurrences par script daté sous `scripts/migrations/`,
  lecteurs moteur, éditeur, docs générés). Meurent : `grantTalent.talentId`, `grantCareerTalent.talentId`
  (registry) et leurs deux `coveredBy` Phase 3.
- **D4. Reste nommé** (aucun type dans `TYPES`, attend R2 v2 de #1473 et les trains de #1897 qui réécrivent
  `ref.ts`) : champs visant `groups`, `psychology`, `traumas`, `qualities`, `weaponGroups`, `mutationTables`,
  `lightTones`, `crewTestTypes` ; les ops `condition`, `wounds`, `grantTrait`, `grantWeapon`,
  `grantNaturalWeapon`, `augmentWeapon`, `grantPsychTrait`, `beginPsych`, `endPsych`, `removePsychTrait`,
  `rollMutation`, `light` restent dans `OPS_NON_TYPEES` (lot L1c #1468). Les `id: z.string()` de
  `traitInstanceSchema`, `refSchema` et `talentRefSchema` (`grammaire/reference.ts:17-39`) relèvent des concepts
  Trait et Talent.
- **D5. Critère « N+1 = une ligne »** : typer une op de plus = son entrée `OP_DEFS` et le retrait de son nom
  d'`OPS_NON_TYPEES` ; ses champs à feuille `idDe` quittent `GAMEOP_FIELD_TARGETS` parce que le test `doublon` l'exige,
  sans autre édition.
- Mouvements de stock attendus (train 1) : `GAMEOP_FIELD_TARGETS` 65 → 43 ; `OPS_NON_TYPEES` 86 → 73.

## Questions posées au jugement

1. D1 : où doit vivre le calcul de `typesAuParse` : dans le test consommateur, à côté d'`OP_DEFS`
   (`mecanique.ts`), ou ailleurs ? Le `.mjs` ne peut pas importer `OP_DEFS` (TS).
2. D1-bis : la preuve par repères est-elle suffisante et bien posée ? Existe-t-il déjà une garde qui établit que
   tout nœud `{ op }` de la donnée committée passe par `gameOpSchema` ? Quels documents embarquent des ops hors de
   `gameOpSchema` (sonde à faire) ?
3. D2 : le gabarit `'$arg'` et le mot réservé `'self'` doivent-ils être acceptés par le schéma de l'op (union au
   site, patron `advantageCost`), ou la valeur substituée se valide-t-elle ailleurs ? Qui garantit que l'`arg`
   d'un Trait « Maladie (X) » est un id de `maladies.json` ?
4. D2 : `testMod.exceptSkills` en `refOuSpec('skill')` : la convention du champ l'exige-t-elle, ou une liste d'ids
   nus (`refs('skill')`) est-elle la bonne forme pour « toute Compétence de cet id, quelle que soit sa
   spécialisation » ?
5. D2 : `summon.addTraits` composé de `traitInstanceSchema` (dont l'`id` n'est pas vérifié au parse) : gain de
   stricte, ou fausse couverture qui masquerait l'angle mort « champs objet » déclaré en tête de `gameOpRefFk.mjs`
   (`:23-33`) ?
6. D3 : migration de graphie du Talent : juste au regard de l'Invariant 5, ou hors du concept Référence ? Faut-il
   la séparer en train à part, et qu'implique le régime `spec`/`choix` que #1897 reprend (seul
   `OP_DEFS.grantCareerSkill` ouvre `choix` à la fusion) ?
7. Porte joueur : laquelle nomme ce lot ? Proposition : dans le Compendium, un Sort dont une op
   `contractDisease` vise une maladie inexistante est refusé à l'enregistrement, avec le message nommé
   d'`idDe`.

## Périmètre (fichiers que le codeur peut toucher)

- Train 1 : `src/data/schemas/grammaire/mecanique.ts` ; `src/engine/ops.ts` (type `GameOp` de `testMod` et des
  gabarits) ; `src/engine/flowCore.ts` (export du gabarit `'$arg'`) ; `src/state/triggeredEffects.ts` ;
  `scripts/guards/lib/gameOpRefFk.mjs` ; `src/data/refs-migrated.test.ts` ; `src/data/grammaire-guard.test.ts` ;
  `src/data/schemas/grammaire/op-defs.test.ts` ; la donnée migrée (1 occurrence de `testMod.exceptSkills`) par
  script daté sous `scripts/migrations/` ; le lecteur moteur d'`exceptSkills` ; `src/ui/editor/GameOpEditor.tsx`
  si une graphie change ; docs générés (`npm run docs:build`).
- Train 2 (D3) : périmètre établi par son propre grounding.
- Hors périmètre : `scripts/gen-registry.mjs`, `src/data/schemas/grammaire/ref.ts` (train 2e-f1 de #1897).
