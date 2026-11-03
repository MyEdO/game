import { describe, it, beforeEach, expect } from 'vitest';
import { previewAttack } from './combatFlow';
import { ouvrirLeBanc } from './banc.testkit';
import type { Jeu } from './etat';
import type { Scene } from './monde/scene';
import { itemFromTrappingById, porteeDeTir, recomputeLoadout } from '../engine/items';
import { resolveMelee } from '../engine/combat';
import { deFixe } from '../engine/dice.testkit';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import type { Combatant, ItemInstance, Weapon } from '../engine/types';
import { garanti } from '../lib/garanti';

// LDB 21 l.33
beforeEach(() => { ouvrirLeBanc(); });

const scene = (): Scene =>
  ({ id: 's', name: 's', dimensions: { w: 10, h: 10 }, ambiance: 'jour', metresPerTile: 2,
    layers: [{ z: 0, tiles: new Array(100).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] }) as unknown as Scene;

const armeDe = (c: Combatant, id: string): Weapon => {
  const it: ItemInstance = { ...garanti(itemFromTrappingById(id), id, 'trapping'), uid: id, equipped: true };
  c.items = [it];
  recomputeLoadout(c);
  return garanti(c.weapons.find((w) => w.uid === id), id, 'arme dérivée');
};

const heros = (frenetique: boolean, armeId: string): { c: Combatant; w: Weapon } => {
  const c = combattantDeTest({ id: 'h', pos: { x: 0, y: 0 }, characteristics: { force: 40 }, ...(frenetique ? { psychState: [{ type: 'frenesie' }] } : {}) });
  return { c, w: armeDe(c, armeId) };
};

describe('Bonus de Force en Frénésie (LDB 21 l.33)', () => {
  it('aperçu d’attaque : Arme simple (+BF+4), Force 40 → 9 en Frénésie, 8 sinon', () => {
    const cible = combattantDeTest({ id: 't', pos: { x: 1, y: 0 } });
    const dmg = (fr: boolean): number => {
      const { c, w } = heros(fr, 'arme-simple');
      const get = (() => ({ scene: scene(), battle: { combatants: [c, cible], movementUsed: 0 }, facing: {}, gameTime: 0, log: () => {} })) as unknown as () => Jeu;
      return previewAttack(get, c, cible, 'corps', { weapon: w }).dmg;
    };
    expect(dmg(true)).toBe(9);
    expect(dmg(false)).toBe(8);
  });

  it('dégâts appliqués : +1 Blessure en Frénésie au même jet', () => {
    const coup = (fr: boolean) => {
      const { c, w } = heros(fr, 'arme-simple');
      return resolveMelee(c, combattantDeTest({ id: 't', pos: { x: 1, y: 0 } }), w, deFixe(12), { defense: 'none' });
    };
    const fr = coup(true), no = coup(false);
    expect(fr.hit && no.hit).toBe(true);
    expect((fr.damage ?? 0) - (no.damage ?? 0)).toBe(1);
  });

  it('portée d’une arme de jet BF×2 (Couteau de lancer), Force 40 → 10 m en Frénésie, 8 m sinon', () => {
    const r = (fr: boolean): number | null => { const { c, w } = heros(fr, 'couteau-de-lancer'); return porteeDeTir(c, w); };
    expect(r(true)).toBe(10);
    expect(r(false)).toBe(8);
  });
});
