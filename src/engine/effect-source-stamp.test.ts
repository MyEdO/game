import { describe, it, expect } from 'vitest';
import { applyOps } from './ops';
import type { Combatant } from './types';

/**
 * CÂBLAGE — `ctx.source` (EffectSource) doit remonter sur TOUT objet/arme PERSISTANT créé par un
 * `GameOp`, pas seulement sur l'`ActiveEffect` qui porte l'effet temporisé (#492). Sans ce stamp,
 * une arme/objet octroyé par un sort/mutation n'a aucun moyen de remonter à sa règle source.
 */
const combatant = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'c', label: 'Cobaye', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], items: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

const SRC = { kind: 'spell', id: 'benediction-de-puissance' } as const;

describe('grantNaturalWeapon — stampe ctx.source sur l’arme naturelle créée', () => {
  it('avec ctx.source : l’arme (activeEffects[].naturalWeapon ET c.weapons) porte la source', () => {
    const c = combatant();
    applyOps(c, [{ op: 'grantNaturalWeapon', label: 'Griffe aethyrique', damage: 3 }], { label: 'Griffe aethyrique', source: SRC });
    expect(c.activeEffects?.[0].naturalWeapon?.source).toEqual(SRC);
    expect(c.weapons.find((w) => w.label === 'Griffe aethyrique')?.source).toEqual(SRC);
  });

  it('sans ctx.source : aucune fausse valeur — le champ reste absent', () => {
    const c = combatant();
    applyOps(c, [{ op: 'grantNaturalWeapon', label: 'Griffe', damage: 3 }], { label: 'Griffe' });
    expect(c.activeEffects?.[0].naturalWeapon?.source).toBeUndefined();
    expect(c.weapons.find((w) => w.label === 'Griffe')?.source).toBeUndefined();
  });
});

describe('grantWeapon — stampe ctx.source sur l’objet invoqué créé', () => {
  it('avec ctx.source : l’ItemInstance conjured porte la source', () => {
    const c = combatant();
    applyOps(c, [{ op: 'grantWeapon', damage: { bonusOf: 'force-mentale' } }], { label: 'Arme aethyrique', defaultDurationRounds: 4, source: SRC });
    const it = c.items?.find((i) => i.conjured);
    expect(it?.source).toEqual(SRC);
  });

});

describe('giveTrapping — stampe ctx.source sur l’objet donné', () => {
  it('avec ctx.source : l’ItemInstance créée porte la source', () => {
    const c = combatant();
    applyOps(c, [{ op: 'giveTrapping', trappingId: 'ration' }], { source: SRC });
    expect(c.items?.[0].source).toEqual(SRC);
  });

  it('sans ctx.source : aucune fausse valeur — le champ reste absent', () => {
    const c = combatant();
    applyOps(c, [{ op: 'giveTrapping', trappingId: 'ration' }], {});
    expect(c.items?.[0].source).toBeUndefined();
  });
});
