import { makePregens } from '../../data/pregens';
import { buildScene } from '../../noyau/mapSpec';
import { toggleDoorIn, type Scene } from '../../noyau/monde/scene';
import type { TestScenario } from './_shared';

/**
 * « La porte close » (#2898) : un réduit fermé par une porte FERMÉE, en exploration. Le geste démontré est
 * l'ouverture de la porte par le groupe (`actionnerLaPorte`), puis le passage. Prose de FIXTURE (test-scenario dev,
 * pas du contenu de campagne livré).
 */
const construire = (): Scene => toggleDoorIn(buildScene({
  id: 'test-porte-close',
  label: 'La porte close',
  desc: 'Arène de test.',
  size: [6, 3],
  terrain: 'pierre',
  ambiance: 'interieur',
  heroStart: [1, 1],
  startMessage: { texte: 'Une cour de pierre ; une porte de bois fermée garde un réduit. (Ouvrez la porte, puis passez-la.)' },
  walls: [
    { x: 2, y: 0, side: 'E' },
    { x: 2, y: 1, side: 'E', door: true },
    { x: 2, y: 2, side: 'E' },
  ],
  zoneMap: { z0: ['...AAA', '...AAA', '...AAA'].join('\n') },
  zoneLegend: { A: { id: 'reduit', label: 'Réduit', presentation: 'interior' } },
}), 2, 1, 'E');

export const scenario: TestScenario = {
  id: 'porte-close',
  order: 28,
  category: 'scenarios',
  icon: 'nav/campaign',
  title: 'La porte close',
  tests: 'Ouverture d’une porte FERMÉE en exploration (`actionnerLaPorte`), puis le passage du groupe : la porte s’ouvre au geste, le pas la franchit.',
  partyNote: 'Pré-tirés',
  construire: () => ({ party: makePregens(), scene: construire() }),
};
