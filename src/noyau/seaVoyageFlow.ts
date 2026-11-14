/**
 * VOYAGE MARITIME jour par jour (MDG 13 « Navigation maritime » + ch.15 « Longs voyages ») —
 * EXTENSION de la machinerie de voyage (`travelFlow`) : mêmes briques (TravelPlan, halte de nuit
 * `ouvrirLeRepos`, entretien quotidien `runDailyUpkeep`, recap), la RÉSOLUTION du jour est navale.
 *
 * Une route MARITIME (`MapRoute.sea`) se voyage sur le NAVIRE DE CAMPAGNE (`state.vessel`) ; sa
 * distance `km` est en MILLES (les tables RAW sont en milles — ch.15 l.57-78). La journée en mer :
 *  1. MÉTÉO du jour (ch.13 l.164) + direction du vent (rose, l.250) — témoin, au recap ;
 *  2. vent « Affaler les voiles » (l.288) → Test d'équipage d'AFFALER (modale, #65) — échec :
 *     Critique au Gréement ; tant que ça souffle, ancre ou dérive à 25 % ;
 *  3. Test d'équipage de PROGRESSION (modale, #65) : milles du jour = 18 × M effectif (vent ch.13
 *     l.276, Salissures l.152, Clinfoc ch.12 l.256), ±10 %/DR (ch.15 l.78) ;
 *  4. arrivée en vue du port À PHARE (`MapPlace.port.lighthouse`) → Test d'équipage de PERCEPTION
 *     (modale, #65 — « voir la lumière d'un phare », l.337) : réussite → bonus d'Orientation (l.335) ;
 *  5. Test d'équipage d'ORIENTATION quotidien (modale, #65 — « un Test par jour de voyage », l.311)
 *     → Repères / Changement de cap (retard %, quart de tour, demi-tour) ;
 *  6. CRISE en cours (Poursuite ch.13 l.354 / Tourbillon l.514) : un Test d'équipage par manche
 *     (modales POURSUITE / MANŒUVRE, #65) jusqu'à l'issue ;
 *  7. INFESTATION de la cale (`vessel.infestation`, op `infestation`) : Test d'équipage étendu
 *     d'EXTERMINATION DES NUISIBLES (modale, #65 — 1d10 h par Test, MDG 14 l.98-104) + son Flow de nuit ;
 *  8. ÉVÉNEMENT DE BORD tous les 1d10 jours (ch.15 l.89, d100 + Humeur de Manann) ;
 *  9. nuit : coque endommagée → Test d'équipage d'ENTRETIEN (modale, #65 — remplace le Test de
 *     Métier à −2 DR, MDG 14 l.116-124, réparation TEMPORAIRE ch.13 l.647) ; Salissures
 *     hebdomadaires (l.148) ; eau/scorbut (ch.14 l.224-242) ; halte de repos (machinerie existante).
 *  À l'accostage : ÉVÉNEMENT DE PORT (2d10 ± Humeur, ch.15 l.127).
 *
 * ÉQUIPAGE hors combat : ABSTRAIT, tenu par les PJ (MDG 14 l.39) ; aucun PJ apte à un poste = sous
 * l'effectif minimal → Manque de bras (MDG 14 l.55). En combat, l'équipage est réel
 * (`battle.combatants`) et le Manque de bras s'applique aussi (`shipCrew.ts`).
 */
import type { IconId } from '../data/icons';
import { battleRng } from './battleRng';
import { nomDuNavire } from './carriers';
import { ouvrirLeRepos } from './restFlow';
import { arriverAuLieu } from './lieuFlow';
import { lieuDuGroupe, placeById, type WorldMap, type MapPlace, type MapRoute } from './worldMap';
import type { TravelPlan, TravelRecapDay } from './travelFlow';
import { toRecapLines } from './recapLine';
import { noteEvent, rangerLesEvenements } from './evenementDuJour';
import type { BatchParticipant } from './pendings';
import {
  crewTestContributors,
  equipageImplique,
  shipMoraleScore,
  applyShipMoraleDelta,
  shipSaboteurDR,
  applyVesselCrewLoss,
  resolveShoreLeaveDesertion,
  shipboardSouls,
  shipUndercrew,
} from './shipCrew';
import { buildAuthorPerilSteps, applyPerilEffectsNow } from './authorPerils';

/** Id du protocole de reprise MARITIME (effets appliqués SUR-LE-CHAMP, `reprendreLeVoyage` rejoue). */
/** Id du PROTOCOLE de reprise maritime (`authorPerils`) : la mer applique les effets d'un péril
 *  interrupteur sur-le-champ (`reprendreLeVoyage` rejoue la traversée). Exporté pour être NOMMÉ par les
 *  contrats, jamais recopié en littéral. */
export const SEA_PERIL_INTERRUPT = 'voyage-mer';
import type { Scene, VictoryCondition } from './monde/scene';
import type { Flow } from '../data/schemas/defs-scenes/effets';
import { buildScene } from './mapSpec';
import type { AuthoredEnemy } from './monde/encounterAuthoring';
import { registerScene } from './monde/registreDesScenes';
import { vehicleCombatant } from '../engine/vehicle';
import {
  type StakeRef,
  type VoyageStakeId,
  voyageStakeRef,
  conditionLabel,
  findVehicleById,
  findCrewRoleById,
  findCrewTestTypeById,
  findNavalTrait,
  NAVAL_TRAITS,
  diseaseLabel,
  refLabel,
  libelleOuAbsence,
  testSkillLabel,
  findNavalPortById,
} from '../data';
import { profilNavalDe } from '../engine/coque';
import {
  installAmount,
  installCost,
  prixDeLaReparation,
  rollPortRepair,
  rollSteamBreakdown,
  steamBreakdownTriggered,
  shipSizeOfLength,
  propulsionDuNavire,
  milieuDuVoyage,
  STEAM_SKILL,
  type PropulsionDuNavire,
  type SteamBreakdownEntry,
} from '../engine/shipBuild';
import { COMPETENCE_DU_MODE, estCompetenceDePropulsion, type PropulsionKind } from '../engine/propulsion';
import { deMonde, formatDice, roll as rollDice, tirer, type RNG, type Tirage } from '../engine/dice';
import { findTableEntry } from '../engine/tables';
import { rollTest, evaluateTest, isDoubleRoll, extendedTestStep, estJete, cibleMesuree } from '../engine/tests';
import type { ModLine } from '../engine/combat';
import { RULE_REF } from '../engine/ruleRefs';
import { testValue, partyAssisted, partyBest, refusPersonneNePeutTenter, type SupportDetail } from '../engine/skills';
import { buildWeapon } from '../engine/items';
import { applyOps, resolveFormula, type Formula, type GameOp, type PairedSense } from '../engine/ops';
import { damageHull, healHull } from './monde/shipDamage';
import { itemCapability } from '../engine/capabilities';
import { toDate, MINUTES_PER_DAY, minutesUntilNext, duskMinute, dayIndex } from '../engine/clock';
import { seasonOfMonth } from '../engine/travelStages';
import {
  rollSeaWeather, rollWindDirection, directionOpposee, VENT_DOMINANT, windAspect, tickWindForceDay, windEffect, windAdjustedM,
  seaWeatherLabel, dailyWaterLitres, temperatureDef, seaExposureTestsPerDay, AFFALER_RULES, windForces,
  type SeaWeather, type WindDirection, type WindAspect, type SeaPrecipitationId,
} from '../engine/seaWeather';
import {
  seaMilesPerDay, orientationOutcome, rollCourseChange, deDuChangementDeCap, foulingEffects, weeklyFoulingLevel,
  lighthouseSpotDifficulty, lighthouseOrientationDR, savoirOceansBonus, pursuitDistanceGain,
  pursuitLowMPenalty, voileSansProfil, forcePaceDifficulty, exhaustionDifficulty, REPARATION, overspeedRow, overspeedDamage, VIVRES_DE_CALE,
} from '../engine/seaNavigation';
import { expireOnRespite, exposureTarget, exposureCoatMods, exposureFirstFailChars, isWeatherWarded } from '../engine/exposure';
import { pursuitOutcome } from '../engine/pursuit';
import { addCondition } from '../engine/conditions';
import { effectiveChar, blessuresPosees } from '../engine/characteristics';
import { findSeaHazard, findWhirlpool, strandingOccurs, strandingPenaltyLine, debrisEntangleFor } from '../engine/seaPerils';
import {
  evenementsDeBord, deDesEvenementsDeBord, deDesEvenementsDePort, deDuVoyageRapide, rollPortEvent, rollDaysToNextEvent, manannBase, seaBoardEventById,
  spoilCargoByEnc, spoilCargoByPct, cargoTotalEnc, cargoOverload, overloadMaxEnc, overloadMarks, resolveFastVoyage, FAST_VOYAGE_PALIERS,
  meteosActives, modificateursAuCarenage, modificateursApresUnEvenement, evitementDuPeril, sommeDesModificateurs,
  type CargoOverload, type SeaEventDef, type ManannMood, type PortProfile, type CargoLot,
} from '../engine/seaVoyage';
import { navalMoveMod, navalTraitsDe, navalTestTypeDR, navalNavTestDR, shipHasNavalTrait, hullNavalTraits, vesselNavalTraits } from '../engine/navalTraits';
import { rule } from '../engine/policy';
import { TEMPORARY_REPAIR } from '../engine/riverNavigation';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import { groupsFor } from '../engine/groups';
import { traverseeCommandee, voyageDayEntry, DEFAULT_VOYAGE_ORDERS, type VoyageOrders, type VoyageCadence } from './voyageCadence';
import {
  ajouterAuRoster,
  crewRoleValue,
  crewTestModParts,
  facteurDuVivreSeul,
  facteursDeVivreSeul,
  moraleBand,
  weeklyCrewWageBrass,
  crewTalentDR,
  UNDERCREW_DR,
  capToSuccesMinime,
  crewTestSuccess,
  rudeEpreuveMoraleDelta,
  SUCCES_MINIME_CAP,
} from '../engine/crewMorale';
import type { NightEntry } from './restFlow';
import { provisioningManifest, rationsDeCale } from '../engine/provisions';
import { toMoney, canAfford, formatMoney, fromBrass, type Money } from '../engine/money';
import { partyMoneyTotal, payFromGroup, refusDeGesteSurLeGroupe, mouvementDeLaBourseDuGroupe } from './bourseFlow';
import { rollShipCritical, applyCrewHit, exposedCrew, type ShipCriticalResolved } from '../engine/shipCritical';
import { bandeTriggeredTest } from './combat/triggeredTest';
import { drainPendingLog, jouerFlowEntier, revealPurpose, runFlow } from './combatEffects';
import { EMPTY_FLOW } from '../engine/flowCore';
import type { ShipCritKey } from '../data/shipCriticals';
import { contractDisease, applyContraction, contractionDue, diseaseDefs, maladieDeclaree } from '../engine/disease';
import {
  DIFFICULTE_PAR_DEFAUT,
  DIFFICULTY_LABELS,
  DIFFICULTY_MODIFIERS,
  type Combatant,
  type Difficulty,
  type NavalTraitRef,
  type ContexteDeTest,
} from '../engine/types';
import type { PendingSteamSave, PendingCascade, CascadeStep } from './pendings';
import type { Get, Set } from './flowTypes';
import type { CorpsDesChoix } from './choixDesFenetres';
import type { CampaignVessel, Jeu } from './etat';
import { refuserGeste } from './refusVisible';
import {
  openWorldTest,
  composeRollLabel,
  openSequence,
  freeCons,
  rollStep,
  monoStep,
  tableStep,
  bandStep,
  buildBand,
  choiceStep,
  openChoice,
  pousseSi,
  type RollRequest,
  type Consequence,
  type FreeConsLine,
} from './rollSeam';
import { rollLine } from './ligneDeJet';
import { type BuiltCascadeStep } from './stepBrand';
import { startCascade, jouerLaJournee, pushStep, type CascadeApplier, type TableStepDef } from './cascade';
import { checkPartyWiped } from './partyWipe';
import { memoParVersion } from '../data/versionDataset';
import { exposureWaveBand } from './nightBands';
import { creatureLabel, dataLabel, findCreatureById } from '../data';
// Tuile de PONT d'une scène de bord : défaut de compilation (`defauts-de-compilation.json`), éditable
// au Codex — la scène d'abordage est compilée, elle n'authore pas son sol.
import { defautsDeCompilation } from '../data';
import { t, t as tr } from '../i18n'; // `tr` : alias pour les portées où `t` est un identifiant local (résultat de jet)

import { stepPrecision, idDansLaSequence, dieStep } from './rollSeam';
import { actorIn, coqueParId, equipageApte, inBattleId } from './monde/combatants';
import { touchActors } from './combatOrParty';
import { garanti } from '../lib/garanti';
import { referentDuNavire } from './navireOps';
import type { PlayerText } from '../i18n/playerText';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';
import type { FragmentDeTables, GenreDEtape, PartDeTable } from './tablesPosees';

/** Id du prédicat de succès des Tests d'équipage résolus PAR CASCADE (MDG 14 l.13) — le flux naval
 *  injecte `crewTestSuccess` (socle unique, règle optionnelle `equipage-zero-dr-succes` comprise) dans
 *  la machinerie générique, qui reste ignorante du domaine (quarantaine d'import #328 intacte). */
export const CREW_TEST_SUCCESS_RULE = 'crew-test';

/** Navire hostile de l'événement en cours (MDG 15 « Cogue pirate » / « Langskip skaeling ») — porté
 *  sur l'état NAVAL le temps de la confrontation, il DÉRIVE l'abordage GÉNÉRIQUE (`startChaseBoarding`)
 *  quel que soit le chemin (combat direct, poursuite rattrapée, tribut refusé) et quelle que soit la
 *  route : `shipRef`/`crewRef`/`chefRef` = ids de `vehicles.json`/`creatures.json` de l'événement. */
export interface SeaBoarding {
  shipRef: string;
  crewRef: string;
  chefRef?: string;
  /** Effectif TOTAL du navire hostile, chef compris (MDG 15 l.150, l.171). */
  nombre: number;
  label: string;
}

/** Crise NAVALE en cours (un Test d'équipage par manche jusqu'à l'issue). */
export type SeaCrisis =
  | { kind: 'poursuite'; label: string; distance: number; escapeAt: number; foeM: number; foeSkill: number }
  | { kind: 'tourbillon'; label: string; whirlpoolId: string; need: number; progress: number };

/** État NAVAL d'un TravelPlan (route `sea`) — persiste dans la save avec le plan. Un jour de voyage
 *  (`runSeaDay`) est UNE cascade `purpose:'travelDay'` (#275 Ronde 2 cran 3), sans FSM
 *  `step` persistée : le point de reprise EST `pendingCascade`/`suspendedCascades` (noyau/cascade.ts). */
export interface SeaVoyageState {
  /** Cap dominant du trajet (fixe le vent relatif, MDG 13 l.262-270) — d'auteur (`MapRoute.seaHeading`), requis (#416). */
  heading: WindDirection;
  weather: SeaWeather;
  windFrom: WindDirection;
  /** Jours en mer avant le prochain événement de bord (1d10, ch.15 l.89 — suspendu au port, l.19). */
  daysToEvent: number;
  /** Jours passés en mer (scorbut : Test par mois sans nourriture correcte, MDG 14 l.230). */
  daysAtSea: number;
  /** TONNEAU D'EAU CONTAMINÉ (MDG 14 l.209) : un porteur de peste noire/flux sanglant/courante galopante/
   *  vérole urticante a raté son Test de Résistance en buvant au tonneau — devient une SOURCE DE
   *  CONTAGION pour quiconque y boit ENSUITE (jamais le jour même). Ne concerne QUE `vessel.waterLitres` —
   *  la petite bière (`tonneau-de-petite-biere`) y échappe (MDG 14 l.209), jamais lue ici. */
  waterContaminated?: { diseaseId: string };
  /** Lignes du jour (recap de la halte de nuit). */
  lines: string[];
  /** PROCÈS-VERBAL structuré du jour (couche `voyageCadence`) : une ligne de JET par Test d'équipage de
   *  ROUTINE auto-résolu en route COMMANDÉE — « aucun jet silencieux » (rendu par `MultiRollList`). */
  entries?: NightEntry[];
  /** Milles parcourus AUJOURD'HUI le long du trajet : Progression, ou dérive SIGNÉE (MDG 13 l.294). */
  milesToday: number;
  /** Blessures de coque AU LEVER du jour — sert au DELTA du jour clos (`SeaRecapChrome.hullDelta`) :
   *  la chronique d'un jour PASSÉ raconte ce que la journée a coûté à la coque, l'état COURANT restant
   *  lu sur la source vivante `vessel.wounds` (#296). */
  hullAtDayStart: number;
  /** M EFFECTIF du jour ayant servi à la Progression (`effectiveSeaM`) — SOURCE du Test de survitesse (#443,
   *  `buildOverspeedStep`) : un recalcul APRÈS coup lirait les modificateurs du navire levés depuis. */
  effMToday?: number;
  /** Mode de propulsion (`propulsionDuNavire`) ayant mû le navire AUJOURD'HUI et servi à `effMToday` —
   *  SOURCE du référent M de conception du Test de survitesse (#524, `buildOverspeedStep`) et de la
   *  Période de travail (MDG 13 l.62, l.111). Absent = navire non mû à la voile ni aux avirons. */
  modeToday?: PropulsionKind;
  /** Dérive mineure déjà vue (Repères : « sans effet la première fois », ch.13 l.318). */
  minorDrift?: boolean;
  /** Phare aperçu aujourd'hui → bonus d'Orientation (ch.13 l.335/351). */
  lighthouseDR?: number;
  /** Voiles affalées aujourd'hui (vents trop forts) : ancre jetée ou dérive à 25 % (ch.13 l.294). */
  sailsDown?: boolean;
  /** ÉCHOUÉ sur un péril (Rocher/Bas-fonds, MDG 13 l.471-473/497/499, #444) : le navire s'arrête net,
   *  aucune Progression tant qu'un Test de Force (pénalité = `strandingPenalty`) ne l'a pas dégagé. */
  stranded?: { hazardId: string; label: string };
  /** EMPÊTRÉ dans des Débris marins (MDG 13 l.485-491, #444) : pénalité de Man/M tant que le Test
   *  étendu de Force (`hazard.freeTest`) n'a pas dégagé le navire — n'arrête PAS la Progression. */
  entangled?: { hazardId: string; label: string; need: number; progress: number; manDR: number; mMod: number; difficulty: Difficulty };
  crisis?: SeaCrisis;
  /** Navire hostile en présence (op `navireHostile`) — source de l'abordage dérivé. */
  boarding?: SeaBoarding;
  /** Embuscade authorée déjà ouverte sur CETTE traversée (#212) — anti-double-feu entre l'ancrage
   *  déterministe (`MapRoute.ambush.at`) et l'abordage de fin de Poursuite (`startChaseBoarding`). */
  ambushFired?: boolean;
  /** FORCER LE RYTHME (MDG 13 l.95-107) : bonus de M demandé au départ (+1 voile/avirons, +2 avirons). */
  forcePace?: number;
  /** Issue du Test de Voile/Ramer du JOUR (l.97) : 'reussite' → le +M s'applique aux milles du jour. Présent
   *  (reussite OU echec) = le rythme a été forcé (l.111). */
  paceToday?: 'reussite' | 'echec';
  /** Acteurs et soutiens des jets de Voile ou de Ramer du JOUR (`mer-forcer-le-rythme`, `merProgressionNavigation`),
   *  en ids — MDG 13 l.111, `equipageImplique`. */
  manieursToday?: string[];
  /** LONGS VOYAGES TRÈS RAPIDES (MDG 15 l.21-37) : présent = traversée RAPIDE (résolue en UN Test de
   *  Rude épreuve, JAMAIS la boucle jour par jour). `palierId`/`roll`/`result`/`crewDR`/`manannTens` : cran du
   *  d10 calculé (persisté pour narrer au moment RÉEL de l'application, jamais avant) ; `pendingFinalize` =
   *  le palier reste à appliquer (après un abordage ancré éventuel — `finalizeFastVoyage` est ré-entrant). */
  fast?: {
    days: number; weeks: number; palierId?: string; roll?: number; result?: number; crewDR?: number;
    manannTens?: number; pendingFinalize?: boolean;
  };
  /** RECETTE (#332) : événement de bord NOMMÉ forcé au PROCHAIN jour (`__wfrp.forceEncounter`) — court-
   *  circuite le timer 1d10 et le tirage d100/Manann de `resolveSeaDayEvent`, sans autre effet de setup. */
  forcedEventId?: string;
}

/** Instantané d'un jour de mer pour l'ÉCRAN DE TRAVERSÉE (`SeaVoyageScreen`) : rose des vents + jauges
 *  compactes + distance restante. Self-contained (le plan est parfois déjà annulé au moment du rendu). */
export interface SeaRecapChrome {
  weatherLabel: string;
  windForce: SeaWeather['vent'];
  windFrom: WindDirection;
  heading: WindDirection;
  /** DELTA de Blessures de coque du jour clos (négatif = coque endommagée, positif = réparée). L'état
   *  COURANT n'est PAS recopié ici : il se lit sur `vessel.wounds` (source unique, #296) — un absolu
   *  gelé sous le libellé « Coque » divergerait de la jauge vive dès la première réparation. */
  hullDelta: number;
  morale: number;
  manann: number;
  waterLitres?: number;
  /** Milles restants à parcourir et estimation de jours de mer restants (à la vitesse de croisière). */
  milesLeft: number;
  daysLeft: number;
}

/** Semaine impériale (8 jours, MDG 15 l.268) — cadence de la pénalité « −1 par semaine en mer » du
 *  voyage rapide (l.28) et des Activités en mer (`daysAtSea % 8`, `continueSeaDayAfterCascade`). */
const SEA_WEEK_DAYS = 8;

/** Précipitations du jour de mer ACTIF (MDG 13 l.185) — la déclaration `pont` d'une ligne de jet
 *  (`ligneDeJet.rollLine`) hors combat, et la source de `Combatant.envPrecipitation` à l'ouverture d'un combat. `undefined` hors
 *  voyage maritime. */
export function activeSeaPrecipitation(get: Get): SeaPrecipitationId | undefined {
  return get().travelPlan?.sea?.weather.precipitations;
}

const log = (get: Get, _set: Set, lines: string[]) => {
  if (lines.length) get().ecrireAuJournal(lines);
};

/** Écrit au journal ET au recap du jour (mêmes lignes — patron travelFlow). */
function tell(get: Get, set: Set, lines: string[]): void {
  if (!lines.length) return;
  log(get, set, lines);
  const plan = get().travelPlan;
  if (plan?.sea) set({ travelPlan: { ...plan, sea: { ...plan.sea, lines: [...plan.sea.lines, ...lines] } } });
}

/** Écrit SEULEMENT au recap du jour (`sea.lines`) — le JOURNAL des appliers de cascade migrés (#295
 *  Lot 1) est désormais écrit par `commitStep` depuis les `consequences` retournées (`freeCons`), pas
 *  par un second canal direct. `tell()` reste le canal des sites HORS applier (narration d'événement de
 *  jour, entretien-survie). */
export function noteSeaLine(get: Get, set: Set, lines: string[]): void {
  if (!lines.length) return;
  const plan = get().travelPlan;
  if (plan?.sea) set({ travelPlan: { ...plan, sea: { ...plan.sea, lines: [...plan.sea.lines, ...lines] } } });
}

export function patchSea(get: Get, set: Set, patch: Partial<SeaVoyageState>): void {
  const plan = get().travelPlan!;
  set({ travelPlan: { ...plan, sea: { ...plan.sea!, ...patch } } });
}

/** Notifie les abonnés d'une mutation IN-PLACE d'un membre de `party` (héros/`diseases`) — les
 *  appliers de maladie de mer (Scorbut, Mal de mer, Tonneau d'eau) mutent `hero` par référence
 *  puis appellent CECI pour faire recopier l'array (`set-scan-guard.test.ts` : SOURCE UNIQUE au
 *  lieu d'un `set({ party: [...get().party] })` littéral dupliqué à chaque applier). */
export function touchParty(get: Get, set: Set): void {
  set({ party: [...get().party] });
}

/** Humeur de Manann du navire de campagne (défaut : registre neuf). */
export function vesselManann(vessel: CampaignVessel | null): ManannMood {
  return vessel?.manann ?? manannBase();
}

/** Facteur de Moral de disette (MDG 14 l.171). */
const FOOD_SHORTAGE_FACTOR = 'nourriture-insuffisante';

/**
 * VIVRES de l'équipage PNJ sur `days` jour(s) : l'effectif nominal (`shipboardSouls().crew`) mange une ration par
 * marin et par jour sur `vessel.provisions`, vivre après vivre dans l'ordre de `VIVRES_DE_CALE.vivres`. Le dernier
 * jour fait la nourriture du prochain recalcul hebdomadaire : à court, `nourriture-insuffisante` ; couvert par un
 * seul vivre, le facteur qui le déclare (`vivreSeul`, crew-morale.json) ; les deux s'excluent. `provisions` absent : vivres non
 * suivis, aucune consommation. MDG 14 l.143, l.166, l.171, l.238, l.263 ; #245 ; #1652
 */
function consumeCrewProvisions(get: Get, set: Set, days: number): string[] {
  const vessel = get().vessel;
  if (!vessel) return [];
  const crew = shipboardSouls(get()).crew;
  const need = crew * Math.max(0, days);
  if (vessel.provisions == null || need <= 0) return [];
  const provisions = { ...vessel.provisions };
  let reste = need;
  let dernier: { vivre: string; mange: number } | undefined;
  for (const id of VIVRES_DE_CALE.vivres) {
    const stock = provisions[id];
    if (stock === undefined) continue;
    const mange = Math.min(reste, stock);
    provisions[id] = stock - mange;
    reste -= mange;
    if (mange > 0) dernier = { vivre: id, mange };
  }
  const left = rationsDeCale(provisions);
  const short = reste > 0;
  const seul = dernier && dernier.mange >= crew ? facteurDuVivreSeul(dernier.vivre)?.id : undefined;
  const actif = short ? FOOD_SHORTAGE_FACTOR : seul ?? null;
  const deVivreSeul = facteursDeVivreSeul();
  const factors = [
    ...vessel.morale.factors.filter((f) => f !== FOOD_SHORTAGE_FACTOR && !deVivreSeul.includes(f)),
    ...(actif ? [actif] : []),
  ];
  set({ vessel: { ...vessel, provisions, morale: { ...vessel.morale, factors } } });
  return [short
    ? t('sv.crewFoodOut')
    : t('sv.crewFoodLeft', { need, left, s: left > 1 ? 's' : '' })];
}

/** RECHARGE les Blessures du Combattant-coque de trajet depuis `vessel.wounds` — SOURCE UNIQUE (#296).
 *  Réutilisée au build du plan (`voyageShip`/`riverHull`, coque de trajet REPART de l'état sauvegardé)
 *  et à la reprise d'un voyage interrompu (`reprendreLeVoyage`, ex. combat naval : le writeback de
 *  `finalizeBattle` sur `vessel.wounds` doit se propager à la coque de trajet, sinon le prochain
 *  `persistHullWounds` l'écraserait avec sa valeur PRÉ-combat périmée — c'est le bug caché du #296). */
export function syncHullWoundsFromVessel(hull: Combatant, vessel: Pick<CampaignVessel, 'wounds'>): void {
  if (vessel.wounds) hull.wounds = { ...hull.wounds, current: Math.min(vessel.wounds.current, hull.wounds.max) };
}

/** Le navire de campagne, ses données de type et sa COQUE de trajet (Blessures PERSISTÉES, #30). */
export function voyageShip(get: Get<Jeu>): { vessel: CampaignVessel; hull: Combatant } | null {
  const vessel = get().vessel;
  if (!vessel) return null;
  const v = findVehicleById(vessel.vehicleId);
  if (!v?.ship) return null;
  const hull = vehicleCombatant(v);
  if (!hull) return null;
  hull.label = nomDuNavire(vessel); // #230 — le rendu reste keyé par creatureId
  syncHullWoundsFromVessel(hull, vessel);
  hull.upgrades = vessel.upgrades ? [...vessel.upgrades] : undefined;
  hull.saboteurDR = vessel.saboteurDR;
  hull.cargoEnc = cargoTotalEnc(vessel.cargo ?? []); // #243 — surcharge (cargoOverload) sur la manœuvre de trajet
  return { vessel, hull };
}

/** La coque de TRAJET quand le voyage porte le navire de campagne (`travelPlan.vehicle` de même véhicule que
 *  `vessel`) ; `undefined` sinon (bateau de route fluviale, aucun voyage). */
export function coqueDuNavireDeCampagne(plan: TravelPlan | null | undefined, vessel: CampaignVessel | null | undefined): Combatant | undefined {
  return plan?.vehicle && vessel && plan.vehicle.creatureId === vessel.vehicleId ? plan.vehicle : undefined;
}

/** PERSISTE les Blessures de la coque de trajet sur le navire de campagne (#30) — l'UNIQUE écriture
 *  `vessel.wounds` (#296). No-op si la coque de trajet n'est pas le navire de campagne (bateau de route
 *  fluviale sans navire de campagne). */
export function persistHullWounds(get: Get, set: Set): void {
  const vessel = get().vessel;
  const coque = coqueDuNavireDeCampagne(get().travelPlan, vessel);
  if (!vessel || !coque) return;
  set({ vessel: { ...vessel, wounds: { current: coque.wounds.current, max: coque.wounds.max } } });
}

/** Fixe ABSOLUMENT les Blessures de coque du navire de campagne (effet d'auteur `adjustVessel`, #308) —
 *  écrit `vessel.wounds` PUIS resynchronise la copie de travail `travelPlan.vehicle` si un voyage est
 *  actif dessus (sinon la prochaine `persistHullWounds` l'écraserait avec la valeur pré-effet périmée,
 *  même trou que #296 côté delta). */
export function setVesselHull(get: Get, set: Set, current: number, max: number): void {
  const vessel = get().vessel;
  if (!vessel) return;
  const reste = Math.max(0, Math.min(current, max));
  set({ vessel: { ...vessel, wounds: { current: reste, max } } });
  const plan = get().travelPlan;
  const coque = coqueDuNavireDeCampagne(plan, vessel);
  if (plan && coque) set({ travelPlan: { ...plan, vehicle: { ...coque, wounds: blessuresPosees(coque, max, reste) } } });
}

/** Inflige `amount` Dégâts à la coque de TRAJET (`hull`, `travelPlan.vehicle`) et PERSISTE aussitôt sur
 *  `vessel.wounds` (#296) — UNE écriture, jamais un `damageHull` orphelin de sa persistance (c'était le
 *  double chemin : certains sites persistaient au coup par coup, d'autres seulement en fin de jour, la
 *  fenêtre entre les deux pouvait écraser une valeur plus fraîche écrite ailleurs, ex. fin de combat naval). */
export function damageVesselHull(get: Get, set: Set, hull: Combatant, amount: number): string[] {
  const j = damageHull(hull, amount, get().forgerUnId);
  const plan = get().travelPlan;
  if (plan) set({ travelPlan: { ...plan } }); // bump de référence : la mutation en place de `hull` doit se voir
  persistHullWounds(get, set);
  return j;
}

/** Inflige `amount` Dégâts au navire de campagne hors combat : à sa coque de trajet quand un voyage la porte
 *  (`damageVesselHull`), sinon à sa coque bâtie de `vessel` (`voyageShip`), écrite par `setVesselHull`.
 *  `null` sans navire de campagne dont la donnée porte une coque. */
export function damageCampaignVessel(get: Get, set: Set, amount: number): string[] | null {
  const coque = coqueDuNavireDeCampagne(get().travelPlan, get().vessel);
  if (coque) return damageVesselHull(get, set, coque, amount);
  const ship = voyageShip(get);
  if (!ship) return null;
  const journal = damageHull(ship.hull, amount, get().forgerUnId);
  setVesselHull(get, set, ship.hull.wounds.current, ship.hull.wounds.max);
  return journal;
}

/** Restaure `amount` Blessures à la coque de TRAJET et PERSISTE aussitôt sur `vessel.wounds` — pendant
 *  de `damageVesselHull` pour les soins. */
export function healVesselHull(get: Get, set: Set, hull: Combatant, amount: number): string[] {
  const j = healHull(hull, amount, get().forgerUnId);
  const plan = get().travelPlan;
  if (plan) set({ travelPlan: { ...plan } });
  persistHullWounds(get, set);
  return j;
}

/** VOIE D'EAU (lot D #327) : une coque percée/heurtée « gâte 1d10 Enc » de cargaison (MSRC 7 l.101 /
 *  MDG, cf. `engine/cargo.ts`). Route sur la SOURCE UNIQUE `vessel.cargo` via le tronc `spoilCargoByEnc`.
 *  Renvoie le journal (vide si rien à gâter). Câblé sur les avaries de coque EXISTANTES (collision maritime,
 *  coque percée fluviale) — jamais un mécanisme neuf. */
export function spoilVesselCargoOnLeak(get: Get, set: Set): string[] {
  const vessel = get().vessel;
  if (!vessel?.cargo?.length) return [];
  const enc = rollDice(1, 10, battleRng());
  const r = spoilCargoByEnc(vessel.cargo, enc);
  if (!r.removed) return [];
  set({ vessel: { ...vessel, cargo: r.lots } });
  // MSRC 7 l.101 / MDG
  return [t('sv.leakSpoils', { enc: r.removed })];
}

/** `propulsionDuNavire` MARITIME de la COQUE `hull` (au `mode` du jour d'un navire mixte), que le schéma
 *  de véhicule garantit (MDG 12 l.131). PUR. */
function seaRig(hull: Combatant, mode?: PropulsionKind): PropulsionDuNavire {
  return garanti(propulsionDuNavire(hull.creatureId, hull.upgrades, 'maritime', mode), hull.creatureId, 'propulsion du navire');
}

/** Un navire de mer par son type et ses Améliorations : coque de trajet (`creatureId`) comme navire de
 *  campagne (`vehicleId`). */
interface NavireDeMer { vehicleId: string | undefined; upgrades?: NavalTraitRef[] }

function navireDeLaCoque(hull: Combatant): NavireDeMer {
  return { vehicleId: hull.creatureId, upgrades: hull.upgrades };
}

/** M de CROISIÈRE du navire : M du gréement + `navalMoveMod` de ses Traits et Améliorations ; à la
 *  vapeur, M du moteur. Socle du M du jour (`effectiveSeaM`), de la traversée rapide, des jours restants
 *  et de l'estimation de la carte du monde (#3059). MDG 12 l.293 ; MDG 12 l.311. PUR. */
export function mDeCroisiere(navire: NavireDeMer): number {
  const rig = garanti(propulsionDuNavire(navire.vehicleId, navire.upgrades, 'maritime'), navire.vehicleId, 'propulsion du navire');
  return rig.mode === 'vapeur' ? rig.m : rig.m + navalMoveMod(navalTraitsDe(navire.vehicleId, navire.upgrades));
}

/** Pourquoi un navire ne peut pas prendre la mer : aucun Mouvement de croisière (MDG 15 l.57-70) ou
 *  cale chargée au-delà du plafond dur (MDG 12 l.70-75). */
export type RefusDAppareiller = { motif: 'immobile' } | { motif: 'cale'; ratioPct: number };

/** Refus d'appareiller du navire (`null` : en état). Source unique du départ en mer (`buildSeaPlan`)
 *  et de l'écran de la carte du monde (#3059). PUR. */
export function refusDAppareiller(navire: NavireDeMer & { cargo?: CargoLot[] }): RefusDAppareiller | null {
  if (mDeCroisiere(navire) <= 0) return { motif: 'immobile' };
  const contenance = garanti(findVehicleById(navire.vehicleId ?? '')?.ship, navire.vehicleId, 'profil naval').capacity;
  const cale = cargoOverload(cargoTotalEnc(navire.cargo ?? []), contenance);
  return cale.canSail ? null : { motif: 'cale', ratioPct: cale.ratioPct };
}

/** Libellé d'un refus d'appareiller. */
export function raisonDuRefusDAppareiller(refus: RefusDAppareiller): string {
  return refus.motif === 'cale' ? t('sv.refusCale', { pct: refus.ratioPct }) : t('sv.refusImmobile');
}

/** Blessures de coque d'un navire de campagne : maximum, courantes, à restaurer. SOURCE UNIQUE du
 *  dossier du navire et du devis de chantier. PUR. */
export function blessuresDeCoqueARestaurer(vessel: CampaignVessel): { max: number; current: number; missing: number } {
  const max = vessel.wounds?.max ?? findVehicleById(vessel.vehicleId)?.hull?.char.B ?? 0;
  const current = vessel.wounds?.current ?? max;
  return { max, current, missing: max - current };
}

/** Dossier d'un navire de campagne : coque, cale (MDG 12 l.70-75), refus d'appareiller, population
 *  embarquée (`shipboardSouls`, MDG 14 l.238), autonomies et soldes. Vue PURE lue par l'écran du dossier. */
export interface DossierDuNavire {
  woundsMax: number; woundsCur: number; missing: number;
  capacity: number; cargoEnc: number; overload: CargoOverload; cargoMax: number; cargoMarks: number[];
  refusDAppareiller: string | null;
  heroes: number; crewCount: number; autonomyDays: number | null; provisionDays: number | null; weeklyWageBrass: number;
  soldesParRole: { roleId: string; count: number; weeklyBrass: number }[];
}

/** `null` : le type du navire n'a pas de profil naval. */
export function dossierDuNavire(vessel: CampaignVessel, party: Combatant[]): DossierDuNavire | null {
  const vd = findVehicleById(vessel.vehicleId);
  if (!vd?.ship) return null;
  const { max: woundsMax, current: woundsCur, missing } = blessuresDeCoqueARestaurer(vessel);
  const capacity = vd.ship.capacity;
  const cargoEnc = cargoTotalEnc(vessel.cargo ?? []);
  const refus = refusDAppareiller(vessel);
  const { heroes, crew: crewCount } = shipboardSouls({ party, vessel });
  const dailyWater = provisioningManifest(party, vessel.waterLitres, 1, { count: crewCount, provisions: vessel.provisions }).eauRequiseLitres;
  return {
    woundsMax, woundsCur, missing,
    capacity, cargoEnc, overload: cargoOverload(cargoEnc, capacity), cargoMax: overloadMaxEnc(capacity), cargoMarks: overloadMarks(capacity),
    refusDAppareiller: refus ? raisonDuRefusDAppareiller(refus) : null,
    heroes, crewCount,
    autonomyDays: vessel.waterLitres != null && dailyWater > 0 ? Math.floor(vessel.waterLitres / dailyWater) : null,
    provisionDays: vessel.provisions != null && crewCount > 0 ? Math.floor(rationsDeCale(vessel.provisions) / crewCount) : null,
    weeklyWageBrass: weeklyCrewWageBrass(vessel.crew),
    soldesParRole: (vessel.crew ?? []).map((h) => ({ roleId: h.roleId, count: h.count, weeklyBrass: weeklyCrewWageBrass([h]) })),
  };
}

/** Refus d'un départ en mer (`null` : le navire de campagne appareille) — les cas où `buildSeaPlan` rend
 *  `null`. Lu par `refusDeDepart` (`travelFlow`) et par l'estimation de la carte du monde (#3059). */
export function refusDuDepartEnMer(get: Get<Jeu>): string | null {
  const ship = voyageShip(get);
  if (!ship) return t('tf.sansNavire');
  const refus = refusDAppareiller(ship.vessel);
  return refus ? raisonDuRefusDAppareiller(refus) : null;
}

/** M de VOYAGE du jour (ch.13/15) : M de croisière (`mDeCroisiere`) + Salissures + événement, puis
 *  EFFET DU VENT (%, Clinfoc — ch.13 l.274/ch.12 l.254). `null` = les voiles n'avancent pas
 *  (Encalminé / Affaler) — Propulsion à vapeur : insensible au vent (ch.12 l.311). */
function effectiveSeaM(get: Get): { m: number | null; sail: boolean; mode: PropulsionKind | null; affaler: boolean } {
  const plan = get().travelPlan!;
  const sea = plan.sea!;
  const hull = plan.vehicle!;
  const vd = profilNavalDe(hull);
  const traits = hullNavalTraits(hull);
  const vessel = get().vessel;
  const propulsion = seaRig(hull);
  const croisiere = mDeCroisiere(navireDeLaCoque(hull));
  if (propulsion.mode === 'vapeur') return { m: croisiere, sail: false, mode: null, affaler: false };
  const sail = propulsion.mode === 'voile';
  const fouling = foulingEffects(vessel?.fouling?.level ?? 0);
  // Forcer le rythme (MDG 13 l.95-107) : le bonus de M du jour n'est acquis que si le Test de
  // Voile/Ramer du jour a été RÉUSSI ('reussite' — posé par la boucle à l'étape Progression).
  const pace = sea.paceToday === 'reussite' ? sea.forcePace ?? 0 : 0;
  // Surcharge de la cale (MDG 12 l.72-74) : −1/−2/−3 M par palier d'Encombrement supplémentaire.
  const overloadM = cargoOverload(cargoTotalEnc(vessel?.cargo ?? []), vd?.capacity ?? 0).mMod;
  // Empêtré dans des Débris marins (MDG 13 l.487-489, #444) : pénalité de M tant que non dégagé.
  const entangleM = sea.entangled?.mMod ?? 0;
  // Modificateurs d'événement posés sur le navire (op `navireMod`) : MDG 15 l.184-185, l.187-188, l.228
  const modsM = sommeDesModificateurs(vessel?.modificateurs, get().gameTime, 'm');
  const baseM = croisiere + fouling.mMod + modsM + pace + overloadM + entangleM;
  const aspect = windAspect(sea.heading, sea.windFrom);
  // Gréement de course (MSRC 12 l.137) « inclut un clinfoc … les avantages des deux ne sont pas cumulables »
  // → il PRIME sur le Clinfoc quand les deux sont présents.
  const rigging = shipHasNavalTrait(traits, 'greement-de-course') ? 'greement' : shipHasNavalTrait(traits, 'clinfoc') ? 'clinfoc' : 'none';
  const cell = windEffect(sea.weather.vent, aspect, rigging);
  const m = windAdjustedM(Math.max(0, baseM), cell, sail);
  const affaler = !!(cell.affaler && sail);
  return { m, sail, mode: propulsion.mode, affaler };
}

// ── Test d'équipage de VOYAGE (MDG 14 l.39) ────────────────────────────────

/** Étape À PARTICIPANTS (batch, seam de jet #275 Décision 4 cran 1/2) d'un Test d'équipage de VOYAGE
 *  (MDG 14 l.39) — construit les contributeurs
 *  (`crewTestContributors`) et pose Moral/sabotage/traits navals en `meta` (agrégés à la validation par
 *  `cascade.aggregateBatchStep`, MÊME formule que `maneuverCrewTotal`). `null` = aucun PJ n'a de rôle
 *  utile (aucun jet à jouer ce Test-là, l'appelant applique son chemin sans-jet). `kind` = la clé du
 *  table `appliers` (#275 Ronde 2 cran 2/3) — les 10 Tests canoniques partagent leur
 *  `testTypeId`, un ÉVÉNEMENT peut réutiliser un `testTypeId` sous un AUTRE `kind` (le `test` d'équipage
 *  d'un Flow → `testDEquipage`) pour ne jamais retomber dans la routine auto-résolue (`KINDS_SOUS_ORDRES`
 *  est indexée par `kind`, pas `testTypeId`). L'enjeu est celui que le `kind` nomme (`buildVoyageCrewStep`),
 *  ou celui que le Test de Flow porte. */
export function etapeDEquipage(get: Get, testTypeId: string, kind: GenreDEtape, stake: StakeRef, opts: CrewStepOpts = {}): BuiltCascadeStep | undefined {
  const plan = get().travelPlan;
  const ship = plan?.vehicle;
  if (!ship) return undefined;
  const party = equipageApte(get().party);
  if (!party.length) return undefined;
  ship.crewIds = party.map((h) => h.id); // MDG 14 l.39
  const navigation = seaRig(ship, plan.sea?.modeToday).competence;
  const contributors = crewTestContributors(ship, party, testTypeId, new Set(party.map((h) => h.id)), navigation, opts.sense);
  if (!contributors.length) return undefined;
  const testType = findCrewTestTypeById(testTypeId);
  const essentialRoleId = testType?.essential.id;
  const pont = activeSeaPrecipitation(get); // MDG 13 l.185
  // Le flux propriétaire (naval) RÉSOUT la présentation (rôle tenu) et DÉCLARE le jet de chaque
  // contributeur au MONTEUR CANONIQUE (`rollStep`) — le séquenceur/modale génériques n'y liront QUE
  // des champs neutres (`BatchParticipant`), base NUE et composantes NOMMÉES comprises.
  // `bonusSlOnSuccess` = +DR de Talent baké (Commandant émérite, MDG 09 l.54).
  const participants: BatchParticipant[] = contributors.map((a) => {
    const role = findCrewRoleById(a.roleId);
    const rv = role ? crewRoleValue(a.crew, role, navigation, opts.sense) : undefined;
    return {
      id: a.crew.id,
      label: role?.label ?? a.roleId, // PROVENANCE affichée (rôle tenu) — jamais le libellé de LIGNE
      roleId: a.roleId,
      ...(rv?.used ? { skill: structuredClone(rv.used) } : {}), // #2097
      interactive: true,
      essential: a.roleId === essentialRoleId,
      difficulty: 'intermediaire' as const,
      bonusSlOnSuccess: role ? crewTalentDR(a.crew, role, navigation) : 0,
      result: null,
      // La Compétence RÉELLEMENT tenue par le rôle (`crewRoleValue().used`) est celle qui se décompose ;
      // le modificateur de Test d'équipage des effets actifs (chanson de marin, `MDG 09 l.224`) est
      // DÉJÀ fondu dans `rv.value` : il se déclare en `dansLaValeur` et sort en chip NOMMÉE par son
      // effet émetteur. Un membre qui ne peut pas tenter son rôle DÉCLARE son refus : la ligne naît
      // résolue (`rollStep`, LDB 09 l.30 ; #2588 Q1). Sans rôle résolu, la valeur vient d'une autre
      // formule : elle se DÉCLARE comme telle.
      ...rollStep(rv?.refus != null
        ? { actor: a.crew, test: { skill: rv.used, sense: opts.sense }, difficulty: 'intermediaire', refus: rv.refus }
        : rv?.used
          ? {
            actor: a.crew, test: { skill: rv.used, sense: opts.sense },
            valeur: rv.value, difficulty: 'intermediaire',
            ...(crewTestModParts(a.crew).length ? { dansLaValeur: crewTestModParts(a.crew) } : {}),
            pont,
          }
          : { valeur: rv?.value ?? 0, valeurEtrangere: true, difficulty: 'intermediaire', pont }),
    };
  });
  const saboteur = shipSaboteurDR(ship); // MDG 14 l.45-47 : −1..−5 DR plats, aussi en voyage (#214)
  // #221 : Traits/Améliorations navals ciblant CE type de Test d'équipage (op `skillDRBonus` à `testType`,
  // ex. Proue-idole de Stromfels → Poursuite) — agnostique de la compétence tenue par le représentant.
  const traitDR = navalTestTypeDR(hullNavalTraits(ship), testTypeId);
  // « Bouteur »/« Gréement de course » modifient le Test de Navigation POUR DIRIGER (MSRC 12 l.66/140) —
  // seul le Test d'équipage de manœuvre (steering) le reçoit, converti en DR (`navalNavTestDR`, ÷10).
  // Modificateurs d'événement posés sur le navire (op `navireMod`) : MDG 15 l.184-185
  const modsDR = sommeDesModificateurs(get().vessel?.modificateurs, get().gameTime, 'manDR');
  const navDirDR = testType?.steering ? navalNavTestDR(hullNavalTraits(ship)) + modsDR : 0;
  // MANQUE DE BRAS (MDG 14 l.55) — s'applique à TOUT Test d'équipage, voyage compris : −2 DR par tranche de
  // 10 % manquante ET plafond au Succès Minime. En campagne l'attrition vient des pertes d'équipage
  // (`vessel.crewLost`, MDG 15 l.245) — MÊME couture que le combat (`shipUndercrew`).
  const undercrew = shipUndercrew(get, ship, party);
  // Le naval verse ses paramètres de formule DÉJÀ chiffrés en `meta` NEUTRE (bande de Moral + sabotage +
  // traits + Manque de bras, et son plafond) et l'ID de son prédicat de succès (`crew-test` →
  // `crewTestSuccess`, MDG 14 l.13) : l'agrégat générique ne connaît aucun seuil naval.
  const flatDR = moraleBand(shipMoraleScore(get, ship)).crewTestDR + saboteur + traitDR + navDirDR + (opts.extraDR ?? 0) + (opts.difficulty ? DIFFICULTY_MODIFIERS[opts.difficulty] / 10 : 0) + undercrew.dr;
  // La POSSESSION de la bande est posée par le socle (`bandStep`) : N contributeurs ⇒ `groupOwner`, un
  // seul ⇒ son porteur. Déclarée nulle part ici — c'est ce qui laissait la fenêtre à l'hôte seul (#1268).
  return bandStep({
    id: idDansLaSequence(get, kind), kind, label: dataLabel(testType?.label, testTypeId), icon: opts.icon ?? 'voyage/ancre', // id = ADRESSE : le `kind` seul collisionne dès qu'un jour en pousse deux (#1852)
    aggregate: 'summed-dr',
    stake,
    ...(opts.contexte ? { contexte: opts.contexte } : {}),
    meta: {
      crewTestType: testTypeId,
      aggregateSuccessRule: CREW_TEST_SUCCESS_RULE,
      ...(flatDR ? { aggregateFlatDR: flatDR } : {}),
      ...(undercrew.capSuccesMinime ? { aggregateCapTo: SUCCES_MINIME_CAP } : {}), // l.55
    },
  }, participants);
}

/** Options d'une étape de Test d'équipage (`etapeDEquipage`). */
type CrewStepOpts = { sense?: PairedSense; extraDR?: number; difficulty?: Difficulty; icon?: IconId; contexte?: ContexteDeTest };

/** Test d'équipage d'une étape de voyage dont le `kind` est l'id de son enjeu : ce que CE jet change, jamais
 *  la règle-cadre du remplacement par un Test d'équipage (MDG 14 l.63). */
export function buildVoyageCrewStep(get: Get, testTypeId: string, kind: Extract<GenreDEtape, VoyageStakeId>, opts: CrewStepOpts = {}): BuiltCascadeStep | undefined {
  return etapeDEquipage(get, testTypeId, kind, voyageStakeRef(kind), opts);
}

/** Refus NOMMÉ de Forcer le rythme quand personne ne peut tenter son Test (MDG 13 l.97, LDB 09 l.30) ; `null`
 *  sinon. Le geste de départ (`WorldMapView`) et l'étape du jour en dérivent. */
export function forcePaceRefus(party: Combatant[], competence: RefDesignee): string | null {
  return partyBest(party, { skill: competence }) ? null : refusPersonneNePeutTenter({ skill: competence });
}

/** Étape MONO « Forcer le rythme » (MDG 13 l.95-107, `mer-forcer-le-rythme`, applier ci-dessous) : le meilleur
 *  PJ soutenu (LDB 12) tente le Test de Voile/Ramer du jour. `undefined` = pas demandé, déjà tranché
 *  aujourd'hui, vapeur (ni voiles ni avirons à forcer), ou personne qui puisse tenter (refus nommé au
 *  journal ; MDG 13 l.97, LDB 09 l.30). */
function buildForcePaceStep(get: Get, set: Set): BuiltCascadeStep | undefined {
  const plan = get().travelPlan!;
  const sea = plan.sea!;
  if (!sea.forcePace || sea.paceToday != null) return undefined;
  const propulsion = seaRig(plan.vehicle!);
  if (propulsion.mode === 'vapeur') return undefined;
  const rig = propulsion.mode;
  const diff = forcePaceDifficulty(sea.forcePace, rig);
  if (!diff) return undefined;
  const refus = forcePaceRefus(get().party, propulsion.competence);
  if (refus) { tell(get, set, [t('sv.paceRefus', { refus })]); return undefined; }
  const skill = propulsion.competence;
  const best = partyAssisted(get().party, { skill })!;
  const test = { skill, label: t('sv.forcePace') };
  return monoStep({
    id: 'mer-forcer-le-rythme', kind: 'mer-forcer-le-rythme', actor: best.actor, icon: 'voyage/navire-a-voile',
    label: composeRollLabel(best.actor, t('sv.forcePace'), test),
    difficulty: diff,
    // Le Soutien est un bonus AU TEST (LDB 12, fiche `soutien`) : la valeur SOUTENUE (`best.value`,
    // Soutien fondu par `partyAssisted`) donne la CIBLE — sans elle, la cible se recalculerait depuis
    // la carac NUE et les soutiens ne changeraient rien au jet (recette #1117).
    ligne: { test: { skill }, valeur: best.value, soutien: best.support, pont: activeSeaPrecipitation(get) },
    stake: voyageStakeRef('mer-forcer-le-rythme', { paceM: sea.forcePace ?? 0 }),
    meta: { forcePace: sea.forcePace, manieurs: manieursDe(best) },
  });
}

/** Compétence des Tests de Navigation du navire du voyage (MDG 13 l.18-19, l.32). */
function helmSkill(get: Get): RefDesignee {
  return seaRig(get().travelPlan!.vehicle!).competence;
}

/** Étape MONO « Test de Navigation » de PROGRESSION (MDG 13 l.18-19, l.32, l.64-66 ; `helmSkill`), DR lu par
 *  `applySeaProgress`. `undefined` = aucun PJ éligible. */
function buildNavProgressionStep(get: Get): BuiltCascadeStep | undefined {
  const skill = helmSkill(get);
  const best = partyAssisted(get().party, { skill });
  if (!best) return undefined;
  const test = { skill, label: t('sv.navigation') };
  const diff: Difficulty = 'intermediaire';
  return monoStep({
    id: 'merProgressionNavigation', kind: 'merProgressionNavigation', actor: best.actor, icon: 'voyage/ancre',
    label: composeRollLabel(best.actor, t('sv.progression'), test),
    difficulty: diff,
    ligne: { test: { skill }, valeur: best.value, soutien: best.support, pont: activeSeaPrecipitation(get) },
    stake: voyageStakeRef('progression-navigation'),
    ...(estCompetenceDePropulsion(skill.id) ? { meta: { manieurs: manieursDe(best) } } : {}),
  });
}

/** La Progression du jour laisse au joueur le choix ouvert par MDG 14 l.63 (« vous POUVEZ effectuer un
 *  Test d'équipage AU LIEU d'un Test de Navigation ») : aucune des deux voies ne se prend en silence.
 *  La voie Navigation que personne ne peut tenter reste OFFERTE, fermée avec son refus (LDB 09 l.30).
 *  `defaultChoice` = l'équipage, la voie du grand vaisseau — c'est elle qui s'applique en cadence
 *  COMMANDÉE (`jouerLaJournee` commandée), où le joueur n'est pas à la manœuvre. Le PORTEUR est le barreur
 *  (`seaDecider`) : c'est lui que la décision engage. */
function buildProgressionChoiceStep(get: Get): BuiltCascadeStep | undefined {
  if (!buildVoyageCrewStep(get, 'progression', 'equipage-progression')) return undefined;
  const helm = helmSkill(get);
  const navRefus = buildNavProgressionStep(get) ? undefined : refusPersonneNePeutTenter({ skill: helm });
  return choiceStep({
    id: 'merProgressionChoix', kind: 'merProgressionChoix', icon: 'voyage/ancre',
    actorId: seaDecider(get),
    label: t('step.seaProgression'),
    options: [
      { key: 'crew', label: t('opt.testEquipage'), detail: t('sv.detailCrew') },
      { key: 'nav', label: t('opt.testNavigation'), detail: t('sv.detailNav'), ...(navRefus ? { refus: navRefus } : {}) },
    ],
    defaultChoice: 'crew',
    stakeRule: { category: 'regles', id: 'test-equipage-progression' },
  });
}

/** Pénalité du Test de Force de dégagement d'un ÉCHOUAGE (MDG 13 l.473), dérivée au jet de
 *  `strandingPenalty` : Encombrement du navire + de sa cargaison. */
function seaStrandingPenalty(get: Get): ModLine[] {
  const vessel = get().vessel;
  const shipEnc = findVehicleById(vessel?.vehicleId ?? '')?.enc ?? 0;
  const cargoEnc = cargoTotalEnc(vessel?.cargo ?? []);
  const line = strandingPenaltyLine(shipEnc, cargoEnc, RULE_REF['echouer-en-mer']);
  return line ? [line] : [];
}

/** Étape MONO « Dégagement » (Test de Force, #444) — partagée par l'Échouage (`mer-degagement`, MDG
 *  ch.13 l.471-473) et l'empêtrement dans des Débris marins (`mer-degagement-debris`, l.491, Test
 *  étendu). `penalite` = les malus sur la cible (l.473). `undefined` = aucun PJ éligible à la Force. */
function buildStrandedOrEntangledStep(get: Get, difficulty: Difficulty, kind: Extract<GenreDEtape, VoyageStakeId>, { penalite = [], stakeValues }: { penalite?: ModLine[]; stakeValues?: Record<string, number> } = {}): BuiltCascadeStep | undefined {
  const force = partyAssisted(get().party, { characteristic: 'force' });
  if (!force) return undefined;
  const test = { characteristic: 'force' as const };
  return monoStep({
    id: kind, kind, actor: force.actor, icon: 'voyage/reparer',
    label: composeRollLabel(force.actor, t('sv.degagement'), test),
    difficulty,
    ligne: { test: { characteristic: 'force' }, valeur: force.value, soutien: force.support, surLaCible: penalite, pont: activeSeaPrecipitation(get) },
    stake: voyageStakeRef(kind, stakeValues),
  });
}

/** Ligne du Test du VAISSEAU (MDG 12 l.58, MDG 13 l.125, l.148) : l'Endurance de la coque, tenue par le
 *  porteur MONDE de `monoStep`. */
function ligneDuVaisseau(hull: Combatant) {
  return { test: { characteristic: 'endurance' as const }, valeur: effectiveChar(hull, 'endurance') };
}

/** Étape MONO « Ça va lâcher, capitaine ! » (MDG 13 l.121-142, `mer-survitesse`, applier ci-dessous),
 *  Test du vaisseau. `undefined` = pas de survitesse ce jour. */
function buildOverspeedStep(get: Get, index: number): BuiltCascadeStep | undefined {
  const plan = get().travelPlan!;
  const sea = plan.sea!;
  if (!sea.milesToday || sea.effMToday == null) return undefined; // aucune Progression ce jour → rien à sanctionner (Encalminé/Affalé/Échoué)
  const hull = garanti(plan.vehicle, plan.routeId, 'navire du voyage');
  // Référent M = le mode PERSISTÉ du jour (`modeToday`, navire mixte, #524).
  const baseM = seaRig(hull, sea.modeToday).m;
  const row = overspeedRow(baseM, sea.effMToday);
  if (!row) return undefined;
  return monoStep({
    id: `mer-survitesse-${index}`, kind: 'mer-survitesse', monde: true, icon: 'voyage/navire-a-voile',
    label: composeRollLabel(hull, t('sv.overspeed'), { characteristic: 'endurance' }),
    difficulty: row.difficulty,
    ligne: ligneDuVaisseau(hull),
    // SURPLUS de M du jour (`effMToday − M de conception`) : c'est ce qui choisit la bande du tableau
    // (l.121-142). Il se LIT sur l'étape par sa NOTE d'enjeu (`stake`, zone d'accueil de ce que le jet
    // met en jeu) — le libellé d'action reste le NOM de l'action (docs/charte-ui.md).
    stake: voyageStakeRef('mer-survitesse', { overM: sea.effMToday - baseM, damage: row.damage }),
    meta: { overspeedDamage: row.damage },
  });
}

/** Cadence infra-journalière du tableau (1 Test par heure/minute/Round selon la bande, l.129-140) mappée
 *  sur le grain JOUR de la boucle de voyage (règle maison éditable `mer-survitesse-tests-par-jour`, #443,
 *  même patron que `exposition-tests-nuit-*`). `n − 1` Tests supplémentaires réutilisent le MÊME meneur
 *  (composition figée au début du jour, comme les autres étapes de tronc). Exportée pour test direct
 *  (#524) : le référent M lit `sea.modeToday`, jamais recalculable depuis le seul `apply('equipage-progression')`
 *  qui écrase ce champ à sa propre politique. */
export function buildOverspeedSteps(get: Get): BuiltCascadeStep[] {
  const n = Math.max(1, Math.round(Number(rule('mer-survitesse-tests-par-jour'))));
  const out: BuiltCascadeStep[] = [];
  for (let i = 0; i < n; i++) {
    const st = buildOverspeedStep(get, i);
    if (!st) break;
    out.push(st);
  }
  return out;
}

/** Étape MONO « Salissures » (MDG 13 l.144-159, `mer-salissures`, applier ci-dessous), Test du
 *  vaisseau ; Difficulté : règle maison `mer-salissures-difficulte` (LDB 12 l.137). `undefined` =
 *  semaine déjà testée, ou moins de 7 jours en mer. */
function buildFoulingStep(get: Get): BuiltCascadeStep | undefined {
  const vessel = get().vessel;
  const sea = get().travelPlan?.sea;
  if (!vessel || !sea) return undefined;
  const week = Math.floor(dayIndex(get().gameTime) / 7);
  if (week <= (vessel.fouling?.lastWeek ?? -1) || sea.daysAtSea + 1 < 7) return undefined;
  const plan = get().travelPlan!;
  const hull = garanti(plan.vehicle, plan.routeId, 'navire du voyage');
  return monoStep({
    id: 'mer-salissures', kind: 'mer-salissures', monde: true, icon: 'voyage/navire-a-voile',
    label: composeRollLabel(hull, t('sv.foulingTest'), { characteristic: 'endurance' }),
    difficulty: rule('mer-salissures-difficulte') as Difficulty,
    ligne: ligneDuVaisseau(hull),
    stake: voyageStakeRef('mer-salissures'),
    meta: { week },
  });
}

/** La coque `hull` est tenue par une réparation temporaire : marqueur du navire de campagne quand elle est la sienne,
 *  de l'état fluvial du bateau de la route sinon. MDG 13 l.651 ; MSRC 7 l.117 */
export function reparationTemporaireTient(get: Get, hull: Combatant): boolean {
  const vessel = get().vessel;
  if (vessel && hull.creatureId === vessel.vehicleId) return !!vessel.reparationTemporaire;
  const plan = get().travelPlan;
  return plan?.vehicle?.id === hull.id && !!plan.river?.reparationTemporaire;
}

/** Pose le marqueur de réparation temporaire de la coque de trajet, au porteur que lit `reparationTemporaireTient`.
 *  MDG 13 l.651 ; MSRC 7 l.117 */
export function poserLaReparationTemporaire(get: Get, set: Set): void {
  const plan = get().travelPlan;
  const vessel = get().vessel;
  if (vessel && coqueDuNavireDeCampagne(plan, vessel)) set({ vessel: { ...vessel, reparationTemporaire: true } });
  else if (plan?.river) set({ travelPlan: { ...plan, river: { ...plan.river, reparationTemporaire: true } } });
}

/** Étape MONO du Test d'Endurance de la coque `hull` tenue par une réparation temporaire, tenue par le MONDE :
 *  `kind` et enjeu de même id, `id` = son adresse dans la séquence, `meta.hullId` = la coque qui le joue.
 *  `undefined` si la coque n'est pas tenue par une réparation temporaire. MDG 13 l.651 ; MSRC 7 l.117 */
export function etapeDeLaReparationTemporaire(
  get: Get, hull: Combatant, id: string, kind: 'mer-reparation-temporaire' | 'fleuve-reparation-temporaire', difficulty: Difficulty, failDamage: Tirage,
): BuiltCascadeStep | undefined {
  if (!reparationTemporaireTient(get, hull)) return undefined;
  return monoStep({
    id, kind, monde: true, icon: 'voyage/reparer',
    label: composeRollLabel(hull, t('sv.reparationTemporaire'), { characteristic: 'endurance' }),
    difficulty,
    ligne: ligneDuVaisseau(hull),
    stake: voyageStakeRef(kind, { degats: formatDice(failDamage.dice) }),
    meta: { hullId: hull.id },
  });
}

/** Issue du Test d'Endurance d'une réparation temporaire : l'échec ouvre le dé `failDamage` des Dégâts de la
 *  coque qui a joué le Test (`reparation-temporaire-degats`). MDG 13 l.651 ; MSRC 7 l.117 */
export function appliquerLaReparationTemporaire(get: Get, set: Set, step: CascadeStep, failDamage: Tirage): ReturnType<CascadeApplier> {
  if (!step.result) return;
  const line = t(step.result.success ? 'sv.reparationTemporaireTient' : 'sv.reparationTemporaireCede');
  noteSeaLine(get, set, [line]);
  const degats = step.result.success ? undefined : dieStep({
    id: `${step.id}-degats`, kind: 'reparation-temporaire-degats', worldOwner: true, icon: 'voyage/reparer',
    label: t('sv.reparationTemporaireDegats'), spec: failDamage.dice, meta: { hullId: String(step.meta?.hullId) },
  });
  return { consequences: freeCons([line]), ...(degats ? { insert: [degats] } : {}) };
}

/** Le Test d'Endurance de la coque `hull` tenue par une réparation temporaire, après le Test `apres` du jour ou de
 *  Manœuvre ; Difficulté : règle maison `mer-reparation-temporaire-difficulte`. MDG 13 l.651 */
export function reparationTemporaireDuNavire(get: Get, hull: Combatant | undefined, apres: string): BuiltCascadeStep | undefined {
  return hull && etapeDeLaReparationTemporaire(get, hull, `${apres}-reparation-temporaire`, 'mer-reparation-temporaire',
    rule('mer-reparation-temporaire-difficulte') as Difficulty, REPARATION.temporaire.failDamage);
}

/** Le Test d'Endurance Accessible (+20) de la coque `hull` tenue par une réparation temporaire, après le Test `apres`
 *  du barreur ou les Dégâts du fleuve. MSRC 7 l.117 */
export function reparationTemporaireFluviale(get: Get, hull: Combatant, apres: string): BuiltCascadeStep | undefined {
  return etapeDeLaReparationTemporaire(get, hull, `${apres}-reparation-temporaire`, 'fleuve-reparation-temporaire',
    TEMPORARY_REPAIR.enduranceDifficulty, TEMPORARY_REPAIR.failDamage);
}

/** Le Test d'Endurance de la coque `ship` après sa Manœuvre de combat, appendu à la séquence de combat, au régime du
 *  milieu du voyage (fluvial : règle maison `fleuve-reparation-temporaire-navigation`). MDG 13 l.651 ; MSRC 7 l.117 */
export function reparationTemporaireApresLaManoeuvre(get: Get, set: Set, ship: Combatant): void {
  const fluvial = milieuDuVoyage(get().travelPlan) === 'fluvial';
  if (fluvial && !rule('fleuve-reparation-temporaire-navigation')) return;
  pushStep(set, (index) => (fluvial ? reparationTemporaireFluviale : reparationTemporaireDuNavire)(get, ship, `manoeuvre-${ship.id}-${index}`), 'combat');
}

/**
 * Étapes POST-PROGRESSION du jour (crise → embuscade ancrée → phare → orientation → extermination →
 * entretien), calculées APRÈS que `applySeaProgress` ait posé `sea.milesToday` du jour (dépendance de
 * l'embuscade/du phare, #275 Ronde 2 cran 3 Décision 2) — appelée par l'applier `'equipage-progression'`
 * (`insert`) ET par `buildSeaDayCascade` quand AUCUN Test de Progression n'a pu s'ouvrir (aucun PJ
 * apte). L'embuscade SANS équipage (aucun jet de Perception possible) ouvre directement l'abordage
 * EN SURPRISE ici : jamais d'étape de cascade sans jet.
 */
function buildPostProgressionSteps(get: Get, set: Set): BuiltCascadeStep[] {
  const plan = get().travelPlan!;
  const sea = plan.sea!;
  const worldMap = get().worldMap as WorldMap;
  const route = worldMap?.routes.find((r) => r.id === plan.routeId);
  const out: BuiltCascadeStep[] = [];
  // 6. CRISE en cours (Poursuite ch.13 l.354 / Tourbillon l.514) : un Test d'équipage par JOUR. Aucun PJ
  // apte au poste = sous l'effectif minimal (MDG 14 l.55) → la manche se joue quand même au plancher de
  // Manque de bras (miroir de la Progression sans équipage `buildSeaDayCascade`) : une CRISE ne se drop
  // JAMAIS faute de titulaire, sinon elle reste posée sans jamais resurgir (soft-lock #383).
  if (sea.crisis) {
    const kind = sea.crisis.kind === 'poursuite' ? 'equipage-poursuite' : 'equipage-tourbillon';
    const testTypeId = sea.crisis.kind === 'poursuite' ? 'progression-poursuite' : 'manoeuvre';
    // Empêtré dans des Débris marins (MDG 13 l.487-489, #444) : pénalité de Man sur le Test de
    // Manœuvre tant que non dégagé.
    const entangleDR = findCrewTestTypeById(testTypeId)?.steering ? (sea.entangled?.manDR ?? 0) : 0;
    // Le Test d'Évasion d'un Tourbillon (MDG 13 l.514-537) traverse des eaux dangereuses (LDB 10 l.966).
    const st = buildVoyageCrewStep(get, testTypeId, kind, {
      ...(entangleDR ? { extraDR: entangleDR } : {}),
      ...(kind === 'equipage-tourbillon' ? { contexte: 'perilDesEaux' as const } : {}),
    });
    if (st) out.push(st);
    else resolveSeaCrisisRound(get, set, capToSuccesMinime(UNDERCREW_DR));
    // MDG 13 l.651
    if (findCrewTestTypeById(testTypeId)?.steering) pousseSi(out, reparationTemporaireDuNavire(get, get().travelPlan?.vehicle, st?.id ?? kind));
  }
  // EMPÊTRÉ dans des Débris marins (MDG 13 l.491, #444) : Test étendu de Force pour se dégager —
  // n'arrête PAS la Progression (contrairement à l'Échouage, `sea.stranded`).
  if (sea.entangled) {
    const st = buildStrandedOrEntangledStep(get, sea.entangled.difficulty, 'mer-degagement-debris', { stakeValues: { drCible: sea.entangled.need } });
    pousseSi(out, st);
  }
  // « ÇA VA LÂCHER, CAPITAINE ! » (MDG 13 l.121-142, #443) : la Progression du jour a dépassé M+4
  // (M de conception) → `mer-survitesse`.
  out.push(...buildOverspeedSteps(get));
  // SALISSURES (MDG 13 l.148, #1105) : le Test de la semaine.
  pousseSi(out, buildFoulingStep(get));
  // MDG 13 l.651
  pousseSi(out, reparationTemporaireDuNavire(get, get().travelPlan?.vehicle, `jour-${sea.daysAtSea}`));
  // #212. Embuscade AUTHORÉE à ancrage déterministe : franchissement de l'ancrage ce jour → Test de
  // Perception PUIS abordage (applier `equipage-embuscade`, table `appliers`).
  if (route?.ambush?.scene.id && route.ambush.encounter && !sea.ambushFired) {
    const anchor = Math.max(0, Math.min(1, route.ambush.at ?? 0.5)) * plan.km;
    if (plan.kmDone + sea.milesToday >= anchor) {
      const st = buildVoyageCrewStep(get, 'perception', 'equipage-embuscade');
      if (st) out.push(st);
      else openAuthoredSeaAmbush(get, set, route, false); // aucun équipage pour tester → surpris directement
    }
  }
  // 4. Phare du port d'arrivée en vue (dernier jour de mer) → Test de Perception VISUEL (MDG 13 l.337).
  const dest = worldMap ? placeById(worldMap, plan.toPlaceId) : undefined;
  const lighthouse = dest?.port?.lighthouse;
  const milesLeft = plan.km - plan.kmDone - sea.milesToday;
  if (lighthouse && milesLeft <= 15 && lighthouseSpotDifficulty(Math.max(1, Math.round(milesLeft))) != null) {
    const st = buildVoyageCrewStep(get, 'perception', 'equipage-phare', { sense: 'vue' });
    pousseSi(out, st);
  }
  // 5. Orientation quotidienne (« un Test par jour de voyage », ch.13 l.311), + Carte marine (+DR, MDG 15 l.290).
  const chartDR = get().party.some((h) => h.items?.some((it) => it.trappingId === 'carte-marine'))
    ? Number(rule('mer-carte-orientation-dr')) : 0;
  const orientStep = buildVoyageCrewStep(get, 'orientation', 'equipage-orientation', chartDR ? { extraDR: chartDR } : {});
  pousseSi(out, orientStep);
  // 7. Infestation de la cale : Test étendu d'EXTERMINATION (MDG 14 l.98-104), à la difficulté de l'op `infestation`.
  const infestation = get().vessel?.infestation;
  if (infestation) {
    const st = buildVoyageCrewStep(get, infestation.crewTestType, 'equipage-extermination', { difficulty: infestation.difficulty });
    pousseSi(out, st);
  }
  // 9a. Coque endommagée → Test d'équipage d'ENTRETIEN (remplace le Métier à −2 DR, MDG 14 l.116-124), à la Difficulté
  //     de la réparation temporaire (règle maison `mer-reparation-temporaire-reparation-difficulte`, MDG 13 l.649).
  const hull = plan.vehicle!;
  if (hull.wounds.current < hull.wounds.max) {
    const st = buildVoyageCrewStep(get, 'entretien', 'equipage-entretien', { difficulty: rule('mer-reparation-temporaire-reparation-difficulte') as Difficulty });
    pousseSi(out, st);
  }
  return out;
}

/**
 * Construit la CASCADE du jour (#275 Ronde 2 cran 3) : tronc = Forcer le rythme (si demandé) → Affaler
 * (si vents violents) → Progression — l'applier `'equipage-progression'` (table `appliers`, cran 2a) INSÈRE les
 * étapes post-progression (`buildPostProgressionSteps`) une fois `sea.milesToday` connu. Aucun PJ apte
 * pour la Progression → applique la progression au plancher de Manque de bras (MDG 14 l.55) et bâtit
 * quand même les étapes qui n'en dépendent pas.
 */
function buildSeaDayCascade(get: Get, set: Set): { steps: BuiltCascadeStep[]; log: string[] } {
  const steps: BuiltCascadeStep[] = [];
  // Périls d'AUTEUR de la route (MÊME source que le terrestre) : une étape de MONDE par péril, EN TÊTE
  // du jour — leurs dés tombent donc avant tout autre dé de la journée, comme dans la boucle qu'elles
  // remplacent. Un péril qui interrompt TRONQUE la séquence (`stopSequence`) : les suivants ne tirent pas.
  const routeDuJour = (get().worldMap as WorldMap | undefined)?.routes.find((r) => r.id === get().travelPlan!.routeId);
  const toLabel = libelleOuAbsence(get().worldMap ? placeById(get().worldMap!, get().travelPlan!.toPlaceId) : undefined, 'lieu', get().travelPlan!.toPlaceId);
  if (routeDuJour) steps.push(...buildAuthorPerilSteps(routeDuJour, toLabel, SEA_PERIL_INTERRUPT));
  // Événement de bord (l.89) : APRÈS les périls d'auteur — les dés d'auteur du jour tombent devant lui.
  pousseSi(steps, buildSeaBoardEventStep(get));
  // ÉCHOUÉ (MDG 13 l.471-473, #444) : « il s'arrête net… ne peut plus bouger jusqu'à ce qu'il soit
  // dégagé » — AUCUNE Progression tant que le Test de Force n'a pas réussi ; le reste de la journée
  // (crise/embuscade/entretien…) continue quand même (miroir Encalminé/Affaler ci-dessous).
  const strandedSea = get().travelPlan!.sea!;
  if (strandedSea.stranded) {
    // MDG 13 l.473
    tell(get, set, [t('sv.stranded', { hazard: strandedSea.stranded.label })]);
    patchSea(get, set, { milesToday: 0 });
    const st = buildStrandedOrEntangledStep(get, 'intermediaire', 'mer-degagement', { penalite: seaStrandingPenalty(get) });
    pousseSi(steps, st);
    steps.push(...buildPostProgressionSteps(get, set));
    return { steps, log: [] };
  }
  // 2. Vents « Affaler les voiles » (ch.13 l.288) : posé AVANT le jet (le d100 ne décide QUE d'un
  // Critique au gréement, jamais du fait que les voiles soient affalées ce jour — RAW).
  const eff = effectiveSeaM(get);
  if (eff.sail && eff.m === null && eff.affaler) {
    patchSea(get, set, { sailsDown: true });
    const st = buildVoyageCrewStep(get, 'affaler', 'equipage-affaler');
    pousseSi(steps, st);
  }
  // 3. Progression du jour : MDG 14 l.61-65 ; MDG 15 l.78. Encalminé : MDG 13 l.296-298. Voiles
  // affalées : MDG 13 l.294.
  const plan = get().travelPlan!;
  const sea = plan.sea!;
  const effAfterAffaler = effectiveSeaM(get);
  if (sea.sailsDown || effAfterAffaler.m === null) {
    const anchored = shipHasNavalTrait(hullNavalTraits(plan.vehicle!), 'ancre');
    if (!sea.sailsDown) {
      const drift = anchored ? 0 : Math.round(seaMilesPerDay(M_DU_COURANT, true));
      tell(get, set, [t('sv.becalmedLine', { suite: anchored ? t('sv.fragAnchorDown') : t('sv.fragDrift', { drift }) })]);
      patchSea(get, set, { milesToday: 0 });
    } else {
      // MDG 13 l.294 ; l.262-270.
      const windDrift = anchored ? 0 : Math.round(seaMilesPerDay(mDeCroisiere(navireDeLaCoque(plan.vehicle!)), true) * (AFFALER_RULES.driftPctOfSpeed / 100));
      const sens = DRIFT_ALONG_ROUTE[windAspect(sea.heading, sea.windFrom)];
      const credited = Math.max(-plan.kmDone, sens * windDrift);
      tell(get, set, [t('sv.sailsDownLine', { suite: anchored ? t('sv.fragAnchorWait') : t('sv.fragWindPush', { drift: windDrift, effet: t(DRIFT_EFFECT_KEY[sens], { miles: Math.abs(credited) }) }) })]);
      patchSea(get, set, { milesToday: credited });
    }
    steps.push(...buildPostProgressionSteps(get, set));
    return { steps, log: [] };
  }
  // FORCER LE RYTHME (MDG 13 l.95-107) : AVANT la Progression — « pour bénéficier du bonus de
  // Mouvement, un Test de Voile ou de Ramer doit être réussi ».
  const paceStep = buildForcePaceStep(get, set);
  if (paceStep) steps.push(paceStep);
  // L'applier `'equipage-progression'` insère le reste de la journée une fois la Progression posée.
  const choiceStep = buildProgressionChoiceStep(get);
  const progStep = choiceStep ?? buildVoyageCrewStep(get, 'progression', 'equipage-progression');
  if (progStep) steps.push(progStep);
  else {
    // Aucun PJ apte (LDB 16, État Inconscient) = sous l'effectif minimal : Progression au plancher de
    // Manque de bras (MDG 14 l.55).
    tell(get, set, applySeaProgress(get, set, capToSuccesMinime(UNDERCREW_DR)));
    steps.push(...buildPostProgressionSteps(get, set));
  }
  return { steps, log: [] };
}

/** M du courant qui tire un navire encalminé. MDG 13 l.298. */
const M_DU_COURANT = 1;
/** Sens de la dérive sous le vent le long du trajet, par vent relatif (MDG 13 l.262-270, l.294). */
const DRIFT_ALONG_ROUTE: Record<WindAspect, -1 | 0 | 1> = { arriere: 1, lateral: 0, face: -1 };
const DRIFT_EFFECT_KEY = { 1: 'sv.driftAhead', 0: 'sv.driftAbeam', [-1]: 'sv.driftBack' } as const;

/** Journée de PURE ROUTINE, seule résolue d'un bloc sous ordres (`jouerLaJournee` commandée) : ni crise, ni
 *  infestation. #275 */
function seaDayAllRoutine(get: Get): boolean {
  const sea = get().travelPlan!.sea!;
  return !sea.crisis && !get().vessel?.infestation;
}

/** PV structuré (couche `voyageCadence` — « aucun jet silencieux ») : une entrée de JET par contributeur
 *  d'une étape À PARTICIPANTS déjà résolue (`runCascadeImmediate`, route COMMANDÉE) — rendue par
 *  `MultiRollList` sur l'écran de traversée. Étapes MONO (Forcer le rythme…) : `[]` (leur ligne va au
 *  journal via `tell()`, comme avant). */
function dayEntriesFromStep(get: Get, step: CascadeStep): NightEntry[] {
  if (!step.participants) return [];
  const pool = get().party;
  return step.participants.flatMap((part, i) => {
    const actor = pool.find((c) => c.id === part.id);
    const res = part.result;
    if (!actor || !res) return [];
    return [voyageDayEntry({
      id: `mer-${step.kind}-${get().travelPlan?.sea?.daysAtSea ?? 0}-${part.id}-${i}`,
      actorId: part.id, icon: 'voyage/ancre', group: step.label,
      // L'ENJEU est celui de l'ÉTAPE (#1117 L1b) : recopié tel quel, rendu UNE fois par bande.
      ...(step.stake ? { stake: step.stake } : {}),
      label: `${(part.roleId ? findCrewRoleById(part.roleId)?.label : undefined) ?? part.label ?? actor.label}${part.essential ? ' ★' : ''}`,
      // Z5 : la ligne NOMME la COMPÉTENCE lancée (couture id→label du catalogue) ; le RÔLE tenu est
      // la provenance, porté par le libellé d'entrée. La Difficulté posée à la construction voyage
      // avec la ligne (#1112) au lieu d'être jetée. Une ligne non tentable n'a pas de dé : son refus.
      ...(estJete(res) ? { d: {
        label: part.skill ? refLabel('skills', part.skill) : (part.label ?? actor.label),
        base: part.base, modifier: res.target - part.base, target: res.target, roll: res.roll, success: res.success, sl: res.sl,
        ...(part.difficulty ? { difficulty: part.difficulty } : {}),
      } } : { text: part.refus }),
      tone: res.success ? 'reussite' : 'echec',
    })];
  });
}

/** Pousse les entrées de PV des étapes RÉSOLUES (route COMMANDÉE, `jouerLaJournee`) dans
 *  `sea.entries` (accumulateur du jour, vidé par `continueSeaDayAfterCascade`). */
function pushDayEntries(get: Get, set: Set, resolved: CascadeStep[]): void {
  const entries = resolved.flatMap((s) => dayEntriesFromStep(get, s));
  if (entries.length) patchSea(get, set, { entries: [...(get().travelPlan?.sea?.entries ?? []), ...entries] });
  // « Aucun jet silencieux » (voyageCadence.ts) : un RÉSUMÉ DR par Test d'équipage AUTO-RÉSOLU, au
  // journal du jour.
  for (const s of resolved) {
    if (!s.participants || !s.result) continue;
    const total = s.result.sl;
    // MDG 14 l.13
    tell(get, set, [t('sv.crewTestSummary', { label: String(s.label), dr: total >= 0 ? `+${total}` : total, issue: crewTestSuccess(total) ? t('sv.success') : t('sv.failure') })]);
  }
}

/** La météo d'un jour en mer (MDG 13 l.164, l.250, l.272) sous les météos imposées au navire (op
 *  `meteoImposee`), dans leur ordre de pose : leurs axes remplacent ceux du tirage, les vents dominants
 *  soufflent à l'opposé (`ventInverse`), et l'aggravation tire son dé ce matin-là. `ventDeLaVeille` absent =
 *  premier jour, sans cran de vent. MDG 15 l.189, l.196-197, l.199, l.219, l.226-227, l.248, l.257 */
function meteoDuJour(get: Get, coque: Combatant, ventDeLaVeille: SeaWeather['vent'] | undefined, rng: RNG): { weather: SeaWeather; windFrom: WindDirection } {
  const verrous = meteosActives(get().vessel?.meteosImposees, get().gameTime);
  let weather = rollSeaWeather(seasonOfMonth(toDate(get().gameTime).month), rng);
  if (ventDeLaVeille) weather = { ...weather, vent: tickWindForceDay(ventDeLaVeille, rng) };
  const windFrom = rollWindDirection(rng, verrous.some((v) => v.ventInverse) ? directionOpposee(VENT_DOMINANT) : VENT_DOMINANT);
  for (const v of verrous) {
    if (v.meteo) weather = { ...weather, ...v.meteo };
    if (v.aggravation && resolveFormula(v.aggravation.de, coque, rng) >= v.aggravation.seuil) weather = { ...weather, ...v.aggravation.meteo };
  }
  return { weather, windFrom };
}

/** Construit le TravelPlan d'une TRAVERSÉE (route `sea`) sur le navire de campagne — `null` si aucun
 *  navire ; une coque à 0 Blessure navigue (MDG 13 l.656, l.674). La coque de trajet repart des Blessures PERSISTÉES (#30). */
export function buildSeaPlan(
  get: Get, routeId: string, fromPlaceId: string, toPlaceId: string,
  route: { km: number; seaHeading?: WindDirection },
  opts: { pace?: number; cadence?: VoyageCadence } = {},
): TravelPlan | null {
  const ship = voyageShip(get);
  if (!ship || refusDAppareiller(ship.vessel)) return null;
  const heading = route.seaHeading;
  if (!heading) throw new Error(`buildSeaPlan: route mer sans seaHeading — cap requis, jamais de défaut silencieux (#416, pit #408)`);
  const rng = battleRng();
  // ORDRES permanents (couche `voyageCadence`) : `DEFAULT_VOYAGE_ORDERS` faute de cadence passée ;
  // l'écran de départ passe COMMANDÉE (son défaut d'affichage) hors traversée rapide.
  const orders: VoyageOrders = { cadence: opts.cadence ?? DEFAULT_VOYAGE_ORDERS.cadence };
  return {
    routeId, fromPlaceId, toPlaceId, mode: 'mer', hoursPerDay: 24, km: route.km, kmDone: 0, interrupted: false,
    orders,
    vehicle: ship.hull,
    sea: {
      heading,
      ...meteoDuJour(get, ship.hull, undefined, rng), // graine du 1ᵉʳ jour (le cran de vent quotidien s'y accroche)
      daysToEvent: rollDaysToNextEvent(rng), // « Tous les 1d10 jours » (ch.15 l.89)
      daysAtSea: 0, lines: [], milesToday: 0, hullAtDayStart: ship.hull.wounds.current,
      ...(opts.pace ? { forcePace: opts.pace } : {}), // Forcer le rythme (MDG 13 l.95-107)
    },
  };
}

// ── LONGS VOYAGES TRÈS RAPIDES (MDG 15 l.21-37) ──────────────────────────────────────────────────

/** Voguer de nuit, porté par la règle maison `mer-voguer-de-nuit` faute d'équipage de campagne
 *  modélisé (#340). MDG 15 l.76 ; MDG 14 l.39. */
function voguerDeNuit(): boolean {
  return rule('mer-voguer-de-nuit') === true;
}

/** Milles d'un jour de CROISIÈRE au M `m` (hors vent, événement et Test de Progression). MDG 15
 *  l.57-70, l.76. Source unique de la carte du monde et du noyau (#3059). */
export function millesDeCroisiere(m: number): number {
  return seaMilesPerDay(m, voguerDeNuit());
}

/** Jours de mer pour couvrir `milles` au M de croisière `m`. MDG 15 l.25. */
export function joursDeMer(milles: number, m: number): number {
  return Math.ceil(Math.max(0, milles) / millesDeCroisiere(m));
}

/** Durée d'une traversée de `km` milles au M de croisière `m` : un jour au moins. MDG 15 l.25. */
export function dureeDeTraversee(km: number, m: number): number {
  return Math.max(1, joursDeMer(km, m));
}

/** Le Moral d'un Test d'équipage RÉSOLU : un type de Test dont le total négatif coûte du Moral (`moraleOnNegativeDR`,
 *  la Rude épreuve) le retire au navire de campagne, où que le Test se joue (traversée rapide, nœud de Flow).
 *  MDG 14 l.110 */
function moralDuTestDEquipage(get: Get, set: Set, step: CascadeStep): void {
  const ship = get().travelPlan?.vehicle;
  const type = typeof step.meta?.crewTestType === 'string' ? findCrewTestTypeById(step.meta.crewTestType) : undefined;
  if (!ship || !step.result || !type?.moraleOnNegativeDR) return;
  const j = applyShipMoraleDelta(get, set, ship, rudeEpreuveMoraleDelta(step.result.sl));
  if (j.length) noteSeaLine(get, set, j);
}

/** Le Test d'équipage de la traversée rapide : la Rude épreuve (MDG 15 l.27). */
const TEST_DU_VOYAGE_RAPIDE = 'rude-epreuve';

/** Appareille en TRAVERSÉE RAPIDE (l.21-37) : construit un plan `sea.fast` (jamais la boucle jour par
 *  jour), estime la durée (distance / vitesse moyenne, l.25) puis ouvre l'UNIQUE Test d'équipage de
 *  Rude épreuve (modale existante). Sans équipage apte : palier au DR 0, résolution immédiate. `false`
 *  = aucun navire en état (l'appelant journalise). */
export function startFastVoyage(
  get: Get, set: Set, routeId: string, fromPlaceId: string, toPlaceId: string,
  route: { km: number; seaHeading?: WindDirection }, opts: { pace?: number; cadence?: VoyageCadence } = {},
): boolean {
  const plan = buildSeaPlan(get, routeId, fromPlaceId, toPlaceId, route, opts);
  if (!plan) return false;
  const days = dureeDeTraversee(plan.km, mDeCroisiere(navireDeLaCoque(plan.vehicle!)));
  const weeks = Math.floor(days / SEA_WEEK_DAYS); // « par semaine passée en mer » (l.28)
  set({ travelPlan: { ...plan, sea: { ...plan.sea!, fast: { days, weeks } } }, worldMapOpen: false, travelRecap: null });
  const to = get().worldMap ? placeById(get().worldMap!, toPlaceId) : undefined;
  log(get, set, [t('sv.departFast', { ship: plan.vehicle!.label, to: libelleOuAbsence(to, 'lieu', toPlaceId), days, km: plan.km })]);
  const st = buildVoyageCrewStep(get, TEST_DU_VOYAGE_RAPIDE, 'equipage-voyage-rapide');
  if (st) { startCascade(get, set, { title: t('sv.fastTitle'), icon: 'voyage/vague', purpose: 'test', steps: [st] }); return true; }
  computeFastPalier(get, set, 0); // aucun équipage apte au Test → DR 0
  finalizeFastVoyage(get, set);
  return true;
}

/** Calcule le palier du voyage rapide (`resolveFastVoyage`) depuis le DR de Rude épreuve + l'Humeur de
 *  Manann + les semaines en mer et le PERSISTE sur `sea.fast` — jamais raconté ici : une embuscade ANCRÉE
 *  peut interrompre AVANT que le palier ne s'applique (#212), et narrer « Voyage désastreux » pendant que
 *  l'écran de combat dément les pertes ment au joueur sur le timing. La narration part avec l'application
 *  réelle, dans `finalizeFastVoyage`. */
function computeFastPalier(get: Get, set: Set, crewDR: number): void {
  const fast = get().travelPlan?.sea?.fast;
  if (!fast) return;
  const mood = vesselManann(get().vessel);
  const { roll, manannTens, result, palier } = resolveFastVoyage(crewDR, mood.score, fast.weeks, battleRng());
  patchSea(get, set, { fast: { ...fast, palierId: palier.id, roll, result, crewDR, manannTens, pendingFinalize: true } });
}

/** Achève une traversée rapide (RÉ-ENTRANT) : une embuscade ANCRÉE (#212) non déclenchée INTERROMPT
 *  d'abord (le reste s'achève en rapide APRÈS le combat, la cascade `'equipage-voyage-rapide'` s'étant SUSPENDUE
 *  — resumée au teardown de combat, `resumeSuspendedCascade`) ; sinon
 *  RACONTE puis applique le palier (MÊME geste — jamais avant, cf. `computeFastPalier`), avance de N
 *  jours (couture unique `avancerLeTemps` → faim/soif/maladies/paie d'équipage), consomme l'eau des
 *  tonneaux (comme le détaillé) et accoste (`openPortAt`). */
function finalizeFastVoyage(get: Get, set: Set): void {
  const plan = get().travelPlan;
  const fast = plan?.sea?.fast;
  if (!plan?.sea || !fast?.pendingFinalize) return;
  // Embuscade ANCRÉE non déclenchée : le rythme forcé du voyage rapide court-circuite la vigie —
  // l'abordage surgit à son ancrage et SURPREND le navire (pas de Test de Perception jour par jour).
  const route = (get().worldMap as WorldMap | undefined)?.routes.find((r) => r.id === plan.routeId);
  if (!plan.sea.ambushFired && route?.ambush?.scene.id && route.ambush.encounter) {
    tell(get, set, [t('sv.fastBroken')]);
    openAuthoredSeaAmbush(get, set, route, false); // reprise post-combat → ce finalize s'exécute à nouveau (ambushFired le saute)
    return;
  }
  const palier = FAST_VOYAGE_PALIERS.find((p) => p.id === fast.palierId);
  if (palier) {
    const crewDR = fast.crewDR ?? 0;
    const manannTens = fast.manannTens ?? 0;
    tell(get, set, [
      t('sv.fastResult', { die: formatDice(deDuVoyageRapide()), roll: String(fast.roll), weeks: fast.weeks, crewDR: `${crewDR >= 0 ? '+' : ''}${crewDR}`, manann: `${manannTens >= 0 ? '+' : ''}${manannTens}`, result: String(fast.result), palier: palier.label }),
      palier.desc,
    ]);
    if (palier.consequence) jouerFlowEntier(runFlow(get, set, palier.consequence, palier.label));
  }
  patchSea(get, set, { fast: { ...fast, pendingFinalize: false } });
  // Eau douce des tonneaux (MDG 14 l.242) : POPULATION EMBARQUÉE (héros + effectif PNJ, `shipboardSouls`)
  // × régime médian × jours — MÊME couture que le détaillé (`continueSeaDayAfterCascade`), le voyage
  // rapide ne tirant pas la Température jour par jour.
  const vessel = get().vessel;
  const patch: Partial<CampaignVessel> = { lastVoyageMilles: plan.km };
  if (vessel?.waterLitres != null) {
    const souls = shipboardSouls(get()).total;
    patch.waterLitres = Math.max(0, vessel.waterLitres - souls * dailyWaterLitres('mediane') * fast.days);
  }
  if (vessel) set({ vessel: { ...vessel, ...patch } });
  // Vivres de l'équipage PNJ sur toute la traversée rapide (MÊME couture que le détaillé).
  log(get, set, consumeCrewProvisions(get, set, fast.days));
  const to = get().worldMap ? placeById(get().worldMap!, plan.toPlaceId) : undefined;
  set({ travelPlan: null });
  // Jours écoulés : franchissement par la couture UNIQUE `avancerLeTemps` (entretien quotidien : faim/soif,
  // maladies, convalescence, paie hebdomadaire de l'équipage) — l'eau vient d'être décrémentée.
  get().avancerLeTemps(fast.days * MINUTES_PER_DAY);
  log(get, set, [t('sv.arriveFast', { to: libelleOuAbsence(to, 'lieu', plan.toPlaceId), days: fast.days })]);
  if (to) openPortAt(get, set, to);
}

// ── Boucle jour par jour (#275 Ronde 2 cran 3 — pipeline cascade) ───────────────────────────────

/** Événement de bord tous les 1d10 jours (ch.15 l.89) — résolu AVANT la cascade du jour (ne dépend
 *  d'aucune Progression). La `consequence` d'un événement (Test, Test d'équipage,
 *  choix : `runFlow`) peut SURFACER leur propre mini-cascade (`purpose:'test'`) — renvoie `true` si
 *  c'est le cas ; sa clôture reprend `runSeaDay` par la couture canonique `dispatchCascadeDone`. */
function resolveSeaDayEvent(get: Get, set: Set): boolean {
  const plan = get().travelPlan!;
  const sea = plan.sea!;
  // Recette (#332) : événement NOMMÉ forcé (`forceEncounter`) — court-circuite le timer + le tirage.
  if (sea.forcedEventId) {
    const forced = seaBoardEventById(sea.forcedEventId);
    patchSea(get, set, { forcedEventId: undefined });
    if (forced) {
      // Hors cascade (recette `forceEncounter`) : personne ne journalise pour nous — la ligne rendue
      // par `resolveBoardEvent` s'écrit ICI, une fois.
      log(get, set, [resolveBoardEvent(get, set, forced)]);
      return !!get().pendingCascade;
    }
  }
  const days = sea.daysToEvent - 1;
  // Jour antérieur à celui de l'événement : rien à tirer, le compteur avance et c'est tout.
  if (days > 0) { patchSea(get, set, { daysToEvent: days }); return false; }
  // Jour d'événement : le tirage est un dé de MONDE, donc une ÉTAPE (`buildSeaBoardEventStep`,
  // poussée dans la cascade du jour juste après les périls d'auteur — l'ordre RAW). Le compteur, lui,
  // n'avance qu'à la résolution : c'est l'applier qui tire le délai suivant, à la MÊME position RNG.
  return false;
}

/** L'ÉVÉNEMENT DE BORD du jour (MDG 15 l.89) quand le compteur y arrive — une étape à TABLE de monde,
 *  dont le `mod` est l'Humeur de Manann (elle DÉCALE le dé, l.85 : c'est bien un modificateur, pas une
 *  autre table). `undefined` les autres jours. */
function buildSeaBoardEventStep(get: Get): BuiltCascadeStep | undefined {
  const sea = get().travelPlan?.sea;
  if (!sea || sea.daysToEvent - 1 > 0) return undefined;
  const mood = vesselManann(get().vessel);
  return tableStep({
    id: SEA_BOARD_EVENT_STEP_ID, kind: SEA_BOARD_EVENT_KIND, worldOwner: true, icon: 'voyage/vague',
    label: t('step.seaBoardEvent'),
    table: { tableId: SEA_BOARD_EVENT_TABLE, ...(mood.score ? { mod: mood.score } : {}) },
    stake: voyageStakeRef(SEA_BOARD_EVENT_KIND),
  });
}

const SEA_BOARD_EVENT_KIND = 'mer-evenement-de-bord';
const SEA_BOARD_EVENT_STEP_ID = 'mer-evenement-de-bord';
export const SEA_BOARD_EVENT_TABLE = 'evenements-de-bord';

// Table DÉRIVÉE du catalogue (`sea-events.json` : chaque entrée porte déjà `min`/`max`/`id`) — aucune
// plage réécrite à la main ; FAMILLE (`famillesTirables`) mémoïsée sur `seaBoardEvents`.
const tableDesEvenementsDeBord = memoParVersion('seaBoardEvents', () => new Map<string, TableStepDef>([[SEA_BOARD_EVENT_TABLE, {
  label: t('step.seaBoardEvent'),
  die: deDesEvenementsDeBord(),
  rows: evenementsDeBord().map((e) => ({ id: e.id, min: e.min, max: e.max })),
  lines: (die) => [t('sv.boardEventLine', { label: findTableEntry(evenementsDeBord(), die).label })],
}]]));

/** Une JOURNÉE de voyage est en vol : sa séquence `purpose:'travelDay'` tient le slot ou attend en pile
 *  (`pendingCascade`/`suspendedCascades`, noyau/cascade.ts). */
const journeeEnVol = (s: Jeu): boolean => [s.pendingCascade, ...s.suspendedCascades].some((c) => c?.purpose === 'travelDay');

/**
 * Boucle maritime — appelée par `runTravelDays`/`reprendreLeVoyage` (plan `sea`) et la reprise de nuit.
 * UN JOUR = périls d'auteur (inline) → événement de bord (inline, peut surfacer) → la CASCADE du jour
 * (`buildSeaDayCascade`, purpose `travelDay`) → `continueSeaDayAfterCascade` à sa clôture (dénouement
 * du jour + halte/arrivée). La cascade EST le point de reprise (`pendingCascade`/`suspendedCascades`,
 * noyau/cascade.ts).
 */
export function runSeaDay(get: Get, set: Set): void {
  const plan = get().travelPlan;
  // Une cascade est déjà active, ou une journée est en vol (parquée en pile derrière un combat ou une
  // séquence qu'un de ses appliers a ouverte) : l'arbitre la montre, sa clôture la reprend, rien à faire —
  // `reprendreLeVoyage` (couture d'événement) ne ré-entre dans AUCUNE FSM (#275 Ronde 2 cran 3, Décision c ; #4006).
  if (!plan?.sea || plan.interrupted || get().pendingSteamSave || get().pendingCascade || journeeEnVol(get())) return;
  const sea = plan.sea;
  // VOYAGE RAPIDE (MDG 15 l.21-37) : ce plan ne déroule JAMAIS la journée par étape — le palier
  // calculé s'applique en un bloc (`finalizeFastVoyage`, ré-entrant après un abordage ancré).
  if (sea.fast) { if (sea.fast.pendingFinalize) finalizeFastVoyage(get, set); return; }
  // Météo du jour (ch.13 l.164) : déjà TIRÉE (à l'ouverture pour le 1ᵉʳ jour, `buildSeaPlan` — sinon à
  // la CLÔTURE du jour précédent, `continueSeaDayAfterCascade` — décision 1 #275 Ronde 2 cran 3, aligné
  // sur le fluvial `tickRiverWindDay`/`finishRiverDay`) — cette ligne l'ANNONCE seulement.
  tell(get, set, [t('sv.weatherOfDay', { weather: seaWeatherLabel(sea.weather), from: sea.windFrom, heading: sea.heading })]);
  if (resolveSeaDayEvent(get, set)) return;
  const { steps, log: lines } = buildSeaDayCascade(get, set);
  for (const l of lines) log(get, set, [l]);
  jouerLesEtapesDuJour(get, set, steps);
}

/** Joue les étapes du jour qu'un build vient de rendre (`buildSeaDayCascade`, ou le reste du jour
 *  `buildPostProgressionSteps`) — UNE décision immédiat/interactif pour les deux entrées du jour. */
function jouerLesEtapesDuJour(get: Get, set: Set, steps: BuiltCascadeStep[]): void {
  // La construction du jour a pu ouvrir un ABORDAGE en plein vol (crise « caught » / embuscade ancrée
  // sans équipage à tester → `startChaseBoarding`/`openAuthoredSeaAmbush` posent `interrupted` + combat) :
  // la traversée s'arrête là (reprise par `reprendreLeVoyage` après le combat), jamais de fin-de-jour en plein combat.
  if (get().battle || get().travelPlan?.interrupted) return;
  // Journée sans jet : finalisée comme la cascade le ferait à sa clôture, défaite hors combat comprise.
  if (!steps.length) { if (!checkPartyWiped(get, set)) continueSeaDayAfterCascade(get, set); return; }
  // Traversée sous ordres (`voyageCadence.traverseeCommandee`) d'une journée de PURE routine (#275 Ronde 2
  // cran 3) : aucun arrêt. Un combat ouvert EN PLEIN VOL (embuscade ancrée) parque la journée derrière lui :
  // sa reprise et son dénouement (`dispatchCascadeDone`) jouent la clôture. `rowSurface: 'pv'` : les rangées
  // des bandes du jour se montrent au PROCÈS-VERBAL (`pushDayEntries` à la clôture) — le journal ne redit pas
  // leurs dés (#1291). Les monos du tableau y gardent leur ligne.
  const commandee = traverseeCommandee(get()) && seaDayAllRoutine(get);
  jouerLaJournee(get, set, steps, { title: t('sv.dayTitle'), purpose: 'travelDay', ...(commandee ? { rowSurface: 'pv' as const } : {}) }, commandee);
}

// ── Seam de jet (#275 Ronde 1) — appliers des sites de jet ouverts par `openRoll` ────────────────

/** Acteur et soutiens d'un jet de Voile ou de Ramer (MDG 13 l.22-24, l.111). */
function manieursDe(best: { actor: Combatant; support: SupportDetail }): string[] {
  return [best.actor.id, ...best.support.ids];
}

/** Persiste les `manieurs` d'une étape jouée dans `sea.manieursToday` (MDG 13 l.111). */
function noteManieurs(get: Get, set: Set, step: CascadeStep): void {
  const ids = step.meta?.manieurs;
  if (!ids?.length) return;
  patchSea(get, set, { manieursToday: [...new Set([...(get().travelPlan?.sea?.manieursToday ?? []), ...ids])] });
}

/** Applique les MILLES du jour depuis le total du Test de Progression (±10 %/DR, ch.15 l.78). Renvoie
 *  la ligne d'annonce (le call-site décide du canal — `tell()` build-time ou `consequences` d'applier). */
function applySeaProgress(get: Get, set: Set, progressionDR: number): string[] {
  const plan = get().travelPlan!;
  const eff = effectiveSeaM(get);
  if (eff.m == null || plan.sea!.sailsDown) { patchSea(get, set, { milesToday: 0 }); return []; }
  const miles = Math.round(seaMilesPerDay(eff.m, voguerDeNuit(), progressionDR));
  // `effMToday` PERSISTE le M effectif qui a servi à CETTE Progression, pour que le Test de survitesse (#443)
  // le lise sans le recalculer après coup.
  patchSea(get, set, { milesToday: miles, effMToday: eff.m, modeToday: eff.mode ?? undefined });
  return [t('sv.progressOfDay', { miles, dr: `${progressionDR >= 0 ? '+' : ''}${progressionDR}` })];
}

/** Étapes du tonneau d'eau contaminé (MDG 14 l.209) — DEUX volets INDÉPENDANTS, dans CET ordre : (a)
 *  EXPOSITION de qui boit AUJOURD'HUI à un tonneau contaminé la veille (`sea.waterContaminated`, jamais
 *  le jour même — « pour quiconque y boit ENSUITE ») ; (b) Test de Résistance Intermédiaire (+0) de
 *  chaque porteur ACTIF d'une maladie qui DÉCLARE `contaminatesWaterBarrel` (`maladies.json`) et boit au
 *  tonneau aujourd'hui → échec CONTAMINE le tonneau (effet visible dès demain). Ne lit QUE
 *  `vessel.waterLitres` — la petite bière
 *  (`tonneau-de-petite-biere`) y échappe (l.209), jamais lue ici. */
function buildBarrelSteps(get: Get, sea: SeaVoyageState, vessel: CampaignVessel | null): BuiltCascadeStep[] {
  if (vessel?.waterLitres == null) return [];
  const out: BuiltCascadeStep[] = [];
  const test: RollRequest['test'] = { skill: { id: 'resistance' }, characteristic: 'endurance' };
  if (sea.waterContaminated) {
    const diseaseId = sea.waterContaminated.diseaseId;
    const diff: Difficulty = diseaseDefs()[diseaseId]?.contractDifficulty ?? DIFFICULTE_PAR_DEFAUT;
    for (const h of get().party.filter((c) => !c.dead && contractionDue(c, diseaseId))) {
      pousseSi(out, monoStep({
        id: `mer-tonneau-expose-${h.id}`, kind: 'mer-tonneau-expose', actor: h,
        label: composeRollLabel(h, t('sv.waterBarrelTainted'), test), difficulty: diff,
        rollLabel: refLabel('skills', { id: 'resistance' }),
        ligne: { test: { skill: { id: 'resistance' }, characteristic: 'endurance' } },
        stake: voyageStakeRef('mer-tonneau-expose', { disease: diseaseLabel(diseaseId) }), meta: { diseaseId },
      }));
    }
  } else {
    for (const h of get().party) {
      if (h.dead) continue;
      const dz = (h.diseases ?? []).find((d) => maladieDeclaree(d) && diseaseDefs()[d.id]?.contaminatesWaterBarrel);
      if (!dz) continue;
      pousseSi(out, monoStep({
        id: `mer-tonneau-contamine-${h.id}`, kind: 'mer-tonneau-contamine', actor: h,
        label: composeRollLabel(h, t('sv.waterBarrel'), test), difficulty: 'intermediaire',
        rollLabel: refLabel('skills', { id: 'resistance' }),
        ligne: { test: { skill: { id: 'resistance' }, characteristic: 'endurance' } },
        stake: voyageStakeRef('mer-tonneau-contamine', { disease: diseaseLabel(dz.id) }), meta: { diseaseId: dz.id },
      }));
    }
  }
  return out;
}

/** Immunité elfe au mal de mer (MDG 14 l.215) : groupe `elfe` de l'espèce (`grantGroups`). */
const isElfSpecies = (species: string | undefined): boolean => groupsFor({ speciesId: species }).includes('elfe');

/** Mal de mer (MDG 14 l.211-222) — DEUX déclencheurs INDÉPENDANTS, cumulables le même jour : premier
 *  jour de CETTE traversée (`daysAtSea === 0` — proxy : le moteur ne porte aucun état par-personnage
 *  « a déjà navigué », le RAW parle de « la première fois qu'ils entreprennent un voyage en mer ») et
 *  mauvais temps (Vent violent ou plus, l.218, `windForces`). Les Personnages elfes sont IMMUNISÉS
 *  (l.215) : jamais testés, aucune étape posée. */
function buildSeasicknessSteps(get: Get, sea: SeaVoyageState): BuiltCascadeStep[] {
  const firstDay = sea.daysAtSea === 0;
  const forces = windForces();
  const badWeather = forces.indexOf(sea.weather.vent) >= forces.indexOf('vent-violent');
  if (!firstDay && !badWeather) return [];
  const appeles = get().party.filter((h) => !h.dead && !isElfSpecies(h.species) && contractionDue(h, 'mal-de-mer'));
  if (!appeles.length) return [];
  // UNE SITUATION = UNE FENÊTRE : chaque déclencheur est UNE bande dont les Personnages appelés sont
  // les RANGÉES (jets indépendants), jamais N étapes MONO qui défilent pour le MÊME Test.
  const bande = (id: string, label: PlayerText, difficulty: Difficulty): BuiltCascadeStep | undefined => buildBand(get, {
    id, kind: 'mer-mal-de-mer', label,
    stake: voyageStakeRef('mer-mal-de-mer', { disease: diseaseLabel('mal-de-mer') }),
    difficulty,
    porteurs: appeles.map((h) => ({ actor: h, ligne: { test: { skill: { id: 'resistance' }, characteristic: 'endurance' } } })),
  });
  const out: BuiltCascadeStep[] = [];
  if (firstDay) pousseSi(out, bande('mer-mal-de-mer-premier', t('sv.seasickFirst'), 'complexe'));
  if (badWeather) pousseSi(out, bande('mer-mal-de-mer-tempete', t('sv.seasickStorm'), 'intermediaire'));
  return out;
}

/**
 * SCORBUT (MDG 14 l.230) — UNE bande dont les Personnages appelés sont les RANGÉES, comme le Mal de mer
 * ci-dessus : « pour chaque mois passé sans nourriture correcte », Test de Résistance Intermédiaire
 * (+0), Facile (+40) pour qui porte de la soupe de chou fermenté (`scurvyGuard`, difficulté de RANGÉE —
 * elle diverge d'un porteur à l'autre). Les rations de bord ne sont pas de la nourriture fraîche : le
 * mois EN MER compte.
 */
function buildScurvySteps(get: Get, daysAtSea: number): BuiltCascadeStep[] {
  if (daysAtSea % 30 !== 0) return [];
  const appeles = get().party.filter((h) => !h.dead && !(h.diseases ?? []).some((d) => d.id === 'scorbut'));
  if (!appeles.length) return [];
  const bande = buildBand(get, {
    id: 'mer-scorbut', kind: 'mer-scorbut', label: t('sv.scurvy'),
    stake: voyageStakeRef('mer-scorbut', { disease: diseaseLabel('scorbut') }),
    difficulty: 'intermediaire',
    porteurs: appeles.map((h) => {
      const soup = (h.items ?? []).some((it) => itemCapability(it, 'scurvyGuard'));
      return {
        actor: h, ligne: { test: { skill: { id: 'resistance' }, characteristic: 'endurance' } },
        ...(soup ? { difficulty: 'facile' as Difficulty } : {}),
        meta: { soup },
      };
    }),
  });
  return bande ? [bande] : [];
}

/** Lignes de conclusion d'une séquence RÉSOLUE D'OFFICE (aucune fenêtre ne les a montrées) : celles des
 *  étapes MONO et celles des RANGÉES de bandes — un seul dériveur pour les trois phases du jour. */
function lignesResolues(steps: readonly CascadeStep[]): string[] {
  return steps.flatMap((s) => [
    ...(s.outcome ?? []).map((l) => l.text),
    ...(s.participants ?? []).flatMap((p) => (p.outcome ?? []).map((l) => l.text)),
  ]);
}

/**
 * Clôture de la CASCADE du jour (#275 Ronde 2 cran 3, appelée par le store — `dispatchCascadeDone`
 * `purpose:'travelDay'`) — PHASE 1/3 de l'entretien-survie (#272 résiduel) : eau & rats, puis les
 * maladies embarquées (MDG 14 l.209-230 — Tonneau d'eau contaminé, Mal de mer, Scorbut).
 * Les Tests des maladies sont POUSSÉS INCONDITIONNELLEMENT par la porte (`openSequence`, #1479) : c'est
 * le socle qui dérive leur surface des PORTEURS déclarés (les héros qui les subissent) — fenêtre quand
 * un siège humain en tient un, résolution d'office sinon (ordres commandés, personne à la barre). Toute
 * ligne générée ICI passe par `tell()` (journal + `sea.lines`, durable) plutôt qu'un tableau local — une
 * cascade surfacée PAUSE l'exécution (reprise asynchrone par un clic), un accumulateur JS ne survivrait
 * pas la pause.
 * `auPv` : les étapes qu'un pilote immédiat a résolues sous `rowSurface: 'pv'` — en direct, ou à la
 * reprise d'une séquence parquée (`PendingCascade.piloteImmediat`) — versées au PV (`pushDayEntries`).
 */
export function continueSeaDayAfterCascade(get: Get, set: Set, auPv: CascadeStep[] = []): void {
  if (get().travelPlan?.sea) pushDayEntries(get, set, auPv);
  const plan = get().travelPlan;
  // Une « Fuite de vapeur » (MDG 12 l.326-328) suspend le jour depuis l'applier `equipage-progression` : sa
  // reprise est `resolveSteamSave`, quel que soit le pilote qui a clos le fragment.
  if (!plan?.sea || get().pendingSteamSave) return;
  const sea = plan.sea;

  // MDG 15 l.160-161, l.175-176
  const vesselDuSoir = get().vessel;
  const infestation = vesselDuSoir?.infestation;
  if (vesselDuSoir && infestation?.assaillie) {
    const { assaillie: _jouee, ...sansMarqueur } = infestation;
    set({ vessel: { ...vesselDuSoir, infestation: sansMarqueur } });
    if (infestation.surDRNegatif) jouerFlowEntier(runFlow(get, set, infestation.surDRNegatif, infestation.label));
  }
  if (infestation) jouerFlowEntier(runFlow(get, set, infestation.chaqueNuit, infestation.label));

  // Eau douce (ch.13 l.209-213 + ch.14 l.242) : consommation par bande de Température × POPULATION EMBARQUÉE
  // (héros + effectif PNJ nominal, `shipboardSouls` — MDG 14 l.238 : « l'équipage … a besoin de beaucoup
  // d'eau »), si le navire suit ses tonneaux (`vessel.waterLitres`). À sec, la Soif se joue à l'entretien
  // quotidien (`upkeep.ts`, `hasWater`), LDB 18 l.340.
  const vessel0 = get().vessel;
  if (vessel0?.waterLitres != null) {
    const souls = shipboardSouls(get()).total;
    const need = souls * dailyWaterLitres(sea.weather.temperature);
    const left = Math.max(0, vessel0.waterLitres - need);
    set({ vessel: { ...vessel0, waterLitres: left } });
    tell(get, set, [left > 0 ? t('sv.freshWater', { need, souls, left }) : t('sv.waterDry')]);
  }
  // Vivres de l'équipage PNJ (MDG 14 l.238/250) : l'effectif nominal mange sur les vivres de la cale.
  tell(get, set, consumeCrewProvisions(get, set, 1));

  // Maladies embarquées (MDG 14 l.209-230) : Tonneau d'eau contaminé (l.209, `buildBarrelSteps`) + Mal de
  // mer (l.211-222, `buildSeasicknessSteps`) + Scorbut (l.230, `buildScurvySteps`). Chaque règle porte
  // son `kind` VÉRIDIQUE — la surface de la journée se dérive des étapes elles-mêmes, plus d'un `kind`
  // de convenance qui en clé trois (#1479).
  const daysAtSea = sea.daysAtSea + 1;
  const diseaseSteps: BuiltCascadeStep[] = [...buildBarrelSteps(get, sea, vessel0), ...buildSeasicknessSteps(get, sea), ...buildScurvySteps(get, daysAtSea)];
  if (diseaseSteps.length) {
    const resolues = openSequence(get, set, { title: 'Entretien — Maladies', icon: 'medical/infection', purpose: 'seaScorbut', steps: diseaseSteps });
    if (!resolues) return; // fenêtre ouverte : clôture reprise par `dispatchCascadeDone` (`combatSlice.ts`) → `continueSeaDayAfterScorbut`
    noteSeaLine(get, set, lignesResolues(resolues));
  }
  continueSeaDayAfterScorbut(get, set);
}

/**
 * PHASE 2/3 (#272 résiduel) : horloge +24 h, Exposition (ch.13 l.203-225), puis Épuisement (ch.13 l.109-111) — même patron MJ-surfaçable que Scorbut (Phase 1). `doneSteps` : la
 * cascade Scorbut VIENT de se clôturer côté MJ (`dispatchCascadeDone`) → ses lignes de résultat (déjà
 * journalisées par `commitStep`) sont reversées dans `sea.lines` pour que le recap de la halte les porte
 * (parité avec le chemin inline, qui les `tell()` lui-même avant d'enchaîner). Absent en chaînage direct
 * (Scorbut résolu I) : déjà `tell()`'ées par `continueSeaDayAfterCascade`.
 */
export function continueSeaDayAfterScorbut(get: Get, set: Set, doneSteps?: CascadeStep[]): void {
  const plan = get().travelPlan;
  if (!plan?.sea) return;
  if (doneSteps) noteSeaLine(get, set, lignesResolues(doneSteps));
  const sea = plan.sea;

  // Horloge : à l'ARRIVÉE au port, la journée entière passe (+24 h) — l'entretien du jour est rattrapé
  // par le prochain `runDailyUpkeep` (garde `lastUpkeepDay`). Sinon (HALTE de nuit / activités en mer)
  // la traversée s'arrête au crépuscule et la nuit de sommeil enjambe minuit : UN SEUL franchissement de
  // jour par cycle jour+nuit (comme le voyage terrestre). L'ENTRETIEN (rations/faim, maladies,
  // convalescence) n'est jamais roulé ici (sinon la Faim s'installe avant le repas) : il se résout dans
  // la cascade de nuit (`buildNightCascade`), APRÈS `feedFromMeal`.
  const arrived = plan.km - Math.min(plan.km, plan.kmDone + sea.milesToday) < 1e-9;
  const dayMinutes = arrived ? 24 * 60 : minutesUntilNext(get().gameTime, duskMinute());
  get().avancerLHorloge(dayMinutes);

  // TEMPÉRATURE (MDG 13 l.203-225) : Tests d'Exposition du jour, `seaExposureTestsPerDay`. Froid : cascade
  // UNIQUE d'`engine/exposure` (MDG 14 l.277) ; chaleur : LDB 18 l.330. La dissipation des pénalités
  // subies suit l'application des échecs, à chaque jour de mer — `continueSeaDayAfterExposure`.
  const tdef = temperatureDef(sea.weather.temperature);
  const expCount = seaExposureTestsPerDay(sea.weather.temperature);
  if (tdef.exposure && expCount > 0) {
    const expDiff = tdef.difficulty ?? DIFFICULTE_PAR_DEFAUT;
    const pont = activeSeaPrecipitation(get); // MDG 13 l.185
    const steps: BuiltCascadeStep[] = [];
    for (const h of get().party) {
      if (h.dead) continue;
      if (isWeatherWarded(h)) { // protection magique : aucun Test à jouer
        tell(get, set, [t('sv.wardedExposure', { name: h.label, what: tdef.exposure === 'froid' ? t('sv.wardCold') : t('sv.wardHeat') })]);
        continue;
      }
      const resVal = testValue(h, { skill: { id: 'resistance' }, characteristic: 'endurance' });
      // FROID : l'absence de manteau est DÉJÀ fondue dans la valeur jetée (`exposureTarget`) — elle se
      // déclare donc en `dansLaValeur` pour redevenir la chip NOMMÉE que `exposureCoatMods` produit.
      // PLANCHER : `exposureTarget` borne la valeur à 0 ; quand ce plancher MORD, la valeur ne vient
      // plus de `testValue` : elle se DÉCLARE alors comme valeur d'une autre formule.
      const froid = tdef.exposure === 'froid';
      const coat = froid ? (exposureCoatMods(h).mods ?? []) : [];
      const brut = resVal + coat.reduce((s, m) => s + m.value, 0);
      const valeur = froid ? exposureTarget(h, resVal) : Math.max(0, resVal);
      // Une VAGUE = une BANDE influençable (MDG 13 l.203-225 : la cadence de la bande donne le nombre
      // de Tests de la Période de travail) — kind PROPRE à la route de mer (`merExposition`, patron
      // `testDEquipage`), même applier d'escalade que la nuit (`EXPOSURE_BAND_KINDS`).
      // La ligne est montée ICI : sa branche PLANCHER ne nomme aucun acteur (valeur d'une autre
      // formule, rien à décomposer) — la faire remonter par le mint la décomposerait.
      const st = monoStep({
        id: `merExposition-${h.id}`, kind: 'merExposition', actor: h, icon: 'repos/froid',
        label: stepPrecision(t('step.exposition'), dataLabel(tdef.label)), rollLabel: refLabel('skills', { id: 'resistance' }),
        difficulty: expDiff,
        montee: rollStep(valeur === brut
          ? {
            actor: h, test: { skill: { id: 'resistance' }, characteristic: 'endurance' }, valeur,
            ...(coat.length ? { dansLaValeur: coat } : {}),
            difficulty: expDiff, pont,
          }
          : { valeur, valeurEtrangere: true, difficulty: expDiff, pont }),
        stake: voyageStakeRef('voyage-exposition', { chars: exposureFirstFailChars(tdef.exposure) }),
        meta: { kind: tdef.exposure },
      });
      pousseSi(steps, st);
    }
    // 3ᵉ producteur d'Exposition à passer par la fabrique de vagues (#1117 L3).
    const band = exposureWaveBand(steps, tdef.exposure, expCount);
    if (band.length) {
      const resolues = openSequence(get, set, { title: 'Entretien — Exposition', icon: 'repos/froid', purpose: 'seaExposure', steps: band });
      if (!resolues) return; // fenêtre ouverte : clôture reprise par `dispatchCascadeDone` → `continueSeaDayAfterExposure`
      noteSeaLine(get, set, lignesResolues(resolues));
    }
  }
  continueSeaDayAfterExposure(get, set);
}

/**
 * PHASE 2b/3 (#1104b) : DISSIPATION des pénalités d'Exposition puis ÉPUISEMENT du rythme forcé
 * (ch.13 l.109-111). `doneSteps` : la cascade d'Exposition VIENT de se clôturer côté MJ
 * (`dispatchCascadeDone`) — ses lignes de résultat sont reversées dans `sea.lines` (même parité que
 * `continueSeaDayAfterScorbut`).
 */
export function continueSeaDayAfterExposure(get: Get, set: Set, doneSteps?: CascadeStep[]): void {
  const plan = get().travelPlan;
  if (!plan?.sea) return;
  if (doneSteps) noteSeaLine(get, set, lignesResolues(doneSteps));
  const sea = plan.sea;

  // DISSIPATION (purge #T3) : les pénalités d'Exposition s'échoient après `exposition-dissipation-heures`
  // (règle ÉDITABLE, défaut 24 h) — MÊME règle que le répit au camp (`restFlow`), un seul réglage
  // gouverne les deux répits. Elle tourne ICI — APRÈS l'application des échecs du jour (l'applier de
  // cascade a déjà couru, chemin immédiat comme chemin surfacé) et à CHAQUE jour de mer, y compris les
  // jours cléments : sinon une pénalité prise un jour froid resterait PERMANENTE faute d'horloge posée.
  for (const h of get().party) {
    if (h.dead) continue;
    expireOnRespite(h, get().gameTime + Number(rule('exposition-dissipation-heures')) * 60);
  }
  set({ party: [...get().party] });

  // ÉPUISEMENT : MDG 13 l.62, l.111 ; #1595.
  const patients = sea.modeToday ? equipageImplique(get().party, sea.manieursToday ?? [], seaRig(get().travelPlan!.vehicle!, sea.modeToday).competence) : [];
  const bande = buildBand(get, {
    id: 'mer-epuisement', kind: 'mer-epuisement', label: t('sv.exhaustion'),
    stake: voyageStakeRef('mer-epuisement', { condition: conditionLabel('extenue') }),
    difficulty: exhaustionDifficulty(sea.paceToday != null),
    porteurs: patients.map((h) => ({ actor: h, ligne: { test: { skill: { id: 'resistance' }, characteristic: 'endurance' }, pont: activeSeaPrecipitation(get) } })), // MDG 13 l.111, l.185, l.200
  });
  if (bande) {
    const resolues = openSequence(get, set, { title: t('sv.exhaustionTitle'), icon: 'medical/infection', purpose: 'seaExhaustion', steps: [bande] });
    if (!resolues) return; // fenêtre ouverte : clôture reprise par `dispatchCascadeDone` (`combatSlice.ts`) → `continueSeaDayAfterExhaustion`
    noteSeaLine(get, set, lignesResolues(resolues));
  }
  continueSeaDayAfterExhaustion(get, set);
}

/**
 * PHASE 3/3 (#272 résiduel) : recap du jour, arrivée (port) ou halte de nuit — même fin qu'avant la
 * scission. Lit `sea.lines` FRAIS (les phases 1/2 ont `tell()` toute leur journalisation, inline OU
 * surfacée MJ) au lieu d'un tableau local reconstitué — la SEULE source, plus de double comptage par
 * chemin. `doneSteps` : mêmes rôle/parité que `continueSeaDayAfterScorbut` ci-dessus, pour l'Épuisement.
 */
export function continueSeaDayAfterExhaustion(get: Get, set: Set, doneSteps?: CascadeStep[]): void {
  const plan = get().travelPlan;
  if (!plan?.sea) return;
  if (doneSteps) noteSeaLine(get, set, lignesResolues(doneSteps));
  const rng = battleRng();
  // RELU APRÈS la reprise ci-dessus : `plan` a été capturé AVANT, et son `sea.lines` n'aurait pas
  // porté les conclusions de la fenêtre qui vient de se clore — le recap du jour les perdait.
  const sea = get().travelPlan!.sea!;
  const daysAtSea = sea.daysAtSea + 1;
  const todayLines = sea.lines;

  const miles = sea.milesToday;
  const kmDone = Math.min(plan.km, plan.kmDone + miles);
  // PV DU JOUR (couche `voyageCadence`) : les jets de ROUTINE auto-résolus s'y sont accumulés (`sea.entries`) —
  // on les EMPORTE dans le recap du jour avant de rincer l'accumulateur pour le lendemain.
  const dayEntries = [...(sea.entries ?? [])];
  const hull = plan.vehicle!;
  const chrome: SeaRecapChrome = {
    weatherLabel: seaWeatherLabel(sea.weather), windForce: sea.weather.vent, windFrom: sea.windFrom, heading: sea.heading,
    hullDelta: hull.wounds.current - sea.hullAtDayStart,
    morale: shipMoraleScore(get, hull), manann: vesselManann(get().vessel).score,
    waterLitres: get().vessel?.waterLitres,
    milesLeft: Math.max(0, Math.round(plan.km - kmDone)),
    daysLeft: joursDeMer(plan.km - kmDone, mDeCroisiere(navireDeLaCoque(hull))),
  };
  // Météo du LENDEMAIN, sous les météos imposées au navire.
  const { weather, windFrom } = meteoDuJour(get, hull, sea.weather.vent, rng);
  patchSea(get, set, {
    daysAtSea, lines: [], entries: [],
    weather, windFrom,
    milesToday: 0, effMToday: undefined, modeToday: undefined, sailsDown: false, lighthouseDR: 0, paceToday: undefined, manieursToday: undefined,
    hullAtDayStart: hull.wounds.current,
  });
  set({ travelPlan: { ...get().travelPlan!, kmDone } });

  const worldMap = get().worldMap as WorldMap;
  const to = placeById(worldMap, plan.toPlaceId);
  const recapDay: TravelRecapDay = { kmFrom: plan.kmDone, kmTo: kmDone, hours: 24, lines: toRecapLines(todayLines), entries: dayEntries, sea: chrome };
  rangerLesEvenements(get, set, recapDay);

  if (plan.km - kmDone < 1e-9 && to) {
    // ARRIVÉE : la distance de la traversée est NOTÉE sur le navire (vente à un port producteur :
    // « plus de 100 milles », l.366). Le CHOIX « relâche à terre » (MDG 15 l.245) se tranche AVANT
    // le tirage de l'événement de port (`trancherLaRelache` enchaîne `resolvePortArrival`).
    set({ travelPlan: null, ...(get().vessel ? { vessel: { ...get().vessel!, lastVoyageMilles: plan.km } } : {}) });
    log(get, set, [t('sv.arrive', { to: to.label })]);
    openPortAt(get, set, to);
    return;
  }
  // ACTIVITÉS EN MER (MDG 15 l.266-272) : « Pour chaque semaine (8 jours) de voyage en mer, chaque
  // Personnage a l'occasion d'effectuer une Activité » — la 8ᵉ journée révolue ouvre le choix (modale),
  // la halte de nuit suit à la confirmation (le recap du jour lui est transmis).
  if (daysAtSea > 0 && daysAtSea % 8 === 0) {
    set({ pendingSeaActivities: { picks: {}, day: recapDay } });
    return;
  }
  openSeaHalt(get, set, recapDay);
}

/** Halte de nuit EN MER (machinerie de repos, patron travelFlow) : on dort À BORD (hamacs, MDG 03
 *  l.71), couchage unique et abrité — pas de tente sur l'eau. `travelDay` = le jour qu'elle clôt. */
export function openSeaHalt(get: Get, set: Set, travelDay: TravelRecapDay): void {
  const vessel = garanti(get().vessel, get().travelPlan?.routeId, 'navire de campagne');
  ouvrirLeRepos(get, set, { places: { bord: true }, lieu: nomDuNavire(vessel), travelHalt: true, travelDay });
}

// ── Appliers des Tests d'équipage de VOYAGE (#275 Ronde 2 cran 3 — PILOTE RÉEL,
//    câblé par `buildSeaDayCascade`/`buildPostProgressionSteps`/`runSeaDay`) ────────────────────

/** Conséquence d'Affaler (ch.13 l.288-294) : échec → Critique au Gréement (MDG 14 l.92-96). Appelée par
 *  l'applier de la CASCADE DU JOUR (`'equipage-affaler'`, routine). */
function affalerConsequence(get: Get, set: Set, step: CascadeStep): Consequence[] {
  if (!step.result) return [];
  // MDG 13 l.292
  if (step.result.success) { const j = [t('sv.sailsStruckInTime')]; noteSeaLine(get, set, j); return freeCons(j); }
  const rng = battleRng();
  const crit = rollShipCritical(AFFALER_RULES.failCritLocation as ShipCritKey, rng);
  applyVesselCritical(get, set, crit);
  return [];
}

/**
 * Cœur d'UNE manche de CRISE (Poursuite ch.13 l.354-370 / Tourbillon ch.13 l.514-528) : dispatche sur
 * `sea.crisis.kind`, applique l'issue et journalise (recap). `total` = DR net de l'équipage —
 * `step.result.sl` quand un Test d'équipage a pu s'ouvrir, le plancher de Manque de bras (MDG 14 l.55,
 * `capToSuccesMinime(UNDERCREW_DR)`) quand AUCUN PJ n'est apte au poste : la manche se joue quand même,
 * comme la Progression sans équipage apte (`buildSeaDayCascade`). Peut ouvrir l'abordage (Poursuite « caught »,
 * `startChaseBoarding` → `interrupted`). SOURCE UNIQUE partagée par les appliers `poursuite`/`tourbillon`
 * ET le repli sans équipage de `buildPostProgressionSteps` — une crise ne se DROP jamais faute de titulaire.
 */
function resolveSeaCrisisRound(get: Get, set: Set, total: number): string[] {
  const plan = get().travelPlan;
  const sea = plan?.sea;
  if (!sea?.crisis) return [];
  const rng = battleRng();
  if (sea.crisis.kind === 'poursuite') {
    const c = sea.crisis;
    const eff = effectiveSeaM(get);
    const myM = eff.m ?? 1;
    const foe = rollTest(c.foeSkill, 'intermediaire', rng);
    const gain = pursuitDistanceGain(myM, total + pursuitLowMPenalty(myM)) - pursuitDistanceGain(c.foeM, foe.sl + pursuitLowMPenalty(c.foeM));
    const distance = c.distance + gain;
    const j = [t('sv.chase', { label: c.label, issue: gain >= 0 ? t('sv.chaseGain') : t('sv.chaseLoss'), gain: `${gain >= 0 ? '+' : ''}${gain}`, distance, escapeAt: c.escapeAt })];
    const outcome = pursuitOutcome(distance, c.escapeAt);
    if (outcome === 'escaped') {
      patchSea(get, set, { crisis: undefined, boarding: undefined });
      // MDG 13 l.362
      j.push(t('sv.chaseEscaped'));
    } else if (outcome === 'caught') {
      patchSea(get, set, { crisis: undefined });
      // MDG 13 l.420
      j.push(t('sv.chaseCaught'));
      startChaseBoarding(get, set);
    } else {
      patchSea(get, set, { crisis: { ...c, distance } });
    }
    noteSeaLine(get, set, j);
    return j;
  }
  const c = sea.crisis;
  const w = findWhirlpool(c.whirlpoolId)!;
  const progress = c.progress + Math.max(0, total + w.manDR);
  const hull = plan!.vehicle!;
  const dmg = Math.max(0, w.ic - Math.floor(effectiveChar(hull, 'endurance') / 10));
  damageVesselHull(get, set, hull, dmg);
  const j = [t('sv.whirlpoolGrind', { label: w.label, dmg, progress, need: c.need })];
  if (progress >= c.need) {
    patchSea(get, set, { crisis: undefined });
    // MDG 13 l.528
    j.push(t('sv.whirlpoolEscaped'));
  } else patchSea(get, set, { crisis: { ...c, progress } });
  noteSeaLine(get, set, j);
  return j;
}

// ── PANNE DE VAPEUR (MDG 12 l.313-352) — résolution first-class au voyage ─────────────────────

/** La personne qui « s'occupe du moteur » (MDG 12 l.326 ; MDG 14 l.39) : le meilleur au Métier (Ingénieur),
 *  sinon le premier PJ en état. */
export function engineerOf(party: Combatant[]): Combatant | undefined {
  const apt = equipageApte(party);
  return partyBest(apt, { skill: STEAM_SKILL })?.actor ?? apt[0];
}

/** Exécute les Tests de REDÉMARRAGE d'une panne (MDG 12 l.329-348) via la personne au moteur — Test
 *  étendu de Force (`drCible`) puis Test(s) de Métier (Ingénieur). Retourne le DR du DERNIER Test de
 *  redémarrage (« 5 − DR Rounds » de mise en pression, l.333). Tests d'AMBIANCE de voyage (« jusqu'à ce
 *  que quelqu'un réussisse », l.331 → retry borné) — équipage abstrait, hors modale (≠ la sauvegarde
 *  d'Initiative PERSO, seul jet influençable de la panne, cf. `openSteamSave`). */
function runRestart(get: Get, set: Set, eng: Combatant, restart: NonNullable<SteamBreakdownEntry['restart']>, rng: RNG): number {
  let lastDR = 0;
  for (const step of restart) {
    const { skill, characteristic, difficulty } = step.test;
    const value = testValue(eng, { skill, characteristic });
    const label = testSkillLabel({ skill, characteristic }) ?? '';
    if (step.drCible != null) {
      let etape = { total: 0, done: step.drCible <= 0 };
      for (let i = 0; !etape.done && i < 20; i++) etape = extendedTestStep(etape.total, rollTest(value, difficulty, rng), step.drCible);
      tell(get, set, [t('sv.engineStep', { name: eng.label, label, diff: DIFFICULTY_LABELS[difficulty], need: step.drCible, issue: etape.done ? t('sv.engineCleared') : t('sv.engineStruggling') })]);
    } else {
      let t = rollTest(value, difficulty, rng);
      for (let i = 0; !t.success && i < 20; i++) t = rollTest(value, difficulty, rng);
      lastDR = Math.max(0, t.sl);
      // Aucune rangée nulle part (équipage abstrait, hors modale) — le journal PORTE le jet (#295 Lot 5, gardé nominativement).
      tell(get, set, [tr('sv.engineRestart', { name: eng.label, label, diff: DIFFICULTY_LABELS[difficulty], roll: t.roll, target: t.target, dr: lastDR })]);
    }
  }
  return lastDR;
}

/** Applique une PANNE DE VAPEUR (MDG 12 l.313-352) au voyage — CHAQUE champ first-class consommé :
 *  « Fuite de vapeur » (`failDamage`) ouvre la sauvegarde d'Initiative INFLUENÇABLE ; l'« Explosion »
 *  (`compartmentDamage`) frappe la personne au moteur (Perforante) ; le moteur détruit (`engineDestroyed`)
 *  ôte la propulsion à vapeur du navire ; le Coup Critique à la Coque (`hullCritical`) est roulé. Les
 *  effets de VITESSE (`mSet`/`mMod`, pendant `durationRounds`/`coolMinutes` + le redémarrage `restart`)
 *  IMMOBILISENT le moteur : la journée perd la fraction de milles correspondante (durée convertie en
 *  minutes via la règle maison `combat-round-secondes`, LDB 13 l.13). */
export function applySteamBreakdown(get: Get, set: Set, b: SteamBreakdownEntry, rng: RNG): void {
  // « Fuite de vapeur » (l.326-328) : un jet de vapeur ébouillante la personne au moteur → sauvegarde
  // d'Initiative INFLUENÇABLE (modale) ; échec = dégâts ignorant l'Armure. Suspend la boucle maritime.
  if (b.failDamage) { openSteamSave(get, set, b.failDamage, rng); return; }

  const eng = engineerOf(get().party);

  // « Explosion » (l.351-352) : quiconque dans le compartiment du moteur (la personne au moteur, équipage
  // abstrait) subit `compartmentDamage` Dégâts avec l'Atout Perforante.
  if (b.compartmentDamage != null && eng) {
    const boiler = buildWeapon({ label: t('sv.boilerBlast'), damage: { plusBF: false, flat: 0 }, qualities: [{ id: 'perforante' }], uid: 'chaudiere' }); // Dégâts passés directement (weaponHit) → la spec ne sert qu'aux qualités

    const lines = applyOps(eng, [{ op: 'wounds', amount: b.compartmentDamage, weaponHit: true }], { idNeuf: get().forgerUnId, rng, weapon: boiler, location: 'corps' });
    set({ party: [...get().party] });
    tell(get, set, [t('sv.blastWave', { name: eng.label, dmg: b.compartmentDamage }), ...lines]);
  }

  // Moteur détruit : l'Amélioration Propulsion à vapeur saute (à ré-installer au chantier) → le navire
  // retombe sur ses voiles/avirons ou dérive pour le reste de la traversée.
  if (b.engineDestroyed && get().vessel) {
    set({ vessel: { ...get().vessel!, upgrades: (get().vessel!.upgrades ?? []).filter((u) => u.id !== 'propulsion-a-vapeur') } });
  }
  if (b.hullCritical) applyVesselCritical(get, set, rollShipCritical('coque', rng));

  // IMMOBILISATION du moteur : fenêtre à vitesse réduite (`mMod`) ou nulle (`mSet:0`) → fraction perdue.
  const secPerRound = Number(rule('combat-round-secondes')); // LDB 13 l.13 (MJ décide, valeur maison)
  let windowMin = 0;
  if (b.durationRounds) windowMin += tirer(b.durationRounds, rng) * secPerRound / 60; // « les 1d10 prochains Rounds »
  if (b.coolMinutes) windowMin += tirer(b.coolMinutes, rng); // « attendre 20+1d10 minutes »
  if (b.restart && eng) windowMin += Math.max(0, 5 - runRestart(get, set, eng, b.restart, rng)) * secPerRound / 60; // « 5 − DR Rounds » de mise en pression
  if (windowMin > 0) {
    const miles0 = get().travelPlan?.sea?.milesToday ?? 0;
    const baseM = garanti(effectiveSeaM(get).m, get().travelPlan?.routeId, 'M du navire à vapeur');
    const speedFactor = b.mSet === 0 ? 0 : b.mMod ? Math.max(0, (baseM + b.mMod) / baseM) : 1; // vitesse pendant la fenêtre
    const miles = Math.max(0, Math.round(miles0 - miles0 * Math.min(1, windowMin / MINUTES_PER_DAY) * (1 - speedFactor)));
    if (miles !== miles0) {
      patchSea(get, set, { milesToday: miles });
      tell(get, set, [t('sv.engineDown', { min: Math.round(windowMin), miles: miles0 - miles })]);
    }
  }
}

/** Ouvre la sauvegarde d'Initiative INFLUENÇABLE d'une « Fuite de vapeur » (MDG 12 l.326-328) sur la
 *  personne au moteur — dégâts d'ébouillantage roulés d'avance (« 1d10–5 Dégâts (1 minimum) », ignorent
 *  l'Armure). Aucun équipage → rien à ébouillanter (la boucle reprend normalement). */
function openSteamSave(get: Get, set: Set, failDamage: Tirage, rng: RNG): void {
  const eng = engineerOf(get().party);
  if (!eng) return;
  const dmg = Math.max(1, tirer(failDamage, rng)); // « (1 minimum) » sur les Dégâts
  const value = testValue(eng, { characteristic: 'initiative' }); // Test d'INITIATIVE (Difficulté par défaut : Intermédiaire +0)
  set({
    pendingSteamSave: {
      actorId: eng.id, skillValue: value, difficulty: 'intermediaire',
      ...cibleMesuree(rollLine({ actor: eng, test: { characteristic: 'initiative' }, difficulty: 'intermediaire', valeur: value })),
      scaldOps: [{ op: 'wounds', amount: dmg, ignoreTB: false, ignoreAP: true }], // « qui ignorent l'Armure » (le BE reste déduit)
      roll: null, success: false, sl: 0,
    } satisfies PendingSteamSave,
  });
}

/** Résout la sauvegarde d'Initiative d'une « Fuite de vapeur » (appelée par `jetValider('fuiteDeVapeur')`) : ÉCHEC →
 *  ébouillanté (`scaldOps` déjà roulés), puis le RESTE de la journée reprend (la cascade `'equipage-progression'`
 *  s'était fermée SANS insérer la suite du jour, cf. son applier — `pendingSteamSave` suspendait). */
export function resolveSteamSave(get: Get, set: Set, p: PendingSteamSave): void {
  const eng = get().party.find((h) => h.id === p.actorId);
  // Le jet est DÉJÀ affiché par la rangée de `SteamSaveModal` (`p.roll`/`p.target`) — pas de re-print (#295 Lot 5).
  if (eng && !p.success) {
    const lines = applyOps(eng, p.scaldOps, { idNeuf: get().forgerUnId, rng: battleRng(), now: get().gameTime });
    set({ party: [...get().party] });
    tell(get, set, [t('sv.scalded', { name: eng.label }), ...lines]);
  } else if (eng) {
    tell(get, set, [t('sv.dodgedSteam', { name: eng.label })]);
  }
  if (get().travelPlan?.sea) continueSeaDayFromPostProgression(get, set);
}

/** Reprend le RESTE du jour (crise/embuscade/phare/orientation/extermination/entretien,
 *  `buildPostProgressionSteps`) — utilisé par `resolveSteamSave` quand la cascade `'equipage-progression'` s'est
 *  fermée SANS insérer la suite (Fuite de vapeur suspendue entre-temps). */
function continueSeaDayFromPostProgression(get: Get, set: Set): void {
  jouerLesEtapesDuJour(get, set, buildPostProgressionSteps(get, set));
}

/** Ouvre l'embuscade AUTHORÉE d'une route de mer (couture UNIQUE, #212) — même pipeline que l'embuscade
 *  terrestre (« Attaqués ! », travelFlow) : interruption + scène + rencontre AUTHORÉES. `noSurprise` :
 *  la Poursuite (`startChaseBoarding`) a prévenu (défaut `true`) ; l'ancrage déterministe le fait dépendre
 *  du Test de Perception. Anti-double-feu par `sea.ambushFired`. Retourne `false` si rien à ouvrir. */
function openAuthoredSeaAmbush(get: Get, set: Set, route: MapRoute | undefined, noSurprise = true): boolean {
  const plan = get().travelPlan;
  if (plan?.sea?.ambushFired || !(route?.ambush?.scene.id && route.ambush.encounter)) return false;
  set({ travelPlan: { ...plan!, interrupted: true, sea: { ...plan!.sea!, ambushFired: true } } });
  get().quitterLaScene(route.ambush.scene.id, route.ambush.entry);
  get().lancerLeCombat(route.ambush.encounter, undefined, { noSurprise });
  return true;
}

/** Id de la Scène d'abordage GÉNÉRIQUE (construite à la volée, re-enregistrée à chaque abordage dérivé). */
const BOARDING_SCENE_ID = 'abordage-generique';

/** Taille de la vague d'abordage : la règle maison `abordage-taille-de-vague`. */
const tailleDeVague = (): number => Math.max(1, Math.round(Number(rule('abordage-taille-de-vague'))));

/** Les marins du navire hostile, chef mis à part, et ceux de la première vague. MDG 15 l.150, l.171 */
function premiereVague(b: SeaBoarding): { marins: number; vague: number } {
  const marins = Math.max(0, b.nombre - (b.chefRef ? 1 : 0));
  return { marins, vague: Math.min(tailleDeVague(), marins) };
}

/** Id du combattant d'index `i` de la rencontre d'abordage générique (`buildEncounter`) : 0 est la coque
 *  hostile, son équipage exposé suit. */
const idDAbordage = (i: number): string => `enemy-enc-abordage-${i}`;

/** La coque de campagne qui porte un combat sur le PONT : sa réf et son nom ; `null` hors de la mer ou sans
 *  coque de campagne connue (impossibilité réelle, non simulable). */
function coqueDuPont(get: Get): { ref: string; nom: string } | null {
  const plan = get().travelPlan;
  if (!plan?.sea) return null;
  const ref = get().vessel?.vehicleId ?? plan.vehicle?.creatureId;
  if (!ref) return null;
  const vessel = get().vessel;
  return { ref, nom: vessel ? nomDuNavire(vessel) : garanti(plan.vehicle, plan.routeId, 'navire du voyage').label };
}

/** La Scène GÉNÉRIQUE du PONT, construite à la volée : la coque de campagne au camp allié (le groupe y
 *  EMBARQUE au `lancerLeCombat`), `ennemis` en face — MÊME machinerie navale que les scènes authorées
 *  (`buildScene` + `enemies` terse, cf. `16-embuscade-fluviale`/`ls-abordage-cogue`). */
function sceneDuPont(coque: { ref: string; nom: string }, label: string, debut: string, rencontre: { id: string; ennemis: AuthoredEnemy[]; victoryCondition?: VictoryCondition }): Scene {
  return buildScene({
    id: BOARDING_SCENE_ID,
    label,
    size: [18, 12],
    terrain: defautsDeCompilation.pont.id,
    ambiance: 'exterieur',
    heroStart: [3, 7],
    startMessage: { texte: debut },
    encounters: [{
      id: rencontre.id,
      enemies: [...rencontre.ennemis, { vehicule: { id: coque.ref }, pos: { x: 3, y: 6 }, side: 'allie' as const, label: coque.nom }],
      ...(rencontre.victoryCondition ? { victoryCondition: rencontre.victoryCondition } : {}),
    }],
  });
}

/** Lance le combat `encounterId` de la Scène du pont : l'enregistre, INTERROMPT la traversée et lance le
 *  combat — MÊME couture de suspension/reprise que l'embuscade authorée (`openAuthoredSeaAmbush` :
 *  `interrupted` + `lancerLeCombat` suspend la cascade en cours, le teardown de combat la reprend).
 *  `onVictory` : la suite jouée sur la victoire (`finishVictory`). */
function combattreSurLePont(get: Get, set: Set, scene: Scene, encounterId: string, onVictory?: Flow, noSurprise = true): void {
  const plan = garanti(get().travelPlan?.sea && get().travelPlan, encounterId, 'traversée en mer');
  registerScene(scene);
  set({ travelPlan: { ...plan, interrupted: true, sea: { ...plan.sea!, boarding: undefined } } });
  get().quitterLaScene(BOARDING_SCENE_ID, undefined);
  get().lancerLeCombat(encounterId, onVictory, { noSurprise });
}

/** L'abordage du navire hostile `b` sur le pont : sa coque porte sa première vague d'abordage
 *  (`premiereVague`, + `chefRef`) comme équipage exposé (MDG 14). */
function buildBoardingScene(coque: { ref: string; nom: string }, b: SeaBoarding): Scene {
  const wave = premiereVague(b).vague;
  const chef = b.chefRef ? 1 : 0;
  // Équipage EXPOSÉ de la coque ennemie = la vague (crew + chef).
  const crewIds = Array.from({ length: wave + chef }, (_, i) => idDAbordage(i + 1));
  const ennemis: AuthoredEnemy[] = [
    { vehicule: { id: b.shipRef }, pos: { x: 14, y: 6 }, label: b.label, crewIds },
    ...Array.from({ length: wave }, (_, i) => ({ creature: { id: b.crewRef }, pos: { x: 12, y: 3 + (i % 6) } })),
    ...(b.chefRef ? [{ creature: { id: b.chefRef }, pos: { x: 16, y: 6 } }] : []),
  ];
  return sceneDuPont(coque, `Abordage — ${b.label}`, t('sv.boardingStart', { ship: b.label }), { id: 'enc-abordage', ennemis });
}

/** Ouvre l'abordage GÉNÉRIQUE dérivé de l'événement (`SeaBoarding`) sur le pont (`combattreSurLePont`).
 *  Renvoie `false` sans coque de campagne (`coqueDuPont`). */
function openGenericBoarding(get: Get, set: Set, b: SeaBoarding, noSurprise = true): boolean {
  const coque = coqueDuPont(get);
  if (!coque) return false;
  combattreSurLePont(get, set, buildBoardingScene(coque, b), 'enc-abordage', undefined, noSurprise);
  // Les marins hors de la première vague restent en RÉSERVE sur la coque hostile ; ils montent à bord par
  // vagues (`monterLesVagues`, `shipCrew.ts`). MDG 15 l.150, l.171
  const { marins, vague } = premiereVague(b);
  const battle = get().battle;
  const coqueHostile = inBattleId(battle, idDAbordage(0));
  if (battle && coqueHostile && marins > vague) {
    coqueHostile.reserveDAbordage = { ref: b.crewRef, restant: marins - vague, vague: tailleDeVague() };
    set({ battle: { ...battle } });
  }
  return true;
}

/** COMBAT EN MER (op `combatEnMer`) : `adversaire.nombre` créatures attaquent sur le pont du navire de
 *  campagne (`combattreSurLePont`) ; chacune est repoussée à `repousseAPct` % de ses Blessures de départ ou
 *  moins (objectif `woundsThreshold` sans cible), `victoire` se joue sur la victoire. Rend les lignes.
 *  MDG 15 l.136-139, l.142-143, l.165-168 */
export function combattreEnMer(get: Get, set: Set, o: Extract<GameOp, { op: 'combatEnMer' }>, label: string): string[] {
  const coque = coqueDuPont(get);
  if (!coque) return [t('sv.combatEnMerSansPont', { label })];
  const { id, nombre, optionals } = o.adversaire;
  const ennemis: AuthoredEnemy[] = Array.from({ length: nombre }, (_, i) => ({
    creature: { id }, pos: { x: 12 - 2 * Math.floor(i / 3), y: 2 + 4 * (i % 3) }, ...(optionals ? { optionals: structuredClone(optionals) } : {}), // #2097
  }));
  const adversaire = `${nombre} × ${creatureLabel(id)}`;
  const scene = sceneDuPont(coque, `${label} — ${adversaire}`, t('sv.combatEnMerStart', { label, adversaire }), {
    id: 'enc-en-mer', ennemis,
    ...(o.repousseAPct !== undefined ? { victoryCondition: { type: 'woundsThreshold' as const, atOrBelowPercent: o.repousseAPct } } : {}),
  });
  combattreSurLePont(get, set, scene, 'enc-en-mer', o.victoire && structuredClone(o.victoire)); // #2097
  return [];
}

/** Rattrapé par un navire hostile → ABORDAGE (MDG 13 l.420). Priorité : embuscade AUTHORÉE de la route
 *  (SURCHARGE d'auteur, jamais une condition d'existence) ; à défaut, l'abordage se DÉRIVE de l'événement
 *  lui-même (le navire hostile `sea.boarding` engendre la rencontre GÉNÉRIQUE bord à bord). En dernier
 *  recours SEULEMENT — coque de campagne inconnue — l'impossibilité est journalisée HONNÊTEMENT (rien
 *  d'inventé, pas de pseudo-récit). */
function startChaseBoarding(get: Get, set: Set): void {
  const plan = get().travelPlan;
  const route = (get().worldMap as WorldMap | undefined)?.routes.find((r) => r.id === plan?.routeId);
  if (openAuthoredSeaAmbush(get, set, route)) return;
  const boarding = plan?.sea?.boarding;
  if (boarding && openGenericBoarding(get, set, boarding)) return;
  tell(get, set, [t('sv.noBoardingData')]);
}

/** Voile du Test de Navigation du navire hostile `b` : la meilleure de son chef et de son équipage, à défaut la
 *  donnée `voileSansProfil`. MDG 13 l.376 */
function voileDuPoursuivant(b: SeaBoarding): number {
  const scores = [b.chefRef, b.crewRef].flatMap((id) => (findCreatureById(id)?.skills ?? []).filter((s) => s.id === COMPETENCE_DU_MODE.voile).map((s) => s.value));
  return scores.length ? Math.max(...scores) : voileSansProfil();
}

/** Fuite = COURSE-POURSUITE (ch.13 l.354) devant le navire hostile `b`, à son M de conception : le seuil
 *  d'évasion suit la visibilité du jour (l.364-370). */
function startSeaPursuit(get: Get, set: Set, b: SeaBoarding): void {
  const sea = get().travelPlan!.sea!;
  const escapeAt = sea.weather.visibilite === 'degage' ? 100 : sea.weather.visibilite === 'brume' ? 50 : 10;
  const foeM = garanti(propulsionDuNavire(b.shipRef, undefined, 'maritime'), b.shipRef, 'propulsion du navire hostile').m;
  patchSea(get, set, {
    crisis: { kind: 'poursuite', label: b.label, distance: Math.floor(escapeAt / 2), escapeAt, foeM, foeSkill: voileDuPoursuivant(b) },
  });
  // MDG 13 l.362-370
  tell(get, set, [t('sv.fleeChase', { start: Math.floor(escapeAt / 2), escapeAt })]);
}

/** PORTEUR d'une décision de BORD (interpellation pirate, tribut) : celui qui mènerait la manœuvre —
 *  le meilleur à la barre (`helmSkill` soutenu), à défaut le premier vivant. La porte de choix exige un
 *  porteur : sans lui, la fenêtre échoit à l'hôte, qui trancherait pour le siège d'un autre. */
function seaDecider(get: Get): string {
  const party = get().party;
  const helm = helmSkill(get);
  return partyAssisted(party, { skill: helm })?.actor.id ?? party.find((h) => !h.dead)?.id ?? '';
}

/** NAVIRE HOSTILE en vue (op `navireHostile`) : il n'approche que s'il juge le navire de campagne vulnérable —
 *  son effectif atteint `cible-vulnerable-pct` % des âmes à bord, ou il aligne plus de grands canons (valeur
 *  maison) ; sinon il passe son chemin. Rend les lignes. MDG 15 l.150-151, l.171-173 */
export function navireHostileEnVue(get: Get, set: Set, coque: Combatant, o: Extract<GameOp, { op: 'navireHostile' }>, label: string): string[] {
  const ames = shipboardSouls(get()).total;
  const vulnerable = o.equipage.nombre * 100 >= ames * Number(rule('cible-vulnerable-pct')) || (o.grandsCanons ?? 0) > (coque.postes?.length ?? 0);
  if (!vulnerable) return [t('sv.hostilePasse', { label })];
  openPirateHail(get, set, { shipRef: o.navire.id, crewRef: o.equipage.id, ...(o.chef ? { chefRef: o.chef.id } : {}), nombre: o.equipage.nombre, label }, o.exigence === 'fouille');
  return [];
}

/** Interpellation du navire hostile (A5.3 #327) : cascade AUTONOME (patron Ouragan `resolveSeaDayEvent`)
 *  d'une SEULE étape de CHOIX — fuir / combattre, et se soumettre quand il exige de fouiller la cale
 *  (`fouille`). L'applier `merPiratesSommation` reprend `runSeaDay` à la fermeture. Le pillage
 *  (`pirate-pillage-pct`) et le tribut à Stromfels sont RAW-mués (MDG 15 l.171-173 décrit l'extorsion sans la
 *  chiffrer) → paramètre maison + choix joueur. */
function openPirateHail(get: Get, set: Set, b: SeaBoarding, fouille: boolean): void {
  patchSea(get, set, { boarding: b });
  openChoice(get, set, {
    title: b.label, icon: 'nautique/vent', purpose: 'test',
    id: 'merPiratesSommation', kind: 'merPiratesSommation', actorId: seaDecider(get), label: dataLabel(b.label),
    defaultChoice: 'fuir',
    options: [
      // MDG 13 l.362-370
      { key: 'fuir', label: t('opt.fuir'), detail: t('sv.detailFuir') },
      { key: 'combattre', label: t('opt.combattre'), detail: t('sv.detailCombattre') },
      ...(fouille ? [{ key: 'soumettre', label: t('opt.soumettre'), detail: t('sv.detailSoumettre', { pct: Number(rule('pirate-pillage-pct')) }) }] : []),
    ],
  });
}

/** Critique de navire au VOYAGE : Blessures non chiffrées par la table (les effets sont l'entrée) →
 *  l'entrée est PERSISTÉE sur le navire (`vessel.criticals`) et racontée ; ses effets mécaniques fins
 *  s'appliquent quand la coque redevient un combattant (combat naval).
 *
 *  Le coup à l'ÉQUIPAGE de la rangée (MDG 13 l.763) s'applique ICI, en voyage comme en combat :
 *  conséquence certaine appliquée, ÉPREUVE ouverte par la PORTE canonique (bande pour les héros
 *  tenus, voie inline sinon), sur les personnes exposées à bord (#1657 B3-2), sauf `equipageEpargne`
 *  (MDG 15 l.49-51). La bande rejoint la séquence HÔTE (`revealPurpose`, #4006) : celle en vol (jour, Test
 *  d'un événement de bord), à défaut celle du combat ou du jour. */
export function applyVesselCritical(get: Get, set: Set, crit: ShipCriticalResolved, equipageEpargne?: true): void {
  const vessel = get().vessel;
  if (vessel) set({ vessel: { ...vessel, criticals: [...(vessel.criticals ?? []), crit.note] } });
  tell(get, set, [`${crit.log}`, `→ ${crit.note}`]);
  if (!crit.crewHit || equipageEpargne) return;
  const coque = get().travelPlan?.vehicle;
  if (!coque) return;
  const equipage = exposedCrew(get().party);
  const coup = applyCrewHit(coque, equipage, crit.crewHit, battleRng(), get().forgerUnId);
  if (coup.hits.length) {
    set({ party: [...get().party] });
    tell(get, set, [t('shipCrit.crewTakes', { n: coup.hits.length, label: crit.label })]);
  }
  if (!coup.testFlow) return;
  const victimes = coup.victims.map((id) => equipage.find((c) => c.id === id)).filter(Boolean) as Combatant[];
  pushStep(set, (index) => bandeTriggeredTest(
    get, set, victimes, coup.testFlow!, `mer-equipage-touche-${crit.id}-${index}`, { idNeuf: get().forgerUnId, rng: battleRng(), label: crit.label, hull: coque },
  ), revealPurpose('travelDay', false));
  // Voie INLINE (personne à bord sans siège) : ses lignes partent dans la file différée — la mer n'a
  // pas de `battle.log`, on les déverse dans le journal du voyage (source unique `drainPendingLog`).
  const lignes = drainPendingLog(get, set).map((e) => e.text);
  if (lignes.length) { set({ party: [...get().party] }); tell(get, set, lignes); }
}

// ── Événements de bord (ch.15 l.132-236) — application MÉCANIQUE par `consequence` ──

/** Localisation TIRÉE d'un Coup Critique de coque (MDG 15 l.153, MDG 15 l.33-37). */
export function localisationAleatoire(rng: RNG): ShipCritKey {
  const locs: ShipCritKey[] = ['greement', 'coque', 'avirons', 'equipements', 'cargaison'];
  return locs[rng.int(0, locs.length - 1)];
}

/** Applique un événement de bord et REND la ligne qui le raconte (titre + texte verbatim de
 *  `sea-events.json`) — son écriture appartient à l'appelant : conséquence d'étape sous cascade,
 *  `ecrireAuJournal` direct hors cascade. Les lignes MÉCANIQUES de la conséquence (dégâts, Moral, avarie) restent
 *  du ressort des sites qui les produisent (`tell`), comme ailleurs dans ce flux. */
function resolveBoardEvent(get: Get, set: Set, event: SeaEventDef, roll?: number): string {
  // MDG 15 l.89, l.228
  const vessel = get().vessel;
  if (vessel?.modificateurs?.some((m) => m.jusqua === 'evenementDeBord')) set({ vessel: { ...vessel, modificateurs: modificateursApresUnEvenement(vessel.modificateurs) } });
  const ligne = noteEvent(get, set, { title: event.label, text: event.desc, roll });
  if (event.consequence) jouerFlowEntier(runFlow(get, set, event.consequence, event.label));
  return ligne;
}

/** Le navire HEURTE le péril `hazardId` (op `perilDeMer`) : Dégâts = Indice de Collision du péril + M du
 *  navire − BE de coque, voie d'eau, puis empêtrement ou Échouage selon la donnée du péril ; un modificateur
 *  du navire qui l'évite (`navireMod.evite`) l'écarte. Rend les lignes. MDG 13 l.446, l.471-499 ;
 *  MDG 15 l.181-183, l.229 */
export function heurterLePeril(get: Get, set: Set, coque: Combatant, hazardId: string, rng: RNG): string[] {
  const hazard = garanti(findSeaHazard(hazardId), hazardId, 'péril en mer');
  const evite = evitementDuPeril(get().vessel?.modificateurs, get().gameTime, hazard.id);
  if (evite) return [t('sv.perilEvite', { hazard: hazard.label, label: evite.label })];
  garanti(get().travelPlan?.sea, hazardId, 'navire en mer');
  const eff = effectiveSeaM(get);
  const dmg = Math.max(0, hazard.ic + (eff.m ?? 1) - Math.floor(effectiveChar(coque, 'endurance') / 10));
  damageVesselHull(get, set, coque, dmg);
  // MDG 13 l.446/475-499
  const j = [t('sv.collision', { dmg, hazard: hazard.label, ic: hazard.ic }), ...spoilVesselCargoOnLeak(get, set)];
  // La DONNÉE du péril ouvre l'issue, jamais son id : `entangleChancePct` (l.485) côté empêtrement,
  // `strandChancePct` (l.497/499) côté Échouage — et le garde passe AVANT le dé, symétriquement,
  // pour qu'un péril sans chance n'en consomme aucun.
  if (hazard.entangleChancePct != null) {
    // Empêtrement (l.485-491) : pénalité de Man/M par Taille du bateau, Test étendu de Force pour se dégager.
    const vehiculeId = get().vessel?.vehicleId ?? '';
    const lengthM = findVehicleById(vehiculeId)?.ship?.lengthM;
    // Un empêtrement se résout par la TAILLE du bateau : sans longueur, il n'y a pas de Taille —
    // anomalie NOMMÉE, jamais un 0 qui rendrait « Minuscule » au premier trois-mâts venu.
    if (lengthM == null) {
      throw new Error(
        `debrisEntangle : le navire « ${vehiculeId || '(aucun)'} » n'a pas de facette « ship » avec sa longueur — la pénalité d'empêtrement (MDG 13 l.485-491) se lit par Taille de bateau.`,
      );
    }
    const ent = debrisEntangleFor(hazard, shipSizeOfLength(lengthM), deMonde(rng));
    if (ent.entangled) {
      patchSea(get, set, {
        entangled: {
          hazardId: hazard.id, label: hazard.label,
          need: hazard.freeTest?.drCible ?? 10, progress: 0,
          manDR: ent.manDR, mMod: ent.mMod,
          difficulty: hazard.freeTest?.test.difficulty ?? 'accessible',
        },
      });
      j.push(t('sv.entangledOn', { hazard: hazard.label }));
    }
  } else if (hazard.strandChancePct != null && strandingOccurs(hazard, deMonde(rng))) {
    // Échouage (l.471-473/497/499) : la pénalité se dérive au jet (`seaStrandingPenalty`).
    patchSea(get, set, { stranded: { hazardId: hazard.id, label: hazard.label } });
    // MDG 13 l.473
    j.push(t('sv.strandedOn', { hazard: hazard.label }));
  }
  return j;
}

/** Un TOURBILLON aspire le navire à la périphérie de sa zone (op `perilDeMer`) : la crise d'évasion s'ouvre,
 *  nommée `label`. Rend les lignes. MDG 13 l.514-537 ; MDG 15 l.140-141, l.146 */
export function entrerDansLeTourbillon(get: Get, set: Set, whirlpoolId: string, label: string): string[] {
  const w = garanti(findWhirlpool(whirlpoolId), whirlpoolId, 'tourbillon');
  garanti(get().travelPlan?.sea, whirlpoolId, 'navire en mer');
  patchSea(get, set, { crisis: { kind: 'tourbillon', label, whirlpoolId: w.id, need: w.evasion.drCible, progress: 0 } });
  // MDG 13 l.528
  return [t('sv.whirlpoolEvasion', { label: w.label, dr: w.evasion.drCible })];
}

// ── Services PORTUAIRES (#30 — réparation, carénage, Améliorations, construction) ────────────────
// MDG 12 l.108-164 ; MDG 13 l.639-651 ; MDG 15 l.255

/** Jours d'UN travail du chantier (réparation ou pose), tirés de `f` sur le référent du navire de campagne :
 *  au moins un. MDG 15 l.255 ; MDG 12 l.230 ; MDG 12 l.293 */
function joursDuChantier(get: Get, set: Set, f: Formula, rng: RNG): number {
  return Math.max(1, Math.round(resolveFormula(f, garanti(referentDuNavire(get, set), 'navire', 'référent du navire au chantier'), rng)));
}

/** Devis du CHANTIER naval d'un navire contre la bourse `bourse` du groupe : réparation (ch.13 l.643 ;
 *  ch.12 l.295) et carénage (ch.13 l.150-159), avec le refus de chaque geste (`null` : le geste passe).
 *  SOURCE UNIQUE de `portRepairVessel`, `portCareenVessel` et de l'écran du port. PUR. */
export interface DevisDeChantier {
  max: number; current: number; missing: number; lissage: boolean; reparationGold: number; refusReparation: string | null;
  foulLevel: number; carenagePct: number; carenageGold: number; refusCarenage: string | null;
}

export function devisDeChantier(vessel: CampaignVessel, bourse: Money, refusHote: string | null): DevisDeChantier {
  const v = findVehicleById(vessel.vehicleId);
  const { max, current, missing } = blessuresDeCoqueARestaurer(vessel);
  const lissage = shipHasNavalTrait(vesselNavalTraits(vessel), 'lissage');
  const reparationGold = Math.ceil(prixDeLaReparation(missing, lissage));
  const foulLevel = vessel.fouling?.level ?? 0;
  const carenagePct = foulingEffects(foulLevel).repairPctOfBase;
  const carenageGold = Math.ceil((v?.purchase?.price?.gold ?? 0) * (carenagePct / 100));
  return {
    max, current, missing, lissage, reparationGold, foulLevel, carenagePct, carenageGold,
    refusReparation: refusHote ?? (missing <= 0 && !vessel.criticals?.length && !vessel.reparationTemporaire ? t('sv.hullIntact')
      : !canAfford(bourse, toMoney({ gold: reparationGold })) ? t('sv.yardTooExpensive', { cost: reparationGold })
      : null),
    refusCarenage: refusHote ?? (foulLevel <= 0 && !modificateursAuCarenage(vessel.modificateurs).length ? t('sv.hullClean')
      : carenageGold > 0 && !canAfford(bourse, toMoney({ gold: carenageGold })) ? t('sv.careenTooExpensive', { cost: carenageGold, pct: carenagePct })
      : null),
  };
}

/** RÉPARATION au port : Tests de Métier (Constructeur de navires) du constructeur local, ou du constructeur de
 *  l'escale (`vessel.constructeurDEscale`), jusqu'à la coque pleine ; le prix suit les Blessures restaurées, le temps
 *  les heures des Tests, ou la durée du constructeur de l'escale. Purge les Critiques notés en voyage. Refus si la
 *  bourse ne couvre pas le devis. MDG 13 l.641-643 ; MDG 12 l.295 ; MDG 15 l.255 */
export function portRepairVessel(get: Get, set: Set): string[] {
  const vessel = get().vessel;
  const v = vessel ? findVehicleById(vessel.vehicleId) : undefined;
  if (!vessel || !v?.hull) { refuserGeste(get, set, t('sv.noVesselToRepair')); return []; }
  const devis = devisDeChantier(vessel, partyMoneyTotal(get), refusDeGesteSurLeGroupe(get()));
  if (devis.refusReparation) { refuserGeste(get, set, devis.refusReparation); return []; }
  const { max, missing, lissage } = devis;
  const rng = battleRng();
  const constructeur = vessel.constructeurDEscale;
  const competence = constructeur?.competence ?? REPARATION.constructeurLocal;
  let restaurees = 0, heures = 0, prix = 0, tests = 0, reussis = 0;
  while (restaurees < missing) {
    const passe = rollPortRepair(competence, missing - restaurees, rng, { lissage });
    tests++;
    if (passe.success) reussis++;
    restaurees += passe.wounds; heures += passe.hours; prix += passe.costGold;
  }
  const cost = Math.ceil(prix);
  payFromGroup(get, set, toMoney({ gold: cost }), { purpose: 'réparation navire' });
  set({ vessel: { ...get().vessel!, wounds: { current: max, max }, criticals: [], reparationTemporaire: undefined } });
  const jours = constructeur ? joursDuChantier(get, set, constructeur.duree, rng) : null;
  const duree = jours !== null ? t('sv.dureeJours', { n: jours }) : t('sv.dureeHeures', { n: Math.max(1, heures) });
  get().avancerLeTemps(jours !== null ? jours * MINUTES_PER_DAY : Math.max(1, heures) * 60);
  return [t('sv.hullRefit', { ship: v.label, missing, cost, lissage: lissage ? t('sv.fragSmoothed', { pct: REPARATION.lissageRepairSurcoutPct }) : '', duree, competence, reussis, tests })];
}

/** CARÉNAGE en cale sèche (Salissures, ch.13 l.150-159) : « pour récurer un bateau de Taille Moyenne ou
 *  plus, il doit être emmené dans une cale sèche » — coût = % du coût de base par NIVEAU (colonne
 *  Réparation du tableau). Lève aussi les modificateurs « jusqu'au carénage » (`modificateursAuCarenage`). */
export function portCareenVessel(get: Get, set: Set): string[] {
  const vessel = get().vessel;
  const v = vessel ? findVehicleById(vessel.vehicleId) : undefined;
  if (!vessel || !v) { refuserGeste(get, set, t('sv.noVesselToCareen')); return []; }
  const devis = devisDeChantier(vessel, partyMoneyTotal(get), refusDeGesteSurLeGroupe(get()));
  if (devis.refusCarenage) { refuserGeste(get, set, devis.refusCarenage); return []; }
  const { carenageGold: cost, carenagePct: pct } = devis;
  const costMoney = toMoney({ gold: cost });
  if (cost > 0) payFromGroup(get, set, costMoney, { purpose: 'carénage navire' });
  set({ vessel: { ...vessel, fouling: { level: 0, lastWeek: vessel.fouling?.lastWeek ?? 0 }, modificateurs: (vessel.modificateurs ?? []).filter((m) => m.jusqua !== 'carenage') } }); // MDG 15 l.185
  return [t('sv.careened', { cost: cost ? t('sv.fragCareenCost', { cost, pct }) : '' })];
}

/** Devis de POSE d'une Amélioration navale (MDG 12 l.195-364) : coût et poids par bande de Taille
 *  (`installCost`), durée en jours (`duree`, tirée à la pose), et refus (`null` : la pose passe) contre la bourse
 *  `bourse` du groupe et le port `portRef` (`MapPlace.port.ref`, `naval-ports.json`). SOURCE UNIQUE de
 *  `installerLAmelioration` et de l'écran du port. PUR. MDG 15 l.255 ; MDG 12 l.230 */
export type DevisDAmelioration = { traitId: string; label: string; enc: number | null } & ({ refus: null; gold: number; duree: Formula } | { refus: string; gold: number | null; duree: Formula | null });

export function devisDAmelioration(vessel: CampaignVessel | null, traitId: string, units: number, bourse: Money, refusHote: string | null, portRef: string | undefined): DevisDAmelioration {
  const v = vessel ? findVehicleById(vessel.vehicleId) : undefined;
  const entry = findNavalTrait(traitId);
  const label = entry?.label ?? traitId;
  if (!vessel || !v?.ship || !entry) return { traitId, label, gold: null, enc: null, duree: null, refus: t('sv.upgradeNotFound') };
  if (entry.kind !== 'amelioration') return { traitId, label, gold: null, enc: null, duree: null, refus: t('sv.upgradeIsTrait', { label }) };
  if (!entry.install) return { traitId, label, gold: null, enc: null, duree: null, refus: t('sv.upgradeNoPrice', { label }) };
  const { gold, enc } = installCost(entry.install, v.ship.lengthM, units);
  const duree: Formula = vessel.constructeurDEscale?.duree ?? (entry.install.jours && installAmount(entry.install.jours, v.ship.lengthM)) ?? REPARATION.joursDePose;
  if (gold == null) return { traitId, label, gold, enc, duree, refus: t('sv.upgradeEmbedded', { label }) };
  if (entry.install.chantierSpecialise && !(portRef && findNavalPortById(portRef)?.chantierNavalSpecialise)) return { traitId, label, gold, enc, duree, refus: t('sv.upgradeNeedsShipyard', { label }) };
  if (refusHote) return { traitId, label, gold, enc, duree, refus: refusHote };
  if (!canAfford(bourse, toMoney({ gold }))) return { traitId, label, gold, enc, duree, refus: t('sv.upgradeTooExpensive', { label, gold }) };
  return { traitId, label, gold, enc, duree, refus: null };
}

/** Améliorations proposées au chantier : celles à pose chiffrée que le navire ne porte pas encore, chacune
 *  avec son devis (une unité). */
export function ameliorationsAuChantier(vessel: CampaignVessel, bourse: Money, refusHote: string | null, portRef: string | undefined): DevisDAmelioration[] {
  const owned = new Set((vessel.upgrades ?? []).map((u) => u.id));
  return NAVAL_TRAITS
    .filter((tr) => tr.kind === 'amelioration' && tr.install && !owned.has(tr.id))
    .map((tr) => devisDAmelioration(vessel, tr.id, 1, bourse, refusHote, portRef))
    .filter((d) => d.gold != null);
}

/** POSE d'une Amélioration navale : le refus de `devisDAmelioration` tombe avant tout débit ; la réf rejoint
 *  `vessel.upgrades` (recopiée sur la coque à chaque départ), et les jours de la pose passent. `units` = cabines
 *  multiples, etc. MDG 12 l.230 ; MDG 12 l.293 ; MDG 15 l.255 */
export function installerLAmelioration(get: Get, set: Set, traitId: string, units = 1): string[] {
  const vessel = get().vessel;
  const devis = devisDAmelioration(vessel, traitId, units, partyMoneyTotal(get), refusDeGesteSurLeGroupe(get()), lieuDuGroupe(get())?.port?.ref);
  if (devis.refus !== null) { refuserGeste(get, set, devis.refus); return []; }
  const navire = garanti(vessel, 'vessel', 'navire du devis d’Amélioration');
  const { gold, enc, label } = devis;
  const jours = joursDuChantier(get, set, devis.duree, battleRng());
  payFromGroup(get, set, toMoney({ gold }), { purpose: 'amélioration navire' });
  set({ vessel: { ...navire, upgrades: [...(navire.upgrades ?? []), { id: traitId, ...(units > 1 ? { value: units } : {}) }] } });
  get().avancerLeTemps(jours * MINUTES_PER_DAY);
  return [t('sv.upgradeInstalled', { label, gold, enc: enc ? t('sv.fragUpgradeEnc', { enc }) : '', duree: t('sv.dureeJours', { n: jours }) })];
}

// ── Événements de PORT (ch.15 l.127-129 + l.239-263) ─────────────────────────────────────────────

/** Permission de faire RELÂCHE À TERRE en attente de CHOIX joueur (MDG 15 l.245), posée à l'accostage
 *  AVANT le tirage de l'événement de port — `trancherLaRelache` tranche puis enchaîne `resolvePortArrival`
 *  et l'arrivée au lieu `to`. */
export interface PendingShoreLeave {
  to: MapPlace;
}

/** Ouvre le PORT d'un lieu (arrivée en mer OU Effet scripté `openPort`) — SOURCE UNIQUE : avec profil de
 *  port (`to.port`) → relâche à terre en attente de décision (`pendingShoreLeave`, MDG 15 l.245) ; sans
 *  profil (destination sans port) → résout directement (rien à jouer) et le groupe arrive au lieu (`arriverAuLieu`).
 *  Appelée par `continueSeaDayAfterCascade` (accostage) et le handler `openPort` (noyau/combatEffects) —
 *  jamais un doublon de cette décision. */
export function openPortAt(get: Get, set: Set, to: MapPlace): void {
  if (to.port) {
    set({ pendingShoreLeave: { to: structuredClone(to) } }); // #2097
    return;
  }
  finalizePortArrivalTo(get, set, to, true);
}

/** ÉVÉNEMENT DE PORT (2d10 ± Humeur, ch.15 l.127-129 + Tableau l.239-263). `relacheATerre` = permission de
 *  faire relâche à terre accordée par le capitaine (`fenetreChoisir('relacheATerre', 'accorder', …)`, MDG 15 l.245) : gate les
 *  rangées `relache` — les DEUX entrées de la table qui la référencent nommément, Embrigadement (l.245,
 *  « cet événement n'a pas lieu » si refusée) et Fête de Manann (l.260, le bonus d'Humeur suppose « le
 *  capitaine autorise… à faire relâche »).
 *  Les 19 autres entrées (Prêtre de Manann, Contrôle à quai, Tempête, Port désert, Gangs des quais, La
 *  tache noire, Pénuries, Pas d'événement, Constructeur itinérant, Trop beau pour être vrai, Beau temps,
 *  Passager clandestin, Rumeurs commerciales, Offre de mission, Bonne pêche, Saturation de produits…) ne
 *  mentionnent pas la relâche à terre — vérifié entrée par entrée (MDG 15 l.243-263) — donc non gatées. */
export function resolvePortArrival(get: Get, set: Set, port: PortProfile | undefined, rng: RNG, shoreLeave = true): void {
  const vessel = get().vessel;
  const mood = vesselManann(vessel);
  const { roll, hours, event } = rollPortEvent(mood.score, rng);
  log(get, set, [t('sv.portEvent', { die: formatDice(deDesEvenementsDePort()), roll, label: event.label, hours }), event.desc]);
  if (event.relache && !shoreLeave) { log(get, set, [t('sv.relacheRefusee', { label: event.label })]); return; }
  // MDG 15 l.249
  if (event.taillePortMax !== undefined && (port?.taille ?? Infinity) > event.taillePortMax) { log(get, set, [t('sv.portTropGrand', { label: event.label, taille: event.taillePortMax })]); return; }
  if (event.consequence) jouerFlowEntier(runFlow(get, set, event.consequence, event.label));
}

/** Résout le choix « Relâche à terre » (MDG 15 l.245) posé à l'accostage, AVANT le tirage de
 *  l'événement de port : `allow` accordé → Embrigadement/Fête de Manann peuvent se produire
 *  normalement ; refusé → l'Embrigadement « n'a pas lieu » et la Fête de Manann perd son bonus
 *  d'Humeur (gate porté par `resolvePortArrival`). Enchaîne le tirage puis la transition de scène. */
function trancherLaRelache(get: Get, set: Set, allow: boolean): void {
  const p = garanti(get().pendingShoreLeave, String(allow), 'relâche à terre');
  set({ pendingShoreLeave: null });
  log(get, set, [allow
    ? t('sv.shoreLeaveGranted')
    : t('sv.shoreLeaveDenied')]);
  // Désertion à la relâche ACCORDÉE (MDG 14 l.192-202) : dé de MONDE par `openWorldTest`, cible = le
  // seuil de la bande de Moral. Il ne décide pas des départs : l'applier `merDesertion` les tire, un
  // d100 par marin (#1508). Son verdict ne dit donc que la comparaison du dé au seuil.
  const vessel = get().vessel;
  const threshold = allow && vessel ? moraleBand(vessel.morale.score).desertionRoll : 0;
  if (threshold) {
    const resolue = openWorldTest(get, set, {
      actionLabel: t('sv.desertion'),
      cible: threshold,
      verdict: { reussite: t('seuil.sousLeSeuil'), echec: t('seuil.auDessus') },
    }, 'merDesertion');
    if (resolue) { finalizePortArrivalTo(get, set, p.to, true); return; } // résolue sur place (I) : l'applier a joué la désertion → accoster maintenant
    // Fenêtre ouverte (M/V), ou pilote arrêté sur un choix : la clôture du slot finalise l'accostage
    // (`dispatchCascadeDone` → `finalizePortArrival`). Interrompu par la défaite : aucun slot, rien à enchaîner.
    const casc = get().pendingCascade;
    if (casc) set({ pendingCascade: { ...casc, portArrival: { toPlaceId: p.to.id, allow: true } } });
    return;
  }
  finalizePortArrivalTo(get, set, p.to, allow);
}

/** Finalise un ACCOSTAGE (MDG 15 l.245) : événement de port (`resolvePortArrival`, qui peut ouvrir SA
 *  propre cascade) puis arrivée au lieu (`arriverAuLieu`). SOURCE UNIQUE des deux gestes enchaînés,
 *  partagée par `trancherLaRelache` (inline) et la clôture de cascade surfacée (`dispatchCascadeDone`). */
export function finalizePortArrivalTo(get: Get, set: Set, to: MapPlace, allow: boolean): void {
  const accostage = accosterLeNavire(get, set, to.id);
  if (accostage.length) log(get, set, accostage);
  const avant = get().pendingCascade;
  resolvePortArrival(get, set, to.port, battleRng(), allow);
  const ouverte = get().pendingCascade;
  // L'événement a SUSPENDU sur sa propre cascade (Test, choix) : l'arrivée au lieu attend sa clôture.
  if (ouverte && ouverte !== avant) { set({ pendingCascade: { ...ouverte, portArrival: { toPlaceId: to.id, allow, evenementJoue: true } } }); return; }
  arriverAuLieu(set, to);
}

/** À l'ACCOSTAGE au lieu `placeId` : le navire y est à quai (`escale`), les recueillis sans solde rejoignent
 *  l'équipage pour une paie normale, la perte au déchargement est levée. MDG 15 l.129, l.213-218, l.250 */
function accosterLeNavire(get: Get, set: Set, placeId: string): string[] {
  const vessel = get().vessel;
  if (!vessel) return [];
  const recueillis = vessel.recueillisSansSolde ?? [];
  const crew = recueillis.reduce((roster, h) => ajouterAuRoster(roster, h.roleId, h.count), vessel.crew ?? []);
  const { recueillisSansSolde: _r, perteAuDechargement: _p, commissions = [], ...reste } = vessel;
  const livrees = commissions.filter((c) => c.placeId === placeId);
  const enCours = commissions.filter((c) => c.placeId !== placeId);
  set({ vessel: { ...reste, escale: placeId, ...(recueillis.length ? { crew } : {}), ...(enCours.length ? { commissions: enCours } : {}) } });
  const n = recueillis.reduce((s, h) => s + h.count, 0);
  const port = placeById(get().worldMap as WorldMap, placeId)?.label ?? placeId;
  for (const c of livrees) mouvementDeLaBourseDuGroupe(get, set, c.brass);
  return [
    ...(n ? [t('eff.recueillisEngages', { n })] : []),
    ...livrees.map((c) => t('eff.commissionLivree', { label: c.label, port, montant: formatMoney(fromBrass(c.brass)) })),
  ];
}


/** L'accostage `arrival` qu'une cascade FERMÉE sans clôture portait : il passe à la cascade que sa branche
 *  a ouverte, sinon il se finalise. */
export function poursuivreLAccostage(get: Get, set: Set, arrival: NonNullable<PendingCascade['portArrival']>): void {
  const ouverte = get().pendingCascade;
  if (ouverte) set({ pendingCascade: { ...ouverte, portArrival: arrival } });
  else finalizePortArrival(get, set, arrival);
}

/** Clôture d'une cascade `portArrival` (désertion à la relâche surfacée, #387) : résout le lieu par id
 *  puis finalise l'accostage. Appelée par `dispatchCascadeDone` — `pendingCascade` est DÉJÀ null. */
export function finalizePortArrival(get: Get, set: Set, arrival: NonNullable<PendingCascade['portArrival']>): void {
  const to = placeById(get().worldMap as WorldMap, arrival.toPlaceId);
  if (!to) return;
  if (arrival.evenementJoue) arriverAuLieu(set, to);
  else finalizePortArrivalTo(get, set, to, arrival.allow);
}

/** Les choix du port (`CorpsDesChoix`, MDG 15 l.245) : la relâche à terre. */
export function choixDuVoyageEnMer(get: Get, set: Set) {
  return {
    relacheATerre: { accorder: (accorder) => trancherLaRelache(get, set, accorder) },
  } satisfies Partial<CorpsDesChoix>;
}

export function creerActionsDuVoyageEnMer(get: Get, set: Set) {
  return {
    reparerLeNavire: () => portRepairVessel(get, set).forEach((l) => get().ecrireAuJournal(l)),
    carenerLeNavire: () => portCareenVessel(get, set).forEach((l) => get().ecrireAuJournal(l)),
    installerLAmelioration: (traitId, units) => installerLAmelioration(get, set, traitId, units).forEach((l) => get().ecrireAuJournal(l)),
  } satisfies FabriqueDuNoyau;
}

/** Les genres d'étape que ce module déclare (table `appliers`). */
export const GENRES_D_ETAPE = [
  SEA_BOARD_EVENT_KIND, 'mer-forcer-le-rythme', 'mer-scorbut', 'mer-mal-de-mer',
  'mer-tonneau-expose', 'mer-tonneau-contamine', 'mer-epuisement', 'equipage-progression', 'mer-survitesse',
  'mer-salissures', 'mer-reparation-temporaire', 'reparation-temporaire-degats', 'equipage-affaler', 'testDEquipage', 'equipage-orientation', 'equipage-phare', 'equipage-embuscade',
  'merProgressionChoix', 'merProgressionNavigation', 'equipage-poursuite', 'equipage-tourbillon', 'equipage-extermination',
  'mer-degagement', 'mer-degagement-debris', 'equipage-voyage-rapide', 'equipage-entretien', 'merPiratesSommation',
  'merPiratesTribut', 'merDesertion',
] as const;
/** Les règles de succès que ce module déclare (table `reglesDeSucces`). */
export const REGLES_DE_SUCCES = [CREW_TEST_SUCCESS_RULE] as const;
/** Les interruptions de péril que ce module déclare (table `interruptionsDePeril`). */
export const INTERRUPTIONS_DE_PERIL = [SEA_PERIL_INTERRUPT] as const;

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  appliers: {
    [SEA_BOARD_EVENT_KIND]: (get, set, step) => {
      const tiree = step.table?.result;
      if (!tiree) return {};
      const rng = battleRng();
      const event = seaBoardEventById(tiree.id);
      // Le délai du PROCHAIN événement se tire ICI, juste après le dé d'événement, et il est posé AVANT la
      // conséquence : celle-ci peut surfacer sa propre cascade, et une reprise re-déclencherait sinon CE
      // même tirage.
      patchSea(get, set, { daysToEvent: rollDaysToNextEvent(rng) });
      if (!event) return {};
      // UNE ligne par événement, et c'est la CONSÉQUENCE de l'étape (titre + texte VERBATIM de
      // `sea-events.json`, AGENTS.md règle 5) : `commitStep` la journalise ET la garde en `outcome`, donc
      // la rangée reste lisible dans la pile après validation (« on ne perd pas les conséquences »,
      // `CascadeModal`). Même patron que la Météo d'Étape (`travelFlow`, applier `etape-meteo`), qui rend
      // sa ligne en conséquence au lieu de l'écrire à côté. La ligne de la TABLE, elle, reste l'issue de la
      // RANGÉE (`table.result.lines`) et ne se re-verse pas au journal : une seule voix par étape.
      return { consequences: freeCons([resolveBoardEvent(get, set, event, tiree.die)]) };
    },
    /** Forcer le rythme (MDG 13 l.95-107) : pose `paceToday`, le +M du jour se lit ensuite par
     *  `effectiveSeaM`. Étape du TRONC de la cascade du jour (`buildForcePaceStep`, avant Progression) —
     *  `tell()` (pas `{journal}`) : la ligne rejoint le RECAP du jour (`sea.lines` → `TravelRecapDay.lines`). */
    'mer-forcer-le-rythme': (get, set, step) => {
      if (!step.result) return;
      const won = step.result.success;
      const forcePace = Number(step.meta?.forcePace ?? 0);
      patchSea(get, set, { paceToday: won ? 'reussite' : 'echec' });
      noteManieurs(get, set, step);
      // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5).
      const j = [t('sv.stepIssue', { label: String(step.label), issue: won ? t('sv.paceWon', { m: forcePace }) : t('sv.paceLost') })];
      noteSeaLine(get, set, j);
      return { consequences: freeCons(j) };
    },
    /** Scorbut (MDG 14 l.230) : BANDE — le verdict se lit RANGÉE PAR RANGÉE (patron Mal de mer ci-dessous),
     *  chaque porteur portant sa soupe de chou fermenté dans `row.meta`. */
    'mer-scorbut': (get, set, step) => {
      const lignes: FreeConsLine[] = [];
      for (const row of step.participants ?? []) {
        const hero = actorIn(get(), row.id);
        // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5).
        // Succès sans effet (l'exposition « pour cette fois » n'a rien à ajouter) → aucune conséquence.
        if (!hero || !row.result || row.result.success) continue;
        const d = contractDisease('scorbut', battleRng());
        if (d) hero.diseases = [...(hero.diseases ?? []), d];
        lignes.push({ text: t('sv.scurvyGot', { name: hero.label, soup: row.meta?.soup ? t('sv.fragSoup') : '' }), tone: 'echec' });
      }
      touchParty(get, set);
      return { consequences: freeCons(lignes) };
    },
    /** Mal de mer (MDG 14 l.217-220) : échec → contracté. `applyContraction` dédoublonne si
     *  DEUX étapes ratées le même jour pour le même héros (premier voyage ET mauvais temps cumulés,
     *  `buildSeasicknessSteps`). */
    'mer-mal-de-mer': (get, set, step) => {
      const lignes: FreeConsLine[] = [];
      // BANDE : le verdict se lit RANGÉE PAR RANGÉE, dans l'ordre de la partie — le dé de contraction
      // d'un porteur qui échoue tombe au rang de SA rangée.
      for (const row of step.participants ?? []) {
        const hero = actorIn(get(), row.id);
        if (!hero || !row.result || row.result.success) continue;
        if (applyContraction(hero, 'mal-de-mer', false, battleRng()).length) lignes.push({ text: t('sv.seasickGot', { name: hero.label }), tone: 'echec' });
      }
      touchParty(get, set);
      return { consequences: freeCons(lignes) };
    },
    /** Tonneau d'eau — EXPOSITION (MDG 14 l.209) : boire au tonneau contaminé la veille
     *  expose au Test de Contraction propre à la maladie qui l'a contaminé (même cycle générique que
     *  Scorbut ci-dessus, difficulté lue sur `diseaseDefs()[…].contractDifficulty`). */
    'mer-tonneau-expose': (get, set, step, hero) => {
      if (!step.result || !hero) return;
      const diseaseId = String(step.meta?.diseaseId ?? '');
      const j = step.result.success ? [] : applyContraction(hero, diseaseId, false, battleRng());
      touchParty(get, set);
      return { consequences: freeCons(j.length ? [{ text: t('sv.waterDiseaseGot', { name: hero.label, disease: diseaseLabel(diseaseId) }), tone: 'echec' }] : []) };
    },
    /** Tonneau d'eau — CONTAMINATION (MDG 14 l.209) : un porteur boit au tonneau, échoue son
     *  Test de Résistance Intermédiaire (+0) → le tonneau devient une source de contagion (effet visible
     *  dès DEMAIN, jamais le jour même — le garde `!waterContaminated` évite qu'un second porteur en échec
     *  le même jour n'écrase la maladie déjà posée par le premier). */
    'mer-tonneau-contamine': (get, set, step) => {
      if (!step.result) return;
      if (step.result.success) return { consequences: freeCons([]) };
      const diseaseId = String(step.meta?.diseaseId ?? '');
      if (!get().travelPlan?.sea?.waterContaminated) patchSea(get, set, { waterContaminated: { diseaseId } });
      return { consequences: freeCons([{ text: t('sv.waterContaminated', { disease: diseaseLabel(diseaseId) }), tone: 'echec' }]) };
    },
    /** Épuisement (MDG 13 l.111) : BANDE, verdict lu rangée par rangée (patron Scorbut ci-dessus). */
    'mer-epuisement': (get, set, step) => {
      const lignes: FreeConsLine[] = [];
      for (const row of step.participants ?? []) {
        const hero = actorIn(get(), row.id);
        // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5).
        // Succès sans effet (rien à ajouter) → aucune conséquence.
        if (!hero || !row.result || row.result.success) continue;
        addCondition(hero, 'extenue');
        lignes.push({ text: t('sv.exhaustionGot', { name: hero.label, diff: DIFFICULTY_LABELS[garanti(row.difficulty, row.id, 'Difficulté de la rangée d’Épuisement')] }), tone: 'echec' });
      }
      set({ party: [...get().party] });
      return { consequences: freeCons(lignes) };
    },
    /** Progression du jour (MDG 14 l.61-65 ; ±10 %/DR ch.15 l.78) + PANNE DE VAPEUR (MDG 12 l.313) sur un
     *  navire à Propulsion à vapeur (Test de Métier lu sur les jets INDIVIDUELS des contributeurs). INSÈRE
     *  le reste de la journée (crise/embuscade/phare/orientation/extermination/entretien) une fois
     *  `sea.milesToday` connu (`buildPostProgressionSteps`, #275 Ronde 2 cran 3 Décision 2). */
    'equipage-progression': (get, set, step) => {
      if (!step.result) return;
      const total = step.result.sl;
      const j = applySeaProgress(get, set, total);
      const plan = get().travelPlan;
      const hull = plan?.vehicle;
      const rng = battleRng();
      if (hull && seaRig(hull).mode === 'vapeur') {
        const triggered = (step.participants ?? []).some((x) => estJete(x.result)
          && steamBreakdownTriggered({ success: evaluateTest(x.result.roll, x.result.target).success, sl: x.result.sl, isDouble: isDoubleRoll(x.result.roll) }));
        if (triggered) {
          // Tirage POST-POSE de la table de panne : l'étape `equipage-progression` est déjà posée, ce dé en est la
          // conséquence — au dé de sa table, même position RNG qu'inline (MDG 12 l.313).
          const b = rollSteamBreakdown(rng);
          j.push(t('sv.steamBreakdown', { label: b.label }), b.desc);
          applySteamBreakdown(get, set, b, rng); // « Fuite de vapeur » → `pendingSteamSave` (sauvegarde d'Initiative) suspend AVANT le reste du jour
        }
      }
      noteSeaLine(get, set, j);
      if (get().pendingSteamSave) return { consequences: freeCons(j) }; // le reste de la journée reprendra APRÈS la sauvegarde (`resolveSteamSave` → `runSeaDay`)
      const insert = buildPostProgressionSteps(get, set);
      return { consequences: freeCons(j), insert: insert.length ? insert : undefined };
    },
    /** « Ça va lâcher, capitaine ! » (MDG 13 l.121-142, #443) : Dégâts de coque (`overspeedDamage`)
     *  routés par `damageVesselHull`. */
    'mer-survitesse': (get, set, step) => {
      if (!step.result) return;
      if (step.result.success) {
        const j = [t('sv.holdsPace', { label: String(step.label) })];
        noteSeaLine(get, set, j);
        return { consequences: freeCons(j) };
      }
      const dmg = overspeedDamage(Number(step.meta?.overspeedDamage ?? 0), step.result.sl);
      const hull = get().travelPlan?.vehicle;
      const j = hull ? damageVesselHull(get, set, hull, dmg) : [];
      // MDG 13 l.142
      const line = [t('sv.hullTakes', { label: String(step.label), n: dmg }), ...j];
      noteSeaLine(get, set, line);
      return { consequences: freeCons(line) };
    },
    /** Salissures (MDG 13 l.148, #1105) : la semaine est notée sur TOUT résultat ; échec → +1 niveau,
     *  plafonné (`weeklyFoulingLevel`). */
    'mer-salissures': (get, set, step) => {
      const vessel = get().vessel;
      if (!step.result || !vessel) return;
      const before = vessel.fouling?.level ?? 0;
      const r = weeklyFoulingLevel(before, step.result.success);
      set({ vessel: { ...vessel, fouling: { level: r.level, lastWeek: Number(step.meta?.week) } } });
      const line = step.result.success ? t('sv.foulingHolds')
        : r.gained ? t('sv.fouling', { level: r.level, desc: foulingEffects(r.level).desc })
        : t('sv.foulingMax', { level: r.level });
      noteSeaLine(get, set, [line]);
      return { consequences: freeCons([line]) };
    },
    'mer-reparation-temporaire': (get, set, step) => appliquerLaReparationTemporaire(get, set, step, REPARATION.temporaire.failDamage),
    /** Dégâts de la réparation temporaire qui cède, à la coque qui a joué le Test, planchés à 0. MDG 13 l.651 ; MSRC 7 l.117 */
    'reparation-temporaire-degats': (get, set, step) => {
      if (!step.de?.result) return;
      const hull = coqueParId(get(), String(step.meta?.hullId));
      if (!hull) return { consequences: freeCons([t('cascade.cibleDisparue', { label: t('sv.reparationTemporaireDegats') })]) };
      const n = Math.max(0, step.de.result.total);
      const line = [t('sv.reparationTemporaireCoque', { n }), ...(n > 0 ? damageVesselHull(get, set, hull, n) : [])];
      set(touchActors(get()));
      noteSeaLine(get, set, line);
      return { consequences: freeCons(line) };
    },
    'equipage-affaler': (get, set, step) => ({ consequences: affalerConsequence(get, set, step) }),
    /** Test d'équipage d'un nœud `test` de Flow (`navireOps.ouvrirLeTestDEquipage`) : cascade AUTONOME
     *  (`purpose:'test'`), dont la branche du verdict puis la suite du Flow se jouent ici, sous le libellé et
     *  le DR du Flow qui l'a ouverte. MDG 14 l.13 */
    testDEquipage: (get, set, step) => {
      if (!step.result) return;
      moralDuTestDEquipage(get, set, step);
      const branche = (step.result.success ? step.meta?.onSuccess : step.meta?.onFail) ?? EMPTY_FLOW;
      jouerFlowEntier(runFlow(get, set, { kind: 'sequence', etapes: [branche, step.meta?.after ?? EMPTY_FLOW] }, step.meta?.flowLabel, step.meta?.flowSl));
      return { consequences: freeCons([]) };
    },
    /** Orientation quotidienne (« un Test par jour de voyage », ch.13 l.311) → Repères / Changement de cap. */
    'equipage-orientation': (get, set, step) => {
      if (!step.result) return;
      const sea = get().travelPlan?.sea;
      if (!sea) return;
      const rng = battleRng();
      const total = step.result.sl;
      const dr = total + (sea.lighthouseDR ?? 0);
      const out = orientationOutcome(dr, !!sea.minorDrift);
      const j = [`Orientation (DR ${dr >= 0 ? '+' : ''}${dr}${sea.lighthouseDR ? `, phare +${sea.lighthouseDR}` : ''}) : ${out.desc}`];
      if (out.outcome === 'derive-mineure') patchSea(get, set, { minorDrift: true });
      if (out.rollCourseChange) {
        const cc = rollCourseChange(rng, out.courseChangeBonus);
        j.push(t('sv.courseChange', { die: formatDice(deDuChangementDeCap()), roll: cc.roll, side: t(cc.side === 'tribord' ? 'sv.sideTribord' : 'sv.sideBabord'), desc: cc.desc }));
        const plan2 = get().travelPlan!;
        const remaining = plan2.km - plan2.kmDone;
        if (cc.outcome === 'retard') set({ travelPlan: { ...plan2, km: plan2.km + remaining * (cc.delayPct / 100) } });
        if (cc.outcome === 'demi-tour') set({ travelPlan: { ...plan2, kmDone: Math.max(0, plan2.kmDone - (plan2.sea?.milesToday ?? 0)) } });
        if (cc.outcome === 'quart-de-tour') {
          const turn: Record<WindDirection, WindDirection> = { nord: cc.side === 'tribord' ? 'est' : 'ouest', sud: cc.side === 'tribord' ? 'ouest' : 'est', est: cc.side === 'tribord' ? 'sud' : 'nord', ouest: cc.side === 'tribord' ? 'nord' : 'sud' };
          patchSea(get, set, { heading: turn[sea.heading] });
        }
      }
      noteSeaLine(get, set, j);
      return { consequences: freeCons(j) };
    },
    /** Phare du port d'arrivée (ch.13 l.337) : réussite → bonus d'Orientation (Savoir Océans/manuel). */
    'equipage-phare': (get, set, step) => {
      if (!step.result) return;
      const success = step.result.success;
      const best = partyAssisted(get().party, { skill: { id: 'orientation' } });
      const dr = success && best ? Math.max(1, lighthouseOrientationDR(best.actor, false), savoirOceansBonus(best.actor)) : 0;
      patchSea(get, set, { lighthouseDR: dr });
      // MDG 13 l.335
      const j = [success ? t('sv.lighthouseSeen', { dr }) : t('sv.lighthouseMissed')];
      noteSeaLine(get, set, j);
      return { consequences: freeCons(j) };
    },
    /** Embuscade authorée à ancrage déterministe (#212) : réussite = préparés (pas de Surprise). */
    'equipage-embuscade': (get, set, step) => {
      if (!step.result) return;
      const plan = get().travelPlan;
      const route = (get().worldMap as WorldMap | undefined)?.routes.find((r) => r.id === plan?.routeId);
      const success = step.result.success;
      const j = [success
        ? t('sv.lookoutOk')
        : t('sv.lookoutKo')];
      noteSeaLine(get, set, j);
      openAuthoredSeaAmbush(get, set, route, success);
      return { consequences: freeCons(j) };
    },
    /** Le choix de Progression (MDG 14 l.63) n'a pas d'issue propre : il INSÈRE la voie retenue. */
    'merProgressionChoix': (get, _set, step) => {
      const nav = step.chosen === 'nav';
      const next = nav ? buildNavProgressionStep(get) : buildVoyageCrewStep(get, 'progression', 'equipage-progression');
      return next ? { insert: [next] } : undefined;
    },
    /** Voie NAVIGATION de la Progression (MDG 13 l.66) : le DR se lit au MÊME tableau que la voie
     *  d'équipage — même `applySeaProgress`, même suite de journée. */
    'merProgressionNavigation': (get, set, step) => {
      if (!step.result) return;
      noteManieurs(get, set, step);
      const j = applySeaProgress(get, set, step.result.sl);
      noteSeaLine(get, set, j);
      const insert = buildPostProgressionSteps(get, set);
      return { consequences: freeCons(j), insert: insert.length ? insert : undefined };
    },
    /** Manche de Poursuite (ch.13 l.354-370) — issue partagée avec la poursuite terrestre (`engine/pursuit`). */
    'equipage-poursuite': (get, set, step) => {
      if (!step.result) return;
      return { consequences: freeCons(resolveSeaCrisisRound(get, set, step.result.sl)) };
    },
    /** Manche d'Évasion du Tourbillon (ch.13 l.514-528) : chaque manche coûte des Dégâts de collision. */
    'equipage-tourbillon': (get, set, step) => {
      if (!step.result) return;
      return { consequences: freeCons(resolveSeaCrisisRound(get, set, step.result.sl)) };
    },
    /** Extermination des nuisibles : MDG 14 l.98-104 ; MDG 15 l.161, l.176 */
    'equipage-extermination': (get, set, step) => {
      if (!step.result) return;
      const vessel = get().vessel;
      const inf = vessel?.infestation;
      if (!vessel || !inf) return;
      const rng = battleRng();
      const { total: progres, done, sl } = extendedTestStep(inf.progres, step.result, inf.drCible);
      get().avancerLHorloge(rollDice(1, 10, rng) * 60); // « Chaque Test nécessite … 1d10 heures » (MDG 14 l.100)
      const { infestation: _exterminee, ...sansInfestation } = vessel;
      set({ vessel: done ? sansInfestation : { ...vessel, infestation: { ...inf, progres, ...(sl < 0 ? { assaillie: true as const } : {}) } } });
      const j = [t(done ? 'sv.verminCleared' : 'sv.verminProgress', { label: inf.label, progress: progres, need: inf.drCible })];
      noteSeaLine(get, set, j);
      return { consequences: freeCons(j) };
    },
    /** Renflouage d'un ÉCHOUAGE (MDG 13 l.471-473, #444) : Test de Force UNIQUE (pas étendu — RAW muet
     *  sur une répétition formelle) ; échec → le navire reste échoué, retenté le lendemain (même construction). */
    'mer-degagement': (get, set, step) => {
      if (!step.result) return;
      const sea = get().travelPlan?.sea;
      if (!sea?.stranded) return;
      const label = sea.stranded.label;
      // MDG 13 l.473
      const j = step.result.success
        ? [t('sv.freedFromStrand', { hazard: label })]
        : [t('sv.stillStranded', { hazard: label })];
      if (step.result.success) patchSea(get, set, { stranded: undefined });
      noteSeaLine(get, set, j);
      return { consequences: freeCons(j) };
    },
    /** Dégagement des Débris marins (MDG 13 l.491, #444) : Test ÉTENDU de Force (`hazard.freeTest`, total
     *  DR posé à la collision) — même cumul mutualisé que l'Extermination (`extendedTestStep`) ci-dessus. */
    'mer-degagement-debris': (get, set, step) => {
      if (!step.result) return;
      const sea = get().travelPlan?.sea;
      if (!sea?.entangled) return;
      const ent = sea.entangled;
      const { total: progress, done } = extendedTestStep(ent.progress, step.result, ent.need);
      let j: string[];
      if (done) {
        patchSea(get, set, { entangled: undefined });
        j = [t('sv.disentangled', { label: ent.label, progress, need: ent.need })];
      } else {
        patchSea(get, set, { entangled: { ...ent, progress } });
        j = [t('sv.disentangleProgress', { label: ent.label, progress, need: ent.need })];
      }
      noteSeaLine(get, set, j);
      return { consequences: freeCons(j) };
    },
    /** Voyage rapide (MDG 15 l.28) : le DR alimente le palier — calculé/persisté PUIS appliqué (embuscade
     *  ancrée éventuelle d'abord, jamais raconté avant — `finalizeFastVoyage` est RÉ-ENTRANT). */
    'equipage-voyage-rapide': (get, set, step) => {
      if (!step.result) return;
      moralDuTestDEquipage(get, set, step);
      computeFastPalier(get, set, step.result.sl);
      finalizeFastVoyage(get, set);
    },
    /** Entretien du soir (remplace le Métier à −2 DR, MDG 14 l.116-124 ; réparation TEMPORAIRE ch.13 l.647). */
    'equipage-entretien': (get, set, step) => {
      if (!step.result) return;
      const total = step.result.sl;
      const rng = battleRng();
      const adj = total + REPARATION.entretienCrewTestDR;
      let j: string[];
      if (adj >= 1) {
        const hull = get().travelPlan!.vehicle!;
        const healed = Math.min(hull.wounds.max - hull.wounds.current, tirer(REPARATION.temporaire.woundsPerRepair, rng));
        healVesselHull(get, set, hull, healed);
        poserLaReparationTemporaire(get, set); // MDG 13 l.651
        // MDG 14 l.122
        j = [t('sv.juryRepairs', { n: healed, dr: `${adj >= 0 ? '+' : ''}${adj}` })];
      } else j = [t('sv.juryRepairsKo', { dr: adj })];
      noteSeaLine(get, set, j);
      return { consequences: freeCons(j) };
    },
    /** CHOIX face au navire hostile (A5.3 #327). fuir → Poursuite ; combattre → abordage immédiat ;
     *  se soumettre → pillage `pirate-pillage-pct` de la cale + CHOIX du tribut (étape insérée). */
    'merPiratesSommation': (get, set, step) => {
      const j: string[] = [];
      if (step.chosen === 'combattre') {
        startChaseBoarding(get, set); // abordage immédiat (rencontre AUTHORÉE de la route)
      } else if (step.chosen === 'soumettre') {
        const pct = Number(rule('pirate-pillage-pct'));
        const vessel = get().vessel;
        if (vessel?.cargo?.length) {
          const r = spoilCargoByPct(vessel.cargo, pct);
          if (r.removed) set({ vessel: { ...get().vessel!, cargo: r.lots } });
          j.push(t('sv.pillaged', { enc: r.removed, pct }));
        } else j.push(t('sv.pillagedEmpty'));
        const tribut = choiceStep({
          id: 'merPiratesTribut', kind: 'merPiratesTribut', icon: 'nautique/vent', actorId: seaDecider(get),
          label: t('step.seaTribut'), defaultChoice: 'livrer',
          options: [
            { key: 'livrer', label: t('opt.livrerEquipage'), detail: t('sv.detailLivrer') },
            { key: 'refuser', label: t('opt.refuser'), detail: t('sv.detailRefuser') },
          ],
        });
        return { consequences: freeCons(j), ...(tribut ? { insert: [tribut] } : {}) };
      } else {
        startSeaPursuit(get, set, garanti(get().travelPlan?.sea?.boarding, 'merPiratesSommation', 'navire hostile en vue'));
      }
      // La reprise du jour à la fermeture de cette cascade (`purpose:'test'` en mer) est portée par
      // `dispatchCascadeDone` → `runSeaDay` (couture canonique de clôture, jamais un `setTimeout` ad hoc).
      return { consequences: freeCons(j) };
    },
    /** TRIBUT à Stromfels (A5.3 #327) : livrer un marin = perte réelle d'équipage (`applyVesselCrewLoss`) +
     *  déplaisir de Manann (facteur de Moral RAW −2d10, MDG 14 : sacrifier une âme à Stromfels, ennemi de
     *  Manann) ; refuser = abordage immédiat. AUCUNE perte silencieuse (tout dénoué au journal/à l'écran). */
    'merPiratesTribut': (get, set, step) => {
      const j: string[] = [];
      if (step.chosen === 'refuser') {
        j.push(t('sv.tributeRefused'));
        startChaseBoarding(get, set);
      } else {
        for (const l of applyVesselCrewLoss(get, set, 1)) j.push(l);
        j.push(t('sv.sailorGiven'));
        const ship = get().travelPlan?.vehicle;
        if (ship) for (const l of applyShipMoraleDelta(get, set, ship, -rollDice(2, 10, battleRng()))) j.push(l); // déplaisir de Manann (MDG 14)
      }
      return { consequences: freeCons(j) };
    },
    /** Désertion (MDG 14 l.192-202, dé de MONDE par `openWorldTest`) : la boucle d100/marin réelle (INCHANGÉE, même seuil,
     *  mêmes tirages via `battleRng()`) vit ICI — l'étape `merDesertion` n'est que le vecteur de visibilité
     *  MJ. La FINALISATION de l'accostage (`finalizePortArrival`) est portée par le champ `portArrival` de la
     *  cascade et jouée à sa clôture par `dispatchCascadeDone` (#387) — plus de `setTimeout` de reprise. */
    'merDesertion': (get, set, step) => {
      if (!step.result) return;
      const journal = resolveShoreLeaveDesertion(get, set, battleRng());
      return { consequences: freeCons(journal) };
    },
  } satisfies PartDeTable<'appliers', typeof GENRES_D_ETAPE>,
  reglesDeSucces: {
    [CREW_TEST_SUCCESS_RULE]: crewTestSuccess,
  } satisfies PartDeTable<'reglesDeSucces', typeof REGLES_DE_SUCCES>,
  famillesTirables: [
    tableDesEvenementsDeBord,
  ],
  interruptionsDePeril: {
    /** Périls d'AUTEUR de la route (`route.perils`) lus JOUR PAR JOUR — MÊME patron que le terrestre
     *  (travelFlow) : tirage à `chancePct` %, effets appliqués (butin attribué hors combat) ; un effet
     *  `startCombat`/`transition` INTERROMPT la traversée (reprise via `reprendreLeVoyage`). Renvoie `true` si
     *  la traversée s'est arrêtée là (combat/transition d'auteur). */
    // PROTOCOLE DE REPRISE MARITIME : les effets d'un péril interrompant s'appliquent SUR-LE-CHAMP —
    // `reprendreLeVoyage` rejoue la traversée après le combat/la transition. Déclaré au flux ; la chance de
    // chaque péril, elle, est une étape de MONDE construite par la source unique (`authorPerils.ts`).
    [SEA_PERIL_INTERRUPT]: applyPerilEffectsNow,
  } satisfies PartDeTable<'interruptionsDePeril', typeof INTERRUPTIONS_DE_PERIL>,
} satisfies FragmentDeTables;
