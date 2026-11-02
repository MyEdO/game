import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ItemIcon } from './ItemIcon';
import { iconSvg } from './Icon';
import { itemFromTrappingById } from '../engine/items';
import type { ItemInstance, Weapon } from '../engine/types';

/** Objet minimal d'une catégorie donnée. */
const mk = (p: Partial<ItemInstance>): ItemInstance =>
  ({ uid: 'x', label: '?', kind: 'misc', qualities: [], enc: 0, equipped: false, ...p } as ItemInstance);

const html = (item: ItemInstance | Weapon) => renderToStaticMarkup(<ItemIcon item={item} />);

describe('ItemIcon : le glyphe de la catégorie de l’objet', () => {
  it('arme du catalogue → item/weapon', () => {
    expect(html(itemFromTrappingById('hallebarde')!)).toContain(iconSvg('item/weapon'));
  });

  it('arme de combat hors catalogue (`Weapon`) → item/weapon', () => {
    const w: Weapon = { label: 'Masse', type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: [] };
    expect(html(w)).toContain(iconSvg('item/weapon'));
  });

  it('bouclier → item/armour', () => {
    expect(html(itemFromTrappingById('bouclier')!)).toContain(iconSvg('item/armour'));
  });

  it('armure → item/armour', () => {
    expect(html(itemFromTrappingById('plastron')!)).toContain(iconSvg('item/armour'));
  });

  it('munition → item/ammo', () => {
    expect(html(mk({ kind: 'ammo', label: 'Flèches' }))).toContain(iconSvg('item/ammo'));
  });

  it('cape → item/cloak', () => {
    expect(html(itemFromTrappingById('cape')!)).toContain(iconSvg('item/cloak'));
  });

  it('consommable (Flow structuré) → item/consumable', () => {
    const potion = mk({ kind: 'misc', label: 'Potion de guérison', consumable: { kind: 'do', effect: { type: 'ops', ops: [{ op: 'heal', amount: { bonusOf: 'endurance' } }] } } });
    expect(html(potion)).toContain(iconSvg('item/consumable'));
  });

  it('objet divers → item/misc', () => {
    expect(html(mk({ kind: 'misc', label: 'Corde', desc: 'Trois mètres de corde.' }))).toContain(iconSvg('item/misc'));
  });
});
