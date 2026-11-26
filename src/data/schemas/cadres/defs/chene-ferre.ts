import type { CadreDef } from '../types';
import { trait } from '../biseau';

const COTE = 128;
const TRANCHE = 32;
/** La largeur de la traverse : le liseré d'encre, le chêne, la gorge contre le panneau. */
const TRAVERSE = 9;
/** La longueur et la largeur d'un bras de ferrure. */
const BRAS = 30;
const FER = 10.5;
/** Le pan coupé du coin extérieur d'une ferrure. */
const PAN = 2;

type Point = [number, number];

const chemin = (points: Point[]) => points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ') + ' Z';

/** Une traverse : le trapèze entre le bord du cadre et le panneau, coupé d'onglet à ses deux bouts, et le fil de son
 *  bois, deux veines le long d'elle. `poser(t, d)` pose le point `t` de sa longueur à la profondeur `d`. */
const traverse = (poser: (t: number, d: number) => Point, couleur: string) =>
  `<path d="${chemin([poser(0, 0), poser(COTE, 0), poser(COTE - TRAVERSE, TRAVERSE), poser(TRAVERSE, TRAVERSE)])}" fill="var(${couleur})" opacity="0.92"/>` +
  trait(poser(0, 4.5), poser(COTE, 4.5), '--shadow-ink', 0.12) +
  trait(poser(0, 6.5), poser(COTE, 6.5), '--border', 0.14);

/** Les arêtes d'un polygone : claire si elle regarde la lumière (en haut à gauche), sombre sinon. */
const aretes = (points: Point[]) => {
  const aire = points.reduce((s, [x, y], i) => s + x * points[(i + 1) % points.length][1] - points[(i + 1) % points.length][0] * y, 0);
  return points
    .map((de, i) => {
      const a = points[(i + 1) % points.length];
      const normale: Point = aire > 0 ? [a[1] - de[1], de[0] - a[0]] : [de[1] - a[1], a[0] - de[0]];
      const eclaire = -normale[0] - normale[1] > 0;
      return trait(de, a, eclaire ? '--fer-clair' : '--fer-sombre', eclaire ? 0.55 : 0.9);
    })
    .join('');
};

/** Un clou : son ombre portée vers le bas à droite, sa tête bombée, son reflet en haut à gauche. */
const clou = (x: number, y: number, r: number) =>
  `<circle cx="${x + 0.8}" cy="${y + 0.9}" r="${r + 0.3}" fill="var(--shadow-ink)" opacity="0.6"/>` +
  `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#chene-ferre-clou)"/>` +
  `<circle cx="${x - r * 0.3}" cy="${y - r * 0.35}" r="${r * 0.45}" fill="var(--ivoire)" opacity="0.4"/>`;

/** La ferrure d'un angle : une équerre de fer noirci à un clou, son coin `(x, y)`, ses bras vers `(sx, sy)`, son ombre
 *  portée sur le bois. */
const ferrure = (x: number, y: number, sx: number, sy: number) => {
  const p = (dx: number, dy: number): Point => [x + sx * dx, y + sy * dy];
  const equerre = (r: number) => [p(PAN + r / 2, r), p(BRAS - r, r), p(BRAS - r, FER - r), p(FER - r, FER - r), p(FER - r, BRAS - r), p(r, BRAS - r), p(r, PAN + r / 2)];
  return (
    `<path d="${chemin(equerre(0))}" transform="translate(1.2 1.6)" fill="var(--shadow-ink)" opacity="0.6"/>` +
    `<path d="${chemin(equerre(0))}" fill="url(#chene-ferre-fer)"/>` +
    aretes(equerre(0.5)) +
    clou(...p(6.6, 6.6), 3.3)
  );
};

/** Chêne ferré : un panneau de chêne sombre (la matière du style, assombrie) dans quatre traverses de chêne nu, celles
 *  du haut et de gauche éclairées, une équerre de fer noirci à un clou à chaque angle. Lumière en haut à gauche. */
export const cadre: CadreDef = {
  id: 'chene-ferre',
  label: 'Chêne ferré',
  tranches: [TRANCHE, TRANCHE, TRANCHE, TRANCHE],
  svg: `
    <radialGradient id="chene-ferre-clou" cx="0.4" cy="0.38" r="0.62" fx="0.32" fy="0.28">
      <stop offset="0" stop-color="var(--fer-clair)"/><stop offset="0.7" stop-color="var(--fer)"/><stop offset="1" stop-color="var(--fer-sombre)"/>
    </radialGradient>
    <linearGradient id="chene-ferre-fer" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--fer-clair)"/><stop offset="0.3" stop-color="var(--fer)"/><stop offset="1" stop-color="var(--fer-sombre)"/>
    </linearGradient>
    <rect x="0" y="0" width="${COTE}" height="${COTE}" fill="var(--chene)" opacity="0.62"/>
    <path d="M${TRAVERSE} ${TRAVERSE} H${COTE - TRAVERSE} V${TRAVERSE + 3} H${TRAVERSE + 3} V${COTE - TRAVERSE} H${TRAVERSE} Z" fill="var(--shadow-ink)" opacity="0.35"/>
    ${traverse((t, d) => [t, d], '--chene-clair')}
    ${traverse((t, d) => [d, t], '--chene')}
    ${traverse((t, d) => [COTE - d, t], '--chene')}
    ${traverse((t, d) => [t, COTE - d], '--chene-sombre')}
    <rect x="1" y="1" width="${COTE - 2}" height="2" fill="var(--border)" opacity="0.7"/>
    ${trait([1.5, 1], [1.5, COTE - 1], '--border', 0.4)}
    <path fill-rule="evenodd" d="M${TRAVERSE - 1} ${TRAVERSE - 1} H${COTE - TRAVERSE + 1} V${COTE - TRAVERSE + 1} H${TRAVERSE - 1} Z M${TRAVERSE} ${TRAVERSE} V${COTE - TRAVERSE} H${COTE - TRAVERSE} V${TRAVERSE} Z" fill="var(--shadow-ink)" opacity="0.7"/>
    <path fill-rule="evenodd" d="M0 0 H${COTE} V${COTE} H0 Z M1 1 V${COTE - 1} H${COTE - 1} V1 Z" fill="var(--shadow-ink)" opacity="0.85"/>
    ${ferrure(0, 0, 1, 1)}
    ${ferrure(COTE, 0, -1, 1)}
    ${ferrure(0, COTE, 1, -1)}
    ${ferrure(COTE, COTE, -1, -1)}
  `,
};
