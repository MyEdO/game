import type { CadreDef } from './types';

/** Le côté du cadre des cadres (`CADRE_DES_CADRES`). */
const COTE = 128;

/** Les deux moitiés du disque, séparées par la diagonale montante, que nomment `url(#<id>-lumiere)` et `url(#<id>-ombre)`. */
export const moities = (id: string) =>
  `<clipPath id="${id}-lumiere"><path d="M0 0 H${COTE} L0 ${COTE} Z"/></clipPath>` +
  `<clipPath id="${id}-ombre"><path d="M${COTE} 0 V${COTE} H0 Z"/></clipPath>`;

/**
 * Le dessin d'un cadre rond de rayon `rayon` (#3935) : un carré du cadre des cadres aux angles arrondis à `rayon`, que
 * ses tranches de `rayon` découpent en quatre quarts de disque ; posé à `2 × rayon` de côté, ses bords et son centre
 * sont vides et le cadre est un disque. Lumière en haut à gauche : ce qui regarde la lumière vit dans le triangle
 * au-dessus de la diagonale montante (`moities`), qui passe au coin intérieur de chaque quart, donc au centre du disque.
 */
export const rond = (rayon: number) => {
  /** Le contour à `retrait` du bord, concentrique au disque. */
  const contour = (retrait: number) =>
    `x="${retrait}" y="${retrait}" width="${COTE - 2 * retrait}" height="${COTE - 2 * retrait}" rx="${rayon - retrait}"`;
  return {
    tranches: [rayon, rayon, rayon, rayon] as CadreDef['tranches'],
    contour,
    /** Un anneau à `retrait` du bord, `lumiere` sur la moitié éclairée, `ombre` sur l'autre. */
    anneau: (id: string, retrait: number, lumiere: string, ombre: string, opacite = 1, epaisseur = 1) =>
      `<rect ${contour(retrait)} fill="none" stroke="var(${lumiere})" stroke-width="${epaisseur}" opacity="${opacite}" clip-path="url(#${id}-lumiere)"/>` +
      `<rect ${contour(retrait)} fill="none" stroke="var(${ombre})" stroke-width="${epaisseur}" opacity="${opacite}" clip-path="url(#${id}-ombre)"/>`,
    /** Le reflet du disque : un arc court sur son bord éclairé, à `retrait` du bord, dans le quart du haut à gauche. */
    reflet: (retrait: number, couleur: string, opacite: number) => {
      const r = rayon - retrait;
      const point = (degres: number) => [rayon + r * Math.cos((degres * Math.PI) / 180), rayon + r * Math.sin((degres * Math.PI) / 180)].map((v) => v.toFixed(2)).join(' ');
      return `<path d="M${point(200)} A${r} ${r} 0 0 1 ${point(250)}" fill="none" stroke="var(${couleur})" stroke-width="1.5" stroke-linecap="round" opacity="${opacite}"/>`;
    },
    /** Les quarts du dessin : chacun son coin `x`, `y` dans le cadre des cadres et son décalage `dx`, `dy` entre le
     *  disque posé et le dessin. */
    quarts: [0, 1, 2, 3].map((i) => ({ i, x: (i % 2) * (COTE / 2), y: (i >> 1) * (COTE / 2), dx: (i % 2) * (COTE - 2 * rayon), dy: (i >> 1) * (COTE - 2 * rayon) })),
  };
};

/**
 * Un disque à listel (#3935) de rayon `rayon` : le listel bombé, large de `listel`, d'un disque de `metal` (`clair` en
 * haut à gauche, `sombre` en bas à droite, inversés quand le disque est `enfonce`), son champ en creux de `champ`, un
 * reflet sur le listel.
 */
const disque = (rayon: number, listel: number) => {
  const { anneau, contour, reflet, tranches } = rond(rayon);
  return (id: string, label: string, champ: string, clair: string, metal: string, sombre: string, enfonce = false): CadreDef => ({
    id,
    label,
    tranches,
    svg:
      moities(id) +
      `<rect ${contour(0)} fill="var(${sombre})"/>` +
      `<rect ${contour(1)} fill="var(${metal})"/>` +
      anneau(id, 1.5, enfonce ? sombre : clair, enfonce ? clair : sombre, 0.9) +
      `<rect ${contour(listel + 1)} fill="var(--shadow-ink)"/>` +
      `<rect ${contour(listel + 2)} fill="var(${champ})"/>` +
      anneau(id, listel + 2.5, '--shadow-ink', clair, 0.6) +
      (enfonce ? '' : reflet(2, clair, 0.9)),
  });
};

/** Une pastille : un disque à listel de 17 de rayon, posé à 34 de côté. */
export const pastille = disque(17, 3);

/** Un bouton rond : un disque à listel de 42 de rayon, posé à 84 de côté (la fin du tour, `art/fin_du_tour.tres`). */
export const boutonRond = disque(42, 6);

/** Un outil : un disque à listel de 23 de rayon, posé à 46 de côté (les outils de l'accueil, `art/accueil.tres`). */
export const outil = disque(23, 4);
