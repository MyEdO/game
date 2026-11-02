import { describe, it, expect, beforeEach } from 'vitest';
import { runCombatHooks, type CombatHookCtx } from '../combatHooks';
import { setRule, resetRule } from '../../engine/policy';
import { seedBattleRng } from '../battleRng';
import { hasCondition, COND, pendingPlusExtensions } from '../../engine/conditions';
import type { ActiveEffect, Combatant } from '../../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../../engine/combattantDeTest.testkit';

const CHARS = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 1, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

const combatant = (over: Partial<Combatant>): Combatant =>
  (blessuresSurLeProfil({
    id: 'x', name: 'X', kind: 'enemy',
    skills: [], talents: [], conditions: [], activeEffects: [], liveTraits: [],
    wounds: blessuresDeBase(10), advantage: 0,
    ...over,
    characteristics: { ...CHARS, ...over.characteristics }, // profil complet : le retrait d'un effet (`removeActiveEffects`) réconcilie les Blessures
  })) as unknown as Combatant;

const ctx = (combatants: Combatant[]): CombatHookCtx => {
  // runCombatHooks('onRoundEnd') exécute TOUTE la séquence : `get` doit renvoyer un état valide
  // (broken-recovery/fireTriggers lisent get().battle/scene). Combattants nus → les autres hooks no-op
  // sans tirer le RNG (pas de condition/Brisé/zone) → se-fatiguer obtient bien le 1ᵉʳ tirage seedé.
  const battle = { combatants, zones: [], round: 1 } as never;
  const net = { mode: 'local', mySeat: 0 }; // `humanControlled` (se-fatiguer) lit `pilotedByHuman` (mode local → contrôlé)
  return { get: (() => ({ battle, scene: undefined, net })) as never, set: (() => {}) as never, battle, sink: () => {} };
};

describe('roundHooks — se-fatiguer (combat-se-fatiguer, LDB 16 l.97)', () => {
  beforeEach(() => resetRule('combat-se-fatiguer'));

  it('règle OFF (défaut) : aucun effet, le compteur ne bouge pas', () => {
    const c = combatant({ effortRounds: 5 });
    runCombatHooks('onRoundEnd', ctx([c]));
    expect(c.effortRounds).toBe(5);
    expect(hasCondition(c, COND.extenue)).toBe(false);
  });

  it('sous le seuil (Bonus d’Endurance Rounds) : accumule sans Test ni État', () => {
    setRule('combat-se-fatiguer', true);
    const c = combatant({ characteristics: { endurance: 35 } as never, effortRounds: 0 }); // BE=3 → seuil 3
    runCombatHooks('onRoundEnd', ctx([c]));
    expect(c.effortRounds).toBe(1);
    expect(hasCondition(c, COND.extenue)).toBe(false);
  });

  it('au seuil, Test de Résistance raté → État Exténué, compteur remis à zéro', () => {
    setRule('combat-se-fatiguer', true);
    seedBattleRng(4); // 1ᵉʳ d100 = 93 → Test de Résistance raté (cible ≈ Endurance basse)
    const c = combatant({ effortRounds: 0 }); // E=1 → seuil 1
    runCombatHooks('onRoundEnd', ctx([c]));
    expect(hasCondition(c, COND.extenue)).toBe(true);
    expect(c.effortRounds).toBe(0);
  });

  it('au seuil, Test de Résistance réussi (DR obtenu) → délai repoussé de DR Rounds, pas 1+DR (LDB 16 l.97)', () => {
    setRule('combat-se-fatiguer', true);
    seedBattleRng(9); // 1ᵉʳ d100 = 20 → cible 40 (E) : réussite, DR = 2
    const c = combatant({ characteristics: { endurance: 40 } as never, effortRounds: 3 }); // BE=4 → seuil 4 (atteint après incrément)
    runCombatHooks('onRoundEnd', ctx([c]));
    expect(hasCondition(c, COND.extenue)).toBe(false);
    expect(c.effortRounds).toBe(2); // 4 (seuil atteint) − DR(2) — PAS 4 − (1+2) = 1
  });
});

describe('roundHooks — Durée « + » PNJ (LDB 47 l.311, #543) : arbitrage — l’IA prolonge SYSTÉMATIQUEMENT, résolu INLINE', () => {
  const plusEffect = (): ActiveEffect => ({ label: 'Arme aethyrique', bonus: 0, duration: { scale: 'rounds', left: 1 }, sourceSpellId: 'arme-aethyrique' });

  it('Test de Force Mentale réussi (FM haute) → +1 Round, aucune offre laissée en attente', () => {
    seedBattleRng(5); // graine donnant un jet bas
    const c = combatant({ activeEffects: [plusEffect()], characteristics: { endurance: 1, 'force-mentale': 95 } as never });
    runCombatHooks('onRoundEnd', ctx([c]));
    expect(pendingPlusExtensions(c)).toHaveLength(0); // résolu, plus d'offre en attente
    expect(c.activeEffects).toHaveLength(1);
    expect(c.activeEffects![0].duration).toEqual({ scale: 'rounds', left: 1 });
  });

  it('Test de Force Mentale raté (FM basse) → expiration NORMALE (retrait effectif)', () => {
    seedBattleRng(1); // graine donnant un jet élevé
    const c = combatant({ activeEffects: [plusEffect()], characteristics: { endurance: 1, 'force-mentale': 5 } as never });
    runCombatHooks('onRoundEnd', ctx([c]));
    expect(c.activeEffects ?? []).toHaveLength(0);
  });
});
