import type { CadreDef } from '../types';

const COTE = 128;
/** Les tranches : les clous des angles y tiennent, la tranche des pages dans celle du bas. */
const TRANCHE = 26;
/** Le retrait des pages sur la reliure, à gauche et à droite ; la hauteur de leur tranche et sa marge au bas. */
const PAGES = { retrait: 13, hauteur: 9, marge: 8 };

/** Un clou de fer à `(x, y)`, éclairé en haut à gauche. */
const clou = (x: number, y: number) =>
  `<circle cx="${x}" cy="${y + 0.6}" r="3" fill="var(--shadow-ink)" opacity="0.8"/>` +
  `<circle cx="${x}" cy="${y}" r="3" fill="url(#reliure-clou)"/>`;

/** La tranche des pages : une feuille claire toutes les trois unités, sur le fond plus sombre de la tranche. */
const feuilles = Array.from({ length: PAGES.hauteur / 3 }, (_, i) =>
  `<rect x="${PAGES.retrait}" y="${COTE - PAGES.marge - PAGES.hauteur + 3 * i}" width="${COTE - 2 * PAGES.retrait}" height="1" fill="var(--tranche-claire)"/>`).join('');

/** Reliure : le cuir d'un registre, plus clair en haut, cerné d'encre, d'un filet d'or et d'une gorge sombre, un clou
 *  de fer à chaque angle, et la tranche de ses pages au bas, feuille sur feuille. */
export const cadre: CadreDef = {
  id: 'reliure',
  label: 'Reliure',
  tranches: [TRANCHE, TRANCHE, TRANCHE, TRANCHE],
  svg: `
    <linearGradient id="reliure-cuir" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--cuir-haut)"/><stop offset="0.6" stop-color="var(--cuir)"/><stop offset="1" stop-color="var(--cuir-bas)"/>
    </linearGradient>
    <radialGradient id="reliure-clou" cx="0.35" cy="0.3" r="0.7">
      <stop offset="0" stop-color="var(--fer-clair)"/><stop offset="0.6" stop-color="var(--fer)"/><stop offset="1" stop-color="var(--fer-sombre)"/>
    </radialGradient>
    <rect x="0" y="0" width="${COTE}" height="${COTE}" rx="7" fill="var(--shadow-ink)"/>
    <rect x="1" y="1" width="${COTE - 2}" height="${COTE - 2}" rx="6" fill="url(#reliure-cuir)"/>
    <rect x="2.5" y="2.5" width="${COTE - 5}" height="${COTE - 5}" rx="5" fill="none" stroke="var(--filet-or)" stroke-width="1" opacity="0.22"/>
    <rect x="3.5" y="3.5" width="${COTE - 7}" height="${COTE - 7}" rx="4" fill="none" stroke="var(--shadow-ink)" stroke-width="1" opacity="0.5"/>
    <rect x="${PAGES.retrait}" y="${COTE - PAGES.marge - PAGES.hauteur}" width="${COTE - 2 * PAGES.retrait}" height="${PAGES.hauteur}" rx="1" fill="var(--tranche-sombre)"/>
    ${feuilles}
    <rect x="${PAGES.retrait}" y="${COTE - PAGES.marge - PAGES.hauteur}" width="${COTE - 2 * PAGES.retrait}" height="${PAGES.hauteur}" rx="1" fill="none" stroke="var(--roussi)" stroke-width="1" opacity="0.6"/>
    ${clou(8, 8)}${clou(COTE - 8, 8)}${clou(8, COTE - 8)}${clou(COTE - 8, COTE - 8)}
  `,
};
