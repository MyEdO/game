/**
 * PORTEUR d'objets (#614, #620) : un héros ou une possession, qui porte des `ItemInstance[]` sous les
 * mêmes sémantiques (`equipped`, `inside`, contenants). Le state le résout par id (`resolveCarrier`,
 * `src/state/carrier.ts`) ; le moteur y place les objets et les y fait entrer (`src/engine/items.ts`).
 */
import type { Combatant, ItemInstance } from './types';
import type { Possession } from './possession';

export type Carrier = { kind: 'hero'; hero: Combatant } | { kind: 'possession'; possession: Possession };

/** Le héros vu comme porteur. */
export function heroCarrier(hero: Combatant): Carrier {
  return { kind: 'hero', hero };
}

/** Objets d'un porteur, en lecture : la liste ne s'étend que par `receiveItems` (`src/engine/items.ts`). */
export function carrierItems(p: Carrier): readonly ItemInstance[] {
  return p.kind === 'hero' ? (p.hero.items ?? []) : p.possession.items;
}
