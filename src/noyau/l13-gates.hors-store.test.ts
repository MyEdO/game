/**
 * L13 — Gates & redirections (LDB 41/42/47) :
 *  - Bénédiction de Protection : « Test de FM Accessible (+20) pour attaquer votre cible.
 *    Sur un échec, ils doivent choisir une cible ou une Action différente. »
 *  - Martyr : « Vous recevez tous les Dégâts subis en principe par vos cibles […] votre BE est
 *    doublé pour le calcul des PB subis à cause de ces Dégâts. »
 *  - Attaques en chaîne : « S'il réduit la cible à 0 Blessure, il rebondit […] max BFM fois. »
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { battleRng } from './battleRng';
import { applyCast, applyAttackResult, attackWardGate, doAttack } from './combatFlow';
import { createHero } from '../engine/character';
import { type RNG } from '../engine/dice';
import { findSpellById } from '../data';
import { testScene } from '../scenes/test-fixture';
import type { Weapon } from '../engine/types';
import type { AttackResult } from '../engine/combat';
import type { CastResult, MissileResult } from '../engine/magic';
import { desEnSuite } from '../engine/dice.testkit';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { cliquerSurLeCombattant } from './combatOrParty';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** RNG scripté (padding 5). */
function seq(values: number[]): RNG {
  return desEnSuite(values, { ensuite: 5 });
}

describe('L13 — gates & redirections', () => {
  function setup() {
    const H = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    const P = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'P', seed: 2 });
    banc.setState({ party: [H, P] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.getState().ensemencerLeTirage(7);
    const b = banc.getState().battle!;
    const hero = b.combatants.find((c) => c.label === 'H')!;
    const priest = b.combatants.find((c) => c.label === 'P')!;
    const foes = b.combatants.filter((c) => c.kind === 'ennemi');
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
      banc.getState().ensemencerLeTirage(s);
      if (!attackWardGate(E, hero, battleRng()).allowed) { failSeed = s; break; }
    }
    expect(failSeed).not.toBeNull();
    banc.getState().ensemencerLeTirage(failSeed!);
    const before = hero.wounds.current;
    const suspended = doAttack(banc.getState, banc.setState, E, hero);
    expect(suspended).toBeUndefined();
    expect(hero.wounds.current).toBe(before);
    expect(banc.getState().battle!.log.map((e) => e.text).join('\n')).toMatch(/Bénédiction de Protection/);
  });

  it('B. de Protection (héros attaquant) : le clic DIFFÈRE l’attaque derrière un Test de FM influençable', () => {
    const { hero, foes } = setup();
    const E = foes[0];
    E.activeEffects = [{ label: 'Bénédiction de Protection', bonus: 0, duration: { scale: 'rounds', left: 6 }, attackWardFM: true }];
    hero.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 }; // adjacent → frappe directe (pas de charge/approche)
    const turn = banc.getState().battle!.order.indexOf(hero.id);
    banc.setState({ battle: { ...banc.getState().battle!, turn, action: null, acted: false } });
    // Tap-2 (confirm) sur la cible bénie → AUCUNE attaque encore : on diffère derrière pendingWard.
    cliquerSurLeCombattant(banc.getState, E.id, { confirm: true });
    expect(banc.getState().pendingWard).toMatchObject({ attackerId: hero.id, targetId: E.id });
    expect(banc.getState().pendingAttack).toBeNull();
    expect(banc.getState().pendingCascade).toBeNull();
  });

  it('B. de Protection (héros) : Test réussi → l’attaque est relancée ; Action non consommée tant que pas frappée', () => {
    const { hero, foes } = setup();
    const E = foes[0];
    E.activeEffects = [{ label: 'Bénédiction de Protection', bonus: 0, duration: { scale: 'rounds', left: 6 }, attackWardFM: true }];
    hero.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 };
    const turn = banc.getState().battle!.order.indexOf(hero.id);
    banc.setState({ battle: { ...banc.getState().battle!, turn, action: null, acted: false } });
    cliquerSurLeCombattant(banc.getState, E.id, { confirm: true });
    // Force le succès du Test de FM puis valide → l’attaque se relance (cascade d’attaque ouverte).
    banc.setState({ pendingWard: { ...banc.getState().pendingWard!, result: { success: true, roll: 5, target: 50, sl: 4 } } });
    banc.getState().jetValider('protection');
    expect(banc.getState().pendingWard).toBeNull();
    expect(banc.getState().pendingCascade).not.toBeNull(); // l’attaque a été relancée
    expect(banc.getState().battle!.log.map((e) => e.text).join('\n')).toMatch(/surmonte sa honte/);
  });

  it('B. de Protection (héros) : Test raté → l’attaque n’a pas lieu, rien n’est consommé', () => {
    const { hero, foes } = setup();
    const E = foes[0];
    E.activeEffects = [{ label: 'Bénédiction de Protection', bonus: 0, duration: { scale: 'rounds', left: 6 }, attackWardFM: true }];
    hero.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 };
    const turn = banc.getState().battle!.order.indexOf(hero.id);
    banc.setState({ battle: { ...banc.getState().battle!, turn, action: null, acted: false } });
    cliquerSurLeCombattant(banc.getState, E.id, { confirm: true });
    banc.setState({ pendingWard: { ...banc.getState().pendingWard!, result: { success: false, roll: 96, target: 50, sl: -4 } } });
    banc.getState().jetValider('protection');
    expect(banc.getState().pendingWard).toBeNull();
    expect(banc.getState().pendingAttack).toBeNull();
    expect(banc.getState().pendingCascade).toBeNull();
    expect(banc.getState().battle!.acted).toBe(false); // l’Action n’est PAS consommée
    expect(banc.getState().battle!.log.map((e) => e.text).join('\n')).toMatch(/ne peut se résoudre/);
  });

  it('Martyr : le prêtre encaisse les Dégâts bruts à 2×BE, la cible ne perd rien', () => {
    const { hero, priest, foes } = setup();
    const E = foes[0];
    hero.activeEffects = [{ label: 'Martyr', bonus: 0, duration: { scale: 'rounds', left: 4 }, martyrGuard: priest.id }];
    priest.characteristics.endurance = 30; // BE 3 → doublé 6
    priest.armour.corps = 0;
    priest.wounds = blessuresDeBase(12, 12, priest);
    const heroBefore = hero.wounds.current;
    const res = { hit: true, damage: 10, woundsLost: 7, location: 'corps', critical: false, log: 'touche.' } as unknown as AttackResult;
    const weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] } as unknown as Weapon;
    applyAttackResult(banc.getState, banc.setState, E, hero, weapon, res);
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
    E1.wounds = blessuresDeBase(8, 1, E1);
    E2.pos = { x: 12, y: 10 }; // à 1 case d'E1 (11,10)
    const e2Before = E2.wounds.current;
    const res: CastResult & Partial<MissileResult> = {
      cast: true, roll: 30, target: 70, sl: 2, isCritical: false, isFumble: false, log: 'lance Attaques en chaîne',
      hit: true, woundsLost: 5, damage: 10, location: 'corps', defenderDefeated: false,
    };
    applyCast(banc.getState, banc.setState, hero, E1, findSpellById('attaques-en-chaine')!, res, true, false);
    const log = banc.getState().battle!.log.map((e) => e.text).join('\n');
    expect(E1.wounds.current).toBe(0);
    expect(log).toMatch(/rebondit sur/);
    expect(E2.wounds.current).toBeLessThan(e2Before); // le rebond a frappé
  });
});
