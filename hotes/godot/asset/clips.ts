/**
 * LA TABLE RÔLE D'ANIMATION → CLIP D'UN MANIFESTE (#2972, #3253) : pour chaque rôle que le corps joue
 * (`ROLES_D_ANIMATION`, `src/noyau/animation.ts`), le nom de son clip dans le GLB ; à deux mains, une table par maniement
 * (`MANIEMENTS`, #3319). Son contrôle lit le vocabulaire du
 * noyau : il vit dans le graphe de l'hôte (`modeles.ts`), hors de celui de l'évaluateur (`charger.mjs`).
 */
import { MANIEMENTS, ROLES_D_ANIMATION, type Maniement, type RoleDAnimation } from '../../../src/noyau/index.ts';

export type TableDeClips = Readonly<Partial<Record<RoleDAnimation, string>>>;
/** Par maniement, la table des rôles que le corps joue en tenant des deux mains un objet de ce maniement. */
export type TablesDeuxMains = Readonly<Partial<Record<Maniement, TableDeClips>>>;

export interface EcartDeClip {
  readonly code: 'role-inconnu' | 'clip-absent' | 'maniement-inconnu';
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

/** Les maniements de `tables`, lues au champ `champ` du manifeste, hors du vocabulaire du noyau, puis les écarts de chaque
 *  table (`ecartsDeClips`). */
export function ecartsDesTablesDeuxMains(tables: TablesDeuxMains, animations: ReadonlySet<string>, champ = 'clipsDeuxMains'): EcartDeClip[] {
  const maniements = new Set<string>(MANIEMENTS);
  return Object.entries(tables).flatMap(([maniement, table]): EcartDeClip[] => [
    ...(maniements.has(maniement) ? [] : [{ code: 'maniement-inconnu' as const, ou: `${champ}.${maniement}`, detail: maniement }]),
    ...ecartsDeClips(table, animations, `${champ}.${maniement}`),
  ]);
}

/** Les clips de la table `prisesOccupees` du manifeste absents des `animations` du GLB. */
export function ecartsDesPrisesOccupees(prises: Readonly<Record<string, unknown>>, animations: ReadonlySet<string>): EcartDeClip[] {
  return Object.keys(prises).flatMap((clip): EcartDeClip[] => (animations.has(clip) ? [] : [{ code: 'clip-absent', ou: `prisesOccupees.${clip}`, detail: clip }]));
}
