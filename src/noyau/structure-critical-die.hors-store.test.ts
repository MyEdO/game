import { expect, it, vi } from 'vitest';
import * as critiquesDeStructure from '../data/structureCriticals';
import { makePregens } from '../data/pregens';
import { parseDiceRequired } from '../engine/dice';
import { ouvrirLeBanc } from './banc.testkit';
import { battleRng } from './battleRng';
import { applyStructureCriticalToTarget } from './combatFlow';

it('le chemin de combat tire le dé de structure authoré', () => {
  vi.spyOn(critiquesDeStructure, 'STRUCTURE_CRITICALS_DIE', 'get').mockReturnValue(parseDiceRequired('d6', 'fixture'));
  const banc = ouvrirLeBanc();
  const target = { ...makePregens()[0], kind: 'enemy' as const, id: 'mur' };
  const int = vi.spyOn(battleRng(), 'int').mockReturnValue(3);
  applyStructureCriticalToTarget(banc.setState, target, {}, []);
  expect(int).toHaveBeenCalledExactlyOnceWith(1, 6);
});
