import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { runSetScan } from '../../scripts/guards/lib/setScan.mjs';

/**
 * Garde-fou « set() bruts des flows » (#321 lentille 3, cliquet baseline patron `scripts/guards/lib/`) :
 * fige l'AGRÉGAT de `set({...})` de `src/state/*.ts` (hors `store.ts`/`stateFields.ts`) qui réinitialisent
 * un champ `STATE_FIELDS` (pending*) DIRECTEMENT, hors `...resetFields(...)`. MESURE globale, PAS un
 * verrou par-fichier : la majorité
 * de ces sites sont des fermetures de modale LÉGITIMES (chaque flow ferme sa propre pending — cf. chasse-2
 * « cœur des set() sains ») ; ce cliquet borne la CROISSANCE non revue plutôt que d'exiger un helper
 * `clearPending` immédiat (aucune correction faite dans cette passe). Baseline gelée au recensement
 * (2026-07-11) : 689 set() / 280 resets ad hoc directs ; +1 set() légitime (voyage : l'applier de poste
 * SCINDÉ en `stagePoste` sans-Test + `stagePosteBatch` pour le pas batch des postes — chacun ré-émet le
 * groupe) ; +2 set() légitimes (#327 lot D : `spoilVesselCargoOnLeak` persiste la voie d'eau sur
 * `vessel.cargo`, et l'applier de soumission de la Cogue pirate y persiste le pillage — SOURCE UNIQUE).
 * +6 set() légitimes (#340 : budget d'heures PAR JOUR CALENDAIRE + portes de départ + nuit forcée —
 * `travelFlow` accumule le budget du jour `addTravelHoursToday`/`markMarchedToday`, pose/lève la porte
 * `pendingDeparture` ; `restFlow` marque la nuit jouée `lastNightDay` ×2) ; +2 resets ad hoc (la porte
 * `pendingDeparture` posée puis effacée à « Attendre l'aube »/au départ diurne — transient de carte).
 * +1 set() légitime (#341 : l'applier `weatherResistance` ré-émet le groupe après l'Exténué de traversée
 * Neige/Blizzard — MÊME patron que `stagePosteBatch`).
 * +3 set() légitimes (#344 : l'Exposition hydrique fluviale surfacée APRÈS le jour DIFFÈRE la halte de
 * nuit — `continueRiverDayAfterCascade` re-tague la cascade en `riverExposure` + fige la progression du
 * jour ; `continueRiverDayAfterExposure` efface ce transient puis reprend la fin du jour) ; +1 reset ad hoc
 * (`travelPlan: null` de garde quand la route/destination a disparu à la reprise post-Exposition).
 * +1 set() légitime (abordage GÉNÉRIQUE dérivé d'un navire hostile : `openGenericBoarding` INTERROMPT la
 * traversée + efface `sea.boarding` avant de transitionner vers la Scène d'abordage construite à la volée).
 * +2 set() légitimes (#341/#253 : `stampEnvWeatherAtCombatStart` estampille la météo du jour sur les
 * combattants à l'ouverture — SOURCE du canal « Tests physiques » ; `openCombatEndCascade` VIDE la file
 * `deferredUpkeepQueue` après consommation des Tests d'entretien différés) ; +1 reset ad hoc (ce
 * `deferredUpkeepQueue: []` = vidage de la file per-combat, jamais rejouée).
 * +1 set() légitime (#351 : `runCascadeImmediate` S'ARRÊTE et SURFACE `pendingCascade` sur un CHOIX sans
 * `defaultChoice` authoré — patron `resolveRemainingCascade`, jamais un `options[0]` silencieux) ; +1 reset
 * ad hoc (même site : pose directe de `pendingCascade`).
 * +1 set() légitime (#474a Se cabrer : `aiCreatureFreeAttacks` dépense l'Action de Mouvement
 * (`movementUsed = mountMovement`) AVANT `applyFreeAttack`, LDB 85 l.314 — coût distinct du `campSpend`
 * d'Avantage porté par `applyFreeAttack`, donc son propre `set()`).
 * +1 set() légitime (#558 : `castSetChosenTableRolls` pose `pendingCast.chosenTableRolls` — le jet sur
 * Tableau est DÉCLINABLE, EDOC 13 l.276 — même patron que `castAllocOvercast` déjà compté).
 * +1 set() légitime (#942 L5 : l'applier `mutationTable` re-émet les acteurs — `touchActors` — quand la
 * mutation est appliquée depuis un dé POSÉ, même patron que `resolveCorruption` pour le chemin inline).
 * +2 set() légitimes (#942 L7 : le dénouement d'un Événement d'interlude est PARTAGÉ par les deux
 * chemins — `finishInterludeEvent` persiste le héros résolu, `finishInterludeDraw` ouvre les Activités
 * après le dernier dé ; l'ouverture écrit seulement un état de phase `tirage`).
 * +4 resets ad hoc (#1135 / 30614b3b, résolution PARTAGÉE du déplacement) : `hoverDelta` (jauges EN
 * DIRECT du survol, `gameIso/stage/useHoverTargeting.ts`) est un transient de VUE remis à null par le
 * MÊME `set()` qui réécrit `battle.preview` — un seul cadre de rendu, sinon la jauge survit à l'aperçu
 * qu'elle chiffrait. Hors portée de `resetFields(scope)` : ses deux scopes sont des CADRES (`scene`,
 * `combatStart`), et `hoverDelta` porte `resetOn: []` (`stateFields.ts`) — un scope par geste de souris
 * casserait l'invariant du manifeste. Sites : `combatSlice.ts:846` (clic hors de toute portée : purge de
 * l'aperçu), `:883` (tap 1 zone de Course), `:893` (tap 1 aperçu de Marche), `:915` (commit du segment,
 * l'acteur a bougé). Les trois autres sites `hoverDelta` du même commit (`battleRun` 1223, `runConfirm`,
 * `runCancel`) étaient DÉJÀ comptés par leur `pendingRun` : ils n'ajoutent rien.
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
// +1/+1 (#1657 B3-1b, mesure exacte 747/302) : `openCombatEndCascade` POSE `combatEndBoundary` sur la
// cascade RÉELLEMENT ouverte — un Test d'amputation différée (LDB 18 l.171), routé par la porte, peut
// l'avoir ouverte à lui seul (`startCascade` renonce sur une liste d'étapes vide) ; sans cette pose, sa
// fermeture rappellerait `openCombatEndCascade` et rejouerait l'Exposition à la Corruption. Le « reset »
// compté est la repose du pending entier, pas une purge (`src/state/crit-test-porte.test.ts` (vii) le verrouille).
// +1 totalCalls (#717, mesure exacte 746/301) : `chapitreRecap.armChapterRecapIfDue` POSE le récap de
// fin de chapitre quand la clôture authorée devient vraie — UN site pour tous les lots d'effets (la
// couture est appelée en pied d'`applyEffects`), aucun reset de cadre : la borne `chapitreDepuis` et
// l'archive `objectifsSoldes` se reposent dans le store, hors périmètre de ce scan.
// +2 totalCalls (#1657 B3-2, mesure exacte 749/302) : SOLDE NET du coup à l'ÉQUIPAGE d'un Critique
// de coque passé par la porte. `applyBoatCritical` (fleuve) et `applyVesselCritical` (mer) reflètent
// chacun la mutation du groupe DEUX fois : après la conséquence CERTAINE (MSRC 07 l.82, appliquée par
// `applyCrewHit`) et après les lignes de la voie INLINE drainées dans le journal du voyage.
// #1852 correctif 1 — 748 → 749 / 299 → 300 (le site a `pendingDefense` en clé de niveau 1, il compte
// donc aussi en reset ad hoc) : `combatFlow.runCleaveChain` PARQUE sa chaîne sur la fenêtre de défense
// VIVANTE rencontrée en tête de boucle au lieu de frapper par-dessus — LDB 85 l.41-43 : une frappe se
// résout entièrement, fenêtre du défenseur comprise, avant que la suivante soit déclarée.
// −2/−2 (#1858 lot 1, mesure exacte 747/298) : CE QUE LA FENÊTRE DE DÉFENSE FERA À SA FERMETURE entre
// PAR LE HAUT — le producteur le déclare dans le littéral qui POSE `pendingDefense` (`suite`), là où le
// maillon de balayage et l'attaque figée demandaient chacun un `set()` sur un pending déjà posé.
const BASELINE = { totalCalls: 747, totalAdHocResets: 298 }; // +1 (#1117 L3 : `registerNightBandApplier` — le set() de persistance du groupe après la boucle PAR RANGÉE, écrit UNE fois pour les 13 kinds de nuit au lieu d'un par applier) // +1/+1 (#1042/#1059 : `counterspellDeclare` RÉÉCRIT les rangées de `pendingCounterspell` — la déclaration de phase 1 vit sur le participant, comme son `result` ; le « reset » compté est cette repose du pending entier, pas une purge) ; +1/+1 (#1029 : `routeCounterspell` MARQUE le moment du Contre-sort — `pendingCast.counterspellRouted` — pour que la fenêtre s'ouvre UNE fois, au jet ou après le choix de Critique ; le reset compté est la purge de `pendingCounterspell` par `castCancel` pré-jet, #1031 : plus de fenêtre orpheline) ; +4/+3 (#989 surfaçage de la défense : `openSurfacedDefense` POSE la fenêtre — une branche mêlée, une branche tir ; `runCleaveChain` accroche la chaîne de balayage PARQUÉE sur la fenêtre ; `defenseConfirm` rend l'attaque figée à `attackConfirm`) ; +1 (#352 innFlow.ts : set() du party après Exténué) ; +1 (#474a : coût Mouvement Se cabrer, aiCreatureFreeAttacks) ; +1/+1 (#476 : toggle harpoonRopeCut, set + reset du pendingAttack) ; +1/+1 (#558 : castSetChosenTableRolls) ; +1 (#508 : purgeAdventureEffects, upkeep.ts — même patron que purgeClockEffects) ; +1 (#491 : rerollWindsOfMagic, combatFlow.ts) ; +2 (#508/#510 : interludeFlow.ts — débit d'argent des résolveurs Réputation/Punchausen) ; +2 (#508 : interludeFlow.ts entrainementStart — débit du tuteur + application de l'Augmentation) ; +6 (#509 : favorFlow.ts — grantFavor/settleFavorActivity/resetInterruptedFavorProgress/breakFavor, nouveau flux) ; +1 reset ad hoc (#942 L2 : `rollCascadeTable` POSE le tirage sur table de l'étape courante dans `pendingCascade` — jumeau exact de `setCascadeChoice`, déjà compté) ; +1/+1 (#942 L3 : `setCascadeTableForcedRoll` POSE le dé de l'étape à table — seam UNIQUE des deux affordances du mode table, jumeau de `rollCascadeTable`) ; totalCalls RESSERRÉ 722 → 717 au passage de #942 L2 : le juge de design du lot a mesuré 5 de mou (des set() comptés à la pose de la baseline ont disparu depuis) — un cliquet qui garde du mou ne borne plus rien ; resets ad hoc RESSERRÉS à la mesure EXACTE au passage de #1135 (baseline 294 pour 293 réels = 1 de mou, plus les 4 sites `hoverDelta` documentés ci-dessus → 297)
// −1/−1 (#1143 : les DEUX purges du télégraphe d'intention — `set({ actorAim: null })` de
// `attackThenAdvance` et du `case 'cast'` de `runEnemyAI` — sont remplacées par la couture UNIQUE
// `clearActorAim` de `combatFlow.ts`. Elle est ancrée au SEAM de résolution d'attaque
// (entrée d'`applyAttackResult`, où naît la ligne de journal du geste) plus quatre sorties
// d'AVORTEMENT/fin de tour ; le compte de `set()` littéraux n'en bouge pas — mesure exacte 726/296).
// +3/+3 (#1117 L4 : la FILE des Tests de seuil de Corruption — `corruptionFlow`. Le slot
// `pendingCorruption` est UNIQUE et une bande de fin de combat peut faire déborder deux héros d'un
// coup : `gainCorruption` pose le seuil OU le met en file (2 sites au lieu d'1), et
// `releaseCorruptionSlot` le rend au suivant. Ces trois `set()` sont la fenêtre RENDUE à un Test RAW
// qui, avant, se roulait en silence — pas du mou. Mesure exacte 730/299).
// +1 (#1176 : `resolveManeuver` ORIENTE l'attaquant vers le centre RÉELLEMENT résolu du geste (cible
// unique, ou centre de zone recentré quand le clic est périmé) ; sans lui l'attaque spéciale de
// créature se jouait dans la dernière orientation connue. Seul l'ATTAQUANT y tourne, là où la passe
// d'armes d'`applyAttackResult` tourne AUSSI le défenseur. Mesure exacte 733).
// +1 (#1279 Sf : `setCascadeAmount` POSE le nombre saisi de l'étape « quantité » courante — jumeau
// exact de `setCascadeChoice`, 6ᵉ interaction de la coquille. Aucun reset ad hoc de plus : ce `set()`
// réécrit `pendingCascade` sans le vider. Mesure exacte 731/297).
// resets ad hoc RESSERRÉS 299 → 297 au passage de #1279 Sf : la mesure réelle est 297 depuis le
// resserrage de #1135, que le commentaire ci-dessus annonçait déjà — le cliquet gardait 2 de mou
// qu'il condamnait lui-même. Un cliquet qui ne colle pas à sa mesure ne borne plus rien.
// +1/+1 (#1279 lot final : `setSequenceCum` — la PORTE du socle de séquence sur son ACCUMULATEUR PAR
// CAMP, jumelle de `setSequencePayload` (déjà comptée). Elle existe parce qu'une étape APPENDÉE à la
// fenêtre — la sanction d'un lanceur, `SequenceParams.throwerPenalty` — compte AVANT que la manche ne
// se close, quand son applier n'a aucun verdict à rendre. Sans elle, les trois familles migrées
// (points du Torchon, buts d'équipe, marques du Cerevis) garderaient un compteur JUMEAU dans leur
// charge utile, contre l'invariant écrit du contrat. Le « reset » compté est la repose du slot
// `sequence` entier, pas une purge. Mesure exacte 732/298.
// +3 (lot INTENTIONS, spec HUD zone 4 : le mode local `localIntent` vit à la RACINE du store, hors
// `battle` — d'où trois `set()` de racine et non une mutation de la coquille de combat :
// `battleArmIntent` (arme/dissout), `consumeIntent` (le clic du champ la consomme) et la purge du
// tour qui s'achève dans `advanceTurn`, jumelle de celle du `combatCursor` juste au-dessus. Aucun
// reset ad hoc de plus : `localIntent` n'est pas un champ `pending*`. Mesure exacte 736/298).
// +3 (lot GESTES RÉVISÉS, spec HUD § ARBITRAGE 2026-08-19 : le REFUS de geste est un retour d'IHM
// LOCAL, `state.refus` à la RACINE du store comme `localIntent` — d'où `refuserGeste` (pose) et
// `eteindreRefus` (extinction différée par la bannière) ; le 3ᵉ est la purge d'APERÇU du site de refus
// d'approche (`targetingModes`), jumelle exacte des deux purges d'aperçu voisines — elle vit au site
// d'appel PARCE QUE le refus, lui, n'a aucun effet de bord sur `battle`. Mesure exacte 739/298).
// +3 resets ad hoc (#1411 : `refus` ENTRE au manifeste `stateFields` — `resetOn: ['scene',
// 'combatStart']` — et la lentille compte les clés de STATE_FIELDS, `pending*` ou non. Les trois
// sites étaient déjà là et sont inchangés : `refusVisible.ts:43` (pose du refus) et `:50`
// (extinction visée par nonce), plus `netFlow.ts:151` où `refus: mine.refus` PRÉSERVE le refus du
// client sous le snapshot de l'hôte — aucun des trois n'est un reset de cadre. Mesure exacte 739/301).
// +1 totalCalls (#1426, mesure exacte 740/301) : SOLDE NET des dés de monde routés par le canal. Le
// module partagé `authorPerils.ts` pose `travelPlan.interrupted` en UN site pour les deux flux (il en
// remplace deux : la boucle de `travelFlow` et celle de `seaVoyageFlow`), `riverVoyageFlow` fige la
// progression du jour AVANT le dé d'Exposition (le report `pendingFinish` doit exister que le dé
// ouvre une fenêtre ou non), et `landMarketFlow` écrit seulement à la vente. Aucun reset de cadre.
// +1 encore (mesure exacte 741/301) : l'applier de l'ÉVÉNEMENT DE BORD pose le compteur du prochain
// événement (`daysToEvent`) là où la résolution synchrone le posait — même écriture, autre maison.
// +2/+1 (#1426, mesure exacte 743/302) : la FENÊTRE DE LOT d'un étal — `ouvrirEtal` pose le lot de
// dés à l'ouverture, `appliquerLotEtal` le referme avant de rejouer le générateur. Le reset compté est
// cette fermeture : le pending doit être VIDE avant le rejeu, sinon le générateur qui repose l'étal
// rouvrirait la fenêtre qu'il vient de dénouer.
// +0 (ASSISE #1443 : la recomposition du groupe (retrait, remplacement, permutation) rend
// sa place au corps qui change de rang — mais la couture vit dans `store.ts`, HORS du périmètre de
// ce scan : `partyFlow.ts` n'écrit plus la scène du tout. Le geste d'assise du store n'en ajoute
// aucun non plus : sa transaction passe par le callback `set((s) => …)` — c'est ce qui la rend
// atomique — et sa libération au déplacement se FOND dans le `set` de `partyPos` qui existait déjà.
// Le cliquet est RESSERRÉ à la mesure du jour (patron #942 L2 / #1135 : un cliquet qui garde du mou
// ne borne plus rien) — resets ad hoc 302 → 301.
// Mesure exacte 743/301).
// +1 (ASSISE, même lot : `combatFlow.releaseSeatsOfDowned` — la couture UNIQUE « un corps mis hors
// d'action ne tient plus sa chaise », appelée là où la mort est ACTÉE (`notifySlain`, entretien hors
// combat d'`advanceTime`). Un `set({ scene })` littéral et CONDITIONNEL : la scène n'est réécrite que
// si un occupant est réellement tombé (sinon même référence). Aucun reset ad hoc de plus.
// Mesure exacte 744/301).
// #1508 T2 — le cliquet ne monte PAS, il se remplit : 748/301 à HEAD, 749/301 sur l'arbre, pour une
// baseline de 749/302. Le +1 de `totalCalls` est le `set((s) => …)` de `combatEffects.differerLaSuite`,
// la SEULE écriture du canal op → applier : elle confie à l'étape à dé la suite que son lot faisait
// attendre, quand cette étape est déjà dans le slot (poussée HORS application). Les étapes poussées
// PENDANT une application n'y passent pas : elles sont annotées dans la fenêtre d'insertion
// (`cascade.annoterEtapeDeLaFenetre`), sans `set`. `totalCalls` n'a donc plus de mou : le prochain
// `set` de `src/state/*.ts` fera rougir ce test, ce qui est exactement son office.
// #1612 — 749 → 750 : le `set({ party: [...get().party] })` de l'APPLIER du dé de MONDE d'une Activité
// (`activityWorldRolls.ts`, `registerCascadeApplier(ACTIVITY_WORLD_ROLL_KIND)`). `applyOps` MUTE le
// héros en place ; ce `set` est la seule ligne qui rende la mutation visible au store — MÊME patron,
// même unique écriture, que les autres appliers de cascade. Aucun reset ad hoc de plus (302 inchangé).
// #1687 lot 3-I-a — 750 → 751 : l'EXÉCUTEUR UNIQUE des gestes d'exploration (`store.jouerAction`) pose
// le dialogue d'un PNJ (`set({ dialogue })`), geste qui vivait dans `interactEntity` — lequel n'en
// porte plus aucun, il délègue. Le solde n'est pas nul parce que le ramassage en combat perd sa
// réécriture du document de scène au profit d'un drapeau (`set` INCONDITIONNEL là où il
// était dans un `else`) : même nombre de `set` écrits, un de plus qu'à HEAD. Aucun reset ad hoc de
// plus (302 inchangé).
// #1508 T3b — 751 → 749 et 302 → 300, MESURÉ (`runSetScan` sur l'arbre du lot). Ce que l'appelant fera
// APRÈS le coup est une DONNÉE d'entrée (`SuiteDeCoup`) qui voyage dans la charge de chaque fenêtre :
// elle n'ajoute aucune écriture. Le solde, PAR APPEL :
//  - RETIRÉS face à HEAD : `combatSlice.attackConfirm` ne pose plus `pendingDualStrike` (l'ouverture de
//    la 2ᵉ frappe est dans la queue partagée) ; `combatSlice.defenseConfirm` ne rend plus l'Action d'une
//    frappe gratuite (idem) ; `combatFlow.applyFreeAttack` et `combatFlow.applyTalentFreeAttack` perdent
//    chacun leur `set({ acted: prevActed })` inline, remplacé par l'appel à la queue — soit QUATRE ;
//  - AJOUTÉS : les DEUX `set` de `combatFlow.jouerLaSuiteDuCoup` (l'Action rendue à une frappe gratuite
//    après le `markActed` de l'application ; l'ouverture de la 2ᵉ frappe du Maniement de deux armes),
//    ÉCRITURE UNIQUE appelée par `attackConfirm`, `defenseConfirm`, la reprise de suspension et les deux
//    résolveurs de frappe gratuite.
// Net −2 (751 → 749). Le `switch` sur `SuiteDeCoup.enchainement` n'écrit rien : il ROUTE.
// Resets ad hoc 302 → 300 : −1 pour la mesure qui portait 1 de mou depuis #1135 (301 réels), −1 parce
// que la fermeture de la cascade-hôte du Tir rapide d'INTERRUPTION n'est plus un `pendingCascade: null`
// littéral et inconditionnel — elle est CONDITIONNÉE au fait que le coup n'ait pas été suspendu (une
// sauvegarde poussée DANS cette cascade y serait détruite avec le coup). La baseline se RESSERRE sur la
// mesure EXACTE : un cliquet qui garde du mou ne borne plus rien.
// #1508 T3b-1 — baseline INCHANGÉE (749/300), solde NET NUL, mesuré par `runSetScan` sur l'arbre du lot
// (`src/state/combatFlow.ts` 110 `set` · `src/state/combatLog.ts` 1) :
//  - AJOUTÉ : le `set({ battle: { …log } })` de `combatLog.journaliser`, ÉCRITURE UNIQUE du routage
//    « en combat → `battle.log`, sinon `state.journal` » (consommateurs : `cascade.commitStep`,
//    `combatFlow.finishPlayerAction`, `combatFlow.castRefused`) ;
//  - RETIRÉ : le `set({ battle: { …log } })` à la main de `combatFlow.castRefused`, qui devient un appel
//    au helper. `finishPlayerAction` est à SOLDE NUL : son `set` restant porte seulement la
//    consommation de l'Action (`action: null` / `selectedSpellId: null`) — le journal part au helper, le
//    drain de `pendingLogQueue` reste au site et lui est passé en `extra`.
// Aucun reset ad hoc de plus (300 inchangé) : le helper n'écrit aucun champ `pending*`.
// — puis 749 → 748, MESURÉ (`runSetScan` sur l'arbre du lot) : `corruptionFlow.resolveRenounce` route
//   la conséquence de « Je te renie ! » (LDB 17 l.67) par `combatLog.journaliser` au lieu de réécrire
//   à la main le couple `if (battle) set({ battle: {…log} }) else get().log(…)` — un `set` littéral de
//   moins, et le routage a seulement UNE définition. BASELINE = la mesure (748/300), sans mou.

describe('garde-fou set() bruts des flows (agrégat)', () => {
  it("le nombre total de set() littéraux détectés dans src/state/*.ts ne dépasse pas la baseline", () => {
    const { totalCalls } = runSetScan(ROOT);
    expect(
      totalCalls,
      `Croissance des set() de src/state/*.ts (${BASELINE.totalCalls} → ${totalCalls}) — revoir le nouveau flux puis AJUSTER la baseline de ce test si légitime`,
    ).toBeLessThanOrEqual(BASELINE.totalCalls);
  });

  it("le nombre de set() qui réinitialisent un champ STATE_FIELDS hors resetFields(...) ne dépasse pas la baseline", () => {
    const { totalAdHocResets } = runSetScan(ROOT);
    expect(
      totalAdHocResets,
      `Croissance des resets ad hoc de champ pending* (${BASELINE.totalAdHocResets} → ${totalAdHocResets}) — un nouveau site direct hors resetFields(...) : envisager le helper partagé, sinon AJUSTER la baseline`,
    ).toBeLessThanOrEqual(BASELINE.totalAdHocResets);
  });
});
