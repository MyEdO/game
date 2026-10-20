import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../store';
import { runEnemyAI, aiTurnLog, clearAiTurnLog } from '../../noyau/combatFlow';
import { seedBattleRng, battleRng } from '../../noyau/battleRng';
import { resolveRecoverTest } from '../../noyau/combat/recover';
import { makeRNG } from '../../engine/dice';
import { opposedTest, REPLIS_DEUX_CIBLES } from '../../engine/tests';
import { etats } from '../../data';
import { setDataset } from '../../data/overrides';
import type { Combatant, Difficulty } from '../../engine/types';

/**
 * Voie IA du Test de RÉCUPÉRATION opposé (`runEnemyAI`, `case 'recover'`) — `LDB 12 l.160`.
 *
 * « Vous pouvez utiliser votre Action pour retirer l'État *Empêtré* en réussissant un Test opposé
 * **de Force** contre la source de cet empêtrement » (`LDB 16 l.66`).
 *
 * Jumelle de `recover-departage-nue.test` (voie joueur) : la résolution INLINE de l'IA passe les deux
 * valeurs NUES par le canal `bases` d'`opposedTest`, donc AUCUN départage n'y retombe sur les cibles.
 */

const CHARS = (force: number) => ({
  'capacite-de-combat': 40, 'capacite-de-tir': 40, force, endurance: 40, initiative: 30,
  agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30,
});
const MELEE = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };

function combatant(p: Partial<Combatant> & { id: string; force: number }): Combatant {
  return {
    label: p.label ?? p.id, kind: p.kind ?? 'hero',
    characteristics: CHARS(p.force) as never,
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [MELEE], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], traits: [], psychState: [], engagedWith: [], size: 'moyenne',
    fortune: 0, resilience: 0, pos: { x: 1, y: 1 },
    ...p,
  } as unknown as Combatant;
}

const scene = () =>
  ({ id: 's', label: '', dimensions: { w: 12, h: 12 }, layers: [{ z: 0, tiles: Array(144).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [], flags: {} } as never);

/** Entrave = héros Force NUE 50 (1 Exténué → 40 testés) ; Empêtré = ennemi Force NUE 60 (3 Exténué →
 *  30 testés). Les valeurs TESTÉES s'inversent par rapport aux NUES : le départage à DR égal se voit. */
function setBattle(activeId: string) {
  const src = combatant({
    id: 'h', label: 'Héros', force: 50, pos: { x: 9, y: 9 },
    conditions: [{ id: 'extenue', value: 1 }] as never,
  });
  const foe = combatant({
    id: 'e', label: 'Ronce', kind: 'enemy', force: 60, pos: { x: 5, y: 5 }, movement: 0,
    conditions: [{ id: 'empetre', value: 1, sourceId: 'h' }, { id: 'extenue', value: 3 }] as never,
  });
  const order = ['e', 'h'];
  useGame.setState({
    mode: 'battle', scene: scene(), party: [], pendingStateRecovery: null,
    battle: {
      combatants: [foe, src], order, baseOrder: order, turn: order.indexOf(activeId), round: 1,
      action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
      acted: false, log: [], over: null,
    } as never,
  });
  return { foe, src };
}

describe('LDB 12 l.160 — la récupération opposée de l’IA départage sur les nues des DEUX camps', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); clearAiTurnLog(); seedBattleRng(1); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('TÉMOIN : la sonde `REPLIS_DEUX_CIBLES` compte bien un opposé roulé SANS nue', () => {
    const avant = REPLIS_DEUX_CIBLES.count;
    opposedTest(30, 40, makeRNG(1));
    expect(REPLIS_DEUX_CIBLES.count, 'sonde inerte : la preuve ci-dessous ne vaudrait rien').toBe(avant + 1);
  });

  it('la résolution IA lit les DEUX nues, distinctes des valeurs testées', () => {
    const { foe } = setBattle('e');
    const rt = resolveRecoverTest(foe, 'empetre', useGame.getState().battle!)!;
    expect([rt.skillBase, rt.skillValue, rt.opposition?.base, rt.opposition?.value])
      .toEqual([60, 30, 50, 40]);
  });

  it('CONTRAT : le tour IA joue le recover SANS aucun repli deux-cibles', () => {
    setBattle('e');
    const avant = REPLIS_DEUX_CIBLES.count;
    runEnemyAI(useGame.getState, useGame.setState, 'e');
    vi.runAllTimers();
    const log = aiTurnLog();
    expect(log.some((r) => r.id === 'e' && r.action.startsWith('recover')), 'le tour IA n’a pas joué le recover').toBe(true);
    expect(REPLIS_DEUX_CIBLES.count, 'un départage de la voie IA est retombé sur les cibles').toBe(avant);
  });
});

describe('LDB 12 l.166 — la Difficulté de `recover` s’applique à l’ACTEUR SEUL, l’entrave roule Intermédiaire', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); seedBattleRng(3); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  /** Donnée DÉVIANTE forgée : `empetre.recover.difficulty` décalée le temps du cas. */
  function withRecoverDifficulty<T>(difficulty: Difficulty, body: () => T): T {
    const avant = [...etats];
    setDataset('etats', etats.map((e) => (e.id === 'empetre' ? { ...e, recover: { ...e.recover!, difficulty } } : e)));
    try { return body(); } finally { setDataset('etats', avant); }
  }

  it('ASYMÉTRIE MESURÉE (voie joueur) : la cible de l’acteur porte la Difficulté, celle de l’entrave NON', () => {
    const nominal = (() => {
      setBattle('e');
      const foe = useGame.getState().battle!.combatants.find((c) => c.id === 'e')!;
      foe.kind = 'hero'; // acteur PILOTÉ : le flux différé (pending) est celui du joueur
      useGame.getState().battleRecoverState('empetre');
      useGame.getState().recoverRoll();
      return useGame.getState().pendingStateRecovery!;
    })();
    expect([nominal.difficulty, nominal.roll!.target, nominal.opponentRoll!.target]).toEqual(['intermediaire', 30, 40]);

    const devie = withRecoverDifficulty('difficile', () => { // −20 (`DIFFICULTY_MODIFIERS`)
      setBattle('e');
      const foe = useGame.getState().battle!.combatants.find((c) => c.id === 'e')!;
      foe.kind = 'hero';
      useGame.getState().battleRecoverState('empetre');
      useGame.getState().recoverRoll();
      return useGame.getState().pendingStateRecovery!;
    });
    expect(devie.difficulty).toBe('difficile');
    expect(devie.roll!.target, 'l’acteur honore la Difficulté de la donnée').toBe(10);
    expect(devie.opponentRoll!.target, 'l’entrave roule Intermédiaire — INCHANGÉE').toBe(40);
    expect([devie.roll!.base, devie.opponentRoll!.base], 'les deux nues restent posées').toEqual([60, 50]);
  });

  /** Donnée DÉVIANTE forgée : `empetre.recover.opposedDifficulty` posée le temps du cas. */
  function withOpposedDifficulty<T>(difficulty: Difficulty, body: () => T): T {
    const avant = [...etats];
    setDataset('etats', etats.map((e) => (e.id === 'empetre' ? { ...e, recover: { ...e.recover!, opposedDifficulty: difficulty } } : e)));
    try { return body(); } finally { setDataset('etats', avant); }
  }

  it('la Difficulté de l’entrave se lit sur l’État, et les DEUX voies la roulent', () => {
    const rt = withOpposedDifficulty('difficile', () => {
      const { foe } = setBattle('e');
      return resolveRecoverTest(foe, 'empetre', useGame.getState().battle!)!;
    });
    expect([rt.difficulty, rt.opposition?.difficulty]).toEqual(['intermediaire', 'difficile']);

    const joueur = withOpposedDifficulty('difficile', () => {
      setBattle('e');
      useGame.getState().battle!.combatants.find((c) => c.id === 'e')!.kind = 'hero';
      useGame.getState().battleRecoverState('empetre');
      useGame.getState().recoverRoll();
      return useGame.getState().pendingStateRecovery!;
    });
    expect(joueur.opponentRoll!.target, 'voie joueur : entrave 40 + Difficile').toBe(20);

    // Voie IA : sa résolution est instantanée ; un tirage où l'issue BASCULE avec la Difficulté de
    // l'entrave, rejoué par l'IA sous la donnée déviante, ne libère que si l'IA l'a roulée.
    const issue = (seed: number, entrave: Difficulty) => {
      seedBattleRng(seed);
      return opposedTest(30, 40, battleRng(), 'intermediaire', entrave, { attacker: 60, defender: 50 }).attackerWins;
    };
    const seed = Array.from({ length: 200 }, (_, i) => i + 1).find((n) => issue(n, 'difficile') && !issue(n, 'intermediaire'));
    expect(seed, 'aucun tirage ne départage les deux Difficultés').toBeDefined();
    const libre = withOpposedDifficulty('difficile', () => {
      const { foe } = setBattle('e');
      seedBattleRng(seed!);
      runEnemyAI(useGame.getState, useGame.setState, 'e');
      vi.runAllTimers();
      return !foe.conditions.some((c) => c.id === 'empetre');
    });
    expect(libre, 'voie IA : l’entrave a roulé la Difficulté de la donnée').toBe(true);
  });
});
