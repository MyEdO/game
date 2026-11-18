/**
 * La défaite (#4411) : l'issue du combat du dôme, son titre et son geste de sortie (`../../combat.md`, section
 * `fin-defaite`), sur la cour assombrie.
 */
import { BUSTES_DU_DOME, type MaquetteCapturee } from './maquette';

export default {
  planche: 'fin-du-combat',
  gabarits: ['recit'],
  decor: { scene: 'cour', variante: 'fin-defaite', bustes: BUSTES_DU_DOME },
} satisfies MaquetteCapturee;
