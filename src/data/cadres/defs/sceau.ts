import type { CadreDef } from '../types';
import { moities, rond } from '../rond';

/** Le sceau : un rond de 25, posé à 50 de côté. */
const { contour, quarts, tranches } = rond(25);
/** La largeur du bourrelet. */
const BOURRELET = 3;
/** Le point de la cire que la lumière touche, dans le disque posé, et la portée de son éclat. */
const ECLAT = { x: 19, y: 16, portee: 31 };
/** Le côté d'un quart du dessin, boîte englobante de son dégradé. */
const QUART = 64;

/** Sceau : un disque de cire rouge plein, bombé (son éclat en haut à gauche), dans un bourrelet plus sombre, clair du
 *  côté de la lumière et sombre à l'opposé. Chaque quart porte l'éclat à sa place dans le disque posé : bord à bord,
 *  leurs éclats n'en font qu'un. */
export const cadre: CadreDef = {
  id: 'sceau',
  label: 'Sceau',
  tranches,
  svg: `
    ${moities('sceau')}
    <clipPath id="sceau-cire"><rect ${contour(BOURRELET)}/></clipPath>
    ${quarts.map(({ i, x, y, dx, dy }) => `<radialGradient id="sceau-eclat-${i}" cx="${(ECLAT.x + dx - x) / QUART}" cy="${(ECLAT.y + dy - y) / QUART}" r="${ECLAT.portee / QUART}"><stop offset="0" stop-color="var(--cire-claire)"/><stop offset="1" stop-color="var(--cire)"/></radialGradient>`).join('')}
    <rect ${contour(0)} fill="var(--cire)"/>
    <rect ${contour(0)} fill="var(--cire-sombre)" opacity="0.3"/>
    <rect ${contour(1.5)} fill="none" stroke="var(--cire-claire)" stroke-width="3" opacity="0.14" clip-path="url(#sceau-lumiere)"/>
    <rect ${contour(1.5)} fill="none" stroke="var(--cire-sombre)" stroke-width="3" opacity="0.22" clip-path="url(#sceau-ombre)"/>
    <g clip-path="url(#sceau-cire)">
      ${quarts.map(({ i, x, y }) => `<rect x="${x}" y="${y}" width="${QUART}" height="${QUART}" fill="url(#sceau-eclat-${i})"/>`).join('')}
    </g>
  `,
};
