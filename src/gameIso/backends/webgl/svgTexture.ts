/**
 * Couture NAVIGATEUR de rasterisation : une chaîne SVG (l'art du décor, source de vérité : `propSvg(...)`)
 * devient une texture de billboard. ZÉRO logique : les décisions (taille monde, vue, palier de
 * rasterisation) vivent dans `billboardMath.ts` (pur, testé). Ce module dépend du DOM (`Blob`,
 * `Image`, `<canvas>`) et de three : la RASTERISATION se juge à l'écran ; seule la politique
 * de CACHE (pure, injectable) est testée unitairement (`svgTexture.test.ts`).
 *
 * Les chaînes attendues sont des FRAGMENTS SVG en boîte locale (120×150 pour les props) : ce module les enveloppe dans un `<svg viewBox>` à la boîte fournie.
 */
import * as THREE from 'three';
import { CacheBorne } from './cacheBorne';

/** Boîte locale du fragment SVG source (unités d'auteur). */
interface SvgBox {
  w: number;
  h: number;
}

export interface RasterizedSvg {
  canvas: HTMLCanvasElement;
  /** Aspect l/h de la boîte source — à passer tel quel à `anchorAndSize`. */
  aspect: number;
}

function wrap(markup: string, box: SvgBox, pxHeight: number, pxWidth: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box.w} ${box.h}" width="${pxWidth}" height="${pxHeight}">${markup}</svg>`;
}

/** Largeur (px) de la rasterisation d'une boîte à `pxHeight` — SEULE formule : la rasterisation la
 *  suit, et l'ESTIMATION de poids (`octetsTextureStatique`) doit la suivre à l'octet près. PURE. */
export function rasterPxWidth(box: SvgBox, pxHeight: number): number {
  return Math.max(1, Math.round(pxHeight * (box.w / box.h)));
}

/**
 * Poids GPU d'une texture statique cuite à `pxHeight` : 4 octets par texel, sans mipmaps. C'est ce
 * que le stock borné compte AVANT que le canevas n'existe (`bytesEst`). PUR.
 *
 * NE LÈVE JAMAIS et ne rend jamais l'infini : une boîte dégénérée (hauteur nulle) pèse ZÉRO — un
 * poids infini au budget évincerait tout le stock à la première pression, là où l'appelant n'attend
 * qu'une écriture de comptabilité. Le défaut se voit à la RASTERISATION, comme avant.
 */
export function octetsTextureStatique(box: SvgBox, pxHeight: number): number {
  const bytes = rasterPxWidth(box, pxHeight) * Math.max(1, Math.round(pxHeight)) * 4;
  return Number.isFinite(bytes) ? bytes : 0;
}

/** Rasterise un fragment SVG à `pxHeight` pixels de haut (largeur déduite de l'aspect de la boîte). */
export function rasterizeSvg(svg: string, box: SvgBox, pxHeight: number): Promise<RasterizedSvg> {
  const aspect = box.w / box.h;
  const pxWidth = rasterPxWidth(box, pxHeight);
  const blob = new Blob([wrap(svg, box, pxHeight, pxWidth)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  return new Promise<RasterizedSvg>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = pxWidth;
      canvas.height = pxHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('rasterizeSvg: contexte 2D indisponible'));
        return;
      }
      ctx.drawImage(img, 0, 0, pxWidth, pxHeight);
      URL.revokeObjectURL(url);
      resolve({ canvas, aspect });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('rasterizeSvg: SVG illisible par le navigateur'));
    };
    img.src = url;
  });
}

/** Texture de billboard : rasterisation + filtrage linéaire sans mipmaps, espace colorimétrique sRGB. */
export async function svgToTexture(svg: string, box: SvgBox, pxHeight: number): Promise<THREE.CanvasTexture> {
  const { canvas } = await rasterizeSvg(svg, box, pxHeight);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * BUDGET du stock de textures statiques (#1374).
 *
 * Mesure du palier réel (`stage/boardPose.atlasPxHeight`, scène mpt=2, DPR 2) : un décor de taille
 * canonique cuit en 205×256 px, soit 209 920 octets (4 octets par texel, sans mipmaps) ; un décor à
 * `scaleK` 2 monte à 410×512 px, 839 680 octets. Population d'une scène-hub en vue de plateau :
 * ~68 décors × 4 crans d'art = 272 textures, soit ≈ 54,5 Mo au palier canonique (les caps voisins de
 * la première personne en retiennent 3 par décor, moins). 64 Mo tiennent donc la scène-hub COMPLÈTE
 * avec ~20 % de marge pour les décors surdimensionnés, là où le stock non borné n'avait pas de fin.
 */
export const TEXTURE_STATIQUE_BUDGET_BYTES_DEFAUT = 64 * 1024 * 1024;

/** Poids GPU d'une texture de billboard : 4 octets par texel de son canevas (RGBA, sans mipmaps). */
const textureBytes = (t: THREE.CanvasTexture): number => {
  const img = t.image as { width?: number; height?: number } | undefined;
  return (img?.width ?? 0) * (img?.height ?? 0) * 4;
};

/** Le stock de textures statiques — une entrée par clé appelante (`billboardTextureKey` : identité,
 *  vue, miroir, palier), BORNÉ au budget d'octets (`cacheBorne`). */
const CACHE = new CacheBorne<THREE.CanvasTexture>({
  budget: TEXTURE_STATIQUE_BUDGET_BYTES_DEFAUT,
  bytesDe: textureBytes,
  disposer: (t) => t.dispose(),
});

/** Change le budget (réglage de mesure/garde) — rend l'ancien. */
export function setStaticTextureBudgetBytes(n: number): number {
  return CACHE.définirBudget(n);
}

/** Clés ÉPINGLÉES (textures POSÉES sur les quads montés au regard courant) : jamais évincées, quel
 *  que soit leur âge — évincer ce qui est à l'écran le laisserait sans art jusqu'à la recuisson. */
export function setStaticTexturePins(keys: Iterable<string>): void {
  CACHE.épingler(keys);
}

/** Les clés ÉPINGLÉES du stock statique, en lecture seule (garde de mesure). */
export function staticTexturePins(): ReadonlySet<string> {
  return CACHE.épingles();
}

/** Compteur de debug du stock statique (entrées, octets). */
export function staticTextureStats(): { entries: number; bytes: number } {
  return CACHE.stats();
}

/** Texture mémoïsée d'une clé. Un ÉCHEC n'est PAS mémoïsé : une promesse rejetée laissée en cache
 *  condamnerait le sujet pour toute la session (un SVG illisible une fois ne l'est pas toujours — page
 *  rechargée, ressource tardive). L'entrée est évincée au rejet, l'appel suivant re-tente. Une clé
 *  ÉVINCÉE par le budget se recuit de la même façon : `make` est rappelé au manque.
 *
 *  `bytesEst` (`octetsTextureStatique`) est ce que l'entrée pèse au budget TANT QUE sa rasterisation
 *  court : sans elle, une rafale de demandes ne pèse rien et le stock gonfle jusqu'à leur service. */
export function getBillboardTexture(
  key: string,
  make: () => Promise<THREE.CanvasTexture>,
  bytesEst?: number,
): Promise<THREE.CanvasTexture> {
  return CACHE.obtenir(key, make, bytesEst === undefined ? undefined : { bytesEst });
}

/** Vide le cache et libère les textures GPU (changement de scène / rechargement). */
export function clearBillboardTextures(): void {
  CACHE.vider();
}
