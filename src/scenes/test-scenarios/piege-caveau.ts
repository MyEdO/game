import { makePregens } from '../../data/pregens';
import { buildScene } from '../../state/mapSpec';
import { flowFromEffects, testFlow, type Condition } from '../../state/flow';
import type { TestScenario } from './_shared';
import type { Scene } from '../../state/scene';

/**
 * « Le Caveau piégé » — VITRINE du système Flow + Condition en DONNÉES pures (zéro code applicatif).
 * Démontre l'authoring complet d'un piège dans l'éditeur :
 *  - INTERACTIONS : un levier et une clé (props `interact`) posent des flags ;
 *  - CONDITION composée (ET / OU / NON) : la herse du trésor s'ouvre si l'on a la CLÉ **ou** tiré le
 *    LEVIER, **et** seulement si l'ALARME n'a pas retenti — impossible à exprimer avant `ConditionEditor` ;
 *  - TEST à branches : une dalle piégée déclenche un Test d'Athlétisme (réussite = esquive ; échec =
 *    piques [dégâts + À Terre] ET déclenchement de l'alarme, qui referme la herse).
 * Tout est un document `Scene` : reproductible et éditable dans l'éditeur (triggers/interact/conditions).
 */
// Murs périmétriques + un renfoncement (le « trésor ») fermé par la herse à droite. Peints en TUILE
// 'mur' via la grille ASCII z0 : périmètre + cloison à x=10, trouée en (10,5) = la herse. Base 'pierre'.
const CAVEAU_Z0 = [
  '##############',
  '#.........#..#',
  '#.........#..#',
  '#.........#..#',
  '#.........#..#',
  '#............#', // y=5 : la trouée en (10,5) = la herse
  '#.........#..#',
  '#.........#..#',
  '#.........#..#',
  '##############',
].join('\n');

function construireScene(): Scene {
  // La herse du trésor : ouverte si (on TIENT la clé OU on a tiré le levier) ET NON alarme — composition
  // ET/OU/NON + lecture de l'inventaire VIVANT (`hasItem`), toute authorée dans `ConditionEditor`.
  const HERSE_WHEN: Condition = {
    kind: 'all',
    of: [
      { kind: 'any', of: [{ kind: 'hasItem', trappingId: 'clef' }, { kind: 'flag', expr: 'levier_tire' }] },
      { kind: 'not', of: { kind: 'flag', expr: 'alarme' } },
    ],
  };

  const scene = buildScene({
    id: 'test-piege-caveau',
    label: 'Le Caveau piégé',
    desc: 'Arène de test.',
    size: [14, 10],
    terrain: 'pierre',
    ambiance: 'interieur',
    heroStart: [2, 5],
    startMessage:
      'Un caveau humide. Au fond, une herse close protège un coffre. Un levier rouillé, une dalle suspecte au sol… et quelque part, une clé.',
    legend: { '#': 'mur' },
    levels: { z0: CAVEAU_Z0 },
    entities: [
      { id: 'levier', kind: 'prop', ref: 'roue-dentee', pos: { x: 2, y: 2 }, label: 'Mécanisme rouillé',
        usable: { actions: [{ id: 'fouiller', unique: true, flow: flowFromEffects([
          { type: 'setFlag', flag: 'levier_tire' },
          { type: 'journal', desc: 'Le mécanisme cède dans un grincement — quelque chose s’ébranle derrière le mur.' },
        ]) }] } },
      { id: 'cle', kind: 'prop', ref: 'cle', pos: { x: 2, y: 8 }, label: 'Clé en fer, posée là',
        usable: { actions: [{ id: 'fouiller', consume: true, flow: flowFromEffects([
          { type: 'giveTrapping', trappingId: 'clef' },
          { type: 'journal', desc: 'Vous empochez la lourde clé en fer.' },
        ]) }] } },
      { id: 'herse-grille', kind: 'prop', ref: 'grille', pos: { x: 10, y: 5 }, label: 'Herse du trésor' },
      { id: 'tresor', kind: 'prop', ref: 'coffre', pos: { x: 12, y: 5 }, label: 'Coffre du trésor',
        usable: { actions: [{ id: 'fouiller', consume: true, flow: flowFromEffects([
          { type: 'giveMoney', montant: { gold: 5 } },
          { type: 'giveTrapping', trappingId: 'arme-simple', qualities: [{ id: 'precise' }], identified: false },
          { type: 'journal', desc: 'Le coffre regorge d’or et d’une lame finement ouvragée.' },
        ]) }] } },
    ],
    triggers: [
      // Dalle piégée (centre) : Test d'Athlétisme → esquive, sinon piques + À Terre + alarme.
      {
        id: 'dalle-piegee',
        rect: { x: 5, y: 4, w: 2, h: 3 },
        once: true,
        flow: testFlow(
          {
            skill: { id: 'athletisme' }, difficulty: 'intermediaire', label: 'Esquiver les piques de la dalle',
            stake: { authored: 'Se figer à temps sur la dalle : sinon les piques frappent le groupe, l’alarme retentit et la herse du trésor se verrouille.' },
          },
          flowFromEffects([{ type: 'journal', desc: 'Un déclic — vous vous figez juste à temps, les piques claquent dans le vide.' }]),
          flowFromEffects([
            { type: 'ops', on: 'party', ops: [{ op: 'wounds', amount: 5 }, { op: 'condition', id: 'a-terre' }] },
            { type: 'setFlag', flag: 'alarme' },
            { type: 'journal', desc: 'Les piques jaillissent ! Dans le fracas, une cloche d’alarme retentit — la herse se verrouille.' },
          ]),
        ),
      },
      // La herse du trésor : franchir (10,5) avec la bonne condition ouvre le passage et récompense.
      {
        id: 'herse',
        rect: { x: 10, y: 5, w: 1, h: 1 },
        when: HERSE_WHEN,
        flow: flowFromEffects([
          { type: 'setFlag', flag: 'herse_ouverte' },
          { type: 'giveXp', amount: 30 },
          { type: 'journal', desc: 'La herse coulisse : le trésor est à vous.' },
        ]),
      },
    ],
  });
  return scene;
}

export const scenario: TestScenario = {
  id: 'piege-caveau',
  order: 10,
  category: 'scenarios',
  icon: 'scenario/trap',
  title: 'Le Caveau piégé',
  tests: 'Vitrine Flow+Condition : interactions (levier/clé → flags), condition composée (clé OU levier) ET NON alarme pour la herse, dalle piégée = Test d’Athlétisme à branches (esquive / piques + À Terre + alarme).',
  partyNote: 'Pré-tirés',
  construire: () => ({ party: makePregens(), scene: construireScene() }),
};
