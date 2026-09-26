/**
 * Flux de VOYAGE (#T2) — résolution jour par jour d'un trajet sur la carte du monde.
 *
 * RAW (section « Voyage » du LDB, fichier source `51 - Magie du Chaos.md`) :
 *  - vitesse = Déplacement en km/h, le plus lent du groupe à pied (LDB 51 l.193) ; diligence M6 / barge M8
 *    (LDB 51 l.180-189, prix par km par passager — débités AVANT le départ) ;
 *  - 6 h de voyage par jour sans Test ; au-delà (marche forcée), Test de Résistance ou Exténué,
 *    +1 si Encombré (LDB 51 l.195) — à pied seulement (les passagers d'un transport ne marchent pas) ;
 *  - fatigue d'Encombrement par journée de voyage (LDB 61 l.46-48, `travelFatigue`) — à pied ;
 *  - péripéties (LDB 51 l.208, table l.210-221) : d10 quotidien, événement sur `perilDie` (défaut 8, paramétrable, 0 = off)
 *    → tirage sur la table VERBATIM (`data/peripeties.ts`) ; en PLUS, péripéties d'AUTEUR par route
 *    (probabilité par jour + Effects d'éditeur).
 *
 * Chaque nuit en route : HALTE — la modale de Repos s'ouvre (campement, ou auberge de relais si la
 * route en a — `MapRoute.inns`) et le voyage se SUSPEND ; le « Continuer » du bilan reprend la
 * route au matin (`continueTravelAfterNight`). Le RAPPORT DU JOUR (km, jets, péripéties) s'affiche
 * DANS la halte du soir (`pendingRest.travelDay`) — chaque journée se lit le soir même, avec ses
 * conséquences ; le recap final ne couvre que le DERNIER segment (plus de déroulé intégral).
 *
 * Une péripétie qui déclenche un combat/une transition INTERROMPT le voyage : `travelPlan` mémorise
 * la progression (`kmDone`) et la carte propose « Reprendre le voyage » (`resumeTravel`).
 */
import { battleRng } from './battleRng';
import { garanti } from './combatants';
import { bus, EVT } from './bus';
import { buildAuthorPerilSteps, registerPerilInterrupt } from './authorPerils';

/** Id du protocole de reprise TERRESTRE (effets DIFFÉRÉS dans `travelPlan.land.interrupt`). */
const LAND_PERIL_INTERRUPT = 'travel-land';
import { openRest, placesOfKind } from './restFlow';
import { placeById, placeOfScene, otherEnd, type MapRoute, type WorldMap } from './worldMap';
import {
  TravelMode, TRAVEL_DEFAULTS, travelModeLabels, travelSpeed, transportCost, forcedMarchTest, applyTravelFatigue,
  vehicleTravel,
} from '../engine/travel';
import {
  type Allure, ALLURE_KMH_PER_M, allureLabel as allureName, mountProfileById, partyMounts, partyFullyMounted, resolveMountedDay,
  type MountInjury,
} from '../engine/mountTravel';
import { possessionLabel } from '../engine/possession';
import {
  vehicleCombatant, applyVehicleProblem, forcedPaceCheck, forcedPaceBeastCheck, forcedPaceModifier,
  type ForcedPaceAnimal, type ForcedPaceAnimalOutcome,
} from '../engine/vehicle';
import { bonus } from '../engine/characteristics';
import { rollVehicleProblem, mountIncidentEffects } from '../engine/travelTables';
import { applyOps } from '../engine/ops';
import { ouvrirChute } from './combatEffects';
import { applyHealWounds } from '../engine/healing';
import { declareDisease } from '../engine/disease';
import { findVehicleById, voyageStakeRef, weather, libelleOuAbsence } from '../data';
import { memoParVersion } from '../data/versionDataset';
import { PERIPETIES } from '../data/peripeties';
import { rollTest, testDetail } from '../engine/tests';
import { partyAssisted, supportSplit, type SupportDetail } from '../engine/skills';
import { addCondition, removeCondition, stacks } from '../engine/conditions';
import { formatMoney } from '../engine/money';
import { condCtx, payFromGroup } from './bourseFlow';
import { evalCondition } from '../engine/flowCore';
import { d10, d100 } from '../engine/dice';
import { rule } from '../engine/policy';
import { toDate, isTravelDaylight, DAWN_MINUTE, minutesUntilNext } from '../engine/clock';
import { dayIndex } from './upkeep';
import { seasonOfMonth, weatherFromRoll, weatherCondition, type Season, type Weather } from '../engine/travelStages';
import { stageAssignmentFromRoles, type StagePosting } from '../engine/activities';
import { buildStageSteps, buildWeatherResistanceSteps, type StageContext } from './travelPostes';
import { startCascade, registerCascadeApplier, registerTableStepFamily, type TableStepDef, type TableStepRow } from './cascade';
import { freeCons, rollSansPilote, monoStep, displayStep, surfaceOf, tableStep, pousseSi } from './rollSeam';
import { t } from '../i18n';
import type { CascadeStep, PendingCascade } from './pendings';
import type { RecapLine } from './recapLine';
import { toRecapLines, phaseOfKind } from './recapLine';
import { buildSeaPlan, runSeaDay, startFastVoyage, syncHullWoundsFromVessel } from './seaVoyageFlow';
import { buildRiverPlan, runRiverDays } from './riverVoyageFlow';
import type { BuiltCascadeStep } from './stepBrand';
import type { Combatant } from '../engine/types';

import type { Get, Set } from './flowTypes';
import { traceLineOf } from '../engine/traceLine';
import { dataLabel, refLabel } from '../data';
import { stepDetail } from './rollSeam';

/** Une journée du récapitulatif de voyage (audit M4) : progression + ce qui s'y est passé. */
export interface TravelRecapDay {
  kmFrom: number;
  kmTo: number;
  hours: number;
  /** Fatigue, péripéties narratives, entretien… Ligne STRUCTURÉE (#349) : `{ text, icon?, tone?,
   *  phase? }`, rendue par le renderer partagé `ui/RecapLine.tsx` — `phase` (jour terrestre
   *  seulement) rattache la ligne à `DAY_PHASE_CATALOG` (`state/recapLine.ts`), même catalogue que
   *  l'agenda du jour EN COURS (`ui/VoyageScreen.dayAgenda`) : le sectionnement des jours CLOS en
   *  tombe GRATUITEMENT (dette 3). */
  lines: RecapLine[];
  /** Les JETS du jour (marche forcée, Survie, Perception…) en lignes de jet structurées —
   *  même brique multijet que le bilan de nuit (MultiRollList), pas du texte. */
  entries?: import('./restFlow').NightEntry[];
  /** Événements de bord RACONTÉS du jour (#371 LOT 4, mer seulement) — titre + texte verbatim +
   *  tirage d100 optionnel, rendus en `ParchmentCard` (`SeaVoyageBody`) : un événement PORTE UN
   *  RÉCIT, distinct des `lines` de routine. */
  events?: import('./recapLine').RecapEvent[];
  /** MER (route COMMANDÉE) : instantané du jour pour l'écran de traversée (rose des vents + jauges +
   *  distance restante) — rendu par `SeaVoyageScreen` à la place du corps de recap terrestre. */
  sea?: import('./seaVoyageFlow').SeaRecapChrome;
  /** MÉTÉO d'Étape (EDOC 8 l.50) = CONTEXTE DU JOUR (arbitrage user 2026-07-11 : « elle doit juste
   *  s'afficher dans un écart lié à la journée », plus de pas de cascade). `id` = météo affichée
   *  (en-tête « Journée de route — … — {météo} » + tuile Météo, vague 2) ; `roll` = d100 INTERNE (debug/
   *  tests ; « y'a que le MJ qui voit le jet de météo » → jamais montré au joueur). */
  weather?: { id: import('../engine/travelStages').Weather; roll: number };
}

/** Suite DIFFÉRÉE derrière le récit du voyage (embuscade d'auteur ou « Attaqués ! » de la table
 *  d10) : le combat ne démarre qu'à l'ACQUITTEMENT du recap — d'abord comprendre ce qui arrive,
 *  ensuite se battre. Fermer la modale (bouton/Échap) DÉCLENCHE la suite : pas d'évitement. */
export type TravelThen =
  | { kind: 'effects'; effects: import('./scene').Effect[] }
  | { kind: 'ambush'; scene: string; entry?: string; encounter: string; noSurprise: boolean };

/** Récapitulatif d'un segment de voyage — la résolution étant SYNCHRONE (l'horloge saute en
 *  bloc), le joueur n'en voyait rien hors journal (audit M4) : modale à l'arrivée, à
 *  l'interruption (péripétie) et à l'arrêt (surcharge). */
export interface TravelRecap {
  fromLabel: string;
  toLabel: string;
  mode: TravelMode;
  status: 'arrived' | 'interrupted' | 'stalled';
  km: number;
  kmDone: number;
  days: TravelRecapDay[];
  /** Embuscade en attente : déclenchée par `dismissTravelRecap` (le récit passe AVANT le combat). */
  then?: TravelThen;
  /** Durée totale du voyage (arrivée seulement, vague « lisibilité 2/2 ») : jours CLOS (`plan.log`) +
   *  le jour courant (jamais logué — l'arrivée ne halte pas) = `log.length + 1`, MÊME formule que
   *  `dayNum` de l'écran-hub. Capturé AVANT que `travelPlan` ne soit remis à `null`. */
  daysTotal?: number;
}

/** Voyage en cours / interrompu (persiste pour « Reprendre le voyage »). La classe du transport payant
 *  (`interieur`/`exterieur`, `cabine`/`pont`) n'entre QUE dans le prix du passage, débité à l'ouverture
 *  par `transportCost` : le plan n'en porte pas trace, aucune reprise ne la relit. */
export interface TravelPlan {
  routeId: string;
  fromPlaceId: string;
  toPlaceId: string;
  mode: TravelMode;
  /** Allure choisie (heures de route par jour ; > heures RAW = marche forcée). */
  hoursPerDay: number;
  /** Allure EDOC (règle `travel-allures`) : en selle = pas/trot/galop (EDOC 07 l.140-144) ; sur un
   *  attelage, `'galop'` = allure forcée (EDOC 07 l.229). Absent = cadence de base. */
  allure?: Allure;
  /** Attelage « Endommagé » (Problème de véhicule) : au pas jusqu'à réparation (EDOC 07 l.278-280). */
  vehicleLame?: boolean;
  km: number;
  kmDone: number;
  /** Interrompu par une péripétie (combat/transition) — reprise via `resumeTravel`. */
  interrupted: boolean;
  /** ORDRES permanents de la traversée (couche `voyageCadence`) : cadence COMMANDÉE (routine auto-résolue,
   *  PV du jour) ou JOUR-PAR-JOUR (modale par jet). Consommé par la mer ET le fluvial. */
  orders?: import('./voyageCadence').VoyageOrders;
  /** Postes d'Activité de l'Étape : un héros → ≤1 Activité (EDOC 8). Initialisé depuis les rôles
   *  PERSISTANTS (`travelRole`) au départ, réutilisé chaque Étape (0 ré-assignation par jour). */
  postes?: Record<string, StagePosting>;
  /** Cumul du Test ÉTENDU de cartographie (Établir des cartes, EDOC 8 l.161) — cf. `extendedTestStep`. */
  extendedProgress?: number;
  /** Coque transitoire du véhicule du trajet (`Combatant`, depuis `vehicles.json` hull) — encaisse les
   *  incidents (`vehicleWounds`). Présente seulement si le trajet utilise un véhicule à coque.
   *  Route MARITIME : la coque du NAVIRE DE CAMPAGNE (Blessures persistées sur `vessel.wounds`, #30). */
  vehicle?: Combatant;
  /** État NAVAL du trajet (route `sea` — MDG 13/15) : météo/vent, événements, crises, étape du jour.
   *  Présent = la résolution du jour est déléguée à `seaVoyageFlow.runSeaDay` (cascade-jour). */
  sea?: import('./seaVoyageFlow').SeaVoyageState;
  /** État FLUVIAL du trajet (route `river`, mode barge — MSRC 7) : vent, dérive/chavirage, jours à flot.
   *  Présent = la résolution du jour est déléguée à `riverVoyageFlow.runRiverDays`. */
  river?: import('./riverVoyageFlow').RiverVoyageState;
  /** CONTEXTE TRANSITOIRE de l'Étape EDOC en cours (météo/saison/postes accumulés) — posé par
   *  `buildStageSteps`, lu par les appliers de poste/exposition, effacé à la clôture du jour. Jamais
   *  persisté au-delà d'une journée. */
  stage?: StageContext;
  /** CONTEXTE TRANSITOIRE du JOUR terrestre EN COURS (posé par `buildTravelDayCascade`, lu et effacé par
   *  `continueTravelDayAfterCascade`) : ce que la clôture de la cascade `travelDay` relit pour enchaîner
   *  la halte de nuit / l'arrivée. Recopie de variables du jour, aucune règle neuve. Jamais persisté. */
  land?: LandDayContext;
  /** Récapitulatif du SEGMENT en cours (audit M4), stocké sur le plan quand la journée SUSPEND sur la
   *  cascade `travelDay` : `continueTravelDayAfterCascade` le relit et le finalise (le `recap` local du
   *  `while` de `runTravelDays` ne survit pas à la suspension). Transitoire — effacé à la finalisation. */
  recap?: TravelRecap;
  /** Maladies PORTÉES AU DÉPART, clés `<idHéros>|<idMaladie>` — posées une seule fois à la première
   *  journée du trajet (conservées à la reprise d'un voyage interrompu). Le complément de cet ensemble
   *  à l'arrivée = les maladies contractées sur la route, celles que la Phase d'arrivée déclare
   *  (EDOC 09 l.21, `declareArrivalDiseases`). */
  diseasesAtStart?: string[];
  /** CHRONIQUE du voyage (#333) : les journées/Étapes DÉJÀ closes, accumulées à leur halte de nuit
   *  (`openRest` porte le `travelDay` finalisé). Alimente le journal de voyage de l'écran-hub
   *  (`VoyageScreen`) — une carte par jour passé. Vidé avec le plan à l'arrivée. */
  log?: TravelRecapDay[];
}

/** MÉTÉO du jour EN COURS (vague « lisibilité du voyage » 2/2) — exposition PROPRE au hub, sans
 *  nouveau champ persisté : le jour EN COURS porte déjà sa météo sur `plan.recap.days[dernier]`
 *  (posée par `buildTravelDayCascade`, AVANT finalisation) ; une fois la halte de nuit ouverte,
 *  `plan.recap` est effacé mais le MÊME jour finalisé vit sur `pendingRest.travelDay` (`openRest`
 *  le porte tel quel). `undefined` = pas de météo d'Étape pour ce jour (règle `travel-etapes` éteinte,
 *  navigation JOUÉE mer/fleuve — chacune a sa propre tuile). */
export function currentTravelDayWeather(plan: TravelPlan, pendingRest: { travelDay?: TravelRecapDay } | null | undefined): TravelRecapDay['weather'] {
  const active = plan.recap?.days[plan.recap.days.length - 1];
  return active?.weather ?? pendingRest?.travelDay?.weather;
}

/** Entrées d'une journée de route terrestre, figées au build de la cascade `travelDay` : l'horloge/les
 *  km avancent AVANT la cascade (marche terrestre déterministe — heures × vitesse, comportement
 *  conservé ; seuls les JETS d'Étape/péripétie sont influençables), donc la clôture a seulement à
 *  enchaîner. Porte la destination, les héros en marche forcée (→ cascade de NUIT), le résultat
 *  d'INTERRUPTION d'une péripétie (combat/embuscade différé), et `arrived`. Jamais persisté au-delà d'une
 *  journée. La ligne de récap du jour vit dans `plan.recap.days[dernier]` (le `while` la relit). */
export interface LandDayContext {
  toScene: string;
  toEntry?: string;
  toLabel: string;
  destLabel: string;
  marchHeroes: string[];
  /** INTERRUPTION posée par une péripétie (le voyage s'arrête, le combat/l'embuscade attend le recap). */
  interrupt?: TravelThen;
  /** Attelage FORCÉ (#270) : progression/conséquences du jour ACCUMULÉES par la chaîne de jets
   *  `landForcedPace`/`landForcedPaceControl`, relues à la clôture pour poser `kmDone`/`gameTime`
   *  (DIFFÉRÉS depuis le build, comme la vitesse fluviale `RiverDayContext`). Absent = conducteur non
   *  humain (chemin synchrone `forcedPaceDay`, kmDone/gameTime déjà posés au build). */
  forcedPaceResult?: { km: number; hours: number; vehicleOut: boolean; vehicleLame: boolean };
}

const log = (get: Get, _set: Set, lines: string[]) => {
  if (lines.length) get().log(lines);
};

/** Heures de voyage/jour SANS Test (RAW LDB 51 l.195, défaut 6) — paramétrable au niveau carte. */
export function baseHoursPerDay(map: WorldMap | null): number {
  return map?.params?.hoursPerDay ?? TRAVEL_DEFAULTS.hoursPerDay;
}

/** Plafond de marche forcée (heures/jour) — LDB 51 l.195 : silence, valeur maison (défaut 10),
 *  paramétrable au niveau carte. */
export function maxHoursPerDay(map: WorldMap | null): number {
  return map?.params?.forcedMaxHours ?? TRAVEL_DEFAULTS.forcedMaxHours;
}

/** Plafond dur d'une journée EN SELLE (heures) — endurance maximale d'une bête au pas (EDOC 07 l.142,
 *  12 h) : au-delà, le groupe DOIT haltE (les allures plus rapides s'épuisent plus tôt, gérées par
 *  `resolveMountedDay`). Sert au budget/jour de la monture (#340). */
const MOUNT_MAX_HOURS = 12;

/** Heures de voyage DÉJÀ parcourues le jour calendaire COURANT (accumulateur unique, `store.travelDayHours`)
 *  — le budget RAW de 6 h se compte PAR JOUR, jamais par trajet (#340). Un franchissement de jour remet à
 *  zéro (la clé `day` ne correspond plus). */
function hoursTravelledToday(get: Get): { foot: number; mount: number; marched: boolean } {
  const today = dayIndex(get().gameTime);
  const acc = get().travelDayHours;
  return acc && acc.day === today ? { foot: acc.foot, mount: acc.mount, marched: acc.marched }
    : { foot: 0, mount: 0, marched: false };
}

/** Ajoute `hours` (mode À PIED ou EN SELLE) au budget du jour calendaire `dayKey` — clé stable pour que la
 *  progression compte sur le jour de l'EFFORT même si le bloc enjambe minuit (#340). */
function addTravelHoursToday(get: Get, set: Set, dayKey: number, mode: 'pied' | 'monture', hours: number): void {
  const acc = get().travelDayHours;
  const prior = acc && acc.day === dayKey ? acc : { day: dayKey, foot: 0, mount: 0, marched: false };
  set({ travelDayHours: {
    day: dayKey,
    foot: prior.foot + (mode === 'pied' ? hours : 0),
    mount: prior.mount + (mode === 'monture' ? hours : 0),
    marched: prior.marched,
  } });
}

/** Marque la marche forcée du jour `dayKey` comme TESTÉE (un seul Test de Résistance/jour, LDB 51 l.195). */
function markMarchedToday(get: Get, set: Set, dayKey: number): void {
  const acc = get().travelDayHours;
  const prior = acc && acc.day === dayKey ? acc : { day: dayKey, foot: 0, mount: 0, marched: false };
  set({ travelDayHours: { ...prior, day: dayKey, marched: true } });
}

/** Un départ terrestre/fluvial est-il BLOQUÉ par la porte d'heure maison (#340) ? Vrai si la règle est
 *  active ET l'heure courante n'est pas dans le créneau aube→crépuscule. La mer est exemptée en amont. */
function departureGated(get: Get): boolean {
  return rule('travel-departure-gate') === true && !isTravelDaylight(get().gameTime);
}

/** « Attendre l'aube » (porte de départ, #340) : joue une nuit de sommeil (repos) — le groupe repart au
 *  matin par la modale de voyage. Efface la porte (le trajet mémorisé sert d'aide-mémoire à l'UI). */
export function departWaitDawn(get: Get, set: Set): void {
  const pd = get().pendingDeparture;
  set({ pendingDeparture: null });
  if (!pd) return;
  openRest(get, set, { places: placesOfKind('camp') });
}

/** Démarre un voyage depuis le lieu courant le long d'une route de la carte. */
export function startTravel(
  get: Get, set: Set,
  routeId: string,
  mode: TravelMode,
  opts: { classeId?: string; hoursPerDay?: number; allure?: Allure; seaPace?: number; fast?: boolean; cadence?: import('./voyageCadence').VoyageCadence } = {},
): void {
  const { worldMap, scene, battle, party } = get();
  if (battle || !worldMap || !scene) return;
  const from = placeOfScene(worldMap, scene.id);
  const route = worldMap.routes.find((r) => r.id === routeId);
  if (!from || !route || (route.a !== from.id && route.b !== from.id)) return;
  if (route.from != null && route.from !== from.id) return; // route à sens unique : pas dans ce sens
  // Trajet FERMé par le récit (`MapRoute.when`, #684) : le verrou est ICI, au même niveau que le sens
  // unique — la vue rend le trajet en affordance refusée, mais tout autre appelant (devtools, coop,
  // reprise de sauvegarde) bute sur la même porte. La raison d'auteur part au journal.
  if (route.when != null && !evalCondition(route.when, condCtx(get))) {
    log(get, set, route.refus ? [route.refus] : []);
    return;
  }
  // « En selle » suit les mêmes chemins qu'à pied (mode IMPLICITE des routes `pied`) — règle
  // `travel-allures` (EDOC 7) et chaque héros vivant en selle (EDOC 07 l.140).
  if (mode === 'monture' && (!rule('travel-allures') || !partyFullyMounted(party, get().possessions))) return;
  if (!route.modes.includes(mode === 'monture' ? 'pied' : mode)) return;
  const to = placeById(worldMap, otherEnd(route, from.id));
  if (!to) return;

  // Porte d'heure de départ (maison `travel-departure-gate`, #340) : terre (pied/monture) et fleuve
  // JOUÉ ne s'ébranlent que de l'aube au crépuscule. La MER est exemptée (voguer de nuit = équipage +
  // installations, MDG 15 l.76). De nuit → on mémorise le trajet et on propose « Attendre l'aube ».
  const riverPlayed = !!route.river && mode !== 'pied' && mode !== 'monture' && !!findVehicleById(mode)?.ship;
  if (mode !== 'mer' && (mode === 'pied' || mode === 'monture' || riverPlayed) && departureGated(get)) {
    set({ pendingDeparture: { routeId, mode, opts, dawnAt: get().gameTime + minutesUntilNext(get().gameTime, DAWN_MINUTE) } });
    return;
  }

  // Route MARITIME (MDG 13-15) : se voyage sur le NAVIRE DE CAMPAGNE — mode 'mer', distance en
  // MILLES, résolution du jour déléguée à `seaVoyageFlow` (météo/vent, Tests d'équipage, événements).
  if (mode === 'mer') {
    if (!route.sea) return;
    // Traversée RAPIDE (MDG 15 l.21-37) : un seul Test de Rude épreuve résout tout le trajet.
    if (opts.fast) {
      if (!startFastVoyage(get, set, routeId, from.id, to.id, route, { pace: opts.seaPace, cadence: opts.cadence })) {
        log(get, set, [t('tf.noVessel')]);
      }
      return;
    }
    const seaPlan = buildSeaPlan(get, routeId, from.id, to.id, route, { pace: opts.seaPace, cadence: opts.cadence });
    if (!seaPlan) {
      log(get, set, [t('tf.noVessel')]);
      return;
    }
    set({ travelPlan: seaPlan, worldMapOpen: false, travelRecap: null });
    log(get, set, [t('tf.seaDepart', { ship: seaPlan.vehicle!.label, to: to.label, km: route.km })]);
    runSeaDay(get, set);
    return;
  }
  if (route.sea) return; // une route maritime ne s'emprunte qu'en mode 'mer'

  // Route FLUVIALE JOUÉE (MSRC 7 « Navigation fluviale ») : sur une embarcation (barge…), la descente
  // se JOUE jour par jour (Test de Navigation, table des vents, périls, chavirage) au lieu d'un transport
  // payant. Repli sur le transport payant (« on paie un passeur ») si aucun batelier/embarcation.
  if (route.river && mode !== 'pied' && mode !== 'monture' && findVehicleById(mode)?.ship) {
    const riverPlan = buildRiverPlan(get, routeId, from.id, to.id, route, { cadence: opts.cadence });
    if (riverPlan) {
      set({ travelPlan: riverPlan, worldMapOpen: false, travelRecap: null });
      log(get, set, [t('tf.riverDepart', { ship: riverPlan.vehicle!.label, to: to.label, km: route.km })]);
      runRiverDays(get, set);
      return;
    }
    // Pas de batelier/embarcation : on retombe sur le transport payant (passeur).
  }

  // Transport payant : prix par km PAR PASSAGER (LDB 51 l.178), débité au départ — refus si bourse insuffisante.
  if (mode !== 'pied' && mode !== 'monture') {
    const passengers = party.filter((h) => !h.dead && !h.outOfRencontre).length;
    const cost = transportCost(route.km, mode, opts.classeId ?? '', passengers, route.prices?.[mode]);
    if (!cost) return; // mode sans facette `travel` (id de véhicule invalide) — rien à débiter, rien à jouer
    // Dépense de GROUPE (LDB 51 l.178) : passage sans bénéficiaire unique → cotisation gloutonne des bourses.
    if (!payFromGroup(get, set, cost, { purpose: 'passage' })) {
      log(get, set, [t('tf.passageTooDear', { mode: travelModeLabels()[mode].toLowerCase(), cost: formatMoney(cost) })]);
      return;
    }
    log(get, set, [t('tf.passagePaid', { cost: formatMoney(cost), mode: travelModeLabels()[mode].toLowerCase() })]);
  }

  // Allure EDOC (règle `travel-allures`) : en selle, pas/trot/galop (EDOC 07 l.140) ; sur un attelage,
  // « pas de course » forcé (EDOC 07 l.229) — seulement si le véhicule a un attelage (`travel.draft`).
  const allure: Allure | undefined = mode === 'monture'
    ? (opts.allure ?? 'pas')
    : opts.allure === 'galop' && rule('travel-allures') && vehicleTravel(mode)?.draft ? 'galop' : undefined;

  const base = baseHoursPerDay(worldMap);
  const hours = mode === 'pied'
    ? Math.min(Math.max(opts.hoursPerDay ?? base, 1), maxHoursPerDay(worldMap))
    : mode === 'monture'
      ? Math.min(Math.max(opts.hoursPerDay ?? base, 1), 12) // « au pas jusqu'à 12 heures sans repos » (EDOC 07 l.142)
      : base; // transport : cadence quotidienne du véhicule — LDB 51 silence, valeur maison (heures de route standard)
  // Coque transitoire du véhicule du trajet (`Combatant` à PV depuis `vehicles.json` hull) — encaisse les
  // Dégâts des Problèmes de véhicule (`applyVehicleProblem`). Créée sous les Étapes EDOC, ou dès que
  // l'allure est FORCÉE (EDOC 07 l.253 : Échec Stupéfiant de Conduite d'attelage → Problème de véhicule).
  const vehicle = mode !== 'pied' && mode !== 'monture' && (rule('travel-etapes') || allure === 'galop')
    ? (() => { const v = findVehicleById(mode); return v ? vehicleCombatant(v) : undefined; })()
    : undefined;
  const plan: TravelPlan = {
    routeId, fromPlaceId: from.id, toPlaceId: to.id, mode,
    hoursPerDay: hours, km: route.km, kmDone: 0, interrupted: false,
    ...(allure ? { allure } : {}),
    // Postes initialisés depuis les rôles PERSISTANTS (`travelRole`) — réutilisés chaque Étape (EDOC 8).
    postes: rule('travel-etapes') ? stageAssignmentFromRoles(party) : undefined,
    ...(vehicle ? { vehicle } : {}),
  };
  set({ travelPlan: plan, worldMapOpen: false, travelRecap: null });
  const allureLabel = allure ? t('tf.fragAllure', { allure: allureName(allure).toLowerCase() }) : '';
  log(get, set, [t('tf.depart', { to: to.label, km: route.km, mode: travelModeLabels()[mode].toLowerCase(), allure: allureLabel })]);
  runTravelDays(get, set);
}

/** Reprend un voyage interrompu (après une embuscade, par exemple). */
export function resumeTravel(get: Get, set: Set): void {
  const plan = get().travelPlan;
  if (!plan || get().battle) return;
  if (get().travelRecap?.then) return; // une embuscade ATTEND son acquittement — pas d'esquive
  // #296 — RECHARGE la coque de trajet depuis `vessel.wounds` (SOURCE UNIQUE) avant de reprendre : un
  // combat naval interrompant le voyage écrit sa fin sur `vessel` (`finalizeBattle`), jamais sur cette
  // copie de travail restée en mémoire — sans ce rechargement, le prochain Dégât/soin de coque du voyage
  // écraserait la valeur fraîche avec l'ancienne (persistance au coup par coup, `damageVesselHull`).
  let vehicle = plan.vehicle;
  const vessel = get().vessel;
  if (vehicle && vessel && vehicle.creatureId === vessel.vehicleId) {
    vehicle = { ...vehicle };
    syncHullWoundsFromVessel(vehicle, vessel);
  }
  set({ travelPlan: { ...plan, interrupted: false, ...(vehicle ? { vehicle } : {}) }, worldMapOpen: false, travelRecap: null });
  log(get, set, [t('tf.resume')]);
  // Mer (#275 Ronde 2 cran 3, Décision c) : `runSeaDay` ne ré-entre dans AUCUNE FSM — si une cascade de
  // voyage vit ENCORE (suspendue derrière le combat qui vient de finir), son garde de tête est un no-op
  // (l'arbitre la remontre) ; sinon elle enchaîne le jour suivant (`buildSeaDayCascade`).
  if (plan.sea) { runSeaDay(get, set); return; }
  if (plan.river) { runRiverDays(get, set); return; } // descente fluviale : résolution fluviale
  runTravelDays(get, set);
}

/** Boucle jour par jour jusqu'à l'arrivée (ou l'interruption par une péripétie). */
function runTravelDays(get: Get, set: Set): void {
  const worldMap = get().worldMap!;
  const base = baseHoursPerDay(worldMap);
  // Récapitulatif du SEGMENT (audit M4) — depuis le départ, ou depuis la reprise.
  const plan0 = get().travelPlan;
  // Empreinte des maladies DÉJÀ portées au départ — posée une seule fois par trajet (une reprise
  // après interruption retrouve celle du départ). Lue par la Phase d'arrivée (EDOC 09 l.21).
  if (plan0 && !plan0.diseasesAtStart) set({ travelPlan: { ...plan0, diseasesAtStart: diseaseKeys(get().party) } });
  const recap: TravelRecap | null = plan0 ? {
    fromLabel: libelleOuAbsence(placeById(worldMap, plan0.fromPlaceId), 'lieu', plan0.fromPlaceId),
    toLabel: libelleOuAbsence(placeById(worldMap, plan0.toPlaceId), 'lieu', plan0.toPlaceId),
    mode: plan0.mode, status: 'arrived', km: plan0.km, kmDone: plan0.kmDone,
    days: [], // SEGMENT courant seulement — les journées passées ont été lues à leur halte du soir
  } : null;
  const finishRecap = (status: TravelRecap['status'], then?: TravelThen, daysTotal?: number) => {
    if (!recap) return;
    recap.status = status;
    recap.kmDone = get().travelPlan?.kmDone ?? recap.km;
    set({ travelRecap: { ...recap, days: [...recap.days], then, daysTotal } });
  };
  let guard = 0;
  while (true) {
    guard += 1;
    if (guard > 400) break; // garde-fou (durée d'année) — un trajet ne dure jamais autant
    const plan = get().travelPlan;
    if (!plan || plan.interrupted) return;
    const route = worldMap.routes.find((r) => r.id === plan.routeId);
    const to = placeById(worldMap, plan.toPlaceId);
    if (!route || !to) { set({ travelPlan: null }); return; }
    const party = get().party;

    // Vitesse du jour (à pied, l'Encombrement/les États du moment comptent ; en selle, l'allure et les
    // Incidents de monte de la veille — recalculée chaque jour). Attelage Endommagé → cadence de base.
    const kmh = travelSpeed(party, get().possessions, plan.mode, route.speed?.[plan.mode], plan.vehicleLame ? undefined : plan.allure);
    if (kmh <= 0) {
      set({ travelPlan: { ...plan, interrupted: true } });
      log(get, set, [t('tf.overloaded')]);
      finishRecap('stalled');
      return;
    }

    // Déjà à destination (reprise d'un voyage interrompu sur le dernier kilomètre) : on arrive
    // sans rejouer une journée (ni fatigue ni péripéties — elles ont déjà été tirées ce jour-là).
    if (plan.km - plan.kmDone < 1e-9) {
      const daysTotal = (plan.log?.length ?? 0) + 1; // AVANT le null (#333 vague 2 — durée affichée à l'arrivée)
      const atStart = plan.diseasesAtStart ?? [];
      set({ travelPlan: null });
      log(get, set, [t('tf.arrival', { to: to.label }), ...travelArrivalCare(get, set), ...declareArrivalDiseases(get, set, atStart)]);
      finishRecap('arrived', undefined, daysTotal);
      get().transitionTo(to.scene, to.entry);
      return;
    }

    // Marche du jour : on avance l'horloge d'un bloc (PAS minute par minute, cf. en-tête).
    // Attelage FORCÉ au pas de course (EDOC 07 l.229) : la progression du jour se joue km par km
    // (Tests de Conduite d'attelage) — sinon, progression linéaire à la vitesse du mode.
    const kmLeft = plan.km - plan.kmDone;
    const forcedEligible = plan.allure === 'galop' && plan.mode !== 'monture' && !plan.vehicleLame && !!vehicleTravel(plan.mode)?.draft;
    const forcedDriver = forcedEligible ? garanti(partyAssisted(party, 'conduite-d-attelage'), 'conduite-d-attelage', 'conducteur') : null;
    // Conducteur dont le jet se SURFACE (#1262) : chaque Test de Conduite d'attelage au km devient une
    // ÉTAPE de la cascade `travelDay` (Chance/Pacte/Résilience possibles), chaînée par insertions
    // successives jusqu'au premier échec (`buildForcedPaceDaySteps`) — gameTime/kmDone sont alors
    // DIFFÉRÉS à la clôture (`continueTravelDayAfterCascade`), comme la progression fluviale.
    // Repli : allure forcée non éligible, ou aucun siège humain ne tient le conducteur → chemin SYNCHRONE (`forcedPaceDay`).
    const premierKm = forcedEligible && forcedDriver && surfaceOf(get, forcedDriver.actor.id)
      ? buildForcedPaceStep(forcedDriver, kmLeft)
      : undefined;
    if (premierKm) {
      const recapDay: TravelRecapDay = { kmFrom: plan.kmDone, kmTo: plan.kmDone, hours: 0, lines: [], entries: [] };
      recap?.days.push(recapDay);
      if (recap) set({ travelPlan: { ...get().travelPlan!, recap } });
      const daySteps = buildTravelDayCascade(get, set, route, recapDay, [], { toScene: to.scene, toEntry: to.entry, toLabel: to.label, destLabel: to.label });
      startCascade(get, set, { title: t('tf.dayTitleForced'), icon: 'travel/cart', purpose: 'travelDay', steps: [premierKm, ...daySteps] });
      return; // la clôture de la cascade (continueTravelDayAfterCascade) finalise le jour
    }
    const forced = forcedEligible ? forcedPaceDay(get, set, kmLeft) : null;
    // BUDGET D'HEURES PAR JOUR CALENDAIRE (#340) : le RAW compte 6 h/JOUR sans Test (LDB 51 l.195), pas
    // par trajet — les heures déjà parcourues aujourd'hui (`hoursTravelledToday`) grèvent le budget
    // du jour. À pied, le plafond DUR maison (`forcedMaxHours`, défaut 10 h) borne la journée ; en
    // selle, l'endurance au pas (12 h, EDOC 07 l.142). Le jour de l'EFFORT (`today0`) est figé AVANT
    // l'avance d'horloge (un bloc peut enjamber minuit — la fatigue reste comptée sur le jour vécu).
    const today0 = dayIndex(get().gameTime);
    const prior = hoursTravelledToday(get);
    const hoursToday = forced ? forced.hours
      : plan.mode === 'pied' ? Math.min(plan.hoursPerDay, kmLeft / kmh, Math.max(0, maxHoursPerDay(worldMap) - prior.foot))
      : plan.mode === 'monture' ? Math.min(plan.hoursPerDay, kmLeft / kmh, Math.max(0, MOUNT_MAX_HOURS - prior.mount))
      : Math.min(plan.hoursPerDay, kmLeft / kmh);
    set({ gameTime: get().gameTime + Math.round(hoursToday * 60) });
    bus.emit(EVT.TIME_ADVANCED, { minutes: Math.round(hoursToday * 60) });
    if (plan.mode === 'pied' || plan.mode === 'monture') addTravelHoursToday(get, set, today0, plan.mode, hoursToday);
    // L'ENTRETIEN du jour (rations/faim, maladies, convalescence) n'est PAS roulé ici : il se résout
    // dans la cascade de la halte de nuit (`buildNightCascade`), APRÈS le repas — sinon la Faim
    // s'installerait avant que le groupe ne mange. À l'ARRIVÉE (pas de nuit), le prochain
    // `runDailyUpkeep` (repos/advanceTime) le rattrape via la garde `lastUpkeepDay`.
    const kmDone = Math.min(plan.km, plan.kmDone + (forced ? forced.km : hoursToday * kmh));
    set({ travelPlan: { ...get().travelPlan!, kmDone } });
    const recapDay: TravelRecapDay = {
      kmFrom: plan.kmDone, kmTo: kmDone, hours: hoursToday,
      lines: toRecapLines(forced?.lines ?? []), entries: [...(forced?.entries ?? [])],
    };
    recap?.days.push(recapDay);
    if (forced) {
      log(get, set, forced.lines);
      // Conséquences d'attelage : Endommagé → au pas jusqu'à réparation (l.272-280) ; Cassé/Accident ou
      // coque à 0 Blessure → véhicule hors d'usage, la route continue à pied.
      if (forced.vehicleLame) set({ travelPlan: { ...get().travelPlan!, vehicleLame: true } });
      if (forced.vehicleOut) {
        set({ travelPlan: { ...get().travelPlan!, mode: 'pied', allure: undefined } });
        log(get, set, [t('tf.vehicleOut')]);
        recapDay.lines.push({ text: t('tf.vehicleOut'), tone: 'bad' });
      }
    }

    // Fin de journée de route À PIED : fatigue d'Encombrement (p.295, non-jetée) + recensement des
    // héros en MARCHE FORCÉE (LDB 51 l.195). Le JET de marche forcée est DIFFÉRÉ : s'il y a une halte de
    // nuit, il ouvre la cascade influençable de la nuit ; sinon (arrivée/interruption) il est roulé
    // d'office ici (pas de halte où le présenter).
    const dayLines: string[] = [];
    const marchHeroes: string[] = [];
    if (plan.mode === 'pied') {
      // Décision sur le CUMUL du jour (prior + ce bloc), pas sur ce seul trajet (#340) : la fatigue
      // d'Encombrement s'applique quand le jour franchit le seuil des heures de base (une fois/jour) ;
      // la marche forcée (LDB 51 l.195) recense les héros dès que le cumul dépasse la base, une seule fois par
      // jour calendaire (`marched`) — un seul Test de Résistance par jour, quel que soit le nombre de trajets.
      const totalFoot = prior.foot + hoursToday;
      const crossedFatigue = prior.foot < base - 1e-9 && totalFoot >= base - 1e-9;
      const overBudget = totalFoot > base + 1e-9 && !prior.marched;
      for (const h of party) {
        if (h.dead || h.outOfRencontre) continue;
        if (crossedFatigue) { const fatigue = applyTravelFatigue(h); dayLines.push(...fatigue); recapDay.lines.push(...toRecapLines(fatigue)); }
        if (overBudget) marchHeroes.push(h.id);
      }
      if (overBudget && marchHeroes.length) markMarchedToday(get, set, today0);
      if (dayLines.length) set({ party: [...party] });
    }
    log(get, set, dayLines);

    // Journée EN SELLE (EDOC 07 l.142-146) : endurance de l'allure des bêtes, Incidents de monte
    // (EDOC 07 l.148-174), chute du cavalier, bête perdue — puis dégradation à pied si le groupe
    // n'est plus monté au complet (les cavaliers ne marchent pas : ni fatigue ni marche forcée).
    // `prior.mount` = heures DÉJÀ chevauchées aujourd'hui : l'endurance se compte sur le jour, pas le trajet (#340).
    if (plan.mode === 'monture') resolveMountedTravelDay(get, set, hoursToday, plan.allure ?? 'pas', recapDay, prior.mount);

    // Sous-système OPTIONNEL « Voyage par Étapes » (EDOC 8, parent `travel-etapes`) + PÉRIPÉTIES du
    // jour (d'auteur puis table d10 RAW). TOUS les JETS du jour (Activités d'Étape, Exposition de fin
    // d'Étape, Survie/Perception des péripéties) sont des ÉTAPES d'une CASCADE influençable
    // (`purpose:'travelDay'`, Chance/Pacte/Résilience) — plus d'auto-résolution inline. Ordre RAW (l.10)
    // : Météo (tirée ici, ambiance) → activités → péripéties. Quand aucun jet n'est produit (règle
    // Étapes éteinte ET pas de péripétie testable), la cascade est VIDE → on finalise directement (le
    // chemin jour-par-jour du LdB reste BYTE-IDENTIQUE).
    const daySteps = buildTravelDayCascade(get, set, route, recapDay, marchHeroes, {
      toScene: to.scene, toEntry: to.entry, toLabel: to.label, destLabel: to.label,
    });
    // Récap du SEGMENT posé sur le plan : la cascade suspend le `while`, donc son `recap`/`recapDay`
    // locaux ne survivent pas — `continueTravelDayAfterCascade` les relit depuis `plan.recap`.
    if (recap) set({ travelPlan: { ...get().travelPlan!, recap } });
    if (daySteps.length) {
      startCascade(get, set, { title: t('tf.dayTitle'), icon: 'travel/compass', purpose: 'travelDay', steps: daySteps });
      return; // la clôture de la cascade (continueTravelDayAfterCascade) finalise le jour
    }
    // Aucun jet influençable : finalisation immédiate (arrivée / halte de nuit) — comme la cascade le
    // ferait à sa clôture. Chaque journée finalise le segment (halte/arrivée) → une seule itération.
    continueTravelDayAfterCascade(get, set);
    return;
  }
}

/** Reprise au MATIN après la halte de nuit (« Continuer » du bilan de la modale de Repos). */
export function continueTravelAfterNight(get: Get, set: Set): void {
  const plan = get().travelPlan;
  if (!plan || plan.interrupted || get().battle) return;
  if (plan.sea) { runSeaDay(get, set); return; } // traversée maritime : la journée suivante est navale
  if (plan.river) { runRiverDays(get, set); return; } // descente fluviale : la journée suivante est fluviale
  runTravelDays(get, set);
}

/** Saison courante (table de Météo EDOC 8 l.52) depuis l'horloge du jeu. */
function currentSeason(get: Get): Season {
  return seasonOfMonth(toDate(get().gameTime).month);
}

/**
 * Construit les ÉTAPES influençables du JOUR terrestre (cascade `purpose:'travelDay'`) — la MISE EN
 * SCÈNE des jets du jour, dans l'ORDRE de résolution RAW (l.10) : (Étape EDOC) Météo tirée ici
 * (ambiance, 1 tirage), puis les postes d'Activité (l.131) + l'agrégation qui INSÈRE l'Exposition de
 * fin d'Étape (l.73) ; enfin les PÉRIPÉTIES (LDB 51 l.208) — un pas `landPeril` qui, à sa validation, tire les
 * péripéties d'auteur (d100) puis la table d10 et INSÈRE le jet influençable (Survie/Perception) quand
 * la péripétie en demande un. Zéro RNG consommé au build hormis la Météo (les jets vivent dans les
 * étapes / appliers) : le build ne consomme pas d'aléa. Renvoie `[]` s'il n'y a AUCUN jet
 * (règle Étapes éteinte ET pas de péripétie testable) : l'appelant finalise alors directement.
 */
/**
 * MÉTÉO D'ÉTAPE (#1426) — UNE table par SAISON, DÉRIVÉE de la donnée (`weather.json` : des
 * fourchettes PLATES `{min, max, weather}`, les DEUX bornes authorées), jamais réécrite à la main.
 * Les deux bornes viennent de la rangée : reconstruire la basse par POSITION donnerait deux vérités
 * sur un même jet — la rangée APPLIQUÉE (`step.table.result`) et la ligne AFFICHÉE (`weatherFromRoll`,
 * qui lit les `min` authorés) divergeraient dès qu'une borne est éditée au Codex.
 * La saison choisit la TABLE ; elle n'est
 * donc JAMAIS un modificateur de dé — conséquence directe : `mod` vaut 0 sur ces tables, et aucune
 * rangée n'est rendue inatteignable par un décalage (`naturalRollForTableRow` rend un naturel pour
 * chacune de ses lignes, cf. `de-monde-surface.test.ts`).
 */
const STAGE_WEATHER_KIND = 'stageWeather';
const STAGE_WEATHER_STEP_ID = 'stage-weather';
const stageWeatherTableId = (season: Season): string => `stage-weather-${season}`;

/** Les rangées de la table d'une saison : la fourchette AUTHORÉE de `weather.json`, l'id stable étant
 *  la météo. Aucune borne n'est recalculée — c'est ce que `weatherFromRoll` lit pour la ligne montrée. */
export const stageWeatherRows = (ranges: { min: number; max: number; weather: string }[]): TableStepRow[] =>
  ranges.map((r) => ({ id: r.weather, min: r.min, max: r.max }));

/** Les tables de météo par saison — FAMILLE dérivée de `weather` (#1692) : la Map se refait à la
 *  première lecture du registre qui suit une édition, donc une saison ajoutée au Codex a sa table et
 *  une saison retirée n'en a plus — pour TOUS les lecteurs, y compris une cascade reprise d'une
 *  sauvegarde, jamais seulement pour celui qui ouvre l'étape. */
const tablesDeMeteo = memoParVersion('weather', () => new Map<string, TableStepDef>(
  weather.map((saison) => [stageWeatherTableId(saison.id as Season), {
    label: t('step.stageWeather'),
    die: 100,
    rows: stageWeatherRows(saison.ranges),
    lines: (die) => [t('out.stageWeather', { weather: weatherCondition(weatherFromRoll(die, saison.id as Season)).label })],
  }]),
));

registerTableStepFamily(tablesDeMeteo);

registerCascadeApplier(STAGE_WEATHER_KIND, (get, set, step) => {
  const tiree = step.table?.result;
  if (!tiree) return {};
  const w = tiree.id as Weather;
  const season = currentSeason(get);
  // CONTEXTE DU JOUR : il vit dans l'état (`plan.recap.days[dernier]`, poussé avant le build) — une
  // fenêtre de pose peut s'intercaler entre le dé et la suite, donc la pile ne peut pas le porter.
  const jours = get().travelPlan?.recap?.days ?? [];
  const recapDay = jours.length ? jours[jours.length - 1] : undefined;
  if (recapDay) {
    recapDay.weather = { id: w, roll: tiree.roll };
    recapDay.lines.push({ text: t('out.stageWeather', { weather: weatherCondition(w).label }) });
  }
  // Les étapes qui DÉPENDENT du temps qu'il fait : elles n'existaient pas avant que le dé tombe.
  // La ligne de météo vient de la TABLE (source unique de son libellé) et rejoint le journal comme
  // toute conséquence — le dé, lui, reste sur la rangée : la prose ne le répète pas.
  return {
    consequences: freeCons(tiree.lines),
    insert: [...buildWeatherResistanceSteps(get, w), ...buildStageSteps(get, set, w, season)],
  };
});

function buildTravelDayCascade(
  get: Get, set: Set, route: MapRoute, recapDay: TravelRecapDay, marchHeroes: string[],
  dest: { toScene: string; toEntry?: string; toLabel: string; destLabel: string },
): CascadeStep[] {
  const steps: BuiltCascadeStep[] = [];

  // Météo « au début de chaque étape » (l.42, EDOC 8 l.50) : dé de MONDE sur la table de SA SAISON —
  // une étape à TABLE, en tête du jour. Le siège qui possède l'environnement la POSE (option « Dés
  // fixés ») ou la voit passer.
  //
  // Ce qui DÉPEND du résultat (contexte de jour, Test de Résistance de traversée, postes d'Étape) vit
  // dans son APPLIER, qui l'`insert` derrière elle : c'est le canal du séquenceur pour « ces étapes-là
  // n'existent qu'une fois le dé connu ». L'ordre des dés reste météo → Résistance → postes.
  if (rule('travel-etapes')) {
    pousseSi(steps, tableStep({
      id: STAGE_WEATHER_STEP_ID, kind: STAGE_WEATHER_KIND, worldOwner: true, icon: 'travel/wave',
      label: t('step.stageWeather'),
      table: { tableId: stageWeatherTableId(currentSeason(get)), spec: { n: 1, sides: 100 } },
      stake: voyageStakeRef(STAGE_WEATHER_KIND),
    }));
  }

  // PÉRIPÉTIES du jour (LDB 51 l.208) : un pas de VÉRIFICATION dont l'applier tire les péripéties d'auteur
  // (d100) puis la table d10 (MÊME ordre RNG qu'inline — APRÈS les jets d'Étape) et, si la péripétie
  // propose un Test (Survie/Perception), INSÈRE le jet influençable juste après. N'est ajouté que s'il
  // y a des péripéties À TIRER (auteur ou table d10) — sinon le jour n'a pas de pas de péripétie (le
  // chemin de base sans péripétie reste sans cascade quand la règle Étapes est éteinte).
  // Péripéties d'AUTEUR : une étape de MONDE par péril (dé posable, tracée), AVANT le pas de table —
  // l'ordre RNG d'origine (d100 d'auteur ×N, puis d10 de seuil, puis d10 de table) est celui-ci.
  steps.push(...buildAuthorPerilSteps(route, dest.destLabel, LAND_PERIL_INTERRUPT));
  const perilDie = route.perilDie ?? get().worldMap?.params?.perilDie ?? TRAVEL_DEFAULTS.perilDie;
  if (perilDie >= 1) {
    // Le tirage des péripéties n'est le pas d'AUCUN héros : c'est la route qui le lance (étape MONDE,
    // routée au siège MJ) — les Tests qu'elle appelle, eux, nomment leur jeteur à l'insertion.
    steps.push(displayStep({
      id: 'land-peril', kind: 'landPeril', icon: 'ui/warning', label: t('step.landPeril'),
      worldOwner: true, meta: { destLabel: dest.destLabel },
    }));
  }

  // Contexte du jour relu par la clôture (arrivée/halte, recalculée depuis `plan.kmDone` — posé avant
  // le build sur le chemin synchrone, ou par la chaîne `landForcedPace` sur le chemin différé).
  // L'interruption d'une péripétie s'y posera.
  set({ travelPlan: { ...get().travelPlan!, land: {
    toScene: dest.toScene, toEntry: dest.toEntry, toLabel: dest.toLabel,
    destLabel: dest.destLabel, marchHeroes: [...marchHeroes],
  } } });
  void recapDay; // le récap du jour (plan.recap.days[dernier]) reçoit la tranche de journal à la clôture
  return steps;
}

/** Lignes STRUCTURÉES d'une étape de cascade DÉJÀ committée, phase-taguée (#349, dette 3) — un pas
 *  BATCH déplie ses PARTICIPANTS (chacun porte SA conséquence, `stagePosteBatch`/`weatherResistance`) ;
 *  un pas MONO lit `step.outcome`. `phaseOfKind` (catalogue PARTAGÉ, `state/recapLine.ts`, le MÊME que
 *  l'agenda du jour EN COURS `ui/VoyageScreen.dayAgenda`) rattache la ligne à sa phase — `undefined`
 *  pour un `kind` hors catalogue (silencieux). */
function stepRecapLines(step: CascadeStep): RecapLine[] {
  const phase = phaseOfKind(step.kind);
  const raw = step.participants ? step.participants.flatMap((p) => p.outcome ?? []) : (step.outcome ?? []);
  return phase ? raw.map((l) => ({ ...l, phase })) : raw;
}

/**
 * Clôture de la cascade du jour terrestre (`purpose:'travelDay'`, appelée par le store) : le jour est
 * fini de se JOUER (postes/exposition/péripéties validés) — reste à enchaîner. Roule la marche forcée
 * EAGER si le jour n'aboutit PAS sur une halte de nuit (arrivée/interruption : pas de nuit où la
 * présenter), sinon la DIFFÈRE à la cascade de nuit (`travelMarch`). Puis : interruption (péripétie) →
 * recap `interrupted` + suite différée ; arrivée → transition ; sinon → halte de nuit (`openRest`).
 * Efface le contexte transitoire du jour. Renvoie `true` (le segment est toujours clos ici).
 * `done` : la cascade `travelDay` FINALISÉE (`dispatchCascadeDone`, `combatSlice.ts`) — ses étapes
 * committées portent les lignes de récap phase-taguées (#349) ; absente quand `buildTravelDayCascade`
 * n'a produit AUCUNE étape (la météo/hors-cascade a déjà été poussée directement sur `recapDay.lines`).
 */
export function continueTravelDayAfterCascade(get: Get, set: Set, done?: PendingCascade): boolean {
  const plan = get().travelPlan;
  if (!plan) return true;
  const worldMap = get().worldMap;
  const route = worldMap?.routes.find((r) => r.id === plan.routeId);
  const ctx = plan.land;
  const recap = plan.recap;
  const recapDay = recap?.days[recap.days.length - 1];
  // Récap du jour : les lignes des étapes de la cascade close (météo/hors-cascade déjà poussées au
  // build, cf. `buildTravelDayCascade`) — phase-taguées via le catalogue partagé (dette 3).
  if (recapDay && done) recapDay.lines.push(...done.participants.flatMap(stepRecapLines));
  // Attelage FORCÉ conducteur JOUEUR (#270) : gameTime/kmDone étaient DIFFÉRÉS depuis le build (la
  // chaîne `landForcedPace` n'a résolu km/heures qu'au fil des jets) — on les pose maintenant, comme
  // le chemin synchrone les pose avant le build. Absent (conducteur IA / pas d'attelage forcé) : rien
  // à faire ici, `plan.kmDone`/`gameTime` sont déjà à jour.
  const fp = ctx?.forcedPaceResult;
  if (fp) {
    set({ gameTime: get().gameTime + Math.round(fp.hours * 60) });
    bus.emit(EVT.TIME_ADVANCED, { minutes: Math.round(fp.hours * 60) });
    const kmDone = Math.min(plan.km, plan.kmDone + fp.km);
    set({ travelPlan: { ...get().travelPlan!, kmDone } });
    if (fp.vehicleLame) set({ travelPlan: { ...get().travelPlan!, vehicleLame: true } });
    if (fp.vehicleOut) {
      set({ travelPlan: { ...get().travelPlan!, mode: 'pied', allure: undefined } });
      log(get, set, [t('tf.vehicleOut')]);
      recapDay?.lines.push({ text: t('tf.vehicleOut'), tone: 'bad' });
    }
    if (recapDay) { recapDay.kmTo = get().travelPlan?.kmDone ?? recapDay.kmTo; recapDay.hours = fp.hours; }
  }
  // Arrivée recalculée depuis `plan.kmDone` À JOUR (posé au build sur le chemin synchrone, ci-dessus
  // sur le chemin différé) — source UNIQUE, sans champ `LandDayContext.arrived` figé au build.
  const arrived = (get().travelPlan?.km ?? 0) - (get().travelPlan?.kmDone ?? 0) < 1e-9;

  // Efface les contextes transitoires du jour (jamais persistés au-delà de la journée).
  set({ travelPlan: { ...get().travelPlan!, land: undefined, stage: undefined, recap: undefined } });

  const finishRecap = (status: TravelRecap['status'], then?: TravelThen, daysTotal?: number) => {
    if (!recap) return;
    recap.status = status;
    recap.kmDone = get().travelPlan?.kmDone ?? recap.km;
    set({ travelRecap: { ...recap, days: [...recap.days], then, daysTotal } });
  };
  // Marche forcée du jour (LDB 51 l.195) : DIFFÉRÉE à la nuit si halte ; sinon roulée EAGER (arrivée/interruption).
  const rollMarchEager = () => {
    for (const id of ctx?.marchHeroes ?? []) {
      const h = get().party.find((x) => x.id === id);
      if (!h) continue;
      const r = forcedMarchTest(h, battleRng());
      if (r) { log(get, set, [r.line]); recapDay?.entries?.push({ actorId: id, icon: 'travel/foot', label: t('step.marcheForcee'), d: r.d, text: r.gained ? t('tf.fragExtenue', { n: r.gained }) : t('tf.holdsPace'), tone: r.gained ? 'bad' : 'ok' }); }
    }
    set({ party: [...get().party] });
  };

  // INTERRUPTION par une péripétie (combat/embuscade différé) : le voyage s'arrête sur le récit.
  if (ctx?.interrupt) {
    rollMarchEager();
    set({ travelPlan: { ...get().travelPlan!, interrupted: true } });
    finishRecap('interrupted', ctx.interrupt);
    return true;
  }
  if (!route || !ctx) { set({ travelPlan: null }); return true; }

  if (arrived) {
    rollMarchEager();
    // Durée totale du voyage (#333 vague 2) : jours CLOS + le jour courant (jamais logué, l'arrivée ne
    // halte pas) — CAPTURÉ avant que `travelPlan` (et son `log`) ne soit remis à `null`.
    const daysTotal = (get().travelPlan?.log?.length ?? 0) + 1;
    const atStart = get().travelPlan?.diseasesAtStart ?? [];
    set({ travelPlan: null });
    const care = [...travelArrivalCare(get, set), ...declareArrivalDiseases(get, set, atStart)];
    if (recapDay) recapDay.lines.push(...toRecapLines(care));
    log(get, set, [t('tf.arrival', { to: ctx.toLabel }), ...care]);
    finishRecap('arrived', undefined, daysTotal);
    get().transitionTo(ctx.toScene, ctx.toEntry);
    return true;
  }
  // Nuit en route : HALTE — modale de Repos (auberge de relais si la route en a, sinon campement). Le
  // voyage se suspend ; « Continuer » du bilan reprend la route au matin. La MARCHE FORCÉE du jour
  // ouvre la cascade de la nuit (influençable) via `travelMarch` — pas de roulé eager ici.
  const travelDay: TravelRecapDay | undefined = recapDay ? { ...recapDay, lines: [...recapDay.lines], entries: [...(recapDay.entries ?? [])] } : undefined;
  openRest(get, set, { places: placesOfKind(route.inns ? 'auberge' : 'camp'), travelHalt: true, travelMarch: ctx.marchHeroes, travelDay });
  return true;
}

// ── APPLIER des PÉRIPÉTIES du jour terrestre (cascade `travelDay`) : joue la table d10 RAW, résout
//    les kinds sans jet joueur inline, et INSÈRE le jet influençable (Survie « éreintant » /
//    Perception « attaque ») quand la péripétie en demande un.
//    ORDRE RNG du jour : d100 auteur → d10 seuil → d10 table → jet.

/** Pose l'INTERRUPTION du jour sur le contexte terrestre (relue par `continueTravelDayAfterCascade`). */
function markLandInterrupt(get: Get, set: Set, then: TravelThen, destLabel: string): string[] {
  const plan = get().travelPlan;
  if (plan?.land) set({ travelPlan: { ...plan, land: { ...plan.land, interrupt: then } } });
  return [t('tf.travelInterrupted', { to: destLabel })];
}

// PROTOCOLE DE REPRISE TERRESTRE : les effets d'un péril interrompant ne s'appliquent PAS tout de
// suite — ils sont DIFFÉRÉS dans `travelPlan.land.interrupt` (`TravelThen`), que la fin de journée
// rejouera (`continueTravelDayAfterCascade`). Déclaré au flux, jamais deviné par le module partagé.
registerPerilInterrupt(LAND_PERIL_INTERRUPT, (get, set, effects, destLabel) =>
  markLandInterrupt(get, set, { kind: 'effects', effects }, destLabel));

registerCascadeApplier('landPeril', (get, set, step) => {
  const worldMap = get().worldMap;
  const route = worldMap?.routes.find((r) => r.id === get().travelPlan?.routeId);
  if (!route) return;
  const destLabel = String(step.meta?.destLabel ?? '');
  const j: string[] = [];

  // 1. Péripéties d'AUTEUR : chacune est SON étape de monde (`buildAuthorPerilSteps`,
  //    `authorPerils.ts`), poussée AVANT ce pas — leurs dés tombent donc toujours avant la table d10.

  // 2. Table d10 RAW (LDB 51 l.210-221). L'entrée à Test (éreintant/attaque) INSÈRE un jet influençable ; les kinds
  //    sans jet (reposant/narratif) sont résolus inline (mêmes sous-jets, même ordre).
  const die = route.perilDie ?? get().worldMap?.params?.perilDie ?? TRAVEL_DEFAULTS.perilDie;
  if (die >= 1 && d10(battleRng()) === die) {
    const entry = PERIPETIES[d10(battleRng()) - 1];
    j.push(t('tf.perilTable', { roll: entry.roll, label: entry.label, text: entry.desc }));
    const party = get().party;
    if (entry.kind === 'reposant') {
      for (const h of party) {
        if (h.dead) continue;
        if (h.wounds.current < h.wounds.max) {
          // SOURCE UNIQUE `applyHealWounds` — plafond munition logée (LDB 62 l.250) même chemin que Guérison/repos.
          j.push(...applyHealWounds(h, h.wounds.max - h.wounds.current, {
            skillCheck: false, wake: false,
            log: () => [h.wounds.current >= h.wounds.max ? t('tf.healAll', { name: h.label }) : t('tf.healPartial', { name: h.label })],
          }));
        }
        const n = stacks(h, 'extenue');
        if (n > 0) { removeCondition(h, 'extenue', n); j.push(t('tf.noMoreExtenue', { name: h.label })); }
      }
      set({ party: [...party] });
    } else if (entry.kind === 'ereintant') {
      // Survie en extérieur Accessible (+20) INFLUENÇABLE → étape-jet insérée (échec = retard + Exténué).
      const best = partyAssisted(party, 'survie-en-exterieur'); // Soutien (LDB 12)
      const st = best && monoStep({
        id: 'peril-survie', kind: 'landPerilSurvie', actor: best.actor, icon: 'travel/compass', label: t('step.landPerilSurvie'),
        rollLabel: refLabel('skills', { id: 'survie-en-exterieur' }), difficulty: 'accessible',
        stake: voyageStakeRef('landPerilSurvie'),
        ligne: { test: { skill: 'survie-en-exterieur' }, valeur: best.value, soutien: best.support },
      });
      if (st) return { consequences: freeCons(j), insert: [st] };
      j.push(...applyEreintant(get, set)); // personne pour tester : retard direct
    } else if (entry.kind === 'attaque') {
      // Perception Accessible (+20) INFLUENÇABLE → étape-jet insérée ; son applier pose l'embuscade
      // différée (le `noSurprise` suit le jet). Sans tester (aucun héros vivant) : interruption directe.
      const configured = !!(route.ambush?.scene && route.ambush.encounter);
      const best = partyAssisted(party, 'perception'); // Soutien (LDB 12)
      const st = best && monoStep({
        id: 'peril-perception', kind: 'landPerilPerception', actor: best.actor, icon: 'ui/eye', label: t('step.landPerilPerception'),
        rollLabel: refLabel('skills', { id: 'perception' }), difficulty: 'accessible',
        stake: voyageStakeRef('landPerilPerception'),
        ligne: { test: { skill: 'perception' }, valeur: best.value, soutien: best.support },
        meta: { destLabel, configured, ambushScene: route.ambush?.scene ?? '', ambushEntry: route.ambush?.entry ?? '', ambushEnc: route.ambush?.encounter ?? '' },
      });
      if (st) return { consequences: freeCons(j), insert: [st] };
      if (configured) { j.push(...markLandInterrupt(get, set, { kind: 'ambush', scene: route.ambush!.scene, entry: route.ambush!.entry, encounter: route.ambush!.encounter, noSurprise: false }, destLabel)); return { consequences: freeCons(j) }; }
      j.push(t('tf.noAmbushConfigured'));
    }
    // narratif (default) : le texte au journal suffit.
  }
  return { consequences: freeCons(j) };
});

/** « Voyage éreintant » (LDB 51 l.215) : Survie en extérieur (+20) INFLUENÇABLE ; échec → +1 jour de retard et
 *  +1 Exténué chacun (`applyEreintant`). */
registerCascadeApplier('landPerilSurvie', (get, set, step, hero) => {
  if (!step.result) return;
  // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5) ;
  // succès sans effet (rien à ajouter) → aucune conséquence, l'échec parle par son effet (`applyEreintant`).
  if (step.result.success) return { consequences: freeCons([t('tf.survieOk', { who: garanti(hero, step.actorId, 'survivant du péril').label })]) };
  return { consequences: freeCons(applyEreintant(get, set)) };
});

/** « Attaqués ! » (LDB 51 l.221) : Perception (+20) INFLUENÇABLE ; réussie → le groupe les voit venir (sans
 *  surprise) ; l'embuscade configurée est DIFFÉRÉE derrière le récit (le `noSurprise` suit le jet). */
registerCascadeApplier('landPerilPerception', (get, set, step, hero) => {
  if (!step.result) return;
  const configured = !!step.meta?.configured;
  const destLabel = String(step.meta?.destLabel ?? '');
  // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5) ;
  // échec sans embuscade configurée (rien à ajouter) → aucune conséquence.
  const j: string[] = step.result.success
    ? [t('tf.perceptionOk', { who: garanti(hero, step.actorId, 'guetteur du péril').label })]
    : configured ? [t('tf.perceptionAmbush', { who: garanti(hero, step.actorId, 'guetteur du péril').label })] : [];
  if (configured) j.push(...markLandInterrupt(get, set, {
    kind: 'ambush', scene: String(step.meta?.ambushScene ?? ''), entry: String(step.meta?.ambushEntry ?? '') || undefined,
    encounter: String(step.meta?.ambushEnc ?? ''), noSurprise: step.result.success,
  }, destLabel));
  return { consequences: freeCons(j) };
});

/**
 * Applique la journée EN SELLE (EDOC 07 l.142-146) : le moteur PUR `resolveMountedDay` rend la fatigue
 * des bêtes et les Incidents de monte ; ici on APPLIQUE — chute du cavalier (Dégâts de Chute, brique
 * `applyFall`, ouverte à la porte par `ouvrirChute`), état persistant sur la Possession (`mountInjury`, SOCLE POSSESSIONS #617/#618), bête
 * morte/condamnée marquée `destroyed` — et on dégrade la route à pied si le groupe n'est plus monté au
 * complet.
 */
function resolveMountedTravelDay(get: Get, set: Set, hoursToday: number, allure: Allure, day: TravelRecapDay, priorHours = 0): void {
  const outcomes = resolveMountedDay(partyMounts(get().party, get().possessions), hoursToday, allure, battleRng(), priorHours);
  const lines: string[] = [];
  const injuries = new Map<string, MountInjury>();
  const abandoned = new Set<string>();
  const chutes: { hero: Combatant; metres: number }[] = [];
  for (const o of outcomes) {
    lines.push(...o.lines);
    for (const mt of o.tests) {
      day.entries!.push({ actorId: o.mount.hero.id, icon: 'travel/mount', label: mt.label, d: mt, text: mt.success ? t('tf.holdsPace') : t('tf.flanche'), tone: mt.success ? 'ok' : 'bad' });
    }
    for (const inc of o.incidents) {
      if (inc.riderTest) {
        day.entries!.push({
          actorId: o.mount.hero.id, icon: 'travel/mount', label: t('tf.mountIncident', { incident: inc.entry.label }), d: inc.riderTest,
          text: inc.riderTest.success ? t('tf.staysInSaddle') : t('tf.fallsOff'), tone: inc.riderTest.success ? 'ok' : 'bad',
        });
      }
      // Chute de selle (2 mètres, EDOC 07 l.167/l.174) — Dégâts de Chute (LDB 15) via la brique partagée.
      // Le 1d10 passe par la PORTE (#1508) : une étape à dé nu du cavalier, appendue à la journée en
      // cours ; ce qu'il encaisse se dit à la résolution de son dé. Servies APRÈS la boucle, comme les
      // blessures de monture : la journée finit de se composer avant qu'une fenêtre ne s'ouvre.
      if (inc.riderFallM) chutes.push({ hero: o.mount.hero, metres: inc.riderFallM });
      if (inc.injury) injuries.set(o.mount.possession.uid, inc.injury);
    }
    // Bête morte (poussée jusqu'à la mort, l.146) ou Patte brisée (« peu d'espoir qu'elle y survive »,
    // l.163) : marquée `destroyed` — abandonnée sur la route.
    const injury = injuries.get(o.mount.possession.uid) ?? o.mount.possession.mountInjury;
    if (o.dead || injury === 'patte-brisee') {
      abandoned.add(o.mount.possession.uid);
      lines.push(t('tf.mountAbandoned', { name: o.mount.hero.label, mount: possessionLabel(o.mount.possession) }));
    }
  }
  if (injuries.size || abandoned.size) {
    set({
      possessions: get().possessions.map((p) => {
        if (abandoned.has(p.uid)) return { ...p, destroyed: true };
        if (p.nature === 'bete' && injuries.has(p.uid)) return { ...p, mountInjury: injuries.get(p.uid) };
        return p;
      }),
    });
  }
  log(get, set, lines);
  day.lines.push(...toRecapLines(lines));
  for (const c of chutes) ouvrirChute(set, c.hero, c.metres);
  if (!partyFullyMounted(get().party, get().possessions)) {
    set({ travelPlan: { ...get().travelPlan!, mode: 'pied', allure: undefined } });
    const l: string = t('tf.notAllMounted');
    log(get, set, [l]);
    day.lines.push({ text: l });
  }
}

/** Issue d'une journée d'attelage FORCÉ (collectée puis journalisée par l'appelant). */
interface ForcedPaceDayResult {
  km: number;
  hours: number;
  lines: string[];
  entries: NonNullable<TravelRecapDay['entries']>;
  /** Cassé/Accident ou coque à 0 Blessure : véhicule hors d'usage. */
  vehicleOut: boolean;
  /** Endommagé : au pas jusqu'à réparation (EDOC 07 l.278-280). */
  vehicleLame: boolean;
}

/** Les bêtes de l'attelage telles que le résolveur pur les attend : `draft.count` pions du MÊME profil
 *  (`montures.json`), dont le Bonus d'Endurance dérive de l'Endurance du profil (réducteur des Blessures
 *  de `EDOC 07 l.253`). SOURCE UNIQUE des deux surfaces de l'allure forcée. */
function draftAnimals(count: number, endurance: number): ForcedPaceAnimal[] {
  return Array.from({ length: count }, () => ({ valeurResistance: endurance, be: bonus(endurance) }));
}

/** Journal des bêtes éprouvées après l'échec du conducteur — SURFACE UNIQUE des deux surfaces (repli
 *  synchrone et cascade joueur). Les bêtes de l'attelage n'ont AUCUNE rangée dédiée (transport sans
 *  identité) : le journal PORTE seul leur jet et l'aggravation de `EDOC 07 l.253`. */
function forcedPaceBeastLines(animaux: ForcedPaceAnimalOutcome[]): string[] {
  const out: string[] = [];
  for (const a of animaux) {
    if (!a.etats.length && !a.blessures) continue;
    out.push(t('tf.beastExhausted', { roll: a.resistance.roll, target: a.resistance.target }));
    if (a.etats.length > 1) out.push(t('tf.beastExhaustedPlus'));
    if (a.blessures) out.push(t('tf.beastHurt', { n: a.blessures }));
  }
  return out;
}

/**
 * Journée d'attelage FORCÉ au pas de course (EDOC 07 l.229) : « Le conducteur doit effectuer un Test de
 * Conduite d'attelage Intermédiaire (+0) tous les kilomètres, avec une pénalité de -10 par kilomètre déjà
 * parcouru au pas de course. En cas d'échec, les animaux repasseront au pas, et chacun doit réussir un
 * Test de Résistance Intermédiaire (+0) ou acquérir un État Exténué. » Un Échec Stupéfiant (-6 DR) du
 * conducteur exige un jet sur le Tableau des Problèmes de véhicule (EDOC 07 l.253). Le conducteur = le
 * meilleur héros en Conduite d'attelage, soutenu (LDB 12). Après un échec, le reste de la journée se fait
 * à la cadence de base du transport (les bêtes soufflent — le galop ne reprend pas le même jour).
 */
function forcedPaceDay(get: Get, set: Set, kmLeft: number): ForcedPaceDayResult {
  const plan = get().travelPlan!;
  const veh = vehicleTravel(plan.mode)!;
  const draft = mountProfileById(veh.draft!.montureId)!;
  const gallopKmh = draft.m * ALLURE_KMH_PER_M.galop; // vitesse au pas de course = M de l'attelage × 3 (l.140)
  const walkKmh = veh.movement;
  const out: ForcedPaceDayResult = { km: 0, hours: 0, lines: [], entries: [], vehicleOut: false, vehicleLame: false };
  const driver = garanti(partyAssisted(get().party, 'conduite-d-attelage'), 'conduite-d-attelage', 'conducteur');
  const driverLine = supportSplit(driver.value, driver.support); // base RÉELLE du conducteur + sa ligne de Soutien
  let galloped = 0;
  while (out.hours < plan.hoursPerDay - 1e-9 && out.km < kmLeft - 1e-9) {
    // SOURCE UNIQUE du kilomètre : `forcedPaceCheck` roule le conducteur (pénalité en MODIFICATEUR de
    // `rollTest`, dont la politique de clamp est la seule) puis, à son échec, chaque bête avec
    // l'aggravation de l.253. Ce chemin et la cascade joueur lisent le MÊME résolveur.
    const res = forcedPaceCheck({
      valeurConduite: driver.value,
      kmDejaCourus: galloped,
      animaux: draftAnimals(veh.draft!.count, draft.e),
      rng: battleRng(),
    });
    const gallopMod = res.modificateur;
    const roll = res.conduite;
    if (roll.success) {
      out.km += 1;
      galloped += 1;
      out.hours += 1 / gallopKmh;
      continue;
    }
    const stupefiant = roll.sl <= -6; // Échec Stupéfiant (EDOC 07 l.253)
    out.entries.push({
      actorId: driver.actor.id, icon: 'travel/cart', label: 'Conduite d’attelage (allure forcée)',
      // La rangée du récap NOMME ce qui compose la valeur : le Soutien des passagers (LDB 12, fondu
      // dans `driver.value`) et les crans déjà avalés au pas de course.
      d: testDetail('Conduite d’attelage', driverLine.base, roll,
        [...driverLine.mods, ...(gallopMod ? [{ label: t('tf.modGallop'), value: gallopMod, famille: 'jet' as const }] : [])]),
      text: stupefiant ? t('tf.forcedStupefiant') : t('tf.forcedBackToWalk'), tone: 'bad',
    });
    // Le jet est DÉJÀ affiché par la rangée `day.entries` (MultiRollList) du même recap — pas de
    // re-print du roll/target (#295 Lot 5) ; le verdict reste pour le journal général (surface SANS rangée).
    out.lines.push(t('tf.forcedFail', { name: driver.actor.label, stupefiant: stupefiant ? t('tf.fragStupefiant') : '' }));
    out.lines.push(...forcedPaceBeastLines(res.animaux));
    if (stupefiant) {
      const pb = applyVehicleProblemToTravel(get, set, out);
      out.vehicleOut = pb.vehicleOut;
      out.vehicleLame = pb.vehicleLame;
    }
    // Reste de la journée à la cadence de base du transport (au pas si Endommagé — même vitesse LDB).
    if (!out.vehicleOut) {
      const remaining = Math.min(plan.hoursPerDay - out.hours, Math.max(0, kmLeft - out.km) / walkKmh);
      out.km += remaining * walkKmh;
      out.hours += remaining;
    }
    break; // plus de galop aujourd'hui
  }
  out.km = Math.min(out.km, kmLeft);
  return out;
}

/**
 * Tire et APPLIQUE un Problème de véhicule au trajet (déclenché AU PAS DE COURSE, EDOC 07 l.253) :
 * `applyVehicleProblem` (Dégâts à la coque) + Dégâts aux OCCUPANTS en `GameOp` (`occupantOps`). Le
 * véhicule allant plus vite que la marche : « Incontrôlable » non maîtrisé → Accident (l.284) et
 * « Cassé » se traite comme un Accident (l.276) — le remap se fait AVANT d'appliquer les Dégâts.
 */
function applyVehicleProblemToTravel(get: Get, set: Set, out: Pick<ForcedPaceDayResult, 'lines' | 'entries'>): { vehicleOut: boolean; vehicleLame: boolean } {
  const vehicle = get().travelPlan?.vehicle;
  if (!vehicle) return { vehicleOut: false, vehicleLame: false }; // garde : coque toujours créée en allure forcée
  const roll = d100(battleRng());
  let entry = rollVehicleProblem(roll);
  if (entry.id === 'incontrolable') {
    // « S'il ne prend pas des mesures pour l'arrêter, le véhicule peut entrer en collision ! … S'il se
    // déplaçait plus vite que la vitesse de marche, il subit un Accident à la place » (l.284) — la
    // maîtrise = Test de Conduite d'attelage Intermédiaire (+0) du conducteur.
    const driver = garanti(partyAssisted(get().party, 'conduite-d-attelage'), 'conduite-d-attelage', 'conducteur');
    const rt = rollTest(driver.value, 'intermediaire', battleRng());
    // Repli IA/synchrone (`forcedPaceDay`) : aucune rangée nulle part pour ce jet — le journal est
    // la SEULE surface, et sa ligne se DÉRIVE (`traceLineOf`), porteur fondu dans le libellé (la phrase
    // NOMME déjà le conducteur).
    out.lines.push(t('tf.vehicleProblem', { label: entry.label }), traceLineOf({
      label: t('tf.retakeControl', { name: driver.actor.label }),
      roll: rt.roll, target: rt.target, success: rt.success,
      issue: rt.success ? t('tf.controlHeld') : t('tf.controlLost'),
    }));
    if (rt.success) return { vehicleOut: false, vehicleLame: false };
    entry = rollVehicleProblem(96); // 96-00 = Accident (table verbatim)
  } else if (entry.id === 'casse') {
    // « Si le véhicule se déplaçait plus vite que la marche, traitez ce résultat comme un Accident » (l.276).
    out.lines.push(t('tf.vehicleProblemAccident', { label: entry.label }));
    entry = rollVehicleProblem(96);
  }
  return applyVehicleProblemEffects(get, set, entry, out.lines);
}

/** Dégâts d'un Problème de véhicule DÉJÀ tranché (Cassé/Accident remappés le cas échéant) — coque
 *  (`applyVehicleProblem`) + occupants (`occupantOps`). Partagé par le chemin synchrone
 *  (`applyVehicleProblemToTravel`, conducteur IA) et la chaîne cascade `landForcedPace`/
 *  `landForcedPaceControl` (conducteur JOUEUR, #270) — SOURCE UNIQUE des Dégâts. */
function applyVehicleProblemEffects(get: Get, set: Set, entry: ReturnType<typeof rollVehicleProblem>, lines: string[]): { vehicleOut: boolean; vehicleLame: boolean } {
  const vehicle = get().travelPlan?.vehicle;
  if (!vehicle) return { vehicleOut: false, vehicleLame: false };
  const r = applyVehicleProblem(vehicle, entry.min, battleRng());
  lines.push(...r.lines);
  // Dégâts aux occupants (Cassé : 1 Blessure ignorant BE et PA ; Accident : 2d10 − BE − PA, min 1) —
  // langue unique GameOp, portée par la table (`occupantOps`).
  if (r.entry.occupantOps?.length) {
    const opLines: string[] = [];
    for (const h of get().party) {
      if (h.dead || h.outOfRencontre) continue;
      opLines.push(...applyOps(h, r.entry.occupantOps, { rng: battleRng() }));
    }
    set({ party: [...get().party] });
    lines.push(...opLines);
  }
  if (r.entry.id === 'endommage') return { vehicleOut: false, vehicleLame: true };
  return { vehicleOut: r.entry.id === 'accident' || vehicle.wounds.current <= 0, vehicleLame: false };
}

/** Le CONDUCTEUR d'un attelage forcé et son Soutien (`LDB 12 l.189` : « le Personnage qui possède la
 *  plus forte chance de réussite lance les dés. Chaque Personnage qui apporte son soutien octroie un
 *  bonus de +10 au Test ») — les passagers d'un même véhicule sont adjacents (l.196) et la Conduite
 *  d'attelage n'est pas un Test de résistance (l.197). SOURCE UNIQUE : le km courant, le km SUIVANT et
 *  la reprise de contrôle désignent le conducteur par CETTE fonction, jamais par une valeur figée. */
function forcedPaceDriver(get: Get) {
  return partyAssisted(get().party, 'conduite-d-attelage');
}

/** Construit l'ÉTAPE-JET de Conduite d'attelage au kilomètre COURANT (#270, conducteur JOUEUR) — pénalité
 *  −10/km déjà galopé (`EDOC 07 l.229`), DÉJÀ fondue dans la valeur jetée et déclarée en `dansLaValeur` :
 *  elle compte UNE fois (chip nommée + cible), jamais deux. `meta` porte l'accumulateur (km/heures déjà
 *  acquis) relu par l'applier pour chaîner le km SUIVANT (`insert`) ou finaliser (`finalizeForcedPace`). */
function buildForcedPaceStep(driver: { actor: Combatant; value: number; support?: SupportDetail }, kmLeft: number, galloped = 0, km = 0, hours = 0): BuiltCascadeStep | undefined {
  const penalty = forcedPaceModifier(galloped); // l.229, SOURCE UNIQUE avec le résolveur pur
  return monoStep({
    id: `land-forced-${galloped}`, kind: 'landForcedPace', actor: driver.actor, icon: 'travel/cart',
    label: stepDetail(dataLabel(driver.actor.label), t('step.conduiteForcee')), rollLabel: 'Conduite d’attelage',
    difficulty: 'intermediaire',
    stake: voyageStakeRef('landForcedPace'),
    ligne: {
      test: { skill: 'conduite-d-attelage' }, valeur: driver.value + penalty, soutien: driver.support,
      ...(penalty ? { dansLaValeur: [{ label: t('tf.modGalloped', { n: galloped }), value: penalty, famille: 'jet' as const }] } : {}),
    },
    meta: { kmLeft, galloped, km, hours },
  });
}

/** Pose l'aggrégat FINAL de l'attelage forcé sur `travelPlan.land` (relu par `continueTravelDayAfterCascade`
 *  pour poser `kmDone`/`gameTime`, DIFFÉRÉS depuis le build — cf. `LandDayContext.forcedPaceResult`). */
function finalizeForcedPace(get: Get, set: Set, result: { km: number; hours: number; vehicleOut: boolean; vehicleLame: boolean }): void {
  const land = get().travelPlan?.land;
  if (!land) return;
  set({ travelPlan: { ...get().travelPlan!, land: { ...land, forcedPaceResult: result } } });
}

/** ÉTAPE-JET de Conduite d'attelage au km (#270) : succès → chaîne le km SUIVANT (`insert`, tant que le
 *  budget du jour reste) ; échec → les bêtes repassent au pas (résistance des bêtes de l'attelage, sans
 *  jet joueur — non-héros) puis, sur un Échec Stupéfiant (−6 DR, l.253), un Problème de véhicule (d100,
 *  donnée d'auteur) — « Incontrôlable » INSÈRE la reprise de contrôle INFLUENÇABLE (`landForcedPaceControl`) ;
 *  les autres résultats s'appliquent inline (`applyVehicleProblemEffects`, pas de jet joueur supplémentaire). */
registerCascadeApplier('landForcedPace', (get, set, step, hero) => {
  if (!step.result) return;
  const m = step.meta!;
  const kmLeft = Number(m.kmLeft), galloped = Number(m.galloped);
  // Conducteur RE-RÉSOLU (acteur + Soutien du moment) : le km suivant et la reprise de contrôle
  // testent la MÊME chose que le km courant, ils ne rejouent pas une valeur figée (LDB 12 l.189).
  const driver = garanti(forcedPaceDriver(get), 'conduite-d-attelage', 'conducteur');
  let km = Number(m.km), hours = Number(m.hours);
  const name = garanti(hero, step.actorId, 'conducteur').label;
  const plan = get().travelPlan!;
  const veh = vehicleTravel(plan.mode)!;
  const draft = mountProfileById(veh.draft!.montureId)!;
  const gallopKmh = draft.m * ALLURE_KMH_PER_M.galop;
  const walkKmh = veh.movement;
  if (step.result.success) {
    km += 1; hours += 1 / gallopKmh;
    // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5).
    const j = [t('tf.forcedOk', { name })];
    if (hours < plan.hoursPerDay - 1e-9 && km < kmLeft - 1e-9 && step.actorId && hero && driver) {
      const suivant = buildForcedPaceStep(driver, kmLeft, galloped + 1, km, hours);
      if (suivant) return { consequences: freeCons(j), insert: [suivant] };
    }
    finalizeForcedPace(get, set, { km: Math.min(km, kmLeft), hours, vehicleOut: false, vehicleLame: false });
    return { consequences: freeCons(j) };
  }
  const stupefiant = step.result.sl <= -6; // Échec Stupéfiant (EDOC 07 l.253)
  // Le jet du conducteur est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print
  // (#295 Lot 5) ; les bêtes de l'attelage n'ont AUCUNE rangée dédiée — le journal les porte seul.
  const j: string[] = [t('tf.forcedFail', { name, stupefiant: stupefiant ? t('tf.fragStupefiant') : '' })];
  // MÊME résolveur pur que le repli synchrone (`forcedPaceBeastCheck`) : le Test de Résistance de
  // l.229 et son aggravation de l.253 n'ont qu'une définition. Le conducteur, lui, a déjà roulé —
  // c'est l'étape INFLUENÇABLE de la cascade (`step.result`), pas un `rollTest` d'ici.
  j.push(...forcedPaceBeastLines(draftAnimals(veh.draft!.count, draft.e).map((a) => forcedPaceBeastCheck(a, battleRng()))));
  // Reste de la JOURNÉE (pas de l'ensemble du trajet) à la cadence de base — plafonné par le budget
  // d'heures RESTANT du jour (`plan.hoursPerDay - hours`), EXACTEMENT `forcedPaceDay` (l.795).
  const remaining = Math.max(0, kmLeft - km);
  const restHours = walkKmh > 0 ? Math.min(plan.hoursPerDay - hours, remaining / walkKmh) : 0;
  const finalKm = Math.min(kmLeft, km + restHours * walkKmh), finalHours = hours + restHours;
  if (!stupefiant) {
    finalizeForcedPace(get, set, { km: finalKm, hours: finalHours, vehicleOut: false, vehicleLame: false });
    return { consequences: freeCons(j) };
  }
  const roll = d100(battleRng());
  let entry = rollVehicleProblem(roll);
  if (entry.id === 'incontrolable') {
    j.push(t('tf.vehicleProblem', { label: entry.label }));
    if (step.actorId && hero && driver) {
      const st = monoStep({
        id: `${step.id}-control`, kind: 'landForcedPaceControl', actor: driver.actor, icon: 'travel/cart',
        label: stepDetail(dataLabel(driver.actor.label), t('step.reprendreControle')), rollLabel: 'Conduite d’attelage',
        difficulty: 'intermediaire',
        stake: voyageStakeRef('landForcedPaceControl'),
        // MÊME jet que le km (Conduite d'attelage soutenue, `LDB 12 l.189`) : ni la pénalité de km
        // (`EDOC 07 l.253` ne la reconduit pas), ni une valeur figée. Les deux surfaces — étape
        // influençable et repli sans pilote ci-dessous — lisent le MÊME conducteur soutenu.
        ligne: { test: { skill: 'conduite-d-attelage' }, valeur: driver.value, soutien: driver.support },
        meta: { finalKm, finalHours },
      });
      if (st) return { consequences: freeCons(j), insert: [st] };
    }
    // Repli SANS acteur joueur (pas d'étape insérée ci-dessus) : aucune rangée nulle part pour ce jet
    // — le journal est la SEULE surface, et sa ligne se DÉRIVE (`traceLineOf`). MÊME valeur que la
    // surface influençable : le conducteur soutenu (`forcedPaceDriver`), jamais une grandeur seconde.
    const rt = rollSansPilote(get, driver.actor, driver.value, 'intermediaire', battleRng());
    j.push(traceLineOf({
      label: t('tf.retakeControl', { name }),
      roll: rt.roll, target: rt.target, success: rt.success,
      issue: rt.success ? t('tf.controlHeld') : t('tf.controlLost'),
    }));
    if (rt.success) { finalizeForcedPace(get, set, { km: finalKm, hours: finalHours, vehicleOut: false, vehicleLame: false }); return { consequences: freeCons(j) }; }
    entry = rollVehicleProblem(96);
  } else if (entry.id === 'casse') {
    j.push(t('tf.vehicleProblemAccident', { label: entry.label }));
    entry = rollVehicleProblem(96);
  }
  const outcome = applyVehicleProblemEffects(get, set, entry, j);
  finalizeForcedPace(get, set, { km: finalKm, hours: finalHours, ...outcome });
  return { consequences: freeCons(j) };
});

/** Reprise de contrôle INFLUENÇABLE d'un attelage « Incontrôlable » (#270, EDOC 07 l.284) : succès →
 *  l'attelage est maîtrisé (pas d'Accident) ; échec → Accident (96-00 de la table, verbatim). */
registerCascadeApplier('landForcedPaceControl', (get, set, step, hero) => {
  if (!step.result) return;
  const m = step.meta!;
  const finalKm = Number(m.finalKm), finalHours = Number(m.finalHours);
  const name = garanti(hero, step.actorId, 'conducteur').label;
  // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5).
  const j = [t('tf.retakeControlDone', { name, issue: t(step.result.success ? 'tf.controlHeldDot' : 'tf.controlLostBang') })];
  if (step.result.success) { finalizeForcedPace(get, set, { km: finalKm, hours: finalHours, vehicleOut: false, vehicleLame: false }); return { consequences: freeCons(j) }; }
  const entry = rollVehicleProblem(96); // 96-00 = Accident (table verbatim)
  const outcome = applyVehicleProblemEffects(get, set, entry, j);
  finalizeForcedPace(get, set, { km: finalKm, hours: finalHours, ...outcome });
  return { consequences: freeCons(j) };
});

/** Clés `<idHéros>|<idMaladie>` des maladies portées par le groupe — empreinte de départ d'un trajet. */
const diseaseKeys = (party: Combatant[]): string[] =>
  party.flatMap((h) => (h.diseases ?? []).map((d) => `${h.id}|${d.id}`));

/**
 * PHASE D'ARRIVÉE, volet maladies — EDOC 09 l.21. Toute maladie encore en INCUBATION qui n'était pas
 * portée au départ (`plan.diseasesAtStart`) a été contractée sur la route : elle se déclare ici, par la
 * bascule unique `declareDisease`. Kind-agnostique — aucune maladie n'est nommée.
 */
function declareArrivalDiseases(get: Get, set: Set, atStart: string[]): string[] {
  const avant = new Set(atStart);
  const lines: string[] = [];
  const party = get().party;
  for (const h of party) {
    for (const dz of h.diseases ?? []) {
      if (dz.phase !== 'incubation' || avant.has(`${h.id}|${dz.id}`)) continue;
      lines.push(...declareDisease(h, dz, battleRng()));
    }
  }
  if (lines.length) set({ party: [...party] });
  return lines;
}

/**
 * Soins de l'ARRIVÉE au relais : le maréchal-ferrant remplace le fer (EDOC 07 l.167), la sellerie est
 * réparée (l.174), la bête boiteuse est laissée aux bons soins de l'étape. EDOC 07 l.167/174 — silence
 * sur coût/durée, valeur maison : on les résout gratuitement à l'arrivée (Patte brisée, elle, a coûté
 * la bête en route).
 */
function travelArrivalCare(get: Get, set: Set): string[] {
  const lines: string[] = [];
  const heroById = new Map(get().party.map((h) => [h.id, h]));
  let touched = false;
  const possessions = get().possessions.map((p) => {
    const eff = p.nature === 'bete' ? mountIncidentEffects(p.mountInjury) : undefined;
    if (!eff || eff.notHealedByCare) return p; // séquelle hors de portée des soins d'étape (Patte brisée)
    const h = heroById.get(p.ownerId);
    lines.push(t('tf.mountCared', { mount: possessionLabel(p), owner: h ? t('tf.fragMountOwner', { name: h.label }) : '', soin: t(eff.preventsMount ? 'tf.mountHealed' : 'tf.mountRepaired') }));
    touched = true;
    return { ...p, mountInjury: undefined };
  });
  if (touched) set({ possessions });
  return lines;
}

/** « Voyage éreintant » raté : +1 jour de retard (le groupe erre) et +1 Exténué chacun.
 *  Renvoie les lignes journalisées (reprises par le récapitulatif de voyage). */
function applyEreintant(get: Get, set: Set): string[] {
  const party = get().party;
  const lines: string[] = [];
  for (const h of party) {
    if (h.dead) continue;
    addCondition(h, 'extenue', 1);
    lines.push(t('tf.detourExhausted', { name: h.label }));
  }
  set({ party: [...party], gameTime: get().gameTime + 24 * 60 }); // un jour de plus sur la route
  bus.emit(EVT.TIME_ADVANCED, { minutes: 24 * 60 });
  // Le jour de retard NE roule PAS l'entretien en eager (sinon Faim avant le repas de la halte) :
  // ce franchissement supplémentaire est décompté dans la cascade de nuit (`buildNightCascade`), qui
  // couvre tous les jours écoulés depuis `lastUpkeepDay` — donc ce détour aussi (non nourri : pas de repas ce jour-là).
  lines.push(t('tf.detourDay'));
  log(get, set, lines);
  return lines;
}
