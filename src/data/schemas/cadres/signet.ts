import type { CadreDef } from './types';

const COTE = 128;
/** La profondeur de l'entaille en queue d'aronde, au bout du signet. */
const ENTAILLE = 10;
/** Les tranches : la queue entière dans celle de droite, que le signet étire en hauteur. */
const TRANCHES: CadreDef['tranches'] = [4, 4, ENTAILLE + 2, 4];

/**
 * Un signet (#3935) : un ruban qui dépasse de la tranche d'un registre, entaillé en queue d'aronde à son bout, son
 * champ dégradé de `teintes` du haut vers le bas, cerné d'un liseré `lisere` d'opacité `opacite`.
 */
export const signet = (id: string, label: string, teintes: [string, string, string], lisere: string, opacite: number): CadreDef => ({
  id,
  label,
  tranches: TRANCHES,
  svg:
    `<linearGradient id="${id}-champ" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(${teintes[0]})"/>` +
    `<stop offset="0.55" stop-color="var(${teintes[1]})"/><stop offset="1" stop-color="var(${teintes[2]})"/></linearGradient>` +
    `<path d="M0 0 H${COTE} L${COTE - ENTAILLE} ${COTE / 2} L${COTE} ${COTE} H0 Z" fill="url(#${id}-champ)"/>` +
    `<path d="M0.5 0.5 H${COTE - 1} L${COTE - ENTAILLE - 0.8} ${COTE / 2} L${COTE - 1} ${COTE - 0.5} H0.5 Z" fill="none" stroke="var(${lisere})" stroke-width="1" opacity="${opacite}"/>`,
});
