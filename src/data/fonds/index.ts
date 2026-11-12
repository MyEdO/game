import type { FondDef } from './types';
import { FOND_DEFS } from './_registry.generated';

export type { FondDef } from './types';
export { FOND_DEFS };

/** Le cadre du dessin d'un fond (`FondDef.svg`). */
export const CADRE_DES_FONDS = { largeur: 320, hauteur: 96 };

/** Lookup par id, table dérivée du registre. */
export const FONDS: Record<string, FondDef> = Object.fromEntries(FOND_DEFS.map((f) => [f.id, f]));
