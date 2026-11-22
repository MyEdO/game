import { describe, expect, it } from 'vitest';
import { piecesDuGroupe, piecesDeToitDeLaScene, reculAuNoeud, tronconsDeLArete, type PieceDeToitPosee, type PanDuGroupe } from './piecesDeToit';
import { DEMI_LARGEUR_DE_POSE_M } from './piecesDArete';
import { emptyScene, sceneMetresPerTile, type BuildingMass, type Scene } from './scene';
import type { Pt } from './path';
import { nappeKey, pansDesNappes } from './volume/toits';
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
  const scene = emptyScene('pieces-de-toit', 12, 12);
  scene.architecture = [{ id: 'corps', label: 'Corps', style: { id: 'maison' }, storeys: [], facades: [], masses }];
  return scene;
};

/** Les faîtières de `scene`, sans ses arêtiers ni ses noues. */
const piecesDeFaite = (scene: Scene): PieceDeToitPosee[] => piecesDeToitDeLaScene(scene).filter((f) => f.piece === 'faitiere');

/** Les bouts `[début, fin]` (le long de X) de chaque faîtière, rangés. */
const bouts = (pieces: readonly PieceDeToitPosee[]): [number, number][] =>
  pieces.map((f) => [f.milieu.x - Math.abs(f.sens.x) / 2, f.milieu.x + Math.abs(f.sens.x) / 2] as [number, number]).sort((p, q) => p[0] - q[0]);

describe('piecesDeToitDeLaScene — le faîte d’un pignon (#4471)', () => {
  const scene = sceneDe(masse());
  const pieces = piecesDeToitDeLaScene(scene);

  it('le faîte court jusqu’au bout des rives, en tronçons d’une case aux bords des cases, bout à bout, à la cote du faîte', () => {
    // emprise x 2..7, y 2..4 (repère des cases centrées : murs pignons à 1,5 et 7,5 ; faîte à y = 3) ; la rive déborde
    // de `e` cases, et ce bout de débord rejoint le tronçon voisin
    const e = roofMaterial('toit-ardoise').eaveOverhangM! / sceneMetresPerTile(scene);
    const attendus = [[1.5 - e, 2.5], [2.5, 3.5], [3.5, 4.5], [4.5, 5.5], [5.5, 6.5], [6.5, 7.5 + e]];
    expect(bouts(pieces)).toEqual(attendus.map(([a, b]) => [expect.closeTo(a, 9), expect.closeTo(b, 9)]));
    for (const f of pieces) {
      expect(f.milieu.y).toBe(3);
      expect(f.entree).toBeCloseTo(f.sortie, 9);
      expect(f.pied).toBeCloseTo(f.entree, 9);
    }
    expect(new Set(pieces.map((f) => f.cle)).size).toBe(pieces.length);
  });

  it('le V épouse les deux pans : demi-différence des pentes = pente du pan', () => {
    for (const f of pieces) {
      expect(f.ecart).toBeCloseTo(2, 9);
      expect(f.pied).toBeCloseTo(4 + 1.5 * 2, 9); // égout à un étage, montée de 1,5 case à 2 m/case (45°)
    }
  });

  it('couverture, famille du kit, palette tirée du `ridgeCap`, cases sous le faîte', () => {
    const [f] = pieces;
    expect(f).toMatchObject({ couverture: 'toit-ardoise', famille: 'ardoise', piece: 'faitiere', position: 'seule', palette: { corps: roofMaterial('toit-ardoise').ridgeCap } });
    expect(pieces.flatMap((g) => g.cases.map((c) => `${c.x},${c.y},${c.z}`)).sort()).toEqual(['2,3,0', '3,3,0', '4,3,0', '5,3,0', '6,3,0', '7,3,0']);
  });

  it('tombe avec sa nappe : sa clé de retrait est celle que le dégagement lève', () => {
    const [f] = pieces;
    expect(f.nappe).toBe(nappeKey('corps', 'nef'));
    expect(toitsLeves(scene, [{ x: 4, y: 3, z: 0 }])).toEqual([f.nappe]);
  });

  it('une croupe n’a qu’un faîte, raccourci des deux croupes, ses demi-cases de bout jointes à leur voisine ; les arêtiers n’en reçoivent aucun', () => {
    // faîte de x = 3 à 6 (centres de case) : coupé à 3,5 / 4,5 / 5,5, ses bouts d’une demi-case rejoignent leur voisine
    expect(bouts(piecesDeFaite(sceneDe(masse({ profile: 'hip' }))))).toEqual([[3, 4.5], [4.5, 6]]);
  });

  it.each([
    { nom: 'T', metresParCase: 2, footprint: [{ x: 2, y: 2, w: 9, h: 3 }, { x: 5, y: 5, w: 3, h: 4 }], faites: { 'y=3': [[3, [6, -1]], [[6, 1], 9]], 'x=6': [[[3, 1], 7]] } },
    { nom: 'T', metresParCase: 3, footprint: [{ x: 2, y: 2, w: 9, h: 3 }, { x: 5, y: 5, w: 3, h: 4 }], faites: { 'y=3': [[3, [6, -1]], [[6, 1], 9]], 'x=6': [[[3, 1], 7]] } },
    { nom: 'croix', metresParCase: 2, footprint: [{ x: 5, y: 2, w: 3, h: 9 }, { x: 2, y: 5, w: 9, h: 3 }], faites: { 'x=6': [[3, [6, -1]], [[6, 1], 9]], 'y=6': [[3, [6, -1]], [[6, 1], 9]] } },
  ])('une croupe en $nom à $metresParCase m par case : chaque faîte se coupe au croisement et recule de la demi-largeur de pose, en mètres, à 45°', ({ metresParCase, footprint, faites }) => {
    const r = reculAuNoeud(Math.PI / 4, DEMI_LARGEUR_DE_POSE_M / metresParCase);
    expect(r).toBeCloseTo(DEMI_LARGEUR_DE_POSE_M / metresParCase, 9);
    // Une borne : un bout libre, ou `[nœud, côté]`, le croisement reculé de `r` d'un côté ou de l'autre.
    const borne = (b: number | number[]) => (typeof b === 'number' ? b : b[0] + b[1] * r);
    const parFaite = new Map<string, [number, number][]>();
    for (const f of piecesDeFaite({ ...sceneDe(masse({ footprint, profile: 'hip' })), metresPerTile: metresParCase })) {
      const selonX = Math.abs(f.sens.x) > 1e-9;
      const [c, l] = selonX ? [f.milieu.x, Math.abs(f.sens.x)] : [f.milieu.y, Math.abs(f.sens.y)];
      const k = selonX ? `y=${f.milieu.y}` : `x=${f.milieu.x}`;
      (parFaite.get(k) ?? parFaite.set(k, []).get(k)!).push([c - l / 2, c + l / 2]);
    }
    expect([...parFaite.keys()].sort()).toEqual(Object.keys(faites).sort());
    for (const [k, morceaux] of Object.entries(faites)) {
      const t = parFaite.get(k)!.sort((p, q) => p[0] - q[0]);
      // Les tronçons d'un morceau se suivent bout à bout ; entre deux morceaux, le jour du croisement.
      const debuts = [t[0][0], ...t.slice(1).filter(([d], i) => Math.abs(d - t[i][1]) > 1e-9).map(([d]) => d)];
      const fins = [...t.slice(0, -1).filter(([, f], i) => Math.abs(t[i + 1][0] - f) > 1e-9).map(([, f]) => f), t[t.length - 1][1]];
      expect(debuts.map((d, i) => [d, fins[i]]), k).toEqual((morceaux as (number | number[])[][]).map(([a, b]) => [expect.closeTo(borne(a), 9), expect.closeTo(borne(b), 9)]));
    }
  });

  it('le débord d’une rive, si long soit-il, va au tronçon de bout : chaque faîtière traverse une case', () => {
    const chaume = { ...sceneDe(masse({ material: { id: 'chaume' } })), metresPerTile: 1 };
    const e = roofMaterial('chaume').eaveOverhangM! / 1;
    const pieces = piecesDeToitDeLaScene(chaume);
    for (const f of pieces) expect(f.cases.length, f.cle).toBeGreaterThan(0);
    const b = bouts(pieces);
    expect(b[0][0]).toBeCloseTo(1.5 - e, 9);
    expect(b[b.length - 1][1]).toBeCloseTo(7.5 + e, 9);
  });

  it('un appentis et une terrasse n’ont aucun faîte', () => {
    expect(piecesDeToitDeLaScene(sceneDe(masse({ profile: 'shed', eaveSide: 'N' })))).toEqual([]);
    expect(piecesDeToitDeLaScene(sceneDe(masse({ profile: 'flat' })))).toEqual([]);
  });
});

describe('tronconsDeLArete — une pièce par case (#4471)', () => {
  const p = (x: number) => ({ x, y: 0, h: 7 });
  const longueurs = (t: [{ x: number }, { x: number }][]) => t.map(([a, b]) => b.x - a.x);

  it('un faîte de 3 cases donne 3 tronçons d’une case, contigus, sans recouvrement, du premier bout vers le second', () => {
    const t = tronconsDeLArete(p(1.5), p(4.5), [1.5, 4.5]);
    expect(longueurs(t)).toEqual([1, 1, 1]);
    t.forEach(([a], i) => expect(a.x).toBe(i === 0 ? 1.5 : t[i - 1][1].x));
    expect(t.every(([a, b]) => a.h === 7 && b.h === 7)).toBe(true);
    expect(tronconsDeLArete(p(4.5), p(1.5), [1.5, 4.5])).toEqual([...t].reverse().map(([a, b]) => [b, a]));
  });

  it('un bout plus court qu’une case rejoint son voisin dans la borne d’étirement, sinon garde sa longueur', () => {
    expect(longueurs(tronconsDeLArete(p(1.5), p(4), [1.5, 4.5]))).toEqual([1, 1.5]);
    expect(longueurs(tronconsDeLArete(p(1.5), p(3.37), [1.5, 3.5]))).toEqual([1, 0.87].map((l) => expect.closeTo(l, 9)));
    expect(longueurs(tronconsDeLArete(p(2), p(2.5), [1.5, 2.5]))).toEqual([0.5]);
  });
});

describe('piecesDuGroupe — saillance et facettes (#4471)', () => {
  const cells = new Set(['0,0', '1,0', '0,1', '1,1']);
  /** Deux pans de part et d'autre du faîte y = 0,5 (repère des cases centrées), x de −0,5 à 1,5, à la cote 5 ; le nord
   *  descend vers −y de `nord` m par case, le sud vers +y de `sud`. */
  const deuxPans = (nord: number, sud: number): PanDuGroupe[] => {
    const h = (y: number, pente: number, sens: number) => 5 - pente * sens * (y - 0.5);
    const pan = (pente: number, sens: number, ys: [number, number]): PanDuGroupe => ({
      poly: [[-0.5, ys[0]], [1.5, ys[0]], [1.5, ys[1]], [-0.5, ys[1]]].map(([x, y]) => ({ x, y, h: h(y, pente, sens) })),
      gx: 0, gy: pente * -sens, nappe: 'corps|nef', cells, z: 0, couverture: 'tuile', egout: 0, debord: 0,
    });
    return [pan(nord, -1, [-0.5, 0.5]), pan(sud, 1, [0.5, 1.5])];
  };

  it('une arête RENTRANTE (noue horizontale) n’est pas un faîte', () => {
    expect(piecesDuGroupe('g', deuxPans(1, 1), 2)).toHaveLength(2);
    expect(piecesDuGroupe('g', deuxPans(-1, -1), 2)).toEqual([]);
  });

  it('un versant plus étroit que la pose (une demi-case) ne porte pas de faîtière : la noue qui le borde passe au-dessus', () => {
    const [nord] = deuxPans(1, 1);
    const pan = (ys: [number, number], h: (y: number) => number, gy: number): PanDuGroupe => ({
      ...nord, gy, poly: [[-0.5, ys[0]], [1.5, ys[0]], [1.5, ys[1]], [-0.5, ys[1]]].map(([x, y]) => ({ x, y, h: h(y) })),
    });
    const etroit = pan([0.5, 0.8], (y) => 5 - (y - 0.5), -1);
    const remonte = pan([0.8, 1.5], (y) => 4.7 + 0.5 * (y - 0.8), 0.5);
    expect(piecesDuGroupe('g', [nord, etroit, remonte], 2)).toEqual([]);
    const large = pan([0.5, 1.2], (y) => 5 - (y - 0.5), -1);
    const auDela = pan([1.2, 1.5], (y) => 4.3 + 0.5 * (y - 1.2), 0.5);
    expect(piecesDuGroupe('g', [nord, large, auDela], 2)).toHaveLength(2);
  });

  it('un faîte qui borde une facette (pan au gradient diagonal) n’a pas de faîtière', () => {
    const [nord, sud] = deuxPans(1, 1);
    expect(piecesDuGroupe('g', [nord, { ...sud, gx: 0.5 }], 2)).toEqual([]);
  });
});

/** Les arêtes droites des pièces `pieces`, par pièce : leurs tronçons colinéaires bout à bout en font une. */
function aretesDe(pieces: readonly PieceDeToitPosee[]): Record<string, number> {
  const restants = pieces.map((p) => ({ piece: p.piece, a: { x: p.milieu.x - p.sens.x / 2, y: p.milieu.y - p.sens.y / 2 }, b: { x: p.milieu.x + p.sens.x / 2, y: p.milieu.y + p.sens.y / 2 } }));
  const memePoint = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-6;
  const colineaires = (u: Pt, v: Pt) => Math.abs(u.x * v.y - u.y * v.x) < 1e-9;
  const compte: Record<string, number> = {};
  while (restants.length) {
    const cur = restants.shift()!;
    for (let suite = true; suite;) {
      suite = false;
      for (let i = 0; i < restants.length; i++) {
        const o = restants[i];
        if (o.piece !== cur.piece || !colineaires({ x: cur.b.x - cur.a.x, y: cur.b.y - cur.a.y }, { x: o.b.x - o.a.x, y: o.b.y - o.a.y })) continue;
        if (memePoint(o.a, cur.b)) cur.b = o.b;
        else if (memePoint(o.b, cur.a)) cur.a = o.a;
        else continue;
        restants.splice(i, 1);
        suite = true;
        break;
      }
    }
    compte[cur.piece] = (compte[cur.piece] ?? 0) + 1;
  }
  return compte;
}

describe('piecesDeToitDeLaScene — arêtiers et noues d’une croupe (#4471)', () => {
  const croupe = (footprint: BuildingMass['footprint'], patch: Partial<BuildingMass> = {}, metresPerTile = 2) =>
    piecesDeToitDeLaScene({ ...sceneDe(masse({ footprint, profile: 'hip', pitchDeg: 30, ...patch })), metresPerTile });

  it.each([
    { nom: 'L', footprint: [{ x: 2, y: 5, w: 8, h: 3 }, { x: 2, y: 2, w: 4, h: 3 }], attendu: { aretier: 6, faitiere: 2, noue: 1 } },
    { nom: 'T', footprint: [{ x: 2, y: 2, w: 9, h: 3 }, { x: 5, y: 5, w: 3, h: 5 }], attendu: { aretier: 6, faitiere: 3, noue: 2 } },
    { nom: 'U', footprint: [{ x: 2, y: 2, w: 3, h: 6 }, { x: 5, y: 6, w: 3, h: 2 }, { x: 8, y: 2, w: 3, h: 6 }], attendu: { aretier: 8, faitiere: 3, noue: 2 } },
    { nom: 'croix', footprint: [{ x: 5, y: 2, w: 3, h: 9 }, { x: 2, y: 5, w: 9, h: 3 }], attendu: { aretier: 8, faitiere: 4, noue: 4 } },
  ])('une croupe en $nom porte exactement ses arêtiers, ses faîtes (coupés aux croisements) et ses noues', ({ footprint, attendu }) => {
    expect(aretesDe(croupe(footprint))).toEqual(attendu);
  });

  it('un arêtier et une noue montent le long de leur sens, du bas vers le haut, leur gradient moyen sans travers', () => {
    const pieces = croupe([{ x: 2, y: 5, w: 8, h: 3 }, { x: 2, y: 2, w: 4, h: 3 }]).filter((p) => p.piece !== 'faitiere');
    expect(pieces.length).toBeGreaterThan(0);
    for (const p of pieces) {
      const l = Math.hypot(p.sens.x, p.sens.y);
      expect(p.sortie, p.cle).toBeGreaterThan(p.entree);
      expect((p.gradient.x * p.sens.x + p.gradient.y * p.sens.y) / l, p.cle).toBeCloseTo((p.sortie - p.entree) / l, 9);
      expect((p.gradient.x * -p.sens.y + p.gradient.y * p.sens.x) / l, `${p.cle} : travers`).toBeCloseTo(0, 9);
      expect(p.pied, p.cle).toBeCloseTo((p.entree + p.sortie) / 2, 9);
    }
  });

  it('le bas d’un arêtier né à l’égout se prolonge sur le débord, vers son coin, en deçà du recul de sa pose à 45°', () => {
    // Sur la diagonale du coin : le débord e√2, moins le recul de la demi-largeur de pose à 45° ; d par axe.
    const d = ((roofMaterial('toit-ardoise').eaveOverhangM! / 2) * Math.SQRT2 - DEMI_LARGEUR_DE_POSE_M / 2) / Math.SQRT2;
    const aretiers = croupe([{ x: 2, y: 2, w: 6, h: 3 }]).filter((p) => p.piece === 'aretier');
    const plusBas = Math.min(...aretiers.map((p) => p.entree));
    const bas = aretiers.filter((p) => Math.abs(p.entree - plusBas) < 1e-9).map((p) => ({ x: p.milieu.x - p.sens.x / 2, y: p.milieu.y - p.sens.y / 2 }));
    expect(bas.map((p) => [p.x, p.y]).sort()).toEqual(
      [[1.5 - d, 1.5 - d], [1.5 - d, 4.5 + d], [7.5 + d, 1.5 - d], [7.5 + d, 4.5 + d]].map(([x, y]) => [expect.closeTo(x, 9), expect.closeTo(y, 9)]).sort(),
    );
  });

  it('sur une croupe de chaume à 1 m par case, chaque pièce d’arêtier traverse au moins une case, le débord compris', () => {
    const pieces = croupe([{ x: 2, y: 2, w: 6, h: 3 }], { material: { id: 'chaume' } }, 1).filter((p) => p.piece === 'aretier');
    expect(pieces.length).toBeGreaterThan(0);
    for (const p of pieces) expect(p.cases.length, p.cle).toBeGreaterThan(0);
  });

  it('une arête entre deux pans de pentes inégales porte leur gradient moyen : son travers cisaille la pièce', () => {
    // Le pan A monte vers +y (h = 2y), le pan B vers +x (h = x/2) : ils se coupent sur la droite y = x/4.
    const cells = new Set(['0,0']);
    const commun = { nappe: 'corps|nef', cells, z: 0, couverture: 'tuile', egout: 0, debord: 0 };
    const A: PanDuGroupe = { ...commun, gx: 0, gy: 2, poly: [{ x: 0, y: 0, h: 0 }, { x: 4, y: 1, h: 2 }, { x: 0, y: 1, h: 2 }] };
    const B: PanDuGroupe = { ...commun, gx: 0.5, gy: 0, poly: [{ x: 0, y: 0, h: 0 }, { x: 4, y: 0, h: 2 }, { x: 4, y: 1, h: 2 }] };
    const [p] = piecesDuGroupe('g', [A, B], 2);
    expect(p).toBeDefined();
    expect(p.gradient).toEqual({ x: 0.25, y: 1 });
    const l = Math.hypot(p.sens.x, p.sens.y);
    expect(Math.abs((p.gradient.x * -p.sens.y + p.gradient.y * p.sens.x) / l)).toBeGreaterThan(0.5);
  });
});

/**
 * #4471 — la pose de chaque pièce, large de `DEMI_LARGEUR_DE_POSE_M` de chaque côté, repose sur le plus haut pan à son
 * aplomb (soffites compris) : aucun bras ne s'enfonce, ni à un nœud (recul), ni au coin d'un débord, ni sous un soffite.
 */
describe('piecesDeToitDeLaScene — chaque bras de chaque pièce repose sur le toit (#4471)', () => {
  const R = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
  const dedans = (poly: readonly { x: number; y: number }[], x: number, y: number) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  };
  const SENS: Record<string, number> = { faitiere: -1, aretier: -1, noue: 1 };
  it.each([
    ['L', [R(2, 5, 8, 3), R(2, 2, 4, 3)]], ['T', [R(2, 2, 9, 3), R(5, 5, 3, 5)]],
    ['U', [R(2, 2, 3, 6), R(5, 6, 3, 2), R(8, 2, 3, 6)]], ['croix', [R(5, 2, 3, 9), R(2, 5, 9, 3)]],
  ].flatMap(([nom, footprint]) => [2, 3].map((metresParCase) => ({ nom, footprint, metresParCase }))))('$nom à $metresParCase m par case', ({ footprint, metresParCase }) => {
    const scene = { ...sceneDe(masse({ footprint: footprint as BuildingMass['footprint'], profile: 'hip', pitchDeg: 30 })), metresPerTile: metresParCase };
    const pans = [...pansDesNappes(scene).values()].flat().flatMap((p) => [p.face, ...p.faces.filter((f) => f.material.part === 'soffite')].map((f) => ({ poly: f.poly, gx: p.gx, gy: p.gy })));
    const bras = DEMI_LARGEUR_DE_POSE_M / metresParCase;
    const enfonces: string[] = [];
    for (const t of piecesDeToitDeLaScene(scene)) {
      const l = Math.hypot(t.sens.x, t.sens.y);
      const n = { x: -t.sens.y / l, y: t.sens.x / l };
      for (const le of [-0.8, 0, 0.8])
        for (const cote of [-1, 1]) {
          const x = t.milieu.x + (t.sens.x * le) / 2 + cote * bras * n.x, y = t.milieu.y + (t.sens.y * le) / 2 + cote * bras * n.y;
          const pose = t.pied + t.gradient.x * (x - t.milieu.x) + t.gradient.y * (y - t.milieu.y) + SENS[t.piece] * t.ecart * bras;
          const toit = Math.max(...pans.filter((p) => dedans(p.poly, x, y)).map((p) => p.poly[0].h + p.gx * (x - p.poly[0].x) + p.gy * (y - p.poly[0].y)));
          if (toit > pose + 1e-6) enfonces.push(`${t.cle} (${le}, ${cote}) : ${pose.toFixed(3)} sous ${toit.toFixed(3)}`);
        }
    }
    expect(enfonces).toEqual([]);
  });
});
