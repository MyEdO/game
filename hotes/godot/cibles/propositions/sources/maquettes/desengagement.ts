/**
 * Se désengager (#4411) : Ilyanwe, engagée contre l'Orc, choisit comment rompre le combat (LDB 15 l.43-49, l.59-66) ;
 * sacrifier l'Avantage se ferme, sa raison lue au survol (`../../combat-suite.md`, section `desengagement`).
 */
import { COMBATTANTS, DIT, TOUR_D_ILYANWE } from './dome.ts';
import type { Ecran } from './maquette.ts';

export default {
  etats: [{
    nom: 'desengagement', gabarit: 'fenetre-du-bas', cour: { etat: 'desengagement' }, combattants: COMBATTANTS,
    combat: TOUR_D_ILYANWE([DIT.charge, 'Orc touche Ilyanwe la Voilée au bras droit.', 'Ilyanwe la Voilée veut rompre le combat.']),
    fenetre: {
      titre: 'Se désengager', heros: { role: 'heros', qui: 'ilyanwe', mise: { engagement: { avantage: 0, contre: 'orc', adverse: 1 } } },
      centre: {
        role: 'choix', groupes: [{
          cartes: [
            { nom: 'Sacrifier l’Avantage', detail: ['Quitter le combat sans Test'], refus: 'Il faut plus d’Avantages que l’adversaire.', survol: true },
            { nom: 'Esquive', detail: [{ test: 'Test opposé', seuil: 44 }, 'coûte l’Action'] },
            { nom: 'Fuir', detail: ['Orc : +1 Avantage, coup dans le dos +20', 'Touchée : encore +1, Test de Calme'], choisie: true },
          ],
        }],
      },
      gestes: [{ libelle: 'Fuir', principal: true }, { libelle: 'Annuler' }], reserves: [],
    },
  }],
} satisfies Ecran;
