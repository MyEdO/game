import { describe, it, expect } from 'vitest';
import { emptyScene, type Scene, type Terrain, type WallSeg } from '../noyau/monde/scene';
import { pathTo, walkNeighbors, reachable } from '../noyau/monde/path';

/**
 * GRILLE 8-CONNEXE — déplacement diagonal (LDB 15 « Déplacement » l.10-16 : la grille optionnelle
 * « compte les cases », aucune règle de diagonale → une diagonale = 1 case = 1 pas, Chebyshev). Source
 * UNIQUE de connectivité (`walkNeighbors`/`pathTo`/`reachable`) partagée explo + clic + POV + combat + IA.
 * La garde anti coupe-de-coin empêche de se faufiler en diagonale à travers un coin de mur / entre deux vides.
 */

const key = (p: { x: number; y: number; z?: number }) => `${p.x},${p.y},${p.z ?? 0}`;
const NO_BLOCK = { blocked: new Set<string>() };

/** Rend une case non-marchable (vide) sur la couche z0. `emptyScene` remplit d'herbe marchable partout. */
function voidTile(s: Scene, w: number, x: number, y: number) {
  s.layers[0].tiles[y * w + x] = 'vide' as Terrain;
}

describe('path — 8-connexe (déplacement diagonal)', () => {
  it('walkNeighbors sur sol ouvert renvoie 8 voisins (4 cardinaux + 4 diagonaux)', () => {
    const s = emptyScene('scene-test', 5, 5);
    const keys = new Set(walkNeighbors(s, { x: 2, y: 2 }).map(key));
    for (const k of ['3,2,0', '1,2,0', '2,3,0', '2,1,0']) expect(keys.has(k)).toBe(true); // cardinaux
    for (const k of ['3,3,0', '3,1,0', '1,3,0', '1,1,0']) expect(keys.has(k)).toBe(true); // diagonaux
    expect(keys.size).toBe(8);
  });

  it('pathTo prend le raccourci diagonal : (0,0)→(3,3) = 4 cases (Chebyshev), pas 7 (Manhattan)', () => {
    const path = pathTo(emptyScene('scene-test', 5, 5), { x: 0, y: 0 }, { x: 3, y: 3 }, NO_BLOCK);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(4); // départ + 3 pas diagonaux
  });

  it('reachable : la diagonale coûte 1 pas (distance = Chebyshev)', () => {
    const dist = reachable(emptyScene('scene-test', 7, 7), { x: 3, y: 3 }, 2, NO_BLOCK);
    expect(dist.get('4,4')).toBe(1); // diagonale adjacente = 1 pas
    expect(dist.get('5,5')).toBe(2); // 2 diagonales = 2 pas
    expect(dist.get('5,3')).toBe(2); // et le cardinal à 2 reste 2
  });
});

describe('path — garde anti coupe-de-coin', () => {
  it('une seule orthogonale flanquante VIDE suffit à interdire la diagonale', () => {
    const s = emptyScene('scene-test', 3, 3);
    voidTile(s, 3, 2, 1); // orthogonale (2,1) vide → interdit la diagonale (1,1)→(2,0) et (1,1)→(2,2)
    const keys = new Set(walkNeighbors(s, { x: 1, y: 1 }).map(key));
    expect(keys.has('2,0,0')).toBe(false);
    expect(keys.has('2,2,0')).toBe(false);
    expect(keys.has('1,0,0')).toBe(true); // la diagonale de l'autre côté (orthogonales libres) reste permise
  });

  it('un MUR sur une arête flanquante bloque la diagonale (coin de mur)', () => {
    const s = emptyScene('scene-test', 3, 3);
    s.walls = [{ x: 1, y: 1, side: 'E' } as WallSeg]; // arête E de (1,1) : entre (1,1) et (2,1)
    const keys = new Set(walkNeighbors(s, { x: 1, y: 1 }).map(key));
    expect(keys.has('2,1,0')).toBe(false); // le cardinal E est muré
    expect(keys.has('2,0,0')).toBe(false); // …donc pas de coupe diagonale par ce coin
    expect(keys.has('2,2,0')).toBe(false);
    expect(keys.has('0,0,0')).toBe(true);  // diagonale opposée (loin du mur) intacte
  });

  it("un MUR sur l'arête de la case CIBLE (2e jambe du L) bloque aussi la diagonale", () => {
    const s = emptyScene('scene-test', 4, 3);
    // D=(2,1) : arête N (entre (2,0)-(2,1)) et arête O (entre (1,1)-(2,1)) murées — les DEUX jambes
    // depuis p=(1,0) sont ouvertes en 1re jambe (A=(2,0), B=(1,1) libres depuis p), seule la 2e jambe
    // (flanc→cible) est murée : sans le fix, la diagonale (1,0)→(2,1) fuit à tort par ce coin.
    s.walls = [
      { x: 2, y: 1, side: 'N' } as WallSeg, // arête N de D : entre (2,0) et (2,1)
      { x: 1, y: 1, side: 'E' } as WallSeg, // arête O de D : entre (1,1) et (2,1)
    ];
    const keys = new Set(walkNeighbors(s, { x: 1, y: 0 }).map(key));
    expect(keys.has('2,0,0')).toBe(true); // 1re jambe A toujours ouverte (cardinal non muré)
    expect(keys.has('1,1,0')).toBe(true); // 1re jambe B toujours ouverte (cardinal non muré)
    expect(keys.has('2,1,0')).toBe(false); // la diagonale vers D reste interdite (2e jambe murée)
  });

  it("un MUR posé SEULEMENT à la couche D'ARRIVÉE (rampe cross-couche) bloque aussi la diagonale (#790)", () => {
    // p=(1,0,z0) → D=(2,1,z1) : A=(2,0) et B=(1,1) sont au sol z0 (1re jambe, inchangée). D est un
    // tablier z1 à hauteur 0 (identique au sol) → `surfaceLink` flat, la diagonale z0→z1 serait sinon
    // praticable. L'arête A→D (2e jambe) n'est murée QU'à z=1 (la couche CIBLE), jamais à z=0 : le garde
    // pré-#790 (évalué au seul z de DÉPART) ne la voit pas et laisse fuir la diagonale vers D@z1.
    const s = emptyScene('scene-test', 4, 3);
    const w = 4;
    const z1 = new Array(w * 3).fill('vide') as Terrain[];
    z1[1 * w + 2] = 'plancher'; // D=(2,1) walkable sur z1, hauteur 0 (défaut) = flat depuis z0
    s.layers.push({ z: 1, tiles: z1 });
    s.walls = [{ x: 2, y: 1, side: 'N', z: 1 } as WallSeg]; // arête A(2,0)→D(2,1), posée SEULEMENT à z=1
    const keys = new Set(walkNeighbors(s, { x: 1, y: 0 }).map(key));
    expect(keys.has('2,0,0')).toBe(true); // 1re jambe A (au sol z0, inchangée) toujours ouverte
    expect(keys.has('1,1,0')).toBe(true); // 1re jambe B (au sol z0, inchangée) toujours ouverte
    expect(keys.has('2,1,0')).toBe(true); // diagonale z0→z0 non affectée (l'arête ne porte que z=1)
    expect(keys.has('2,1,1')).toBe(false); // diagonale z0→z1 bloquée : coin scellé par l'arête CIBLE
  });

  it('une pièce close par arêtes murées a des coins étanches (aucune fuite diagonale)', () => {
    const s = emptyScene('scene-test', 3, 3);
    // Cellule (1,1) totalement close par 4 arêtes murées (N/E/S/O) — un mur d'arête PUR, aucun
    // terrain `mur`. Depuis chaque coin extérieur en diagonale, les DEUX jambes du L sont coupées
    // par l'arête posée sur la case cible : aucune fuite en diagonale à travers le coin.
    s.walls = [
      { x: 1, y: 1, side: 'N' } as WallSeg, // entre (1,1) et (1,0)
      { x: 1, y: 2, side: 'N' } as WallSeg, // entre (1,1) et (1,2)
      { x: 1, y: 1, side: 'E' } as WallSeg, // entre (1,1) et (2,1)
      { x: 0, y: 1, side: 'E' } as WallSeg, // entre (1,1) et (0,1)
    ];
    for (const corner of [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 2 }]) {
      const dist = reachable(s, corner, 4, NO_BLOCK);
      expect(dist.has('1,1')).toBe(false); // aucun corner extérieur n'atteint la cellule close, ni en diagonale ni via un détour
    }
  });
});
