import { describe, it, expect } from 'vitest';
import {
  billboardHeightM,
  billboardView,
  anchorAndSize,
  rasterPxHeight,
  billboardTextureKey,
  BILLBOARD_BOX_ASPECT,
  ZOOM_MAX,
  RASTER_PX_MIN,
  RASTER_PX_MAX,
  JEU_ENT_H_M,
  atlasLayout,
  frameUvRect,
  ATLAS_GUTTER_PX,
} from './billboardMath';
import { pxPerM } from './worldTris';
import { ISO_PX_PER_M } from '../../iso';
import { VIEWS, project, facingView } from '../../rig/facing';
import { povView } from '../../pov/camera';
import { ENT_H_M, PROP_H_M, BB_W, BB_H } from '../../pov/billboardCore';
import { DIR8_ORDER } from '../../../state/dir8';
import { TW, type Rot } from '../../../geometry/iso';

describe('taille monde — convention `jeu` du moteur + presets de comparaison de planche (#1160)', () => {
  it('héroïque = boîte iso 150 px × échelle de token ÷ 24 px/m', () => {
    expect(ISO_PX_PER_M).toBe(24); // LEVEL_H 96 px ⇔ METRES_PER_LEVEL 4 m
    // personnage : échelle rig 0.58 → 150×0.58 = 87 px → 3.625 m
    expect(billboardHeightM('heroique', 'personnage')).toBeCloseTo(3.625, 6);
    // prop : échelle 0.55 → 150×0.55 = 82.5 px → 3.4375 m
    expect(billboardHeightM('heroique', 'prop')).toBeCloseTo(3.4375, 6);
    // dérivation vérifiée depuis les constantes importées, pas depuis un nombre écrit à la main
    expect(billboardHeightM('heroique', 'prop')).toBeCloseTo((BB_H * 0.55) / ISO_PX_PER_M, 10);
  });

  it('métrique = constantes du POV (1,8 m debout / 1,7 m un prop)', () => {
    expect(billboardHeightM('metrique', 'personnage')).toBe(ENT_H_M);
    expect(billboardHeightM('metrique', 'personnage')).toBeCloseTo(1.8, 6);
    expect(billboardHeightM('metrique', 'prop')).toBe(PROP_H_M);
    expect(billboardHeightM('metrique', 'prop')).toBeCloseTo(1.7, 6);
  });

  it('jeu = convention CIBLE du moteur : 2,3 m debout, prop à la même échelle', () => {
    // valeurs littérales, indépendantes de la dérivation du module
    expect(billboardHeightM('jeu', 'personnage')).toBe(2.3);
    expect(billboardHeightM('jeu', 'personnage')).toBe(JEU_ENT_H_M);
    expect(billboardHeightM('jeu', 'prop')).toBeCloseTo(2.1722222, 6);
    expect(billboardHeightM('jeu', 'personnage')).toBeLessThan(billboardHeightM('heroique', 'personnage'));
    expect(billboardHeightM('jeu', 'personnage')).toBeGreaterThan(billboardHeightM('metrique', 'personnage'));
  });

  it('jeu/métrique = un SEUL facteur, partagé par toutes les familles', () => {
    const ratio = billboardHeightM('jeu', 'personnage') / billboardHeightM('metrique', 'personnage');
    expect(ratio).toBeCloseTo(1.2777778, 6);
    expect(billboardHeightM('jeu', 'prop') / billboardHeightM('metrique', 'prop')).toBeCloseTo(ratio, 12);
  });

  it('héroïque est ~2× la métrique — l’écart mesuré sur planche (#1160)', () => {
    expect(billboardHeightM('heroique', 'personnage') / billboardHeightM('metrique', 'personnage')).toBeGreaterThan(1.9);
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

  it('aspect fourni par l’appelant (boîte de rig, non carrée)', () => {
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
    const k = billboardTextureKey('rig:soldat', 'profile', true, 128);
    expect(k).not.toBe(billboardTextureKey('rig:soldat', 'profile', false, 128));
    expect(k).not.toBe(billboardTextureKey('rig:soldat', 'front', true, 128));
    expect(k).not.toBe(billboardTextureKey('rig:soldat', 'profile', true, 256));
    expect(k).not.toBe(billboardTextureKey('prop:tonneau', 'profile', true, 128));
    expect(billboardTextureKey('rig:soldat', 'profile', true, 128)).toBe(k);
  });
});

describe('atlas de flipbook — grille de frames et rectangles UV (#1176)', () => {
  it('grilles mesurées : la cellule dicte le nombre de colonnes/rangées sous le plafond de texture', () => {
    for (const [cw, ch, cols, rows] of [
      [219, 273, 9, 7],
      [295, 368, 6, 5],
      [111, 138, 18, 14],
    ] as const) {
      const l = atlasLayout(cw, ch, cols * rows);
      expect([l.cols, l.rows], `${cw}×${ch}`).toEqual([cols, rows]);
      expect(l.cellW).toBe(cw);
      expect(l.cellH).toBe(ch);
      expect(l.texW).toBeLessThanOrEqual(RASTER_PX_MAX);
      expect(l.texH).toBeLessThanOrEqual(RASTER_PX_MAX);
      expect(l.texW + cw).toBeGreaterThan(RASTER_PX_MAX); // une colonne de plus déborderait
      expect(l.texH + ch).toBeGreaterThan(RASTER_PX_MAX);
    }
  });

  it('n RÉDUIT quand les frames ne tiennent pas — jamais une texture hors borne', () => {
    const l = atlasLayout(219, 273, 500);
    expect(l.n).toBe(9 * 7);
    expect(l.rects).toHaveLength(l.n);
    expect(Math.max(l.texW, l.texH)).toBeLessThanOrEqual(RASTER_PX_MAX);
    // une cellule plus grande que le plafond ne peut PAS tenir la promesse de borne : refus explicite
    expect(() => atlasLayout(3000, 4000, 12)).toThrow();
    expect(() => atlasLayout(RASTER_PX_MAX + 1, 100, 2)).toThrow();
    expect(atlasLayout(RASTER_PX_MAX, 100, 2).texW).toBe(RASTER_PX_MAX); // la cellule EXACTEMENT au plafond passe
  });

  it('peu de frames : une seule rangée, la texture ne réserve que ce qui sert', () => {
    const l = atlasLayout(100, 200, 4);
    expect([l.cols, l.rows, l.n]).toEqual([4, 1, 4]);
    expect([l.texW, l.texH]).toEqual([400, 200]);
    const l2 = atlasLayout(1000, 200, 3); // 2 colonnes au plus (2048/1000)
    expect([l2.cols, l2.rows, l2.n]).toEqual([2, 2, 3]);
    expect(l2.rects[2]).toEqual({ x: ATLAS_GUTTER_PX, y: 200 + ATLAS_GUTTER_PX, w: 1000 - 2 * ATLAS_GUTTER_PX, h: 200 - 2 * ATLAS_GUTTER_PX });
  });

  it('chaque frame réserve sa GOUTTIÈRE : les contenus ne se touchent jamais', () => {
    const l = atlasLayout(100, 200, 6);
    for (const r of l.rects) {
      expect(r.w).toBe(100 - 2 * ATLAS_GUTTER_PX);
      expect(r.h).toBe(200 - 2 * ATLAS_GUTTER_PX);
      expect(r.x % 100).toBe(ATLAS_GUTTER_PX);
      expect(r.y % 200).toBe(ATLAS_GUTTER_PX);
    }
    expect(l.rects[1].x - (l.rects[0].x + l.rects[0].w)).toBe(2 * ATLAS_GUTTER_PX); // gouttière des DEUX voisins
  });

  it('UV : origine en BAS (convention three), inset d’un DEMI-TEXEL', () => {
    const l = atlasLayout(100, 200, 4); // 4×1
    const u0 = frameUvRect(l, 0);
    expect(u0.x).toBeCloseTo((ATLAS_GUTTER_PX + 0.5) / l.texW, 12);
    expect(u0.w).toBeCloseTo((100 - 2 * ATLAS_GUTTER_PX - 1) / l.texW, 12);
    // rangée du haut de l'image ⇒ les v les plus GRANDS ; le haut du contenu touche 1 − (2 + 0,5)/h
    expect(u0.y + u0.h).toBeCloseTo(1 - (ATLAS_GUTTER_PX + 0.5) / l.texH, 12);
    expect(u0.y).toBeCloseTo((ATLAS_GUTTER_PX + 0.5) / l.texH, 12); // symétrique en bas
    expect(u0.y).toBeGreaterThan(0);
    expect(u0.y + u0.h).toBeLessThan(1);
    // frame suivante : décalée d'une cellule entière en u, même v
    const u1 = frameUvRect(l, 1);
    expect(u1.x - u0.x).toBeCloseTo(l.cellW / l.texW, 12);
    expect(u1.y).toBeCloseTo(u0.y, 12);
    // rangée SUIVANTE = plus BAS dans l'image = v plus PETIT
    const deuxRangees = atlasLayout(1000, 200, 3);
    expect(frameUvRect(deuxRangees, 2).y).toBeLessThan(frameUvRect(deuxRangees, 0).y);
    expect(() => frameUvRect(l, 4)).toThrow();
  });

  it('cellule invalide (plus petite que ses deux gouttières) : refus explicite', () => {
    expect(() => atlasLayout(4, 100, 2)).toThrow();
    expect(() => atlasLayout(100, Number.NaN, 2)).toThrow();
  });
});
