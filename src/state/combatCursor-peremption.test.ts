/**
 * PÉREMPTION du curseur de combat (`curseurPerime`, #2817 D4) : le curseur appartient à la fenêtre de
 * geste ouverte, et l'abonnement unique du store le remet à `null` quand elle se ferme — fin de combat,
 * tour achevé, Tir rapide déclenché, visée Tir rapide qui bascule ; il survit tant que le même combattant
 * garde la main. Chaque cas passe par le flux que le
 * jeu appelle ; le curseur se pose par ses actions (`moveCursor`, `snapCursorToTarget`).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame, type BattleState } from './store';
import { finishCombatEnd } from './combatFlow';
import { createHero } from '../engine/character';
import { emptyScene } from '../noyau/monde/scene';
import { seedBattleRng } from '../noyau/battleRng';
import { makePregens } from '../data/pregens';
import { spawnEnemy } from './spawn';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon } from '../engine/types';

const get = () => useGame.getState();
const rangedOf = (c: Combatant): Weapon => c.weapons.find((w) => w.type === 'ranged')!;

/** Duel sur scène vide : le héros H joue au tour `turn` de l'ordre [H, E]. */
function duel(turn: 0 | 1) {
  const H = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 3 });
  H.pos = { x: 0, y: 0 };
  const E: Combatant = JSON.parse(JSON.stringify(H));
  E.id = 'enemy-0';
  E.label = 'Gobelin';
  E.kind = 'enemy';
  E.pos = { x: 2, y: 0 };
  const battle: BattleState = {
    combatants: [H, E], order: [E.id, H.id], turn, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  };
  useGame.setState({ party: [H], mode: 'battle', battle, scene: emptyScene(8, 8), combatCursor: null, preemptAiming: null, pendingRoundStart: null, pendingAttack: null });
  return { H, E };
}

/** Pause de début du Round 2, H tireur Tir rapide armé d'un arc chargé, E à portée. */
function pauseTirRapide() {
  const { H, E } = duel(1);
  H.talents = [{ talentId: 'tir-rapide', times: 1 }];
  H.weapons = [{ label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 30, qualities: [] }] as never;
  rangedOf(H).loaded = true;
  get().battleEndTurn();
  expect(get().pendingRoundStart, 'témoin : la pause de Round est ouverte').not.toBeNull();
  seedBattleRng(1);
  get().armPreempt(H.id);
  get().snapCursorToTarget(1);
  expect(get().combatCursor?.snappedId, 'témoin : le curseur vise la cible du tireur').toBe(E.id);
  return { H, E };
}

beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); useGame.setState({ battle: null, combatCursor: null, preemptAiming: null, pendingRoundStart: null, pendingAttack: null }); });

describe('curseurPerime — le curseur suit la fenêtre de geste', () => {
  it('fin de combat : la victoire périme le curseur', () => {
    duel(1);
    get().moveCursor('right');
    expect(get().combatCursor, 'témoin : le curseur est posé').not.toBeNull();
    finishCombatEnd(get, useGame.setState);
    expect(get().battle!.over).toBe('victory');
    expect(get().combatCursor).toBeNull();
  });

  it('tour achevé : la fin de tour périme le curseur', () => {
    duel(1);
    get().moveCursor('right');
    expect(get().combatCursor, 'témoin : le curseur est posé').not.toBeNull();
    get().battleEndTurn();
    expect(get().combatCursor).toBeNull();
  });

  it('tour achevé dans le Round : la main qui passe périme le curseur', () => {
    const { H, E } = duel(0);
    useGame.setState({ battle: { ...get().battle!, order: [H.id, E.id] } });
    get().moveCursor('right');
    expect(get().combatCursor, 'témoin : le curseur est posé').not.toBeNull();
    get().battleEndTurn();
    expect(get().battle!.round, 'témoin : le Round ne change pas').toBe(1);
    expect(get().battle!.turn, 'témoin : la main passe au suivant').toBe(1);
    expect(get().combatCursor).toBeNull();
  });

  it('enfourcher une monture Nerveux qui précède le cavalier décale le tour, pas la main : le curseur survit', () => {
    const hero = makePregens()[0];
    hero.pos = { x: 5, y: 5 };
    const horse = spawnEnemy({ ref: 'cheval' }, 'horse', { x: 6, y: 5 });
    horse.traits = [{ id: 'nerveux' }, { id: 'taille', arg: 'Grande' }] as never;
    horse.size = 'grande';
    horse.mountable = true;
    horse.kind = 'hero';
    const other = spawnEnemy({ ref: 'brigand' }, 'other', { x: 1, y: 1 });
    const battle: BattleState = {
      combatants: [hero, horse, other], order: ['other', 'horse', hero.id], baseOrder: ['other', 'horse', hero.id],
      turn: 2, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    useGame.setState({ party: [hero], mode: 'battle', battle, scene: testScene(), combatCursor: null, preemptAiming: null });
    get().moveCursor('right');
    const pose = get().combatCursor;
    expect(pose, 'témoin : le curseur est posé').not.toBeNull();
    get().battleMount();
    const b = get().battle!;
    expect(hero.mountId, 'témoin : le héros est monté').toBe('horse');
    expect(b.turn, 'témoin : l’index du tour s’est décalé').not.toBe(2);
    expect(b.order[b.turn], 'témoin : le même héros garde la main').toBe(hero.id);
    expect(get().combatCursor).toBe(pose);
  });

  it('Tir rapide déclenché : le clic qui tire périme le curseur', () => {
    const { H, E } = pauseTirRapide();
    get().battleClickEntity(E.id, { confirm: true });
    expect(get().pendingAttack?.attackerId, 'témoin : la modale de tir s’est ouverte').toBe(H.id);
    expect(get().combatCursor).toBeNull();
  });

  it('visée Tir rapide désarmée : le changement de `preemptAiming` périme le curseur', () => {
    const { H } = pauseTirRapide();
    get().armPreempt(H.id);
    expect(get().preemptAiming, 'témoin : la bascule a désarmé la visée').toBeNull();
    expect(get().combatCursor).toBeNull();
  });

  it('une écriture sans rapport avec la fenêtre ne périme pas le curseur', () => {
    duel(1);
    get().moveCursor('right');
    const pose = get().combatCursor;
    expect(pose, 'témoin : le curseur est posé').not.toBeNull();
    get().battleArmIntent('course');
    useGame.setState({ battle: { ...get().battle!, movementUsed: 1 } });
    expect(get().combatCursor).toBe(pose);
  });
});
