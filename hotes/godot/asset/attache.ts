/** Un point d'attache sur un os, dans le repère de l'os (rotation XYZ en radians). */
export interface Attache {
  readonly os: string;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
}

export const estListeDeChaines = (v: unknown): v is string[] => Array.isArray(v) && v.every((e) => typeof e === 'string');
export const estTriplet = (v: unknown): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every((e) => typeof e === 'number' && Number.isFinite(e));
