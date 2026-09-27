import { makePregens } from '../../data/pregens';
import { buildScene } from '../../state/mapSpec';
import { flowFromEffects } from '../../state/flow';
import type { TestScenario } from './_shared';
import type { Scene } from '../../state/scene';

/**
 * POURSUITE TERRESTRE JOUABLE (#95, LDB 15 l.88-108) : le groupe fuit trois brigands sur un chemin
 * découvert. Le trigger d'entrée pose l'Effet `startPursuit` (state/pursuitFlow ouvre la boucle de
 * manches, cascade influençable `purpose:'pursuite'`) dès le premier pas. Rattrapé (Distance ≤ 0),
 * la fuite se dénoue en COMBAT (`enc-rattrapage`, mêmes brigands) ; semé, elle se dénoue au récit.
 */
const construireScene = (): Scene => buildScene({
  id: 'test-poursuite-terrestre',
  label: 'Chemin de crête — poursuite',
  desc: 'Chemin découvert entre deux talus, aucun couvert avant la lisière au loin.',
  size: [18, 10],
  terrain: 'herbe',
  heroStart: [2, 5],
  startMessage:
    'Des cris dans votre dos — trois silhouettes armées surgissent du talus et se lancent à vos ' +
    'trousses. Fuyez !',
  // Bande franchie au premier pas (comme la clairière d'Ulric) : ouvre la poursuite sans délai.
  triggers: [
    {
      id: 'depart-poursuite',
      rect: { x: 3, y: 0, w: 1, h: 10 },
      once: true,
      flow: flowFromEffects([
        {
          type: 'startPursuit',
          partyRole: 'fleeing',
          distance: 4,
          skill: { id: 'athletisme' },
          foes: [
            { ref: { creatureId: 'brigand' } },
            { ref: { creatureId: 'brigand' } },
            { ref: { creatureId: 'brigand' } },
          ],
          encounter: 'enc-rattrapage',
        },
      ]),
    },
  ],
  // Secours si rattrapés (Distance ≤ 0, LDB 15 l.94) — mêmes brigands, cachés tant que la fuite tient.
  encounters: [
    {
      id: 'enc-rattrapage',
      hidden: true,
      enemies: [
        { ref: 'brigand', pos: { x: 1, y: 4 }, label: 'Brigand' },
        { ref: 'brigand', pos: { x: 1, y: 6 }, label: 'Brigand' },
        { ref: 'brigand', pos: { x: 0, y: 5 }, label: 'Brigand meneur' },
      ],
    },
  ],
});

export const scenario: TestScenario = {
  id: 'poursuite-terrestre',
  order: 3,
  category: 'combat',
  icon: 'scenario/travel',
  title: 'Poursuite terrestre',
  tests:
    "L'Effet `startPursuit` (#95, LDB 15 l.88-108) ouvre la boucle de manches JOUABLE (cascade " +
    "influençable purpose:'pursuite', UNE bande par manche — une rangée par coureur) dès l'entrée ; rattrapage " +
    '(Distance ≤ 0) bascule en combat contre les mêmes brigands, évasion (Distance ≥ 10) se dénoue au récit.',
  partyNote: 'Groupe fixe (pré-tirés)',
  construire: () => ({ party: makePregens(), scene: construireScene() }),
};
