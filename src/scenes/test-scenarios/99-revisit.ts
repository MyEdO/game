import { makePregens } from '../../data/pregens';
import { buildScene } from '../../state/mapSpec';
import { flowFromEffects } from '../../state/flow';
import type { TestScenario } from './_shared';
import type { Scene } from '../../state/scene';

/**
 * « Revisite » (#707) — DÉMO de la persistance d'état au revisit (couche `sceneInstances`, moteur
 * livré au lot 1) : deux petites scènes reliées par des transitions (`extraScenes` + `Effect
 * transition`). La Réserve porte un coffre `interact.consume` et une porte ; le Couloir n'est qu'un
 * sas de transition. Prose de FIXTURE (test-scenario dev, pas du contenu de campagne livré).
 *
 * Recette : fouiller le coffre (disparaît) + ouvrir la porte en Réserve, passer par le Couloir,
 * revenir en Réserve — le coffre reste absent, la porte reste ouverte (sans ce lot, `transitionTo`
 * re-clonait la scène authored à chaque entrée et perdait les deux mutations).
 */
const construireReserve = (): Scene => buildScene({
  id: 'test-revisit-reserve',
  label: 'La Réserve',
  desc: 'Arène de test.',
  size: [6, 3],
  terrain: 'pierre',
  ambiance: 'interieur',
  heroStart: [0, 1],
  startMessage:
    'Une réserve poussiéreuse. Un coffre non gardé traîne près de l’entrée ; une porte de bois barre ' +
    'le fond du couloir. (Fouillez le coffre puis ouvrez la porte pour rejoindre le couloir — revenez ' +
    'ensuite ici pour vérifier que rien n’a été remis en place.)',
  walls: [{ x: 2, y: 1, side: 'E', door: true }],
  entities: [
    {
      id: 'reserve-coffre', kind: 'prop', ref: 'coffre', pos: { x: 1, y: 1 }, label: 'Coffre sans gardien',
      usable: { actions: [{ id: 'fouiller', consume: true, flow: flowFromEffects([
        { type: 'giveMoney', montant: { gold: 3 } },
        { type: 'journal', desc: 'Le coffre ne contenait que quelques pièces — vous les empochez.' },
      ]) }] },
    },
  ],
  triggers: [
    {
      id: 'reserve-vers-couloir',
      rect: { x: 5, y: 1, w: 1, h: 1 },
      flow: flowFromEffects([{ type: 'transition', scene: 'test-revisit-couloir' }]),
    },
  ],
});

const construireCouloir = (): Scene => buildScene({
  id: 'test-revisit-couloir',
  label: 'Le Couloir',
  desc: 'Arène de test.',
  size: [4, 3],
  terrain: 'pierre',
  ambiance: 'interieur',
  heroStart: [3, 1],
  startMessage: 'Un couloir de service, sans rien à voir. (Repartez vers la Réserve pour la revisiter.)',
  triggers: [
    {
      id: 'couloir-vers-reserve',
      rect: { x: 0, y: 1, w: 1, h: 1 },
      flow: flowFromEffects([{ type: 'transition', scene: 'test-revisit-reserve' }]),
    },
  ],
});

export const scenario: TestScenario = {
  id: 'revisit',
  order: 26,
  category: 'scenarios',
  icon: 'nav/campaign',
  title: 'Revisite (persistance de scène)',
  tests:
    'Persistance d’état au revisit (#707, couche `sceneInstances`) : fouiller le coffre `interact.consume` ' +
    'de la Réserve (disparaît) + ouvrir sa porte, transiter par le Couloir, revenir en Réserve — le coffre ' +
    'reste absent et la porte reste ouverte (sans capture/apply, `transitionTo` re-clonait la scène authored).',
  partyNote: 'Pré-tirés',
  construire: () => ({ party: makePregens(), scene: construireReserve(), extraScenes: [construireCouloir()] }),
};
