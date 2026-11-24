import { describe, it, expect } from 'vitest';
import { addCondition, addTimedCondition, stacks } from './conditions';
import { combattantDeTest, blessuresDeBase } from './combattantDeTest.testkit';

/** « Gunther », héros à 8 PB sur 10, sans État. */
const gunther = () => combattantDeTest({ id: 'gunther', label: 'Gunther', kind: 'heros', wounds: blessuresDeBase(10, 8) });

describe('pose NEUVE d’un État non cumulable : un pion (LDB 16 l.37, l.115, l.137)', () => {
  it.each(['a-terre', 'inconscient', 'surpris'])('%s posé à 2 : un seul pion', (id) => {
    const c = gunther();
    addCondition(c, id, 2);
    expect(stacks(c, id)).toBe(1);
  });

  it('la pose à durée borne aussi', () => {
    const c = gunther();
    addTimedCondition(c, 'a-terre', 3, 2);
    expect(stacks(c, 'a-terre')).toBe(1);
  });

  it('un État cumulable garde ses pions', () => {
    const c = gunther();
    addCondition(c, 'sonne', 2);
    expect(stacks(c, 'sonne')).toBe(2);
  });
});
