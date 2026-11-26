import type { CadreDef } from '../types';

const COTE = 128;
/** La demi-hauteur du ruban : ses tranches de haut et de bas se touchent presque, il se pose à `2 × TRANCHE + 1` de haut. */
const TRANCHE = 16;
/** La profondeur de la découpe en bannière de chaque queue. */
const DECOUPE = 7.5;
/** L'ombre de la cire, en haut, au milieu et en bas du ruban posé : un dégradé par tranche, le milieu entre elles. */
const OMBRE = { haut: 0.37, milieu: 0.47, bas: 0.57 };

/** Le contour : chaque queue se découpe en pointe à mi-hauteur, là où les tranches de haut et de bas se rejoignent. */
const contour =
  `M0 0 H${COTE} L${COTE - DECOUPE} ${TRANCHE} V${COTE - TRANCHE} L${COTE} ${COTE} ` +
  `H0 L${DECOUPE} ${COTE - TRANCHE} V${TRANCHE} Z`;

/** Le dégradé d'ombre `id`, d'opacité `de` à `a` du haut vers le bas. */
const ombre = (id: string, de: number, a: number) =>
  `<linearGradient id="ruban-${id}" x1="0" y1="0" x2="0" y2="1">` +
  `<stop offset="0" stop-color="var(--shadow-ink)" stop-opacity="${de}"/><stop offset="1" stop-color="var(--shadow-ink)" stop-opacity="${a}"/>` +
  `</linearGradient>`;

/** Ruban : une bande de cire brunie aux queues découpées en bannière, plus claire en haut et plus sombre en bas, un
 *  liseré de laiton en haut et en bas. Il s'étire en largeur ; sa hauteur est celle de ses deux tranches. */
export const cadre: CadreDef = {
  id: 'ruban',
  label: 'Ruban',
  tranches: [TRANCHE, TRANCHE, TRANCHE, TRANCHE],
  svg: `
    <clipPath id="ruban-bande"><path d="${contour}"/></clipPath>
    ${ombre('haut', OMBRE.haut, OMBRE.milieu)}
    ${ombre('bas', OMBRE.milieu, OMBRE.bas)}
    <g clip-path="url(#ruban-bande)">
      <rect x="0" y="0" width="${COTE}" height="${COTE}" fill="var(--cire)"/>
      <rect x="0" y="0" width="${COTE}" height="${COTE}" fill="var(--laiton)" opacity="0.15"/>
      <rect x="0" y="0" width="${COTE}" height="${TRANCHE}" fill="url(#ruban-haut)"/>
      <rect x="0" y="${TRANCHE}" width="${COTE}" height="${COTE - 2 * TRANCHE}" fill="var(--shadow-ink)" opacity="${OMBRE.milieu}"/>
      <rect x="0" y="${COTE - TRANCHE}" width="${COTE}" height="${TRANCHE}" fill="url(#ruban-bas)"/>
      <rect x="0" y="0" width="${COTE}" height="1" fill="var(--laiton)" opacity="0.85"/>
      <rect x="0" y="${COTE - 1}" width="${COTE}" height="1" fill="var(--laiton)" opacity="0.7"/>
    </g>
  `,
};
