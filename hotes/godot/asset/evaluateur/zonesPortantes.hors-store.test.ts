// Les zones qui portent un emplacement (#4351) : par os de la base, la zone du corps qu'il tient, puis ses voisines.
import { describe, expect, it } from 'vitest';
import { glb, type Piece, type Point } from './gardes/pieces.testkit.ts';
import { zonesPortantesDeLaBase } from './zonesPortantes.ts';

/** Un tronçon carré de 0,2 m de côté entre les hauteurs `bas` et `haut`, de zone `zone` : le kit skinne ses sommets à
 *  `pied` sous 0,5 m, à `jambe` au-dessus. */
function troncon(nom: string, zone: string, bas: number, haut: number): Piece {
  const sommets = [bas, haut].flatMap((y) => [[-0.1, -0.1], [0.1, -0.1], [0.1, 0.1], [-0.1, 0.1]].map(([x, z]): Point => [x, y, z]));
  return { nom, zone, sommets, triangles: [0, 1, 2, 3].flatMap((k) => [k, (k + 1) % 4, k + 4, (k + 1) % 4, (k + 1) % 4 + 4, k + 4]) };
}

describe('zonesPortantesDeLaBase', () => {
  it('un os tient la zone où il pèse le plus ; elle est suivie des zones qui la touchent au repos', async () => {
    const base = glb([troncon('haut', 'cuisse', 0.5, 1), troncon('bas', 'pied', 0, 0.5), troncon('loin', 'tete', 2, 2.1)]);
    expect(await zonesPortantesDeLaBase(base)).toEqual({ jambe: ['cuisse', 'pied'], pied: ['pied', 'cuisse'] });
  });

  it('une base sans zone n’en porte aucune', async () => {
    const { zone: _zone, ...sansZone } = troncon('corps', 'cuisse', 0.5, 1);
    expect(await zonesPortantesDeLaBase(glb([sansZone]))).toEqual({});
  });
});
