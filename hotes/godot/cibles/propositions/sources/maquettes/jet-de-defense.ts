/**
 * Le jet de Défense tombé (#4411) : la fenêtre de Défense du dôme après les deux dés, le défenseur à gauche,
 * l'attaquant en miroir (`../../combat.md`, section `jet-de-defense`), sur la cour.
 */
import { BUSTES_DU_DOME, type MaquetteCapturee } from './maquette';

export default {
  planche: 'defense-jet-tombe',
  gabarits: ['combat', 'fenetre-du-bas'],
  decor: { scene: 'cour', variante: 'jet-de-defense', bustes: BUSTES_DU_DOME },
} satisfies MaquetteCapturee;
