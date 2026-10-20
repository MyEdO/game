import { describe, it, expect } from 'vitest';
import type { Combatant } from '../engine/types';
import { evalCondition, spellFlowFor } from '../engine/flowCore';
import type { ConditionCtx } from '../engine/flowCore';
import { chaosDomainOf } from '../engine/combatFeatures/dispatch';
import { runPureFlowLines } from '../noyau/combat/flowEval';
import { buildActorView } from '../engine/actorView';
import { findSpellById } from '../data';
import { deFixe } from '../engine/dice.testkit';

/**
 * Dé-stub d'« Allure démoniaque » (EDOC 13 l.270-280) : le Flow du sort sélectionne la colonne du Tableau
 * des aspects démoniaques (l.234-247) selon le Domaine du Chaos du lanceur (Condition `casterChaosDomain`),
 * tire sur la table `tables.json` (op `rollTable` `tableId`), octroie le Trait à la durée du Sort, et une
 * rangée « Mutation » attache une mutation PERMANENTE. RNG figé, sans store.
 */
const caster = (spec?: string): Combatant =>
  ({
    id: 'w', name: 'W', kind: 'hero', species: 'humains-reiklander',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 35 },
    wounds: { current: 15, max: 15 }, advantage: 0, conditions: [], skills: [], traits: [],
    talents: spec ? [{ talentId: 'magie-du-chaos', spec, times: 1 }] : [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  } as unknown as Combatant);

const fixed = deFixe;
const spellFlow = () => spellFlowFor(findSpellById('allure-demoniaque')!.effects, 'target');

describe('chaosDomainOf — Domaine du Chaos du lanceur (spec du Talent Magie du Chaos)', () => {
  it('retourne la spec du Talent castingKind:chaos', () => {
    expect(chaosDomainOf(caster('nurgle'))).toBe('nurgle');
    expect(chaosDomainOf(caster('tzeentch'))).toBe('tzeentch');
  });
  it('non porteur du Talent → undefined', () => {
    expect(chaosDomainOf(caster())).toBeUndefined();
  });
});

describe('Condition casterChaosDomain — 4 branches', () => {
  const ctxFor = (spec?: string): ConditionCtx => ({ flags: {}, gameTime: 0, caster: buildActorView(caster(spec)) });
  it('vraie SEULEMENT pour le Domaine du lanceur', () => {
    for (const dom of ['nurgle', 'slaanesh', 'tzeentch', 'indivisible'] as const) {
      const ctx = ctxFor(dom === 'indivisible' ? undefined : dom); // 'indivisible' n'est pas un dieu de données
      for (const probe of ['nurgle', 'slaanesh', 'tzeentch', 'indivisible']) {
        const expected = dom !== 'indivisible' && probe === dom;
        expect(evalCondition({ kind: 'casterChaosDomain', is: probe }, ctx)).toBe(expected);
      }
    }
  });
  it('lanceur sans Domaine → toutes les branches fausses', () => {
    const ctx = ctxFor();
    for (const probe of ['nurgle', 'slaanesh', 'tzeentch', 'indivisible'])
      expect(evalCondition({ kind: 'casterChaosDomain', is: probe }, ctx)).toBe(false);
  });
});

describe('Allure démoniaque — Flow end-to-end (RNG figé)', () => {
  it('durée = (Bonus de Sociabilité) Rounds + (donnée du sort, marqueur « + » LDB 47 l.311/#543)', () => {
    expect(findSpellById('allure-demoniaque')!.duration).toEqual({ kind: 'rounds', value: { bonusOf: 'sociabilite' }, plus: true });
  });

  it('Nurgle : sélectionne la colonne Nurgle, octroie le Trait AVEC Indice pour la durée du Sort', () => {
    const c = caster('nurgle');
    runPureFlowLines(c, c, spellFlow(), { rng: fixed(3), caster: c, defaultDurationRounds: 3, label: 'Allure démoniaque' });
    const eff = (c.activeEffects ?? []).filter((e) => e.grantedTrait);
    expect(eff).toHaveLength(1); // die=3 → Nurgle 3 = Démoniaque (7)
    expect(eff[0].grantedTrait!.id).toBe('demoniaque');
    expect(eff[0].grantedTrait!.value).toBe(7);
    expect(eff[0].duration).toEqual({ scale: 'rounds', left: 3 });
  });

  it('Tzeentch : colonne différente (die=1 → Souffle +9 (Feu))', () => {
    const c = caster('tzeentch');
    runPureFlowLines(c, c, spellFlow(), { rng: fixed(1), caster: c, defaultDurationRounds: 3, label: 'Allure démoniaque' });
    const eff = (c.activeEffects ?? []).filter((e) => e.grantedTrait);
    expect(eff[0].grantedTrait!.id).toBe('souffle');
    expect(eff[0].grantedTrait!.value).toBe(9);
    expect(eff[0].grantedTrait!.arg).toBe('Feu');
  });

  it('cast MINIMAL (0 pas alloué à la Durée) → 1 seul jet sur le Tableau, MÊME à SL positif (EDOC 13 l.270-276)', () => {
    // Un DR ≠ NI positif (ici SL=4) ne suffit PAS à multiplier les jets : le RAW couple « refaire un
    // jet » au pas de Surincantation ALLOUÉ à la Durée (choix du joueur), jamais au DR brut du Test.
    const c = caster('nurgle');
    runPureFlowLines(c, c, spellFlow(), { rng: fixed(3), caster: c, sl: 4, defaultDurationRounds: 3, label: 'Allure démoniaque' });
    expect((c.activeEffects ?? []).filter((e) => e.grantedTrait)).toHaveLength(1);
  });

  it('2 pas alloués à la Durée → 1+2 jets sur le Tableau ET durée prolongée, « à la fois » (EDOC 13 l.276)', () => {
    const c = caster('nurgle');
    // `defaultDurationRounds` porte ici la durée DÉJÀ prolongée par l'allocation (calculée par `overcastDurationParts`
    // côté `applyCast`, hors périmètre de ce Flow pur) — seule la multiplicité des jets est sous test.
    runPureFlowLines(c, c, spellFlow(), { rng: fixed(3), caster: c, overcastDurationSteps: 2, defaultDurationRounds: 9, label: 'Allure démoniaque' });
    const eff = (c.activeEffects ?? []).filter((e) => e.grantedTrait);
    expect(eff).toHaveLength(3); // 1 + 2 pas
    expect(eff.every((e) => e.duration)).toBe(true);
    expect(eff[0].duration).toEqual({ scale: 'rounds', left: 9 }); // durée prolongée du MÊME pas
  });

  it('rangée Mutation (Nurgle 8) → mutation attachée POUR LA DURÉE DU SORT (EDOC 13 l.276-277)', () => {
    const c = caster('nurgle');
    runPureFlowLines(c, c, spellFlow(), { rng: fixed(8), caster: c, defaultDurationRounds: 3, label: 'Allure démoniaque' });
    expect((c.mutations ?? []).length).toBe(1); // die=8 → Nurgle 8 = Mutation → rollMutation edoc-phys-nurgle
    const eff = (c.activeEffects ?? []).filter((e) => e.grantedMutation);
    expect(eff).toHaveLength(1); // porteur temporisé (≠ Corruption permanente)
    expect(eff[0].duration).toEqual({ scale: 'rounds', left: 3 });
  });

  it('lanceur sans Domaine du Chaos → aucun effet (no-op propre, jamais un mauvais Trait)', () => {
    const c = caster();
    const lines = runPureFlowLines(c, c, spellFlow(), { rng: fixed(3), caster: c, defaultDurationRounds: 3, label: 'Allure démoniaque' });
    expect(lines).toEqual([]);
    expect((c.activeEffects ?? []).filter((e) => e.grantedTrait)).toHaveLength(0);
    expect((c.mutations ?? []).length).toBe(0);
  });
});
