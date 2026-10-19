import { describe, it, expect } from 'vitest';
import { freeJumpTiles, maxJumpTiles, jumpNeedsTest } from './movement';

/**
 * Saut (LDB 15 l.76). Échelle du jeu = 2 m/case (précédent `resolveRun`). On saute LIBREMENT
 * de Mouvement/3 mètres → floor((M/3)/2) cases sans Test ; un Test d'Athlétisme étend d'UNE case
 * (incrément minimal de la grille pour « chaque DR rajoute 30 cm »). Au-delà = infranchissable.
 */
describe('règles de saut', () => {
  it('saut libre = floor((M/3)/2) cases (sans Test)', () => {
    expect(freeJumpTiles(4)).toBe(0); // 1,33 m < 1 case (2 m) → humain ne franchit aucun gouffre librement
    expect(freeJumpTiles(6)).toBe(1); // 2 m = 1 case
    expect(freeJumpTiles(12)).toBe(2); // 4 m = 2 cases
    expect(freeJumpTiles(0)).toBe(0);
  });

  it('saut MAX (avec le Test de `saut`) = libre + 1 case', () => {
    expect(maxJumpTiles(4)).toBe(1); // un humain peut TENTER 1 case (2 m) au prix d'un Test
    expect(maxJumpTiles(6)).toBe(2);
  });

  it('un saut exige un Test ssi sa distance dépasse le saut libre', () => {
    expect(jumpNeedsTest(4, 1)).toBe(true); // 1 case > libre(0)
    expect(jumpNeedsTest(6, 1)).toBe(false); // 1 case ≤ libre(1)
    expect(jumpNeedsTest(6, 2)).toBe(true); // 2 cases > libre(1)
  });
});
