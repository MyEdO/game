import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  HALO_HOVER_PULSE_MAX,
  HALO_HOVER_PULSE_MIN,
  HALO_HOVER_PULSE_S,
  HALO_PULSE_MAX,
  HALO_PULSE_MIN,
  HALO_PULSE_S,
  PING_END,
  PING_OPACITY_MAX,
  PING_S,
  PING_SCALE_MAX,
  PING_SCALE_MIN,
  SPARK_OPACITY_MAX,
  SPARK_OPACITY_MIN,
  SPARK_RISE_PX,
  SPARK_S,
  haloPing,
  haloPulse,
  poseInteractHalos,
  sparkBob,
  type HaloPools,
} from './interactHaloPose';
import { HALO_RING_CHORDS, HALO_SLOTS, HALO_SLOT_CAPACITY, HALO_SLOT_OPACITY, buildHaloMesh, type HaloSlot } from '../backends/webgl/interactHaloMeshes';
import { HALO_HOVER_SCALE, HALO_RX_PX, SPARK_DX_PX, SPARK_DY_PX, haloRadiusK, type InteractHalo } from '../builders/interactHalos';
import { ISO_PX_PER_M } from '../iso';
import { pxPerM } from '../backends/webgl/worldTris';
import { ringDashes } from './dynamicMarkPose';

/**
 * POSE PAR FRAME des halos d'interaction (#1176, P3-0g) — la passe PURE, mesurée hors de tout écran.
 * Deux choses s'y jouent : la GÉOMÉTRIE (un halo est un cercle monde au pied du décor, du rayon dont
 * l'ellipse affine est la projection) et la PULSATION, qui n'est ici qu'une fonction de l'horloge de
 * la frame — cadences et bornes vivent dans `interactHaloPose.ts` (`HALO_PULSE_S`, `PING_S`, `SPARK_S`).
 */
const MPT = 2;
const PLAT = () => 0;

function pools(): HaloPools {
  const p: HaloPools = {};
  for (const slot of HALO_SLOTS) p[slot] = buildHaloMesh(slot);
  return p;
}

function frame(tSec: number, camQuat = new THREE.Quaternion()) {
  return { mpt: MPT, groundM: PLAT, kind: 'iso' as const, yawDeg: 0, camQuat, tSec };
}

/** UN utilisable de la frame, RÉVÉLÉ par défaut (`etat` se surcharge : `survole`, `muet`). */
const halo = (id: string, extra: Partial<InteractHalo> = {}): InteractHalo => ({
  id,
  cell: { x: 3, y: 4, z: 0 },
  n: 1,
  scaleK: 1,
 
  span: { w: 1, h: 1 },
  centre: { x: 3, y: 4 },
  echelle: { x: 1, y: 1 },
  etat: 'revele',
  visible: true,
  ...extra,
});

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

/** Rayon MOYEN des cordes d'un pool autour du centre `(x, z)`. */
function rayonDesCordes(mesh: THREE.InstancedMesh, x: number, z: number): number {
  let somme = 0;
  for (let i = 0; i < mesh.count; i++) {
    const { pos } = instance(mesh, i);
    somme += Math.hypot(pos.x - x, pos.z - z);
  }
  return somme / mesh.count;
}

const opacité = (mesh: THREE.InstancedMesh) => (mesh.material as THREE.MeshBasicMaterial).opacity;

describe('Pulsations : des fonctions de frame (#1176 P3-0g)', () => {
  it('haloPulse : la CADENCE et les BORNES du battement de repos (1,6 s, 0,35 → 0,8)', () => {
    expect(haloPulse(0, false)).toBeCloseTo(HALO_PULSE_MIN, 12);
    expect(haloPulse(HALO_PULSE_S / 2, false), 'mi-course = le palier 50 %').toBeCloseTo(HALO_PULSE_MAX, 12);
    expect(haloPulse(HALO_PULSE_S, false), 'la période boucle sans couture').toBeCloseTo(HALO_PULSE_MIN, 12);
    // et jamais hors de ses bornes, à aucun instant du tour
    for (let i = 0; i < 200; i++) {
      const v = haloPulse((i * HALO_PULSE_S) / 200, false);
      expect(v).toBeGreaterThanOrEqual(HALO_PULSE_MIN - 1e-12);
      expect(v).toBeLessThanOrEqual(HALO_PULSE_MAX + 1e-12);
    }
  });

  it('haloPulse survolé : 0,7 s, 0,85 → 1 — plus VIF et plus RAPIDE', () => {
    expect(haloPulse(0, true)).toBeCloseTo(HALO_HOVER_PULSE_MIN, 12);
    expect(haloPulse(HALO_HOVER_PULSE_S / 2, true)).toBeCloseTo(HALO_HOVER_PULSE_MAX, 12);
    expect(HALO_HOVER_PULSE_S).toBeLessThan(HALO_PULSE_S);
    // à la même seconde, le survol est TOUJOURS plus lumineux que le repos
    for (let i = 0; i < 100; i++) expect(haloPulse(i / 25, true)).toBeGreaterThan(haloPulse(i / 25, false) - 1e-12);
  });

  it('haloPing : l’onde s’élargit et s’évanouit, puis RIEN jusqu’au tour suivant', () => {
    expect(haloPing(0)).toEqual({ scale: PING_SCALE_MIN, opacity: PING_OPACITY_MAX });
    const fin = haloPing(PING_S * PING_END * 0.999);
    expect(fin.scale).toBeCloseTo(PING_SCALE_MAX, 2);
    expect(fin.opacity).toBeCloseTo(0, 2);
    // le palier 75 %→100 % de `haloPing` : invisible, donc rien à peindre
    expect(haloPing(PING_S * 0.8).opacity).toBe(0);
    expect(haloPing(PING_S * 0.99).opacity).toBe(0);
    expect(haloPing(PING_S).opacity, 'le tour repart').toBe(PING_OPACITY_MAX);
    // MONOTONE en échelle sur la course visible : l'onde ne recule jamais
    let précédent = 0;
    for (let i = 0; i < 100; i++) {
      const s = haloPing((i * PING_S * PING_END) / 100).scale;
      expect(s).toBeGreaterThanOrEqual(précédent);
      précédent = s;
    }
  });

  it('sparkBob : l’étincelle monte de 4 px à mi-course, opacité 0,85 → 1', () => {
    expect(sparkBob(0)).toEqual({ risePx: 0, opacity: SPARK_OPACITY_MIN });
    const haut = sparkBob(SPARK_S / 2);
    expect(haut.risePx).toBeCloseTo(SPARK_RISE_PX, 12);
    expect(haut.opacity).toBeCloseTo(SPARK_OPACITY_MAX, 12);
    expect(sparkBob(SPARK_S).risePx).toBeCloseTo(0, 12);
  });
});

describe('Pose des halos — géométrie (#1176 P3-0g)', () => {
  it('un décor fouillable pose son disque et son anneau au pied, au RAYON de l’ellipse affine', () => {
    const p = pools();
    const n = poseInteractHalos(p, [halo('coffre')], frame(0));
    expect(n.haloDisque).toBe(1);
    expect(n.haloContour).toBeGreaterThan(3);
    expect(n.haloDisqueSurvol + n.haloContourSurvol, 'aucun renfort sans survol').toBe(0);
    const rM = haloRadiusK(HALO_RX_PX) * MPT;
    // le DISQUE : gabarit de diamètre 1, donc une échelle de 2·r ; le contour : des cordes sur le cercle
    const d = instance(p.haloDisque!, 0);
    expect(d.pos.x).toBeCloseTo(3 * MPT, 6);
    expect(d.pos.z).toBeCloseTo(4 * MPT, 6);
    expect(d.scl.x).toBeCloseTo(2 * rM, 6);
    expect(rayonDesCordes(p.haloContour!, 3 * MPT, 4 * MPT)).toBeCloseTo(rM, 6);
  });

  it('un décor GRAND porte un halo GRAND — l’échelle du décor entre dans le rayon', () => {
    const p = pools();
    poseInteractHalos(p, [halo('epave', { echelle: { x: 2, y: 2 } })], frame(0));
    expect(instance(p.haloDisque!, 0).scl.x).toBeCloseTo(2 * haloRadiusK(HALO_RX_PX) * 2 * MPT, 6);
  });

  /**
   * EMPREINTE NON CARRÉE (#1509 L9′) : le halo est une ELLIPSE, un demi-axe par axe de l'empreinte.
   * Avec un facteur isotrope, le halo d'une table murale 1×2 débordait d'une demi-case sur son axe
   * COURT — à travers le mur qu'elle longe. Un décor d'une case, lui, garde un halo ROND.
   */
  it('un décor 1×2 porte un halo ALLONGÉ — le disque et son contour épousent chaque axe', () => {
    const p = pools();
    poseInteractHalos(p, [halo('murale', { echelle: { x: 1, y: 2 } })], frame(0));
    const disque = instance(p.haloDisque!, 0);
    expect(disque.scl.x, 'axe court : une case').toBeCloseTo(2 * haloRadiusK(HALO_RX_PX) * 1 * MPT, 6);
    expect(disque.scl.z, 'axe long : deux cases').toBeCloseTo(2 * haloRadiusK(HALO_RX_PX) * 2 * MPT, 6);
    // Le CONTOUR suit la MÊME ellipse : aucune de ses cordes ne sort des demi-axes (c'est la
    // CONTENANCE qui compte — le halo ne doit pas traverser le mur), et il s'étire bien sur l'axe long
    // (les cordes sont posées à des angles DISCRETS : leur maximum n'atteint le demi-axe qu'à la
    // résolution du chapelet, on ne l'exige donc pas à l'égalité).
    const rx = haloRadiusK(HALO_RX_PX) * 1 * MPT;
    const ry = haloRadiusK(HALO_RX_PX) * 2 * MPT;
    const cordes = [...Array(p.haloContour!.count).keys()].map((i) => instance(p.haloContour!, i));
    const ecartX = Math.max(...cordes.map((c) => Math.abs(c.pos.x - 3 * MPT)));
    const ecartZ = Math.max(...cordes.map((c) => Math.abs(c.pos.z - 4 * MPT)));
    expect(ecartX, 'axe court : rien ne sort du demi-axe').toBeLessThanOrEqual(rx + 1e-5);
    expect(ecartZ, 'axe long : rien ne sort du demi-axe').toBeLessThanOrEqual(ry + 1e-5);
    expect(ecartZ, 'le contour s’allonge VRAIMENT sur l’axe long').toBeGreaterThan(rx * 1.5);
  });

  it('un décor 1×1 garde un halo ROND (contrat de non-régression)', () => {
    const p = pools();
    poseInteractHalos(p, [halo('coffre')], frame(0));
    const disque = instance(p.haloDisque!, 0);
    expect(disque.scl.x).toBeCloseTo(2 * haloRadiusK(HALO_RX_PX) * MPT, 6);
    expect(disque.scl.z).toBeCloseTo(disque.scl.x, 6);
  });

  it('SURVOL : le halo change de pool, s’agrandit de 1,32 et laisse le pool de repos VIDE', () => {
    const p = pools();
    const n = poseInteractHalos(p, [halo('coffre', { etat: 'survole' })], frame(0));
    expect(n.haloDisque + n.haloContour, 'un halo survolé n’est pas peint deux fois').toBe(0);
    expect(n.haloDisqueSurvol).toBe(1);
    expect(n.haloContourSurvol).toBeGreaterThan(3);
    expect(instance(p.haloDisqueSurvol!, 0).scl.x).toBeCloseTo(2 * haloRadiusK(HALO_RX_PX) * HALO_HOVER_SCALE * MPT, 6);
  });

  it('l’ÉTINCELLE est un quad face caméra, au-dessus du décor et décalé vers la droite de l’écran', () => {
    const p = pools();
    // caméra tournée d’un quart de tour : la « droite de l'écran » n'est plus l'axe X du monde
    const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    poseInteractHalos(p, [halo('coffre')], { ...frame(0), camQuat: quat });
    const e = instance(p.haloEtincelle!, 0);
    // hauteur : 26 px d'écran, à `ISO_PX_PER_M` px par mètre de hauteur (sans flottement à t = 0)
    expect(e.pos.y).toBeCloseTo(26 / ISO_PX_PER_M, 6);
    // décalage : 9 px vers la droite de l'ÉCRAN, donc sur l'axe que la caméra désigne
    const droite = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
    const attendu = new THREE.Vector3(3 * MPT, 0, 4 * MPT).addScaledVector(droite, 9 / pxPerM(MPT));
    expect(e.pos.x).toBeCloseTo(attendu.x, 6);
    expect(e.pos.z).toBeCloseTo(attendu.z, 6);
    // et le quad regarde la caméra : son orientation en dérive
    expect(e.quat.angleTo(quat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)))).toBeCloseTo(0, 6);
  });

  /** MUET = RIEN (#1687) : un utilisable ni survolé ni révélé ne s'annonce pas — aucun pool ne le
   *  porte, pas même son étincelle. C'est la fin du halo permanent. */
  it('un utilisable MUET n’écrit dans AUCUN pool', () => {
    const p = pools();
    const n = poseInteractHalos(p, [halo('coffre', { etat: 'muet' })], frame(0));
    for (const slot of HALO_SLOTS) expect(n[slot], slot).toBe(0);
  });

  /** UNE MATIÈRE POUR TOUS (#1687) : un PNJ à qui parler et un coffre à fouiller sont deux utilisables
   *  — mêmes pools, même rayon. L'entité utilisable n'a pas de kind. */
  it('deux utilisables révélés partagent la MÊME matière — un jeton de PNJ comme un décor', () => {
    const p = pools();
    const n = poseInteractHalos(
      p,
      [halo('coffre'), halo('marchand', { cell: { x: 5, y: 5, z: 0 }, centre: { x: 5, y: 5 } })],
      frame(0),
    );
    expect(n.haloDisque, 'un disque par utilisable révélé').toBe(2);
    expect(n.haloDisqueSurvol + n.haloContourSurvol, 'et aucun renfort sans survol').toBe(0);
    const r = haloRadiusK(HALO_RX_PX) * MPT;
    expect(instance(p.haloDisque!, 0).scl.x).toBeCloseTo(2 * r, 6);
    expect(instance(p.haloDisque!, 1).scl.x, 'le rayon ne dépend pas de QUI porte le halo').toBeCloseTo(2 * r, 6);
    expect(instance(p.haloDisque!, 1).pos.x, 'et chacun est chez lui').toBeCloseTo(5 * MPT, 6);
  });

  it('aucun halo : tous les pools tombent à zéro, et rien n’est laissé de la frame précédente', () => {
    const p = pools();
    poseInteractHalos(p, [halo('coffre'), halo('m', { cell: { x: 5, y: 5, z: 0 }, centre: { x: 5, y: 5 } })], frame(0));
    const n = poseInteractHalos(p, [], frame(0));
    for (const slot of HALO_SLOTS) {
      expect(n[slot as HaloSlot], slot).toBe(0);
      expect(p[slot as HaloSlot]!.count, slot).toBe(0);
    }
  });

  it('SATURATION : un halo qui ne tient pas n’est pas ENTAMÉ — pas même son disque', () => {
    const p: HaloPools = { haloContour: buildHaloMesh('haloContour', 4), haloDisque: buildHaloMesh('haloDisque') };
    const n = poseInteractHalos(p, [halo('coffre')], frame(0));
    expect(n.haloContour, 'un arc isolé se lirait comme une autre marque').toBe(0);
    expect(n.haloDisque, 'et un disque sans son contour serait une flaque muette').toBe(0);
  });

  it('CAPACITÉ COUPLÉE : le pool de disques ne dépasse jamais ce que son pool de contours sait habiller', () => {
    // CONTRAT DE MONTAGE : chaque paire (disque, contour) tient la même population de halos.
    const paires: [HaloSlot, HaloSlot][] = [
      ['haloDisque', 'haloContour'],
      ['haloDisqueSurvol', 'haloContourSurvol'],
    ];
    for (const [disque, contour] of paires)
      expect(HALO_SLOT_CAPACITY[contour], `${contour} doit habiller les ${HALO_SLOT_CAPACITY[disque]} disques de ${disque}`)
        .toBeGreaterThanOrEqual(HALO_SLOT_CAPACITY[disque] * HALO_RING_CHORDS);
    // et le palier de cordes est bien une BORNE du chapelet réellement demandé au gabarit de référence
    expect(ringDashes(haloRadiusK(HALO_RX_PX), null, 'iso').length).toBeLessThanOrEqual(HALO_RING_CHORDS);
    expect(ringDashes(haloRadiusK(HALO_RX_PX) * HALO_HOVER_SCALE, null, 'iso').length).toBeLessThanOrEqual(HALO_RING_CHORDS);
    // MESURE DE BOUT EN BOUT : au décor de trop, aucun disque NU ne reste (le juge P3-0g : au 52ᵉ halo,
    // l'ancien couple 64 disques / 1024 cordes en peignait un).
    const cordes = ringDashes(haloRadiusK(HALO_RX_PX), null, 'iso').length;
    const tenus = 3;
    const p: HaloPools = {
      haloContour: buildHaloMesh('haloContour', cordes * tenus),
      haloDisque: buildHaloMesh('haloDisque', HALO_SLOT_CAPACITY.haloDisque),
    };
    const n = poseInteractHalos(p, Array.from({ length: tenus + 5 }, (_, i) => halo(`d${i}`)), frame(0));
    expect(n.haloContour).toBe(cordes * tenus);
    expect(n.haloDisque, 'autant de disques que de contours habillés, pas un de plus').toBe(tenus);
  });

  it('l’ÉTINCELLE ne grandit ni ne monte avec le décor — seule sa POSITION suit l’échelle', () => {
    // L'échelle porte sur la seule POSITION du glyphe : son tracé garde ses `SPARK_R_PX` px et son
    // flottement ses `SPARK_RISE_PX` px (`interactHaloPose.poserEtincelle`, `sparkBob`). L'étincelle
    // flotte AU-DESSUS du décor : elle suit le PLUS GRAND côté de l'empreinte, là où le halo, couché au
    // sol, suit chaque axe.
    const mesure = (scale: number) => {
      const echelle = { x: scale, y: scale };
      const p = pools();
      poseInteractHalos(p, [halo('e', { echelle })], frame(0));
      const bas = instance(p.haloEtincelle!, 0);
      poseInteractHalos(p, [halo('e', { echelle })], frame(SPARK_S / 2));
      const haut = instance(p.haloEtincelle!, 0);
      return { côté: bas.scl.x, montée: haut.pos.y - bas.pos.y, hauteur: bas.pos.y };
    };
    const un = mesure(1);
    const deux = mesure(2);
    // (tolérance : les matrices d'instance sont stockées en float32 — 1e-7 près à cette échelle)
    expect(deux.côté, 'le glyphe garde sa taille d’écran').toBeCloseTo(un.côté, 6);
    expect(deux.montée, 'et son flottement ses 4 px').toBeCloseTo(un.montée, 6);
    expect(un.montée).toBeCloseTo(SPARK_RISE_PX / ISO_PX_PER_M, 6);
    // ce qui suit l'échelle, c'est la POSITION : le décor deux fois plus grand porte son étincelle
    // deux fois plus haut au-dessus de ses pieds
    expect(deux.hauteur).toBeCloseTo(2 * un.hauteur, 6);
  });

  it('l’ÉTINCELLE s’élève selon le HAUT DE L’ÉCRAN, pas selon l’axe Y du monde', () => {
    // Caméra du DESSUS : elle regarde à la verticale, donc l'axe Y du monde pointe vers l'œil — une
    // élévation en Y y serait invisible. Patron `sceneMeshes.billboardPose` (consommé par `boardPose`).
    const p = pools();
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0, 'YXZ'));
    poseInteractHalos(p, [halo('coffre')], { ...frame(0), kind: 'top', camQuat: quat });
    const e = instance(p.haloEtincelle!, 0);
    const haut = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
    expect(Math.abs(haut.y), 'témoin : sous cette caméra, le haut de l’écran n’est PAS l’axe Y').toBeLessThan(1e-9);
    // le pied du décor, décalage de droite d'écran compris
    const droite = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
    const pied = new THREE.Vector3(3 * MPT, 0, 4 * MPT).addScaledVector(droite, SPARK_DX_PX / pxPerM(MPT));
    const attendu = pied.clone().addScaledVector(haut, SPARK_DY_PX / ISO_PX_PER_M);
    expect(e.pos.distanceTo(attendu)).toBeCloseTo(0, 6);
    expect(e.pos.distanceTo(pied), 'l’étincelle reste à 26 px du décor, vue du dessus comprise').toBeCloseTo(SPARK_DY_PX / ISO_PX_PER_M, 6);
  });
});

describe('Pose des halos — la PULSATION passe par l’opacité des pools (#1176 P3-0g)', () => {
  it('les opacités de matériau suivent l’horloge, chacune sur SA courbe', () => {
    const p = pools();
    const jeu = [halo('a'), halo('b', { etat: 'survole' })];
    poseInteractHalos(p, jeu, frame(0));
    expect(opacité(p.haloDisque!)).toBeCloseTo(HALO_SLOT_OPACITY.haloDisque * HALO_PULSE_MIN, 12);
    expect(opacité(p.haloContour!)).toBeCloseTo(HALO_SLOT_OPACITY.haloContour * HALO_PULSE_MIN, 12);
    expect(opacité(p.haloContourSurvol!), 'le SURVOLÉ bat sur la courbe VIVE').toBeCloseTo(HALO_SLOT_OPACITY.haloContourSurvol * HALO_HOVER_PULSE_MIN, 12);
    expect(opacité(p.haloOnde!)).toBeCloseTo(PING_OPACITY_MAX, 12);
    expect(opacité(p.haloEtincelle!)).toBeCloseTo(SPARK_OPACITY_MIN, 12);
    // une demi-période plus tard, le halo de repos est à son maximum
    poseInteractHalos(p, jeu, frame(HALO_PULSE_S / 2));
    expect(opacité(p.haloDisque!)).toBeCloseTo(HALO_SLOT_OPACITY.haloDisque * HALO_PULSE_MAX, 12);
    expect(opacité(p.haloContourSurvol!)).toBeCloseTo(
      HALO_SLOT_OPACITY.haloContourSurvol * haloPulse(HALO_PULSE_S / 2, true),
      12,
    );
  });

  it('l’ONDE s’élargit d’une frame à l’autre, et n’est PAS peinte quand elle est éteinte', () => {
    const p = pools();
    const jeu = [halo('coffre')];
    poseInteractHalos(p, jeu, frame(0));
    const r0 = rayonDesCordes(p.haloOnde!, 3 * MPT, 4 * MPT);
    poseInteractHalos(p, jeu, frame(PING_S * 0.3));
    const r1 = rayonDesCordes(p.haloOnde!, 3 * MPT, 4 * MPT);
    expect(r1, 'l’onde sonar avance entre deux frames').toBeGreaterThan(r0);
    expect(r0).toBeCloseTo(haloRadiusK(HALO_RX_PX) * PING_SCALE_MIN * MPT, 6);
    // au-delà de 75 % du tour, la pulsation est à opacité nulle : rien à écrire
    const n = poseInteractHalos(p, jeu, frame(PING_S * 0.9));
    expect(n.haloOnde).toBe(0);
    expect(n.haloContour, 'mais le halo révélé, lui, reste peint').toBeGreaterThan(0);
  });

  it('l’ÉTINCELLE monte entre deux frames — le flottement est bien une fonction de l’horloge', () => {
    const p = pools();
    const jeu = [halo('coffre')];
    poseInteractHalos(p, jeu, frame(0));
    const y0 = instance(p.haloEtincelle!, 0).pos.y;
    poseInteractHalos(p, jeu, frame(SPARK_S / 2));
    const y1 = instance(p.haloEtincelle!, 0).pos.y;
    expect(y1 - y0).toBeCloseTo(SPARK_RISE_PX / ISO_PX_PER_M, 6);
  });
});
