/**
 * Résolveur de CAPACITÉS d'objet (`engine/capabilities`) — canal `capabilities` unifié, lu PAR ID dans
 * le catalogue (trappingId), MÊME logique cross-source que traits/qualités/maladies. Vérifie les DEUX
 * natures de lecture :
 *  - `itemCapability(it, cap)` : par-OBJET, NON gatée sur le port (ration/grimoire dans le sac comptent) ;
 *  - `hasCapability(c, cap)` : agrégat par-PERSONNAGE, GATÉ sur le port pour les objets (cape PORTÉE,
 *    gantelet TENU).
 * Comportement RAW préservé : gantelet porté → anti-lâcher ; cape portée → pas de malus de froid.
 */
import { describe, it, expect } from 'vitest';
import { itemCapability, hasCapability } from './capabilities';
import { armeInvoquee, itemFromTrappingById } from './items';
import type { Combatant, ItemInstance, Weapon } from './types';
import { objetDeTest, type SurchargeDObjet } from './objetDeTest.testkit';

const item = (uid: string, trappingId: string, extra: SurchargeDObjet = {}): ItemInstance =>
  objetDeTest({ uid, trappingId, kind: 'misc', qualities: [], enc: 0, equipped: false, ...extra });

/** Combattant minimal porteur d'un inventaire (et d'un loadout actif `weapons` pour la garde TENU). */
const carrier = (items: ItemInstance[], weapons: Weapon[] = []): Combatant =>
  ({ id: 'c', name: 'Porteur', items, weapons } as unknown as Combatant);

describe('itemCapability — lecture par-OBJET (catalogue, NON gatée sur le port)', () => {
  it('reconnaît la capacité au trappingId, quel que soit equipped', () => {
    // Ration / grimoire dans le sac (equipped:false) : la capacité par-objet répond VRAI (on mange/lit
    // depuis le sac — pas de gating).
    expect(itemCapability(item('r', 'ration'), 'isRations')).toBe(true);
    expect(itemCapability(item('g', 'grimoire'), 'isGrimoire')).toBe(true);
    expect(itemCapability(item('cap', 'cape'), 'weatherProtection')).toBe(true);
    expect(itemCapability(item('t', 'tente'), 'isShelter')).toBe(true);
  });

  it('false pour une autre capacité ou un autre trapping', () => {
    expect(itemCapability(item('r', 'ration'), 'isGrimoire')).toBe(false);
    expect(itemCapability(item('cap', 'cape'), 'isRations')).toBe(false);
  });
});

describe('itemCapability — une arme INVOQUÉE n’a aucune capacité, quelle que soit sa forme', () => {
  it('l’arme invoquée sous la forme du Poing de fer n’en hérite pas l’immunité au désarmement', () => {
    expect(itemCapability(itemFromTrappingById('poing-de-fer')!, 'disarmImmune'), 'non-vacuité : l’objet du catalogue la porte').toBe(true);
    const invoquee = armeInvoquee({ type: 'melee', damage: { plusBF: true, flat: 0 }, source: { kind: 'spell', id: 'arme-aethyrique' }, form: 'poing-de-fer' });
    expect(itemCapability(invoquee, 'disarmImmune')).toBe(false);
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
