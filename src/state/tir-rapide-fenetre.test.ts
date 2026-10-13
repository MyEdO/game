import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame, type BattleState } from './store';
import { initialFields } from './stateFields';
import { createHero } from '../engine/character';
import { seedBattleRng } from './battleRng';
import { emptyScene } from './scene';
import type { Combatant, Weapon } from '../engine/types';

/**
 * TIR RAPIDE, BOUCLE REPRENABLE (#997, #1765) — `LDB 11 l.97-103`. Chaque tir d'interruption passe par la
 * fenêtre du défenseur surfacé ; la boucle des tireurs s'arrête sur elle et reprend à sa fermeture, et
 * le Round ne s'ouvre qu'au bout de la boucle.
 */
const ARC = (): Weapon => ({ uid: 'arc', label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 1 }, range: 30, qualities: [], loaded: true } as unknown as Weapon);
const g = () => useGame.getState();
const de = (id: string): Combatant => g().battle!.combatants.find((c) => c.id === id)!;

/** Deux héros surfacés, deux tireurs de l'IA à Bout Portant (LDB 14 l.62 : la défense est permise).
 *  E1 a pris le talent deux fois : il tire d'abord (LDB 11 l.103). */
function finDeRound(gmSeat?: number) {
  const mk = (id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }): Combatant => {
    const c = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: id, seed: 3 });
    c.id = id; c.label = id; c.kind = kind; c.pos = pos; c.fortune = 0;
    c.wounds = { ...c.wounds, current: 200, max: 200 };
    return c;
  };
  const H1 = mk('h1', 'hero', { x: 0, y: 0 });
  const H2 = mk('h2', 'hero', { x: 0, y: 4 });
  const E1 = mk('e1', 'enemy', { x: 1, y: 0 });
  const E2 = mk('e2', 'enemy', { x: 1, y: 4 });
  E1.talents = [{ talentId: 'tir-rapide', times: 2 }];
  E2.talents = [{ talentId: 'tir-rapide', times: 1 }];
  E1.weapons = [ARC()]; E2.weapons = [ARC()];
  const battle = {
    combatants: [H1, H2, E1, E2], order: ['h1', 'h2', 'e1', 'e2'], turn: 3, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({
    ...initialFields(), party: [H1, H2], mode: 'battle', battle, scene: emptyScene(8, 8),
    net: { ...g().net, mode: 'local', mySeat: 0, gmSeat, ownership: {} },
  });
}

describe('#997 — Tir rapide de l’IA : chaque tir ouvre la fenêtre du défenseur, la boucle reprend', () => {
  beforeEach(() => { vi.useFakeTimers(); seedBattleRng(3); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('deux tireurs : deux fenêtres, dans l’ordre du talent, puis le Round s’ouvre', () => {
    finDeRound();
    g().battleEndTurn(); // → Round 2, pause de début de Round
    expect(g().pendingRoundStart).not.toBeNull();
    g().confirmRoundStart();
    // 1ʳᵉ fenêtre : E1 (talent ×2) sur H1. La boucle est PARQUÉE : E2 n'a pas tiré, le Round n'est pas ouvert.
    expect(g().pendingDefense?.attackerId).toBe('e1');
    expect(g().pendingDefense?.defenderId).toBe('h1');
    expect(de('e1').loseNextAction, 'le prix se paie avant le tir').toBe(true);
    expect(de('e2').loseNextAction, 'E2 attend la fermeture de la 1ʳᵉ fenêtre').toBeFalsy();
    expect(g().battle!.turn).toBe(-1);
    g().defenseRoll();
    g().defenseConfirm();
    // La boucle REPREND : 2ᵉ fenêtre, E2 sur H2 — le Round attend toujours.
    expect(g().pendingDefense?.attackerId).toBe('e2');
    expect(g().pendingDefense?.defenderId).toBe('h2');
    expect(g().battle!.turn).toBe(-1);
    const c = g().pendingCascade;
    expect(c?.participants[c.cursor]?.jet, 'la fenêtre de E2 est l’étape courante').toBe('defense');
    g().defenseRoll();
    g().defenseConfirm();
    // Boucle finie : le Round s'ouvre sur H1, aucune défense orpheline.
    expect(g().pendingDefense).toBeNull();
    expect(g().battle!.order[g().battle!.turn]).toBe('h1');
    expect(de('e1').loseNextAction).toBe(true);
    expect(de('e2').loseNextAction).toBe(true);
  });
});

describe('#997 — Tir rapide du héros (`pa.interrupt`) : le défenseur surfacé joue SA fenêtre', () => {
  beforeEach(() => { vi.useFakeTimers(); seedBattleRng(3); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('ennemi sous siège MJ à Bout Portant : la fenêtre s’interpose, le tir s’applique à sa fermeture', () => {
    finDeRound(0);
    const h1 = de('h1');
    h1.talents = [{ talentId: 'tir-rapide', times: 1 }];
    h1.weapons = [ARC()];
    g().battleEndTurn();
    g().preemptRangedShot('h1', 'e1');
    expect(g().pendingAttack?.interrupt).toBe(true);
    g().attackRoll();
    g().attackConfirm();
    expect(g().pendingDefense?.defenderId, 'la fenêtre de E1 s’interpose').toBe('e1');
    expect(g().pendingDefense?.suite.mode).toBe('pilotee');
    g().defenseRoll();
    g().defenseConfirm();
    expect(g().pendingDefense).toBeNull();
    expect(g().pendingAttack).toBeNull();
    expect(de('h1').loseNextAction, 'le tir est payé').toBe(true);
    expect(g().pendingRoundStart, 'toujours à la pause de début de Round').not.toBeNull();
  });
});

describe('#997 — Tir rapide d’un tireur à gratuite de créature : la suite déclarée tranche (LDB 11 l.103)', () => {
  beforeEach(() => { vi.useFakeTimers(); seedBattleRng(3); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('E1 mord (Morsure) mais son tir d’interruption ne déclenche aucune gratuite à la fermeture de la fenêtre', () => {
    finDeRound();
    de('e1').traits = [{ id: 'morsure', value: 14 }];
    de('e1').advantage = 3; // coût d'Avantage de la Morsure payable
    de('e2').talents = []; // E1 seul tireur : sa fenêtre fermée, la boucle finit et le Round s'ouvre
    g().battleEndTurn();
    g().confirmRoundStart();
    expect(g().pendingDefense?.attackerId).toBe('e1');
    expect(g().pendingDefense?.weapon.uid, 'la fenêtre est celle du tir').toBe('arc');
    expect(g().pendingDefense?.atk.success, 'le tir de E1 réussit').toBe(true);
    g().defenseRoll();
    g().defenseSetForcedRoll(96); // la défense échoue sans Maladresse : le tir touche, E1 garde son Avantage
    g().defenseConfirm();
    expect(de('e1').advantage, 'E1 peut payer la Morsure').toBeGreaterThanOrEqual(1);
    expect(g().pendingDefense, 'aucune Morsure de E1 ne suit son tir d’interruption').toBeNull();
    expect(g().battle!.order[g().battle!.turn], 'le Round s’ouvre').toBe('h1');
  });
});
