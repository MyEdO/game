import { expect, it, vi } from 'vitest';
import { makePregens } from '../data/pregens';
import { deDeLaTable, setDeDeTable } from '../data/overrides';
import { ouvrirLeBanc } from './banc.testkit';
import { battleRng } from './battleRng';
import { applyStructureCriticalToTarget } from './combatFlow';

it('le chemin de combat tire le dé de structure authoré', () => {
  const imprime = deDeLaTable('structureCriticals')!;
  setDeDeTable('structureCriticals', 'd6');
  try {
    const banc = ouvrirLeBanc();
    const target = { ...makePregens()[0], kind: 'enemy' as const, id: 'mur' };
    const int = vi.spyOn(battleRng(), 'int').mockReturnValue(3);
    applyStructureCriticalToTarget(banc.setState, target, {}, []);
    expect(int).toHaveBeenCalledExactlyOnceWith(1, 6);
  } finally {
    setDeDeTable('structureCriticals', imprime);
  }
});
