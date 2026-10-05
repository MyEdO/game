import { makePregens } from '../../data/pregens';
import { buildScene, type WallSpec } from '../../state/mapSpec';
import { flowFromEffects } from '../../state/flow';
import type { Dialogue, Scene } from '../../state/scene';
import type { TestScenario } from './_shared';

/**
 * « La fenêtre sur les écuries » — recette de la croisée FRANCHISSABLE et de la porte SECRÈTE (#700) :
 * EDO 01 l.229-231, EDO 08 l.402.
 *  - ÉTAGE (z1, plancher à 4 m) : couloir, bureau, cachette ; croisée E de (7,2) sur les écuries, au rez.
 *  - Porte secrète E de (3,2), face porteuse dans le bureau, Complexe ; la cachette et son coffre derrière.
 *  - REZ (z0) : salle basse, volée d'escalier (2..5,6) qui remonte au couloir ; porte E de (7,5) sur les écuries.
 *  - RENCONTRE `enc-homme-de-main` : l'homme de main du couloir, ouverte par son dialogue.
 */

const W = 12;
const H = 8;
/** Enveloppe du bâtiment : x 1..7, y 1..6, aux deux étages. */
const X0 = 1, X1 = 7, Y0 = 1, Y1 = 6;

const REZ = [
  '............',
  '.DDDDDDD....',
  '.DDDDDDD....',
  '.DDDDDDD....',
  '.DDDDDDD....',
  '.DDDDDDD....',
  '.DEEEEDD....',
  '............',
].join('\n');

const ETAGE = [
  '............',
  '.PPPPPPP....',
  '.PPPPPPP....',
  '.PPPPPPP....',
  '.PPPPPPP....',
  '....PPPP....',
  '......PP....',
  '............',
].join('\n');

const ZONES_REZ = [
  '........SSSS',
  '.RRRRRRRSSSS',
  '.RRRRRRRSSSS',
  '.RRRRRRRSSSS',
  '.RRRRRRRSSSS',
  '.RRRRRRRSSSS',
  '.RRRRRRRSSSS',
  '........SSSS',
].join('\n');

const ZONES_ETAGE = [
  '............',
  '.BBBHHCC....',
  '.BBBHHCC....',
  '.BBBHHCC....',
  '.CCCCCCC....',
  '....CCCC....',
  '......CC....',
  '............',
].join('\n');

/** Enveloppe d'un étage — hors les arêtes `percees` (`"x,y,side"` : portes, croisée), posées à part. */
function enveloppe(z: number, percees: readonly string[]): WallSpec[] {
  const out: WallSpec[] = [];
  for (let x = X0; x <= X1; x++) out.push({ x, y: Y0, side: 'N', z }, { x, y: Y1 + 1, side: 'N', z });
  for (let y = Y0; y <= Y1; y++) out.push({ x: X0 - 1, y, side: 'E', z }, { x: X1, y, side: 'E', z });
  return out.filter((w) => !percees.includes(`${w.x},${w.y},${w.side}`));
}

const CROISEE: WallSpec = { x: 7, y: 2, side: 'E', z: 1, window: true, crossable: true, allege: 1, suspendu: 2 };
const PORTE_SECRETE: WallSpec = { x: 3, y: 2, side: 'E', z: 1, door: true, secret: { difficulty: 'complexe', face: 'porteuse' } };
const PORTE_ECURIES: WallSpec = { x: 7, y: 5, side: 'E', door: true };

const CLOISONS_ETAGE: WallSpec[] = [
  // Bureau : cloison E (porte secrète au milieu), cloison S (porte sur le couloir en (2,4)).
  { x: 3, y: 1, side: 'E', z: 1 }, PORTE_SECRETE, { x: 3, y: 3, side: 'E', z: 1 },
  { x: 1, y: 4, side: 'N', z: 1 }, { x: 2, y: 4, side: 'N', z: 1, door: true }, { x: 3, y: 4, side: 'N', z: 1 },
  // Cachette : cloisons E et S, sans porte.
  { x: 5, y: 1, side: 'E', z: 1 }, { x: 5, y: 2, side: 'E', z: 1 }, { x: 5, y: 3, side: 'E', z: 1 },
  { x: 4, y: 4, side: 'N', z: 1 }, { x: 5, y: 4, side: 'N', z: 1 },
  // Garde-corps de la trémie de l'escalier.
  { x: 1, y: 5, side: 'N', z: 1 }, { x: 2, y: 5, side: 'N', z: 1 }, { x: 3, y: 5, side: 'N', z: 1 }, { x: 3, y: 5, side: 'E', z: 1 },
];

const DIALOGUES: Dialogue[] = [
  {
    id: 'dlg-homme-de-main',
    start: 'h1',
    nodes: [
      {
        id: 'h1',
        speakerId: 'homme-de-main',
        desc: '« Personne ne monte ici. Redescendez par où vous êtes venus — ou par la fenêtre, si vous préférez. »',
        choices: [
          {
            label: 'Tirer l’épée.',
            flow: flowFromEffects([{ type: 'endDialogue' }, { type: 'startCombat', encounter: 'enc-homme-de-main' }]),
          },
          { label: 'Reculer.', flow: flowFromEffects([{ type: 'endDialogue' }]) },
        ],
      },
    ],
  },
];

function construireScene(): Scene {
  return buildScene({
    id: 'test-fenetre-ecuries',
    label: 'La fenêtre sur les écuries',
    desc: 'Un étage de relais : couloir, bureau et cachette ; la croisée du couloir donne sur les écuries, 4 m plus bas.',
    size: [W, H],
    terrain: 'terre',
    ambiance: 'interieur',
    legend: { D: 'dalle', P: 'plancher' },
    levels: { z0: REZ, z1: ETAGE },
    elevate: { P: 4 },
    cells: { E: { terrain: 'dalle', stair: { to: 'z1' } } },
    walls: [
      ...enveloppe(0, ['7,5,E']), PORTE_ECURIES,
      ...enveloppe(1, ['7,2,E']), CROISEE,
      ...CLOISONS_ETAGE,
    ],
    zoneMap: { z0: ZONES_REZ, z1: ZONES_ETAGE },
    zoneLegend: {
      R: { id: 'salle-basse', label: 'Salle basse', presentation: 'interior' },
      S: { id: 'ecuries', label: 'Écuries', presentation: 'exterior' },
      B: { id: 'bureau', label: 'Bureau', presentation: 'interior' },
      H: { id: 'cachette', label: 'Cachette', presentation: 'interior' },
      C: { id: 'couloir', label: 'Couloir', presentation: 'interior' },
    },
    heroStart: { x: 7, y: 6, z: 1 },
    entities: [
      { id: 'bureau-table', kind: 'prop', ref: 'bureau', pos: { x: 1, y: 2 }, z: 1 },
      { id: 'bureau-chaise', kind: 'prop', ref: 'chaise', pos: { x: 1, y: 1 }, z: 1 },
      { id: 'cachette-coffre', kind: 'prop', ref: 'coffre', pos: { x: 5, y: 2 }, z: 1, label: 'Coffre de la cachette',
        usable: { actions: [{ id: 'fouiller', consume: true, flow: flowFromEffects([
          { type: 'giveTrapping', custom: 'Lettre cachetée' },
          { type: 'journal', desc: 'Au fond du coffre, une lettre cachetée.' },
        ]) }] } },
      { id: 'homme-de-main', kind: 'personnage', ref: 'brigand', label: 'Homme de main', pos: { x: 6, y: 1 }, z: 1, facing: 'S', dialogueId: 'dlg-homme-de-main' },
      { id: 'stalle-1', kind: 'prop', ref: 'stalle-ecurie', pos: { x: 10, y: 1 } },
      { id: 'stalle-2', kind: 'prop', ref: 'stalle-ecurie', pos: { x: 10, y: 4 } },
      { id: 'abreuvoir', kind: 'prop', ref: 'abreuvoir', pos: { x: 9, y: 6 } },
    ],
    dialogues: DIALOGUES,
    encounters: [{ id: 'enc-homme-de-main', members: [{ entityId: 'homme-de-main' }] }],
    startMessage: 'Le couloir de l’étage. Au nord, la croisée donne sur les écuries ; à l’ouest, la porte du bureau.',
  });
}

export const scenario: TestScenario = {
  id: 'fenetre-ecuries',
  order: 27,
  category: 'scenarios',
  icon: 'scenario/hamlet',
  title: 'La fenêtre sur les écuries',
  tests:
    'Croisée franchissable d’étage (4 m, se suspendre = 2 m, EDO 01 l.229-231) : sauter en exploration puis EN COMBAT ' +
    '(rencontre `enc-homme-de-main`, ouverte par le dialogue de l’homme de main) ; remonter par l’escalier. Porte secrète ' +
    'Complexe du bureau (EDO 08 l.402) : découverte à l’approche, ou « Fouiller la pièce » ; la cachette et son coffre derrière.',
  partyNote:
    'Pré-tirés, à l’étage. Gestes : sauter/se suspendre à la croisée (hors combat, puis en combat via l’homme de main) · ' +
    'remonter par l’escalier de la salle basse · entrer au bureau (découverte à l’approche) · Fouiller la pièce.',
  construire: () => ({ party: makePregens(), scene: construireScene() }),
};
