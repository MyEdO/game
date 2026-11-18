/**
 * Le sauvetage par le Destin (#4411) : un coup fatal frappe Ilyanwe ; elle brûle un Point de Destin pour l'éviter ou
 * survivre hors du combat, ou accepte son sort (LDB 17 l.29-32) (`../../combat-suite.md`, section
 * `sauvetage-par-le-destin`).
 */
import { COMBATTANTS, TOUR_DE_L_ORC } from './dome.ts';
import type { Ecran } from './maquette.ts';

export default {
  etats: [{
    nom: 'sauvetage-par-le-destin', gabarit: 'fenetre-du-bas', cour: { etat: 'sauvetage-par-le-destin' },
    combattants: { ...COMBATTANTS, ilyanwe: { ...COMBATTANTS.ilyanwe, blessures: 0 } },
    combat: TOUR_DE_L_ORC(['Orc s’avance vers Ilyanwe la Voilée.', 'Orc attaque Ilyanwe la Voilée.', 'Orc touche Ilyanwe la Voilée : un coup fatal.']),
    fenetre: {
      titre: 'Le Destin', heros: { role: 'heros', qui: 'ilyanwe', mise: { menace: 'Un coup fatal.' } },
      centre: {
        role: 'choix', groupes: [{
          cartes: [
            { nom: 'Éviter le coup', detail: ['−1 Destin · elle reste au combat'], choisie: true },
            { nom: 'Survivre hors du combat', detail: ['−1 Destin · elle quitte la rencontre'] },
            { nom: 'Accepter son sort', detail: ['Sans sacrifice, le héros meurt.'], funeste: true },
          ],
        }],
      },
      gestes: [{ libelle: 'Confirmer', principal: true }], reserves: [{ nom: 'Destin', valeur: 2 }],
    },
  }],
} satisfies Ecran;
