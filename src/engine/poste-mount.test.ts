import { describe, it, expect } from 'vitest';
import { recomputeLoadout, emptyArmour } from './items';
import type { Combatant, ItemInstance } from './types';

/**
 * Un poste d'artillerie monte une arme sur un servant via le chemin d'équipement NORMAL : l'`ItemInstance`
 * (base + qualités/enchants par instance) porte un `mountSide`, et `recomputeLoadout` le propage à l'arme
 * active dérivée (`Weapon.mountSide`) — lu ensuite par la validation d'arc de tir. (MDG 12-13)
 */
const gunItem: ItemInstance = {
  uid: 'gun1', trappingId: 'pierrier', label: 'Pierrier', kind: 'ranged',
  damage: { plusBF: false, flat: 14 }, range: 30,
  qualities: [{ id: 'dangereuse' }, { id: 'recharge', value: 4 }],
  enc: 5, equipped: true, mountSide: 'tribord',
};

const gunner = (): Combatant =>
  ({
    id: 'cap', name: 'Chef de pièce', kind: 'enemy',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], talents: [], skills: [],
    armour: emptyArmour(), movement: 4, items: [{ ...gunItem }],
  }) as unknown as Combatant;

describe('recomputeLoadout — propage mountSide de l’ItemInstance à l’arme active', () => {
  it('un canon monté à tribord → l’arme à distance active porte mountSide:tribord', () => {
    const c = gunner();
    recomputeLoadout(c);
    const w = c.weapons.find((w) => w.uid === 'gun1');
    expect(w).toBeDefined();
    expect(w?.mountSide).toBe('tribord');
  });

  it('une arme NON montée n’a pas de mountSide (régression : champ optionnel)', () => {
    const c = gunner();
    c.items = [{ ...gunItem, uid: 'gun2', mountSide: undefined }];
    recomputeLoadout(c);
    expect(c.weapons.find((w) => w.uid === 'gun2')?.mountSide).toBeUndefined();
  });
});

describe('recomputeLoadout — SERVIR un poste (mannedPoste) : canon dérivé, taguée mountSide, HORS inventaire', () => {
  it('le chef de pièce qui sert un poste reçoit le canon en arme active (côté du POSTE), pas dans ses items', () => {
    const c = gunner();
    c.items = []; // aucune arme en inventaire — le canon vient du poste, pas du sac
    // Le CHEF est `crewIds[0]` (RAW AA 10 l.230 : « ils nomment l'un d'entre eux pour effectuer le Test ») — seul lui
    // dérive l'arme de tir (les membres SUPPORT occupent la pièce sans la tirer).
    c.mannedPoste = { item: { ...gunItem, uid: 'cannon', mountSide: undefined }, side: 'babord', crewIds: ['cap'] };
    recomputeLoadout(c);
    const w = c.weapons.find((w) => w.uid === 'cannon');
    expect(w).toBeDefined();
    expect(w?.mountSide).toBe('babord'); // le côté vient du POSTE (mannedPoste.side), pas de l'item
    expect((c.items ?? []).some((i) => i.uid === 'cannon')).toBe(false); // le canon n'est PAS un objet d'inventaire
  });
});
