import type { CadreDef } from './types';

/** Le côté du cadre des cadres (`CADRE_DES_CADRES`). */
const COTE = 128;

type Point = [number, number];

/** Un trait de `de` à `a`. */
export const trait = (de: Point, a: Point, couleur: string, opacite = 1) =>
  `<path d="M${de[0]} ${de[1]} L${a[0]} ${a[1]}" fill="none" stroke="var(${couleur})" stroke-width="1" opacity="${opacite}"/>`;

/** Les quatre côtés d'un carré inscrit à `retrait` du bord : `haut` et `gauche` à la couleur `lumiere`, `bas` et
 *  `droite` à la couleur `ombre`. */
export const biseau = (retrait: number, lumiere: string, ombre: string, opacite = 1) => {
  const [a, b] = [retrait + 0.5, COTE - retrait - 0.5];
  return (
    trait([a, b], [a, a], lumiere, opacite) + trait([a, a], [b, a], lumiere, opacite) +
    trait([b, a], [b, b], ombre, opacite) + trait([b, b], [a, b], ombre, opacite)
  );
};

/** L'épaisseur des tranches d'une plaque : le liseré, le filet de deux traits, l'ombre d'une plaque enfoncée. */
const TRANCHE_DE_PLAQUE = 6;

/** Une plaque de bouton (#3935) : un fond `fond`, cerné d'un liseré d'encre, sous un filet à biseau (`lumiere` en haut
 *  à gauche, `ombre` en bas à droite) ; `enfoncee`, l'ombre du filet tombe sur le haut et la gauche de la plaque. */
export const plaque = (id: string, label: string, fond: string, lumiere: string, ombre: string, enfoncee = false): CadreDef => ({
  id,
  label,
  tranches: [TRANCHE_DE_PLAQUE, TRANCHE_DE_PLAQUE, TRANCHE_DE_PLAQUE, TRANCHE_DE_PLAQUE],
  svg:
    `<rect x="0" y="0" width="${COTE}" height="${COTE}" fill="var(${fond})"/>` +
    biseau(0, '--shadow-ink', '--shadow-ink') +
    biseau(1, lumiere, ombre) +
    biseau(2, lumiere, ombre, 0.6) +
    (enfoncee
      ? `<rect x="3" y="3" width="${COTE - 6}" height="2" fill="var(--shadow-ink)" opacity="0.55"/>` +
        `<rect x="3" y="5" width="2" height="${COTE - 8}" fill="var(--shadow-ink)" opacity="0.3"/>`
      : ''),
});
