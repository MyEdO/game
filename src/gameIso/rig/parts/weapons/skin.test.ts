import { describe, it, expect } from 'vitest';
import { weaponPart } from '../equipment';
import { tokensOf } from '../../palette';
import type { Weapon } from '../../../../engine/types';

/** Arme routée PAR SHAPE (id de forme stable) — plus aucun routage par libellé. */
const w = (shape: string, skin?: Record<string, string>): Weapon =>
  ({ label: 'x', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [], shape, skin } as Weapon);

describe('skin d’arme — recolorisation par-objet (jetons de palette)', () => {
  it('au défaut, l’art est entièrement résolu (aucun jeton `@clé` résiduel)', () => {
    const art = weaponPart(w('epee_batarde')) as string;
    expect(typeof art).toBe('string');
    expect(tokensOf(art)).toEqual([]); // tous les jetons substitués en hex
  });

  it('un skin override recolore (≠ défaut, la couleur du skin apparaît)', () => {
    const base = weaponPart(w('epee_batarde')) as string;
    const gold = weaponPart(w('epee_batarde', { metal: '#caa64a' })) as string;
    expect(gold).not.toBe(base);
    expect(gold.toLowerCase()).toContain('#caa64a'); // la lame dorée
    expect(tokensOf(gold)).toEqual([]);
  });

  it('un skin vide = rendu par défaut (résolution idempotente)', () => {
    expect(weaponPart(w('dague', {}))).toEqual(weaponPart(w('dague')));
  });
});
