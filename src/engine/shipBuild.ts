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
 * Améliorations : coût / poids d'installation par PALIER DE LONGUEUR (`NavalInstall`, verbatim ch.12 ;
 * MSRC 12 l.54-135 pour les Améliorations propres au MSRC — le RAW y tarife par TYPE de navire à
 * longueurs explicites, pas par `ShipSize`, #277) — `per:'5m'` = par tranche de 5 m de Taille (Blindage
 * l.225, Lissage l.289) ; `per:'unite'` = par cabine (l.240) ; `'modele'` = ceux du modèle embarqué
 * (Embarcation de bord, l.268).
 *
 * Réparations (ch.13 l.639-651) : constructeur naval au port — « 1 CO par Blessure restaurée. Chaque
 * Test réussi prend 1d10 heures de travail et restaure 1d10 Blessures » ; Métier (Charpentier) à −10
 * (l.641) ; réparations TEMPORAIRES (l.647-651) : Complexe (−10) à Très Difficile (−30), 1 h et 1d10
 * Blessures par réparation, puis Test d'Endurance par jour de voyage et à chaque Manœuvre — chaque
 * échec inflige 1d10−4 Dégâts. Lissage : réparation +50 % sinon perte du bénéfice (ch.12 l.295).
 */
import shipConstructionJson from '../data/ship-construction.json';
import steamBreakdownJson from '../data/steam-breakdown.json';
import { findTableEntry, findTableEntryIndex, tableOuverte } from './tables';
import { roll as rollDice, type RNG, defaultRNG } from './dice';
import { rollTest } from './tests';
import type { CharKey, Difficulty } from './types';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import { findVehicleById } from '../data';
import type { ShipSize, NavalInstall, InstallBand } from '../data';
import type { Combatant } from './types';

export type PropulsionKind = 'voile' | 'avirons';

/** Politique UNIQUE « voile si gréée, sinon avirons » (Compétence de Navigation par mode de
 *  propulsion, MDG 13 l.17-24) — SOURCE UNIQUE du mode/M de conception d'un navire, consommée par
 *  tout site qui décidait auparavant `sail?.m ?? oars?.m`/`sail ? … : …` chacun dans son coin
 *  (#524). `null` = ni voile ni avirons (fiche incomplète — la propulsion à vapeur ne passe pas
 *  par ici, elle a son propre M constant, ch.12 l.311). */
export function vesselPropulsion(vd: { sail?: { m: number }; oars?: { m: number } } | undefined): { mode: PropulsionKind; m: number } | null {
  if (vd?.sail) return { mode: 'voile', m: vd.sail.m };
  if (vd?.oars) return { mode: 'avirons', m: vd.oars.m };
  return null;
}

export interface StandardShipRow {
  size: ShipSize;
  costGold: number;
  crew: number;
  sail?: { m: number; crew: number };
  oars?: { m: number; crew: number };
  /** Colonne « Taille » du tableau standard (ch.12 l.122-129), en mètres ; `max: null` = la bande
   *  FINALE, que le livre imprime « 81+ » (l.129). */
  lengthM: { min: number; max: number | null };
  e: number;
  b: number;
  capacity: number;
}

export interface SpeedTrait { id: string; label: string; mMod: number; capacityPct: number; manDR: number; costPct: number }
interface ManRow { manDR: number; costPct: number }
interface ConstructionTraitRule { id: string; maxLevel: number; costPctPerLevel: number; ePerLevel?: number; bPctPerLevel?: number; capacityPctPerLevel?: number }

const DATA = shipConstructionJson as unknown as {
  standard: StandardShipRow[];
  propulsion: { secondaryMalus: number; secondaryMinM: number };
  manoeuvrability: ManRow[];
  speedTraits: SpeedTrait[];
  constructionTraits: ConstructionTraitRule[];
};


/** La colonne « Taille » (ch.12 l.122-129) telle que `findTableEntry` la lit — `tableOuverte`
 *  (`./tables`) est le tronc commun des tables dont la bande FINALE est ouverte (ici « 81+ », l.129).
 *  Triée par borne basse : les DEUX bornes étant authorées, l'ordre des rangées au Codex ne décide
 *  plus du résultat. La contiguïté, elle, est tenue en donnée (`ecartsDeCouverture`,
 *  `src/data/schemas/defs/ship-construction.ts`). */
const STANDARD_LOOKUP = tableOuverte(
  [...DATA.standard].sort((a, b) => a.lengthM.min - b.lengthM.min).map((row) => ({ ...row.lengthM, size: row.size })),
);

/**
 * Taille MDG d'un navire d'après sa LONGUEUR (tableau standard, ch.12 l.120-129 : 1-10 m Minuscule …
 * 81 m+ Monstrueuse) — SOURCE UNIQUE de la dérivation Taille ← longueur pour tout le moteur.
 *
 * Le livre imprime des bandes d'ENTIERS contiguës depuis 1 m, la dernière ouverte : le domaine de
 * cette fonction est donc l'entier ≥ 1, ce que le schéma exige du porteur
 * (`ship.lengthM: z.number().int().min(1)`, `src/data/schemas/defs/vehicles.ts`). Une longueur hors
 * de ce domaine — 0, négative, ou fractionnaire entre deux bandes — est une ANOMALIE NOMMÉE, jamais
 * un repli muet : `findTableEntry` rendrait « Monstrueuse » au dépassement, et retomber sur la
 * première bande rendrait « Minuscule » à un trois-mâts de 80,5 m.
 * PUR.
 */
export function shipSizeOfLength(lengthM: number): ShipSize {
  const i = findTableEntryIndex(STANDARD_LOOKUP, lengthM);
  if (i < 0) {
    throw new Error(
      `shipSizeOfLength : la longueur ${lengthM} m ne tombe dans aucune bande de la colonne « Taille » (MDG 12 l.122-129) — le tableau couvre les longueurs ENTIÈRES à partir de 1 m, sans plafond.`,
    );
  }
  return STANDARD_LOOKUP[i].size;
}

/**
 * Taille d'une COQUE EN JEU (`Combatant`) — sa longueur vit sur le TYPE de véhicule (`creatureId`,
 * `vehicles.json`), jamais recopiée sur l'instance : même patron que `hullNavalTraits`
 * (`./navalTraits`). `undefined` quand la coque n'a pas de profil naval (véhicule non navire, ou
 * type introuvable) — l'appelant NOMME ce cas. PUR.
 */
export function hullShipSize(hull: Combatant): ShipSize | undefined {
  const lengthM = findVehicleById(hull.creatureId ?? '')?.ship?.lengthM;
  return lengthM === undefined ? undefined : shipSizeOfLength(lengthM);
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
  sail?: { m: number; crew: number };
  oars?: { m: number; crew: number };
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
  const std = DATA.standard.find((r) => r.size === spec.size)!;
  const speed = DATA.speedTraits.find((s) => s.id === (spec.speedTraitId ?? 'moyen')) ?? DATA.speedTraits[3];
  const manChoice = DATA.manoeuvrability.find((m) => m.manDR === (spec.manDR ?? 0)) ?? { manDR: 0, costPct: 0 };

  // Étape 2 — propulsion principale : l'autre méthode M −2, min 3 (l.133) ; supprimée si non gardée.
  const adjust = (m: number) => Math.max(DATA.propulsion.secondaryMinM, m - DATA.propulsion.secondaryMalus);
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
    const rule = DATA.constructionTraits.find((r) => r.id === t.id);
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
    traits: traits.map((t) => ({ id: t.id, level: Math.min(t.level, DATA.constructionTraits.find((r) => r.id === t.id)?.maxLevel ?? t.level) })),
  };
}

// ── Installation d'Améliorations (MDG 12 l.195-364, `NavalInstall`) ───────────────────────────

/** Palier retenu pour `lengthM` : le PREMIER dont `maxLengthM` ≥ `lengthM` (triés croissants), sinon le
 *  DERNIER de la liste (bande ouverte, `maxLengthM: null`, #277). PUR. */
function bandValue(bands: InstallBand[], lengthM: number): number {
  for (const b of bands) if (b.maxLengthM != null && lengthM <= b.maxLengthM) return b.value;
  return bands.length ? bands[bands.length - 1].value : 0;
}

/** Coût (CO) ou poids (Enc) d'installation d'une Amélioration : palier de LONGUEUR × multiplicateur
 *  `per:'5m'` (« par tranche de 5 mètres de Taille », l.225/289 — tranches ENTAMÉES comptées) ou
 *  `per:'unite'` (× `units`). `'modele'` (Embarcation de bord) → `null` : le prix est celui du modèle
 *  embarqué, résolu par l'appelant. PUR. */
export function installAmount(
  part: NonNullable<NavalInstall['installation']>,
  lengthM: number,
  units = 1,
): number | null {
  if (part === 'modele') return null;
  const base = bandValue(part.bands, lengthM);
  if (part.per === '5m') return base * Math.max(1, Math.ceil(lengthM / 5));
  if (part.per === '10m') return base * Math.max(1, Math.ceil(lengthM / 10)); // MSRC 12 « pour 10 mètres » (Coque de course l.23)
  if (part.per === 'unite') return base * Math.max(1, units);
  return base;
}

/** Coût + poids d'installation d'une Amélioration navale sur une coque de `lengthM` mètres. PUR. */
export function installCost(install: NavalInstall, lengthM: number, units = 1): { gold: number | null; enc: number | null } {
  return {
    gold: installAmount(install.installation, lengthM, units),
    enc: install.weightEnc ? installAmount(install.weightEnc, lengthM, units) : 0,
  };
}

// ── Réparations (MDG 13 l.639-651) ────────────────────────────────────────────────────────────

export interface RepairTick { roll: number; target: number; success: boolean; wounds: number; hours: number; costGold: number }

/** UNE passe de réparation au PORT (l.643 : « 1 CO par Blessure restaurée. Chaque Test réussi prend
 *  1d10 heures de travail et restaure 1d10 Blessures ») — `skillValue` = Métier (Constructeur de
 *  navires), ou Métier (Charpentier) déjà pénalisé de −10 par l'appelant (l.641). `lissage` : le coût
 *  monte de 50 % (ch.12 l.295). PUR (RNG injecté). */
export function rollPortRepair(skillValue: number, woundsMissing: number, rng: RNG = defaultRNG, opts: { lissage?: boolean; difficulty?: Difficulty } = {}): RepairTick {
  const t = rollTest(skillValue, opts.difficulty ?? 'intermediaire', rng);
  const hours = rollDice(1, 10, rng);
  if (!t.success) return { roll: t.roll, target: t.target, success: false, wounds: 0, hours, costGold: 0 };
  const wounds = Math.min(woundsMissing, rollDice(1, 10, rng));
  const costGold = wounds * (opts.lissage ? 1.5 : 1);
  return { roll: t.roll, target: t.target, success: true, wounds, hours, costGold };
}

/** UNE réparation TEMPORAIRE en mer (l.647-649) : Complexe (−10) à Très Difficile (−30) selon les
 *  conditions ; réussie → 1 heure, 1d10 Blessures. Le navire devra tester son Endurance par jour de
 *  voyage et à chaque Manœuvre (l.651) — suivi par l'appelant (`temporaryPatched`). PUR. */
export function rollTemporaryRepair(skillValue: number, woundsMissing: number, difficulty: Difficulty, rng: RNG = defaultRNG): RepairTick {
  const t = rollTest(skillValue, difficulty, rng);
  return { roll: t.roll, target: t.target, success: t.success, wounds: t.success ? Math.min(woundsMissing, rollDice(1, 10, rng)) : 0, hours: 1, costGold: 0 };
}

/** Dégâts d'une réparation temporaire qui CÈDE (l.651 : « Chaque Test raté inflige 1d10–4 Dégâts »),
 *  plancher 0. PUR. */
export function temporaryRepairFailureDamage(rng: RNG = defaultRNG): number {
  return Math.max(0, rollDice(1, 10, rng) - 4);
}

// ── Panne de Vapeur (MDG 12 l.313-352) ────────────────────────────────────────────────────────

export interface SteamBreakdownEntry {
  min: number;
  max: number;
  id: string;
  type: 'steam-breakdown';
  label: string;
  desc: string;
  mMod?: number;
  mSet?: number;
  durationRounds?: string;
  /** Refroidissement obligatoire avant réparation (Rupture du réservoir, MDG 12 l.344) : « attendre
   *  20+1d10 minutes » — minutes d'horloge d'immobilisation du moteur. */
  coolMinutes?: string;
  failDamage?: string;
  engineDestroyed?: boolean;
  hullCritical?: boolean;
  compartmentDamage?: number;
  restart?: { skill?: RefDesignee; char?: CharKey; difficulty: Difficulty; extendedDR?: number }[];
}

export const STEAM_BREAKDOWNS = steamBreakdownJson as SteamBreakdownEntry[];

/** Tirage du tableau PANNE DE VAPEUR (ch.12 l.313 : « Chaque fois que quelqu'un obtient un double sur
 *  un Test de Métier (Ingénieur) raté, que le résultat est un Échec Stupéfiant ou que le bateau subit
 *  un Coup Critique à la Coque »). PUR (RNG injecté). */
export function steamBreakdownFor(roll: number): SteamBreakdownEntry {
  return findTableEntry(STEAM_BREAKDOWNS, roll);
}

/** Le Test de Métier (Ingénieur) déclenche-t-il une Panne de Vapeur (ch.12 l.313) ? Double sur un Test
 *  RATÉ, ou Échec Stupéfiant (DR ≤ −6). PUR. */
export function steamBreakdownTriggered(t: { success: boolean; sl: number; isDouble?: boolean }): boolean {
  return !t.success && (!!t.isDouble || t.sl <= -6);
}
