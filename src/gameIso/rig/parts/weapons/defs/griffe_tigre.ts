import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: 'griffe_tigre',
  label: 'Griffes de Tigre',
  type: 'melee',
  group: 'Bagarre',
  target: 'griffes montees sur la main (4 lames courbes saillant des jointures, type bagh-nakh)',
  art: "<!-- Griffes de Tigre : arme de Bagarre TENUE = poing ganté + 4 lames COURBES sur les jointures --><!-- paume / poing ferme --><g stroke=\"@metalO\" stroke-width=\"0.5\"><path d=\"M-8 4 Q-9 -8 -7 -14 Q-5 -19 1 -19 Q8 -19 10 -13 Q11 -5 10 3 Q9 9 2 10 Q-6 11 -8 4 Z\" fill=\"url(#dg-v-@peauH-@peauO)\"/></g><!-- doigts replies --><g fill=\"url(#dg-v-@peauH-@peauO)\" stroke=\"@metalO\" stroke-width=\"0.5\"><path d=\"M-7 -13 q-1 -6 3 -6 q3 0 3 6 q0 4 -3 5 q-3 0 -3 -5 z\"/><path d=\"M-1.5 -15 q-1 -6 3 -6 q3 0 3 6 q0 4 -3 5 q-3 0 -3 -5 z\"/><path d=\"M4 -14 q-1 -6 3 -6 q3 0 3 5 q0 4 -3 5 q-3 0 -3 -4 z\"/></g><!-- pouce --><path d=\"M-11 -3 Q-13 -8 -10 -11 Q-7 -12 -6 -8 L-6 1 Q-9 3 -11 -3 Z\" fill=\"url(#dg-v-@peauH-@peauO)\" stroke=\"@metalO\" stroke-width=\"0.5\"/><!-- sangle de cuir sur le dos de la main (fixe les griffes) --><path d=\"M-8 -10 Q1 -14.5 11 -9.5 L11 -5.5 Q1 -10.5 -8 -6 Z\" fill=\"@cuir\" stroke=\"@metalO\" stroke-width=\"0.5\"/><rect x=\"-8\" y=\"-9.6\" width=\"19\" height=\"1\" rx=\"0.5\" fill=\"@cuirH\" opacity=\"0.6\"/><!-- 4 GRIFFES recourbees emergeant des jointures (signature : lames COURBES, pas pointes droites) --><g fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.45\" stroke-linejoin=\"round\"><path d=\"M-7.6 -12 Q-12 -20 -10 -29 Q-7.4 -22 -5 -13 Z\"/><path d=\"M-3 -14 Q-7.4 -22 -5 -33 Q-2.4 -24 -0.5 -15 Z\"/><path d=\"M2.6 -14 Q-1.4 -22 1 -33 Q3.6 -24 5 -15 Z\"/><path d=\"M7.6 -12 Q3.6 -20 6 -30 Q8.6 -22 10 -13 Z\"/></g><!-- reflets le long des griffes --><g stroke=\"@metalH\" stroke-width=\"0.4\" fill=\"none\" opacity=\"0.6\"><path d=\"M-9.2 -27 Q-10.6 -20 -8 -14\"/><path d=\"M-4.6 -31 Q-6 -22 -3.4 -15\"/><path d=\"M0.4 -31 Q-1 -22 1.6 -16\"/><path d=\"M5.4 -28 Q4 -21 6.6 -14\"/></g>",
  palette: { metalO: '#2a3038', metalH: '#dfe6ef', metal: '#9aa6b8', cuir: '#6a4426', cuirH: '#a07a48' },
};
