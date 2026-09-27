/**
 * Fin de combat — les `activeEffects` à durée en Rounds (LDB 47/EDOC 13 : Allure démoniaque
 * `op:'rollMutation'`/`grantTrait` avec `duration:{scale:'rounds'}`) ne peuvent PAS ticker hors combat
 * (les Rounds n'existent qu'EN combat). `finalizeBattle` doit donc les DÉTACHER explicitement au
 * teardown — sinon la DONNÉE portée (`mutations`/`traits`, carriée par `carryOverState`) devient
 * orpheline et PERMANENTE (plus aucun porteur pour l'expirer), un combat suivant ne pouvant jamais
 * l'effacer. Même couture d'expiration que `tickDurations`/fin de Round (`removeActiveEffects`).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { finalizeBattle } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { rollMutation } from '../data/mutations';
import { attachMutation } from '../engine/corruption';
import { testScene } from '../scenes/test-fixture';

describe('finalizeBattle — teardown des activeEffects à durée Rounds (jamais d\'orphelin permanent)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    const W = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'W', seed: 3 });
    useGame.setState({ party: [W] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    return b.combatants.find((c) => c.label === 'W')!;
  }

  it('mutation TEMPORISÉE (rollMutation, Rounds restants) → détachée au teardown, jamais reportée en permanent', () => {
    const caster = setup();
    const m = rollMutation('edoc-phys-nurgle', makeRNG(4)); // die=4 → sang-acide (edoc-phys-nurgle)
    attachMutation(caster, m, makeRNG(1));
    caster.activeEffects = [{ label: 'Allure démoniaque', bonus: 0, duration: { scale: 'rounds', left: 3 }, grantedMutation: m }];
    expect(caster.mutations?.some((x) => x.id === m.id)).toBe(true);
    finalizeBattle(useGame.getState, useGame.setState);
    const heroAfter = useGame.getState().party.find((h) => h.id === caster.id)!;
    // Détachée AVANT écriture (couture unique `removeActiveEffects`) : la donnée écrite au groupe
    // est déjà propre — pas de porteur mort qui traîne (activeEffects lui-même n'est de toute façon
    // jamais reporté hors combat).
    expect(heroAfter.mutations?.some((x) => x.id === m.id)).toBe(false);
  });

  it('Trait accordé à durée (grantTrait, Rounds restants) → détaché au teardown, jamais permanent', () => {
    const caster = setup();
    caster.traits = [...(caster.traits ?? []), { id: 'peur', value: 3 }];
    caster.activeEffects = [{ label: 'Allure démoniaque', bonus: 0, duration: { scale: 'rounds', left: 2 }, grantedTrait: { id: 'peur', value: 3 } }];
    finalizeBattle(useGame.getState, useGame.setState);
    const heroAfter = useGame.getState().party.find((h) => h.id === caster.id)!;
    expect((heroAfter.traits ?? []).some((t) => t.id === 'peur')).toBe(false);
  });

  it('effet à durée PERMANENTE ou d\'HORLOGE (clock) : jamais touché par ce teardown', () => {
    const caster = setup();
    caster.activeEffects = [
      { label: 'Buff permanent', bonus: 0, duration: { scale: 'permanent' }, char: 'force' },
      { label: 'Contrecoup', bonus: 0, duration: { scale: 'clock', until: 999999 } },
    ];
    finalizeBattle(useGame.getState, useGame.setState);
    expect(caster.activeEffects).toHaveLength(2);
  });
});
