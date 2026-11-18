/**
 * Le jet d'attaque avant le dé (#4411) : la fenêtre d'attaque du dôme, la localisation à choisir et ses réglages, les
 * réserves du héros à gauche de « Lancer » (`../../combat.md`, section `jet-avant-le-de`), sur la cour.
 */
import { BUSTES_DU_DOME, type MaquetteCapturee } from './maquette';

export default {
  planche: 'attaque',
  gabarits: ['combat', 'fenetre-du-bas'],
  decor: { scene: 'cour', variante: 'jet-avant-le-de', bustes: BUSTES_DU_DOME },
} satisfies MaquetteCapturee;
