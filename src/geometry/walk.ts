/**
 * Interpolation temporelle d'un déplacement le long d'un chemin de tuiles — géométrie/simulation PURE
 * (#161 : hors du foyer `gameIso` car `noyau/combatDirector` en a besoin pour
 * CADENCER la résolution du combat, pas seulement pour l'afficher — cf. `docs/architecture.md`).
 */
export interface Pt { x: number; y: number }

/**
 * Position FRACTIONNAIRE le long de `path` à `elapsed` ms, `stepMs` par tuile.
 * Permet au token de GLISSER tuile par tuile (marche) au lieu de se téléporter à la fin.
 */
export function walkXY(path: Pt[], elapsed: number, stepMs: number): Pt {
  if (!path || path.length === 0) return { x: 0, y: 0 };
  const total = (path.length - 1) * stepMs;
  if (path.length === 1 || elapsed >= total) return path[path.length - 1];
  if (elapsed <= 0) return path[0];
  const seg = Math.floor(elapsed / stepMs);
  const f = (elapsed - seg * stepMs) / stepMs;
  const a = path[seg];
  const b = path[seg + 1];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

/** Durée totale du parcours (ms). */
export function walkDuration(path: Pt[], stepMs: number): number {
  return Math.max(0, (path.length - 1) * stepMs);
}

/** Durée d'un pas de marche (ms) — SOURCE UNIQUE partagée par le rendu du monde ET le
 *  séquencement du combat (combatFlow/combatDirector), pour que la résolution attende la fin réelle du déplacement. */
export const STEP_MS = 160;

/** Durée totale d'un déplacement avec le pas standard. */
export function walkMs(path: Pt[]): number {
  return walkDuration(path, STEP_MS);
}
