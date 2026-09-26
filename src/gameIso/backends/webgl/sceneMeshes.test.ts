import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applyVisibilityTint,
  bakeWorldGeometry,
  worldBakeDeps,
  type BakedWorld,
  type TintAt,
  type WorldGeometry,
  billboardDepthOffsetUnits,
  billboardPose,
  buildWorldGeometry,
  collectBillboards,
  wholeSceneBillboardEls,
  contactShadow,
  contactShadowWidthM,
  actorBillboards,
  actorIdentityKey,
  reposerActeurs,
  contentBox,
  applyFogGamma,
  installFogGamma,
  povBackgroundIndoor,
  povFog,
  reposerBrume,
  skyTexture,
  FOG_GAMMA_DEFINE,
  sunContrast,
  sunRig,
  faceGroup,
  surfaceGrouping,
  wantsContactShadow,
  worldFaces,
  worldShadowBox,
  type WorldFace,
  AMBIENT_INTENSITY,
  BILLBOARD_DEPTH_BIAS_M,
  CONTACT_SHADOW_LIFT_M,
  DEPTH_BUFFER_BITS,
  LIGHT_COLOR,
  SHADOW_MAP_SIZE,
  SHADOW_NORMAL_BIAS_TEXELS,
  SUN_ELEVATION_DEG,
  SUN_INTENSITY,
} from './sceneMeshes';
import { facesGeometry, polyBounds, type Vec3 } from './worldTris';
import { faceDepthOf } from './faceRelief';
import { anchorAndSize, billboardHeightM, subjectQuad, BILLBOARD_BOX_ASPECT, type BillboardConvention } from './billboardMath';
import { BB_W, BB_H } from '../../pov/billboardCore';
import type { Combatant } from '../../../engine/types';
import { tintOf } from './visibilityTint';
import { faceSurface, tintVarFactor } from './faceColors';
import { faceBakeData, FACE_PX_PER_M } from './faceBake';
import { coursesPeriodM, groundPeriodM, roofCourseStepM, variantOf, N_VARIANTS } from '../../detail/courses';
import { facadeStructureAppearance } from '../../catalog/facades';
import { FASCIA_THICK_M, roofMaterial } from '../../catalog/roofs';
import { wallPartRelief, WALL_PARTS } from '../../catalog/structures';
import { ROOF_SLOPE_M } from '../../builders/roofs';
import { buildWalls } from '../../builders/walls';
import { tousLesTerrains } from '../../../state/terrain';
import type { Face, SceneEl } from '../../builders/types';
import { buildScene } from '../../../state/mapSpec';
import { spec as siegeSpec } from '../../../scenes/test-scenarios/siege-enceinte';
import { scenario as arene } from '../../../scenes/test-scenarios/arene';
import { scenario as pontVitrine } from '../../../scenes/test-scenarios/pont-vitrine';
import { scenario as diligence } from '../../../scenes/test-scenarios/diligence';
import { buildOperaFloorplan } from '../../../scenes/opera/floorplan';
import { buildVitrineScene } from '../../../scenes/vitrine-batiments';
import { emptyScene, sceneMetresPerTile, type Scene, type Terrain } from '../../../state/scene';
import { PROPS, propSvg } from '../../catalog/decor';
import { AMBIANCE, ambianceLuminance } from '../../catalog/ambiance';
import { schema as ambianceSchema } from '../../../data/schemas/defs/ambiance';
import { fogAt, fogCurveOf } from '../../pov/camera';
import { memoByRef, memoByRefDeps } from '../../../state/sceneMemo';
import { srgbToLinear, toHex } from '../../shade';

const scene = buildScene(siegeSpec);
const mpt = sceneMetresPerTile(scene);
const plein = () => 1;

/** La scène d'un CONSTRUCTEUR de témoin, retenue par l'identité du constructeur : les témoins sont
 *  traversés par plusieurs bancs de ce fichier, et une scène rebâtie à chaque `it` n'a plus la même
 *  identité — donc plus aucun bake retenu. La construction reste PARESSEUSE (rien n'est bâti à
 *  l'import), et une scène fabriquée sur place, hors de cette table, garde son identité neuve. */
const sceneDe = memoByRef((faire: () => Scene) => faire());
/** Le bake d'une scène, RETENU par son read-set réel — le patron de l'écran (`stage/GameStage3D.tsx`,
 *  `memoByRefDeps`), ici pour les bancs qui recuisent la MÊME scène d'un `it` à l'autre. */
const bakeRetenu = memoByRefDeps<Scene, BakedWorld>();
const cuire = (s: Scene, m: number): BakedWorld => bakeRetenu(s, worldBakeDeps(s, m), () => bakeWorldGeometry(s, m));
/** `buildWorldGeometry` sur un bake RETENU : mêmes sommets, mêmes couleurs — la teinte se recalcule en
 *  place à chaque appel. À n'employer que là où UNE géométrie est lue à la fois : deux appels rendent
 *  LE MÊME objet (contrat de propriété de `BakedWorld`), donc un banc qui compare deux teintes
 *  côte à côte, ou deux constructions, garde `buildWorldGeometry`. */
const monde = (s: Scene, m: number, tint: TintAt = plein): WorldGeometry => applyVisibilityTint(cuire(s, m), tint).geometry;

/** Le PRÉPROCESSEUR GLSL, pour le seul cas qui nous occupe : `POV_FOG_GAMMA` non défini — tout bloc
 *  `#ifdef POV_FOG_GAMMA … #endif` disparaît, lignes comprises. Idempotent sur un chunk qui n'en porte
 *  pas (aucune ligne à retirer), ce qui le rend sûr à appliquer AVANT comme APRÈS la surcharge. */
function sansDéfine(glsl: string): string {
  const gardées: string[] = [];
  let dansLeBloc = false;
  for (const ligne of glsl.split('\n')) {
    if (!dansLeBloc && ligne.includes(`#ifdef ${FOG_GAMMA_DEFINE}`)) { dansLeBloc = true; continue; }
    if (dansLeBloc) { if (ligne.includes('#endif')) dansLeBloc = false; continue; }
    gardées.push(ligne);
  }
  return gardées.join('\n');
}

/** Le chunk de brume TEL QUE three le compile sans le define — capturé à l'import, donc avant toute pose
 *  de ce banc (et débarrassé du bloc si un autre banc du même worker a déjà installé la surcharge). */
const CHUNK_SANS_DEFINE = sansDéfine(THREE.ShaderChunk.fog_fragment);

/** Nommé : c'est l'IDENTITÉ du constructeur qui porte le bake retenu, donc le banc hors table
 *  (`écarte le terrain nu`) doit demander la MÊME vitrine que la table des témoins. */
const faireVitrine = () => buildVitrineScene();

/** Les SIX scènes-témoins du chantier de rendu — la population que l'utilisateur juge. */
const TEMOINS: [string, () => Scene][] = [
  ['siege-enceinte', () => scene],
  ['pont-vitrine', () => pontVitrine.scene],
  ['opera', () => buildOperaFloorplan()],
  ['arene', () => arene.scene],
  ['vitrine-batiments', faireVitrine],
  ['diligence', () => diligence.scene],
];

/** Normale (unitaire) du triangle `i` de la géométrie fusionnée. */
function triNormal(pos: Float32Array | ArrayLike<number>, i: number) {
  const p = (k: number) => ({ x: pos[(i * 3 + k) * 3], y: pos[(i * 3 + k) * 3 + 1], z: pos[(i * 3 + k) * 3 + 2] });
  const [a, b, c] = [p(0), p(1), p(2)];
  const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  const n = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x };
  const len = Math.hypot(n.x, n.y, n.z) || 1;
  const centre = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3, z: (a.z + b.z + c.z) / 3 };
  return { x: n.x / len, y: n.y / len, z: n.z / len, centre };
}

describe('FUSION — toute la scène en UNE géométrie', () => {
  it('une seule BufferGeometry porte position + couleur de tous les triangles, sous un index IDENTITÉ', () => {
    const g = monde(scene, mpt);
    const pos = g.getAttribute('position');
    const col = g.getAttribute('color');
    // Aucun sommet PARTAGÉ (`computeVertexNormals` donne donc la normale de FACE) : l'index est
    // l'identité, et il n'existe que pour donner au masque de dégagement une case à réécrire.
    const idx = g.getIndex()!;
    expect(idx.count).toBe(pos.count);
    expect(Array.from(idx.array as Uint32Array).every((v, i) => v === i)).toBe(true);
    expect(pos.count).toBeGreaterThan(3000);
    expect(pos.count % 3).toBe(0);
    expect(col.count).toBe(pos.count);
    expect(g.getAttribute('normal').count).toBe(pos.count);
  });

  it('la teinte de visibilité MULTIPLIE la couleur de face (case explorée = plus sombre)', () => {
    const clair = buildWorldGeometry(scene, mpt, plein).getAttribute('color').array as Float32Array;
    const sombre = buildWorldGeometry(scene, mpt, () => tintOf('explored')).getAttribute('color').array as Float32Array;
    expect(sombre.length).toBe(clair.length);
    const somme = (a: Float32Array) => a.reduce((s, v) => s + v, 0);
    expect(somme(sombre)).toBeCloseTo(somme(clair) * tintOf('explored'), 1);
  });
});

describe('ORIENTATION — les triangles regardent DEHORS (la carte d’ombre en dépend)', () => {
  /** Le dehors d'une face ORIENTÉE est celui de SON volume ; celui d'une face sans orientation propre est
   *  le haut (horizontale) ou l'extérieur de la carte (verticale).
   *  Deux façons de porter son volume, deux mesures : une BOÎTE MINCE (plusieurs quads, `g.normal` nul)
   *  se mesure au centre de sa boîte ; une face qui ferme DÉJÀ un volume (décor volumique : un seul quad,
   *  `g.normal` renseigné) se mesure à SA propre normale — le centre de sa boîte est dans son plan, et
   *  l'y projeter ne mesurerait que du bruit de virgule flottante. */
  function bilan(scn: Scene) {
    const m = sceneMetresPerTile(scn);
    const listées = worldFaces(scn);
    const pos = monde(scn, m).getAttribute('position').array as Float32Array;
    const geoms = facesGeometry(listées.map((f) => f.face), m, faceDepthOf());
    // La fusion émet les faces GROUPÉES par surface (un groupe = un dessin) : le bilan les parcourt
    // dans CET ordre, sinon il compare le triangle d'une face à la normale d'une autre.
    const ordre = surfaceGrouping(listées, m).faceIndices.flat();
    const cx = ((scn.dimensions.w - 1) / 2) * m;
    const cz = ((scn.dimensions.h - 1) / 2) * m;
    let i = 0;
    const b = { volumiques: 0, rentrantes: 0, horizontales: 0, versLeBas: 0, verticales: 0, versLInterieur: 0 };
    for (const fi of ordre) {
      const g = geoms[fi];
      const boite = polyBounds(g.tris.flat());
      const mid: Vec3 = {
        x: (boite.lo.x + boite.hi.x) / 2,
        y: (boite.lo.y + boite.hi.y) / 2,
        z: (boite.lo.z + boite.hi.z) / 2,
      };
      for (let k = 0; k < g.tris.length; k++, i++) {
        const n = triNormal(pos, i);
        if (g.oriented) {
          const c = { x: n.centre.x, y: n.centre.y, z: n.centre.z };
          b.volumiques++;
          const dehors = g.normal
            ? n.x * g.normal.x + n.y * g.normal.y + n.z * g.normal.z
            : n.x * (c.x - mid.x) + n.y * (c.y - mid.y) + n.z * (c.z - mid.z);
          if (dehors < 0) b.rentrantes++;
        } else if (Math.abs(n.y) > 1e-6) {
          b.horizontales++;
          if (n.y < 0) b.versLeBas++;
        } else {
          b.verticales++;
          if (n.x * (n.centre.x - cx) + n.z * (n.centre.z - cz) < 0) b.versLInterieur++;
        }
      }
    }
    expect(i * 3).toBe(pos.length / 3); // la fusion rend EXACTEMENT les triangles de `facesGeometry`
    return b;
  }

  for (const [nom, scn] of [['siege-enceinte', scene], ['arene', arene.scene]] as [string, Scene][])
    it(`${nom} : 0 triangle de mur à normale rentrante, 0 face libre retournée`, () => {
      const b = bilan(scn);
      expect(b.volumiques).toBeGreaterThan(1000);
      expect(b.horizontales).toBeGreaterThan(100);
      expect({ rentrantes: b.rentrantes, versLeBas: b.versLeBas, versLInterieur: b.versLInterieur }).toEqual({
        rentrantes: 0,
        versLeBas: 0,
        versLInterieur: 0,
      });
    });
});

describe('BILLBOARDS — sujets de la scène', () => {
  it('les personnages et le décor sont collectés, ancrés aux pieds, avec leur SVG par vue', () => {
    const subs = collectBillboards(scene, mpt, wholeSceneBillboardEls(scene));
    const persos = subs.filter((s) => s.kind === 'personnage');
    expect(persos.length).toBeGreaterThan(0);
    expect(subs.some((s) => s.kind === 'prop')).toBe(true);
    const svg = persos[0].svg('front', false, 0);
    expect(svg).toContain('<defs>'); // le blob de rasterisation est un document ISOLÉ : défs incluses
    expect(svg).toContain('data-bone');
    expect(persos[0].svg('profile', false, 0)).not.toBe(svg); // la VUE demandée change le dessin
    expect(persos[0].box).toEqual({ w: 120, h: 150 });
  });

  it('le SVG d\'un PERSONNAGE ignore le cran de caméra, celui d\'un DÉCOR directionnel en dépend — c\'est ce qui règle la clé de cache', () => {
    const perso = collectBillboards(scene, mpt, wholeSceneBillboardEls(scene)).find((s) => s.kind === 'personnage')!;
    for (const camRot of [1, 2, 3] as const)
      expect(perso.svg('front', false, camRot)).toBe(perso.svg('front', false, 0));
    // Le décor délègue à `propSvg(ref, dir, camRot)` : un prop DIRECTIONNEL (`views`) pivote avec la
    // caméra, donc son cran reste dans la clé de cache. Lu sur le REGISTRE (les scènes du spike
    // n'en posent aucun aujourd'hui — une carte en posera un demain sans toucher au cache).
    const directionnels = Object.values(PROPS).filter((p) => p.views);
    expect(directionnels.length).toBeGreaterThan(0);
    expect(directionnels.every((p) => propSvg(p.id, 'S', 1) !== propSvg(p.id, 'S', 0))).toBe(true);
  });
});

describe('CONTENU — ce qu’un cadrage doit tenir', () => {
  const quadDe = (s: { kind: 'personnage' | 'prop'; scaleK: number }) =>
    anchorAndSize(billboardHeightM('jeu', s.kind) * s.scaleK, BILLBOARD_BOX_ASPECT);

  for (const [nom, faire] of TEMOINS)
    it(`${nom} : la boîte de contenu tient dans la géométrie élargie aux sujets, et porte tout le bâti`, () => {
      const scn = sceneDe(faire);
      const m = sceneMetresPerTile(scn);
      const geoBox = monde(scn, m).boundingBox!;
      const subs = collectBillboards(scn, m, wholeSceneBillboardEls(scn));
      const box = contentBox(scn, m, subs, quadDe, geoBox);
      const englobante = worldShadowBox(geoBox, subs, quadDe);
      // La boîte englobante vient de l'attribut de position, en FLOAT32 : elle arrondit d'un ULP là où
      // la boîte de contenu lit les sommets en double. La marge est millimétrique, jamais métrique.
      expect(englobante.clone().expandByScalar(1e-3).containsBox(box)).toBe(true);
      // Toute face NON-TERRAIN (relief, structure, toiture) tient dans la boîte de contenu. Les rangs
      // coplanaires se mesurent sur la liste ENTIÈRE (contrat de `coplanarRanks`) : on filtre APRÈS.
      const toutes = worldFaces(scn).map((f) => f.face);
      const geoms = facesGeometry(toutes, m, faceDepthOf());
      let bati = 0;
      let dehors = 0;
      for (let i = 0; i < toutes.length; i++) {
        if (toutes[i].material.domain === 'terrain') continue;
        bati++;
        for (const tri of geoms[i].tris)
          for (const p of tri) if (!box.containsPoint(new THREE.Vector3(p.x, p.y, p.z))) dehors++;
      }
      expect(bati).toBeGreaterThan(0);
      expect(dehors).toBe(0);
    });

  it('elle ÉCARTE le terrain nu : la plaine d’herbe de vitrine-batiments sort du cadrage', () => {
    const scn = sceneDe(faireVitrine);
    const m = sceneMetresPerTile(scn);
    const geoBox = monde(scn, m).boundingBox!;
    const subs = collectBillboards(scn, m, wholeSceneBillboardEls(scn));
    const box = contentBox(scn, m, subs, quadDe, geoBox);
    const t = (b: THREE.Box3) => b.getSize(new THREE.Vector3());
    // Mesuré #1176 : 60×48 m de géométrie pour 51,4×37,1 m de contenu.
    expect(t(box).x).toBeLessThan(t(geoBox).x - 5);
    expect(t(box).z).toBeLessThan(t(geoBox).z - 5);
  });

  it('une carte de PLAINE (aucune face hors terrain) retombe sur la boîte fournie', () => {
    const plaine: Scene = {
      ...scene,
      dimensions: { w: 6, h: 6 },
      layers: [{ z: 0, tiles: Array<Terrain>(36).fill('herbe') }],
      walls: [],
      architecture: [],
      entities: [],
    };
    const m = sceneMetresPerTile(plaine);
    expect(worldFaces(plaine).every((f) => f.face.material.domain === 'terrain')).toBe(true);
    const repli = new THREE.Box3(new THREE.Vector3(-3, 0, -4), new THREE.Vector3(3, 2, 4));
    expect(contentBox(plaine, m, [], quadDe, repli).equals(repli)).toBe(true);
  });
});

describe('LUMIÈRE — un soleil neutre et calibré', () => {
  it('les deux lumières sont NEUTRES : elles modulent la luminance, jamais la teinte de l’albédo', () => {
    const c = new THREE.Color(LIGHT_COLOR);
    expect([c.g - c.r, c.b - c.r]).toEqual([0, 0]); // gris pur : aucune dérive de teinte sur l'albédo
    expect(c.r).toBeGreaterThan(0.9); // et à pleine luminance : la lumière n'assombrit pas non plus
  });

  // Le RENDU réel se juge sur planche (`scripts/qc/capture-jeu.mjs`) — ici, seul le réglage est tenu :
  // sous le lambertien de three, une nappe au sol reçoit `AMBIENT + SUN·sin(élévation)` et une face dos au
  // soleil `AMBIENT`, soit un contraste `1 + sin(élévation)·SUN/AMBIENT`.
  it('le contraste nappe ÷ dos au soleil vaut 2,16 à 10 % près, l’ambiante ne descend pas au noir', () => {
    const cible = 1 + Math.sin((38 * Math.PI) / 180) * (0.85 / 0.45);
    expect(cible).toBeCloseTo(2.16, 2);
    expect(sunContrast()).toBeCloseTo(1 + Math.sin((SUN_ELEVATION_DEG * Math.PI) / 180) * (SUN_INTENSITY / AMBIENT_INTENSITY), 12);
    expect(sunContrast()).toBeGreaterThan(cible * 0.9);
    expect(sunContrast()).toBeLessThan(cible * 1.1);
    expect(AMBIENT_INTENSITY).toBeGreaterThan(0.35);
    expect(AMBIENT_INTENSITY + SUN_INTENSITY).toBeLessThan(1.5); // ni face brûlée
  });

  it('l’élévation ne dépend PAS de la taille de la carte (une grande scène ne met pas le soleil au zénith)', () => {
    const elevDe = (b: THREE.Box3) => {
      const rig = sunRig(b);
      const d = rig.position.clone().sub(rig.target);
      return (Math.atan2(d.y, Math.hypot(d.x, d.z)) * 180) / Math.PI;
    };
    const petite = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(20, 4, 20));
    const grande = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(400, 4, 400));
    expect(elevDe(petite)).toBeCloseTo(SUN_ELEVATION_DEG, 6);
    expect(elevDe(grande)).toBeCloseTo(SUN_ELEVATION_DEG, 6);
  });

  // Le frustum se calcule sur les CASTEURS : la géométrie ET les quads de billboard. Sur la seule boîte
  // de géométrie, un sujet du siège débordait de 0,769 m (3,44 m à `pont-vitrine` en `heroique`) — hors
  // frustum, la silhouette cesse de projeter.
  for (const [nom, faire] of TEMOINS)
    it(`${nom} : le frustum d’ombre contient la géométrie ET les billboards (ancres + sommets)`, () => {
      const scn = sceneDe(faire);
      const m = sceneMetresPerTile(scn);
      const geoBox = monde(scn, m).boundingBox!;
      const subs = collectBillboards(scn, m, wholeSceneBillboardEls(scn));
      const quadDe = (s: (typeof subs)[number]) =>
        anchorAndSize(billboardHeightM('jeu', s.kind) * s.scaleK, BILLBOARD_BOX_ASPECT);
      const box = worldShadowBox(geoBox, subs, quadDe);
      const rig = sunRig(box);
      const vue = new THREE.Matrix4()
        .lookAt(rig.position, rig.target, new THREE.Vector3(0, 1, 0))
        .setPosition(rig.position)
        .invert();
      const points: THREE.Vector3[] = [];
      for (const x of [geoBox.min.x, geoBox.max.x])
        for (const y of [geoBox.min.y, geoBox.max.y])
          for (const z of [geoBox.min.z, geoBox.max.z]) points.push(new THREE.Vector3(x, y, z));
      for (const s of subs) {
        const q = quadDe(s);
        for (const dx of [-q.widthM / 2, q.widthM / 2])
          for (const dy of [0, q.heightM])
            for (const dz of [-q.widthM / 2, q.widthM / 2])
              points.push(s.anchor.clone().add(new THREE.Vector3(dx, dy, dz)));
      }
      let hors = 0;
      let horsBoite = 0;
      for (const p of points) {
        if (!box.containsPoint(p)) horsBoite++;
        const c = p.clone().applyMatrix4(vue);
        if (Math.abs(c.x) > rig.span || Math.abs(c.y) > rig.span || -c.z < rig.near || -c.z > rig.far) hors++;
      }
      // 8 coins de géométrie + les 8 sommets du quad de CHAQUE sujet : la garde couvre bien les billboards.
      expect({ points: points.length, horsBoite, hors }).toEqual({ points: 8 + 8 * subs.length, horsBoite: 0, hors: 0 });
    });

  it('le biais de normale se compte en TEXELS de la carte d’ombre (jamais un forfait métrique)', () => {
    const box = monde(scene, mpt).boundingBox!;
    const rig = sunRig(box);
    expect(rig.mapSize).toBe(SHADOW_MAP_SIZE);
    expect(rig.normalBias).toBeCloseTo(((2 * rig.span) / SHADOW_MAP_SIZE) * SHADOW_NORMAL_BIAS_TEXELS, 9);
    expect(rig.normalBias).toBeLessThan(0.25); // le forfait de 0,35 m mangeait l'ombre des blocs bas
  });

  // ── Le biais de normale grandit avec la scène (il vaut 3 texels de carte d'ombre, et un texel
  // couvre `2 × rayon / 2048` mètres) : un relief plus mince que lui se noie dans sa propre ombre.
  // La garde se joue donc scène par scène, sur la boîte des CASTEURS (géométrie + quads de billboard,
  // `worldShadowBox` — le chemin de l'écran), au PIRE des trois conventions de
  // taille offertes. Une scène plus large que l'opéra rougit ICI, au lieu de noyer le relief en silence.
  const MIN_RELIEF_M = Math.min(
    FASCIA_THICK_M,
    ...WALL_PARTS.map(wallPartRelief).flatMap((r) => (r.famille === 'saillie' ? [r.jutM] : [])),
  );
  /** Marge exigée du plus mince relief sur le biais d'ombre de la scène. */
  const MARGE_MIN = 1.2;

  /** Biais de normale RÉEL d'une scène, au pire des conventions de taille de billboard. */
  function biaisReel(scn: Scene): number {
    const m = sceneMetresPerTile(scn);
    const geoBox = monde(scn, m).boundingBox!;
    const subs = collectBillboards(scn, m, wholeSceneBillboardEls(scn));
    const biais = (['jeu', 'heroique', 'metrique'] as BillboardConvention[]).map((conv) =>
      sunRig(
        worldShadowBox(geoBox, subs, (s: (typeof subs)[number]) =>
          anchorAndSize(billboardHeightM(conv, s.kind) * s.scaleK, BILLBOARD_BOX_ASPECT),
        ),
      ).normalBias,
    );
    return Math.max(...biais);
  }

  for (const [nom, faire] of TEMOINS)
    it(`${nom} : le plus MINCE relief du catalogue dépasse le biais d’ombre de la scène (marge ≥ 20 %)`, () => {
      const biais = biaisReel(sceneDe(faire));
      expect([nom, biais > 0]).toEqual([nom, true]);
      expect([nom, MIN_RELIEF_M > biais]).toEqual([nom, true]);
      expect([nom, MIN_RELIEF_M / biais >= MARGE_MIN]).toEqual([nom, true]);
    });
});

describe('CIEL & BRUME — les couleurs du POV, jamais des teintes propres au spike', () => {
  it('À PLEINE LUMIÈRE (le neutre) : le dégradé va de la brume d’horizon (bas) au haut de ciel — les teintes du catalogue', () => {
    const tex = skyTexture();
    const d = tex.image.data as Uint8Array;
    const hex = (i: number) => toHex(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    expect(hex(0)).toBe(AMBIANCE.pov.fogOutdoor.toLowerCase());
    expect(hex(tex.image.height / 2 - 1)).toBe(AMBIANCE.pov.fogOutdoor.toLowerCase()); // horizon à mi-hauteur
    expect(hex(tex.image.height - 1)).toBe(AMBIANCE.pov.skyTop.toLowerCase());
    expect(tex.colorSpace).toBe(THREE.SRGBColorSpace);
    // `ambianceLum` omis ≡ 1 : le palier de plein jour ne déplace aucun octet.
    expect(Array.from(skyTexture(undefined, 1).image.data as Uint8Array)).toEqual(Array.from(d));
  });

  it('la brume reprend la courbe de profondeur du POV, en CASES converties en mètres', () => {
    const fog = povFog(mpt, false);
    const d = AMBIANCE.pov.depth.outdoor;
    expect(fog.near).toBeCloseTo(d.fogStartT * mpt, 9);
    expect(fog.far).toBeCloseTo(d.farTiles * mpt, 9);
    expect(`#${fog.color.getHexString(THREE.SRGBColorSpace)}`).toBe(AMBIANCE.pov.fogOutdoorSurface.toLowerCase());
  });

  it('la brume se REPOSE : même objet, paramètres neufs, et un verdict qui dit lequel a bougé', () => {
    const fog = povFog(mpt, false);
    const objet = fog;
    expect(reposerBrume(fog, mpt, false), 'rien n’a bougé : rien à repeindre').toBe(false);
    // Le palier d'ambiance : seule la COULEUR bouge, et le verdict la voit.
    expect(reposerBrume(fog, mpt, false, null, 0.3)).toBe(true);
    expect(fog).toBe(objet);
    expect(`#${fog.color.getHexString(THREE.SRGBColorSpace)}`)
      .toBe(`#${povFog(mpt, false, null, 0.3).color.getHexString(THREE.SRGBColorSpace)}`);
    // La météo authorée : la portée se resserre sur le MÊME objet.
    const serrée = povFog(mpt, false, { color: '#8fa6bb', povTightenK: 0.5 }, 0.3);
    expect(reposerBrume(fog, mpt, false, { color: '#8fa6bb', povTightenK: 0.5 }, 0.3)).toBe(true);
    expect(fog.near).toBe(serrée.near);
    expect(fog.far).toBe(serrée.far);
    expect(fog.color.equals(serrée.color)).toBe(true);
    // …et une repose à l'identique ne réclame plus d'image.
    expect(reposerBrume(fog, mpt, false, { color: '#8fa6bb', povTightenK: 0.5 }, 0.3)).toBe(false);
  });

  it('DEUX couleurs : la brume des SURFACES n’est pas celle du CIEL (les sols ne se relèvent pas)', () => {
    const surface = `#${povFog(mpt, false).color.getHexString(THREE.SRGBColorSpace)}`;
    expect(surface).toBe(AMBIANCE.pov.fogOutdoorSurface.toLowerCase());
    expect(surface).not.toBe(AMBIANCE.pov.fogOutdoor.toLowerCase());
    const ciel = skyTexture();
    const d = ciel.image.data as Uint8Array;
    // Bas de la texture = l'horizon : c'est la brume de CIEL qui s'y trouve, pas celle des surfaces.
    expect(toHex(d[0], d[1], d[2])).toBe(AMBIANCE.pov.fogOutdoor.toLowerCase());
  });

  it('INTÉRIEUR : brume sombre COURTE, et un fond sombre au lieu du ciel', () => {
    const fog = povFog(mpt, true);
    const d = AMBIANCE.pov.depth.indoor;
    expect(fog.near).toBeCloseTo(d.fogStartT * mpt, 9);
    expect(fog.far).toBeCloseTo(d.farTiles * mpt, 9);
    expect(`#${fog.color.getHexString(THREE.SRGBColorSpace)}`).toBe(AMBIANCE.pov.fogIndoor.toLowerCase());
    expect(fog.far, 'la brume d’intérieur est plus COURTE que celle du dehors').toBeLessThan(povFog(mpt, false).far);
    const fond = povBackgroundIndoor();
    expect(fond.isColor).toBe(true);
    expect(`#${fond.getHexString(THREE.SRGBColorSpace)}`).toBe(AMBIANCE.pov.fogIndoor.toLowerCase());
  });
});

/**
 * PALIER D'AMBIANCE du ciel et des brumes (#1176) — le défaut mesuré à la bascule C4 : une scène
 * `ambientLight: 'nuit'` rendait un sol au palier (#473929) sous un horizon resté à `fogOutdoor`
 * NON ATTÉNUÉ (sonde du juge : #7f9ab4 à l'écran), soit un ciel de plein jour en pleine nuit.
 *
 * LA RÈGLE : le ciel et les brumes n'ont pas de luminosité propre — ils prennent le MÊME scalaire que
 * le monde, `ambianceLuminance(palier)` (`catalog/ambiance.ts`), celui que `stageLightScalars` sert
 * aux lampes sous le nom `ambianceLum`.
 *
 * ESPACE DE MÉLANGE : LINÉAIRE, celui où les lampes de three multiplient l'albédo des faces (les
 * couleurs de sommet sont DÉCODÉES, `applyVisibilityTint` : `c.set(hex)` convertit sRGB → espace de
 * travail). L'étalon du banc est donc `commeUneFace` ci-dessous : la couleur du ciel traitée
 * exactement comme l'albédo d'une face au même palier. Une atténuation faite sur l'OCTET sRGB
 * tomberait bien sous ce que le monde rend au même palier — écart déclaré au correctif.
 */
describe('PALIER D’AMBIANCE (#1176) — le ciel et les brumes n’ont pas de luminosité propre', () => {
  /** Le palier `nuit` de `src/data/lightLevels.json` (0,18), passé par la porte des lampes. */
  const LUM_NUIT = ambianceLuminance(0.18);
  /** La loi du MONDE : l'albédo décodé × le palier, en LINÉAIRE — puis relu en octets sRGB. */
  const commeUneFace = (hex: string, lum: number) =>
    `#${new THREE.Color(hex).multiplyScalar(lum).getHexString(THREE.SRGBColorSpace)}`;
  const horizonDe = (lum: number) => {
    const d = skyTexture(undefined, lum).image.data as Uint8Array;
    return [d[0], d[1], d[2]] as const;
  };

  it('le palier `nuit` vaut bien 0,3276 — la donnée, pas un nombre recopié', () => {
    expect(LUM_NUIT).toBeCloseTo(0.3276, 4);
  });

  it('HORIZON de nuit : atténué par le palier, exactement comme l’albédo d’une face (sonde du juge)', () => {
    const nuit = horizonDe(LUM_NUIT);
    expect(toHex(...nuit)).toBe(commeUneFace(AMBIANCE.pov.fogOutdoor, LUM_NUIT));
    // NON-RÉGRESSION de la sonde : plus jamais l'octet plein du catalogue (ni le #7f9ab4 mesuré à
    // l'écran, qui en est l'interpolation) là où la nuit est tombée.
    expect(toHex(...nuit)).not.toBe(AMBIANCE.pov.fogOutdoor.toLowerCase());
    const jour = horizonDe(1);
    for (const k of [0, 1, 2]) expect(nuit[k]).toBeLessThan(jour[k]);
    // …et l'atténuation est CELLE du monde : le rapport de luminance vaut le palier, par canal.
    for (const k of [0, 1, 2]) expect(srgbToLinear(nuit[k]) / srgbToLinear(jour[k])).toBeCloseTo(LUM_NUIT, 2);
  });

  it('HAUT DE CIEL de nuit : même palier — le dégradé s’éteint entier, pas seulement son bas', () => {
    const tex = skyTexture(undefined, LUM_NUIT);
    const d = tex.image.data as Uint8Array;
    const i = (tex.image.height - 1) * 4;
    expect(toHex(d[i], d[i + 1], d[i + 2])).toBe(commeUneFace(AMBIANCE.pov.skyTop, LUM_NUIT));
  });

  it('BRUME DES SURFACES de nuit : même palier — un sol lointain ne se relève pas vers une brume diurne', () => {
    const fog = povFog(mpt, false, null, LUM_NUIT);
    expect(`#${fog.color.getHexString(THREE.SRGBColorSpace)}`).toBe(commeUneFace(AMBIANCE.pov.fogOutdoorSurface, LUM_NUIT));
    // La couleur de brume est consommée par three en LINÉAIRE : c'est là que le facteur s'applique.
    expect(fog.color.r).toBeCloseTo(new THREE.Color(AMBIANCE.pov.fogOutdoorSurface).r * LUM_NUIT, 9);
    // La brume AUTHORÉE de météo (#1247) n'y échappe pas : elle remplace la teinte, pas le palier.
    const orage = povFog(mpt, false, { color: '#8fa6bb' }, LUM_NUIT);
    expect(`#${orage.color.getHexString(THREE.SRGBColorSpace)}`).toBe(commeUneFace('#8fa6bb', LUM_NUIT));
  });

  it('INTÉRIEUR : le fond suit le palier lui aussi (nappe du monde, pas décor autonome)', () => {
    const fond = povBackgroundIndoor(LUM_NUIT);
    expect(`#${fond.getHexString(THREE.SRGBColorSpace)}`).toBe(commeUneFace(AMBIANCE.pov.fogIndoor, LUM_NUIT));
  });

  it('TABLE des paliers de `lightLevels.json` — l’horizon mesuré à chaque cran', () => {
    const table = ([1, 0.75, 0.45, 0.18, 0] as const).map((s) => [s, toHex(...horizonDe(ambianceLuminance(s)))]);
    expect(table).toEqual([
      [1, '#9fb2c6'],
      [0.75, '#8fa0b3'],
      [0.45, '#798897'],
      [0.18, '#5f6b77'],
      [0, '#47505a'],
    ]);
  });
});

/**
 * LA COURBE — ce que le fragment de brume calcule RÉELLEMENT, comparé à la courbe DONNÉE du POV
 * (`fogAt`, `pov/camera.ts`). Le fog natif de three s'arrête au `smoothstep( fogNear, fogFar, depth )` :
 * la moitié de la courbe. La surcharge de chunk (`installFogGamma`) y ajoute le `pow(·, gamma)` sous
 * `#define`, et `applyFogGamma` pose ce define sur les matériaux embrumés.
 */
describe('GAMMA de la brume — la courbe du POV, pas la moitié de la courbe (#1176 P3-1c)', () => {
  /** `smoothstep` de GLSL (spec ES 3.0 §8.3) — le seul morceau de shader que ce banc réécrit. */
  function smoothstep(bord0: number, bord1: number, x: number): number {
    const t = Math.min(1, Math.max(0, (x - bord0) / (bord1 - bord0)));
    return t * t * (3 - 2 * t);
  }
  /** Le `fogFactor` du fragment de three, gamma installé : les trois paramètres viennent des objets
   *  RÉELS (near/far de `povFog`, gamma du `#define` posé par `applyFogGamma`). */
  const facteurShader = (profondeurM: number, fog: THREE.Fog, gamma: number): number =>
    Math.pow(smoothstep(fog.near, fog.far, profondeurM), gamma);

  /** Gamma tel que le shader le lira : la valeur du define posée sur un matériau embrumé. */
  function gammaPosé(gamma: number | null): number | undefined {
    const mat = new THREE.MeshLambertMaterial();
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    applyFogGamma(mesh, gamma);
    const v = mat.defines?.[FOG_GAMMA_DEFINE] as string | undefined;
    return v === undefined ? undefined : Number(v);
  }

  /** 400 profondeurs entre 0 et la portée du milieu. */
  const ÉCHANTILLONS = 400;
  function écartMax(indoor: boolean, gamma: number): number {
    const fog = povFog(mpt, indoor);
    const courbe = fogCurveOf(indoor);
    let max = 0;
    for (let i = 0; i <= ÉCHANTILLONS; i++) {
      const profondeurM = (i / ÉCHANTILLONS) * courbe.end * mpt;
      max = Math.max(max, Math.abs(facteurShader(profondeurM, fog, gamma) - fogAt(profondeurM / mpt, courbe)));
    }
    return max;
  }

  it('la surcharge de chunk ajoute le `pow` manquant, et une seule fois (idempotente)', () => {
    installFogGamma();
    const chunk = THREE.ShaderChunk.fog_fragment;
    expect(chunk, 'le `pow` doit être injecté (ancre de three r185 introuvable ?)').toContain(`fogFactor = pow( fogFactor, ${FOG_GAMMA_DEFINE} );`);
    expect(chunk).toContain(`#ifdef ${FOG_GAMMA_DEFINE}`);
    installFogGamma();
    expect(THREE.ShaderChunk.fog_fragment, 'une seconde pose n’empile pas un second `pow`').toBe(chunk);
    expect(chunk.split('pow( fogFactor').length - 1).toBe(1);
  });

  it('`applyFogGamma` pose le gamma du milieu sur les matériaux EMBRUMÉS, et le retire', () => {
    const monde = new THREE.Group();
    const embrumé = new THREE.MeshLambertMaterial();
    const sans = new THREE.MeshBasicMaterial({ fog: false });
    monde.add(new THREE.Mesh(new THREE.BufferGeometry(), embrumé), new THREE.Mesh(new THREE.BufferGeometry(), sans));
    expect(applyFogGamma(monde, AMBIANCE.pov.depth.outdoor.fogGamma)).toBe(true);
    expect(embrumé.defines?.[FOG_GAMMA_DEFINE]).toBe(AMBIANCE.pov.depth.outdoor.fogGamma.toFixed(4));
    expect(sans.defines?.[FOG_GAMMA_DEFINE], 'un matériau non embrumé n’a aucun gamma à porter').toBeUndefined();
    // Deuxième passe identique : rien ne change, donc aucune recompilation demandée.
    embrumé.needsUpdate = false;
    expect(applyFogGamma(monde, AMBIANCE.pov.depth.outdoor.fogGamma)).toBe(false);
    expect(applyFogGamma(monde, null)).toBe(true);
    expect(embrumé.defines?.[FOG_GAMMA_DEFINE]).toBeUndefined();
  });

  it('gamma POSÉ : le fragment rend EXACTEMENT la courbe donnée du POV, dedans comme dehors', () => {
    for (const indoor of [false, true]) {
      const gamma = gammaPosé(fogCurveOf(indoor).gamma)!;
      expect(gamma).toBe(fogCurveOf(indoor).gamma);
      expect(écartMax(indoor, gamma), `milieu ${indoor ? 'intérieur' : 'extérieur'}`).toBeLessThan(1e-9);
    }
  });

  it('gamma DÉBRANCHÉ (le smoothstep nu de three) : l’écart à la courbe du POV réapparaît', () => {
    // Les deux écarts mesurés au juge de design (#1176 P3-1) — c'est ce que la surcharge supprime.
    expect(écartMax(false, 1)).toBeCloseTo(0.25, 2);
    expect(écartMax(true, 1)).toBeCloseTo(0.067, 2);
  });

  it('SANS le define, le chunk surchargé rend le chunk d’origine — octet pour octet', () => {
    installFogGamma();
    const surchargé = THREE.ShaderChunk.fog_fragment;
    expect(surchargé, 'la surcharge doit bien avoir modifié le chunk').not.toBe(CHUNK_SANS_DEFINE);
    // La surcharge est GLOBALE au module three : tout écran qui ne pose pas le define (la vue de plateau,
    // les autres bancs) doit compiler EXACTEMENT le fragment d'avant — pas « à peu près ».
    expect(sansDéfine(surchargé)).toBe(CHUNK_SANS_DEFINE);
  });

  it('un gamma irreprésentable au littéral GLSL ÉCHOUE au lieu de rendre une brume pleine', () => {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial());
    // `toFixed(4)` rendrait « 0.0000 », donc `pow(x, 0) = 1` : la brume à fond partout, sans un mot.
    expect(() => applyFogGamma(mesh, 0.00004)).toThrow(/irreprésentable/);
    expect(() => applyFogGamma(mesh, 0)).toThrow(/irreprésentable/);
    expect(() => applyFogGamma(mesh, -2)).toThrow(/irreprésentable/);
  });

  it('le SCHÉMA de la donnée refuse un gamma sous le plancher du littéral', () => {
    expect(ambianceSchema.safeParse(AMBIANCE).success, 'la donnée en place reste valide').toBe(true);
    for (const gamma of [0.00004, 0, -2]) {
      const mauvais = structuredClone(AMBIANCE) as { pov: { depth: { outdoor: { fogGamma: number } } } };
      mauvais.pov.depth.outdoor.fogGamma = gamma;
      expect(ambianceSchema.safeParse(mauvais).success, `fogGamma = ${gamma} ne doit pas être authorable`).toBe(false);
    }
    expect(AMBIANCE.pov.depth.outdoor.fogGamma).toBeGreaterThanOrEqual(0.1);
    expect(AMBIANCE.pov.depth.indoor.fogGamma).toBeGreaterThanOrEqual(0.1);
  });
});

describe('BIAIS de PROFONDEUR — le quad ne bouge pas, seule sa profondeur ment', () => {
  it('l’ancre MONDE du quad est invariante par caméra : l’arête basse reste sur les pieds', () => {
    const ancre = new THREE.Vector3(12.5, 3.25, -7.75);
    const lift = 1.15;
    const cams = [
      new THREE.Quaternion(),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.6, 0.8, 0, 'YXZ')),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.1, 2.4, 0, 'YXZ')),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, -3.0, 0, 'YXZ')),
    ];
    for (const q of cams) {
      const pos = billboardPose(ancre, lift, q);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      const bas = pos.clone().addScaledVector(up, -lift);
      expect(bas.distanceTo(ancre)).toBeCloseTo(0, 9);
      // et AUCUNE composante le long du regard : le déplacement est colinéaire au haut d'écran.
      const regard = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
      expect(pos.clone().sub(ancre).dot(regard)).toBeCloseTo(0, 9);
    }
  });

  it('le biais vaut BILLBOARD_DEPTH_BIAS_M de profondeur, vers l’œil, et rien de plus', () => {
    const units = billboardDepthOffsetUnits(100, 300);
    expect(units).toBeLessThan(0); // vers l'œil
    expect(units).toBeCloseTo((-BILLBOARD_DEPTH_BIAS_M / 200) * 2 ** DEPTH_BUFFER_BITS, 6);
    // PERSPECTIVE : la profondeur fenêtre n'est pas linéaire — le même mètre coûte 4× moins loin ×2.
    const proche = billboardDepthOffsetUnits(0.1, 400, 5);
    const loin = billboardDepthOffsetUnits(0.1, 400, 10);
    expect(proche / loin).toBeCloseTo(4, 6);
  });
});

describe('OMBRE DE CONTACT — ancrée sous les pieds', () => {
  it('le disque n’existe qu’en couleur CUITE : en éclairé, l’ombre PROJETÉE fait foi', () => {
    expect(wantsContactShadow('personnage', false)).toBe(true);
    expect(wantsContactShadow('personnage', true)).toBe(false);
    expect(wantsContactShadow('prop', false)).toBe(false); // le décor porte son ellipse dans son art
  });

  it('le disque est à l’aplomb EXACT de l’ancre, posé à plat sur le sol', () => {
    const ancre = new THREE.Vector3(12.5, 3.25, -7.75);
    const disque = contactShadow({ anchor: ancre, box: { w: BB_W, h: BB_H } }, { heightM: 2 });
    expect(disque.position.x).toBe(ancre.x);
    expect(disque.position.z).toBe(ancre.z);
    expect(disque.position.y).toBeCloseTo(ancre.y + CONTACT_SHADOW_LIFT_M, 9);
    expect(disque.rotation.x).toBeCloseTo(-Math.PI / 2, 9);
    expect(disque.geometry.parameters.radius).toBeGreaterThan(0);
  });
});

/**
 * LE SOCLE DE FIGURINE (#1176 P3-5a) : sans soleil, le disque de contact EST le socle du pion — sa
 * taille dit le sujet, pas l'état de son art. La boîte d'un corps AU SOL est BALAYÉE par la chute
 * (`rigGroundTilt` : 193×193 contre 120×150 debout) : prise pour largeur de socle, elle donnait au
 * cadavre un socle ×1,6 plus large que celui du vivant identique à côté, et centré sur ses pieds.
 */
describe('OMBRE DE CONTACT — le socle se dimensionne sur le SUJET, jamais sur sa boîte d’art', () => {
  const scèneNue = emptyScene(6, 6);
  const mptNu = sceneMetresPerTile(scèneNue);

  const acteur = (patch: Partial<Combatant> = {}): Combatant =>
    ({
      id: 'a1', label: 'Acteur', kind: 'hero', pos: { x: 1, y: 1 }, size: 'moyenne',
      wounds: { current: 12, max: 12 }, weapons: [], characteristics: {}, advantage: 0,
      conditions: [], armour: {}, skills: [], talents: [], movement: 4, career: 'soldat', species: 'humain',
      ...patch,
    }) as unknown as Combatant;

  const sujetDe = (c: Combatant, rider?: Combatant) =>
    actorBillboards([{ c, ...(rider ? { rider } : {}), x: 1, y: 1, z: 0, facing: 'S' }], scèneNue, mptNu)[0];

  /** Le rayon MONDE du socle tel que la prod le monte : le sujet et son quad, rien d'autre. */
  const rayon = (s: ReturnType<typeof sujetDe>): number =>
    contactShadow(s, subjectQuad('jeu', s)).geometry.parameters.radius;

  it('un MORT porte le socle de ce même sujet VIVANT — la chute balaie l’art, pas le pion', () => {
    const vivant = sujetDe(acteur());
    const mort = sujetDe(acteur({ id: 'e1', kind: 'enemy', dead: true, wounds: { current: 0, max: 12 } } as Partial<Combatant>));
    expect(mort.anim?.ground, 'PRÉMISSE : ce sujet doit être au sol').toBe('corpse');
    expect(vivant.box.w, 'PRÉMISSE : le vivant garde la boîte canonique').toBe(BB_W);
    // PRÉMISSE de l'écart mesuré : la boîte du mort est BALAYÉE, en largeur comme en hauteur.
    expect(mort.box.w / vivant.box.w).toBeGreaterThan(1.5);
    expect(subjectQuad('jeu', mort).widthM / subjectQuad('jeu', vivant).widthM).toBeGreaterThan(1.5);
    expect(rayon(mort)).toBeCloseTo(rayon(vivant), 6);
    // et cette largeur commune est bien la CANONIQUE : `BB_W` à l'échelle art→monde du quad.
    expect(contactShadowWidthM(mort, subjectQuad('jeu', mort)))
      .toBeCloseTo((subjectQuad('jeu', vivant).heightM / BB_H) * BB_W, 6);
  });

  it('un À TERRE conscient aussi : la bascule est plus faible, le socle reste le même', () => {
    const debout = sujetDe(acteur());
    const àTerre = sujetDe(acteur({ conditions: [{ id: 'a-terre' }] } as unknown as Partial<Combatant>));
    expect(àTerre.anim?.ground, 'PRÉMISSE : ce sujet doit être au sol').toBe('prone');
    expect(rayon(àTerre)).toBeCloseTo(rayon(debout), 6);
  });

  it('un couple MONTÉ garde son socle : sa boîte est haussée en HAUTEUR seulement', () => {
    const monture = { id: 'm1', label: 'Cheval', kind: 'enemy', creatureId: 'cheval', pos: { x: 1, y: 1 }, size: 'grande', conditions: [], wounds: { current: 10, max: 10 }, riderId: 'a1' } as unknown as Combatant;
    const couple = sujetDe(monture, acteur());
    expect(couple.box.w).toBe(BB_W);
    expect(couple.box.h).toBeGreaterThan(BB_H);
    // largeur canonique === largeur du quad : le comportement du couple est INCHANGÉ par la dérivation.
    expect(contactShadowWidthM(couple, subjectQuad('jeu', couple))).toBeCloseTo(subjectQuad('jeu', couple).widthM, 9);
  });
});

describe('ATTRIBUTS d’UV — les deux jeux voyagent dans LA géométrie fusionnée', () => {
  it('chaque scène-témoin rend UNE géométrie qui porte position + couleur + uv + uv1, alignés au sommet', () => {
    for (const [nom, charge] of TEMOINS) {
      const scène = sceneDe(charge);
      const g = monde(scène, sceneMetresPerTile(scène));
      const n = g.getAttribute('position').count;
      // Index IDENTITÉ : un sommet par coin de triangle, aucun partage — la case que le masque de
      // dégagement réécrit (`applyCutawayMask`), jamais une déduplication de sommets.
      const idx = g.getIndex()!.array as Uint32Array;
      expect([nom, idx.length]).toEqual([nom, n]);
      expect([nom, idx[0], idx[n - 1]]).toEqual([nom, 0, n - 1]);
      expect([nom, n % 3]).toEqual([nom, 0]);
      expect([nom, g.getAttribute('color').count]).toEqual([nom, n]);
      expect([nom, g.getAttribute('uv').count]).toEqual([nom, n]);
      expect([nom, g.getAttribute('uv1').count]).toEqual([nom, n]);
      expect([nom, g.getAttribute('uv').itemSize, g.getAttribute('uv1').itemSize]).toEqual([nom, 2, 2]);
    }
  });

  it('`uv` est la maille MONDE en MÈTRES : chaque arête de triangle y garde sa longueur', () => {
    const g = monde(scene, mpt);
    const pos = g.getAttribute('position').array as Float32Array;
    const uv = g.getAttribute('uv').array as Float32Array;
    let pires = 0;
    for (let t = 0; t * 9 < pos.length; t++) {
      for (let i = 0; i < 3; i++) {
        const j = (i + 1) % 3;
        const a = t * 3 + i;
        const b = t * 3 + j;
        const d3 = Math.hypot(pos[a * 3] - pos[b * 3], pos[a * 3 + 1] - pos[b * 3 + 1], pos[a * 3 + 2] - pos[b * 3 + 2]);
        const dUV = Math.hypot(uv[a * 2] - uv[b * 2], uv[a * 2 + 1] - uv[b * 2 + 1]);
        if (Math.abs(d3 - dUV) > 1e-3) pires++;
      }
    }
    expect(pires).toBe(0);
  });

  it('`uv1` reste dans [0,1] et exploite la face (pas un aplat de zéros)', () => {
    const g = monde(scene, mpt);
    const uv1 = Array.from(g.getAttribute('uv1').array as Float32Array);
    expect(uv1.filter((v) => v < -1e-6 || v > 1 + 1e-6)).toEqual([]);
    expect(uv1.filter((v) => v > 0.99).length).toBeGreaterThan(100);
  });
});

describe('TEINTE de sommet — la variance par case est CUITE dans `color`', () => {
  /** Une nappe plate d'herbe : un albédo quasi unique, donc toute nuance résiduelle vient de la
   *  variance de teinte par case (le sol d'herbe porte `tintVar` en donnée). */
  const nappe = emptyScene(8, 8);

  /** Couleurs distinctes des sommets, arrondies au 1/10000. */
  const teintes = (g: THREE.BufferGeometry) => {
    const c = g.getAttribute('color').array as Float32Array;
    const out = new Set<string>();
    for (let k = 0; k < c.length; k += 3) out.add([c[k], c[k + 1], c[k + 2]].map((v) => v.toFixed(4)).join(','));
    return out;
  };
  const clé = (col: THREE.Color) => [col.r, col.g, col.b].map((v) => v.toFixed(4)).join(',');
  /** Teinte ATTENDUE d'une face : son albédo de matériau × la variance de SA case. */
  const attendue = (f: { face: Face; cell: { x: number; y: number; z: number } }) => {
    const s = faceSurface(f.face);
    return clé(new THREE.Color(s.color).multiplyScalar(tintVarFactor(s.recipe, f.cell)));
  };

  it('la nappe témoin porte bien de l’herbe à variance (sinon la mesure ne pèserait rien)', () => {
    const herbe = tousLesTerrains().find((t) => t.id === 'herbe')!;
    expect(herbe.detail?.tintVar).toBeGreaterThan(0);
    expect(worldFaces(nappe).filter((f) => f.face.material.id === 'herbe').length).toBeGreaterThan(50);
  });

  it('un sol à variance ne rend PAS un aplat : la nappe porte plusieurs nuances du MÊME albédo', () => {
    const g = buildWorldGeometry(nappe, sceneMetresPerTile(nappe), plein);
    const albédos = new Set(worldFaces(nappe).map((f) => faceSurface(f.face).color));
    expect(teintes(g).size).toBeGreaterThan(albédos.size);
  });

  it('la teinte d’un sommet est EXACTEMENT albédo × variance de sa case (jamais une couleur inventée)', () => {
    const g = buildWorldGeometry(nappe, sceneMetresPerTile(nappe), plein);
    expect(teintes(g)).toEqual(new Set(worldFaces(nappe).map(attendue)));
  });

  it('la variance se COMPOSE avec la teinte de visibilité, elle ne l’écrase pas', () => {
    const vue = buildWorldGeometry(nappe, sceneMetresPerTile(nappe), plein).getAttribute('color').array as Float32Array;
    const explorée = buildWorldGeometry(nappe, sceneMetresPerTile(nappe), () => tintOf('explored')).getAttribute('color')
      .array as Float32Array;
    for (let k = 0; k < vue.length; k += 997) expect(explorée[k]).toBeCloseTo(vue[k] * tintOf('explored'), 5);
  });

  it('la nuance est STABLE : deux constructions de la même scène donnent les mêmes couleurs', () => {
    const a = buildWorldGeometry(scene, mpt, plein).getAttribute('color').array as Float32Array;
    const b = buildWorldGeometry(scene, mpt, plein).getAttribute('color').array as Float32Array;
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe('GROUPES DE SURFACE — la géométrie reste UNE, le dessin se scinde', () => {
  /** Face nue de matériau `mat`, avec la pente de nappe `pitchM` (pans de toit) et son côté d'arête. */
  const wf = (mat: Face['material'], pitchM?: number, side?: WorldFace['side']): WorldFace => {
    const face: Face = { poly: [], material: mat, oriented: false };
    const cell = { x: 3, y: 4, z: 0 };
    return { face, cell, cellKey: '3,4,0', el: { kind: 'floor', cell, faces: [face] } as unknown as SceneEl, pitchM, side };
  };

  it('les groupes couvrent EXACTEMENT tous les sommets, chacun une fois', () => {
    const g = monde(scene, mpt);
    const total = g.getAttribute('position').count;
    expect(g.groups.length).toBe(g.userData.surfaceGroups.length);
    expect(g.groups.length).toBeGreaterThan(1); // la scène porte plus que le seul groupe nu
    const couvert = new Uint8Array(total);
    for (const grp of g.groups) for (let i = grp.start; i < grp.start + grp.count!; i++) couvert[i]++;
    expect(couvert.every((n) => n === 1)).toBe(true);
    // `materialIndex` = index du groupe de surface : le contrat du mesh multi-matériaux de l'écran.
    expect(g.groups.map((x) => x.materialIndex)).toEqual(g.userData.surfaceGroups.map((_, i) => i));
  });

  it('une face SANS appareillage tombe dans le groupe NU ; une pierre à assises a sa période', () => {
    const sansAssises = tousLesTerrains().find((t) => !t.detail?.courses)!;
    const nu = faceGroup(wf({ domain: 'terrain', id: sansAssises.id }), mpt);
    const pierre = faceGroup(wf({ domain: 'structure', id: 'mur-en-pierre', part: 'face' }), mpt);
    expect(pierre.kind).toBe('wall');
    expect(pierre.periodM).toEqual(coursesPeriodM(facadeStructureAppearance('mur-en-pierre').detail!.courses!));
    expect(pierre.key).not.toBe(nu.key);
    // La face nue n'emporte ni recette ni période : rien à texturer.
    expect([nu.kind, nu.periodM, nu.recipe]).toEqual([null, undefined, undefined]);
  });

  it('un SOL prend la période élargie du sol, en une seule variante', () => {
    const c = tousLesTerrains().find((t) => t.detail?.courses)!;
    const g = faceGroup(wf({ domain: 'terrain', id: c.id }), mpt);
    expect(g.kind).toBe('ground');
    expect(g.variant).toBe(0);
    expect(g.periodM).toEqual(groundPeriodM(c.detail!.courses!));
  });

  it('deux nappes de PENTES différentes ne partagent PAS un groupe (échelle par élément)', () => {
    const mat: Face['material'] = { domain: 'roof', id: 'tuile', part: 'N' };
    const hM = roofMaterial('tuile').detail!.courses!.hM;
    const plat = faceGroup(wf(mat, 1.0), mpt);
    const raide = faceGroup(wf(mat, 2.4), mpt);
    expect(plat.periodM!.v).toBe(2 * roofCourseStepM(1.0, hM, ROOF_SLOPE_M));
    expect(raide.periodM!.v).toBe(2 * roofCourseStepM(2.4, hM, ROOF_SLOPE_M));
    expect(plat.periodM!.v).not.toBe(raide.periodM!.v);
    expect(plat.key).not.toBe(raide.key);
    // La LARGEUR de période, elle, reste celle de l'appareillage : seule la cadence des rangs change.
    expect(plat.periodM!.u).toBe(raide.periodM!.u);
  });

  it('la variante d’anti-périodicité vient de l’identité MONDE de la face (même hash que l’affine)', () => {
    const mat: Face['material'] = { domain: 'structure', id: 'mur-en-pierre', part: 'face' };
    const ici = faceGroup(wf(mat, undefined, 'N'), mpt);
    expect(ici.variant).toBe(variantOf({ x: 3, y: 4 }, 'N'));
    const vus = new Set<number>();
    for (let x = 0; x < 40; x++) for (let y = 0; y < 40; y++) vus.add(variantOf({ x, y }, 'N'));
    expect(vus.size).toBe(N_VARIANTS); // les 3 variantes se rencontrent bien sur une carte
  });

  it('PARITÉ avec l’affine : la variante d’une face de MUR est celle de son CÔTÉ D’ARÊTE, jamais de sa `part`', () => {
    const murs = buildWalls(scene).filter((el) => el.faces.length);
    expect(murs.length).toBeGreaterThan(10);
    const parFace = new Map(worldFaces(scene).map((w) => [w.face, w]));
    let vérifiées = 0;
    const parts = new Set<string>();
    for (const el of murs) {
      // Ce que le backend affine passe à `variantOf` pour CE mur (`authoring/wallsSvg.ts`, `coursesOverlaySvg`).
      const attendu = variantOf(el.cell, el.side);
      for (const f of el.faces) {
        const w = parFace.get(f);
        if (!w) continue;
        const g = faceGroup(w, mpt);
        if (g.variant === undefined || g.kind !== 'wall') continue;
        expect([el.key, f.material.part, g.variant]).toEqual([el.key, f.material.part, attendu]);
        parts.add(f.material.part ?? '');
        vérifiées++;
      }
    }
    // La mesure porte sur PLUSIEURS parts d'un même appareillage : c'est la `part` qui divergeait.
    expect(vérifiées).toBeGreaterThan(50);
    expect(parts.size).toBeGreaterThan(1);
  });

  it('une façade à COLOMBAGE sort de la période pour sa CUISSON, et les jumelles se partagent une image', () => {
    let cuits = 0;
    let facesCuites = 0;
    let cellulesCuites = 0;
    for (const [nom, faire] of TEMOINS) {
      const scn = sceneDe(faire);
      const m = sceneMetresPerTile(scn);
      const wfs = worldFaces(scn);
      const { groups, faceIndices } = surfaceGrouping(wfs, m);
      const cellules = new Set<string>();
      groups.forEach((g, i) => {
        if (!g.bake) return;
        cuits++;
        facesCuites += faceIndices[i].length;
        for (const k of faceIndices[i]) cellules.add(wfs[k].cellKey);
        // Un groupe CUIT ne répète rien : il n'a pas de période, mais un gabarit et sa recette.
        expect([nom, g.periodM, g.recipe?.timber !== undefined]).toEqual([nom, undefined, true]);
        expect([nom, g.bake.wM > 0 && g.bake.hM > 0]).toEqual([nom, true]);
        // Le gabarit est quantifié au CENTIMÈTRE : c'est la maille de partage.
        expect([nom, g.bake.wM]).toEqual([nom, Math.round(g.bake.wM * 100) / 100]);
      });
      cellulesCuites += cellules.size;
    }
    expect(cuits).toBeGreaterThan(0);
    // Le cache MORD : strictement plus de faces cuites que d'images cuites, et surtout des façades de
    // CASES DIFFÉRENTES tombent sur la même image — c'est ce qu'une clé re-seedée à l'identité de face
    // détruirait (une image par mur).
    expect(facesCuites).toBeGreaterThan(cuits);
    expect(cellulesCuites).toBeGreaterThan(cuits);
  });

  it('AUCUNE face hors part `face` ne se colombe — parité avec ce que le backend affine habille', () => {
    // `authoring/wallsSvg.ts` cherche la face `part === 'face'` d'un mur, `authoring/wallsSvg.ts` écarte tout
    // le reste avant le colombage de la l.251, et `structureFaceSvg` (l.209) ne reçoit que des
    // fermetures de comble authorées `part: 'face'`. Une cuisson posée ailleurs (poteau, plinthe,
    // vitre…) peint des poutres là où le SVG n'en met aucune.
    const parts = new Set<string>();
    let cuits = 0;
    for (const [nom, faire] of TEMOINS) {
      const scn = sceneDe(faire);
      const wfs = worldFaces(scn);
      const { groups, faceIndices } = surfaceGrouping(wfs, sceneMetresPerTile(scn));
      groups.forEach((g, i) => {
        if (!g.bake) return;
        cuits++;
        for (const k of faceIndices[i]) {
          const p = wfs[k].face.material.part;
          parts.add(p ?? '-');
          expect([nom, g.key, p]).toEqual([nom, g.key, 'face']);
        }
      });
    }
    expect(cuits).toBeGreaterThan(0);
    expect([...parts]).toEqual(['face']);
  });

  it('aucune cuisson ne NOIRCIT sa face : jamais plus de la moitié des pixels sous le plein', () => {
    // Un masque majoritairement sombre n'est plus un ornement mais un bandeau : c'est ce que rendait la
    // cuisson d'une part étroite (un poteau de 8 cm de large recevait une ossature entière).
    let mesurés = 0;
    for (const [nom, faire] of TEMOINS) {
      const scn = sceneDe(faire);
      const { groups } = surfaceGrouping(worldFaces(scn), sceneMetresPerTile(scn));
      for (const g of groups) {
        if (!g.bake) continue;
        const b = faceBakeData({ color: g.color!, recipe: g.recipe, part: g.part }, g.bake.wM, g.bake.hM, FACE_PX_PER_M, g.variant ?? 0);
        expect([nom, g.key, b !== null]).toEqual([nom, g.key, true]); // une cuisson NEUTRE ne coûte pas un dessin
        let sombres = 0;
        for (let k = 0; k < b!.w * b!.h; k++) if (b!.data[k * 4] < 0.9 * 255) sombres++;
        expect([nom, g.key, sombres / (b!.w * b!.h) < 0.5]).toEqual([nom, g.key, true]);
        mesurés++;
      }
    }
    expect(mesurés).toBeGreaterThan(10);
  });
});

/**
 * LA POSE D'UN ACTEUR N'EST PAS SON IDENTITÉ (#1396) — la couture que le montage des quads interroge.
 * Un pas ou un pivot doit se REPOSER sur les sujets montés : l'identité, elle, ne bouge pas, faute de
 * quoi tout le groupe de billboards se démonte à chaque pas (mesuré : 13 matériaux libérés, 0 quad
 * survivant sur un banc de douze décors).
 */
describe('reposerActeurs — case et cap sont de la POSE, jamais de l’identité (#1396)', () => {
  const scèneRepose = emptyScene(8, 8);
  const mptRepose = sceneMetresPerTile(scèneRepose);
  const combattant = (): Combatant =>
    ({
      id: 'r1', label: 'R', kind: 'hero', pos: { x: 1, y: 1 }, size: 'moyenne',
      wounds: { current: 12, max: 12 }, weapons: [], characteristics: {}, advantage: 0,
      conditions: [], armour: {}, skills: [], talents: [], movement: 4, career: 'soldat', species: 'humain',
    }) as unknown as Combatant;

  it('l’identité IGNORE la case et le cap (deux poses, une seule identité)', () => {
    const c = combattant();
    expect(actorIdentityKey({ c, x: 1, y: 1, z: 0, facing: 'S' }))
      .toBe(actorIdentityKey({ c, x: 4, y: 6, z: 0, facing: 'NE' }));
  });

  it('un PAS réécrit la case du sujet monté (sans quoi sa teinte reste celle du départ)', () => {
    const c = combattant();
    const [sujet] = actorBillboards([{ c, x: 1, y: 1, z: 0, facing: 'S' }], scèneRepose, mptRepose);
    const ancre = sujet.anchor.clone();

    const { ancres } = reposerActeurs([sujet], [{ c, x: 2, y: 1, z: 0, facing: 'S' }], scèneRepose, mptRepose);

    expect(ancres, 'la repose ne signale pas le déplacement : rien ne peindra').toBe(true);
    expect(sujet.cell, 'la CASE du sujet est restée au départ — sa teinte y resterait aussi').toEqual({ x: 2, y: 1, z: 0 });
    expect(sujet.anchor.equals(ancre), 'l’ancre monde n’a pas suivi la case').toBe(false);
  });

  it('un PIVOT réécrit le cap du sujet et le SIGNALE (l’art se relève dessus)', () => {
    const c = combattant();
    const [sujet] = actorBillboards([{ c, x: 1, y: 1, z: 0, facing: 'S' }], scèneRepose, mptRepose);

    const { ancres, caps } = reposerActeurs([sujet], [{ c, x: 1, y: 1, z: 0, facing: 'E' }], scèneRepose, mptRepose);

    expect(sujet.facing, 'le cap du sujet est resté au précédent : le corps regarde ailleurs qu’il ne va').toBe('E');
    expect(caps, 'le cap changé n’est pas signalé : un corps SANS flipbook garderait l’art de l’ancien cap').toEqual([sujet]);
    expect(ancres, 'un pivot sur place ne déplace rien').toBe(false);
  });

  it('une pose INCHANGÉE n’écrit rien et ne signale rien (aucune image gratuite)', () => {
    const c = combattant();
    const [sujet] = actorBillboards([{ c, x: 1, y: 1, z: 0, facing: 'S' }], scèneRepose, mptRepose);

    const { ancres, caps } = reposerActeurs([sujet], [{ c, x: 1, y: 1, z: 0, facing: 'S' }], scèneRepose, mptRepose);

    expect(ancres).toBe(false);
    expect(caps).toEqual([]);
  });
});

/**
 * DÉCOR VOLUMIQUE DANS LA MASSE — la couture entre la recette (donnée) et le dessin : ses faces entrent
 * dans `worldFaces` comme celles d'un mur, et le groupement les scinde PAR MATÉRIAU (aucune période,
 * aucune cuisson par face — mais une réponse à la lumière propre, que le groupe doit porter jusqu'au
 * matériau monté). C'est ce découpage qui donne au même décor plusieurs plages de picking disjointes.
 */
describe('GROUPES DE SURFACE — un décor à recette se groupe par MATÉRIAU', () => {
  const scèneMeuble = () => {
    const s = emptyScene(8, 8);
    s.entities = [{ id: 'table-1', kind: 'prop', pos: { x: 2, y: 3 }, ref: 'table-ronde-4-tabourets', facing: 'S' }] as typeof s.entities;
    return s;
  };

  it('les faces du décor entrent dans `worldFaces`, chacune porteuse de son entité', () => {
    const facesProp = worldFaces(scèneMeuble()).filter((wf) => wf.face.material.domain === 'prop');
    expect(facesProp.length).toBeGreaterThan(0);
    expect(facesProp.every((wf) => wf.face.entId === 'table-1')).toBe(true);
    expect(facesProp.every((wf) => wf.el.kind === 'prop')).toBe(true);
  });

  it('un groupe par matériau de recette, porteur de la réponse à la lumière AUTHORÉE', () => {
    const listées = worldFaces(scèneMeuble());
    const { groups } = surfaceGrouping(listées, 2);
    const groupesProp = groups.filter((g) => g.key.startsWith('prop|'));
    expect(groupesProp.map((g) => g.key).sort()).toEqual(['prop|bois-chene', 'prop|fer-noirci']);
    for (const g of groupesProp) {
      expect(g.kind).toBeNull(); // aucune période : la couleur de sommet suffit
      expect(g.recipe).toBeUndefined();
      expect(g.pbr).toBeDefined();
    }
    expect(groupesProp.find((g) => g.key === 'prop|fer-noirci')!.pbr)
      .toEqual({ roughness: 0.52, metalness: 0.85 }); // `src/data/materials.json`, domaine `prop`
  });

  it('deux matériaux ⇒ le décor occupe DEUX plages de picking disjointes dans la géométrie cuite', () => {
    const world = buildWorldGeometry(scèneMeuble(), 2, () => 1);
    const plages = world.userData.propVertexRanges.filter((r) => r.entId === 'table-1');
    expect(plages.length).toBe(2);
    const [a, b] = [...plages].sort((x, y) => x.vertexStart - y.vertexStart);
    expect(a.vertexStart + a.vertexCount).toBeLessThanOrEqual(b.vertexStart); // disjointes, jamais fusionnées
  });
});
