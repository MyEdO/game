import { describe, it, expect } from 'vitest';
import { boundarySegs, buildRoofs, clearedSpace, depthToEave, fieldHeightAt, gableEnds, roofPans, massFootprintCells, massRoomZoneIds, massSpaceCells, nappeKey, resolveMass, resolveNappes, riseAt, ROOF_SLOPE_M, type RoofShapeSpec } from './roofs';
import { buildWalls } from './walls';
import type { Face, GP, RoofLine } from './types';
import { WALL_H_M } from '../iso';
import { roofMaterial } from '../catalog/roofs';
import { MISSING_ID, MISSING_TONE } from '../catalog/missing';
import { emptyScene, type BuildingMass, type Scene, type WallSeg } from '../../state/scene';
import { addLayer, effectiveArchitecture, fillTerrainRect, paintTiles, putLayer, rederiveRoofMasses } from '../../state/sceneEdit';
import { encloseRect, perimeterWallSegs } from '../../state/sceneEdit.testkit';
import { diligenceCampaign } from '../../scenes/campaign';
import { buildings } from '../../data';

/**
 * Builder de TOITS du pivot : on teste la FUSION EN PANS CONTINUS (le fix de la cause racine « toit
 * mosaïque/zigzag ») — un polygone par pan, cellules-selles scindées en triangles PLANS le long de
 * l'arêtier —, les lignes sémantiques (faîte/arêtier/égout/rangs), les hauteurs en MÈTRES, les vérités
 * de scène (visible, roofOccupied), et la dérivation par MASSE (#823) : `hip` par BFS (noues/croupes
 * automatiques sur un corps en L, jamais une boîte englobante) et `roomZoneIds` DÉRIVÉS des zones
 * intérieures que l'emprise recouvre (jamais un champ authoré).
 */

const S = ROOF_SLOPE_M;

function rect(x0: number, y0: number, w: number, h: number): Set<string> {
  const out = new Set<string>();
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) out.add(`${x},${y}`);
  return out;
}

/** Pose une COTE métrique de relief sur une couche (toute la couche, ou les seules `cells`) — la
 *  vérité que `heightAt` porte et sur laquelle `buildWalls` assoit ses murs. */
function coter(scene: Scene, z: number, metres: number, cells?: readonly { x: number; y: number }[]): void {
  const layer = scene.layers.find((l) => l.z === z)!;
  const { w, h } = scene.dimensions;
  const height = layer.height ?? new Array<number>(w * h).fill(0);
  for (const c of cells ?? [...Array(w * h)].map((_, i) => ({ x: i % w, y: Math.floor(i / w) }))) height[c.y * w + c.x] = metres;
  layer.height = height;
}

/** Forme HIP par défaut des tests de pavage bruts — reproduit le pavage « sans shape »
 *  (profondeur BFS × `ROOF_SLOPE_M`, la même formule pour toute forme y compris un L). */
const hip = (eaveHeightM = 0, pitch = S): RoofShapeSpec => ({ profile: 'hip', ridge: 'x', pitch, eaveHeightM });

/** Sommets d'un polygone, triés (x,y,h) — compare des boucles sans dépendre du point de départ. */
const vertsOf = (f: Face) => [...f.poly].sort((a, b) => a.x - b.x || a.y - b.y || a.h - b.h);
const partsOf = (faces: Face[]) => faces.map((f) => f.material.part).sort();
const ofKind = (lines: RoofLine[], kind: RoofLine['kind']) => lines.filter((l) => l.kind === kind);

/** Le polygone est-il PLAN ? (fit du plan sur 3 sommets non colinéaires, résidu nul partout). */
function isPlanar(f: Face): boolean {
  const [p0, ...rest] = f.poly;
  let basis: [GP, GP] | null = null;
  for (let i = 0; i < rest.length - 1 && !basis; i++) {
    const a = rest[i], b = rest[i + 1];
    if ((a.x - p0.x) * (b.y - p0.y) - (a.y - p0.y) * (b.x - p0.x) !== 0) basis = [a, b];
  }
  if (!basis) return true; // dégénéré (colinéaire) : rien à vérifier
  const [a, b] = basis;
  const det = (a.x - p0.x) * (b.y - p0.y) - (a.y - p0.y) * (b.x - p0.x);
  const gx = ((a.h - p0.h) * (b.y - p0.y) - (a.y - p0.y) * (b.h - p0.h)) / det;
  const gy = ((a.x - p0.x) * (b.h - p0.h) - (a.h - p0.h) * (b.x - p0.x)) / det;
  return f.poly.every((p) => Math.abs(p0.h + gx * (p.x - p0.x) + gy * (p.y - p0.y) - p.h) < 1e-9);
}

describe('roofPans — rectangle 4×2 : 4 pans EXACTS + faîte (hip, distance BFS = pyramide)', () => {
  const { faces, lines } = roofPans(rect(0, 0, 4, 2), 'tuile', undefined, undefined, hip());

  it('4 pans, un par orientation, tous PLANS', () => {
    expect(faces).toHaveLength(4);
    expect(partsOf(faces)).toEqual(['E', 'N', 'O', 'S']);
    for (const f of faces) {
      expect(f.material).toMatchObject({ domain: 'roof', id: 'tuile' });
      expect(isPlanar(f)).toBe(true);
    }
  });

  it('pan N = trapèze égout(4)→faîte(2) ; pan E = triangle — sommets exacts (GP, coins de grille ±0.5)', () => {
    const north = faces.find((f) => f.material.part === 'N')!;
    expect(vertsOf(north)).toEqual([
      { x: -0.5, y: -0.5, h: 0 },
      { x: 0.5, y: 0.5, h: S },
      { x: 2.5, y: 0.5, h: S },
      { x: 3.5, y: -0.5, h: 0 },
    ]);
    const east = faces.find((f) => f.material.part === 'E')!;
    expect(vertsOf(east)).toEqual([
      { x: 2.5, y: 0.5, h: S },
      { x: 3.5, y: -0.5, h: 0 },
      { x: 3.5, y: 1.5, h: 0 },
    ]);
  });

  it('UN faîte fusionné (colinéaire), 4 arêtiers, 4 égouts (un par façade)', () => {
    const faites = ofKind(lines, 'faite');
    expect(faites).toHaveLength(1);
    expect([faites[0].a, faites[0].b].sort((p, q) => p.x - q.x)).toEqual([
      { x: 0.5, y: 0.5, h: S },
      { x: 2.5, y: 0.5, h: S },
    ]);
    expect(ofKind(lines, 'aretier')).toHaveLength(4);
    expect(ofKind(lines, 'egout')).toHaveLength(4);
  });

  it('rangs : `courses` rangs PAR CRAN de montée, par pan (tuile = 3 → 12), à niveau constant', () => {
    const rangs = ofKind(roofPans(rect(0, 0, 4, 2), 'tuile', 3, undefined, hip()).lines, 'rang');
    expect(rangs).toHaveLength(12);
    for (const r of rangs) {
      expect(r.a.h).toBeCloseTo(r.b.h, 12); // courbe de niveau du pan
      expect(r.a.h).toBeGreaterThan(0);
      expect(r.a.h).toBeLessThan(S);
    }
  });
});

describe('roofPans — pyramide 4×4 : selles du centre TRIANGULÉES, apex partagé', () => {
  const { faces, lines } = roofPans(rect(0, 0, 4, 4), 'tuile', undefined, undefined, hip());

  it('4 pans TRIANGLES nets (aucune selle émise), apex unique à 2 crans', () => {
    expect(faces).toHaveLength(4);
    expect(partsOf(faces)).toEqual(['E', 'N', 'O', 'S']);
    for (const f of faces) {
      expect(f.poly).toHaveLength(3);
      expect(isPlanar(f)).toBe(true);
      expect(f.poly.some((p) => p.x === 1.5 && p.y === 1.5 && Math.abs(p.h - 2 * S) < 1e-9)).toBe(true);
    }
  });

  it('aucun faîte (apex ponctuel), 4 arêtiers pleine diagonale (coin → apex, fusionnés), 4 égouts', () => {
    expect(ofKind(lines, 'faite')).toHaveLength(0);
    const aretiers = ofKind(lines, 'aretier');
    expect(aretiers).toHaveLength(4);
    for (const a of aretiers) {
      const [lo, hi] = [a.a, a.b].sort((p, q) => p.h - q.h);
      expect(lo.h).toBe(0); // du coin d'égout…
      expect(hi).toMatchObject({ x: 1.5, y: 1.5 }); // …jusqu'à l'apex
    }
    expect(ofKind(lines, 'egout')).toHaveLength(4);
  });
});

describe('roofPans — forme en L : arêtiers/noue triangulés SANS selle (hip BFS, croupes ET noues automatiques)', () => {
  const L = new Set([...rect(0, 0, 4, 2), ...rect(0, 2, 2, 2)]);
  const { faces, lines } = roofPans(L, 'tuile', undefined, undefined, hip());

  it('6 pans TOUS PLANS (N, O, 2×E, 2×S) — plus aucune quad-selle', () => {
    expect(partsOf(faces)).toEqual(['E', 'E', 'N', 'O', 'S', 'S']);
    for (const f of faces) expect(isPlanar(f)).toBe(true);
  });

  it('la NOUE du coin rentrant est un arêtier net : (1.5,1.5) au faîte → (1.5,1.5)+1 au creux', () => {
    const noue = ofKind(lines, 'aretier').find(
      (a) => [a.a, a.b].some((p) => p.x === 0.5 && p.y === 0.5) && [a.a, a.b].some((p) => p.x === 1.5 && p.y === 1.5),
    )!;
    expect(noue).toBeTruthy();
    const [lo, hi] = [noue.a, noue.b].sort((p, q) => p.h - q.h);
    expect(hi).toMatchObject({ x: 0.5, y: 0.5, h: S }); // haut de la noue (sommet intérieur)
    expect(lo).toMatchObject({ x: 1.5, y: 1.5, h: 0 }); // creux au coin rentrant
  });

  it('2 faîtes (bras long + bras court)', () => {
    expect(ofKind(lines, 'faite')).toHaveLength(2);
  });
});

describe('roofPans — cas limites', () => {
  it('1×1 : un pan PLAT unique à la base (profil `flat`), pas de faîte/arêtier/rang', () => {
    const { faces, lines } = roofPans(rect(2, 3, 1, 1), 'tuile', 3, undefined, { profile: 'flat', ridge: 'x', pitch: S, eaveHeightM: 0 });
    expect(faces).toHaveLength(1);
    expect(faces[0].material.part).toBe('N');
    expect(faces[0].poly.every((p) => p.h === 0)).toBe(true);
    expect(ofKind(lines, 'egout')).toHaveLength(4);
    expect(lines).toHaveLength(4); // rien d'autre
  });

  it('1×1 en `hip` : PAS un pan plat — la pyramide dégénère en 4 triangles, apex au centre à 0,5 cran', () => {
    const { faces } = roofPans(rect(2, 3, 1, 1), 'tuile', undefined, undefined, hip());
    expect(faces).toHaveLength(4);
    expect(faces.every((f) => f.poly.some((p) => Math.abs(p.h - 0.5 * S) < 1e-9))).toBe(true);
  });

  it('aucune cellule → vide ; déterministe (deux appels identiques)', () => {
    expect(roofPans(new Set(), 'tuile', undefined, undefined, hip())).toEqual({ faces: [], lines: [] });
    const a = roofPans(rect(0, 0, 3, 3), 'toit-ardoise', 3, undefined, hip(1));
    const b = roofPans(rect(0, 0, 3, 3), 'toit-ardoise', 3, undefined, hip(1));
    expect(a).toEqual(b);
  });
});

describe('roofPans — VOLUME d’avant-toit (soffite débordant + fascia par ÉGOUT)', () => {
  const eave = { overhang: 0.3, fasciaDrop: 0.2 };
  const { faces } = roofPans(rect(0, 0, 4, 2), 'tuile', undefined, eave, hip());
  const soffites = faces.filter((f) => f.material.part === 'soffite');
  const fascias = faces.filter((f) => f.material.part === 'fascia');

  it('un soffite + une fascia PAR ÉGOUT (4 façades) ; les 4 pans N/E/S/O intacts', () => {
    expect(soffites).toHaveLength(4);
    expect(fascias).toHaveLength(4);
    expect(faces.filter((f) => ['N', 'E', 'S', 'O'].includes(f.material.part!))).toHaveLength(4);
  });

  it('le bord EXTÉRIEUR du soffite descend SOUS l’égout (débord = pente continuée), PLAN', () => {
    for (const s of soffites) {
      const hs = s.poly.map((p) => p.h);
      expect(Math.min(...hs)).toBeCloseTo(-0.3 * S, 9); // bord extérieur : base − overhang·pente
      expect(Math.max(...hs)).toBeCloseTo(0, 9); // bord intérieur : sur l’égout (base)
      expect(isPlanar(s)).toBe(true); // coplanaire (débord franc, pas de pli)
    }
  });

  it('la fascia PEND verticalement sous le bord extérieur (haut = soffite, bas = − fasciaDrop)', () => {
    for (const fa of fascias) {
      const top = fa.poly.filter((p) => Math.abs(p.h - (-0.3 * S)) < 1e-9);
      const bot = fa.poly.filter((p) => Math.abs(p.h - (-0.3 * S - 0.2)) < 1e-9);
      expect(top).toHaveLength(2); // arête haute sur le bord extérieur du soffite
      expect(bot).toHaveLength(2); // arête basse, fasciaDrop plus bas
    }
  });

  it('SANS EaveSpec (appels historiques) : aucun débord, juste les pans', () => {
    const f = roofPans(rect(0, 0, 4, 2), 'tuile', undefined, undefined, hip()).faces;
    expect(f.every((x) => ['N', 'E', 'S', 'O'].includes(x.material.part!))).toBe(true);
  });

  it('fasciaDrop 0 (chaume, bord mou) : soffite SEUL, pas de fascia dure', () => {
    const f = roofPans(rect(0, 0, 4, 2), 'chaume', undefined, { overhang: 0.36, fasciaDrop: 0 }, hip()).faces;
    expect(f.some((x) => x.material.part === 'soffite')).toBe(true);
    expect(f.some((x) => x.material.part === 'fascia')).toBe(false);
  });

  it('pyramide (hip) : débord sur les 4 ÉGOUTS SEULEMENT, jamais sur les arêtiers', () => {
    const { faces: pf } = roofPans(rect(0, 0, 4, 4), 'tuile', undefined, eave, hip());
    expect(pf.filter((f) => f.material.part === 'soffite')).toHaveLength(4);
    expect(pf.filter((f) => f.material.part === 'fascia')).toHaveLength(4);
  });
});
describe('buildRoofs — masses de bâtiment (#823)', () => {
  const mass = (patch: Partial<BuildingMass> = {}): BuildingMass => ({
    id: 'toit-nef',
    z: 0,
    footprint: [{ x: 2, y: 2, w: 4, h: 2 }],
    levels: 1,
    profile: 'gable',
    ridge: 'x',
    pitchDeg: 45, // tan(45°)=1 ; avec metresPerTile=2 (défaut emptyScene), pitch dérivé = 2 m/case
    material: 'tuile',
    ...patch,
  });
  const sceneWithMasses = (...masses: BuildingMass[]): Scene => {
    const scene = emptyScene(12, 12);
    scene.architecture = [{
      id: 'corps-principal',
      label: 'Corps principal',
      style: 'maison',
      storeys: [],
      facades: [],
      masses,
    }];
    return scene;
  };

  /** Le `label` d'une pièce de nappe est PEINT sur le plan (`authoring/roofsSvg`) : sans libellé
   *  authoré, il vaut le nom FR du TYPE de bâtiment du corps ; l'id technique n'est le repli que
   *  lorsque le corps n'a NI libellé NI type. */
  it('sans libellé authoré, la nappe porte le LIBELLÉ du type de bâtiment — l’id du corps n’est que le dernier repli', () => {
    const type = buildings.find((b) => b.label !== b.id)!;
    expect(type, 'aucun bâtiment dont le libellé diffère de l’id : le test ne distinguerait rien.').toBeTruthy();
    // Une scène PAR cas : les nappes se mémoïsent par IDENTITÉ de scène (`memoByRef`).
    const sansLabel = (style: string | undefined): Scene => {
      const scene = sceneWithMasses(mass());
      const corps = scene.architecture![0];
      delete corps.label;
      corps.style = style;
      return scene;
    };

    expect(new Set(buildRoofs(sansLabel(type.id)).map((el) => el.label))).toEqual(new Set([type.label]));
    expect(new Set(buildRoofs(sansLabel(undefined)).map((el) => el.label))).toEqual(new Set(['corps-principal']));
  });

  it.each(['x', 'y'] as const)('respecte le faîtage authoré %s', (ridge) => {
    const footprint = [ridge === 'x' ? { x: 2, y: 2, w: 4, h: 2 } : { x: 2, y: 2, w: 2, h: 4 }];
    const out = buildRoofs(sceneWithMasses(mass({ ridge, footprint })));
    expect(new Set(out.map((pan) => pan.ridge))).toEqual(new Set([ridge]));
    expect(out).toHaveLength(2);
  });

  it('sans `ridge` déclaré, résout le LONG axe de l’emprise', () => {
    const out = buildRoofs(sceneWithMasses(mass({ ridge: undefined, footprint: [{ x: 2, y: 2, w: 6, h: 2 }] })));
    expect(new Set(out.map((pan) => pan.ridge))).toEqual(new Set(['x']));
  });

  it.each(['x', 'y'] as const)('gable impair %s reste exactement deux pans sans bande sommitale', (ridge) => {
    const footprint = [ridge === 'x' ? { x: 2, y: 2, w: 4, h: 3 } : { x: 2, y: 2, w: 3, h: 4 }];
    const out = buildRoofs(sceneWithMasses(mass({ ridge, footprint })));
    expect(out).toHaveLength(2);
    expect(new Set(out.map((pan) => pan.faces[0].material.part))).toEqual(
      ridge === 'x' ? new Set(['N', 'S']) : new Set(['O', 'E']),
    );
    expect(out.some((pan) => pan.faces[0].poly.every((point) => point.h === pan.faces[0].poly[0].h))).toBe(false);
  });

  it('deux masses jointives restent deux volumes intentionnels', () => {
    const out = buildRoofs(sceneWithMasses(
      mass({ id: 'aile-ouest', footprint: [{ x: 1, y: 2, w: 4, h: 2 }] }),
      mass({ id: 'pignon-central', footprint: [{ x: 5, y: 2, w: 2, h: 2 }] }),
    ));
    expect([...new Set(out.map((roof) => roof.sectionId))]).toEqual(['aile-ouest', 'pignon-central']);
  });

  it('unit et déduplique les parties rectangulaires d’une masse en L', () => {
    const out = buildRoofs(sceneWithMasses(mass({
      profile: 'flat',
      footprint: [
        { x: 2, y: 2, w: 1, h: 3 },
        { x: 2, y: 4, w: 3, h: 1 },
        { x: 2, y: 4, w: 1, h: 1 },
      ],
    })));
    const cells = new Set(out.flatMap((pan) => pan.cells.map((cell) => `${cell.x},${cell.y}`)));
    expect(cells).toEqual(new Set(['2,2', '2,3', '2,4', '3,4', '4,4']));
  });

  it.each([
    ['gable', 2],
    ['hip', 4],
    ['shed', 1],
    ['flat', 1],
  ] as const)('profile %s produit %s pans indépendants', (profile, count) => {
    const out = buildRoofs(sceneWithMasses(mass({ profile, ...(profile === 'shed' ? { eaveSide: 'N' as const } : {}) })));
    expect(out).toHaveLength(count);
    expect(new Set(out.map((pan) => pan.panId)).size).toBe(count);
    expect(out.every((pan) => pan.faces.length > 0)).toBe(true);
  });

  it('porte les ids relationnels et des bornes serrées par pan', () => {
    const out = buildRoofs(sceneWithMasses(mass()));
    expect(out.map(({ bodyId, sectionId }) => ({ bodyId, sectionId }))).toEqual([
      { bodyId: 'corps-principal', sectionId: 'toit-nef' },
      { bodyId: 'corps-principal', sectionId: 'toit-nef' },
    ]);
    expect(out.map((pan) => pan.span)).toEqual([{ w: 4, h: 1 }, { w: 4, h: 1 }]);
    const slopes = out.flatMap((pan) => pan.faces
      .filter((face) => ['N', 'E', 'S', 'O'].includes(face.material.part!))
      .flatMap((face) => face.poly.map((point) => point.h)));
    expect(Math.min(...slopes)).toBeCloseTo(4); // 1 niveau × WALL_H_M
    expect(Math.max(...slopes)).toBeCloseTo(6); // + 1 case de cross-portée × 2 m/case (pitchDeg=45, mpt=2)
  });

  it('la montée suit la portée LOCALE : une jupe étroite garde SA crête, jamais celle de l’aile large', () => {
    // Corps en L : bande large de 8 cases (y 0..3), jupe de 2 cases de large (y 4..9). Faîtage sur y,
    // donc la portée se lit en x, tranche de y par tranche de y (`localCrossSpans`, SOURCE UNIQUE de la
    // lecture de portée — la même qui choisit le profil d'une masse dérivée).
    const cells = new Set([...rect(0, 0, 8, 4), ...rect(0, 4, 2, 6)]);
    const shape: RoofShapeSpec = { profile: 'gable', ridge: 'y', pitch: 2, eaveHeightM: 4 };
    expect(riseAt({ x: 1, y: 7 }, cells, shape)).toBeCloseTo(2); // crête de la jupe : 1 case de montée
    expect(riseAt({ x: 2, y: 7 }, cells, shape)).toBeCloseTo(0); // son égout, au ras du mur de la jupe
    expect(riseAt({ x: 4, y: 2 }, cells, shape)).toBeCloseTo(8); // la bande large, elle, monte de 4 cases
  });

  it('une masse sur une case COTÉE pose sa nappe AU-DESSUS des murs de cette case, jamais en dessous', () => {
    // Bâtiment sur une butte / une terrasse : le mur s'assoit sur le relief de SA case (`buildWalls`
    // lit `heightAt`), l'égout doit lire la MÊME cote — sinon la nappe passe sous le sommet des murs.
    const scene = sceneWithMasses(mass());
    const butteM = 6;
    coter(scene, 0, butteM);
    const out = buildRoofs(scene);
    expect(out.length).toBeGreaterThan(0);
    const sommetDesMurs = butteM + WALL_H_M;
    for (const pan of out) {
      expect(pan.eaveHeightM).toBeCloseTo(sommetDesMurs);
      const hs = pan.faces
        .filter((face) => ['N', 'E', 'S', 'O'].includes(face.material.part!)) // les PANS ; l'avant-toit pend sous l'égout par construction
        .flatMap((face) => face.poly.map((point) => point.h));
      expect(Math.min(...hs)).toBeGreaterThanOrEqual(sommetDesMurs - 1e-9);
    }
  });

  it('une masse à ÉTAGE pose sa nappe AU-DESSUS des murs de son étage (jamais au plancher qu’elle coiffe)', () => {
    // Le geste de l'éditeur : « ajouter une masse » à l'étage 1 pose `levels: 1` (`state/sceneEdit.addBuildingMass`).
    const scene = sceneWithMasses(mass({ z: 1, levels: 1 }));
    scene.layers.push({ z: 1, tiles: new Array(144).fill('sol') });
    const plancherEtage = WALL_H_M; // l'étage repose sur le sommet des murs du rez
    coter(scene, 1, plancherEtage);
    const out = buildRoofs(scene);
    expect(out.length).toBeGreaterThan(0);
    for (const pan of out) {
      expect(pan.eaveHeightM).toBeCloseTo(plancherEtage + WALL_H_M);
      const hs = pan.faces
        .filter((face) => ['N', 'E', 'S', 'O'].includes(face.material.part!))
        .flatMap((face) => face.poly.map((point) => point.h));
      expect(Math.min(...hs)).toBeGreaterThanOrEqual(plancherEtage + WALL_H_M - 1e-9);
    }
  });

  it('roomZoneIds DÉRIVÉS (#823) : les zones intérieures que l’emprise recouvre, plus aucun champ authoré', () => {
    const scene = sceneWithMasses(mass());
    scene.effectZones = [{ id: 'salle', label: 'Salle', presentation: 'interior', z: 0, area: { kind: 'rect', x: 2, y: 2, w: 4, h: 2 } }];
    const out = buildRoofs(scene);
    expect(out.every((pan) => pan.roomZoneIds)).toBe(true);
    expect(new Set(out.flatMap((pan) => pan.roomZoneIds!))).toEqual(new Set(['salle']));
  });

  it.each(['x', 'y'] as const)('hip %s conserve quatre pans proportionnés autour du faîtage authoré', (ridge) => {
    const footprint = [ridge === 'x' ? { x: 2, y: 2, w: 6, h: 2 } : { x: 2, y: 2, w: 2, h: 6 }];
    const out = buildRoofs(sceneWithMasses(mass({ profile: 'hip', ridge, footprint })));
    expect(out).toHaveLength(4);
    expect(new Set(out.map((pan) => pan.ridge))).toEqual(new Set([ridge]));
    expect(Math.max(...out.flatMap((pan) => pan.faces.flatMap((face) => face.poly.map((point) => point.h))))).toBeCloseTo(6);
  });

  it.each(['x', 'y'] as const)('hip impair %s reste exactement quatre pans', (ridge) => {
    const footprint = [ridge === 'x' ? { x: 2, y: 2, w: 5, h: 3 } : { x: 2, y: 2, w: 3, h: 5 }];
    const out = buildRoofs(sceneWithMasses(mass({ profile: 'hip', ridge, footprint })));
    expect(out).toHaveLength(4);
    expect(new Set(out.map((pan) => pan.faces[0].material.part))).toEqual(new Set(['N', 'E', 'S', 'O']));
  });

  it.each([
    ['x', { x: 2, y: 2, w: 3, h: 5 }],
    ['y', { x: 2, y: 2, w: 5, h: 3 }],
  ] as const)('hip ridge %s pilote quatre pans même opposé au grand côté', (ridge, foot) => {
    const scene = sceneWithMasses(mass({ profile: 'hip', ridge, footprint: [foot] }));
    const out = buildRoofs(scene);
    const again = buildRoofs(scene);
    expect(out).toHaveLength(4);
    expect(new Set(out.map((pan) => pan.faces[0].material.part))).toEqual(new Set(['N', 'E', 'S', 'O']));
    expect(out.map(({ key, cell, span }) => ({ key, cell, span })))
      .toEqual(again.map(({ key, cell, span }) => ({ key, cell, span })));
  });

  it.each([
    ['x', { x: 2, y: 2, w: 1, h: 3 }],
    ['y', { x: 2, y: 2, w: 3, h: 1 }],
  ] as const)('hip mince ridge %s se ferme en apex sans pan dégénéré', (ridge, foot) => {
    const out = buildRoofs(sceneWithMasses(mass({ profile: 'hip', ridge, footprint: [foot] })));
    const area = (face: Face) => Math.abs(face.poly.reduce((sum, point, index) => {
      const next = face.poly[(index + 1) % face.poly.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0)) / 2;
    expect(out).toHaveLength(4);
    expect(out.every((pan) => area(pan.faces[0]) > 0)).toBe(true);
    expect(out.flatMap((pan) => pan.faces[0].poly).every((point) =>
      Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.h))).toBe(true);
  });

  it.each(['N', 'O'] as const)('shed %s applique la pente sur toute la portée transverse depuis l’égout déclaré', (eaveSide) => {
    const footprint = [eaveSide === 'N' ? { x: 2, y: 2, w: 4, h: 2 } : { x: 2, y: 2, w: 2, h: 4 }];
    const [pan] = buildRoofs(sceneWithMasses(mass({ profile: 'shed', ridge: undefined, eaveSide, footprint })));
    const heights = pan.faces
      .filter((face) => ['N', 'E', 'S', 'O'].includes(face.material.part!))
      .flatMap((face) => face.poly.map((point) => point.h));
    expect(Math.min(...heights)).toBeCloseTo(4);
    expect(Math.max(...heights)).toBeCloseTo(4 + 2 * 2); // portée 2 cases × 2 m/case (pitchDeg=45)
  });

  it('roofPans consomme RoofShapeSpec RÉSOLU (ridge tranché, pitch en m/case) au lieu de choisir depuis la boîte', () => {
    const shaped = roofPans(
      rect(0, 0, 4, 2),
      'tuile',
      3,
      { overhang: 0.3, fasciaDrop: 0.2 },
      { profile: 'gable', ridge: 'x', pitch: 0.5, eaveHeightM: 4 },
    );
    const slopes = shaped.faces.filter((face) => ['N', 'E', 'S', 'O'].includes(face.material.part!));
    expect(partsOf(slopes)).toEqual(['N', 'S']);
    expect(Math.min(...slopes.flatMap((face) => face.poly.map((point) => point.h)))).toBeCloseTo(4);
    expect(Math.max(...slopes.flatMap((face) => face.poly.map((point) => point.h)))).toBeCloseTo(4.5);
  });

  it('chaque pan authoré porte ses rangs et son volume de bord matériel', () => {
    const out = buildRoofs(sceneWithMasses(mass()));
    for (const pan of out) {
      expect(pan.lines.some((line) => line.kind === 'rang')).toBe(true);
      expect(pan.faces.some((face) => face.material.part === 'soffite')).toBe(true);
      expect(pan.faces.some((face) => face.material.part === 'fascia')).toBe(true);
    }
  });

  it('désactive le détail SVG coûteux d’une grande masse sans supprimer sa géométrie', () => {
    const out = buildRoofs(sceneWithMasses(mass({
      footprint: [{ x: 1, y: 1, w: 10, h: 8 }],
    })));
    expect(out).toHaveLength(2);
    expect(out.every((pan) => pan.simplifiedCourses)).toBe(true);
    expect(out.every((pan) => pan.lines.some((line) => line.kind === 'rang'))).toBe(true);
  });

  // ── DÉGAGEMENT (#818) à l'échelle de l'ESPACE HABITÉ ────────────────────────────────────────────
  // Le découpage en TRAVÉES (#829) est une vérité de SILHOUETTE : une pièce se couvre de plusieurs
  // travées. Le dégagement, lui, se mesure en PIÈCES — entrer dans une salle ouvre la salle, pas la
  // bande de charpente sous laquelle on a posé le pied.
  /** Deux travées côte à côte formant UNE aile, et une PIÈCE (`salle`) qui les traverse toutes deux. */
  const aileDeuxTravees = (): Scene => {
    const scene = sceneWithMasses(
      mass({ id: 'travee-nord', footprint: [{ x: 2, y: 2, w: 6, h: 2 }] }),
      mass({ id: 'travee-sud', footprint: [{ x: 2, y: 4, w: 6, h: 2 }] }),
    );
    scene.effectZones = [
      { id: 'salle', label: 'Salle', presentation: 'interior', z: 0, area: { kind: 'rect', x: 2, y: 2, w: 6, h: 4 } },
    ];
    return scene;
  };
  const massesLevees = (scene: Scene, allies: { x: number; y: number; z?: number }[]) =>
    new Set(buildRoofs(scene, { allies }).filter((pan) => pan.states.roofOccupied).map((pan) => pan.sectionId));

  it('dégage la PIÈCE ENTIÈRE : un allié dans la salle lève TOUTES les travées qui la couvrent', () => {
    const scene = aileDeuxTravees();
    // L'allié est posé dans la travée NORD ; la travée SUD couvre la MÊME salle et se lève avec elle.
    expect(massesLevees(scene, [{ x: 4, y: 2, z: 0 }])).toEqual(new Set(['travee-nord', 'travee-sud']));
    // Et la nappe se lève d'un bloc : jamais un pan levé pendant que son jumeau reste posé.
    const pans = buildRoofs(scene, { allies: [{ x: 4, y: 2, z: 0 }] });
    expect(pans.every((pan) => pan.states.roofOccupied)).toBe(true);
  });

  it('ne FUITE pas d’un corps à l’autre : être dans l’auberge ne lève pas le toit des écuries d’en face', () => {
    const scene = sceneWithMasses(
      mass({ id: 'auberge', footprint: [{ x: 1, y: 1, w: 4, h: 3 }] }),
      mass({ id: 'ecuries', footprint: [{ x: 7, y: 1, w: 4, h: 3 }] }),
    );
    scene.effectZones = [
      { id: 'salle', label: 'Salle', presentation: 'interior', z: 0, area: { kind: 'rect', x: 1, y: 1, w: 4, h: 3 } },
      { id: 'box', label: 'Box', presentation: 'interior', z: 0, area: { kind: 'rect', x: 7, y: 1, w: 4, h: 3 } },
    ];
    expect(massesLevees(scene, [{ x: 2, y: 2, z: 0 }])).toEqual(new Set(['auberge']));
    expect(massesLevees(scene, [{ x: 8, y: 2, z: 0 }])).toEqual(new Set(['ecuries']));
  });

  it('ne dégage pas un COMBLE qu’on ne visite pas : l’étage garde son toit quand on est au rez', () => {
    const scene = sceneWithMasses(
      mass({ id: 'toit-du-rez', z: 0, levels: 1, footprint: [{ x: 1, y: 1, w: 4, h: 3 }] }),
      mass({ id: 'toit-du-comble', z: 1, levels: 1, footprint: [{ x: 6, y: 1, w: 4, h: 3 }] }),
    );
    addLayer(scene, 1);
    scene.effectZones = [
      { id: 'salle-rez', label: 'Salle', presentation: 'interior', z: 0, area: { kind: 'rect', x: 1, y: 1, w: 4, h: 3 } },
      { id: 'comble', label: 'Comble', presentation: 'interior', z: 1, area: { kind: 'rect', x: 6, y: 1, w: 4, h: 3 } },
    ];
    expect(massesLevees(scene, [{ x: 2, y: 2, z: 0 }])).toEqual(new Set(['toit-du-rez']));
    expect(massesLevees(scene, [{ x: 7, y: 2, z: 1 }])).toEqual(new Set(['toit-du-comble']));
  });

  it('ALLIÉ HORS PIÈCE (bâti non zoné) : la masse se lève ENTIÈRE sous ses pieds, à son niveau seul', () => {
    // Aucune zone intérieure ne couvre ce bâti : l'espace habité de la masse EST son emprise.
    const scene = sceneWithMasses(mass({ id: 'hangar', footprint: [{ x: 2, y: 2, w: 6, h: 4 }] }));
    const dedans = buildRoofs(scene, { allies: [{ x: 3, y: 3, z: 0 }] });
    expect(dedans.every((pan) => pan.states.roofOccupied)).toBe(true); // la NAPPE, pas le pan piétiné
    expect(massesLevees(scene, [{ x: 3, y: 3, z: 1 }])).toEqual(new Set()); // niveau non couvert
  });

  it('ALLIÉ DEHORS, ou aucun allié : la toiture reste posée', () => {
    const scene = aileDeuxTravees();
    expect(massesLevees(scene, [{ x: 0, y: 0, z: 0 }])).toEqual(new Set());
    expect(buildRoofs(scene).every((pan) => !pan.states.roofOccupied)).toBe(true);
  });

  /** Travées de charpente de la carte VIVANTE, et un POSTE d'observation sous chacune : une case de
   *  son emprise, à un niveau qu'elle couvre. Aucune déclaration de zone n'entre ici — l'auteur
   *  déclare ce qui est à ciel ouvert, plus ce qui est bâti (#881). */
  const traveesDeLaDiligence = () => {
    const carte = diligenceCampaign.scenes[0];
    const masses = effectiveArchitecture(carte)
      .flatMap((corps) => corps.masses.map((masse) => ({ masse, cells: massFootprintCells(masse.footprint) })));
    const postes = masses.map(({ masse, cells }) => {
      const [key] = [...cells];
      const [x, y] = key.split(',').map(Number);
      return { x, y, z: masse.z };
    });
    return { carte, masses, postes };
  };

  it('CHEMIN RÉEL (La Diligence) : sous CHAQUE travée, aucun morceau de toit ne reste sur la tête de l’allié', () => {
    // La carte que l'auteur édite, telle qu'elle est le jour du test. On se poste sous chacune de ses
    // travées : toute masse qui recouvre la case où l'allié se tient doit se lever — sans quoi le
    // joueur regarde son bâtiment par un trou. Le contrat vaut pour le bâti nu comme pour la pièce
    // nommée : il ne tient à aucune zone déclarée.
    const { carte, masses, postes } = traveesDeLaDiligence();
    expect(masses.length).toBeGreaterThan(0);
    const restees: string[] = [];
    postes.forEach((poste) => {
      const levees = new Set(buildRoofs(carte, { allies: [poste] })
        .filter((pan) => pan.states.roofOccupied)
        .map((pan) => pan.sectionId));
      for (const { masse, cells } of masses) {
        const couvre = cells.has(`${poste.x},${poste.y}`) && poste.z >= masse.z - masse.levels + 1 && poste.z <= masse.z;
        if (couvre && !levees.has(masse.id)) restees.push(`${poste.x},${poste.y}@z${poste.z}/${masse.id}`);
      }
    });
    expect(restees).toEqual([]);
  });

  it('CHEMIN RÉEL : l’espace ouvert est l’union EXACTE des travées de l’espace habité (ni trou, ni fuite)', () => {
    // La carte de l'auteur est une donnée VIVANTE : on n'y mesure que des RELATIONS, jamais un compte
    // figé ni la présence d'une déclaration. L'ESPACE HABITÉ de l'allié se lit du modèle
    // (`clearedSpace` : sa pièce quand il en a une, l'emprise qui l'abrite sinon), et les travées
    // attendues sont celles dont l'espace touche le sien — une de moins, le joueur regarde sa salle
    // par un trou ; une de plus, le dégagement fuit vers un corps voisin.
    const { carte, masses, postes } = traveesDeLaDiligence();
    const attendues = (poste: { x: number; y: number; z: number }) => {
      const cleared = clearedSpace(carte, [poste]);
      const degagees = new Set<string>(cleared.roomlessCells);
      for (const cells of cleared.zoneCells.values()) for (const key of cells) degagees.add(key);
      return masses.filter(({ masse, cells }) => massSpaceCells(masse, cells).some((key) => degagees.has(key)));
    };
    // On entre là où le PLUS de travées partagent l'espace habité : c'est là que se voit la confusion
    // « travée piétinée » vs « espace habité ».
    const [poste] = [...postes].sort((a, b) => attendues(b).length - attendues(a).length);
    const couvrantes = attendues(poste);
    expect(couvrantes.length).toBeGreaterThan(0);
    const pans = buildRoofs(carte, { allies: [poste] }).filter((pan) => pan.states.roofOccupied);
    expect(new Set(pans.map((pan) => pan.sectionId))).toEqual(new Set(couvrantes.map(({ masse }) => masse.id)));
    expect(new Set(pans.flatMap((pan) => pan.cells.map((cell) => `${cell.x},${cell.y}`))))
      .toEqual(new Set(couvrantes.flatMap(({ cells }) => [...cells])));
  });

  it('visible : une masse de toit est l’ENVELOPPE du bâtiment, TOUJOURS visible (#818)', () => {
    const scene = sceneWithMasses(mass());
    expect(buildRoofs(scene).every((pan) => pan.states.visible)).toBe(true);
  });

  it('résout le matériau du catalogue par id : la RECETTE du def pilote la géométrie, l’élément porte l’id authoré', () => {
    const chaume = buildRoofs(sceneWithMasses(mass({ material: 'chaume' })));
    expect(chaume.every((pan) => pan.material === 'chaume')).toBe(true); // id authoré conservé tel quel
    expect(roofMaterial('chaume').eaveOverhangM).toBeGreaterThan(0);
    expect(chaume.every((pan) => pan.faces.some((f) => f.material.part === 'soffite'))).toBe(true);

    // Id absent du registre : REPLI VISIBLE (#877) — la couverture résout l'entrée d'alarme, peinte au
    // ton criard sur tous ses pans, tandis que l'élément porte l'id BRUT pour nommer la donnée fautive.
    const inconnu = buildRoofs(sceneWithMasses(mass({ material: 'introuvable' })));
    expect(inconnu.every((pan) => pan.material === 'introuvable')).toBe(true);
    const alarme = roofMaterial('introuvable');
    expect(alarme.id).toBe(MISSING_ID);
    expect([alarme.N, alarme.E, alarme.S, alarme.O]).toEqual([MISSING_TONE, MISSING_TONE, MISSING_TONE, MISSING_TONE]);
  });
});

describe('resolveMass / massRoomZoneIds — dérivation partagée (#823)', () => {
  it('résout le ridge par défaut au LONG axe, et le pitch en m/case (metresPerTile × tan(pitchDeg))', () => {
    const scene = emptyScene(10, 10);
    scene.metresPerTile = 3;
    const { shape } = resolveMass(scene, {
      id: 'm', z: 0, footprint: [{ x: 0, y: 0, w: 6, h: 2 }], levels: 1, profile: 'gable', pitchDeg: 45, material: 'tuile',
    });
    expect(shape.ridge).toBe('x');
    expect(shape.pitch).toBeCloseTo(3); // tan(45°)=1 × metresPerTile=3
    expect(shape.eaveHeightM).toBeCloseTo(WALL_H_M);
  });

  it('l’égout lit le RELIEF sous l’emprise, jamais une cote déduite de l’index d’étage (`levels` n’y entre pas)', () => {
    const scene = emptyScene(10, 10);
    scene.layers.push({ z: 1, tiles: new Array(100).fill('sol') });
    const at = (z: number, levels: number) =>
      resolveMass(scene, { id: 'm', z, footprint: [{ x: 0, y: 0, w: 2, h: 2 }], levels, profile: 'flat', pitchDeg: 30, material: 'tuile' }).shape.eaveHeightM;
    coter(scene, 1, WALL_H_M); // couche d'étage cotée au sommet des murs du rez
    expect(at(1, 1)).toBeCloseTo(2 * WALL_H_M);
    expect(at(1, 1)).toBeCloseTo(at(1, 2)); // `levels` compte les niveaux couverts, pas une hauteur
    // BUTTE : la MÊME masse, au MÊME étage, monte avec le relief de ses cases.
    coter(scene, 0, 6);
    expect(at(0, 1)).toBeCloseTo(6 + WALL_H_M);
  });

  it('emprise NON PLANE : l’égout se prend au point HAUT — aucun mur porté n’est traversé', () => {
    const scene = emptyScene(10, 10);
    coter(scene, 0, WALL_H_M, [{ x: 0, y: 0 }]); // marche haute sous l'emprise (cage d'escalier, terrasse)
    const { shape } = resolveMass(scene, { id: 'm', z: 0, footprint: [{ x: 0, y: 0, w: 2, h: 2 }], levels: 1, profile: 'flat', pitchDeg: 30, material: 'tuile' });
    expect(shape.eaveHeightM).toBeCloseTo(WALL_H_M + WALL_H_M);
    // RÉFUTATION du point BAS : l'égout y serait à `WALL_H_M`, soit la cote du PLANCHER de la case
    // haute — la nappe traverserait son mur de bout en bout.
    expect(shape.eaveHeightM).toBeGreaterThan(WALL_H_M);
  });

  it('massRoomZoneIds : zones intérieures recouvertes par l’emprise, sur toute la plage de niveaux (z − levels + 1 … z)', () => {
    const scene = emptyScene(10, 10);
    scene.layers.push({ z: 1, tiles: new Array(100).fill('vide') });
    scene.effectZones = [
      { id: 'bas', label: 'Bas', presentation: 'interior', z: 0, area: { kind: 'rect', x: 0, y: 0, w: 2, h: 2 } },
      { id: 'haut', label: 'Haut', presentation: 'interior', z: 1, area: { kind: 'rect', x: 0, y: 0, w: 2, h: 2 } },
      { id: 'dehors', label: 'Cour', presentation: 'exterior', z: 0, area: { kind: 'rect', x: 5, y: 5, w: 2, h: 2 } },
    ];
    const mass: BuildingMass = { id: 'm', z: 1, footprint: [{ x: 0, y: 0, w: 2, h: 2 }], levels: 2, profile: 'flat', pitchDeg: 30, material: 'tuile' };
    const cells = new Set(['0,0', '0,1', '1,0', '1,1']);
    expect(new Set(massRoomZoneIds(scene, mass, cells))).toEqual(new Set(['bas', 'haut']));
  });
});

describe('gableEnds — géométrie PURE du triangle de pignon (emprise réelle + pente, aucune donnée nouvelle)', () => {
  const shape = (patch: Partial<RoofShapeSpec> = {}): RoofShapeSpec => ({
    profile: 'gable',
    ridge: 'x',
    pitch: 0.5,
    eaveHeightM: 4,
    ...patch,
  });

  it('un toit gable produit EXACTEMENT deux pignons, un par extrémité du faîtage', () => {
    const ends = gableEnds(rect(0, 0, 4, 2), shape());
    expect(ends).toHaveLength(2);
  });

  it('chaque pignon est un TRIANGLE : base à la hauteur d’ÉGOUT, sommet à la hauteur de FAÎTAGE', () => {
    const ends = gableEnds(rect(0, 0, 4, 2), shape({ eaveHeightM: 4, pitch: 0.5 }));
    for (const end of ends) {
      expect(end.poly).toHaveLength(3);
      const heights = end.poly.map((p) => p.h).sort((a, b) => a - b);
      expect(heights[0]).toBeCloseTo(4); // base = égout
      expect(heights[1]).toBeCloseTo(4); // les DEUX coins de base à l'égout
      expect(heights[2]).toBeCloseTo(4 + 0.5); // sommet = faîtage (crossHalf=1 · pitch)
    }
  });

  it('ridge "y" ferme les pignons Nord/Sud plutôt qu’Est/Ouest — même contrat de hauteurs', () => {
    const ends = gableEnds(rect(0, 0, 2, 4), shape({ ridge: 'y' }));
    expect(ends).toHaveLength(2);
    for (const end of ends) {
      const heights = end.poly.map((p) => p.h).sort((a, b) => a - b);
      expect(heights[0]).toBeCloseTo(4);
      expect(heights[2]).toBeCloseTo(4.5);
    }
  });

  it('un toit hip ou flat ne ferme AUCUN pignon (les rampants rejoignent déjà chaque bord)', () => {
    expect(gableEnds(rect(0, 0, 4, 2), shape({ profile: 'hip' }))).toEqual([]);
    expect(gableEnds(rect(0, 0, 4, 2), shape({ profile: 'flat' }))).toEqual([]);
  });

  it('un toit shed ferme deux pignons en triangle RECTANGLE (mono-pente, pas de sommet centré)', () => {
    const ends = gableEnds(rect(0, 0, 4, 2), shape({ profile: 'shed', eaveSide: 'N' }));
    expect(ends).toHaveLength(2);
    for (const end of ends) {
      expect(end.poly).toHaveLength(3);
      const heights = end.poly.map((p) => p.h);
      expect(Math.min(...heights)).toBeCloseTo(4); // bas côté égout
      expect(Math.max(...heights)).toBeCloseTo(4 + 2 * 0.5); // haut côté faîte (portée 2 · pente)
      expect(heights.filter((h) => Math.abs(h - Math.min(...heights)) < 1e-9)).toHaveLength(2); // base plate
    }
  });

  it('une aile plus étroite que la bbox globale ferme un pignon à SA largeur réelle, pas la bbox', () => {
    const L = new Set([...rect(0, 0, 4, 2), ...rect(0, 2, 2, 2)]); // L : l'extrémité x=4 n'a que la rangée y∈[0,2)
    const ends = gableEnds(L, shape({ eaveHeightM: 0, pitch: 0.5 }));
    const east = ends.find((end) => end.poly.every((p) => p.x === 3.5))!;
    expect(east).toBeTruthy();
    expect(east.poly.map((p) => p.y).sort((a, b) => a - b)).toEqual([-0.5, 0.5, 1.5]); // largeur 2, pas 4
  });

  it('aucune cellule → aucun pignon (déterministe)', () => {
    expect(gableEnds(new Set(), shape())).toEqual([]);
  });

  it('l’arête prolongée est celle qui PORTE le pignon, aux DEUX extrémités', () => {
    // Faîtage x sur [2,6[ : les deux plans de pignon sont en x=1,5 et x=5,5 — soit le côté 'E' des
    // cases x=1 et x=5. C'est là que le pignon lit sa matière et prend sa profondeur de tri.
    const ends = gableEnds(rect(2, 2, 4, 2), shape());
    expect(ends.map((end) => end.edges.map((e) => `${e.x},${e.y},${e.side}`))).toEqual([
      ['1,2,E', '1,3,E'],
      ['5,2,E', '5,3,E'],
    ]);
    for (const end of ends) {
      const plane = new Set(end.poly.map((p) => p.x));
      expect(plane.size).toBe(1); // le pignon est un PLAN vertical…
      expect([...plane][0]).toBe(end.edges[0].x + 0.5); // …posé sur l'arête qu'il prolonge
    }
  });

  it('ridge "y" prolonge des arêtes NORD, elles aussi de part et d’autre du volume', () => {
    const ends = gableEnds(rect(2, 2, 2, 4), shape({ ridge: 'y' }));
    expect(ends.map((end) => end.edges.map((e) => `${e.x},${e.y},${e.side}`))).toEqual([
      ['2,2,N', '3,2,N'],
      ['2,6,N', '3,6,N'],
    ]);
  });

  it('une extrémité PARTIELLEMENT jointive ferme le RESTE, case par case', () => {
    // Extrémité est (x=6) large de 3 cases ; la case au-delà de y=3 est déjà couverte par une autre
    // nappe. Le verdict est PAR CASE : seule celle-là se saute, les deux autres se ferment.
    const cells = rect(2, 2, 4, 3);
    const joint = (x: number, y: number) => x === 6 && y === 3;
    const ends = gableEnds(cells, shape(), joint);
    const est = ends.filter((end) => end.edges[0].x === 5);
    expect(est.flatMap((end) => end.inside.map((c) => `${c.x},${c.y}`))).toEqual(['5,2', '5,4']);
    expect(est).toHaveLength(2); // deux tronçons OUVERTS distincts, séparés par la jointure
  });

  it('une extrémité ENTIÈREMENT jointive ne ferme rien (le toit continue)', () => {
    const ends = gableEnds(rect(2, 2, 4, 2), shape(), (x) => x === 6);
    expect(ends.map((end) => end.edges[0].x)).toEqual([1]); // seul le bout ouest reste
  });

  it('un versant DROIT ne coûte pas un sommet par case : un pignon large reste un triangle', () => {
    const ends = gableEnds(rect(0, 0, 4, 6), shape({ ridge: 'x' }));
    for (const end of ends) expect(end.poly).toHaveLength(3);
  });
});

describe('fermetures de comble — pièces de la NAPPE : matière du mur prolongé, sort de leur toit', () => {
  const mass = (patch: Partial<BuildingMass> = {}): BuildingMass => ({
    id: 'nef', z: 0, footprint: [{ x: 2, y: 2, w: 4, h: 2 }], levels: 1,
    profile: 'gable', ridge: 'x', pitchDeg: 45, material: 'tuile', ...patch,
  });
  /** Murs SOUS les deux arêtes de pignon d'une masse (2,2,4×2) : côté 'E' des colonnes x=1 et x=5. */
  const carryingWalls = (structure: string): WallSeg[] =>
    [1, 5].flatMap((x) => [2, 3].map((y) => ({ x, y, side: 'E' as const, structure })));
  const sceneWith = (masses: BuildingMass[], walls: WallSeg[] = []): Scene => {
    const scene = emptyScene(16, 16);
    scene.walls = walls;
    scene.architecture = [{ id: 'corps', style: 'maison', storeys: [], facades: [], masses }];
    return scene;
  };
  const closures = (scene: Scene) => buildRoofs(scene).filter((el) => el.panId?.startsWith('pignon-'));

  it('une nappe à deux pentes ferme ses DEUX extrémités, en pièces de la nappe (jamais des murs)', () => {
    const els = closures(sceneWith([mass()], carryingWalls('mur-a-ossature-en-bois')));
    expect(els).toHaveLength(2);
    for (const el of els) {
      expect(el.sectionId).toBe('nef'); // MÊME masse que ses pans : même identité, donc même sort
      expect(el.faces).toHaveLength(1);
      expect(el.faces[0].poly).toHaveLength(3);
      expect(el.faces[0].material.domain).toBe('structure'); // matière de MUR, jamais de couverture
    }
  });

  it('le pignon prend la matière du MUR qu’il prolonge — un corps à colombage a des pignons à colombage', () => {
    const els = closures(sceneWith([mass({ material: 'toit-ardoise' })], carryingWalls('mur-a-ossature-en-bois')));
    expect(els).toHaveLength(2);
    for (const el of els) {
      expect(el.faces[0].material.id).toBe('mur-a-ossature-en-bois');
      expect(el.faces[0].material.id).not.toBe('toit-ardoise'); // ni la couverture…
      expect(el.faces[0].material.id).not.toBe('mur-en-pierre'); // …ni un repli sur un id en dur (#877)
    }
  });

  it('la matière suit le mur, pas la hauteur : changer le mur porteur change le pignon', () => {
    const seche = closures(sceneWith([mass()], carryingWalls('mur-en-pierres-seches')));
    expect(new Set(seche.map((el) => el.faces[0].material.id))).toEqual(new Set(['mur-en-pierres-seches']));
  });

  it('sans mur SOUS l’arête, la matière se lit sur les murs du VOLUME que la masse enferme', () => {
    // Aucun mur sur les arêtes de pignon (x=1 et x=5) : seulement une façade latérale du volume.
    const lateral: WallSeg[] = [2, 3, 4, 5].map((x) => ({ x, y: 2, side: 'N' as const, structure: 'mur-en-bois' }));
    const els = closures(sceneWith([mass()], lateral));
    expect(els).toHaveLength(2);
    for (const el of els) expect(el.faces[0].material.id).toBe('mur-en-bois');
  });

  it('volume MUET : la matière se lit alors sur le CORPS entier — un pignon prolonge SON bâtiment', () => {
    // La masse `nef` (2..5, 2..3) ne borde AUCUN mur ; c'est l'autre masse du MÊME corps qui en porte,
    // hors de son emprise. La 4ᵉ lecture de `closureAppearance` est le seul chemin qui reste.
    const loin: WallSeg[] = [10, 11].map((x) => ({ x, y: 10, side: 'N' as const, structure: 'mur-en-pierres-seches' }));
    const els = closures(sceneWith(
      [mass(), mass({ id: 'aile', footprint: [{ x: 10, y: 10, w: 2, h: 1 }], profile: 'flat' })],
      loin,
    ));
    expect(els).toHaveLength(2);
    for (const el of els) expect(el.faces[0].material.id).toBe('mur-en-pierres-seches');
  });

  it('un corps SANS aucun mur n’a pas de bâti à prolonger : aucune fermeture inventée', () => {
    expect(closures(sceneWith([mass()]))).toHaveLength(0);
  });

  it('une nappe hip ne ferme aucune extrémité (les rampants rejoignent déjà chaque bord)', () => {
    expect(closures(sceneWith([mass({ profile: 'hip' })], carryingWalls('mur-en-bois')))).toHaveLength(0);
  });

  it('deux masses JOINTIVES ne ferment pas leur jointure, mais bien leurs bouts extérieurs', () => {
    const walls: WallSeg[] = [1, 5, 9].flatMap((x) => [2, 3].map((y) => ({ x, y, side: 'E' as const, structure: 'mur-en-bois' })));
    const els = closures(sceneWith([
      mass({ id: 'ouest', footprint: [{ x: 2, y: 2, w: 4, h: 2 }] }),
      mass({ id: 'est', footprint: [{ x: 6, y: 2, w: 4, h: 2 }] }),
    ], walls));
    expect(els).toHaveLength(2);
    expect(els.map((el) => el.faces[0].poly[0].x).sort((a, b) => a - b)).toEqual([1.5, 9.5]);
  });

  it('le pignon SUIT le sort de sa nappe : dégagée, elle emporte ses fermetures', () => {
    const scene = sceneWith([mass()], carryingWalls('mur-en-bois'));
    const dedans = buildRoofs(scene, { allies: [{ x: 3, y: 2, z: 0 }] });
    const pans = dedans.filter((el) => !el.panId?.startsWith('pignon-'));
    const pignons = dedans.filter((el) => el.panId?.startsWith('pignon-'));
    expect(pans.every((el) => el.states.roofOccupied)).toBe(true);
    expect(pignons).toHaveLength(2);
    expect(pignons.every((el) => el.states.roofOccupied)).toBe(true); // jamais un pignon qui reste seul
    // Personne dedans : la nappe ET ses pignons restent posés.
    expect(buildRoofs(scene).every((el) => !el.states.roofOccupied)).toBe(true);
  });
});

/**
 * #947 — FAÎTAGE D'UNE PORTÉE IMPAIRE sur une emprise irrégulière. Le pavage n'échantillonne la
 * montée qu'aux sommets ENTIERS : quand le faîtage tombe ENTRE deux sommets, la nappe s'aplatit en
 * une bande horizontale, peinte comme une face à part — la « facette claire qui ne suit pas la
 * pente ». Contrat POSITIF : le faîte monte à la DEMI-portée réelle, et aucune face n'est plate.
 */
describe('roofPans — le faîtage d’une portée IMPAIRE ne s’aplatit pas en bande (#947)', () => {
  // Corps de 5 cases de profondeur (portée IMPAIRE : faîtage à 2,5 cases du bord, ENTRE deux sommets
  // de grille) prolongé d'une aile plus étroite — emprise non rectangulaire, donc pavage cellule par
  // cellule, celui qui rate le faîtage.
  const enL = new Set([...rect(0, 0, 12, 5), ...rect(5, 5, 1, 3)]);
  const forme = (profile: RoofShapeSpec['profile']): RoofShapeSpec =>
    ({ profile, ridge: 'x', pitch: S, eaveHeightM: 0 });

  it('le faîte atteint la DEMI-portée réelle, pas le sommet de grille en dessous', () => {
    const hs = roofPans(enL, 'tuile', undefined, undefined, forme('hip')).faces.flatMap((f) => f.poly.map((p) => p.h));
    expect(Math.max(...hs)).toBeCloseTo(2.5 * S, 9);
  });

  it('aucune face de la nappe n’est HORIZONTALE — chaque pan suit une pente, et reste PLAN', () => {
    for (const profile of ['hip', 'gable'] as const) {
      const { faces } = roofPans(enL, 'tuile', undefined, undefined, forme(profile));
      expect(faces.filter((f) => f.poly.every((p) => Math.abs(p.h - f.poly[0].h) < 1e-9))).toEqual([]);
      for (const f of faces) expect(isPlanar(f)).toBe(true);
    }
  });

  it('la lecture CONTINUE de la profondeur de croupe est celle du BFS aux sommets ENTIERS', () => {
    // Une seule vérité de croupe : le pavage insère les sommets qu'il veut, il lit le MÊME toit.
    const shape = forme('hip');
    const segs = boundarySegs(enL);
    for (const key of enL) {
      const [x, y] = key.split(',').map(Number);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
        const v = { x: x + dx, y: y + dy };
        expect(depthToEave(v, segs) * S).toBeCloseTo(riseAt(v, enL, shape), 9);
      }
    }
  });
});

/**
 * #947 — mesure de la NAPPE elle-même (pas de la donnée qui la décrit) : la hauteur de comble se lit
 * sommet par sommet par `riseAt`, la formule que le rendu consomme. Sur un corps que l'auteur n'a pas
 * pentu, le faîte ne dépasse jamais la borne, quelle que soit la profondeur du corps.
 */
describe('toiture dérivée — le comble mesuré au SOMMET tient sous la borne (#947)', () => {
  /** Corps clos SANS masse ni pente authorées : profil, pente et emprise se dérivent tous du plan. */
  const corps = (profondeur: number): Scene => {
    const scene = emptyScene(36, 36);
    scene.architecture = [{ id: 'corps', style: 'maison', storeys: [], facades: [], masses: [] }];
    return encloseRect(scene, { x: 2, y: 2, w: profondeur, h: 28 });
  };

  /** Faîte RÉEL d'une masse : la plus haute cote de sommet de son emprise, hauteur d'égout comprise. */
  const faiteM = (scene: Scene, mass: BuildingMass): { egout: number; faite: number } => {
    const { cells, shape } = resolveMass(scene, mass);
    let faite = -Infinity;
    for (const key of cells) {
      const [x, y] = key.split(',').map(Number);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const)
        faite = Math.max(faite, shape.eaveHeightM + riseAt({ x: x + dx, y: y + dy }, cells, shape));
    }
    return { egout: shape.eaveHeightM, faite };
  };

  it('de l’aile étroite au corps le plus profond, le comble reste sous un étage de bâti', () => {
    for (const profondeur of [3, 6, 10, 16, 22]) {
      const scene = corps(profondeur);
      const borne = scene.roofDefaults.riseMaxStoreys * WALL_H_M;
      const masses = effectiveArchitecture(scene).flatMap((body) => body.masses);
      expect(masses).toHaveLength(1);
      const { egout, faite } = faiteM(scene, masses[0]);
      expect(faite - egout).toBeLessThanOrEqual(borne + 1e-9);
      expect(faite).toBeGreaterThan(egout); // une nappe, pas une dalle
    }
  });
});

describe('buildRoofs — le PLAN est la source des masses dérivées (#841)', () => {
  /** Corps sans masse authorée : toute sa toiture se dérive de `roofDefaults` + du plan. */
  const planScene = (): Scene => {
    const scene = emptyScene(12, 12);
    scene.architecture = [{
      id: 'corps',
      style: 'maison',
      storeys: [],
      facades: [],
      masses: [],
      roofDefaults: { profile: 'gable', pitchDeg: 30, material: 'tuile' },
    }];
    return encloseRect(scene, { x: 1, y: 1, w: 4, h: 2 });
  };

  const cellsOf = (scene: Scene, z?: number) => new Set(buildRoofs(scene)
    .filter((el) => z === undefined || el.cell.z === z)
    .flatMap((el) => el.cells.map((c) => `${c.x},${c.y}`)));

  it('couvre la pièce du rez sans masse authorée ni matérialisation préalable', () => {
    expect(cellsOf(planScene())).toEqual(rect(1, 1, 4, 2));
  });

  it('suit une pièce AJOUTÉE au rez sur une scène déjà matérialisée, sans toucher l’intention de toiture', () => {
    const compilee = rederiveRoofMasses(planScene()); // état laissé par `buildScene`/l'inspecteur
    expect(cellsOf(compilee)).toEqual(rect(1, 1, 4, 2));
    const apres = encloseRect(compilee, { x: 6, y: 5, w: 3, h: 2 });
    expect(cellsOf(apres)).toEqual(new Set([...rect(1, 1, 4, 2), ...rect(6, 5, 3, 2)]));
  });

  it('suit une case BÂTIE à l’étage (couche z=1 peinte) sur une scène déjà matérialisée', () => {
    let scene = rederiveRoofMasses(planScene());
    scene = fillTerrainRect(addLayer(scene, 1), { x: 1, y: 1, w: 4, h: 2 }, 'pierre', 1);
    expect(cellsOf(scene, 0)).toEqual(new Set()); // l'étage coiffe les deux niveaux : plus de toit au rez
    expect(cellsOf(scene, 1)).toEqual(rect(1, 1, 4, 2));
    const agrandi = paintTiles(scene, { x: 5, y: 1 }, 'pierre', 1, 1);
    expect(cellsOf(agrandi, 1)).toEqual(new Set([...rect(1, 1, 4, 2), '5,1']));
  });

  it('préserve une masse AUTHORÉE : le plan ne la déplace ni ne la remplace', () => {
    const authoree: BuildingMass = {
      id: 'toit-authore', z: 0, footprint: [{ x: 1, y: 1, w: 4, h: 2 }], levels: 1,
      profile: 'flat', pitchDeg: 45, material: 'chaume',
    };
    const scene = planScene();
    scene.architecture![0].masses = [authoree];
    const apres = encloseRect(scene, { x: 6, y: 5, w: 3, h: 2 });
    const parMasse = new Map(buildRoofs(apres).map((el) => [el.sectionId, el.material]));
    expect(parMasse.get('toit-authore')).toBe('chaume');
    expect(cellsOf(apres)).toEqual(new Set([...rect(1, 1, 4, 2), ...rect(6, 5, 3, 2)]));
  });
});

/**
 * #1186 — GROUPE DE NAPPE. Les masses d'un même corps, au même `z`, de même égout MESURÉ, dont les
 * cellules sont 4-adjacentes et qui peuvent partager une pente (`mayShareNappe` : ici trois croupes
 * de MÊME pente authorée) lisent UN champ de hauteur sur l'UNION de leurs emprises : chacune pave SES
 * cellules (identité, cutaway, exclusions intactes) mais la hauteur y est celle du champ commun — au
 * joint le versant CONTINUE et le BFS ouvre la noue, au lieu de deux nappes qui retombent chacune à
 * l'égout. Les traitements d'EXTRÉMITÉ restent par masse : les pignons d'un corps central à versants
 * droits se mesurent sur La Diligence RÉELLE (describe suivant), dont les masses sont dérivées.
 */
describe('groupe de nappe — un champ de hauteur sur le domaine UNION (#1186)', () => {
  const AILE_O = { x: 0, y: 4, w: 8, h: 8 };
  const AILE_E = { x: 12, y: 4, w: 8, h: 8 };
  const CENTRE = { x: 8, y: 0, w: 4, h: 12 }; // corps ÉTROIT perpendiculaire : ses BOUTS restent libres

  const trio = (): Scene => {
    const scene = emptyScene(24, 20);
    scene.walls = perimeterWallSegs([AILE_O, AILE_E, CENTRE]);
    scene.architecture = [{
      id: 'corps', style: 'maison', storeys: [], facades: [],
      masses: [
        { id: 'aile-o', z: 0, footprint: [AILE_O], levels: 1, profile: 'hip', pitchDeg: 45, material: 'tuile' },
        { id: 'aile-e', z: 0, footprint: [AILE_E], levels: 1, profile: 'hip', pitchDeg: 45, material: 'tuile' },
        { id: 'centre', z: 0, footprint: [CENTRE], levels: 1, profile: 'hip', ridge: 'y', pitchDeg: 45, material: 'tuile' },
      ],
    }];
    return scene;
  };
  const nappeOf = (scene: Scene, massId: string) => resolveNappes(scene).get(nappeKey('corps', massId))!;
  /** Coins d'arête PARTAGÉS par deux masses voisines (le JOINT), avec la masse de chaque côté. */
  const jointCorners = (scene: Scene): { a: string; b: string; v: { x: number; y: number } }[] => {
    const owner = new Map<string, string>();
    for (const mass of effectiveArchitecture(scene)[0].masses)
      for (const key of nappeOf(scene, mass.id).cells) owner.set(key, mass.id);
    const out: { a: string; b: string; v: { x: number; y: number } }[] = [];
    for (const [key, a] of owner) {
      const [x, y] = key.split(',').map(Number);
      for (const [dx, dy, c0, c1] of [
        [1, 0, { x: x + 1, y }, { x: x + 1, y: y + 1 }],
        [0, 1, { x, y: y + 1 }, { x: x + 1, y: y + 1 }],
      ] as const) {
        const b = owner.get(`${x + dx},${y + dy}`);
        if (!b || b === a) continue;
        out.push({ a, b, v: c0 }, { a, b, v: c1 });
      }
    }
    return out;
  };

  it('les trois masses forment UN groupe : même champ, sur l’UNION de leurs emprises', () => {
    const scene = trio();
    const ids = ['aile-o', 'aile-e', 'centre'].map((id) => nappeOf(scene, id));
    expect(new Set(ids.map((n) => n.groupId)).size).toBe(1);
    expect(new Set(ids.map((n) => n.field))).toHaveLength(1); // LE MÊME objet de champ, pas trois copies
    expect(ids[0].field.domain.size).toBe(8 * 8 + 8 * 8 + 4 * 12);
    for (const n of ids) expect(n.cells.size).toBeLessThan(n.field.domain.size); // chacune ne pave que SA part
  });

  it('au JOINT, le versant CONTINUE : une seule hauteur des deux côtés, au-dessus de l’égout', () => {
    const scene = trio();
    const coins = jointCorners(scene);
    expect(coins.length).toBeGreaterThan(0);
    const egout = nappeOf(scene, 'centre').field.shape.eaveHeightM;
    let auDessus = 0;
    for (const { a, b, v } of coins) {
      const hA = fieldHeightAt(nappeOf(scene, a).field, v);
      const hB = fieldHeightAt(nappeOf(scene, b).field, v);
      expect(hA).toBeCloseTo(hB, 12); // jamais deux vérités de hauteur au même point
      if (hA > egout + 1e-9) auDessus++;
    }
    expect(auDessus).toBeGreaterThan(coins.length / 2); // la double-retombée à l'égout a disparu
  });

  it('la NOUE s’ouvre au coin rentrant du joint — un arêtier qui descend jusqu’à l’égout', () => {
    const scene = trio();
    const egout = nappeOf(scene, 'centre').field.shape.eaveHeightM;
    const aretiers = buildRoofs(scene).flatMap((el) => el.lines.map((l) => ({ ...l, section: el.sectionId })))
      .filter((l) => l.kind === 'aretier');
    // Coin rentrant NORD-OUEST du joint : sommet de grille (8,4), soit le point GP (7.5, 3.5). La noue
    // appartient au CENTRE, dont le versant s'y prolonge : seul, il n'aurait là qu'un égout.
    const noue = aretiers.filter((l) => [l.a, l.b].some((p) =>
      Math.abs(p.x - 7.5) < 1e-9 && Math.abs(p.y - 3.5) < 1e-9 && Math.abs(p.h - egout) < 1e-9));
    expect(noue.length).toBeGreaterThan(0);
    expect(new Set(noue.map((l) => l.section))).toEqual(new Set(['centre']));
    for (const l of noue) expect(Math.max(l.a.h, l.b.h)).toBeGreaterThan(egout); // elle REMONTE dans la nappe
  });

  it('UNE pente par groupe, refittée sur le domaine — le comble tient sous la borne de comble (#947)', () => {
    const scene = trio();
    const { field } = nappeOf(scene, 'centre');
    const pitches = new Set(['aile-o', 'aile-e', 'centre'].map((id) => nappeOf(scene, id).field.shape.pitch));
    expect(pitches.size).toBe(1);
    // REFIT sur la portée de l'UNION : la pente de chaque masse (45°) n'y tiendrait pas la borne.
    const masse = effectiveArchitecture(scene)[0].masses.find((m) => m.id === 'centre')!;
    expect(field.shape.pitch).toBeLessThan(resolveMass(scene, masse).shape.pitch);
    let faite = -Infinity;
    for (const key of field.domain) {
      const [x, y] = key.split(',').map(Number);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const)
        faite = Math.max(faite, fieldHeightAt(field, { x: x + dx, y: y + dy }));
    }
    expect(faite).toBeGreaterThan(field.shape.eaveHeightM);
    expect(faite - field.shape.eaveHeightM).toBeLessThanOrEqual(scene.roofDefaults.riseMaxStoreys * WALL_H_M + 1e-9);
  });

  it('un groupe d’UNE masse est le chemin HISTORIQUE : domaine = ses cellules, pavage identique', () => {
    const scene = emptyScene(24, 20);
    scene.walls = perimeterWallSegs([CENTRE]);
    scene.architecture = [{
      id: 'corps', style: 'maison', storeys: [], facades: [],
      masses: [{ id: 'centre', z: 0, footprint: [CENTRE], levels: 1, profile: 'gable', ridge: 'y', pitchDeg: 45, material: 'tuile' }],
    }];
    const n = nappeOf(scene, 'centre');
    expect(n.field.domain.size).toBe(n.cells.size);
    expect(n.field.shape).toEqual(n.shape);
    const eave = { overhang: 0.3, fasciaDrop: 0.1 };
    const historique = roofPans(n.cells, 'tuile', 3, eave, n.shape);
    expect(roofPans(n.cells, 'tuile', 3, eave, n.field.shape, n.field)).toEqual(historique);
  });

  it('égouts DIFFÉRENTS ⇒ pas de groupe : deux nappes indépendantes, chacune sur son emprise', () => {
    const scene = trio();
    // L'aile ouest se pose sur une terrasse : son égout mesuré n'est plus celui des deux autres.
    coter(scene, 0, WALL_H_M, [...Array(AILE_O.w * AILE_O.h)].map((_, i) => ({
      x: AILE_O.x + (i % AILE_O.w), y: AILE_O.y + Math.floor(i / AILE_O.w),
    })));
    const ouest = nappeOf(scene, 'aile-o');
    const centre = nappeOf(scene, 'centre');
    expect(ouest.field.shape.eaveHeightM).not.toBeCloseTo(centre.field.shape.eaveHeightM, 9);
    expect(ouest.groupId).not.toBe(centre.groupId);
    expect(ouest.field.domain.size).toBe(ouest.cells.size); // aucune union : le comportement d'avant
    expect(centre.groupId).toBe(nappeOf(scene, 'aile-e').groupId); // les deux autres restent groupées
  });

  it('le RACCORD de nappes (`walls.ts`) lit la MÊME hauteur que les pans — une seule vérité', () => {
    // Un BLOC sur terrasse (autre égout, donc autre nappe) vient buter contre le BOUT de faîtage du
    // corps central. Là, le versant du groupe arrive à PLEINE hauteur (extrémité fermée) : le quad de
    // raccord doit relier CETTE cote, jamais la retombée qu'aurait la masse lue seule sur ses cases.
    const CENTRE_C = { x: 8, y: 4, w: 4, h: 8 };
    const BLOC = { x: 8, y: 0, w: 4, h: 4 };
    const scene = emptyScene(24, 20);
    scene.walls = perimeterWallSegs([CENTRE_C, AILE_E, BLOC]);
    scene.architecture = [{
      id: 'corps', style: 'maison', storeys: [], facades: [],
      masses: [
        { id: 'aile-e', z: 0, footprint: [AILE_E], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 45, material: 'tuile' },
        { id: 'centre', z: 0, footprint: [CENTRE_C], levels: 1, profile: 'gable', ridge: 'y', pitchDeg: 45, material: 'tuile' },
        { id: 'bloc', z: 0, footprint: [BLOC], levels: 1, profile: 'hip', pitchDeg: 45, material: 'tuile' },
      ],
    }];
    coter(scene, 0, WALL_H_M, [...Array(BLOC.w * BLOC.h)].map((_, i) => ({
      x: BLOC.x + (i % BLOC.w), y: BLOC.y + Math.floor(i / BLOC.w),
    })));
    const centre = nappeOf(scene, 'centre').field;
    const bloc = nappeOf(scene, 'bloc').field;
    expect(nappeOf(scene, 'centre').groupId).not.toBe(nappeOf(scene, 'bloc').groupId);
    const seams = buildWalls(scene).filter((el) => el.key.includes('centre') && el.key.includes('bloc'));
    expect(seams.length).toBeGreaterThan(0);
    let mesures = 0;
    let auDessusEgout = 0;
    for (const el of seams) {
      for (const p of el.faces[0].poly) {
        const v = { x: p.x + 0.5, y: p.y + 0.5 };
        const attendues = [fieldHeightAt(centre, v), fieldHeightAt(bloc, v)];
        expect(attendues.some((h) => Math.abs(h - p.h) < 1e-9)).toBe(true); // aucune cote inventée
        mesures++;
        if (Math.abs(p.h - fieldHeightAt(centre, v)) < 1e-9 && p.h > centre.shape.eaveHeightM + 1e-9) auDessusEgout++;
      }
    }
    expect(mesures).toBeGreaterThan(0);
    expect(auDessusEgout).toBeGreaterThan(0); // le raccord monte jusqu'au versant, pas jusqu'à l'égout
  });
});

/**
 * #1186 — LA DILIGENCE RÉELLE : ses masses d'étage partageaient un égout et des pentes fittées
 * distinctes, et retombaient chacune à l'égout au joint (griefs de la maquette : « les 3 toitures
 * sont sensées se rejoindre »). Ce que ce bloc mesure sur le plan livré est DÉRIVÉ de lui — jamais un
 * compte ni une cote recopiés (#1709) ; les comptes exacts se prennent sur la fixture qui suit.
 */
describe('La Diligence — les nappes de l’étage se REJOIGNENT (#1186)', () => {
  const scene = diligenceCampaign.scenes[0];
  const masses = () => effectiveArchitecture(scene).find((b) => b.id === 'diligence')!.masses.filter((m) => m.z === 1);
  const nappeOf = (massId: string) => resolveNappes(scene).get(nappeKey('diligence', massId))!;

  it('les masses de l’étage forment UN groupe (même égout MESURÉ, 4-adjacentes)', () => {
    const ids = masses().map((m) => m.id);
    // NON-VACUITÉ, jamais un cardinal du plan livré (#1709) : sans DEUX nappes il n'y a pas de
    // jonction à mesurer, et le compte exact se prend sur la fixture ci-dessous.
    expect(ids.length, 'moins de deux nappes d’étage : rien à rejoindre').toBeGreaterThan(1);
    expect(new Set(ids.map((id) => nappeOf(id).groupId)).size).toBe(1);
    expect(new Set(ids.map((id) => nappeOf(id).field.shape.eaveHeightM)).size).toBe(1);
  });

  it('aucune face SÉCANTE entre les masses : toute leur couverture émise repose sur UN champ', () => {
    // Deux nappes ne peuvent se croiser que si elles lisent deux hauteurs : chaque sommet de chaque
    // pan des masses d'étage se relit ici sur LE champ du groupe (les débords d'avant-toit, hors nappe
    // par construction, ne sont pas de la couverture).
    const pans = buildRoofs(scene).filter((el) => el.cell.z === 1 && !el.panId?.startsWith('pignon-'));
    expect(pans.length).toBeGreaterThan(0);
    let sommets = 0;
    for (const el of pans) {
      const { field } = nappeOf(el.sectionId!);
      for (const f of el.faces) {
        if (!['N', 'E', 'S', 'O'].includes(f.material.part!)) continue;
        for (const p of f.poly) {
          expect(p.h).toBeCloseTo(fieldHeightAt(field, { x: p.x + 0.5, y: p.y + 0.5 }), 9);
          sommets++;
        }
      }
    }
    expect(sommets).toBeGreaterThan(50);
  });

  it('au JOINT, le versant CONTINUE au-dessus de l’égout — plus de double retombée à 8 m', () => {
    const owner = new Map<string, string>();
    for (const mass of masses()) for (const key of nappeOf(mass.id).cells) owner.set(key, mass.id);
    let coins = 0;
    let auDessusEgout = 0;
    for (const [key, a] of owner) {
      const [x, y] = key.split(',').map(Number);
      for (const [dx, dy, c0, c1] of [
        [1, 0, { x: x + 1, y }, { x: x + 1, y: y + 1 }],
        [0, 1, { x, y: y + 1 }, { x: x + 1, y: y + 1 }],
      ] as const) {
        const b = owner.get(`${x + dx},${y + dy}`);
        if (!b || b === a) continue;
        for (const v of [c0, c1]) {
          const hA = fieldHeightAt(nappeOf(a).field, v);
          const hB = fieldHeightAt(nappeOf(b).field, v);
          expect(hA).toBeCloseTo(hB, 12); // une seule hauteur au même point, des deux côtés du joint
          coins++;
          if (hA > 8 + 1e-9) auDessusEgout++;
        }
      }
    }
    expect(coins).toBeGreaterThan(0);
    expect(auDessusEgout).toBeGreaterThan(coins * 0.8); // seuls les BOUTS du joint touchent encore l'égout
    // Nappes continues au joint : aucun mur de raccord (`walls.ts`) n'a de marche à combler.
    expect(buildWalls(scene).filter((el) => el.key.startsWith('seam:') && el.cell.z === 1)).toEqual([]);
  });

  it('chaque corps en `gable` ferme DEUX pignons, les croupes n’en ferment aucun', () => {
    const pignons = buildRoofs(scene).filter((el) => el.cell.z === 1 && el.panId?.startsWith('pignon-'));
    const gables = masses().filter((m) => m.profile === 'gable');
    expect(gables.length, 'aucune masse `gable` à l’étage : la mesure n’a plus de sujet').toBeGreaterThan(0);
    // DEUX pignons par masse à deux rampants, aucun par croupe : le compte se DÉDUIT du plan, il ne
    // se recopie pas (#1709).
    expect(pignons).toHaveLength(gables.length * 2);
    expect(new Set(pignons.map((el) => el.sectionId))).toEqual(new Set(gables.map((m) => m.id)));
  });
});

/**
 * #1186 — LA CARTE DÉCIDE : entrer dans un groupe de nappe coûte sa pente (refit sur la portée de
 * l'union) et son profil (le champ commun est `hip`). Une masse DÉRIVÉE n'a rien à perdre — sa pente
 * est déjà calculée. Une masse AUTHORÉE porte un geste d'auteur : elle ne rejoint que ce qui a
 * exactement son profil et sa pente, et jamais depuis une terrasse (`flat`) ou une mono-pente
 * (`shed`). Chaque cas se mesure contre la même masse posée SEULE : la valeur de référence n'est
 * jamais une constante recopiée.
 */
describe('groupe de nappe — une masse AUTHORÉE ne cède ni sa pente ni son profil (#1186)', () => {
  const A = { x: 0, y: 0, w: 8, h: 8 };
  const B = { x: 8, y: 2, w: 4, h: 4 };

  const scene = (masses: BuildingMass[], rects: { x: number; y: number; w: number; h: number }[]): Scene => {
    const s = emptyScene(20, 14);
    s.walls = perimeterWallSegs(rects);
    s.architecture = [{ id: 'corps', style: 'maison', storeys: [], facades: [], masses }];
    return s;
  };
  const nappeOf = (s: Scene, massId: string) => resolveNappes(s).get(nappeKey('corps', massId))!;
  /** Point le plus HAUT du champ, lu sur les seules cellules PAVÉES par la masse. */
  const faiteSur = (s: Scene, massId: string): number => {
    const n = nappeOf(s, massId);
    let haut = -Infinity;
    for (const key of n.cells) {
      const [x, y] = key.split(',').map(Number);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const)
        haut = Math.max(haut, fieldHeightAt(n.field, { x: x + dx, y: y + dy }));
    }
    return haut;
  };
  /** La MÊME masse, seule sur la carte : l'état que son auteur a demandé. */
  const solo = (mass: BuildingMass) => faiteSur(scene([mass], [B]), mass.id);

  const grosseMasse: BuildingMass = { id: 'a', z: 0, footprint: [A], levels: 1, profile: 'hip', pitchDeg: 45, material: 'tuile' };
  const accolee = (patch: Partial<BuildingMass>): BuildingMass =>
    ({ id: 'b', z: 0, footprint: [B], levels: 1, profile: 'hip', pitchDeg: 30, material: 'tuile', ...patch });

  it('une masse `flat` accolée reste PLATE : son faîte est son égout', () => {
    const b = accolee({ profile: 'flat' });
    const s = scene([grosseMasse, b], [A, B]);
    expect(faiteSur(s, 'b')).toBeCloseTo(nappeOf(s, 'b').field.shape.eaveHeightM, 9); // terrasse : aucune pente reçue
    expect(faiteSur(s, 'b')).toBeCloseTo(solo(b), 9);
    expect(nappeOf(s, 'b').field.shape.profile).toBe('flat');
    expect(nappeOf(s, 'b').groupId).not.toBe(nappeOf(s, 'a').groupId);
  });

  it('une masse `shed` accolée garde sa MONO-PENTE et son côté d’égout', () => {
    const b = accolee({ profile: 'shed', eaveSide: 'E' });
    const s = scene([grosseMasse, b], [A, B]);
    expect(faiteSur(s, 'b')).toBeCloseTo(solo(b), 9);
    expect(nappeOf(s, 'b').field.shape.profile).toBe('shed');
    expect(nappeOf(s, 'b').groupId).not.toBe(nappeOf(s, 'a').groupId);
    // Le versant descend d'ouest en est jusqu'à l'égout déclaré : une seule pente, pas de croupe.
    const { field } = nappeOf(s, 'b');
    const hauteurs = [8, 9, 10, 11, 12].map((x) => fieldHeightAt(field, { x, y: B.y + 2 }));
    for (let i = 1; i < hauteurs.length; i++) expect(hauteurs[i]).toBeLessThan(hauteurs[i - 1]);
    expect(hauteurs[hauteurs.length - 1]).toBeCloseTo(field.shape.eaveHeightM, 9);
  });

  it('deux pentes AUTHORÉES distinctes ⇒ deux groupes : chaque faîte reste celui de la masse seule', () => {
    const GRAND = { x: 0, y: 0, w: 12, h: 8 };
    const APPENTIS = { x: 12, y: 3, w: 2, h: 2 };
    const grand: BuildingMass = { id: 'grand', z: 0, footprint: [GRAND], levels: 1, profile: 'hip', pitchDeg: 15, material: 'tuile' };
    const app: BuildingMass = { id: 'app', z: 0, footprint: [APPENTIS], levels: 1, profile: 'hip', pitchDeg: 60, material: 'tuile' };
    const duo = scene([grand, app], [GRAND, APPENTIS]);
    const seul = scene([grand], [GRAND]);
    expect(faiteSur(duo, 'grand')).toBeCloseTo(faiteSur(seul, 'grand'), 9); // l'appentis raide n'écrase rien
    expect(nappeOf(duo, 'grand').field.shape.pitch).toBeCloseTo(nappeOf(seul, 'grand').field.shape.pitch, 12);
    expect(nappeOf(duo, 'grand').groupId).not.toBe(nappeOf(duo, 'app').groupId);
  });

});

/**
 * #1186 — LES MASSES DÉRIVÉES, elles, GROUPENT malgré des pentes distinctes. Une masse `derived` ne se
 * pose pas à la main : `effectiveArchitecture` rejoue la dérivation depuis le PLAN — la scène est donc
 * CONSTRUITE plan compris (#1709), jamais empruntée à une carte de campagne.
 *
 * LE PLAN MINIMAL qui dérive trois masses d'un même étage : deux corps CLOS au rez (`interiorCells`
 * les voit, ils sortent à deux niveaux), séparés par un PASSAGE que rien ne clôt au rez (un seul
 * niveau), et un plancher d'étage qui court d'un bout à l'autre par-dessus les trois. Trois
 * composantes de sommet, trois portées — donc trois pentes fittées — et un seul égout, celui de leur
 * étage : le champ commun, la noue de la maquette.
 */
describe('nappes DÉRIVÉES — trois masses d’étage, trois pentes, UN champ (#1186)', () => {
  const SIZE = 24;
  const OUEST = { x: 1, y: 1, w: 7, h: 14 };
  const PASSAGE = { x: 8, y: 1, w: 3, h: 14 };
  const EST = { x: 11, y: 1, w: 8, h: 14 };
  const ETAGE = { x: OUEST.x, y: OUEST.y, w: OUEST.w + PASSAGE.w + EST.w, h: OUEST.h };

  const dans = (r: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
    x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

  const plan = (): Scene => {
    let sc = emptyScene(SIZE, SIZE);
    for (const [z, rects] of [[0, [OUEST, EST]], [1, [ETAGE]]] as const) {
      const tiles = new Array(SIZE * SIZE).fill(z === 0 ? 'herbe' : 'vide');
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) if (rects.some((r) => dans(r, x, y))) tiles[y * SIZE + x] = 'pierre';
      sc = putLayer(sc, z, tiles);
    }
    sc.walls = perimeterWallSegs([OUEST, EST]); // le PASSAGE n'est clos de rien : un seul niveau
    sc.architecture = [{ id: 'corps', style: 'maison', storeys: [], facades: [], masses: [] }];
    return sc;
  };

  const scene = plan();
  const masses = () => effectiveArchitecture(scene).find((b) => b.id === 'corps')!.masses.filter((m) => m.z === 1);
  const nappeOf = (massId: string) => resolveNappes(scene).get(nappeKey('corps', massId))!;

  it('la fixture EXERCE le cas : trois masses DÉRIVÉES à l’étage, à trois pentes distinctes', () => {
    const trois = masses();
    expect(trois).toHaveLength(3);
    expect(trois.every((m) => m.derived)).toBe(true);
    expect(new Set(trois.map((m) => resolveMass(scene, m).shape.pitch)).size).toBe(3);
  });

  it('elles GROUPENT quand même : un seul groupe, et LE même champ — la noue de la maquette', () => {
    const nappes = masses().map((m) => nappeOf(m.id));
    expect(new Set(nappes.map((n) => n.groupId)).size).toBe(1);
    expect(new Set(nappes.map((n) => n.field)).size).toBe(1);
    expect(new Set(nappes.map((n) => n.field.shape.eaveHeightM)).size).toBe(1);
  });

  it('la masse en `gable` ferme DEUX pignons, les croupes n’en ferment aucun', () => {
    const gables = masses().filter((m) => m.profile === 'gable');
    expect(gables).toHaveLength(1); // le passage, seule portée sous la borne de comble
    const pignons = buildRoofs(scene).filter((el) => el.cell.z === 1 && el.panId?.startsWith('pignon-'));
    expect(pignons).toHaveLength(2);
    expect(new Set(pignons.map((el) => el.sectionId))).toEqual(new Set([gables[0].id]));
  });
});
