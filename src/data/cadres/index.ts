import type { CadreDef } from './types';
import { CADRE_DEFS } from './_registry.generated';

export type { CadreDef } from './types';
export { CADRE_DEFS };

/** Le cadre du dessin d'un cadre de panneau (`CadreDef.svg`). */
export const CADRE_DES_CADRES = { largeur: 128, hauteur: 128 };

/** Lookup par id, table dérivée du registre. */
export const CADRES: Record<string, CadreDef> = Object.fromEntries(CADRE_DEFS.map((c) => [c.id, c]));
