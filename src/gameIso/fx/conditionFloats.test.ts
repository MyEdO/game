import { describe, it, expect } from 'vitest';
import { condSignature, diffConditionGains } from './useCombatFx';
import type { Combatant } from '../../engine/types';

const C = (id: string, conditions: { id: string; value: number }[]): Combatant =>
  ({ id, name: id, kind: 'ennemi', pos: { x: 3, y: 4 }, conditions }) as unknown as Combatant;

describe('diffConditionGains — flottants d’État par diff (lisibilité)', () => {
  it('État nouveau → flottant icône + nom ; empilement → valeur affichée', () => {
    const prev = condSignature([C('a', [{ id: 'hemorragique', value: 1 }])]);
    const gains = diffConditionGains(prev, [C('a', [{ id: 'hemorragique', value: 3 }, { id: 'sonne', value: 1 }])]);
    expect(gains).toHaveLength(2);
    expect(gains.some((g) => g.text.includes('Hémorragique 3'))).toBe(true);
    expect(gains.some((g) => g.text.includes('Sonné'))).toBe(true); // le flottant affiche le LIBELLÉ
  });
  it('État retiré ou inchangé → rien ; combattant sans instantané (entrée en scène) → rien', () => {
    const prev = condSignature([C('a', [{ id: 'sonne', value: 2 }])]);
    expect(diffConditionGains(prev, [C('a', [{ id: 'sonne', value: 1 }])])).toHaveLength(0);
    expect(diffConditionGains(prev, [C('a', [{ id: 'sonne', value: 2 }])])).toHaveLength(0);
    expect(diffConditionGains(new Map(), [C('b', [{ id: 'brise', value: 1 }])])).toHaveLength(0);
  });
});
