/**
 * Le Coup Critique (#4411) : la fenêtre du Critique que le combat du dôme sert au premier Coup Critique, sa
 * localisation, les Blessures perdues et l'effet du livre (LDB 18 l.65), sur la cour (`../../combat.md`, section
 * `coup-critique`).
 */
import { BUSTES_DU_DOME, type Ecran } from './maquette';

export default {
  etats: [{ nom: 'coup-critique', planche: 'coup-critique', gabarits: ['combat', 'fenetre-du-bas'], decor: { scene: 'cour', variante: 'coup-critique', bustes: BUSTES_DU_DOME } }],
} satisfies Ecran;
