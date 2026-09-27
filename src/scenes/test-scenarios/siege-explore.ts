import { pregenParty, PREGEN } from '../../data/pregens';
import { buildScene } from '../../state/mapSpec';
import { spec } from './siege-enceinte';
import type { TestScenario } from './_shared';

/**
 * SIÈGE — EXPLORATION (sans combat). Le MÊME `MapSpec` que `siege-enceinte`, recompilé avec un id de scène
 * DISTINCT (fog/registre propres, aucune mutation partagée) et SANS `autoCombat` → la carte se charge en
 * EXPLORATION : déplacement et caméra LIBRES pour inspecter/retoucher le rendu du siège (rempart, rampe du
 * flanc gauche, chemin de ronde à 4 m, parapet, toits, relief, brouillard) sans que le mode combat gêne la
 * lecture. La rencontre reste DÉCLARÉE dans la scène mais n'est jamais démarrée (aucun trigger, pas d'autoCombat).
 */
export const scenario: TestScenario = {
  id: 'siege-explore',
  order: 13,
  category: 'rendu',
  icon: 'scenario/siege',
  title: 'Siège — exploration (sans combat)',
  tests:
    'La carte du siège (30×46, 2 couches) chargée en EXPLORATION, SANS démarrer le combat : déplacement et ' +
    'caméra libres pour inspecter le rendu (rempart, rampe du flanc gauche, chemin de ronde à 4 m, parapet, ' +
    'toits, relief, brouillard). Le mode combat ne gêne plus l\'inspection de la carte.',
  partyNote: 'Explorez librement : montez au rempart par la rampe du flanc gauche, faites le tour de l\'enceinte. Aucune rencontre ne démarre.',
  construire: () => ({
    party: pregenParty(PREGEN.soldat, PREGEN.chasseur, PREGEN.sorcier, PREGEN.tueur),
    scene: buildScene({ ...spec(), id: 'siege-explore', label: 'Siège — exploration (sans combat)' }),
  }),
};
