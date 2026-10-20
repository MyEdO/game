import { describe, it, expect } from 'vitest';
import { nextEntityId } from './entityId';

describe('nextEntityId', () => {
  it('plus petit suffixe libre, base36', () => {
    expect(nextEntityId('personnage', [])).toBe('personnage-0');
    expect(nextEntityId('objet', ['objet-0', 'objet-1'])).toBe('objet-2');
  });
  it('saute les ids pris (trou)', () => {
    expect(nextEntityId('e', ['e-0', 'e-2'])).toBe('e-1');
  });
  it('unicité en accumulant', () => {
    const taken = new Set<string>();
    const a = nextEntityId('p', taken);
    taken.add(a);
    const b = nextEntityId('p', taken);
    taken.add(b);
    expect(a).not.toBe(b);
  });
});
