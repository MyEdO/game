import { idsDeTest } from '../engine/idsDeTest.testkit';
import { expect, it, vi } from 'vitest';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { deDeLaTable, setDeDeTable } from '../data/overrides';
import { ouvrirLeBanc } from './banc.testkit';
import { battleRng } from './battleRng';
import { applyStructureCriticalToTarget } from './combatFlow';

it('le chemin de combat tire le dé de structure authoré', () => {
  const imprime = deDeLaTable('structureCriticals')!;
  setDeDeTable('structureCriticals', 'd6');
  try {
    const banc = ouvrirLeBanc();
    const target = { ...tousLesHerosDeScenario(idsDeTest)[0], kind: 'enemy' as const, id: 'mur' };
    const int = vi.spyOn(battleRng(), 'int').mockReturnValue(3);
    applyStructureCriticalToTarget(idsDeTest, banc.setState, target, {}, []);
    expect(int).toHaveBeenCalledExactlyOnceWith(1, 6);
  } finally {
    setDeDeTable('structureCriticals', imprime);
  }
});
