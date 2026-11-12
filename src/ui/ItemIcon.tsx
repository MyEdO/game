/**
 * Icône d'OBJET — primitive UNIQUE pour afficher un objet ou une arme par le glyphe de sa catégorie.
 * Réutilisée par le Sac, l'onglet Combat de la fiche, les pickers `MediaSelect` et la hotbar de combat.
 */
import type { Weapon } from '../engine/types';
import { isCapeItem, isShieldItem, type GabaritDObjet } from '../engine/items';
import { isConsumable } from '../engine/consumables';
import { Icon } from './Icon';
import type { IconId } from '../data/icons';

/** Id d'icône de catégorie (registre src/data/icons, famille item/*). */
function glyphe(item: GabaritDObjet | Weapon): IconId {
  if ('kind' in item) {
    if (item.kind === 'armor') return 'objet/armure';
    if (item.kind === 'melee' || item.kind === 'distance') return isShieldItem(item) ? 'objet/armure' : 'objet/arme';
    if (item.kind === 'ammo') return 'objet/munition';
    if (isCapeItem(item)) return 'objet/cape';
    if (isConsumable(item)) return 'objet/consommable';
    return 'objet/divers';
  }
  // `Weapon` (combat) : pas de champ `kind` — discriminant de l'union.
  return isShieldItem(item) ? 'objet/armure' : 'objet/arme';
}

const SIZE_PX = { sm: 24, md: 40, lg: 64 } as const;
type SizeKey = keyof typeof SIZE_PX;

export function ItemIcon({ item, size = 'sm' }: { item: GabaritDObjet | Weapon; size?: number | SizeKey }) {
  const px = typeof size === 'number' ? size : SIZE_PX[size];
  return (
    <span className="item-icon item-icon-glyph" style={{ width: px, height: px, lineHeight: `${px}px` }} aria-hidden>
      <Icon id={glyphe(item)} size={Math.round(px * 0.72)} />
    </span>
  );
}
