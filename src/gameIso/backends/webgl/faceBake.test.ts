import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  bakeResolution,
  clearFaceBakes,
  faceBakeData,
  faceBakeKey,
  getFaceBake,
  needsFaceBake,
  BEAM_MIN_PX,
  FACE_PX_PER_M,
} from './faceBake';
import { teinteRatio } from './periodTexture';
import { timberOverlaySvg } from '../../authoring/detailSvg';
import { TIMBER_V0, TIMBER_V1, expandRecipe } from '../../detail/expand';
import { ISO_PX_PER_M } from '../../iso';
import { structureAppearances } from '../../../data';
import { parseHex, srgbToLinear } from '../../shade';
import type { DetailRecipe } from '../../detail/types';

/** La def d'apparence à COLOMBAGE de la donnée — la cuisson tire d'elle sa couleur de bois. */
const BOIS = structureAppearances.find((d) => d.id === 'mur-en-bois')!;
const RECETTE = BOIS.detail as DetailRecipe;
/** Def à APPAREILLAGE de blocs (`blockWM`) : le bois est à rangs CONTINUS, ses accents n'ont aucune
 *  borne de joint vertical — c'est la pierre qui prouve l'alignement sur le motif partagé. */
const PIERRE = structureAppearances.find((d) => d.id === 'mur-en-pierre')!;
const RECETTE_PIERRE = PIERRE.detail as DetailRecipe;

const W_M = 4;
const H_M = 2.5;
/** La SEULE part de mur que le colombage habille (cf. `TIMBERED_PARTS`) — toute cuisson en porte une. */
const FACE = 'face' as const;

/** Facteur multiplicatif RVB rendu par un pixel du masque (la valeur 255 vaut `gain`). */
const facteurs = (b: { data: Uint8Array; w: number; gain: number }, x: number, y: number): [number, number, number] => {
  const i = (y * b.w + x) * 4;
  return [0, 1, 2].map((c) => (b.data[i + c] / 255) * b.gain) as [number, number, number];
};

/** Inverse de `srgbToLinear` (valeur linéaire → sRGB 0–1). */
const linearToSrgb = (v: number): number => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

/** Luminance moyenne d'une colonne de pixels du masque, sur la bande de lignes `[y0, y1[`. */
function colonne(b: { data: Uint8Array; w: number; h: number }, x: number, y0 = 0, y1 = b.h): number {
  let s = 0;
  for (let y = y0; y < y1; y++) {
    const i = (y * b.w + x) * 4;
    s += (b.data[i] + b.data[i + 1] + b.data[i + 2]) / 3;
  }
  return s / (y1 - y0);
}

describe('faceBake — cuisson par face (canal DÉTERMINISTE seul)', () => {
  it('la donnée porte bien les canaux mesurés (sinon les tests suivants ne prouvent rien)', () => {
    expect(RECETTE.timber).toBeTruthy();
    expect(RECETTE_PIERRE.courses?.blockWM).toBeTruthy();
    expect(RECETTE_PIERRE.courses?.paletteVar).toBeGreaterThan(0);
  });

  it('le colombage cuit dépose des poteaux aux u de l’expansion (0, 0,5, 1 pour 4 m à 2 m de travée)', () => {
    const b = faceBakeData({ color: BOIS.face, recipe: { timber: RECETTE.timber, seedScope: RECETTE.seedScope }, part: FACE }, W_M, H_M)!;
    expect(b).toBeTruthy();
    // Poteaux attendus aux fractions 0, 0,5 et 1 de la largeur : colonnes 0, w/2 et w−1. La mesure porte
    // sur la BANDE de l'ossature (entre les marges canoniques), pas sur toute la hauteur de face.
    const bande: [number, number] = [Math.round(TIMBER_V0 * b.h) + 4, Math.round(TIMBER_V1 * b.h) - 4];
    const milieu = b.w / 2;
    const colonnes = Array.from({ length: b.w }, (_, x) => colonne(b, x, ...bande));
    // Entre les deux poteaux de BORD (u = 0 et u = 1), la colonne la plus sombre est le poteau MÉDIAN.
    let argmin = Math.round(b.w * 0.25);
    for (let x = Math.round(b.w * 0.25); x <= Math.round(b.w * 0.75); x++) if (colonnes[x] < colonnes[argmin]) argmin = x;
    expect(Math.abs(argmin - milieu)).toBeLessThanOrEqual(2);
    // Un poteau est une colonne PLEINE : elle est très en dessous d'une colonne de travée (u = 0,25).
    expect(colonnes[milieu]).toBeLessThan(0.6 * colonnes[Math.round(b.w * 0.25)]);
    // Les deux bords portent aussi leur poteau (demi-largeur visible).
    expect(colonnes[0]).toBeLessThan(0.7 * colonnes[Math.round(b.w * 0.25)]);
  });

  it('les pans de bois s’arrêtent aux marges CANONIQUES du backend affine (couronnement, plinthe)', () => {
    const b = faceBakeData({ color: BOIS.face, recipe: { timber: RECETTE.timber, seedScope: RECETTE.seedScope }, part: FACE }, W_M, H_M)!;
    const x = b.w / 2; // cœur du poteau médian
    const lum = (y: number) => facteurs(b, x, y)[0];
    // Le couronnement (au-dessus de `TIMBER_V0`) et la plinthe (sous `TIMBER_V1`) restent NUS — cette
    // recette réduite n'a aucune assise, le masque y vaut donc exactement 1.
    expect(lum(2)).toBeCloseTo(1, 3);
    expect(lum(b.h - 3)).toBeCloseTo(1, 3);
    expect(Math.round(TIMBER_V0 * b.h)).toBeGreaterThan(8); // la marge haute est bien mesurable ici
    expect(b.h - Math.round(TIMBER_V1 * b.h)).toBeGreaterThan(8);
    // ENTRE les deux : le bois.
    expect(lum(Math.round(TIMBER_V0 * b.h) + 4)).toBeLessThan(0.9);
    expect(lum(Math.round(TIMBER_V1 * b.h) - 4)).toBeLessThan(0.9);
  });

  it('la couleur du bois vient de la DONNÉE (rapport par canal, aucun hex dans le module)', () => {
    const b = faceBakeData({ color: BOIS.face, recipe: { timber: RECETTE.timber, seedScope: RECETTE.seedScope }, part: FACE }, W_M, H_M)!;
    const attendu = teinteRatio(RECETTE.timber!.color, BOIS.face)!;
    // Pixel au CŒUR du poteau médian : le masque y vaut exactement le rapport bois ÷ face.
    const mesuré = facteurs(b, b.w / 2, Math.round(b.h * 0.5));
    for (let c = 0; c < 3; c++) expect(Math.abs(mesuré[c] - attendu[c])).toBeLessThan(0.02);
    // Ce que le GPU RENDRA : le masque multiplie un albédo LINÉARISÉ, la sortie repasse en sRGB. Le
    // pixel de poutre doit donc valoir, à l'octet près, la couleur de la donnée — un rapport pris sur
    // les octets sRGB rendait rgb(82,64,44) au lieu de rgb(59,46,31).
    const rendu = parseHex(BOIS.face)!.map((v, c) => Math.round(255 * linearToSrgb(srgbToLinear(v) * mesuré[c])));
    expect(rendu).toEqual(parseHex(RECETTE.timber!.color)!);
    const src = readFileSync(new URL('./faceBake.ts', import.meta.url), 'utf8');
    expect(src.match(/#[0-9a-fA-F]{6}\b/g)).toBeNull();
  });

  it('les accents SEEDÉS d’un mur ne sont PAS cuits : seul le colombage exige une cuisson par face', () => {
    const lisse: DetailRecipe = { seedScope: 'edge', courses: { hM: 0.35, joint: '#000000', jointW: 0.02, blockWM: [0.5, 0.8] } };
    expect(needsFaceBake(lisse, 'wall', FACE)).toBe(false);
    // Blocs nuancés et mouchetis : ils restent au chemin de PÉRIODE (canal dédié spécifié #1198).
    expect(needsFaceBake({ ...lisse, courses: { ...lisse.courses!, paletteVar: 0.08 } }, 'wall', FACE)).toBe(false);
    expect(needsFaceBake({ ...lisse, speckle: { colors: ['#111111'], perM2: 4, rM: [0.02, 0.05] } }, 'wall', FACE)).toBe(false);
    // Le COLOMBAGE, lui, exige la cuisson — et jamais sur un SOL.
    expect(needsFaceBake(RECETTE, 'wall', FACE)).toBe(true);
    expect(needsFaceBake(RECETTE, 'ground', FACE)).toBe(false);
    expect(faceBakeData({ color: BOIS.face, recipe: lisse, part: FACE }, W_M, H_M)).toBeNull();
    expect(faceBakeData({ color: BOIS.face, part: FACE }, W_M, H_M)).toBeNull();
  });

  it('SEULE la part `face` se colombe — le jeu EXACT que le backend affine habille', () => {
    // Les parts décoratives d'un mur à pans de bois : le SVG n'y pose aucune poutre (`authoring/wallsSvg.ts`
    // cherche `part === 'face'`, `authoring/wallsSvg.ts` écarte tout le reste avant le colombage de la l.251).
    for (const part of ['poteau', 'panneau', 'moulure', 'plinthe', 'couronnement', 'vitre', 'meneau', 'vantail', 'jambage', 'chambranle', 'parapet', 'merlon', 'arase', 'bande'])
      expect([part, needsFaceBake(RECETTE, 'wall', part)]).toEqual([part, false]);
    expect(needsFaceBake(RECETTE, 'wall', undefined)).toBe(false);
    expect(needsFaceBake(RECETTE, 'wall', FACE)).toBe(true);
    // …et la cuisson elle-même s'en abstient, pas seulement le prédicat.
    expect(faceBakeData({ color: BOIS.face, recipe: RECETTE, part: 'vitre' }, W_M, H_M)).toBeNull();
  });

  it('un masque entièrement NEUTRE ne se cuit pas : une image invisible coûte un dessin pour rien', () => {
    // Couleur de poutre NON hex (couleur CSS nommée d'une def) : `teinteRatio` s'abstient, rien n'est
    // déposé ; sans assises pour porter un fond, le masque resterait plein à 255 partout.
    const muet: DetailRecipe = { seedScope: 'edge', timber: { postEveryM: 2, braces: 'X', wM: 0.08, color: 'sienna' } };
    expect(needsFaceBake(muet, 'wall', FACE)).toBe(true);
    expect(faceBakeData({ color: BOIS.face, recipe: muet, part: FACE }, W_M, H_M)).toBeNull();
    // La même recette avec une couleur LISIBLE cuit, elle, une image.
    const parlant: DetailRecipe = { ...muet, timber: { ...muet.timber!, color: RECETTE.timber!.color } };
    expect(faceBakeData({ color: BOIS.face, recipe: parlant, part: FACE }, W_M, H_M)).toBeTruthy();
  });

  it('la LARGEUR de poutre cuite est celle de la source affine, en mètres (aucune épaisseur inventée)', () => {
    // L'affine stroké sa poutre à `e.timber.wM × ISO_PX_PER_M` px d'écran (`timberOverlaySvg`). La cuisson
    // part de la MÊME expansion : on relit la largeur au SVG, on la ramène en mètres, et on la retrouve
    // dans le masque — largeur à mi-couverture d'une colonne de poteau.
    const quad: [number, number][] = [[0, 0], [200, 0], [200, 120], [0, 120]];
    const svg = timberOverlaySvg({ recipe: RECETTE, quad, faceWM: W_M, faceHM: H_M, dims: { view: 'iso', rot: 0, cols: 10, rows: 10, zoom: 1 } as never });
    const strokePx = Number(/stroke-width="([\d.]+)"/.exec(svg)![1]);
    const wM = expandRecipe({ timber: RECETTE.timber, seedScope: RECETTE.seedScope }, W_M, H_M, 0).timber!.wM;
    expect(strokePx / ISO_PX_PER_M).toBeCloseTo(wM, 6);
    const b = faceBakeData({ color: BOIS.face, recipe: { timber: RECETTE.timber, seedScope: RECETTE.seedScope }, part: FACE }, W_M, H_M)!;
    const y = Math.round(b.h * 0.5);
    const seuil = 1 - (1 - teinteRatio(RECETTE.timber!.color, BOIS.face)![0]) / 2; // mi-couverture
    let encrées = 0;
    for (let x = 0; x < b.w; x++) if (facteurs(b, x, y)[0] <= seuil) encrées++;
    // 3 poteaux (dont deux DEMI-poteaux aux bords) + 2 écharpes obliques traversant cette ligne :
    // 2 largeurs pleines de poteau + 2 tranches d'écharpe ≈ 4 largeurs à mi-couverture près.
    const pxParM = (b.w / W_M + b.h / H_M) / 2;
    expect(encrées / (wM * pxParM)).toBeGreaterThan(3);
    expect(encrées / (wM * pxParM)).toBeLessThan(6);
  });

  it('le fond de PÉRIODE est cuit dans la face (les joints survivent à la sortie du groupe)', () => {
    const avecJoints = faceBakeData({ color: BOIS.face, recipe: RECETTE, part: FACE }, W_M, H_M)!;
    const sansAssises = faceBakeData(
      { color: BOIS.face, recipe: { seedScope: RECETTE.seedScope, timber: RECETTE.timber }, part: FACE },
      W_M,
      H_M,
    )!;
    // Nombre de BANDES sombres traversées par une colonne de travée (hors poteau) : un rang d'assises
    // tous les `hM` = 0,3 m, soit ~8 lignes de joint sur 2,5 m de face ; la seule ossature n'y coupe
    // que ses deux écharpes.
    const bandes = (b: { data: Uint8Array; w: number; h: number }) => {
      const x = Math.round(b.w * 0.25);
      let n = 0;
      let dedans = false;
      for (let y = 0; y < b.h; y++) {
        const sombre = b.data[(y * b.w + x) * 4] < 235;
        if (sombre && !dedans) n++;
        dedans = sombre;
      }
      return n;
    };
    expect(bandes(sansAssises)).toBeLessThanOrEqual(3);
    expect(bandes(avecJoints)).toBeGreaterThanOrEqual(6);
  });

  it('le masque est borné et son gain reporte tout dépassement', () => {
    const b = faceBakeData({ color: BOIS.face, recipe: RECETTE, part: FACE }, W_M, H_M)!;
    expect(b.gain).toBeGreaterThanOrEqual(1);
    expect(b.data.length).toBe(b.w * b.h * 4);
    expect([b.w, b.h]).toEqual([2 ** Math.round(Math.log2(W_M * FACE_PX_PER_M)), 2 ** Math.round(Math.log2(H_M * FACE_PX_PER_M))]);
    for (let i = 0; i < b.w * b.h; i++) expect(b.data[i * 4 + 3]).toBe(255);
  });
});

describe('faceBake — résolution ADAPTATIVE ciblée sur la poutre', () => {
  const POUTRE_M = RECETTE.timber!.wM;
  /** Gabarits de façade (m) dont la poutre PEUT tenir 3 px sous le plafond dur : du petit (que le
   *  plafond ordinaire n'affame pas) au grand (qui exige le relèvement) — dont deux gabarits MESURÉS
   *  dans les scènes-témoins (20 × 5,77 m de l'arène, 20 × 9 m de la vitrine). */
  const GABARITS: [number, number][] = [[2, 2.5], [4, 2.5], [6, 4], [8, 6], [10, 8], [12, 12], [14, 10], [20, 5.77], [20, 9]];
  /** Largeur de masque (px) que la poutre occupe réellement à la résolution rendue. */
  const poutrePx = (wM: number, hM: number) => POUTRE_M * bakeResolution(RECETTE, wM, hM).pxPerM;

  it('la donnée porte bien une poutre FINE (sinon le seuil ne se mesure sur rien)', () => {
    expect(POUTRE_M).toBeGreaterThan(0);
    expect(POUTRE_M).toBeLessThan(0.2);
    expect(BEAM_MIN_PX).toBe(3);
  });

  it('la poutre tient 3 px de masque sur TOUS les gabarits où le plafond dur le permet', () => {
    for (const [wM, hM] of GABARITS) {
      const px = poutrePx(wM, hM);
      expect([`${wM}×${hM}`, px >= 3, Number(px.toFixed(2))]).toEqual([`${wM}×${hM}`, true, Number(px.toFixed(2))]);
    }
    // Le balayage contient bien des grandes façades qui EXIGENT le relèvement (sinon il ne prouve rien) —
    // et des petites qui n'y touchent pas.
    const relevés = GABARITS.filter(([w, h]) => { const r = bakeResolution(RECETTE, w, h); return r.w > 256 || r.h > 256; });
    expect(relevés.length).toBeGreaterThanOrEqual(3);
    expect(relevés.length).toBeLessThan(GABARITS.length);
  });

  it('les petites façades gardent EXACTEMENT leur résolution (seules les grandes paient)', () => {
    // 4 × 2,5 m : le plafond ordinaire ne borde ni un côté ni l'autre, la dérivation rend les mêmes
    // côtés qu'un arrondi direct à la résolution de référence.
    const petite = bakeResolution(RECETTE, W_M, H_M);
    expect([petite.w, petite.h]).toEqual([2 ** Math.round(Math.log2(W_M * FACE_PX_PER_M)), 2 ** Math.round(Math.log2(H_M * FACE_PX_PER_M))]);
    expect([bakeResolution(RECETTE, 6, 4).w, bakeResolution(RECETTE, 6, 4).h]).toEqual([256, 256]);
    // Une recette SANS colombage ne relève jamais rien : le seuil ne vise QUE la poutre.
    const sansBois: DetailRecipe = { seedScope: RECETTE.seedScope, courses: RECETTE.courses };
    expect([bakeResolution(sansBois, 12, 12).w, bakeResolution(sansBois, 12, 12).h]).toEqual([256, 256]);
  });

  it('le plafond DUR de 512 px borne le côté cuit, même quand la poutre y reste sous le seuil', () => {
    for (const [wM, hM] of [...GABARITS, [16, 12], [30, 24], [60, 60]] as [number, number][]) {
      const r = bakeResolution(RECETTE, wM, hM);
      expect([`${wM}×${hM}`, r.w <= 512 && r.h <= 512]).toEqual([`${wM}×${hM}`, true]);
      expect([`${wM}×${hM}`, Math.log2(r.w) % 1, Math.log2(r.h) % 1]).toEqual([`${wM}×${hM}`, 0, 0]);
    }
    // Une façade que même 512 px n'affranchit pas sature les DEUX côtés : rien de plus à donner.
    expect([bakeResolution(RECETTE, 30, 24).w, bakeResolution(RECETTE, 30, 24).h]).toEqual([512, 512]);
  });

  it('une longue façade BASSE : relever le seul plafond ne la nourrit pas, la résolution monte', () => {
    // 20 × 5,77 m (mesuré dans l'arène) : la LARGEUR sature le plafond dur, mais la hauteur retombe à
    // 256 px à l'arrondi de la résolution de référence — la poutre reste alors sous le seuil.
    const côtéRéférence = (m: number) => 2 ** Math.round(Math.log2(Math.min(m * FACE_PX_PER_M, 512)));
    expect([côtéRéférence(20), côtéRéférence(5.77)]).toEqual([512, 256]);
    const r = bakeResolution(RECETTE, 20, 5.77);
    expect([r.w, r.h]).toEqual([512, 512]); // la hauteur DÉPASSE ce que la résolution de référence rendait
    expect(POUTRE_M * r.pxPerM).toBeGreaterThanOrEqual(3);
  });

  it('la cuisson RÉELLE suit la dérivation (la fonction pure n’est pas une doublure)', () => {
    const r = bakeResolution(RECETTE, 12, 12);
    expect(r.w).toBeGreaterThan(256); // ce gabarit-là est bien un cas RELEVÉ
    const b = faceBakeData({ color: BOIS.face, recipe: RECETTE, part: FACE }, 12, 12)!;
    expect([b.w, b.h]).toEqual([r.w, r.h]);
    const petit = faceBakeData({ color: BOIS.face, recipe: RECETTE, part: FACE }, W_M, H_M)!;
    expect([petit.w, petit.h]).toEqual([bakeResolution(RECETTE, W_M, H_M).w, bakeResolution(RECETTE, W_M, H_M).h]);
  });
});

describe('faceBake — UNE clé déterministe par gabarit, UNE image par clé', () => {
  const surface = { color: BOIS.face, recipe: RECETTE, part: FACE };
  beforeEach(() => clearFaceBakes());

  it('la clé ne dépend QUE de (surface, gabarit au cm, variante) — deux façades jumelles, UNE clé', () => {
    // Deux façades DISTINCTES du monde, de même surface et de même gabarit : leurs clés sont égales, et
    // c'est à cette égalité que `surfaceGrouping` les réunit en UN groupe (donc UNE cuisson).
    const k1 = faceBakeKey('mur~bois', 4, 2.5, 1);
    const k2 = faceBakeKey('mur~bois', 4.001, 2.499, 1);
    expect(k2).toBe(k1);
    const a = getFaceBake(k1, surface, 4, 2.5, 1);
    const b = getFaceBake(k2, surface, 4, 2.5, 1);
    expect(a).toBeTruthy();
    expect(b).toBe(a); // MÊME objet : une clé redemandée ne recuit rien
    // …et l'image est bien fonction du seul gabarit : deux cuissons directes sont bit-à-bit identiques.
    const i1 = faceBakeData(surface, 4, 2.5)!;
    const i2 = faceBakeData(surface, 4, 2.5)!;
    expect(Buffer.from(i1.data).equals(Buffer.from(i2.data))).toBe(true);
  });

  it('un gabarit ou une variante différents ne se partagent PAS (et l’image change)', () => {
    const k = faceBakeKey('mur~bois', 4, 2.5, 1);
    expect(faceBakeKey('mur~bois', 3, 2.5, 1)).not.toBe(k);
    expect(faceBakeKey('mur~bois', 4, 2.5, 2)).not.toBe(k);
    expect(faceBakeKey('mur~pierre', 4, 2.5, 1)).not.toBe(k);
    const un = getFaceBake(k, surface, 4, 2.5, 1);
    const autre = getFaceBake(faceBakeKey('mur~bois', 3, 2.5, 1), surface, 3, 2.5, 1);
    // Deux gabarits, deux images DISTINCTES : la clé ne déduplique que ce qui est identique.
    // Les deux cuissons doivent EXISTER — `not.toBe` passerait trivialement sur un `null`.
    expect(un).toBeTruthy();
    expect(autre).toBeTruthy();
    expect(autre).not.toBe(getFaceBake(k, surface, 4, 2.5, 1));
  });

  it('la texture s’échantillonne sur l’UV de FACE (`uv1`) et ne se répète pas', async () => {
    const THREE = await import('three');
    const t = getFaceBake(faceBakeKey('mur~bois', 4, 2.5, 0), surface, 4, 2.5, 0)!.texture;
    expect(t.channel).toBe(1);
    expect([t.wrapS, t.wrapT]).toEqual([THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping]);
  });
});
