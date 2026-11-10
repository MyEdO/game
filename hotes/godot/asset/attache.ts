import { estObjet } from '../../../src/lib/objet.mjs';

/** Un repère posé dans un autre : son origine et sa rotation XYZ en radians. */
export interface Repere {
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
}

/** Un point d'attache sur un os, dans le repère de l'os. */
export interface Attache extends Repere {
  readonly os: string;
}

/** Un emplacement qu'offre une pièce skinnée (`emplacements` de son manifeste, #3844) : un point d'attache qui suit la
 *  pièce. */
export interface EmplacementOffert extends Attache {
  /** par os de la base, son poids, de somme 1 : l'emplacement suit le mélange des déplacements de ces os depuis leur
   *  repos, comme un sommet de la pièce sous lui ; absent, il suit `os` seul. */
  readonly poids?: Readonly<Record<string, number>>;
}

/** L'écart toléré entre la somme des `poids` d'un emplacement offert et 1. */
export const TOLERANCE_DES_POIDS = 1e-3;

export const estListeDeChaines = (v: unknown): v is string[] => Array.isArray(v) && v.every((e) => typeof e === 'string');
export const estTriplet = (v: unknown): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every((e) => typeof e === 'number' && Number.isFinite(e));

/** `v` est un `Repere` seul, sans autre champ. */
export const estRepere = (v: unknown): v is Repere => estObjet(v) && estTriplet(v.position) && estTriplet(v.rotation) && Object.keys(v).length === 2;

/** La ligne du rang-ième objet rangé au point `point` : le point même pour le premier, `<point>#<rang>` ensuite ; une
 *  pièce offre la case d'un rang sous cette ligne (#3844). */
export const ligneAuRang = (point: string, rang: number): string => (rang > 1 ? `${point}#${rang}` : point);

/** Le rang de la case `<point>#<rang>` (`ligneAuRang`), entier d'au moins 2 ; `undefined` pour toute autre chaîne. */
export const rangDeCase = (id: string): number | undefined => {
  const lu = /^[^#]+#([2-9]|[1-9]\d+)$/.exec(id);
  return lu ? Number(lu[1]) : undefined;
};
