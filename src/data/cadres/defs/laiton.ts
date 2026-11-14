import type { CadreDef } from '../types';
import { biseau, trait } from '../biseau';

const COTE = 128;
/** La largeur du filet de laiton. */
const BANDE = 5;
/** Le côté de la plaque d'angle, qui déborde du filet sur l'image. */
const ANGLE = 9;
const TRANCHE = 10;

/** La plaque d'un angle, son coin `(x, y)`, ses côtés vers `(sx, sy)` : un carré de laiton bombé, ses arêtes au biseau
 *  du filet, un rivet en son milieu. */
const plaque = (x: number, y: number, sx: number, sy: number) => {
  const [gauche, haut] = [sx > 0 ? x : x - ANGLE, sy > 0 ? y : y - ANGLE];
  const [droite, bas] = [gauche + ANGLE, haut + ANGLE];
  const [cx, cy] = [gauche + ANGLE / 2, haut + ANGLE / 2];
  return (
    `<rect x="${gauche}" y="${haut}" width="${ANGLE}" height="${ANGLE}" fill="url(#laiton-plaque)"/>` +
    trait([gauche + 0.5, bas - 0.5], [gauche + 0.5, haut + 0.5], '--laiton-clair') + trait([gauche + 0.5, haut + 0.5], [droite - 0.5, haut + 0.5], '--laiton-clair') +
    trait([droite - 0.5, haut + 0.5], [droite - 0.5, bas - 0.5], '--laiton-sombre') + trait([droite - 0.5, bas - 0.5], [gauche + 0.5, bas - 0.5], '--laiton-sombre') +
    `<circle cx="${cx + 0.5}" cy="${cy + 0.5}" r="1.6" fill="var(--shadow-ink)" opacity="0.5"/>` +
    `<circle cx="${cx}" cy="${cy}" r="1.6" fill="var(--laiton)"/>` +
    `<circle cx="${cx - 0.5}" cy="${cy - 0.5}" r="0.6" fill="var(--laiton-clair)"/>`
  );
};

/** Laiton : un filet de laiton patiné à biseau (arête claire en haut à gauche, sombre en bas à droite, le revers
 *  du filet à l'inverse), un liseré d'encre contre l'image, une plaque rivetée à chaque angle. Le centre est vide :
 *  l'image du contenu s'y montre. */
export const cadre: CadreDef = {
  id: 'laiton',
  label: 'Laiton',
  tranches: [TRANCHE, TRANCHE, TRANCHE, TRANCHE],
  svg: `
    <linearGradient id="laiton-plaque" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--laiton-clair)"/><stop offset="0.45" stop-color="var(--laiton)"/><stop offset="1" stop-color="var(--laiton-sombre)"/>
    </linearGradient>
    <path fill-rule="evenodd" d="M0 0 H${COTE} V${COTE} H0 Z M${BANDE} ${BANDE} V${COTE - BANDE} H${COTE - BANDE} V${BANDE} Z" fill="var(--laiton)"/>
    ${biseau(0, '--laiton-clair', '--laiton-sombre')}
    ${biseau(2, '--laiton-clair', '--laiton-sombre', 0.35)}
    ${biseau(BANDE - 1, '--laiton-sombre', '--laiton-clair', 0.8)}
    <rect x="${BANDE + 0.5}" y="${BANDE + 0.5}" width="${COTE - 2 * BANDE - 1}" height="${COTE - 2 * BANDE - 1}" fill="none" stroke="var(--ink)" stroke-width="1"/>
    ${plaque(0, 0, 1, 1)}
    ${plaque(COTE, 0, -1, 1)}
    ${plaque(0, COTE, 1, -1)}
    ${plaque(COTE, COTE, -1, -1)}
  `,
};
