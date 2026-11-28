/**
 * VOYAGE FLUVIAL jour par jour (**Mort sur le Reik — Compagnon, ch.5** « Navigation fluviale », cité
 * `MSRC 7 l.<ligne>`) — la descente d'un fleuve en barge, JOUÉE au lieu d'être un simple transport payant.
 *
 * RÉUTILISATION (pas de duplication de la machinerie de voyage) : ce flux est le PENDANT FLUVIAL de
 * `seaVoyageFlow` (mer, MDG). Comme lui, il s'appuie sur la machinerie de voyage EXISTANTE — halte de nuit
 * (`ouvrirLeRepos`), entretien quotidien (`runDailyUpkeep`), coque de trajet PERSISTÉE au coup par coup
 * (`damageVesselHull`/`healVesselHull`, #296 — SOURCE UNIQUE `vessel.wounds`), récap du jour
 * (`TravelRecapDay`) — et n'écrit QUE la résolution navale du jour. Il ne réimplémente ni la boucle de
 * nuit, ni l'entretien, ni la persistance.
 *
 * DISTINCT de la mer (choix de fidélité, pas de raccourci) : MSRC 7 est un système PROPRE, plus simple que
 * MDG. Le Test de Navigation fluvial est le **barreur seul** (Voile) ou le **meilleur rameur** (Ramer), un par
 * étape (l.11-15) — PAS un Test d'équipage MDG (rôles multiples, Moral, rôle essentiel doublé, manque de bras :
 * rien de tout cela dans MSRC). On le résout donc comme le sibling maritime résout SON test de barreur unique
 * (Forcer le rythme) : INLINE, meilleur pilote avec Soutien (LDB 12, `partyAssisted`), remonté dans le récap de
 * la halte de nuit — la même présentation que les jets de bord du voyage maritime. La table des vents,
 * le chavirage et les Critiques de bateau sont propres au fleuve (`engine/riverNavigation.ts`).
 *
 * EXPOSITION HYDRIQUE (MSRC 16 l.5-13) : un tirage d'auteur par étape (`MapRoute.riverExposure`) pose le
 * Test d'Exposition par la couture de l'Effet de scène (`combatEffects.openWaterExposure`), sous le `kind`
 * propre à la descente (`fleuveExposition`) ; tables hydriques : `engine/waterExposure.ts`.
 */
import type { IconId } from '../data/schemas/icons';
import type { PlayerText } from '../i18n/playerText';
import { battleRng } from './battleRng';
import { minutesUntilNext, duskMinute, MINUTES_PER_DAY } from '../engine/clock';
import { effectTargets, etapesDExpositionHydrique } from './combatEffects';
import { ouvrirLeRepos, placesOfKind, routeLieu } from './restFlow';
import { estBateauFluvial, placeById, type MapPlace, type MapRoute, type WorldMap } from './worldMap';
import { arriverAuLieu } from './lieuFlow';
import { estLeNavireDeCampagne, lierLaCoqueDeCampagne } from './monde/coqueDeCampagne';
import { bandesDeContagion } from './contagion';
import { calculerLesTestsDExposition } from './expositionAMaladie';
import { porteursABord } from './shipCrew';
import {
  damageVesselHull,
  healVesselHull,
  syncHullWoundsFromVessel,
  spoilVesselCargoOnLeak,
  reparationTemporaireFluviale,
  reparationTemporaireTient,
  appliquerLaReparationTemporaire,
  poserLaReparationTemporaire,
} from './seaVoyageFlow';
import { rule } from '../engine/policy';
import { baseHoursPerDay, finishRecap, segmentDuVoyage, stepRecapLines } from './travelFlow';
import type { TravelPlan, TravelRecapDay } from './travelFlow';
import type { TravelMode } from '../engine/travel';
import { vehicleCombatant } from '../engine/vehicle';
import { propulsionDuNavire, type PropulsionDuNavire } from '../engine/shipBuild';
import { refCouvre, type RefDesignee } from '../data/schemas/grammaire/ref';
import { voyageStakeRef, findVehicleById, refLabel } from '../data';
import type { StakeRef } from '../data';
import { partyCargoTotalEnc, nomDuNavire } from './carriers';
import { partyAssisted, possesses, refusPersonneNePeutTenter } from '../engine/skills';
import { maxBy } from '../engine/pick';
import { rollTest, ECHEC_SANS_JET, type TestResult } from '../engine/tests';
import type { ModLine } from '../engine/combat';
import { RULE_REF } from '../engine/ruleRefs';
import { testValue, type TestDesigne } from '../engine/skills';
import { deMonde, tirer, type RNG } from '../engine/dice';
import { strandingPenaltyLine } from '../engine/seaPerils';
import { effectiveChar } from '../engine/characteristics';
import {
  rollRiverWind, tickRiverWindDay, riverWindEffect, savoirVoiesFluvialesBonus,
  riverDayKm, riverDriftKm, navPenaltyMods,
  driftNavPenalty, driftPctOfSpeed, OUT_OF_CONTROL,
  riverControlKept, capsizeRightDifficulty, capsizeRightCumulative, capsizeSinkTurns, holeSinkMinutes, riverCritical, findRiverPeril,
  resolveRiverImpact, rollBarrage, rollBarrageClearing, echouageDamage, navBaseDifficulty, tackDifficulty,
  CAPSIZE, TEMPORARY_REPAIR, riverForceLabel,
} from '../engine/riverNavigation';
import type { RiverWindDirId } from '../data/schemas/defs/river-navigation';
import { DIFFICULTY_LABELS, type Combatant, type Difficulty, type VehicleData } from '../engine/types';
import { jouerLaJournee, type CascadeApplier } from './cascade';
import { checkPartyWiped } from './partyWipe';
import { composeRollLabel, monoStep, choiceStep, displayStep, refusePorte, surfaceOf, pousseSi, worldStep, type LigneNommee } from './rollSeam';
import type { BuiltCascadeStep } from './stepBrand';
import { actorIn, equipageApte } from './monde/combatants';
import { garanti } from '../lib/garanti';
import { traverseeCommandee, DEFAULT_VOYAGE_ORDERS, type VoyageCadence, type VoyageOrders } from './voyageCadence';
import { WORLD_STEP_OWNER, type CascadeStep, type CascadeStepMeta, type PendingCascade } from './pendings';
import type { Get, Set } from './flowTypes';
import { dataLabel } from '../data';
import { t } from '../i18n';
import { shipLocationLabel, rollShipCritical, applyCrewHit, exposedCrew } from '../engine/shipCritical';
import { RIVER_CRIT_SET } from '../data/shipCriticals';
import { bandeTriggeredTest } from './combat/triggeredTest';
import { drainPendingLog } from './combatEffects';
import { stepDetail, stepPrecision } from './rollSeam';
import type { FragmentDeTables, GenreDEtape, PartDeTable } from './tablesPosees';
import type { Jeu } from './etat';
import { nomDe } from '../engine/nom';
import { ligneDeTexte, type EntreeDuJournal } from '../engine/journal';
import { type Applique } from '../engine/faits';

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
  (loc === 'avirons' ? t('fleuve.localisationRames') : shipLocationLabel(loc));

/** État FLUVIAL d'un TravelPlan (route `river`) — persiste avec le plan. */
export interface RiverVoyageState {
  /** Force du vent (ticke 4×/jour, l.21). */
  windForce: string;
  /** Direction RELATIVE (fixée en début de voyage, l.21). */
  windDir: RiverWindDirId;
  daysAfloat: number;
  /** Bateau hors de contrôle (gréement en péril, note 5 l.41) : dérive + Nav −20 jusqu'à réparation. */
  horsDeControle?: boolean;
  /** Gréement/avirons brisés (Critique `driftUntilRepair`, l.78-82) : dérive jusqu'à réparation. */
  broken?: boolean;
  /** Coque percée (« Y a un trou », l.101) — sink différé si non calfatée. */
  holed?: boolean;
  /** Coque tenue par une réparation temporaire (calfatage réussi). MSRC 7 l.117 */
  reparationTemporaire?: true;
  /** Le bateau a coulé (chavirage non redressé, ou coque percée non calfatée) : voyage perdu. */
  sunk?: boolean;
  /** CONTEXTE TRANSITOIRE du jour EN COURS (posé par `buildRiverDayCascade`, lu et effacé par
   *  `continueRiverDayAfterCascade`) : les entrées de vitesse de la journée que le calcul de km lit
   *  à la clôture de la cascade du jour. Aucune règle propre : les variables du jour
   *  (baseKm/pourcentageDuVent/drift) y sont mises de côté pour être relues après les jets
   *  influençables. Jamais persisté au-delà d'une journée. */
  day?: RiverDayContext;
  /** Facteur de progression du jour EN COURS (déblaiement d'un barrage, MSRC 7 l.128), posé par l'applier
   *  `fleuveChoixDObstacle`, lu à la clôture pour les km — transitoire comme `day`. Défaut 1. */
  dayAgilityFactor?: number;
  /** La journée close, figée pendant l'Exposition hydrique (`exposition`) puis pendant les Tests de Contraction
   *  (`contagion`) : chaque cascade close du jour y verse ses lignes (`stepRecapLines`). */
  pendingFinish?: { etape: 'exposition' | 'contagion'; jour: TravelRecapDay };
}

/** Instantané d'un jour fluvial clos (#4574) : le vent du jour (MSRC 7 l.21), sa part de vitesse ou la dérive qui a
 *  fait ses km, et le barreur ou le réparateur de gréement qui ont manqué. */
export interface RiverRecapChrome {
  vent: { force: string; direction: RiverWindDirId };
  pourcentageDuVent: number;
  derive: boolean;
  sansBarreur?: true;
  sansReparateur?: true;
}

/** Entrées de VITESSE d'une journée fluviale, figées au build de la cascade du jour (vent) et
 *  complétées par les appliers (dérive de perte de contrôle, louvoyage manqué → pourcentageDuVent annulé).
 *  Le km final = `riverDayKm(baseKm, pourcentageDuVent, agilityFactor)` ou `riverDriftKm(baseKm)` si dérive —
 *  EXACTEMENT le calcul de l'ancien `resolveRiverDay`. */
export interface RiverDayContext {
  baseKm: number;
  /** % de vitesse du vent (Tableau des vents) — annulé par un louvoyage manqué (`fleuveVirementDeBord`). */
  pourcentageDuVent: number;
  /** Dérive DÉJÀ certaine à l'ouverture (Calme/hors de contrôle/gréement brisé) — les appliers la
   *  forcent aussi (perte de contrôle, chavirage, gréement en péril). */
  forceDrift: boolean;
  /** Le vent impose un louvoyage (Modéré/Fort de côté) : le `pourcentageDuVent` n'est acquis qu'avec `fleuveVirementDeBord` réussi. */
  louvoyage?: boolean;
  /** Personne ne peut tenter la Navigation du jour. LDB 09 l.30 */
  sansBarreur?: true;
  /** Gréement ou avirons brisés sans personne pour les réparer. MSRC 7 l.78-82 */
  sansReparateur?: true;
}

const log = (get: Get, _set: Set, lines: EntreeDuJournal[]) => {
  if (lines.length) get().ecrireAuJournal(lines);
};

/** Coque de campagne (Blessures persistées, #30) ou coque du mode choisi (MSRC 07 l.172-178). */
function riverHull(vessel: Jeu['vessel'], ficheDeRoute: VehicleData): Combatant | null {
  const ficheDeCampagne = vessel && findVehicleById(vessel.vehicleId);
  const profilDeCampagne = ficheDeCampagne?.ship && ficheDeCampagne.hull ? ficheDeCampagne : undefined;
  const navire = profilDeCampagne ? vessel : undefined;
  const coque = vehicleCombatant(profilDeCampagne ?? ficheDeRoute, navire?.uid, 'fluvial');
  if (!coque) return null;
  if (navire) {
    lierLaCoqueDeCampagne(coque, navire);
    coque.label = nomDuNavire(navire);
    syncHullWoundsFromVessel(coque, navire);
    coque.upgrades = navire.upgrades ? [...navire.upgrades] : undefined;
  }
  return coque;
}

/** Un « batelier » : un PJ vivant qui a augmenté la `competence` de Navigation du bateau (MSRC 5 l.11-17),
 *  Spécialisation sœur comprise (`possesses`, LDB 09 l.571). Sans batelier, on paie un passeur (repli
 *  transport payant côté `partirEnVoyage`). */
export function hasBatelier(party: Combatant[], competence: RefDesignee): boolean {
  return party.some((h) => !h.dead && aAugmente(h, competence));
}

/** `c` a-t-il augmenté `competence` (LDB 09 l.30, l.571) ? PUR. */
function aAugmente(c: Combatant, competence: RefDesignee): boolean {
  return possesses(c, competence) && (c.skills ?? []).some((s) => refCouvre({ id: competence.id }, s) && s.advances > 0);
}

/** Coque de la descente jouable avec le pilote de sa Compétence (MSRC 07 l.11-17, l.74, l.90). */
export function coqueDeDescente(s: Pick<Jeu, 'party' | 'vessel' | 'lieu'>, route: MapRoute, mode: TravelMode): Combatant | null {
  if (!route.river || !route.modes.includes(mode) || mode === 'pied' || mode === 'monture' || mode === 'mer') return null;
  const fiche = findVehicleById(mode);
  if (!fiche?.ship || !fiche.hull) return null;
  const { vessel } = s;
  const amarreAilleurs = vessel?.escale !== undefined && vessel.escale !== s.lieu && estBateauFluvial(vessel);
  const coque = riverHull(amarreAilleurs ? null : vessel, fiche);
  return coque && hasBatelier(s.party, riverNavSkill(coque)) ? coque : null;
}

/** MSRC 07 l.172-178 ; LDB 51 l.178. */
export function vitesseDeDescente(route: MapRoute, mode: TravelMode, coque: Combatant): number {
  return route.speed?.[mode] ?? riverPropulsion(coque).m;
}

export function buildRiverPlan(get: Get, routeId: string, fromPlaceId: string, toPlaceId: string, route: MapRoute, mode: TravelMode, opts: { cadence?: VoyageCadence } = {}): TravelPlan | null {
  const coque = coqueDeDescente(get(), route, mode);
  if (!coque) return null;
  const wind = rollRiverWind(battleRng());
  const orders: VoyageOrders = { cadence: opts.cadence ?? DEFAULT_VOYAGE_ORDERS.cadence };
  return {
    routeId, fromPlaceId, toPlaceId, mode, hoursPerDay: 24, km: route.km, kmDone: 0, interrupted: false,
    orders,
    vehicle: coque,
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
  if (plan.km - plan.kmDone < 1e-9) { arriveRiver(get, set, to, []); return; }
  resolveRiverDay(get, set, route);
}

/** L'accostage à `to` : le récit du segment (`finishRecap`) porte ses journées `jours`, comme une arrivée à terre. */
function arriveRiver(get: Get, set: Set, to: MapPlace, jours: TravelRecapDay[]): void {
  const { travelPlan, vessel } = get();
  const plan = garanti(travelPlan, to.id, 'descente qui accoste');
  const accoste = vessel && estBateauFluvial(vessel) && estLeNavireDeCampagne(plan.vehicle, vessel);
  set({ travelPlan: null, ...(accoste ? { vessel: { ...vessel, escale: to.id } } : {}) });
  log(get, set, [ligneDeTexte(t('fleuve.accostage', { to: to.label }))]);
  finishRecap(get, set, segmentDuVoyage(plan, jours), 'arrived');
  arriverAuLieu(set, to);
}

/** Meilleur pilote (barreur/rameur) de l'équipage apte avec Soutien (LDB 12) pour la Compétence de Navigation. */
function riverPilot(get: Get, competence: RefDesignee) {
  return partyAssisted(equipageApte(get().party), { skill: competence });
}

/**
 * Résout UNE journée de descente en la MISE EN SCÈNE d'une CASCADE influençable (purpose `travelDay`) :
 * TOUS les jets du jour (Navigation, Louvoyage, sauvegardes vitales, évitement des
 * périls) deviennent des ÉTAPES `CascadeStep` (Lancer → Chance/Pacte/Résilience → Valider) au lieu
 * d'être auto-résolus inline. La CONSÉQUENCE de chaque étape vit dans la table `appliers`
 * fluvial (helpers PURS de `riverNavigation.ts`, zéro duplication de formule) qui mute le héros et/ou
 * la coque (`travelPlan.vehicle`) et/ou l'état fluvial. À la clôture de la cascade (`combatSlice`
 * → `continueRiverDayAfterCascade`), le store calcule les km du jour à partir des résultats d'étape
 * — SEUL endroit où ils se calculent — puis enchaîne la halte de nuit ou l'arrivée.
 */
function resolveRiverDay(get: Get, set: Set, route: MapRoute): void {
  const { steps, log: lines } = buildRiverDayCascade(get, set, route);
  for (const l of lines) log(get, set, [l]);
  if (!steps.length) {
    // Aucun jet influençable (bateau coulé d'entrée, personne à la barre) : on finalise directement,
    // comme la cascade le ferait à sa clôture — défaite hors combat comprise (`checkPartyWiped`).
    if (!checkPartyWiped(get, set)) continueRiverDayAfterCascade(get, set);
    return;
  }
  // Traversée sous ordres (`voyageCadence.traverseeCommandee`, #91, #2545) : aucun arrêt.
  jouerLaJournee(get, set, steps, { title: t('fleuve.titreDeLaJournee'), purpose: 'travelDay' }, traverseeCommandee(get()));
}

/** Test de Navigation du jour : sa Difficulté (le Test est demandé par MSRC 7 l.15, sans Difficulté
 *  énoncée — défaut Intermédiaire +0, LDB 12 l.148) et ses MALUS NOMMÉS (dérive l.38,
 *  hors de contrôle l.41) — SOURCE UNIQUE, partagée par le build de l'étape Nav et l'évitement de
 *  péril `navTest`. Les malus ne sont PAS des Difficultés : ils se lisent en chips sur la ligne. */
function riverNavTest(river: RiverVoyageState, eff: ReturnType<typeof riverWindEffect>): { difficulty: Difficulty; mods: ModLine[] } {
  return {
    difficulty: navBaseDifficulty(),
    mods: navPenaltyMods({ derive: !!eff.derive || !!river.broken, horsDeControle: !!river.horsDeControle }),
  };
}

/** Une étape-JET fluviale prête à influencer : la Difficulté est comprise dans `target` ET portée en
 *  DONNÉE de l'étape (`difficulty`) — la ligne de jet la DIT, l'affichage ne la devine pas. La LIGNE
 *  (base nue + toutes ses composantes nommées + cible + écrêtage) et la POSSESSION sont posées par le
 *  mint : ce monteur fluvial ne calcule rien, il DÉCLARE (`LigneNommee`) et habille. */
function riverStep(
  id: string, kind: GenreDEtape, actor: Combatant, label: PlayerText, icon: IconId, rollLabel: string,
  ligne: LigneNommee, difficulty: Difficulty, meta: CascadeStepMeta | undefined,
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
  return refLabel('skills', riverNavSkill(get().travelPlan?.vehicle));
}

/** Compétence de Navigation de la coque `hull` (MSRC 7 l.11-13), par sa propulsion FLUVIALE que le schéma de
 *  véhicule garantit (`propulsionDuNavire`, MDG 12 l.131). PUR. */
function riverNavSkill(hull: Combatant | undefined): RefDesignee {
  return riverPropulsion(hull).competence;
}

/** Propulsion FLUVIALE de la coque `hull` (MSRC 12 l.255). PUR. */
function riverPropulsion(hull: Combatant | undefined): PropulsionDuNavire {
  return garanti(propulsionDuNavire(hull?.creatureId, hull?.upgrades, 'fluvial'), hull?.creatureId, 'propulsion de l’embarcation');
}

/**
 * Construit les ÉTAPES influençables du JOUR (dans l'ORDRE de résolution RAW : réparation →
 * Navigation → Louvoyage → sauvegardes de vent → périls). Pose le CONTEXTE de vitesse transitoire
 * (`river.day`) que la clôture relira pour les km. Renvoie aussi les lignes de journal d'ambiance
 * (vent du jour) déjà connues. Consomme ZÉRO RNG (les jets vivent dans les étapes / appliers).
 */
export function buildRiverDayCascade(get: Get, set: Set, route: MapRoute): { steps: BuiltCascadeStep[]; log: EntreeDuJournal[] } {
  const plan = get().travelPlan!;
  const river = plan.river!;
  const worldMap = get().worldMap as WorldMap;
  const coque = plan.vehicle!;
  const steps: BuiltCascadeStep[] = [];
  const logs: EntreeDuJournal[] = [];

  const eff = riverWindEffect(river.windForce, river.windDir);
  // MSRC 7 l.21
  logs.push(ligneDeTexte(t('fleuve.ventDuJour', {
    // La FORCE passe par la DONNÉE (`riverForceLabel`) : la capitaliser depuis l'id rendait « Modere ».
    force: riverForceLabel(river.windForce),
    dir: t(river.windDir === 'arriere' ? 'fleuve.ventArriere' : river.windDir === 'cote' ? 'fleuve.ventDeCote' : 'fleuve.ventContraire'),
  })));

  const baseKm = vitesseDeDescente(route, plan.mode, coque) * baseHoursPerDay(worldMap);
  const competence = riverNavSkill(coque);
  const pilot = riverPilot(get, competence);

  // CONTEXTE DE VITESSE du jour (relu à la clôture) : dérive déjà certaine (Calme/hors-contrôle/brisé),
  // % de vent, louvoyage requis. Les appliers le complètent (perte de contrôle, chavirage → dérive).
  const dayCtx: RiverDayContext = {
    baseKm, pourcentageDuVent: eff.pourcentage ?? 0, forceDrift: !!eff.derive || !!river.horsDeControle || !!river.broken,
    louvoyage: !!eff.louvoyage,
  };
  set({ travelPlan: { ...get().travelPlan!, river: { ...river, day: dayCtx } } });

  // DÉCLARATION du jet de barre, faite UNE fois : les quatre étapes de barre et l'évitement de péril
  // testent la MÊME grandeur (même barreur, même Compétence, même Soutien) — seuls la Difficulté et
  // les modificateurs de situation changent.
  const pilotLigne: LigneNommee | undefined = pilot
    ? { test: { skill: competence }, valeur: pilot.value, soutien: pilot.support }
    : undefined;

  // MSRC 7 l.117
  pousseSi(steps, reparationTemporaireDuBateau(get, `fleuve-jour-${river.daysAfloat}`));

  // 1. Réparation du gréement/avirons brisés d'une étape précédente (l.78-82 / note 5), réparation temporaire (l.115) : rend le contrôle.
  if ((river.broken || river.horsDeControle)) {
    const repair = bestShipwright(get);
    if (repair) pousseSi(steps, riverStep('river-repair', 'fleuveReparationDeCommande', repair.actor, t('step.riverRepair'), 'voyage/reparer',
      refLabel('skills', { id: 'metier' }), repair.ligne, reparationTemporaireDifficulty(), undefined,
      { stake: voyageStakeRef('fleuve-reparation-greement', { malusDeDerive: driftNavPenalty(), malusHorsDeControle: OUT_OF_CONTROL.navPenalty }) }));
    else { logs.push(ligneDeTexte(t('fleuve.greementSansReparateur'))); patchDay(get, set, { sansReparateur: true }); }
  }

  // 2. NAVIGATION de l'étape (l.15) : barreur seul (Voile) / meilleur rameur (Ramer), +Savoir (l.13).
  //    Les malus de dérive/hors-contrôle sont RÉÉVALUÉS dans l'applier après la réparation.
  if (pilot) {
    const savoir = savoirVoiesFluvialesBonus(pilot.actor);
    const navTest = riverNavTest(river, eff);
    pousseSi(steps, riverStep('fleuve-navigation', 'fleuveNavigation', pilot.actor, composeRollLabel(undefined, t('step.navigation'), { skill: competence }), 'voyage/navire-a-voile',
      refLabel('skills', competence), { ...pilotLigne!, surLaCible: navTest.mods }, navTest.difficulty, { savoir },
      { stake: voyageStakeRef('fleuve-navigation', { driftKm: Math.round(riverDriftKm(baseKm)), driftPct: driftPctOfSpeed() }) }));
  } else {
    // Personne ne peut tenter la Navigation : ÉCHEC sans jet, conséquence de l'échec (LDB 09 l.30 ; #2588 Q1).
    logs.push(ligneDeTexte(refusPersonneNePeutTenter({ skill: competence })), ligneDeTexte(t('fleuve.sansBarreur')));
    patchDay(get, set, { forceDrift: !riverControlKept(ECHEC_SANS_JET.success, ECHEC_SANS_JET.sl, 0), sansBarreur: true });
  }

  // 3. LOUVOYAGE (note 3, l.39) : le +% de vent de côté Modéré/Fort n'est acquis qu'avec un Test réussi.
  if (eff.louvoyage && pilot) pousseSi(steps, riverStep('fleuve-louvoyage', 'fleuveVirementDeBord', pilot.actor, t('step.fleuveVirementDeBord'), 'nautique/louvoyage',
    refLabel('skills', competence), pilotLigne!, tackDifficulty(), { savoir: savoirVoiesFluvialesBonus(pilot.actor) },
    { stake: voyageStakeRef('fleuve-louvoyage', { pourcentageDuVent: eff.pourcentage ?? 0 }) }));

  // 4. Sauvegardes de VENT (l.40-41).
  if (eff.risqueDeChavirage) {
    // `pilotValue` = la valeur FONDUE du barreur, portée en DONNÉE : le redressement qui suit un
    // chavirage (`fleuveChavirage` → `rightingStep`) en dérive sa cible, et la `base` de l'étape est nue.
    if (pilot) pousseSi(steps, riverStep('fleuve-chavirage', 'fleuveChavirage', pilot.actor, t('step.fleuveChavirage'), 'nautique/vent',
      refLabel('skills', competence), pilotLigne!, CAPSIZE.removeSailDifficulty,
      { savoir: savoirVoiesFluvialesBonus(pilot.actor), pilotValue: pilot.value },
      { stake: voyageStakeRef('fleuve-chavirage', { rounds: Math.max(1, capsizeSinkTurns(effectiveChar(coque, 'endurance'))) }) }));
    else { sinkBoat(get, set, (l) => logs.push(...l), t('fleuve.chavirageSansBarreur')); }
  }
  if (eff.risqueDeGreement) {
    if (pilot) pousseSi(steps, riverStep('fleuve-preserver-greement', 'fleuveGreement', pilot.actor, t('step.fleuveGreement'), 'nautique/vent',
      refLabel('skills', competence), pilotLigne!, CAPSIZE.removeSailDifficulty, { savoir: savoirVoiesFluvialesBonus(pilot.actor) },
      { stake: voyageStakeRef('fleuve-preserver-greement', { malusHorsDeControle: OUT_OF_CONTROL.navPenalty }) }));
    else { steps.push(...applyBoatCriticalNoPilot(get, set, coque, (l) => logs.push(...l))); }
  }

  // 5. PÉRILS de rivière (l.119-166) — un pas de VÉRIFICATION d'occurrence par péril d'auteur (affichage
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
      id: `river-peril-${i}`, kind: 'fleuveTestDePeril' as const, icon: 'interface/attention' as const, label: dataLabel(peril.label),
      meta: { perilId: spawn.perilId, chancePct: spawn.chancePct, savoir: pilot ? savoirVoiesFluvialesBonus(pilot.actor) : 0,
        hasPilot: !!pilot,
        navDerive: !!eff.derive || !!river.broken, navHorsDeControle: !!river.horsDeControle,
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
function applyBoatCriticalNoPilot(get: Get, set: Set, coque: Combatant, tell: (l: EntreeDuJournal[]) => void): BuiltCascadeStep[] {
  tell([ligneDeTexte(t('fleuve.greementSansBarreur'))]);
  const insert = applyBoatCritical(get, set, get().travelPlan!, get().travelPlan!.river!, coque, 'greement', tell, battleRng(), 'river-rigging-nopilot');
  set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, horsDeControle: true } } });
  tell([ligneDeTexte(t('fleuve.horsDeControle'))]);
  return insert;
}

/** Les lignes de la cascade close `done` (`stepRecapLines`) ; aucune sans elle. */
const lignesDuJour = (done: PendingCascade | undefined) => done?.participants.flatMap(stepRecapLines) ?? [];

/**
 * Clôture de la CASCADE du jour (finalisation `purpose:'travelDay'`, appelée par le store) : recalcule
 * la PROGRESSION du jour à partir du contexte de vitesse (`river.day`, alimenté par les étapes/appliers)
 * par `riverDriftKm` / `riverDayKm` (helpers PURS, source unique), fige la journée (`TravelRecapDay` : les lignes
 * de `done` et son instantané `RiverRecapChrome`) — puis résout l'exposition hydrique et enchaîne halte de nuit /
 * arrivée (`finishRiverDay`). Efface le contexte transitoire. `done` : la cascade `travelDay` close, absente quand
 * le jour n'a produit aucune étape.
 */
export function continueRiverDayAfterCascade(get: Get, set: Set, done?: PendingCascade): void {
  const plan = get().travelPlan;
  if (!plan?.river) return;
  const river = plan.river;
  const ctx = river.day;
  const worldMap = get().worldMap as WorldMap;
  const route = worldMap?.routes.find((r) => r.id === plan.routeId);
  const to = worldMap ? placeById(worldMap, plan.toPlaceId) : undefined;
  if (!route || !to) { set({ travelPlan: null }); return; }

  const sunk = !!river.sunk;
  const baseKm = ctx?.baseKm ?? 0;
  const kmDay = sunk ? 0
    : ctx?.forceDrift ? riverDriftKm(baseKm)
    : riverDayKm(baseKm, ctx?.pourcentageDuVent ?? 0, river.dayAgilityFactor ?? 1);
  if (!sunk) log(get, set, [ligneDeTexte(t('fleuve.progression', { km: Math.round(kmDay), note: ctx?.forceDrift ? t('fleuve.fragmentDeDerive') : (ctx?.pourcentageDuVent ? t('fleuve.fragmentDeVent', { pct: `${ctx.pourcentageDuVent >= 0 ? '+' : ''}${ctx.pourcentageDuVent}` }) : t('fleuve.fragmentDePoint')) }))]);

  const jour: TravelRecapDay = {
    kmFrom: plan.kmDone, kmTo: Math.min(plan.km, plan.kmDone + kmDay), hours: 24, lines: lignesDuJour(done),
    river: {
      vent: { force: river.windForce, direction: river.windDir }, pourcentageDuVent: ctx?.pourcentageDuVent ?? 0, derive: !!ctx?.forceDrift,
      ...(ctx?.sansBarreur ? { sansBarreur: true } : {}), ...(ctx?.sansReparateur ? { sansReparateur: true } : {}),
    },
  };
  // La journée est FIGÉE avant le dé d'Exposition, et le contexte transitoire du jour effacé (jamais persisté au-delà
  // de la journée) : la halte ou l'arrivée se rejoue depuis ce point figé (`continueRiverDayAfterExposure`), que le dé
  // ouvre une fenêtre ou se résolve d'un trait (#344).
  set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, day: undefined, dayAgilityFactor: undefined, pendingFinish: { etape: 'exposition', jour } } } });
  if (!ouvrirLExpositionDuJour(get, set, route, sunk)) continueRiverDayAfterExposure(get, set);
}

/** Reprise après l'Exposition hydrique (`exposition`), puis après les Tests de Contraction (`contagion`) : la
 *  cascade close `done` verse ses lignes à la journée figée. */
export function continueRiverDayAfterExposure(get: Get, set: Set, done?: PendingCascade): void {
  const plan = get().travelPlan;
  const river = plan?.river;
  const fin = river?.pendingFinish;
  if (!plan || !river || !fin) return;
  const worldMap = get().worldMap as WorldMap;
  const route = worldMap?.routes.find((r) => r.id === plan.routeId);
  const to = worldMap ? placeById(worldMap, plan.toPlaceId) : undefined;
  if (!route || !to) { set({ travelPlan: null }); return; }
  const jour: TravelRecapDay = { ...fin.jour, lines: [...fin.jour.lines, ...lignesDuJour(done)] };
  if (fin.etape === 'exposition') {
    finishRiverDay(get, set, jour);
    return;
  }

  set({ travelPlan: { ...plan, river: { ...river, pendingFinish: undefined } } });
  if (plan.km - plan.kmDone < 1e-9) { arriveRiver(get, set, to, [jour]); return; }

  // MDG 03 l.71
  const places = { ...placesOfKind(route.inns ? 'auberge' : 'camp'), ...(get().vessel ? { bord: true } : {}) };
  ouvrirLeRepos(get, set, { places, lieu: routeLieu(plan), travelHalt: true, travelDay: jour });
}

/**
 * EXPOSITION HYDRIQUE d'une étape (MSRC 16, l.5-13) : tirage d'auteur (`MapRoute.riverExposure`) dont la réussite
 * insère le Test d'Exposition (kind `fleuveExposition`) de TOUT le groupe dans sa cascade. Sautée si le bateau a
 * coulé ; rend `false` quand rien ne se tire.
 *
 * Le d100 d'auteur est un dé de MONDE (`worldStep`, évaluation `'seuil'` : `dé ≤ chancePct`, ni bande ni DR) : il
 * DÉCIDE si l'Exposition a lieu. Il se joue après la cascade du jour comme une journée de route (`jouerLaJournee`),
 * sous le purpose `riverExposure` dont la clôture (`dispatchCascadeDone`) reprend la fin du jour
 * (`continueRiverDayAfterExposure`, #344), jamais une interruption de trajet.
 */
function ouvrirLExpositionDuJour(get: Get, set: Set, route: MapRoute, sunk: boolean): boolean {
  const ex = route.riverExposure;
  if (!ex || sunk) return false;
  const actionLabel = t('fleuve.libelleDExposition');
  jouerLaJournee(get, set, [worldStep({
    id: RIVER_EXPOSURE_KIND, kind: RIVER_EXPOSURE_KIND,
    label: composeRollLabel(undefined, actionLabel, {}), rollLabel: actionLabel,
    cible: Math.max(0, Math.min(100, ex.chancePct)),
    verdict: { reussite: t('seuil.expose'), echec: t('seuil.nonExpose') },
    meta: { exposureMode: ex.mode, exposureSource: ex.source },
  })], { title: actionLabel, purpose: 'riverExposure' }, traverseeCommandee(get()));
  return true;
}

const RIVER_EXPOSURE_KIND = 'fleuveExpositionTirage';

function controlLabel(kept: boolean, success: boolean): string {
  if (success) return t('fleuve.controleGarde');
  return t(kept ? 'fleuve.controleRattrape' : 'fleuve.controlePerdu');
}

/** Patche le contexte du jour (`river.day`) — SOURCE UNIQUE de ses mutations, depuis la construction du jour
 *  (personne à la barre ni pour réparer) et depuis un applier (perte de contrôle, louvoyage manqué, chavirage → dérive). */
function patchDay(get: Get, set: Set, patch: Partial<RiverDayContext>): void {
  const river = get().travelPlan?.river;
  if (!river?.day) return;
  set({ travelPlan: { ...get().travelPlan!, river: { ...river, day: { ...river.day, ...patch } } } });
}

// ── APPLIERS des étapes du JOUR fluvial (purpose `travelDay`) : conséquence RAW par `kind`, via les
//    helpers PURS de `riverNavigation.ts` (zéro duplication de formule). Chaque applier lit `step.result`
//    (jet influencé) et mute le héros / la coque (`travelPlan.vehicle`) / l'état fluvial / le contexte
//    de vitesse du jour. Ordre de résolution = ordre des étapes construites (parité RNG avec l'inline).

/** Étape-JET de redressement du Round `round` (0 = le premier) d'un bateau renversé (MSRC 7 l.40) :
 *  Navigation Accessible, malus −5 par Round déjà échoué porté en chip NOMMÉE. Le redressement EST un
 *  Test de Navigation (`MSRC 7 note 4` : « un seul Test de Navigation Accessible (+20) par Round pour
 *  essayer de redresser le bateau ») : le barreur et son Soutien se re-résolvent ici, et le +1 DR de
 *  Savoir (Voies fluviales, l.13) se résout AU DR dans l'applier (`riverControlKept`), pas dans la cible. */
function rightingStep(get: Get, source: CascadeStep, round: number, be: number): BuiltCascadeStep | undefined {
  const rounds = Math.max(1, be); // plancher : au moins UNE tentative (parité avec le nb de Rounds joués)
  const penalty = round * capsizeRightCumulative();
  // Le barreur est RE-RÉSOLU ici (acteur + Soutien du moment) : la ligne se remonte par le monteur
  // canonique, jamais transportée d'étape en étape. Le −5 cumulatif du Round courant est un
  // modificateur DE CIBLE (l.40) : déclaré en `surLaCible`, il ne s'empile pas d'un Round à l'autre.
  const competence = riverNavSkill(get().travelPlan?.vehicle);
  const pilot = riverPilot(get, competence);
  const savoir = pilot ? savoirVoiesFluvialesBonus(pilot.actor) : Number(source.meta?.savoir ?? 0);
  const cumul = penalty
    ? [{ label: t('fleuve.cumulDeRedressement', { n: round + 1 }), value: penalty, famille: 'circonstance' as const, ref: RULE_REF['navigation-chavirage'] }]
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
    id: `${source.id}-right-${round}`, kind: 'fleuveRedressement', actor: porteur, icon: 'nautique/louvoyage',
    label: stepDetail(t('step.fleuveRedressement'), t('step.round', { n: round + 1, total: rounds })),
    rollLabel: source.rollLabel ?? t('fleuve.navigation'),
    difficulty: capsizeRightDifficulty(),
    stake: voyageStakeRef('fleuve-redressement', { nextPenalty: (round + 1) * capsizeRightCumulative(), rounds: rounds }),
    meta: { rightRound: round, rightRounds: rounds, savoir },
    // Barreur en poste : sa valeur SOUTENUE se décompose. Plus de barreur éligible (mort, débarqué) :
    // la valeur figée à la construction tient lieu de seuil, DÉCLARÉE comme venant d'une autre formule
    // (`valeurEtrangere`) — sans Test nommé dans la ligne, le monteur n'a RIEN à décomposer et rend la
    // valeur en base (`testValueSplit` : « rien à décomposer » dès qu'aucune compétence ni
    // caractéristique n'est déclarée), porteur nommé ou non ; l'étape dit son `teste` (MSRC 7 note 4).
    ...(pilot
      ? { ligne: { test: { skill: competence }, valeur: pilot.value, soutien: pilot.support, ...(cumul ? { surLaCible: cumul } : {}) } }
      : { ligne: { valeur: Number(source.meta?.pilotValue ?? source.base ?? 0), valeurEtrangere: true, ...(cumul ? { surLaCible: cumul } : {}) }, teste: { skill: structuredClone(competence) } }), // #2097
  });
}

/** Applique un Coup Critique de bateau (l.72-94) : Dégâts d'éclats à l'équipage — esquive INFLUENÇABLE
 *  (#270, Initiative) quand le jet de la victime exposée se surface, sinon inline — États, dérive, ou
 *  coque percée (réparation elle-même GATÉE, `holeBoat`). Renvoie les étapes-jet à INSÉRER, propagées par
 *  l'appelant (build-time `applyBoatCriticalNoPilot` ou applier `fleuveGreement`/`fleuveDetectionDePeril`). */
function applyBoatCritical(get: Get, set: Set, plan: TravelPlan, river: RiverVoyageState, coque: Combatant, location: RiverCritLocation, tell: (l: EntreeDuJournal[]) => void, rng: RNG, idPrefix: string): BuiltCascadeStep[] {
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
    const coup = applyCrewHit(coque, equipage, resolu.crewHit, rng, get().forgerUnId);
    if (coup.hits.length) {
      set({ party: [...get().party] });
      tell([ligneDeTexte(t('shipCrit.crewTakes', { n: coup.hits.length, label: resolu.label }))]);
    }
    if (coup.testFlow) {
      const victimes = coup.victims.map((id) => equipage.find((c) => c.id === id)).filter(Boolean) as Combatant[];
      const bande = bandeTriggeredTest(get, set, victimes, coup.testFlow, `${idPrefix}-crew-hit`, { idNeuf: get().forgerUnId, rng: rng, label: resolu.label, hull: coque });
      if (bande) insert.push(bande);
      // Voie INLINE (marin sans siège) : ses lignes partent dans la file différée — le voyage n'a pas
      // de `battle.log`, on les déverse dans SON journal (source unique `drainPendingLog`).
      const lignes = drainPendingLog(get, set).map((e) => e.entree);
      if (lignes.length) { set({ party: [...get().party] }); tell(lignes); }
    }
  }
  if (crit.driftUntilRepair) set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, broken: true } } });
  if (crit.hole) insert.push(...holeBoat(get, set, plan, tell, idPrefix));
  void river;
  return insert;
}

/** Le Test de détection d'un péril du fleuve par le barreur. MSRC 7 l.136 */
const AGILITE: TestDesigne = { characteristic: 'agilite' };

/** Le meilleur réparateur de la réparation temporaire : le meilleur des deux Métiers, Construction de
 *  bateaux et Charpentier, soutenu (LDB 12) ; `null` si personne. Rend la DÉCLARATION du jet (`ligne`). MSRC 7 l.115 */
function bestShipwright(get: Get): { actor: Combatant; value: number; teste: TestDesigne; ligne: LigneNommee } | null {
  const r = maxBy([SPEC.constructionBateaux, SPEC.charpentier].flatMap((spec) => {
    const test: TestDesigne = { skill: { id: 'metier', spec } };
    const a = partyAssisted(get().party, test);
    return a ? [{ test, a }] : [];
  }), (x) => x.a.value);
  return r && { actor: r.item.a.actor, value: r.item.a.value, teste: r.item.test, ligne: { test: r.item.test, valeur: r.item.a.value, soutien: r.item.a.support } };
}

/** Difficulté des Tests de réparation temporaire (calfatage, gréement) : règle maison
 *  `fleuve-reparation-temporaire-reparation-difficulte`. MSRC 7 l.115 */
function reparationTemporaireDifficulty(): Difficulty {
  return rule('fleuve-reparation-temporaire-reparation-difficulte') as Difficulty;
}

/** Coque PERCÉE (« Y a un trou », l.101-105) : le bateau prend l'eau et coule en E minutes ; on tente une
 *  réparation temporaire (l.113-117), INFLUENÇABLE
 *  (#270, `fleuveReparationDeBreche`) quand le jet du réparateur se surface — sinon inline. */
function holeBoat(get: Get, set: Set, plan: TravelPlan, tell: (l: EntreeDuJournal[]) => void, idPrefix: string): BuiltCascadeStep[] {
  tell(spoilVesselCargoOnLeak(get, set)); // la coque prend l'eau → voie d'eau gâte 1d10 Enc (lot D #327)
  const minutes = holeSinkMinutes(effectiveChar(plan.vehicle!, 'endurance')); // « coule en E minutes » (l.103)
  const repair = bestShipwright(get);
  const difficulty = reparationTemporaireDifficulty();
  if (repair && surfaceOf(get, repair.actor.id)) {
    tell([ligneDeTexte(t('fleuve.coquePercee', { min: minutes }))]);
    const st = monoStep({
      id: `${idPrefix}-hole`, kind: 'fleuveReparationDeBreche', actor: repair.actor, icon: 'voyage/reparer',
      label: t('step.fleuveReparationDeBreche'), rollLabel: refLabel('skills', { id: 'metier' }), difficulty,
      ligne: repair.ligne,
      stake: voyageStakeRef('fleuve-calfatage', { minutes }),
    });
    if (st) return [st];
  }
  const rng = battleRng();
  if (repair) {
    // Repli SANS pilote humain (pas d'étape insérée ci-dessus) : aucune rangée nulle part pour ce
    // jet — le journal est la SEULE surface, il PORTE le jet (#295 Lot 5, gardé nominativement).
    const res = rollTest({ porteur: repair.actor.id, teste: repair.teste }, repair.value, difficulty, rng);
    tell([ligneDeTexte(t('fleuve.coquePerceeEnLigne', { min: minutes, diff: DIFFICULTY_LABELS[difficulty], roll: res.roll, target: res.target, issue: t(res.success ? 'fleuve.voieDEauColmatee' : 'fleuve.calfatageRate') }))]);
    if (res.success) {
      // Réparation temporaire (l.116) : restaure 1d10 Blessures de coque.
      const healed = Math.min(plan.vehicle!.wounds.max - plan.vehicle!.wounds.current, tirer(TEMPORARY_REPAIR.woundsPerRepair, rng));
      healVesselHull(get, set, plan.vehicle!, healed);
      set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, holed: false } } });
      poserLaReparationTemporaire(get, set); // MSRC 7 l.117
      tell([ligneDeTexte(t('fleuve.coqueTient', { n: healed }))]);
      return [];
    }
  } else tell([ligneDeTexte(t('fleuve.sansCalfat'))]);
  // MSRC 7 l.103
  sinkBoat(get, set, tell, t('fleuve.naufrageParVoieDEau'));
  return [];
}

/** Le bateau COULE : voyage perdu (le groupe reste au point de départ). */
function sinkBoat(get: Get, set: Set, tell: (l: EntreeDuJournal[]) => void, reason: string): void {
  tell([ligneDeTexte(reason)]);
  set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, sunk: true } } });
}

/** CONSÉQUENCE d'un PÉRIL de rivière (l.119-166) SURVENU, résolue selon le `kind` (`river-perils.json`).
 *  Pour `navTest` (Débris) le jet d'évitement est INFLUENÇABLE (lu dans `step.result`) ; `obstacle`
 *  (Barrage) passe par le CHOIX `fleuveChoixDObstacle` ; `detect` GATE sa détection (#270, `fleuveDetectionDePeril`,
 *  cf. la table `appliers` du module) — sans barreur qualifié dont le jet se surface, résolution inline. */
function resolveRiverPerilConsequence(get: Get, set: Set, peril: NonNullable<ReturnType<typeof findRiverPeril>>, step: CascadeStep, rng: RNG): { applique: Applique; insert?: BuiltCascadeStep[] } {
  const plan = get().travelPlan!;
  const river = plan.river!;
  const coque = plan.vehicle!;
  const j: EntreeDuJournal[] = [];
  const insert: BuiltCascadeStep[] = [];
  const damageHull = (dmg: number, note: string) => {
    damageVesselHull(get, set, coque, dmg);
    j.push(ligneDeTexte(t('fleuve.coqueTouchee', { peril: peril.label, dmg, note, cur: coque.wounds.current, max: coque.wounds.max })));
  };
  if (peril.kind === 'navigation' && peril.onFail) {
    // Débris (l.125) : Test de Navigation d'évitement INFLUENÇABLE (step.result), +Savoir (l.13) → contrôle gardé.
    const res = step.result;
    const savoir = Number(step.meta?.savoir ?? 0);
    const avoided = res ? riverControlKept(res.success, res.sl, savoir) : false;
    j.push(ligneDeTexte(t('fleuve.manoeuvreDEvitement', { peril: peril.label, issue: t(res ? (avoided ? 'fleuve.evites' : 'fleuve.collision') : 'fleuve.collisionSansBarreur') })));
    if (!avoided) for (let i = 0; i < peril.onFail.hullHits; i++) damageHull(peril.onFail.damagePerHit, t('fleuve.fragmentDeCollision'));
  } else if (peril.kind === 'perception' && peril.onHit) {
    // Rochers / eaux peu profondes (l.136) : succès AUTO avec la Compétence Navigation ; sinon Agilité (+0),
    // INFLUENÇABLE (#270) si le jet se surface pour le barreur (`fleuveDetectionDePeril`).
    const pilotId = step.actorId;
    const pilot = pilotId ? get().party.find((h) => h.id === pilotId) : undefined;
    const skilled = pilot && aAugmente(pilot, riverNavSkill(get().travelPlan?.vehicle));
    if (skilled) {
      j.push(ligneDeTexte(t('fleuve.barreurConnaitLePassage', { peril: peril.label })));
    } else if (pilot && surfaceOf(get, pilot.id)) {
      const st = monoStep({
        id: `${step.id}-detect`, kind: 'fleuveDetectionDePeril', actor: pilot, icon: 'nautique/bois-flottant', label: stepDetail(dataLabel(peril.label), t('step.detection')),
        rollLabel: t('char.agilite'), difficulty: 'intermediaire',
        ligne: { test: AGILITE },
        stake: voyageStakeRef('fleuve-peril-detection', { damage: peril.onHit.hullDamage }),
        meta: { perilId: peril.id },
      });
      pousseSi(insert, st);
    } else {
      const detect = pilot ? rollTest({ porteur: pilot.id, teste: AGILITE }, testValue(pilot, AGILITE), 'intermediaire', rng) : { success: false };
      j.push(ligneDeTexte(t('fleuve.ligneDeDetection', { peril: peril.label, roll: 'roll' in detect ? (detect as TestResult).roll : t('fleuve.fragmentSansJet'), issue: t(detect.success ? 'fleuve.detectionReussie' : 'fleuve.detectionRatee') })));
      if (!detect.success) {
        const impact = resolveRiverImpact(peril.onHit, rng);
        damageHull(impact.hullDamage, '');
        if (impact.echoue) insert.push(...applyEchouageSteps(get, set, step.id, j));
        if (impact.holed) insert.push(...applyBoatCritical(get, set, plan, river, coque, 'coque', (l) => j.push(...l), rng, step.id)); // Critique coque = percée (l.88)
      }
    }
  }
  return { applique: { lignes: j, faits: [] }, insert: insert.length ? insert : undefined };
}

/** S'ÉCHOUER (MSRC 7 l.97-99) : 12 Dégâts de coque, puis le Test de Force de renflouage. L'Enc PROPRE du
 *  bateau (MSRC 07 l.172-182) et celle de la CARGAISON des porteurs réels du groupe (`partyCargoTotalEnc`)
 *  font la pénalité. */
export function applyEchouage(get: Get, set: Set, tell: (l: EntreeDuJournal[]) => void): void {
  const coque = get().travelPlan!.vehicle!;
  damageVesselHull(get, set, coque, echouageDamage());
  const { penalite, encTxt } = echouagePenalty(get);
  // Chemin IA/synchrone (`fleuveEchouageForce` gate l'acteur JOUEUR ci-dessus) : aucune rangée nulle
  // part pour ce jet — le journal est la SEULE surface, il PORTE le jet (#295 Lot 5, gardé nominativement).
  const force = partyAssisted(get().party, FORCE_DE_RENFLOUAGE);
  const res = force ? rollTest({ porteur: force.actor.id, teste: FORCE_DE_RENFLOUAGE }, force.value, ECHOUAGE_DIFFICULTY, battleRng(), penalite?.value ?? 0) : null;
  tell([ligneDeTexte(t('fleuve.echouage', { dmg: echouageDamage(), suite: res ? t('fleuve.fragmentDeRenflouage', { diff: DIFFICULTY_LABELS[ECHOUAGE_DIFFICULTY], enc: encTxt, roll: res.roll, target: res.target, issue: t(res.success ? 'fleuve.renflouageReussi' : 'fleuve.renflouageRate') }) : t('fleuve.fragmentDePoint') }))]);
}

/** MSRC 7 l.99 ; LDB 12 l.148. */
const ECHOUAGE_DIFFICULTY: Difficulty = 'intermediaire';
/** Le Test de renflouage. MSRC 7 l.99 */
const FORCE_DE_RENFLOUAGE: TestDesigne = { characteristic: 'force' };

/** Pénalité du renflouage (MSRC 7 l.99), dérivée au jet de `strandingPenalty` — partagée par le renflouage
 *  IA/synchrone (`applyEchouage`) et l'étape-jet JOUEUR (`fleuveEchouageForce`, #270). */
function echouagePenalty(get: Get): { penalite: ModLine | null; encTxt: string } {
  const coque = get().travelPlan!.vehicle!;
  const bateau = findVehicleById(coque.creatureId ?? '');
  const boatEnc = bateau?.ship?.fluvialEnc ?? bateau?.enc ?? 0;
  const cargoEnc = partyCargoTotalEnc(get());
  const penalite = strandingPenaltyLine(boatEnc, cargoEnc, RULE_REF['navigation-echouage']);
  const encTxt: string = penalite ? t('fleuve.malusDEncombrement', { total: -penalite.value, boat: boatEnc, cargo: cargoEnc }) : '';
  return { penalite, encTxt };
}

/** ÉCHOUAGE (#270) : Dégâts fixes appliqués immédiatement (non-jetés) ; le renflouage (Test de Force)
 *  devient une étape-jet INFLUENÇABLE (`fleuveEchouageForce`) quand le jet de l'acteur se surface —
 *  sinon délègue à `applyEchouage` (chemin IA/synchrone inchangé). */
function applyEchouageSteps(get: Get, set: Set, idPrefix: string, j: EntreeDuJournal[]): BuiltCascadeStep[] {
  const force = partyAssisted(get().party, FORCE_DE_RENFLOUAGE);
  if (!force || !surfaceOf(get, force.actor.id)) {
    applyEchouage(get, set, (l) => j.push(...l));
    return [];
  }
  const coque = get().travelPlan!.vehicle!;
  damageVesselHull(get, set, coque, echouageDamage());
  const { penalite } = echouagePenalty(get);
  j.push(ligneDeTexte(t('fleuve.echouage', { dmg: echouageDamage(), suite: t('fleuve.fragmentDePoint') })));
  const st = monoStep({
    id: `${idPrefix}-echouage`, kind: 'fleuveEchouageForce', actor: force.actor, icon: 'voyage/reparer',
    label: t('step.riverEchouage'), rollLabel: t('char.force'), difficulty: ECHOUAGE_DIFFICULTY,
    ligne: { test: FORCE_DE_RENFLOUAGE, valeur: force.value, soutien: force.support, ...(penalite ? { surLaCible: [penalite] } : {}) },
    stake: voyageStakeRef('fleuve-renflouage'),
  });
  return st ? [st] : [];
}

/** LDB 20 l.206 ; MDG 14 l.208 */
function finishRiverDay(get: Get, set: Set, jour: TravelRecapDay): void {
  const plan = get().travelPlan!;
  const river = plan.river!;

  // Naufrage : voyage perdu.
  if (river.sunk) {
    get().avancerLHorloge(MINUTES_PER_DAY);
    set({ travelPlan: null });
    log(get, set, [ligneDeTexte(t('fleuve.naufrage'))]);
    return;
  }

  // Vent de demain : 4 tirages (aube/midi/crépuscule/minuit, l.21).
  const nextForce = tickRiverWindDay(river.windForce, battleRng());
  const kmDone = jour.kmTo;
  const arrived = plan.km - kmDone < 1e-9;
  // Horloge : à l'ARRIVÉE, la journée entière passe (+24 h) — l'entretien du jour est rattrapé par le
  // prochain `runDailyUpkeep`. Sinon (HALTE de nuit) la navigation s'arrête au crépuscule : le canon MSRC
  // ne chiffre PAS la navigation fluviale de nuit (valeur maison, cadence gouvernée par la même porte
  // aube→crépuscule que le départ, `voyage-heure-de-depart`, #340) et la nuit de sommeil enjambe minuit :
  // UN SEUL franchissement de jour par cycle jour+nuit (comme le voyage terrestre).
  // L'ENTRETIEN n'est jamais roulé ici (sinon la Faim s'installe avant le repas) : il se résout dans la
  // cascade de nuit (`buildNightCascade`), APRÈS `feedFromMeal`.
  const minutes = arrived ? MINUTES_PER_DAY : minutesUntilNext(get().gameTime, duskMinute());
  const navireDeCampagne = estLeNavireDeCampagne(plan.vehicle, get().vessel);
  const voyageurs = porteursABord(get, set).filter(({ id }) => navireDeCampagne || id !== WORLD_STEP_OWNER);
  const dus = calculerLesTestsDExposition(get, set, minutes, [voyageurs]);
  get().avancerLHorloge(minutes);
  set({
    travelPlan: {
      ...get().travelPlan!, kmDone,
      river: {
        ...river, windForce: nextForce, daysAfloat: river.daysAfloat + 1,
        pendingFinish: { etape: 'contagion', jour },
      },
    },
  });

  const steps = bandesDeContagion(get, set, dus);
  if (steps.length) {
    jouerLaJournee(get, set, steps, { title: t('fleuve.titreDeLaJournee'), purpose: 'riverExposure' }, traverseeCommandee(get()));
  } else {
    continueRiverDayAfterExposure(get, set);
  }
}

/** `reparationTemporaireFluviale` du bateau de la route, tant qu'il flotte. MSRC 7 l.117 */
function reparationTemporaireDuBateau(get: Get, apres: string): BuiltCascadeStep | undefined {
  const plan = get().travelPlan;
  if (!plan?.vehicle || plan.river?.sunk) return undefined;
  return reparationTemporaireFluviale(get, plan.vehicle, apres);
}

/** Les Tests de Navigation du barreur. MSRC 7 l.117 */
const NAVIGATION_DU_BARREUR: ReadonlySet<string> = new Set([
  'fleuveNavigation', 'fleuveVirementDeBord', 'fleuveChavirage', 'fleuveRedressement', 'fleuveGreement', 'fleuvePerilNavigation',
] satisfies (typeof GENRES_D_ETAPE)[number][]);

/** Chaque applier du module, suivi du Test d'Endurance du bateau tenu par une réparation temporaire quand il joue un
 *  Test de Navigation du barreur (règle maison `fleuve-reparation-temporaire-navigation`) ou inflige des Dégâts à
 *  la coque (règle maison `fleuve-reparation-temporaire-degats`) ; un seul Test par étape, et seulement si la réparation
 *  tenait déjà avant l'étape. MSRC 7 l.117 */
function suiviDeLaReparationTemporaire(appliers: PartDeTable<'appliers', typeof GENRES_D_ETAPE>): PartDeTable<'appliers', typeof GENRES_D_ETAPE> {
  const suivi = (kind: string, applier: CascadeApplier): CascadeApplier => (get, set, step, hero, ctx) => {
    const coque = get().travelPlan?.vehicle;
    const tenait = !!coque && reparationTemporaireTient(get, coque);
    const avant = coque?.wounds.current;
    const issue = applier(get, set, step, hero, ctx);
    const apres = get().travelPlan?.vehicle?.wounds.current;
    const declenche = tenait && ((!!step.result && NAVIGATION_DU_BARREUR.has(kind) && rule('fleuve-reparation-temporaire-navigation'))
      || (avant !== undefined && apres !== undefined && apres < avant && rule('fleuve-reparation-temporaire-degats')));
    const suite = declenche ? reparationTemporaireDuBateau(get, step.id) : undefined;
    return suite ? { ...issue, insert: [...(issue?.insert ?? []), suite] } : issue;
  };
  return Object.fromEntries(Object.entries(appliers).map(([kind, applier]) => [kind, suivi(kind, applier)])) as PartDeTable<'appliers', typeof GENRES_D_ETAPE>;
}

/** Les genres d'étape que ce module déclare (table `appliers`). */
export const GENRES_D_ETAPE = [
  RIVER_EXPOSURE_KIND, 'fleuveReparationDeCommande', 'fleuveNavigation', 'fleuveVirementDeBord', 'fleuveChavirage', 'fleuveRedressement',
  'fleuveGreement', 'fleuveTestDePeril', 'fleuveChoixDObstacle', 'fleuvePerilNavigation', 'fleuveReparationDeBreche',
  'fleuveDetectionDePeril', 'fleuveEchouageForce', 'fleuve-reparation-temporaire',
] as const;

const APPLIERS = {
  [RIVER_EXPOSURE_KIND]: (get, _set, step) => {
    if (!step.result) return {};
    if (!step.result.success) return { applique: { lignes: [ligneDeTexte(t('fleuve.sansExposition'), { ton: 'neutre' })], faits: [] } };
    const mode = step.meta?.exposureMode as import('../data').WaterExposureMode;
    const source = step.meta?.exposureSource as string | undefined;
    return { insert: etapesDExpositionHydrique(effectTargets(get, 'groupe'), { mode, source }, 'fleuveExposition') };
  },
  /** Réparation du gréement/avirons (l.78-82 / note 5) : Test de Métier réussi → rend le contrôle. */
  fleuveReparationDeCommande: (get, set, step, hero) => {
    if (!step.result) return;
    if (step.result.success) set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, broken: false, horsDeControle: false } } });
    const name = nomDe(garanti(hero, step.actorId, 'charpentier'));
    return { applique: { lignes: [step.result.success
      ? ligneDeTexte(t('fleuve.reparationReussie', { name }), { ton: 'reussite' })
      : ligneDeTexte(t('fleuve.reparationRatee', { name }), { ton: 'echec' })], faits: [] } };
  },
  /** Navigation de l'étape (l.15) : perte de contrôle (échec non rattrapé par Savoir) → dérive. */
  fleuveNavigation: (get, set, step, hero) => {
    if (!step.result) return;
    const savoir = Number(step.meta?.savoir ?? 0);
    const kept = riverControlKept(step.result.success, step.result.sl, savoir);
    if (!kept) patchDay(get, set, { forceDrift: true });
    const savoirNote = savoir > 0 ? t('fleuve.fragmentDeSavoir', { n: savoir }) : '';
    return { applique: { lignes: [ligneDeTexte(t('fleuve.ligneDeNavigation', { who: nomDe(garanti(hero, step.actorId, 'pilote')), savoir: savoirNote, issue: controlLabel(kept, step.result.success) }), { ton: step.result.success ? 'reussite' : kept ? 'neutre' : 'echec' })], faits: [] } };
  },
  /** Louvoyage (note 3, l.39) : le +% de vent n'est acquis qu'avec un Test réussi. */
  fleuveVirementDeBord: (get, set, step) => {
    if (!step.result) return;
    const savoir = Number(step.meta?.savoir ?? 0);
    const ok = step.result.success || (savoir > 0 && step.result.sl + savoir >= 0);
    const pourcentageDuVent = get().travelPlan?.river?.day?.pourcentageDuVent ?? 0;
    if (!ok) patchDay(get, set, { pourcentageDuVent: 0 });
    return { applique: { lignes: [ok
      ? ligneDeTexte(t('fleuve.louvoyageReussi', { pct: pourcentageDuVent }), { ton: 'reussite' })
      : ligneDeTexte(t('fleuve.louvoyageRate'), { ton: 'echec' })], faits: [] } };
  },
  /** Chavirage (note 4, l.40) : voile retirée à temps → dérive ; sinon le redressement s'ouvre Round par
   *  Round (une étape INFLUENÇABLE par Round, jusqu'à BE Rounds) ou le bateau coule. Le bateau ne fait au
   *  mieux que DÉRIVER ce jour → `forceDrift`. */
  fleuveChavirage: (get, set, step) => {
    if (!step.result) return;
    patchDay(get, set, { forceDrift: true });
    if (step.result.success) return { applique: { lignes: [ligneDeTexte(t('fleuve.chavirageEvite'), { ton: 'reussite' })], faits: [] } };
    const be = capsizeSinkTurns(effectiveChar(get().travelPlan!.vehicle!, 'endurance'));
    const premier = rightingStep(get, step, 0, be);
    return {
      applique: { lignes: [ligneDeTexte(t('fleuve.chavirage'), { ton: 'echec' })], faits: [] },
      ...(premier ? { insert: [premier] } : {}),
    };
  },
  /** Redressement d'un bateau renversé, UN Round = UNE étape (note 4, l.40) : réussi → le bateau est
   *  redressé ; échoué → le Round suivant s'insère tant qu'il en reste (BE), sinon le bateau coule. */
  fleuveRedressement: (get, set, step) => {
    if (!step.result) return;
    const round = Number(step.meta?.rightRound ?? 0);
    const be = Number(step.meta?.rightRounds ?? 1);
    // Le redressement est un Test de NAVIGATION (note 4) : le +1 DR de Savoir (Voies fluviales, l.13)
    // s'y applique AU DR, comme au Test du jour et au Louvoyage — MÊME lecture (`riverControlKept`).
    const savoir = Number(step.meta?.savoir ?? 0);
    const savoirNote = savoir > 0 ? t('fleuve.fragmentDeSavoir', { n: savoir }) : '';
    if (riverControlKept(step.result.success, step.result.sl, savoir)) {
      return { applique: { lignes: [ligneDeTexte(t('fleuve.redresse', { n: round + 1, savoir: savoirNote }), { ton: 'reussite' })], faits: [] } };
    }
    if (round + 1 < be) {
      const suivant = rightingStep(get, { ...step, id: step.id.replace(/-right-\d+$/, '') }, round + 1, be);
      return {
        applique: { lignes: [ligneDeTexte(t('fleuve.resteSurLeFlanc', { n: round + 1, be }), { ton: 'echec' })], faits: [] },
        ...(suivant ? { insert: [suivant] } : {}),
      };
    }
    const j: EntreeDuJournal[] = [];
    // MSRC 7 l.40
    sinkBoat(get, set, (l) => j.push(...l), t('fleuve.naufrageSansRedressement', { be }));
    return { applique: { lignes: j, faits: [] } };
  },
  /** Gréement en péril (note 5, l.41) : Test raté → Critique au gréement + dérive hors de contrôle. */
  fleuveGreement: (get, set, step) => {
    if (!step.result) return;
    if (step.result.success) return { applique: { lignes: [ligneDeTexte(t('fleuve.greementTient'), { ton: 'reussite' })], faits: [] } };
    const j: EntreeDuJournal[] = [ligneDeTexte(t('fleuve.critiqueAuGreement'), { ton: 'echec' })];
    const insert = applyBoatCritical(get, set, get().travelPlan!, get().travelPlan!.river!, get().travelPlan!.vehicle!, 'greement', (l) => j.push(...l), battleRng(), step.id);
    set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, horsDeControle: true } } });
    patchDay(get, set, { forceDrift: true });
    j.push(ligneDeTexte(t('fleuve.horsDeControle')));
    return { applique: { lignes: j, faits: [] }, insert: insert.length ? insert : undefined };
  },
  /** VÉRIFICATION d'occurrence d'un péril (l.119-166) : tire la CHANCE (d100, MÊME position RNG qu'inline —
   *  un d100 par péril, AVANT le Test d'évitement). Péril survenu à Test de Navigation (Débris) → INSÈRE une
   *  étape-jet d'évitement INFLUENÇABLE (`fleuvePerilNavigation`) ; kinds sans jet joueur (`detect`/`obstacle`)
   *  résolus inline ici (mêmes sous-jets, même ordre). Coulé → sauté sans d100 (parité : inline `break`). */
  fleuveTestDePeril: (get, set, step) => {
    const rng = battleRng();
    if (get().travelPlan?.river?.sunk) return; // coulé → péril sauté (parité : inline `break`, aucun d100)
    const perilId = String(step.meta?.perilId ?? '');
    const chancePct = Number(step.meta?.chancePct ?? 0);
    const peril = findRiverPeril(perilId);
    if (!peril) return;
    // Rejeu POST-POSE de la chance du péril : l'étape `fleuveTestDePeril` est déjà posée, ce dé en est la
    // conséquence — porte du canal (`deMonde`), un dé par péril (même position RNG qu'inline).
    if (deMonde(rng) > Math.max(0, Math.min(100, chancePct))) return;
    if (peril.kind === 'navigation') {
      // Le Test d'évitement est INFLUENÇABLE → étape-jet insérée juste après (chance PUIS jet, ordre inline).
      const hasPilot = !!step.meta?.hasPilot;
      // Le barreur est RE-RÉSOLU au moment de l'insertion (acteur + Soutien du moment) et la ligne se
      // remonte par le monteur canonique : les malus de dérive/hors-contrôle, eux, voyagent en drapeaux
      // sérialisables et redeviennent des chips NOMMÉES (`navPenaltyMods`).
      const competence = riverNavSkill(get().travelPlan?.vehicle);
      const pilot = riverPilot(get, competence);
      if (!hasPilot || !pilot) return resolveRiverPerilConsequence(get, set, peril, { ...step, result: null }, rng);
      // Un péril à Test PORTE sa conséquence (`onFail`, exigée par le schéma de `river-perils`) : sans
      // elle, il n'y a rien à mettre en jeu, donc pas de jet à ouvrir — la conséquence se résout seule.
      const onFail = peril.onFail;
      if (!onFail) return resolveRiverPerilConsequence(get, set, peril, { ...step, result: null }, rng);
      const st = monoStep({
        id: `${step.id}-nav`, kind: 'fleuvePerilNavigation', actor: pilot.actor, icon: 'nautique/bois-flottant', label: stepDetail(dataLabel(peril.label), t('step.evitement')),
        rollLabel: String(step.meta?.navLabel ?? riverPilotSkillLabel(get)), difficulty: navBaseDifficulty(),
        ligne: {
          test: { skill: competence }, valeur: pilot.value, soutien: pilot.support,
          surLaCible: navPenaltyMods({ derive: !!step.meta?.navDerive, horsDeControle: !!step.meta?.navHorsDeControle }),
        },
        stake: voyageStakeRef('fleuve-peril-evitement', { hits: onFail.hullHits, damagePerHit: onFail.damagePerHit }),
        contexte: 'perilDesEaux', // Test d'évitement d'un péril de rivière : LDB 10 l.966
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
        ?? partyAssisted(get().party, { characteristic: 'force' })?.actor.id
        ?? get().party.find((h) => !h.dead)?.id ?? '';
      const st = choiceStep({
        id: `${step.id}-obstacle`, kind: 'fleuveChoixDObstacle', actorId: decideur, icon: 'interface/attention',
        label: stepDetail(stepPrecision(dataLabel(peril.label), t('step.obstacleStats', { endurance: b.endurance, blessures: b.wounds })), t('step.forcerOuDeblayer')),
        options: [
          { key: 'deblayer', label: t('opt.deblayer'), detail: t('fleuve.detailDuDeblayage') },
          { key: 'forcer', label: t('opt.forcerBelier'), detail: t('fleuve.detailDuBelier', { dmg: peril.obstacle.ramDamage }) },
        ],
        meta: { perilId },
      });
      return st ? { insert: [st] } : undefined;
    }
    // detect : jet de détection GATÉ (#270, conducteur JOUEUR → étape insérée `fleuveDetectionDePeril` ; sinon
    // résolution inline, sous-jets dans le même ordre qu'inline).
    return resolveRiverPerilConsequence(get, set, peril, { ...step, result: null }, rng);
  },
  /** CHOIX au barrage (l.128) : forcer au bélier (+ramDamage à la coque) ou déblayer à la main (3d10 objets
   *  × 4d10 Enc, coque INTACTE, le halage ampute la progression du jour via `dayAgilityFactor`). */
  fleuveChoixDObstacle: (get, set, step) => {
    const peril = findRiverPeril(String(step.meta?.perilId ?? ''));
    if (!peril?.obstacle) return;
    const coque = get().travelPlan!.vehicle!;
    if (step.chosen === 'forcer') {
      damageVesselHull(get, set, coque, peril.obstacle.ramDamage);
      return { applique: { lignes: [ligneDeTexte(t('fleuve.forceAuBelier', { peril: peril.label, dmg: peril.obstacle.ramDamage, cur: coque.wounds.current, max: coque.wounds.max }))], faits: [] } };
    }
    if (!peril.clear) return { applique: { lignes: [ligneDeTexte(t('fleuve.deblaySimple', { peril: peril.label }))], faits: [] } };
    const c = rollBarrageClearing(peril.clear, battleRng());
    const workDay = baseHoursPerDay(get().worldMap as WorldMap);
    const factor = workDay > 0 ? Math.max(0, 1 - c.hours / workDay) : 1;
    const prev = get().travelPlan?.river?.dayAgilityFactor ?? 1;
    set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, dayAgilityFactor: prev * factor } } });
    return { applique: { lignes: [ligneDeTexte(t('fleuve.deblaye', { peril: peril.label, objects: c.objects, enc: c.enc, hours: c.hours, pct: Math.round((1 - factor) * 100) }))], faits: [] } };
  },
  /** Évitement INFLUENÇABLE d'un péril à Test de Navigation (Débris, l.125) : le jet (`step.result`) décide
   *  de la collision → Dégâts à la coque via la conséquence commune. */
  fleuvePerilNavigation: (get, set, step) => {
    const peril = findRiverPeril(String(step.meta?.perilId ?? ''));
    if (!peril) return;
    return resolveRiverPerilConsequence(get, set, peril, step, battleRng());
  },
  /** Réparation d'urgence INFLUENÇABLE d'une coque PERCÉE (#270, Métier) — succès = voie d'eau colmatée
   *  (+1d10 Blessures de coque, l.116) ; échec = le bateau sombre (l.103). */
  fleuveReparationDeBreche: (get, set, step, hero) => {
    if (!step.result) return;
    const plan = get().travelPlan!;
    const name = nomDe(garanti(hero, step.actorId, 'charpentier'));
    if (step.result.success) {
      const healed = Math.min(plan.vehicle!.wounds.max - plan.vehicle!.wounds.current, tirer(TEMPORARY_REPAIR.woundsPerRepair, battleRng()));
      healVesselHull(get, set, plan.vehicle!, healed);
      set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, holed: false } } });
      poserLaReparationTemporaire(get, set); // MSRC 7 l.117
      return { applique: { lignes: [ligneDeTexte(t('fleuve.colmatageReussi', { name, n: healed }), { ton: 'reussite' })], faits: [] } };
    }
    const j: EntreeDuJournal[] = [ligneDeTexte(t('fleuve.colmatageRate', { name }), { ton: 'echec' })];
    // MSRC 7 l.103
    sinkBoat(get, set, (l) => j.push(...l), t('fleuve.naufrageParVoieDEau'));
    return { applique: { lignes: j, faits: [] } };
  },
  /** Détection INFLUENÇABLE d'un péril « detect » (Rochers/eaux peu profondes, l.136, Agilité — #270) —
   *  sans la Compétence de Navigation (auto-succès résolu AVANT l'insertion, cf. `resolveRiverPerilConsequence`).
   *  Échec → impact (Dégâts fixes, chances de percée/échouage, MÊME conséquence que le chemin inline). */
  fleuveDetectionDePeril: (get, set, step) => {
    const peril = findRiverPeril(String(step.meta?.perilId ?? ''));
    if (!step.result || !peril?.onHit) return;
    if (step.result.success) return { applique: { lignes: [ligneDeTexte(t('fleuve.perilEvite', { peril: peril.label }), { ton: 'reussite' })], faits: [] } };
    const j: EntreeDuJournal[] = [ligneDeTexte(t('fleuve.impactDuPeril', { peril: peril.label }), { ton: 'echec' })];
    const rng = battleRng();
    const impact = resolveRiverImpact(peril.onHit, rng);
    const plan = get().travelPlan!;
    const coque = plan.vehicle!;
    damageVesselHull(get, set, coque, impact.hullDamage);
    j.push(ligneDeTexte(t('fleuve.coqueTouchee', { peril: peril.label, dmg: impact.hullDamage, note: '', cur: coque.wounds.current, max: coque.wounds.max })));
    const insert: BuiltCascadeStep[] = [];
    if (impact.echoue) insert.push(...applyEchouageSteps(get, set, step.id, j));
    if (impact.holed) insert.push(...applyBoatCritical(get, set, plan, plan.river!, coque, 'coque', (l) => j.push(...l), rng, step.id));
    return { applique: { lignes: j, faits: [] }, insert: insert.length ? insert : undefined };
  },
  /** Renflouage INFLUENÇABLE (#270, Force) — MÊME issue que `applyEchouage`, jet différé. */
  fleuveEchouageForce: (_get, _set, step, hero) => {
    if (!step.result) return;
    const name = nomDe(garanti(hero, step.actorId, 'renfloueur'));
    return { applique: { lignes: [step.result.success
      ? ligneDeTexte(t('fleuve.remisAFlot', { name }), { ton: 'reussite' })
      : ligneDeTexte(t('fleuve.pasRemisAFlot', { name }), { ton: 'echec' })], faits: [] } };
  },
  'fleuve-reparation-temporaire': (get, set, step) => appliquerLaReparationTemporaire(get, set, step, TEMPORARY_REPAIR.failDamage),
} satisfies PartDeTable<'appliers', typeof GENRES_D_ETAPE>;

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = { appliers: suiviDeLaReparationTemporaire(APPLIERS) } satisfies FragmentDeTables;
