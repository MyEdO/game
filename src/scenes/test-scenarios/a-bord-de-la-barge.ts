import { tousLesHerosDeScenario } from './_heros';
import { buildScene } from '../../noyau/mapSpec';
import type { TestScenario } from './_shared';

/**
 * À BORD DE LA BARGE FLUVIALE (#3772, #3790). Une barge fluviale, l'entité de son type, dans un bassin à l'échelle de son
 * plan, proue à l'est : ses ponts (`vehicles.json › ponts`), relevés sur la planche du Bérébéli, et son décor
 * (`planDeLaBarge.ts`), en exploration. Le groupe est à bord dans l'allée du pont avant, entre la cargaison bâchée, et
 * parcourt la barge : cabines du rouf, cale par l'échelle de sa trappe, plate-forme de proue, plate-forme de poupe,
 * passerelle et toits du rouf. Aucune rencontre.
 */
export const scenario: TestScenario = {
  id: 'a-bord-de-la-barge',
  order: 17,
  category: 'naval',
  icon: 'scenario/naval',
  title: 'À bord de la barge fluviale',
  tests:
    'Une barge fluviale posée dans un bassin par référence à son type : pont principal et allée du pont avant, cabines du rouf, ' +
    'cale, plates-formes de proue et de poupe, passerelle et toits du rouf parcourus à pied et par leurs échelles ; ' +
    'son décor à bord : fanaux, pile de tonneaux et cargaison bâchée des deux bords.',
  partyNote: 'Explorez librement : les cabines du rouf, la cale par l’échelle de sa trappe, puis les plates-formes de proue et de poupe par leurs échelles, la passerelle et les toits.',
  construire: (idNeuf) => ({
    party: tousLesHerosDeScenario(idNeuf),
    scene: buildScene({
      id: 'a-bord-de-la-barge',
      label: 'À bord de la barge fluviale',
      size: [14, 7],
      terrain: 'eau',
      entities: [{ id: 'barge', kind: 'personnage', vehicule: { id: 'barge-fluviale' }, pos: { x: 6, y: 2 }, facing: 'E', label: 'La barge' }],
      heroStart: { x: 8, y: 3, z: 1 },
    }),
  }),
};
