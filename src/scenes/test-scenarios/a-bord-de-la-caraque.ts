import { makePregens } from '../../data/pregens';
import { buildScene } from '../../noyau/mapSpec';
import type { TestScenario } from './_shared';

/**
 * À BORD DE LA CARAQUE (#3686). Une caraque posée par référence à son type (`MapSpec.navires`) dans un bassin, proue
 * à l'est, avec ses Sabords, son Nid-de-pie et son Embarcation de bord : ses quatre ponts, relevés sur les plans de
 * MDG 12 l.286, en exploration. Le groupe est à bord dans l'embelle et parcourt le navire, des cabines du château de
 * poupe à la cale, par les échelles de trappe, et monte à la hune. Aucune rencontre.
 */
export const scenario: TestScenario = {
  id: 'a-bord-de-la-caraque',
  order: 17,
  category: 'naval',
  icon: 'scenario/naval',
  title: 'À bord de la caraque',
  tests:
    // MDG 12 l.286
    'Une caraque posée dans un bassin par référence à son type : pont supérieur et château de poupe, pont principal, ' +
    'cale, gaillard et plage arrière parcourus à pied, chaque pièce de la légende nommée, les ponts reliés par leurs échelles de trappe ; ' +
    'ses Améliorations à bord : sabords clos de la batterie et du château, hune du Nid-de-pie, canot de l’Embarcation de bord.',
  partyNote: 'Explorez librement : les cabines du château, puis descendez en cale, ou montez sur la plage arrière et à la hune par les échelles.',
  construire: (idNeuf) => ({
    party: makePregens(idNeuf),
    scene: buildScene({
      id: 'a-bord-de-la-caraque',
      label: 'À bord de la caraque',
      size: [22, 9],
      terrain: 'eau',
      navires: [{ ref: 'caraque', id: 'caraque', x: 2, y: 2, cap: 'E', upgrades: [{ id: 'sabord' }, { id: 'nid-de-pie' }, { id: 'embarcation-de-bord' }] }],
      heroStart: { x: 14, y: 4, z: 2 },
    }),
  }),
};
