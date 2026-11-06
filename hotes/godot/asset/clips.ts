/**
 * LA TABLE RÔLE D'ANIMATION → CLIP D'UN MANIFESTE (#2972, #3253) : pour chaque rôle que le corps joue
 * (`ROLES_D_ANIMATION`, `src/noyau/animation.ts`), le nom de son clip dans le GLB. Son contrôle lit le vocabulaire du
 * noyau : il vit dans le graphe de l'hôte (`modeles.ts`), hors de celui de l'évaluateur (`charger.mjs`).
 */
import { ROLES_D_ANIMATION, type RoleDAnimation } from '../../../src/noyau/index.ts';

export type TableDeClips = Readonly<Partial<Record<RoleDAnimation, string>>>;

export interface EcartDeClip {
  readonly code: 'role-inconnu' | 'clip-absent';
  readonly ou: string;
  readonly detail: string;
}

/** Les rôles de la table `clips`, lue au champ `champ` du manifeste, hors du vocabulaire du noyau, et ses clips absents
 *  des `animations` du GLB. */
export function ecartsDeClips(clips: TableDeClips, animations: ReadonlySet<string>, champ = 'clips'): EcartDeClip[] {
  const roles = new Set<string>(ROLES_D_ANIMATION);
  return Object.entries(clips).flatMap(([role, nom]): EcartDeClip[] => [
    ...(roles.has(role) ? [] : [{ code: 'role-inconnu' as const, ou: `${champ}.${role}`, detail: role }]),
    ...(animations.has(nom) ? [] : [{ code: 'clip-absent' as const, ou: `${champ}.${role}`, detail: nom }]),
  ]);
}
