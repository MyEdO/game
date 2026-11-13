/**
 * Le dessin d'un cadre rond (#3935) : un carré du cadre des cadres aux angles arrondis au rayon `RAYON`, que ses
 * tranches de `RAYON` découpent en quatre quarts de disque ; tracé à `2 × RAYON` de côté, ses bords et son centre
 * sont vides et le cadre est un disque. Lumière en haut à gauche : ce qui regarde la lumière vit dans le triangle au-dessus
 * de la diagonale montante, qui passe au coin intérieur de chaque quart, donc au centre du disque.
 */
export const RAYON = 17;
/** Le côté du cadre des cadres (`CADRE_DES_CADRES`). */
const COTE = 128;

/** Le contour à `retrait` du bord, concentrique au disque. */
export const contour = (retrait: number) =>
  `x="${retrait}" y="${retrait}" width="${COTE - 2 * retrait}" height="${COTE - 2 * retrait}" rx="${RAYON - retrait}"`;

/** Les deux moitiés du disque, séparées par la diagonale montante, que nomment `url(#<id>-lumiere)` et `url(#<id>-ombre)`. */
export const moities = (id: string) =>
  `<clipPath id="${id}-lumiere"><path d="M0 0 H${COTE} L0 ${COTE} Z"/></clipPath>` +
  `<clipPath id="${id}-ombre"><path d="M${COTE} 0 V${COTE} H0 Z"/></clipPath>`;

/** Un anneau à `retrait` du bord, `lumiere` sur la moitié éclairée, `ombre` sur l'autre. */
export const anneau = (id: string, retrait: number, lumiere: string, ombre: string, opacite = 1, epaisseur = 1) =>
  `<rect ${contour(retrait)} fill="none" stroke="var(${lumiere})" stroke-width="${epaisseur}" opacity="${opacite}" clip-path="url(#${id}-lumiere)"/>` +
  `<rect ${contour(retrait)} fill="none" stroke="var(${ombre})" stroke-width="${epaisseur}" opacity="${opacite}" clip-path="url(#${id}-ombre)"/>`;

/** Le reflet d'un disque : un arc court sur son bord éclairé, à `retrait` du bord, dans le quart du haut à gauche. */
export const reflet = (retrait: number, couleur: string, opacite: number) => {
  const r = RAYON - retrait;
  const point = (degres: number) => [RAYON + r * Math.cos((degres * Math.PI) / 180), RAYON + r * Math.sin((degres * Math.PI) / 180)].map((v) => v.toFixed(2)).join(' ');
  return `<path d="M${point(200)} A${r} ${r} 0 0 1 ${point(250)}" fill="none" stroke="var(${couleur})" stroke-width="1.5" stroke-linecap="round" opacity="${opacite}"/>`;
};
