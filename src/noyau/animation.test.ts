import { describe, it, expect } from 'vitest';
import { maniementDe } from './animation';
import type { Maniement } from '../data/schemas/grammaire/valeurs';
import { findTrappingById } from '../data';
import { buildWeapon, itemFromTrappingById, weaponFromItem } from '../engine/items';
import { armeDeDessin, type FormeDArme } from './equipementDessine';
import type { Weapon } from '../engine/types';

/** #2967 */
const w = (id: string, type: 'melee' | 'ranged' = 'melee'): FormeDArme => {
  const objet = itemFromTrappingById(id, findTrappingById);
  const arme = objet ? weaponFromItem(objet) : buildWeapon({ label: id, type, damage: { plusBF: false, flat: 4 } });
  return armeDeDessin({ ...arme, type });
};

describe('maniementDe — dérivé de la FORME, pas du Groupe de règles', () => {
  it('mappe un représentant de chaque classe', () => {
    const cases: Array<[string, 'melee' | 'ranged', Maniement]> = [
      ['dague', 'melee', 'lame1m'],
      ['rapiere', 'melee', 'escrime'],
      ['zweihander', 'melee', 'lourde2m'],
      ['hallebarde', 'melee', 'hampe'],
      ['lance-de-cavalerie', 'melee', 'lance_cav'],
      ['fleau-d-armes', 'melee', 'fleau'],
      ['main-gauche', 'melee', 'parade'],
      ['coup-de-poing', 'melee', 'poings'],
      ['arc-long', 'ranged', 'arc'],
      ['arbalete', 'ranged', 'arbalete'],
      ['pistolet', 'ranged', 'arme_feu'],
      ['fronde', 'ranged', 'fronde'],
      ['javelot', 'ranged', 'jet'],
      ['fouet', 'ranged', 'entraves'],
      ['bombe', 'ranged', 'explosif'],
    ];
    for (const [name, type, expected] of cases) {
      expect(maniementDe(w(name, type)), name).toBe(expected);
    }
  });

  it('la FORME prime sur le Groupe trompeur (bec-de-corbin: Groupe Cavalerie → maniement lame1m)', () => {
    expect(maniementDe(w('marteau-a-bec-de-corbin'))).toBe('lame1m');
  });

  it('arme à feu d’ingénierie (Arquebus à répétition) → arme_feu comme la poudre noire', () => {
    expect(maniementDe(w('arquebus-a-repetition', 'ranged'))).toBe('arme_feu');
  });

  it('repli : arme non dessinée → groupe canonique (Épée → lame1m, mêlée inconnue → lame1m, distance inconnue → arc)', () => {
    expect(maniementDe(w('epee'))).toBe('lame1m');
    expect(maniementDe(w('truc-bizarre', 'melee'))).toBe('lame1m');
    expect(maniementDe(w('engin-inconnu', 'ranged'))).toBe('arc');
  });

  it('sans arme → lame1m (défaut neutre)', () => {
    expect(maniementDe(undefined)).toBe('lame1m');
  });

  it('#2113 S3 — arme invoquée : le maniement suit la forme résolue de `form`, comme son dessin', () => {
    const invoquee: Weapon = buildWeapon({ label: 'Arme aethyrique', type: 'melee', damage: { plusBF: false, flat: 4 }, shape: findTrappingById('arbalete')!.shape });
    expect(findTrappingById('arbalete')?.shape?.id, 'la sonde mord : le gabarit a une forme d’arbalète').toBe('arbalete');
    expect(maniementDe(armeDeDessin(invoquee))).toBe('arbalete');
  });
});
