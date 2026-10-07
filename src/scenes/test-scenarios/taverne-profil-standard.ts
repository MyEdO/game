import { pregenParty, PREGEN } from '../../data/pregens';
import { findSpeciesById } from '../../data';
import { buildScene } from '../../state/mapSpec';
import { flowFromEffects } from '../../state/flow';
import type { TestScenario } from './_shared';
import type { Scene } from '../../state/scene';

/**
 * « Taverne — un PNJ à profil standard » (#1882) : un habitué de la salle, typé par le profil standard de
 * son espèce (`species.json › profilStandard`, `LDB 77 l.7`), PROPOSE une partie (`SceneEntity.tavernGame`,
 * `NADJ 04 l.72`). Son dialogue ouvre la table (`openTavernGames`, `state/combatEffects.ts`) sur SON offre :
 * l'opposant joue sa fiche (`sceneNpc`, `state/tavernFlow.ts`).
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
      'et il joue de sa fiche — le profil standard Humain (LDB 77).' },
    entities: [
      {
        id: 'habitue-bras-de-fer',
        kind: 'personnage',
        ref: fiche,
        label: 'Habitué de la salle',
        pos: { x: 6, y: 3 },
        facing: 'O',
        appearance: { species: ESPECE },
        dialogueId: 'dlg-bras-de-fer',
        tavernGame: { gameId: 'bras-de-fer' },
      },
    ],
    dialogues: [
      {
        id: 'dlg-bras-de-fer',
        start: 'defi',
        nodes: [
          {
            id: 'defi',
            desc: '« Un bras de fer, étranger ? Le perdant paie la tournée. »',
            choices: [
              { label: 'Relever le défi.', icon: 'nav/dice', flow: flowFromEffects([{ type: 'openTavernGames' }]) },
              { label: 'Une autre fois. (Partir)', flow: flowFromEffects([{ type: 'endDialogue' }]) },
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
  icon: 'scenario/market',
  title: 'Taverne — un PNJ à profil standard',
  tests:
    'Un PNJ typé par le profil standard de son espèce (LDB 77) propose un jeu de taverne depuis son dialogue ' +
    '(Effet openTavernGames, option `tavern-games` pré-activée, NADJ 16) : la table s’ouvre sur son offre et ' +
    'l’opposant joue sa fiche.',
  partyNote: 'Soldat · Chasseur',
  rules: { 'tavern-games': true },
  construire: () => ({ party: pregenParty(PREGEN.soldat, PREGEN.chasseur), scene: construireScene() }),
};
