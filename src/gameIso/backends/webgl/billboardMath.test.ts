import { describe, it, expect } from 'vitest';
import {
  BILLBOARD_H_M,
  billboardView,
  anchorAndSize,
  rasterPxHeight,
  billboardTextureKey,
  BILLBOARD_BOX_ASPECT,
  ZOOM_MAX,
  RASTER_PX_MIN,
  RASTER_PX_MAX,
  JEU_SCALE,
  subjectQuad,
} from './billboardMath';
import { pxPerM } from './worldTris';
import { VIEWS, project, facingView } from '../../facing';
import { povView } from '../../pov/camera';
import { PROP_H_M, BB_W, BB_H } from '../../pov/billboardCore';
import { DIR8_ORDER } from '../../../geometry/dir8';
import { TW, type Rot } from '../../../geometry/iso';

describe('taille monde — une seule hauteur de décor (#1160)', () => {
  it('la hauteur est la valeur rendue en jeu, au bit près', () => {
    // valeur littérale, indépendante de la dérivation du module
    expect(BILLBOARD_H_M).toBe(2.172222222222222);
  });

  it('hauteur = hauteur métrique de décor × échelle du moteur', () => {
    expect(PROP_H_M).toBeCloseTo(1.7, 6);
    expect(JEU_SCALE).toBeCloseTo(1.2777778, 6);
    expect(BILLBOARD_H_M).toBe(PROP_H_M * JEU_SCALE);
  });

  it('quad d’un sujet : boîte canonique, la hauteur × son échelle à l’aspect de la boîte', () => {
    const q = subjectQuad({ scaleK: 1.5, box: { w: BB_W, h: BB_H } });
    expect(q.heightM).toBeCloseTo(BILLBOARD_H_M * 1.5, 10);
    expect(q.widthM).toBeCloseTo(BILLBOARD_H_M * 1.5 * BILLBOARD_BOX_ASPECT, 10);
  });

  it('quad d’un sujet : une boîte deux fois plus haute double le quad au lieu d’écraser le sujet', () => {
    const q = subjectQuad({ scaleK: 1, box: { w: BB_W, h: BB_H * 2 } });
    expect(q.heightM).toBeCloseTo(BILLBOARD_H_M * 2, 10);
    expect(q.widthM).toBeCloseTo(BILLBOARD_H_M * 2 * (BB_W / (BB_H * 2)), 10);
  });
});

describe('sélection de vue — délégation aux résolveurs de prod (#1161)', () => {
  it('ortho : identique à project() pour les 8 Dir8 × 4 rotations', () => {
    for (const dir of DIR8_ORDER) {
      for (const rot of [0, 1, 2, 3] as Rot[]) {
        expect(billboardView({ kind: 'ortho', yawDeg: rot * 90 }, dir), `${dir}/${rot}`).toEqual(project(dir, rot));
      }
    }
  });

  it('ortho : le cran de caméra CHANGE la vue (pas une constante déguisée)', () => {
    const vues = new Set(([0, 1, 2, 3] as Rot[]).map((rot) => JSON.stringify(billboardView({ kind: 'ortho', yawDeg: rot * 90 }, 'N'))));
    expect(vues.size).toBeGreaterThan(1);
  });

  it('ortho : garde le seuil 1.5 de facingView (aucun seuil recopié)', () => {
    // 'E' à rot 0 → delta (1,0) → écran (dx,dy) = (1,1) : |dx| = |dy| ⇒ pas profil, vers le bas ⇒ front
    expect(billboardView({ kind: 'ortho', yawDeg: 0 }, 'E')).toEqual(facingView(1, 1));
  });

  it('ortho : un lacet LIBRE change la vue ENTRE deux crans (l’angle continu n’est pas quantifié)', () => {
    // 'E' est à la frontière front/profil au cran 0 (|dx| = |dy|) : tourner la caméra de 25° la franchit
    // — le résolveur d'écran `facingView` tranche. Un lacet ramené au cran le PLUS PROCHE (0 ici)
    // rendrait 'front' : c'est cette quantification que la garde interdit.
    expect(billboardView({ kind: 'ortho', yawDeg: 0 }, 'E').view).toBe('front');
    expect(billboardView({ kind: 'ortho', yawDeg: 25 }, 'E').view).toBe('profile');
    expect(billboardView({ kind: 'ortho', yawDeg: 65 }, 'E').view).toBe('profile');
    for (const yawDeg of [12.5, 25, 47.3, 65, 200.4]) {
      const { view, mirror } = billboardView({ kind: 'ortho', yawDeg }, 'NE');
      expect(VIEWS, `${yawDeg}`).toContain(view);
      expect(typeof mirror).toBe('boolean');
    }
  });

  it('ortho : à un cheveu d’un cran, la VUE est celle du cran (le lacet libre tourne dans le MÊME sens)', () => {
    // Le `mirror` d'une orientation À LA FRONTIÈRE (delta écran à composante nulle) peut basculer d'un
    // côté à l'autre du cran : c'est la frontière elle-même, pas un sens de rotation. La VUE, elle, tient.
    for (const dir of DIR8_ORDER) {
      for (const rot of [0, 1, 2, 3] as Rot[]) {
        const attendu = project(dir, rot).view;
        expect(billboardView({ kind: 'ortho', yawDeg: rot * 90 + 1e-6 }, dir).view, `${dir}/${rot}+`).toBe(attendu);
        expect(billboardView({ kind: 'ortho', yawDeg: rot * 90 - 1e-6 }, dir).view, `${dir}/${rot}-`).toBe(attendu);
      }
    }
  });

  it('perspective : identique à povView (front/back/profil)', () => {
    const fwd = { x: 0, y: 1 }; // caméra regarde vers le sud
    const right = { x: -1, y: 0 };
    const cam = { kind: 'perspective', fwd, right } as const;
    // entité tournée vers le nord : elle nous fait face
    expect(billboardView(cam, 'N')).toEqual({ view: 'front', mirror: false });
    // entité tournée vers le sud : elle nous tourne le dos
    expect(billboardView(cam, 'S')).toEqual({ view: 'back', mirror: false });
    // entité de profil, latéral net
    expect(billboardView(cam, 'E').view).toBe('profile');
    expect(billboardView(cam, 'O').view).toBe('profile');
    expect(billboardView(cam, 'E').mirror).not.toBe(billboardView(cam, 'O').mirror);
    for (const dir of DIR8_ORDER) {
      expect(billboardView(cam, dir), dir).toEqual(povView(fwd, right, dir));
    }
  });

  it('perspective ≠ ortho : les deux familles ne partagent pas de résolveur', () => {
    // diagonale : seuil POV 1.2 vs seuil iso 1.5 ⇒ verdicts distincts sur au moins un cap
    const cam = { kind: 'perspective', fwd: { x: 0, y: 1 }, right: { x: -1, y: 0 } } as const;
    const diffs = DIR8_ORDER.filter((d) => JSON.stringify(billboardView(cam, d)) !== JSON.stringify(billboardView({ kind: 'ortho', yawDeg: 0 }, d)));
    expect(diffs.length).toBeGreaterThan(0);
  });
});

describe('ancrage — quad face caméra, pieds au sol', () => {
  it('aspect de la boîte de billboard = 120/150', () => {
    expect(BILLBOARD_BOX_ASPECT).toBeCloseTo(BB_W / BB_H, 10);
    expect(BILLBOARD_BOX_ASPECT).toBeCloseTo(0.8, 10);
  });

  it('largeur = hauteur × aspect, base sur l’ancre, centre à mi-hauteur', () => {
    const q = anchorAndSize(3.4375, BILLBOARD_BOX_ASPECT);
    expect(q.heightM).toBeCloseTo(3.4375, 6);
    expect(q.widthM).toBeCloseTo(3.4375 * 0.8, 6);
    expect(q.centerLiftM).toBeCloseTo(3.4375 / 2, 6);
    expect(q.corners[0]).toEqual([-q.widthM / 2, 0]);
    expect(q.corners[1]).toEqual([q.widthM / 2, 0]);
    expect(q.corners[2]).toEqual([q.widthM / 2, q.heightM]);
    expect(q.corners[3]).toEqual([-q.widthM / 2, q.heightM]);
  });

  it('aspect fourni par l’appelant (boîte de décor non carrée)', () => {
    const q = anchorAndSize(1.8, 100 / 180);
    expect(q.widthM).toBeCloseTo(1, 6);
  });

  it('hauteur ou aspect non positifs = erreur', () => {
    expect(() => anchorAndSize(0, 0.8)).toThrow();
    expect(() => anchorAndSize(1.8, 0)).toThrow();
    expect(() => anchorAndSize(-1, 0.8)).toThrow();
  });
});

describe('palier de rasterisation', () => {
  it('px/m iso = celui de pxPerM (worldTris) — une seule source, pas de copie locale', () => {
    expect(pxPerM(2)).toBeCloseTo((TW * Math.SQRT1_2) / 2, 10);
    expect(pxPerM(4)).toBeCloseTo(pxPerM(2) / 2, 10);
  });

  it('rasterise à la taille écran du zoom MAX', () => {
    const pxm = pxPerM(2); // ≈ 22.63
    expect(ZOOM_MAX).toBe(2.6);
    expect(rasterPxHeight(3.4375, pxm)).toBe(Math.ceil(3.4375 * pxm * 2.6));
    // un billboard plus grand → plus de pixels
    expect(rasterPxHeight(3.625, pxm)).toBeGreaterThan(rasterPxHeight(1.8, pxm));
  });

  it('bornes de texture', () => {
    expect(rasterPxHeight(0.001, 1)).toBe(RASTER_PX_MIN);
    expect(rasterPxHeight(1000, 100)).toBe(RASTER_PX_MAX);
  });
});

describe('clé de cache de texture', () => {
  it('une entrée par identité, vue, miroir, palier', () => {
    const k = billboardTextureKey('prop:banc', 'profile', true, 128);
    expect(k).not.toBe(billboardTextureKey('prop:banc', 'profile', false, 128));
    expect(k).not.toBe(billboardTextureKey('prop:banc', 'front', true, 128));
    expect(k).not.toBe(billboardTextureKey('prop:banc', 'profile', true, 256));
    expect(k).not.toBe(billboardTextureKey('prop:tonneau', 'profile', true, 128));
    expect(billboardTextureKey('prop:banc', 'profile', true, 128)).toBe(k);
  });
});
