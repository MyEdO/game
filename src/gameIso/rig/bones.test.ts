import { describe, it, expect } from 'vitest';
import { BONE_IDS, SLOT_BONES, SLOT_LAYER } from './bones';
import type { Slot } from '../../engine/authoringAppearance';

describe('bones registry', () => {
  it('chaque slot pointe vers des os connus', () => {
    const known = new Set<string>(BONE_IDS);
    for (const bones of Object.values(SLOT_BONES))
      for (const b of bones) expect(known.has(b)).toBe(true);
  });

  it('chaque slot a un ordre de calque défini', () => {
    for (const slot of Object.keys(SLOT_BONES) as Slot[])
      expect(typeof SLOT_LAYER[slot]).toBe('number');
  });
});
