import { SLOTS, type Slot } from '../palette';
import type { Palette } from '../../../engine/authoringAppearance';

/**
 * Tirage INDIVIDUEL déterministe dans les plages d'une race (`raceAppearance.json`, champ
 * `tirageIndividuel`) : la graine stable d'un individu choisit une teinte par emplacement listé. La
 * coiffure a UNE source, le resolver (`parts/resolve.ts`), qui la tire de la même graine.
 */

// Diviseur de graine PAR emplacement : décorrèle les tirages d'un même individu.
const BANDES: Record<Slot, number> = { peau: 3, cheveux: 13, yeux: 17, vet1: 19, vet2: 23, cuir: 29, metal: 31, corps: 37, accent: 41 };

const pick = (arr: string[], n: number): string => arr[((n % arr.length) + arr.length) % arr.length];

/** Une teinte par emplacement de `plages`, tirée par la graine. */
export function teintesTirees(seed: number, plages: Partial<Record<Slot, string[]>>): Palette {
  const out: Palette = {};
  for (const slot of SLOTS) {
    const plage = plages[slot];
    if (plage?.length) out[slot] = pick(plage, Math.floor(seed / BANDES[slot]));
  }
  return out;
}
