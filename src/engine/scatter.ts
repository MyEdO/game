/** Dispersion — LDB 14 l.142-151, table `dispersion.json` (dé `die`). PUR : RNG injecté. */
import { RNG, d10, rollDice } from './dice';
import { chebyshev } from './grid';
import { findTableEntry } from './tables';
import dispersionJson from '../data/dispersion.json';
import { deDeTirageDe, rangeesDe, type RangeeDe } from '../data/rangees';
import type * as dispersion from '../data/schemas/defs/dispersion';

export interface Pt {
  x: number;
  y: number;
}

/** Le Diagramme de Dispersion VIVANT — la collection que le Codex édite (`dispersion`, `data/overrides.ts`). */
type LigneDeDispersion = RangeeDe<typeof dispersion>;
export const TABLE_DE_DISPERSION: LigneDeDispersion[] = rangeesDe<typeof dispersion>(dispersionJson);

/**
 * Tuile d'atterrissage d'une Dispersion (LDB 14 l.142-151). `from` = lanceur, `to` = cible,
 * `metresPerTile` = échelle de la scène ; `bounds` borne à la carte, sans bornes plancher 0.
 */
export function scatter(from: Pt, to: Pt, rng: RNG, metresPerTile: number, bounds?: { w: number; h: number }): Pt {
  const clamp = (p: Pt): Pt => ({
    x: Math.max(0, bounds ? Math.min(bounds.w - 1, p.x) : p.x),
    y: Math.max(0, bounds ? Math.min(bounds.h - 1, p.y) : p.y),
  });
  const rangee = findTableEntry(TABLE_DE_DISPERSION, rollDice(deDeTirageDe<typeof dispersion>(dispersionJson), rng));
  const origine = rangee.depuis === 'lanceur' ? from : to;
  if (rangee.dx === 0 && rangee.dy === 0) return clamp({ x: origine.x, y: origine.y });
  const halfM = (chebyshev(from, to) * metresPerTile) / 2;
  const distM = Math.min(d10(rng) + d10(rng), halfM);
  const distTiles = Math.max(0, Math.round(distM / metresPerTile));
  return clamp({ x: origine.x + rangee.dx * distTiles, y: origine.y + rangee.dy * distTiles });
}
