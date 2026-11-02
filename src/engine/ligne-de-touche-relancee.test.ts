import { describe, it, expect } from 'vitest';
import { resolveMelee, issueAuJet, hitLocationByShape, reverseRoll } from './combat';
import { t } from '../i18n';
import { locationLabel, type Combatant, type Weapon } from './types';
import type { RNG } from './dice';
import { desEnSuite } from './dice.testkit';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

/** Le `log` né au jet est l'issue au jet : LDB 18 l.53, l.55 ; AA 07 l.32. */

const epee = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] } as unknown as Weapon;
const combattant = (id: string): Combatant => (blessuresSurLeProfil({
  id, label: id, kind: 'hero',
  characteristics: { 'capacite-de-combat': 50, 'capacite-de-tir': 50, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
  wounds: blessuresDeBase(12), advantage: 0, conditions: [], traumas: [], traits: [], weapons: [], items: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, skills: [], talents: [], movement: 4,
  bodyShape: 'humanoide', size: 'moyenne', pos: { x: 0, y: 0 },
})) as unknown as Combatant;
const des = (...d: number[]): RNG => desEnSuite(d);

describe('le log né au jet est la ligne de `issueAuJet`', () => {
  it('double 22, Localisation relancée au d100 5 : la Tête, jamais le Bras gauche de l’inversion', () => {
    const a = combattant('A'), d = combattant('D');
    const res = resolveMelee(a, d, epee, des(22, 5), { defense: 'none' });
    expect(hitLocationByShape(reverseRoll(22))).toBe('brasG');
    expect(res.critLocation).toBe('tete');
    const { ligne } = issueAuJet(d, res, epee, a);
    expect(res.log).toBe(ligne);
    expect(ligne).toContain(`(${t('touche.nouvelleLocalisation', { lieu: locationLabel('tete', 'humanoide') })})`);
  });
});
