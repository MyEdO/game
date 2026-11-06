import { estObjet } from '../../../src/hote/formes.ts';

/** Un repère posé dans un autre : son origine et sa rotation XYZ en radians. */
export interface Repere {
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
}

/** Un point d'attache sur un os, dans le repère de l'os. */
export interface Attache extends Repere {
  readonly os: string;
}

export const estListeDeChaines = (v: unknown): v is string[] => Array.isArray(v) && v.every((e) => typeof e === 'string');
export const estTriplet = (v: unknown): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every((e) => typeof e === 'number' && Number.isFinite(e));

/** `v` est un `Repere` seul, sans autre champ. */
export const estRepere = (v: unknown): v is Repere => estObjet(v) && estTriplet(v.position) && estTriplet(v.rotation) && Object.keys(v).length === 2;
