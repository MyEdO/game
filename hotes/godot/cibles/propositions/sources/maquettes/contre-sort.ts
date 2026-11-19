/**
 * Le contre-sort (#4411) : le Chamane gobelin incante Fléchette sur Berta ; Ilyanwe déclare son Contre-sort avant les
 * jets (LDB 46 l.156 ; fiche `user-doctrine-declaration-avant-jets`), seule, unie à un lanceur du même Domaine (LDB 46
 * l.162) ou en passant, puis son jet opposé tombé, sur la cour (`../../combat-suite.md`, sections `contre-sort`).
 */
import { apresLeDe, COMBATTANTS, RESERVES, reserves, TOUR } from './dome.ts';
import type { Ecran } from './maquette.ts';

const COMBAT = TOUR(3, 4, ['chamane', 'orc'], ['Ilyanwe la Voilée lance Fléchette sur Orc.', 'Berta se met en Défensive.', 'Chamane gobelin incante Fléchette sur Berta.']);
const COUR = { etat: 'jet-de-defense', marques: ['vise' as const] };

export default {
  etats: [
    {
      nom: 'contre-sort-declaration', gabarit: 'fenetre-du-bas', cour: COUR, combattants: COMBATTANTS, combat: COMBAT,
      fenetre: {
        titre: 'Contre-sort',
        centre: {
          role: 'choix', annonce: { sort: 'Fléchette', lanceur: 'chamane', cible: 'berta' },
          groupes: [{
            cartes: [
              { nom: 'Contrer seul', detail: [{ test: 'Langue (Magick)', seuil: 85, contre: 52 }, { qui: 'berta', distance: 6, portee: 62 }], choisie: true },
              { nom: 'S’unir', detail: ['Test Soutenu, même Domaine'], refus: 'Aucun lanceur du même Domaine à portée.' },
              { nom: 'Passer', detail: ['Un seul Contre-sort par Round'] },
            ],
          }],
        },
        gestes: [{ libelle: 'Déclarer', principal: true }, { libelle: 'Annuler' }], reserves: [],
      },
    },
    {
      nom: 'contre-sort', gabarit: 'fenetre-du-bas', cour: COUR, combattants: COMBATTANTS, combat: COMBAT,
      fenetre: {
        titre: 'Contre-sort',
        heros: { role: 'testeur', qui: 'ilyanwe', test: 'Langue (Magick)', seuil: 85, jet: { des: [40, 2], dr: 4, reussite: true } },
        centre: { role: 'verdict', porte: { arme: 'Fléchette', cible: 'berta' }, drNet: 2, issue: 'Contre-sort d’Ilyanwe la Voilée : le Sort est dissipé.' },
        autre: { role: 'testeur', qui: 'chamane', test: 'Langue (Magick)', seuil: 52, jet: { des: [30, 7], dr: 2, reussite: true } },
        gestes: apresLeDe(RESERVES.ilyanwe), reserves: reserves(RESERVES.ilyanwe),
      },
    },
  ],
} satisfies Ecran;
