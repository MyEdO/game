import type { CadreDef } from './types';

const COTE = 128;
/** Les tranches d'une case : son filet et son liseré. */
const TRANCHE = 2;

/**
 * Une case d'une rangée de segments (#3935) : son champ `champ` (un jeton, ou un dégradé de trois jetons du haut vers le
 * bas) d'opacité `opacite`, cernée d'un filet `filet` d'opacité `opaciteDuFilet` ; `lisere`, un liseré au-dedans.
 * Deux cases voisines se chevauchent d'une unité : leur filet n'en fait qu'un.
 */
export const segment = (id: string, label: string, champ: string | [string, string, string], opacite: number, filet: string, opaciteDuFilet: number, lisere?: string): CadreDef => ({
  id,
  label,
  tranches: [TRANCHE, TRANCHE, TRANCHE, TRANCHE],
  svg:
    (typeof champ === 'string'
      ? `<rect x="0" y="0" width="${COTE}" height="${COTE}" fill="var(${champ})" opacity="${opacite}"/>`
      : `<linearGradient id="${id}-champ" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(${champ[0]})"/><stop offset="0.6" stop-color="var(${champ[1]})"/><stop offset="1" stop-color="var(${champ[2]})"/></linearGradient>` +
        `<rect x="0" y="0" width="${COTE}" height="${COTE}" fill="url(#${id}-champ)" opacity="${opacite}"/>`) +
    `<rect x="0.5" y="0.5" width="${COTE - 1}" height="${COTE - 1}" fill="none" stroke="var(${filet})" stroke-width="1" opacity="${opaciteDuFilet}"/>` +
    (lisere ? `<rect x="1.5" y="1.5" width="${COTE - 3}" height="${COTE - 3}" fill="none" stroke="var(${lisere})" stroke-width="1" opacity="0.8"/>` : ''),
});
