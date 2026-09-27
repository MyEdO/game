import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyAttackResult } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { stacks } from '../engine/conditions';
import { removeSurgicalTrauma } from '../engine/trauma';
import type { AttackResult } from '../engine/combat';
import type { Trauma } from '../engine/types';

/**
 * #190 — Réouverture (LDB 18 / AA 07) : tant qu'une plaie critique n'est pas recousue par Chirurgie,
 * chaque nouveau Dégât à la MÊME Localisation octroie ses États Hémorragique. Le déclencheur vit au point
 * d'application des Dégâts localisés d'une attaque (`applyAttackResult`) : ici on POSE la plaie
 * (`bleedOnReinjury`) puis on frappe la localisation pour observer les États ajoutés (le coup fondateur
 * du critique est stampé APRÈS son propre Dégât, il ne se déclenche donc pas lui-même — testé au moteur).
 */
describe('#190 — réouverture par Dégât localisé au point d’application (applyAttackResult)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup(gate: Trauma) {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    H.wounds = { current: 20, max: 20, base: 20 } as never; // grande réserve : pas de mort ni Critique d'overkill
    H.armour = { tete: 0, corps: 0, brasG: 0, brasD: 0, jambeG: 0, jambeD: 0 } as never;
    H.traumas = [gate];
    useGame.setState({ battle: { ...useGame.getState().battle! } });
    return { H, E };
  }

  /** Touche NON-critique, sans overkill, à la localisation `loc` (2 PB perdus). */
  const hit = (loc: string): AttackResult => ({
    hit: true, attackerRoll: 40, netSL: 1, location: loc as never, damage: 2, woundsLost: 2,
    critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '',
  });

  it('nouveau Dégât à la MÊME Localisation → +N États Hémorragique', () => {
    const { H, E } = setup({ label: 'Dégâts artériels', location: 'corps', bleedOnReinjury: 2, needsSurgery: true });
    applyAttackResult(useGame.getState, useGame.setState, E, H, E.weapons[0], hit('corps'));
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(stacks(h, 'hemorragique')).toBe(2);
  });

  it('Dégât à une AUTRE Localisation → aucun État Hémorragique', () => {
    const { H, E } = setup({ label: 'Dégâts artériels', location: 'corps', bleedOnReinjury: 2, needsSurgery: true });
    applyAttackResult(useGame.getState, useGame.setState, E, H, E.weapons[0], hit('brasD'));
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(stacks(h, 'hemorragique')).toBe(0);
  });

  it('après Chirurgie (plaie retirée) → un nouveau Dégât à la Localisation ne rouvre plus rien', () => {
    const { H, E } = setup({ label: 'Cuisse lacérée', location: 'jambeD', bleedOnReinjury: 1, needsSurgery: true });
    H.criticalWounds = 1;
    removeSurgicalTrauma(H);
    applyAttackResult(useGame.getState, useGame.setState, E, H, E.weapons[0], hit('jambeD'));
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(stacks(h, 'hemorragique')).toBe(0);
  });
});
