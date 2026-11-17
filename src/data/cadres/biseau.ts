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

/** L'épaisseur des tranches d'une plaque : la bordure d'encre, le filet de deux traits, le liseré. */
const TRANCHE_DE_PLAQUE = 4;

/** Le rayon des angles d'une plaque. */
const RAYON_DE_PLAQUE = 3;

/** Le métal d'un filet : son ombre, son éclat, son plein. */
type Metal = [sombre: string, eclat: string, plein: string];

/** Le filet de laiton des plaques de bouton. */
const LAITON: Metal = ['--laiton-sombre', '--laiton-eclat', '--laiton'];

/** Le rectangle arrondi à `retrait` du bord, concentrique à la plaque. */
const contour = (retrait: number) =>
  `x="${retrait}" y="${retrait}" width="${COTE - 2 * retrait}" height="${COTE - 2 * retrait}" rx="${Math.max(RAYON_DE_PLAQUE - retrait, 0)}"`;

/** Un dégradé `id` de `de` à `a` (`x2`, `y2` : sa direction), passant par `milieu` à `ou`. */
const degrade = (id: string, x2: number, y2: number, de: string, a: string, milieu?: [string, number]) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="var(${de})"/>` +
  (milieu ? `<stop offset="${milieu[1]}" stop-color="var(${milieu[0]})"/>` : '') +
  `<stop offset="1" stop-color="var(${a})"/></linearGradient>`;

/** Une plaque de bouton (#3935) : un champ dégradé de `champ[0]` en haut à `champ[1]` en bas, cerné d'un liseré `lisere`,
 *  dans un filet de `metal` dont les flancs vont de l'ombre au plein et dont le haut et le bas portent un éclat, sous
 *  une bordure d'encre ; `enfoncee`, l'ombre du filet tombe sur le haut et la gauche du champ. Le nine-patch
 *  (`TILE_FIT`) n'étire qu'une fois le bord et le champ tant que la plaque fait moins d'une fois et demie le centre. */
export const plaque = (id: string, label: string, champ: [string, string], lisere: string, metal: Metal = LAITON, enfoncee = false): CadreDef => {
  const [sombre, eclat, plein] = metal;
  const filet = (y: number, de: string, a: string, ou: number, suffixe: string) =>
    `<rect x="1" y="${y}" width="${COTE - 2}" height="2" fill="url(#${id}-${suffixe})" clip-path="url(#${id}-forme)"/>` +
    `<defs>${degrade(`${id}-${suffixe}`, 1, 0, de, a, [eclat, ou])}</defs>`;
  return {
    id,
    label,
    tranches: [TRANCHE_DE_PLAQUE, TRANCHE_DE_PLAQUE, TRANCHE_DE_PLAQUE, TRANCHE_DE_PLAQUE],
    svg:
      `<defs>${degrade(`${id}-flanc`, 0, 1, sombre, plein)}${degrade(`${id}-champ`, 0, 1, champ[0], champ[1])}` +
      `<clipPath id="${id}-forme"><rect ${contour(1)}/></clipPath></defs>` +
      `<rect ${contour(0)} fill="var(--shadow-ink)"/>` +
      `<rect ${contour(1)} fill="url(#${id}-flanc)"/>` +
      filet(1, sombre, plein, 0.6, 'haut') +
      filet(COTE - 3, plein, sombre, 0.35, 'bas') +
      `<rect ${contour(3)} fill="var(${lisere})"/>` +
      `<rect ${contour(4)} fill="url(#${id}-champ)"/>` +
      (enfoncee
        ? `<rect x="4" y="4" width="${COTE - 8}" height="2" fill="var(--shadow-ink)" opacity="0.55"/>` +
          `<rect x="4" y="6" width="2" height="${COTE - 10}" fill="var(--shadow-ink)" opacity="0.3"/>`
        : ''),
  };
};
