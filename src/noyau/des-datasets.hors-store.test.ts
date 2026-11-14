import { expect, it, vi } from 'vitest';
import { sousLeDe } from '../data/deDeLaTable.testkit';
import { ouvrirLeBanc } from './banc.testkit';
import { battleRng } from './battleRng';
import { rollTableStep } from './cascade';
import { buildStageSteps, TABLES } from './travelPostes';

it('l’agrégation de voyage fait tirer la Rencontre au dé authoré', () => {
  sousLeDe('rencontresPositives', 'd6', () => {
    const banc = ouvrirLeBanc();
    banc.setState({ party: [], travelPlan: { routeId: 'r', km: 24, postes: { h: { activityId: 'etablir-cartes' } } } as never });
    const steps = buildStageSteps(banc.getState, banc.setState, 'beau', 'ete');
    banc.getState().travelPlan!.stage!.results.push({ activityId: 'etablir-cartes', actorId: 'h', roll: 1, sl: 4, success: true, ops: [], extenue: false });
    const agg = steps.find((step) => step.kind === 'etapeBilan')!;
    const rencontre = TABLES.appliers.etapeBilan(banc.getState, banc.setState, agg)?.insert?.find((step) => step.kind === 'etapeRencontre');
    const int = vi.spyOn(battleRng(), 'int').mockReturnValue(3);
    rollTableStep(rencontre!.table!, battleRng());
    expect(int).toHaveBeenCalledExactlyOnceWith(1, 6);
  });
});
