import { findTrappingById, findVehicleById, type QualityRef } from '../data/index';
import { damageString } from '../engine/items';
import { mountProfileForCreature } from '../engine/mountTravel';
import { rangeSpecLabel, ammoRangeModLabel } from '../engine/weaponStats';
import type { WeaponDamageSpec, WeaponRangeSpec, AmmoRangeMod } from '../engine/types';
import { catalogEntryOf } from './merchantFlow';
import { libelleDeValeur } from '../data/schemas/grammaire/meta';
import { availabilitySchema } from '../data/schemas/grammaire/valeurs';
import type { IdDeColonneDuMarchand } from '../data/schemas/grammaire/vocabulaires';

/** Colonnes de stats par famille (tableau comparatif). `get` prend directement l'`id` de la ligne —
 *  chaque famille fait SON lookup (trapping ou catalogue généralisé), aucune résolution par défaut
 *  qui présumerait un trapping. */
type TrapRow = { damage?: WeaponDamageSpec | null; reach?: string | null; range?: WeaponRangeSpec | null; ammoRangeMod?: AmmoRangeMod | null; pa?: number | null; qualities?: QualityRef[] };
const DASH = '—';
const dmg = (t: TrapRow) => (t.damage ? damageString(t.damage) : DASH);
/** Colonne de trapping — résout la ligne PUIS applique `fn` (DASH si la ligne n'est pas un trapping). */
function trapCol(fn: (t: TrapRow) => string): (id: string) => string {
  return (id) => { const t = findTrappingById(id); return t ? fn(t) : DASH; };
}
/** Capacité de PORT d'une unité (#619 Lot A) — Enc portée EDOC 07 (monture) ou Chargement LDB 70/EDOC 07
 *  (véhicule terrestre) ; DASH si non chiffré. */
function unitCapacity(id: string): string {
  const unit = catalogEntryOf(id)?.unit;
  if (!unit) return DASH;
  if (unit.kind === 'bete') { const p = mountProfileForCreature(unit.id); return p ? `M ${p.m} / Enc ${p.encPortee}` : DASH; }
  const v = findVehicleById(unit.id);
  return v?.chargement != null ? `Chargement ${v.chargement}` : DASH;
}
/** Le rendu de chaque colonne de stats du vocabulaire `colonnesDuMarchand` (`merchantFamilies.json › columns`),
 *  lu par le panneau du marchand. */
export const MERCHANT_COL_RENDERERS: Record<IdDeColonneDuMarchand, { get: (id: string) => string }> = {
  damage: { get: trapCol(dmg) },
  reach: { get: trapCol((t) => t.reach || DASH) },
  // « N m » fixe / « BF×k m » jet ; sinon modificateur de munition (« ×½ »)
  range: { get: trapCol((t) => rangeSpecLabel(t.range) ?? (ammoRangeModLabel(t.ammoRangeMod) || DASH)) },
  protection: { get: trapCol((t) => { const q = (t.qualities ?? []).find((x) => x.id === 'protectrice'); return q ? `Protectrice ${q.value ?? ''}`.trim() : DASH; }) },
  pa: { get: trapCol((t) => (t.pa != null ? String(t.pa) : DASH)) },
  availability: { get: (id) => { const av = catalogEntryOf(id)?.availability; return av ? libelleDeValeur(availabilitySchema, av) : DASH; } },
  capacity: { get: unitCapacity },
};
