import { makePregens } from '../../data/pregens';
import { buildOperaFloorplan } from '../opera/floorplan';
import { scenarioEntities } from '../opera/furnished';
import type { TestScenario } from './_shared';
import type { Scene } from '../../state/scene';

/**
 * OPÉRA — PLAN MEUBLÉ. La géométrie fidèle du Théâtre Staatsoper (`opera/floorplan.ts`, plan NADJ 08
 * folio 38 rez / folio 39 étage, images) chargée en EXPLORATION avec son MOBILIER (`opera/furnished.ts`) : la scène DÉDIÉE où le
 * meublage se juge à l'écran (#1644), sans toucher au scénario jouable « Opéra », qui a sa propre
 * carte 21 cases et ses propres entités.
 */
function construireScene(): Scene {
  const s = buildOperaFloorplan();
  return { ...s, entities: [...s.entities, ...scenarioEntities()] };
}

export const scenario: TestScenario = {
  id: 'opera-plan',
  order: 14,
  category: 'rendu',
  icon: 'scenario/opera',
  title: 'Opéra — plan meublé (Staatsoper)',
  tests:
    'Rendu en jeu du mobilier du plan NADJ 8 : volumiques d\'intérieur (comptoirs, tables, étagères, bancs, ' +
    'sièges du parterre, décors de scène) et billboards restants, posés pièce par pièce sur la géométrie ' +
    'fidèle du Staatsoper (rez + étage). Exploration libre, aucune rencontre.',
  partyNote: 'Explorez librement : coulisses, scène, parterre, foyer, puis la galerie des loges par les rampes d\'angle. Aucune rencontre ne démarre.',
  construire: () => ({ party: makePregens(), scene: construireScene() }),
};
