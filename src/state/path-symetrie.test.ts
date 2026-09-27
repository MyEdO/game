import { describe, it, expect } from 'vitest';
import { diligenceCampaign, paquetDuJeu } from '../scenes/campaign';
import { emptyScene, isWalkable, type Scene, type Terrain, type WallSeg } from './scene';
import { walkNeighbors, type Pt } from './path';

/**
 * SYMÉTRIE du franchissement — la marchabilité est une propriété de l'ARÊTE, pas du sens de parcours :
 * `B ∈ walkNeighbors(A) ⟺ A ∈ walkNeighbors(B)`. Ce qui en dépend (`pathTo`, la fermeture transitive des
 * gardes de scène, `walkComponentAt`/`portalsForParty`, le pas du joueur) devient faux dès qu'une arête
 * se franchit dans un seul sens. Le cas critique est la diagonale INTER-COUCHES : ses cases de FLANC
 * n'ont pas d'étage propre — au sommet d'une rampe, elles n'existent que sur la couche basse — et le
 * garde anti coupe-de-coin doit les chercher sur les DEUX couches du pas, jamais sur la seule couche
 * où l'on se tient. Le garde reste ENTIER : un coin scellé par un mur le reste dans les deux sens.
 */

const key = (p: Pt) => `${p.x},${p.y},${p.z ?? 0}`;
const links = (scene: Scene, a: Pt, b: Pt) => walkNeighbors(scene, a).some((n) => key(n) === key(b));

/** Toutes les cases formant une surface réelle, toutes couches confondues. */
function surfaces(scene: Scene): Pt[] {
  const out: Pt[] = [];
  for (const layer of scene.layers)
    for (let y = 0; y < scene.dimensions.h; y++)
      for (let x = 0; x < scene.dimensions.w; x++) if (isWalkable(scene, x, y, layer.z)) out.push({ x, y, z: layer.z });
  return out;
}

/** Les arêtes franchies dans un seul sens, sur toute la scène. */
function sensUniques(scene: Scene): string[] {
  const out: string[] = [];
  for (const a of surfaces(scene))
    for (const b of walkNeighbors(scene, a)) if (!links(scene, b, a)) out.push(`${key(a)} -> ${key(b)}`);
  return out;
}

describe('path — le franchissement d’une arête est SYMÉTRIQUE', () => {
  const diligence: Scene = paquetDuJeu(diligenceCampaign).scenes[0];

  it('sur « La Diligence » (carte authorée, 3 couches), toute arête franchie l’est dans les deux sens', () => {
    expect(sensUniques(diligence)).toEqual([]);
  });

  it('les sommets des deux escaliers se montent ET se redescendent', () => {
    const sommets: [Pt, Pt][] = [
      [{ x: 19, y: 22, z: 0 }, { x: 20, y: 21, z: 1 }], // volée est : dernière marche (3 m) → plancher (4 m)
      [{ x: 14, y: 25, z: 0 }, { x: 13, y: 24, z: 1 }], // volée ouest
      [{ x: 20, y: 22, z: 0 }, { x: 21, y: 21, z: 1 }], // paliers voisins de ces mêmes sommets
      [{ x: 13, y: 25, z: 0 }, { x: 12, y: 24, z: 1 }],
    ];
    for (const [bas, haut] of sommets) {
      expect([key(bas), key(haut), links(diligence, bas, haut)]).toEqual([key(bas), key(haut), true]);
      expect([key(haut), key(bas), links(diligence, haut, bas)]).toEqual([key(haut), key(bas), true]);
    }
  });

  it('une scène mono-couche reste symétrique quels que soient les murs d’arête', () => {
    const s = emptyScene(4, 4);
    s.walls = [
      { x: 1, y: 1, side: 'E' } as WallSeg,
      { x: 2, y: 2, side: 'N' } as WallSeg,
      { x: 0, y: 2, side: 'E' } as WallSeg,
    ];
    expect(sensUniques(s)).toEqual([]);
  });
});

/**
 * Scène 4×3 : sol z0 marchable, et une couche z1 portant les cases demandées (hauteur 0 = de niveau
 * avec le sol, donc `surfaceLink` flat → la diagonale cross-couche serait praticable sans garde).
 */
function twoLayer(tuilesZ1: { x: number; y: number }[], murs: WallSeg[], videsZ0: { x: number; y: number }[] = []): Scene {
  const w = 4;
  const s = emptyScene(w, 3);
  const z1 = new Array(w * 3).fill('vide') as Terrain[];
  for (const t of tuilesZ1) z1[t.y * w + t.x] = 'plancher';
  for (const v of videsZ0) s.layers[0].tiles[v.y * w + v.x] = 'vide' as Terrain;
  s.layers.push({ z: 1, tiles: z1 });
  s.walls = murs;
  return s;
}

describe('path — le garde anti coupe-de-coin reste ENTIER dans les deux sens', () => {
  const p: Pt = { x: 1, y: 0, z: 0 };
  const d: Pt = { x: 2, y: 1, z: 1 };

  it('sans obstacle, la diagonale cross-couche passe dans les deux sens (témoin)', () => {
    const s = twoLayer([{ x: 2, y: 1 }], []);
    expect(links(s, p, d)).toBe(true);
    expect(links(s, d, p)).toBe(true);
  });

  it('un mur posé SEULEMENT sur la couche d’ARRIVÉE scelle le coin dans les deux sens', () => {
    // Arête A(2,0)—D(2,1) murée à z1, et arête B(1,1)—D murée à z1 : les deux chemins en L sont coupés.
    const s = twoLayer([{ x: 2, y: 1 }], [
      { x: 2, y: 1, side: 'N', z: 1 } as WallSeg,
      { x: 1, y: 1, side: 'E', z: 1 } as WallSeg,
    ]);
    expect(links(s, p, d)).toBe(false);
    expect(links(s, d, p)).toBe(false);
    expect(sensUniques(s)).toEqual([]);
  });

  it('un mur sur UNE seule jambe suffit, et il vaut dans les deux sens', () => {
    const s = twoLayer([{ x: 2, y: 1 }], [{ x: 2, y: 1, side: 'N', z: 1 } as WallSeg]);
    expect(links(s, p, d)).toBe(false);
    expect(links(s, d, p)).toBe(false);
  });

  it('un flanc absent des DEUX couches du pas interdit la diagonale dans les deux sens', () => {
    // (2,0) vide au sol et absent de z1 : le chemin en L p→A→D n'existe sur aucune couche du pas.
    const s = twoLayer([{ x: 2, y: 1 }], [], [{ x: 2, y: 0 }]);
    expect(isWalkable(s, 2, 0, 0)).toBe(false);
    expect(isWalkable(s, 2, 0, 1)).toBe(false);
    expect(links(s, p, d)).toBe(false);
    expect(links(s, d, p)).toBe(false);
  });

  it('un flanc présent sur la SEULE couche basse suffit (sommet de rampe) — et symétriquement', () => {
    const s = twoLayer([{ x: 2, y: 1 }], []);
    expect(isWalkable(s, 2, 0, 0)).toBe(true);
    expect(isWalkable(s, 2, 0, 1)).toBe(false); // le flanc n'existe QUE sous la couche d'arrivée
    expect(links(s, p, d)).toBe(true);
    expect(links(s, d, p)).toBe(true);
  });
});
