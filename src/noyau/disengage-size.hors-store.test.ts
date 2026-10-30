import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

// ---------------------------------------------------------------------------
// Désengagement gratuit du plus grand (LDB 85 - Traits de creature.md l.373-374)
// ---------------------------------------------------------------------------

describe('Désengagement & Taille (store)', () => {
  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    return { b, H, enemies };
  }

  /** Engage `H` avec `foes`, place le tour sur H, action libre. */
  function engageAndActivate(H: Combatant, foes: Combatant[]) {
    H.engagedWith = foes.map((f) => f.id);
    for (const f of foes) f.engagedWith = [H.id];
    const b = banc.getState().battle!;
    const turn = b.order.indexOf(H.id);
    banc.setState({ battle: { ...b, turn, action: null, movementUsed: 0, acted: false } });
  }

  it('plus grand que TOUS ses Engagés → déplacement libre, sans pendingDisengage, liens levés', () => {
    const { H, enemies } = setup();
    H.size = 'grande';
    const E = enemies[0];
    E.size = 'moyenne';
    enemies.slice(1).forEach((e) => (e.dead = true));
    engageAndActivate(H, [E]);

    banc.getState().battleDisengage();

    const st = banc.getState();
    expect(st.pendingDisengage).toBeNull(); // court-circuité : aucun menu de Désengagement
    expect(st.battle!.action).toBeNull(); expect(st.battle!.reachable.size).toBeGreaterThan(0); // déplacement libre rouvert (budget posé)
    expect(st.battle!.reachable.size).toBeGreaterThan(0);
    const h = st.battle!.combatants.find((c) => c.id === H.id)!;
    const e = st.battle!.combatants.find((c) => c.id === E.id)!;
    expect(h.engagedWith).toEqual([]); // liens Engagé levés des deux côtés
    expect(e.engagedWith ?? []).not.toContain(H.id);
  });

  it('même Taille → Désengagement normal (menu de choix ouvert)', () => {
    const { H, enemies } = setup();
    H.size = 'moyenne';
    const E = enemies[0];
    E.size = 'moyenne';
    enemies.slice(1).forEach((e) => (e.dead = true));
    engageAndActivate(H, [E]);

    banc.getState().battleDisengage();

    expect(banc.getState().pendingDisengage?.phase).toBe('choice'); // pas de court-circuit
  });

  it('plus grand qu’un seul de deux Engagés (pas tous) → Désengagement normal', () => {
    const { H, enemies } = setup();
    H.size = 'grande';
    const [E1, E2] = enemies;
    E1.size = 'moyenne'; // plus petit
    E2.size = 'grande'; // PAS plus petit → pas de désengagement gratuit
    enemies.slice(2).forEach((e) => (e.dead = true));
    engageAndActivate(H, [E1, E2]);

    banc.getState().battleDisengage();

    expect(banc.getState().pendingDisengage?.phase).toBe('choice');
    // les liens ne sont PAS levés tant que le Désengagement n'a pas réussi
    expect(banc.getState().battle!.combatants.find((c) => c.id === H.id)!.engagedWith).toContain(E1.id);
  });
});
