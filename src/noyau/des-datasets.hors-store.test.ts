import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); });
afterEach(() => {
  vi.doUnmock('../data/rencontres-edoc.json');
  vi.resetModules();
});

it('l’agrégation de voyage tire le dé de Rencontre authoré', async () => {
  vi.doMock('../data/rencontres-edoc.json', async (original) => ({ default: { ...(await original<{ default: object }>()).default, die: 'd6' } }));
  const { ouvrirLeBanc } = await import('./banc.testkit');
  const { buildStageSteps, TABLES } = await import('./travelPostes');
  const { battleRng } = await import('./battleRng');
  const banc = ouvrirLeBanc();
  banc.setState({ party: [], travelPlan: { routeId: 'r', km: 24, postes: { h: { activityId: 'etablir-cartes' } } } as never });
  const steps = buildStageSteps(banc.getState, banc.setState, 'beau', 'ete');
  banc.getState().travelPlan!.stage!.results.push({ activityId: 'etablir-cartes', actorId: 'h', roll: 1, sl: 4, success: true, ops: [], extenue: false });
  const agg = steps.find((step) => step.kind === 'stageAggregate')!;
  const int = vi.spyOn(battleRng(), 'int').mockReturnValue(3);
  try {
    TABLES.appliers.stageAggregate(banc.getState, banc.setState, agg);
    expect(int).toHaveBeenCalledExactlyOnceWith(1, 6);
  } finally { int.mockRestore(); }
});
