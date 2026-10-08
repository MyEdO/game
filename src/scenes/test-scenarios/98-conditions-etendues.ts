import { makePregens } from '../../data/pregens';
import { buildScene } from '../../state/mapSpec';
import { flowFromEffects } from '../../state/flow';
import type { TestScenario } from './_shared';
import type { Scene } from '../../state/scene';

/**
 * Recette des 4 nouveaux kinds de `Condition` PARTY-LEVEL (#711, moteur `f0de1956`) : `skill`,
 * `career`, `species`, `status`. Un PNJ dialogant dont les choix portent un `when` gaté sur chacun,
 * préfixé du descripteur entre crochets (convention §dialogues, `docs/campagne-authoring.md`) — le
 * joueur voit POURQUOI le choix lui est offert. Prose de FIXTURE (test-scenario dev, pas du contenu
 * de campagne livré).
 */
const construireScene = (): Scene => buildScene({
  id: 'test-conditions-etendues',
  label: 'Conditions étendues — démo',
  desc: 'Arène de test.',
  size: [10, 8],
  terrain: 'herbe',
  heroStart: [1, 4],
  startMessage:
    { texte: 'Un garde bavard au poste de contrôle — ses réponses varient selon qui, dans le groupe, ' +
    'porte la bonne Compétence, la bonne carrière, la bonne espèce ou le bon Statut.' },
  entities: [
    {
      id: 'garde', kind: 'personnage', ref: 'villageois', label: 'Garde du poste',
      pos: { x: 6, y: 3 }, dialogueId: 'dlg-garde',
    },
  ],
  dialogues: [
    {
      id: 'dlg-garde',
      start: 'accueil',
      nodes: [
        {
          id: 'accueil',
          desc: '« Halte-là ! Qu’est-ce qui vous amène ? »',
          choices: [
            {
              label: '[Crochetage] « On sait forcer une serrure, au besoin. »',
              when: { kind: 'skill', id: 'crochetage' },
              flow: flowFromEffects([{ type: 'journal', desc: 'Le garde hausse un sourcil, amusé.' }, { type: 'endDialogue' }]),
            },
            {
              label: '[Soldat] « On a porté l’uniforme, nous aussi. »',
              when: { kind: 'career', id: 'soldat' },
              flow: flowFromEffects([{ type: 'journal', desc: 'Le garde se détend, entre collègues.' }, { type: 'endDialogue' }]),
            },
            {
              label: '[Halfling] « Un petit gabarit passe partout, hein ? »',
              when: { kind: 'species', id: 'halflings' },
              flow: flowFromEffects([{ type: 'journal', desc: 'Le garde éclate de rire.' }, { type: 'endDialogue' }]),
            },
            {
              label: '[Statut : Argent+] « Nous sommes des gens de qualité. »',
              when: { kind: 'status', atLeast: 'Argent 1' },
              flow: flowFromEffects([{ type: 'journal', desc: 'Le garde s’incline, un peu raide.' }, { type: 'endDialogue' }]),
            },
            {
              label: 'Passer son chemin sans un mot.',
              flow: flowFromEffects([{ type: 'endDialogue' }]),
            },
          ],
        },
      ],
    },
  ],
});

export const scenario: TestScenario = {
  id: 'conditions-etendues',
  order: 25,
  category: 'scenarios',
  icon: 'nav/campaign',
  title: 'Conditions étendues (skill/career/species/status)',
  tests:
    'Les 4 nouveaux kinds de `Condition` party-level (#711) : `skill` (avances), `career`, ' +
    '`species`, `status` — gate de choix de dialogue sur les VIVANTS du groupe, convention ' +
    'de préfixe « [Descripteur] » côté prose.',
  partyNote: 'Pré-tirés',
  construire: () => ({ party: makePregens(), scene: construireScene() }),
};
