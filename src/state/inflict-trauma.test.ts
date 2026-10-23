/** Lot F — Effet d'éditeur `inflictTrauma` (LDB 18) : poser rétroactivement une Blessure Critique. */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyEffects } from '../noyau/combatEffects';
import { makePregens } from '../data/pregens';
import { idNeufDeBanc } from '../lib/entityId.testkit';

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [] });
  useGame.getState().seedRng(11);
});

describe('Effet inflictTrauma', () => {
  it('fracture mineure à la jambe → trauma posé (Mouvement ÷2) + criticalWounds++', () => {
    const party = makePregens(idNeufDeBanc).slice(0, 2);
    useGame.setState({ party });
    applyEffects(useGame.getState, useGame.setState, [
      { type: 'inflictTrauma', kind: 'fracture', severity: 'mineur', location: 'jambeG', heroId: party[0].id },
    ]);
    const h = useGame.getState().party[0];
    expect(h.traumas?.length).toBe(1);
    expect(h.traumas![0].ops?.some((o) => o.op === 'moveScale')).toBe(true); // règle du Pied (LDB 18 l.298)
    expect(h.criticalWounds).toBe(1);
  });
  it('amputation au bras droit → séquelle permanente (main directrice)', () => {
    const party = makePregens(idNeufDeBanc).slice(0, 1);
    useGame.setState({ party });
    applyEffects(useGame.getState, useGame.setState, [
      { type: 'inflictTrauma', kind: 'amputation', location: 'brasD' },
    ]);
    const h = useGame.getState().party[0];
    expect(h.traumas?.length).toBeGreaterThanOrEqual(1);
    expect(h.traumas!.some((t) => /amput/i.test(t.label))).toBe(true);
  });
});
