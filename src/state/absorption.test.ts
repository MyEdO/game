/**
 * Trait de créature ABSORPTION (EDO 11 l.222) — mécanique 100 % DONNÉES (traits.json `absorption.effects`),
 * dispatchée par le système générique d'effets déclenchés (`fireTriggers`). Aucune branche par-nom dans le
 * moteur : tout passe par les extensions GÉNÉRALES de vocabulaire (Condition `engagedAdvantageLead`,
 * Formula `{woundsDealt}`, EffectTargeting `grappled` / `{pick}`).
 *
 * RAW (verbatim) : « À la fin du Round, si la créature a un Avantage plus élevé que tous les adversaires
 * engagés, elle absorbe un adversaire de taille égale ou inférieure. Une victime absorbée gagne un nombre
 * d'États Empêtré égal au Bonus de Force de la créature et compte comme étant Empoigné. Une victime
 * absorbée perd le Bonus de Force de la créature en Blessures à la fin de chaque tour ; les Points
 * d'Armure, ou le Bonus d'Endurance, ne réduisent pas cette perte. Le même nombre de Blessures est
 * « guéri » par la créature. […] Toute attaque qui touche la créature inflige une quantité égale de Dégâts
 * à la victime absorbée. »
 */
import { describe, it, expect } from 'vitest';
import { fireTriggers } from './triggeredEffects';
import { areGrappling } from '../engine/grapple';
import { clearEngagementOf } from '../engine/engagement';
import { stacks } from '../engine/conditions';
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';
import type { SizeCategory } from '../engine/size';

/** Combattant minimal — F 45 → Bonus de Force 4 (la « monnaie » de l'Absorption). */
const mk = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'c', label: 'C', kind: 'enemy',
  characteristics: { 'capacite-de-combat': 35, 'capacite-de-tir': 25, force: 45, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 25, 'force-mentale': 25, sociabilite: 25 },
  wounds: { current: 20, max: 30 }, advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
  ...over,
} as Combatant);

/** Créature Absorption — Grande (4), BF 4, Avantage `adv`. */
const beast = (adv: number, over: Partial<Combatant> = {}): Combatant =>
  mk({ id: 'beast', label: 'Engloutisseur', kind: 'enemy', traits: [{ id: 'absorption' }], size: 'grande' as SizeCategory, advantage: adv, pos: { x: 5, y: 5 }, wounds: { current: 10, max: 30 }, ...over });

/** Proie engagée avec la bête (héros) — Taille `size`, Avantage `adv`. */
const prey = (id: string, size: SizeCategory, adv = 0, over: Partial<Combatant> = {}): Combatant =>
  mk({ id, label: id, kind: 'hero', size, advantage: adv, engagedWith: ['beast'], pos: { x: 5, y: 6 }, ...over });

const get = (...cs: Combatant[]) => (() => ({ battle: { combatants: cs } })) as never;
const empetre = (c: Combatant) => stacks(c, 'empetre');
const digere = (c: Combatant) => stacks(c, 'digere');

describe('Absorption (EDO 11 l.222) — engloutissement de fin de Round, data-driven', () => {
  it('(a) Avantage supérieur à TOUS + adversaire de Taille ≤ → absorbe : Empêtré ×BF, Empoigné, marqué Digéré', () => {
    const b = beast(2);
    const v = prey('v', 'moyenne'); // Moyenne (3) ≤ Grande (4)
    fireTriggers(get(b, v), b, 'onRoundEnd', { rng: makeRNG(1) });
    expect(empetre(v)).toBe(4);          // BF de la créature (F 45 → 4)
    expect(areGrappling(b, v)).toBe(true); // « compte comme étant Empoigné » = lien grapplingWith
    expect(digere(v)).toBe(1);           // marqueur d'État Digéré posé
  });

  it('(a) un adversaire de Taille SUPÉRIEURE n’est PAS absorbé', () => {
    const b = beast(2);
    const big = prey('big', 'enorme'); // Énorme (5) > Grande (4)
    fireTriggers(get(b, big), b, 'onRoundEnd', { rng: makeRNG(1) });
    expect(empetre(big)).toBe(0);
    expect(areGrappling(b, big)).toBe(false);
    expect(digere(big)).toBe(0);
  });

  it('(a) Avantage NON strictement supérieur (égalité) → aucune absorption', () => {
    const b = beast(1);
    const v = prey('v', 'moyenne', 1); // Avantage égal → avance = 0, pas « plus élevé »
    fireTriggers(get(b, v), b, 'onRoundEnd', { rng: makeRNG(1) });
    expect(empetre(v)).toBe(0);
    expect(areGrappling(b, v)).toBe(false);
  });

  it('(b) digestion de fin de Round : la victime absorbée perd le BF (PA & BE ignorés), la créature « guérit » d’autant', () => {
    // Victime DÉJÀ absorbée (empoignée) avec PA et BE élevés → la perte ignore les deux.
    const b = beast(0, { wounds: { current: 10, max: 30 }, grapplingWith: ['v'] });
    const v = prey('v', 'moyenne', 0, {
      grapplingWith: ['beast'], conditions: [{ id: 'empetre', value: 4 }, { id: 'digere', value: 1 }],
      wounds: { current: 20, max: 20 }, armour: { tete: 5, brasG: 5, brasD: 5, corps: 5, jambeG: 5, jambeD: 5 },
      characteristics: { 'capacite-de-combat': 35, 'capacite-de-tir': 25, force: 35, endurance: 55, initiative: 30, agilite: 30, dexterite: 30, intelligence: 25, 'force-mentale': 25, sociabilite: 25 }, // BE 5
    });
    fireTriggers(get(b, v), b, 'onRoundEnd', { rng: makeRNG(1) });
    expect(v.wounds.current).toBe(16); // 20 − 4 (BF), PA 5 et BE 5 IGNORÉS
    expect(b.wounds.current).toBe(14); // 10 + 4, la créature guérit le même nombre
  });

  it('(b) digestion qui TUE (PB restants < BF) : la créature ne guérit que les Blessures RÉELLEMENT perdues, pas le BF entier (RAW « le même nombre »)', () => {
    const b = beast(0, { wounds: { current: 10, max: 30 }, grapplingWith: ['v'] });
    const v = prey('v', 'moyenne', 0, {
      grapplingWith: ['beast'], conditions: [{ id: 'empetre', value: 4 }, { id: 'digere', value: 1 }],
      wounds: { current: 2, max: 20 }, // 2 PB restants < BF 4
    });
    fireTriggers(get(b, v), b, 'onRoundEnd', { rng: makeRNG(1) });
    expect(v.wounds.current).toBe(0);  // 2 − min(BF 4, 2) = 0
    expect(b.wounds.current).toBe(12); // 10 + 2 (le RÉEL), surtout PAS 10 + 4
  });

  it('(c) redirection : une attaque infligeant N PB à la créature inflige N PB à la victime absorbée', () => {
    const b = beast(0, { grapplingWith: ['v'] });
    const v = prey('v', 'moyenne', 0, {
      grapplingWith: ['beast'], wounds: { current: 20, max: 20 },
      armour: { tete: 4, brasG: 4, brasD: 4, corps: 4, jambeG: 4, jambeD: 4 },
      characteristics: { 'capacite-de-combat': 35, 'capacite-de-tir': 25, force: 35, endurance: 55, initiative: 30, agilite: 30, dexterite: 30, intelligence: 25, 'force-mentale': 25, sociabilite: 25 },
    });
    // onWoundLoss émis sur la créature (cf. combatFlow) avec les PB réellement perdus ce coup = 7.
    fireTriggers(get(b, v), b, 'onWoundLoss', { rng: makeRNG(1), woundsDealt: 7 });
    expect(v.wounds.current).toBe(13); // 20 − 7 (égal, PA & BE ignorés)
  });

  it('(d) UN SEUL adversaire absorbé par Round — le plus proche', () => {
    const b = beast(2);
    const near = prey('near', 'moyenne', 0, { pos: { x: 5, y: 6 } }); // dist 1
    const farr = prey('farr', 'moyenne', 0, { pos: { x: 5, y: 9 } }); // dist 4
    fireTriggers(get(b, near, farr), b, 'onRoundEnd', { rng: makeRNG(1) });
    expect(areGrappling(b, near)).toBe(true);
    expect(areGrappling(b, farr)).toBe(false);
    expect((b.grapplingWith ?? []).length).toBe(1); // capacité 1 : un seul happé ce Round
    // Round suivant : déjà un absorbé → capacité 0 → aucun nouvel engloutissement.
    fireTriggers(get(b, near, farr), b, 'onRoundEnd', { rng: makeRNG(2) });
    expect(areGrappling(b, farr)).toBe(false);
    expect((b.grapplingWith ?? []).length).toBe(1);
  });

  it('(e) mort de la victime absorbée → le lien d’absorption est levé (clearEngagementOf, voie de mort du combat)', () => {
    const b = beast(0, { grapplingWith: ['v'] });
    const v = prey('v', 'moyenne', 0, { grapplingWith: ['beast'], conditions: [{ id: 'inconscient', value: 1 }], wounds: { current: 0, max: 20 } });
    expect(areGrappling(b, v)).toBe(true);
    clearEngagementOf([b, v], v.id); // la victime tombe hors de combat → le combat purge ses liens
    expect(areGrappling(b, v)).toBe(false);
    expect(b.grapplingWith).toEqual([]);
  });
});
