import type { CadreDef } from '../types';

const COTE = 128;
const TRANCHE = 20;
/** Le pas du centre répété : la marbrure s'y raccorde à elle-même sur les deux axes. */
const PAS = COTE - 2 * TRANCHE;
/** Le retrait de la feuille : le filet de laiton, le filet d'ombre. */
const FILETS = 2;
/** La profondeur de la vignette, de la feuille vers le centre : elle s'éteint au bout de la tranche. */
const VIGNETTE = TRANCHE - FILETS;

/** Une plage de la marbrure : son centre dans le motif répété (0 à `PAS`), ses demi-axes, sa teinte. */
type Plage = [x: number, y: number, rx: number, ry: number, teinte: 'ombre' | 'clair'];

const PLAGES: Plage[] = [
  [20, 24, 44, 34, 'ombre'],
  [58, 76, 30, 22, 'ombre'],
  [66, 44, 42, 30, 'clair'],
];

/** La marbrure : chaque plage, et ses reprises à un pas de distance, qui la raccordent d'un motif au suivant. */
const marbrure = PLAGES.flatMap(([x, y, rx, ry, teinte]) =>
  [-1, 0, 1].flatMap((i) =>
    [-1, 0, 1].map((j) => `<ellipse cx="${TRANCHE + x + i * PAS}" cy="${TRANCHE + y + j * PAS}" rx="${rx}" ry="${ry}" fill="url(#parchemin-${teinte})"/>`),
  ),
).join('');

/** Un halo `id` : la teinte `couleur`, pleine de `force` en son centre, éteinte à son bord. */
const halo = (id: string, couleur: string, force: number) =>
  `<radialGradient id="${id}"><stop offset="0" stop-color="var(${couleur})" stop-opacity="${force}"/>` +
  `<stop offset="0.55" stop-color="var(${couleur})" stop-opacity="${force * 0.45}"/><stop offset="1" stop-color="var(${couleur})" stop-opacity="0"/></radialGradient>`;

/** La vignette d'un bord : un dégradé `id` vers `(x2, y2)`, sombre au bord, éteint à `VIGNETTE`, sur le rectangle
 *  `x y l h` de ce bord. */
const vignette = (id: string, x2: number, y2: number, x: number, y: number, l: number, h: number) =>
  `<linearGradient id="${id}" x1="${x2 < 0 ? 1 : 0}" y1="${y2 < 0 ? 1 : 0}" x2="${x2 > 0 ? 1 : 0}" y2="${y2 > 0 ? 1 : 0}">` +
  [[0, 0.62], [0.07, 0.48], [0.2, 0.33], [0.5, 0.17], [1, 0]].map(([ou, force]) => `<stop offset="${ou}" stop-color="var(--border)" stop-opacity="${force}"/>`).join('') +
  `</linearGradient><rect x="${x}" y="${y}" width="${l}" height="${h}" fill="url(#${id})"/>`;

/** Parchemin : une feuille au bord net, cernée d'un filet de laiton puis d'un filet d'ombre, à la teinte du parchemin
 *  roussie, marbrée de grandes plages sombres et claires, vignettée vers ses bords et roussie à ses angles. */
export const cadre: CadreDef = {
  id: 'parchemin',
  label: 'Parchemin',
  tranches: [TRANCHE, TRANCHE, TRANCHE, TRANCHE],
  svg: `
    <clipPath id="parchemin-feuille"><rect x="${FILETS}" y="${FILETS}" width="${COTE - 2 * FILETS}" height="${COTE - 2 * FILETS}" rx="1.5"/></clipPath>
    ${halo('parchemin-ombre', '--roussi', 0.06)}${halo('parchemin-clair', '--ivoire', 0.08)}${halo('parchemin-angle', '--roussi', 0.3)}
    <rect x="0" y="0" width="${COTE}" height="${COTE}" rx="3" fill="var(--laiton-sombre)"/>
    <rect x="1" y="1" width="${COTE - 2}" height="${COTE - 2}" rx="2" fill="var(--shadow-ink)" opacity="0.7"/>
    <g clip-path="url(#parchemin-feuille)">
      <rect x="0" y="0" width="${COTE}" height="${COTE}" fill="var(--parchment)"/>
      <rect x="0" y="0" width="${COTE}" height="${COTE}" fill="var(--roussi)" opacity="0.2"/>
      ${marbrure}
      ${vignette('parchemin-haut', 0, 1, 0, FILETS, COTE, VIGNETTE)}
      ${vignette('parchemin-gauche', 1, 0, FILETS, 0, VIGNETTE, COTE)}
      ${vignette('parchemin-bas', 0, -1, 0, COTE - TRANCHE, COTE, VIGNETTE)}
      ${vignette('parchemin-droite', -1, 0, COTE - TRANCHE, 0, VIGNETTE, COTE)}
      ${[0, COTE].flatMap((x) => [0, COTE].map((y) => `<circle cx="${x}" cy="${y}" r="${TRANCHE}" fill="url(#parchemin-angle)"/>`)).join('')}
    </g>
  `,
};
