import { pregenParty, PREGEN } from '../../data/pregens';
import { buildScene } from '../../state/mapSpec';
import { flowFromEffects } from '../../state/flow';
import type { TestScenario } from './_shared';

/**
 * « Échéance & compte à rebours » (#668) : `setObjective`/`delayedEffect` posés avec une même
 * `ScheduleSpec` (`afterDays: 2, atHour: 0`) — le bandeau d'objectif affiche J-2 puis J-1 (compte
 * à rebours, `ObjectiveBanner`) à mesure que le joueur DORT (`rest`, aubergiste), jusqu'au tir du
 * `delayedEffect` à l'échéance (journal + flag).
 */
const auberge = buildScene({
  id: 'test-echeance-auberge',
  label: 'Auberge du Cor Fêlé',
  desc: 'Arène de test.',
  size: [12, 8],
  terrain: 'herbe',
  heroStart: [3, 4],
  rest: { auberge: true },
  startMessage:
    'Une rumeur court : un rituel se prépare quelque part en ville, pour dans deux jours à minuit. ' +
    'Rien à faire d’autre ici que dormir — regardez le bandeau d’objectif en haut de l’écran se ' +
    'décompter à chaque nuit (« Dormir jusqu’au lendemain » chez l’aubergiste).',
  entities: [
    { id: 'aubergiste', kind: 'personnage', ref: 'humain', label: 'Aubergiste', pos: { x: 8, y: 3 }, appearance: { species: 'humains-reiklander' }, dialogueId: 'dlg-auberge-echeance' },
  ],
  dialogues: [
    {
      id: 'dlg-auberge-echeance',
      start: 'accueil',
      nodes: [
        {
          id: 'accueil',
          desc: 'Une chambre pour la nuit, l’ami ? À ce train, vous allez user le plancher.',
          choices: [
            { label: 'Dormir jusqu’au lendemain.', flow: flowFromEffects([{ type: 'rest', lodging: 'auberge', days: 1 }]) },
            { label: 'Pas encore.' },
          ],
        },
      ],
    },
  ],
  triggers: [
    {
      id: 'pose-echeance',
      rect: { x: 0, y: 0, w: 12, h: 8 },
      once: true,
      flow: flowFromEffects([
        {
          type: 'setObjective',
          id: 'ech-obj',
          desc: 'Empêcher le rituel avant minuit',
          afterDays: 2, atHour: 0,
        },
        {
          type: 'delayedEffect',
          afterDays: 2, atHour: 0,
          flow: flowFromEffects([
            { type: 'journal', desc: 'MINUIT — le rituel s’accomplit.' },
            { type: 'setFlag', flag: 'rituel-accompli' },
          ]),
        },
      ]),
    },
  ],
});

export const scenario: TestScenario = {
  id: 'echeance',
  order: 21,
  category: 'scenarios',
  icon: 'scenario/village',
  title: 'Échéance & compte à rebours',
  tests:
    '`ScheduleSpec` partagée (#668) : `setObjective` pose `Objective.deadline` (compte à rebours J-2/J-1 ' +
    'au bandeau `ObjectiveBanner`) et `delayedEffect` tire le même jour à minuit (journal + flag) — les ' +
    'deux résolus par `scheduleAt` (`engine/clock`). Dormir chez l’aubergiste (`rest`, jour par jour) fait ' +
    'avancer le temps et progresser le compte à rebours jusqu’au tir.',
  partyNote: 'Sigmund (Soldat) · Tueur nain · Sorcier · Chasseur',
  makeParty: () => pregenParty(PREGEN.soldat, PREGEN.tueur, PREGEN.sorcier, PREGEN.chasseur),
  scene: auberge,
  money: { gold: 2, silver: 0, brass: 0 }, // #668 : de quoi payer une nuit d'auberge à 4 (2 chambres privées + 4 repas ≈ 24s, LDB 66 l.13/16/28) du premier clic
};
