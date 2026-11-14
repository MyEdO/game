import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { canMove } from './mount';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { effectiveMovement } from '../engine/encumbrance';
import type { AttackResult } from '../engine/combat';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const HIT: AttackResult = {
  hit: true, attackerRoll: 40, netSL: 1, location: 'corps', damage: 3, woundsLost: 3,
  critical: false, advantageTo: 'attaquant', defenderDefeated: false, log: '',
};

/**
 * Tir « immobile » (option, comme « Tirer dans le tas ») : puisque le Mouvement est décomposable et qu'on
 * peut bouger APRÈS le tir, un tir mobile garde la pénalité -10 (LDB 14 l.70). Décider de NE PAS bouger
 * (tirImmobile) annule la pénalité MAIS consomme le Mouvement du Tour (on ne pourra plus se déplacer).
 */
describe('Tir immobile (tirImmobile)', () => {
  function setup() {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    const E = b.combatants.find((c) => c.kind === 'ennemi')!;
    H.weapons = [{ label: 'Arc', type: 'distance', damage: { plusBF: false, flat: 8 }, range: 60, qualities: [] }] as never;
    H.pos = { x: 6, y: 10 };
    E.pos = { x: 12, y: 10 }; // à distance → arme à distance employée
    return { H, E };
  }

  it('tir immobile : confirme → le Mouvement du Tour est consommé (plus de déplacement possible)', () => {
    const { H, E } = setup();
    const M = effectiveMovement(H);
    banc.setState({
      battle: { ...banc.getState().battle!, acted: false, movementUsed: 0, movedPreAction: false },
      pendingAttack: { attackerId: H.id, targetId: E.id, location: null, result: HIT, tirImmobile: true },
    });
    banc.getState().jetValider('attaque');
    const st = banc.getState();
    const h = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(st.battle!.movementUsed).toBe(M); // Mouvement consommé par l'immobilisation
    expect(canMove(st.battle!, h)).toBe(false); // plus de déplacement après le tir immobile
  });

  it('tir mobile (tirImmobile absent) : confirme → le Mouvement RESTE disponible (on peut encore bouger)', () => {
    const { H, E } = setup();
    banc.setState({
      battle: { ...banc.getState().battle!, acted: false, movementUsed: 0, movedPreAction: false },
      pendingAttack: { attackerId: H.id, targetId: E.id, location: null, result: HIT },
    });
    banc.getState().jetValider('attaque');
    const st = banc.getState();
    const h = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(st.battle!.movementUsed).toBe(0); // pas d'immobilisation → Mouvement intact
    expect(canMove(st.battle!, h)).toBe(true); // Action puis Mouvement reste permis
  });
});
