import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('../data/structure-criticals.json');
  vi.resetModules();
});

it('le chemin de combat tire le dé de structure authoré', async () => {
  vi.resetModules();
  vi.doMock('../data/structure-criticals.json', async (original) => ({
    default: { ...(await original<{ default: object }>()).default, die: 'd6' },
  }));
  const { ouvrirLeBanc } = await import('./banc.testkit');
  const { applyStructureCriticalToTarget } = await import('./combatFlow');
  const { battleRng } = await import('./battleRng');
  const { makePregens } = await import('../data/pregens');
  const banc = ouvrirLeBanc();
  const target = { ...makePregens()[0], kind: 'enemy' as const, id: 'mur' };
  const int = vi.spyOn(battleRng(), 'int').mockReturnValue(3);
  try {
    applyStructureCriticalToTarget(banc.setState, target, {}, []);
    expect(int).toHaveBeenCalledExactlyOnceWith(1, 6);
  } finally { int.mockRestore(); }
});
