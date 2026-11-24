import { describe, it, expect } from 'vitest';
import { relaisAEtage, VOLEES_DU_RELAIS } from './fixtures/plans.testkit';
import { emptyScene, isWalkable, type Scene, type WallSeg } from '../noyau/monde/scene';
import type { Terrain } from '../data/schemas/defs-scenes/scene';
import { reachable, tileKey, walkNeighbors, type MoveEnv, type Pt } from '../noyau/monde/path';
import { plancherGrimpable } from '../noyau/monde/escalade.testkit';

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
  const relais: Scene = relaisAEtage();

  it('sur le relais à étage (deux couches, deux volées, portes et cloisons), toute arête franchie l’est dans les deux sens', () => {
    expect(sensUniques(relais)).toEqual([]);
  });

  it('le sommet de chaque volée se monte ET se redescend, en diagonale inter-couches comprise', () => {
    for (const { haut } of VOLEES_DU_RELAIS) {
      const sommet: Pt = { ...haut, z: 0 };
      const montees = walkNeighbors(relais, sommet).filter((n) => (n.z ?? 0) === 1);
      // Le cas critique : au moins une montée en DIAGONALE depuis la dernière marche.
      expect(montees.filter((n) => n.x !== sommet.x && n.y !== sommet.y).map(key), key(sommet)).not.toEqual([]);
      for (const n of montees) expect([key(sommet), key(n), links(relais, n, sommet)]).toEqual([key(sommet), key(n), true]);
    }
  });

  it('une scène mono-couche reste symétrique quels que soient les murs d’arête', () => {
    const s = emptyScene('scene-test', 4, 4);
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
  const s = emptyScene('scene-test', w, 3);
  const z1 = Array.from({ length: w * 3 }, (): Terrain => 'vide');
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

/** #4156 : le pas d'un Grimpant (`traverse`, LDB 85 l.160-162) franchit l'arête escaladable entre deux couches dans les
 *  deux sens (LDB 15 l.57), sur `plancherGrimpable`. */
describe('path — le pas d’un Grimpant (`traverse`) franchit l’arête escaladable dans les deux sens', () => {
  const s = plancherGrimpable();
  const env: MoveEnv = { blocked: new Set(), traverse: { climb: true, climbFullSpeed: true } };
  /** Les voisins de pas de `a` : `reachable` à portée 1, le pas que partagent `reachable` et `distancesDeMarcheVers`. */
  const cle = (p: Pt) => tileKey(p.x, p.y, p.z ?? 0);
  const pas = (a: Pt) => [...reachable(s, a, 1, env).keys()].filter((k) => k !== cle(a));

  it('le rez atteint le plancher, et le plancher atteint le rez', () => {
    const duRez = [...reachable(s, { x: 2, y: 3, z: 0 }, 4, env).keys()];
    const duHaut = [...reachable(s, { x: 2, y: 0, z: 1 }, 3, env).keys()];
    expect(duRez).toContain(tileKey(2, 0, 1));
    expect(duHaut).toContain(tileKey(2, 3, 0));
  });

  it('toute arête franchie par le pas l’est dans les deux sens', () => {
    const uniques = surfaces(s).flatMap((a) => pas(a).filter((b) => {
      const [x, y, z] = b.split(',').map(Number);
      return !pas({ x, y, z }).includes(cle(a));
    }).map((b) => `${cle(a)} -> ${b}`));
    expect(pas({ x: 2, y: 0, z: 1 })).toContain(tileKey(2, 1, 0));
    expect(uniques).toEqual([]);
  });
});
