import { groupeDeScenario } from './_heros';
import { buildScene } from '../../noyau/mapSpec';
import type { Scene } from '../../noyau/monde/scene';
import type { TestScenario } from './_shared';

/**
 * « Mêlée dans le noir » (#4028) : deux héros sans Vision nocturne ni lampe, au contact de deux gobelins (Vision
 * nocturne) dans une scène en ténèbres. Le groupe ne voit que ses propres cases ; les gobelins se ciblent par leur case
 * et frappent sans être vus (`docs/raw/4e/combat.md`, « Combat rapproché dans le noir »). Prose de FIXTURE
 * (test-scenario dev, pas du contenu de campagne livré).
 */
const construireScene = (): Scene => buildScene({
  id: 'test-melee-dans-le-noir',
  label: 'Mêlée dans le noir',
  desc: 'Arène de test.',
  size: [10, 8],
  terrain: 'pierre',
  ambientLight: 'tenebres',
  heroStart: [3, 3],
  startMessage: { texte: 'La dernière chandelle s’éteint. Tout près, dans le noir, quelque chose ricane.' },
  encounters: [
    {
      id: 'enc-noir',
      enemies: [
        { creature: { id: 'gobelin' }, pos: { x: 3, y: 3 }, label: 'Gobelin' },
        { creature: { id: 'gobelin' }, pos: { x: 3, y: 4 }, label: 'Gobelin' },
      ],
    },
  ],
});

export const scenario: TestScenario = {
  id: 'melee-dans-le-noir',
  order: 30,
  category: 'combat',
  icon: 'scenario/embuscade',
  title: 'Mêlée dans le noir',
  tests:
    'La vision du groupe en combat : dans les ténèbres, les gobelins au contact sont hors de vue (ni corps, ni nom, ni ' +
    'rang) mais restent des cibles cliquables par leur case, et leur attaque ouvre une Défense qui ne nomme pas l’attaquant.',
  partyNote: 'Prêtre · Répurgateur (sans Vision nocturne ni lampe)',
  construire: (idNeuf) => ({ party: groupeDeScenario(idNeuf, 'pretre', 'repurgateur'), scene: construireScene() }),
  autoCombat: 'enc-noir',
};
