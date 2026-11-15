import type { CadreDef } from '../types';

const COTE = 128;
const TRANCHE = 32;
/** Le pas des clous de la bande de fer : le bord répété (`COTE` moins deux tranches) en porte quatre. */
const PAS = 16;
const BANDE = 9;
/** Le pas des planches : le centre répété en porte deux, et leurs joints se raccordent d'un motif à l'autre. */
const PLANCHE = 32;
/** Le joint de planches du centre le plus haut. */
const JOINT = TRANCHE + 12;

type Point = [number, number];

/** Un trait de `de` à `a`. */
const trait = (de: Point, a: Point, couleur: string, opacite: number, epaisseur = 1) =>
  `<path d="M${de[0]} ${de[1]} L${a[0]} ${a[1]}" fill="none" stroke="var(${couleur})" stroke-width="${epaisseur}" opacity="${opacite}"/>`;

/** Un clou de rayon `r` : son ombre portée vers le bas à droite, sa tête bombée, son reflet en haut à gauche. */
const clou = (x: number, y: number, r = 2.4) =>
  `<circle cx="${x + 0.9}" cy="${y + 0.9}" r="${r}" fill="var(--shadow-ink)" opacity="0.6"/>` +
  `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#chene-ferre-clou)"/>` +
  `<circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.3}" fill="var(--fer-clair)"/>`;

/** Une bosse du martelé : creusée, son bord sombre regarde la lumière, son bord clair s'en détourne. */
const coup = (x: number, y: number) =>
  `<circle cx="${x - 0.4}" cy="${y - 0.4}" r="1.1" fill="var(--fer-sombre)" opacity="0.35"/>` +
  `<circle cx="${x + 0.4}" cy="${y + 0.4}" r="0.9" fill="var(--fer-clair)" opacity="0.18"/>`;

/** Ce que porte un bord répété de la bande : un clou tous les `PAS` à mi-bande, et deux coups de marteau entre eux.
 *  `poser(t, d)` pose le point `t` du bord (d'une tranche d'angle à l'autre) à la profondeur `d` dans la bande. */
const bordDeFer = (poser: (t: number, d: number) => Point) =>
  Array.from({ length: (COTE - 2 * TRANCHE) / PAS }, (_, i) => {
    const t = TRANCHE + PAS / 2 + i * PAS;
    const [cx, cy] = poser(t, BANDE / 2);
    const [ax, ay] = poser(t + 5, 2.6 + (i % 3) * 1.5);
    const [bx, by] = poser(t - 4.5, 6.4 - (i % 2) * 1.8);
    return coup(ax, ay) + coup(bx, by) + clou(cx, cy);
  }).join('');

/** Les arêtes d'un polygone : claire si elle regarde la lumière (en haut à gauche), sombre sinon. */
const aretes = (points: Point[]) => {
  const aire = points.reduce((s, [x, y], i) => s + x * points[(i + 1) % points.length][1] - points[(i + 1) % points.length][0] * y, 0);
  return points
    .map((de, i) => {
      const a = points[(i + 1) % points.length];
      const normale: Point = aire > 0 ? [a[1] - de[1], de[0] - a[0]] : [de[1] - a[1], a[0] - de[0]];
      const eclaire = -normale[0] - normale[1] > 0;
      return trait(de, a, eclaire ? '--fer-clair' : '--fer-sombre', eclaire ? 0.9 : 1);
    })
    .join('');
};

/** La ferrure d'un angle : une équerre de fer à bras pointus et trois clous, son coin `(x, y)`, ses bras vers
 *  `(sx, sy)`, son ombre portée sur le bois. */
const ferrure = (x: number, y: number, sx: number, sy: number) => {
  const p = (dx: number, dy: number): Point => [x + sx * dx, y + sy * dy];
  const plaque = [p(0, 0), p(25, 0), p(30, 7), p(25, 14), p(14, 14), p(14, 25), p(7, 30), p(0, 25)];
  const d = plaque.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px} ${py}`).join(' ') + ' Z';
  return (
    `<path d="${d}" transform="translate(1.3 1.3)" fill="var(--shadow-ink)" opacity="0.55"/>` +
    `<path d="${d}" fill="url(#chene-ferre-plaque)"/>` +
    aretes(plaque) +
    clou(...p(6, 6), 3) + clou(...p(23, 7), 3) + clou(...p(7, 23), 3)
  );
};

/** Les joints des planches, horizontaux, sur toute la largeur du bois, et l'about d'une planche sur deux. */
const joints = () => {
  const ys = [JOINT - PLANCHE, JOINT, JOINT + PLANCHE, JOINT + 2 * PLANCHE];
  const abouts: [number, number, number][] = [[TRANCHE + 20, JOINT, JOINT + PLANCHE]];
  return (
    ys.map((y) => trait([BANDE, y], [COTE - BANDE, y], '--shadow-ink', 0.55, 1.2) + trait([BANDE, y + 1.1], [COTE - BANDE, y + 1.1], '--border', 0.4)).join('') +
    abouts.map(([x, de, a]) => trait([x, de], [x, a], '--shadow-ink', 0.5, 1.2) + trait([x + 1.1, de], [x + 1.1, a], '--border', 0.3)).join('')
  );
};

/** Chêne ferré : planches de chêne sombre (la matière du style, assombrie par le centre), bande de fer noirci martelée
 *  et cloutée sur le pourtour, équerre à trois clous à chaque angle, filet intérieur de laiton. Lumière en haut à
 *  gauche. */
export const cadre: CadreDef = {
  id: 'chene-ferre',
  label: 'Chêne ferré',
  tranches: [TRANCHE, TRANCHE, TRANCHE, TRANCHE],
  svg: `
    <radialGradient id="chene-ferre-clou" cx="0.4" cy="0.4" r="0.6" fx="0.3" fy="0.3">
      <stop offset="0" stop-color="var(--fer-clair)"/><stop offset="0.55" stop-color="var(--fer)"/><stop offset="1" stop-color="var(--fer-sombre)"/>
    </radialGradient>
    <linearGradient id="chene-ferre-plaque" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--fer-clair)"/><stop offset="0.35" stop-color="var(--fer)"/><stop offset="1" stop-color="var(--fer-sombre)"/>
    </linearGradient>
    <rect x="0" y="0" width="${COTE}" height="${COTE}" fill="var(--chene)" opacity="0.62"/>
    ${joints()}
    <path d="M${BANDE + 2} ${BANDE + 2} H${COTE - BANDE - 2} V${BANDE + 5} H${BANDE + 5} V${COTE - BANDE - 2} H${BANDE + 2} Z" fill="var(--shadow-ink)" opacity="0.4"/>
    <path fill-rule="evenodd" d="M0 0 H${COTE} V${COTE} H0 Z M${BANDE} ${BANDE} V${COTE - BANDE} H${COTE - BANDE} V${BANDE} Z" fill="var(--fer)"/>
    <path fill-rule="evenodd" d="M1 1 H${COTE - 1} V3 H3 V${COTE - 1} H1 Z" fill="var(--fer-clair)" opacity="0.3"/>
    <path fill-rule="evenodd" d="M${COTE - 1} ${COTE - 1} H1 V${COTE - 3} H${COTE - 3} V1 H${COTE - 1} Z" fill="var(--fer-sombre)" opacity="0.45"/>
    ${trait([0.5, COTE - 0.5], [0.5, 0.5], '--fer-clair', 1)}${trait([0.5, 0.5], [COTE - 0.5, 0.5], '--fer-clair', 1)}
    ${trait([COTE - 0.5, 0.5], [COTE - 0.5, COTE - 0.5], '--fer-sombre', 1)}${trait([COTE - 0.5, COTE - 0.5], [0.5, COTE - 0.5], '--fer-sombre', 1)}
    ${trait([BANDE - 0.5, BANDE - 0.5], [COTE - BANDE + 0.5, BANDE - 0.5], '--fer-sombre', 1)}${trait([BANDE - 0.5, BANDE - 0.5], [BANDE - 0.5, COTE - BANDE + 0.5], '--fer-sombre', 1)}
    ${trait([BANDE - 0.5, COTE - BANDE + 0.5], [COTE - BANDE + 0.5, COTE - BANDE + 0.5], '--fer-clair', 0.6)}${trait([COTE - BANDE + 0.5, BANDE - 0.5], [COTE - BANDE + 0.5, COTE - BANDE + 0.5], '--fer-clair', 0.6)}
    <rect x="${BANDE + 0.5}" y="${BANDE + 0.5}" width="${COTE - 1 - 2 * BANDE}" height="${COTE - 1 - 2 * BANDE}" fill="none" stroke="var(--laiton-clair)" stroke-width="1"/>
    <rect x="${BANDE + 1.5}" y="${BANDE + 1.5}" width="${COTE - 3 - 2 * BANDE}" height="${COTE - 3 - 2 * BANDE}" fill="none" stroke="var(--laiton-sombre)" stroke-width="1" opacity="0.8"/>
    ${bordDeFer((t, d) => [t, d])}
    ${bordDeFer((t, d) => [t, COTE - BANDE + d])}
    ${bordDeFer((t, d) => [d, t])}
    ${bordDeFer((t, d) => [COTE - BANDE + d, t])}
    ${ferrure(0, 0, 1, 1)}
    ${ferrure(COTE, 0, -1, 1)}
    ${ferrure(0, COTE, 1, -1)}
    ${ferrure(COTE, COTE, -1, -1)}
  `,
};
