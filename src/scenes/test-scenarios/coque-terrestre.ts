import { tousLesHerosDeScenario } from './_heros';
import { buildScene } from '../../noyau/mapSpec';
import { flowFromEffects } from '../../noyau/monde/flow';
import type { TestScenario } from './_shared';

/**
 * UNE COQUE TERRESTRE POSÉE (#4471) : la diligence (`vehicles.json`), l'entité de son type, dans un pré, au cap est.
 * La scène porte son corps, qui se montre par le monde sous son modèle (`coquesDeLaScene`), en exploration comme au
 * combat. Le premier pas du groupe vers l'est franchit la bande qui ouvre le combat, où la diligence est membre de la
 * rencontre avec un brigand.
 */
export const scenario: TestScenario = {
  id: 'coque-terrestre',
  order: 63,
  category: 'rendu',
  icon: 'scenario/galerie',
  title: 'Coque terrestre — la diligence posée',
  tests:
    'Une diligence posée dans un pré par référence à son type : son modèle au monde, au centre de son empreinte, à sa ' +
    'taille réelle, sans nom flottant ; au premier pas, le combat, où elle reste un seul modèle, immobile.',
  partyNote: 'Faites un pas vers l’est : le combat s’ouvre, la diligence et un brigand en face.',
  construire: (idNeuf) => ({
    party: tousLesHerosDeScenario(idNeuf),
    scene: buildScene({
      id: 'coque-terrestre',
      label: 'Pré de la diligence',
      size: [12, 8],
      terrain: 'herbe',
      ambientLight: 'jour',
      heroStart: [2, 4],
      entities: [{ id: 'diligence', kind: 'personnage', vehicule: { id: 'diligence' }, pos: { x: 6, y: 3 }, facing: 'E', label: 'La diligence' }],
      triggers: [
        {
          id: 'ouvrir-le-combat',
          rect: { x: 3, y: 0, w: 1, h: 8 },
          once: true,
          flow: flowFromEffects([{ type: 'startCombat', encounter: { id: 'enc-diligence' } }]),
        },
      ],
      encounters: [
        {
          id: 'enc-diligence',
          hidden: true,
          members: [{ entityId: 'diligence', side: 'ennemi' }],
          enemies: [{ creature: { id: 'humain' }, pos: { x: 10, y: 4 }, label: 'Brigand' }],
        },
      ],
    }),
  }),
};
