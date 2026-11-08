import { makePregens } from '../../data/pregens';
import { buildScene } from '../../noyau/mapSpec';
import type { TestScenario } from './_shared';

/**
 * À BORD DE LA CARAQUE (#3686). Une caraque posée par référence à son type (`MapSpec.navires`) dans un bassin, proue
 * à l'est : ses quatre ponts, relevés sur les plans de MDG p.99, en exploration. Le groupe est à bord dans l'embelle
 * et parcourt le navire, des cabines du château de poupe à la cale, par les échelles de trappe. Aucune rencontre.
 */
export const scenario: TestScenario = {
  id: 'a-bord-de-la-caraque',
  order: 17,
  category: 'naval',
  icon: 'scenario/naval',
  title: 'À bord de la caraque',
  tests:
    // MDG p.99
    'Une caraque posée dans un bassin par référence à son type : pont supérieur et château de poupe, pont principal, ' +
    'cale, gaillard et plage arrière parcourus à pied, chaque pièce de la légende nommée, les ponts reliés par leurs échelles de trappe.',
  partyNote: 'Explorez librement : les cabines du château, puis descendez en cale ou montez sur la plage arrière par les échelles.',
  construire: (idNeuf) => ({
    party: makePregens(idNeuf),
    scene: buildScene({
      id: 'a-bord-de-la-caraque',
      label: 'À bord de la caraque',
      size: [22, 9],
      terrain: 'eau',
      navires: [{ ref: 'caraque', id: 'caraque', x: 2, y: 2, cap: 'E' }],
      heroStart: { x: 13, y: 4, z: 2 },
    }),
  }),
};
