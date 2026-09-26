# Vocabulaire mécanique du moteur — GÉNÉRÉ

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-vocabulaire.mjs` (`npm run docs:vocabulaire`) — NE PAS ÉDITER À LA MAIN.
> Sources : l'union `GameOp` de `src/engine/ops.ts` et les unions `Condition`/`Flow`/`EffectTrigger`/
> `EffectTargeting` de `src/engine/flowCore.ts`. Vocabulaire d'EFFET et de LOGIQUE partagé par les sorts,
> traits, talents, états, maladies, qualités d'arme, consommables et flux de combat.
> Le vocabulaire de SCÈNE (`Effect`) vit dans `docs/campagne-effects.md`.

## Comment lire cette carte

**Colonne « Résolution »** — c'est le piège nº 1 de ce fichier, lisez-le avant de conclure qu'une op n'existe pas.
Elle rapporte UN FAIT d'AST, rien d'autre : ce que le switch d'`applyOps` (moteur pur) fait de l'op.

- **exécutée** — `case` PORTEUR de code : le moteur pur mute le `Combatant` et rend ses lignes de journal.
- **inerte au switch** — `case` dont le corps se réduit à `break;`.
- **hors switch** — aucun `case` : l'op tombe dans le défaut.

**« inerte au switch » et « hors switch » ne veulent PAS dire « inutilisable ».** C'est le patron NORMAL de deux
familles, que cette colonne ne distingue pas (elle ne mesure pas la sémantique) :

- les effets **IMPURS** (grille, initiative, file d'horloge — `summon`, `zone`, `push`, `teleport`, `delayed`…),
  résolus par la couche `src/state` ;
- les **PASSIFS** (`weaponRollMod`, `incomingAttackMod`, `offTerrainMod`…), jamais « lancés », LUS au point de
  calcul par un collecteur.

Le JSDoc de ces ops dit souvent « INERTE dans `applyOps` » : la phrase décrit le moteur pur, pas la capacité.
La colonne « Résolveurs » dit où ça se joue vraiment — c'est elle qui tranche entre les deux familles.

**Colonne « Résolveurs »** — modules de `src/engine`/`src/state` (hors tests, hors `ops.ts`) qui nomment l'op.
**Colonne « Donnée »** — occurrences dans `src/data` : `fichier:id-de-l-entrée`. Un **0** signale une op qu'AUCUNE donnée
n'emploie — candidate au code mort, à instruire (elle peut être employée par du code, cf. « Résolveurs »).

**Périmètre mesuré / angles morts** — la table des TROIS CANAUX est dérivée des déclarations de champs ;
« Résolveurs » et « Donnée » sont des mesures TEXTUELLES bornées :
hors périmètre, donc invisibles ici, les ops construites dynamiquement dans `src/engine`/`src/state` (`engine/miscast`,
`engine/polymorph`… fabriquent des `GameOp` en code), les JSON de campagne hors `src/data`, les tests, et `src/ui`
(affichage, jamais résolution). Un **0** en « Donnée » n'est donc pas une preuve de mort : c'est une PISTE.

## Les trois canaux de mécanique en donnée

`GameOp` est la langue de l'axe EFFET/MODIFICATEUR — une op s'APPLIQUE à une cible (`applyOps(target, ops)`).
Ce n'est pas le seul canal par lequel une entité porte sa mécanique en donnée ; la table ci-dessous est
DÉRIVÉE des DÉCLARATIONS de champs (AST) des sources de `src/data`, `src/engine`, `src/state`, jamais des commentaires :

- **`passive: GameOp[]`** — modificateurs de VALEUR, exécutés par `applyOps` (collecteur `passiveMods`) ;
- **`effects: TriggeredEffect[]`** — effets DÉCLENCHÉS sur un `EffectTrigger`, dispatchés par `fireTriggers` ;
- **`capabilities` / `combat`** — DRAPEAUX sans cible, lus par des dispatchers génériques qui ne nomment
  aucune entité. Un drapeau n'est pas une op inachevée : n'ayant AUCUNE cible, il n'est pas un effet
  appliqué mais une propriété que la règle consulte — le porter en `GameOp` fabriquerait une op que seul
  son dispatcher lirait.

Un champ ne compte pour un canal que si son TYPE le porte : `SpellData.effects: Flow` (flux authored) et
`WeaponGroupData.combat: 'melee' \| 'ranged'` (étiquette) n'y figurent pas.

| Entité | Déclarée | `passive` | `effects` | Drapeaux |
|---|---|---|---|---|
| `ActiveEffect` | `src/engine/types.ts:759` | `passive: GameOp[]` | — | — |
| `DomainData` | `src/data/index.ts:2025` | — | `effects: TriggeredEffect[]` | — |
| `ManeuverDef` | `src/data/index.ts:1653` | — | `effects: TriggeredEffect[]` | — |
| `Mutation` | `src/engine/corruption.ts:58` | `passive: GameOp[]` | `effects: TriggeredEffect[]` | — |
| `NavalTraitData` | `src/data/index.ts:2574` | `passive: GameOp[]` | — | — |
| `QualityData` | `src/data/index.ts:1940` | `passive: GameOp[]` | `effects: TriggeredEffect[]` | `capabilities: QualityCapabilities` |
| `StatusData` | `src/data/index.ts:1435` | `passive: GameOp[]` | `effects: TriggeredEffect[]` | — |
| `SymptomData` | `src/data/index.ts:1983` | `passive: GameOp[]` | `effects: TriggeredEffect[]` | `capabilities: SymptomCapabilities` |
| `TalentData` | `src/data/index.ts:1040` | `passive: GameOp[]` | `effects: TriggeredEffect[]` | `combat: CombatFeature` |
| `TraitData` | `src/data/index.ts:1823` | `passive: GameOp[]` | `effects: TriggeredEffect[]` | `capabilities: TraitCapabilities` |
| `TrappingData` | `src/data/index.ts:1156` | `passive: GameOp[]` | — | `capabilities: ItemCapabilities` |
| `Weapon` | `src/engine/types.ts:375` | `passive: GameOp[]` | — | — |
| `WeaponEnchant` | `src/engine/types.ts:538` | `passive: GameOp[]` | — | — |

_13 entités déclarant au moins un canal. Une entité qui étend une autre HÉRITE de ses canaux — la
table ne montre que les champs DÉCLARÉS (`EtatData`/`PsychologyData` tiennent les leurs de `StatusData`)._

### Le vocabulaire des drapeaux (5 types)

| Type | Site | Drapeaux déclarés |
|---|---|---|
| `CombatFeature` | `src/engine/combatFeatures/types.ts:27` | 51 — `offHandPenalty`, `attackModes`, `meleeDamageBonus`, `rangedDamageBonus`, `brawlDamageBonus`, `chargeDamageBonus`, `slayer`, `damageReduction`, `critExtraWounds`, `rangedAPIgnore`, `ignoreCalledShotHead`, `ignoreCalledShotRanged`, `ignoreSizeRangedMods`, `sniper`, `initiativeBonus`, `strikeFirstRanged`, `surpriseSave`, `reloadDR`, `runBonus`, `fleeBonus`, `pursuitTargetBonus`, `shieldAdvantage`, `advantageDefenseReaction`, `counterOnDefenseWin`, `counterRequiresFastParry`, `stealAdvantage`, `stealOne`, `transferWeight`, `reloadAssessAdvantage`, `fearSizeAsMount`, `retreatCost`, `keepAdvantageOnDisengage`, `disengageWithLessAdvantage`, `battement`, `distraire`, `outnumberCount`, `braveheart`, `fearImmune`, `bleedIgnore`, `focusNoMiscastOnDouble`, `castNoMiscastOnDouble`, `causesFear`, `reverseFailed`, `bargainBonus`, `encumbranceBonus`, `corruptionThreshold`, `surgery`, `castingKind`, `commandTeam`, `seaShanty`, `critRollTwice` |
| `ItemCapabilities` | `src/data/index.ts:1113` | 12 — `preventForcedDrop`, `weatherProtection`, `isShelter`, `isRations`, `isGrimoire`, `lockpicks`, `scurvyGuard`, `sealskin`, `shipParts`, `disarmImmune`, `ropeMode`, `waterContainer` |
| `QualityCapabilities` | `src/data/index.ts:1902` | 26 — `fastStrike`, `slowStrike`, `fumbleOn9`, `fumbleDigits`, `pushback`, `bladeTrap`, `damagesArmour`, `firearm`, `canFireWhileEngaged`, `magazine`, `salvo`, `areaFire`, `explosion`, `crewedTeam`, `parryAP`, `encDelta`, `layerable`, `critImmuneOdd`, `apIgnoredOnEven`, `apIgnoredOnImpaleCrit`, `siege`, `ram`, `unbreakable`, `magic`, `withheldOnRestraint`, `beats` |
| `SymptomCapabilities` | `src/data/index.ts:1969` | 6 — `blocksHealing`, `amputation`, `contagious`, `nausea`, `endTest`, `persistentActive` |
| `TraitCapabilities` | `src/data/index.ts:1704` | 43 — `bonusWoundsBE`, `mutationAtSpawn`, `markMutations`, `swarm`, `naturalWeapon`, `spellcaster`, `undead`, `wardSave`, `damageImmunity`, `spellDomainImmunity`, `counterOnDefenseWin`, `counterRequiresFastParry`, `unstable`, `painless`, `freeTrample`, `psychImmuneIfAhead`, `psychType`, `psychImmune`, `psychIndice`, `psychCible`, `grantGroups`, `frenzyCapable`, `mindless`, `woundsUseForce`, `bestial`, `coldBlooded`, `stupid`, `rage`, `territorial`, `skittishMount`, `structResistant`, `structImpenetrable`, `fly`, `leap`, `stride`, `autoClimb`, `climbFullSpeed`, `noRun`, `seesInDark`, `darkSightTiles`, `wakelessBite`, `encumbranceFactor`, `consumptionFactor` |

## GameOp — index par concept (français)

Les noms d'ops sont en anglais, le projet et ses sources sont en français : cette table est l'entrée par le SENS.
Elle est DÉRIVÉE (motifs du lexique appliqués au nom + au JSDoc de chaque op) — une op qui ne tombe dans aucun
concept fait ÉCHOUER la génération, donc la CI. Une op apparaît sous plusieurs concepts.

| Concept | Ops |
|---|---|
| Armes : enchanter, altérer, invoquer, désarmer | `augmentWeapon`, `grantWeapon`, `grantNaturalWeapon`, `grantFreeAttack`, `breakBlade`, `maxWeaponHands`, `disarm`, `handGate`, `removeShipPoste`, `weaponRollMod`, `weaponDamageMod`, `armourPierce`, `critOnRoll` |
| Armure, Points d'Armure, protection | `ap`, `damageArmour`, `arrowWard`, `domeWard`, `attackWardFM`, `weatherWard`, `armourPierce` |
| Attaquer : touche, attaque gratuite, mot-clé d'attaque | `augmentWeapon`, `critTwice`, `attackWardFM`, `grantNaturalWeapon`, `grantFreeAttack`, `chain`, `incomingAttackMod`, `incomingAdvantage`, `attackKeyword`, `mitigateIncoming`, `weaponRollMod`, `weaponDamageMod` |
| Avantage | `endPsych`, `beginPsych`, `gainAdvantage`, `incomingAdvantage`, `spendAdvantage` |
| Blessures, dégâts, Coups Critiques | `wounds`, `heal`, `healCaster`, `preventInfection`, `kill`, `cureCriticalWound`, `reduceToZero`, `critTwice`, `suffocate`, `martyr`, `grantWeapon`, `chain`, `rollThreshold`, `endTransform`, `lifeSteal`, `sbBonus`, `mitigateIncoming`, `attrMod`, `handGate`, `weaponDamageMod`, `critOnRoll` |
| Caractéristiques et attributs (max de Blessures, Chance…) | `charMod`, `charDamage`, `charDRBonus`, `sbBonus`, `attrMod` |
| Compétences, Talents, Carrières : octroyer, modifier | `castPenalty`, `grantTalent`, `grantCareerSkill`, `grantCareerTalent`, `grantFreeAttack`, `skillMod`, `skillDRBonus`, `incomingSpellDRMod` |
| Composition : séquence d'ops, palier, tableau, récurrence | `kill`, `fall`, `perRound`, `rollThreshold`, `rollTable`, `rollMutation`, `transform` |
| Corruption, Chaos, mutation, Péché | `corruption`, `sinMod`, `corruptionExposure`, `rollMutation`, `zone`, `attackKeyword`, `moveMod`, `disarm` |
| Durée, horloge, effet différé, expiration | `charMod`, `gainResource`, `castPenalty`, `statusMod`, `grantReverseToken`, `grantTrait`, `grantTalent`, `augmentWeapon`, `reduceDiseaseDays`, `contractDisease`, `suppressPsych`, `grantNaturalWeapon`, `perRound`, `scheduleRespawn`, `polymorph`, `transform`, `suppressSymptom`, `delayed` |
| Empoignade, entrave, immobilisation | `condition` |
| États (LDB 16) : poser, retirer, ignorer une pénalité d'État | `condition`, `removeCondition`, `endPsych`, `beginPsych`, `ignoreStatePenalties`, `grantFreeAttack` |
| Faim, provisions, alcool, ivresse | `augmentWeapon`, `noHunger`, `ignoreAnimosity`, `rollThreshold`, `intoxicate` |
| Invocation, créatures, bestiaire, reconstitution | `grantTrait`, `removeTrait`, `grantWeapon`, `summon`, `scheduleRespawn`, `polymorph`, `transform`, `offTerrainMod` |
| Lumière, vision, brouillard de guerre | `light` |
| Magie, incantation, prière, miracle, contrecoup | `ap`, `gainResource`, `castPenalty`, `grantTrait`, `augmentWeapon`, `freeReroll`, `critTwice`, `suppressPsych`, `castWard`, `attackWardFM`, `noHunger`, `weatherWard`, `grantWeapon`, `interruptFocus`, `perRound`, `charDamage`, `zone`, `transform`, `incomingSpellDRMod`, `attackKeyword`, `mitigateIncoming` |
| Maladies : exposer, contracter, guérir, symptômes | `cureDisease`, `reduceDiseaseDays`, `preventInfection`, `exposeDisease`, `contractDisease`, `diseaseTestMod`, `suppressSymptom`, `aggravateSymptom`, `attenuateSymptom`, `grantSymptom` |
| Monnaie, bourse, argent | `money` |
| Mort, retrait du jeu, bannissement | `kill`, `banish`, `suffocate` |
| Mouvement, allonge, terrain | `moveScale`, `moveMod`, `offTerrainMod`, `attrMod`, `loseTurn`, `actGate` |
| Narratif, arbitrage non modélisé | `banish`, `narrative` |
| Navire, coque, équipage, poste d'artillerie | `fall`, `charDRBonus`, `crewTestMod`, `removeShipPoste`, `teamCommander` |
| Objets, possessions, inventaire | `giveTrapping`, `disarm` |
| Position, zone, poussée, téléportation, rebond | `arrowWard`, `push`, `teleport`, `chain`, `zone`, `delayed` |
| Psychologie : Peur, Terreur, Frénésie, Animosité, Obsession | `endPsych`, `beginPsych`, `grantTrait`, `grantPsychTrait`, `removePsychTrait`, `grantCareerTalent`, `suppressPsych`, `ignoreAnimosity`, `grantFreeAttack`, `sbBonus` |
| Ressources : Chance, Destin, Résilience, Détermination | `gainResource`, `kill`, `freeReroll`, `zone`, `attrMod` |
| Sens et organes : vue, ouïe, cécité, surdité | `amputer`, `senseLoss` |
| Soin, guérison, régénération, aide médicale | `heal`, `healCaster`, `cureCriticalWound`, `rollThreshold` |
| Statut social, Réputation, Standing | `statusMod` |
| Suffocation, respiration, exposition météo | `suffocate`, `noBreath`, `weatherWard` |
| Tests : modificateur, DR, relance, inversion, gate | `castPenalty`, `grantReverseToken`, `augmentWeapon`, `cureDisease`, `cureCriticalWound`, `freeReroll`, `castWard`, `testMod`, `interruptFocus`, `breakBlade`, `teleport`, `zone`, `skillDRBonus`, `charDRBonus`, `crewTestMod`, `incomingAttackMod`, `incomingSpellDRMod`, `offTerrainMod`, `loseTurn`, `actGate`, `diseaseTestMod`, `weaponRollMod`, `weaponDamageMod` |
| Tour de jeu : perdre son Action / son Mouvement | `loseTurn`, `actGate` |
| Traits de créature : octroyer, retirer | `grantTrait`, `removeTrait`, `grantPsychTrait`, `removePsychTrait`, `suppressPsych`, `polymorph`, `endTransform`, `incomingSpellDRMod`, `moveMod` |
| Transformation, métamorphose, forme alternative | `polymorph`, `transform`, `endTransform` |

## GameOp — les 110 opérations

| Op | Champs | Résolution | Résolveurs | Donnée | Rôle |
|---|---|---|---|---|---|
| `actGate` | `char` | exécutée | — | 2 — `spells.json:desorientation`, `trappings.json:racine-de-mandragore` | GATE d'action par Round (Racine de mandragore, LDB 71 l.35 : « Les utilisateurs doivent réussir un Test de Force Mentale à chaque Round pour effectuer une Action ou un Mouvement (un au choix) ») — `ActiveEffect.actGate` vérifié au DÉBUT du tour du porteur en combat (cadence-aware : héros manuel = étape de cascade influençable + choix Action/Mouvement ; IA/auto = jet inline, l'Action est gardée). |
| `aggravateSymptom` | `disease`, `symptomId`, `severity`, `otherwise?` | exécutée | `engine/disease.ts` | 1 — `maladies.json:pneumonie` | AGGRAVE un symptôme déjà porté par la maladie `disease` (EDOC 08 l.104 : « le symptôme Fièvre devient Grave »). |
| `amputer` | `sequels`, `loc?`, `unites?`, `unitesPerSL?` | exécutée | `engine/critical.ts` | **0** | AMPUTATION (LDB 18 l.233-286) : pose la plaie chirurgicale (`needsSurgery`) et les séquelles PERMANENTES `sequels` (ids de fiche `traumas.json`), puis consolide les cumuls (`consolidateAmputations` — doigts/orteils/dents/organes pairés). |
| `ap` | `loc?`, `amount`, `noDeviation?`, `atHitLocation?` | exécutée | `engine/corruption.ts`, `engine/navalTraits.ts`, `state/aiSpellValue.ts` | 22 — `mutations.json:peau-d-acier`, `mutations.json:ecailles-epineuses` … | PA à une Localisation (`loc`) ou à TOUTES (`loc` absent — Armure Aethyrique « +1 PA à toutes les Localisations »). |
| `armourPierce` | `amount`, `bypass?` | **inerte au switch** | `engine/qualities/dispatch.ts`, `state/targetingModes.ts` | 1 — `qualities.json:perforante` | PASSIF d'ARME : Perforante (LDB 62 l.270) — `bypass` (ex. `'nonMetal'`) puis `amount` PA retirés du reliquat à la mitigation. |
| `arrowWard` | — | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 1 — `spells.json:bouclier-anti-fleches` | Bouclier anti-flèches (LDB 47 — L11) : « les projectiles constitués de matière organique sont automatiquement détruits s'ils entrent dans la Zone d'Effet ». |
| `attackKeyword` | `keyword` | **hors switch** | — | 3 — `traits.json:demoniaque`, `traits.json:fabrique` … | L'attaque du porteur porte un MOT-CLÉ (Magique/Démoniaque/Fabriqué → 'magic', LDB 85). |
| `attackWardFM` | — | exécutée | `state/aiSpellValue.ts`, `state/combatFlow.ts`, `state/targetingModes.ts` | 1 — `spells.json:benediction-de-protection` | Bénédiction de Protection (LDB 41 — L13) : « Les ennemis doivent effectuer un Test de FM Accessible (+20) pour attaquer votre cible ». |
| `attenuateSymptom` | `disease`, `symptomId`, `otherwise?` | exécutée | — | **0** | ATTÉNUE d'un échelon un symptôme déjà porté (LDB 20 l.159 : « transformant Grave en Modéré et Modéré en convulsions normales ») — MIROIR d'`aggravateSymptom`. |
| `attrMod` | `attr`, `mod` | exécutée | `engine/talentEffects.ts` | 4 — `talents.json:chanceux`, `talents.json:dur-a-cuire` … | Modificateur d'un ATTRIBUT SECONDAIRE À MAXIMUM (≠ CharKey, ≠ Mouvement) : Blessures (Dur à cuire +BE), Chance (Chanceux), Détermination (Obstiné). |
| `augmentWeapon` | `addQualities?`, `damageBonus?`, `bypass?`, `requiresWeapon?`, `removeQualities?`, `removeType?`, `suppressEnchants?`, `passive?`, `onHitEffects?` | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 11 — `spells.json:benediction-de-droiture`, `spells.json:serres-d-ambre` … | ALTÉRATION d'ARME temporisée — enchantement OU dégradation, une seule primitive (Jalon 2.6 — Bénédiction de Droiture : Magique ; Marteau ardent : Magique +BSoc + En flammes/À Terre à la touche ; Épée ardente : +6 + Percutante + En flammes ; VDM 05 — Arme enchantée « ajouter 1 Atout ou retirer 1 Défaut », Défaut « Tous les Atouts de l'arme disparaissent […] −1 DR à tous les Tests pour attaquer avec elle », enchantements de l'arme neutralisés). |
| `banish` | `narration?`, `onlyGroups?` | exécutée | `state/aiSpellValue.ts` | 5 — `spells.json:fauche-demon`, `spells.json:le-labyrinthe-de-cristal` … | RETRAIT DU JEU : la cible est destituée, sa forme se dissipe — la force qui la soutenait cède. |
| `beginPsych` | `type`, `cible?`, `sourceId?`, `indice?`, `calmeDR?`, `active?`, `lastTestRound?`, `fromTest?` | exécutée | `engine/psychology.ts` | **0** | POSE (ou met à jour) un état PSYCHOLOGIQUE porté — JUMELLE d'`endPsych`, même collection `psychState` (DISTINCTE de `conditions` : pas de perte d'Avantage à la pose, LDB 21 ≠ LDB 16). |
| `breakBlade` | — | **inerte au switch** | `engine/flowCore.ts`, `state/combat/triggeredTest.ts`, `state/combatFlow.ts` +1 | **0** | Marqueur IMPUR de la branche de VICTOIRE d'un Test opposé de Piège-lame (LDB 62 l.280) : l'adversaire est désarmé (sa lame arrachée) et, sur un Succès Stupéfiant (marge nette ≥ 6 DR), sa lame est BRISÉE à moins qu'elle ne possède l'Atout Incassable. |
| `castPenalty` | `skill?`, `mod?`, `blocked?`, `maxZeroDR?`, `rounds?`, `minutes?`, `hours?`, `days?` | exécutée | `engine/magic.ts`, `engine/miscast.ts`, `state/aiSpellValue.ts` +1 | 17 — `miscast.json:mineure-langue-maladroite`, `miscast.json:majeure-propos-esoteriques` … | Pénalité/blocage d'incantation temporisé (contrecoups, LDB 46/40) : −N à une Compétence de magie, Tests interdits, ou DR de Prière plafonné à 0. |
| `castWard` | `radius`, `perSL?` | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 1 — `spells.json:n-ecoutez-point-la-sorciere` | N'écoutez point la Sorcière (LDB 42) : « Tous les Sorts qui ciblent quelque chose ou quelqu'un dans les (BSoc) mètres subissent -20 aux Tests de Langue (Magick) » — aura portée par la cible (le prêtre), rayon élargi « +BSoc m par +2 DR » via `perSL.radiusFormula`. |
| `chain` | `maxBounces`, `hopMeters` | **inerte au switch** | `state/combatFlow.ts`, `state/targetingModes.ts` | 1 — `spells.json:attaques-en-chaine` | ATTAQUES EN CHAÎNE (LDB 47 l.340) : si le Projectile réduit la cible à 0 Blessure, il rebondit sur l'ennemi le plus proche (≤ `hopMeters` m, dans la portée initiale), mêmes Dégâts, jusqu'à `maxBounces` rebonds. |
| `charDamage` | `char`, `amount` | exécutée | — | 6 — `spells.json:poids-des-annees`, `spells.json:poids-des-annees` … | Perte PERMANENTE de Caractéristique (Vers de carie « −1d10 Initiative… », MSRC 16 l.94-97) : décrémente la Caractéristique de BASE (`c.characteristics`), jamais sous 0 — irréversible « sauf par des moyens magiques ou miraculeux » (l.103). |
| `charDRBonus` | `char`, `bonus` | exécutée | — | 17 — `sea-shanties.json:camarades-d-equipage-rassemblez-vous`, `tables.json:vdm-marques-arcaniques-lumiere` … | +N DR aux Tests d'une CARACTÉRISTIQUE (chanson « Camarades d'équipage » : +1 DR sur tout Test de Sociabilité, MDG 09 l.236) — variante par carac de `skillDRBonus`. |
| `charMod` | `char`, `mod`, `durationRounds?`, `durationMinutes?`, `durationHours?` | exécutée | `engine/polymorph.ts`, `engine/talentEffects.ts`, `engine/traits/dispatch.ts` +2 | 238 — `criticals.json:bleus-aux-cotes`, `criticals.json:orteil-contusionne` … | Modificateur de caractéristique temporisé (ActiveEffect — meilleur bonus + pire pénalité sans cumul, LDB 16 l.13). |
| `condition` | `id`, `value?`, `durationRounds?`, `perRound?`, `valuePerSL?`, `onlyGroups?`, `onlyIfCondition?`, `unlessCondition?`, `escapeStrength?`, `escapeThreshold?`, `entangleOnFail?`, `struggleDamage?`, `lockedUntil?`, `resolveWindow?`, `unlockBy?`, `grapple?`, `durationMinutes?`, `durationHours?`, `carried?` | exécutée | `engine/conditions.ts`, `engine/critical.ts`, `engine/disease.ts` +13 | 440 — `activities.json:extenue`, `criticals.json:hemorragique` … | Ajout d'un État nommé (LDB 16). |
| `contractDisease` | `disease` | exécutée | `engine/disease.ts`, `state/aiSpellValue.ts` | 10 — `criticals.json:blessure-au-ventre`, `criticals.json:hemorragie-interne` … | CONTRACTE instantanément une Maladie (`disease` = id) — incubation 0, durée tirée. |
| `corruption` | `amount`, `perSL?`, `align?` | exécutée | `engine/miscast.ts`, `state/aiSpellValue.ts`, `state/targetingModes.ts` | 15 — `miscast.json:mineure-murmures-mortels`, `miscast.json:mineure-malediction-de-corruption` … | Points de Corruption (LDB 19). |
| `corruptionExposure` | `level?`, `skill?`, `easeSteps?` | exécutée | — | 9 — `activities.json:tester-objets-magiques`, `spells.json:bouclier-en-acier-dore` … | EXPOSITION à une Influence corruptrice (LDB 19 l.23-75) : Test différé par MODALE (pendingCorruption) — op IMPURE résolue par la couche state via `ctx.onCorruptionExposure` (même patron que `ctx.onCorruption`) ; sans contexte (moteur pur), journalisée sans jet. |
| `crewTestMod` | `mod` | exécutée | — | 1 — `sea-shanties.json:naviguons-tous-ensemble` | Modificateur aux Tests INDIVIDUELS composant un TEST D'ÉQUIPAGE (MDG 14) — chanson « Naviguons tous ensemble » : « +10 sur les Tests individuels de chaque membre d'équipage impliqué dans un Test d'équipage » (MDG 09 l.224). |
| `critOnRoll` | `mod`, `equals` | **inerte au switch** | `engine/qualities/dispatch.ts` | 1 — `qualities.json:empaleuse` | PASSIF d'ARME : Empaleuse (LDB 62) — déclenche un Coup Critique quand `roll % mod === equals` (`{mod:10, equals:0}` = multiple de 10). |
| `critTwice` | — | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 1 — `spells.json:benediction-de-sauvagerie` | « Deux lancers [de Blessure Critique], choisissez le meilleur » quand le porteur INFLIGE un Critique (Bénédiction de Sauvagerie, LDB 41) — lu par `resolveCritique` via l'attaquant. |
| `cureCriticalWound` | `count?`, `countPerSL?` | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 3 — `spells.json:larmes-de-shallya`, `traits.json:regeneration` … | Guérit `count` (+échelle DR) Blessures critiques de convalescence — jamais une amputation (Larmes de Shallya, LDB 42). |
| `cureDisease` | `count?`, `countPerSL?` | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 2 — `spells.json:amere-catharsis`, `trappings.json:panacea-universalis` | Purge de maladies (Amère catharsis, LDB 42) : retire `count` (+échelle DR) maladies. |
| `damageArmour` | `material` | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 3 — `maneuvers.json:souffle-corrosif`, `maneuvers.json:vomissement` … | Putréfaction (LDB 47) : « le cuir se racornit (perdant 1 PA à 1 Localisation) » — seule la matière `cuir` est mécanisée (pièce d'armure portée) ; le reste (denrées, vêtements) reste MJ. |
| `delayed` | `afterMinutes?`, `afterHours?`, `afterDays?`, `afterDuration?`, `forMinutes?`, `forHours?`, `forDays?`, `ops` | **inerte au switch** | `engine/flowCore.ts`, `state/combatEffects.ts` | 7 — `spells.json:crevasse-lumiere`, `spells.json:danse-du-desespoir` … | Ops DIFFÉRÉES à échéance d'horloge (op IMPURE — file `scheduledEffects`, résolue couche state comme `summon`/`zone` ; INERTE dans `applyOps`). |
| `disarm` | — | exécutée | `state/combatFlow.ts` | 17 — `criticals.json:choc-au-bras`, `criticals.json:choc-violent-au-bras` … | Lâche l'objet tenu dans UNE main (Aux Armes, bras/corps « Vous lâchez ce que vous teniez dans cette main ») — vide le slot de loadout (`main`/`off`) et `recomputeLoadout` (même patron que `breakBacleArmour` : mutation de l'ItemInstance/loadout puis re-dérivation, PAS un ground-item — aucun tel concept dans le moteur). |
| `diseaseTestMod` | `diseases?`, `amount` | exécutée | `engine/disease.ts`, `state/aiSpellValue.ts`, `state/targetingModes.ts` | 6 — `maladies.json:vers-du-reik`, `trappings.json:fleur-de-lune` … | Bonus/malus aux Tests LIÉS À UNE MALADIE (contraction, cycle quotidien, Test de fin) — Fleur de lune « +30 à tous les Tests associés pour résister à la [Peste noire] » (LDB 71 l.26), Racine de terre +10 (LDB 72 l.28), Tonique digestif +20 (l.32). |
| `domeWard` | `traitId`, `indice` | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 1 — `spells.json:dome` | Dôme (LDB 47 l.410) — aura sur la cible, qui OCTROIE `traitId` (Indice) à ceux qu'elle couvre : MÊME graphie d'octroi que `grantTrait`, et REQUISE ici (un dôme sans Indice serait une protection qui ne sauve de rien). |
| `endPsych` | `type` | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 2 — `psychology.json:frenesie`, `talents.json:controle-de-la-frenesie` | Retire un état PSYCHOLOGIQUE porté (`PsychAffliction.type` — collection `psychState`, DISTINCTE de `conditions` : pas de perte d'Avantage à la pose, LDB 21 ≠ LDB 16). |
| `endTransform` | `tag` | exécutée | `engine/creatureAttacks.ts`, `state/aiSpellValue.ts` | 1 — `maneuvers.json:forme-humaine-ulric` | Fin de TRANSFORMATION (`transform`) : retire d'un coup tous les effets actifs portant le `tag` (deltas de profil + traits accordés + apparence) et recale les Blessures — retour à la forme de base. |
| `exposeDisease` | `disease`, `difficultyShift?`, `incubation?` | exécutée | `state/aiSpellValue.ts` | 4 — `qualities.json:infecte`, `traits.json:infecte` … | EXPOSE la cible à une Maladie (`disease` = id de `maladies.json`) → Test de Contraction au bilan de fin de combat (LDB 20 l.25/51). |
| `fall` | `hauteur` | exécutée | — | 5 — `ship-criticals.json:vergue-detachee`, `ship-criticals.json:greement-degrade` … | CHUTE (`LDB 15 l.80`, `l.84`) : la cible tombe de la hauteur que dit une TABLE (`hauteur.table`, `ship-criticals.json` → `tablesDeChute`), lue par (Taille de la coque `ctx.hull` × station du tombant, `Combatant.shipStation`) — MDG 13 l.678-688. |
| `freeReroll` | — | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 3 — `spells.json:benediction-de-chance`, `spells.json:methode-essai-erreur` … | « Peut relancer le prochain Test auquel elle échoue » (Bénédiction de Chance, LDB 41) — drapeau consommé à l'usage au point de relance des flux de jet. |
| `gainAdvantage` | `amount`, `feedOpposingPool?` | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 3 — `tavernGames.json:bras-de-fer`, `tavernGames.json:middenball` … | Porte l'Avantage de la cible à AU MOINS `amount` (jamais réduit). |
| `gainResource` | `resource`, `amount`, `perSL?`, `temporary?` | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 6 — `spells.json:le-premier-signe-d-amul`, `spells.json:le-second-signe-d-amul` … | Points de Chance OU de Destin accordés (`resource`, LDB 47 — « Les Signes d'Amul », « Que la chance persiste », « Maître du Destin », « Troisième Signe d'Amul ») : incrément immédiat (peut dépasser le maximum — c'est un grant de Sort) ; `temporary` pose un effet actif qui RETIRE les points NON dépensés à l'expiration (rounds OU horloge, engine/grantedResources). |
| `giveTrapping` | `trappingId?`, `custom?`, `count?`, `perSL?` | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 3 — `spells.json:generosite-de-manann`, `spells.json:recolte-de-rhya` … | Crée un objet (`trapping`) dans l'inventaire de la cible — nom RÉEL de la base → objet à stats, nom inconnu → objet CUSTOM (misc). |
| `grantCareerSkill` | `skill` | **hors switch** | `engine/talentEffects.ts`, `state/targetingModes.ts` | 5 — `talents.json:artiste`, `talents.json:maitre-artisan` … | Ajoute une Compétence aux listes de TOUTE carrière entamée (Maître artisan/Sorcier!/… LDB 10) — référence EMBOÎTÉE (jamais libellé), MÊME forme que `SkillRef` sans sa valeur imprimée : `skill.choix` = emplacement NON désigné, reporté sur la spec choisie du talent quand elle existe. |
| `grantCareerTalent` | `talentId`, `spec?` | **hors switch** | `engine/talentEffects.ts`, `state/targetingModes.ts` | 21 — `talents.json:flagellant`, `traits.json:marque-de-tzeentch` … | Ajoute un Talent aux listes de TOUTE carrière entamée (Flagellant → Frénésie « est ajouté à la liste des Talents de n'importe laquelle de vos Carrières », LDB 10) — analogue Talent de `grantCareerSkill`, ref par `talentId` STABLE. |
| `grantFreeAttack` | `weapon`, `when`, `advantageCost?`, `advantageOrMovement?`, `activeIf?`, `perChargerOncePerRound?`, `label?` | **inerte au switch** | `engine/flowCore.ts`, `state/aiSpellValue.ts`, `state/combat/triggeredTest.ts` +3 | 3 — `psychology.json:frenesie`, `talents.json:assaut-feroce` … | ATTAQUE GRATUITE accordée par un talent/état (Frénésie : 1 attaque d'Arme/Round ; Assaut féroce : attaque supplémentaire à la touche ; Frappe réactive : riposte quand on est Chargé). |
| `grantNaturalWeapon` | `label`, `damage`, `damagePlus?`, `plusBF?`, `bare?`, `qualities?`, `attackKind?`, `subType?`, `uid?` | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 7 — `mutations.json:cornes-asymetriques`, `mutations.json:griffes` … | Accorde une ARME NATURELLE (Dent et griffe : Morsure BF+3 / Arme BF+4 ; Incarnation de Wyssan) : attaque ADDITIONNELLE de mêlée injectée dans `c.weapons` (recomputeLoadout), retirée à l'expiration. |
| `grantPsychTrait` | `psychType`, `cible?`, `argFrom?` | exécutée | `engine/corruption.ts`, `engine/disease.ts` | 8 — `drunkenness.json:tous-un-par-un`, `mutations.json:colere-impie` … | Trait PSYCHOLOGIQUE conféré (Colère impie → Frénésie). |
| `grantReverseToken` | `skill?` | exécutée | `state/interludeFlow.ts` | 1 — `activities.json:observer-une-cible` | Jeton d'INVERSION de Test CONSOMMABLE « pour la prochaine aventure » (LDB 23 l.209/218) — durée `{scale:'adventure'}`, consommé par `consumeReverseToken` (rollFlowSpecs). |
| `grantSymptom` | `disease`, `symptomId`, `severity?` | exécutée | `engine/disease.ts` | 1 — `maladies.json:pneumonie` | AJOUTE un symptôme à une maladie déjà portée (EDOC 08 l.106-108 : « la maladie développe également le symptôme Toxine »). |
| `grantTalent` | `talentId`, `spec?` | exécutée | `engine/corruption.ts`, `engine/talentEffects.ts`, `state/aiSpellValue.ts` +1 | 57 — `mutations.json:tete-bestiale-chien`, `mutations.json:fuite-aethyrique` … | Talent OCTROYÉ, TEMPORAIRE porté par l'`ActiveEffect` (`grantedTalent`) ou STRUCTUREL dans `c.talents` quand l'octroi n'a pas d'échéance (Marques Arcaniques, VDM 02 l.238). |
| `grantTrait` | `traitId`, `arg?`, `argFrom?`, `indice?`, `indicePerSL?`, `onlyGroups?`, `durationRounds?`, `durationMinutes?`, `durationHours?` | exécutée | `engine/corruption.ts`, `engine/polymorph.ts`, `state/aiSpellValue.ts` +1 | 132 — `domains.json:bete`, `maneuvers.json:forme-hybride-ulric` … | Trait de créature TEMPORISÉ (Jalon 2.6 — « vous gagnez le Trait X tant que le Sort est actif ») : posé dans `c.traits` (vu par TOUS les consommateurs — dispatch, psy, IA, déplacement), retiré à l'expiration de l'ActiveEffect porteur. |
| `grantWeapon` | `label`, `damage`, `damagePlus?`, `plusBF?`, `qualities?`, `subType?`, `reach?`, `hands?`, `onHitEffects?`, `skin?`, `form?`, `chooseForm?` | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 3 — `spells.json:arme-aethyrique`, `spells.json:l-epee-ardente-de-rhuin` … | Invoque une arme MAGIQUE temporaire (Arme aethyrique : Dégâts = BFM ; Faux de Shyish : Arme d'hast, BFM+3 ; Épée ardente de Rhuin : Dégâts +6, Percutante). |
| `handGate` | — | exécutée | — | 2 — `criticals.json:main-ensanglantee`, `criticals.json:aa-bras-46` | Main « ensanglantée » (Aux Armes bras 46-50, l.2569 : Main ensanglantée) — pose un marqueur PAR-MAIN (`Combatant.handGates`), DISTINCT du compteur global Hémorragique, qui impose un Test de Dextérité (+20) AVANT toute Action employant l'arme tenue par cette main (`attackHandGate` ; Échec → op `disarm`). |
| `heal` | `amount`, `perSL?` | exécutée | `state/aiSpellValue.ts`, `state/massBattleFlow.ts`, `state/rollSeam.ts` +2 | 16 — `spells.json:benediction-de-guerison`, `spells.json:cauteriser` … | Blessures rendues (plafonnées au max). |
| `healCaster` | `amount` | exécutée | `state/aiSpellValue.ts` | 1 — `spells.json:drain` | Blessures rendues AU LANCEUR (« Puis vous Guérissez 1 Point de Blessure » — Drain). |
| `ignoreAnimosity` | — | exécutée | — | 1 — `drunkenness.json:meilleur-ami` | « Vous êtes mon meilleur ami ! » (Ivresse 3-4, LDB 09 l.480) : ignore Préjugés et Animosités existants tant que l'effet dure — flag `ActiveEffect.ignoreAnimosity`. |
| `ignoreStatePenalties` | `count?` | exécutée | `engine/conditions.ts`, `state/aiSpellValue.ts`, `state/targetingModes.ts` | 3 — `sea-shanties.json:les-dames-de-l-anguille`, `spells.json:clarte-d-esprit` … | « Ne subit aucune pénalité causée par les États » (Endurance de l'anachorète, LDB 42) — drapeau d'effet actif lu par combatTestPenalty/testStatePenalty. |
| `incomingAdvantage` | `mode`, `amount` | **hors switch** | `engine/conditions.ts` | 1 — `etats.json:sonne` | L'ASSAILLANT du porteur GAGNE `amount` Avantage(s) avant son attaque (Sonné : « +1 Avantage », LDB 16 l.125). |
| `incomingAttackMod` | `mode`, `amount`, `flankRear?` | **hors switch** | `engine/conditions.ts` | 5 — `etats.json:assourdi`, `etats.json:a-terre` … | Modificateur au Test de l'ATTAQUANT qui vise le porteur (Parasité : −10 au toucher en mêlée, LDB 85 p.340). |
| `incomingSpellDRMod` | `amount` | **hors switch** | `engine/magic.ts` | 2 — `talents.json:resistance-a-la-magie`, `traits.json:resistance-a-la-magie` | Modificateur au DR des SORTS qui affectent le porteur (Résistance à la Magie — trait `LDB 85 l.302`, talent `LDB 10 l.1026`). |
| `interruptFocus` | — | **inerte au switch** | `engine/flowCore.ts`, `state/combat/triggeredTest.ts`, `state/combatFlow.ts` | **0** | Marqueur IMPUR de la branche d'ÉCHEC du Test de Calme d'interruption de Focalisation (LDB 46 l.144) : la cible perd tous les DR focalisés (couverts par son composant) et subit une Incantation Imparfaite Mineure. |
| `intoxicate` | — | exécutée | `engine/drunkenness.ts` | 4 — `tavernGames.json:cerevis`, `tavernGames.json:torchon` … | Boisson alcoolisée : enregistre UN échec de Résistance à l'alcool (LDB 09 l.475) sur la cible — −10 aux CC/CT/Ag/Dex/Int (plafond −30), et Ivresse (1d10) au seuil BE. |
| `kill` | — | exécutée | `engine/disease.ts` | 3 — `spells.json:cendre-et-poussiere`, `symptoms.json:toxine` … | Mort DIRECTE hors Tableau des Critiques (Toxine, LDB 20 l.215 : « ou vous mourrez ») — 1 Point de Destin sauve (LDB 17 l.29-37, « circonstances les plus difficiles […] éviter une mort certaine », MÊME patron que la mort par Hémorragie hors combat, `outOfCombatUpkeep.ts`), sinon `target.dead = true`. |
| `lifeSteal` | `num`, `den`, `round?` | exécutée | `state/combatFlow.ts`, `state/targetingModes.ts` | 4 — `spells.json:caresse-de-laniph`, `spells.json:vol-de-vie` … | VOL DE VIE (LDB 48 — Caresse de Laniph, Vol de vie) : le lanceur (`ctx.caster`) regagne une fraction (`num/den`, arrondi `round`, défaut plancher) des Blessures RÉELLEMENT infligées ce lancement (`ctx.woundsDealt`, jamais plus que les PB perdus par la cible). |
| `light` | `radiusM`, `tone?`, `durationRounds?` | exécutée | — | 7 — `spells.json:lumiere`, `spells.json:edifice-illumine` … | Émission de LUMIÈRE — `radiusM` = le rayon éclairé en MÈTRES, la valeur RAW telle qu'elle est écrite (Bougie 10 m `LDB 74 l.43`, Lanterne 20 m `LDB 74 l.58`) ; c'est `rayonEnCases` (`state/vision.ts`) qui la ramène aux cases du brouillard de guerre. |
| `loseTurn` | `what?` | exécutée | `state/targetingModes.ts` | 6 — `maneuvers.json:forme-hybride-ulric`, `maneuvers.json:forme-humaine-ulric` … | Perd sa prochaine Action ET/OU son prochain Mouvement (Affamé : « festoie » ; échec du gate de la Racine de mandragore : « une Action ou un Mouvement (un au choix) », LDB 71 l.35 → l'issue du choix pose `what:'action'` ou `'movement'`). |
| `martyr` | — | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 1 — `spells.json:martyr` | Martyr (LDB 43 l.107) : « Vous recevez tous les Dégâts subis en principe par vos cibles. |
| `maxWeaponHands` | `hands`, `durationRounds?` | exécutée | `engine/trauma.ts` | 9 — `criticals.json:choc-violent-au-bras`, `criticals.json:clef-de-bras` … | Plafond de mains d'arme maniables — GÉNÉRALISE `noTwoHanded` (hands:1 = pas d'arme à deux mains). |
| `mitigateIncoming` | `mode`, `unlessKeyword?` | **hors switch** | `state/targetingModes.ts` | 1 — `traits.json:ethere` | MITIGE les Dégâts ENTRANTS du porteur (Éthéré : nullifie sauf attaque 'magic', LDB 85 l.134). |
| `money` | `montant` | exécutée | `engine/flowCore.ts` | 3 — `activities.json:mendier`, `activities.json:mendier` … | Crédite (positif) ou débite (négatif) la bourse PERSONNELLE de la cible, en SOUS DE CUIVRE (`brass` — unité de compte unique, `engine/money.ts`). |
| `moveMod` | `mod` | exécutée | `engine/navalTraits.ts`, `engine/traits/dispatch.ts`, `engine/trauma.ts` | 19 — `maneuvers.json:forme-hybride-ulric`, `mutations.json:pattes-d-animaux` … | Modificateur ADDITIF de Mouvement (trait Brutal −1 / Rapide +1, mutation ±1, encombrement) — distinct de `moveScale` (multiplicatif). |
| `moveScale` | `num`, `den`, `durationRounds?` | exécutée | `engine/navalTraits.ts`, `engine/trauma.ts` | 17 — `criticals.json:souffle-coupe`, `criticals.json:genou-demis` … | Échelle MULTIPLICATIVE du Mouvement — GÉNÉRALISE le drapeau `movementHalved` (= 1/2). |
| `narrative` | `text` | exécutée | `engine/polymorph.ts`, `engine/spellspec.ts` | 507 — `spells.json:benediction-de-conscience`, `spells.json:alerte` … | Effet non modélisé : journalisé verbatim, arbitrage MJ (rien d'inventé). |
| `noBreath` | — | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 5 — `spells.json:benediction-de-souffle`, `spells.json:respiration-aquatique` … | « N'a pas besoin de respirer et ignore les règles de suffocation » (B. |
| `noHunger` | — | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 1 — `spells.json:graisse-de-la-terre` | « N'a pas besoin de manger ou de boire » (Graisse de la terre, LDB 48) : exempte de la Faim (système de provisions) tant que le Sort dure. |
| `offTerrainMod` | `terrain`, `mSet?`, `testDR?`, `suffocates?` | **inerte au switch** | — | 3 — `traits.json:amphibie`, `traits.json:creature-marine` … | HORS de son terrain d'élection (`terrain` = type de tuile de la case occupée, ex. `eau`), le porteur est diminué : `mSet` REMPLACE son Mouvement (Créature marine : « son M tombe à 1 », MDG 16 l.17 ; Aquatique : « ne peut pas se déplacer sur la terre ferme », MSRC 15 l.139 → `mSet: 0`) et `testDR` s'applique à TOUS ses Tests (Créature marine : « tous les Tests qu'elle effectue subissent –2 DR »). |
| `perRound` | `ops` | exécutée | — | 2 — `spells.json:recolte-de-rhya`, `spells.json:sang-bouillant` | Effet RÉCURRENT multi-Rounds : pose un effet actif porteur qui re-joue `ops` à CHAQUE fin de Round tant que le sort dure (`ctx.defaultDurationRounds`, Surincantation de Durée incluse — LDB 47). |
| `polymorph` | `ref` | exécutée | — | 2 — `spells.json:forme-bestiale`, `spells.json:transformation-de-kadon` | MÉTAMORPHOSE en créature (Forme bestiale, LDB 48) : remplace F/E/Ag/Dex (charMod différentiel) et accorde les Traits de la créature sauf Bestial (grantTrait), auto-restitués à l'expiration. |
| `preventInfection` | — | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 3 — `spells.json:cauteriser`, `trappings.json:cataplasme-de-guerison` … | Les Blessures ne s'infecteront pas (Cautériser, LDB 47 → flag `woundDressed`, LDB 18 l.298). |
| `push` | `meters` | **inerte au switch** | `state/combatFlow.ts`, `state/targetingModes.ts` | 4 — `spells.json:poussee`, `spells.json:geyser` … | POUSSÉE POSITIONNELLE (Poussée, LDB 47 l.479) : chaque cible affectée est repoussée en ligne (direction lanceur→cible) de `meters` mètres jusqu'à l'obstacle ; la collision est journalisée. |
| `reduceDiseaseDays` | `days?`, `dice?`, `disease?`, `oncePerDisease?`, `daysPerSL?` | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 3 — `spells.json:benediction-de-convalescence`, `trappings.json:gesundheit` … | −N jours sur la durée d'une maladie active. |
| `reduceToZero` | — | exécutée | `engine/miscast.ts`, `state/aiSpellValue.ts`, `state/targetingModes.ts` | 3 — `maneuvers.json:regard-petrifiant`, `miscast.json:colere-chatiment` … | PB réduits à 0 SEUL (Châtiment, Tonnerre et foudre — LDB 40). |
| `removeCondition` | `id?`, `value?`, `valuePerSL?`, `all?` | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 29 — `domains.json:extenue`, `domains.json:hemorragique` … | Retrait d'États : `id` absent = au choix de la cible (1er État porté). |
| `removePsychTrait` | `psychType?` | exécutée | `state/targetingModes.ts` | 1 — `activities.json:convalescence` | Retire UN Trait psychologique porté (`c.psychTraits` — la DONNÉE persistée, ≠ `endPsych` qui retire une affliction de combat `psychState`). |
| `removeShipPoste` | — | exécutée | — | 1 — `ship-criticals.json:canon-perdu` | Retire une pièce d'artillerie d'une COQUE (« Canon perdu », MDG 13 l.765 : la pièce passe par-dessus bord) : `target.postes` perd UN poste au hasard (`ctx.rng`) ; si son chef de pièce (`crewIds[0]`, résolu dans `ctx.crew`) la servait, il est démancipé (`mannedPoste` + arme dérivée retirés). |
| `removeTrait` | `traitId` | exécutée | — | 1 — `mutations.json:haine-sporadique` | RETRAIT d'un Trait de créature porté (`c.traits`) — l'INVERSE de `grantTrait`, même vocabulaire : retire ce que LA SOURCE COURANTE (`ctx.source`) a accordé, instances retrouvées par le registre `TraitInstance.src`. |
| `rollMutation` | `table`, `duration?` | exécutée | — | 4 — `tables.json:allure-demoniaque-nurgle`, `tables.json:allure-demoniaque-slaanesh` … | Tirage d'une MUTATION sur une table de Corruption (`mutationTables.json`, par id `table`) — réutilise `rollMutation()` + `attachMutation()` (`corruption.ts`/`mutations.ts`). |
| `rollTable` | `die`, `mod?`, `addNegativeSL?`, `extraRollsPerStep?`, `rows` \| `die?`, `mod?`, `addNegativeSL?`, `extraRollsPerStep?`, `tableId` | exécutée | `engine/miscast.ts`, `engine/overcast.ts` | 27 — `activities.json:brasser-une-potion`, `activities.json:alchimie-ordinaire` … | Tirage sur TABLE (`die` = d10/d100) : lookup par fourchette `[min,max]` (`findTableEntry`, source unique), les `ops` de la rangée touchée sont appliquées avec le MÊME ctx. |
| `rollThreshold` | `sides`, `thresholds` | exécutée | — | 2 — `traits.json:regeneration`, `traits.json:regeneration` | Jet à PALIERS (Régénération : un d10 → soin = le dé ; sur 10, soigne aussi un Critique) : roule 1d`sides` UNE fois, applique les `ops` de CHAQUE palier dont `atLeast` est atteint (cumulatif). |
| `sbBonus` | `amount` | **hors switch** | `engine/trauma.ts` | 1 — `psychology.json:frenesie` | +N au Bonus de Force employé aux DÉGÂTS (Frénésie : +1 « grâce à votre férocité », LDB 21 l.33). |
| `scheduleRespawn` | `ref`, `delayDays`, `count?`, `allyOfCaster?`, `cancelFlag?` | **inerte au switch** | `state/combatFlow.ts` | 1 — `traits.json:gardien-eternel` | RECONSTITUTION DIFFÉRÉE (Gardien éternel, Middenheim — « se reconstitue au bout de d10 jours »). |
| `senseLoss` | `sense` | exécutée | `engine/trauma.ts`, `state/targetingModes.ts` | 2 — `traumas.json:oeil-perdu`, `traumas.json:oreille-perdue` | Perte d'un organe sensoriel PAIRÉ (œil/oreille). |
| `sinMod` | `amount` | exécutée | `state/combatEffects.ts` | 2 — `activities.json:penitence`, `activities.json:penitence` | Points de PÉCHÉ ±N (LDB 40 l.36 : sanction du prêtre fautif ; ACE Annexe I « Pénitence » : « enlevez 1 point de Péché, ou 2 sur un Succès Impressionnant ») — jamais sous 0. |
| `skillDRBonus` | `skill?`, `bonus`, `testType?` | exécutée | `engine/navalTraits.ts`, `state/targetingModes.ts` | 60 — `naval-traits.json:peu-maniable`, `naval-traits.json:peu-maniable` … | +N DR à un Test de Compétence nommé (Furtif : +Bonus d'Agilité au DR de Discrétion, LDB 85 l.154 ; chanson « Jacques Bret » : +1 DR sur tout Test de Corps à corps réussi, MDG 09 l.228). |
| `skillMod` | `skill`, `mod`, `sense?` | exécutée | `engine/skills.ts`, `engine/trauma.ts`, `engine/wearPenalty.ts` +1 | 26 — `drunkenness.json:bravoure-marienburgher`, `mutations.json:langue-pendante` … | Modificateur (pénalité/bonus) à UNE Compétence nommée — GÉNÉRALISE les pénalités de séquelle `skillPenalty` (Langue −100 « auto-échec parole ») ET `dodgePenalty` (Esquive −20, mobilité). |
| `spendAdvantage` | `amount` | exécutée | — | **0** | Dépense `amount` Points d'Avantage du RÉFÉRENT (Déstabilisante : coût d'un Test de renversement). |
| `statusMod` | `amount` | exécutée | `state/interludeFlow.ts` | 1 — `activities.json:surpris` | Modificateur TEMPORAIRE de Standing (LDB 23 l.228-234 « Réputation » : +1 sur succès, +2 sur Succès Stupéfiant, −1 sur Échec Stupéfiant) — durée `{scale:'adventure'}` (« pour la prochaine aventure »), composé par `heroStatus` (interludeFlow.ts), purgé à l'interlude SUIVANT (`purgeAdventureEffects`). |
| `suffocate` | — | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 8 — `spells.json:transmutation-de-chamon`, `spells.json:ombres-etrangleuses` … | « Soumis aux règles de la Suffocation » (LDB 18 l.345-346 — Ombres étrangleuses, Transmutation de Chamon) : −1 PB/Round, 0 PB → Inconscient, mort après BE Rounds. |
| `summon` | `ref`, `count`, `countPerSL?`, `addTraits?`, `size?`, `allyOfCaster?`, `despawnIfCasterDown?` | **inerte au switch** | `state/aiSpellValue.ts`, `state/combatFlow.ts`, `state/summonFlow.ts` | 16 — `spells.json:destrier-d-ombre`, `spells.json:menace-rampante` … | INVOCATION de créature(s) (Nécromancie « Réanimation/Relever les morts », Ulric « Hurlement du loup », Démonologie « Manifestation », Taal « Roi de la Nature »…). |
| `suppressPsych` | — | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 2 — `spells.json:clarte-d-esprit`, `spells.json:baume-pour-un-esprit-blesse` | Baume pour un esprit blessé (LDB 42) : « Tous les Traits Psychologiques sont retirés pour la durée du Miracle » — Traits psy SUSPENDUS (portés par l'effet), restitués à l'expiration. |
| `suppressSymptom` | `symptomId` | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 1 — `trappings.json:racine-de-terre` | SUSPEND un symptôme de maladie par id (Racine de terre : « annuler les effets de bubons causés par la Peste noire », LDB 72 l.28) — analogue de `suppressPsych` : les canaux `passive`/`onTick` du symptôme sont ignorés tant que l'effet dure (`ActiveEffect.suppressedSymptom`, lu par `symptomSuppressed` dans engine/disease), restitués à l'expiration. |
| `teamCommander` | `commanderId` | exécutée | — | **0** | Commandant d'équipe (AA 13 l.29-35) : lie CE chef de pièce (`target`) au commandant `commanderId` qui vient de le diriger (Test de Commandement réussi) → l'équipe tire ENSUITE au score de Projectiles du commandant (substitution re-validée à chaque tir tant qu'il vit et reste à portée de voix). |
| `teleport` | `meters`, `perSL?` | **inerte au switch** | `state/combatFlow.ts` | 6 — `spells.json:teleportation`, `spells.json:portail-d-ombre` … | TÉLÉPORTATION du lanceur (Téléportation, LDB 47 l.517 / Portail d'Ombre / Eau de la terre, LDB 48 l.671/719) : le lanceur se déplace de `meters` mètres (+`perSL` « +metersFormula par `every` DR ») en survolant les obstacles. |
| `testMod` | `amount`, `char?`, `combatOnly?`, `movementOnly?`, `hearingOnly?`, `exceptSkills?`, `weaponHand?` | exécutée | `engine/conditions.ts`, `engine/qualities/dispatch.ts`, `engine/skills.ts` +3 | 26 — `criticals.json:epaule-luxee`, `criticals.json:genou-demis` … | Modificateur de Test du porteur (Malédiction de malchance : −10 global). |
| `transform` | `tag`, `ops`, `morphRef?` | exécutée | `engine/creatureAttacks.ts`, `state/aiSpellValue.ts` | 1 — `maneuvers.json:forme-hybride-ulric` | TRANSFORMATION durable & réversible (≠ `polymorph`, buff temporaire de sort) — Métamorphose de créature (Enfant d'Ulric humain↔hybride, Middenheim p.116) : applique un jeu de deltas AUTHORÉS (`ops` — charMod/moveMod/grantTrait… du tableau RAW VERBATIM) sous un LABEL déterministe (`tag`) et une durée PERMANENTE (jamais auto-restituée), + override d'APPARENCE (`morphRef`, couche rig). |
| `weaponDamageMod` | `mode?`, `plusUnits?`, `negateAtouts?`, `chargeGated?` | **inerte au switch** | `engine/qualities/dispatch.ts` | 5 — `qualities.json:devastatrice`, `qualities.json:percutante` … | PASSIF d'ARME : modificateur de DÉGÂTS (LDB 62-63) — Dévastatrice (DR = max(DR, dé des unités), `mode:'maxUnits'`), Percutante (+ dé des unités, `plusUnits`), Inoffensive (annule les Atouts de Dégâts, `negateAtouts`), Épuisante (`chargeGated` : Percutante/Dévastatrice de l'arme inertes hors Charge). |
| `weaponRollMod` | `phase`, `drMod?`, `flatMod?` | **inerte au switch** | `engine/qualities/dispatch.ts` | 10 — `qualities.json:a-enroulement`, `qualities.json:defensive` … | PASSIF d'ARME (Atout/Défaut, LDB 62-63) : modificateur de DR/plat à une PHASE de jet de combat — Précise (+10 `flatMod` en attaque), Imprécise (−1 DR en attaque), Pointue (+1 DR au Test d'attaque RÉUSSI, `phase:'attackSuccess'`, LDB 62 l.288), Défensive (+1 DR parade du défenseur), À Enroulement (−1 DR parade adverse), Lente (+1 DR à TOUTE défense adverse), Pratique/Peu Fiable (±1 DR à un Test raté). |
| `weatherWard` | — | exécutée | `state/aiSpellValue.ts`, `state/targetingModes.ts` | 3 — `spells.json:protection-contre-la-pluie`, `spells.json:peau-de-loup-d-hiver` … | Immunité à l'EXPOSITION météo (froid/pluie/neige/tempête) tant que le Sort dure — Peau de loup d'hiver (Ulric), Protection contre la pluie. |
| `wounds` | `amount`, `perSL?`, `onlyGroups?`, `ignoreTB?`, `ignoreAP?`, `bypassArmour?`, `apFrom?`, `min?`, `extraAP?`, `weaponHit?` | exécutée | `engine/critical.ts`, `engine/disease.ts`, `engine/miscast.ts` +9 | 226 — `criticals.json:blessure-spectaculaire`, `criticals.json:coupure-mineure` … | Blessures subies DIRECTEMENT. |
| `zone` | `shape`, `radiusMeters?`, `lengthMeters?`, `lengthPerSL?`, `blocksLoS?`, `onCross?`, `perRound?`, `crossTest?`, `barrier?`, `gate?`, `noCorruption?` | **inerte au switch** | `engine/overcast.ts`, `state/combatFlow.ts`, `state/zones.ts` | 13 — `spells.json:vol-du-destin`, `spells.json:grands-feux-d-u-zhul` … | ZONE PERSISTANTE posée par le sort (Mur de feu, Grands feux d'U'Zhul, Vol du Destin). |

_110 ops (111 membres d'union avant fusion des formes) — 87 exécutées par `applyOps`, 15 inertes au switch, 8 hors switch (impures ou passives — cf. « Résolveurs »)._

### Ops à ZÉRO usage en donnée (7)

- `amputer`
- `attenuateSymptom`
- `beginPsych`
- `breakBlade`
- `interruptFocus`
- `spendAdvantage`
- `teamCommander`

À instruire : soit du vocabulaire posé d'avance (l'op attend sa donnée), soit du code mort. Croiser avec la
colonne « Résolveurs » avant de conclure.

## Condition — l'algèbre de test PURE des flux

Prédicat PUR évalué par `evalCondition` : le `cond` d'un nœud `Flow` `if`, le `lockedUntil` d'un État, le gate d'un
effet déclenché. Composables par `all`/`any`/`not`.

| `kind` | Champs | Rôle |
|---|---|---|
| `always` | — | — |
| `flag` | `expr` | ET de drapeaux avec négation : « v1,!v2 » ⇔ flags.v1 && !flags.v2 (sémantique `condMet`). |
| `time` | `window` | Fenêtre horaire (heure-du-jour, `before` exclusif) — sémantique `temporalConditionMet`. |
| `hasItem` | `trappingId`, `count?` | Le GROUPE possède au moins `count` (défaut 1) exemplaire(s) de l'objet d'`id` `trappingId` (réf de catalogue stable). |
| `money` | `atLeast` | La bourse du groupe vaut AU MOINS le seuil `atLeast` (comparaison en sous de cuivre). |
| `partyDead` | `who` | État vital du groupe : `any` = au moins un héros mort, `all` = tous morts. |
| `skill` | `id`, `spec?`, `advances?`, `who?` | Un héros du groupe (`any`) OU tous (`all`, défaut `any`) possède la Compétence `id` (`spec` éventuel) avec au moins `advances` avances (défaut 0 = simple possession) — #711, gate de dialogue party-level. |
| `career` | `id`, `who?` | Un héros du groupe (`any`/`all`) exerce la carrière `id` (`Combatant.career`) — #711. |
| `species` | `id`, `who?` | Un héros du groupe (`any`/`all`) est de l'espèce `id` (`Combatant.species`) — #711. |
| `status` | `atLeast`, `who?` | Un héros du groupe (`any`/`all`) a un Statut (LDB 08, `actorStatus`) au moins `atLeast` (« Argent 2 », `parseStatus`) — #711. |
| `compare` | `subject`, `op`, `value` | COMPARAISON sur un ACTEUR du Flow (cible OU lanceur) — UNIQUE Condition « données d'acteur » : `subject` (`who` × donnée fixe OU valeur d'un État) · `op` (≥ ≤ = < >) · `value`. |
| `slThreshold` | `op`, `value` | Seuil de MARGE / DR du contexte (`ctx.sl`) : vrai si `sl ≥ atLeast`. |
| `location` | `is` | Localisation touchée par l'attaque courante (`ctx.location`, dé inversé) — Assommante : « si vous touchez la Tête… ». |
| `attackKind` | `is` | KIND de l'attaque courante (`ctx.attackKind` : 'morsure'/'cornes'/'caudale'/… cf. `creatureAttackKind`) — gate « seulement quand l'attaque est une Morsure » (Vampirique). |
| `startleCause` | `is` | CAUSE d'un effarouchement courant (`ctx.startleCause` : 'noise' bruits forts / 'magic' présence de magie — LDB 85 l.197 Nerveux) — gate l'exemption Dressé (Guerre ignore les bruits, Magie ignore la magie, LDB 85 l.110). |
| `woundsDealt` | `op`, `value` | Blessures infligées par l'attaque/lancement courant (`ctx.woundsDealt`), comparées par `op` à `value` (Venin : `> 0` → Empoisonné ; un rider « coup lourd » : `>= 3`). |
| `engagedAdvantageGap` | `op`, `value` | Écart d'Avantage avec les adversaires Engagés (`ctx.engagedAdvantageGap`), comparé par `op` à `value` (Instable : `> 0` → la créature est repoussée et perd des PB, LDB 85 l.177). |
| `engagedAdvantageLead` | `op`, `value` | AVANCE d'Avantage sur TOUS les adversaires Engagés (`ctx.engagedAdvantageLead` = son Avantage − le meilleur Avantage ennemi engagé), SIGNÉE et non bornée, comparée par `op` à `value`. |
| `foeInLoS` | — | Y a-t-il un adversaire VIVANT dans la Ligne de Vue de `target` (`ctx.foeInLoS`) ? Géométrie d'arène emballée en donnée (au-dessus de `lineOfSightCover`) : sortie de Frénésie « plus d'ennemi en vue → fin » (LDB 21 l.35), fuite/récupération du Brisé « hors de vue de l'ennemi » (LDB 16 l.52). |
| `hiddenFromFoes` | — | Aucun adversaire VIVANT ne voit l'acteur (sens foe→acteur, ≠ `foeInLoS` acteur→foe) — « caché hors de vue de l'ennemi » (Brisé, LDB 16 l.54/56 : retrait sans Test + difficulté Accessible). |
| `engaged` | — | L'acteur est-il ENGAGÉ avec un adversaire (LDB 13 l.159) ? Gate de récupération du Brisé (LDB 16 l.54 : aucun Test si Engagé). |
| `crewTest` | — | Le Test courant est-il un TEST D'ÉQUIPAGE à bord (MDG 14) ? Gate du bonus « Commandant émérite » (MDG 09 l.54 : « à bord de votre bateau ou impliquant votre équipage »). |
| `nearestFoe` | `op`, `value` | Distance (cases) à l'adversaire VIVANT le plus proche, comparée par `op` à `value` (Brisé : Très difficile si ≤ 3, LDB 16 l.58). |
| `capability` | `who`, `id`, `op?`, `value?` | Niveau d'une CAPACITÉ de combat (`CombatFeature`) de l'acteur `who`, comparé par `op` (défaut `>=`) à `value` (défaut 1) — Cœur vaillant (`braveheart`) octroyable par talent OU effet. |
| `relation` | `who`, `is` | Camp / RELATION d'un acteur (`who`) — gate « seulement les ennemis / les alliés / les neutres » (riders de domaine offensifs : `who:'target', is:'opponent'`). |
| `has` | `who`, `what`, `value`, `spec?` | L'acteur (`who`) POSSÈDE un élément : appartenance à un **Groupe** (faction, via `groupMatch`), un **Talent** (par id, `spec` éventuel — « Magie des Arcanes (Feu) »), un **Trait** (par id), ou un **état psychologique** actif (par type — `psych`, ex. 'frenesie' : gate du Contrôle de la Frénésie, LDB 10). |
| `casterChaosDomain` | `is` | Le Domaine du Chaos du LANCEUR (`ctx.caster.chaosDomain`, `chaosDomainOf`) est-il `is` ? Gate GÉNÉRIQUE de tout Sort d'Arcanes du Chaos « se manifestant selon le Domaine spécifique » (EDOC 13 l.264-266) — la branche du Flow sélectionne sa colonne (Allure démoniaque : Nurgle/Slaanesh/Tzeentch/ Indivisible). |
| `visiblePassive` | `who` | L'acteur (`who`) montre-t-il un passif VISIBLE (`ActorView.visiblePassive` — une lésion apparente, émise `visible` par sa source) ? Gate d'apparence : « à quel point votre apparence peut susciter la sympathie » (LDB 09 l.97). |
| `all` | `of` | — |
| `any` | `of` | — |
| `not` | `of` | — |

_31 entrées — dérivées de `src/engine/flowCore.ts`._

## Flow — les nœuds de flux authorés

Un nœud de Flow, GÉNÉRIQUE sur le type de sa FEUILLE `E` (défaut `EffectOp` — engine pur ; la couche `state` instancie `Flow<Effect>`). Cinq formes, RÉCURSIVES, jamais cycliques : - `seq` : exécute `steps` dans l'ordre (forme Flow d'une liste d'effets) ; - `do` : une feuille — applique un effet `E` (action) ; - `if` : évalue `cond` (PUR) → `then` / `else` ; - `test` : jet ALÉATOIRE interactif → `success` / `fail` (forme Flow d'`Effect.test`) ; - `choice` : DÉCISION du joueur opt-in (≠ `test` aléatoire, ≠ `if` état) → `yes` / `no`. Coût d'Avantage optionnel dépensé sur `yes`. Primitive FONDAMENTALE des réactions de combat (Frappe Réactive « vous POUVEZ tenter », Déstabilisante « vous POUVEZ dépenser 2 Av ») et, à terme, des choix de dialogue/pièges. Son exécuteur (`resolveFlowChoice`) pousse une étape-choix GÉNÉRIQUE `triggeredChoice` (`pushCombatStep` yes/no + applier unique) — il n'invente pas de mécanisme.

| `kind` | Champs | Rôle |
|---|---|---|
| `seq` | `steps` | — |
| `do` | `effect` | — |
| `if` | `cond`, `then`, `else?` | — |
| `test` | `test`, `success`, `fail` | — |
| `choice` | `prompt`, `advantageCost?`, `icon?`, `yes`, `no?` | — |

_5 entrées — dérivées de `src/engine/flowCore.ts`._

## EffectTrigger — les déclencheurs d'effet

DÉCLENCHEUR d'un effet « sur événement » — le pendant du « au lancement » des sorts. Partagé par TOUT porteur d'effets déclenchés (Trait de créature, Atout d'arme, Talent…). `onHit` : après une touche réussie (du porteur ou de l'arme) ; `onWoundLoss` : quand le porteur PERD des PB ; `onRoundStart` : au début de son Round ; `onStartled` : magie / bruit fort ; `onKill` : adversaire mis hors de combat ; `onGainCondition` : le porteur vient de GAGNER un État (filtré par `condition` — Mâchoires d'acier : « chaque fois que vous gagnez un État Sonné »). `onWoundLoss` se produit pour TOUTE perte de PB (mêlée OU distance) ; le TYPE d'attaque voyage dans le contexte (`attackType`) et un effet peut s'y restreindre via son champ `attackType`. `onSlain` : le porteur vient d'être mis HORS DE COMBAT, par n'importe quel chemin de mort (0 PB, Critique létal — démembrement —, mort-auto du désespéré, mort lente). Émis UNE fois (garde `slainNotified`). Couvre le « démon banni à sa mort » (Démoniaque, LDB 85 l.98) et tout futur effet « à la mort ». Cycle de vie du COMBAT (au point de hook correspondant — cf. `combatHooks`) : `onCombatStart` (le combat débute), `onCombatEnd` (le combat se résout, AVANT l'écran de victoire), `onRoundEnd` (fin de Round, après l'entretien), `onTurnStart`/`onTurnEnd` (début/fin du tour du porteur). Cycle de l'HORLOGE de campagne (émis par `state/clockHooks`, au franchissement de jour de `runDailyUpkeep`) : `onDayStart` — une fois par JOUR calendaire franchi, rattrapage compris (trois jours sautés = trois émissions) ; `onWake` — au RÉVEIL, c'est-à-dire le jour d'une nuit JOUÉE (`lastNightDay`) seulement : une avance d'horloge de 24 h sans sommeil ne l'émet pas.

Valeurs du champ `trigger` d'un `TriggeredEffect`, dispatchées par `fireTriggers` (`src/state/triggeredEffects.ts`).

| Déclencheur | Rôle |
|---|---|
| `onHit` | — |
| `onCrit` | — |
| `onWoundLoss` | — |
| `onSlain` | — |
| `onRoundStart` | — |
| `onStartled` | — |
| `onKill` | — |
| `onCharged` | — |
| `onGainCondition` | — |
| `onCombatStart` | — |
| `onCombatEnd` | — |
| `onRoundEnd` | — |
| `onTurnStart` | — |
| `onTurnEnd` | — |
| `onDayStart` | — |
| `onWake` | — |
| `onAttackResolved` | — |
| `onCastResolved` | — |
| `onMiscast` | — |
| `onOwnTestFailed` | Le PORTEUR vient d'ÉCHOUER un Test (n'importe lequel : combat, scène, entretien) — `ctx.margin` = le DR de l'échec (négatif). |

_20 entrées — dérivées de `src/engine/flowCore.ts`._

## EffectTargeting — la ou les cibles d'un effet déclenché

CIBLE(S) d'un effet déclenché : le porteur (`self`), la victime touchée (`victim`), les adversaires Engagés (`engaged`), les adversaires que le porteur EMPOIGNE actuellement (`grappled`, = ses `grapplingWith` — la « victime absorbée » de l'Absorption pour la digestion/redirection), ou — géométrie — TOUS les combattants à `radiusMeters` d'un centre (l'arc d'Azyr : `{ near: 'victim', radiusMeters: 2 }`). Le centre lui-même et le porteur sont exclus. `{ pick: 'engaged', ... }` : SÉLECTIONNE jusqu'à `max` adversaires Engagés non encore empoignés, les plus PROCHES d'abord, de Taille ≤ la sienne si `sizeAtMost:'self'` — la capacité restante tient compte des `grapplingWith` déjà tenus (« elle absorbe un adversaire », Absorption EDO 11 l.222). Réutilisable par tout effet « happe le plus proche petit ennemi engagé ».

Valeurs du champ `on` d'un `TriggeredEffect`.

| Cible | Champs | Rôle |
|---|---|---|
| `self` | — | — |
| `victim` | — | — |
| `engaged` | — | — |
| `grappled` | — | — |
| `{ near … }` | `radiusMeters` | — |
| `{ pick … }` | `sizeAtMost?`, `max` | — |

_6 entrées — dérivées de `src/engine/flowCore.ts`._
<!-- sources-empreinte: 9c37b0db2896af6ad7b0be8ac6506718eb116ef6 (671 fichiers, 16 dossiers) corps: caa4a0cce0a9f4e7668a035a7800946536d1acd8 -->
