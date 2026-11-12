import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { maniementDe, maniementDeLaForme } from './animation';
import type { Maniement } from '../data/schemas/grammaire/valeurs';
import { findTrappingById } from '../data';
import { buildWeapon, itemFromTrappingById, weaponFromItem } from '../engine/items';
import { armeDeDessin, type FormeDArme } from './equipementDessine';
import type { Weapon } from '../engine/types';

/** #2967 */
const w = (id: string, type: 'melee' | 'distance' = 'melee'): FormeDArme => {
  const objet = itemFromTrappingById(id, idsDeTest, findTrappingById);
  const arme = objet ? weaponFromItem(objet) : buildWeapon({ label: id, type, damage: { plusBF: false, flat: 4 }, uid: id });
  return armeDeDessin({ ...arme, type });
};

describe('maniementDe — dérivé de la FORME, pas du Groupe de règles', () => {
  it('mappe un représentant de chaque classe', () => {
    const cases: Array<[string, 'melee' | 'distance', Maniement]> = [
      ['dague', 'melee', 'lame1m'],
      ['rapiere', 'melee', 'escrime'],
      ['zweihander', 'melee', 'lourde2m'],
      ['hallebarde', 'melee', 'hampe'],
      ['lance-de-cavalerie', 'melee', 'lance_cav'],
      ['fleau-d-armes', 'melee', 'fleau'],
      ['main-gauche', 'melee', 'parade'],
      ['coup-de-poing', 'melee', 'poings'],
      ['arc-long', 'distance', 'arc'],
      ['arbalete', 'distance', 'arbalete'],
      ['pistolet', 'distance', 'arme_feu'],
      ['fronde', 'distance', 'fronde'],
      ['javelot', 'distance', 'jet'],
      ['fouet', 'distance', 'entraves'],
      ['bombe', 'distance', 'explosif'],
    ];
    for (const [name, type, expected] of cases) {
      expect(maniementDe(w(name, type)), name).toBe(expected);
    }
  });

  it('la FORME prime sur le Groupe trompeur (bec-de-corbin: Groupe Cavalerie → maniement lame1m)', () => {
    expect(maniementDe(w('marteau-a-bec-de-corbin'))).toBe('lame1m');
  });

  it('arme à feu d’ingénierie (Arquebus à répétition) → arme_feu comme la poudre noire', () => {
    expect(maniementDe(w('arquebus-a-repetition', 'distance'))).toBe('arme_feu');
  });

  it('repli : arme non dessinée → groupe canonique (Épée → lame1m, mêlée inconnue → lame1m, distance inconnue → arc)', () => {
    expect(maniementDe(w('epee'))).toBe('lame1m');
    expect(maniementDe(w('truc-bizarre', 'melee'))).toBe('lame1m');
    expect(maniementDe(w('engin-inconnu', 'distance'))).toBe('arc');
  });

  it('sans arme → lame1m (défaut neutre)', () => {
    expect(maniementDe(undefined)).toBe('lame1m');
  });

  it('#2113 S3 — arme invoquée : le maniement suit la forme résolue de `form`, comme son dessin', () => {
    const invoquee: Weapon = buildWeapon({ label: 'Arme aethyrique', type: 'melee', damage: { plusBF: false, flat: 4 }, shape: findTrappingById('arbalete')!.shape, uid: 'conjure-1' });
    expect(findTrappingById('arbalete')?.shape?.id, 'la sonde mord : le gabarit a une forme d’arbalète').toBe('arbalete');
    expect(maniementDe(armeDeDessin(invoquee))).toBe('arbalete');
  });
});

describe('maniementDeLaForme — celui que déclare la racine de la forme', () => {
  it('une racine donne le sien ; une variante, celui de sa racine ; aucune déclaration, aucun', () => {
    expect(maniementDeLaForme('hallebarde')).toBe('hampe');
    expect(maniementDeLaForme('grande_hache')).toBe('lourde2m');
    expect(maniementDeLaForme('epee_soldat')).toBeUndefined();
    expect(maniementDeLaForme('inconnue')).toBeUndefined();
  });
});
