import { describe, expect, it } from 'vitest';
import { faitesDuGroupe, faitieresDeLaScene, tronconsDuFaite, type Faitiere, type PanDuGroupe } from './faitieres';
import { emptyScene, type BuildingMass, type Scene } from './scene';
import { nappeKey } from './volume/toits';
import { toitsLeves } from './volume/volume';
import { roofMaterial } from './volume/matieres';

/**
 * Les faîtières (#4471) : un faîte par segment SAILLANT HORIZONTAL que portent deux pans d'un groupe de nappes, servi une
 * fois, à sa cote, du gradient moyen de ses pans et de la demi-différence de leurs pentes, tombant avec sa nappe.
 */

const masse = (patch: Partial<BuildingMass> = {}): BuildingMass => ({
  id: 'nef', z: 0, footprint: [{ x: 2, y: 2, w: 6, h: 3 }], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 45,
  material: { id: 'toit-ardoise' }, ...patch,
});
const sceneDe = (...masses: BuildingMass[]): Scene => {
  const scene = emptyScene('faitieres', 12, 12);
  scene.architecture = [{ id: 'corps', label: 'Corps', style: { id: 'maison' }, storeys: [], facades: [], masses }];
  return scene;
};

/** Les bouts `[début, fin]` (le long de X) de chaque faîtière, rangés. */
const bouts = (faitieres: readonly Faitiere[]): [number, number][] =>
  faitieres.map((f) => [f.milieu.x - Math.abs(f.sens.x) / 2, f.milieu.x + Math.abs(f.sens.x) / 2] as [number, number]).sort((p, q) => p[0] - q[0]);

describe('faitieresDeLaScene — le faîte d’un pignon (#4471)', () => {
  const scene = sceneDe(masse());
  const faitieres = faitieresDeLaScene(scene);

  it('le faîte se sert en tronçons d’une case, aux bords des cases, bout à bout, à la cote du faîte', () => {
    // emprise x 2..7, y 2..4 (repère des cases centrées : bords à 1,5 et 7,5 ; faîte à y = 3)
    expect(bouts(faitieres)).toEqual([[1.5, 2.5], [2.5, 3.5], [3.5, 4.5], [4.5, 5.5], [5.5, 6.5], [6.5, 7.5]]);
    for (const f of faitieres) {
      expect(f.milieu.y).toBe(3);
      expect(f.entree).toBeCloseTo(f.sortie, 9);
      expect(f.pied).toBeCloseTo(f.entree, 9);
    }
    expect(new Set(faitieres.map((f) => f.cle)).size).toBe(faitieres.length);
  });

  it('le V épouse les deux pans : demi-différence = pente du pan, gradient moyen nul sur un pignon symétrique', () => {
    const [f] = faitieres;
    expect(f.ecart).toBeCloseTo(2, 9);
    expect(f.pied).toBeCloseTo(4 + 1.5 * 2, 9); // égout à un étage, montée de 1,5 case à 2 m/case (45°)
    expect(f.gradient.x).toBeCloseTo(0, 9);
    expect(f.gradient.y).toBeCloseTo(0, 9);
  });

  it('couverture, famille du kit, palette tirée du `ridgeCap`, cases sous le faîte', () => {
    const [f] = faitieres;
    expect(f).toMatchObject({ couverture: 'toit-ardoise', famille: 'ardoise', piece: 'faitiere', position: 'seule', palette: { corps: roofMaterial('toit-ardoise').ridgeCap } });
    expect(faitieres.flatMap((g) => g.cases.map((c) => `${c.x},${c.y},${c.z}`)).sort()).toEqual(['2,3,0', '3,3,0', '4,3,0', '5,3,0', '6,3,0', '7,3,0']);
  });

  it('tombe avec sa nappe : sa clé de retrait est celle que le dégagement lève', () => {
    const [f] = faitieres;
    expect(f.nappe).toBe(nappeKey('corps', 'nef'));
    expect(toitsLeves(scene, [{ x: 4, y: 3, z: 0 }])).toEqual([f.nappe]);
  });

  it('une croupe n’a qu’un faîte, raccourci des deux croupes, ses demi-cases de bout jointes à leur voisine ; les arêtiers n’en reçoivent aucun', () => {
    // faîte de x = 3 à 6 (centres de case) : coupé à 3,5 / 4,5 / 5,5, ses bouts d’une demi-case rejoignent leur voisine
    expect(bouts(faitieresDeLaScene(sceneDe(masse({ profile: 'hip' }))))).toEqual([[3, 4.5], [4.5, 6]]);
  });

  it('un appentis et une terrasse n’ont aucun faîte', () => {
    expect(faitieresDeLaScene(sceneDe(masse({ profile: 'shed', eaveSide: 'N' })))).toEqual([]);
    expect(faitieresDeLaScene(sceneDe(masse({ profile: 'flat' })))).toEqual([]);
  });
});

describe('tronconsDuFaite — une pièce par case (#4471)', () => {
  const p = (x: number) => ({ x, y: 0, h: 7 });
  const longueurs = (t: [{ x: number }, { x: number }][]) => t.map(([a, b]) => b.x - a.x);

  it('un faîte de 3 cases donne 3 tronçons d’une case, contigus, sans recouvrement', () => {
    const t = tronconsDuFaite(p(4.5), p(1.5));
    expect(longueurs(t)).toEqual([1, 1, 1]);
    t.forEach(([a], i) => expect(a.x).toBe(i === 0 ? 1.5 : t[i - 1][1].x));
    expect(t.every(([a, b]) => a.h === 7 && b.h === 7)).toBe(true);
  });

  it('un bout plus court qu’une case rejoint son voisin dans la borne d’étirement, sinon garde sa longueur', () => {
    expect(longueurs(tronconsDuFaite(p(1.5), p(4)))).toEqual([1, 1.5]);
    expect(longueurs(tronconsDuFaite(p(1.5), p(3.37)))).toEqual([1, 0.87].map((l) => expect.closeTo(l, 9)));
    expect(longueurs(tronconsDuFaite(p(2), p(2.5)))).toEqual([0.5]);
  });
});

describe('faitesDuGroupe — saillance, pentes inégales et facettes (#4471)', () => {
  const cells = new Set(['0,0', '1,0', '0,1', '1,1']);
  /** Deux pans de part et d'autre du faîte y = 0,5 (repère des cases centrées), x de −0,5 à 1,5, à la cote 5 ; le nord
   *  descend vers −y de `nord` m par case, le sud vers +y de `sud`. */
  const deuxPans = (nord: number, sud: number): PanDuGroupe[] => {
    const h = (y: number, pente: number, sens: number) => 5 - pente * sens * (y - 0.5);
    const pan = (pente: number, sens: number, ys: [number, number]): PanDuGroupe => ({
      poly: [[-0.5, ys[0]], [1.5, ys[0]], [1.5, ys[1]], [-0.5, ys[1]]].map(([x, y]) => ({ x, y, h: h(y, pente, sens) })),
      gx: 0, gy: pente * -sens, nappe: 'corps|nef', cells, z: 0, couverture: 'tuile',
    });
    return [pan(nord, -1, [-0.5, 0.5]), pan(sud, 1, [0.5, 1.5])];
  };

  it('pentes inégales : le gradient moyen cisaille la pièce, la demi-différence ouvre son V', () => {
    const { faitieres } = faitesDuGroupe('g', deuxPans(1, 3));
    expect(faitieres).toHaveLength(2);
    const [f] = faitieres;
    // nord : G = (0, +1) ; sud : G = (0, −3) ⇒ moyenne (0, −1), demi-différence 2
    expect(f.gradient.x).toBeCloseTo(0, 9);
    expect(f.gradient.y).toBeCloseTo(-1, 9);
    expect(f.ecart).toBeCloseTo(2, 9);
    // chaque bras épouse son pan : vers le nord (−y) la pièce descend de ecart − gradient·(−y) = 1, vers le sud de 3
    expect(f.ecart + f.gradient.y).toBeCloseTo(1, 9);
    expect(f.ecart - f.gradient.y).toBeCloseTo(3, 9);
  });

  it('une arête RENTRANTE (noue horizontale) n’est pas un faîte', () => {
    expect(faitesDuGroupe('g', deuxPans(-1, -1)).faitieres).toEqual([]);
  });

  it('un faîte qui borde une facette (pan au gradient diagonal) n’a pas de faîtière, et se compte', () => {
    const [nord, sud] = deuxPans(1, 1);
    expect(faitesDuGroupe('g', [nord, { ...sud, gx: 0.5 }])).toEqual({ faitieres: [], surFacette: 1 });
  });
});
