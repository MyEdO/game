import { expect, it, vi } from 'vitest';
import { parseDiceRequired } from '../engine/dice';
import * as tablesDeVoyage from '../engine/travelTables';
import { ouvrirLeBanc } from './banc.testkit';
import { battleRng } from './battleRng';
import { buildStageSteps, TABLES } from './travelPostes';

it('l’agrégation de voyage tire le dé de Rencontre authoré', () => {
  vi.spyOn(tablesDeVoyage, 'ENCOUNTER_DIE', 'get').mockReturnValue(parseDiceRequired('d6', 'fixture'));
  const banc = ouvrirLeBanc();
  banc.setState({ party: [], travelPlan: { routeId: 'r', km: 24, postes: { h: { activityId: 'etablir-cartes' } } } as never });
  const steps = buildStageSteps(banc.getState, banc.setState, 'beau', 'ete');
  banc.getState().travelPlan!.stage!.results.push({ activityId: 'etablir-cartes', actorId: 'h', roll: 1, sl: 4, success: true, ops: [], extenue: false });
  const agg = steps.find((step) => step.kind === 'stageAggregate')!;
  const int = vi.spyOn(battleRng(), 'int').mockReturnValue(3);
  TABLES.appliers.stageAggregate(banc.getState, banc.setState, agg);
  expect(int).toHaveBeenCalledExactlyOnceWith(1, 6);
});
