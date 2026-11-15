import type { CadreDef } from '../types';

const COTE = 128;
const TRANCHE = 14;
/** La longueur du bord répété : l'ondulation d'un bord y fait un nombre entier de vagues, et se raccorde à elle-même. */
const BORD = COTE - 2 * TRANCHE;
const PAS = 2;
/** Le pan coupé de chaque coin, entamé. */
const COIN = 8;
/** Le retrait moyen du contour : la place de l'ombre portée de la feuille, dans le dessin. */
const MARGE = 5.5;

/** Le retrait du contour au point `t` d'un bord (0 à `COTE`), ondulé par les harmoniques `vagues` de ce bord : nul aux
 *  bornes du bord répété, il s'y raccorde ; dans une tranche d'angle, il se creuse vers le pan coupé du coin. */
const retrait = (t: number, vagues: [number, number][]) => {
  if (t < TRANCHE) return MARGE + (TRANCHE - t) * 0.12;
  if (t > COTE - TRANCHE) return MARGE + (t - COTE + TRANCHE) * 0.12;
  const u = (t - TRANCHE) / BORD;
  return MARGE + vagues.reduce((somme, [rang, ampleur]) => somme + ampleur * Math.sin(2 * Math.PI * rang * u), 0);
};

/** Les points d'un bord, d'un pan coupé à l'autre au pas `PAS`, posés par `point(t, retrait)`. */
const bord = (vagues: [number, number][], point: (t: number, r: number) => [number, number]) =>
  Array.from({ length: (COTE - 2 * COIN) / PAS + 1 }, (_, i) => point(COIN + i * PAS, retrait(COIN + i * PAS, vagues)));

const contour = [
  ...bord([[2, 0.9], [5, 0.5], [9, 0.35]], (t, r) => [t, r]),
  ...bord([[3, 0.8], [7, 0.45], [11, 0.3]], (t, r) => [COTE - r, t]),
  ...bord([[2, -0.7], [6, 0.55], [10, 0.3]], (t, r) => [COTE - t, COTE - r]),
  ...bord([[3, -0.85], [5, 0.4], [13, 0.25]], (t, r) => [r, COTE - t]),
]
  .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
  .join(' ');

/** Parchemin : une feuille au contour ondulé et entamé aux angles, à la teinte du parchemin, son bord roussi par des
 *  liserés de plus en plus clairs vers l'intérieur, son ombre portée en bas à droite, qui suit son contour. */
export const cadre: CadreDef = {
  id: 'parchemin',
  label: 'Parchemin',
  tranches: [TRANCHE, TRANCHE, TRANCHE, TRANCHE],
  svg: `
    <clipPath id="parchemin-feuille"><path d="${contour} Z"/></clipPath>
    <g transform="translate(0.8 1.8)">
      <path d="${contour} Z" fill="none" stroke="var(--shadow-ink)" stroke-width="4" opacity="0.1"/>
      <path d="${contour} Z" fill="none" stroke="var(--shadow-ink)" stroke-width="2.2" opacity="0.18"/>
      <path d="${contour} Z" fill="var(--shadow-ink)" opacity="0.35"/>
    </g>
    <path d="${contour} Z" fill="var(--parchment)"/>
    <g clip-path="url(#parchemin-feuille)" fill="none">
      <path d="${contour} Z" stroke="var(--roussi)" stroke-width="14" opacity="0.14"/>
      <path d="${contour} Z" stroke="var(--roussi)" stroke-width="8" opacity="0.22"/>
      <path d="${contour} Z" stroke="var(--roussi)" stroke-width="4" opacity="0.4"/>
      <path d="${contour} Z" stroke="var(--roussi)" stroke-width="1.5" opacity="0.75"/>
    </g>
  `,
};
