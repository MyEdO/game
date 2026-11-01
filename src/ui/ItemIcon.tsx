/**
 * Icône d'OBJET — primitive UNIQUE pour afficher un objet ou une arme par le glyphe de sa catégorie.
 * Réutilisée par le Sac, l'onglet Combat de la fiche, les pickers `MediaSelect` et la hotbar de combat.
 */
import type { ItemInstance, Weapon } from '../engine/types';
import { isCapeItem, isShieldItem } from '../engine/items';
import { isConsumable } from '../engine/consumables';
import { Icon } from './Icon';
import type { IconId } from './icons';

/** Id d'icône de catégorie (registre src/ui/icons, famille item/*). */
function glyphe(item: ItemInstance | Weapon): IconId {
  if ('kind' in item) {
    if (item.kind === 'armor') return 'item/armour';
    if (item.kind === 'melee' || item.kind === 'ranged') return isShieldItem(item) ? 'item/armour' : 'item/weapon';
    if (item.kind === 'ammo') return 'item/ammo';
    if (isCapeItem(item)) return 'item/cloak';
    if (isConsumable(item)) return 'item/consumable';
    return 'item/misc';
  }
  // `Weapon` (combat) : pas de champ `kind` — discriminant de l'union.
  return isShieldItem(item) ? 'item/armour' : 'item/weapon';
}

const SIZE_PX = { sm: 24, md: 40, lg: 64 } as const;
type SizeKey = keyof typeof SIZE_PX;

export function ItemIcon({ item, size = 'sm' }: { item: ItemInstance | Weapon; size?: number | SizeKey }) {
  const px = typeof size === 'number' ? size : SIZE_PX[size];
  return (
    <span className="item-icon item-icon-glyph" style={{ width: px, height: px, lineHeight: `${px}px` }} aria-hidden>
      <Icon id={glyphe(item)} size={Math.round(px * 0.72)} />
    </span>
  );
}
