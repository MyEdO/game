import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import {
  accentCounts,
  accentMatrix,
  groupAccents,
  mountGroundAccentLots,
  reposeGroundAccents,
  sceneGroundAccents,
  tileGroundAccents,
  SPECKLE_LIFT_M,
  type GroundAccentLot,
  type SceneGroundAccent,
} from './groundAccents';
import { groundAccentsSvg, TUFT_LEAN_AMPLITUDE } from '../../authoring/detailSvg';
import { terrainDetail } from '../../../state/terrain';
import { ISO_PX_PER_M } from '../../iso';
import { TUFT_FAN } from '../../detail/expand';
import { projGP } from '../../authoring/project';
import { worldFaces, type KeepEl, type TintAt } from './sceneMeshes';
import { facePoly, coplanarRanks, COPLANAR_BIAS_M } from './worldTris';
import { buildScene } from '../../../state/mapSpec';
import { spec as siegeSpec } from '../../../scenes/test-scenarios/siege-enceinte';
import { testScenarios } from '../../../scenes/test-scenarios';
import { sceneMetresPerTile } from '../../../state/scene';
import type { Dims } from '../../../geometry/iso';
import type { DetailRecipe } from '../../detail/types';

/**
 * ACCENTS DE SOL en instances : la PARITÉ STRUCTURELLE avec le semis de l'affine
 * (`groundAccentsSvg`, `authoring/detailSvg.ts`) — même seed monde ⇒ mêmes emplacements. La preuve ne
 * compare pas des pixels : elle REPROJETTE les positions monde des instances par la projection affine
 * (`projGP`) et exige qu'elles tombent EXACTEMENT sur les ancres du chemin SVG.
 */

const dims: Dims = { w: 8, h: 8 };
const MPT = 2;
const HERBE = terrainDetail('herbe')!;
const TERRE = terrainDetail('terre')!;

const n2 = (v: number) => Math.round(v * 100) / 100;

/** Ancres des TOUFFES du SVG : `groundAccentsSvg` émet 3 sous-chemins `M x,y` par touffe, tous au PIED
 *  (`authoring/detailSvg.ts`) — on garde une ancre sur trois. */
function tuftAnchorsOfSvg(svg: string): [number, number][] {
  const path = /stroke-linecap="round"/.test(svg) ? svg.match(/<path d="([^"]*)" fill="none"/)?.[1] ?? '' : '';
  const anchors = [...path.matchAll(/M(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as [number, number]);
  return anchors.filter((_, i) => i % 3 === 0);
}

/** BRINS du SVG : le 2ᵉ sous-chemin de chaque touffe est `l ${lean·0,4},${−hp·1,15}` (`authoring/detailSvg.ts`,
 *  `groundAccentsSvg`) — la SEULE commande `l` du tracé, d'où se redécodent les deux grandeurs que
 *  l'émetteur a tirées du flux `blades` : la hauteur de brin (px) et le penché d'écran. */
function svgBrins(svg: string): { lean: number; hp: number }[] {
  const d = svg.match(/<path d="([^"]*)" fill="none"/)?.[1] ?? '';
  return [...d.matchAll(/l(-?[\d.]+),(-?[\d.]+)/g)].map((m) => ({ lean: Number(m[1]) / 0.4, hp: -Number(m[2]) / 1.15 }));
}

/** Écarts de parité TOLÉRÉS : exactement le quantum d'arrondi `n2` (2 décimales) du SVG rapporté à
 *  chaque grandeur décodée — au-delà, ce n'est plus de l'arrondi mais un autre tirage.
 *  Hauteur : `n2` sur `−hp·1,15` px ⇒ 0,005/1,15/`ISO_PX_PER_M` = 1,812e-4 m (mesuré 1,811e-4 sur 1 600 brins).
 *  Lacet : `n2` sur `lean·0,4` ⇒ 0,005/0,4 de `lean`, redéplié sur 2·`TUFT_LEAN_AMPLITUDE` puis étalé
 *  sur 2π = 3,273e-2 rad (mesuré 3,270e-2). Contre-vérifié SENSIBLE : rangs du flux permutés ⇒ 9,9e-2 m
 *  d'écart de hauteur, 550× le seuil. */
const ECART_HAUTEUR_MAX = 2e-4;
const ECART_LACET_MAX = 3.3e-2;

/** Centres des MOUCHETIS du SVG : `dotSub` (`authoring/detailSvg.ts`) trace `M cx,cy−r L cx+1.2r,cy …` —
 *  le centre se relit donc en (x du 1er point, y du 2ᵉ). */
function speckleCentersOfSvg(svg: string): [number, number][] {
  const path = svg.match(/<path d="([^"]*)" fill="#/)?.[1] ?? '';
  return [...path.matchAll(/M(-?[\d.]+),(-?[\d.]+)L(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[4])]);
}

/** Position monde d'un accent reprojetée par la projection AFFINE (l'inverse exact de `tileGroundAccents`). */
const reproject = (a: { pos: { x: number; y: number; z: number } }): [number, number] => {
  const p = projGP({ x: a.pos.x / MPT, y: a.pos.z / MPT, h: a.pos.y }, dims);
  return [n2(p[0]), n2(p[1])];
};

describe('groundAccents — parité de SEED avec le semis affine', () => {
  it('les TOUFFES tombent sur les ancres de `groundAccentsSvg`, tuile par tuile', () => {
    let vues = 0;
    for (const cell of [{ x: 1, y: 1, z: 0 }, { x: 3, y: 2, z: 0 }, { x: 5, y: 4, z: 1 }]) {
      const h = cell.z * 4;
      const attendu = tuftAnchorsOfSvg(groundAccentsSvg(HERBE, cell, h, dims, MPT));
      const obtenu = tileGroundAccents(HERBE, cell, h, MPT).filter((a) => a.kind === 'tuft').map(reproject);
      expect(obtenu.length).toBe(attendu.length);
      expect(obtenu).toEqual(attendu);
      vues += attendu.length;
    }
    expect(vues).toBeGreaterThan(0); // un semis vide ne prouverait rien
  });

  it('les MOUCHETIS tombent sur les centres des losanges de `groundAccentsSvg`', () => {
    let vues = 0;
    for (const cell of [{ x: 2, y: 1, z: 0 }, { x: 4, y: 6, z: 0 }]) {
      const attendu = speckleCentersOfSvg(groundAccentsSvg(TERRE, cell, 0, dims, MPT));
      const obtenu = tileGroundAccents(TERRE, cell, 0, MPT).filter((a) => a.kind === 'speckle').map(reproject);
      expect(obtenu.length).toBe(attendu.length);
      expect(obtenu).toEqual(attendu);
      vues += attendu.length;
    }
    expect(vues).toBeGreaterThan(0);
  });

  it("la couleur d'un lot est celle que l'affine tire PAR TUILE (palette de la recette)", () => {
    const cell = { x: 7, y: 3, z: 0 };
    const svg = groundAccentsSvg(HERBE, cell, 0, dims, MPT);
    const attendue = svg.match(/stroke="(#[0-9a-f]{6})"/)?.[1];
    expect(HERBE.tufts!.colors).toContain(attendue);
    for (const a of tileGroundAccents(HERBE, cell, 0, MPT)) expect(a.color).toBe(attendue);
  });

  it('un semis est DÉTERMINISTE et distinct de celui de la tuile voisine', () => {
    const a = tileGroundAccents(HERBE, { x: 1, y: 1, z: 0 }, 0, MPT);
    expect(tileGroundAccents(HERBE, { x: 1, y: 1, z: 0 }, 0, MPT)).toEqual(a);
    const voisine = tileGroundAccents(HERBE, { x: 2, y: 1, z: 0 }, 0, MPT);
    expect(voisine.map((t) => t.pos.x - 2 * MPT)).not.toEqual(a.map((t) => t.pos.x - MPT));
  });

  it('la hauteur de brin reste dans les bornes de la DONNÉE, facteur de brin compris', () => {
    const [lo, hi] = HERBE.tufts!.hM;
    for (let x = 0; x < 12; x++)
      for (const t of tileGroundAccents(HERBE, { x, y: 5, z: 0 }, 0, MPT)) {
        expect(t.sizeM).toBeGreaterThanOrEqual(lo * 0.8);
        expect(t.sizeM).toBeLessThanOrEqual(hi * 1.3);
      }
  });

  // Les ANCRES (tests ci-dessus) ne disent rien du FLUX `blades` lui-même : elles viennent d'`expandRecipe`.
  // Ce test-ci confronte les DEUX tirages par touffe, dans leur RANG — une permutation des rangs laisse
  // les ancres intactes et n'y serait pas vue.
  it('la HAUTEUR puis le LACET de chaque brin sont les deux tirages du flux `blades`, dans cet ORDRE', () => {
    let vus = 0;
    let pireHauteur = 0;
    let pireLacet = 0;
    for (let x = 0; x < 20; x++)
      for (let y = 0; y < 20; y++) {
        const cell = { x, y, z: 0 };
        const brins = svgBrins(groundAccentsSvg(HERBE, cell, 0, dims, MPT));
        const touffes = tileGroundAccents(HERBE, cell, 0, MPT).filter((a) => a.kind === 'tuft');
        expect(touffes.length).toBe(brins.length);
        touffes.forEach((a, i) => {
          vus++;
          pireHauteur = Math.max(pireHauteur, Math.abs(brins[i].hp / ISO_PX_PER_M - a.sizeM));
          // Penché d'écran REDÉPLIÉ en son tirage uniforme [0,1] — celui que le POV et le WebGL
          // étalent, eux, sur un tour complet.
          const tirage = (brins[i].lean / TUFT_LEAN_AMPLITUDE + 1) / 2;
          pireLacet = Math.max(pireLacet, Math.abs(tirage * Math.PI * 2 - a.yaw));
        });
      }
    expect(vus).toBeGreaterThan(1000); // un semis maigre ne prouverait rien
    expect(pireHauteur).toBeLessThanOrEqual(ECART_HAUTEUR_MAX);
    expect(pireLacet).toBeLessThanOrEqual(ECART_LACET_MAX);
  });
});

/** Semis MONTÉ puis REPOSÉ une fois — l'état dans lequel l'écran laisse ses lots après un commit. */
function reposé(
  accents: readonly SceneGroundAccent[],
  opts: { lit?: boolean; keepEl?: KeepEl; tintAt?: TintAt } = {},
): GroundAccentLot[] {
  const lots = mountGroundAccentLots(accents, { lit: opts.lit ?? false });
  reposeGroundAccents(lots, opts.keepEl ?? (() => true), opts.tintAt ?? (() => 1));
  return lots;
}

describe('groundAccents — semis de SCÈNE et montage instancié', () => {
  const scene = buildScene(siegeSpec());
  const mpt = sceneMetresPerTile(scene);

  it('la scène de siège porte un semis MESURABLE', () => {
    const c = accentCounts(sceneGroundAccents(scene, mpt, 'jeu'));
    expect(c.tufts).toBeGreaterThan(0);
  });

  it('la teinte de visibilité de la case voyage sur la couleur des instances, JAMAIS sur le semis', () => {
    const accents = sceneGroundAccents(scene, mpt, 'jeu');
    expect(accents.length).toBeGreaterThan(0);
    for (const a of accents) expect([a.cell.x, a.cell.y, a.cell.z].every(Number.isInteger)).toBe(true);
    const mesh = reposé(accents.slice(0, 200), { tintAt: () => 0.25 })[0].mesh;
    const attendue = new THREE.Color().set(accents.find((a) => `${a.kind}|${a.color}` === mesh.name)!.color).multiplyScalar(0.25);
    const lue = new THREE.Color();
    mesh.getColorAt(0, lue);
    expect(lue.r).toBeCloseTo(attendue.r, 6);
    expect(lue.g).toBeCloseTo(attendue.g, 6);
    expect(lue.b).toBeCloseTo(attendue.b, 6);
  });

  it('le semis est INVARIANT à la visibilité : deux teintes, un seul et même tirage', () => {
    const a = sceneGroundAccents(scene, mpt, 'jeu');
    const b = sceneGroundAccents(scene, mpt, 'jeu');
    const trace = (x: (typeof a)[number]) => `${x.cell.x},${x.cell.y},${x.cell.z}|${x.kind}|${x.pos.x}|${x.pos.z}|${x.sizeM}`;
    expect(b.map(trace)).toEqual(a.map(trace));
    // La teinte n'entre PAS dans le lot (elle varie par case, `instanceColor` la porte).
    const lots = groupAccents(a);
    const eteints = reposé(a, { tintAt: () => 0.1 });
    const pleins = reposé(a, { tintAt: () => 1 });
    const empreinte = (l: GroundAccentLot) => `${l.mesh.name}:${l.mesh.count}`;
    expect(eteints.map(empreinte)).toEqual(pleins.map(empreinte));
    expect(eteints.length).toBe(lots.size);
  });

  it('un lot par (type × couleur), chaque instance à sa pose monde', () => {
    const accents = sceneGroundAccents(scene, mpt, 'jeu');
    const lots = groupAccents(accents);
    expect(lots.size).toBeGreaterThan(1);
    const meshes = reposé(accents).map((l) => l.mesh);
    expect(meshes.map((m) => m.count).reduce((x, y) => x + y, 0)).toBe(accents.length);
    // CULLING : rien n'est calculé d'avance — three résout la sphère à la première frame
    // (`Frustum.intersectsObject`) et `InstancedMesh` la surcharge pour couvrir SES instances, pas le
    // gabarit unité posé à l'origine. C'est cette couverture qu'on exige, pas l'appel.
    for (const m of meshes) expect(m.boundingSphere).toBeNull();
    const m0 = meshes[0];
    m0.computeBoundingSphere();
    const sphere = m0.boundingSphere!;
    expect(sphere.radius).toBeGreaterThan(0);
    for (const a of lots.get(m0.name)!)
      expect(sphere.center.distanceTo(new THREE.Vector3(a.pos.x, a.pos.y, a.pos.z))).toBeLessThanOrEqual(sphere.radius + 1e-6);
    const tuft = accents.find((a) => a.kind === 'tuft')!;
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    accentMatrix(tuft).decompose(pos, quat, scale);
    expect(pos.x).toBeCloseTo(tuft.pos.x, 9);
    expect(pos.y).toBeCloseTo(tuft.pos.y, 9);
    expect(scale.y).toBeCloseTo(tuft.sizeM, 9);
    expect(scale.x).toBeCloseTo(2 * TUFT_FAN * tuft.sizeM, 9);
  });

  it('un mouchetis se DÉCOLLE de la nappe qui le porte (jamais coplanaire)', () => {
    const dot = tileGroundAccents(TERRE, { x: 2, y: 2, z: 0 }, 3.5, MPT).find((a) => a.kind === 'speckle')!;
    const pos = new THREE.Vector3();
    accentMatrix(dot).decompose(pos, new THREE.Quaternion(), new THREE.Vector3());
    expect(pos.y - dot.pos.y).toBeCloseTo(SPECKLE_LIFT_M, 9);
    expect(SPECKLE_LIFT_M).toBeGreaterThan(0.0015 * 2); // > 2 crans de COPLANAR_BIAS_M
  });

  it('un terrain SANS recette d\'accent ne sème rien', () => {
    const nu: DetailRecipe = { seedScope: 'tile' };
    expect(tileGroundAccents(nu, { x: 1, y: 1, z: 0 }, 0, MPT)).toEqual([]);
  });
});

/**
 * REPOSE (#1376) : un semis monté ne se REBÂTIT plus. Le franchissement d'un cran passe au stage une
 * référence de `KeepEl` NEUVE pour un verdict IDENTIQUE sur le sol (le dégagement n'obéit qu'à la
 * découpe, jamais au lacet) — et un rebuild à cet instant libérait matériaux et géométries, donc un
 * `deleteProgram`/`linkProgram` et un ré-upload de sommets par quart de tour.
 */
describe('groundAccents — REPOSE en place, jamais de reconstruction', () => {
  const scene = buildScene(siegeSpec());
  const mpt = sceneMetresPerTile(scene);
  const accents = sceneGroundAccents(scene, mpt, 'jeu');
  /** Teinte STABLE, comme celle que l'hôte du monde mémorise (`stage/MondeDeCampagne`) : elle ne se reforge qu'au
   *  changement de visibilité, jamais au franchissement d'un cran. */
  const TEINTE_PLEINE: TintAt = () => 1;
  /** La nappe la plus SEMÉE de la scène : la retirer doit se voir. */
  const plusSemée = () => {
    const parEl = new Map<SceneGroundAccent['el'], number>();
    for (const a of accents) parEl.set(a.el, (parEl.get(a.el) ?? 0) + 1);
    return [...parEl.entries()].sort((x, y) => y[1] - x[1])[0];
  };
  /** Matrices lues DANS le mesh, bornées à `count` — ce que le GPU dessinerait. */
  const matricesMontrées = (lot: GroundAccentLot): number[][] => {
    const out: number[][] = [];
    const m = new THREE.Matrix4();
    for (let i = 0; i < lot.mesh.count; i++) {
      lot.mesh.getMatrixAt(i, m);
      out.push([...m.elements]);
    }
    return out;
  };
  /** Une matrice telle que le tampon d'instances la RENDRA : `instanceMatrix` est en flottants 32
   *  bits, la comparer aux doubles de `accentMatrix` échouerait sur l'arrondi seul. */
  const en32bits = (m: THREE.Matrix4): number[] => m.elements.map((v) => Math.fround(v));
  /** Ce que three appelle « écrit » : `needsUpdate` n'a QUE son setter (`BufferAttribute`), le
   *  compteur `version` est la seule trace lisible d'un téléversement demandé. */
  const versions = (lots: readonly GroundAccentLot[]) =>
    lots.map((l) => [l.mesh.instanceMatrix.version, l.mesh.instanceColor?.version ?? -1]);

  it('MONTAGE : un mesh par lot, à la capacité du lot ; la repose en borne le compte', () => {
    const lots = mountGroundAccentLots(accents, { lit: true });
    expect(lots.length).toBe(groupAccents(accents).size);
    expect(lots.length).toBeGreaterThan(1);
    // Rien n'est montré avant la repose : elle seule connaît le dégagement.
    expect(lots.every((l) => l.mesh.count === 0)).toBe(true);
    expect(lots.map((l) => l.mesh.instanceMatrix.count).reduce((a, b) => a + b, 0)).toBe(accents.length);
    reposeGroundAccents(lots, () => true, TEINTE_PLEINE);
    expect(lots.map((l) => l.mesh.count).reduce((a, b) => a + b, 0)).toBe(accents.length);
  });

  it('VERDICT INCHANGÉ (référence de `KeepEl` neuve) : rien n’est réécrit, rien n’est libéré', () => {
    const lots = reposé(accents, { lit: true, tintAt: TEINTE_PLEINE });
    expect(lots.length).toBeGreaterThan(1);
    const meshesAvant = lots.map((l) => l.mesh);
    const matsAvant = lots.map((l) => l.mesh.material);
    const geosAvant = lots.map((l) => l.mesh.geometry);
    const comptesAvant = lots.map((l) => l.mesh.count);
    const versionsAvant = versions(lots);
    expect(comptesAvant.every((c) => c > 0)).toBe(true); // un semis vide ne prouverait rien
    const disposeMat = vi.spyOn(THREE.Material.prototype, 'dispose');
    const disposeGeo = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');

    // Le franchissement : MÊME loi, référence NEUVE — exactement ce que `keepEl` devient au cran suivant.
    const écrit = reposeGroundAccents(lots, (el) => el !== undefined, TEINTE_PLEINE);

    expect(écrit).toEqual({ dégagement: false, teinte: false });
    expect(disposeMat).not.toHaveBeenCalled();
    expect(disposeGeo).not.toHaveBeenCalled();
    expect(lots.map((l) => l.mesh)).toEqual(meshesAvant);
    expect(lots.map((l) => l.mesh.material)).toEqual(matsAvant);
    expect(lots.map((l) => l.mesh.geometry)).toEqual(geosAvant);
    expect(lots.map((l) => l.mesh.count)).toEqual(comptesAvant);
    expect(versions(lots), 'un téléversement demandé pour rien : c’est le ré-upload mesuré').toEqual(versionsAvant);
    disposeMat.mockRestore();
    disposeGeo.mockRestore();
  });

  it('DÉGAGEMENT : la nappe retirée emporte SES touffes, les autres instances restent en tête', () => {
    const [cible, semés] = plusSemée();
    expect(semés).toBeGreaterThan(0);
    // Teinte qui VARIE par case : sous une teinte plate, une couleur laissée au rang de l'instance
    // partie serait indiscernable de la bonne.
    const teinteParCase: TintAt = (x, y, z) => 0.2 + ((x * 7 + y * 3 + z) % 5) / 10;
    const lots = reposé(accents, { lit: true, tintAt: teinteParCase });
    const pleins = lots.map((l) => l.mesh.count);

    const écrit = reposeGroundAccents(lots, (el) => el !== cible, teinteParCase);

    expect(écrit.dégagement).toBe(true);
    expect(lots.map((l) => l.mesh.count).reduce((a, b) => a + b, 0)).toBe(accents.length - semés);
    expect(lots.map((l) => l.mesh.count)).not.toEqual(pleins);
    const lue = new THREE.Color();
    const attendue = new THREE.Color();
    for (const lot of lots) {
      const attendus = lot.accents.filter((a) => a.el !== cible);
      expect(lot.mesh.count).toBe(attendus.length);
      // Les instances MONTRÉES sont bien celles retenues, dans leur ordre de semis.
      expect(matricesMontrées(lot)).toEqual(attendus.map((a) => en32bits(accentMatrix(a))));
      // …et leur COULEUR suit la compaction : la teinte se lit à la case du retenu de CE rang.
      for (let i = 0; i < lot.mesh.count; i++) {
        const a = attendus[i];
        lot.mesh.getColorAt(i, lue);
        attendue.set(a.color).multiplyScalar(teinteParCase(a.cell.x, a.cell.y, a.cell.z));
        expect([lue.r, lue.g, lue.b].map((v) => Math.round(v * 1e5))).toEqual(
          [attendue.r, attendue.g, attendue.b].map((v) => Math.round(v * 1e5)),
        );
      }
    }
    // Le semis lui-même n'a pas bougé : c'est l'APPLICATION qui filtre.
    expect(sceneGroundAccents(scene, mpt, 'jeu').length).toBe(accents.length);
  });

  /**
   * CULLING APRÈS COMPACTION : `InstancedMesh` porte SA sphère englobante, et three ne la calcule
   * qu'une fois — `Frustum.intersectsObject` la recalcule si (et seulement si) elle est nulle, et
   * `setMatrixAt` ne l'invalide pas (JSDoc three, `InstancedMesh.js`). Une sphère figée sur un
   * dégagement ACTIF fait disparaître de l'écran ET de la carte d'ombre les instances que la levée du
   * dégagement vient de rendre.
   */
  it('un dégagement LEVÉ rend ses instances VISIBLES du frustum (sphère réinvalidée)', () => {
    // Dégagement ACTIF au montage : UNE seule nappe retenue — la sphère du lot amputé se referme
    // alors sur cette tuile, et tout le reste du semis tombe hors d'elle.
    const [seule] = plusSemée();
    const lots = mountGroundAccentLots(accents, { lit: true });
    reposeGroundAccents(lots, (el) => el === seule, TEINTE_PLEINE);
    const lot = lots.find((l) => l.mesh.count > 0 && l.accents.some((a) => a.el !== seule))!;
    expect(lot, 'aucun lot à la fois retenu et amputé : rien à mesurer').toBeTruthy();
    lot.mesh.updateMatrixWorld(true);

    // PREMIÈRE FRAME : c'est là que three fige la sphère du lot AMPUTÉ.
    new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().identity()).intersectsObject(lot.mesh);
    const figée = lot.mesh.boundingSphere!.clone();
    expect(figée.radius, 'sphère non calculée : la panne mesurée ne pourrait pas se produire').toBeGreaterThan(0);

    reposeGroundAccents(lots, () => true, TEINTE_PLEINE);
    lot.mesh.updateMatrixWorld(true);

    // CADRAGE serré sur un accent que le dégagement retenait, et choisi tel que la sphère FIGÉE
    // n'entre PAS dans ce cadre : sans cette condition le frustum toucherait la sphère périmée et le
    // contrat serait vrai des deux côtés.
    const cadreSur = (p: { x: number; y: number; z: number }): THREE.Frustum => {
      const cam = new THREE.OrthographicCamera(-2, 2, 2, -2, 1, 60);
      cam.position.set(p.x, p.y + 40, p.z);
      cam.lookAt(p.x, p.y, p.z);
      cam.updateMatrixWorld(true);
      return new THREE.Frustum().setFromProjectionMatrix(
        new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse),
      );
    };
    let frustum: THREE.Frustum | null = null;
    for (const a of lot.accents) {
      if (a.el === seule) continue;
      const f = cadreSur(a.pos);
      if (!f.intersectsSphere(figée)) { frustum = f; break; }
    }
    expect(frustum, 'aucun cadre hors de la sphère figée : la garde ne mordrait pas').toBeTruthy();

    expect(frustum!.intersectsObject(lot.mesh), 'lot entier culled : ses touffes ne se peignent plus').toBe(true);
  });

  it('TEINTE seule : `instanceColor` se réécrit, les matrices ne bougent pas', () => {
    const lots = reposé(accents.slice(0, 400), { lit: true, tintAt: TEINTE_PLEINE });
    const avant = lots.map(matricesMontrées);
    const versionsAvant = versions(lots);

    const écrit = reposeGroundAccents(lots, () => true, () => 0.25);

    expect(écrit).toEqual({ dégagement: false, teinte: true });
    expect(lots.map((l) => l.mesh.instanceColor!.version)).toEqual(versionsAvant.map(([, c]) => c + 1));
    expect(lots.map((l) => l.mesh.instanceMatrix.version)).toEqual(versionsAvant.map(([m]) => m));
    expect(lots.map(matricesMontrées)).toEqual(avant);
    const lue = new THREE.Color();
    lots[0].mesh.getColorAt(0, lue);
    const attendue = new THREE.Color().set(lots[0].accents[0].color).multiplyScalar(0.25);
    expect(lue.r).toBeCloseTo(attendue.r, 6);
    expect(lue.g).toBeCloseTo(attendue.g, 6);
    expect(lue.b).toBeCloseTo(attendue.b, 6);
  });

  it('MATÉRIAU : `lit` choisit le régime, exactement comme les faces du monde', () => {
    expect(mountGroundAccentLots(accents.slice(0, 50), { lit: false })[0].mesh.material)
      .toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(mountGroundAccentLots(accents.slice(0, 50), { lit: true })[0].mesh.material)
      .toBeInstanceOf(THREE.MeshLambertMaterial);
  });
});

/** Toutes les nappes SEMÉES du registre : chaque face de terrain nu porteuse d'une recette d'accent,
 *  avec le rang coplanaire que le monde fusionné lui donne et les accents qu'elle sème. */
function nappesSemees() {
  const out: {
    id: string;
    mpt: number;
    cell: { x: number; y: number; z: number };
    hs: number[];
    rank: number;
    accents: ReturnType<typeof tileGroundAccents>;
  }[] = [];
  for (const sc of testScenarios) {
    const c = sc.construire();
    for (const scene of [c.scene, ...(c.extraScenes ?? [])]) {
      const m2t = sceneMetresPerTile(scene);
      const wfs = worldFaces(scene, 'jeu');
      const rangs = coplanarRanks(wfs.map((w) => facePoly(w.face, m2t)));
      wfs.forEach((wf, i) => {
        const mat = wf.face.material;
        if (mat.domain !== 'terrain' || mat.part) return;
        const recette = terrainDetail(mat.id);
        if (!recette) return;
        out.push({
          id: `${sc.id}/${scene.id}/${mat.id}@${wf.cellKey}`,
          mpt: m2t,
          cell: wf.cell,
          hs: wf.face.poly.map((p) => p.h),
          rank: rangs[i],
          accents: tileGroundAccents(recette, wf.cell, wf.face.poly[0].h, m2t),
        });
      });
    }
  }
  return out;
}

/** Plafond de densité de semis : le DOUBLE de la pire mesure du registre (1,0000 accent/m²). */
const DENSITE_MAX_M2 = 2;

describe('groundAccents — contrat des NAPPES SEMÉES, sur TOUT le registre de scènes', () => {
  const nappes = nappesSemees();

  it('le registre offre un échantillon de nappes semées qui vaille une mesure', () => {
    expect(nappes.length).toBeGreaterThan(20_000); // mesuré 28 739 faces sur 44 scènes
  });

  it("aucun accent ne déborde l'EMPRISE monde de sa case", () => {
    // `tileGroundAccents` mappe l'UV de tuile en `(cell ± 0,5) · mpt` : le MÊME repère que `gpToWorld`.
    // Un décalage de ce mapping poserait le semis d'une case sur sa voisine — invisible sur une nappe
    // unie, visible ici.
    const hors = nappes.filter((n) =>
      n.accents.some(
        (a) =>
          a.pos.x < (n.cell.x - 0.5) * n.mpt - 1e-9 ||
          a.pos.x > (n.cell.x + 0.5) * n.mpt + 1e-9 ||
          a.pos.z < (n.cell.y - 0.5) * n.mpt - 1e-9 ||
          a.pos.z > (n.cell.y + 0.5) * n.mpt + 1e-9,
      ),
    );
    expect(hors.map((n) => n.id)).toEqual([]);
  });

  it('toute nappe à recette est PLANE — le semis lit une seule hauteur pour la tuile entière', () => {
    // `sceneGroundAccents` passe `poly[0].h` pour toute la face : le jour où un terrain à recette
    // devient une rampe, les accents flotteraient ou s'enterreraient. Ce test le dira ce jour-là.
    const pentues = nappes.filter((n) => Math.max(...n.hs) - Math.min(...n.hs) > 1e-9);
    expect(pentues.map((n) => n.id)).toEqual([]);
  });

  it('toute nappe à recette est au rang coplanaire 0 — le décollement du mouchetis reste lisible', () => {
    // Un rang > 0 déplace la face de `rank × COPLANAR_BIAS_M` le long de sa normale (`biasPoly`) alors
    // que l'accent, lui, n'est pas dans la géométrie fusionnée : au 4ᵉ cran, le biais avale
    // `SPECKLE_LIFT_M` et le losange z-fighte de nouveau.
    const empiles = nappes.filter((n) => n.rank > 0);
    expect(empiles.map((n) => n.id)).toEqual([]);
    expect(SPECKLE_LIFT_M / COPLANAR_BIAS_M).toBeGreaterThan(3);
  });

  it("la DENSITÉ de semis au m² reste sous le double de la pire mesure du registre", () => {
    // Un emballement de semis se mesure au MÈTRE CARRÉ, jamais en absolu ni par tuile : la recette
    // déclare un `perM2` (1,1 pour l'herbe, ≤ 0,6 pour les mouchetis) et une tuile vaut `mpt²` m².
    // Mesures du 2026-08-10 sur les 44 scènes du registre : plafond 1,0000 accent/m² (galerie-modeles,
    // 50 112 instances sur 12 528 tuiles de 2 m ; poursuite-terrestre ; voyage/*), 0,9646 au siège.
    // Une borne PAR TUILE serait fausse — elle croît en `mpt²` : duel-naval sort à 25,0 accents/tuile
    // pour 0,2500/m² (mpt = 10). Une borne ABSOLUE ne dirait rien non plus : galerie-modeles pèse
    // 50 112 instances sans le moindre emballement, juste 6× plus de sol.
    const parScene = new Map<string, { n: number; m2: number }>();
    for (const n of nappes) {
      const cle = n.id.slice(0, n.id.indexOf('/', n.id.indexOf('/') + 1));
      const e = parScene.get(cle) ?? { n: 0, m2: 0 };
      e.n += n.accents.length;
      e.m2 += n.mpt * n.mpt;
      parScene.set(cle, e);
    }
    expect(parScene.size).toBeGreaterThan(30); // 44 scènes semées mesurées
    const debordent = [...parScene]
      .filter(([, e]) => e.n / e.m2 > DENSITE_MAX_M2)
      .map(([cle, e]) => `${cle} à ${(e.n / e.m2).toFixed(4)}/m²`);
    expect(debordent).toEqual([]);
  });
});
