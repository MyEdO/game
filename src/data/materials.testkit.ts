import { materials } from './index';
import type { MaterialEntry } from './materials.types';

/** Le document des matières, cloné puis retouché entrée par entrée — jamais une liste écrite à la main. */
export function editees(patch: (e: MaterialEntry) => MaterialEntry): MaterialEntry[] {
  return materials.map((e) => patch(structuredClone(e)));
}
