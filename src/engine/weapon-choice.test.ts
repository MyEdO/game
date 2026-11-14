import { describe, it, expect } from 'vitest';
import { canFireWhileEngaged, attackWeapon, assertAttackWeapon } from './combat';
import { Weapon } from './types';

const arbalete: Weapon = { label: 'Arbalète', type: 'distance', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [] };
const pistolet: Weapon = { label: 'Pistolet', type: 'distance', damage: { plusBF: false, flat: 8 }, range: 20, qualities: [{ id: 'pistolet' }, { id: 'recharge' }] };
const epee: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };

describe('canFireWhileEngaged — Atout Pistolet (LDB Armes l.297-298)', () => {
  it('seule une arme à distance « Pistolet » tire en Combat rapproché', () => {
    expect(canFireWhileEngaged(pistolet)).toBe(true);
    expect(canFireWhileEngaged(arbalete)).toBe(false); // arbalète : pas de tir en mêlée
    expect(canFireWhileEngaged(epee)).toBe(false); // mêlée, pas concernée
  });
});

describe('attackWeapon — choisit l’arme selon la distance', () => {
  it('cible au contact : privilégie l’arme de MÊLÉE (Knud : Épée, pas l’Arbalète)', () => {
    expect(attackWeapon([arbalete, epee], true)).toBe(epee);
  });
  it('cible au contact, pas d’arme de mêlée mais un Pistolet : tir à bout portant autorisé', () => {
    expect(attackWeapon([pistolet], true)).toBe(pistolet);
  });
  it('cible au contact, arme à distance simple seule : dernier recours = weapons[0]', () => {
    expect(attackWeapon([arbalete], true)).toBe(arbalete);
  });
  it('cible distante : privilégie l’arme à DISTANCE', () => {
    expect(attackWeapon([epee, arbalete], false)).toBe(arbalete);
  });
  it('tableau vide (structure/décor sans arme) : undefined, jamais un crash (#203 régression écran noir)', () => {
    expect(attackWeapon([], true)).toBeUndefined();
    expect(attackWeapon([], false)).toBeUndefined();
  });
});

describe('assertAttackWeapon — garde explicite de l’invariant « un attaquant a toujours une arme »', () => {
  it('délègue à attackWeapon quand une arme existe', () => {
    expect(assertAttackWeapon([epee, arbalete], false)).toBe(arbalete);
  });
  it('échoue fort (jamais un cast silencieux) si l’invariant mains-nues est violé', () => {
    expect(() => assertAttackWeapon([], true)).toThrow();
  });
});
