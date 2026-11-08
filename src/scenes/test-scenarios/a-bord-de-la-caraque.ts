import { makePregens } from '../../data/pregens';
import { buildScene } from '../../noyau/mapSpec';
import { PLAN_DE_LA_CARAQUE } from '../../noyau/planDeLaCaraque';
import type { TestScenario } from './_shared';

/**
 * À BORD DE LA CARAQUE (#3686). Les quatre ponts relevés sur les plans de MDG 12 l.286 (`PLAN_DE_LA_CARAQUE`) en
 * exploration : le groupe monte à bord dans l'embelle et parcourt le navire, des cabines du château de poupe à la
 * cale, par les échelles de trappe. Aucune rencontre.
 */
export const scenario: TestScenario = {
  id: 'a-bord-de-la-caraque',
  order: 17,
  category: 'naval',
  icon: 'scenario/naval',
  title: 'À bord de la caraque',
  tests:
    // MDG 12 l.286
    'Les ponts de la caraque parcourus à pied : pont supérieur et château de poupe, pont principal, cale, gaillard ' +
    'et plage arrière, chaque pièce de la légende nommée, les ponts reliés par leurs échelles de trappe.',
  partyNote: 'Explorez librement : les cabines du château, puis descendez en cale ou montez sur la plage arrière par les échelles.',
  construire: (idNeuf) => ({
    party: makePregens(idNeuf),
    scene: buildScene({ ...PLAN_DE_LA_CARAQUE, id: 'a-bord-de-la-caraque', heroStart: { x: 6, y: 2, z: 2 } }),
  }),
};
