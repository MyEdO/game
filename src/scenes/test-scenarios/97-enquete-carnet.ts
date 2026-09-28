import { makePregens } from '../../data/pregens';
import { buildScene } from '../../state/mapSpec';
import { flowFromEffects } from '../../state/flow';
import type { NarratifBlock } from '../../state/campaignNarratif';
import type { TestScenario } from './_shared';
import type { Scene } from '../../state/scene';

/**
 * Recette du carnet d'enquête (#670, mécanique MAISON — aucune règle RAW) : une affaire, deux
 * indices (dont un à deux stades), un dialogue qui révèle le premier stade PUIS l'avance, et un
 * décor qui écarte l'autre indice comme fausse piste. Prose de FIXTURE (test-scenario dev, pas du
 * contenu de campagne livré) — sert de terrain à la recette navigateur du Carnet (autre lot).
 */
const construireNarratif = (): NarratifBlock => ({
  affaires: [{ id: 'aff-marchand-disparu', titre: 'Le marchand disparu' }],
  indices: [
    {
      id: 'ind-registre',
      affaireId: 'aff-marchand-disparu',
      kind: 'indice',
      titre: 'Le registre du comptoir',
      stades: [
        { id: 's1', prose: 'Le registre du comptoir mentionne une livraison partie sans destinataire noté.' },
        { id: 's2', prose: 'Un nom gratté à l’encre au bas de la page : *Otto Baumann*.' },
      ],
    },
    {
      id: 'ind-rumeur-forgeron',
      affaireId: 'aff-marchand-disparu',
      kind: 'rumeur',
      titre: 'Le forgeron accusé',
      stades: [{ id: 's1', prose: 'Une rumeur de taverne accuse le forgeron du quartier — sans le moindre fait à l’appui.' }],
    },
  ],
  presetsPnj: [],
  objets: [],
});

const construireScene = (): Scene => buildScene({
  id: 'test-enquete-carnet-comptoir',
  label: 'Comptoir marchand — enquête',
  desc: 'Arène de test.',
  size: [10, 8],
  terrain: 'herbe',
  heroStart: [1, 4],
  startMessage:
    'Le comptoir du marchand disparu. Le commis peut ouvrir le registre ; la rumeur de taverne colle ' +
    'au forgeron du coin, sans preuve.',
  entities: [
    {
      id: 'commis', kind: 'personnage', ref: 'villageois', label: 'Commis du comptoir',
      pos: { x: 6, y: 3 }, dialogueId: 'dlg-commis',
    },
  ],
  dialogues: [
    {
      id: 'dlg-commis',
      start: 'accueil',
      nodes: [
        {
          id: 'accueil',
          desc: '« Le patron n’est pas rentré. Vous voulez jeter un œil au registre ? »',
          choices: [
            {
              label: 'Consulter le registre.',
              flow: flowFromEffects([{ type: 'revealClue', indiceId: 'ind-registre' }, { type: 'endDialogue' }]),
            },
            {
              label: 'Y regarder de plus près, à la page du bas.',
              flow: flowFromEffects([{ type: 'revealClue', indiceId: 'ind-registre', stade: 's2' }, { type: 'endDialogue' }]),
            },
            { label: 'Laisser tomber.', flow: flowFromEffects([{ type: 'endDialogue' }]) },
          ],
        },
      ],
    },
  ],
  triggers: [
    {
      id: 'forge-du-quartier',
      rect: { x: 7, y: 6, w: 1, h: 1 },
      once: true,
      flow: flowFromEffects([
        { type: 'journal', desc: 'Le forgeron travaille tranquillement — la rumeur ne tient pas debout.' },
        { type: 'discreditClue', indiceId: 'ind-rumeur-forgeron' },
      ]),
    },
  ],
});

export const scenario: TestScenario = {
  id: 'enquete-carnet',
  order: 24,
  category: 'scenarios',
  icon: 'nav/campaign',
  title: 'Carnet d’enquête',
  tests:
    'Mécanique MAISON du carnet (#670) : `revealClue` première révélation (dialogue, premier stade) ' +
    'et mise à jour (stade explicite), `discreditClue` (déclencheur de zone, fausse piste écartée).',
  partyNote: 'Pré-tirés',
  construire: () => ({ party: makePregens(), scene: construireScene(), narratif: construireNarratif() }),
};
