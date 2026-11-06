import { expect, it, vi } from 'vitest';
import { parseDiceRequired } from '../engine/dice';
import * as tablesDeVoyage from '../engine/travelTables';
import { ouvrirLeBanc } from './banc.testkit';
import { battleRng } from './battleRng';
import { rollTableStep } from './cascade';
import { buildStageSteps, TABLES } from './travelPostes';

it('l’agrégation de voyage fait tirer la Rencontre au dé authoré', () => {
  vi.spyOn(tablesDeVoyage, 'ENCOUNTER_DIE', 'get').mockReturnValue(parseDiceRequired('d6', 'fixture'));
  const banc = ouvrirLeBanc();
  banc.setState({ party: [], travelPlan: { routeId: 'r', km: 24, postes: { h: { activityId: 'etablir-cartes' } } } as never });
  const steps = buildStageSteps(banc.getState, banc.setState, 'beau', 'ete');
  banc.getState().travelPlan!.stage!.results.push({ activityId: 'etablir-cartes', actorId: 'h', roll: 1, sl: 4, success: true, ops: [], extenue: false });
  const agg = steps.find((step) => step.kind === 'stageAggregate')!;
  const rencontre = TABLES.appliers.stageAggregate(banc.getState, banc.setState, agg)?.insert?.find((step) => step.kind === 'stageEncounter');
  const int = vi.spyOn(battleRng(), 'int').mockReturnValue(3);
  rollTableStep(rencontre!.table!, battleRng());
  expect(int).toHaveBeenCalledExactlyOnceWith(1, 6);
});
