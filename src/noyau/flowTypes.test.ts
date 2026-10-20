import { describe, expect, it } from 'vitest';
import type { GameState } from '../state/store';
import type { PatchDeFlux, Set } from './flowTypes';

describe('Set des flux : journal hors du patch (#319, #2724)', () => {
  it('refuse journal, la recopie de l’état et un Partial<GameState> brut', () => {
    const recus: unknown[] = [];
    const set: Set = (partial) => { recus.push(partial); };
    const brut: Partial<GameState> = {};
    const patch: PatchDeFlux = { party: [] };

    // @ts-expect-error journal ne s'écrit pas par le patch d'un flux
    set({ journal: [] });
    // @ts-expect-error recopier l'état emporte journal
    set((s) => ({ ...s }));
    // @ts-expect-error Partial<GameState> laisse journal ouvert
    set(brut);
    set(patch);

    expect(recus).toHaveLength(4);
  });
});
