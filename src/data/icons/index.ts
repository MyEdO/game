import { ICON_FAMILIES } from './_registry.generated';
import type { IconDef } from './types';

export type { IconDef, IconId, IconIdInput } from './types';

/** Registre à plat : id → def (unicité des ids garantie par icons.test.ts). Keyé `string` pour
 *  rester indexable par un id porté par la DONNÉE (`IconIdInput`) — l'absence est gérée par le
 *  rendu (throw DEV). */
export const ICON_DEFS: Record<string, IconDef> = Object.fromEntries(
  ICON_FAMILIES.flat().map((d) => [d.id, d]),
);
