import { groupeDeScenario } from './_heros';
import { findSpeciesById } from '../../data';
import { buildScene } from '../../noyau/mapSpec';
import { flowFromEffects } from '../../noyau/monde/flow';
import type { TestScenario } from './_shared';
import type { Scene } from '../../noyau/monde/scene';

/**
 * « Taverne — un PNJ à profil standard » (#1882) : un habitué de la salle, typé par le profil standard de
 * son espèce (`species.json › profilStandard`, `LDB 77 l.7`), PROPOSE une partie (`SceneEntity.tavernGame`,
 * `NADJ 04 l.72`). Son dialogue ouvre la table (`openTavernGames`, `noyau/combatEffects.ts`) sur SON offre :
 * l'opposant joue sa fiche (`sceneNpc`, `noyau/tavernFlow.ts`).
 */
const ESPECE = 'humains-reiklander';

function construireScene(): Scene {
  const fiche = findSpeciesById(ESPECE)?.profilStandard?.id;
  if (!fiche) throw new Error(`taverne-profil-standard : « ${ESPECE} » ne porte pas de profil standard (species.json)`);
  return buildScene({
    id: 'test-taverne-profil-standard',
    label: 'Taverne — un PNJ à profil standard',
    desc: 'Arène de test.',
    size: [10, 7],
    terrain: 'planches',
    heroStart: [2, 3],
    startMessage:
      { texte: 'Un habitué de la salle, coude sur la table, vous toise. Parlez-lui : il propose un bras de fer, ' +
      // LDB 77
      'et il joue de sa fiche — le profil standard Humain.' },
    entities: [
      {
        id: 'habitue-bras-de-fer',
        kind: 'personnage',
        creature: { id: fiche },
        label: 'Habitué de la salle',
        pos: { x: 6, y: 3 },
        facing: 'O',
        appearance: { species: ESPECE },
        dialogueId: { id: 'dlg-bras-de-fer' },
        tavernGame: { id: 'bras-de-fer' },
      },
    ],
    dialogues: [
      {
        id: 'dlg-bras-de-fer',
        start: { id: 'defi' },
        nodes: [
          {
            id: 'defi',
            desc: '« Un bras de fer, étranger ? Le perdant paie la tournée. »',
            choices: [
              { id: 'relever-defi', label: 'Relever le défi.', icon: 'navigation/des', flow: flowFromEffects([{ type: 'openTavernGames' }]) },
              { id: 'partir', label: 'Une autre fois. (Partir)', flow: flowFromEffects([{ type: 'endDialogue' }]) },
            ],
          },
        ],
      },
    ],
  });
}

export const scenario: TestScenario = {
  id: 'taverne-profil-standard',
  order: 8,
  category: 'marche',
  icon: 'scenario/marche',
  title: 'Taverne — un PNJ à profil standard',
  tests:
    // LDB 77
    'Un PNJ typé par le profil standard de son espèce propose un jeu de taverne depuis son dialogue ' +
    // NADJ 16
    '(Effet openTavernGames, option `jeux-de-taverne` pré-activée) : la table s’ouvre sur son offre et ' +
    'l’opposant joue sa fiche.',
  partyNote: 'Soldat · Chasseur',
  rules: { 'jeux-de-taverne': true },
  construire: (idNeuf) => ({ party: groupeDeScenario(idNeuf, 'soldat', 'chasseur'), scene: construireScene() }),
};
