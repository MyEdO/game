import type { CadreDef } from '../types';
import { moities, rond } from '../rond';

/** Le médaillon : un rond de 25, la taille du sceau qui lui répond au même jet (`art/jet_de_heros.tres`). */
const { anneau, contour, reflet, tranches } = rond(25);

/** Médaillon : un disque de laiton patiné, son listel bombé (arête claire en haut à gauche, sombre en bas à droite),
 *  son champ en creux, un reflet sur le listel. */
export const cadre: CadreDef = {
  id: 'medaillon',
  label: 'Médaillon',
  tranches,
  svg: `
    ${moities('medaillon')}
    <rect ${contour(0)} fill="var(--laiton-sombre)"/>
    <rect ${contour(1)} fill="var(--laiton)"/>
    ${anneau('medaillon', 1.5, '--laiton-clair', '--laiton-sombre', 0.9)}
    ${anneau('medaillon', 3.5, '--laiton-sombre', '--laiton-clair', 0.7)}
    ${reflet(2, '--laiton-clair', 0.9)}
  `,
};
