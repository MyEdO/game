# Décisions de revue des stocks de dette retirés de la porte (#3021, 2026-10-26)

Ticket: #1463

Date : 2026-10-26. Base mesurée : `37a2b98b52`. Archive datée, pas une référence vivante : elle ne se met pas à jour avec le code.

## Objet

Le lot P1 de #3021 (design v4 de #2995) retire de la porte des comptes les collections dont la donnée faisait bouger le compte. Ce document conserve ce que leurs stocks commis portaient et que la mesure ne déduit pas : les lots posés à la main contre la déduction (`lotDeForme`, `LOT_CLE_RESERVEE`, `scripts/docs/lib/structures-lexique.mts`) et les commentaires de revue attachés aux lignes. L'inventaire qui les remplace (`scripts/guards/lib/inventaireDeDette.mts`) se rend au résumé du job `comptes:plage` et dans `docs/structures-donnees.md` §7.

## Comptes à la base

Chaque collection retirée, mesurée à `37a2b98b52` sur son stock commis. `STRUCTURES_OPS` et `STRUCTURES_ENVELOPPE` deviennent les volets `DETTE_OPS` (un site par op de `OPS_NON_TYPEES` et par couple op, clé de `refsAPlat(OP_DEFS)`) et `DETTE_ENVELOPPE` (un site par type de `CONTENU_A_SOURCER`), mesurés au schéma seul. `SLOTS_INATTEIGNABLES` est supprimée : ses lignes étaient des occurrences sans case (`{random:N}`, `{choice:[{…}]}`) que le scan inscrivait. Les autres entrent à l'inventaire, hors de la porte.

| Collection | Sites | Occurrences |
|---|---|---|
| `STRUCTURES_FORMES` | 407 | 7662 |
| `STRUCTURES_OPS` | 259 | 1105 |
| `STRUCTURES_HOMONYMES` | 4 | 1296 |
| `STRUCTURES_ENVELOPPE` | 14 | 61 |
| `STRUCTURES_ORPHELINES` | 98 | 413 |
| `STRUCTURES_DEFAUT` | 25 | — |
| `SLOTS_SANS_DECLARATION` | 253 | 10823 |
| `SLOTS_INATTEIGNABLES` | 3 | 35 |

## Lots décidés contre la déduction

55 lignes. Le lot est celui que la ligne du stock portait ; la déduction du lexique à la même base est donnée entre parenthèses.

| Site | Lot | Motif | Collection |
|---|---|---|---|
| `reference \| arene-projet.json \| appearance \| species,tenue` | L3 #1463 (déduit : L2 #1463) | apparence : ESPÈCE et TENUE | `STRUCTURES_FORMES` |
| `reference \| arene-projet.json \| appearance \| species,tenue+…` | L3 #1463 (déduit : L2 #1463) | apparence : ESPÈCE et TENUE | `STRUCTURES_FORMES` |
| `reference \| arene-projet.json \| effect \| entityId,type` | L3 #1463 (déduit : L2 #1463) | référence d’ENTITÉ de scène | `STRUCTURES_FORMES` |
| `reference \| arene-projet.json \| merchant \| archetype` | L3 #1463 (déduit : L2 #1463) | référence d’ARCHÉTYPE de marchand | `STRUCTURES_FORMES` |
| `reference \| arene-projet.json \| optionals \| arg,id` | L3 #1463 (déduit : L2 #1463) | paramètre d’ENTITÉ (trait, talent) | `STRUCTURES_FORMES` |
| `reference \| arene-projet.json \| ref \| id-nu` | L3 #1463 (déduit : L2 #1463) | référence de PION de scène | `STRUCTURES_FORMES` |
| `reference \| barge-du-sel-projet.json \| ref \| id-nu` | L3 #1463 (déduit : L2 #1463) | référence de PION de scène | `STRUCTURES_FORMES` |
| `reference \| careerLevels.json \| career \| id-nu` | L3 #1463 (déduit : L2 #1463) | référence de CARRIÈRE | `STRUCTURES_FORMES` |
| `reference \| careerLevels.json \| trappings \| creatureId` | L3 #1463 (déduit : L2 #1463) | dotation : référence de CRÉATURE | `STRUCTURES_FORMES` |
| `reference \| careerLevels.json \| trappings \| creatureId+…` | L3 #1463 (déduit : L2 #1463) | dotation : référence de CRÉATURE | `STRUCTURES_FORMES` |
| `reference \| careerLevels.json \| trappings \| vehicleId+…` | L3 #1463 (déduit : L2 #1463) | dotation : référence de VÉHICULE | `STRUCTURES_FORMES` |
| `reference \| careers.json \| tenue \| id-nu` | L3 #1463 (déduit : L2 #1463) | référence de TENUE | `STRUCTURES_FORMES` |
| `reference \| creatures.json \| appearance \| species` | L3 #1463 (déduit : L2 #1463) | apparence : ESPÈCE | `STRUCTURES_FORMES` |
| `reference \| creatures.json \| appearance \| species,tenue` | L3 #1463 (déduit : L2 #1463) | apparence : ESPÈCE et TENUE | `STRUCTURES_FORMES` |
| `reference \| creatures.json \| appearance \| species+…` | L3 #1463 (déduit : L2 #1463) | apparence : ESPÈCE | `STRUCTURES_FORMES` |
| `reference \| creatures.json \| monster \| tete` | L3 #1463 (déduit : L2 #1463) | apparence de MONSTRE par localisation | `STRUCTURES_FORMES` |
| `reference \| creatures.json \| optionals \| arg,id` | L3 #1463 (déduit : L2 #1463) | paramètre d’ENTITÉ (trait, talent) | `STRUCTURES_FORMES` |
| `reference \| creatures.json \| optionals \| arg,id,value` | L3 #1463 (déduit : L2 #1463) | paramètre d’ENTITÉ (trait, talent) | `STRUCTURES_FORMES` |
| `reference \| creatures.json \| traits \| arg,id` | L3 #1463 (déduit : L2 #1463) | référence de TRAIT paramétré | `STRUCTURES_FORMES` |
| `reference \| crew-test-types.json \| essential \| id-nu` | L3 #1463 (déduit : L2 #1463) | référence de RÔLE d’équipage | `STRUCTURES_FORMES` |
| `reference \| diligence-projet.json \| base \| id-nu` | L3 #1463 (déduit : L2 #1463) | base de PRESET de PNJ (#671) | `STRUCTURES_FORMES` |
| `reference \| domains.json \| of \| value+…` | L3 #1463 (déduit : L2 #1463) | référence de GROUPE sous tirage borné `of` | `STRUCTURES_FORMES` |
| `reference \| lieux-services.json \| merchantArchetype \| id-nu` | L3 #1463 (déduit : L2 #1463) | référence d’ARCHÉTYPE de marchand | `STRUCTURES_FORMES` |
| `reference \| loup-et-saumure-projet.json \| appearance \| species,tenue+…` | L3 #1463 (déduit : L2 #1463) | apparence : ESPÈCE et TENUE | `STRUCTURES_FORMES` |
| `reference \| loup-et-saumure-projet.json \| crew \| count,roleId` | L3 #1463 (déduit : L2 #1463) | référence de RÔLE d’équipage | `STRUCTURES_FORMES` |
| `reference \| loup-et-saumure-projet.json \| members \| entityId+…` | L3 #1463 (déduit : L2 #1463) | référence d’ENTITÉ de scène | `STRUCTURES_FORMES` |
| `reference \| loup-et-saumure-projet.json \| merchant \| archetype` | L3 #1463 (déduit : L2 #1463) | référence d’ARCHÉTYPE de marchand | `STRUCTURES_FORMES` |
| `reference \| loup-et-saumure-projet.json \| ref \| id-nu` | L3 #1463 (déduit : L2 #1463) | référence de PION de scène | `STRUCTURES_FORMES` |
| `reference \| loup-et-saumure-projet.json \| serviceKind \| id-nu` | L3 #1463 (déduit : L2 #1463) | référence de SERVICE de lieu | `STRUCTURES_FORMES` |
| `reference \| loup-et-saumure-projet.json \| services \| kind` | L3 #1463 (déduit : L2 #1463) | référence de SERVICE de lieu | `STRUCTURES_FORMES` |
| `reference \| loup-et-saumure-projet.json \| victoryCondition \| targetId,type+…` | L3 #1463 (déduit : L2 #1463) | référence de CIBLE de condition de victoire | `STRUCTURES_FORMES` |
| `reference \| maladies.json \| dailyTest \| symptomId+…` | L4 #1463 (déduit : L3 #1463) | JET (EDOC 08 l.104) compté en référence parce qu’il DÉSIGNE le symptôme qu’il inflige — l’enveloppe `épreuve {test, onFail}` de #1657 geste B le reprend ; le lot des références ne l’éteindrait jamais | `STRUCTURES_FORMES` |
| `reference \| mutations.json \| passive \| arg,traitId+…` | L3 #1463 (déduit : L2 #1463) | référence de TRAIT paramétré | `STRUCTURES_FORMES` |
| `reference \| pregens.json \| career \| id-nu` | L3 #1463 (déduit : L2 #1463) | référence de CARRIÈRE | `STRUCTURES_FORMES` |
| `reference \| pregens.json \| species \| id-nu` | L3 #1463 (déduit : L2 #1463) | référence d’ESPÈCE | `STRUCTURES_FORMES` |
| `reference \| raceAppearance.json \| gabarit \| id-nu` | L3 #1463 (déduit : L2 #1463) | référence de GABARIT de rig | `STRUCTURES_FORMES` |
| `reference \| sea-events.json \| params \| chefRef,crewRef,ship+…` | L3 #1463 (déduit : L2 #1463) | paramètres d’ÉVÉNEMENT (créature, véhicule) | `STRUCTURES_FORMES` |
| `reference \| speciesRace.json \| rules \| race+…` | L3 #1463 (déduit : L2 #1463) | référence de RACE | `STRUCTURES_FORMES` |
| `reference \| spells.json \| cond \| is+…` | L3 #1463 (déduit : L2 #1463) | CONDITION de sort | `STRUCTURES_FORMES` |
| `reference \| spells.json \| domainId \| id-nu` | L3 #1463 (déduit : L2 #1463) | référence de DOMAINE de magie | `STRUCTURES_FORMES` |
| `reference \| spells.json \| of \| value+…` | L3 #1463 (déduit : L2 #1463) | référence de GROUPE sous tirage borné `of` | `STRUCTURES_FORMES` |
| `reference \| spells.json \| ops \| arg,traitId+…` | L3 #1463 (déduit : L2 #1463) | référence de TRAIT paramétré | `STRUCTURES_FORMES` |
| `reference \| spells.json \| ops \| count,ref,size+…` | L3 #1463 (déduit : L2 #1463) | référence de CRÉATURE invoquée | `STRUCTURES_FORMES` |
| `reference \| spells.json \| ops \| count,ref+…` | L3 #1463 (déduit : L2 #1463) | référence de CRÉATURE invoquée | `STRUCTURES_FORMES` |
| `reference \| spells.json \| ops \| ref+…` | L3 #1463 (déduit : L2 #1463) | référence de CRÉATURE invoquée | `STRUCTURES_FORMES` |
| `reference \| trappings.json \| subType \| id-nu` | L3 #1463 (déduit : L2 #1463) | SOUS-TYPE d’objet | `STRUCTURES_FORMES` |
| `reference \| trappings.json \| weaponGroup \| id-nu` | L3 #1463 (déduit : L2 #1463) | référence de GROUPE d’armes | `STRUCTURES_FORMES` |
| `reference \| voyage-stakes.json \| kind \| id-nu` | L3 #1463 (déduit : L2 #1463) | GENRE d’enjeu de voyage | `STRUCTURES_FORMES` |
| `mutations.json \| ops` | L3 #1473 (déduit : L2/L3 #1473) | — | `SLOTS_SANS_DECLARATION` |
| `symptoms.json \| ops` | L1b #1467 (déduit : L2/L3 #1473) | — | `SLOTS_SANS_DECLARATION` |
| `symptoms.json \| passive` | L1b #1467 (déduit : L2/L3 #1473) | — | `SLOTS_SANS_DECLARATION` |
| `symptoms.json \| minutes` | L1b #1467 (déduit : L2/L3 #1473) | — | `SLOTS_SANS_DECLARATION` |
| `symptoms.json \| grave` | L1b #1467 (déduit : L2/L3 #1473) | — | `SLOTS_SANS_DECLARATION` |
| `traits.json \| passive` | L1b #1467 (déduit : L2/L3 #1473) | — | `SLOTS_SANS_DECLARATION` |
| `trappings.json \| ops` | L1b #1467 (déduit : L2/L3 #1473) | — | `SLOTS_SANS_DECLARATION` |

## Commentaires de revue

25 lignes : le commentaire que le stock portait au-dessus ou au bout de la ligne, sans lot propre.

| Site | Motif | Collection |
|---|---|---|
| `reference \| diligence-projet.json \| base \| id-nu` | (#680, 2026-09-29) : base de preset, id nu imposé par presetPnjSchema.base (#671) | `STRUCTURES_FORMES` |
| `reference \| maladies.json \| mutation \| into+…` | mue Rhume → Pneumonie, EDOC 08 l.122 (#674) | `STRUCTURES_FORMES` |
| `reference \| maladies.json \| ops \| disease,symptomId+…` | cycle quotidien de la Pneumonie, EDOC 08 l.104-108 (#674) — champ `onFail` → `ops` : la conséquence vit sous la feuille `EffectOp` du nœud `test` (#1657 B2b) | `STRUCTURES_FORMES` |
| `reference \| maladies.json \| otherwise \| disease,symptomId+…` | échelon Toxine du même cycle, EDOC 08 l.106-108 (#674) | `STRUCTURES_FORMES` |
| `reference \| miscast.json \| ops \| id,unlessCondition,value+…` | NEUF (#1653 train A) : « Purifier la chair » (LDB 40 l.75) gate sa cause récurrente sur l'État qu'elle pose (LDB 16 l.117) | `STRUCTURES_FORMES` |
| `reference \| symptoms.json \| ops \| disease+…` | la conséquence du cycle vit sous la feuille `EffectOp` du nœud `test` (#1657 B2b) | `STRUCTURES_FORMES` |
| `source \| progression-schemas.derived.json \| schemas \| book,page+…` | le folio inventait son nom : la bande dit `page` comme toute réf de source (#1463 L-gram-4) | `STRUCTURES_FORMES` |
| `condition \| carried,id,op \| spells.json` | #1695 lot 1 (LDB 48 l.495) | `STRUCTURES_OPS` |
| `condition \| durationRounds,id,op,perRound,unlessCondition,value \| miscast.json` | NEUF (#1653 train A) : la cause récurrente de « Purifier la chair », 1d10 Rounds (LDB 40 l.75, LDB 16 l.117) | `STRUCTURES_OPS` |
| `aggravateSymptom \| disease,op,otherwise,severity,symptomId \| maladies.json` | EDOC 08 l.104-108 (#674) | `STRUCTURES_OPS` |
| `grantSymptom \| disease,op,symptomId \| maladies.json` | EDOC 08 l.106-108 (#674) | `STRUCTURES_OPS` |
| `talent` | #1473 train 2a : la clé `talent` des ops de Talent (objet, `refOuSpec`) rejoint les 79 `talent: "<id>"` à chaîne nue. | `STRUCTURES_HOMONYMES` |
| `creatures.json \| grant \| char,value` | #2724 : `char` y est un littéral de `charKeySchema` (#1463, arbitrages L0 point 3) | `STRUCTURES_ORPHELINES` |
| `etats.json \| value \| char,factor,who` | #1932 : `char` y est un littéral de `charKeySchema` (#1463, arbitrages L0 point 3) | `STRUCTURES_ORPHELINES` |
| `etats.json \| value \| char,who` | #1932 : `char` y est un littéral de `charKeySchema` (#1463, arbitrages L0 point 3) | `STRUCTURES_ORPHELINES` |
| `etats.json \| recover \| enjeu,form,skill` | skill → enjeu,form,skill (#1920 B14, 2026-09-24) : l'enjeu de récupération se porte sur l'État | `STRUCTURES_ORPHELINES` |
| `barge-du-sel-projet.json \| ref` | #1473 R1 : 1 `prop` atteint (`idDe('prop')` de la branche `prop` de `sceneEntitySchema`, `defs-scenes/scene.ts:204`) + 5 `personnage` (`ref` en chaîne libre : dette réelle, #1882) | `SLOTS_SANS_DECLARATION` |
| `maladies.json \| dailyTest` | EDOC 08 l.104 (#674) — le Test quotidien DÉSIGNE son symptôme (#1657 geste A) | `SLOTS_SANS_DECLARATION` |
| `mutations.json \| ops` | #862 : 1ʳᵉ op authorée de mutations.json (re-ciblage `onDayStart` de Haine sporadique) | `SLOTS_SANS_DECLARATION` |
| `symptoms.json \| ops` | les réfs du cycle (`onTick`) comptent ici, sous la feuille `EffectOp` du nœud `test` (#1657 B2b) | `SLOTS_SANS_DECLARATION` |
| `symptoms.json \| passive` | #1599 : l'État *Exténué* du Malaise (LDB 20 l.188) s'écrit en op `condition` du canal passif | `SLOTS_SANS_DECLARATION` |
| `traits.json \| ops` | VDM 09 l.280 | `SLOTS_SANS_DECLARATION` |
| `careerLevels.json \| trappings` | `{choice:[…]}` : les feuilles comptent sous `careerLevels.json \| choice` | `SLOTS_INATTEIGNABLES` |
| `species.json \| of` | `{random:N}` | `SLOTS_INATTEIGNABLES` |
| `species.json \| talents` | `{random:N}` | `SLOTS_INATTEIGNABLES` |
