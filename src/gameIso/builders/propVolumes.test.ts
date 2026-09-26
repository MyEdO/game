import { describe, expect, it } from 'vitest';
import { DIR4_ORDER, type Dir4, type Dir8 } from '../../state/dir8';
import { findPropById } from '../../data';
import { capVolumique, type PropData } from '../../data/props.types';
import { polyNormal } from '../backends/webgl/worldTris';
import { buildPropVolumes, type AncrageVolume } from './propVolumes';
import type { Face } from './types';

/**
 * COMPILATION VOLUMIQUE — ce qu'un type de décor à recette produit comme géométrie MONDE, aux HUIT
 * caps. Les goldens tiennent la forme (nombre de faces par primitive, coordonnées) ; les assertions
 * qui les entourent tiennent ce qu'un golden ne dit pas : l'identité de picking, le domaine de
 * matériau, l'orientation vers le dehors et l'absence de face dégénérée.
 */
const PROP_TROIS_PRIMITIVES: PropData = {
  id: 'banc-d-epreuve',
  type: 'props',
  label: 'Banc d’épreuve',
  solid: true,
  volume: {
    capIdentite: 'S',
    primitives: [
      { kind: 'box', center: { xM: 0, yM: 0, hM: 0.45 }, size: { xM: 1.6, yM: 0.8, hM: 0.1 }, material: 'bois-chene' },
      { kind: 'cylinder', center: { xM: 0.4, yM: 0, hM: 0.2 }, axis: 'h', radiusM: 0.12, longueurM: 0.4, sides: 8, material: 'fer-noirci' },
      { kind: 'prism', center: { xM: -0.4, yM: 0.2, hM: 0.15 }, size: { xM: 0.6, yM: 0.4, hM: 0.3 }, slope: 'x+', material: 'pierre-atre' },
    ],
  },
};

/** Échelle des scènes de ce fichier : le défaut du monde, 2 m/case (`LDB 15 l.12`). */
const MPT_TERRESTRE = 2;

/** Les faces MONDE d'une recette à l'échelle terrestre — l'échelle est un paramètre du BUILDER, pas de
 *  l'ancrage : ce raccourci ne fait que la nommer une fois pour tout le fichier. */
const cuire = (prop: PropData, ancrage: AncrageVolume): Face[] => buildPropVolumes(prop, ancrage, MPT_TERRESTRE);

/** L'ANCRAGE d'un meuble posé : son point monde, son cap, l'altitude de son pied, l'entité porteuse. */
function ancrageDe({ id, ancre, facing, baseHeightM = 0 }: { id?: string; ancre: { x: number; y: number }; facing?: Dir8; baseHeightM?: number }): AncrageVolume {
  return { ancre, facing: capVolumique(facing, id ?? 'sonde'), baseHeightM, ...(id ? { entId: id } : {}) };
}

const r3 = (n: number): number => Math.round(n * 1000) / 1000;
/** Le golden d'une face : son matériau, son nombre de sommets, ses sommets arrondis au millimètre. */
const snapshotFaces = (faces: readonly Face[]): string[] =>
  faces.map((f) => `${f.material.domain}:${f.material.id}|${f.poly.length}|${f.poly.map((p) => `(${r3(p.x)},${r3(p.y)},${r3(p.h)})`).join(' ')}`);

/** Aire (m²) d'un polygone MONDE, à l'échelle d'une case d'un mètre : zéro = face dégénérée. */
function aire(face: Face): number {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < face.poly.length; i++) {
    const a = face.poly[i];
    const b = face.poly[(i + 1) % face.poly.length];
    nx += (a.h - b.h) * (a.y + b.y);
    ny += (a.y - b.y) * (a.x + b.x);
    nz += (a.x - b.x) * (a.h + b.h);
  }
  return Math.hypot(nx, ny, nz) / 2;
}

describe('buildPropVolumes — la recette locale devient de la géométrie monde', () => {
  it.each<Dir4>(DIR4_ORDER)('compile les trois primitives au cap %s', (facing) => {
    const ancrage = ancrageDe({ id: `meuble-${facing}`, ancre: { x: 4, y: 6 }, facing });
    const faces = cuire(PROP_TROIS_PRIMITIVES, ancrage);
    expect(faces.length).toBe(6 + 10 + 5); // boîte, cylindre à 8 pans (+ dessus + dessous), prisme
    expect(faces.every((f) => f.entId === ancrage.entId && f.material.domain === 'prop')).toBe(true);
    expect(snapshotFaces(faces)).toMatchSnapshot();
  });

  it('aucune face dégénérée, et chaque polygone regarde le DEHORS de sa primitive', () => {
    const faces = cuire(PROP_TROIS_PRIMITIVES, ancrageDe({ id: 'meuble', ancre: { x: 4, y: 6 }, facing: 'S' }));
    for (const face of faces) expect(aire(face)).toBeGreaterThan(1e-6);
    // Le centre de la BOÎTE, en monde : toute face de la boîte doit lui tourner le dos.
    const boite = faces.filter((f) => f.material.id === 'bois-chene');
    expect(boite).toHaveLength(6);
    const centre = { x: 4, y: 6, h: 0.45 };
    for (const face of boite) {
      const n = polyNormal(face.poly.map((p) => ({ x: p.x, y: p.h, z: p.y })))!;
      const c = face.poly.reduce((acc, p) => ({ x: acc.x + p.x / 4, y: acc.y + p.h / 4, z: acc.z + p.y / 4 }), { x: 0, y: 0, z: 0 });
      expect(n.x * (c.x - centre.x) + n.y * (c.y - centre.h) + n.z * (c.z - centre.y)).toBeGreaterThan(0);
    }
  });

  it('le CAP tourne la géométrie une seule fois, autour de la case d’ancrage', () => {
    const parCap = DIR4_ORDER.map((facing) =>
      cuire(PROP_TROIS_PRIMITIVES, ancrageDe({ id: 'meuble', ancre: { x: 4, y: 6 }, facing })));
    // Le cylindre est excentré (x = 0.2) : chaque cap le pose ailleurs — quatre positions DISTINCTES.
    const piedsParCap = parCap.map((faces) => {
      const pied = faces.filter((f) => f.material.id === 'fer-noirci').flatMap((f) => f.poly);
      return `${r3(Math.min(...pied.map((p) => p.x)))},${r3(Math.min(...pied.map((p) => p.y)))}`;
    });
    expect(new Set(piedsParCap).size).toBe(4);
    // …et l'ancrage ne bouge pas : le centre de la boîte reste sur la case, à tous les caps.
    for (const faces of parCap) {
      const boite = faces.filter((f) => f.material.id === 'bois-chene').flatMap((f) => f.poly);
      expect(r3((Math.min(...boite.map((p) => p.x)) + Math.max(...boite.map((p) => p.x))) / 2)).toBe(4);
      expect(r3((Math.min(...boite.map((p) => p.y)) + Math.max(...boite.map((p) => p.y))) / 2)).toBe(6);
    }
  });

  /**
   * CAP D'IDENTITÉ (contrat de donnée, `data/props.types.ts`) : une recette s'authore au cap `S`
   * (`CAP_IDENTITE_PROP`), qui est AUSSI le défaut du monde — une instance SANS `facing` rend donc la
   * géométrie AUTHORÉE, non tournée. C'est tout le contrat de #1680 ligne 16 : ce que l'auteur écrit
   * est ce que la scène montre, sans demi-tour à tenir de tête.
   */
  it('le cap `S` est l’identité de rotation ; SANS cap, la géométrie sort telle qu’AUTHORÉE', () => {
    /** L'emprise en x/y d'un matériau, RAMENÉE au repère local de la case d'ancrage. */
    const emprise = (facing: Dir8 | undefined, material: string) => {
      const pts = cuire(PROP_TROIS_PRIMITIVES, ancrageDe({ id: 'meuble', ancre: { x: 4, y: 6 }, ...(facing ? { facing } : {}) }))
        .filter((f) => f.material.id === material)
        .flatMap((f) => f.poly.map((p) => ({ x: p.x - 4, y: p.y - 6 })));
      return {
        x: [r3(Math.min(...pts.map((p) => p.x))), r3(Math.max(...pts.map((p) => p.x)))],
        y: [r3(Math.min(...pts.map((p) => p.y))), r3(Math.max(...pts.map((p) => p.y)))],
      };
    };
    // Au cap `S`, chaque primitive occupe EXACTEMENT l'emprise que la recette déclare (centre ± demi-
    // dimension, centre ± rayon) : aucune rotation ne s'est appliquée.
    expect(emprise('S', 'bois-chene')).toEqual({ x: [-0.4, 0.4], y: [-0.2, 0.2] }); // box (0,0) × (0.8, 0.4)
    expect(emprise('S', 'fer-noirci')).toEqual({ x: [0.14, 0.26], y: [-0.06, 0.06] }); // cyl (0.2, 0) r 0.06
    expect(emprise('S', 'pierre-atre')).toEqual({ x: [-0.35, -0.05], y: [0, 0.2] }); // prism (−0.2, 0.1) × (0.3, 0.2)
    // …et l'ABSENCE de cap vaut `S` : la MÊME emprise, à l'identique — c'est l'invariant du lot.
    expect(emprise(undefined, 'bois-chene')).toEqual(emprise('S', 'bois-chene'));
    expect(emprise(undefined, 'fer-noirci')).toEqual(emprise('S', 'fer-noirci'));
    expect(emprise(undefined, 'pierre-atre')).toEqual(emprise('S', 'pierre-atre'));
    // Le cap `N` est désormais le DEMI-TOUR : le pied et le rampant changent de bord.
    expect(emprise('N', 'fer-noirci')).toEqual({ x: [-0.26, -0.14], y: [-0.06, 0.06] });
    expect(emprise('N', 'pierre-atre')).toEqual({ x: [0.05, 0.35], y: [-0.2, 0] });
  });

  /**
   * LE CONTRAT SUR UNE RECETTE RÉELLE ET ASYMÉTRIQUE — le `coffre` du catalogue, dont la SERRURE est
   * la seule primitive de `laiton-dore` et n'est centrée sur aucun axe. Sans cap, le monde la pose
   * exactement là où la donnée l'écrit : c'est la formulation mesurable de « une recette s'authore
   * telle qu'elle se voit ». Une recette restée sous l'ancien repère la poserait à l'opposé.
   */
  it('coffre : SANS cap, la serrure sort du côté que la DONNÉE déclare', () => {
    const coffre = findPropById('coffre')!;
    const serrure = coffre.volume!.primitives.find((p) => p.material === 'laiton-dore')!;
    const faces = cuire(coffre, ancrageDe({ id: 'coffre-1', ancre: { x: 5, y: 7 } }))
      .filter((f) => f.material.id === 'laiton-dore');
    expect(faces.length).toBeGreaterThan(0);
    const pts = faces.flatMap((f) => f.poly);
    const centre = {
      x: r3((Math.min(...pts.map((p) => p.x)) + Math.max(...pts.map((p) => p.x))) / 2 - 5),
      y: r3((Math.min(...pts.map((p) => p.y)) + Math.max(...pts.map((p) => p.y))) / 2 - 7),
    };
    expect(centre).toEqual({ x: r3(serrure.center.xM / MPT_TERRESTRE), y: r3(serrure.center.yM / MPT_TERRESTRE) });
    expect(Math.sign(centre.y), 'la serrure n’est pas sur l’axe : le côté est mesurable').not.toBe(0);
  });

  /**
   * ANCRE FRACTIONNAIRE (#1624) : une feature de façade s'ancre entre deux cases, un ornement de faîte au
   * milieu d'une empreinte paire. La recette y subit une TRANSLATION RIGIDE et rien d'autre — mêmes
   * normales face à face, mêmes aires, le seul écart étant le décalage demandé.
   */
  it('une ancre FRACTIONNAIRE translate la recette sans la déformer', () => {
    const surCase = cuire(PROP_TROIS_PRIMITIVES, ancrageDe({ ancre: { x: 4, y: 3 }, facing: 'E' }));
    const entreCases = cuire(PROP_TROIS_PRIMITIVES, ancrageDe({ ancre: { x: 4.5, y: 3.5 }, facing: 'E' }));
    expect(entreCases).toHaveLength(surCase.length);
    for (const [i, face] of entreCases.entries()) {
      const ref = surCase[i];
      expect(face.material).toEqual(ref.material);
      expect(face.poly.map((p) => ({ x: r3(p.x - 0.5), y: r3(p.y - 0.5), h: r3(p.h) })))
        .toEqual(ref.poly.map((p) => ({ x: r3(p.x), y: r3(p.y), h: r3(p.h) })));
      const n = (f: Face) => polyNormal(f.poly.map((p) => ({ x: p.x, y: p.h, z: p.y })))!;
      const [a, b] = [n(face), n(ref)];
      expect([r3(a.x), r3(a.y), r3(a.z)]).toEqual([r3(b.x), r3(b.y), r3(b.z)]);
      expect(r3(aire(face))).toBe(r3(aire(ref)));
    }
  });

  /**
   * CAP CARDINAL SEULEMENT (#1680 ligne 3) : le type d'`AncrageVolume` refuse déjà la diagonale au
   * compilateur ; `capVolumique` est la porte qui la refuse à la DONNÉE, nominativement. La rotation
   * générique (`rotatePropLocal`), elle, garde ses huit caps — elle sert aussi aux places assises.
   */
  it.each<Dir8>(['NE', 'SE', 'SO', 'NO'])('refuse le cap diagonal %s, en le nommant', (diagonal) => {
    expect(() => ancrageDe({ id: 'meuble', ancre: { x: 4, y: 6 }, facing: diagonal }))
      .toThrow(`meuble : cap ${diagonal} — un décor volumique ne prend qu'un cap cardinal (N/E/S/O)`);
  });

  /**
   * UNITÉ DE LA RECETTE (#1507) — une recette est en MÈTRES : la MÊME recette cuite sur une scène
   * terrestre (2 m/case) et sur une scène MER (10 m/case) rend la MÊME boîte MÉTRIQUE. C'est le défaut
   * que ce lot supprime : le monde multipliait des cases par l'échelle à la cuisson, et un tonneau de
   * 0,75 m de large en mesurait 3,74 en mer.
   */
  it('l’ÉCHELLE de la scène ne change pas les DIMENSIONS MÉTRIQUES d’une recette', () => {
    const cuireA = (mpt: number) =>
      buildPropVolumes(PROP_TROIS_PRIMITIVES, ancrageDe({ id: 'meuble', ancre: { x: 4, y: 6 }, facing: 'S' }), mpt);
    /** L'emprise MÉTRIQUE d'un matériau : les cases du monde, ramenées en mètres par `mpt`. */
    const boiteMetrique = (mpt: number, material: string) => {
      const pts = cuireA(mpt).filter((f) => f.material.id === material).flatMap((f) => f.poly);
      const etendue = (v: number[]) => r3(Math.max(...v) - Math.min(...v));
      return {
        largeur: etendue(pts.map((p) => p.x * mpt)),
        profondeur: etendue(pts.map((p) => p.y * mpt)),
        hauteur: etendue(pts.map((p) => p.h)),
      };
    };
    for (const material of ['bois-chene', 'fer-noirci', 'pierre-atre'])
      expect(boiteMetrique(10, material), material).toEqual(boiteMetrique(MPT_TERRESTRE, material));
    // …et ces mètres sont EXACTEMENT ceux que la recette écrit : la caisse fait 1,6 × 0,8 × 0,1 m.
    expect(boiteMetrique(10, 'bois-chene')).toEqual({ largeur: 1.6, profondeur: 0.8, hauteur: 0.1 });
    // L'emprise en CASES, elle, SUIT l'échelle : 0,8 case à 2 m/case, 0,16 à 10.
    const enCases = (mpt: number) => {
      const pts = cuireA(mpt).filter((f) => f.material.id === 'bois-chene').flatMap((f) => f.poly);
      return r3(Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x)));
    };
    expect([enCases(MPT_TERRESTRE), enCases(10)]).toEqual([0.8, 0.16]);
  });

  it('la hauteur du sol s’ajoute UNE fois à chaque hauteur locale', () => {
    const auSol = cuire(PROP_TROIS_PRIMITIVES, ancrageDe({ id: 'meuble', ancre: { x: 4, y: 6 }, facing: 'S' }));
    const enHauteur = cuire(PROP_TROIS_PRIMITIVES, ancrageDe({ id: 'meuble', ancre: { x: 4, y: 6 }, facing: 'S', baseHeightM: 7.25 }));
    expect(enHauteur.map((f) => f.poly.map((p) => r3(p.h - 7.25)))).toEqual(auSol.map((f) => f.poly.map((p) => r3(p.h))));
    expect(Math.min(...enHauteur.flatMap((f) => f.poly.map((p) => p.h)))).toBeCloseTo(7.25);
  });
});
