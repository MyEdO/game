import { describe, it, expect } from 'vitest';
import { weaponPart } from '../equipment';
import { type FormeDArme, armeDeDessin } from '../../../../noyau/equipementDessine';
import { tokensOf } from '../../palette';
import { gameOpSchema } from '../../../../data/schemas/grammaire/mecanique';
import { giveTrappingSchema } from '../../../../data/schemas/defs-scenes/effets';
import { applyOps, type GameOp } from '../../../../engine/ops';
import { desDuTest } from '../../../../engine/dice.testkit';
import { pregen, PREGEN } from '../../../../data/pregens';

const w = (forme: string, teinte?: string): FormeDArme => ({ type: 'melee', forme, ...(teinte ? { teinte } : {}) });

describe('teinte d’objet', () => {
  it('au défaut, l’art est résolu', () => {
    expect(tokensOf(weaponPart(w('epee_batarde')) as string)).toEqual([]);
  });
  it('grantWeapon transmet la teinte au rendu de l’arme active', () => {
    const op = gameOpSchema.parse({ op: 'grantWeapon', label: 'Arme aethyrique', damage: 6, form: 'epee-batarde', teinte: { id: 'aethyrique' } }) as GameOp;
    const c = pregen(PREGEN.soldat);
    applyOps(c, [op], { rng: desDuTest, label: 'Essai' });
    const arme = c.weapons.find((a) => a.teinte === 'aethyrique');
    expect(arme).toBeDefined();
    expect(c.items?.some((i) => i.teinte === 'aethyrique')).toBe(true);
    const art = weaponPart(armeDeDessin(arme!)) as string;
    expect(art.toLowerCase()).toContain('#8fd4ff');
  });
  it('une teinte inconnue ou d’un autre domaine est refusée aux portes', () => {
    for (const teinte of [{ id: 'inconnue' }, { id: 'bois-chene' }, { metal: '#8fd4ff' }, 'aethyrique']) {
      expect(gameOpSchema.safeParse({ op: 'grantWeapon', label: 'Arme', damage: 6, teinte }).success).toBe(false);
      expect(giveTrappingSchema.safeParse({ type: 'giveTrapping', trappingId: 'epee-batarde', teinte }).success).toBe(false);
    }
  });
  it('une teinte inconnue au rendu équivaut à une absence', () => {
    expect(weaponPart(w('dague', 'inconnue'))).toEqual(weaponPart(w('dague')));
  });
});
