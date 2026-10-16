import { describe, it, expect } from 'vitest';
import { applyCriticalToTarget } from './combatFlow';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import type { Combatant } from '../engine/types';
import type { AttackResult } from '../engine/combat';

const CRIT: AttackResult = { hit: true, critical: true, attackerRoll: 11, netSL: 1, location: 'corps', advantageTo: 'attacker', defenderDefeated: false, log: '' };

/**
 * RAW-2 — « Je ne faillirai pas ! » (LDB 17 l.68) : « Si vous infligez un Coup Critique, vous pouvez
 * choisir la Localisation atteinte, plutôt que de la laisser au hasard. » Sur un Coup Critique issu d'un
 * succès FORCÉ, la localisation choisie doit court-circuiter le tirage aléatoire (`critLocationRoll`).
 */
const mk = (): Combatant =>
  ({
    id: 'T', name: 'Cible', kind: 'enemy',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], traumas: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
  }) as unknown as Combatant;

describe('applyCriticalToTarget — la Localisation fournie est utilisée verbatim (résolue en amont)', () => {
  it('localisation fournie → le Critique est résolu à cette localisation', () => {
    seedBattleRng(1);
    const log: string[] = [];
    applyCriticalToTarget(mk(), 'tete', 0, log, () => {}, { get: useGame.getState });
    expect(log.some((l) => l.includes('(Tête)'))).toBe(true); // localisation affichée en FR via locationLabel(loc, shape)
  });

  it('un Critique est bien appliqué à la localisation donnée', () => {
    seedBattleRng(1);
    const log: string[] = [];
    applyCriticalToTarget(mk(), 'corps', 0, log, () => {}, { get: useGame.getState });
    expect(log.some((l) => l.includes('Blessure critique'))).toBe(true);
  });
});

describe('applyCriticalToTarget — libellé de localisation adapté à la forme du corps (créatures)', () => {
  it('critique sur quadrupède → localisation « (Membre antérieur droit) », jamais « (Bras droit) » humanoïde', () => {
    seedBattleRng(1);
    const log: string[] = [];
    const t = mk();
    t.bodyShape = 'quadrupede';
    applyCriticalToTarget(t, 'brasD', 0, log, () => {}, { get: useGame.getState }); // localisation fournie pour le déterminisme
    expect(log.some((l) => l.includes('(Membre antérieur droit)'))).toBe(true);
    expect(log.some((l) => l.includes('(Bras droit)'))).toBe(false);
  });
});

describe('attackSetCritLocation — réservé au Coup Critique FORCÉ (RAW-2)', () => {
  it('forced + critical → pose result.critLocation', () => {
    useGame.setState({ pendingAttack: { attackerId: 'a', targetId: 'b', location: null, forced: true, result: CRIT } });
    useGame.getState().attackSetCritLocation('jambeG');
    expect(useGame.getState().pendingAttack!.result!.critLocation).toBe('jambeG');
  });

  it('non forcé (Coup Critique « ordinaire ») → ignoré (localisation au hasard, RAW)', () => {
    useGame.setState({ pendingAttack: { attackerId: 'a', targetId: 'b', location: null, result: CRIT } });
    useGame.getState().attackSetCritLocation('jambeG');
    expect(useGame.getState().pendingAttack!.result!.critLocation).toBeUndefined();
  });
});
