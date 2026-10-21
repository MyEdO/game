import { describe, it, expect } from 'vitest';
import { musicDefsFor } from './music';

describe('musicDefsFor — pistes par contexte (registre)', () => {
  it('chaque contexte a au moins une piste', () => {
    for (const ctx of ['exploration', 'interieur', 'combat'] as const) {
      expect(musicDefsFor(ctx).length, `contexte ${ctx}`).toBeGreaterThan(0);
    }
  });
  it('ne retourne que des defs musique du contexte (jamais un SFX)', () => {
    for (const ctx of ['exploration', 'interieur', 'combat'] as const) {
      for (const def of musicDefsFor(ctx)) expect(def.music?.contexts).toContain(ctx);
    }
  });
  it('le combat joue la piste de bataille', () => {
    expect(musicDefsFor('combat').map((d) => d.id)).toContain('musique-combat');
  });
});
