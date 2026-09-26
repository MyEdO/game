import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { chooseEnemyAction, EnemyTurnInput } from './ai';
import { emptyScene } from './scene';
import { useGame } from './store';
import { runEnemyAI, aiTurnLog, clearAiTurnLog } from './combatFlow';
import { spawnEnemy } from './spawn';
import { pregen, PREGEN } from '../data/pregens';
import { areGrappling } from '../engine/grapple';
import { stacks } from '../engine/conditions';
import { seedBattleRng } from './battleRng';
import type { Combatant, Weapon } from '../engine/types';

// IA — versant Empoignade (LDB 14 l.161) : « Si vous commencez votre tour Empoigné, vous pouvez BRISER
// l'Empoignade si vous disposez d'un Avantage SUPÉRIEUR ; autrement, vous devez effectuer un Test opposé de
// Force pour votre Action. » L'Empoigné est donc VERROUILLÉ sur la lutte (ni tir/cast/mêlée normale) — la
// décision est PURE ; le résolveur impur (`runEnemyAI`) exécute « break » (re-décision) ou le Test opposé.

const MELEE: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
const BOW: Weapon = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 7 }, range: 30, qualities: [] };

function mk(id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, opts: Partial<Combatant> = {}): Combatant {
  return {
    id, label: id, kind, pos,
    wounds: { current: 10, max: 10 }, weapons: [MELEE], characteristics: {} as never,
    advantage: 0, conditions: [], armour: {} as never, skills: [], talents: [], movement: 4,
    ...opts,
  } as Combatant;
}
const scene = emptyScene(12, 12);
function input(enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput {
  return { enemy, heroes, scene, blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)), movement: enemy.movement, spells: [], ...extra };
}

/** Empoigné = `grapplingWith` + État *Empêtré* (les DEUX posés ensemble par `GRAPPLE.init`, LDB 14 l.159). */
function grappled(e: Combatant, hId: string): void {
  e.grapplingWith = [hId];
  e.conditions = [{ id: 'empetre', value: 1, sourceId: hId }];
}

describe('IA — Empoignade : agir quand on est Empoigné (LDB 14 l.161)', () => {
  it('Empoigné → Action « grapple » (Test opposé de Force), JAMAIS « recover empetre »', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }); grappled(e, 'h');
    const h = mk('h', 'hero', { x: 5, y: 6 }, { advantage: 0 }); // adjacent → mêlée possible, mais la lutte préempte
    const a = chooseEnemyAction(input(e, [h], { movement: 0 }));
    expect(a).toEqual({ kind: 'grapple', targetId: 'h', resolution: 'test' });
  });

  it('mêleeur avec Avantage SUPÉRIEUR → reste en lutte (resolution:test) : il GAGNE à rester Empoigné', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { advantage: 3 }); grappled(e, 'h');
    const h = mk('h', 'hero', { x: 5, y: 6 }, { advantage: 0 });
    const a = chooseEnemyAction(input(e, [h], { movement: 0 }));
    expect(a).toEqual({ kind: 'grapple', targetId: 'h', resolution: 'test' });
  });

  it('tireur avec Avantage SUPÉRIEUR → BRISE pour regagner sa distance (resolution:break)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { advantage: 3, weapons: [BOW] }); grappled(e, 'h');
    const h = mk('h', 'hero', { x: 5, y: 6 }, { advantage: 0 });
    const a = chooseEnemyAction(input(e, [h], { movement: 0 }));
    expect(a).toEqual({ kind: 'grapple', targetId: 'h', resolution: 'break' });
  });

  it('tireur SANS Avantage supérieur (égalité) → ne PEUT pas briser → Test opposé (resolution:test)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { advantage: 1, weapons: [BOW] }); grappled(e, 'h');
    const h = mk('h', 'hero', { x: 5, y: 6 }, { advantage: 1 }); // égalité : pas STRICTEMENT supérieur
    const a = chooseEnemyAction(input(e, [h], { movement: 0 }));
    expect(a).toEqual({ kind: 'grapple', targetId: 'h', resolution: 'test' });
  });

  it('Empêtré SANS lien d’Empoignade (filet/sort) → recover empetre : la garde ne capture QUE `grapplingWith`', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { conditions: [{ id: 'empetre', value: 1, sourceId: 'h' }] }); // pas de grapplingWith
    const h = mk('h', 'hero', { x: 9, y: 9 });
    const a = chooseEnemyAction(input(e, [h], { movement: 0 }));
    expect(a).toEqual({ kind: 'recover', state: 'empetre' });
  });
});

const arenaScene = () =>
  ({ id: 's', label: '', dimensions: { w: 12, h: 12 }, layers: [{ z: 0, tiles: Array(144).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [], flags: {} } as never);

describe('IA Empoignade — dispatch (runEnemyAI) : l’Empoigné LUTTE, le tireur supérieur BRISE puis agit', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); clearAiTurnLog(); useGame.setState({ battle: null, party: [] }); seedBattleRng(1); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  /** Arène à 2 combattants adjacents (e Engagé/Empoigné avec h), tour sur `e`. */
  function arena(): { e: Combatant; h: Combatant } {
    const e = spawnEnemy({ ref: 'brigand' }, 'e', { x: 5, y: 5 });
    e.kind = 'enemy'; e.movement = 4; e.engagedWith = ['h'];
    e.grapplingWith = ['h'];
    e.conditions = [{ id: 'empetre', value: 1, sourceId: 'h' }];
    const h = pregen(PREGEN.sorcier);
    h.id = 'h'; h.pos = { x: 6, y: 5 }; h.engagedWith = ['e']; h.advantage = 0;
    h.grapplingWith = ['e']; h.wounds = { ...h.wounds, max: 30, current: 30 };
    const battle = {
      combatants: [e, h], order: ['e', 'h'], baseOrder: ['e', 'h'], turn: 0, round: 1,
      action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as never;
    useGame.setState({ battle, scene: arenaScene(), party: [], partyPos: { x: 0, y: 0 } });
    return { e, h };
  }

  it('mêleeur Empoigné (Avantage non supérieur) → Action « grapple » dispatchée (PAS recover), Action consommée', () => {
    const { e } = arena();
    e.advantage = 0; // pas d'Avantage supérieur → Test opposé de Force
    runEnemyAI(useGame.getState, useGame.setState, e.id);
    const log = aiTurnLog();
    const last = log[log.length - 1];
    expect(last?.action.startsWith('grapple')).toBe(true); // a LUTTÉ (pas « recover empetre »)
    expect(useGame.getState().battle!.acted).toBe(true); // le Test opposé EST l'Action (l.161)
  });

  it('tireur Empoigné + Avantage SUPÉRIEUR → BRISE : `grapplingWith` purgé + Empêtré retiré, puis VRAIE action', () => {
    const bow: Weapon = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 7 }, range: 30, qualities: [] };
    const { e } = arena();
    e.weapons = [bow]; e.advantage = 3; // tireur, Avantage strictement supérieur (h = 0)
    runEnemyAI(useGame.getState, useGame.setState, e.id);
    const after = useGame.getState().battle!.combatants.find((c) => c.id === 'e')!;
    const h = useGame.getState().battle!.combatants.find((c) => c.id === 'h')!;
    expect(areGrappling(after, h)).toBe(false); // Brisé : lien dénoué DES DEUX côtés (synchrone)
    expect(stacks(after, 'empetre')).toBe(0);   // Empêtré lié retiré (gratuit, par le Mouvement)
    const log = aiTurnLog();
    expect(log[log.length - 1]?.action.startsWith('grapple')).toBe(false); // a re-décidé une vraie action le MÊME tour
  });
});
