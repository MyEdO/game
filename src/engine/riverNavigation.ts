/**
 * NAVIGATION FLUVIALE — couche PURE de **Mort sur le Reik — Compagnon, ch.5** (« Navigation fluviale »,
 * cité `MSRC 7 l.<ligne>`), données verbatim dans `src/data/river-navigation.json` + `river-perils.json`.
 * Pendant fluvial de `seaNavigation.ts` (mer, MDG). Les deux couches sont DISTINCTES parce que les tables
 * RAW le sont : la mer (MDG) a 6 forces de vent + rose des vents + Salissures + Orientation ; le fleuve
 * (MSRC 7) a une table de vent PROPRE (5 forces, direction RELATIVE arrière/côté/contraire — l.21-41),
 * un Test de Navigation SIMPLE (Voile OU Ramer, un par étape — l.11-15) et ses propres Critiques de bateau
 * (l.72-94). Ce qui est réellement COMMUN (boucle jour/jour, halte de nuit, entretien quotidien, coque
 * persistée) est réutilisé côté flux (`riverVoyageFlow` réutilise `openRest`/`runDailyUpkeep`/
 * `persistHullWounds` de la machinerie de voyage), pas ré-implémenté.
 *
 * RAW modélisé (MSRC 7) :
 *  - **Test de Navigation** = Voile OU Ramer selon l'embarcation, regroupés sous « Navigation » (l.11) ;
 *    UN par étape de voyage (l.15, renvoi aux règles de voyage EDOC). Barreur (voile) / meilleur rameur
 *    (barque) (l.13). **Savoir (Voies fluviales)** → +1 DR (fleuves/rivières/canaux uniquement, l.13).
 *  - **Ramer** = Compétence de base (tous peuvent) ; **Voile** non (l.17). Test d'**Agilité Intermédiaire
 *    (+0)** au début de chaque jour : échec → vitesse −20 % ce jour ; Échec spectaculaire (−6 DR) → ÷2 (l.17).
 *  - **Table des vents** (l.21-33) : Force 1d10 (Calme/Léger/Modéré/Fort/Très fort), Direction 1d10
 *    (arrière 1-3 / côté 4-7 / contraire 8-10). d10 à l'aube/midi/crépuscule/minuit : sur un 1, la force
 *    change d'un cran (bornes : Calme→Léger, Très fort→Fort). Effets % + Dérive/Louvoyer/Chavirage (l.37-41).
 *  - **Chavirage** (note 4, l.40) : Très fort de côté → retirer la voile (Navigation Accessible +20) sinon
 *    le bateau se renverse ; 1 Test de Navigation Accessible (+20)/Round pour redresser, chaque échec
 *    −5 cumulatif ; non redressé → coule en **BE tours** (Bonus d'Endurance).
 *  - **Critiques de bateau** (l.72-94) + **s'échouer** (12 Dégâts, l.99) + **« Y a un trou »** (coule en
 *    E minutes, −10 Nav/tour, −1 % vitesse/tour, l.101-105).
 *  - **Dangers** (l.119-166) : Débris, Barrage, Rochers, Eaux peu profondes — cf. `river-perils.json`.
 */
import riverNavJson from '../data/river-navigation.json';
import riverPerilsJson from '../data/river-perils.json';
import { RIVER_CRIT_SET, type ShipCritKey } from '../data/shipCriticals';
import { findTableEntry } from './tables';
import { basculesDeForce } from './forceDuVent';
import { memoParVersion } from '../data/versionDataset';
import { d10, d100, rollExpr, type RNG, defaultRNG } from './dice';
import { bonus } from './characteristics';
import type { Combatant, Difficulty } from './types';
import { RULE_REF } from './ruleRefs';
import type { ModLine } from './combat';

// ── Types de la table des vents (l.21-41) ────────────────────────────────────────────────────────

export type RiverWindForceId = 'calme' | 'leger' | 'modere' | 'fort' | 'tres-fort';
/** Direction du vent RELATIVE au bateau (MSRC 7 l.25-33) — pas une direction cardinale (≠ mer). */
export type RiverWindDirId = 'arriere' | 'cote' | 'contraire';

/** Cellule d'EFFET DU VENT (l.29-33) : % ajouté à la vitesse, ou un cas particulier (Dérive/Louvoyer/
 *  Chavirage/Gréement en péril). `pct` absent = pas de gain de vitesse (Dérive / Très fort de côté). */
export interface RiverWindEffect {
  /** % de vitesse (peut être négatif : vent contraire). */
  pct?: number;
  /** Calme (l.29) : le bateau dérive en aval à 25 % ; Tests de Navigation −10 (note 2, l.38). */
  drift?: boolean;
  /** Vent de côté Modéré/Fort (note 3, l.39) : le +% n'est acquis qu'en louvoyant (Navigation Accessible +20). */
  tack?: boolean;
  /** Très fort de côté (note 4, l.40) : retirer la voile ou chavirer. */
  capsizeRisk?: boolean;
  /** Très fort contraire (note 5, l.41) : Navigation Accessible (+20) sinon Critique au gréement + dérive. */
  riggingRisk?: boolean;
}

interface BandRow { id: string; label: string; min: number; max: number }
interface CritDef { driftUntilRepair?: boolean; hole?: boolean }

const DATA = riverNavJson as unknown as {
  windForces: BandRow[];
  windDirections: BandRow[];
  windTickThreshold: number;
  windTicksPerDay: number;
  windEffect: Record<string, Record<RiverWindDirId, RiverWindEffect>>;
  driftPctOfSpeed: number;
  driftNavPenalty: number;
  navBaseDifficulty: Difficulty;
  tackDifficulty: Difficulty;
  savoirVoiesFluvialesDR: number;
  rowingAgility: { difficulty: Difficulty; failSpeedPct: number; spectacularSL: number; spectacularSpeedFactor: number };
  capsize: { removeSailDifficulty: Difficulty; rightDifficulty: Difficulty; rightCumulativePenalty: number };
  outOfControl: { navPenalty: number };
  echouage: { hullDamage: number };
  temporaryRepair: { difficulty: Difficulty; charpentierPenalty: number; woundsPerRepair: string };
};

export const riverForces = memoParVersion('riverNavigation', (): RiverWindForceId[] => DATA.windForces.map((f) => f.id as RiverWindForceId));
export const navBaseDifficulty = (): Difficulty => DATA.navBaseDifficulty;
export const tackDifficulty = (): Difficulty => DATA.tackDifficulty;
export const CAPSIZE = DATA.capsize;
export const OUT_OF_CONTROL = DATA.outOfControl;
export const TEMPORARY_REPAIR = DATA.temporaryRepair;
export const driftPctOfSpeed = (): number => DATA.driftPctOfSpeed;
export const driftNavPenalty = (): number => DATA.driftNavPenalty;

export const riverForceLabel = (id: RiverWindForceId): string => DATA.windForces.find((f) => f.id === id)?.label ?? id;
export const riverDirLabel = (id: RiverWindDirId): string => DATA.windDirections.find((d) => d.id === id)?.label ?? id;

// ── Vent (l.21-41) ───────────────────────────────────────────────────────────────────────────────

/** Tire la force et la direction du vent en début de voyage (l.21 : « Lancez 2d10 … force et direction »). PUR. */
export function rollRiverWind(rng: RNG = defaultRNG): { force: RiverWindForceId; dir: RiverWindDirId } {
  return {
    force: findTableEntry(DATA.windForces, d10(rng)).id as RiverWindForceId,
    dir: findTableEntry(DATA.windDirections, d10(rng)).id as RiverWindDirId,
  };
}

/** UNE mise à jour de la force du vent (l.21). PUR. */
export function tickRiverWind(current: RiverWindForceId, rng: RNG = defaultRNG): RiverWindForceId {
  return basculesDeForce(riverForces(), current, DATA.windTickThreshold, 1, () => d10(rng));
}

/** Nombre de crans de force appliqués sur une JOURNÉE (4 tirages, l.21). PUR. */
export function tickRiverWindDay(current: RiverWindForceId, rng: RNG = defaultRNG): RiverWindForceId {
  return basculesDeForce(riverForces(), current, DATA.windTickThreshold, DATA.windTicksPerDay, () => d10(rng));
}

/** Effet du vent pour une force × direction relative (Tableau des vents, l.29-33). PUR. */
export function riverWindEffect(force: RiverWindForceId, dir: RiverWindDirId): RiverWindEffect {
  return DATA.windEffect[force]?.[dir] ?? {};
}

// ── Navigation (l.11-17) ─────────────────────────────────────────────────────────────────────────

/** Bonus de **Savoir (Voies fluviales)** aux Tests de Navigation (l.13 : « +1 DR … fleuves, rivières et
 *  canaux »). 0 si la Compétence n'est pas ACQUISE (le +1 DR récompense la formation, pas l'Int nue). PUR. */
export function savoirVoiesFluvialesBonus(c: Combatant): number {
  const adv = (c.skills ?? []).find((s) => s.id === 'savoir' && s.spec === 'voies-fluviales')?.advances ?? 0;
  return adv > 0 ? DATA.savoirVoiesFluvialesDR : 0;
}

/** Compétence de Navigation d'une embarcation (l.11-13) : **Voile** si le bateau porte une voilure, sinon
 *  **Ramer** (barque). Décision de DONNÉE (facette `ship.sail` du véhicule), même règle que la manœuvre
 *  navale (`shipManeuverParams`). PUR. */
export function riverPilotSkill(hasSail: boolean): 'voile' | 'ramer' {
  return hasSail ? 'voile' : 'ramer';
}

/** Le barreur garde-t-il le CONTRÔLE à l'issue du Test de Navigation de l'étape (l.15) ? Une réussite garde
 *  toujours le cap ; un ÉCHEC de peu est rattrapé par le +1 DR de **Savoir (Voies fluviales)** (l.13 :
 *  `navSL + savoir ≥ 0`). Sinon le contrôle est perdu → le courant emporte le bateau (dérive, note 2 l.38). PUR. */
export function riverControlKept(navSuccess: boolean, navSL: number, savoirBonus: number): boolean {
  return navSuccess || (savoirBonus > 0 && navSL + savoirBonus >= 0);
}

/** Facteur de vitesse du **Test d'Agilité** de rame du jour (l.17) : réussite → 1 ; échec → 1 + failSpeedPct
 *  (−20 % → 0,8) ; Échec spectaculaire (DR ≤ −6) → spectacularSpeedFactor (÷2 → 0,5). PUR. */
export function rowingAgilityFactor(success: boolean, sl: number): number {
  if (success) return 1;
  if (sl <= DATA.rowingAgility.spectacularSL) return DATA.rowingAgility.spectacularSpeedFactor;
  return 1 + DATA.rowingAgility.failSpeedPct / 100;
}
export const rowingAgilityDifficulty = (): Difficulty => DATA.rowingAgility.difficulty;

/** Km parcourus dans la JOURNÉE : distance de base (barge M × heures, EDOC — l.15) modulée par l'effet du
 *  vent (% l.29-33) et le facteur d'Agilité (l.17). Plancher 0. PUR. */
export function riverDayKm(baseKmPerDay: number, windPct: number, agilityFactor: number): number {
  return Math.max(0, baseKmPerDay * (1 + windPct / 100) * agilityFactor);
}

/** Distance de DÉRIVE en aval (note 2, l.38 ; hors de contrôle note 5, l.41) : 25 % de la vitesse de base. PUR. */
export function riverDriftKm(baseKmPerDay: number): number {
  return baseKmPerDay * (DATA.driftPctOfSpeed / 100);
}

/** MODIFICATEURS NOMMÉS du Test de Navigation du jour — MSRC 7 l.38 (dérive : « les Tests de
 *  **Navigation** subissent un malus de –10 ») et l.41 (« Les Tests de **Navigation** pour tenter de
 *  diriger le bateau subissent un malus de -20 »). Ce sont des MALUS, pas des Difficultés : la
 *  Difficulté du Test reste `navBaseDifficulty` (MSRC 7 l.15 demande le Test sans en fixer la
 *  Difficulté — le défaut Intermédiaire +0 est celui de la table, LDB 12 l.148). PUR. */
export function navPenaltyMods(state: { drift?: boolean; outOfControl?: boolean }): ModLine[] {
  const mods: ModLine[] = [];
  if (state.drift) mods.push({ label: 'Dérive', value: driftNavPenalty(), famille: 'jet', ref: RULE_REF['navigation-derive'] });
  if (state.outOfControl) mods.push({ label: 'Hors de contrôle', value: OUT_OF_CONTROL.navPenalty, famille: 'jet', ref: RULE_REF['navigation-greement'] });
  return mods;
}

// ── Chavirage (note 4, l.40) ─────────────────────────────────────────────────────────────────────


/** Difficulté RAW du Test de redressement (note 4, l.40 — Accessible). */
export const capsizeRightDifficulty = (): Difficulty => DATA.capsize.rightDifficulty;

/** Malus CUMULATIF par Round échoué du redressement (note 4, l.40) — chip NOMMÉE de la ligne. */
export const capsizeRightCumulative = (): number => DATA.capsize.rightCumulativePenalty;

/** Tours avant naufrage d'un bateau renversé non redressé (note 4, l.40) : Bonus d'Endurance de la coque. PUR. */
export function capsizeSinkTurns(hullEndurance: number): number {
  return bonus(hullEndurance);
}

/** Minutes avant naufrage d'une coque PERCÉE (« Y a un trou », l.103 : « coule en un nombre de minutes égal
 *  à son Endurance »). PUR. */
export function holeSinkMinutes(hullEndurance: number): number {
  return hullEndurance;
}

// ── Critiques de bateau (l.72-94) ────────────────────────────────────────────────────────────────

/** Vue « voyage » d'un Coup Critique de bateau fluvial (l.72-94), DÉRIVÉE de l'unique source
 *  `river-criticals.json` (la même que le combat lit via `RIVER_CRIT_SET`) — un seul fait RAW, deux vues.
 *  Chaque table MSRC n'a qu'une entrée (effet déterministe par Localisation, pas de sous-jet d10).
 *
 *  PÉRIMÈTRE (#1657 B3-2) : uniquement ce que la COQUE encaisse (États navals de `ops`), que le flux
 *  de voyage persiste dans son propre état (`river.broken`, `river.holed`). Ce que le coup fait à
 *  l'ÉQUIPAGE ne se dérive pas ici : voyage et combat lisent la même rangée par le même résolveur
 *  (`rollShipCritical` → `applyCrewHit`), qui rend son nœud `test` à la porte canonique. PUR. */
export function riverCritical(location: string): CritDef | undefined {
  const e = RIVER_CRIT_SET.tables[location as ShipCritKey]?.[0];
  if (!e) return undefined;
  const hasCond = (id: string) => e.ops?.some((o) => o.op === 'condition' && o.id === id) ?? false;
  return {
    driftUntilRepair: hasCond('derive') || undefined,
    hole: hasCond('voie-d-eau') || undefined,
  };
}

// ── Dangers (l.119-166) ──────────────────────────────────────────────────────────────────────────

export type RiverPerilKind = 'navTest' | 'obstacle' | 'detect';
export interface RiverPerilDef {
  id: string;
  label: string;
  kind: RiverPerilKind;
  /** Débris (l.125) : Test de Navigation raté → `hullHits` coups à la coque, `damagePerHit` chacun. */
  onFail?: { hullHits: number; damagePerHit: number };
  /** Barrage (l.128) : Endurance (`endurance`×`enduranceMult`), Blessures (`wounds`), bélier +`ramDamage`. */
  obstacle?: { endurance: string; enduranceMult: number; wounds: string; ramDamage: number };
  /** Déblayage à la main (l.128) : `objects` éléments de `encPerObject` Enc ; `encPerHour` = débit de
   *  halage (valeur maison éditable, l.128, règle stricte 7 — le halage n'y est pas chiffré en temps). */
  clear?: { objects: string; encPerObject: string; encPerHour: number };
  /** Rochers/eaux peu profondes (l.138-144) : à l'impact, Dégâts + chances de percée/échouage. */
  onHit?: { hullDamage: number; holeChancePct?: number; echouageChancePct?: number };
  ref: string;
}

export const RIVER_PERILS: RiverPerilDef[] = (riverPerilsJson as { perils: RiverPerilDef[] }).perils;
export const findRiverPeril = (id: string): RiverPerilDef | undefined => RIVER_PERILS.find((p) => p.id === id);

export interface RiverImpact {
  hullDamage: number;
  /** Coque percée (« Y a un trou ») — l.140 : rochers 50 % de chance. */
  holed: boolean;
  /** Le bateau s'échoue (l.140/144) : coque +12 Dégâts, à renflouer (Test de Force). */
  echoue: boolean;
}

/** Résout l'IMPACT sur un rocher / des eaux peu profondes (l.138-144) : Dégâts fixes à la coque, puis
 *  d100 de percée et d100 d'échouage selon les chances RAW. PUR (RNG injecté). */
export function resolveRiverImpact(onHit: NonNullable<RiverPerilDef['onHit']>, rng: RNG = defaultRNG): RiverImpact {
  return {
    hullDamage: onHit.hullDamage,
    holed: onHit.holeChancePct != null && d100(rng) <= onHit.holeChancePct,
    echoue: onHit.echouageChancePct != null && d100(rng) <= onHit.echouageChancePct,
  };
}

/** Endurance & Blessures d'un barrage de débris (l.128 : « Endurance de 1d10 × 10 et 2d10 de Blessures »). PUR. */
export function rollBarrage(obstacle: NonNullable<RiverPerilDef['obstacle']>, rng: RNG = defaultRNG): { endurance: number; wounds: number } {
  return { endurance: rollExpr(obstacle.endurance, rng) * obstacle.enduranceMult, wounds: rollExpr(obstacle.wounds, rng) };
}

/** Déblayage à la main d'un barrage (l.128 : « il faut déblayer 3d10 objets. Chaque élément a 4d10 Points
 *  d'Encombrement ») : `objects` éléments tirés, Encombrement TOTAL halé, converti en HEURES par le débit
 *  maison `encPerHour` (l.128, règle stricte 7 — plancher 1 h). PUR (RNG injecté). */
export function rollBarrageClearing(clear: NonNullable<RiverPerilDef['clear']>, rng: RNG = defaultRNG): { objects: number; enc: number; hours: number } {
  const objects = rollExpr(clear.objects, rng);
  let enc = 0;
  for (let i = 0; i < objects; i++) enc += rollExpr(clear.encPerObject, rng);
  return { objects, enc, hours: Math.max(1, Math.ceil(enc / clear.encPerHour)) };
}

/** Dégâts d'un bateau qui s'échoue (l.99 : « sa coque subit 12 Dégâts »). PUR. */
export const echouageDamage = (): number => DATA.echouage.hullDamage;
