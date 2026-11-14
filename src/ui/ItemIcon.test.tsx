import { idsDeTest } from '../engine/idsDeTest.testkit';
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
  it('arme du catalogue → objet/arme', () => {
    expect(html(itemFromTrappingById('hallebarde', idsDeTest)!)).toContain(iconSvg('objet/arme'));
  });

  it('arme de combat hors catalogue (`Weapon`) → objet/arme', () => {
    const w: Weapon = { label: 'Masse', type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: [] };
    expect(html(w)).toContain(iconSvg('objet/arme'));
  });

  it('bouclier → objet/armure', () => {
    expect(html(itemFromTrappingById('bouclier', idsDeTest)!)).toContain(iconSvg('objet/armure'));
  });

  it('armure → objet/armure', () => {
    expect(html(itemFromTrappingById('plastron', idsDeTest)!)).toContain(iconSvg('objet/armure'));
  });

  it('munition → objet/munition', () => {
    expect(html(mk({ kind: 'ammo', label: 'Flèches' }))).toContain(iconSvg('objet/munition'));
  });

  it('cape → objet/cape', () => {
    expect(html(itemFromTrappingById('cape', idsDeTest)!)).toContain(iconSvg('objet/cape'));
  });

  it('consommable (Flow du catalogue) → objet/consommable', () => {
    const potion = mk({ kind: 'misc', label: 'Potion de guérison', trappingId: 'potion-de-guerison' }); // Flow lu au catalogue
    expect(html(potion)).toContain(iconSvg('objet/consommable'));
  });

  it('objet divers → objet/divers', () => {
    expect(html(mk({ kind: 'misc', label: 'Corde', desc: 'Trois mètres de corde.' }))).toContain(iconSvg('objet/divers'));
  });
});
