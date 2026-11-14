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
 * Joué par l'op de navire `perilDeMer` (`noyau/navireOps.ts`, `heurterLePeril` de `seaVoyageFlow.ts`) :
 * `strandingOccurs`/`strandingPenalty` l'Échouage (Rocher/Bas-fonds),
 * `debrisEntangleFor` l'empêtrement (Débris marins) — `damageHull`/`damageVesselHull` seuls écrivent
 * `state.vessel.wounds`. `perilManagement` (Perception/Manœuvre par distance, MDG 13 l.429-438) reste ORPHELIN :
 * aucune simulation de péril approchant à distance décroissante n'existe côté état (le tirage de bord est
 * un jet unique « sans prévenir ») — cf. rapport #444.
 */
import type { Difficulty } from './types';
import { seaPerils, type SeaPerilsData, type ShipSize } from '../data';
import type { ModLine } from './combat';
import type { CodexTarget } from './ruleRefs';
import { t } from '../i18n';

const SIZE_ORDER: ShipSize[] = ['minuscule', 'tres-petite', 'petite', 'moyenne', 'grande', 'enorme', 'monstrueuse'];

/** Un péril de navigation (MDG 13 l.475-499). */
export type SeaHazardDef = SeaPerilsData['hazards'][number];
/** Un tourbillon (MDG 13 l.514-537). */
export type WhirlpoolDef = SeaPerilsData['tourbillons'][number];

export const SEA_HAZARDS = seaPerils.hazards;
export const findSeaHazard = (id: string): SeaHazardDef | undefined => seaPerils.hazards.find((h) => h.id === id);
export const findWhirlpool = (id: string): WhirlpoolDef | undefined => seaPerils.tourbillons.find((w) => w.id === id);

/** Difficultés de GESTION D'UN PÉRIL à `distanceM` (MDG 13 l.429-436) : Perception pour le repérer, Manœuvre
 *  pour l'éviter — la ligne la plus proche ≥ distance (100 m et plus = la plus permissive). PUR. */
export function perilManagement(distanceM: number): { spot: Difficulty; avoid: Difficulty } {
  const rows = [...seaPerils.gestionDesPerils].sort((a, b) => a.distanceM - b.distanceM);
  for (const r of rows) if (distanceM <= r.distanceM) return { spot: r.spot, avoid: r.avoid };
  return { spot: rows[rows.length - 1].spot, avoid: rows[rows.length - 1].avoid };
}

/** Pénalité de dégagement d'un ÉCHOUAGE (MDG 13 l.473) : « un Test de Force avec une pénalité égale au total
 *  de points d'Encombrement du navire et de sa cargaison ». PUR. */
export function strandingPenalty(shipEnc: number, cargoEnc: number): number {
  return -(Math.max(0, shipEnc) + Math.max(0, cargoEnc));
}

/** Ligne de `strandingPenalty` sur la cible du Test de dégagement — SOURCE UNIQUE de la mer (MDG 13 l.473)
 *  et du fleuve (MSRC 7 l.99), `ref` = la règle du milieu. `null` sans Encombrement. PUR. */
export function strandingPenaltyLine(shipEnc: number, cargoEnc: number, ref: CodexTarget): ModLine | null {
  const value = strandingPenalty(shipEnc, cargoEnc);
  return value ? { label: t('tp.modStranding'), value, famille: 'circonstance', ref } : null;
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
