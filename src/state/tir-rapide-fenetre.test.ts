import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame, type BattleState } from './store';
import { initialFields } from './stateFields';
import { createHero } from '../engine/character';
import { seedBattleRng } from './battleRng';
import { emptyScene } from './scene';
import { t } from '../i18n';
import type { Combatant, Weapon } from '../engine/types';
import { draineCascade, poseSurDeNonTombe } from './cascadeTestKit';

/**
 * TIR RAPIDE, BOUCLE REPRENABLE (#997, #1765) — `LDB 11 l.97-103`. Chaque tir d'interruption passe par la
 * fenêtre du défenseur surfacé ; la boucle des tireurs s'arrête sur elle et reprend à sa fermeture, et
 * le Round ne s'ouvre qu'au bout de la boucle.
 */
const ARC = (): Weapon => ({ uid: 'arc', label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 1 }, range: 30, qualities: [], loaded: true } as unknown as Weapon);
const g = () => useGame.getState();
const de = (id: string): Combatant => g().battle!.combatants.find((c) => c.id === id)!;
/** Les Tirs rapides déclenchés par `id`, comptés à leur marqueur de journal. */
const tirsDe = (id: string) => g().battle!.log.filter((l) => l.text === t('cf.tirRapide', { name: id })).length;
const etape = () => { const c = g().pendingCascade; return c?.participants[c.cursor]; };

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

/** #1765 (DoD, point 2) — le tir d'interruption est SUSPENDU par la Maladresse de son défenseur : la boucle
 *  des tireurs suivants est la suite du coup (`enchainement: tirRapide`), elle ne reprend qu'au dé. */
describe('#1765 — Tir rapide : la Maladresse du défenseur suspend la boucle, qui reprend au dé, une fois', () => {
  beforeEach(() => { vi.useFakeTimers(); seedBattleRng(3); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('H1 rate sa défense sur un double : E2 attend le dé de Maladresse, puis tire UNE fois', () => {
    finDeRound();
    g().battleEndTurn();
    g().confirmRoundStart();
    expect(g().pendingDefense?.attackerId).toBe('e1');
    g().defenseRoll();
    g().defenseSetForcedRoll(99); // LDB 14 l.13
    g().defenseConfirm();
    expect(etape()?.kind, 'la Maladresse tient la main').toBe('fumbleJet');
    expect(g().pendingDefense, 'E2 n’a pas encore sa fenêtre').toBeNull();
    expect(de('e2').loseNextAction, 'E2 n’a pas tiré').toBeFalsy();
    expect(g().battle!.turn, 'le Round attend la boucle').toBe(-1);
    g().fumbleRoll();
    g().fumbleConfirm();
    expect(g().pendingDefense?.attackerId, 'la boucle reprend sur E2').toBe('e2');
    expect(tirsDe('e2'), 'E2 tire UNE fois').toBe(1);
    g().defenseRoll();
    g().defenseConfirm();
    draineCascade(g, 10, poseSurDeNonTombe(1));
    expect(tirsDe('e2'), 'aucune reprise de plus').toBe(1);
    expect(g().pendingCascade, 'aucune étape orpheline').toBeNull();
  });
});

/** #1765 (DoD, point 2) — la Maladresse d'une arme Bâclé (LDB 60 l.50) et Solide (LDB 60 l.30) ouvre, au dé
 *  de Maladresse, le dé de Sauvegarde Solide : la boucle des tireurs ne reprend qu'à ce dé, une fois. Siège MJ
 *  0 : les tireurs sont des PNJ alliés de l'IA (`aiControlled`), l'ennemi visé défend sous le siège MJ. */
describe('#1765 — Tir rapide : Maladresse d’arme Bâclé+Solide, la boucle reprend au dé de Sauvegarde, une fois', () => {
  beforeEach(() => { vi.useFakeTimers(); seedBattleRng(3); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
  const LAME = (): Weapon => ({ uid: 'lame', label: 'Lame', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [{ id: 'bacle' }, { id: 'solide', value: 1 }] } as unknown as Weapon);

  it('E1, sous siège MJ, rate sa défense sur un double : H2 attend le dé de Maladresse PUIS le dé de Solide, et tire UNE fois', () => {
    finDeRound(0);
    for (const [id, times] of [['h1', 2], ['h2', 1]] as const) {
      de(id).aiControlled = true;
      de(id).talents = [{ talentId: 'tir-rapide', times }];
      de(id).weapons = [ARC()];
    }
    for (const id of ['e1', 'e2']) { de(id).talents = []; de(id).weapons = [LAME()]; }
    g().battleEndTurn();
    g().confirmRoundStart();
    expect(g().pendingDefense?.attackerId).toBe('h1');
    expect(g().pendingDefense?.defenderId).toBe('e1');
    g().defenseRoll();
    g().defenseSetForcedRoll(99); // LDB 14 l.13
    g().defenseConfirm();
    expect(etape()?.kind, 'la Maladresse de E1 tient la main').toBe('fumbleJet');
    g().fumbleRoll();
    g().fumbleConfirm();
    const solide = etape();
    expect(solide?.kind, 'le dé de Sauvegarde Solide tient la main').toBe('casseDArme');
    expect(g().pendingDefense, 'H2 n’a pas encore sa fenêtre').toBeNull();
    expect(de('h2').loseNextAction, 'H2 n’a pas tiré').toBeFalsy();
    expect(tirsDe('h2')).toBe(0);
    expect(g().battle!.turn, 'le Round attend la boucle').toBe(-1);
    g().cascadeDieSetForcedRoll(solide!.id, 1);
    g().cascadeNext();
    expect(de('e1').weapons.some((w) => w.uid === 'lame'), 'la Lame Bâclée se brise (1 < Solide)').toBe(false);
    expect(g().pendingDefense?.attackerId, 'la boucle reprend sur H2').toBe('h2');
    expect(tirsDe('h2'), 'H2 tire UNE fois').toBe(1);
    g().defenseRoll();
    g().defenseSetForcedRoll(96); // la défense échoue sans Maladresse
    g().defenseConfirm();
    draineCascade(g, 10, poseSurDeNonTombe(1));
    expect(tirsDe('h2'), 'aucune reprise de plus').toBe(1);
    expect(g().pendingCascade, 'aucune étape orpheline').toBeNull();
    expect(g().pendingDefense, 'aucune défense orpheline').toBeNull();
    expect(g().battle!.order[g().battle!.turn], 'le Round s’ouvre').toBe('h1');
  });
});

/** #1765 — le tir d'interruption de l'IA sur un porteur de sauvegarde (LDB 85 l.98) sans siège passe par le
 *  chemin INSTANTANÉ (`runPreemptShots` → `applyAttackResult`) : le retour suspendu arrête la boucle, le
 *  tireur suivant ne tire qu'au dé, une fois. */
describe('#1765 — Tir rapide instantané : la sauvegarde de la cible suspend la boucle, qui reprend au dé, une fois', () => {
  beforeEach(() => { vi.useFakeTimers(); seedBattleRng(5); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('E1 touche H1 (Protection, sans siège) : E2 attend le dé de sauvegarde, puis tire UNE fois', () => {
    finDeRound();
    for (const id of ['h1', 'h2']) {
      de(id).aiControlled = true;
      de(id).traits = [{ id: 'protection', value: 10 }];
    }
    g().battleEndTurn();
    g().confirmRoundStart();
    expect(g().pendingDefense, 'aucune fenêtre de défense : le tir est instantané').toBeNull();
    expect(tirsDe('e1'), 'E1 a tiré').toBe(1);
    const sauvegarde = etape();
    expect(sauvegarde?.kind, 'la sauvegarde de H1 tient la main').toBe('sauvegarde');
    expect(sauvegarde?.de, 'une étape à dé').toBeTruthy();
    expect(tirsDe('e2'), 'E2 n’a pas tiré').toBe(0);
    expect(de('e2').loseNextAction, 'E2 n’a rien payé').toBeFalsy();
    expect(g().battle!.turn, 'le Round attend la boucle').toBe(-1);
    g().cascadeNext();
    expect(tirsDe('e2'), 'la boucle reprend : E2 tire UNE fois').toBe(1);
    expect(g().pendingCascade, 'aucune étape orpheline').toBeNull();
    expect(g().battle!.order[g().battle!.turn], 'le Round s’ouvre').toBe('h1');
  });
});
