/**
 * La mutation que la Corruption menace (#4411) : les Points de Corruption de Berta débordent son seuil ; elle renie la
 * Corruption au prix d'un Point de Résilience, ou mute (LDB 19 l.70, l.76 ; LDB 17 l.67)
 * (`../../combat-suite.md`, section `corruption-mutation`).
 */
import { COMBATTANTS, RESERVES, TOUR_DE_BERTA } from './dome.ts';
import type { Ecran } from './maquette.ts';

export default {
  etats: [{
    nom: 'corruption-mutation', gabarit: 'fenetre-du-bas', cour: { etat: 'corruption-mutation' }, combattants: COMBATTANTS,
    combat: TOUR_DE_BERTA(['Berta : +2 Points de Corruption (total 7).', 'Berta : la Corruption déborde son seuil.', 'Berta échoue à contenir sa Corruption.']),
    fenetre: {
      titre: 'La mutation menace', heros: { role: 'heros', qui: 'berta', mise: { corruption: { points: 7, seuil: 6 } } },
      centre: {
        role: 'choix', groupes: [{
          cartes: [
            { nom: 'Je te renie !', detail: ['−1 Résilience · aucune mutation', 'Les Points de Corruption restent'], choisie: true },
            { nom: 'Muter', detail: ['−3 Points, le Bonus de Force Mentale', 'La mutation se tire au d100'], funeste: true },
          ],
        }],
      },
      gestes: [{ libelle: 'Confirmer', principal: true }], reserves: [{ nom: 'Résilience', valeur: RESERVES.berta.resilience }],
    },
  }],
} satisfies Ecran;
