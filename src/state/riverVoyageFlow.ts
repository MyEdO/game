/**
 * VOYAGE FLUVIAL jour par jour (**Mort sur le Reik — Compagnon, ch.5** « Navigation fluviale », cité
 * `MSRC 7 l.<ligne>`) — la descente d'un fleuve en barge, JOUÉE au lieu d'être un simple transport payant.
 *
 * RÉUTILISATION (pas de duplication de la machinerie de voyage) : ce flux est le PENDANT FLUVIAL de
 * `seaVoyageFlow` (mer, MDG). Comme lui, il s'appuie sur la machinerie de voyage EXISTANTE — halte de nuit
 * (`openRest`), entretien quotidien (`runDailyUpkeep`), coque de trajet PERSISTÉE au coup par coup
 * (`damageVesselHull`/`healVesselHull`, #296 — SOURCE UNIQUE `vessel.wounds`), récap du jour
 * (`TravelRecapDay`) — et n'écrit QUE la résolution navale du jour. Il ne réimplémente ni la boucle de
 * nuit, ni l'entretien, ni la persistance.
 *
 * DISTINCT de la mer (choix de fidélité, pas de raccourci) : MSRC 7 est un système PROPRE, plus simple que
 * MDG. Le Test de Navigation fluvial est le **barreur seul** (Voile) ou le **meilleur rameur** (Ramer), un par
 * étape (l.11-15) — PAS un Test d'équipage MDG (rôles multiples, Moral, rôle essentiel doublé, manque de bras :
 * rien de tout cela dans MSRC). On le résout donc comme le sibling maritime résout SON test de barreur unique
 * (Forcer le rythme) : INLINE, meilleur pilote avec Soutien (LDB 12, `partyAssisted`), remonté dans le récap de
 * la halte de nuit — la même présentation que les jets de bord du voyage maritime. La table des vents, l'Agilité
 * de rame, le chavirage et les Critiques de bateau sont propres au fleuve (`engine/riverNavigation.ts`).
 *
 * EXPOSITION HYDRIQUE (MSRC 16) : la descente EXERCE l'Effet EXISTANT `waterExposure` — un tirage d'auteur
 * par étape (`MapRoute.riverExposure`) qui, via `applyEffects`, ouvre la cascade de Test de Résistance →
 * maladie. RÉUTILISE le canal d'Effet (aucune mécanique neuve) : le moteur de tables hydriques et l'Effet
 * étaient déjà là (`engine/waterExposure.ts`), seule leur MISE EN SCÈNE dans le voyage manquait.
 */
import type { PlayerText } from '../i18n/playerText';
import { battleRng } from './battleRng';
import { minutesUntilNext, DUSK_MINUTE } from '../engine/clock';
import { applyEffects, nePeutPasDifferer } from './combatEffects';
import { openRest, placesOfKind } from './restFlow';
import { placeById, type MapRoute, type WorldMap } from './worldMap';
import { damageVesselHull, healVesselHull, syncHullWoundsFromVessel, spoilVesselCargoOnLeak } from './seaVoyageFlow';
import { baseHoursPerDay } from './travelFlow';
import type { TravelPlan, TravelRecapDay } from './travelFlow';
import { toRecapLines } from './recapLine';
import { travelSpeed } from '../engine/travel';
import { vehicleCombatant } from '../engine/vehicle';
import { voyageStakeRef, findVehicleById, refLabel, specLabel } from '../data';
import type { StakeRef } from '../data';
import { partyCargoTotalEnc, nomDuNavire } from './carriers';
import { partyAssisted } from '../engine/skills';
import { rollTest, type TestResult } from '../engine/tests';
import type { ModLine } from '../engine/combat';
import { RULE_REF } from '../engine/ruleRefs';
import { testValue } from '../engine/skills';
import { deMonde, rollExpr, type RNG } from '../engine/dice';
import { difficultyFromModifier } from '../engine/tests';
import { effectiveChar } from '../engine/characteristics';
import {
  rollRiverWind, tickRiverWindDay, riverWindEffect, riverPilotSkill, savoirVoiesFluvialesBonus,
  rowingAgilityFactor, ROWING_AGILITY_DIFFICULTY, riverDayKm, riverDriftKm, navPenaltyMods,
  DRIFT_NAV_PENALTY, DRIFT_PCT_OF_SPEED, OUT_OF_CONTROL,
  riverControlKept, CAPSIZE_RIGHT_DIFFICULTY, CAPSIZE_RIGHT_CUMULATIVE, capsizeSinkTurns, holeSinkMinutes, riverCritical, findRiverPeril,
  resolveRiverImpact, rollBarrage, rollBarrageClearing, echouageDamage, NAV_BASE_DIFFICULTY, TACK_DIFFICULTY,
  CAPSIZE, TEMPORARY_REPAIR, riverForceLabel,
  type RiverWindForceId, type RiverWindDirId,
} from '../engine/riverNavigation';
import { DIFFICULTY_LABELS, type Combatant, type Difficulty } from '../engine/types';
import { startCascade, registerCascadeApplier, runCascadeImmediate } from './cascade';
import { freeCons, monoStep, choiceStep, displayStep, refusePorte, surfaceOf, pousseSi, openWorldTest, type Consequence, type BandLigne } from './rollSeam';
import type { BuiltCascadeStep } from './stepBrand';
import { actorIn, garanti } from './combatants';
import { riverAutoResolves, DEFAULT_VOYAGE_ORDERS, type VoyageCadence, type VoyageOrders } from './voyageCadence';
import type { CascadeStep, CascadeStepMeta } from './pendings';
import type { Get, Set } from './flowTypes';
import { dataLabel } from '../data';
import { t } from '../i18n';
import { shipLocationLabel, rollShipCritical, applyCrewHit, exposedCrew } from '../engine/shipCritical';
import { RIVER_CRIT_SET } from '../data/shipCriticals';
import { bandeTriggeredTest } from './combat/triggeredTest';
import { drainPendingLog } from './combatEffects';
import { stepDetail, stepPrecision } from './rollSeam';

/** SPÉCIALISATIONS de Métier lues par la réparation de bateau (l.107-117) — ids STABLES de
 *  `skills.json`, JAMAIS des libellés : `testValue` compare `s.spec === spec` à l'ID que porte
 *  l'instance (`SkillInstance.spec`), donc un libellé ne matche AUCUN personnage et le jaugerait à sa
 *  caractéristique nue (#1341). Le texte affiché se dérive de l'id par `specLabel`. */
const SPEC = { constructionBateaux: 'construction-de-bateaux', charpentier: 'charpentier' } as const;

/** LOCALISATIONS de Critique de bateau (clés des tables de `river-criticals.json`) — le type restreint
 *  rend le résolveur TOTAL : aucun repli sur l'id, donc aucune fuite de moteur-speak à l'écran. */
export type RiverCritLocation = 'greement' | 'avirons' | 'gouvernail' | 'coque' | 'superstructure';
/** Libellé JOUEUR d'une Localisation de bateau : le foyer est au moteur (`shipLocationLabel`), qui
 *  couvre les huit `ShipLocation` — les cinq d'ici en sont un sous-ensemble.
 *
 *  UNE entrée DIVERGE par LIVRE et se PRÉSERVE : la table fluviale dit « Rames » (`MSRC 7 l.56`,
 *  colonne Barque) là où la maritime dit « Avirons » (`MDG 13 l.575-582`). La surcharge est donc
 *  NOMINATIVE et locale au fluvial ; les quatre autres restent au foyer commun. */
export const riverLocLabel = (loc: RiverCritLocation): PlayerText =>
  (loc === 'avirons' ? t('rv.locRames') : shipLocationLabel(loc));

/** État FLUVIAL d'un TravelPlan (route `river`) — persiste avec le plan. */
export interface RiverVoyageState {
  /** Force du vent (ticke 4×/jour, l.21). */
  windForce: RiverWindForceId;
  /** Direction RELATIVE (fixée en début de voyage, l.21). */
  windDir: RiverWindDirId;
  daysAfloat: number;
  /** Bateau hors de contrôle (gréement en péril, note 5 l.41) : dérive + Nav −20 jusqu'à réparation. */
  outOfControl?: boolean;
  /** Gréement/avirons brisés (Critique `driftUntilRepair`, l.78-82) : dérive jusqu'à réparation. */
  broken?: boolean;
  /** Coque percée (« Y a un trou », l.101) — sink différé si non calfatée. */
  holed?: boolean;
  /** Le bateau a coulé (chavirage non redressé, ou coque percée non calfatée) : voyage perdu. */
  sunk?: boolean;
  /** CONTEXTE TRANSITOIRE du jour EN COURS (posé par `buildRiverDayCascade`, lu et effacé par
   *  `continueRiverDayAfterCascade`) : les entrées de vitesse de la journée que le calcul de km lit
   *  à la clôture de la cascade du jour. Aucune règle propre : les variables du jour
   *  (baseKm/windPct/drift) y sont mises de côté pour être relues après les jets
   *  influençables. Jamais persisté au-delà d'une journée. */
  day?: RiverDayContext;
  /** Facteur d'Agilité de rame du jour EN COURS (posé par l'applier `riverAgility`, lu à la clôture pour
   *  les km) — transitoire comme `day`. Défaut 1 (pas de barreur → pas d'étape → facteur neutre). */
  dayAgilityFactor?: number;
  /** Progression du jour FIGÉE pendant que la cascade d'Exposition hydrique (purpose `riverExposure`) est
   *  ouverte : la halte de nuit / l'arrivée sont DIFFÉRÉES à sa clôture (`continueRiverDayAfterExposure`,
   *  #344). Transitoire — jamais persisté au-delà d'une journée. */
  pendingFinish?: { kmDay: number; dayLines: string[] };
}

/** Entrées de VITESSE d'une journée fluviale, figées au build de la cascade du jour (vent) et
 *  complétées par les appliers (dérive de perte de contrôle, louvoyage manqué → windPct annulé).
 *  Le km final = `riverDayKm(baseKm, windPct, agilityFactor)` ou `riverDriftKm(baseKm)` si dérive —
 *  EXACTEMENT le calcul de l'ancien `resolveRiverDay`. */
export interface RiverDayContext {
  baseKm: number;
  /** % de vitesse du vent (Tableau des vents) — annulé par un louvoyage manqué (`riverTack`). */
  windPct: number;
  /** Dérive DÉJÀ certaine à l'ouverture (Calme/hors de contrôle/gréement brisé) — les appliers la
   *  forcent aussi (perte de contrôle, chavirage, gréement en péril). */
  forceDrift: boolean;
  /** Le vent impose un louvoyage (Modéré/Fort de côté) : le `windPct` n'est acquis qu'avec `riverTack` réussi. */
  tack?: boolean;
  /** Libellé de destination (repris à la clôture pour la halte/arrivée). */
  toScene: string;
  toEntry?: string;
  toLabel: string;
  /** Longueur du journal au DÉBUT du jour (repère) : le RÉCAP de la halte (`TravelRecapDay.lines`,
   *  affiché en tête de la modale de nuit) = la tranche de journal écrite depuis ce repère. */
  journalMark: number;
}

const log = (get: Get, _set: Set, lines: string[]) => {
  if (lines.length) get().log(lines);
};

/** La COQUE de trajet fluviale : le navire de campagne si c'en est un, sinon le véhicule-bateau de la route
 *  (`vehicles.json`, facette `ship`+`hull`). Repart des Blessures persistées (#30) si c'est le navire de
 *  campagne. `null` si aucun bateau exploitable. */
function riverHull(get: Get, route: MapRoute): { coque: Combatant; hasSail: boolean } | null {
  const boatMode = route.modes.find((m) => findVehicleById(m)?.ship && findVehicleById(m)?.hull);
  const vessel = get().vessel;
  const vId = vessel && findVehicleById(vessel.vehicleId)?.ship ? vessel.vehicleId : boatMode;
  const v = vId ? findVehicleById(vId) : undefined;
  if (!v?.ship || !v.hull) return null;
  const coque = vehicleCombatant(v);
  if (!coque) return null;
  if (vessel && vessel.vehicleId === vId) {
    coque.label = nomDuNavire(vessel); // #230
    syncHullWoundsFromVessel(coque, vessel);
  }
  return { coque, hasSail: !!v.ship.sail };
}

/** Un « batelier » : un PJ vivant AYANT des avances en Voile OU Ramer (l.11-17). Sans batelier, on paie un
 *  passeur (repli transport payant côté `startTravel`). */
export function hasBatelier(party: Combatant[]): boolean {
  return party.some((h) => !h.dead && (h.skills ?? []).some((s) => (s.id === 'voile' || s.id === 'ramer') && s.advances > 0));
}

/** Construit le TravelPlan d'une DESCENTE fluviale (route `river`, mode barge) — `null` si aucun bateau ou
 *  aucun batelier (→ repli transport payant). PUR de RNG hormis le tirage du vent de départ. */
export function buildRiverPlan(get: Get, routeId: string, fromPlaceId: string, toPlaceId: string, route: MapRoute, opts: { cadence?: VoyageCadence } = {}): TravelPlan | null {
  const hull = riverHull(get, route);
  if (!hull || hull.coque.wounds.current <= 0) return null;
  if (!hasBatelier(get().party)) return null;
  const wind = rollRiverWind(battleRng());
  // ORDRES permanents (couche `voyageCadence`) : `DEFAULT_VOYAGE_ORDERS` faute de cadence passée. AUCUN
  // appelant ne renseigne `opts.cadence` en fluvial (l'écran de départ ne l'envoie qu'en mer) : la
  // descente joue donc toujours le défaut, `riverAutoResolves` ne rend jamais `true` sur ce chemin.
  const orders: VoyageOrders = { cadence: opts.cadence ?? DEFAULT_VOYAGE_ORDERS.cadence };
  return {
    routeId, fromPlaceId, toPlaceId, mode: 'barge', hoursPerDay: 24, km: route.km, kmDone: 0, interrupted: false,
    orders,
    vehicle: hull.coque,
    river: { windForce: wind.force, windDir: wind.dir, daysAfloat: 0 },
  };
}

// ── Boucle jour par jour ─────────────────────────────────────────────────────────────────────────

/** Résout UNE journée de descente puis suspend sur la halte de nuit (ou arrive). Reprise au matin par
 *  `continueTravelAfterNight`. */
export function runRiverDays(get: Get, set: Set): void {
  const plan = get().travelPlan;
  if (!plan?.river || plan.interrupted || get().pendingRest || get().pendingCascade) return;
  const worldMap = get().worldMap as WorldMap;
  const route = worldMap?.routes.find((r) => r.id === plan.routeId);
  const to = worldMap ? placeById(worldMap, plan.toPlaceId) : undefined;
  if (!route || !to) { set({ travelPlan: null }); return; }
  if (plan.km - plan.kmDone < 1e-9) { arriveRiver(get, set, to); return; }
  resolveRiverDay(get, set, route, to);
}

function arriveRiver(get: Get, set: Set, to: { scene: string; entry?: string; label: string }): void {
  set({ travelPlan: null });
  log(get, set, [t('rv.arrive', { to: to.label })]);
  get().transitionTo(to.scene, to.entry);
}

/** Meilleur pilote (barreur/rameur) du groupe avec Soutien (LDB 12) pour la Compétence de Navigation. */
function riverPilot(get: Get, skillId: 'voile' | 'ramer') {
  return partyAssisted(get().party, skillId);
}

/**
 * Résout UNE journée de descente en la MISE EN SCÈNE d'une CASCADE influençable (purpose `travelDay`) :
 * TOUS les jets du jour (Agilité de rame, Navigation, Louvoyage, sauvegardes vitales, évitement des
 * périls) deviennent des ÉTAPES `CascadeStep` (Lancer → Chance/Pacte/Résilience → Valider) au lieu
 * d'être auto-résolus inline. La CONSÉQUENCE de chaque étape vit dans un `registerCascadeApplier`
 * fluvial (helpers PURS de `riverNavigation.ts`, zéro duplication de formule) qui mute le héros et/ou
 * la coque (`travelPlan.vehicle`) et/ou l'état fluvial. À la clôture de la cascade (`combatSlice`
 * → `continueRiverDayAfterCascade`), le store calcule les km du jour à partir des résultats d'étape
 * — SEUL endroit où ils se calculent — puis enchaîne la halte de nuit ou l'arrivée.
 */
function resolveRiverDay(get: Get, set: Set, route: MapRoute, to: { scene: string; entry?: string; label: string }): void {
  const { steps, log: lines } = buildRiverDayCascade(get, set, route, to);
  for (const l of lines) log(get, set, [l]);
  if (!steps.length) {
    // Aucun jet influençable (bateau coulé d'entrée, ou aucune entrée de vitesse à tester) : on
    // finalise directement, comme la cascade le ferait à la clôture.
    continueRiverDayAfterCascade(get, set);
    return;
  }
  // Route COMMANDÉE (couche `voyageCadence`, résidu #91) : la journée de descente est de la ROUTINE
  // influençable — l'auto-pilote pilote LE MÊME plan d'étapes via le pilote IMMÉDIAT de la cascade
  // (mêmes appliers, mêmes conséquences), SANS modale par jet ; les lignes tombent au PV du jour
  // (journal → recap de la halte). En coop, la conduite reste manuelle (modale).
  if (get().net.mode === 'local' && riverAutoResolves(get().travelPlan?.orders, steps)) {
    runCascadeImmediate(get, set, steps);
    if (get().battle || get().pendingCascade) return; // combat en plein vol OU choix sans défaut : surfacé, jamais résolu en silence
    continueRiverDayAfterCascade(get, set);
    return;
  }
  startCascade(get, set, { title: t('rv.dayTitle'), icon: 'travel/wave', purpose: 'travelDay', steps });
}

/** Test de Navigation du jour : sa Difficulté (le Test est demandé par MSRC 7 l.15, sans Difficulté
 *  énoncée — défaut Intermédiaire +0, LDB 12 l.148) et ses MALUS NOMMÉS (dérive l.38,
 *  hors de contrôle l.41) — SOURCE UNIQUE, partagée par le build de l'étape Nav et l'évitement de
 *  péril `navTest`. Les malus ne sont PAS des Difficultés : ils se lisent en chips sur la ligne. */
function riverNavTest(river: RiverVoyageState, eff: ReturnType<typeof riverWindEffect>): { difficulty: Difficulty; mods: ModLine[] } {
  return {
    difficulty: NAV_BASE_DIFFICULTY,
    mods: navPenaltyMods({ drift: !!eff.drift || !!river.broken, outOfControl: !!river.outOfControl }),
  };
}

/** Une étape-JET fluviale prête à influencer : la Difficulté est comprise dans `target` ET portée en
 *  DONNÉE de l'étape (`difficulty`) — la ligne de jet la DIT, l'affichage ne la devine pas. La LIGNE
 *  (base nue + toutes ses composantes nommées + cible + écrêtage) et la POSSESSION sont posées par le
 *  mint : ce monteur fluvial ne calcule rien, il DÉCLARE (`BandLigne`) et habille. */
function riverStep(
  id: string, kind: string, actor: Combatant, label: PlayerText, icon: string, rollLabel: string,
  ligne: BandLigne, difficulty: Difficulty, meta: CascadeStepMeta | undefined,
  // `stake` REQUIS (#1117) : une étape fluviale qui LANCE dit ce qu'elle met en jeu — le compilateur
  // tient le contrat pour les étapes construites ici (le cliquet textuel ne voit que les littéraux).
  opts: { stake: StakeRef },
): BuiltCascadeStep | undefined {
  return monoStep({ id, kind, actor, icon, label, rollLabel, difficulty, ligne, stake: opts.stake, meta });
}

/** Libellé de la COMPÉTENCE de barre du bateau EN COURS (Voile si gréé, Ramer sinon — MSRC 7 l.15),
 *  résolu par la couture id→label du catalogue. SOURCE UNIQUE : la construction du jour le porte en
 *  donnée (`meta.navLabel`) et l'applier le RE-DÉRIVE pour une cascade PERSISTÉE (save reprise, siège
 *  coop) construite avant que la donnée n'existe — la ligne de jet n'est jamais sans nom (Z5). */
function riverPilotSkillLabel(get: Get): string {
  const vehicleId = get().travelPlan?.vehicle?.creatureId ?? '';
  return refLabel('skills', { id: riverPilotSkill(findVehicleById(vehicleId)?.ship?.sail != null) });
}

/**
 * Construit les ÉTAPES influençables du JOUR (dans l'ORDRE de résolution RAW : réparation → Agilité →
 * Navigation → Louvoyage → sauvegardes de vent → périls). Pose le CONTEXTE de vitesse transitoire
 * (`river.day`) que la clôture relira pour les km. Renvoie aussi les lignes de journal d'ambiance
 * (vent du jour) déjà connues. Consomme ZÉRO RNG (les jets vivent dans les étapes / appliers).
 */
export function buildRiverDayCascade(get: Get, set: Set, route: MapRoute, to: { scene: string; entry?: string; label: string }): { steps: BuiltCascadeStep[]; log: string[] } {
  const plan = get().travelPlan!;
  const river = plan.river!;
  const worldMap = get().worldMap as WorldMap;
  const coque = plan.vehicle!;
  const steps: BuiltCascadeStep[] = [];
  const logs: string[] = [];

  const eff = riverWindEffect(river.windForce, river.windDir);
  logs.push(t('rv.windOfDay', {
    // La FORCE passe par la DONNÉE (`riverForceLabel`) : la capitaliser depuis l'id rendait « Modere ».
    force: riverForceLabel(river.windForce),
    dir: t(river.windDir === 'arriere' ? 'rv.windArriere' : river.windDir === 'cote' ? 'rv.windCote' : 'rv.windContraire'),
  }));

  const baseKm = travelSpeed(get().party, get().possessions, plan.mode, route.speed?.[plan.mode]) * baseHoursPerDay(worldMap);
  const skillId = riverPilotSkill(findVehicleById(coque.creatureId ?? '')?.ship?.sail != null);
  const pilot = riverPilot(get, skillId);

  // CONTEXTE DE VITESSE du jour (relu à la clôture) : dérive déjà certaine (Calme/hors-contrôle/brisé),
  // % de vent, louvoyage requis. Les appliers le complètent (perte de contrôle, chavirage → dérive).
  const dayCtx: RiverDayContext = {
    baseKm, windPct: eff.pct ?? 0, forceDrift: !!eff.drift || !!river.outOfControl || !!river.broken,
    tack: !!eff.tack, toScene: to.scene, toEntry: to.entry, toLabel: to.label, journalMark: get().journal.length,
  };
  set({ travelPlan: { ...get().travelPlan!, river: { ...river, day: dayCtx } } });

  // DÉCLARATION du jet de barre, faite UNE fois : les quatre étapes de barre et l'évitement de péril
  // testent la MÊME grandeur (même barreur, même Compétence, même Soutien) — seuls la Difficulté et
  // les modificateurs de situation changent.
  const pilotLigne: BandLigne | undefined = pilot
    ? { test: { skill: skillId }, valeur: pilot.value, soutien: pilot.support }
    : undefined;

  // 1. Réparation du gréement/avirons brisés d'une étape précédente (l.78-82 / note 5) : rend le contrôle.
  if ((river.broken || river.outOfControl)) {
    const repair = bestShipwright(get);
    if (repair) pousseSi(steps, riverStep('river-repair', 'riverControlRepair', repair.actor, t('step.riverRepair'), 'travel/repair',
      refLabel('skills', { id: 'metier' }), repair.ligne, TEMPORARY_REPAIR.difficulty, undefined,
      { stake: voyageStakeRef('riverControlRepair', { driftPenalty: DRIFT_NAV_PENALTY, outOfControlPenalty: OUT_OF_CONTROL.navPenalty }) }));
    else logs.push(t('rv.riggingNoRepairman'));
  }

  // 2. AGILITÉ de rame (l.17) : échec → −20 % ; Échec spectaculaire (−6 DR) → ÷2.
  if (pilot) {
    pousseSi(steps, riverStep('river-agility', 'riverAgility', pilot.actor, t('step.riverAgility'), 'travel/rowboat',
      t('char.agilite'), { test: { char: 'agilite' } }, ROWING_AGILITY_DIFFICULTY, undefined,
      { stake: voyageStakeRef('riverAgility', {
        // La SOURCE parle en POURCENTAGE et en DIVISION (MSRC 7 l.17) : le facteur ×0.8 est la langue du
        // moteur, pas celle du joueur — la ligne d'échec dit déjà « −20 % » / « ÷2 ».
        failPct: Math.round((1 - rowingAgilityFactor(false, 0)) * 100),
        spectacularDiv: Math.round(1 / rowingAgilityFactor(false, -6)),
      }) }));
  }

  // 3. NAVIGATION de l'étape (l.15) : barreur seul (Voile) / meilleur rameur (Ramer), +Savoir (l.13).
  //    Les malus de dérive/hors-contrôle sont RÉÉVALUÉS dans l'applier après la réparation.
  if (pilot) {
    const savoir = savoirVoiesFluvialesBonus(pilot.actor);
    const navTest = riverNavTest(river, eff);
    pousseSi(steps, riverStep('river-nav', 'riverNav', pilot.actor, stepPrecision(t('step.navigation'), refLabel('skills', { id: skillId })), 'travel/sail-ship',
      refLabel('skills', { id: skillId }), { ...pilotLigne!, surLaCible: navTest.mods }, navTest.difficulty, { savoir },
      { stake: voyageStakeRef('riverNav', { driftKm: Math.round(riverDriftKm(baseKm)), driftPct: DRIFT_PCT_OF_SPEED }) }));
  } else {
    logs.push(t('rv.noPilot'));
    dayCtx.forceDrift = true; // pas de barreur = contrôle perdu (note 2 : dérive)
    set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, day: { ...dayCtx } } } });
  }

  // 4. LOUVOYAGE (note 3, l.39) : le +% de vent de côté Modéré/Fort n'est acquis qu'avec un Test réussi.
  if (eff.tack && pilot) pousseSi(steps, riverStep('river-tack', 'riverTack', pilot.actor, t('step.riverTack'), 'nautical/tack',
    refLabel('skills', { id: skillId }), pilotLigne!, TACK_DIFFICULTY, { savoir: savoirVoiesFluvialesBonus(pilot.actor) },
    { stake: voyageStakeRef('riverTack', { windPct: eff.pct ?? 0 }) }));

  // 5. Sauvegardes de VENT (l.40-41).
  if (eff.capsizeRisk) {
    // `pilotValue` = la valeur FONDUE du barreur, portée en DONNÉE : le redressement qui suit un
    // chavirage (`riverCapsize` → `rightingStep`) en dérive sa cible, et la `base` de l'étape est nue.
    if (pilot) pousseSi(steps, riverStep('river-capsize', 'riverCapsize', pilot.actor, t('step.riverCapsize'), 'nautical/wind',
      refLabel('skills', { id: skillId }), pilotLigne!, CAPSIZE.removeSailDifficulty,
      { savoir: savoirVoiesFluvialesBonus(pilot.actor), pilotValue: pilot.value },
      { stake: voyageStakeRef('riverCapsize', { rounds: Math.max(1, capsizeSinkTurns(effectiveChar(coque, 'endurance'))) }) }));
    else { sinkBoat(get, set, (l) => logs.push(...l), t('rv.capsizeNoPilot')); }
  }
  if (eff.riggingRisk) {
    if (pilot) pousseSi(steps, riverStep('river-rigging', 'riverRigging', pilot.actor, t('step.riverRigging'), 'nautical/wind',
      refLabel('skills', { id: skillId }), pilotLigne!, CAPSIZE.removeSailDifficulty, { savoir: savoirVoiesFluvialesBonus(pilot.actor) },
      { stake: voyageStakeRef('riverRigging', { outOfControlPenalty: OUT_OF_CONTROL.navPenalty }) }));
    else { steps.push(...applyBoatCriticalNoPilot(get, set, coque, (l) => logs.push(...l))); }
  }

  // 6. PÉRILS de rivière (l.119-166) — un pas de VÉRIFICATION d'occurrence par péril d'auteur (affichage
  //    muet). L'applier tire la chance (d100, MÊME position RNG qu'inline : un d100 par péril, AVANT le
  //    Test d'évitement), et — si le péril survient et propose un Test de Navigation (Débris) — INSÈRE une
  //    étape-jet d'évitement INFLUENÇABLE juste après (chance PUIS jet = ordre RNG identique à l'inline).
  //    Les kinds sans jet joueur (`detect`/`obstacle`) sont résolus inline dans l'applier de vérification.
  // Malus du Test d'évitement : la dérive s'applique telle quelle (l.38, « les Tests de **Navigation**
  // subissent un malus de –10 » — général). Le hors-de-contrôle vise « les Tests de **Navigation** pour
  // tenter de diriger le bateau » (l.41) : l'évitement d'une collision (l.125, « les Personnages doivent
  // agir vite pour éviter les dégâts d'une collision ») en est un — lecture déclarée, l.125 ne dit pas
  // « diriger ». Les drapeaux voyagent en donnée (sérialisable) ; l'applier RE-RÉSOUT le barreur et son
  // Soutien pour remonter la ligne par le monteur canonique (aucune ligne transportée à la main).
  for (const [i, spawn] of (route.riverPerils ?? []).entries()) {
    const peril = findRiverPeril(spawn.perilId);
    if (!peril) continue;
    const commun = {
      id: `river-peril-${i}`, kind: 'riverPerilCheck', icon: 'ui/warning', label: dataLabel(peril.label),
      meta: { perilId: spawn.perilId, chancePct: spawn.chancePct, savoir: pilot ? savoirVoiesFluvialesBonus(pilot.actor) : 0,
        hasPilot: !!pilot, navSkill: skillId,
        navDrift: !!eff.drift || !!river.broken, navOutOfControl: !!river.outOfControl,
        // Libellé de la LIGNE du Test d'évitement inséré par l'applier : la compétence du barreur
        // (l.15), RÉSOLUE par la couture id→label du catalogue et portée en donnée — l'applier n'a
        // plus à la deviner.
        navLabel: riverPilotSkillLabel(get) },
    };
    // Sans barreur, ce pas n'est celui de PERSONNE : c'est le fleuve qui vérifie (étape MONDE,
    // routée au siège MJ), pas un héros qu'il faudrait nommer pour la forme.
    steps.push(pilot ? displayStep({ ...commun, actorId: pilot.actor.id }) : displayStep({ ...commun, worldOwner: true }));
  }

  return { steps, log: logs };
}

/** Coup Critique au gréement SANS barreur (note 5) — Critique + dérive hors de contrôle. Le jet d'éclats
 *  reste possiblement INFLUENÇABLE (#270, `applyBoatCritical`) même sans barreur (l'esquive porte sur la
 *  victime exposée, pas sur le pilote). */
function applyBoatCriticalNoPilot(get: Get, set: Set, coque: Combatant, tell: (l: string[]) => void): BuiltCascadeStep[] {
  tell([t('rv.riggingNoPilot')]);
  const insert = applyBoatCritical(get, set, get().travelPlan!, get().travelPlan!.river!, coque, 'greement', tell, battleRng(), 'river-rigging-nopilot');
  set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, outOfControl: true } } });
  tell([t('rv.outOfControl')]);
  return insert;
}

/**
 * Clôture de la CASCADE du jour (finalisation `purpose:'travelDay'`, appelée par le store) : recalcule
 * la PROGRESSION du jour à partir du contexte de vitesse (`river.day`, alimenté par les étapes/appliers)
 * par `riverDriftKm` / `riverDayKm` (helpers PURS, source unique) — puis résout l'exposition hydrique et
 * enchaîne halte de nuit / arrivée (`finishRiverDay`). Efface le contexte transitoire.
 */
export function continueRiverDayAfterCascade(get: Get, set: Set): void {
  const plan = get().travelPlan;
  if (!plan?.river) return;
  const river = plan.river;
  const ctx = river.day;
  const worldMap = get().worldMap as WorldMap;
  const route = worldMap?.routes.find((r) => r.id === plan.routeId);
  const to = ctx
    ? { scene: ctx.toScene, entry: ctx.toEntry, label: ctx.toLabel }
    : (worldMap ? placeById(worldMap, plan.toPlaceId) : undefined);
  if (!route || !to) { set({ travelPlan: null }); return; }

  const sunk = !!river.sunk;
  const baseKm = ctx?.baseKm ?? 0;
  const kmDay = sunk ? 0
    : ctx?.forceDrift ? riverDriftKm(baseKm)
    : riverDayKm(baseKm, ctx?.windPct ?? 0, river.dayAgilityFactor ?? 1);
  if (!sunk) log(get, set, [t('rv.progress', { km: Math.round(kmDay), note: ctx?.forceDrift ? t('rv.fragDrift') : (ctx?.windPct ? t('rv.fragWind', { pct: `${ctx.windPct >= 0 ? '+' : ''}${ctx.windPct}` }) : t('rv.fragDot')) })]);

  // RÉCAP du jour (affiché en tête de la halte de nuit) = la tranche de journal écrite depuis le repère.
  const dayLines = ctx ? get().journal.slice(ctx.journalMark) : [];

  // Efface le contexte transitoire du jour (jamais persisté au-delà de la journée).
  set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, day: undefined, dayAgilityFactor: undefined } } });

  // Exposition hydrique du jour (MSRC 16) — ouvre l'Effet EXISTANT `waterExposure` (cascade influençable).
  // Si elle SURFACE, on DIFFÈRE la halte de nuit à sa clôture : sinon la cascade d'Exposition et la modale
  // de Repos coexistent, le Repos reprend la route AVANT la résolution de l'Exposition, et celle-ci
  // (purpose générique `test`) n'a plus de continuation → la journée suivante ne se ré-arme jamais (#344).
  // Patron du sibling maritime (`seaScorbut`/`seaExhaustion`) : un purpose DÉDIÉ (`riverExposure`) dont la
  // clôture (`dispatchCascadeDone`) reprend la fin du jour (`continueRiverDayAfterExposure`).
  // La progression du jour est FIGÉE avant le dé d'Exposition : celui-ci peut ouvrir une FENÊTRE (siège
  // qui possède le monde, option « Dés fixés ») aussi bien que se résoudre d'un trait, et dans les deux
  // cas la halte/l'arrivée se rejoue depuis ce point figé (`continueRiverDayAfterExposure`).
  set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, pendingFinish: { kmDay, dayLines } } } });
  openRiverExposureChance(get, set, route, sunk);
  // Quelque chose s'est SURFACÉ (la fenêtre du dé, ou l'Effet d'Exposition qu'il vient d'ouvrir) : la fin
  // de jour est DIFFÉRÉE à la clôture de cette cascade — sans ce report, la modale de Repos et celle
  // d'Exposition coexistent et la journée suivante ne se ré-arme jamais (#344).
  if (marqueExpositionDuJour(get, set)) return;
  continueRiverDayAfterExposure(get, set);
}

/**
 * Marque la cascade ouverte par l'Exposition du purpose DÉDIÉ `riverExposure` — c'est lui qui rend la
 * fin du jour à `continueRiverDayAfterExposure` (#344) au lieu du purpose générique `test`, sans
 * continuation. Posé aux DEUX endroits où l'Exposition peut ouvrir une fenêtre : le dé d'auteur
 * lui-même (dé de MONDE, joué par le siège qui possède le monde) et l'Effet que sa réussite ouvre.
 * Rend `false` quand rien n'est ouvert : la fin du jour se joue alors tout de suite.
 */
function marqueExpositionDuJour(get: Get, set: Set): boolean {
  const pc = get().pendingCascade;
  if (!pc) return false;
  set({ pendingCascade: { ...pc, purpose: 'riverExposure' } });
  return true;
}

/** Reprise de la FIN du jour fluvial après la cascade d'Exposition hydrique (purpose `riverExposure`,
 *  posée par `continueRiverDayAfterCascade`) : la halte de nuit / l'arrivée, DIFFÉRÉES le temps du Test de
 *  Résistance. Rejoue `finishRiverDay` avec la progression du jour FIGÉE (`river.pendingFinish`). */
export function continueRiverDayAfterExposure(get: Get, set: Set): void {
  const plan = get().travelPlan;
  if (!plan?.river) return;
  const fin = plan.river.pendingFinish;
  const worldMap = get().worldMap as WorldMap;
  const route = worldMap?.routes.find((r) => r.id === plan.routeId);
  const to = worldMap ? placeById(worldMap, plan.toPlaceId) : undefined;
  set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, pendingFinish: undefined } } });
  if (!route || !to) { set({ travelPlan: null }); return; }
  finishRiverDay(get, set, to, fin?.kmDay ?? 0, fin?.dayLines ?? []);
}

/**
 * EXPOSITION HYDRIQUE d'une étape (MSRC 16, l.5-13) : tirage d'auteur (`MapRoute.riverExposure`) qui
 * déclenche l'Effet EXISTANT `waterExposure` sur TOUT le groupe — aucune mécanique neuve. Sautée si le
 * bateau a coulé (plus de fleuve sous les pieds).
 *
 * Le d100 d'auteur est un dé de MONDE : il DÉCIDE si l'Exposition a lieu, et se pose donc comme les
 * autres (`worldStep`, évaluation `'seuil'` : `dé ≤ chancePct`, ni bande ni DR). Il est poussé EN FIN
 * de la cascade du jour, là où il se tirait — sa conséquence ouvre l'Effet et pose `river.pendingFinish`.
 * La chaîne halte/arrivée ne change PAS de forme : elle reste le différé de clôture
 * (`continueRiverDayAfterExposure`, fix #344), jamais une interruption de trajet.
 */
function openRiverExposureChance(get: Get, set: Set, route: MapRoute, sunk: boolean): void {
  const ex = route.riverExposure;
  if (!ex || sunk) return;
  openWorldTest(get, set, {
    actionLabel: t('rv.exposureLabel'),
    difficulty: 'intermediaire',
  }, RIVER_EXPOSURE_KIND, {
    baseValue: Math.max(0, Math.min(100, ex.chancePct)),
    exposureMode: ex.mode, exposureSource: ex.source,
  });
}

const RIVER_EXPOSURE_KIND = 'riverExposureChance';
registerCascadeApplier(RIVER_EXPOSURE_KIND, (get, set, step) => {
  if (!step.result) return {};
  if (!step.result.success) return { consequences: freeCons([{ text: t('rv.exposureNone'), tone: 'info' }]) };
  const mode = step.meta?.exposureMode as import('../data').WaterExposureMode;
  const source = step.meta?.exposureSource as string | undefined;
  // Une feuille `waterExposure` LITTÉRALE ne porte aucun canal de dés (#1508) : le marquage du jour
  // qui suit ne peut donc pas passer devant un dé — et si ça changeait, ça lèverait ici.
  nePeutPasDifferer(applyEffects(get, set, [{ type: 'waterExposure', mode, source, target: 'party' }]), 'riverVoyage.exposition');
  marqueExpositionDuJour(get, set);
  return {};
});

function controlLabel(kept: boolean, success: boolean): string {
  if (success) return t('rv.controlKept');
  return t(kept ? 'rv.controlSaved' : 'rv.controlLost');
}

/** Patche le contexte de vitesse du jour (`river.day`) — SOURCE UNIQUE des mutations d'entrée de km
 *  depuis un applier (perte de contrôle, louvoyage manqué, chavirage → dérive). */
function patchDay(get: Get, set: Set, patch: Partial<RiverDayContext>): void {
  const river = get().travelPlan?.river;
  if (!river?.day) return;
  set({ travelPlan: { ...get().travelPlan!, river: { ...river, day: { ...river.day, ...patch } } } });
}

// ── APPLIERS des étapes du JOUR fluvial (purpose `travelDay`) : conséquence RAW par `kind`, via les
//    helpers PURS de `riverNavigation.ts` (zéro duplication de formule). Chaque applier lit `step.result`
//    (jet influencé) et mute le héros / la coque (`travelPlan.vehicle`) / l'état fluvial / le contexte
//    de vitesse du jour. Ordre de résolution = ordre des étapes construites (parité RNG avec l'inline).

/** Réparation du gréement/avirons (l.78-82 / note 5) : Test de Métier réussi → rend le contrôle. */
registerCascadeApplier('riverControlRepair', (get, set, step, hero) => {
  if (!step.result) return;
  if (step.result.success) set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, broken: false, outOfControl: false } } });
  const name = garanti(hero, step.actorId, 'charpentier').label;
  return { consequences: freeCons([step.result.success
    ? { text: t('rv.repairOk', { name }), tone: 'ok' }
    : { text: t('rv.repairKo', { name }), tone: 'bad' }]) };
});

/** Agilité de rame (l.17) : facteur de vitesse (1 / 0,8 / 0,5) posé sur `river.dayAgilityFactor`. */
registerCascadeApplier('riverAgility', (get, set, step, hero) => {
  if (!step.result) return;
  const factor = rowingAgilityFactor(step.result.success, step.result.sl);
  set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, dayAgilityFactor: factor } } });
  const name = garanti(hero, step.actorId, 'rameur').label;
  const text = step.result.success ? t('rv.rowOk', { name }) : factor === 0.5 ? t('rv.rowHalf', { name }) : t('rv.rowMinus', { name });
  return { consequences: freeCons([{ text, tone: step.result.success ? 'ok' : 'bad' }]) };
});

/** Navigation de l'étape (l.15) : perte de contrôle (échec non rattrapé par Savoir) → dérive. */
registerCascadeApplier('riverNav', (get, set, step, hero) => {
  if (!step.result) return;
  const savoir = Number(step.meta?.savoir ?? 0);
  const kept = riverControlKept(step.result.success, step.result.sl, savoir);
  if (!kept) patchDay(get, set, { forceDrift: true });
  const savoirNote = savoir > 0 ? t('rv.fragSavoir', { n: savoir }) : '';
  return { consequences: freeCons([{
    text: t('rv.navLine', { who: garanti(hero, step.actorId, 'pilote').label, savoir: savoirNote, issue: controlLabel(kept, step.result.success) }),
    tone: step.result.success ? 'ok' : kept ? 'info' : 'bad',
  }]) };
});

/** Louvoyage (note 3, l.39) : le +% de vent n'est acquis qu'avec un Test réussi. */
registerCascadeApplier('riverTack', (get, set, step) => {
  if (!step.result) return;
  const savoir = Number(step.meta?.savoir ?? 0);
  const ok = step.result.success || (savoir > 0 && step.result.sl + savoir >= 0);
  const windPct = get().travelPlan?.river?.day?.windPct ?? 0;
  if (!ok) patchDay(get, set, { windPct: 0 });
  return { consequences: freeCons([ok
    ? { text: t('rv.tackOk', { pct: windPct }), tone: 'ok' }
    : { text: t('rv.tackKo'), tone: 'bad' }]) };
});

/** Étape-JET de redressement du Round `round` (0 = le premier) d'un bateau renversé (MSRC 7 l.40) :
 *  Navigation Accessible, malus −5 par Round déjà échoué porté en chip NOMMÉE. Le redressement EST un
 *  Test de Navigation (`MSRC 7 note 4` : « un seul Test de Navigation Accessible (+20) par Round pour
 *  essayer de redresser le bateau ») : le barreur et son Soutien se re-résolvent ici, et le +1 DR de
 *  Savoir (Voies fluviales, l.13) se résout AU DR dans l'applier (`riverControlKept`), pas dans la cible. */
function rightingStep(get: Get, source: CascadeStep, round: number, be: number): BuiltCascadeStep | undefined {
  const rounds = Math.max(1, be); // plancher : au moins UNE tentative (parité avec le nb de Rounds joués)
  const penalty = round * CAPSIZE_RIGHT_CUMULATIVE;
  // Le barreur est RE-RÉSOLU ici (acteur + Soutien du moment) : la ligne se remonte par le monteur
  // canonique, jamais transportée d'étape en étape. Le −5 cumulatif du Round courant est un
  // modificateur DE CIBLE (l.40) : déclaré en `surLaCible`, il ne s'empile pas d'un Round à l'autre.
  const skillId = riverPilotSkill(findVehicleById(get().travelPlan?.vehicle?.creatureId ?? '')?.ship?.sail != null);
  const pilot = riverPilot(get, skillId);
  const savoir = pilot ? savoirVoiesFluvialesBonus(pilot.actor) : Number(source.meta?.savoir ?? 0);
  const cumul = penalty
    ? [{ label: t('rv.rightingCumul', { n: round + 1 }), value: penalty, famille: 'jet' as const, ref: RULE_REF['navigation-chavirage'] }]
    : undefined;
  // PORTEUR de l'étape : le barreur DU MOMENT quand il en reste un — le Test est le sien, donc la
  // fenêtre aussi. C'est un CHANGEMENT assumé : l'étape reprenait jusqu'ici l'`actorId` du chavirage,
  // qui pouvait n'être plus celui qui roule. À défaut de barreur, le porteur du chavirage garde
  // l'étape (le bateau est le sien) : sans lui, la fenêtre échoirait à l'hôte.
  const porteur = pilot?.actor ?? actorIn(get(), source.actorId ?? '');
  if (!porteur) {
    refusePorte(`redressement « ${source.id} » (Round ${round + 1}) : plus aucun porteur à bord — sans lui `
      + 'le bateau ne serait ni redressé ni coulé, la note 4 (l.40) resterait en suspens. Aucun jet ouvert.');
    return undefined;
  }
  return monoStep({
    id: `${source.id}-right-${round}`, kind: 'riverRighting', actor: porteur, icon: 'nautical/tack',
    label: stepDetail(t('step.riverRighting'), t('step.round', { n: round + 1, total: rounds })),
    rollLabel: source.rollLabel ?? t('rv.navigation'),
    difficulty: CAPSIZE_RIGHT_DIFFICULTY,
    stake: voyageStakeRef('riverRighting', { nextPenalty: (round + 1) * CAPSIZE_RIGHT_CUMULATIVE, rounds: rounds }),
    meta: { rightRound: round, rightRounds: rounds, savoir },
    // Barreur en poste : sa valeur SOUTENUE se décompose. Plus de barreur éligible (mort, débarqué) :
    // la valeur figée à la construction tient lieu de seuil, DÉCLARÉE comme venant d'une autre formule
    // (`valeurEtrangere`) — sans Test nommé, le monteur n'a RIEN à décomposer et rend la valeur en base
    // (`testValueSplit` : « rien à décomposer » dès qu'aucune compétence ni caractéristique n'est
    // déclarée), porteur nommé ou non. Les deux régimes passent donc par la MÊME entrée `ligne`.
    ligne: pilot
      ? { test: { skill: skillId }, valeur: pilot.value, soutien: pilot.support, ...(cumul ? { surLaCible: cumul } : {}) }
      : { valeur: Number(source.meta?.pilotValue ?? source.base ?? 0), valeurEtrangere: true, ...(cumul ? { surLaCible: cumul } : {}) },
  });
}

/** Chavirage (note 4, l.40) : voile retirée à temps → dérive ; sinon le redressement s'ouvre Round par
 *  Round (une étape INFLUENÇABLE par Round, jusqu'à BE Rounds) ou le bateau coule. Le bateau ne fait au
 *  mieux que DÉRIVER ce jour → `forceDrift`. */
registerCascadeApplier('riverCapsize', (get, set, step) => {
  if (!step.result) return;
  patchDay(get, set, { forceDrift: true });
  if (step.result.success) return { consequences: freeCons([{ text: t('rv.capsizeAvoided'), tone: 'ok' }]) };
  const be = capsizeSinkTurns(effectiveChar(get().travelPlan!.vehicle!, 'endurance'));
  const premier = rightingStep(get, step, 0, be);
  return {
    consequences: freeCons([{ text: t('rv.capsizeHappens'), tone: 'bad' }]),
    ...(premier ? { insert: [premier] } : {}),
  };
});

/** Redressement d'un bateau renversé, UN Round = UNE étape (note 4, l.40) : réussi → le bateau est
 *  redressé ; échoué → le Round suivant s'insère tant qu'il en reste (BE), sinon le bateau coule. */
registerCascadeApplier('riverRighting', (get, set, step) => {
  if (!step.result) return;
  const round = Number(step.meta?.rightRound ?? 0);
  const be = Number(step.meta?.rightRounds ?? 1);
  // Le redressement est un Test de NAVIGATION (note 4) : le +1 DR de Savoir (Voies fluviales, l.13)
  // s'y applique AU DR, comme au Test du jour et au Louvoyage — MÊME lecture (`riverControlKept`).
  const savoir = Number(step.meta?.savoir ?? 0);
  const savoirNote = savoir > 0 ? t('rv.fragSavoir', { n: savoir }) : '';
  if (riverControlKept(step.result.success, step.result.sl, savoir)) {
    return { consequences: freeCons([{ text: t('rv.righted', { n: round + 1, savoir: savoirNote }), tone: 'ok' }]) };
  }
  if (round + 1 < be) {
    const suivant = rightingStep(get, { ...step, id: step.id.replace(/-right-\d+$/, '') }, round + 1, be);
    return {
      consequences: freeCons([{ text: t('rv.stillOnSide', { n: round + 1, be }), tone: 'bad' }]),
      ...(suivant ? { insert: [suivant] } : {}),
    };
  }
  const j: import('./rollSeam').FreeConsLine[] = [];
  sinkBoat(get, set, (l) => j.push(...l), t('rv.sinkNotRighted', { be }));
  return { consequences: freeCons(j) };
});

/** Gréement en péril (note 5, l.41) : Test raté → Critique au gréement + dérive hors de contrôle. */
registerCascadeApplier('riverRigging', (get, set, step) => {
  if (!step.result) return;
  if (step.result.success) return { consequences: freeCons([{ text: t('rv.riggingHolds'), tone: 'ok' }]) };
  const j: import('./rollSeam').FreeConsLine[] = [{ text: t('rv.riggingCrit'), tone: 'bad' }];
  const insert = applyBoatCritical(get, set, get().travelPlan!, get().travelPlan!.river!, get().travelPlan!.vehicle!, 'greement', (l) => j.push(...l), battleRng(), step.id);
  set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, outOfControl: true } } });
  patchDay(get, set, { forceDrift: true });
  j.push(t('rv.outOfControl'));
  return { consequences: freeCons(j), insert: insert.length ? insert : undefined };
});

/** VÉRIFICATION d'occurrence d'un péril (l.119-166) : tire la CHANCE (d100, MÊME position RNG qu'inline —
 *  un d100 par péril, AVANT le Test d'évitement). Péril survenu à Test de Navigation (Débris) → INSÈRE une
 *  étape-jet d'évitement INFLUENÇABLE (`riverPerilNav`) ; kinds sans jet joueur (`detect`/`obstacle`)
 *  résolus inline ici (mêmes sous-jets, même ordre). Coulé → sauté sans d100 (parité : inline `break`). */
registerCascadeApplier('riverPerilCheck', (get, set, step) => {
  const rng = battleRng();
  if (get().travelPlan?.river?.sunk) return; // coulé → péril sauté (parité : inline `break`, aucun d100)
  const perilId = String(step.meta?.perilId ?? '');
  const chancePct = Number(step.meta?.chancePct ?? 0);
  const peril = findRiverPeril(perilId);
  if (!peril) return;
  // Rejeu POST-POSE de la chance du péril : l'étape `riverPerilCheck` est déjà posée, ce dé en est la
  // conséquence — porte du canal (`deMonde`), un dé par péril (même position RNG qu'inline).
  if (deMonde(rng) > Math.max(0, Math.min(100, chancePct))) return;
  if (peril.kind === 'navTest') {
    // Le Test d'évitement est INFLUENÇABLE → étape-jet insérée juste après (chance PUIS jet, ordre inline).
    const hasPilot = !!step.meta?.hasPilot;
    // Le barreur est RE-RÉSOLU au moment de l'insertion (acteur + Soutien du moment) et la ligne se
    // remonte par le monteur canonique : les malus de dérive/hors-contrôle, eux, voyagent en drapeaux
    // sérialisables et redeviennent des chips NOMMÉES (`navPenaltyMods`).
    const skillId = String(step.meta?.navSkill ?? riverPilotSkill(findVehicleById(get().travelPlan?.vehicle?.creatureId ?? '')?.ship?.sail != null));
    const pilot = riverPilot(get, skillId as 'voile' | 'ramer');
    if (!hasPilot || !pilot) return resolveRiverPerilConsequence(get, set, peril, { ...step, result: null }, rng);
    // Un péril à Test PORTE sa conséquence (`onFail`, exigée par le schéma de `river-perils`) : sans
    // elle, il n'y a rien à mettre en jeu, donc pas de jet à ouvrir — la conséquence se résout seule.
    const onFail = peril.onFail;
    if (!onFail) return resolveRiverPerilConsequence(get, set, peril, { ...step, result: null }, rng);
    const st = monoStep({
      id: `${step.id}-nav`, kind: 'riverPerilNav', actor: pilot.actor, icon: 'nautical/snag', label: stepDetail(dataLabel(peril.label), t('step.evitement')),
      rollLabel: String(step.meta?.navLabel ?? riverPilotSkillLabel(get)), difficulty: NAV_BASE_DIFFICULTY,
      ligne: {
        test: { skill: skillId }, valeur: pilot.value, soutien: pilot.support,
        surLaCible: navPenaltyMods({ drift: !!step.meta?.navDrift, outOfControl: !!step.meta?.navOutOfControl }),
      },
      stake: voyageStakeRef('riverPerilNav', { hits: onFail.hullHits, damagePerHit: onFail.damagePerHit }),
      meta: { perilId, savoir: Number(step.meta?.savoir ?? 0) },
    });
    return st ? { insert: [st] } : undefined;
  }
  if (peril.kind === 'obstacle' && peril.obstacle) {
    // Barrage (l.128) : CHOIX joueur — forcer au bélier (Dégâts à la coque) OU déblayer à la main (temps,
    // coque intacte). L'Endurance/les Blessures du barrage sont tirées ici pour la lisibilité du choix.
    const b = rollBarrage(peril.obstacle, rng);
    // PORTEUR de la décision : le barreur du pas de vérification, sinon celui qui la mettrait en œuvre
    // (Force soutenue — bélier comme déblaiement), sinon le premier vivant. La porte de choix exige un
    // porteur : sans lui la fenêtre échoit à l'hôte, qui trancherait pour un autre siège.
    const decideur = step.actorId
      ?? partyAssisted(get().party.filter((h) => !h.dead), undefined, 'force')?.actor.id
      ?? get().party.find((h) => !h.dead)?.id ?? '';
    const st = choiceStep({
      id: `${step.id}-obstacle`, kind: 'riverObstacleChoice', actorId: decideur, icon: 'ui/warning',
      label: stepDetail(stepPrecision(dataLabel(peril.label), t('step.obstacleStats', { endurance: b.endurance, blessures: b.wounds })), t('step.forcerOuDeblayer')),
      options: [
        { key: 'deblayer', label: t('opt.deblayer'), detail: t('rv.obstacleClearDetail') },
        { key: 'forcer', label: t('opt.forcerBelier'), detail: t('rv.obstacleRamDetail', { dmg: peril.obstacle.ramDamage }) },
      ],
      // Cadence commandée : défaut = le MOINS destructif (déblayer, coque intacte) — MSRC 7 l.128.
      defaultChoice: 'deblayer', meta: { perilId },
    });
    return st ? { insert: [st] } : undefined;
  }
  // detect : jet de détection GATÉ (#270, conducteur JOUEUR → étape insérée `riverPerilDetect` ; sinon
  // résolution inline, sous-jets dans le même ordre qu'inline).
  return resolveRiverPerilConsequence(get, set, peril, { ...step, result: null }, rng);
});

/** CHOIX au barrage (l.128) : forcer au bélier (+ramDamage à la coque) ou déblayer à la main (3d10 objets
 *  × 4d10 Enc, coque INTACTE, le halage ampute la progression du jour via `dayAgilityFactor`). */
registerCascadeApplier('riverObstacleChoice', (get, set, step) => {
  const peril = findRiverPeril(String(step.meta?.perilId ?? ''));
  if (!peril?.obstacle) return;
  const coque = get().travelPlan!.vehicle!;
  if (step.chosen === 'forcer') {
    damageVesselHull(get, set, coque, peril.obstacle.ramDamage);
    return { consequences: freeCons([t('rv.rammed', { peril: peril.label, dmg: peril.obstacle.ramDamage, cur: coque.wounds.current, max: coque.wounds.max })]) };
  }
  if (!peril.clear) return { consequences: freeCons([t('rv.clearedPlain', { peril: peril.label })]) };
  const c = rollBarrageClearing(peril.clear, battleRng());
  const workDay = baseHoursPerDay(get().worldMap as WorldMap);
  const factor = workDay > 0 ? Math.max(0, 1 - c.hours / workDay) : 1;
  const prev = get().travelPlan?.river?.dayAgilityFactor ?? 1;
  set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, dayAgilityFactor: prev * factor } } });
  return { consequences: freeCons([t('rv.cleared', { peril: peril.label, objects: c.objects, enc: c.enc, hours: c.hours, pct: Math.round((1 - factor) * 100) })]) };
});

/** Évitement INFLUENÇABLE d'un péril à Test de Navigation (Débris, l.125) : le jet (`step.result`) décide
 *  de la collision → Dégâts à la coque via la conséquence commune. */
registerCascadeApplier('riverPerilNav', (get, set, step) => {
  const peril = findRiverPeril(String(step.meta?.perilId ?? ''));
  if (!peril) return;
  return resolveRiverPerilConsequence(get, set, peril, step, battleRng());
});

/** Réparation d'urgence INFLUENÇABLE d'une coque PERCÉE (#270, Métier) — succès = voie d'eau colmatée
 *  (+1d10 Blessures de coque, l.116) ; échec = le bateau sombre (l.103). */
registerCascadeApplier('riverHoleRepair', (get, set, step, hero) => {
  if (!step.result) return;
  const plan = get().travelPlan!;
  const name = garanti(hero, step.actorId, 'charpentier').label;
  if (step.result.success) {
    const healed = Math.min(plan.vehicle!.wounds.max - plan.vehicle!.wounds.current, rollExpr(TEMPORARY_REPAIR.woundsPerRepair, battleRng()));
    healVesselHull(get, set, plan.vehicle!, healed);
    set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, holed: false } } });
    return { consequences: freeCons([{ text: t('rv.holeRepairOk', { name, n: healed }), tone: 'ok' }]) };
  }
  const j: import('./rollSeam').FreeConsLine[] = [{ text: t('rv.holeRepairKo', { name }), tone: 'bad' }];
  sinkBoat(get, set, (l) => j.push(...l), t('rv.sinkLeak'));
  return { consequences: freeCons(j) };
});

/** Détection INFLUENÇABLE d'un péril « detect » (Rochers/eaux peu profondes, l.136, Agilité — #270) —
 *  sans la Compétence de Navigation (auto-succès résolu AVANT l'insertion, cf. `resolveRiverPerilConsequence`).
 *  Échec → impact (Dégâts fixes, chances de percée/échouage, MÊME conséquence que le chemin inline). */
registerCascadeApplier('riverPerilDetect', (get, set, step) => {
  const peril = findRiverPeril(String(step.meta?.perilId ?? ''));
  if (!step.result || !peril?.onHit) return;
  if (step.result.success) return { consequences: freeCons([{ text: t('rv.perilAvoided', { peril: peril.label }), tone: 'ok' }]) };
  const j: import('./rollSeam').FreeConsLine[] = [{ text: t('rv.perilImpact', { peril: peril.label }), tone: 'bad' }];
  const rng = battleRng();
  const impact = resolveRiverImpact(peril.onHit, rng);
  const plan = get().travelPlan!;
  const coque = plan.vehicle!;
  damageVesselHull(get, set, coque, impact.hullDamage);
  j.push(t('rv.hullHit', { peril: peril.label, dmg: impact.hullDamage, note: '', cur: coque.wounds.current, max: coque.wounds.max }));
  const insert: BuiltCascadeStep[] = [];
  if (impact.echoue) insert.push(...applyEchouageSteps(get, set, step.id, j));
  if (impact.holed) insert.push(...applyBoatCritical(get, set, plan, plan.river!, coque, 'coque', (l) => j.push(...l), rng, step.id));
  return { consequences: freeCons(j), insert: insert.length ? insert : undefined };
});

/** Applique un Coup Critique de bateau (l.72-94) : Dégâts d'éclats à l'équipage — esquive INFLUENÇABLE
 *  (#270, Initiative) quand le jet de la victime exposée se surface, sinon inline — États, dérive, ou
 *  coque percée (réparation elle-même GATÉE, `holeBoat`). Renvoie les étapes-jet à INSÉRER, propagées par
 *  l'appelant (build-time `applyBoatCriticalNoPilot` ou applier `riverRigging`/`riverPerilDetect`). */
function applyBoatCritical(get: Get, set: Set, plan: TravelPlan, river: RiverVoyageState, coque: Combatant, location: RiverCritLocation, tell: (l: string[]) => void, rng: RNG, idPrefix: string): BuiltCascadeStep[] {
  const crit = riverCritical(location);
  if (!crit) return [];
  const insert: BuiltCascadeStep[] = [];
  // Coup à l'équipage (l.78-94) : MÊME résolveur que le combat naval (`rollShipCritical` →
  // `applyCrewHit`, jeu MSRC), donc UNE seule lecture de la donnée. Ce qui est CERTAIN (rames, l.82)
  // s'applique là ; ce qui est une ÉPREUVE (gréement l.78, superstructure l.94) ressort en nœud `test`
  // et part par la PORTE — bande pour les héros tenus, voie inline (journalisée) pour les autres.
  const equipage = exposedCrew(get().party);
  const resolu = rollShipCritical(location, rng, undefined, RIVER_CRIT_SET);
  if (resolu.crewHit) {
    const coup = applyCrewHit(coque, equipage, resolu.crewHit, rng);
    if (coup.hits.length) {
      set({ party: [...get().party] });
      tell([t('shipCrit.crewTakes', { n: coup.hits.length, label: resolu.label })]);
    }
    if (coup.testFlow) {
      const victimes = coup.victims.map((id) => equipage.find((c) => c.id === id)).filter(Boolean) as Combatant[];
      const bande = bandeTriggeredTest(get, set, victimes, coup.testFlow, `${idPrefix}-crew-hit`, { label: resolu.label, hull: coque });
      if (bande) insert.push(bande);
      // Voie INLINE (marin sans siège) : ses lignes partent dans la file différée — le voyage n'a pas
      // de `battle.log`, on les déverse dans SON journal (source unique `drainPendingLog`).
      const lignes = drainPendingLog(get, set).map((e) => e.text);
      if (lignes.length) { set({ party: [...get().party] }); tell(lignes); }
    }
  }
  if (crit.driftUntilRepair) set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, broken: true } } });
  if (crit.hole) insert.push(...holeBoat(get, set, plan, tell, idPrefix));
  void river;
  return insert;
}

/** Le meilleur réparateur de bateau (l.107-117) : Métier (Construction de bateaux), sinon Métier
 *  (Charpentier) à −10. Soutien LDB 12. `null` si personne. Source UNIQUE (calfatage + réparation du
 *  gréement) — rend AUSSI la DÉCLARATION du jet (`ligne`), le malus du réparateur de substitution
 *  compris : c'est ici, et nulle part ailleurs, qu'on sait quelle spécialisation a servi. */
function bestShipwright(get: Get): { actor: Combatant; value: number; ligne: BandLigne } | null {
  const build = partyAssisted(get().party, 'metier', undefined, undefined, SPEC.constructionBateaux);
  if (build) {
    return {
      actor: build.actor, value: build.value,
      ligne: { test: { skill: 'metier', spec: SPEC.constructionBateaux }, valeur: build.value, soutien: build.support },
    };
  }
  const c = partyAssisted(get().party, 'metier', undefined, undefined, SPEC.charpentier);
  if (!c) return null;
  // Réparateur de SUBSTITUTION (`MSRC 5 l.113-117`) : le −10 est DÉJÀ fondu dans la valeur jetée,
  // donc il se déclare en `dansLaValeur` — le monteur le sort de la base et le rend en chip NOMMÉE.
  const penalty = TEMPORARY_REPAIR.charpentierPenalty;
  const value = c.value + penalty;
  return {
    actor: c.actor, value,
    ligne: {
      test: { skill: 'metier', spec: SPEC.charpentier }, valeur: value, soutien: c.support,
      dansLaValeur: [{ label: specLabel('skills', 'metier', SPEC.charpentier), value: penalty, famille: 'jet' as const, ref: { category: 'skills', id: 'metier' } }],
    },
  };
}

/** Coque PERCÉE (« Y a un trou », l.101-105) : le bateau prend l'eau et coule en E minutes ; on tente une
 *  réparation temporaire (Métier Construction de bateaux/Charpentier, Complexe — l.113-117), INFLUENÇABLE
 *  (#270, `riverHoleRepair`) quand le jet du réparateur se surface — sinon inline. */
function holeBoat(get: Get, set: Set, plan: TravelPlan, tell: (l: string[]) => void, idPrefix: string): BuiltCascadeStep[] {
  tell(spoilVesselCargoOnLeak(get, set)); // la coque prend l'eau → voie d'eau gâte 1d10 Enc (lot D #327)
  const minutes = holeSinkMinutes(effectiveChar(plan.vehicle!, 'endurance')); // « coule en E minutes » (l.103)
  const repair = bestShipwright(get);
  if (repair && surfaceOf(get, repair.actor.id)) {
    tell([t('rv.holed', { min: minutes })]);
    const st = monoStep({
      id: `${idPrefix}-hole`, kind: 'riverHoleRepair', actor: repair.actor, icon: 'travel/repair',
      label: t('step.riverHoleRepair'), rollLabel: refLabel('skills', { id: 'metier' }), difficulty: TEMPORARY_REPAIR.difficulty,
      ligne: repair.ligne,
      stake: voyageStakeRef('riverHoleRepair', { minutes }),
    });
    if (st) return [st];
  }
  const rng = battleRng();
  if (repair) {
    // Repli SANS pilote humain (pas d'étape insérée ci-dessus) : aucune rangée nulle part pour ce
    // jet — le journal est la SEULE surface, il PORTE le jet (#295 Lot 5, gardé nominativement).
    const res = rollTest(repair.value, TEMPORARY_REPAIR.difficulty, rng);
    tell([t('rv.holeInline', { min: minutes, diff: DIFFICULTY_LABELS[TEMPORARY_REPAIR.difficulty], roll: res.roll, target: res.target, issue: t(res.success ? 'rv.holeSealed' : 'rv.holeFailed') })]);
    if (res.success) {
      // Réparation temporaire (l.116) : restaure 1d10 Blessures de coque.
      const healed = Math.min(plan.vehicle!.wounds.max - plan.vehicle!.wounds.current, rollExpr(TEMPORARY_REPAIR.woundsPerRepair, rng));
      healVesselHull(get, set, plan.vehicle!, healed);
      set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, holed: false } } });
      tell([t('rv.hullHolds', { n: healed })]);
      return [];
    }
  } else tell([t('rv.noCaulker')]);
  sinkBoat(get, set, tell, t('rv.sinkLeak'));
  return [];
}

/** Le bateau COULE : voyage perdu (le groupe reste au point de départ). */
function sinkBoat(get: Get, set: Set, tell: (l: string[]) => void, reason: string): void {
  tell([reason]);
  set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, sunk: true } } });
}

/** CONSÉQUENCE d'un PÉRIL de rivière (l.119-166) SURVENU, résolue selon le `kind` (`river-perils.json`).
 *  Pour `navTest` (Débris) le jet d'évitement est INFLUENÇABLE (lu dans `step.result`) ; `obstacle`
 *  (Barrage) passe par le CHOIX `riverObstacleChoice` ; `detect` GATE sa détection (#270, `riverPerilDetect`,
 *  cf. `registerCascadeApplier` ci-dessus) — sans barreur qualifié dont le jet se surface, résolution inline. */
function resolveRiverPerilConsequence(get: Get, set: Set, peril: NonNullable<ReturnType<typeof findRiverPeril>>, step: CascadeStep, rng: RNG): { consequences: Consequence[]; insert?: BuiltCascadeStep[] } {
  const plan = get().travelPlan!;
  const river = plan.river!;
  const coque = plan.vehicle!;
  const j: string[] = [];
  const insert: BuiltCascadeStep[] = [];
  const damageHull = (dmg: number, note: string) => {
    damageVesselHull(get, set, coque, dmg);
    j.push(t('rv.hullHit', { peril: peril.label, dmg, note, cur: coque.wounds.current, max: coque.wounds.max }));
  };
  if (peril.kind === 'navTest' && peril.onFail) {
    // Débris (l.125) : Test de Navigation d'évitement INFLUENÇABLE (step.result), +Savoir (l.13) → contrôle gardé.
    const res = step.result;
    const savoir = Number(step.meta?.savoir ?? 0);
    const avoided = res ? riverControlKept(res.success, res.sl, savoir) : false;
    j.push(t('rv.avoidManeuver', { peril: peril.label, issue: t(res ? (avoided ? 'rv.avoided' : 'rv.collided') : 'rv.noPilotCollision') }));
    if (!avoided) for (let i = 0; i < peril.onFail.hullHits; i++) damageHull(peril.onFail.damagePerHit, t('rv.fragCollision'));
  } else if (peril.kind === 'detect' && peril.onHit) {
    // Rochers / eaux peu profondes (l.136) : succès AUTO avec la Compétence Navigation ; sinon Agilité (+0),
    // INFLUENÇABLE (#270) si le jet se surface pour le barreur (`riverPerilDetect`).
    const pilotId = step.actorId;
    const pilot = pilotId ? get().party.find((h) => h.id === pilotId) : undefined;
    const skilled = pilot && (pilot.skills ?? []).some((s) => (s.id === 'voile' || s.id === 'ramer') && s.advances > 0);
    if (skilled) {
      j.push(t('rv.pilotKnows', { peril: peril.label }));
    } else if (pilot && surfaceOf(get, pilot.id)) {
      const st = monoStep({
        id: `${step.id}-detect`, kind: 'riverPerilDetect', actor: pilot, icon: 'nautical/snag', label: stepDetail(dataLabel(peril.label), t('step.detection')),
        rollLabel: t('char.agilite'), difficulty: 'intermediaire',
        ligne: { test: { char: 'agilite' } },
        stake: voyageStakeRef('riverPerilDetect', { damage: peril.onHit.hullDamage }),
        meta: { perilId: peril.id },
      });
      pousseSi(insert, st);
    } else {
      const detect = pilot ? rollTest(testValue(pilot, undefined, 'agilite'), 'intermediaire', rng) : { success: false };
      j.push(t('rv.detectLine', { peril: peril.label, roll: 'roll' in detect ? (detect as TestResult).roll : t('rv.fragNoRoll'), issue: t(detect.success ? 'rv.detectOk' : 'rv.detectKo') }));
      if (!detect.success) {
        const impact = resolveRiverImpact(peril.onHit, rng);
        damageHull(impact.hullDamage, '');
        if (impact.echoue) insert.push(...applyEchouageSteps(get, set, step.id, j));
        if (impact.holed) insert.push(...applyBoatCritical(get, set, plan, river, coque, 'coque', (l) => j.push(...l), rng, step.id)); // Critique coque = percée (l.88)
      }
    }
  }
  return { consequences: freeCons(j), insert: insert.length ? insert : undefined };
}

/** S'ÉCHOUER (l.97-99) : le bateau s'arrête, sa coque subit 12 Dégâts ; on le renfloue par un Test de Force
 *  « avec un malus égal au nombre total de Points d'Encombrement du bateau et de sa cargaison » (l.99). Le
 *  malus = Enc PROPRE du bateau (`VehicleData.enc`) + Enc de la CARGAISON des porteurs réels du groupe
 *  (`partyCargoTotalEnc` : bêtes/véhicules/navire, la cale fluviale du commerce MSRC 13), converti en
 *  difficulté (chaque 10 Enc ≈ un cran de −10 via
 *  `difficultyFromModifier`) ; degrade sur Intermédiaire si aucun Enc n'est connu (barge LDB `enc` null +
 *  convoi vide). Le RAW ne prévoit AUCUN délestage pour se renflouer (l.97-105 muets) → non modélisé. */
export function applyEchouage(get: Get, set: Set, tell: (l: string[]) => void): void {
  const coque = get().travelPlan!.vehicle!;
  damageVesselHull(get, set, coque, echouageDamage());
  const { difficulty, encTxt } = echouageDifficulty(get);
  // Chemin IA/synchrone (`riverEchouageForce` gate l'acteur JOUEUR ci-dessus) : aucune rangée nulle
  // part pour ce jet — le journal est la SEULE surface, il PORTE le jet (#295 Lot 5, gardé nominativement).
  const force = partyAssisted(get().party, undefined, 'force');
  const res = force ? rollTest(force.value, difficulty, battleRng()) : null;
  tell([t('rv.grounded', { dmg: echouageDamage(), suite: res ? t('rv.fragRefloat', { diff: DIFFICULTY_LABELS[difficulty], enc: encTxt, roll: res.roll, target: res.target, issue: t(res.success ? 'rv.refloatOk' : 'rv.refloatKo') }) : t('rv.fragDot') })]);
}

/** Malus/difficulté du renflouage (l.99, Enc du bateau + de la cargaison) — SOURCE UNIQUE, partagée par
 *  le renflouage IA/synchrone (`applyEchouage`) et l'étape-jet JOUEUR (`riverEchouageForce`, #270). */
function echouageDifficulty(get: Get): { difficulty: Difficulty; encTxt: string } {
  const coque = get().travelPlan!.vehicle!;
  const boatEnc = findVehicleById(coque.creatureId ?? '')?.enc ?? 0;
  const cargoEnc = partyCargoTotalEnc(get());
  const totalEnc = boatEnc + cargoEnc;
  const difficulty = totalEnc > 0 ? difficultyFromModifier(-totalEnc) : 'intermediaire';
  const encTxt: string = totalEnc > 0 ? t('rv.encMalus', { total: totalEnc, boat: boatEnc, cargo: cargoEnc }) : '';
  return { difficulty, encTxt };
}

/** ÉCHOUAGE (#270) : Dégâts fixes appliqués immédiatement (non-jetés) ; le renflouage (Test de Force)
 *  devient une étape-jet INFLUENÇABLE (`riverEchouageForce`) quand le jet de l'acteur se surface —
 *  sinon délègue à `applyEchouage` (chemin IA/synchrone inchangé). */
function applyEchouageSteps(get: Get, set: Set, idPrefix: string, j: import('./rollSeam').FreeConsLine[]): BuiltCascadeStep[] {
  const force = partyAssisted(get().party, undefined, 'force');
  if (!force || !surfaceOf(get, force.actor.id)) {
    applyEchouage(get, set, (l) => j.push(...l));
    return [];
  }
  const coque = get().travelPlan!.vehicle!;
  damageVesselHull(get, set, coque, echouageDamage());
  const { difficulty, encTxt } = echouageDifficulty(get);
  j.push(t('rv.grounded', { dmg: echouageDamage(), suite: t('rv.fragDot') }));
  const st = monoStep({
    id: `${idPrefix}-echouage`, kind: 'riverEchouageForce', actor: force.actor, icon: 'travel/repair',
    label: t('step.riverEchouage'), rollLabel: t('char.force'), difficulty,
    ligne: { test: { char: 'force' }, valeur: force.value, soutien: force.support },
    stake: voyageStakeRef('riverEchouageForce'),
    meta: { encTxt },
  });
  return st ? [st] : [];
}

/** Renflouage INFLUENÇABLE (#270, Force) — MÊME issue que `applyEchouage`, jet différé. */
registerCascadeApplier('riverEchouageForce', (_get, _set, step, hero) => {
  if (!step.result) return;
  const name = garanti(hero, step.actorId, 'renfloueur').label;
  return { consequences: freeCons([step.result.success
    ? { text: t('rv.refloatedOk', { name }), tone: 'ok' }
    : { text: t('rv.refloatedKo', { name }), tone: 'bad' }]) };
});

/** Fin de journée : horloge avancée (arrivée = +24 h ; halte = jusqu'au crépuscule), puis arrivée ou
 *  halte de nuit (la coque est déjà PERSISTÉE au coup par coup, `damageVesselHull`/`healVesselHull`,
 *  #296). L'entretien du jour se résout dans la cascade de nuit. */
function finishRiverDay(get: Get, set: Set, to: { scene: string; entry?: string; label: string }, kmDay: number, dayLines: string[]): void {
  const plan = get().travelPlan!;
  const river = plan.river!;

  // Naufrage : voyage perdu.
  if (river.sunk) {
    set({ gameTime: get().gameTime + 24 * 60, travelPlan: null });
    log(get, set, [t('rv.wreck')]);
    return;
  }

  // Vent de demain : 4 tirages (aube/midi/crépuscule/minuit, l.21).
  const nextForce = tickRiverWindDay(river.windForce, battleRng());
  const kmDone = Math.min(plan.km, plan.kmDone + kmDay);
  const arrived = plan.km - kmDone < 1e-9;
  // Horloge : à l'ARRIVÉE, la journée entière passe (+24 h) — l'entretien du jour est rattrapé par le
  // prochain `runDailyUpkeep`. Sinon (HALTE de nuit) la navigation s'arrête au crépuscule : le canon MSRC
  // ne chiffre PAS la navigation fluviale de nuit (valeur maison, cadence gouvernée par la même porte
  // aube→crépuscule que le départ, `travel-departure-gate`, #340) et la nuit de sommeil enjambe minuit :
  // UN SEUL franchissement de jour par cycle jour+nuit (comme le voyage terrestre).
  // L'ENTRETIEN n'est jamais roulé ici (sinon la Faim s'installe avant le repas) : il se résout dans la
  // cascade de nuit (`buildNightCascade`), APRÈS `feedFromMeal`.
  set({ gameTime: get().gameTime + (arrived ? 24 * 60 : minutesUntilNext(get().gameTime, DUSK_MINUTE)) });
  set({
    travelPlan: {
      ...get().travelPlan!, kmDone,
      river: { ...river, windForce: nextForce, daysAfloat: river.daysAfloat + 1 },
    },
  });

  const recapDay: TravelRecapDay = { kmFrom: plan.kmDone, kmTo: kmDone, hours: 24, lines: toRecapLines(dayLines) };

  if (arrived) { arriveRiver(get, set, to); return; }
  const route = (get().worldMap as WorldMap)?.routes.find((r) => r.id === plan.routeId);
  // Sur la rivière on peut mouiller le long de la berge : coucher À BORD (hamacs, MDG 03 l.71) offert
  // en plus du campement/de l'auberge de la halte — la belle étoile sur la berge reste possible.
  const places = { ...placesOfKind(route?.inns ? 'auberge' : 'camp'), ...(get().vessel ? { bord: true } : {}) };
  openRest(get, set, { places, travelHalt: true, travelDay: recapDay });
}
