/**
 * Modes de propulsion à Compétence de Navigation et Compétence de chaque mode — MDG 13 l.18-19, l.97.
 * Module FEUILLE (aucun import) : le schéma de véhicule et `shipBuild.ts` le lisent tous les deux.
 */

/** Modes de propulsion à Compétence de Navigation (MDG 13 l.18-19). */
export const PROPULSION_KINDS = ['voile', 'avirons'] as const;
export type PropulsionKind = typeof PROPULSION_KINDS[number];

/** Compétence de Navigation de chaque mode (MDG 13 l.18-19, l.97). */
export const COMPETENCE_DU_MODE: Readonly<Record<PropulsionKind, 'voile' | 'ramer'>> = { voile: 'voile', avirons: 'ramer' };

/** `skillId` est-elle la Compétence d'un mode de `PROPULSION_KINDS` (MDG 13 l.18-19, l.111) ? PUR. */
export function estCompetenceDePropulsion(skillId: string): boolean {
  return PROPULSION_KINDS.some((k) => COMPETENCE_DU_MODE[k] === skillId);
}
