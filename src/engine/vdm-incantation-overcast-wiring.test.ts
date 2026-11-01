/**
 * Câblage de l'axe Dégâts de la Surincantation révisée (`VDM 02 l.198`, `magic-vdm-incantation`) :
 * le Projectile magique peut regagner en Dégâts le DR que `missileDamageSL` lui retire sous
 * l'option. Chaque cas est mesuré OPTION OFF puis ON sur le MÊME appel — le volet OFF est la
 * garde de non-régression du Livre de base, le volet ON rougit si le point de lecture est
 * débranché.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { setRule, resetRule } from './policy';
import { evaluateMissile, missileDamageSL, type CastResult } from './magic';
import type { Combatant } from './types';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

const RULE = 'magic-vdm-incantation';

afterEach(() => resetRule(RULE));

function mk(p: Partial<Combatant> = {}): Combatant {
  return blessuresSurLeProfil({
    id: 'c', label: 'Sujet', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 42, sociabilite: 30 },
    wounds: blessuresDeBase(14), advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], spells: [], xp: 0,
    ...p,
  }) as Combatant;
}

/** Projectile SANS attribut de Domaine : seuls Dégâts du Sort, DR et BFM entrent dans le calcul. */
const projectile = { label: 'Trait d’essai', type: 'Magie des Arcanes', domainId: null, missile: true, damage: 4, cn: 2, range: null, target: 1, duration: null, desc: 'Il s’agit d’un Projectile magique avec Dégâts +4.' };

const crit = (sl: number): CastResult => ({ cast: true, roll: 44, target: 60, sl, isCritical: true, isFumble: false, log: 'jet' });

describe('missileDamageSL — axe Dégâts (`VDM 02 l.198,207-215`)', () => {
  it('CÂBLAGE : le même appel ne rend pas le même DR ajouté selon l’option', () => {
    expect(missileDamageSL(3, 0)).toBe(3);
    setRule(RULE, true);
    expect(missileDamageSL(3, 0)).toBe(0);
  });

  it('option ON, 0 DR alloué à l’axe Dégâts : le nerf reste sec (aucune contrepartie)', () => {
    setRule(RULE, true);
    expect(missileDamageSL(3, 0)).toBe(0);
  });

  it('option ON, 3 DR alloués à l’axe Dégâts : +3 Dégâts (palier 3 du Tableau)', () => {
    setRule(RULE, true);
    expect(missileDamageSL(3, 3)).toBe(3);
  });

  it('option OFF : les DR alloués à l’axe Dégâts sont ignorés (aucun axe au Livre de base)', () => {
    expect(missileDamageSL(3, 3)).toBe(3); // = Math.max(0, sl), pas de 2e composante
  });
});

describe('evaluateMissile — le Projectile magique regagne ses Dégâts (`VDM 02 l.198`)', () => {
  const caster = mk({ id: 'w', label: 'Mage' }); // BFM 4
  const target = mk({ id: 't', kind: 'enemy' }); // BE 3, aucune PA

  it('option ON SANS allocation à l’axe Dégâts : le nerf de `missileDamageSL` reste sec', () => {
    setRule(RULE, true);
    const r = evaluateMissile(caster, target, projectile as never, crit(3));
    expect(r.damage).toBe(4 + 4); // Dégâts du Sort + BFM, DR non ajouté
  });

  it('option ON AVEC 3 DR alloués à l’axe Dégâts : les Dégâts sont réparés', () => {
    setRule(RULE, true);
    const r = evaluateMissile(caster, target, projectile as never, crit(3), undefined, 3);
    expect(r.damage).toBe(4 + 4 + 3); // Dégâts du Sort + BFM + bonus de Surincantation (palier 3)
  });
});
