import structureCriticalsJson from './structure-criticals.json';

/**
 * Blessures critiques sur une STRUCTURE — Aux Armes « Tableau des Blessures critiques sur une Structure »
 * (p.120), transcrites verbatim. 3ᵉ FAMILLE du modèle de coque, alignée sur `ship-criticals.json`
 * (navire) et `problemes-vehicule.json` (véhicule) : le RAW dit lui-même que Structure / Véhicule /
 * Navire suivent le MÊME patron Endurance/Blessures + table de Critiques (AA 10 l.13/116).
 *
 * Un Critique de Structure est tiré sur un d100 (double + ≥25 % des PB retirés, ou tout coup à 0 PB).
 * Champs :
 *  - `wounds` : Blessures SUPPLÉMENTAIRES perdues par la Structure (`0` pour une Blessure Triviale « T »,
 *    AA 07 l.77-79 ; `null` quand la Structure est `destroyed`).
 *  - `trivial` : Blessure Triviale (« T ») — n'inflige aucune Blessure et ne compte pas vers la destruction.
 *  - `destroyed` : « Effondrement » → la Structure entière s'écroule.
 *  - `note` : effets verbatim sur les PERSONNES (Dégâts = Bonus d'Endurance, Tests d'Athlétisme, couvert,
 *    Limite d'Encombrement) — appliqués par le résolveur de combat (qui connaît occupants/couvert).
 */
export interface StructureCritEntry {
  min: number;
  /** `null` : « 96 ou plus », AA 10 l.127 (`BandeOuverte`, `engine/tables`). */
  max: number | null;
  /** id STABLE (slug) — toute réf passe par lui, jamais le `label`. */
  id: string;
  label: string;
  /** Blessures supplémentaires de la Structure (0 = Triviale ; null = détruite). */
  wounds: number | null;
  /** Blessure Triviale (« T », AA 07 l.77-79) : 0 Blessure, ne compte pas vers la destruction. */
  trivial?: boolean;
  /** « Effondrement » : la Structure est détruite. */
  destroyed?: boolean;
  note: string;
}

export const STRUCTURE_CRITICALS = (structureCriticalsJson as { entries: StructureCritEntry[] }).entries;
/** Libellé de la table (rangée de tirage `TableRollLine`). */
export const STRUCTURE_CRITICALS_LABEL: string = structureCriticalsJson.label;
