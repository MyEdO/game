/**
 * Le Coup Critique (#4411) : Ilyanwe frappe l'Orc à la tête, les Blessures qu'il perd et l'effet du livre (LDB 18
 * l.65), le héros qui frappe à gauche, l'Orc touché à droite (`../../dispositions.md`, arbitrage 17), sur la cour
 * (`../../combat.md`, section `coup-critique`).
 */
import { COMBATTANTS, DIT, TOUR_D_ILYANWE } from './dome.ts';
import type { Ecran } from './maquette.ts';

export default {
  etats: [{
    nom: 'coup-critique', gabarit: 'fenetre-du-bas', cour: { etat: 'coup-critique' }, combattants: { ...COMBATTANTS, orc: { ...COMBATTANTS.orc, blessures: 9 } },
    combat: TOUR_D_ILYANWE([DIT.orc, DIT.charge, 'Ilyanwe la Voilée touche Orc (Tête) : 10 dégâts − 7 (BE+PA) = 3 Blessures — CRITIQUE !']),
    fenetre: {
      titre: 'Coup critique',
      heros: { role: 'heros', qui: 'ilyanwe', mise: { critiqueSur: 'orc' } },
      centre: { role: 'critique', nom: 'Coup percutant', effet: 'Le sang obscurcit votre vision, et vous percevez des points blancs et des flashs de lumière. Vous obtenez 1 État Sonné.' },
      autre: { role: 'touche', qui: 'orc', zone: 'tete', atteinte: 'Touché à la tête', blessures: 2 },
      gestes: [{ libelle: 'Continuer', principal: true }], reserves: [],
    },
  }],
} satisfies Ecran;
