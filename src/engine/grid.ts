/**
 * Métriques PURES de la grille carrée — foyer moteur, sans aucune dépendance (module feuille).
 *
 * Le moteur (`scatter`), le store (`path`, `vision`, IA, combat) et le rendu mesurent tous des
 * distances de cases : elles vivent ICI, jamais recopiées au site. Règle 3 (AGENTS.md) : `src/engine`
 * ne dépend pas de `src/state` — c'est donc le moteur qui porte la primitive et `noyau/monde/path` qui la
 * consomme, pas l'inverse.
 */

/** Point de grille. Métrique PLANE : l'empilement `z` d'une scène ne participe pas à la distance
 *  (la verticale se mesure à part, `verticalTiles`), d'où les seuls `x`/`y` requis ici. */
export interface GridPt {
  x: number;
  y: number;
}

/** Distance « roi d'échecs » (Chebyshev) sur la grille carrée : la diagonale vaut 1.
 *  C'est la distance de COMBAT (portée de mêlée, bandes de tir) — un ennemi en diagonale
 *  est à portée de contact. Le DÉPLACEMENT suit la MÊME métrique (grille 8-connexe,
 *  cf. `NEIGHBORS` de `noyau/monde/path`) : une diagonale = 1 pas → portée et déplacement s'accordent. */
export function chebyshev(a: GridPt, b: GridPt): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
