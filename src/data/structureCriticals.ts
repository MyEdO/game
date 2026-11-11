import structureCriticalsJson from './structure-criticals.json';
import { deDeTirageDe, rangeesDe, type RangeeDe } from './rangees';
import type * as critiquesDeStructure from './schemas/defs/structure-criticals';
import type { DeDeTable } from '../engine/tables';

/** Le dé AUTHORÉ des Critiques de Structure (`die`), lu VIVANT à l'appel. AA 10 l.112 */
export const structureCriticalsDie = (): DeDeTable => deDeTirageDe<typeof critiquesDeStructure>(structureCriticalsJson);

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
export type StructureCritEntry = RangeeDe<typeof critiquesDeStructure>;

export const STRUCTURE_CRITICALS = rangeesDe<typeof critiquesDeStructure>(structureCriticalsJson);
