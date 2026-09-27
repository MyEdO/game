/**
 * PÉRILS EN MER — couche PURE de MDG 13 l.423-564, données verbatim dans `src/data/sea-perils.json`.
 * Les COLLISIONS elles-mêmes (Indice de Collision, facteurs) vivent déjà dans `collision.ts` — ici les
 * périls ENVIRONNEMENTAUX qui les déclenchent et leurs états propres :
 *  - **Échouer** (MDG 13 l.471-473) : le navire s'arrête net ; dégagement = Test de Force avec une pénalité
 *    égale au total d'Encombrement du navire et de sa cargaison.
 *  - **Icebergs / Débris marins / Rochers / Bas-fonds** (MDG 13 l.475-499) : IC moyens, chances d'échouage,
 *    empêtrement dans les débris (pénalité par Taille du bateau + Test étendu de Force pour se dégager).
 *  - **Détroits** (MDG 13 l.501-511) : entraînement au M du courant + pénalité aux Tests de Navigation.
 *  - **Tourbillons** (MDG 13 l.514-537) : M / Zone / Man / IC / Évasion des cinq gabarits.
 *  - **Gestion des périls** (MDG 13 l.429-438) : Perception pour repérer / Manœuvre pour éviter, par distance ;
 *    « Un Test d'Orientation est toujours nécessaire après avoir croisé un péril » (MDG 13 l.438).
 * Branché sur l'événement de bord `collision` (#444, `seaVoyageFlow.ts` `case 'collision'`) :
 * `pickSeaHazard` tire le péril, `strandingOccurs`/`strandingPenalty` l'Échouage (Rocher/Bas-fonds),
 * `debrisEntangleFor` l'empêtrement (Débris marins) — `damageHull`/`damageVesselHull` seuls écrivent
 * `state.vessel.wounds`. `perilManagement` (Perception/Manœuvre par distance, MDG 13 l.429-438) reste ORPHELIN :
 * aucune simulation de péril approchant à distance décroissante n'existe côté état (le tirage de bord est
 * un jet unique « sans prévenir ») — cf. rapport #444.
 */
import seaPerilsJson from '../data/sea-perils.json';
import { type RNG, defaultRNG } from './dice';
import type { CharKey, Difficulty } from './types';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import type { ShipSize } from '../data';

const SIZE_ORDER: ShipSize[] = ['minuscule', 'tres-petite', 'petite', 'moyenne', 'grande', 'enorme', 'monstrueuse'];

export interface SeaHazardDef {
  id: string;
  label: string;
  m?: number;
  ic: number;
  strandChancePct?: number;
  entangleChancePct?: number;
  entanglePenalties?: { minSize?: ShipSize; maxSize?: ShipSize; manDR: number; mMod: number }[];
  freeTest?: { skill?: RefDesignee; char?: CharKey; difficulty: Difficulty; totalDR: number };
  desc: string;
  /** Poids du TIRAGE parmi les périls d'une collision (#444) — MAISON : le RAW (MDG 13 l.475-499) ne donne
   *  aucune fréquence relative entre Icebergs/Débris marins/Rocher/Bas-fonds. Éditable ; absent = 1
   *  (équiprobable), voir `hazardsWeightNote` en tête de `sea-perils.json`. */
  weight?: number;
}

export interface StraitDef { id: string; label: string; m: number; navDR: number }

export interface WhirlpoolDef {
  id: string;
  label: string;
  m: number;
  zoneRadiusM: number;
  zoneSpiralM: number;
  manDR: number;
  ic: number;
  evasion: { difficulty: Difficulty; totalDR: number };
}

const DATA = seaPerilsJson as unknown as {
  echouer: { desc: string };
  hazards: SeaHazardDef[];
  detroits: StraitDef[];
  tourbillons: WhirlpoolDef[];
  tourbillonSwim: { skill: RefDesignee; difficulty: Difficulty };
  gestionDesPerils: { distanceM: number; spot: Difficulty; avoid: Difficulty }[];
};

export const SEA_HAZARDS = DATA.hazards;
export const findSeaHazard = (id: string): SeaHazardDef | undefined => DATA.hazards.find((h) => h.id === id);
export const findWhirlpool = (id: string): WhirlpoolDef | undefined => DATA.tourbillons.find((w) => w.id === id);

/** Tire le péril RENCONTRÉ lors d'une collision (Iceberg/Débris marins/Rocher/Bas-fonds) — pondéré par
 *  `SeaHazardDef.weight` (#444, MAISON : le RAW MDG 13 l.475-499 ne fixe aucune fréquence relative). PUR. */
export function pickSeaHazard(rng: RNG = defaultRNG): SeaHazardDef {
  const weights = DATA.hazards.map((h) => Math.max(0, h.weight ?? 1));
  const total = weights.reduce((s, w) => s + w, 0) || 1;
  let r = rng.int(1, total);
  for (let i = 0; i < DATA.hazards.length; i++) {
    r -= weights[i];
    if (r <= 0) return DATA.hazards[i];
  }
  return DATA.hazards[DATA.hazards.length - 1];
}

/** Difficultés de GESTION D'UN PÉRIL à `distanceM` (MDG 13 l.429-436) : Perception pour le repérer, Manœuvre
 *  pour l'éviter — la ligne la plus proche ≥ distance (100 m et plus = la plus permissive). PUR. */
export function perilManagement(distanceM: number): { spot: Difficulty; avoid: Difficulty } {
  const rows = [...DATA.gestionDesPerils].sort((a, b) => a.distanceM - b.distanceM);
  for (const r of rows) if (distanceM <= r.distanceM) return { spot: r.spot, avoid: r.avoid };
  return { spot: rows[rows.length - 1].spot, avoid: rows[rows.length - 1].avoid };
}

/** Pénalité de dégagement d'un ÉCHOUAGE (MDG 13 l.473) : « un Test de Force avec une pénalité égale au total
 *  de points d'Encombrement du navire et de sa cargaison ». PUR. */
export function strandingPenalty(shipEnc: number, cargoEnc: number): number {
  return -(Math.max(0, shipEnc) + Math.max(0, cargoEnc));
}

/** Le navire s'échoue-t-il sur ce péril (Rochers 20 % / Bas-fonds 40 %, MDG 13 l.497+499) ? PUR, le dé
 *  est FOURNI : il appartient au canal (`state` le tire par la porte, cf. `engine/dice.deMonde`). */
export function strandingOccurs(hazard: SeaHazardDef, roll: number): boolean {
  return hazard.strandChancePct != null && roll <= hazard.strandChancePct;
}

export interface EntangleResult { entangled: boolean; manDR: number; mMod: number }

/** Empêtrement dans des DÉBRIS MARINS après collision (MDG 13 l.485-489) : 20 % de chances ; pénalité par
 *  Taille du bateau (Minuscule-Petite −2 DR Man / −1 M ; Moyenne-Grande −1 DR Man ; au-delà rien). PUR,
 *  le dé est FOURNI (cf. `strandingOccurs`). */
export function debrisEntangleFor(hazard: SeaHazardDef, shipSize: ShipSize, roll: number): EntangleResult {
  if (hazard.entangleChancePct == null || roll > hazard.entangleChancePct) return { entangled: false, manDR: 0, mMod: 0 };
  const idx = SIZE_ORDER.indexOf(shipSize);
  for (const p of hazard.entanglePenalties ?? []) {
    const min = p.minSize ? SIZE_ORDER.indexOf(p.minSize) : 0;
    const max = p.maxSize ? SIZE_ORDER.indexOf(p.maxSize) : SIZE_ORDER.length - 1;
    if (idx >= min && idx <= max) return { entangled: true, manDR: p.manDR, mMod: p.mMod };
  }
  return { entangled: true, manDR: 0, mMod: 0 }; // Taille supérieure à Grande : « aucun effet » (MDG 13 l.489)
}
