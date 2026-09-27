import type { MerchantArchetypeDef } from './types';
import { MERCHANT_ARCHETYPES } from '../../data';

export type { MerchantArchetypeDef } from './types';
export { MERCHANT_ARCHETYPES };

/** Lookup par clé `id` (table dérivée du registre — pas à maintenir à la main). */
export const MERCHANTS: Record<string, MerchantArchetypeDef> = Object.fromEntries(
  MERCHANT_ARCHETYPES.map((m) => [m.id, m]),
);
