/**
 * Lot E — compléments Corruption : Âme pure (LDB 10, seuil +niveau), « Je te renie ! »
 * (LDB 17 l.67, refus de mutation contre 1 Résilience), exposition par le Trait Corruption.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { gainCorruption } from './corruptionFlow';
import { draineCascade } from './cascadeTestKit';
import { corruptionThresholdExceeded } from '../engine/corruption';
import { PREGEN } from '../data/pregens';
import { createHero } from '../engine/character';
import { bonus } from '../engine/characteristics';
import type { Combatant } from '../engine/types';

/** Sans Talent aléatoire (`talentsRolled: false`) : aucun tirage d'Âme pure (LDB 10 l.52). */
function hero(): Combatant {
  return createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Sigmund', id: `pregen-${PREGEN.soldat}`, seed: PREGEN.soldat, talentsRolled: false });
}

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], pendingCorruption: null, pendingRenounce: null });
  useGame.getState().seedRng(7);
});

describe('Âme pure (LDB 10) — seuil de Corruption +niveau', () => {
  it('le talent relève le seuil BFM+BE du nombre de niveaux', () => {
    const h = hero();
    const base = bonus(h.characteristics['force-mentale']) + bonus(h.characteristics.endurance);
    h.corruption = base + 1;
    expect(corruptionThresholdExceeded(h)).toBe(true);
    h.talents = [...h.talents, { talentId: 'ame-pure', times: 2 }];
    expect(corruptionThresholdExceeded(h)).toBe(false); // seuil +2
    h.corruption = base + 3;
    expect(corruptionThresholdExceeded(h)).toBe(true);
  });
});

describe('« Je te renie ! » (LDB 17 l.67)', () => {
  /** Franchit le seuil : le Test de Résistance est désormais une MODALE (kind 'seuil') —
   *  on lance puis on FORCE l'échec (déterministe) avant d'acquitter. */
  function corruptPastThreshold(h: Combatant): void {
    h.characteristics.endurance = 1;
    h.characteristics['force-mentale'] = 1;
    h.corruption = 10; // largement au-delà du seuil (BFM+BE = 0)
    gainCorruption(useGame.getState, useGame.setState, h, 1);
    expect(useGame.getState().pendingCorruption?.kind).toBe('seuil'); // le jet est VISIBLE
    useGame.getState().corruptionRoll();
    useGame.setState({ pendingCorruption: { ...useGame.getState().pendingCorruption!, roll: 99, target: 5, sl: -9, success: false } });
    useGame.getState().resolveCorruption();
  }
  it('héros avec Résilience → la mutation est SUSPENDUE (pendingRenounce)', () => {
    const h = hero();
    h.resilience = 1;
    useGame.setState({ party: [h] });
    corruptPastThreshold(h);
    expect(useGame.getState().pendingRenounce).toBeTruthy();
    expect(h.mutations ?? []).toEqual([]);
    const before = h.corruption!;
    useGame.getState().renounceResolve(true);
    expect(useGame.getState().pendingRenounce).toBeNull();
    expect(h.resilience).toBe(0); // 1 Point de Résilience dépensé
    expect(h.mutations ?? []).toEqual([]); // pas de mutation
    expect(h.corruption).toBe(before); // « vous ne perdez aucun Point de Corruption »
  });
  it('« Subir » → la mutation s’applique (−BFM Points, tirage)', () => {
    const h = hero();
    h.resilience = 1;
    useGame.setState({ party: [h] });
    corruptPastThreshold(h);
    expect(useGame.getState().pendingRenounce).toBeTruthy();
    useGame.getState().renounceResolve(false);
    draineCascade(useGame.getState); // les dés de la mutation sont des étapes : elle tombe en les jouant
    expect((h.mutations ?? []).length).toBe(1);
  });
  it('sans Résilience → mutation à l’acquittement (pas de « Je te renie ! »)', () => {
    const h = hero();
    h.resilience = 0;
    useGame.setState({ party: [h] });
    corruptPastThreshold(h);
    expect(useGame.getState().pendingRenounce).toBeNull();
    draineCascade(useGame.getState); // idem : l'acquittement pousse les étapes, il ne mute pas sur place
    expect((h.mutations ?? []).length).toBe(1);
  });
});
