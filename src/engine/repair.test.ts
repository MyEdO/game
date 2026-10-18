import { describe, it, expect } from 'vitest';
import { repairCostBrass, repairWeaponCostBrass, isRepairable, itemRepairCostBrass } from './repair';

describe('repair — réparation armure (LDB 63 l.64)', () => {
  it('10 % du prix de base par PA perdu', () => {
    expect(repairCostBrass({ pa: 2, damageTaken: 1 } as any, 120)).toBe(12); // 1 PA perdu × 10 % de 120
    expect(repairCostBrass({ pa: 3, damageTaken: 2 } as any, 120)).toBe(24); // 2 PA × 10 %
  });
  it('pièce brisée (PA nette < 0, LDB 63 l.21) → 30 % du prix de base', () => {
    expect(repairCostBrass({ pa: 1, damageTaken: 2 } as any, 100)).toBe(30);
  });
  it('pièce à 0 PA nette : encore utilisable, 10 % par PA perdu (LDB 63 l.19, l.64)', () => {
    expect(repairCostBrass({ pa: 1, damageTaken: 1 } as any, 100)).toBe(10);
  });
  it('non endommagée → 0', () => {
    expect(repairCostBrass({ pa: 2, damageTaken: 0 } as any, 100)).toBe(0);
  });
});

describe('repair — réparation arme (LDB 62 l.135)', () => {
  const sword = (dt: number) => ({ kind: 'melee', damage: { plusBF: true, flat: 4 }, damageTaken: dt } as any);
  it('10 % du prix de base par point de Dégâts subi', () => {
    expect(repairWeaponCostBrass(sword(1), 200)).toBe(20); // 1 point × 10 % de 200
    expect(repairWeaponCostBrass(sword(3), 200)).toBe(60); // 3 points × 10 %
  });
  it('arme réduite à l’état improvisé (Dégâts +0) : irréparable → 0', () => {
    expect(repairWeaponCostBrass(sword(4), 200)).toBe(0); // flat 4 − 4 = 0 → improvisée
    expect(isRepairable(sword(4))).toBe(false);
    expect(isRepairable(sword(2))).toBe(true);
  });
  it('non endommagée → 0 / non réparable', () => {
    expect(repairWeaponCostBrass(sword(0), 200)).toBe(0);
    expect(isRepairable(sword(0))).toBe(false);
  });
  it('itemRepairCostBrass : dispatch par kind (arme vs armure)', () => {
    expect(itemRepairCostBrass(sword(2), 200)).toBe(40); // arme : 2 × 10 %
    expect(itemRepairCostBrass({ kind: 'armor', pa: 3, damageTaken: 2 } as any, 120)).toBe(24); // armure : 2 PA × 10 %
  });
});
