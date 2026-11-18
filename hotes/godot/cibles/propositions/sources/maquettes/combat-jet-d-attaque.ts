/**
 * Le jet d'attaque tombé (#4411) : la fenêtre de jet du dôme après le dé de l'attaquant, ses gestes après le dé et les
 * réserves qu'ils dépensent (`../../combat.md`), sur la cour.
 */
import { BUSTES_DU_DOME, type MaquetteCapturee } from './maquette';

export default {
  planche: 'attaque-jet-tombe',
  gabarits: ['combat', 'fenetre-du-bas'],
  decor: { scene: 'cour', variante: 'jet', bustes: BUSTES_DU_DOME },
} satisfies MaquetteCapturee;
