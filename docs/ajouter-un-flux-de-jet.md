# Ajouter un flux de jet (« une situation = une modale »)

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-flux-de-jet.mjs` (`npm run docs:flux-de-jet`) — NE PAS ÉDITER À LA MAIN.

**Périmètre mesuré / angles morts** — sont DÉRIVÉS à chaque génération : les 10 membres de
`RollVerb` (`src/state/flowVerbs.ts:26`), les 40 entrées de `FLOW_VERBS` avec leur ligne,
leur type, leurs verbes, leur porteur de jet et leurs actions de résolution, la confrontation au
registre des modales (`src/state/modalArbiter.ts`, 31 clés déclarées), les 9
fabriques/lentilles partagées et les 4 atomes obligatoires (lus dans la garde
anti-dérive, jamais recopiés), et les 5 gardes avec l'intitulé de leur
`describe(...)`. **Angles morts** : ce doc dit COMMENT poser un flux, pas d'où partent les jets
existants (`docs/registre-jets.md`) ni comment chaque consommateur remplit la coquille
(`docs/usages-jets.md`) ; le CONTENU d'un résolveur métier (ce que `xConfirm` applique) n'est
dérivable d'aucun registre — c'est la règle du jeu ; les interdits et l'ordre des étapes sont de
l'ÉDITORIAL fixé dans le script.

Tout jet différé suit le MÊME cycle de vie et passe par la MÊME fabrique. **Aucun flux ne recode la
mécanique (RNG / Chance / Résilience / Résistance) dans son propre closure** — il ne déclare que sa
FORME.

## 0. Le cycle de vie

Les verbes du cycle sont l'union `RollVerb` (`src/state/flowVerbs.ts:26`) :

`roll` · `reroll` · `bonusSL` · `darkPact` · `forceSuccess` · `setForcedRoll` · `resist` · `determine` · `cancel` · `reverse`

> Les verbes du cycle de jet différé (cf. `RollFlowHandlers`).

Source unique de la plomberie : `makeRollFlow` (`src/state/rollFlowFactory.ts:529`).
Elle centralise gardes, dépense de points et re-rendu ; le flux ne fournit que sa forme.
**« Appliquer » (`<flux>Confirm`) reste écrit à la main** — ses effets sont la règle métier, pas de
la plomberie.

## 1. Le registre des flux — `FLOW_VERBS`

`FLOW_VERBS` (`src/state/flowVerbs.ts`) est la **SOURCE UNIQUE** du câblage : elle porte, par flux, son type et
le sous-ensemble de verbes exposés. Le type `RollFlowActionsMap` en est DÉRIVÉ et `GameState`
l'étend — ajouter ou retirer un verbe ici est **bidirectionnel** : l'oublier ailleurs casse `tsc`.
`FLOW_HANDLERS` (`src/state/rollFlowSpecs.ts`) y associe le handler, avec exhaustivité garantie
(40 entrées dans `FLOWS`, 40 dans `FLOW_HANDLERS`).

### Flux MONO (29)

Un flux mono déclare son **porteur du jet** (`jetOwner`) : l'acteur dont les verbes DÉPENSENT les
ressources. C'est obligatoire — aucun repli silencieux sur le propriétaire de la fenêtre.

| Flux | Déclaré | Porteur du jet | Verbes | Modale (`auto`) |
|---|---|---|---|---|
| `attack` | `src/state/flowVerbs.ts:77` | `pendingAttack.attackerId` | `reroll`, `bonusSL`, `darkPact`, `cancel`, `forceSuccess`, `setForcedRoll`, `reverse` | — |
| `defense` | `src/state/flowVerbs.ts:78` | `pendingDefense.defenderId` | `roll`, `reroll`, `bonusSL`, `darkPact`, `forceSuccess`, `setForcedRoll`, `reverse` | — |
| `cast` | `src/state/flowVerbs.ts:79` | `pendingCast.casterId` | `reroll`, `bonusSL`, `darkPact`, `forceSuccess`, `setForcedRoll` | — |
| `disengage` | `src/state/flowVerbs.ts:80` | `pendingDisengage.moverId` | `reroll`, `bonusSL`, `darkPact`, `forceSuccess`, `setForcedRoll` | — |
| `auContact` | `src/state/flowVerbs.ts:84` | `pendingAuContact.moverId` | `reroll`, `bonusSL`, `darkPact`, `forceSuccess`, `setForcedRoll` | `choice` |
| `grapple` | `src/state/flowVerbs.ts:85` | `pendingGrapple.actorId` | `reroll`, `bonusSL`, `darkPact`, `forceSuccess`, `setForcedRoll` | `choice` |
| `trample` | `src/state/flowVerbs.ts:86` | `pendingTrample.attackerId` | `roll`, `reroll`, `bonusSL`, `darkPact`, `forceSuccess`, `setForcedRoll` | — |
| `battement` | `src/state/flowVerbs.ts:87` | `pendingBattement.attackerId` | `roll`, `reroll`, `bonusSL`, `darkPact`, `forceSuccess`, `setForcedRoll` | `self` |
| `distraire` | `src/state/flowVerbs.ts:88` | `pendingDistraire.moverId` | `roll`, `reroll`, `bonusSL`, `darkPact`, `forceSuccess`, `setForcedRoll` | `self` |
| `maneuver` | `src/state/flowVerbs.ts:91` | `pendingManeuver.attackerId` | `roll`, `reroll`, `bonusSL`, `darkPact`, `forceSuccess`, `setForcedRoll` | `self` |
| `run` | `src/state/flowVerbs.ts:92` | `pendingRun.combatantId` | `roll`, `reroll`, `bonusSL`, `forceSuccess`, `setForcedRoll`, `darkPact` | `self` |
| `fall` | `src/state/flowVerbs.ts:94` | `pendingFall.combatantId` | `roll`, `reroll`, `bonusSL`, `forceSuccess`, `setForcedRoll`, `darkPact` | `choice` |
| `reload` | `src/state/flowVerbs.ts:95` | `pendingReload.actorId` | `roll`, `reroll`, `bonusSL`, `darkPact`, `forceSuccess`, `setForcedRoll` | `self` |
| `handGate` | `src/state/flowVerbs.ts:96` | `pendingHandGate.attackerId` | `roll`, `reroll`, `bonusSL`, `darkPact`, `forceSuccess`, `setForcedRoll` | `self` |
| `recover` | `src/state/flowVerbs.ts:97` | `pendingStateRecovery.actorId` | `roll`, `reroll`, `bonusSL`, `darkPact`, `forceSuccess`, `setForcedRoll` | — |
| `focus` | `src/state/flowVerbs.ts:98` | `pendingFocus.casterId` | `roll`, `reroll`, `bonusSL`, `darkPact`, `forceSuccess`, `setForcedRoll` | `self` |
| `dispel` | `src/state/flowVerbs.ts:101` | `pendingDispel.casterId` | `roll`, `reroll`, `bonusSL`, `darkPact`, `forceSuccess`, `setForcedRoll` | `self` |
| `frenzy` | `src/state/flowVerbs.ts:102` | `pendingFrenzy.combatantId` | `roll`, `reroll`, `forceSuccess`, `setForcedRoll`, `darkPact` | `self` |
| `approach` | `src/state/flowVerbs.ts:103` | `pendingApproach.combatantId` | `roll`, `reroll`, `forceSuccess`, `setForcedRoll`, `darkPact` | `self` |
| `ward` | `src/state/flowVerbs.ts:104` | `pendingWard.attackerId` | `roll`, `reroll`, `forceSuccess`, `setForcedRoll`, `darkPact` | `self` |
| `heal` | `src/state/flowVerbs.ts:107` | `pendingHeal.healerId` | `roll`, `reroll`, `bonusSL`, `darkPact`, `forceSuccess`, `setForcedRoll` | `self` |
| `surgery` | `src/state/flowVerbs.ts:108` | `pendingSurgery.healerId` | `roll`, `reroll`, `bonusSL`, `darkPact`, `forceSuccess`, `setForcedRoll` | — |
| `corruption` | `src/state/flowVerbs.ts:109` | `pendingCorruption.heroId` | `roll`, `reroll`, `bonusSL`, `darkPact`, `forceSuccess`, `setForcedRoll`, `resist` | `self` |
| `test` | `src/state/flowVerbs.ts:113` | `pendingTest.actorId` | `roll`, `reroll`, `bonusSL`, `darkPact`, `forceSuccess`, `setForcedRoll`, `determine`, `cancel`, `reverse` | — |
| `steamSave` | `src/state/flowVerbs.ts:114` | `pendingSteamSave.actorId` | `roll`, `reroll`, `bonusSL`, `darkPact`, `forceSuccess`, `setForcedRoll` | `self` |
| `activity` | `src/state/flowVerbs.ts:115` | `pendingActivity.heroId` | `roll`, `reroll`, `bonusSL`, `darkPact`, `forceSuccess`, `setForcedRoll` | `hostOnly` |
| `bargain` | `src/state/flowVerbs.ts:119` | `pendingBargain.playerId` | `roll`, `reroll`, `bonusSL`, `darkPact`, `forceSuccess`, `setForcedRoll` | — |
| `appraise` | `src/state/flowVerbs.ts:120` | `pendingAppraise.actorId` | `roll`, `reroll`, `bonusSL`, `darkPact`, `forceSuccess`, `setForcedRoll` | — |
| `shanty` | `src/state/flowVerbs.ts:121` | `pendingShanty.singerId` | `roll`, `reroll`, `bonusSL`, `forceSuccess`, `setForcedRoll`, `darkPact` | `choice` |

### Flux MULTI (11)

Un flux multi déclare `pidIsActor` (à qui appartient le 1ᵉʳ argument des délégués), son ouverture
`coop` éventuelle, et ses actions de `resolution` (les actions manuscrites qui closent la fenêtre —
elles sont DÉRIVÉES dans la surface invité, jamais recopiées).

| Flux | Déclaré | `pidIsActor` | Coop | Résolution | Modale (`auto`) |
|---|---|---|---|---|---|
| `flee` | `src/state/flowVerbs.ts:83` | true | oui | `fleeConfirm` | — |
| `counterspell` | `src/state/flowVerbs.ts:122` | true | oui | `counterspellConfirm`, `counterspellCancel` | — |
| `cascade` | `src/state/flowVerbs.ts:128` | false | oui | `cascadeNext`, `cascadeResolveAll`, `cascadeFinish` | `partial` |
| `opposition` | `src/state/flowVerbs.ts:129` | true | oui | `oppositionConfirm` | — |
| `extendedTest` | `src/state/flowVerbs.ts:131` | false | oui | `extendedTestNext`, `extendedTestCancel` | — |
| `etalLot` | `src/state/flowVerbs.ts:135` | false | oui | `etalLotConfirm`, `etalLotCancel` | `self` |
| `forceDoor` | `src/state/flowVerbs.ts:136` | true | oui | `forceDoorConfirm`, `forceDoorCancel` | — |
| `shipManeuver` | `src/state/flowVerbs.ts:137` | true | oui | `shipManeuverConfirm`, `shipManeuverCancel` | `choice` |
| `shipBattery` | `src/state/flowVerbs.ts:138` | true | oui | `shipBatteryConfirm`, `shipBatteryCancel` | `choice` |
| `crewTest` | `src/state/flowVerbs.ts:139` | true | oui | `crewTestConfirm`, `crewTestCancel` | `choice` |
| `cascadeBatch` | `src/state/flowVerbs.ts:145` | true | oui | — | — |

Flux sans entrée propre dans `MODAL_DEFS` : `attack`, `defense`, `cast`, `disengage`, `flee`, `trample`, `recover`, `surgery`, `test`, `bargain`, `appraise`, `counterspell`, `opposition`, `extendedTest`, `forceDoor`, `cascadeBatch` — normal quand le flux est une ÉTAPE d'une cascade (l'entrée de cascade porte déjà la fenêtre), fautif sinon.

## 2. La recette — 1 spec + 1 confirm

1. **Type du pending** : `Pending<X> extends PendingBase` (`src/state/rollFlowFactory.ts` porte
   `PendingBase` et ses champs hérités). Déclarer le slot dans `GameState`.
2. **Entrée dans `FLOWS`** (`src/state/rollFlowSpecs.ts`) : `makeRollFlow({ key, rolled, actor, resolve, outcome, … })`.
   **Réutiliser les fabriques partagées** (§3) plutôt que réécrire les branches à la main.
3. **Entrée dans `FLOW_VERBS`** (`src/state/flowVerbs.ts`) : type, verbes, et le porteur (`jetOwner`) ou
   `pidIsActor`/`resolution`. Puis l'entrée jumelle dans `FLOW_HANDLERS` — l'exhaustivité est
   forcée à la compilation.
4. **`<flux>Confirm` / `<flux>Cancel` écrits à la main** dans la tranche de store du domaine : lire le
   résultat, appliquer les effets métier (par `GameOp` si l'effet est un octroi / un soin / des
   dégâts), nuller le pending, et faire avancer la cascade hôte si le jet en est une étape — jamais
   une 2ᵉ fenêtre séparée.
5. **Ouvrir le pending** depuis le site d'origine ; si le jet est une étape de combat, l'ouvrir comme
   une étape de cascade, pas comme une fenêtre isolée.
6. **Registre des modales** (`src/state/modalArbiter.ts`) — SEULEMENT si le flux n'est pas une étape d'une cascade
   déjà déclarée. La politique de Cadence (`auto`) est REQUISE.

## 3. Fabriques et lentilles PARTAGÉES — à réutiliser avant d'écrire une branche

| Primitive | Site | Rôle (JSDoc) |
|---|---|---|
| `makeRollFlow` | `src/state/rollFlowFactory.ts:529` | Fabrique UNIQUE des flux de jet (mono ET multi). |
| `testOutcome` | `src/state/rollFlowSpecs.ts:302` | Issue d'un Test dont le résultat est déjà un `{ success, sl }` (jet simple ou opposé résolu) : la réussite RÉELLE + son Degré. |
| `cleanRollOutcome` | `src/state/rollFlowSpecs.ts:312` | Issue d'un Test dont le résultat est un `{ roll, target, sl }` SANS champ `success` (réussite propre = `roll ≤ cible`) : incantation, enfoncement de porte, Test d'équipage — un résultat absent = échec. |
| `flatRollLens` | `src/state/rollFlowSpecs.ts:349` | Lentille PARTAGÉE des Tests PLATS (le jet vit au niveau du pending : `roll`/`target`/`sl`/`success`) — `actorTR` reconstruit le TestResult, `applyRoll` re-projette roll/sl/success (identiques d'un flux à l'autre) ; seul `dieTarget` (cible du dé forcé ; `null` = déjà réussi → rien à forcer) varie. |
| `resultRollLens` | `src/state/rollFlowSpecs.ts:359` | Lentille PARTAGÉE des Tests dont le jet vit sous `p.result` (`{ roll, target, sl, success }`) — même `actorTR`/`applyRoll` que `flatRollLens` mais imbriqués sous `result` ; seul `dieTarget` varie (Chanson/Dissipation). |
| `opposedBinaryFlow` | `src/state/rollFlowSpecs.ts:373` | Fabrique PARTAGÉE des Tests opposés BINAIRES (issue success/tie/fail) où SEUL le jet de l'ACTEUR se (re)joue tandis que le foe reste FIGÉ — le jet de l'acteur est l'« attaquant » du Test opposé (`resolveOpposed`/`disengageOutcome`). |
| `rollFlowActions` | `src/state/rollFlowSpecs.ts:211` | Délégués MONO d'un flux : les verbes listés, byte-identiques aux anciens `() => FLOWS.x.m(get, set)`. |
| `rollFlowActionsMulti` | `src/state/rollFlowSpecs.ts:224` | Délégués MULTI d'un flux : `pid` en tête, byte-identiques aux anciens `(pid) => FLOWS.x.m(get, set, pid)`. |
| `buildRollFlowActions` | `src/state/rollFlowSpecs.ts:2164` | Assemble les ~113 délégués de jet du store (`<prefix><Verbe>`) depuis `FLOW_VERBS` + `FLOW_HANDLERS` — remplace les 40 spreads `rollFlowActions(Multi)` éparpillés dans le store. |

Le résolveur d'un flux est **UN SEUL** `resolve` pour tous les cas : jet normal (RNG), réussite
forcée par défaut, dé CHOISI par le joueur, et DR imposé par la Résistance. Un flux qui n'expose pas
la capacité correspondante n'offre simplement pas l'influence — les branches sont alors inertes.

## 4. La modale = `RollShell` paramétrée

`RollShell` est LA coquille unique : contrôles en PROPS, métier en SLOTS. Écrire un hook
`use<Jet>JetProps` (`src/ui/jetProps/`) qui lit le store et rend les props ; la modale ne fait que
l'appeler. Quelles zones chaque consommateur remplit aujourd'hui : `docs/usages-jets.md` (généré).
**Ne jamais réécrire un bouton « Lancer »/« Relancer » à la main** dans une modale.

## 5. Les atomes OBLIGATOIRES

La garde anti-dérive (`src/state/rollflow-no-drift.test.ts`) exige la présence de ces atomes dans le registre des flux — cette
liste est LUE dans la garde, jamais recopiée ici :

| Atome | Site | Rôle (JSDoc) |
|---|---|---|
| `bumpSL` | `src/engine/tests.ts:317` | Influence « +`by` DR » sur un jet DÉJÀ résolu (Chance, LDB 17 l.24 ; bonus de Piège-lame, LDB 62) : renvoie une copie du `TestResult` avec son Degré de Réussite augmenté, pour le RÉ-opposer ou le réappliquer. |
| `bestForcedRoll` | `src/engine/tests.ts:157` | Le dé qui MAXIMISE le DR d'une réussite FORCÉE (« Je ne faillirai pas ! », LDB 17 l.68 : on choisit le résultat → LE MEILLEUR), selon le `slMode` — car le meilleur jet DÉPEND de la policy : - **fast** (DR = dizaines du jet, LDB 12 l.102) → le jet valide le PLUS HAUT (`maxForcedRoll` : dizaines max) ; - **standard** (DR = différence de dizaines) → **01** (le plus bas → dizaines de la cible). |
| `forcedTR` | `src/engine/tests.ts:325` | `TestResult` d'une réussite FORCÉE (Résilience « Je ne faillirai pas ! » LDB 17 l.68 / Résistance Menace LDB 10) au dé `roll`, DR `sl` imposé. |
| `hydrateTR` | `src/engine/tests.ts:335` | `TestResult` RE-HYDRATÉ depuis un détail de jet stocké (RollBreakdown/attackerDetail/étape de cascade…) : ajoute `isDouble` dérivé du dé. |

## 6. Interdits

- **Aucun `rollTest` inline sur le chemin JOUEUR.** Un Test qui affecte un combattant piloté par un
  humain DOIT ouvrir un pending influençable — jamais résolu en silence dans un résolveur métier. Le
  choke-point est le PRÉDICAT DE CONTRÔLEUR, jamais le `kind` de l'entité.
- **Aucune 2ᵉ fenêtre de conséquences.** Un jet et sa conséquence immédiate (Coup Critique,
  Maladresse…) vivent dans LA MÊME modale, par la cascade — jamais une fenêtre « Résultat » qui
  s'ouvre après la fermeture de la modale de jet.
- **Aucune mécanique d'influence recodée localement** (dé forcé en dur, « +1 DR » qui force le
  succès, littéral de résultat recopié) : passer par les atomes du §5.

## Gardes

| Garde | Ce qu’elle verrouille (son propre `describe`) |
|---|---|
| `src/state/rollFlowWiring.test.ts` | câblage des flux de jet — source unique FLOW_VERBS |
| `src/state/rollflow-no-drift.test.ts` | Anti-dérive du système de jet — tout passe par la fabrique + les atomes partagés |
| `src/state/maneuver-defense-cascade.test.ts` | Défense de manœuvre de zone — cascade influençable (héros) vs silence (IA) |
| `src/state/jet-owner-vs-spec.test.ts` | #1015 — le porteur déclaré (`FLOW_VERBS.jetOwner`) EST l’acteur que le flux débite |
| `src/ui/active-modal.test.ts` | pickActiveModalKey — priorité des modales de combat |

`npm run typecheck` après tout ajout : le type dérivé de `FLOW_VERBS` casse immédiatement si le
registre et les handlers divergent.
<!-- sources-empreinte: f284a69914fc4a2046e0a44c6ddf7a23d144c487 (14 fichiers, 0 dossiers) corps: 4711c3823e317c0aa03f21b8c3c71bcc0ae98048 -->
