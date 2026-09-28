import type { WingDef } from '../types';

// Aile de CUIR (membrane de chauve-souris : furie du Chaos, démons ailés). Membrane en JETONS @peau
// (suit la robe de la créature), bord inférieur festonné entre les doigts osseux, pouce-griffe au coude.
const aileCuir = (s: 1 | -1) =>
  `<path d="M${5 * s} -15 Q${13 * s} -26 ${17 * s} -38 L${20 * s} -34 Q${23 * s} -22 ${20 * s} -12 L${17 * s} -14 Q${18 * s} -4 ${14 * s} 2 L${11 * s} -2 Q${12 * s} 5 ${8 * s} 9 Q${10 * s} -4 ${6 * s} -11 Z" fill="@peauO" stroke="#1a1210" stroke-width="0.7"/>`
  + `<path d="M${6 * s} -14 Q${12 * s} -25 ${16 * s} -36" stroke="@peau" stroke-width="1.3" fill="none" stroke-linecap="round"/>`
  + `<path d="M${18 * s} -33 Q${20 * s} -22 ${18 * s} -13 M${16 * s} -15 Q${17 * s} -6 ${13 * s} 0 M${10 * s} -3 Q${11 * s} 3 ${8 * s} 8" stroke="@peau" stroke-width="0.6" fill="none" opacity="0.8"/>`
  + `<path d="M${16 * s} -37 l${2.4 * s} -2.6 l${0.8 * s} 3.4 Z" fill="#cdbfa4" stroke="#1a1210" stroke-width="0.4"/>`;

export const wing: WingDef = {
  id: 'cuir',
  label: 'Ailes de cuir',
  front: `<g data-trait="vol">${aileCuir(1)}${aileCuir(-1)}</g>`,
  back: `<g data-trait="vol">${aileCuir(1)}${aileCuir(-1)}<path d="M-2 -15 Q0 -5 0 7 Q0 -5 2 -15" stroke="#1a1210" stroke-width="0.8" fill="none" opacity="0.6"/></g>`,
  profile:
    '<g data-trait="vol">'
    + '<path d="M-2 -12 Q-12 -25 -17 -39 L-21 -34 Q-25 -21 -21 -10 L-17 -13 Q-19 -2 -14 4 L-11 0 Q-12 6 -7 10 Q-10 -3 -5 -10 Z" fill="@peauO" stroke="#1a1210" stroke-width="0.7"/>'
    + '<path d="M-3 -11 Q-11 -24 -16 -36" stroke="@peau" stroke-width="1.3" fill="none" stroke-linecap="round"/>'
    + '<path d="M-19 -33 Q-22 -21 -19 -12 M-16 -14 Q-18 -4 -13 2 M-10 -1 Q-11 4 -8 9" stroke="@peau" stroke-width="0.6" fill="none" opacity="0.8"/>'
    + '<path d="M-16 -38 l-2.6 -2.4 l-0.6 3.6 Z" fill="#cdbfa4" stroke="#1a1210" stroke-width="0.4"/>'
    + '</g>',
};
