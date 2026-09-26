import { makePregens } from '../../data/pregens';
import { buildOperaFloorplan } from '../opera/floorplan';
import { scenarioEntities } from '../opera/furnished';
import type { TestScenario } from './_shared';

/**
 * OPÉRA — PLAN MEUBLÉ. La géométrie fidèle du Théâtre Staatsoper (`opera/floorplan.ts`, plan NADJ 08
 * folio 38 rez / folio 39 étage, images) chargée en EXPLORATION avec son MOBILIER (`opera/furnished.ts`) : la scène DÉDIÉE où le
 * meublage se juge à l'écran (#1644), sans toucher au scénario jouable « Opéra », qui a sa propre
 * carte 21 cases et ses propres entités.
 *
 * Le mobilier est CLONÉ : `scenarioEntities` est un tableau exporté, lu par ailleurs (les gardes de
 * population, `scripts/qc/opera-furniture-check.mts`) — la scène ne doit rien lui prendre ni rien
 * lui rendre.
 */
const scene = (() => {
  const s = buildOperaFloorplan();
  return { ...s, entities: [...s.entities, ...structuredClone(scenarioEntities)] };
})();

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
  makeParty: () => makePregens(),
  scene,
};
