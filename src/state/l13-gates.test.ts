/**
 * L13 — Gates & redirections (LDB 41/42/47) :
 *  - Bénédiction de Protection : « Test de FM Accessible (+20) pour attaquer votre cible.
 *    Sur un échec, ils doivent choisir une cible ou une Action différente. »
 *  - Martyr : « Vous recevez tous les Dégâts subis en principe par vos cibles […] votre BE est
 *    doublé pour le calcul des PB subis à cause de ces Dégâts. »
 *  - Attaques en chaîne : « S'il réduit la cible à 0 Blessure, il rebondit […] max BFM fois. »
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyCast, applyAttackResult, attackWardGate, doAttack } from './combatFlow';
import { createHero } from '../engine/character';
import { type RNG } from '../engine/dice';
import { findSpell } from '../data';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon } from '../engine/types';
import type { AttackResult } from '../engine/combat';
import type { CastResult, MissileResult } from '../engine/magic';

/** RNG scripté (padding 5). */
function seq(values: number[]): RNG {
  let i = 0;
  return { int: () => values[i++] ?? 5 } as RNG;
}

describe('L13 — gates & redirections', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    const H = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    const P = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'P', seed: 2 });
    useGame.setState({ party: [H, P] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    useGame.getState().seedRng(7);
    const b = useGame.getState().battle!;
    const hero = b.combatants.find((c) => c.label === 'H')!;
    const priest = b.combatants.find((c) => c.label === 'P')!;
    const foes = b.combatants.filter((c) => c.kind === 'enemy');
    hero.pos = { x: 10, y: 10 };
    priest.pos = { x: 9, y: 10 };
    foes.forEach((f, i) => { f.pos = { x: 11 + i, y: 10 }; });
    return { hero, priest, foes };
  }

  it('B. de Protection : jet raté → l’attaque est refusée ; jet réussi → autorisée avec jet montré', () => {
    const { hero, foes } = setup();
    const E = foes[0];
    hero.activeEffects = [{ label: 'Bénédiction de Protection', bonus: 0, duration: { scale: 'rounds', left: 6 }, attackWardFM: true }];
    E.characteristics['force-mentale'] = 30; // cible Accessible 50
    const refused = attackWardGate(E, hero, seq([99]));
    expect(refused.allowed).toBe(false);
    expect(refused.lines.join(' ')).toMatch(/ne peut se résoudre|Bénédiction de Protection/);
    const allowed = attackWardGate(E, hero, seq([5]));
    expect(allowed.allowed).toBe(true);
    expect(allowed.lines.join(' ')).toMatch(/surmonte/);
    const noWard = attackWardGate(E, foes[1] ?? hero, seq([99]));
    if (foes[1]) expect(noWard).toEqual({ allowed: true, lines: [] }); // sans bénédiction : aucun Test
  });

  it('B. de Protection : l’IA renonce à frapper le héros béni (jet raté)', () => {
    const { hero, foes } = setup();
    const E = foes[0];
    hero.activeEffects = [{ label: 'Bénédiction de Protection', bonus: 0, duration: { scale: 'rounds', left: 6 }, attackWardFM: true }];
    E.characteristics['force-mentale'] = 1; // cible 21
    // graine dont le 1er d100 rate la cible 21 (cherchée puis rejouée — déterministe par seed).
    let failSeed: number | null = null;
    for (let s = 1; s <= 60; s++) {
      useGame.getState().seedRng(s);
      if (!attackWardGate(E, hero).allowed) { failSeed = s; break; }
    }
    expect(failSeed).not.toBeNull();
    useGame.getState().seedRng(failSeed!);
    const before = hero.wounds.current;
    const suspended = doAttack(useGame.getState, useGame.setState, E, hero);
    expect(suspended).toBe(false);
    expect(hero.wounds.current).toBe(before);
    expect(useGame.getState().battle!.log.map((e) => e.text).join('\n')).toMatch(/Bénédiction de Protection/);
  });

  it('B. de Protection (héros attaquant) : le clic DIFFÈRE l’attaque derrière un Test de FM influençable', () => {
    const { hero, foes } = setup();
    const E = foes[0];
    E.activeEffects = [{ label: 'Bénédiction de Protection', bonus: 0, duration: { scale: 'rounds', left: 6 }, attackWardFM: true }];
    hero.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 }; // adjacent → frappe directe (pas de charge/approche)
    const turn = useGame.getState().battle!.order.indexOf(hero.id);
    useGame.setState({ battle: { ...useGame.getState().battle!, turn, action: null, acted: false } });
    // Tap-2 (confirm) sur la cible bénie → AUCUNE attaque encore : on diffère derrière pendingWard.
    useGame.getState().battleClickEntity(E.id, { confirm: true });
    expect(useGame.getState().pendingWard).toMatchObject({ attackerId: hero.id, targetId: E.id });
    expect(useGame.getState().pendingAttack).toBeNull();
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('B. de Protection (héros) : Test réussi → l’attaque est relancée ; Action non consommée tant que pas frappée', () => {
    const { hero, foes } = setup();
    const E = foes[0];
    E.activeEffects = [{ label: 'Bénédiction de Protection', bonus: 0, duration: { scale: 'rounds', left: 6 }, attackWardFM: true }];
    hero.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 };
    const turn = useGame.getState().battle!.order.indexOf(hero.id);
    useGame.setState({ battle: { ...useGame.getState().battle!, turn, action: null, acted: false } });
    useGame.getState().battleClickEntity(E.id, { confirm: true });
    // Force le succès du Test de FM puis valide → l’attaque se relance (cascade d’attaque ouverte).
    useGame.setState({ pendingWard: { ...useGame.getState().pendingWard!, result: { success: true, roll: 5, target: 50, sl: 4 } } });
    useGame.getState().wardConfirm();
    expect(useGame.getState().pendingWard).toBeNull();
    expect(useGame.getState().pendingCascade).not.toBeNull(); // l’attaque a été relancée
    expect(useGame.getState().battle!.log.map((e) => e.text).join('\n')).toMatch(/surmonte sa honte/);
  });

  it('B. de Protection (héros) : Test raté → l’attaque n’a pas lieu, rien n’est consommé', () => {
    const { hero, foes } = setup();
    const E = foes[0];
    E.activeEffects = [{ label: 'Bénédiction de Protection', bonus: 0, duration: { scale: 'rounds', left: 6 }, attackWardFM: true }];
    hero.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 };
    const turn = useGame.getState().battle!.order.indexOf(hero.id);
    useGame.setState({ battle: { ...useGame.getState().battle!, turn, action: null, acted: false } });
    useGame.getState().battleClickEntity(E.id, { confirm: true });
    useGame.setState({ pendingWard: { ...useGame.getState().pendingWard!, result: { success: false, roll: 96, target: 50, sl: -4 } } });
    useGame.getState().wardConfirm();
    expect(useGame.getState().pendingWard).toBeNull();
    expect(useGame.getState().pendingAttack).toBeNull();
    expect(useGame.getState().pendingCascade).toBeNull();
    expect(useGame.getState().battle!.acted).toBe(false); // l’Action n’est PAS consommée
    expect(useGame.getState().battle!.log.map((e) => e.text).join('\n')).toMatch(/ne peut se résoudre/);
  });

  it('Martyr : le prêtre encaisse les Dégâts bruts à 2×BE, la cible ne perd rien', () => {
    const { hero, priest, foes } = setup();
    const E = foes[0];
    hero.activeEffects = [{ label: 'Martyr', bonus: 0, duration: { scale: 'rounds', left: 4 }, martyrGuard: priest.id }];
    priest.characteristics.endurance = 30; // BE 3 → doublé 6
    priest.armour.corps = 0;
    priest.wounds = { current: 12, max: 12 } as Combatant['wounds'];
    const heroBefore = hero.wounds.current;
    const res = { hit: true, damage: 10, woundsLost: 7, location: 'corps', critical: false, log: 'touche.' } as unknown as AttackResult;
    const weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] } as unknown as Weapon;
    applyAttackResult(useGame.getState, useGame.setState, E, hero, weapon, res);
    expect(hero.wounds.current).toBe(heroBefore); // la cible reste indemne (dégâts renvoyés au Martyr)
    expect(priest.wounds.current).toBe(12 - Math.max(0, 10 - 6)); // 10 bruts − 2×BE(3) = 4
  });

  it('Attaques en chaîne : la cible tombe à 0 → le Projectile rebondit sur l’ennemi voisin', () => {
    const { hero, foes } = setup();
    const E1 = foes[0]; // cible principale, mourante
    const E2 = foes[1]; // voisin — receveur du rebond
    if (!E2) return; // garde : la rencontre doit fournir ≥ 2 ennemis
    hero.characteristics['force-mentale'] = 40; // BFM 4 → 4 rebonds max, saut 4 m
    hero.skills.push({ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 10 });
    E1.wounds = { current: 1, max: 8 } as Combatant['wounds'];
    E2.pos = { x: 12, y: 10 }; // à 1 case d'E1 (11,10)
    const e2Before = E2.wounds.current;
    const res: CastResult & Partial<MissileResult> = {
      cast: true, roll: 30, target: 70, sl: 2, isCritical: false, isFumble: false, log: 'lance Attaques en chaîne',
      hit: true, woundsLost: 5, damage: 10, location: 'corps', defenderDefeated: false,
    };
    applyCast(useGame.getState, useGame.setState, hero, E1, findSpell('Attaques en chaîne')!, res, true, false);
    const log = useGame.getState().battle!.log.map((e) => e.text).join('\n');
    expect(E1.wounds.current).toBe(0);
    expect(log).toMatch(/rebondit sur/);
    expect(E2.wounds.current).toBeLessThan(e2Before); // le rebond a frappé
  });
});
