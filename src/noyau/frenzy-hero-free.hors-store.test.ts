import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { AttackResult } from '../engine/combat';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const HIT: AttackResult = {
  hit: true, attackerRoll: 40, netSL: 1, location: 'corps', damage: 3, woundsLost: 3,
  critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '',
};

describe('Frénésie du héros — attaque de CC GRATUITE chaque Round (LDB 21 l.33)', () => {
  beforeEach(() => {
    banc.setState({ battle: null, pendingAttack: null });
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 };
    H.talents = [...(H.talents ?? []), { talentId: 'frenesie', times: 1 }]; // octroie l'attaque d'arme libre (donnée)
    return { H, E };
  }

  it('1re attaque du Round = gratuite (Action préservée) + comptée (freeAttacksThisTurn)', () => {
    const { H, E } = setup();
    (H.psychState ??= []).push({ type: 'frenesie' });
    banc.setState({ battle: { ...banc.getState().battle!, acted: false }, pendingAttack: { attackerId: H.id, targetId: E.id, location: null, result: HIT } });
    banc.getState().attackConfirm();
    const st = banc.getState();
    const h = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.freeAttacksThisTurn?.['arme']).toBe(1);
    expect(st.battle!.acted).toBe(false); // l'Action n'est PAS consommée par l'attaque libre
  });

  it('2e attaque du même Round (gratuite déjà utilisée) → consomme l’Action', () => {
    const { H, E } = setup();
    (H.psychState ??= []).push({ type: 'frenesie' });
    H.freeAttacksThisTurn = { arme: 1 }; // attaque d'arme libre déjà utilisée ce Round (plafond atteint)
    banc.setState({ battle: { ...banc.getState().battle!, acted: false }, pendingAttack: { attackerId: H.id, targetId: E.id, location: null, result: HIT } });
    banc.getState().attackConfirm();
    expect(banc.getState().battle!.acted).toBe(true);
  });

  it('héros NON frénétique → l’attaque consomme l’Action', () => {
    const { H, E } = setup();
    banc.setState({ battle: { ...banc.getState().battle!, acted: false }, pendingAttack: { attackerId: H.id, targetId: E.id, location: null, result: HIT } });
    banc.getState().attackConfirm();
    expect(banc.getState().battle!.acted).toBe(true);
  });

  it('attaque libre de Frénésie INITIABLE même Action dépensée (entrée en Frénésie ce tour)', () => {
    const { H, E } = setup();
    (H.psychState ??= []).push({ type: 'frenesie' });
    const b = banc.getState().battle!;
    const turn = b.order.indexOf(H.id);
    banc.setState({ battle: { ...b, turn, action: null, acted: true } }); // Action déjà dépensée (Test de FM d'entrée)
    banc.getState().battleClickEntity(E.id, { confirm: true });
    expect(banc.getState().pendingAttack).not.toBeNull(); // l'attaque libre s'ouvre malgré `acted`
  });
});
