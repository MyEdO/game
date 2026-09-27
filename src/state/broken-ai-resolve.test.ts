import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { chooseEnemyAction } from './ai';
import { runEnemyAI, aiTurnLog, clearAiTurnLog } from './combatFlow';
import { spawnEnemy } from './spawn';
import { pregen, PREGEN } from '../data/pregens';
import { stacks } from '../engine/conditions';
import { seedBattleRng } from './battleRng';
import type { Combatant } from '../engine/types';

/**
 * Lot 1 — IA : un acteur VERROUILLÉ (`restrictsAction`, ex. Brisé) dépense PROACTIVEMENT sa Détermination
 * pour se RESSAISIR (retirer l'État, LDB 17 l.57-61) au lieu de fuir/subir tout le combat. GÉNÉRIQUE et
 * data-driven (aucun nom d'État en dur) : la décision PURE vit dans `chooseEnemyAction` (`spendResource`),
 * l'exécution dans `runEnemyAI` (dépense via l'action store `spendResolveCondition`, puis vraie action).
 */
const scene = () =>
  ({ id: 's', label: '', dimensions: { w: 12, h: 12 }, layers: [{ z: 0, tiles: Array(144).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [], flags: {} } as never);

const sword = [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }];

const CHARS = { 'capacite-de-combat': 35, 'capacite-de-tir': 35, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
/** Ennemi minimal pour la DÉCISION pure : pos + arme de mêlée + caracs + États/Détermination paramétrés.
 *  (Les caracs servent au cœur de scoring atteint quand l'ennemi n'est PAS verrouillé — `pickDoctrine`.) */
function foe(over: Partial<Combatant>): Combatant {
  return { id: 'e', kind: 'enemy', name: 'E', pos: { x: 5, y: 5 }, weapons: sword, characteristics: CHARS, skills: [], conditions: [], wounds: { current: 10, max: 10 }, advantage: 0, traits: [], size: 'moyenne', engagedWith: [], psychState: [], ...over } as unknown as Combatant;
}
const hero = (x: number, y: number): Combatant => ({ id: 'h', kind: 'hero', name: 'H', pos: { x, y }, wounds: { current: 10, max: 10 }, conditions: [], characteristics: CHARS, traits: [], size: 'moyenne', advantage: 0, weapons: [], armour: {} } as unknown as Combatant);
const decide = (enemy: Combatant, heroes: Combatant[]) =>
  chooseEnemyAction({ enemy, heroes, scene: scene(), blocked: new Set<string>(), movement: 4 } as never);

describe('IA Brisé — dépense PROACTIVE de Détermination (LDB 17 l.57-61), data-driven', () => {
  it('Engagé + Détermination suffisante → se RESSAISIT (spendResource resolve→removeCondition brise)', () => {
    const enemy = foe({ conditions: [{ id: 'brise', value: 1 }], resolve: 1, engagedWith: ['h'] });
    const action = decide(enemy, [hero(6, 5)]); // héros adjacent
    expect(action).toEqual({ kind: 'spendResource', resource: 'resolve', via: 'removeCondition', id: 'brise' });
    expect(enemy.resolve).toBe(1); // décision PURE : ne dépense rien (l'exécution est dans le store)
  });

  it('anti-gaspi : Détermination INSUFFISANTE pour nettoyer entièrement → PAS de dépense', () => {
    const enemy = foe({ conditions: [{ id: 'brise', value: 2 }], resolve: 1 }); // non Engagé, héros loin
    const action = decide(enemy, [hero(11, 5)]);
    expect(action.kind).not.toBe('spendResource'); // clear partiel inutile → on ne gaspille pas
    expect(action.kind).toBe('move'); // → fuite (Brisé non Engagé)
    expect(enemy.resolve).toBe(1); // pool intact
  });

  it('pool absent (Détermination 0) → comportement inchangé (fuite), aucune dépense', () => {
    const enemy = foe({ conditions: [{ id: 'brise', value: 1 }], resolve: 0 });
    const action = decide(enemy, [hero(11, 5)]);
    expect(action.kind).toBe('move');
  });

  it('non-régression : un ennemi NON verrouillé ne propose JAMAIS spendResource', () => {
    const enemy = foe({ conditions: [], resolve: 2, engagedWith: ['h'] });
    const action = decide(enemy, [hero(6, 5)]);
    expect(action.kind).not.toBe('spendResource');
  });
});

describe('IA Brisé — dispatch : la dépense retire l\'État puis une vraie action suit le MÊME tour', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); clearAiTurnLog(); useGame.setState({ battle: null, party: [] }); seedBattleRng(1); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('ennemi Brisé+Détermination, Engagé → spendResolveCondition retire le Brisé (−1 Détermination), action réelle dispatchée', () => {
    const e = spawnEnemy({ ref: 'brigand' }, 'e', { x: 5, y: 5 });
    e.kind = 'enemy';
    e.conditions = [{ id: 'brise', value: 1 }];
    e.resolve = 1;
    e.engagedWith = ['h'];
    e.movement = 4;
    const h = pregen(PREGEN.sorcier);
    h.id = 'h'; h.pos = { x: 6, y: 5 }; h.wounds = { ...h.wounds, max: 30, current: 30 }; // adjacent → mêlée après déverrouillage
    const battle = {
      combatants: [e, h], order: ['e', 'h'], baseOrder: ['e', 'h'], turn: 0, round: 1,
      action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as never;
    useGame.setState({ battle, scene: scene(), party: [], partyPos: { x: 0, y: 0 } });

    runEnemyAI(useGame.getState, useGame.setState, e.id);

    // La boucle de dépense est SYNCHRONE (avant le télégraphe différé) : le Brisé est retiré, la Détermination consommée.
    const after = useGame.getState().battle!.combatants.find((c) => c.id === 'e')!;
    expect(stacks(after, 'brise')).toBe(0);
    expect(after.resolve).toBe(0);
    // La trace enregistre la VRAIE action choisie après déverrouillage (pas une dépense).
    const log = aiTurnLog();
    const last = log[log.length - 1];
    expect(last?.action.startsWith('spend')).toBe(false);
  });
});
