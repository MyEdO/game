import { idsDeTest } from '../engine/idsDeTest.testkit';
import { expect, it, vi } from 'vitest';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { sousLeDe } from '../data/deDeLaTable.testkit';
import { ouvrirLeBanc } from './banc.testkit';
import { battleRng } from './battleRng';
import { applyStructureCriticalToTarget } from './combatFlow';

it('le chemin de combat tire le dé de structure authoré', () => {
  sousLeDe('structureCriticals', 'd6', () => {
    const banc = ouvrirLeBanc();
    const target = { ...tousLesHerosDeScenario(idsDeTest)[0], kind: 'ennemi' as const, id: 'mur' };
    const int = vi.spyOn(battleRng(), 'int').mockReturnValue(3);
    applyStructureCriticalToTarget(idsDeTest, banc.setState, target, {}, []);
    expect(int).toHaveBeenCalledExactlyOnceWith(1, 6);
  });
});
