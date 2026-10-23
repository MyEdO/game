import { describe, it, expect } from 'vitest';
import { applyOps } from './ops';
import { removeActiveEffects } from './conditions';
import { attachMutation } from './corruption';
import { rollMutation } from '../data/mutations';
import type { Combatant } from './types';
import { deFixe, desDuTest } from './dice.testkit';
import { idNeufDeBanc } from '../lib/entityId.testkit';

/**
 * Op `rollTable` variante `tableId` (dé-stub Allure démoniaque, EDOC 13) + multiplicité `extraRollsPerStep`
 * (couplée au PAS de Surincantation alloué à la Durée, `ctx.overcastDurationSteps` — EDOC 13 l.270-276,
 * « pour chaque +2 DR, vous pouvez à la fois prolonger la durée et refaire un jet ») + op `rollMutation`
 * (mutation PERMANENTE). Résolution de table via `tables.json` (`findEffectTableById`, fail-fast), lookup
 * `[min,max]` (source unique `findTableEntry`). RNG figé (dé = valeur `int`).
 */
const dummy = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'x', label: 'X', kind: 'enemy', species: 'humains',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], skills: [], talents: [], traits: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

/** RNG figé au dé `n` (int() renvoie `n`, tous appels). */
const fixed = deFixe;

describe('op rollTable — variante tableId (tables.json)', () => {
  it('résout la table référencée et applique les ops de la rangée (Nurgle 3 = Démoniaque (7))', () => {
    const c = dummy();
    applyOps(c, [{ op: 'rollTable', tableId: 'allure-demoniaque-nurgle' }], { idNeuf: idNeufDeBanc, rng: fixed(3), defaultDurationRounds: 5 });
    const eff = (c.activeEffects ?? []).filter((e) => e.grantedTrait);
    expect(eff).toHaveLength(1);
    expect(eff[0].grantedTrait!.id).toBe('demoniaque');
    expect(eff[0].grantedTrait!.value).toBe(7); // Indice porté par la rangée
    expect(eff[0].duration).toEqual({ scale: 'rounds', left: 5 }); // durée du Sort (ctx.defaultDurationRounds)
    expect((c.traits ?? []).some((t) => t.id === 'demoniaque')).toBe(true);
  });

  it('tableId inconnu → fail-fast (jamais un tirage silencieux)', () => {
    expect(() => applyOps(dummy(), [{ op: 'rollTable', tableId: 'inexistante' }], { idNeuf: idNeufDeBanc, rng: fixed(1) })).toThrow(/introuvable/i);
  });

  it('extraRollsPerStep : 1 jet + N par pas de Surincantation Durée (EDOC 13 l.270-276)', () => {
    const roll = (overcastDurationSteps: number, perStep: number) => {
      const c = dummy();
      applyOps(c, [{ op: 'rollTable', tableId: 'allure-demoniaque-nurgle', extraRollsPerStep: perStep }], { idNeuf: idNeufDeBanc, rng: fixed(3), overcastDurationSteps, defaultDurationRounds: 3 });
      return (c.activeEffects ?? []).filter((e) => e.grantedTrait).length;
    };
    expect(roll(0, 1)).toBe(1); // 0 pas de Durée → 1 seul jet
    expect(roll(1, 1)).toBe(2); // 1 pas → +1 jet
    expect(roll(2, 1)).toBe(3); // 2 pas → +2 jets (RAW « à la fois prolonger la durée et refaire un jet »)
    const c = dummy();
    applyOps(c, [{ op: 'rollTable', tableId: 'allure-demoniaque-nurgle', extraRollsPerStep: 1 }], { idNeuf: idNeufDeBanc, rng: fixed(3), defaultDurationRounds: 3 }); // ctx sans overcastDurationSteps ≡ 0
    expect((c.activeEffects ?? []).filter((e) => e.grantedTrait)).toHaveLength(1);
  });

  it('chosenTableRolls DÉCLINE le jet (EDOC 13 l.276 « vous pouvez ») sans jamais dépasser les pas alloués', () => {
    const roll = (overcastDurationSteps: number, chosenTableRolls: number | undefined) => {
      const c = dummy();
      applyOps(c, [{ op: 'rollTable', tableId: 'allure-demoniaque-nurgle', extraRollsPerStep: 1 }], { idNeuf: idNeufDeBanc, rng: fixed(3), overcastDurationSteps, chosenTableRolls, defaultDurationRounds: 3 });
      return (c.activeEffects ?? []).filter((e) => e.grantedTrait).length;
    };
    expect(roll(2, undefined)).toBe(3); // chosen absent = tous les pas (comportement actuel/IA)
    expect(roll(2, 0)).toBe(1); // décliné entièrement → 1 seul jet (le jet de base reste dû)
    expect(roll(2, 1)).toBe(2); // 1 pas choisi sur 2 alloués
    expect(roll(2, 2)).toBe(3); // tous choisis = comme absent
    expect(roll(2, 5)).toBe(3); // clamp : jamais au-delà des pas RÉELLEMENT alloués
  });

  it('addNegativeSL décale le jet vers le bas de |DR| (parité avec la forme inline)', () => {
    // die=3, |DR|=3 → lookup à 6 (Nurgle 6 = Peur (3))
    const c = dummy();
    applyOps(c, [{ op: 'rollTable', tableId: 'allure-demoniaque-nurgle', addNegativeSL: true }], { idNeuf: idNeufDeBanc, rng: fixed(3), sl: -3 });
    const eff = (c.activeEffects ?? []).filter((e) => e.grantedTrait);
    expect(eff[0].grantedTrait!.id).toBe('peur');
    expect(eff[0].grantedTrait!.value).toBe(3);
  });

  it('la forme inline `rows` reste fonctionnelle (rétro-compatibilité)', () => {
    const c = dummy();
    applyOps(c, [{ op: 'rollTable', die: 'd10', rows: [{ min: 1, max: 10, ops: [{ op: 'wounds', amount: 4 }] }] }], { idNeuf: idNeufDeBanc, rng: fixed(3) });
    expect(c.wounds.current).toBe(16);
  });
});

describe('op rollMutation — durée du Sort par défaut, permanent en option (EDOC 13 l.276-277)', () => {
  it('ctx à durée → mutation attachée + ActiveEffect porteur qui la détache à l’expiration', () => {
    const c = dummy();
    const lines = applyOps(c, [{ op: 'rollMutation', table: 'edoc-phys-nurgle' }], { idNeuf: idNeufDeBanc, rng: fixed(1), defaultDurationRounds: 5 });
    expect((c.mutations ?? []).length).toBe(1);
    const eff = (c.activeEffects ?? []).filter((e) => e.grantedMutation);
    expect(eff).toHaveLength(1);
    expect(eff[0].duration).toEqual({ scale: 'rounds', left: 5 });
    expect(eff[0].grantedMutation!.id).toBe((c.mutations ?? [])[0].id);
    // Le journal ne ment JAMAIS sur la temporalité : un octroi TEMPORISÉ n'affirme pas « permanente ».
    expect(lines.some((l) => /pour la durée/.test(l))).toBe(true);
    expect(lines.some((l) => /permanente/.test(l))).toBe(false);
  });

  it('ctx SANS durée → mutation PERMANENTE (aucun ActiveEffect porteur) — parité chemin Corruption', () => {
    const c = dummy();
    const lines = applyOps(c, [{ op: 'rollMutation', table: 'edoc-phys-nurgle' }], { idNeuf: idNeufDeBanc, rng: fixed(1) });
    expect((c.mutations ?? []).length).toBe(1);
    expect((c.activeEffects ?? []).some((e) => e.grantedMutation)).toBe(false);
    expect(lines.some((l) => /mutation permanente/.test(l))).toBe(true);
  });

  it('`duration:"permanent"` force le permanent MÊME avec un ctx à durée', () => {
    const c = dummy();
    applyOps(c, [{ op: 'rollMutation', table: 'edoc-phys-nurgle', duration: 'permanent' }], { idNeuf: idNeufDeBanc, rng: fixed(1), defaultDurationRounds: 5 });
    expect((c.mutations ?? []).length).toBe(1);
    expect((c.activeEffects ?? []).some((e) => e.grantedMutation)).toBe(false);
  });

  it('table de mutation inconnue → fail-fast', () => {
    expect(() => applyOps(dummy(), [{ op: 'rollMutation', table: 'inexistante' }], { idNeuf: idNeufDeBanc, rng: fixed(1) })).toThrow(/introuvable/i);
  });

  it('mutation TEMPORISÉE détachée à l’expiration : instance ET Trait passif retirés', () => {
    const c = dummy();
    // d100=4 → sang-acide (edoc-phys-nurgle), passif grantTrait « sang-corrosif ».
    applyOps(c, [{ op: 'rollMutation', table: 'edoc-phys-nurgle' }], { idNeuf: idNeufDeBanc, rng: fixed(4), defaultDurationRounds: 2 });
    expect((c.mutations ?? []).some((m) => m.id === 'sang-acide')).toBe(true);
    expect((c.traits ?? []).some((t) => t.id === 'sang-corrosif')).toBe(true);
    // Expiration = MÊME couture que fin de Round / horloge / dissipation (removeActiveEffects).
    removeActiveEffects(c, (e) => !!e.grantedMutation);
    expect((c.mutations ?? []).some((m) => m.id === 'sang-acide')).toBe(false);
    expect((c.traits ?? []).some((t) => t.id === 'sang-corrosif')).toBe(false);
  });

  it('chemin CORRUPTION (attachMutation direct) reste PERMANENT : aucun effet porteur, jamais détaché', () => {
    const c = dummy();
    attachMutation(c, rollMutation('edoc-phys-nurgle', fixed(4)), desDuTest);
    expect((c.mutations ?? []).some((m) => m.id === 'sang-acide')).toBe(true);
    expect((c.activeEffects ?? []).some((e) => e.grantedMutation)).toBe(false); // permanent : pas de porteur
    removeActiveEffects(c, () => true); // aucune expiration ne l'atteint
    expect((c.mutations ?? []).some((m) => m.id === 'sang-acide')).toBe(true);
  });
});
