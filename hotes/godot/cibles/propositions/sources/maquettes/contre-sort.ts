/**
 * Le contre-sort (#4411) : le Chamane gobelin incante Fléchette sur Berta ; Ilyanwe déclare son Contre-sort avant les
 * jets (LDB 46 l.156 ; `reglage.contreSort.declaration`, fiche `user-doctrine-declaration-avant-jets`), seule, unie à un
 * lanceur du même Domaine (LDB 46 l.162) ou en passant, puis son jet opposé tombé, sur la cour (`../../combat-suite.md`,
 * sections `contre-sort`).
 */
import { ligne } from '../../../../../../src/hote/elements';
import { apresLeDe, BERTA, cartes, CHAMANE, fenetreSurLeDome, ILYANWE, jet, ORC, reglageDe, RESERVES, reserves, type TourDuDome } from './dome';
import type { Ecran } from './maquette';

const TOUR: TourDuDome = {
  tour: 'Round 1 · tour 3 sur 4', suite: [ILYANWE, BERTA], round: 'Round 2', ordre: [ORC, CHAMANE],
  journal: ['Ilyanwe la Voilée lance Fléchette sur Orc.', 'Berta se met en Défensive.', 'Chamane gobelin incante Fléchette sur Berta.'],
};

export default {
  etats: [
    fenetreSurLeDome('contre-sort-declaration', 'Contre-sort, la déclaration avant les jets', 'jet-de-defense', TOUR, {
      titre: 'Contre-sort',
      corps: [ligne('annonce', 'Fléchette', 'neutre', 'Chamane gobelin · Cible : Berta')],
      reglages: [cartes(reglageDe('contreSort', 'declaration'), 'Déclarer le Contre-sort', [
        ['seul', 'Contrer seul', 'Langue (Magick) ≤ 85 contre ≤ 52\nBerta à 6 m · portée 62 m'],
        ['unir', 'S’unir', 'Test Soutenu, même Domaine', 'Aucun lanceur du même Domaine à portée.'],
        ['passer', 'Passer', 'Un seul Contre-sort par Round'],
      ], 0)],
      gestes: [],
    }),
    fenetreSurLeDome('contre-sort', 'Contre-sort, les jets opposés tombés', 'jet-de-defense', TOUR, {
      titre: 'Contre-sort',
      corps: [ligne('arme', 'Fléchette'), ligne('cible', 'Cible : Berta'), jet('jet', ILYANWE, 'Langue (Magick)', '≤ 85', { resultat: '42', dr: '+4', reussite: true }),
        jet('defense', CHAMANE, 'Langue (Magick)', '≤ 52', { resultat: '37', dr: '+2', reussite: true }), ligne('drNet', 'DR net +2'), ligne('issue', 'Contre-sort d’Ilyanwe la Voilée : le Sort est dissipé.')],
      gestes: apresLeDe('contreSort', { reussi: true, chance: RESERVES.ilyanwe.chance, resilience: RESERVES.ilyanwe.resilience }), reserves: reserves(RESERVES.ilyanwe),
    }),
  ],
} satisfies Ecran;
