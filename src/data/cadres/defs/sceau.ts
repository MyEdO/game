import type { CadreDef } from '../types';
import { anneau, contour, moities, RAYON, reflet } from '../rond';

/** Sceau : un disque de cire rouge, son bord bourrelé (clair en haut à gauche, sombre en bas à droite), l'empreinte
 *  du cachet en creux, un reflet sur le bourrelet. */
export const cadre: CadreDef = {
  id: 'sceau',
  label: 'Sceau',
  tranches: [RAYON, RAYON, RAYON, RAYON],
  svg: `
    ${moities('sceau')}
    <rect ${contour(0)} fill="var(--cire-sombre)"/>
    <rect ${contour(1)} fill="var(--cire)"/>
    ${anneau('sceau', 1.5, '--cire-claire', '--cire-sombre', 0.7)}
    ${anneau('sceau', 4.5, '--cire-sombre', '--cire-claire', 0.6, 1.2)}
    ${reflet(2, '--cire-claire', 0.8)}
  `,
};
