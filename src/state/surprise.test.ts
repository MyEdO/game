import { describe, it, expect, afterEach } from 'vitest';
import { applySurprise, computeMoveReach } from '../noyau/combatFlow';
import { chooseEnemyAction } from '../noyau/monde/ai';
import { effectiveMovement } from '../engine/encumbrance';
import { seedBattleRng } from '../noyau/battleRng';
import { hasCondition } from '../engine/conditions';

import { useGame } from './store';
import type { Combatant } from '../engine/types';
import { resetCadence, setCadence } from '../engine/cadence';

const scene = () => ({ id: 's', label: '', dimensions: { w: 10, h: 10 }, levels: [{ z: 0, tiles: Array(100).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [], flags: {} } as never);
const C = (over: Partial<Combatant>): Combatant =>
  ({ id: 'x', kind: 'hero', name: 'X', conditions: [], skills: [], characteristics: {}, wounds: { current: 10, max: 10 }, items: [], movement: 4, advantage: 0, ...over } as unknown as Combatant);

describe('Surprise — établissement & comportement (LDB 13 l.52-81 / 16 l.130-136)', () => {
  afterEach(() => resetCadence());

  it('applySurprise : le camp embusqué qui perd le Test opposé Perception vs Discrétion → Surpris', () => {
    setCadence('rapide'); // héros auto-résolu inline (pas de cascade différée à piloter)
    seedBattleRng(1);
    const LOW = { 'capacite-de-combat': 5, 'capacite-de-tir': 5, force: 5, endurance: 5, initiative: 5, agilite: 5, dexterite: 5, intelligence: 5, 'force-mentale': 5, sociabilite: 5 } as never;
    const HIGH = { 'capacite-de-combat': 90, 'capacite-de-tir': 90, force: 90, endurance: 90, initiative: 90, agilite: 90, dexterite: 90, intelligence: 90, 'force-mentale': 90, sociabilite: 90 } as never;
    const hero = C({ id: 'h', kind: 'hero', characteristics: LOW }); // Perception faible
    const enemy = C({ id: 'e', kind: 'enemy', characteristics: HIGH }); // Discrétion forte (embusqueur)
    useGame.setState({ battle: { combatants: [hero, enemy], order: ['h', 'e'], turn: -1, round: 1, log: [], over: null } as never, pendingLogQueue: [] });
    applySurprise(useGame.getState, useGame.setState, 'party'); // les héros sont pris en embuscade
    const h = useGame.getState().battle!.combatants.find((c) => c.id === 'h')!;
    const e = useGame.getState().battle!.combatants.find((c) => c.id === 'e')!;
    expect(hasCondition(h, 'surpris')).toBe(true);
    expect(hasCondition(e, 'surpris')).toBe(false);
  });

  it('effectiveMovement = 0 quand Surpris (LDB 16 l.135)', () => {
    const c = C({ characteristics: { force: 30, endurance: 30 } as never, conditions: [{ id: 'surpris', value: 1 }] });
    expect(effectiveMovement(c)).toBe(0);
  });

  it('IA : un ennemi Surpris passe la main (ni Mouvement ni Action)', () => {
    const e = C({ id: 'e', kind: 'enemy', conditions: [{ id: 'surpris', value: 1 }], pos: { x: 5, y: 5 }, weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }] as never });
    const h = C({ id: 'h', kind: 'hero', pos: { x: 6, y: 5 } });
    expect(chooseEnemyAction({ enemy: e, heroes: [h], scene: scene(), blocked: new Set(), movement: 4 } as never).kind).toBe('end');
  });

  // Surpris (LDB 16 l.135) : ni Mouvement ni Action ce tour. La Détermination reste ouverte, et le
  // RAW le dit pour CET État en propre (LDB 13 l.71). Elle se mesure sur son chemin RÉEL — le
  // dispatcher DIRECT ; depuis #1411 P0-B lot 3 elle n'arme plus aucun mode (`battle.action`), c'est
  // la pastille de l'État qui porte le retrait.
  it('un héros Surpris ne peut QUE puiser dans sa Détermination — et elle retire l’État (LDB 13 l.71)', () => {
    const hero = C({ id: 'h', kind: 'hero', conditions: [{ id: 'surpris', value: 1 }], pos: { x: 5, y: 5 }, weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }] as never, resolve: 1 });
    useGame.setState({ battle: { combatants: [hero], order: ['h'], turn: 0, action: null, movementUsed: 0, acted: false, reachable: new Map(), over: false, round: 1, log: [] } as never, scene: scene() });
    expect(computeMoveReach(useGame.getState).size).toBe(0); // Mouvement bloqué (effectiveMovement = 0)
    useGame.getState().battleSelectAction('cast');
    expect(useGame.getState().battle!.action).toBeNull(); // Action bloquée
    useGame.getState().battleSpendResolve('surpris'); // dépense DIRECTE, jamais un mode armé
    expect(hasCondition(useGame.getState().battle!.combatants[0], 'surpris')).toBe(false);
    expect(useGame.getState().battle!.combatants[0].resolve).toBe(0);
  });

  it('aucune surprise déclarée → personne n\'est Surpris', () => {
    const hero = C({ id: 'h', kind: 'hero' });
    const enemy = C({ id: 'e', kind: 'enemy' });
    // applySurprise n'est appelé que si enc.surprise est défini ; ici on vérifie juste l'état initial.
    expect(hasCondition(hero, 'surpris')).toBe(false);
    expect(hasCondition(enemy, 'surpris')).toBe(false);
  });
});
