import { describe, it, expect } from 'vitest';
import { effectiveWeaponDamage } from './weaponDamage';
import { recomputeLoadout, parseDamage } from './items';
import { isMagicWeapon } from './qualities/dispatch';
import { applyOps } from './ops';
import { endOfRound } from './conditions';
import { runPureFlowLines } from '../state/combatEffects';
import type { Combatant, ItemInstance, Weapon } from './types';
import type { TriggeredEffect, Flow } from './flowCore';
import { objetDeTest } from './objetDeTest.testkit';

/** Construit un `TriggeredEffect` onHit→victim portant `ops` (forme unifiée des onHit d'arme). */
const onHitFlow = (ops: unknown[]): TriggeredEffect =>
  ({ trigger: 'onHit', on: 'victim', flow: { kind: 'do', effect: { type: 'ops', on: 'victim', ops } as never } });

/**
 * Enchantement d'arme (op `augmentWeapon`) : B. de Droiture (Magique), Marteau ardent de Sigmar
 * (Magique, +BSoc, En flammes + À Terre à la touche), Épée ardente de Rhuin (+6, Percutante, En
 * flammes), Épée de justice (bypass + Test gaté). L'enchantement vit SUR L'ARME (`ItemInstance.enchants`)
 * et est replié dans l'arme active par `recomputeLoadout` → `c.weapons[0]` est déjà enchantée
 * (visible partout ET appliquée à la résolution). À l'expiration, l'enchant est retiré de l'objet.
 */
const dummy = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'x', label: 'X', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 45 },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

/** Arme NUE pour les comparaisons de mitigation (non enchantée). */
const sword = (): Weapon => ({ label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, reach: 'Moyenne', range: null, qualities: [] });

const weaponItem = (uid: string, trappingId: string, damage: string): ItemInstance =>
  (objetDeTest({ uid, trappingId, kind: 'melee', damage: parseDamage(damage), reach: 'Moyenne', range: null, qualities: [], enc: 1, equipped: true }));

/** Combattant tenant une arme dans son set actif (l'op enchante l'arme TENUE). */
const wielder = (item: ItemInstance, p: Partial<Combatant> = {}): Combatant => {
  const c = dummy({ items: [item], loadouts: [{ id: 'lo', main: item.uid }], activeLoadoutId: 'lo', ...p });
  recomputeLoadout(c);
  return c;
};
const heldEnchants = (c: Combatant) => (c.items ?? []).find((i) => i.uid === 'w')?.enchants;

describe('augmentWeapon — enchantement porté par l’arme, replié dans c.weapons', () => {
  it('B. de Droiture : l’arme tenue devient Magique (isMagicWeapon → touche l’Éthéré), objet non muté', () => {
    const c = wielder(weaponItem('w', 'epee', '+BF+4'));
    applyOps(c, [{ op: 'augmentWeapon', addQualities: ['magique'] }], { label: 'Bénédiction de Droiture', defaultDurationRounds: 6 });
    expect(isMagicWeapon(c.weapons[0])).toBe(true); // arme active enchantée
    expect(heldEnchants(c)).toHaveLength(1); // l'enchant vit sur l'OBJET
    expect(c.items![0].qualities).toEqual([]); // les qualités de base de l'objet ne sont pas mutées
  });

  it('Marteau ardent : +BSoc Dégâts (du PRÊTRE) + Magique + En flammes/À Terre à la touche', () => {
    const priest = dummy({}); // BSoc 4
    const fighter = wielder(weaponItem('w', 'epee', '+BF+4'), { id: 'f' });
    applyOps(fighter, [{
      op: 'augmentWeapon', addQualities: ['magique'], damageBonus: { bonusOf: 'sociabilite' },
      onHitEffects: [onHitFlow([{ op: 'condition', id: 'en-flammes' }, { op: 'condition', id: 'a-terre' }])],
    }], { label: 'Marteau ardent de Sigmar', caster: priest, defaultDurationRounds: 4 });
    expect(effectiveWeaponDamage(fighter.weapons[0], 3)).toBe(3 + 4 + 4); // BF 3 + arme 4 + BSoc 4 du prêtre
    expect(isMagicWeapon(fighter.weapons[0])).toBe(true);
    // L'onHit est replié sur l'arme (weapon.onHitEffects) ; exécuté par le dispatcher → 2 États sur la cible.
    const victim = dummy({ id: 'v' });
    runPureFlowLines(victim, fighter, fighter.weapons[0].onHitEffects![0].flow, {});
    expect(victim.conditions.map((c) => c.id).sort()).toEqual(['en-flammes', 'a-terre'].sort());
  });

  it('Épée ardente de Rhuin : +6 et Percutante s’apposent, et l’enchantement EXPIRE (objet nettoyé)', () => {
    const c = wielder(weaponItem('w', 'epee', '+BF+4'));
    applyOps(c, [{ op: 'augmentWeapon', addQualities: ['percutante'], damageBonus: 6, onHitEffects: [onHitFlow([{ op: 'condition', id: 'en-flammes' }])] }], {
      label: 'Épée ardente de Rhuin', defaultDurationRounds: 1,
    });
    expect(c.weapons[0].qualities.some((q) => q.id === 'percutante')).toBe(true);
    expect(effectiveWeaponDamage(c.weapons[0], 3)).toBe(3 + 4 + 6);
    endOfRound(c); // Round écoulé → dissipation
    expect(c.weapons[0].qualities.some((q) => q.id === 'percutante')).toBe(false);
    expect(effectiveWeaponDamage(c.weapons[0], 3)).toBe(3 + 4);
    expect(heldEnchants(c)).toBeUndefined(); // enchant retiré de l'objet
  });

  it('Épée de justice : bypass « all » lie l’ÉPÉE tenue (requiresWeapon) ; un marteau tenu → fizzle', async () => {
    const { woundsFromHit } = await import('./combat');
    const c = wielder(weaponItem('w', 'epee', '+BF+4'));
    applyOps(c, [{ op: 'augmentWeapon', requiresWeapon: 'épée', addQualities: ['magique'], bypass: 'all' }], { label: 'Épée de justice', defaultDurationRounds: 4 });
    expect(c.weapons[0].bypass).toBe('all'); // épée tenue → enchantée
    const hammerGuy = wielder(weaponItem('w', 'marteau-de-guerre', '+BF+5'), { id: 'h' });
    applyOps(hammerGuy, [{ op: 'augmentWeapon', requiresWeapon: 'épée', addQualities: ['magique'], bypass: 'all' }], { label: 'Épée de justice', defaultDurationRounds: 4 });
    expect(hammerGuy.weapons[0].bypass).toBeUndefined(); // pas d'épée tenue → fizzle
    expect(heldEnchants(hammerGuy)).toBeUndefined();
    const armored = dummy({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 5, jambeG: 0, jambeD: 0 } }); // 5 PA corps, BE 3
    expect(woundsFromHit(sword(), armored, 'corps', 12, 0, 1, undefined)).toBe(12 - 3 - 5); // arme nue : −BE −PA
    expect(woundsFromHit(c.weapons[0], armored, 'corps', 12, 0, 1, undefined)).toBe(12 - 3); // épée enchantée : ignore les 5 PA
  });

  it('Épée de justice : onHit porte un NŒUD FLOW `test` GATÉ par le Groupe « Criminel » (Inconscient sur échec)', () => {
    // Le Test « à la touche » de l'Épée de justice est un nœud de STRUCTURE Flow `{kind:'test'}` (plus
    // une op `test` — supprimée Lot 4d), gaté par `onlyGroups:['Criminel']` sur le FlowTest. L'enchant
    // doit PORTER ce nœud sur l'arme active. La RÉSOLUTION cadence-aware du gate `onlyGroups` (no-op si la
    // victime n'est pas du Groupe) est couverte par `venin-test.test.ts` (même `resolveFlowTest`).
    const justiceTest: Flow = {
      kind: 'test',
      test: { skill: { id: 'resistance' }, difficulty: 'accessible', onlyGroups: ['Criminel'] },
      success: { kind: 'seq', steps: [] },
      fail: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: 'inconscient' }] } },
    };
    const c = wielder(weaponItem('w', 'epee', '+BF+4'));
    applyOps(c, [{
      op: 'augmentWeapon', addQualities: ['magique'],
      onHitEffects: [{ trigger: 'onHit', on: 'victim', flow: justiceTest }],
    }], { label: 'Épée de justice', defaultDurationRounds: 4 });
    const node = c.weapons[0].onHitEffects![0].flow;
    expect(node.kind).toBe('test');
    if (node.kind === 'test') {
      expect(node.test.skill).toEqual({ id: 'resistance' });
      expect(node.test.onlyGroups).toEqual(['Criminel']); // gate porté par le FlowTest
    }
    endOfRound(c); endOfRound(c); endOfRound(c); endOfRound(c);
    expect(heldEnchants(c)).toBeUndefined(); // dissipé avec l'enchantement
  });
});
