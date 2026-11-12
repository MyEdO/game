import { tousLesHerosDeScenario } from './_heros';
import { buildScene } from '../../noyau/mapSpec';
import type { Scene } from '../../noyau/monde/scene';
import type { TestScenario } from './_shared';

/**
 * « Le brouillard » (#3625) : une clairière au pied d'un tertre, au sud, sous le brouillard, en exploration. La brume de la
 * météo se pose en nappes au-dessus du sol le plus bas en tactique, et resserre la brume de profondeur en immersion
 * (`meteoDuRegard`, `lumiereDeLaScene`). Prose de FIXTURE (test-scenario dev, pas du contenu de campagne livré).
 */
const construire = (): Scene => ({
  ...buildScene({
    id: 'test-brouillard',
    label: 'Le brouillard',
    desc: 'Arène de test.',
    size: [16, 16],
    terrain: 'herbe',
    relief: [{ rect: [0, 13, 15, 15], height: 3 }],
    heroStart: [8, 12],
    startMessage: { texte: 'Le brouillard monte de la clairière et noie le pied du tertre.' },
  }),
  weather: 'brouillard',
});

export const scenario: TestScenario = {
  id: 'brouillard',
  order: 29,
  category: 'scenarios',
  icon: 'navigation/campagne',
  title: 'Le brouillard',
  tests: 'La brume de la météo en nappes au-dessus du sol en tactique, et la brume de profondeur resserrée en immersion.',
  partyNote: 'Pré-tirés',
  construire: (idNeuf) => ({ party: tousLesHerosDeScenario(idNeuf), scene: construire() }),
};
