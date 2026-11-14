import { FAMILLES_DE_COUCHES } from './_registry.generated';
import type { CoucheDePaysage } from './types';
import type { IdDeCoucheGenere } from '../paysages.generated';

export type { CoucheDePaysage } from './types';

/** L'id d'une couche de paysage : union générée depuis les defs (`npm run gen`). */
export type IdDeCouche = IdDeCoucheGenere;

/** Le cadre du dessin d'une couche (`CoucheDePaysage.svg`). */
export const CADRE_DES_PAYSAGES = { largeur: 960, hauteur: 360 };

/** Lookup par id, table dérivée du registre. */
export const COUCHES_DE_PAYSAGE: Record<string, CoucheDePaysage> = Object.fromEntries(FAMILLES_DE_COUCHES.flat().map((c) => [c.id, c]));
