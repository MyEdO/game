import type { CadreDef } from './types';

const COTE = 128;
/** La profondeur de la vignette des bords de la page. */
const VIGNETTE = 28;
/** La largeur de l'ombre de la reliure sur la page, vers le pli. */
const PLI = 46;

/**
 * Une page d'un registre ouvert (#3935), sur sa matière de parchemin : ses bords vignettés vers le dedans, et l'ombre
 * de la reliure qui s'épaissit vers le pli, du côté `pli`. Son centre est vide.
 */
export const page = (id: string, label: string, pli: 'gauche' | 'droite'): CadreDef => {
  const versLePli = pli === 'droite';
  const bord = (suffixe: string, x1: number, y1: number, x2: number, y2: number, x: number, y: number, l: number, h: number) =>
    `<linearGradient id="${id}-${suffixe}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="var(--vignette-de-page)" stop-opacity="0.4"/><stop offset="1" stop-color="var(--vignette-de-page)" stop-opacity="0"/></linearGradient>` +
    `<rect x="${x}" y="${y}" width="${l}" height="${h}" fill="url(#${id}-${suffixe})"/>`;
  return {
    id,
    label,
    tranches: versLePli ? [VIGNETTE, VIGNETTE, PLI, VIGNETTE] : [PLI, VIGNETTE, VIGNETTE, VIGNETTE],
    svg:
      bord('haut', 0, 0, 0, 1, 0, 0, COTE, VIGNETTE) +
      bord('bas', 0, 1, 0, 0, 0, COTE - VIGNETTE, COTE, VIGNETTE) +
      bord('gauche', 0, 0, 1, 0, 0, 0, VIGNETTE, COTE) +
      bord('droite', 1, 0, 0, 0, COTE - VIGNETTE, 0, VIGNETTE, COTE) +
      `<linearGradient id="${id}-pli" x1="${versLePli ? 1 : 0}" y1="0" x2="${versLePli ? 0 : 1}" y2="0">` +
      `<stop offset="0" stop-color="var(--ombre-du-pli)" stop-opacity="${versLePli ? 0.5 : 0.55}"/><stop offset="1" stop-color="var(--ombre-du-pli)" stop-opacity="0"/></linearGradient>` +
      `<rect x="${versLePli ? COTE - PLI : 0}" y="0" width="${PLI}" height="${COTE}" fill="url(#${id}-pli)"/>`,
  };
};
