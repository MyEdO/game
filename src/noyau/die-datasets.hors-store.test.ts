import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); });
afterEach(() => {
  vi.doUnmock('../data/artillery-misfire.json');
  vi.doUnmock('../data/structure-criticals.json');
  vi.doUnmock('../data/ship-criticals.json');
  vi.resetModules();
});

describe('dés authorés des tables — câblage aux lecteurs', () => {
  it.each(['2d10', 'd10+1'])('la Salve refuse une expression incompatible avec sa porte : %s', async (die) => {
    vi.doMock('../data/artillery-misfire.json', async (original) => ({ default: { ...(await original<{ default: object }>()).default, die } }));
    await expect(import('../data/artilleryMisfire')).rejects.toThrow('exige un dé unique sans modificateur');
  });
  it('la Salve expose le dé authoré à sa porte', async () => {
    vi.doMock('../data/artillery-misfire.json', async (original) => ({ default: { ...(await original<{ default: object }>()).default, die: 'd6' } }));
    const { DE_SALVE_MISFIRE } = await import('../engine/artilleryMisfire');
    expect(DE_SALVE_MISFIRE).toEqual({ n: 1, sides: 6 });
  });
  it('le critique de structure tire le dé authoré', async () => {
    vi.doMock('../data/structure-criticals.json', async (original) => ({ default: { ...(await original<{ default: object }>()).default, die: 'd6' } }));
    const { rollStructureCritical } = await import('../engine/structureCritical');
    const int = vi.fn(() => 3);
    rollStructureCritical({ int });
    expect(int).toHaveBeenCalledExactlyOnceWith(1, 6);
  });
  it('le critique de navire tire le dé authoré', async () => {
    vi.doMock('../data/ship-criticals.json', async (original) => ({ default: { ...(await original<{ default: object }>()).default, die: 'd6' } }));
    const { rollShipCritical } = await import('../engine/shipCritical');
    const int = vi.fn(() => 3);
    rollShipCritical('avirons', { int });
    expect(int).toHaveBeenCalledExactlyOnceWith(1, 6);
  });
  it('le critique fluvial certain ne consomme aucun tirage', async () => {
    const { rollShipCritical } = await import('../engine/shipCritical');
    const { RIVER_CRIT_SET } = await import('../data/shipCriticals');
    const int = vi.fn(() => 3);
    expect(rollShipCritical('avirons', { int }, undefined, RIVER_CRIT_SET).id).toBe('rames-fluvial');
    expect(int).not.toHaveBeenCalled();
  });
});
