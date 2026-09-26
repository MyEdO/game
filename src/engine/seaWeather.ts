/**
 * MÉTÉO DE LA MER DES GRIFFES — couche PURE de MDG 13 « Navigation maritime » (l.162-306),
 * données verbatim dans `src/data/sea-weather.json`.
 *
 * RAW modélisé :
 *  - Tirage QUOTIDIEN des 4 aspects (Précipitations / Température / Visibilité / Vents) : « Lancez le
 *    dé pour chaque aspect » (l.164), 1d10 + saison (« ajoutez 2 au résultat pour les mois d'automne
 *    et de printemps et 4 pour l'hiver », l.164) ; mer chaude : « soustrayez 2 au résultat (minimum
 *    de 1) des lancers pour la Température et la Visibilité » (l.166).
 *  - Rose des vents (l.250-260) : 1-6 dominant, 7 nord, 8 sud, 9 ouest, 10 est.
 *  - Aspect du vent (l.262-270) : direction du vent COMPARÉE au cap du navire → vent arrière /
 *    latéral (bâbord-tribord) / de face.
 *  - Mise à jour du vent « à l'aube, à midi, au crépuscule et à minuit » (l.272) : 1d10, sur 1 le
 *    vent change d'un cran (autant de chances de forcir que de mollir ; Calme plat ne peut que
 *    devenir Légère brise, Violente tempête que Vent violent).
 *  - Effet du vent (l.276-286) : % ajouté au M AVANT tout autre modificateur (l.274) ; avant la
 *    barre = voiles, après = autres propulsions. Encalminé (l.296-300), Affaler les voiles
 *    (l.288-294 : Test de Navigation Intermédiaire (+0), échec → Critique sur les voiles ; sans
 *    ancre, dérive à 25 % de la vitesse dans le sens du vent), Virement de bord (l.302-304 : le
 *    bonus n'est acquis que sur un Test de Navigation Intermédiaire (+0) réussi).
 *  - **Clinfoc** (MDG 12 l.246-264) : un navire à voiles doté de l'Amélioration utilise le
 *    tableau « EFFET DU VENT (CLINFOC) » à la place — passé par `rigging: 'clinfoc'`.
 *  - **Gréement de course** (MSRC 12 l.137) : DELTA de % voiles sur le tableau standard (+10 % vent
 *    arrière/de côté, malus de vent contraire réduit de 5 %) — passé par `rigging: 'greement'` ; inclut
 *    un clinfoc mais les deux ne se cumulent pas (le Gréement prime).
 *  - Effets des Précipitations (l.187-201), Température (l.203-225 : Tests d'Exposition périodiques
 *    + eau à boire), Visibilité (l.227-243 : −DR aux Tests de Projectiles/Orientation/Perception
 *    basés sur la vue au-delà d'une distance).
 */
import seaWeatherJson from '../data/sea-weather.json';
import { findTableEntry } from './tables';
import { d10, type RNG, defaultRNG } from './dice';
import { WORK_PERIOD_HOURS } from './seaNavigation';
import type { Difficulty } from './types';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import type { Season } from './travelStages';
import { rule } from './policy';

export type SeaPrecipitationId = 'aucune' | 'legeres' | 'abondantes' | 'tres-abondantes';
export type SeaTemperatureId = 'caniculaire' | 'chaude' | 'mediane' | 'froide' | 'glaciale';
export type SeaVisibilityId = 'degage' | 'brume' | 'brouillard' | 'puree-de-pois';
export type SeaWindForceId = 'calme-plat' | 'legere-brise' | 'brise-fraiche' | 'vent-modere' | 'vent-violent' | 'violente-tempete';
/** Direction du vent (rose des vents, l.250) — `dominant` = vents d'ouest sur la Mer des Griffes (l.253). */
export type WindDirection = 'nord' | 'sud' | 'est' | 'ouest';
/** Aspect du vent par rapport au cap (l.262-270). */
export type WindAspect = 'arriere' | 'lateral' | 'face';

export interface SeaWeather {
  precipitations: SeaPrecipitationId;
  temperature: SeaTemperatureId;
  visibilite: SeaVisibilityId;
  vent: SeaWindForceId;
}

interface WeatherRow { min: number; max: number; precipitations: string; temperature: string; visibilite: string; vent: string }
interface PrecipitationDef { id: string; label: string; desc?: string; skillMods?: { skills: RefDesignee[]; mod: number }[]; otherMod?: number }
interface TemperatureDef { id: string; label: string; testEveryHours?: number; difficulty?: Difficulty; exposure?: 'chaleur' | 'froid'; litresParJour?: number }
interface VisibilityDef { id: string; label: string; drPenalty?: number; beyondM?: number }
/** Cellule du tableau EFFET DU VENT : % voiles / % autres, ou Encalminé / Affaler / Virement de bord. */
export interface WindEffectCell { pctSail?: number; pctOther?: number; encalmine?: boolean; affaler?: boolean; virement?: boolean }

const DATA = seaWeatherJson as unknown as {
  table: WeatherRow[];
  seasonMod: Record<Season, number>;
  warmSeaMod: number;
  precipitations: PrecipitationDef[];
  temperatures: TemperatureDef[];
  visibilites: VisibilityDef[];
  vents: { id: string; label: string }[];
  roseDesVents: { min: number; max: number; direction: string }[];
  effetDuVent: Record<string, Record<WindAspect, WindEffectCell>>;
  effetDuVentClinfoc: Record<string, Record<WindAspect, WindEffectCell>>;
  effetDuVentGreementDelta: Record<WindAspect, number>;
  affaler: { difficulty: Difficulty; failCritLocation: string; driftPctOfSpeed: number };
  encalmine: { currentM: number; towM: number; towManDR: number };
};

/** Ordre croissant des forces de vent (pour le cran ±1 de la mise à jour, l.272). */
export const WIND_FORCES: SeaWindForceId[] = DATA.vents.map((v) => v.id as SeaWindForceId);

/** Lookup STRICT d'une fiche de `sea-weather.json` — FAIL-FAST NOMINATIF (patron
 *  `data/overrides.ts::miscastEntries`, frère terrestre `travelStages.ts::weatherCondition`) : un `!`
 *  rendait `undefined` puis plantait plus loin, sans dire QUEL id manquait ni dans quel volet. */
function ficheMer<T extends { id: string }>(volet: string, liste: readonly T[], id: string): T {
  const trouve = liste.find((e) => e.id === id);
  if (!trouve) throw new Error(`sea-weather.json : « ${id} » absent de ${volet} (ids : ${liste.map((e) => e.id).join(', ')}).`);
  return trouve;
}

export const precipitationDef = (id: SeaPrecipitationId): PrecipitationDef => ficheMer('precipitations', DATA.precipitations, id);
export const temperatureDef = (id: SeaTemperatureId): TemperatureDef => ficheMer('temperatures', DATA.temperatures, id);
export const visibilityDef = (id: SeaVisibilityId): VisibilityDef => ficheMer('visibilites', DATA.visibilites, id);
export const windForceLabel = (id: SeaWindForceId): string => ficheMer('vents', DATA.vents, id).label;
export const AFFALER_RULES = DATA.affaler;

/** Libellé compact d'une météo (journal / recap). */
export function seaWeatherLabel(w: SeaWeather): string {
  return `${precipitationDef(w.precipitations).label} · ${temperatureDef(w.temperature).label} · ${visibilityDef(w.visibilite).label} · ${windForceLabel(w.vent)}`;
}

/** Tire la météo du jour (l.164-166) : 1d10 + saison PAR ASPECT ; mer chaude → −2 (min 1) sur
 *  Température et Visibilité. PUR (RNG injecté). */
export function rollSeaWeather(season: Season, rng: RNG = defaultRNG, warmSea = false): SeaWeather {
  const mod = DATA.seasonMod[season] ?? 0;
  const aspect = (warm: boolean): WeatherRow => {
    let r = d10(rng) + mod;
    if (warm) r = Math.max(1, r + DATA.warmSeaMod);
    return findTableEntry(DATA.table, r);
  };
  return {
    precipitations: aspect(false).precipitations as SeaPrecipitationId,
    temperature: aspect(warmSea).temperature as SeaTemperatureId,
    visibilite: aspect(warmSea).visibilite as SeaVisibilityId,
    vent: aspect(false).vent as SeaWindForceId,
  };
}

/** Direction du vent (rose des vents, l.250-260). `dominantDirection` = vents dominants du plan
 *  d'eau (Mer des Griffes : ouest, l.253 — paramétrable par carte). PUR. */
export function rollWindDirection(rng: RNG = defaultRNG, dominantDirection: WindDirection = 'ouest'): WindDirection {
  const dir = findTableEntry(DATA.roseDesVents, d10(rng)).direction;
  return dir === 'dominant' ? dominantDirection : (dir as WindDirection);
}

/** Aspect du vent pour un navire faisant route vers `heading` (l.262-270) : un vent du nord souffle
 *  DEPUIS le nord → cap au nord = vent de face ; cap au sud = vent arrière ; est/ouest = latéral. PUR. */
export function windAspect(heading: WindDirection, windFrom: WindDirection): WindAspect {
  if (heading === windFrom) return 'face';
  const opposite: Record<WindDirection, WindDirection> = { nord: 'sud', sud: 'nord', est: 'ouest', ouest: 'est' };
  return opposite[heading] === windFrom ? 'arriere' : 'lateral';
}

/** Mise à jour du vent « à l'aube, à midi, au crépuscule et à minuit » (l.272) : 1d10, sur 1 le vent
 *  change d'un cran (50/50 forcir/mollir ; bornes : Calme plat → Légère brise, Violente tempête →
 *  Vent violent). PUR — renvoie la nouvelle force. */
export function tickWindForce(current: SeaWindForceId, rng: RNG = defaultRNG): SeaWindForceId {
  if (d10(rng) !== 1) return current;
  const i = WIND_FORCES.indexOf(current);
  const up = d10(rng) <= 5;
  // Bornes RAW : « Le Calme plat ne peut devenir qu'une Légère brise et une Violente tempête ne peut
  // devenir qu'un Vent violent » (l.272) — le cran aux bornes est FORCÉ, pas annulé.
  const next = i === 0 ? 1 : i === WIND_FORCES.length - 1 ? WIND_FORCES.length - 2 : i + (up ? 1 : -1);
  return WIND_FORCES[next];
}

/** Gréement du navire modulant l'EFFET DU VENT : `clinfoc` = tableau ALTERNATIF de l'Amélioration Clinfoc
 *  (MDG 12 l.256-264) ; `greement` = Gréement de course (MSRC 12 l.137), DELTA sur le tableau STANDARD. */
export type SailRigging = 'none' | 'clinfoc' | 'greement';

/** Cellule d'EFFET DU VENT pour une force × aspect (l.276-286), selon le `rigging` : `clinfoc` → tableau de
 *  l'Amélioration Clinfoc (MDG 12 l.256-264 — voiles seulement) ; `greement` → Gréement de course
 *  (MSRC 12 l.137), qui ajoute un DELTA de % voiles au tableau standard (+10 % vent arrière ou de côté ;
 *  vent contraire : malus réduit de 5 %) — sans effet quand les voiles ne portent pas (Encalminé/Affaler). PUR. */
export function windEffect(force: SeaWindForceId, aspect: WindAspect, rigging: SailRigging = 'none'): WindEffectCell {
  const std = DATA.effetDuVent[force][aspect];
  if (rigging === 'greement') {
    if (std.encalmine || std.affaler || std.pctSail == null) return std; // voiles affalées → le gréement n'aide pas
    return { ...std, pctSail: std.pctSail + DATA.effetDuVentGreementDelta[aspect] };
  }
  if (rigging !== 'clinfoc') return std;
  const c = DATA.effetDuVentClinfoc[force][aspect];
  // Le tableau Clinfoc ne donne que la colonne voiles — le % « autres propulsions » reste celui du standard.
  return { ...c, ...(c.pctOther == null && std.pctOther != null && !c.affaler && !c.encalmine ? { pctOther: std.pctOther } : {}) };
}

/** M effectif d'un navire sous le vent (l.274 : « ajoutés au M du bateau … avant d'appliquer tout autre
 *  modificateur ») : `null` = les voiles n'avancent pas (Encalminé, ou Affaler les voiles). Un vaisseau à
 *  propulsion NON-voile applique la colonne « autres » (jamais Encalminé/Affaler). Arrondi au plus proche,
 *  plancher 0. PUR. */
export function windAdjustedM(baseM: number, cell: WindEffectCell, sailPowered: boolean): number | null {
  if (sailPowered && (cell.encalmine || cell.affaler)) return null;
  const pct = sailPowered ? cell.pctSail ?? 0 : cell.pctOther ?? 0;
  return Math.max(0, Math.round(baseM * (1 + pct / 100)));
}

/** Malus PLAT d'une Visibilité réduite sur un Test basé sur la vue (Projectiles / Orientation /
 *  Perception, l.231-243), la cible étant à `distanceM` mètres : −1/−2/−3 DR au-delà de 20/10/5 m. PUR. */
export function visibilityDRPenalty(vis: SeaVisibilityId, distanceM: number): number {
  const def = visibilityDef(vis);
  return def.drPenalty != null && def.beyondM != null && distanceM > def.beyondM ? def.drPenalty : 0;
}

/** Modificateur de Précipitations sur un Test de Compétence `skillId` (spécialisation `spec`), l.187-201.
 *  Une référence SANS `spec` couvre toute spécialisation ; une référence AVEC `spec` ne couvre que
 *  celle-là. Hors liste : `otherMod`, sinon 0. PUR. */
export function precipitationSkillMod(precip: SeaPrecipitationId, skillId: string, spec?: string): number {
  const def = precipitationDef(precip);
  const couvre = (r: RefDesignee): boolean => r.id === skillId && (r.spec == null || r.spec === spec);
  return def.skillMods?.find((m) => m.skills.some(couvre))?.mod ?? def.otherMod ?? 0;
}

/** Litres d'eau à boire PAR JOUR et par membre d'équipage : la bande de Température (Caniculaire 4 L,
 *  Chaude 3 L — l.209/213), sinon le régime de bord « 2 à 3 litres d'eau par jour » (MDG 14 l.242 —
 *  fourchette, valeur maison, règle `sea-water-litres-mediane`). PUR. */
export function dailyWaterLitres(temp: SeaTemperatureId): number {
  return temperatureDef(temp).litresParJour ?? Number(rule('sea-water-litres-mediane'));
}

/** Tests d'Exposition d'une JOURNÉE en mer pour la bande de Température (l.203-225 : « Toutes les
 *  deux/quatre heures, effectuez un Test de Résistance… »). Le jour de voyage ne se simule pas heure
 *  par heure : la période EXPOSÉE sur le pont = UNE Période de travail à la voile (8 h, l.107) →
 *  8 ÷ cadence Tests par jour (bandes 4 h → 2 Tests ; bandes 2 h → 4 — mêmes comptes que la nuit
 *  dehors d'`exposureNight` : difficile 2 / extrême 4). Médiane → 0 (« tolérable », l.217). PUR. */
export function seaExposureTestsPerDay(temp: SeaTemperatureId): number {
  const def = temperatureDef(temp);
  if (!def.exposure || !def.testEveryHours) return 0;
  return Math.max(1, Math.round(WORK_PERIOD_HOURS.voile / def.testEveryHours));
}
