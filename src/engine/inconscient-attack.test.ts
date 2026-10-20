import { describe, it, expect } from 'vitest';
import { resolveMelee, resolveRanged } from './combat';
import { addCondition, cannotDefend } from './conditions';
import type { Combatant, Weapon } from './types';
import { deFixe } from './dice.testkit';

const rngOf = deFixe;

const mk = (_over: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'c',
    name: 'C',
    kind: 'enemy',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 35, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 },
    advantage: 0,
    conditions: [],
    skills: [],
    talents: [],
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    movement: 4,
    size: 'moyenne',
  } as unknown as Combatant);

const sword: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
const bow: Weapon = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [] };

describe('Attaque contre un Inconscient (LDB 16 l.113)', () => {
  it('un Inconscient ne peut pas se défendre', () => {
    const ko = mk();
    addCondition(ko, 'inconscient');
    expect(cannotDefend(ko)).toBe(true);
  });

  it('mêlée : touche automatiquement même sur un jet raté (98) et inflige un Critique', () => {
    const target = mk();
    addCondition(target, 'inconscient');
    // CC 40, jet 98 → échec normal ; vs Inconscient → « Je ne faillirai pas ! » : réussite + critique.
    const res = resolveMelee(mk(), target, sword, rngOf(98));
    expect(res.hit).toBe(true);
    expect(res.critical).toBe(true);
  });

  it('mêlée : un défenseur conscient esquive/pare ce même jet raté (pas de touche)', () => {
    const target = mk();
    const res = resolveMelee(mk(), target, sword, rngOf(98), { defense: 'none' });
    expect(res.hit).toBe(false); // jet 98 vs CC 40 → échec, cible consciente
  });

  it('distance : touche automatiquement et inflige un Critique', () => {
    const target = mk();
    addCondition(target, 'inconscient');
    const res = resolveRanged(mk(), target, bow, rngOf(95), 5);
    expect(res.hit).toBe(true);
    expect(res.critical).toBe(true);
  });

  it('distance : Dégâts « à bout portant » > Dégâts à portée moyenne (même jet réussi)', () => {
    const consc = mk();
    const ko = mk();
    addCondition(ko, 'inconscient');
    // Jet 35 ≤ CT 40 → réussite dans les deux cas ; l'Inconscient ajoute +6 DR (bout portant).
    const hitConsc = resolveRanged(mk(), consc, bow, rngOf(35), 30); // portée moyenne
    const hitKO = resolveRanged(mk(), ko, bow, rngOf(35), 30);
    expect(hitConsc.hit).toBe(true);
    expect(hitKO.hit).toBe(true);
    expect(hitKO.damage!).toBeGreaterThan(hitConsc.damage!);
  });
});
