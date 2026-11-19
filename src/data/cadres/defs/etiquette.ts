import type { CadreDef } from '../types';

const COTE = 128;
const TRANCHE = 4;
/** Le rayon des angles de l'étiquette. */
const RAYON = 2;

/** Étiquette : un billet de parchemin plus clair que la page qui le porte, éclairé vers le haut à droite, aux angles à
 *  peine arrondis, cerné d'un filet brun. */
export const cadre: CadreDef = {
  id: 'etiquette',
  label: 'Étiquette',
  tranches: [TRANCHE, TRANCHE, TRANCHE, TRANCHE],
  svg: `
    <radialGradient id="etiquette-jour" cx="0.75" cy="0.25" r="0.75">
      <stop offset="0" stop-color="var(--ivoire)" stop-opacity="0.6"/><stop offset="1" stop-color="var(--ivoire)" stop-opacity="0"/>
    </radialGradient>
    <rect x="0" y="0" width="${COTE}" height="${COTE}" rx="${RAYON}" fill="var(--parchment)"/>
    <rect x="0" y="0" width="${COTE}" height="${COTE}" rx="${RAYON}" fill="var(--ivoire)" opacity="0.55"/>
    <rect x="0" y="0" width="${COTE}" height="${COTE}" rx="${RAYON}" fill="url(#etiquette-jour)"/>
    <rect x="0.5" y="0.5" width="${COTE - 1}" height="${COTE - 1}" rx="${RAYON - 0.5}" fill="none" stroke="var(--laiton-sombre)" stroke-width="1" opacity="0.75"/>
  `,
};
