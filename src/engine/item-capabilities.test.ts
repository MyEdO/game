/**
 * Résolveur de CAPACITÉS d'objet (`engine/capabilities`) — canal intrinsèque `capabilities`.
 * Vérifie les DEUX
 * natures de lecture :
 *  - `itemCapability(it, cap)` : par-OBJET, NON gatée sur le port (ration/grimoire dans le sac comptent) ;
 *  - `hasCapability(c, cap)` : agrégat par-PERSONNAGE, GATÉ sur le port pour les objets (cape PORTÉE,
 *    gantelet TENU).
 * Comportement RAW préservé : gantelet porté → anti-lâcher ; cape portée → pas de malus de froid.
 */
import { describe, it, expect } from 'vitest';
import { itemCapability, hasCapability } from './capabilities';
import { customTrapping, itemFromTrappingById } from './items';
import type { Combatant, ItemInstance, Weapon } from './types';

const item = (uid: string, trappingId: string | undefined, extra: Partial<ItemInstance> = {}): ItemInstance =>
  ({ ...(trappingId ? itemFromTrappingById(trappingId)! : customTrapping(uid)), uid, ...extra });

/** Combattant minimal porteur d'un inventaire (et d'un loadout actif `weapons` pour la garde TENU). */
const carrier = (items: ItemInstance[], weapons: Weapon[] = []): Combatant =>
  ({ id: 'c', name: 'Porteur', items, weapons } as unknown as Combatant);

describe('itemCapability — lecture par-OBJET NON gatée sur le port', () => {
  it('reconnaît la capacité née sur l’objet, quel que soit equipped', () => {
    // Ration / grimoire dans le sac (equipped:false) : la capacité par-objet répond VRAI (on mange/lit
    // depuis le sac — pas de gating).
    expect(itemCapability(item('r', 'ration'), 'isRations')).toBe(true);
    expect(itemCapability(item('g', 'grimoire'), 'isGrimoire')).toBe(true);
    expect(itemCapability(item('cap', 'cape'), 'weatherProtection')).toBe(true);
    expect(itemCapability(item('t', 'tente'), 'isShelter')).toBe(true);
  });

  it('false pour une autre capacité, un autre trapping, ou un objet custom (sans trappingId)', () => {
    expect(itemCapability(item('r', 'ration'), 'isGrimoire')).toBe(false);
    expect(itemCapability(item('cap', 'cape'), 'isRations')).toBe(false);
    expect(itemCapability(item('x', undefined), 'isRations')).toBe(false); // custom : aucune capacité
  });
});

describe('hasCapability — agrégat par-PERSONNAGE, GATÉ sur le port pour les objets', () => {
  it('weatherProtection : cape PORTÉE → vrai ; cape NON portée → faux', () => {
    const cape = item('cap', 'cape', { equipped: true });
    expect(hasCapability(carrier([cape]), 'weatherProtection')).toBe(true);
    cape.equipped = false;
    expect(hasCapability(carrier([cape]), 'weatherProtection')).toBe(false);
  });

  it('preventForcedDrop : gantelet PORTÉ (equipped) → vrai ; rangé → faux', () => {
    const gauntlet = item('g1', 'gantelet-verrouille', { kind: 'melee', equipped: true });
    expect(hasCapability(carrier([gauntlet]), 'preventForcedDrop')).toBe(true);
    gauntlet.equipped = false;
    expect(hasCapability(carrier([gauntlet]), 'preventForcedDrop')).toBe(false);
  });

  it('preventForcedDrop : gantelet TENU (uid dans c.weapons) → vrai même sans equipped', () => {
    const gauntlet = item('g1', 'gantelet-verrouille', { kind: 'melee', equipped: false });
    const held = carrier([gauntlet], [{ uid: 'g1', label: 'Gantelet verrouillé' } as Weapon]);
    expect(hasCapability(held, 'preventForcedDrop')).toBe(true);
  });

  it('une capacité non portée par l’inventaire/les traits/les maladies → faux', () => {
    expect(hasCapability(carrier([item('r', 'ration', { equipped: true })]), 'preventForcedDrop')).toBe(false);
  });
});
