/**
 * Effets `moveEntity` et `playSfx` (#701), côté éditeur : leur résumé dans la liste d'Effets (`effectSummary`). Leur
 * application se joue au banc du noyau (`src/noyau/moveEntity-playSfx-effect.hors-store.test.ts`).
 */
import { describe, it, expect } from 'vitest';
import { CIBLES_D_EFFET_DE_SCENE } from '../noyau/combatEffects';
import type { Effect } from '../data/schemas/defs-scenes/effets';
import { effectSummary } from '../ui/editor/EffectList';

describe('effectSummary — moveEntity / playSfx', () => {
  it('résume un déplacement', () => {
    expect(effectSummary({ type: 'moveEntity', id: 'garde', to: { x: 3, y: 4 } } as Effect, { cibles: CIBLES_D_EFFET_DE_SCENE })).toMatch(/garde.*3.*4/);
  });

  it('résume un retrait', () => {
    expect(effectSummary({ type: 'moveEntity', id: 'garde', remove: true } as Effect, { cibles: CIBLES_D_EFFET_DE_SCENE })).toMatch(/[Rr]etirer garde/);
  });

  it('résume un son', () => {
    expect(effectSummary({ type: 'playSfx', id: 'gong-victoire' } as Effect, { cibles: CIBLES_D_EFFET_DE_SCENE })).toMatch(/gong-victoire/);
  });
});
