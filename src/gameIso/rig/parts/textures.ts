/**
 * TEXTURES réutilisables du rig — motifs SVG PARAMÉTRIQUES dessinés en coordonnées
 * locales d'os. Partagés mutations ↔ créatures : le plumage d'une harpie, les écailles
 * d'un homme-lézard ou la crête d'une cocatrix se composent avec les mêmes briques.
 * Les couleurs acceptent les jetons de palette (@peau/@peauO/@peauH) → recolorisation
 * par espèce gratuite (ombres dérivées par buildTokenMap).
 */
import { gammeDe } from '../../../data/palette.types';

/** Une plume : pointe vers −y depuis (x,y) — limbe, rachis, barbes. `k` = échelle. */
export function plume(x: number, y: number, rot: number, fill = '#e8e0cc', k = 1): string {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${k})">`
    + '<path d="M0 1 Q-2.4 -3 -1.3 -8.5 Q0 -11 1.3 -8.5 Q2.4 -3 0 1 Z" fill="' + fill + '" stroke="#4a3a2a" stroke-width="0.45"/>'
    + '<path d="M0 0.4 L0 -9.6" stroke="#4a3a2a" stroke-width="0.4" opacity="0.8"/>'
    + '<path d="M-1.5 -3 L0 -4.4 M1.5 -3 L0 -4.4 M-1.6 -5.6 L0 -7 M1.6 -5.6 L0 -7" stroke="#4a3a2a" stroke-width="0.3" opacity="0.6"/>'
    + '</g>';
}

/** Éventail de plumes (crête, épaulette, panache de queue) centré en (cx,cy).
 *  `spread` = ouverture totale en degrés ; couleurs alternées crème/brun/roux par défaut. */
export function plumeFan(
  cx: number,
  cy: number,
  o: { n?: number; spread?: number; k?: number; baseRot?: number; colors?: string[] } = {},
): string {
  const n = o.n ?? 3;
  const spread = o.spread ?? 56;
  const k = o.k ?? 1;
  const baseRot = o.baseRot ?? 0;
  const colors = o.colors ?? ['#e8e0cc', '#8a6a48', '#a8743e'];
  let out = '';
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5; // −0.5..0.5
    out += plume(
      cx + t * 3.2 * k,
      cy + Math.abs(t) * 1.4 * k, // les plumes latérales partent un peu plus bas (éventail)
      baseRot + t * spread,
      colors[i % colors.length],
      k * (1 - Math.abs(t) * 0.25), // centre dominant
    );
  }
  return out;
}

/** Chemin (attribut `d`) de rangées d'écailles imbriquées en quinconce, couvrant
 *  [x0..x1]×[y0..y1]. À poser en `stroke` (les arcs dessinent le bord de chaque écaille). */
export function scalesPath(x0: number, x1: number, y0: number, y1: number, step = 3): string {
  let d = '';
  let row = 0;
  for (let y = y0; y <= y1; y += step * 0.7, row++) {
    for (let x = x0 + (row % 2 ? step / 2 : 0); x + step <= x1 + 0.01; x += step) {
      d += `M${+x.toFixed(2)} ${+y.toFixed(2)} q${+(step / 2).toFixed(2)} ${+(step * 0.66).toFixed(2)} ${step} 0 `;
    }
  }
  return d;
}

/** Patch d'écailles prêt à poser : bords ombrés + reflet décalé (relief). `base` = base de
 *  gamme (`peau` pour le rig bipède, `corps` pour les gabarits de créature). */
export function scalesPatch(x0: number, x1: number, y0: number, y1: number, step = 3, base = 'peau'): string {
  return `<path d="${scalesPath(x0, x1, y0, y1, step)}" stroke="@${gammeDe(base, 'ombre')}" stroke-width="${(step * 0.16).toFixed(2)}" fill="none" opacity="0.85"/>`
    + `<path d="${scalesPath(x0, x1, y0 + step * 0.18, y1, step)}" stroke="@${gammeDe(base, 'lumiere')}" stroke-width="${(step * 0.1).toFixed(2)}" fill="none" opacity="0.4"/>`;
}

/** Chemin de touffes de FOURRURE en quinconce (petits traits incurvés vers le bas). */
export function furPath(x0: number, x1: number, y0: number, y1: number, step = 3): string {
  let d = '';
  let row = 0;
  for (let y = y0; y <= y1; y += step * 0.9, row++) {
    for (let x = x0 + (row % 2 ? step / 2 : 0); x <= x1 + 0.01; x += step) {
      d += `M${+x.toFixed(2)} ${+y.toFixed(2)} q${(step * 0.18).toFixed(2)} ${(step * 0.5).toFixed(2)} ${(-step * 0.12).toFixed(2)} ${(step * 0.95).toFixed(2)} `;
    }
  }
  return d;
}

/** Patch de pelage prêt à poser : touffes ombrées + reflets épars. `base` = base de gamme. */
export function furPatch(x0: number, x1: number, y0: number, y1: number, step = 3, base = 'peau'): string {
  return `<path d="${furPath(x0, x1, y0, y1, step)}" stroke="@${gammeDe(base, 'ombre')}" stroke-width="${(step * 0.14).toFixed(2)}" fill="none" opacity="0.7" stroke-linecap="round"/>`
    + `<path d="${furPath(x0 + step * 0.3, x1, y0 + step * 0.45, y1, step * 2)}" stroke="@${gammeDe(base, 'lumiere')}" stroke-width="${(step * 0.1).toFixed(2)}" fill="none" opacity="0.45" stroke-linecap="round"/>`;
}
