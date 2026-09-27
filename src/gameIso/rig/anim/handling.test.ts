import { describe, it, expect } from 'vitest';
import { handlingClass, isTwoHanded, isRangedHandling, type Handling } from './handling';
import { WEAPON_FORMS } from '../parts/weaponForms';
import { findTrappingById } from '../../../data';
import type { Weapon } from '../../../engine/types';

// Le maniement est routé PAR ID STABLE (`shape`) — l'arme est construite comme au SPAWN : id de Possession → shape.
const w = (id: string, type: 'melee' | 'ranged' = 'melee'): Weapon =>
  ({ label: findTrappingById(id)?.label ?? id, type, damage: { plusBF: false, flat: 4 }, qualities: [], shape: findTrappingById(id)?.shape } as Weapon);
/** Arme routée directement par son slug de FORME (pas de libellé). */
const byShape = (shape: string | undefined, type: 'melee' | 'ranged' = 'melee'): Weapon =>
  ({ label: 'x', type, damage: { plusBF: false, flat: 4 }, qualities: [], shape } as Weapon);

describe('handlingClass — dérivé de la FORME, pas du Groupe de règles', () => {
  it('mappe un représentant de chaque classe', () => {
    const cases: Array<[string, 'melee' | 'ranged', Handling]> = [
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
      expect(handlingClass(w(name, type)), name).toBe(expected);
    }
  });

  it('la FORME prime sur le Groupe trompeur (bec-de-corbin: Groupe Cavalerie → maniement lame1m)', () => {
    expect(handlingClass(w('marteau-a-bec-de-corbin'))).toBe('lame1m');
  });

  it('arme à feu d’ingénierie (Arquebus à répétition) → arme_feu comme la poudre noire', () => {
    expect(handlingClass(w('arquebus-a-repetition', 'ranged'))).toBe('arme_feu');
  });

  it('toute forme cataloguée résout vers UNE classe connue (aucune forme orpheline)', () => {
    const KNOWN: Handling[] = ['lame1m', 'escrime', 'lourde2m', 'hampe', 'lance_cav', 'fleau', 'parade', 'poings', 'arc', 'arbalete', 'arme_feu', 'fronde', 'jet', 'entraves', 'explosif'];
    for (const f of WEAPON_FORMS) {
      const h = handlingClass(byShape(f.slug, f.type));
      expect(KNOWN, f.slug).toContain(h);
    }
  });

  it('repli : arme non dessinée → groupe canonique (Épée → lame1m, mêlée inconnue → lame1m, distance inconnue → arc)', () => {
    expect(handlingClass(w('epee'))).toBe('lame1m');
    expect(handlingClass(w('truc-bizarre', 'melee'))).toBe('lame1m');
    expect(handlingClass(w('engin-inconnu', 'ranged'))).toBe('arc');
  });

  it('sans arme → lame1m (défaut neutre)', () => {
    expect(handlingClass(undefined)).toBe('lame1m');
  });
});

describe('isTwoHanded — la main gauche vient tenir l’arme', () => {
  it('vrai pour lourde2m / hampe / arc / arbalète / arme à feu', () => {
    expect(isTwoHanded(w('zweihander'))).toBe(true);
    expect(isTwoHanded(w('hallebarde'))).toBe(true);
    expect(isTwoHanded(w('arc-long', 'ranged'))).toBe(true);
    expect(isTwoHanded(w('arbalete', 'ranged'))).toBe(true);
    expect(isTwoHanded(w('arquebuse', 'ranged'))).toBe(true);
  });
  it('faux pour les armes à une main', () => {
    expect(isTwoHanded(w('dague'))).toBe(false);
    expect(isTwoHanded(w('rapiere'))).toBe(false);
    expect(isTwoHanded(w('coup-de-poing'))).toBe(false);
  });
});

describe('isRangedHandling', () => {
  it('classe les familles à distance', () => {
    expect(isRangedHandling(w('arc-long', 'ranged'))).toBe(true);
    expect(isRangedHandling(w('bombe', 'ranged'))).toBe(true);
    expect(isRangedHandling(w('fouet', 'ranged'))).toBe(true);
    expect(isRangedHandling(w('dague'))).toBe(false);
  });
});
