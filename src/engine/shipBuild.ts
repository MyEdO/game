/**
 * CONSTRUIRE UN NAVIRE (MDG 12 l.108-164) + INSTALLATION D'AMÉLIORATIONS (l.195-364) + RÉPARATIONS
 * (ch.13 l.639-651) — couche PURE, données verbatim dans `ship-construction.json` / `naval-traits.json`
 * (`install`) / `sea-navigation.json` (`reparation`).
 *
 * Construction en 4 étapes (l.110) : « la Taille du bateau ; son mode de propulsion ; si son style
 * affecte ou non la manœuvrabilité, la vitesse ou l'espace pour la cargaison ; et si des Traits ou des
 * Améliorations s'appliquent au navire. »
 *  1. Taille (l.114-129) : le tableau CARACTÉRISTIQUES DE BATEAU STANDARD donne coût/équipage/M/E/B/Contenance.
 *  2. Propulsion (l.131-133) : « Choisissez la méthode de propulsion principale et réduisez le Mouvement
 *     de l'autre méthode de 2 (jusqu'à un minimum de 3). À noter que les plus grandes catégories de
 *     vaisseaux ne peuvent pas être propulsés à la rame. »
 *  3. Manœuvrabilité (l.135-143) : −2 DR → −40 % ; −1 DR → −20 % ; +1 DR → +20 %.
 *  4. Vitesse (l.145-164) : Escargot… Foudroyant (M ±, Contenance ±%, Man, coût ±%).
 *  Traits de construction (l.167-193) : Peu maniable (−10 %/niveau), Renforcé (+10 E, −10 % Contenance,
 *  +10 %/niveau), Robuste (+10 %), Solide (+30 % B, −10 % Contenance, +20 %/niveau).
 *
 * Améliorations : les six barèmes MSRC 12 l.54-135 indexent le coût et le poids sur le type de bateau.
 * MDG 12 l.195-364 porte les barèmes de longueur et les taux par tranche de 5 m ou par cabine.
 * La Coque de course prend ses tranches de 10 m sur le gabarit fluvial (MSRC 12 l.21-25).
 *
 * Réparations (ch.13 l.639-651) : constructeur naval au port — « 1 CO par Blessure restaurée. Chaque
 * Test réussi prend 1d10 heures de travail et restaure 1d10 Blessures » ; Métier (Charpentier) à −10
 * (l.641) ; réparations TEMPORAIRES (l.647-651) : Complexe (−10) à Très Difficile (−30), 1 h et 1d10
 * Blessures par réparation, puis Test d'Endurance par jour de voyage et à chaque Manœuvre — chaque
 * échec inflige 1d10−4 Dégâts. Lissage : réparation +50 % sinon perte du bénéfice (ch.12 l.295).
 */
import { shipConstruction, STEAM_BREAKDOWNS, steamBreakdownDie, type SteamBreakdownEntry } from '../data';
import { findTableEntry } from './tables';
import { rollDice, tirer, type RNG } from './dice';
import { REPARATION } from './seaNavigation';
import { rollTest } from './tests';
import { DIFFICULTE_PAR_DEFAUT, type Difficulty } from './types';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import { findVehicleById } from '../data';
import type { ShipSize, NavalInstall, InstallBand, InstallBareme } from '../data';
import type { ProfilDePropulsion } from '../data/schemas/grammaire/valeurs';
import type { NavalTraitRef, VehicleData } from './types';
import type { ShipRig } from './combat';
import { navalTraitsDe, shipHasNavalTrait } from './navalTraits';
import { COMPETENCE_DU_MODE, type PropulsionKind } from './propulsion';
import { dureeEnJours } from './clock';

export { hullShipSize, shipSizeOfLength } from './coque';

/** Milieu du FLUX qui meut le navire (voyage maritime ou fluvial) — MDG 12 l.311 ; MSRC 12 l.255. */
export type MilieuDeNavigation = 'maritime' | 'fluvial';

/** Milieu du voyage en cours : fluvial sous `river`, maritime sinon (MDG 13 l.13). PUR. */
export function milieuDuVoyage(plan: { river?: unknown } | null | undefined): MilieuDeNavigation {
  return plan?.river ? 'fluvial' : 'maritime';
}

/** Compétence de la propulsion à vapeur (MDG 12 l.311 ; MDG 13 l.32 ; MSRC 12 l.255). */
export const STEAM_SKILL = { id: 'metier', spec: 'ingenieur' } as const;

/** Propulsion d'un navire dans un milieu : mode, M, Compétence de Navigation, gréement (colonne de
 *  Localisation, MDG 13). */
export interface PropulsionDuNavire {
  mode: 'vapeur' | PropulsionKind;
  m: number;
  competence: RefDesignee;
  rig: ShipRig;
}

/** Gréement d'un profil naval, voile et avirons ensemble = `mixte` (colonne de Localisation, MDG 13) ;
 *  `null` = ni voile ni avirons. PUR. */
export function rigDuNavire(vd: Pick<NonNullable<VehicleData['ship']>, 'sail' | 'oars'>): ShipRig | null {
  if (vd.sail && vd.oars) return 'mixte';
  if (vd.sail) return 'voile';
  return vd.oars ? 'avirons' : null;
}

/** Mode de conception : `mode` s'il est gréé, sinon la voile, sinon les avirons. MDG 13 l.17-24 ; #524. */
function modeDeConception(vd: NonNullable<VehicleData['ship']>, mode: PropulsionKind | undefined): { mode: PropulsionKind; m: number; competence: RefDesignee } | null {
  if (vd.sail && mode !== 'avirons') return { mode: 'voile', m: vd.sail.m, competence: { id: COMPETENCE_DU_MODE.voile, spec: vd.sail.spec } };
  if (vd.oars) return { mode: 'avirons', m: vd.oars.m, competence: { id: COMPETENCE_DU_MODE.avirons } };
  if (vd.sail) return { mode: 'voile', m: vd.sail.m, competence: { id: COMPETENCE_DU_MODE.voile, spec: vd.sail.spec } };
  return null;
}

/** Propulsion d'un navire, désigné par son couple (id de véhicule, améliorations) comme `navalTraitsDe`,
 *  dans le `milieu` du flux ; `mode` = le mode du jour d'un navire mixte. Vapeur : MDG 12 l.311
 *  (maritime), MSRC 12 l.255 (fluvial) ; voile, avirons : MDG 13 l.18-19 ; MSRC 07 l.172-178.
 *  `null` = aucune. PUR. */
export function propulsionDuNavire(vehicleId: string | undefined, upgrades: NavalTraitRef[] | undefined, milieu: MilieuDeNavigation, mode?: PropulsionKind): PropulsionDuNavire | null {
  const vd = findVehicleById(vehicleId ?? '')?.ship;
  if (!vd) return null;
  const rig = rigDuNavire(vd);
  const conception = modeDeConception(vd, mode);
  if (!conception || !rig) return null;
  const m = milieu === 'fluvial' ? (vd.fluvialMovement ?? conception.m) : conception.m;
  if (shipHasNavalTrait(navalTraitsDe(vehicleId, upgrades), 'propulsion-a-vapeur'))
    return { mode: 'vapeur', m: milieu === 'maritime' ? 4 : m, competence: STEAM_SKILL, rig };
  return { ...conception, m, rig };
}

export interface ShipBuildSpec {
  size: ShipSize;
  /** Méthode de propulsion PRINCIPALE (l.131) ; l'autre est réduite de 2, min 3 — si la catégorie l'offre. */
  primary: PropulsionKind;
  /** Garder la propulsion secondaire ? (les plus grandes catégories n'ont pas d'avirons du tout.) */
  secondary?: boolean;
  /** Modificateur de Manœuvre choisi (−2/−1/0/+1 DR, l.139-143). */
  manDR?: number;
  /** Trait de vitesse (l.149-164), défaut « moyen ». */
  speedTraitId?: string;
  /** Traits de construction (l.167-193) : id (catalogue `naval-traits.json`) → niveau. */
  traits?: { id: string; level: number }[];
}

export interface ShipBuildResult {
  size: ShipSize;
  sail?: ProfilDePropulsion;
  oars?: ProfilDePropulsion;
  manDR: number;
  e: number;
  b: number;
  capacity: number;
  crew: number;
  /** Coût FINAL en couronnes d'or (base × Σ des modificateurs de %). */
  costGold: number;
  traits: { id: string; level: number }[];
}

/** Construit un navire par les 4 étapes RAW (ch.12 l.108-164) + Traits de construction (l.167-193).
 *  Les % de coût s'appliquent tous AU COÛT DE BASE (« ajoutez 10 % au coût de base ») → additifs. PUR. */
export function buildShip(spec: ShipBuildSpec): ShipBuildResult {
  const std = shipConstruction.standard.find((r) => r.size === spec.size)!;
  const speed = shipConstruction.speedTraits.find((s) => s.id === (spec.speedTraitId ?? 'moyen')) ?? shipConstruction.speedTraits[3];
  const manChoice = shipConstruction.manoeuvrability.find((m) => m.manDR === (spec.manDR ?? 0)) ?? { manDR: 0, costPct: 0 };

  // Étape 2 — propulsion principale : l'autre méthode M −2, min 3 (l.133) ; supprimée si non gardée.
  const adjust = (m: number) => Math.max(shipConstruction.propulsion.secondaryMinM, m - shipConstruction.propulsion.secondaryMalus);
  let sail = std.sail ? { ...std.sail } : undefined;
  let oars = std.oars ? { ...std.oars } : undefined;
  if (spec.primary === 'voile' && oars) oars = spec.secondary ? { ...oars, m: adjust(oars.m) } : undefined;
  if (spec.primary === 'avirons' && sail) sail = spec.secondary ? { ...sail, m: adjust(sail.m) } : undefined;

  // Étape 4 — vitesse : M ± sur la propulsion principale, Contenance ±%, Man cumulée (l.147).
  if (spec.primary === 'voile' && sail) sail.m += speed.mMod;
  if (spec.primary === 'avirons' && oars) oars.m += speed.mMod;

  let capacityPct = speed.capacityPct;
  let costPct = manChoice.costPct + speed.costPct;
  let e = std.e;
  let bPct = 0;

  const traits = (spec.traits ?? []).filter((t) => t.level > 0);
  for (const t of traits) {
    const rule = shipConstruction.constructionTraits.find((r) => r.id === t.id);
    if (!rule) continue;
    const level = Math.min(t.level, rule.maxLevel);
    costPct += rule.costPctPerLevel * level;
    if (rule.ePerLevel) e += rule.ePerLevel * level;
    if (rule.bPctPerLevel) bPct += rule.bPctPerLevel * level;
    if (rule.capacityPctPerLevel) capacityPct += rule.capacityPctPerLevel * level;
  }

  return {
    size: spec.size,
    sail,
    oars,
    manDR: manChoice.manDR + speed.manDR,
    e,
    b: Math.round(std.b * (1 + bPct / 100)),
    capacity: Math.max(0, Math.round(std.capacity * (1 + capacityPct / 100))),
    crew: std.crew,
    costGold: Math.round(std.costGold * (1 + costPct / 100)),
    traits: traits.map((t) => ({ id: t.id, level: Math.min(t.level, shipConstruction.constructionTraits.find((r) => r.id === t.id)?.maxLevel ?? t.level) })),
  };
}

// ── Installation d'Améliorations (MDG 12 l.195-364, `NavalInstall`) ───────────────────────────

type CoqueAEquiper = { id: string; ship: Pick<NonNullable<VehicleData['ship']>, 'lengthM' | 'fluvialLengthM'> };

/** MDG 12 l.195-364 ; MSRC 12 l.54-135 */
function bandValue(bands: InstallBand[], lengthM: number, vehicleId: string | undefined): number {
  const bande = bands.find((b) => b.vehicules?.some((id) => id === vehicleId))
    ?? bands.find((b) => b.maxLengthM != null && lengthM <= b.maxLengthM)
    ?? bands[bands.length - 1];
  return dureeEnJours(bande?.value ?? 0);
}

/** Coût (CO), poids (Enc) ou durée de pose (jours) : bande du type ou de la longueur, × multiplicateur
 *  `per:'5m'` (« par tranche de 5 mètres de Taille », l.225/289 — tranches ENTAMÉES comptées) ou
 *  `per:'unite'` (× `units`). `'modele'` (Embarcation de bord) → `null` : le prix est celui du modèle
 *  embarqué, résolu par l'appelant ; sur la durée, l'appelant retombe sur `REPARATION.joursDePose`. PUR. */
export function installAmount(
  part: InstallBareme,
  coque: CoqueAEquiper | number,
  units = 1,
  milieu?: MilieuDeNavigation,
): number | null {
  if (part === 'modele') return null;
  const { id, ship } = typeof coque === 'number'
    ? { id: undefined, ship: { lengthM: coque, fluvialLengthM: undefined } }
    : coque;
  const lengthM = (milieu === 'fluvial' ? ship.fluvialLengthM : undefined) ?? ship.lengthM;
  const base = bandValue(part.bands, lengthM, id);
  if (part.per === '5m') return base * Math.max(1, Math.ceil(lengthM / 5));
  if (part.per === '10m') return base * Math.max(1, Math.ceil(lengthM / 10)); // MSRC 12 « pour 10 mètres » (Coque de course l.23)
  if (part.per === 'unite') return base * Math.max(1, units);
  return base;
}

/** Coût et poids de pose d'une Amélioration navale. MDG 12 l.195-364 ; MSRC 12 l.21-25, l.54-135. PUR. */
export function installCost(install: NavalInstall, coque: CoqueAEquiper | number, units = 1): { gold: number | null; enc: number | null } {
  return {
    gold: installAmount(install.installation, coque, units, install.milieu),
    enc: install.weightEnc ? installAmount(install.weightEnc, coque, units, install.milieu) : 0,
  };
}

// ── Réparations (MDG 13 l.639-651) ────────────────────────────────────────────────────────────

export interface RepairTick { roll: number; target: number; success: boolean; wounds: number; hours: number; costGold: number }

/** Facteur du coût de réparation d'une coque lissée ou non. MDG 12 l.295 */
const facteurDeLissage = (lissage: boolean): number => (lissage ? 1 + REPARATION.lissageRepairSurcoutPct / 100 : 1);

/** Prix au port de `wounds` Blessures restaurées, coque lissée ou non. MDG 13 l.643 ; MDG 12 l.295 */
export const prixDeLaReparation = (wounds: number, lissage: boolean): number =>
  wounds * REPARATION.portCostGoldPerWound * facteurDeLissage(lissage);

/** Enc de pièces détachées de navire que coûtent `wounds` Blessures restaurées, tranche entamée comptée, arrondi
 *  au-dessus, coque lissée ou non. MDG 15 l.306 ; MDG 12 l.295 */
export function piecesDeLaReparation(wounds: number, lissage: boolean): number {
  const { piecesEncParTranche: encParTranche, piecesBlessuresParTranche: blessuresParTranche } = REPARATION;
  return Math.ceil(Math.ceil(wounds / blessuresParTranche) * encParTranche * facteurDeLissage(lissage));
}

/** Blessures que `enc` Enc de pièces détachées de navire paient au plus, en tranches entières (réciproque de
 *  `piecesDeLaReparation`). MDG 15 l.306 ; MDG 12 l.295 */
export function blessuresPayeesParLesPieces(enc: number, lissage: boolean): number {
  const { piecesEncParTranche: encParTranche, piecesBlessuresParTranche: blessuresParTranche } = REPARATION;
  return blessuresParTranche * Math.floor(enc / (encParTranche * facteurDeLissage(lissage)));
}

/** UNE passe de réparation au PORT : Test de Métier (Constructeur de navires) à `skillValue`, ou de Métier
 *  (Charpentier) déjà pénalisé par l'appelant. MDG 13 l.641-643 ; MDG 12 l.295. PUR (RNG injecté). */
export function rollPortRepair(skillValue: number, woundsMissing: number, rng: RNG, opts: { lissage?: boolean; difficulty?: Difficulty } = {}): RepairTick {
  const t = rollTest(skillValue, opts.difficulty ?? DIFFICULTE_PAR_DEFAUT, rng);
  const hours = tirer(REPARATION.testHours, rng);
  if (!t.success) return { roll: t.roll, target: t.target, success: false, wounds: 0, hours, costGold: 0 };
  const wounds = Math.min(woundsMissing, tirer(REPARATION.woundsPerTest, rng));
  return { roll: t.roll, target: t.target, success: true, wounds, hours, costGold: prixDeLaReparation(wounds, !!opts.lissage) };
}

// ── Panne de Vapeur (MDG 12 l.313-352) ────────────────────────────────────────────────────────

/** Tirage du tableau PANNE DE VAPEUR (ch.12 l.313 : « Chaque fois que quelqu'un obtient un double sur
 *  un Test de Métier (Ingénieur) raté, que le résultat est un Échec Stupéfiant ou que le bateau subit
 *  un Coup Critique à la Coque »). PUR (RNG injecté). */
export function steamBreakdownFor(roll: number): SteamBreakdownEntry {
  return findTableEntry(STEAM_BREAKDOWNS, roll);
}

/** La Panne de Vapeur tirée au dé de son tableau (`steamBreakdownDie`). PUR (RNG injecté). */
export function rollSteamBreakdown(rng: RNG): SteamBreakdownEntry {
  return steamBreakdownFor(rollDice(steamBreakdownDie(), rng));
}

/** Le Test de Métier (Ingénieur) déclenche-t-il une Panne de Vapeur (ch.12 l.313) ? Double sur un Test
 *  RATÉ, ou Échec Stupéfiant (DR ≤ −6). PUR. */
export function steamBreakdownTriggered(t: { success: boolean; sl: number; isDouble?: boolean }): boolean {
  return !t.success && (!!t.isDouble || t.sl <= -6);
}
