import { makePregens } from '../../data/pregens';
import { scenario as plan } from './opera-plan';
import type { TestScenario } from './_shared';

/**
 * OPÉRA — GALERIE (#1883). La scène d'`opera-plan`, son départ du groupe déplacé à l'ÉTAGE (`z: 1`), sur
 * la rive ouest du puits, contre le `garde-corps` (`opera/floorplan.ts`, `OPERA_WALL_LEGEND`).
 */
const scene = {
  ...plan.scene,
  entities: plan.scene.entities.map((e) =>
    e.kind === 'heroStart' ? { ...e, pos: { x: 9, y: 16 }, z: 1, facing: 'E' as const } : e),
};

export const scenario: TestScenario = {
  id: 'opera-galerie',
  order: 15,
  category: 'rendu',
  icon: 'scenario/opera',
  title: 'Opéra — la galerie, au bord du puits',
  tests:
    "Départ à l'étage : le groupe démarre sur la galerie (z1) du Staatsoper, au bord du puits, contre son " +
    "garde-corps — la vue du dessus, la coupe de l'étage et le garde-corps se jugent depuis la rive. Aucune rencontre.",
  partyNote: 'Le groupe démarre sur la galerie ouest, face au puits. Aucune rencontre ne démarre.',
  makeParty: () => makePregens(),
  scene,
};
