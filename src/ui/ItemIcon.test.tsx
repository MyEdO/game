import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ItemIcon } from './ItemIcon';
import { iconSvg } from './Icon';
import { itemFromTrappingById } from '../engine/items';
import type { ItemInstance, Weapon } from '../engine/types';

/** Objet minimal (catégories sans art : munition/cape/consommable/divers). */
const mk = (p: Partial<ItemInstance>): ItemInstance =>
  ({ uid: 'x', label: '?', kind: 'misc', qualities: [], enc: 0, equipped: false, ...p } as ItemInstance);

const html = (item: ItemInstance) => renderToStaticMarkup(<ItemIcon item={item} />);

describe('ItemIcon', () => {
  it('arme du registre (tokenisée) : SVG en diagonale, sans <defs>', () => {
    const h = html(itemFromTrappingById('hallebarde')!);
    expect(h).toContain('item-icon-weapon');
    expect(h).toContain('rotate(-40)'); // arme en diagonale
    expect(h).not.toContain('<defs'); // art tokenisé hex → pas de gradient
  });

  it('arme générique hors-catalogue (Weapon directe) : repli avec gradient → <defs> injecté', () => {
    const w: Weapon = { label: 'Masse', type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: [] }; // synonyme → art de repli url(#g_steelD)
    const h = renderToStaticMarkup(<ItemIcon item={w} />);
    expect(h).toContain('item-icon-weapon');
    expect(h).toContain('<defs');
  });

  it('armure : SVG droit (pas de rotation), classe armor', () => {
    const h = html(itemFromTrappingById('plastron')!);
    expect(h).toContain('item-icon-armor');
    expect(h).not.toContain('rotate(-40)');
  });

  it('munition → icône item/ammo', () => {
    expect(html(mk({ kind: 'ammo', label: 'Flèches' }))).toContain(iconSvg('item/ammo'));
  });

  it('cape → icône item/cloak', () => {
    expect(html(mk({ kind: 'misc', label: 'Cape', trappingId: 'cape' }))).toContain(iconSvg('item/cloak'));
  });

  it('consommable (Flow structuré) → icône item/consumable', () => {
    const potion = mk({ kind: 'misc', label: 'Potion de guérison', consumable: { kind: 'do', effect: { type: 'ops', ops: [{ op: 'heal', amount: { bonusOf: 'endurance' } }] } } });
    expect(html(potion)).toContain(iconSvg('item/consumable'));
  });

  it('objet divers → icône item/misc', () => {
    expect(html(mk({ kind: 'misc', label: 'Corde', desc: 'Trois mètres de corde.' }))).toContain(iconSvg('item/misc'));
  });

  it('rend en SSR sans getBBox (repli viewBox, aucune exception)', () => {
    expect(() => html(itemFromTrappingById('hallebarde')!)).not.toThrow();
  });

  it('objet sans porteur (coup-de-poing) : chair du porteur par défaut, aucun jeton `@` rendu (#1903 D2)', () => {
    const poing: Weapon = { label: 'Coup-de-poing', type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: [], shape: 'poing' };
    const out = renderToStaticMarkup(<ItemIcon item={poing} />);
    expect(out).not.toMatch(/@[a-zA-Z]/);
    expect(out).toContain('url(#dg-v-ffd4a5-b08c6d)');
  });
});
