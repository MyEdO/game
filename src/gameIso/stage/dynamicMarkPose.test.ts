import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { poseDynamicMarks, ringDashes, ringSolidStepPx, tetherDashCount, type DynMarkPools, type RingDash } from './dynamicMarkPose';
import { buildDynamicMarkMesh, dynSlotLiftM } from '../backends/webgl/dynamicMarkMeshes';
import { slotLiftM } from '../backends/webgl/highlightMeshes';
import { SPECKLE_LIFT_M } from '../backends/webgl/groundAccents';
import { pxPerM } from '../backends/webgl/worldTris';
import { billboardHeightM } from '../backends/webgl/billboardMath';
import { resetDiagOnce } from '../devDiag';
import { CELL, projectStep, rotOffset, stepOf, type ProjKind } from '../../geometry/iso';
import { affineCamera, projectToScreen } from '../backends/webgl/cameras';
import { ENEMY_RING, HERO_RING } from '../teamColors';
import type { EndState } from '../../engine/conditions';
import { applyEndStateColor } from '../endStateAppearance';
import {
  COMBAT_TOKEN_BASE,
  RING_A_PX,
  RING_B_PX,
  TEAM_RING_WIDTH_K,
  TETHER_DASH_K,
  TETHER_GAP_K,
  TETHER_WIDTH_K,
  dashPattern,
  discR,
  ringPhaseRad,
  teamRingRadiusK,
  type DynamicMarks,
  type TeamRing,
} from '../builders/dynamicMarks';

/**
 * POSE PAR FRAME des marques dynamiques (#1176, P3-0d) — la passe PURE, mesurée hors de tout écran :
 * un lien d'engagement entre deux combattants dont l'un GLISSE doit avoir son chapelet de tirets aux
 * positions de l'instant, et non aux cases logiques. Ce qu'on vérifie ici est ce que la voie affine
 * obtient gratuitement en repeignant son SVG à chaque frame — et que le volumique n'obtient QUE si la
 * pose consomme le même canal de glissement.
 */
const MPT = 2;
const DASH_M = TETHER_DASH_K * MPT;
const GAP_M = TETHER_GAP_K * MPT;
const PLAT = () => 0;

function pools(): DynMarkPools {
  return {
    tether: buildDynamicMarkMesh('tether'),
    actif: buildDynamicMarkMesh('actif'),
    groupe: buildDynamicMarkMesh('groupe'),
    anneau: buildDynamicMarkMesh('anneau'),
  };
}

/** Position, lacet et échelle d'une instance écrite. */
function instance(mesh: THREE.InstancedMesh, i: number) {
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  mesh.getMatrixAt(i, m);
  m.decompose(pos, quat, scl);
  return { pos, quat, scl };
}

const PAIRE: DynamicMarks = {
  tethers: [{ a: { id: 'h1', cell: { x: 1, y: 1, z: 0 } }, b: { id: 'e1', cell: { x: 3, y: 1, z: 0 } } }],
  active: null,
  party: null,
  rings: [],
};

describe('poseDynamicMarks — le lien d’engagement suit la glisse (#1176 P3-0d)', () => {
  it('une paire immobile : chapelet de tirets d’un centre de case à l’autre, au pas du gabarit', () => {
    const p = pools();
    const n = poseDynamicMarks(p, PAIRE, { mpt: MPT, glide: () => null, groundM: PLAT, kind: 'iso' });
    // 2 cases d'écart = 4 m à `mpt` 2 ; le pas est celui de la voie affine (4 px de tiret, 3 de blanc).
    expect(n.tether).toBe(tetherDashCount(4, DASH_M, GAP_M));
    expect(p.tether!.count).toBe(n.tether);
    const premier = instance(p.tether!, 0);
    expect(premier.pos.x).toBeCloseTo(1 * MPT + DASH_M / 2, 5);
    expect(premier.pos.z).toBeCloseTo(1 * MPT, 5);
    expect(premier.scl.x).toBeCloseTo(DASH_M, 5); // longueur du tiret
    expect(premier.scl.z).toBeCloseTo(TETHER_WIDTH_K * MPT, 5); // épaisseur du trait
    // dernier tiret : entièrement dans le segment
    const dernier = instance(p.tether!, n.tether - 1);
    expect(dernier.pos.x).toBeLessThanOrEqual(3 * MPT);
    // le lien est tendu le long de +X : le lacet envoie l'axe du quad sur la direction du segment
    const axe = new THREE.Vector3(1, 0, 0).applyQuaternion(premier.quat);
    expect(axe.x).toBeCloseTo(1, 5);
    expect(axe.z).toBeCloseTo(0, 5);
  });

  it('un combattant qui GLISSE emporte SON extrémité — l’autre ne bouge pas', () => {
    const p = pools();
    const glissé = { dx: 1, dy: 0, dz: 0 };
    poseDynamicMarks(p, PAIRE, { mpt: MPT, glide: (cid) => (cid === 'h1' ? glissé : null), groundM: PLAT, kind: 'iso' });
    const premier = instance(p.tether!, 0);
    // l'extrémité de `h1` est à 1·mpt + 1 m ; le premier tiret part de là.
    expect(premier.pos.x).toBeCloseTo(1 * MPT + 1 + DASH_M / 2, 5);
    // segment raccourci de 1 m → un tiret de moins que la version immobile
    expect(p.tether!.count).toBe(tetherDashCount(3, DASH_M, GAP_M));
  });

  it('le lacet du chapelet suit une direction quelconque (segment sur +Z)', () => {
    const p = pools();
    const versLeSud: DynamicMarks = {
      ...PAIRE,
      tethers: [{ a: { id: 'h1', cell: { x: 1, y: 1, z: 0 } }, b: { id: 'e1', cell: { x: 1, y: 4, z: 0 } } }],
    };
    poseDynamicMarks(p, versLeSud, { mpt: MPT, glide: () => null, groundM: PLAT, kind: 'iso' });
    const axe = new THREE.Vector3(1, 0, 0).applyQuaternion(instance(p.tether!, 0).quat);
    expect(axe.x).toBeCloseTo(0, 5);
    expect(axe.z).toBeCloseTo(1, 5);
  });

  it('le contour de l’ACTIF couvre son empreinte et SUIT sa glisse ; le repère de GROUPE ne glisse pas', () => {
    const p = pools();
    const marks: DynamicMarks = {
      tethers: [],
      active: { id: 'm1', cell: { x: 4, y: 5, z: 0 }, n: 2 },
      party: { x: 7, y: 8, z: 0 },
      rings: [],
    };
    const n = poseDynamicMarks(p, marks, {
      mpt: MPT,
      glide: () => ({ dx: 0.5, dy: 0, dz: 0 }),
      kind: 'iso',
      groundM: PLAT,
    });
    expect(n.actif).toBe(4); // empreinte 2×2
    const coins = Array.from({ length: 4 }, (_, i) => instance(p.actif!, i).pos);
    expect(coins.map((c) => `${c.x},${c.z}`).sort()).toEqual([
      `${4 * MPT + 0.5},${5 * MPT}`, `${4 * MPT + 0.5},${6 * MPT}`,
      `${5 * MPT + 0.5},${5 * MPT}`, `${5 * MPT + 0.5},${6 * MPT}`,
    ].sort());
    expect(instance(p.actif!, 0).scl.x).toBe(MPT); // le cadre couvre une case entière
    expect(n.groupe).toBe(1);
    const groupe = instance(p.groupe!, 0).pos;
    expect([groupe.x, groupe.z]).toEqual([7 * MPT, 8 * MPT]); // aucune glisse, comme en affine
  });

  it('la glisse VERTICALE (marche en pente) monte la marque avec son porteur', () => {
    const p = pools();
    poseDynamicMarks(p, { tethers: [], active: { id: 'h1', cell: { x: 0, y: 0, z: 1 }, n: 1 }, party: null, rings: [] }, {
      mpt: MPT,
      glide: () => ({ dx: 0, dy: 3, dz: 0 }),
      kind: 'iso',
      groundM: (_x, _y, z) => (z ? 5 : 0),
    });
    expect(instance(p.actif!, 0).pos.y).toBeCloseTo(5 + 3 + dynSlotLiftM('actif'), 5);
  });

  it('BIAIS : les marques dynamiques se posent AU-DESSUS de toutes les marques statiques, le LIEN au sommet', () => {
    // `rangeBand` est le rang le plus haut des marques de case (`highlightMeshes.SLOT_RANK`).
    expect(dynSlotLiftM('actif')).toBeGreaterThan(slotLiftM('rangeBand'));
    expect(dynSlotLiftM('groupe')).toBeGreaterThan(dynSlotLiftM('actif'));
    expect(dynSlotLiftM('anneau')).toBeGreaterThan(dynSlotLiftM('groupe'));
    // Le lien d'engagement passe au-dessus de TOUTES les autres marques dynamiques : sous le contour
    // d'actif, la bande or de la case active lui mangeait son dernier tiers (juge vision 2026-08-13).
    expect(dynSlotLiftM('tether')).toBeGreaterThan(dynSlotLiftM('anneau'));
    // et chaque rang est un CRAN entier de décollement — jamais un demi (le z-fighting reviendrait)
    expect(dynSlotLiftM('groupe') - dynSlotLiftM('actif')).toBeCloseTo(SPECKLE_LIFT_M, 12);
    expect(dynSlotLiftM('tether') - dynSlotLiftM('anneau')).toBeCloseTo(SPECKLE_LIFT_M, 12);
  });

  it('rien à peindre : les pools tombent à zéro instance, sans se démonter', () => {
    const p = pools();
    poseDynamicMarks(p, PAIRE, { mpt: MPT, glide: () => null, groundM: PLAT, kind: 'iso' });
    const avant = p.tether!.instanceMatrix.array;
    const n = poseDynamicMarks(p, { tethers: [], active: null, party: null, rings: [] }, { mpt: MPT, glide: () => null, groundM: PLAT, kind: 'iso' });
    expect(n).toEqual({ tether: 0, actif: 0, groupe: 0, anneau: 0 });
    expect(p.tether!.count).toBe(0);
    expect(p.tether!.instanceMatrix.array).toBe(avant); // aucun tampon réalloué
  });

  it('SATURATION ATOMIQUE : un lien qui ne RENTRE pas ne s’ENTAME pas — le précédent reste entier', () => {
    resetDiagOnce();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const deuxLiens: DynamicMarks = {
      tethers: [
        { a: { id: 'h1', cell: { x: 1, y: 1, z: 0 } }, b: { id: 'e1', cell: { x: 3, y: 1, z: 0 } } },
        { a: { id: 'h2', cell: { x: 1, y: 5, z: 0 } }, b: { id: 'e2', cell: { x: 3, y: 5, z: 0 } } },
      ],
      active: null,
      party: null,
      rings: [],
    };
    const parLien = tetherDashCount(4, DASH_M, GAP_M); // 2 cases d'écart à `mpt` 2
    expect(parLien).toBeGreaterThan(2); // le témoin doit VRAIMENT avoir un chapelet à tronquer
    const cadre = { mpt: MPT, glide: () => null, groundM: PLAT, kind: 'iso' } as const;
    // Un quad de moins qu'il n'en faut pour les DEUX : le second lien est absent EN ENTIER.
    const p = { tether: buildDynamicMarkMesh('tether', parLien * 2 - 1) };
    const n = poseDynamicMarks(p, deuxLiens, cadre);
    expect(n.tether).toBe(parLien);
    expect(p.tether.count).toBe(parLien);
    // les tirets écrits sont ceux du PREMIER lien (z de sa rangée), aucun du second
    for (let i = 0; i < n.tether; i++) expect(instance(p.tether, i).pos.z).toBeCloseTo(1 * MPT, 5);
    // le PREMIER lien lui-même ne s'entame pas s'il ne tient pas
    const étroit = { tether: buildDynamicMarkMesh('tether', parLien - 1) };
    expect(poseDynamicMarks(étroit, deuxLiens, cadre).tether).toBe(0);
    // le DEV n'est prévenu qu'UNE fois — jamais soixante fois par seconde
    expect(warn.mock.calls.length).toBe(1);
    expect(String(warn.mock.calls[0][0])).toContain('tether');
    warn.mockRestore();
  });
});

describe('anneau — allure commune par état de fin', () => {
  it.each<EndState>(['mort', 'inconscient', 'rendu', 'hors-combat'])('%s applique la loi jusque dans la couleur d’instance', (endState) => {
    const p = pools();
    const marks: DynamicMarks = { tethers: [], active: null, party: null, rings: [{ id: 'fini', cell: { x: 1, y: 1, z: 0 }, rK: 0.3, color: HERO_RING[0] }] };
    poseDynamicMarks(p, marks, { mpt: MPT, glide: () => null, groundM: PLAT, kind: 'iso', chromeAt: () => ({ ghost: true, endState, highlight: null }) });
    const obtenu = new THREE.Color();
    p.anneau!.getColorAt(0, obtenu);
    const attendu = applyEndStateColor(new THREE.Color(HERO_RING[0]), endState);
    expect(obtenu.r).toBeCloseTo(attendu.r, 6);
    expect(obtenu.g).toBeCloseTo(attendu.g, 6);
    expect(obtenu.b).toBeCloseTo(attendu.b, 6);
    const debout = new THREE.Color(HERO_RING[0]).convertLinearToSRGB();
    obtenu.convertLinearToSRGB();
    const ecartMax = Math.max(Math.abs(obtenu.r - debout.r), Math.abs(obtenu.g - debout.g), Math.abs(obtenu.b - debout.b));
    expect(ecartMax).toBeGreaterThanOrEqual(endState === 'rendu' ? 0.1 : 0.15);
    for (const mesh of Object.values(p)) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); mesh.dispose(); }
  });
});

describe('tetherDashCount — le pas du pointillé', () => {
  it('un segment plus court qu’un tiret en porte tout de même UN (cases voisines)', () => {
    expect(tetherDashCount(DASH_M / 2, DASH_M, GAP_M)).toBe(1);
  });
  it('aucun tiret sur un segment nul', () => {
    expect(tetherDashCount(0, DASH_M, GAP_M)).toBe(0);
  });
  it('un tiret de plus par période franchie', () => {
    const période = DASH_M + GAP_M;
    expect(tetherDashCount(période * 3, DASH_M, GAP_M)).toBe(3);
    expect(tetherDashCount(période * 3 + DASH_M * 1.5, DASH_M, GAP_M)).toBe(4);
  });
});

/**
 * ANNEAUX D'ÉQUIPE (#1176, P3-0e) — la décoration de sol du jeton. Ce qui se mesure ici est ce que le
 * juge P3-0 (angle 4) exige : le pointillé du canal daltonien R9 doit rester uniforme À L'ÉCRAN, là où
 * la projection losange écrase de moitié l'axe de profondeur d'un cercle monde — et ne RIEN
 * pré-compenser sous la vue du dessus, dont la projection est 1:1.
 */
/** Rayon (fraction de case) de l'anneau d'un jeton de combat à l'échelle d'art 1, par vue. En vue du
 *  DESSUS il ceint le disque-portrait, que la surcouche peint à `discR(n)` px, à `CELL` px par case. */
const RK = teamRingRadiusK(COMBAT_TOKEN_BASE);
const RK_TOP = discR(1) / CELL;
/** Le pointillé d'équipe (`teamShape(true)`), lu par la MÊME porte que la pose. */
const MOTIF = dashPattern('5 3')!;
/** Hauteurs de jeton JUGÉES (px écran) — les trois zooms du contrat d'art. */
const JUGÉS = [40, 64, 128];

/** Zoom auquel un personnage MESURE `hauteurPx` : sa hauteur monde (convention `jeu`) portée aux
 *  pixels de la projection affine que la caméra volumique reproduit (`pxPerM`). */
const zoomPour = (hauteurPx: number) => hauteurPx / (billboardHeightM('jeu', 'personnage') * pxPerM(MPT));

/** Point ÉCRAN (px, zoom 1) du paramètre `u` d'un anneau sous la vue `kind` — par le chemin de
 *  projection de PROD (`rotOffset` + `projectStep`), jamais par la formule d'ellipse qu'on est en
 *  train de juger. L'angle MONDE d'un tiret est `φ = u + phase + lacet` (cf. `poserAnneaux`). */
function écran(kind: ProjKind, u: number, rK: number, yawDeg: number): { dx: number; dy: number } {
  const phi = u + ringPhaseRad(kind) + (yawDeg * Math.PI) / 180;
  return projectStep(stepOf(kind), rotOffset(yawDeg, { x: rK * Math.cos(phi), y: rK * Math.sin(phi) }));
}
const écart = (a: { dx: number; dy: number }, b: { dx: number; dy: number }) => Math.hypot(a.dx - b.dx, a.dy - b.dy);

/** Longueur d'ARC ÉCRAN (px) entre deux paramètres, sommée à la corde fine — indépendante de la table
 *  d'arc de `ringDashes`, dont c'est justement le résultat qu'on vérifie. C'est bien l'ARC qu'il faut
 *  mesurer : l'espacement que l'œil voit court le long du tracé, pas à travers. */
function arcÉcran(kind: ProjKind, u0: number, u1: number, rK: number, yawDeg: number, pas = 64): number {
  let s = 0;
  for (let i = 0; i < pas; i++)
    s += écart(écran(kind, u0 + ((u1 - u0) * i) / pas, rK, yawDeg), écran(kind, u0 + ((u1 - u0) * (i + 1)) / pas, rK, yawDeg));
  return s;
}

/** Périmètre ÉCRAN de l'anneau. */
const périmètre = (kind: ProjKind, rK: number) => arcÉcran(kind, 0, 2 * Math.PI, rK, 0, 4096);

/** BLANCS écran (px) entre tirets consécutifs, au zoom donné — le tour se referme sur le premier. */
function blancs(kind: ProjKind, tirets: readonly RingDash[], rK: number, yawDeg: number, zoom: number): number[] {
  return tirets.map((t, i) => {
    const suivant = tirets[(i + 1) % tirets.length];
    const u0 = t.u + t.span / 2;
    // Le dernier blanc enjambe le tour ; les autres se lisent tels quels (un blanc NUL peut passer
    // sous zéro d'un epsilon flottant, et le borner ici évite de lire un tour entier à sa place).
    const u1 = (i === tirets.length - 1 ? suivant.u + 2 * Math.PI : suivant.u) - suivant.span / 2;
    return arcÉcran(kind, u0, Math.max(u0, u1), rK, yawDeg) * zoom;
  });
}

describe('ringDashes — le pointillé de l’anneau, UNIFORME À L’ÉCRAN (#1176 P3-0e)', () => {
  it('les blancs sont tous ÉGAUX à l’écran ; à pas d’arc MONDE ils seraient écrasés de moitié', () => {
    const tirets = ringDashes(RK, MOTIF, 'iso');
    expect(tirets.length, 'le témoin doit VRAIMENT porter un chapelet').toBeGreaterThan(3);
    const g = blancs('iso', tirets, RK, 0, 1);
    expect(Math.min(...g) / Math.max(...g)).toBeGreaterThan(0.98);
    // TÉMOIN : les mêmes tirets répartis à pas d'ANGLE MONDE constant (`u` est à un décalage près
    // l'angle monde) — ce que donnerait un anneau construit sans pré-compensation.
    const naïf = tirets.map((t, i) => ({ u: ((i + 0.5) * 2 * Math.PI) / tirets.length, span: t.span }));
    const gn = blancs('iso', naïf, RK, 0, 1);
    expect(Math.min(...gn) / Math.max(...gn), 'le témoin doit VRAIMENT être écrasé').toBeLessThan(0.6);
  });

  it('le COMPTE est celui du pointillé affine : `ceil(périmètre écran / période)`', () => {
    // Le compte de la voie affine ne dépend PAS du zoom : l'ellipse comme le `stroke-dasharray` sont
    // en unités du repère SVG, que la caméra met à l'échelle ensemble.
    const P = périmètre('iso', RK);
    expect(ringDashes(RK, MOTIF, 'iso').length).toBe(Math.max(1, Math.ceil(P / (MOTIF.dashPx + MOTIF.gapPx))));
  });

  it('aux trois zooms JUGÉS (jeton 40/64/128 px), les tirets restent DISCERNABLES (blanc ≥ 1,5 px)', () => {
    const tirets = ringDashes(RK, MOTIF, 'iso');
    const nAffine = Math.max(1, Math.ceil(périmètre('iso', RK) / (MOTIF.dashPx + MOTIF.gapPx)));
    for (const h of JUGÉS) {
      const g = blancs('iso', tirets, RK, 0, zoomPour(h));
      expect(Math.min(...g), `jeton ${h} px : blanc minimal`).toBeGreaterThanOrEqual(1.5);
      expect(tirets.length, `jeton ${h} px : autant de tirets qu’en affine`).toBeGreaterThanOrEqual(nAffine);
    }
  });

  it('un anneau PLEIN est un polygone de cordes sans blanc, dont la FLÈCHE tient sous le demi-pixel', () => {
    const pleins = ringDashes(RK, null, 'iso');
    expect(pleins.length).toBe(Math.max(1, Math.ceil(périmètre('iso', RK) / ringSolidStepPx(RK * RING_A_PX, RK * RING_B_PX))));
    expect(Math.max(...blancs('iso', pleins, RK, 0, 1)), 'aucun blanc sur un trait plein').toBeLessThan(1e-9);
    for (const t of pleins) {
      const a = écran('iso', t.u - t.span / 2, RK, 0);
      const b = écran('iso', t.u + t.span / 2, RK, 0);
      const milieu = écran('iso', t.u, RK, 0);
      expect(Math.hypot((a.dx + b.dx) / 2 - milieu.dx, (a.dy + b.dy) / 2 - milieu.dy)).toBeLessThanOrEqual(0.5);
    }
  });

  it('VUE DU DESSUS : le compte est celui du CERCLE affine, et la compensation 2:1 s’y éteint', () => {
    const P = 2 * Math.PI * discR(1); // le disque-portrait, tracé en `<circle r={discR}>`
    expect(périmètre('top', RK_TOP)).toBeCloseTo(P, 3);
    expect(ringDashes(RK_TOP, MOTIF, 'top').length).toBe(Math.ceil(P / (MOTIF.dashPx + MOTIF.gapPx)));
    // TÉMOIN : le gabarit LOSANGE appliqué à la vue du dessus — deux fois moins de tirets, sur un
    // anneau presque deux fois trop petit. C'est ce que la pose faisait avant le correctif du juge.
    expect(ringDashes(RK, MOTIF, 'iso').length).toBeLessThan(ringDashes(RK_TOP, MOTIF, 'top').length / 2);
  });
});

/** Viewport de la sonde de projection — le cadre dans lequel la caméra volumique reproduit au pixel la
 *  projection SVG (`backends/webgl/cameras.test.ts`). */
const VUE = { w: 800, h: 600 };

/** Les CORDES posées dans le pool, projetées à travers la VRAIE caméra de production. De chaque
 *  matrice d'instance on relit l'ARC qu'elle couvre — son rayon, son angle, et l'ouverture dont sa
 *  longueur est la corde — puis on projette les deux BOUTS DE CET ARC. Ce qui est jugé est donc la
 *  place que les tirets laissent sur le tracé, jamais le bombement sous-pixel du polygone de cordes.
 *  `centre` = position MONDE du centre de l'anneau. */
function cordesÉcran(mesh: THREE.InstancedMesh, kind: ProjKind, yawDeg: number, centre: THREE.Vector3) {
  const { camera } = affineCamera(kind, yawDeg, MPT, VUE);
  const bouts: { a: { sx: number; sy: number }; b: { sx: number; sy: number }; centre: { sx: number; sy: number } }[] = [];
  for (let i = 0; i < mesh.count; i++) {
    const { pos, scl } = instance(mesh, i);
    const r = Math.hypot(pos.x - centre.x, pos.z - centre.z);
    const phi = Math.atan2(pos.z - centre.z, pos.x - centre.x);
    const demi = Math.asin(Math.min(1, scl.x / (2 * r))); // corde `2r·sin(span/2)` → demi-ouverture
    const bout = (a: number) => projectToScreen(camera, new THREE.Vector3(centre.x + r * Math.cos(a), pos.y, centre.z + r * Math.sin(a)), VUE);
    bouts.push({ a: bout(phi - demi), b: bout(phi + demi), centre: projectToScreen(camera, pos.clone(), VUE) });
  }
  return bouts;
}

/** BLANCS écran (px) entre cordes consécutives : la distance des deux bouts LES PLUS PROCHES (le sens
 *  de l'axe d'une corde n'est pas une donnée du contrat, seule l'est la place qu'elle laisse). */
function blancsÉcran(cordes: ReturnType<typeof cordesÉcran>): number[] {
  const d = (u: { sx: number; sy: number }, v: { sx: number; sy: number }) => Math.hypot(u.sx - v.sx, u.sy - v.sy);
  return cordes.map((c, i) => {
    const s = cordes[(i + 1) % cordes.length];
    return Math.min(d(c.b, s.a), d(c.a, s.b), d(c.b, s.b), d(c.a, s.a));
  });
}

describe('poseDynamicMarks — les ANNEAUX d’équipe (#1176 P3-0e)', () => {
  const anneau: TeamRing = { id: 'e1', cell: { x: 2, y: 3, z: 0 }, rK: RK, color: ENEMY_RING, dash: '5 3' };
  const avec = (rings: TeamRing[]): DynamicMarks => ({ tethers: [], active: null, party: null, rings });

  it('un chapelet de cordes posé sur le cercle des PIEDS, à l’épaisseur et à la teinte de son équipe', () => {
    const p = pools();
    const n = poseDynamicMarks(p, avec([anneau]), { mpt: MPT, glide: () => null, groundM: PLAT, kind: 'iso' });
    expect(n.anneau).toBe(ringDashes(RK, MOTIF, 'iso').length);
    expect(p.anneau!.count).toBe(n.anneau);
    const rM = RK * MPT;
    for (let i = 0; i < n.anneau; i++) {
      const { pos, scl } = instance(p.anneau!, i);
      expect(Math.hypot(pos.x - 2 * MPT, pos.z - 3 * MPT), 'chaque corde est sur le cercle').toBeCloseTo(rM, 6);
      expect(scl.z, 'épaisseur du trait, la même pour toutes').toBeCloseTo(TEAM_RING_WIDTH_K * MPT, 6);
      expect(pos.y, 'posé au rang de son slot').toBeCloseTo(dynSlotLiftM('anneau'), 6);
    }
    const teinte = new THREE.Color();
    p.anneau!.getColorAt(0, teinte);
    expect(`#${teinte.getHexString()}`).toBe(ENEMY_RING.toLowerCase());
  });

  it('la TEINTE voyage par instance : deux anneaux de couleurs différentes gardent chacun la leur', () => {
    const p = pools();
    const bleu: TeamRing = { ...anneau, id: 'h1', cell: { x: 8, y: 8, z: 0 }, color: HERO_RING[0], dash: undefined };
    const n = poseDynamicMarks(p, avec([anneau, bleu]), { mpt: MPT, glide: () => null, groundM: PLAT, kind: 'iso' });
    const nE1 = ringDashes(RK, MOTIF, 'iso').length;
    const nH1 = ringDashes(RK, null, 'iso').length;
    expect(n.anneau).toBe(nE1 + nH1);
    expect(nE1, 'les deux chapelets doivent VRAIMENT porter plusieurs cordes').toBeGreaterThan(2);
    expect(nH1).toBeGreaterThan(2);
    const teinte = new THREE.Color();
    const lue = (i: number) => {
      p.anneau!.getColorAt(i, teinte);
      return `#${teinte.getHexString()}`;
    };
    // les DEUX chapelets, à leurs bornes ET en leur milieu : une teinte écrite une seule fois (celle du
    // dernier porteur) passerait toutes les cordes au bleu.
    for (const i of [0, Math.floor(nE1 / 2), nE1 - 1]) expect(lue(i), `corde ${i} de l’ennemi`).toBe(ENEMY_RING.toLowerCase());
    for (const i of [nE1, nE1 + Math.floor(nH1 / 2), nE1 + nH1 - 1]) expect(lue(i), `corde ${i} du héros`).toBe(HERO_RING[0].toLowerCase());
  });

  it('l’anneau SUIT la glisse de SON porteur, et lui seul', () => {
    const p = pools();
    const autre: TeamRing = { ...anneau, id: 'h1', cell: { x: 8, y: 8, z: 0 }, color: '#4f8fe0', dash: undefined };
    const n = poseDynamicMarks(p, avec([anneau, autre]), {
      mpt: MPT,
      glide: (cid) => (cid === 'e1' ? { dx: 1.5, dy: 0.25, dz: 0 } : null),
      kind: 'iso',
      groundM: PLAT,
    });
    const nE1 = ringDashes(RK, MOTIF, 'iso').length;
    expect(n.anneau).toBe(nE1 + ringDashes(RK, null, 'iso').length);
    for (let i = 0; i < nE1; i++) {
      const { pos } = instance(p.anneau!, i);
      expect(Math.hypot(pos.x - (2 * MPT + 1.5), pos.z - 3 * MPT)).toBeCloseTo(RK * MPT, 6);
      expect(pos.y).toBeCloseTo(0.25 + dynSlotLiftM('anneau'), 6);
    }
    const immobile = instance(p.anneau!, nE1);
    expect(Math.hypot(immobile.pos.x - 8 * MPT, immobile.pos.z - 8 * MPT)).toBeCloseTo(RK * MPT, 6);
  });

  it('le LACET de la caméra tourne l’anneau sans changer son allure à l’écran', () => {
    const p = pools();
    poseDynamicMarks(p, avec([anneau]), { mpt: MPT, glide: () => null, groundM: PLAT, kind: 'iso', yawDeg: 30 });
    for (let i = 0; i < p.anneau!.count; i++) {
      const { pos } = instance(p.anneau!, i);
      expect(Math.hypot(pos.x - 2 * MPT, pos.z - 3 * MPT), 'un cercle est invariant par rotation').toBeCloseTo(RK * MPT, 6);
    }
    const g = blancs('iso', ringDashes(RK, MOTIF, 'iso'), RK, 30, 1);
    expect(Math.min(...g) / Math.max(...g)).toBeGreaterThan(0.98);
  });

  it('BIAIS : l’anneau passe AU-DESSUS des trois autres marques dynamiques', () => {
    // Mesure de la voie affine : l'anneau y est peint DANS le jeton (profondeur
    // `+0.5`) quand le lien, le contour d'actif et le repère de groupe se posent SOUS lui (`+0.25`,
    // `dynamicHighlightObjs`).
    expect(dynSlotLiftM('anneau')).toBeGreaterThan(dynSlotLiftM('groupe'));
    expect(dynSlotLiftM('anneau') - dynSlotLiftM('groupe')).toBeCloseTo(SPECKLE_LIFT_M, 12);
    expect(dynSlotLiftM('anneau')).toBeGreaterThan(slotLiftM('rangeBand'));
  });

  it('SATURATION ATOMIQUE : un anneau qui ne RENTRE pas n’est pas entamé', () => {
    resetDiagOnce();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const étroit = { anneau: buildDynamicMarkMesh('anneau', ringDashes(RK, MOTIF, 'iso').length - 1) };
    expect(poseDynamicMarks(étroit, avec([anneau]), { mpt: MPT, glide: () => null, groundM: PLAT, kind: 'iso' }).anneau).toBe(0);
    expect(warn.mock.calls.length).toBe(1);
    expect(String(warn.mock.calls[0][0])).toContain('anneau');
    warn.mockRestore();
  });
});

/**
 * SONDE DE PROJECTION (#1176, P3-0e — correctif du juge) : les cordes RÉELLEMENT posées, projetées à
 * travers la VRAIE `affineCamera` de production. C'est le seul juge de l'allure : une compensation 2:1
 * appliquée à une projection 1:1 y saute aux yeux, et une formule d'ellipse ne peut pas s'auto-absoudre.
 */
describe('poseDynamicMarks — l’anneau MESURÉ à travers la caméra de production (#1176 P3-0e)', () => {
  const posé = (kind: ProjKind, yawDeg: number, ring: TeamRing) => {
    const p = pools();
    poseDynamicMarks(p, { tethers: [], active: null, party: null, rings: [ring] }, { mpt: MPT, glide: () => null, groundM: PLAT, kind, yawDeg });
    return p.anneau!;
  };
  const ennemi: TeamRing = { id: 'e1', cell: { x: 2, y: 3, z: 0 }, rK: RK, color: ENEMY_RING, dash: '5 3' };
  /** Centre MONDE de cet anneau (case 2,3 à `mpt` mètres, au rang de son slot). */
  const CENTRE = new THREE.Vector3(2 * MPT, dynSlotLiftM('anneau'), 3 * MPT);
  /** Le pool, posé sous un verdict de PION donné — c'est lui qui décide, jamais la projection. */
  const compte = (kind: ProjKind, pionsEnDisques: boolean) => {
    const p = pools();
    return poseDynamicMarks(p, { tethers: [], active: null, party: null, rings: [ennemi] }, { mpt: MPT, glide: () => null, groundM: PLAT, kind, yawDeg: 0, pionsEnDisques }).anneau;
  };

  it('en LOSANGE, les blancs restent égaux à l’écran à tous les lacets (0/15/45/90°)', () => {
    for (const yaw of [0, 15, 45, 90]) {
      const cordes = cordesÉcran(posé('iso', yaw, ennemi), 'iso', yaw, CENTRE);
      expect(cordes.length, `lacet ${yaw}° : le témoin doit VRAIMENT porter un chapelet`).toBeGreaterThan(3);
      const g = blancsÉcran(cordes);
      expect(Math.min(...g) / Math.max(...g), `lacet ${yaw}° : uniformité des blancs`).toBeGreaterThan(0.95);
    }
  });

  it('sous `pionsEnDisques` : ce pool n’écrit AUCUNE corde — l’anneau vit sur le disque SVG', () => {
    // Le PION est un disque de la surcouche SVG (`stage/TokenChromeOverlay`), et son anneau y est peint
    // au rayon du disque. Deux anneaux — l'un plat au sol, l'autre à l'écran — se superposeraient à des
    // rayons différents : le verdict est EXCLUSIF, et c'est lui qui tranche, pas la projection.
    expect(compte('top', true)).toBe(0);
  });

  it('TÉMOIN : le même relevé, verdict retombé, redonne son chapelet — c’est le VERDICT qui tranche', () => {
    // Même vue, même anneau, même caméra : seul `pionsEnDisques` change. Sans lui le pool repeint, donc
    // le zéro ci-dessus n'est pas un pool vide, une capacité nulle ou une marque perdue.
    expect(compte('top', false)).toBeGreaterThan(3);
    // …et le plateau iso, lui, n'est jamais gaté : c'est là que vit l'anneau AUX PIEDS.
    expect(compte('iso', false)).toBeGreaterThan(3);
  });

  it('l’anneau posé est celui des PIEDS (`rK`) : c’est LUI que le relevé écran suit', () => {
    // Mesuré sur le relevé écran EXACT, pas sur un rayon moyen : doubler `rK` déplace toutes les
    // cordes, et c'est la seule grandeur de rayon que cette pose lise.
    const relevé = (r: Partial<TeamRing>) => cordesÉcran(posé('iso', 0, { ...ennemi, ...r }), 'iso', 0, CENTRE)
      .map((c) => `${c.centre.sx.toFixed(9)},${c.centre.sy.toFixed(9)}`).join('|');
    expect(relevé({ rK: RK * 2 })).not.toBe(relevé({}));
    expect(relevé({ dash: undefined })).not.toBe(relevé({}));
  });
});
