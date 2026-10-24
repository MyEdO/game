/**
 * FORMES d'arme — DÉRIVÉES du registre auto-chargé `weapons/defs/` (1 arme = 1 fichier,
 * cf. scripts/gen-registry.mjs). Ce module reste le point d'accès « FORME » (métadonnées
 * sans l'art) consommé par le routage d'art (equipment.ts) et les scripts QC. L'ART et la
 * métadonnée vivent ensemble dans chaque `WeaponDef`.
 */
import { WEAPON_DEFS } from './weapons/_registry.generated';
import { SHIELD_DEFS } from './shields/_registry.generated';
import { norm } from '../../../lib/normalize';
export { norm }; // re-export (source unique) consommé par equipment.ts

/** Vue « forme » d'une arme (les champs de WeaponDef sans l'art). */
export interface WeaponForm { label: string; slug: string; type: 'melee' | 'ranged'; group: string; target: string; }
export interface ShieldForm { label: string; slug: string; target: string; }

/** Source de vérité = registre des armes (`weapons/defs/`). Vue forme (l'`art` reste porté par le def). */
export const WEAPON_FORMS: WeaponForm[] = WEAPON_DEFS;

// Dérivé du registre data-driven `shields/defs/` (même source que les armes), jamais un tableau en dur.
export const SHIELD_FORMS: ShieldForm[] = SHIELD_DEFS.map((d) => ({ label: d.label, slug: d.slug, target: d.target }));
