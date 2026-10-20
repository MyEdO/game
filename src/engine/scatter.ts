/**
 * Dispersion d'une arme de jet ratée — LDB 13-Combat `14 - _GoBack.md` l.144-151 (verbatim) :
 *
 * « Sur un échec à un Test de Projectiles (Lancer), lancez 1d10 et consultez le diagramme ci-dessous
 *   pour voir où votre arme atterrit. « T » indique la cible. […] Un résultat de 1 à 8 vous indique une
 *   direction : lancez 2d10 pour déterminer la distance en mètres à laquelle l'arme arrive – sans
 *   dépasser la moitié de la distance entre vous et la cible. Un résultat de 9 indique que l'arme
 *   atterrit à vos pieds. Un résultat de 10 indique que c'est aux pieds de votre cible. La Dispersion
 *   peut être utilisée à chaque fois qu'une direction aléatoire est requise. »
 *
 * Diagramme 3×3 (offsets depuis la cible T au centre, l.146-149) :
 *   1=(-1,-1) 2=(0,-1) 3=(+1,-1) | 4=(-1,0) T 5=(+1,0) | 6=(-1,+1) 7=(0,+1) 8=(+1,+1)
 *
 * PRIMITIVE PURE et réutilisable (« peut être utilisée à chaque fois qu'une direction aléatoire est
 * requise ») : RNG injecté, aucun effet de bord. Le câblage (FX/journal) vit dans `noyau/combatFlow`.
 */
import { RNG, d10 } from './dice';
import { chebyshev } from './grid';

export interface Pt {
  x: number;
  y: number;
}

/** Offsets du diagramme de Dispersion (depuis la tuile cible), indexés par le 1d10 de direction (1..8). */
const SCATTER_DIRS: Record<number, Pt> = {
  1: { x: -1, y: -1 }, 2: { x: 0, y: -1 }, 3: { x: 1, y: -1 },
  4: { x: -1, y: 0 }, /*       T        */ 5: { x: 1, y: 0 },
  6: { x: -1, y: 1 }, 7: { x: 0, y: 1 }, 8: { x: 1, y: 1 },
};

/**
 * Tuile d'atterrissage d'une arme de jet ratée (LDB 14 l.144-151). PURE.
 *
 * - `from` = pieds du lanceur ; `to` = pieds de la cible. `metresPerTile` = échelle de la scène.
 * - 1d10 : `9` → `from` (pieds du lanceur) ; `10` → `to` (pieds de la cible) ; `1..8` → direction du
 *   diagramme, distance = `min(2d10, demi-distance)` mètres (demi-distance = moitié de la distance
 *   lanceur↔cible, plafond RAW), convertie en tuiles (`round(distM / metresPerTile)`).
 * - `bounds` (optionnel) borne le résultat à la carte (`[0, w-1] × [0, h-1]`) ; sans bornes, plancher 0.
 */
export function scatter(from: Pt, to: Pt, rng: RNG, metresPerTile: number, bounds?: { w: number; h: number }): Pt {
  const clamp = (p: Pt): Pt => ({
    x: Math.max(0, bounds ? Math.min(bounds.w - 1, p.x) : p.x),
    y: Math.max(0, bounds ? Math.min(bounds.h - 1, p.y) : p.y),
  });
  const dir = d10(rng); // 1d10 de DIRECTION en premier (l.144)
  if (dir === 9) return clamp({ x: from.x, y: from.y }); // pieds du lanceur (l.151)
  if (dir === 10) return clamp({ x: to.x, y: to.y }); // pieds de la cible (l.151)
  const off = SCATTER_DIRS[dir];
  // Distance EN MÈTRES : 2d10 « sans dépasser la moitié de la distance entre vous et la cible » (l.151).
  const halfM = (chebyshev(from, to) * metresPerTile) / 2;
  const distM = Math.min(d10(rng) + d10(rng), halfM);
  const distTiles = Math.max(0, Math.round(distM / metresPerTile));
  return clamp({ x: to.x + off.x * distTiles, y: to.y + off.y * distTiles });
}
