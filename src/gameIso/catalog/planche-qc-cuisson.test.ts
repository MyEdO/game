/**
 * PLANCHE QC DU MOBILIER VOLUMIQUE — l'instrument est une INSTANCE de la cuisson (#1680 ligne 17).
 *
 * Un œil de QC qui tient ses propres lois montre un décor que le jeu ne rend pas : l'auteur corrige
 * alors d'après une image fausse. Défaut mesuré avant ce lot : la planche projetait à `cos/sin(π/6)`
 * sur une seule cadence de 44 px/m — l'isométrie « uniforme » que `cameras.ts:14` documente comme
 * FAUSSE (la projection de production tient deux cadences indépendantes, sol et hauteur) : +15,5 % de
 * profondeur au sol, et un rapport hauteur:profondeur de 2 au lieu de 3.
 *
 * Trois contrats, tous sur le module de la planche IMPORTÉ (jamais sur son texte source : une lecture
 * par regex devient muette au premier refactor) :
 *  - PARITÉ AVEC LA CUISSON : les triangles que la planche PEINT sont exactement ceux dont le sens de
 *    parcours écrit par la cuisson (`sceneMeshes.ts:441-449`) regarde l'œil ;
 *  - sa projection EST celle de la caméra affine de production, au 1e-9 sur les deux axes ;
 *  - CLIQUET : aucun littéral de projection dans `scripts/qc/`.
 */
import { describe, expect, it } from 'vitest';
import { readCorpus } from '../../../scripts/guards/lib/sourceCorpus.mjs';
import {
  ECHELLE_PROJETEE,
  MPT_DE_PLANCHE,
  RECETTES,
  ancrageDePlanche,
  preparerVue,
  projeterPlanche,
  versOeilDe,
  type Pt3,
  type VuePlanche,
} from '../../../scripts/qc/lib/plancheVolumique';
import { buildPropVolumes } from '../builders/propVolumes';
import { fanTriangles, orienterPoly, polyNormal, shadeFamily, type Vec3 } from '../../noyau/monde/volume/worldTris';
import { affineScales } from '../backends/webgl/cameras';
import { findPropById } from '../../data';
import type { Rot } from '../../geometry/iso';

const CRANS: Rot[] = [0, 1, 2, 3];
const facesDe = (id: string) => buildPropVolumes(findPropById(id)!, ancrageDePlanche, MPT_DE_PLANCHE);

/** Repère de la planche (x est, y sud, h haut) → repère three (X est, Y haut, Z sud). */
const versTrois = (p: Pt3): Vec3 => ({ x: p.x, y: p.h, z: p.y });
const produit = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
/** La planche n'a qu'une case, à l'origine — la loi n'a besoin du centre de carte que pour une
 *  surface OUVERTE verticale, qu'aucune recette volumique ne produit. */
const CENTRE_PLANCHE = { x: 0, z: 0 };
const estMemeSens = (a: Vec3, b: Vec3 | null) => !!b && produit(a, b) > 0;

describe('planche QC — le DEHORS peint est celui de la cuisson', () => {
  it('chaque recette × 4 crans : la planche PEINT exactement les triangles que la cuisson écrit FRONTAUX', () => {
    // Les deux côtés se calculent à des GRANULARITÉS différentes, et c'est là toute la mesure : la
    // planche cull une FACE entière (`preparerVue`), la cuisson oriente chaque TRIANGLE
    // (`sceneMeshes.ts:441`, après `fanTriangles`). Un éventail dont un triangle diverge de sa face —
    // recette non plane, non convexe, sommets colinéaires — peint au QC une surface que le GPU écarte,
    // ou l'inverse : l'auteur juge alors une image que le jeu ne rend pas.
    const oeil = versTrois(versOeilDe('iso'));
    const désaccords: string[] = [];
    let faces = 0;
    let triangles = 0;
    for (const id of RECETTES) {
      const fs = facesDe(id);
      for (const rot of CRANS) {
        preparerVue(fs, rot, 'iso').forEach((p, i) => {
          faces++;
          for (const [t, tri] of fanTriangles(p.metrique.map(versTrois)).entries()) {
            triangles++;
            const { versLExterieur, normale } = orienterPoly(tri, fs[i].oriented, CENTRE_PLANCHE);
            // Le SENS DE PARCOURS que la cuisson écrit : `[0,1,2]` vers le dehors, `[0,2,1]` sinon
            // (`sceneMeshes.ts:449`). Frontal à l'œil = la normale géométrique du triangle ÉCRIT
            // regarde l'œil ; on la relit sur les sommets réordonnés, jamais sur la valeur rendue.
            const écrit: Vec3[] = versLExterieur ? [...tri] : [tri[0], tri[2], tri[1]];
            const nÉcrite = polyNormal(écrit);
            expect(nÉcrite === null || estMemeSens(nÉcrite, normale), `${id}/rot${rot}/face${i}/tri${t}`).toBe(true);
            const frontal = !!nÉcrite && produit(nÉcrite, oeil) > 0;
            if (frontal !== p.visible) désaccords.push(`${id}/rot${rot}/face${i}/tri${t}`);
          }
        });
      }
    }
    expect(faces, 'aucune face lue : la parité tournerait à vide').toBeGreaterThan(0);
    expect(triangles, 'aucun triangle lu : la parité tournerait à vide').toBeGreaterThan(0);
    expect(désaccords).toEqual([]);
  });

  it('l’œil est AU-DESSUS : les faces peintes portent plus haut que les faces cachées, aux 4 crans', () => {
    // VÉRITÉ FIXE, indépendante de la loi : une coquille close vue d'en haut montre son dessus et ses
    // flancs proches, elle cache son dessous et ses flancs lointains. Un dehors RETOURNÉ échange
    // exactement les deux lots — l'inégalité s'inverse sur chaque cas (chaque recette × 4 crans).
    const moyenne = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
    const inversés: string[] = [];
    for (const id of RECETTES) {
      const faces = facesDe(id);
      for (const rot of CRANS) {
        const hauteurs = (visible: boolean) =>
          preparerVue(faces, rot, 'iso')
            .filter((p) => p.visible === visible)
            .map((p) => moyenne(p.metrique.map((q) => q.h)));
        const peintes = hauteurs(true);
        const cachées = hauteurs(false);
        if (!peintes.length || !cachées.length || moyenne(peintes) <= moyenne(cachées)) inversés.push(`${id}/rot${rot}`);
      }
    }
    expect(inversés).toEqual([]);
  });

  it('aucune face peinte ne regarde le SOFFITE à la verticale (le dessous ne se voit pas d’en haut)', () => {
    // Ce que mord cette clause : la DIRECTION DE L'ŒIL, dérivée du pitch de la caméra — un œil passé
    // sous l'horizon (signe inversé, pitch pris à une autre vue) peindrait les dessous.
    const dessous: string[] = [];
    for (const id of RECETTES) {
      const faces = facesDe(id);
      for (const rot of CRANS) {
        preparerVue(faces, rot, 'iso').forEach((p, i) => {
          const n = p.normale;
          if (p.visible && n && shadeFamily({ x: n.x, y: n.h, z: n.y }) === 'bas' && n.h < -0.9) dessous.push(`${id}/rot${rot}/face${i}`);
        });
      }
    }
    expect(dessous).toEqual([]);
  });
});

describe('planche QC — la PROJECTION peinte est celle de la caméra de production', () => {
  const POINTS: Pt3[] = [
    { x: 0, y: 0, h: 0 },
    { x: 1, y: 0, h: 0 },
    { x: 0, y: 1, h: 0 },
    { x: 0, y: 0, h: 1 },
    { x: 2.5, y: -1.75, h: 0.85 },
    { x: -3.25, y: 4.5, h: 2.4 },
  ];

  /** L'affine de production reformulée depuis la CAMÉRA : `sx` px/m le long de l'axe écran droit
   *  (diagonale (x−y)/√2 en iso, x en vue du dessus), `sy` px/m le long de l'axe écran vertical, dont
   *  le pitch départage la part de PROFONDEUR sol et la part de HAUTEUR. */
  const parLaCamera = (p: Pt3, vue: VuePlanche) => {
    const { sx, sy, pitch } = affineScales(vue, ECHELLE_PROJETEE);
    if (vue === 'top') return { sx: p.x * sx, sy: p.y * sy };
    return {
      sx: sx * (p.x - p.y) * Math.SQRT1_2,
      sy: sy * ((p.x + p.y) * Math.SQRT1_2 * Math.sin(pitch) - p.h * Math.cos(pitch)),
    };
  };

  it.each<VuePlanche>(['iso', 'top'])('%s : la planche projette au pixel de `affineScales` (1e-9)', (vue) => {
    for (const p of POINTS) {
      const vu = projeterPlanche(p, vue);
      const attendu = parLaCamera(p, vue);
      expect(Math.abs(vu.sx - attendu.sx), `${vue} sx sur ${JSON.stringify(p)}`).toBeLessThan(1e-9);
      expect(Math.abs(vu.sy - attendu.sy), `${vue} sy sur ${JSON.stringify(p)}`).toBeLessThan(1e-9);
    }
  });

  it('la direction de l’ŒIL est le NOYAU de la projection : s’y déplacer ne bouge aucun axe d’écran', () => {
    for (const vue of ['iso', 'top'] as VuePlanche[]) {
      const o = versOeilDe(vue);
      expect(Math.hypot(o.x, o.y, o.h)).toBeCloseTo(1, 12);
      for (const p of POINTS) {
        const a = projeterPlanche(p, vue);
        const b = projeterPlanche({ x: p.x + o.x, y: p.y + o.y, h: p.h + o.h }, vue);
        expect(Math.abs(a.sx - b.sx)).toBeLessThan(1e-9);
        expect(Math.abs(a.sy - b.sy)).toBeLessThan(1e-9);
      }
    }
  });
});

/** Les fautes de PROJECTION LOCALE qu'un outil de QC ne peut plus commettre : une trigonométrie sur un
 *  angle LITTÉRAL (le pitch iso « uniforme » de 30°, l'erreur d'origine), et une cadence de pixels par
 *  mètre déclarée sur place (la projection en tient DEUX, dérivées de `affineScales`). Le pitch et les
 *  échelles se demandent à la caméra ; un cran de caméra est un quart de tour ENTIER (`rotOffset`). */
const INTERDITS: { nom: string; motif: RegExp }[] = [
  { nom: 'angle littéral (Math.PI)', motif: /Math\.PI/ },
  { nom: 'trigonométrie sur un littéral', motif: /Math\.(?:cos|sin|tan|atan2?|asin|acos)\([^)]*[0-9]/ },
  { nom: 'cadence de pixels par mètre déclarée sur place', motif: /\b[A-Z_]*(?:PX|PIXELS)_(?:PAR|PER)_(?:M|METRE|METER)\b|\b[A-Z_]*(?:M|METRE|METER)S?_(?:PAR|PER)_(?:PX|PIXELS?)\b/ },
];

describe('CLIQUET — aucun outil de QC ne tient sa propre projection', () => {
  it('scripts/qc : zéro littéral de projection', () => {
    // Tous les scripts de QC, récursivement — un outil de plus est couvert par sa seule existence.
    const fichiers = readCorpus(['scripts/qc'], { exts: ['.mts', '.mjs', '.ts', '.js'] });
    expect(fichiers.length).toBeGreaterThan(0);
    const fautes: string[] = [];
    for (const { rel, text } of fichiers) {
      text.split('\n').forEach((ligne, i) => {
        for (const { nom, motif } of INTERDITS)
          if (motif.test(ligne)) fautes.push(`${rel}:${i + 1} — ${nom}`);
      });
    }
    expect(fautes).toEqual([]);
  });
});
