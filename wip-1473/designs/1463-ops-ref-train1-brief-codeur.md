# #1473 · brief CODEUR — lot « ops à référence typées », train 1 (2026-09-24)

Worktree ABSOLU : `/home/claude/game/.wt-1473-r1`, branche `chantier/1473-r1`, tête `9cf3308af`. Tu travailles
UNIQUEMENT dans ce chemin.

Interdits, sans exception : tout `git checkout`, `restore`, `reset`, `stash`, `add`, `commit`, `clean` (l'orchestrateur
committe) ; toute suppression récursive ou à joker ; toute écriture hors du worktree, sauf tes sondes sous
`/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/train1/` ; `scripts/gen-registry.mjs` et
`src/data/schemas/grammaire/ref.ts` (réécrits par le train 2e-f1 de #1897 « Sorts du livre fan : 47 doublons
d'entrées officielles deviennent UNE entité à plusieurs emplacements (lot 1 de #838) »). Tu ne lances PAS la suite
complète : tests du périmètre seulement (`npx vitest run <fichiers>`), `npm run docs:build`, et `npm run typecheck:fast`
si tu peux ; l'orchestrateur joue le typecheck complet.

**Budget : 2 heures d'horloge, UN livrable** : le diff dans le worktree + ton rendu. À l'échéance, rends ce qui est
fait et NOMME le reste. Rendu final = données brutes (sorties de commandes collées, pas de résumé d'exit code).

Rattachement : #1473 « [#1463 solde] Refs validées AU PARSE contre le registre d'ids généré (livré par #1466 ref(type)
+ #1468 OP_DEFS) — ce ticket solde les 12 gardes FK nominatives concept par concept (L2/L3) et gameOpRefFk.mjs ».
Design complet et questions d'origine : `/mnt/project-files/dettes/1463-ops-ref-brief.md` (v1). Verdict du juge :
`/mnt/project-files/dettes/1463-ops-ref-juge-design-v1.json`. Lis les deux avant de coder.

## Invariant

1. Verbatim (brief R1 v1.1 de #1473, https://github.com/cgauche/game/issues/1473#issuecomment-5801354411) :
   « **Toute vérification d'un id contre le registre, sous `src/data/schemas`, passe par `idDe`.** »
   Question à laquelle il répondait : où une référence à une entité se déclare-t-elle ? Sur une feuille `idDe`.
2. Verbatim (`.claude/credo.md`) : « Une garde de synchronisation est un smell : une seule source de vérité. »
   Question : qui déclare la cible d'un champ-référence d'op ? Aujourd'hui, pour 9 champs, à la fois leur feuille
   `idDe` d'`OP_DEFS` et leur entrée `{ registry }` de `GAMEOP_FIELD_TARGETS` (`scripts/guards/lib/gameOpRefFk.mjs`).
3. Verbatim (`src/data/schemas/grammaire/mecanique.ts:144`) : « Une entrée ne se retire que par le commit qui TYPE
   l'op dans `OP_DEFS`. » Question : quand une op quitte-t-elle `OPS_NON_TYPEES` ? Quand son payload strict entre
   dans `OP_DEFS`.
4. Verbatim (`scripts/guards/lib/gameOpRefFk.mjs:10-11`) : « La table est donc tenue par le type, jamais par la
   mémoire de l'auteur. » Question : qui fixe le périmètre de la garde ? Le type, jamais une liste à la main.
5. Verbatim (`.claude/skills/orchestrer-des-agents/SKILL.md`, § Brief) : « Un lot qui touche un CHAMP embarque
   TOUTES les conventions de ce champ. » Question : jusqu'où va le lot sur un champ touché ? Jusqu'à ses
   jumeaux, ses stocks, ses lecteurs et ses commentaires.

## Cas canonique déjà couvert

- Op typée à feuille `idDe` : `removeTrait` (`mecanique.ts:89`), `domeWard` (`:93`), `offTerrainMod` (`:100-106`).
- Op à payload récursif : `aggravateSymptom.otherwise: z.array(z.lazy(() => gameOpSchema))` (`mecanique.ts:46`).
- Valeur réservée acceptée AU PARSE : `advantageCost: z.union([z.number(), z.literal(INDICE_TEMPLATE)])`
  (`mecanique.ts:594`, `INDICE_TEMPLATE`/`IndiceTemplate` exportés par `src/engine/flowCore.ts:510-511`).
- Référence de Compétence d'op : `refOuSpec('skill')` (`grantCareerSkill`, `mecanique.ts:134`).
- Message nommé sur une union : `skillDRBonus` et son `error:` (`mecanique.ts:112-126`).
- SLOT (case validée par `idDe` au parse de mesure) : `slotsDuParse` (`scripts/docs/lib/slots-registre.mts:77`),
  consommé par `src/data/slots-contrat.test.ts:52` ; descente d'un schéma : `descendre`
  (`src/data/schemas/grammaire/descente.ts:106`) et `estFeuilleDId` (`ref.ts:149`).
- Périmètre dérivé de la garde : `auditFieldCoverage` (`gameOpRefFk.mjs:240`, `unclassified`/`stale`), consommé par
  `src/data/refs-migrated.test.ts:1236-1240`.

Chaque op de ce train est une INSTANCE : une entrée `OP_DEFS` composée de feuilles et de schémas existants, sans
branche par type d'op. La garde ne gagne AUCUNE catégorie : un champ typé sort du périmètre dérivé et son entrée
restante ressort en `stale`.

## Design jugé :

**FRAGILE**, workflow `juge-design-socle`, run `wf_5213107c-401`, 2026-09-24 : 11 bloquants survivants, aucun
structurel, 2 écartés. Chacun est intégré ci-dessous (B1 à B11 renvoient à l'ordre du verdict).

### A. La garde cesse de doublonner le parse

- **A1 (B1, B6)** : l'ensemble des « champs d'op à slot » (vocabulaire des slots, pas un synonyme neuf) est calculé
  STATIQUEMENT depuis `OP_DEFS` : pour chaque op, tout membre de son schéma (unions comprises), le champ dont le
  sous-arbre porte une feuille `idDe` (`descendre` + `estFeuilleDId`). Hôte : `scripts/docs/lib/slots-registre.mts`,
  qui porte déjà le concept de slot. `mecanique.ts` ne dépend d'aucun outil de garde.
- **A2** : `auditFieldCoverage(root, { champsASlot })` retire ces champs du périmètre dérivé. Une entrée de
  `GAMEOP_FIELD_TARGETS` sur l'un d'eux sort en `stale`, avec un message qui dit pourquoi (typé au parse par
  `OP_DEFS`). Meurent immédiatement : `removeTrait.traitId`, `domeWard.traitId`, `aggravateSymptom.disease`,
  `aggravateSymptom.symptomId`, `attenuateSymptom.disease`, `attenuateSymptom.symptomId`, `grantSymptom.disease`,
  `grantSymptom.symptomId`, `offTerrainMod.terrain`.
- **A3 (B1, B3, B4) — invariant de couverture, promu en test dans `refs-migrated.test.ts`** : toute occurrence
  visitée par `scanGameOpRefs` d'un champ de `champsASlot` est, soit une case de `slotsDuParse` (même `porteur`,
  même `cle`), soit une valeur réservée déclarée AU MÊME nœud de schéma (branches `z.literal` lues par `descendre`,
  aucune liste recopiée). Sonde du juge : aujourd'hui 2218 nœuds `{op}` visités, 2054 atteints par `gameOpSchema`.
- **A4 (B3)** : conséquence d'A3, un conteneur d'ops se type AVANT ou AVEC son contenu. Mesuré : `perRound`
  (`src/engine/ops.ts:855`, `spells.json` : `perRound.ops[giveTrapping]`) et `rollThreshold` (`:859`, `traits.json`
  régénération : `thresholds[].ops`) entrent dans ce train. Si A3 en nomme d'autres, ils y entrent aussi.
- **A5 — mise aux normes de `gameOpRefFk.mjs`** : ce qui ne sert plus meurt dans le même diff, chaque mort
  prouvée par une sonde collée : `TOLERATED.templates` (`'$arg'` n'apparaît que sur `exposeDisease.disease`,
  `'$indice'` sur aucun champ à `registry`), `TOLERATED.selfRef` et la clé `self` du format fermé (seul
  `scheduleRespawn.ref` la porte), le résolveur `effectTables` (seul `rollTable.tableId` le vise ; mêmes 21 ids que
  `tables.json`). `TOLERATED.softIds.etats` (`'petrifie'`) cesse d'être une seconde liste : le consommateur TS
  l'injecte depuis `NARRATIVE_MARKERS` (`src/engine/conditions.ts:57-62`, « REGISTRE UNIQUE ») et
  `src/data/data-wellformed.test.ts:66-68` lit `NARRATIVE_MARKERS`. Le test du vocabulaire toléré
  (`refs-migrated.test.ts:1296-1307`) se réécrit ou meurt avec lui.
- **A6 (B11) — poison du périmètre, corrigé dans le geste** : l'en-tête « POURQUOI PAS LES SCHÉMAS ZOD »
  (`gameOpRefFk.mjs:13-16`) se réécrit d'après A1-A3 ; toutes les références de ligne périmées de l'en-tête et de
  la table (`:2` `ops.ts:1573`, `:52` `ops.ts:741`, `:151` `ops.ts:956`, et chaque autre que tu vérifies) ;
  la pierre tombale de `mecanique.ts:99` ; l'excuse de `mecanique.ts:65` (« dataset non encore déclaré à
  `TYPES` ») devient un fait adossé à son lot ; le commentaire de `src/engine/conditions.ts:611` devient la réf
  nue de la règle de l'État Brisé au `Source/` (garde `src/comment-poison-guard.test.ts`).

### B. Les ops typées dans ce train

Toutes gardent leur graphie de clé (voir C3). Pour chacune, lis son membre de `GameOp` dans `src/engine/ops.ts` et
chaque occurrence committée ; le payload strict couvre TOUTES les clés observées.

- `exposeDisease` : `disease` en `idDe('maladie')` OU le gabarit `'$arg'`.
- `contractDisease` : `disease` en `idDe('maladie')`.
- `reduceDiseaseDays` : `disease` en `idDe('maladie')`, `dice` en `diceSpecSchema`.
- `diseaseTestMod` : `diseases` en `refs('maladie')`.
- `suppressSymptom` : `symptomId` en `idDe('symptome')`.
- `giveTrapping` : `trappingId` en `idDe('trapping')`. **Écarté 1 du juge, retenu** : son jumeau d'Effet de scène
  `giveTrappingSchema.trappingId` (`src/data/schemas/defs-scenes/effets.ts:133-135`, 18 références
  d'`arene-projet.json` à 0 slot) passe à `idDe('trapping')` dans le même diff.
- `polymorph`, `summon`, `transform.morphRef` : `idDe('creature')` ; `transform.ops` récursif.
- `scheduleRespawn` : `ref` en `idDe('creature')` OU le mot réservé `'self'` (`src/engine/ops.ts:897`).
- `rollTable` : deux membres stricts, `tableId` en `idDe('table')`, ou `rows[].ops` récursif.
- `summon.addTraits` : `traitInstanceSchema` (`grammaire/reference.ts:17`). **Pas une couverture de référence** :
  son `id` reste `z.string()`. À déclarer comme angle mort, jamais compté comme gagné.
- `testMod` : `exceptSkills` en liste de `refOuSpec('skill')` (graphie d'op de la référence de Compétence depuis
  R1 ; `{ id }` sans spec = toute spécialisation). Migration de l'unique occurrence (`etats.json:148`) par script
  daté sous `scripts/migrations/`, selon la convention du dépôt ; son lecteur `src/engine/conditions.ts:611` compare
  l'id.
- `perRound`, `rollThreshold` (A4).

**Gabarit et mot réservé (B4, B10)** : `'$arg'` s'exporte du moteur sur le patron `INDICE_TEMPLATE`/`IndiceTemplate`
(nom au choix du codeur, justifié), et `withArg` (`src/state/triggeredEffects.ts:52-66`) lit les DEUX constantes au
lieu des littéraux nus. L'union au site dégrade le message nommé d'`idDe` en « Entrée invalide » (sonde du juge) :
le message nommé doit survivre (test qui le prouve).

**Hors de ce train, pour une raison mesurée** : `removeCondition` (B7) reste dans `OPS_NON_TYPEES` avec `condition`
(lot L1c #1468) : un id d'État d'op a aujourd'hui pour domaine `etats.json` ∪ `NARRATIVE_MARKERS`, et typer le
retrait sans la pose créerait deux domaines pour un même concept.

### C. Questions posées au codeur (réponse en SORTIE, citation exigée)

1. Où vit le compositeur « feuille OU valeur réservée » (`'$arg'`, `'self'`, et `advantageCost` qui l'adopterait
   dans le même diff) : `grammaire/valeurs.ts`, `mecanique.ts` ? Un seul compositeur pour les trois, ou deux
   concepts distincts (gabarit d'instance vs mot réservé) ? Dis ce que tu as choisi et pourquoi.
2. Le jumeau d'Effet `giveTrappingSchema` et `OP_DEFS.giveTrapping` ont-ils le même jeu de clés hors
   discriminant ? Si oui, compose une seule forme ; sinon nomme la différence.
3. A3 nomme-t-il d'autres conteneurs que `perRound` et `rollThreshold` ? Lesquels, typés ou non ?
4. La migration d'`exceptSkills` crée-t-elle une signature neuve dans `scripts/guards/lib/structuresStock.mjs`
   (ligne `:1413`, `testMod amount,exceptSkills,op`) ?
5. La ligne `effets.ts:giveTrappingSchema|alias|trappingId` de `grammaireStock.mjs` meurt-elle quand sa valeur
   devient `idDe` ?

**C3 — graphie des clés (B8), règle d'ingénierie révisable du 2026-09-24** : dans une op, la VALEUR d'une référence
vient d'une fabrique de `ref.ts` (`idDe`, `refs`, `refOuSpec`). La CLÉ reste celle de la donnée tant que la ligne de
stock qui la classe n'est pas soldée par son lot : `ref`/`morphRef`, `tableId`, `disease` sont les lignes
`divergente` de `structuresStock.mjs` (`:173`, `:330`, `:417`, lot L3 #1463), `trappingId`/`ref` les alias L3 de
`grammaireStock.mjs:78-86`. Motif : renommer ces clés migre `spells.json`, que #1897 réécrit en ce moment.

### D. Stocks et cliquets (B2, B5) — chaque mouvement mesuré et collé

- `GAMEOP_FIELD_TARGETS` : 65 → 44 attendu (−9 par A2, −12 champs de B). Plus si A5 fait mourir autre chose.
- `OPS_NON_TYPEES` : 86 → 72 attendu (−12 ops de B, −2 conteneurs), plus si A3 nomme d'autres conteneurs.
- `scripts/guards/lib/slotsStock.mjs` : `SLOTS_SANS_DECLARATION` perd au moins `etats.json | exceptSkills` (`:154`)
  et `trappings.json | diseases` (`:331`) ; le plafond `DETTE_ADOPTION_MAX` de `src/data/slots-contrat.test.ts:60`
  (283) descend d'autant. Toute autre ligne que l'adoption fait périmer part aussi.
- `src/data/grammaire-guard.test.ts:280-294` (graphies de la grammaire, liste nommée à cardinal tenu) : une ligne
  par clé alias neuve d'`OP_DEFS` (`ref` ×3, `trappingId`, et ce que la mesure donne).
- `src/data/refs-migrated.test.ts:1279-1292` (contre-épreuve sur `grantTalent.talentId`) : inchangée dans ce train.
- Docs générés : `npm run docs:build`, puis `node scripts/docs/build-all.mjs --empreinte` doit passer.
- Chaque stock qui décroît donne une ligne `CLIQUET:` de ton rendu (ancien → nouveau, commande de mesure).

### E. Reste NOMMÉ (ne pas coder)

- Train 2 (graphie du Talent, #1646 « Specs de talent HORS talents[] : 18 porteurs {talentId, spec} … marche à
  étendre aux porteurs GameOp + axes.json ») : `grantTalent`/`grantCareerTalent` → `{ talent: refOuSpec('talent') }`,
  AVEC `src/data/schemas/defs/axes.ts:26-30` (B9).
- Types absents de `TYPES` (R2 v2 de #1473, après les trains de #1897) : champs visant `groups`, `psychology`,
  `traumas`, `qualities`, `weaponGroups`, `mutationTables`, `lightTones`, `crewTestTypes`.
- Ops restant dans `OPS_NON_TYPEES` (L1c #1468) : `condition`, `removeCondition`, `wounds`, `grantTrait`,
  `grantWeapon`, `grantNaturalWeapon`, `augmentWeapon`, `grantPsychTrait`, `beginPsych`, `endPsych`,
  `removePsychTrait`, `rollMutation`, `light`, et le reste de la liste.
- Concept Trait : `traitInstanceSchema.id` et `.arg` non vérifiés (`grammaire/reference.ts:17-25`). L'arg d'un Trait
  à `specsSource` est la référence réelle derrière `'$arg'` (écarté 2 du juge) ; l'instance fautive
  `creatures.json:51985` (Maladie « au choix ») relève de #1893.
- Dialecte `JsonOp` de `miscast.json` : #1902.

## Périmètre (fichiers que tu peux toucher)

- Schémas : `src/data/schemas/grammaire/mecanique.ts`, `src/data/schemas/grammaire/valeurs.ts` (si le compositeur
  de C1 y vit), `src/data/schemas/defs-scenes/effets.ts` (jumeau `giveTrappingSchema`).
- Moteur et store : `src/engine/ops.ts` (membres de `GameOp`), `src/engine/flowCore.ts` (export du gabarit),
  `src/engine/conditions.ts` (lecteur d'`exceptSkills`, commentaire `:611`), `src/state/triggeredEffects.ts`.
- Gardes et stocks : `scripts/guards/lib/gameOpRefFk.mjs`, `scripts/guards/lib/slotsStock.mjs`,
  `scripts/guards/lib/structuresStock.mjs` et `scripts/guards/lib/grammaireStock.mjs` si la mesure l'exige,
  `scripts/docs/lib/slots-registre.mts`.
- Tests : `src/data/refs-migrated.test.ts`, `src/data/slots-contrat.test.ts`, `src/data/grammaire-guard.test.ts`,
  `src/data/schemas/grammaire/op-defs.test.ts`, `src/data/data-wellformed.test.ts`, et le test voisin d'un fichier
  ci-dessus que ton diff fait bouger.
- Donnée : `src/data/etats.json` par un script neuf `scripts/migrations/2026-09-24-<nom>.mjs`.
- Docs générés par `npm run docs:build`.
- `src/ui/**` : aucune modification attendue. Si une graphie lue par l'éditeur change, arrête-toi et dis-le.

## Rendu exigé

1. Le diff, fichier par fichier (`git diff --stat` collé).
2. Pour CHAQUE garde neuve ou modifiée (A2, A3, stale, gabarit, message nommé, exclusivité des membres de
   `rollTable`) : une **preuve par mutation** (tu casses, tu colles la sortie rouge, tu restaures, tu colles la sortie
   verte).
3. Les sorties BRUTES : tests du périmètre (`npx vitest run` sur `src/data/refs-migrated.test.ts`,
   `src/data/slots-contrat.test.ts`, `src/data/grammaire-guard.test.ts`, `src/data/schemas/grammaire/op-defs.test.ts`,
   `src/data/data-wellformed.test.ts`, et chaque test voisin que ton diff touche), `npm run docs:build`,
   `node scripts/docs/build-all.mjs --empreinte`.
4. Les réponses aux questions C1-C5, citées.
5. Les lignes `CLIQUET:` de D.
6. Le poison rencontré HORS périmètre, avec `fichier:ligne`.
7. Ce qui n'est pas fait, NOMMÉ.
