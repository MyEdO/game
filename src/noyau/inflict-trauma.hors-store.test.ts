/** Lot F — Effet d'éditeur `inflictTrauma` (LDB 18) : poser rétroactivement une Blessure Critique. */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyEffects } from './combatEffects';
import { makePregens } from '../data/pregens';

let banc: Banc;
beforeEach(() => {
  banc = ouvrirLeBanc();
  banc.setState({ battle: null, party: [], journal: [] });
  banc.getState().seedRng(11);
});

describe('Effet inflictTrauma', () => {
  it('fracture mineure à la jambe → trauma posé (Mouvement ÷2) + criticalWounds++', () => {
    const party = makePregens().slice(0, 2);
    banc.setState({ party });
    applyEffects(banc.getState, banc.setState, [
      { type: 'inflictTrauma', kind: 'fracture', severity: 'mineur', location: 'jambeG', heroId: party[0].id },
    ]);
    const h = banc.getState().party[0];
    expect(h.traumas?.length).toBe(1);
    expect(h.traumas![0].ops?.some((o) => o.op === 'moveScale')).toBe(true); // règle du Pied (LDB 18 l.298)
    expect(h.criticalWounds).toBe(1);
  });
  it('amputation au bras droit → séquelle permanente (main directrice)', () => {
    const party = makePregens().slice(0, 1);
    banc.setState({ party });
    applyEffects(banc.getState, banc.setState, [
      { type: 'inflictTrauma', kind: 'amputation', location: 'brasD' },
    ]);
    const h = banc.getState().party[0];
    expect(h.traumas?.length).toBeGreaterThanOrEqual(1);
    expect(h.traumas!.some((t) => /amput/i.test(t.label))).toBe(true);
  });
});
